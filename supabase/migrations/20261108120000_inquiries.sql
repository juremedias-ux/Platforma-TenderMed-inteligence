-- TenderMed Intelligence – public inquiry storage
--
-- Security model
--   * Browsers never access these tables directly. All writes go through
--     Next.js route handlers that use the server-only secret key
--     (service_role), after validation, origin checks and rate limiting.
--   * RLS is enabled on every table and NO policies are created, so the
--     anon and authenticated roles can neither read nor write rows even if
--     table privileges were granted by default.
--   * Table privileges and function EXECUTE privileges are additionally
--     revoked from public, anon and authenticated (defence in depth).
--   * Functions are SECURITY INVOKER with an empty search_path.

-- ---------------------------------------------------------------------------
-- demo_requests: pilot / demo inquiries
-- ---------------------------------------------------------------------------

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  interest_area text not null,
  message text,
  marketing_opt_in boolean not null default false,
  consent_version text,
  consent_recorded_at timestamptz,
  privacy_notice_version text not null,
  source text not null,
  -- Deduplication bookkeeping (repeated requests are merged, see submit_demo_request).
  submission_count integer not null default 1,
  last_submitted_at timestamptz not null default now(),

  constraint demo_requests_full_name_chk
    check (full_name = btrim(full_name) and char_length(full_name) between 2 and 120),
  constraint demo_requests_email_chk
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  constraint demo_requests_interest_area_chk
    check (interest_area in (
      'equipment_register',
      'service_coordination',
      'solution_recommendations',
      'tenders_sales_opportunities',
      'partnership',
      'full_presentation'
    )),
  constraint demo_requests_message_chk
    check (message is null or char_length(message) between 1 and 2000),
  constraint demo_requests_consent_chk
    check (
      (marketing_opt_in and consent_version is not null and consent_recorded_at is not null)
      or (not marketing_opt_in and consent_version is null and consent_recorded_at is null)
    ),
  constraint demo_requests_consent_version_chk
    check (consent_version is null or char_length(consent_version) between 1 and 64),
  constraint demo_requests_privacy_notice_version_chk
    check (char_length(privacy_notice_version) between 1 and 64),
  constraint demo_requests_source_chk
    check (source ~ '^[a-z0-9:_-]{1,64}$'),
  constraint demo_requests_submission_count_chk
    check (submission_count >= 1)
);

comment on table public.demo_requests is
  'Pilot/demo inquiries from the public website. Written only by server-side route handlers.';

create index demo_requests_dedupe_idx
  on public.demo_requests (email, interest_area, last_submitted_at desc);
create index demo_requests_created_at_idx
  on public.demo_requests (created_at desc);

-- ---------------------------------------------------------------------------
-- contact_messages: general contact form
-- ---------------------------------------------------------------------------

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  message text not null,
  privacy_notice_version text not null,
  source text not null,

  constraint contact_messages_full_name_chk
    check (full_name = btrim(full_name) and char_length(full_name) between 2 and 120),
  constraint contact_messages_email_chk
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  constraint contact_messages_message_chk
    check (char_length(message) between 10 and 4000),
  constraint contact_messages_privacy_notice_version_chk
    check (char_length(privacy_notice_version) between 1 and 64),
  constraint contact_messages_source_chk
    check (source ~ '^[a-z0-9:_-]{1,64}$')
);

comment on table public.contact_messages is
  'Contact form messages from the public website. Written only by server-side route handlers.';

create index contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- ---------------------------------------------------------------------------
-- form_rate_limits: durable fixed-window rate limiting
--
-- key_hash is an HMAC-SHA256 of the client IP or e-mail address computed in
-- the application; raw identifiers are never stored. Rows older than one day
-- are deleted opportunistically on every call (see consume_form_rate_limit).
-- ---------------------------------------------------------------------------

create table public.form_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key_hash, window_start),

  constraint form_rate_limits_bucket_chk check (bucket ~ '^[a-z0-9:_-]{1,64}$'),
  constraint form_rate_limits_key_hash_chk check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint form_rate_limits_hits_chk check (hits >= 0)
);

comment on table public.form_rate_limits is
  'Pseudonymous rate-limit counters (HMAC of IP or e-mail). Retained for at most ~24 hours.';

create index form_rate_limits_window_start_idx
  on public.form_rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------

alter table public.demo_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.form_rate_limits enable row level security;

-- No policies are created on purpose: anon/authenticated get no row access.

revoke all on table public.demo_requests from public, anon, authenticated;
revoke all on table public.contact_messages from public, anon, authenticated;
revoke all on table public.form_rate_limits from public, anon, authenticated;

grant select, insert, update on table public.demo_requests to service_role;
grant select, insert on table public.contact_messages to service_role;
grant select, insert, update, delete on table public.form_rate_limits to service_role;

-- ---------------------------------------------------------------------------
-- consume_form_rate_limit
-- Returns true while the number of hits in the current window is within the
-- limit. Also deletes counters older than one day (retention).
-- ---------------------------------------------------------------------------

create function public.consume_form_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.form_rate_limits as r (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, v_window_start, 1)
  on conflict (bucket, key_hash, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  delete from public.form_rate_limits
  where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_demo_request
-- Inserts a pilot/demo request, or merges it into a request with the same
-- e-mail and interest area submitted within the last 24 hours. The function
-- returns nothing, so callers cannot learn whether an address already exists.
-- Marketing consent is recorded when given and never silently withdrawn by a
-- later submission (withdrawal must be handled explicitly).
-- ---------------------------------------------------------------------------

create function public.submit_demo_request(
  p_full_name text,
  p_email text,
  p_interest_area text,
  p_message text,
  p_marketing_opt_in boolean,
  p_consent_version text,
  p_privacy_notice_version text,
  p_source text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_existing_id uuid;
begin
  if p_marketing_opt_in and p_consent_version is null then
    raise exception 'consent version required for marketing opt-in' using errcode = '22023';
  end if;

  select id into v_existing_id
  from public.demo_requests
  where email = v_email
    and interest_area = p_interest_area
    and last_submitted_at > now() - interval '24 hours'
  order by last_submitted_at desc
  limit 1
  for update;

  if v_existing_id is null then
    insert into public.demo_requests (
      full_name, email, interest_area, message,
      marketing_opt_in, consent_version, consent_recorded_at,
      privacy_notice_version, source
    ) values (
      btrim(p_full_name), v_email, p_interest_area, nullif(btrim(p_message), ''),
      coalesce(p_marketing_opt_in, false),
      case when p_marketing_opt_in then p_consent_version end,
      case when p_marketing_opt_in then now() end,
      p_privacy_notice_version, p_source
    );
  else
    update public.demo_requests
    set full_name = btrim(p_full_name),
        message = coalesce(nullif(btrim(p_message), ''), message),
        privacy_notice_version = p_privacy_notice_version,
        submission_count = submission_count + 1,
        last_submitted_at = now(),
        marketing_opt_in = marketing_opt_in or coalesce(p_marketing_opt_in, false),
        consent_version = case
          when p_marketing_opt_in and not marketing_opt_in then p_consent_version
          else consent_version
        end,
        consent_recorded_at = case
          when p_marketing_opt_in and not marketing_opt_in then now()
          else consent_recorded_at
        end
    where id = v_existing_id;
  end if;
end;
$$;

revoke all on function public.consume_form_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.submit_demo_request(text, text, text, text, boolean, text, text, text) from public, anon, authenticated;

grant execute on function public.consume_form_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.submit_demo_request(text, text, text, text, boolean, text, text, text) to service_role;
