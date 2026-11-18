-- TenderMed Intelligence platform – service requests and collaboration
--
-- Service requests are coordinated between the healthcare organization
-- (operators: owner, admin, equipment_manager) and request-scoped external
-- collaborators (service_assignments), who see only the requests they are
-- assigned to. All state changes (status, appointments, completions,
-- replacement equipment) run through SECURITY DEFINER functions that check
-- the actor explicitly; clients have no write privilege on those columns.
--
-- Status flow:
--   novo → v_usklajevanju → termin_potrjen → v_izvedbi → caka_na_potrditev → zakljuceno
--   any open status → preklicano (only without an active completion record)

-- ---------------------------------------------------------------------------
-- service_requests
-- ---------------------------------------------------------------------------

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reference_number integer not null,
  equipment_id uuid not null,
  plan_id uuid,
  request_type text not null,
  title text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'novo',
  replacement_status text not null default 'not_needed',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  cancel_reason text,
  closed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  unique (organization_id, id),
  unique (organization_id, reference_number),
  foreign key (organization_id, equipment_id) references public.equipment (organization_id, id),
  foreign key (organization_id, plan_id) references public.maintenance_plans (organization_id, id),
  constraint service_requests_type_chk check (request_type in (
    'preventive_maintenance', 'inspection', 'calibration', 'repair', 'other')),
  constraint service_requests_title_chk check (title = btrim(title) and char_length(title) between 3 and 160),
  constraint service_requests_description_chk check (description is null or char_length(description) <= 4000),
  constraint service_requests_priority_chk check (priority in ('normal', 'urgent')),
  constraint service_requests_status_chk check (status in (
    'novo', 'v_usklajevanju', 'termin_potrjen', 'v_izvedbi', 'caka_na_potrditev', 'zakljuceno', 'preklicano')),
  constraint service_requests_replacement_chk check (replacement_status in (
    'not_needed', 'requested', 'arranged', 'delivered', 'returned')),
  constraint service_requests_schedule_chk check (
    (scheduled_start is null and scheduled_end is null)
    or (scheduled_start is not null and scheduled_end > scheduled_start)),
  constraint service_requests_closed_chk check ((status in ('zakljuceno', 'preklicano')) = (closed_at is not null)),
  constraint service_requests_cancel_chk check (
    (status = 'preklicano') = (cancel_reason is not null)
    and (cancel_reason is null or char_length(cancel_reason) between 3 and 1000))
);

create index service_requests_org_status_idx on public.service_requests (organization_id, status);
create index service_requests_equipment_idx on public.service_requests (organization_id, equipment_id);

-- ---------------------------------------------------------------------------
-- service_assignments (request-scoped external collaborators)
-- ---------------------------------------------------------------------------

create table public.service_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  assignee_user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

create unique index service_assignments_active_uq on public.service_assignments (service_request_id, assignee_user_id)
  where revoked_at is null;
create index service_assignments_user_idx on public.service_assignments (assignee_user_id) where revoked_at is null;

alter table public.invitations
  add constraint invitations_service_request_fk foreign key (organization_id, service_request_id)
  references public.service_requests (organization_id, id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Access helpers (definer: they read rows the caller may not see directly)
-- ---------------------------------------------------------------------------

create function private.is_request_assignee(p_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_assignments a
    where a.service_request_id = p_request and a.assignee_user_id = auth.uid() and a.revoked_at is null)
$$;

create function private.can_view_request(p_org uuid, p_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_member(p_org) or private.is_request_assignee(p_request)
$$;

-- Profile visibility across a service collaboration:
--   an active assignee sees members of the request's organization and the
--   other active assignees of the same request;
--   members see everyone who has been assigned in their organization.
create function private.shares_request_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_assignments mine
    where mine.assignee_user_id = auth.uid() and mine.revoked_at is null
      and (
        exists (select 1 from public.organization_memberships m
                where m.organization_id = mine.organization_id and m.user_id = p_user)
        or exists (select 1 from public.service_assignments other
                   where other.service_request_id = mine.service_request_id
                     and other.assignee_user_id = p_user and other.revoked_at is null)))
  or exists (
    select 1 from public.service_assignments theirs
    join public.organization_memberships m on m.organization_id = theirs.organization_id and m.user_id = auth.uid()
    where theirs.assignee_user_id = p_user)
$$;

revoke all on function private.is_request_assignee(uuid), private.can_view_request(uuid, uuid),
  private.shares_request_with(uuid) from public;
grant execute on function private.is_request_assignee(uuid), private.can_view_request(uuid, uuid),
  private.shares_request_with(uuid) to authenticated, service_role;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_org_with(id) or private.shares_request_with(id));

