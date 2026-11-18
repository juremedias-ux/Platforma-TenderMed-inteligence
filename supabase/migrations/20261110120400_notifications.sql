-- TenderMed Intelligence platform – notifications, preferences and e-mail outbox
--
-- In-app notifications are created by the database (service events, shared
-- messages, daily due-date reminders); each has an event key that is unique
-- per recipient, so retries and repeated scheduler runs never duplicate them.
-- E-mail delivery goes through email_outbox (service role only):
--   claim_outbox()   locks due rows with SKIP LOCKED, re-checks that the
--                    recipient still has access and wants e-mail, and marks
--                    the rest cancelled;
--   complete_outbox() records sent / retry (exponential backoff) / failed.
-- Rows stuck in `sending` (crash between send and completion) are retried
-- with the same idempotency key within 23 hours (the provider deduplicates),
-- otherwise marked `unknown` and never resent automatically.

alter table public.organizations
  add column reminder_audience text not null default 'responsible_or_operators',
  add constraint organizations_reminder_audience_chk
    check (reminder_audience in ('responsible_or_operators', 'operators'));

grant update (reminder_audience) on table public.organizations to authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_request_id uuid,
  kind text not null,
  title text not null,
  body text,
  link_path text not null,
  event_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient_user_id, event_key),
  foreign key (organization_id, service_request_id)
    references public.service_requests (organization_id, id) on delete cascade,
  constraint notifications_kind_chk check (kind in ('due_reminder', 'overdue_reminder', 'service_update', 'assignment')),
  constraint notifications_link_chk check (link_path ~ '^/app/[A-Za-z0-9/_-]*$'),
  constraint notifications_text_chk check (char_length(title) <= 200 and coalesce(char_length(body), 0) <= 1000)
);

create index notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_reminders boolean not null default true,
  email_service_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.email_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  event_key text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (recipient_user_id, event_key),
  constraint email_outbox_status_chk check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled', 'unknown'))
);

