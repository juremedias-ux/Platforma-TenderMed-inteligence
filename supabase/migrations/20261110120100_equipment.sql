-- TenderMed Intelligence platform – equipment register and maintenance plans
--
-- Organization-consistent relationships use composite foreign keys
-- (organization_id, id), so a row can never reference a location, device or
-- plan of another organization. organization_id is immutable after insert.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function private.prevent_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'TM_ORGANIZATION_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Sets authorship and bumps the optimistic-concurrency version.
create function private.stamp_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.version := 1;
  else
    new.version := old.version + 1;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

-- True when p_user is a member of p_org (definer: the caller may not be able
-- to read that membership row directly).
create function private.user_is_member(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships m where m.organization_id = p_org and m.user_id = p_user)
$$;

revoke all on function private.user_is_member(uuid, uuid) from public;
grant execute on function private.user_is_member(uuid, uuid) to authenticated, service_role;

create function private.check_responsible_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.responsible_user_id is not null
     and not private.user_is_member(new.organization_id, new.responsible_user_id) then
    raise exception 'TM_RESPONSIBLE_NOT_MEMBER' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  unique (organization_id, id),
  constraint locations_name_chk check (name = btrim(name) and char_length(name) between 1 and 120)
);

create unique index locations_name_uq on public.locations (organization_id, lower(name));

create trigger locations_org_immutable before update on public.locations
  for each row execute function private.prevent_organization_change();
create trigger locations_stamp before insert or update on public.locations
  for each row execute function private.stamp_row();

-- ---------------------------------------------------------------------------
-- equipment
-- ---------------------------------------------------------------------------

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  asset_tag text,
  name text not null,
  category text not null,
  manufacturer_name text,
  model text,
  serial_number text,
  location_id uuid,
  responsible_user_id uuid references public.profiles (id) on delete set null,
  purchase_date date,
  commissioning_date date,
  warranty_end_date date,
  status text not null default 'active',
  -- Optional reference to a catalog product (foreign key added with the catalog).
  product_id uuid,
  notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, location_id) references public.locations (organization_id, id),
  constraint equipment_name_chk check (name = btrim(name) and char_length(name) between 2 and 160),
  constraint equipment_asset_tag_chk check (asset_tag is null or (asset_tag = btrim(asset_tag) and char_length(asset_tag) between 1 and 64)),
  constraint equipment_text_lengths_chk check (
    coalesce(char_length(manufacturer_name), 0) <= 120 and coalesce(char_length(model), 0) <= 120
    and coalesce(char_length(serial_number), 0) <= 120 and coalesce(char_length(notes), 0) <= 4000),
  constraint equipment_category_chk check (category in (
    'patient_monitoring', 'infusion', 'defibrillation', 'ultrasound_imaging', 'radiology_imaging',
    'sterilization', 'physiotherapy', 'laboratory', 'ecg', 'suction', 'ventilation', 'other')),
  constraint equipment_status_chk check (status in ('active', 'in_service', 'temporarily_out', 'archived'))
);

create unique index equipment_asset_tag_uq on public.equipment (organization_id, lower(asset_tag)) where asset_tag is not null;
create unique index equipment_serial_uq on public.equipment (organization_id, lower(coalesce(manufacturer_name, '')), lower(serial_number))
  where serial_number is not null;
create index equipment_org_status_idx on public.equipment (organization_id, status);
create index equipment_org_category_idx on public.equipment (organization_id, category);
create index equipment_org_location_idx on public.equipment (organization_id, location_id);

create trigger equipment_org_immutable before update on public.equipment
  for each row execute function private.prevent_organization_change();
create trigger equipment_stamp before insert or update on public.equipment
  for each row execute function private.stamp_row();
create trigger equipment_responsible before insert or update of responsible_user_id on public.equipment
  for each row execute function private.check_responsible_member();

-- ---------------------------------------------------------------------------
-- maintenance plans
--
-- Scheduling modes (docs/security-model.md → Maintenance scheduling):
--   fixed_calendar   – due dates anchor_date + k × interval_months (each date
--                      computed from the anchor, month-end clamped). Each
--                      qualifying completion covers the earliest outstanding
--                      due date; late completions skip dates already passed.
--   after_completion – next due = last qualifying completion + interval;
--                      anchor_date is the first due date before any completion.
--   one_off          – a single explicit due date; done after one completion.
-- next_due_date and last_completed_on are derived and maintained by triggers.
-- ---------------------------------------------------------------------------

