-- TenderMed Intelligence platform – catalog, recommendation feedback and supplier inquiries
--
-- Only organizations approved by the platform operator (supplier_approvals,
-- written with the service role by scripts/approve-supplier.mjs) can publish
-- catalog products. Published products of approved suppliers are visible to
-- every user with at least one membership; drafts only to the supplier.
-- Recommendations are computed in the application from the organization's
-- own data and published products (deterministic rules, no external data);
-- only the organization's feedback on them is stored here.
-- Supplier inquiries carry an explicit snapshot of what the requesting user
-- chose to share; suppliers never read the requesting organization's data.

create function private.has_any_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organization_memberships m where m.user_id = auth.uid())
$$;

create function private.can_publish_catalog(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_org, array['owner', 'admin'])
    and private.is_approved_supplier(p_org)
    and exists (select 1 from public.organizations o
                where o.id = p_org and o.kind in ('distributor', 'service_provider', 'manufacturer'))
$$;

revoke all on function private.has_any_membership(), private.can_publish_catalog(uuid) from public;
grant execute on function private.has_any_membership(), private.can_publish_catalog(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  supplier_organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  product_type text not null,
  category text not null,
  manufacturer_name text,
  model text,
  description text,
  status text not null default 'draft',
  published_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  unique (supplier_organization_id, id),
  constraint catalog_products_name_chk check (name = btrim(name) and char_length(name) between 2 and 160),
  constraint catalog_products_type_chk check (product_type in ('device', 'accessory', 'consumable', 'spare_part', 'service')),
  constraint catalog_products_category_chk check (category in (
    'patient_monitoring', 'infusion', 'defibrillation', 'ultrasound_imaging', 'radiology_imaging',
    'sterilization', 'physiotherapy', 'laboratory', 'ecg', 'suction', 'ventilation', 'other')),
  constraint catalog_products_text_chk check (
    coalesce(char_length(manufacturer_name), 0) <= 120 and coalesce(char_length(model), 0) <= 120
    and coalesce(char_length(description), 0) <= 4000),
  constraint catalog_products_status_chk check (status in ('draft', 'published', 'archived'))
);

create index catalog_products_published_idx on public.catalog_products (category, product_type) where status = 'published';

create table public.catalog_compatibility (
  id uuid primary key default gen_random_uuid(),
  supplier_organization_id uuid not null,
  product_id uuid not null,
  manufacturer_name text not null,
  model text not null,
  foreign key (supplier_organization_id, product_id)
    references public.catalog_products (supplier_organization_id, id) on delete cascade,
  constraint catalog_compatibility_text_chk check (
    char_length(btrim(manufacturer_name)) between 1 and 120 and char_length(btrim(model)) between 1 and 120)
);

create unique index catalog_compatibility_uq on public.catalog_compatibility (product_id, lower(manufacturer_name), lower(model));
create index catalog_compatibility_model_idx on public.catalog_compatibility (lower(manufacturer_name), lower(model));

create table public.catalog_sources (
  id uuid primary key default gen_random_uuid(),
  supplier_organization_id uuid not null,
  product_id uuid not null,
  title text not null,
  url text not null,
  retrieved_on date,
  foreign key (supplier_organization_id, product_id)
    references public.catalog_products (supplier_organization_id, id) on delete cascade,
  constraint catalog_sources_title_chk check (char_length(btrim(title)) between 2 and 200),
  constraint catalog_sources_url_chk check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 500)
);

-- Draft → published → archived (archived products can be republished).
create function private.catalog_product_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  end if;
  if tg_op = 'UPDATE' and new.supplier_organization_id <> old.supplier_organization_id then
    raise exception 'TM_ORGANIZATION_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger catalog_products_rules before insert or update on public.catalog_products
  for each row execute function private.catalog_product_rules();
create trigger catalog_products_stamp before insert or update on public.catalog_products
  for each row execute function private.stamp_row();