create index email_outbox_due_idx on public.email_outbox (next_attempt_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Creating notifications
-- ---------------------------------------------------------------------------

create function private.enqueue_notification(
  p_user uuid,
  p_org uuid,
  p_request uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email boolean;
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (recipient_user_id, organization_id, service_request_id, kind, title, body, link_path, event_key)
  values (p_user, p_org, p_request, p_kind, left(p_title, 200), left(p_body, 1000), p_link, p_key)
  on conflict (recipient_user_id, event_key) do nothing
  returning id into v_id;
  if v_id is null then
    return;
  end if;

  select case when p_kind in ('due_reminder', 'overdue_reminder') then pr.email_reminders else pr.email_service_updates end
  into v_email
  from public.notification_preferences pr where pr.user_id = p_user;
  if coalesce(v_email, true) then
    insert into public.email_outbox (notification_id, recipient_user_id, event_key)
    values (v_id, p_user, p_key)
    on conflict (recipient_user_id, event_key) do nothing;
  end if;
end;
$$;

revoke all on function private.enqueue_notification(uuid, uuid, uuid, text, text, text, text, text) from public;

create function private.days_sl(p_days integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_days::text || ' ' || case when abs(p_days) % 100 = 1 then 'dan' when abs(p_days) % 100 = 2 then 'dneva' else 'dni' end
$$;

create function private.format_date_sl(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_date, 'FMDD. FMMM. YYYY')
$$;

-- Members who coordinate service for an organization.
create function private.operator_ids(p_org uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id from public.organization_memberships m
  where m.organization_id = p_org and m.role in ('owner', 'admin', 'equipment_manager')
$$;

revoke all on function private.days_sl(integer), private.format_date_sl(date), private.operator_ids(uuid) from public;
-- generate_due_reminders runs as the service role (security invoker).
grant execute on function private.days_sl(integer), private.format_date_sl(date), private.operator_ids(uuid),
  private.enqueue_notification(uuid, uuid, uuid, text, text, text, text, text) to service_role;

-- Daily reminders. For each open due date, the reminder used is the smallest
-- configured lead time that has been reached (so a missed scheduler run is
-- caught up the next day without sending several reminders at once).
-- Overdue items are reminded weekly. Recipients: the plan's responsible
-- person (if still a member) or, when none is set or the organization chose
-- 'operators', all owners, admins and equipment managers.
create function public.generate_due_reminders(p_today date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  v_days integer;
  v_lead integer;
  v_key text;
  v_kind text;
  v_title text;
  v_body text;
  v_activity text;
  v_user uuid;
  v_count integer := 0;
begin
  for r in
    select a.*, o.reminder_audience
    from public.maintenance_agenda a
    join public.organizations o on o.id = a.organization_id
  loop
    v_days := r.next_due_date - p_today;
    v_activity := coalesce(r.activity_label, case r.activity_type
      when 'preventive_maintenance' then 'Preventivno vzdrževanje'
      when 'inspection' then 'Varnostno-tehnični pregled'
      when 'calibration' then 'Kalibracija'
      else 'Servisna aktivnost' end);

    if v_days >= 0 then
      select min(d) into v_lead from unnest(r.reminder_days) d where d >= v_days;
      if v_lead is null then
        continue;
      end if;
      v_kind := 'due_reminder';
      v_key := 'due:' || r.id || ':' || r.next_due_date || ':' || v_lead;
      v_title := case when v_days = 0 then 'Rok je danes: ' else 'Rok čez ' || private.days_sl(v_days) || ': ' end
                 || v_activity || ' – ' || r.equipment_name;
    else
      v_kind := 'overdue_reminder';
      v_key := 'overdue:' || r.id || ':' || r.next_due_date || ':' || ((-v_days - 1) / 7);
      v_title := 'Rok je potekel pred ' || private.days_sl(-v_days) || ': ' || v_activity || ' – ' || r.equipment_name;
    end if;
    v_body := 'Rok: ' || private.format_date_sl(r.next_due_date)
      || coalesce('. Inventarna številka: ' || r.asset_tag, '')
      || coalesce('. Lokacija: ' || r.location_name, '') || '.';

    for v_user in
      select r.responsible_user_id
      where r.reminder_audience = 'responsible_or_operators' and r.responsible_user_id is not null
        and private.user_is_member(r.organization_id, r.responsible_user_id)
      union
      select op from private.operator_ids(r.organization_id) op
      where r.reminder_audience = 'operators' or r.responsible_user_id is null
         or not private.user_is_member(r.organization_id, r.responsible_user_id)
    loop
      perform private.enqueue_notification(v_user, r.organization_id, null, v_kind, v_title, v_body,
        '/app/' || r.organization_id || '/oprema/' || r.equipment_id, v_key);
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Service updates: notify the other side of the request (never the actor).
-- Members → active assignees; assignees → the request creator if still an
-- operator, otherwise all operators.
create function private.notify_request(
  p_request uuid,
  p_actor uuid,
  p_audience text,
  p_title text,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.service_requests;
  v_user uuid;
  v_title text;
  v_equipment text;
begin
  select * into v from public.service_requests r where r.id = p_request;
  select e.name into v_equipment from public.equipment e where e.organization_id = v.organization_id and e.id = v.equipment_id;
  v_title := p_title || ' – #' || v.reference_number || ' ' || v.title;

  if p_audience in ('assignees', 'both') then
    for v_user in
      select a.assignee_user_id from public.service_assignments a
      where a.service_request_id = p_request and a.revoked_at is null and a.assignee_user_id is distinct from p_actor
    loop
      perform private.enqueue_notification(v_user, v.organization_id, p_request, 'service_update', v_title,
        'Oprema: ' || v_equipment || '.', '/app/servisne-naloge/' || p_request, p_key);
    end loop;
  end if;

  if p_audience in ('organization', 'both') then
    for v_user in
      select v.created_by
      where v.created_by is not null and v.created_by is distinct from p_actor
        and v.created_by in (select private.operator_ids(v.organization_id))
      union
      select op from private.operator_ids(v.organization_id) op
      where op is distinct from p_actor
        and (v.created_by is null or v.created_by not in (select private.operator_ids(v.organization_id)))
    loop
      perform private.enqueue_notification(v_user, v.organization_id, p_request, 'service_update', v_title,
        'Oprema: ' || v_equipment || '.', '/app/' || v.organization_id || '/servisi/' || p_request, p_key);
    end loop;
  end if;
end;
$$;

revoke all on function private.notify_request(uuid, uuid, text, text, text) from public;

create function private.service_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_actor boolean;
  v_other text;
  v_key text := 'event:' || new.id;
  v_request public.service_requests;
begin
  v_org_actor := new.actor_user_id is not null and private.user_is_member(new.organization_id, new.actor_user_id);
  v_other := case when v_org_actor then 'assignees' else 'organization' end;

  case new.event_type
    when 'appointment_proposed' then
      perform private.notify_request(new.service_request_id, new.actor_user_id, v_other, 'Nov predlog termina', v_key);
    when 'appointment_accepted' then
      perform private.notify_request(new.service_request_id, new.actor_user_id, v_other, 'Termin je potrjen', v_key);
    when 'appointment_declined' then
      perform private.notify_request(new.service_request_id, new.actor_user_id, v_other, 'Predlog termina je zavrnjen', v_key);
    when 'completion_recorded' then
      perform private.notify_request(new.service_request_id, new.actor_user_id, v_other,
        case when v_org_actor then 'Zabeležena izvedba' else 'Izvedba čaka na potrditev' end, v_key);
    when 'completion_acknowledged' then
      perform private.notify_request(new.service_request_id, new.actor_user_id, 'assignees', 'Izvedba je potrjena', v_key);
    when 'completion_rejected' then
      perform private.notify_request(new.service_request_id, new.actor_user_id, 'assignees', 'Izvedba je zavrnjena', v_key);
    when 'status_changed' then
      if new.to_status = 'preklicano' then
        perform private.notify_request(new.service_request_id, new.actor_user_id, 'assignees', 'Zahtevek je preklican', v_key);
      elsif new.to_status = 'zakljuceno' then
        perform private.notify_request(new.service_request_id, new.actor_user_id, 'assignees', 'Zahtevek je zaključen', v_key);
      end if;
    when 'assignee_added' then
      if new.actor_user_id is not null and new.actor_user_id = new.detail::uuid then
        -- The technician accepted an invitation: tell the organization.
        perform private.notify_request(new.service_request_id, new.actor_user_id, 'organization',
          'Serviser je sprejel povabilo', v_key);
      else
        select * into v_request from public.service_requests r where r.id = new.service_request_id;
        perform private.enqueue_notification(new.detail::uuid, new.organization_id, new.service_request_id, 'assignment',
          'Dodeljen vam je servisni zahtevek – #' || v_request.reference_number || ' ' || v_request.title,
          null, '/app/servisne-naloge/' || new.service_request_id, v_key);
      end if;
    else
      null;
  end case;
  return new;
end;
$$;

create trigger service_events_notify after insert on public.service_events
  for each row execute function private.service_event_notifications();

create function private.service_message_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'shared' then
    perform private.notify_request(new.service_request_id, new.author_id,
      case when private.user_is_member(new.organization_id, new.author_id) then 'assignees' else 'organization' end,
      'Novo sporočilo', 'message:' || new.id);
  end if;
  return new;
end;
$$;

create trigger service_messages_notify after insert on public.service_messages
  for each row execute function private.service_message_notifications();

-- ---------------------------------------------------------------------------
-- Outbox processing (service role only)
-- ---------------------------------------------------------------------------

-- The recipient must still be allowed to see the notification's subject and
-- still want e-mail of this kind; the account e-mail must be confirmed.
create function private.outbox_allowed(p_outbox bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.email_outbox o
    join public.notifications n on n.id = o.notification_id
    join auth.users u on u.id = o.recipient_user_id
    left join public.notification_preferences pr on pr.user_id = o.recipient_user_id
    where o.id = p_outbox
      and u.email_confirmed_at is not null
      and coalesce(case when n.kind in ('due_reminder', 'overdue_reminder') then pr.email_reminders
                        else pr.email_service_updates end, true)
      and (private.user_is_member(n.organization_id, o.recipient_user_id)
           or (n.service_request_id is not null and exists (
                 select 1 from public.service_assignments a
                 where a.service_request_id = n.service_request_id
                   and a.assignee_user_id = o.recipient_user_id and a.revoked_at is null))))
$$;

revoke all on function private.outbox_allowed(bigint) from public;
grant execute on function private.outbox_allowed(bigint) to service_role;

create function public.claim_outbox(p_limit integer default 20)
returns table (
  id bigint,
  idempotency_key uuid,
  to_email text,
  title text,
  body text,
  link_path text,
  attempts integer
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id bigint;
begin
  update public.email_outbox o set
    status = case when o.created_at > now() - interval '23 hours' then 'pending' else 'unknown' end,
    locked_at = null,
    last_error = 'stale_lock'
  where o.status = 'sending' and o.locked_at < now() - interval '15 minutes';

  update public.email_outbox o set status = 'cancelled', last_error = 'expired'
  where o.status = 'pending' and o.created_at < now() - interval '7 days';

  for v_id in
    select o.id from public.email_outbox o
    where o.status = 'pending' and o.next_attempt_at <= now()
    order by o.id
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  loop
    if private.outbox_allowed(v_id) then
      update public.email_outbox o set status = 'sending', locked_at = now(), attempts = o.attempts + 1 where o.id = v_id;
      return query
        select o.id, o.idempotency_key, lower(u.email)::text, n.title, n.body, n.link_path, o.attempts
        from public.email_outbox o
        join public.notifications n on n.id = o.notification_id
        join auth.users u on u.id = o.recipient_user_id
        where o.id = v_id;
    else
      update public.email_outbox o set status = 'cancelled', last_error = 'recipient_not_allowed' where o.id = v_id;
    end if;
  end loop;
end;
$$;

-- p_result: sent | retry | failed
create function public.complete_outbox(p_id bigint, p_result text, p_provider_id text default null, p_error text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.email_outbox o set
    status = case
      when p_result = 'sent' then 'sent'
      when p_result = 'retry' and o.attempts < 5 then 'pending'
      else 'failed' end,
    next_attempt_at = case when p_result = 'retry'
      then now() + least(interval '6 hours', make_interval(mins => 5 * (2 ^ (o.attempts - 1))::integer))
      else o.next_attempt_at end,
    sent_at = case when p_result = 'sent' then now() end,
    provider_message_id = coalesce(p_provider_id, o.provider_message_id),
    last_error = left(p_error, 500),
    locked_at = null
  where o.id = p_id and o.status = 'sending';
end;
$$;

revoke all on function public.generate_due_reminders(date), public.claim_outbox(integer),
  public.complete_outbox(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.generate_due_reminders(date), public.claim_outbox(integer),
  public.complete_outbox(bigint, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_outbox enable row level security;

revoke all on table public.notifications, public.notification_preferences, public.email_outbox
  from public, anon, authenticated;
grant select, update (read_at) on table public.notifications to authenticated;
grant select, insert (user_id, email_reminders, email_service_updates),
  update (user_id, email_reminders, email_service_updates, updated_at) on table public.notification_preferences to authenticated;
grant all on table public.notifications, public.notification_preferences, public.email_outbox to service_role;

create policy notifications_select on public.notifications for select to authenticated
  using (recipient_user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

create policy notification_preferences_select on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());
create policy notification_preferences_update on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function private.touch_updated_at();