create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  equipment_id uuid not null,
  activity_type text not null,
  activity_label text,
  schedule_mode text not null,
  interval_months integer,
  anchor_date date,
  due_date date,
  last_completed_on date,
  next_due_date date,
  responsible_user_id uuid references public.profiles (id) on delete set null,
  reminder_days integer[] not null default '{30,7}',
  source_basis text not null,
  source_note text,
  -- Optional document stating the requirement (foreign key added with documents).
  source_document_id uuid,
  status text not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, equipment_id) references public.equipment (organization_id, id) on delete cascade,
  constraint maintenance_plans_activity_chk check (activity_type in ('preventive_maintenance', 'inspection', 'calibration', 'other')),
  constraint maintenance_plans_label_chk check (
    (activity_type <> 'other' or activity_label is not null)
    and (activity_label is null or (activity_label = btrim(activity_label) and char_length(activity_label) between 2 and 120))),
  constraint maintenance_plans_mode_chk check (schedule_mode in ('fixed_calendar', 'after_completion', 'one_off')),
  constraint maintenance_plans_shape_chk check (
    (schedule_mode in ('fixed_calendar', 'after_completion') and interval_months between 1 and 120
       and anchor_date is not null and due_date is null)
    or (schedule_mode = 'one_off' and due_date is not null and interval_months is null)),
  constraint maintenance_plans_reminders_chk check (
    cardinality(reminder_days) <= 5 and 0 <= all (reminder_days) and 366 > all (reminder_days)),
  constraint maintenance_plans_source_chk check (source_basis in (
    'manufacturer_instructions', 'organization_procedure', 'service_contract', 'legal_requirement', 'other')),
  constraint maintenance_plans_source_note_chk check (source_note is null or char_length(source_note) <= 500),
  constraint maintenance_plans_status_chk check (status in ('active', 'archived'))
);

create index maintenance_plans_equipment_idx on public.maintenance_plans (organization_id, equipment_id);
create index maintenance_plans_due_idx on public.maintenance_plans (next_due_date) where status = 'active';