-- ---------------------------------------------------------------------------
-- appointment proposals, messages, completion records, events
-- ---------------------------------------------------------------------------

create table public.appointment_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  proposed_by uuid references public.profiles (id) on delete set null,
  proposed_as text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  status text not null default 'proposed',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade,
  constraint appointment_proposals_time_chk check (ends_at > starts_at and ends_at <= starts_at + interval '14 days'),
  constraint appointment_proposals_as_chk check (proposed_as in ('member', 'assignee')),
  constraint appointment_proposals_note_chk check (
    coalesce(char_length(note), 0) <= 1000 and coalesce(char_length(decision_note), 0) <= 1000),
  constraint appointment_proposals_status_chk check (status in ('proposed', 'accepted', 'declined', 'withdrawn', 'superseded'))
);

create index appointment_proposals_request_idx on public.appointment_proposals (service_request_id, created_at);

create table public.service_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  author_id uuid references public.profiles (id) on delete set null,
  visibility text not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade,
  constraint service_messages_visibility_chk check (visibility in ('shared', 'internal')),
  constraint service_messages_body_chk check (char_length(btrim(body)) between 1 and 4000)
);

create index service_messages_request_idx on public.service_messages (service_request_id, created_at);

create table public.completion_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_request_id uuid not null,
  equipment_id uuid not null,
  plan_id uuid,
  completed_on date not null,
  outcome text not null,
  summary text not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_as text not null,
  acknowledgment_status text not null,
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  acknowledgment_note text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  replaces_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade,
  foreign key (organization_id, equipment_id) references public.equipment (organization_id, id),
  foreign key (organization_id, plan_id) references public.maintenance_plans (organization_id, id),
  foreign key (organization_id, replaces_id) references public.completion_records (organization_id, id),
  constraint completion_records_outcome_chk check (outcome in ('completed', 'completed_with_findings', 'not_completed')),
  constraint completion_records_summary_chk check (char_length(btrim(summary)) between 3 and 4000),
  constraint completion_records_as_chk check (recorded_as in ('member', 'assignee')),
  constraint completion_records_ack_chk check (acknowledgment_status in ('not_required', 'pending', 'acknowledged', 'rejected')),
  constraint completion_records_ack_note_chk check (acknowledgment_note is null or char_length(acknowledgment_note) <= 1000),
  constraint completion_records_void_chk check (
    (voided_at is null) = (void_reason is null)
    and (void_reason is null or char_length(void_reason) between 3 and 1000))
);

create index completion_records_plan_idx on public.completion_records (plan_id) where voided_at is null;
create index completion_records_request_idx on public.completion_records (service_request_id);

-- Shared timeline of a request, visible to members and assignees.
create table public.service_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  service_request_id uuid not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  detail text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade
);

create index service_events_request_idx on public.service_events (service_request_id, id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.log_service_event(
  p_org uuid,
  p_request uuid,
  p_type text,
  p_from text default null,
  p_to text default null,
  p_detail text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.service_events (organization_id, service_request_id, actor_user_id, event_type, from_status, to_status, detail)
  values (p_org, p_request, auth.uid(), p_type, p_from, p_to, p_detail)
$$;

revoke all on function private.log_service_event(uuid, uuid, text, text, text, text) from public;

-- Insert defaults and rules for direct client writes. Status, schedule,
-- replacement and closing columns are not granted to clients at all; this
-- trigger additionally pins them on insert.
create function private.service_request_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_plan_equipment uuid;
  v_plan_status text;
  v_equipment_status text;
begin
  if tg_op = 'INSERT' then
    if current_user = 'authenticated' then
      new.status := 'novo';
      new.scheduled_start := null;
      new.scheduled_end := null;
      new.cancel_reason := null;
      new.closed_at := null;
      if new.replacement_status not in ('not_needed', 'requested') then
        raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
      end if;
      select e.status into v_equipment_status from public.equipment e
      where e.organization_id = new.organization_id and e.id = new.equipment_id;
      if v_equipment_status = 'archived' then
        raise exception 'TM_EQUIPMENT_ARCHIVED' using errcode = 'P0001';
      end if;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 7001));
    select coalesce(max(r.reference_number), 0) + 1 into new.reference_number
    from public.service_requests r where r.organization_id = new.organization_id;
  elsif current_user = 'authenticated' and old.status in ('zakljuceno', 'preklicano') then
    raise exception 'TM_REQUEST_CLOSED' using errcode = 'P0001';
  end if;

  if new.plan_id is not null and (tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id
                                  or new.equipment_id is distinct from old.equipment_id) then
    select p.equipment_id, p.status into v_plan_equipment, v_plan_status
    from public.maintenance_plans p where p.organization_id = new.organization_id and p.id = new.plan_id;
    if v_plan_equipment is distinct from new.equipment_id or v_plan_status <> 'active' then
      raise exception 'TM_PLAN_MISMATCH' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.equipment_id is distinct from old.equipment_id then
    raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function private.service_request_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log_service_event(new.organization_id, new.id, 'created', null, new.status);
  return new;