-- Saves a product with its compatibility list and sources in one
-- transaction (security invoker: RLS and column privileges apply).
create function public.save_catalog_product(
  p_supplier uuid,
  p_product uuid,
  p_version integer,
  p_data jsonb,
  p_compatibility jsonb,
  p_sources jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_publish_catalog(p_supplier) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_compatibility, '[]')) > 100 or jsonb_array_length(coalesce(p_sources, '[]')) > 20 then
    raise exception 'TM_IMPORT_TOO_LARGE' using errcode = 'P0001';
  end if;
  if p_product is null then
    insert into public.catalog_products (supplier_organization_id, name, product_type, category, manufacturer_name, model, description)
    values (p_supplier, p_data ->> 'name', p_data ->> 'product_type', p_data ->> 'category',
            nullif(p_data ->> 'manufacturer_name', ''), nullif(p_data ->> 'model', ''), nullif(p_data ->> 'description', ''))
    returning id into v_id;
  else
    update public.catalog_products p set
      name = p_data ->> 'name',
      product_type = p_data ->> 'product_type',
      category = p_data ->> 'category',
      manufacturer_name = nullif(p_data ->> 'manufacturer_name', ''),
      model = nullif(p_data ->> 'model', ''),
      description = nullif(p_data ->> 'description', '')
    where p.id = p_product and p.supplier_organization_id = p_supplier and p.version = p_version
    returning p.id into v_id;
    if v_id is null then
      raise exception 'TM_VERSION_CONFLICT' using errcode = 'P0001';
    end if;
    delete from public.catalog_compatibility c where c.product_id = v_id;
    delete from public.catalog_sources s where s.product_id = v_id;
  end if;

  insert into public.catalog_compatibility (supplier_organization_id, product_id, manufacturer_name, model)
  select distinct on (lower(btrim(x ->> 'manufacturer_name')), lower(btrim(x ->> 'model')))
    p_supplier, v_id, btrim(x ->> 'manufacturer_name'), btrim(x ->> 'model')
  from jsonb_array_elements(coalesce(p_compatibility, '[]')) x;
  insert into public.catalog_sources (supplier_organization_id, product_id, title, url, retrieved_on)
  select p_supplier, v_id, btrim(x ->> 'title'), btrim(x ->> 'url'), nullif(x ->> 'retrieved_on', '')::date
  from jsonb_array_elements(coalesce(p_sources, '[]')) x;
  return v_id;
end;
$$;

revoke all on function public.save_catalog_product(uuid, uuid, integer, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_catalog_product(uuid, uuid, integer, jsonb, jsonb, jsonb) to authenticated;

-- Approved suppliers with their declared commercial relationship to the
-- platform operator (shown next to their products).
create function public.catalog_suppliers()
returns table (organization_id uuid, name text, commercial_relationship text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, s.commercial_relationship
  from public.supplier_approvals s
  join public.organizations o on o.id = s.organization_id
  where s.status = 'approved' and private.has_any_membership()
$$;

revoke all on function public.catalog_suppliers() from public, anon;
grant execute on function public.catalog_suppliers() to authenticated;

-- ---------------------------------------------------------------------------
-- Organization-side data
-- ---------------------------------------------------------------------------

create table public.catalog_private_notes (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.catalog_products (id) on delete cascade,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (organization_id, product_id),
  constraint catalog_private_notes_body_chk check (char_length(body) between 1 and 4000)
);

create table public.recommendation_feedback (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.catalog_products (id) on delete cascade,
  rule_key text not null,
  status text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (organization_id, product_id, rule_key),
  constraint recommendation_feedback_status_chk check (status in ('saved', 'dismissed', 'info_requested', 'reviewed')),
  constraint recommendation_feedback_rule_chk check (rule_key ~ '^[a-z_]+:[0-9a-z_:-]{1,120}$')
);

create function private.set_editor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger catalog_private_notes_editor before insert or update on public.catalog_private_notes
  for each row execute function private.set_editor();
create trigger recommendation_feedback_editor before insert or update on public.recommendation_feedback
  for each row execute function private.set_editor();

-- ---------------------------------------------------------------------------
-- Supplier inquiries
-- ---------------------------------------------------------------------------

create table public.supplier_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null,
  message text not null,
  shared_snapshot jsonb not null,
  status text not null default 'sent',
  response_text text,
  responded_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (supplier_organization_id, product_id)
    references public.catalog_products (supplier_organization_id, id) on delete cascade,
  constraint supplier_inquiries_message_chk check (char_length(btrim(message)) between 3 and 2000),
  constraint supplier_inquiries_snapshot_chk check (
    jsonb_typeof(shared_snapshot) = 'object' and octet_length(shared_snapshot::text) <= 20000),
  constraint supplier_inquiries_status_chk check (status in ('sent', 'answered', 'closed')),
  constraint supplier_inquiries_response_chk check (response_text is null or char_length(response_text) between 1 and 4000),
  constraint supplier_inquiries_distinct_chk check (organization_id <> supplier_organization_id)
);

create index supplier_inquiries_org_idx on public.supplier_inquiries (organization_id, created_at desc);
create index supplier_inquiries_supplier_idx on public.supplier_inquiries (supplier_organization_id, created_at desc);

-- Insert: the product must be published by an approved supplier; author and
-- time are set here. Update: the supplier answers (response, status
-- answered); the requesting organization may only close.
create function private.supplier_inquiry_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.catalog_products p
                   where p.id = new.product_id and p.supplier_organization_id = new.supplier_organization_id
                     and p.status = 'published')
       or not private.is_approved_supplier(new.supplier_organization_id) then
      raise exception 'TM_PRODUCT_NOT_AVAILABLE' using errcode = 'P0001';
    end if;
    new.status := 'sent';
    new.response_text := null;
    new.responded_at := null;
    new.responded_by := null;
    new.created_by := auth.uid();
    new.created_at := now();
    return new;
  end if;

  if private.has_org_role(old.supplier_organization_id, array['owner', 'admin']) then
    if old.status = 'closed' or new.status not in ('answered', 'closed') or new.response_text is null then
      raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    new.responded_at := now();
    new.responded_by := auth.uid();
  else
    if new.status <> 'closed' or new.response_text is distinct from old.response_text then
      raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger supplier_inquiries_rules before insert or update on public.supplier_inquiries
  for each row execute function private.supplier_inquiry_rules();

