-- TenderMed Intelligence platform – private documents
--
-- Files live in the private Storage bucket `documents` at the fixed path
-- `<organization_id>/<document_id>` (no user-controlled path segments).
-- Upload flow:
--   1. create_pending_document() checks the caller and creates a `pending` row;
--   2. the server issues a short-lived signed upload URL for that path;
--   3. the server verifies the uploaded object (size, magic bytes) with the
--      service role and calls finalize_document() → `ready` or `rejected`.
-- Downloads: the server checks the row through RLS and issues a 60-second
-- signed URL. Storage RLS additionally allows authenticated reads only for
-- objects whose `ready` document row the caller can read. Clients cannot
-- insert, update or delete objects directly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
on conflict (id) do nothing;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  equipment_id uuid,
  service_request_id uuid,
  document_type text not null,
  title text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null unique,
  status text not null default 'pending',
  shared_with_assignees boolean not null default false,
  uploaded_as text not null,
  finalized_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  unique (organization_id, id),
  foreign key (organization_id, equipment_id) references public.equipment (organization_id, id),
  foreign key (organization_id, service_request_id) references public.service_requests (organization_id, id) on delete cascade,
  constraint documents_path_chk check (storage_path = organization_id::text || '/' || id::text),
  constraint documents_type_chk check (document_type in (
    'instructions_for_use', 'service_report', 'calibration_report', 'inspection_report', 'warranty_certificate',
    'acceptance_record', 'declaration_of_conformity', 'technical_datasheet', 'service_contract', 'other')),
  constraint documents_title_chk check (title = btrim(title) and char_length(title) between 2 and 160),
  constraint documents_file_name_chk check (
    char_length(file_name) between 1 and 200 and file_name !~ '[/\\[:cntrl:]]'),
  constraint documents_mime_chk check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  constraint documents_size_chk check (size_bytes between 1 and 20971520),
  constraint documents_status_chk check (status in ('pending', 'ready', 'rejected')),
  constraint documents_finalized_chk check ((status = 'ready') = (finalized_at is not null)),
  constraint documents_uploaded_as_chk check (uploaded_as in ('member', 'assignee')),
  constraint documents_sharing_chk check (not shared_with_assignees or service_request_id is not null)
);

create index documents_equipment_idx on public.documents (organization_id, equipment_id) where status = 'ready';
create index documents_request_idx on public.documents (service_request_id) where status = 'ready';
create index documents_pending_idx on public.documents (created_at) where status = 'pending';

alter table public.maintenance_plans
  add constraint maintenance_plans_source_document_fk foreign key (organization_id, source_document_id)
  references public.documents (organization_id, id);

-- Clients may edit metadata of ready documents only.
create function private.document_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and old.status <> 'ready' then
    raise exception 'TM_DOCUMENT_NOT_READY' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger documents_org_immutable before update on public.documents
  for each row execute function private.prevent_organization_change();
create trigger documents_rules before update on public.documents
  for each row execute function private.document_rules();
create trigger documents_stamp before insert or update on public.documents
  for each row execute function private.stamp_row();
create trigger documents_audit after insert or update on public.documents
  for each row execute function private.audit_row();

-- Read access to a document row (used by RLS on documents and storage).
create function private.can_read_document(p_org uuid, p_request uuid, p_shared boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_member(p_org)
    or (p_request is not null and p_shared and private.is_request_assignee(p_request))
$$;

revoke all on function private.can_read_document(uuid, uuid, boolean) from public;
grant execute on function private.can_read_document(uuid, uuid, boolean) to authenticated, service_role;

create function public.create_pending_document(
  p_org uuid,
  p_equipment uuid,
  p_request uuid,
  p_type text,
  p_title text,
  p_file_name text,
  p_mime text,
  p_size bigint,
  p_shared boolean default false
)
returns table (document_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_operator boolean;
  v_assignee boolean := false;
  v_equipment uuid := p_equipment;
  v_id uuid := gen_random_uuid();
  v_request_org uuid;
  v_request_equipment uuid;
begin
  if v_uid is null then
    raise exception 'TM_NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  v_operator := private.has_org_role(p_org, array['owner', 'admin', 'equipment_manager']);

  if p_request is not null then
    select r.organization_id, r.equipment_id into v_request_org, v_request_equipment
    from public.service_requests r where r.id = p_request;
    if v_request_org is distinct from p_org then
      raise exception 'TM_NOT_FOUND' using errcode = 'P0001';
    end if;
    v_assignee := private.is_request_assignee(p_request);
    v_equipment := v_request_equipment;
  elsif p_equipment is not null and not exists (
          select 1 from public.equipment e where e.organization_id = p_org and e.id = p_equipment) then
    raise exception 'TM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not (v_operator or v_assignee) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  if (select count(*) from public.documents d
      where d.created_by = v_uid and d.status = 'pending' and d.created_at > now() - interval '1 day') >= 20 then
    raise exception 'TM_TOO_MANY_PENDING' using errcode = 'P0001';
  end if;

  insert into public.documents (id, organization_id, equipment_id, service_request_id, document_type, title, file_name,
    mime_type, size_bytes, storage_path, shared_with_assignees, uploaded_as)
  values (v_id, p_org, v_equipment, p_request, p_type, btrim(p_title), p_file_name, p_mime, p_size,
    p_org::text || '/' || v_id::text,
    case when v_operator then coalesce(p_shared, false) and p_request is not null else true end,
    case when v_operator then 'member' else 'assignee' end);

  if p_request is not null then
    perform private.log_service_event(p_org, p_request, 'document_added', null, null, v_id::text);
  end if;
  return query select v_id, p_org::text || '/' || v_id::text;
end;
$$;

-- Service role only: called by the server after verifying the stored object.
create function public.finalize_document(p_document uuid, p_ok boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.documents d set
    status = case when p_ok then 'ready' else 'rejected' end,
    finalized_at = case when p_ok then now() end
  where d.id = p_document and d.status = 'pending';
  if not found then
    raise exception 'TM_DOCUMENT_NOT_PENDING' using errcode = 'P0001';
  end if;
end;
$$;

-- Service role only: pending uploads older than p_age are marked rejected;
-- returns their storage paths so the caller can delete orphaned objects.
create function public.expire_pending_documents(p_age interval default interval '1 day')
returns table (storage_path text)
language sql
security invoker
set search_path = ''
as $$
  update public.documents d set status = 'rejected'
  where d.status = 'pending' and d.created_at < now() - p_age
  returning d.storage_path
$$;

revoke all on function public.create_pending_document(uuid, uuid, uuid, text, text, text, text, bigint, boolean)
  from public, anon;
grant execute on function public.create_pending_document(uuid, uuid, uuid, text, text, text, text, bigint, boolean)
  to authenticated;
revoke all on function public.finalize_document(uuid, boolean), public.expire_pending_documents(interval)
  from public, anon, authenticated;
grant execute on function public.finalize_document(uuid, boolean), public.expire_pending_documents(interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;
revoke all on table public.documents from public, anon, authenticated;
grant select, update (title, document_type, shared_with_assignees, archived_at) on table public.documents to authenticated;
grant all on table public.documents to service_role;

create policy documents_select on public.documents for select to authenticated
  using (
    (status = 'ready' or created_by = auth.uid())
    and private.can_read_document(organization_id, service_request_id, shared_with_assignees));
create policy documents_update on public.documents for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (
    private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager'])
    and (not shared_with_assignees or service_request_id is not null));

create policy documents_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (select 1 from public.documents d where d.storage_path = objects.name and d.status = 'ready'));