end;
$$;

create trigger service_requests_org_immutable before update on public.service_requests
  for each row execute function private.prevent_organization_change();
create trigger service_requests_rules before insert or update on public.service_requests
  for each row execute function private.service_request_rules();
create trigger service_requests_stamp before insert or update on public.service_requests
  for each row execute function private.stamp_row();
create trigger service_requests_created after insert on public.service_requests
  for each row execute function private.service_request_created();

-- Assignments: clients may only revoke (owner/admin, enforced by RLS).
-- Invoker, so that current_user identifies direct client statements.
create function private.service_assignment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if old.revoked_at is not null or new.revoked_at is null then
      raise exception 'TM_INVITATION_CLOSED' using errcode = 'P0001';
    end if;
    new.revoked_at := now();
    new.revoked_by := auth.uid();
  end if;
  return new;
end;
$$;

create function private.service_assignment_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_service_event(new.organization_id, new.service_request_id, 'assignee_added', null, null,
                                      new.assignee_user_id::text);
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform private.log_service_event(new.organization_id, new.service_request_id, 'assignee_revoked', null, null,
                                      new.assignee_user_id::text);
  end if;
  return new;
end;
$$;

create trigger service_assignments_guard before update on public.service_assignments
  for each row execute function private.service_assignment_guard();
create trigger service_assignments_org_immutable before update on public.service_assignments
  for each row execute function private.prevent_organization_change();
create trigger service_assignments_log after insert or update on public.service_assignments
  for each row execute function private.service_assignment_log();

-- Assignment invitations only for open requests.
create function private.check_assignment_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'service_assignment' and exists (
       select 1 from public.service_requests r
       where r.organization_id = new.organization_id and r.id = new.service_request_id
         and r.status in ('zakljuceno', 'preklicano')) then
    raise exception 'TM_REQUEST_CLOSED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger invitations_assignment_check before insert on public.invitations
  for each row execute function private.check_assignment_invitation();

-- Replaces the placeholder from the foundation migration.
create or replace function private.accept_service_assignment(p_org uuid, p_request uuid, p_user uuid, p_assigned_by uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select r.status into v_status from public.service_requests r
  where r.organization_id = p_org and r.id = p_request for update;
  if v_status is null then
    raise exception 'TM_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status in ('zakljuceno', 'preklicano') then
    raise exception 'TM_REQUEST_CLOSED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.service_assignments a
                 where a.service_request_id = p_request and a.assignee_user_id = p_user and a.revoked_at is null) then
    insert into public.service_assignments (organization_id, service_request_id, assignee_user_id, assigned_by)
    values (p_org, p_request, p_user, p_assigned_by);
  end if;
end;
$$;

-- Messages: author and time are always set by the database.
create function private.service_message_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();
  new.body := btrim(new.body);
  return new;
end;
$$;

create trigger service_messages_rules before insert on public.service_messages
  for each row execute function private.service_message_rules();

-- ---------------------------------------------------------------------------
-- Plan dates from completion records (replaces the Phase 2 stub)
-- ---------------------------------------------------------------------------

create or replace function private.plan_completion_dates(p_plan uuid)
returns date[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(c.completed_on order by c.completed_on), '{}'::date[])
  from public.completion_records c
  where c.plan_id = p_plan
    and c.voided_at is null
    and c.acknowledgment_status in ('not_required', 'acknowledged')
    and c.outcome <> 'not_completed'