alter table public.notifications drop constraint notifications_kind_chk;
alter table public.notifications add constraint notifications_kind_chk
  check (kind in ('due_reminder', 'overdue_reminder', 'service_update', 'assignment', 'supplier_inquiry'));

create function private.supplier_inquiry_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_product text;
begin
  select p.name into v_product from public.catalog_products p where p.id = new.product_id;
  if tg_op = 'INSERT' then
    for v_user in
      select m.user_id from public.organization_memberships m
      where m.organization_id = new.supplier_organization_id and m.role in ('owner', 'admin')
    loop
      perform private.enqueue_notification(v_user, new.supplier_organization_id, null, 'supplier_inquiry',
        'Novo povpraševanje: ' || v_product, null,
        '/app/' || new.supplier_organization_id || '/katalog/povprasevanja', 'inquiry:' || new.id);
    end loop;
  elsif new.status = 'answered' and old.status <> 'answered' and new.created_by is not null then
    perform private.enqueue_notification(new.created_by, new.organization_id, null, 'supplier_inquiry',
      'Odgovor na povpraševanje: ' || v_product, null,
      '/app/' || new.organization_id || '/katalog/povprasevanja', 'inquiry-answer:' || new.id);
  end if;
  return new;
end;
$$;

create trigger supplier_inquiries_notify after insert or update on public.supplier_inquiries
  for each row execute function private.supplier_inquiry_notifications();

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

-- Catalog rows belong to the supplier organization (supplier_organization_id).
create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
  v_entity uuid;
  v_changed text[] := '{}';
begin
  v_org := coalesce((v_row ->> 'organization_id')::uuid,
                    (v_row ->> 'supplier_organization_id')::uuid,
                    case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid end);
  v_entity := coalesce((v_row ->> 'id')::uuid, (v_row ->> 'user_id')::uuid);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), '{}') into v_changed
    from jsonb_each(v_new) n
    where n.key not in ('updated_at', 'version')
      and n.value is distinct from v_old -> n.key;
    if array_length(v_changed, 1) is null then
      return new;
    end if;
  end if;

  insert into public.audit_events (organization_id, actor_user_id, entity_type, entity_id, action, changed_columns)
  values (v_org, auth.uid(), tg_table_name, v_entity, lower(tg_op), v_changed);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger catalog_products_audit after insert or update on public.catalog_products
  for each row execute function private.audit_row();
create function private.audit_supplier_inquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Recorded for the requesting organization and for the supplier.
  insert into public.audit_events (organization_id, actor_user_id, entity_type, entity_id, action, changed_columns)
  select org, auth.uid(), 'supplier_inquiries', new.id, lower(tg_op), '{}'::text[]
  from unnest(array[new.organization_id, new.supplier_organization_id]) org;
  return new;