-- Pure scheduling function, shared by triggers and tests. p_completions must
-- be the qualifying completion dates in ascending order.
create function private.compute_next_due(
  p_mode text,
  p_interval integer,
  p_anchor date,
  p_due date,
  p_completions date[]
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_k integer := 0;
  v_next date;
  v_done date;
begin
  if p_mode = 'one_off' then
    return case when cardinality(p_completions) > 0 then null else p_due end;
  end if;

  if p_mode = 'after_completion' then
    if cardinality(p_completions) = 0 then
      return p_anchor;
    end if;
    return (p_completions[cardinality(p_completions)] + make_interval(months => p_interval))::date;
  end if;

  -- fixed_calendar
  v_next := p_anchor;
  foreach v_done in array p_completions loop
    v_k := v_k + 1;
    v_next := (p_anchor + make_interval(months => v_k * p_interval))::date;
    while v_next <= v_done loop
      v_k := v_k + 1;
      v_next := (p_anchor + make_interval(months => v_k * p_interval))::date;
    end loop;
  end loop;
  return v_next;
end;
$$;

-- Qualifying completion dates of a plan. Replaced by the service migration
-- once completion records exist.
create function private.plan_completion_dates(p_plan uuid)
returns date[]
language sql
stable
security definer
set search_path = ''
as $$
  select '{}'::date[]
$$;

revoke all on function private.plan_completion_dates(uuid) from public;
grant execute on function private.plan_completion_dates(uuid) to authenticated, service_role;
grant execute on function private.compute_next_due(text, integer, date, date, date[]) to authenticated, service_role;

create function private.derive_plan_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dates date[] := case when tg_op = 'INSERT' then '{}'::date[] else private.plan_completion_dates(new.id) end;
begin
  new.last_completed_on := v_dates[cardinality(v_dates)];
  new.next_due_date := private.compute_next_due(new.schedule_mode, new.interval_months, new.anchor_date, new.due_date, v_dates);
  return new;
end;
$$;

create trigger maintenance_plans_org_immutable before update on public.maintenance_plans
  for each row execute function private.prevent_organization_change();
create trigger maintenance_plans_stamp before insert or update on public.maintenance_plans
  for each row execute function private.stamp_row();
create trigger maintenance_plans_responsible before insert or update of responsible_user_id on public.maintenance_plans
  for each row execute function private.check_responsible_member();
create trigger maintenance_plans_derive before insert or update on public.maintenance_plans
  for each row execute function private.derive_plan_dates();

-- Equipment list with the earliest active due date (RLS of the base tables
-- applies because the view runs with the caller's privileges).
create view public.equipment_overview
with (security_invoker = true)
as
select
  e.*,
  l.name as location_name,
  (select min(p.next_due_date) from public.maintenance_plans p
   where p.equipment_id = e.id and p.organization_id = e.organization_id and p.status = 'active') as next_due_date
from public.equipment e
left join public.locations l on l.id = e.location_id and l.organization_id = e.organization_id;

-- Open due dates of active plans on non-archived equipment (calendar,
-- overview counts and reminders). Runs with the caller's privileges.
create view public.maintenance_agenda
with (security_invoker = true)
as
select
  p.id,
  p.organization_id,
  p.equipment_id,
  p.activity_type,
  p.activity_label,
  p.schedule_mode,
  p.next_due_date,
  p.last_completed_on,
  p.responsible_user_id,
  p.reminder_days,
  e.name as equipment_name,
  e.asset_tag,
  e.status as equipment_status,
  e.location_id,
  l.name as location_name
from public.maintenance_plans p
join public.equipment e on e.organization_id = p.organization_id and e.id = p.equipment_id
left join public.locations l on l.organization_id = e.organization_id and l.id = e.location_id
where p.status = 'active' and e.status <> 'archived' and p.next_due_date is not null;

-- ---------------------------------------------------------------------------
-- Transactional CSV import (all rows or none)
-- ---------------------------------------------------------------------------

create function public.import_equipment(p_org uuid, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_location uuid;
  v_count integer := 0;
begin
  if not private.has_org_role(p_org, array['owner', 'admin', 'equipment_manager']) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'TM_IMPORT_EMPTY' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'TM_IMPORT_TOO_LARGE' using errcode = 'P0001';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_location := null;
    if nullif(btrim(v_row ->> 'location'), '') is not null then
      select l.id into v_location from public.locations l
      where l.organization_id = p_org and lower(l.name) = lower(btrim(v_row ->> 'location'));
      if v_location is null then
        insert into public.locations (organization_id, name)
        values (p_org, btrim(v_row ->> 'location')) returning id into v_location;
      end if;
    end if;

    insert into public.equipment (
      organization_id, asset_tag, name, category, manufacturer_name, model, serial_number, location_id,
      purchase_date, commissioning_date, warranty_end_date, status, notes)
    values (
      p_org,
      nullif(btrim(v_row ->> 'asset_tag'), ''),
      btrim(v_row ->> 'name'),
      v_row ->> 'category',
      nullif(btrim(v_row ->> 'manufacturer_name'), ''),
      nullif(btrim(v_row ->> 'model'), ''),
      nullif(btrim(v_row ->> 'serial_number'), ''),
      v_location,
      nullif(v_row ->> 'purchase_date', '')::date,
      nullif(v_row ->> 'commissioning_date', '')::date,
      nullif(v_row ->> 'warranty_end_date', '')::date,
      coalesce(nullif(v_row ->> 'status', ''), 'active'),
      nullif(btrim(v_row ->> 'notes'), ''));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.import_equipment(uuid, jsonb) from public, anon;
grant execute on function public.import_equipment(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create trigger locations_audit after insert or update on public.locations
  for each row execute function private.audit_row();
create trigger equipment_audit after insert or update on public.equipment
  for each row execute function private.audit_row();
create trigger maintenance_plans_audit after insert or update on public.maintenance_plans
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- RLS and privileges (no deletes: archive instead)
-- ---------------------------------------------------------------------------

alter table public.locations enable row level security;
alter table public.equipment enable row level security;
alter table public.maintenance_plans enable row level security;

revoke all on table public.locations, public.equipment, public.maintenance_plans, public.equipment_overview,
  public.maintenance_agenda from public, anon, authenticated;

grant select, insert (organization_id, name), update (name, archived_at) on table public.locations to authenticated;
grant select,
  insert (organization_id, asset_tag, name, category, manufacturer_name, model, serial_number, location_id,
          responsible_user_id, purchase_date, commissioning_date, warranty_end_date, status, notes),
  update (asset_tag, name, category, manufacturer_name, model, serial_number, location_id, responsible_user_id,
          purchase_date, commissioning_date, warranty_end_date, status, notes)
  on table public.equipment to authenticated;
grant select,
  insert (organization_id, equipment_id, activity_type, activity_label, schedule_mode, interval_months, anchor_date,
          due_date, responsible_user_id, reminder_days, source_basis, source_note, source_document_id, status),
  update (activity_type, activity_label, schedule_mode, interval_months, anchor_date, due_date, responsible_user_id,
          reminder_days, source_basis, source_note, source_document_id, status)
  on table public.maintenance_plans to authenticated;
grant select on table public.equipment_overview, public.maintenance_agenda to authenticated;

grant all on table public.locations, public.equipment, public.maintenance_plans, public.equipment_overview,
  public.maintenance_agenda to service_role;

create policy locations_select on public.locations for select to authenticated
  using (private.is_org_member(organization_id));
create policy locations_write on public.locations for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
create policy locations_update on public.locations for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));

create policy equipment_select on public.equipment for select to authenticated
  using (private.is_org_member(organization_id));
create policy equipment_insert on public.equipment for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
create policy equipment_update on public.equipment for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));

create policy maintenance_plans_select on public.maintenance_plans for select to authenticated
  using (private.is_org_member(organization_id));
create policy maintenance_plans_insert on public.maintenance_plans for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
create policy maintenance_plans_update on public.maintenance_plans for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