$$;

create function private.refresh_plan(p_plan uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  -- The derive trigger recomputes next_due_date / last_completed_on.
  update public.maintenance_plans p set last_completed_on = p.last_completed_on where p.id = p_plan
$$;

revoke all on function private.refresh_plan(uuid) from public;

-- ---------------------------------------------------------------------------
-- State-changing functions
-- ---------------------------------------------------------------------------

-- Locks the request after checking that the caller may see it. Unknown and
-- inaccessible requests raise the same error.
create function private.lock_request(p_request uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.service_requests;
begin
  if auth.uid() is null then
    raise exception 'TM_NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  select * into r from public.service_requests s where s.id = p_request for update;
  if not found or not private.can_view_request(r.organization_id, r.id) then
    raise exception 'TM_NOT_FOUND' using errcode = 'P0001';
  end if;
  return r;
end;
$$;

create function private.is_request_operator(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_org, array['owner', 'admin', 'equipment_manager'])
$$;

revoke all on function private.is_request_operator(uuid) from public;
revoke all on function private.lock_request(uuid) from public;

create function private.has_active_completion(p_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.completion_records c
                 where c.service_request_id = p_request and c.voided_at is null and c.outcome <> 'not_completed'
                   and c.acknowledgment_status in ('not_required', 'pending', 'acknowledged'))
$$;

create function private.has_effective_completion(p_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.completion_records c
                 where c.service_request_id = p_request and c.voided_at is null and c.outcome <> 'not_completed'
                   and c.acknowledgment_status in ('not_required', 'acknowledged'))
$$;

revoke all on function private.has_active_completion(uuid), private.has_effective_completion(uuid) from public;

create function public.transition_service_request(p_request uuid, p_version integer, p_to text, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.service_requests;
  v_operator boolean;
  v_assignee boolean;
  v_allowed boolean := false;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_version integer;
begin
  v := private.lock_request(p_request);
  v_operator := private.is_request_operator(v.organization_id);
  v_assignee := private.is_request_assignee(v.id);
  if v.version <> p_version then
    raise exception 'TM_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  if v.status in ('zakljuceno', 'preklicano') then
    raise exception 'TM_REQUEST_CLOSED' using errcode = 'P0001';
  end if;

  if p_to = 'preklicano' then
    v_allowed := v_operator;
    if v_allowed and v_note is null then
      raise exception 'TM_REASON_REQUIRED' using errcode = 'P0001';
    end if;
    if v_allowed and private.has_active_completion(p_request) then
      raise exception 'TM_REQUEST_HAS_COMPLETION' using errcode = 'P0001';
    end if;
  elsif p_to = 'v_usklajevanju' then
    v_allowed := (v_operator and v.status in ('novo', 'termin_potrjen', 'v_izvedbi'))
              or (v_assignee and v.status in ('termin_potrjen', 'v_izvedbi'));
  elsif p_to = 'v_izvedbi' then
    v_allowed := (v_operator or v_assignee) and v.status = 'termin_potrjen';
  elsif p_to = 'zakljuceno' then
    v_allowed := v_operator and v.status in ('v_izvedbi', 'caka_na_potrditev');
    if v_allowed and not private.has_effective_completion(p_request) then
      raise exception 'TM_COMPLETION_REQUIRED' using errcode = 'P0001';
    end if;
    if v_allowed and exists (select 1 from public.completion_records c
                             where c.service_request_id = p_request and c.voided_at is null
                               and c.acknowledgment_status = 'pending') then
      raise exception 'TM_COMPLETION_REQUIRED' using errcode = 'P0001';
    end if;
    if v_allowed and v.replacement_status in ('requested', 'arranged', 'delivered') then
      raise exception 'TM_REPLACEMENT_OPEN' using errcode = 'P0001';
    end if;
  end if;

  if not v_allowed then
    raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if p_to = 'v_usklajevanju' and v.status in ('termin_potrjen', 'v_izvedbi') then
    update public.appointment_proposals a set status = 'superseded'
    where a.service_request_id = p_request and a.status = 'accepted';
  end if;
  if p_to = 'preklicano' then
    update public.appointment_proposals a set status = 'withdrawn', decided_at = now(), decided_by = auth.uid()
    where a.service_request_id = p_request and a.status = 'proposed';
  end if;

  update public.service_requests s set
    status = p_to,
    scheduled_start = case when p_to = 'v_usklajevanju' then null else s.scheduled_start end,
    scheduled_end = case when p_to = 'v_usklajevanju' then null else s.scheduled_end end,
    cancel_reason = case when p_to = 'preklicano' then v_note else null end,
    closed_at = case when p_to in ('zakljuceno', 'preklicano') then now() else null end
  where s.id = p_request
  returning s.version into v_version;

  perform private.log_service_event(v.organization_id, p_request, 'status_changed', v.status, p_to,
                                    case when p_to = 'preklicano' then 'cancelled' end);
  return v_version;
end;
$$;

create function public.propose_appointment(p_request uuid, p_starts timestamptz, p_ends timestamptz, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.service_requests;
  v_operator boolean;
  v_assignee boolean;
  v_id uuid;
begin
  v := private.lock_request(p_request);
  v_operator := private.is_request_operator(v.organization_id);
  v_assignee := private.is_request_assignee(v.id);
  if not (v_operator or v_assignee) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v.status not in ('novo', 'v_usklajevanju') then
    raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_starts is null or p_ends is null or p_starts <= now() or p_ends <= p_starts
     or p_ends > p_starts + interval '14 days' then
    raise exception 'TM_APPOINTMENT_INVALID' using errcode = 'P0001';
  end if;

  insert into public.appointment_proposals (organization_id, service_request_id, proposed_by, proposed_as, starts_at, ends_at, note)
  values (v.organization_id, p_request, auth.uid(), case when v_operator then 'member' else 'assignee' end,
          p_starts, p_ends, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  if v.status = 'novo' then
    update public.service_requests s set status = 'v_usklajevanju' where s.id = p_request;
    perform private.log_service_event(v.organization_id, p_request, 'status_changed', 'novo', 'v_usklajevanju');
  end if;
  perform private.log_service_event(v.organization_id, p_request, 'appointment_proposed', null, null, v_id::text);
  return v_id;
end;
$$;

-- p_action: accept | decline | withdraw. Acceptance by the other side: an
-- operator may accept any proposal by someone else; an assignee may accept
-- proposals made by the organization.
create function public.respond_appointment(p_proposal uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.appointment_proposals;
  v public.service_requests;
  v_operator boolean;
  v_assignee boolean;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_proposal from public.appointment_proposals a where a.id = p_proposal;
  if not found then
    raise exception 'TM_NOT_FOUND' using errcode = 'P0001';
  end if;
  v := private.lock_request(v_proposal.service_request_id);
  v_operator := private.is_request_operator(v.organization_id);
  v_assignee := private.is_request_assignee(v.id);
  select * into v_proposal from public.appointment_proposals a where a.id = p_proposal for update;

  if v_proposal.status <> 'proposed' then
    raise exception 'TM_PROPOSAL_CLOSED' using errcode = 'P0001';
  end if;
  if v.status not in ('novo', 'v_usklajevanju') then
    raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if p_action = 'withdraw' then
    if v_proposal.proposed_by is distinct from auth.uid() then
      raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
    end if;
    update public.appointment_proposals a set status = 'withdrawn', decided_by = auth.uid(), decided_at = now(),
      decision_note = v_note where a.id = p_proposal;
    perform private.log_service_event(v.organization_id, v.id, 'appointment_withdrawn', null, null, p_proposal::text);
    return;
  end if;

  if p_action not in ('accept', 'decline') then
    raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if v_proposal.proposed_by = auth.uid()
     or not (v_operator or (v_assignee and v_proposal.proposed_as = 'member')) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_action = 'decline' then
    update public.appointment_proposals a set status = 'declined', decided_by = auth.uid(), decided_at = now(),
      decision_note = v_note where a.id = p_proposal;
    perform private.log_service_event(v.organization_id, v.id, 'appointment_declined', null, null, p_proposal::text);
    return;
  end if;

  if v_proposal.starts_at <= now() then
    raise exception 'TM_PROPOSAL_IN_PAST' using errcode = 'P0001';
  end if;
  update public.appointment_proposals a set status = 'accepted', decided_by = auth.uid(), decided_at = now(),
    decision_note = v_note where a.id = p_proposal;
  update public.appointment_proposals a set status = 'superseded'
  where a.service_request_id = v.id and a.status = 'proposed';
  update public.service_requests s set status = 'termin_potrjen',
    scheduled_start = v_proposal.starts_at, scheduled_end = v_proposal.ends_at
  where s.id = v.id;
  perform private.log_service_event(v.organization_id, v.id, 'appointment_accepted', null, null, p_proposal::text);
  perform private.log_service_event(v.organization_id, v.id, 'status_changed', v.status, 'termin_potrjen');
end;
$$;

create function public.record_completion(
  p_request uuid,
  p_completed_on date,
  p_outcome text,
  p_summary text,
  p_replaces uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.service_requests;
  v_operator boolean;
  v_assignee boolean;
  v_require_ack boolean;
  v_ack text;
  v_to text;
  v_id uuid;
begin
  v := private.lock_request(p_request);
  v_operator := private.is_request_operator(v.organization_id);
  v_assignee := private.is_request_assignee(v.id);
  if not (v_operator or v_assignee) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  if not ((v_operator and v.status in ('novo', 'v_usklajevanju', 'termin_potrjen', 'v_izvedbi'))
          or (v_assignee and v.status in ('termin_potrjen', 'v_izvedbi'))) then
    raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if private.has_active_completion(p_request) then
    raise exception 'TM_COMPLETION_EXISTS' using errcode = 'P0001';
  end if;
  if p_completed_on is null or p_completed_on > (now() at time zone 'Europe/Ljubljana')::date
     or p_completed_on < date '2000-01-01' then
    raise exception 'TM_COMPLETION_DATE_INVALID' using errcode = 'P0001';
  end if;
  if p_replaces is not null and not exists (
       select 1 from public.completion_records c
       where c.id = p_replaces and c.service_request_id = p_request and c.voided_at is not null) then
    raise exception 'TM_INVALID_REPLACEMENT' using errcode = 'P0001';
  end if;

  select o.require_completion_acknowledgment into v_require_ack
  from public.organizations o where o.id = v.organization_id;
  if not v_operator and v_require_ack then
    v_ack := 'pending';
    v_to := 'caka_na_potrditev';
  else
    v_ack := 'not_required';
    v_to := 'v_izvedbi';
  end if;

  insert into public.completion_records (organization_id, service_request_id, equipment_id, plan_id, completed_on,
    outcome, summary, recorded_by, recorded_as, acknowledgment_status, replaces_id)
  values (v.organization_id, p_request, v.equipment_id, v.plan_id, p_completed_on, p_outcome, btrim(p_summary),
    auth.uid(), case when v_operator then 'member' else 'assignee' end, v_ack, p_replaces)
  returning id into v_id;

  if v.status <> v_to then
    update public.service_requests s set status = v_to where s.id = p_request;
    perform private.log_service_event(v.organization_id, p_request, 'status_changed', v.status, v_to);
  end if;
  perform private.log_service_event(v.organization_id, p_request, 'completion_recorded', null, null, v_id::text);
  if v.plan_id is not null and v_ack = 'not_required' then
    perform private.refresh_plan(v.plan_id);
  end if;
  return v_id;
end;
$$;

create function public.acknowledge_completion(p_completion uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completion public.completion_records;
  v public.service_requests;
  v_operator boolean;
  v_assignee boolean;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_to text;
begin
  select * into v_completion from public.completion_records c where c.id = p_completion;
  if not found then
    raise exception 'TM_NOT_FOUND' using errcode = 'P0001';
  end if;
  v := private.lock_request(v_completion.service_request_id);
  v_operator := private.is_request_operator(v.organization_id);
  v_assignee := private.is_request_assignee(v.id);
  if not v_operator then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into v_completion from public.completion_records c where c.id = p_completion for update;
  if v_completion.acknowledgment_status <> 'pending' or v_completion.voided_at is not null then
    raise exception 'TM_COMPLETION_NOT_PENDING' using errcode = 'P0001';
  end if;
  if not p_accept and v_note is null then
    raise exception 'TM_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update public.completion_records c set
    acknowledgment_status = case when p_accept then 'acknowledged' else 'rejected' end,
    acknowledged_by = auth.uid(), acknowledged_at = now(), acknowledgment_note = v_note
  where c.id = p_completion;

  v_to := case
    when p_accept and v_completion.outcome <> 'not_completed' and v.replacement_status in ('not_needed', 'returned')
      then 'zakljuceno'
    else 'v_izvedbi'
  end;
  update public.service_requests s set status = v_to,
    closed_at = case when v_to = 'zakljuceno' then now() else null end
  where s.id = v.id;

  perform private.log_service_event(v.organization_id, v.id,
    case when p_accept then 'completion_acknowledged' else 'completion_rejected' end, null, null, p_completion::text);
  if v.status <> v_to then
    perform private.log_service_event(v.organization_id, v.id, 'status_changed', v.status, v_to);
  end if;
  if p_accept and v_completion.plan_id is not null then
    perform private.refresh_plan(v_completion.plan_id);
  end if;
end;
$$;

-- Voiding keeps the record (correction history). A corrected record can be
-- entered with record_completion(..., p_replaces => voided id).
create function public.void_completion(p_completion uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completion public.completion_records;
  v public.service_requests;
  v_operator boolean;
  v_assignee boolean;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_completion from public.completion_records c where c.id = p_completion;
  if not found then
    raise exception 'TM_NOT_FOUND' using errcode = 'P0001';
  end if;
  v := private.lock_request(v_completion.service_request_id);
  v_operator := private.is_request_operator(v.organization_id);
  v_assignee := private.is_request_assignee(v.id);
  if not private.has_org_role(v.organization_id, array['owner', 'admin']) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'TM_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_completion from public.completion_records c where c.id = p_completion for update;
  if v_completion.voided_at is not null then
    raise exception 'TM_ALREADY_VOIDED' using errcode = 'P0001';
  end if;

  update public.completion_records c set voided_at = now(), voided_by = auth.uid(), void_reason = v_reason
  where c.id = p_completion;
  if v.status in ('zakljuceno', 'caka_na_potrditev') then
    update public.service_requests s set status = 'v_izvedbi', closed_at = null where s.id = v.id;
    perform private.log_service_event(v.organization_id, v.id, 'status_changed', v.status, 'v_izvedbi');
  end if;
  perform private.log_service_event(v.organization_id, v.id, 'completion_voided', null, null, p_completion::text);
  if v_completion.plan_id is not null then
    perform private.refresh_plan(v_completion.plan_id);
  end if;
end;
$$;

create function public.set_replacement_status(p_request uuid, p_version integer, p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.service_requests;
  v_operator boolean;
  v_assignee boolean;
  v_version integer;
begin
  v := private.lock_request(p_request);
  v_operator := private.is_request_operator(v.organization_id);
  v_assignee := private.is_request_assignee(v.id);
  if not (v_operator or v_assignee) then
    raise exception 'TM_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v.version <> p_version then
    raise exception 'TM_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  if v.status in ('zakljuceno', 'preklicano') then
    raise exception 'TM_REQUEST_CLOSED' using errcode = 'P0001';
  end if;
  if not (
    (v.replacement_status = 'not_needed' and p_status = 'requested')
    or (v.replacement_status = 'requested' and p_status in ('arranged', 'not_needed'))
    or (v.replacement_status = 'arranged' and p_status in ('delivered', 'not_needed'))
    or (v.replacement_status = 'delivered' and p_status = 'returned')) then
    raise exception 'TM_TRANSITION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  update public.service_requests s set replacement_status = p_status where s.id = p_request
  returning s.version into v_version;
  perform private.log_service_event(v.organization_id, p_request, 'replacement_changed', v.replacement_status, p_status);
  return v_version;
end;
$$;

-- Technician area: requests assigned to the caller with the details they
-- need (assignees cannot read the organization or equipment tables).
create function public.my_service_assignments()
returns table (
  service_request_id uuid,
  organization_id uuid,
  organization_name text,
  reference_number integer,
  title text,
  request_type text,
  priority text,
  status text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  equipment_name text,
  manufacturer_name text,
  model text,
  serial_number text,
  location_name text,
  assigned_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.organization_id, o.name, r.reference_number, r.title, r.request_type, r.priority, r.status,
    r.scheduled_start, r.scheduled_end, e.name, e.manufacturer_name, e.model, e.serial_number, l.name, a.created_at
  from public.service_assignments a
  join public.service_requests r on r.id = a.service_request_id and r.organization_id = a.organization_id
  join public.organizations o on o.id = r.organization_id
  join public.equipment e on e.organization_id = r.organization_id and e.id = r.equipment_id
  left join public.locations l on l.organization_id = e.organization_id and l.id = e.location_id
  where a.assignee_user_id = auth.uid() and a.revoked_at is null
  order by (r.status in ('zakljuceno', 'preklicano')), r.scheduled_start nulls last, r.created_at desc
$$;

-- Request header for members and assignees.
create function public.service_request_brief(p_request uuid)
returns table (
  organization_name text,
  equipment_name text,
  equipment_category text,
  asset_tag text,
  manufacturer_name text,
  model text,
  serial_number text,
  location_name text,
  require_completion_acknowledgment boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, e.name, e.category, e.asset_tag, e.manufacturer_name, e.model, e.serial_number, l.name,
    o.require_completion_acknowledgment
  from public.service_requests r
  join public.organizations o on o.id = r.organization_id
  join public.equipment e on e.organization_id = r.organization_id and e.id = r.equipment_id
  left join public.locations l on l.organization_id = e.organization_id and l.id = e.location_id
  where r.id = p_request and private.can_view_request(r.organization_id, r.id)
$$;

revoke all on function
  public.transition_service_request(uuid, integer, text, text),
  public.propose_appointment(uuid, timestamptz, timestamptz, text),
  public.respond_appointment(uuid, text, text),
  public.record_completion(uuid, date, text, text, uuid),
  public.acknowledge_completion(uuid, boolean, text),
  public.void_completion(uuid, text),
  public.set_replacement_status(uuid, integer, text),
  public.my_service_assignments(),
  public.service_request_brief(uuid)
  from public, anon;
grant execute on function
  public.transition_service_request(uuid, integer, text, text),
  public.propose_appointment(uuid, timestamptz, timestamptz, text),
  public.respond_appointment(uuid, text, text),
  public.record_completion(uuid, date, text, text, uuid),
  public.acknowledge_completion(uuid, boolean, text),
  public.void_completion(uuid, text),
  public.set_replacement_status(uuid, integer, text),
  public.my_service_assignments(),
  public.service_request_brief(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create trigger service_requests_audit after insert or update on public.service_requests
  for each row execute function private.audit_row();
create trigger service_assignments_audit after insert or update on public.service_assignments
  for each row execute function private.audit_row();
create trigger completion_records_audit after insert or update on public.completion_records
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------

alter table public.service_requests enable row level security;
alter table public.service_assignments enable row level security;
alter table public.appointment_proposals enable row level security;
alter table public.service_messages enable row level security;
alter table public.completion_records enable row level security;
alter table public.service_events enable row level security;

revoke all on table public.service_requests, public.service_assignments, public.appointment_proposals,
  public.service_messages, public.completion_records, public.service_events from public, anon, authenticated;

grant select,
  insert (organization_id, equipment_id, plan_id, request_type, title, description, priority, replacement_status),
  update (title, description, priority)
  on table public.service_requests to authenticated;
grant select, update (revoked_at) on table public.service_assignments to authenticated;
grant select on table public.appointment_proposals, public.completion_records, public.service_events to authenticated;
grant select, insert (organization_id, service_request_id, visibility, body) on table public.service_messages to authenticated;

grant all on table public.service_requests, public.service_assignments, public.appointment_proposals,
  public.service_messages, public.completion_records, public.service_events to service_role;

create policy service_requests_select on public.service_requests for select to authenticated
  using (private.can_view_request(organization_id, id));
create policy service_requests_insert on public.service_requests for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));
create policy service_requests_update on public.service_requests for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager']));

create policy service_assignments_select on public.service_assignments for select to authenticated
  using (private.is_org_member(organization_id) or assignee_user_id = auth.uid());
create policy service_assignments_revoke on public.service_assignments for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));

create policy appointment_proposals_select on public.appointment_proposals for select to authenticated
  using (private.can_view_request(organization_id, service_request_id));
create policy completion_records_select on public.completion_records for select to authenticated
  using (private.can_view_request(organization_id, service_request_id));
create policy service_events_select on public.service_events for select to authenticated
  using (private.can_view_request(organization_id, service_request_id));

create policy service_messages_select on public.service_messages for select to authenticated
  using (
    (visibility = 'internal' and private.is_org_member(organization_id))
    or (visibility = 'shared' and private.can_view_request(organization_id, service_request_id)));
create policy service_messages_insert on public.service_messages for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin', 'equipment_manager'])
    or (visibility = 'shared' and private.is_request_assignee(service_request_id)));