end;
$$;
create trigger supplier_inquiries_audit after insert or update on public.supplier_inquiries
  for each row execute function private.audit_supplier_inquiry();

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------

alter table public.catalog_products enable row level security;
alter table public.catalog_compatibility enable row level security;
alter table public.catalog_sources enable row level security;
alter table public.catalog_private_notes enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.supplier_inquiries enable row level security;

revoke all on table public.catalog_products, public.catalog_compatibility, public.catalog_sources,
  public.catalog_private_notes, public.recommendation_feedback, public.supplier_inquiries
  from public, anon, authenticated;

grant select,
  insert (supplier_organization_id, name, product_type, category, manufacturer_name, model, description, status),
  update (name, product_type, category, manufacturer_name, model, description, status)
  on table public.catalog_products to authenticated;
grant select, insert (supplier_organization_id, product_id, manufacturer_name, model), delete
  on table public.catalog_compatibility to authenticated;
grant select, insert (supplier_organization_id, product_id, title, url, retrieved_on), delete
  on table public.catalog_sources to authenticated;
grant select, insert (organization_id, product_id, body), update (body), delete
  on table public.catalog_private_notes to authenticated;
grant select, insert (organization_id, product_id, rule_key, status), update (status), delete
  on table public.recommendation_feedback to authenticated;
grant select, insert (organization_id, supplier_organization_id, product_id, message, shared_snapshot),
  update (status, response_text) on table public.supplier_inquiries to authenticated;

grant all on table public.catalog_products, public.catalog_compatibility, public.catalog_sources,
  public.catalog_private_notes, public.recommendation_feedback, public.supplier_inquiries to service_role;

create policy catalog_products_select on public.catalog_products for select to authenticated
  using (
    private.is_org_member(supplier_organization_id)
    or (status = 'published' and private.is_approved_supplier(supplier_organization_id) and private.has_any_membership()));
create policy catalog_products_insert on public.catalog_products for insert to authenticated
  with check (private.can_publish_catalog(supplier_organization_id));
create policy catalog_products_update on public.catalog_products for update to authenticated
  using (private.can_publish_catalog(supplier_organization_id))
  with check (private.can_publish_catalog(supplier_organization_id));

create policy catalog_compatibility_select on public.catalog_compatibility for select to authenticated
  using (exists (select 1 from public.catalog_products p where p.id = product_id));
create policy catalog_compatibility_write on public.catalog_compatibility for insert to authenticated
  with check (private.can_publish_catalog(supplier_organization_id));
create policy catalog_compatibility_delete on public.catalog_compatibility for delete to authenticated
  using (private.can_publish_catalog(supplier_organization_id));

create policy catalog_sources_select on public.catalog_sources for select to authenticated
  using (exists (select 1 from public.catalog_products p where p.id = product_id));
create policy catalog_sources_write on public.catalog_sources for insert to authenticated
  with check (private.can_publish_catalog(supplier_organization_id));
create policy catalog_sources_delete on public.catalog_sources for delete to authenticated
  using (private.can_publish_catalog(supplier_organization_id));

create policy catalog_private_notes_select on public.catalog_private_notes for select to authenticated
  using (private.is_org_member(organization_id));
create policy catalog_private_notes_insert on public.catalog_private_notes for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager'])
    and exists (select 1 from public.catalog_products p where p.id = product_id));
create policy catalog_private_notes_update on public.catalog_private_notes for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
create policy catalog_private_notes_delete on public.catalog_private_notes for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));

create policy recommendation_feedback_select on public.recommendation_feedback for select to authenticated
  using (private.is_org_member(organization_id));
create policy recommendation_feedback_insert on public.recommendation_feedback for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager'])
    and exists (select 1 from public.catalog_products p where p.id = product_id));
create policy recommendation_feedback_update on public.recommendation_feedback for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
create policy recommendation_feedback_delete on public.recommendation_feedback for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));

create policy supplier_inquiries_select on public.supplier_inquiries for select to authenticated
  using (private.is_org_member(organization_id) or private.is_org_member(supplier_organization_id));
create policy supplier_inquiries_insert on public.supplier_inquiries for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
create policy supplier_inquiries_update on public.supplier_inquiries for update to authenticated
  using (
    private.has_org_role(supplier_organization_id, array['owner', 'admin'])
    or private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (
    private.has_org_role(supplier_organization_id, array['owner', 'admin'])
    or private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
