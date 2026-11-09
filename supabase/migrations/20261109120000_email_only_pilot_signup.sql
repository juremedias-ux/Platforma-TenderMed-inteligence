-- TenderMed Intelligence – e-mail-only pilot sign-up
--
-- The pilot form now collects only an e-mail address. Name and interest area
-- become optional; their constraints still apply when a value is present.
-- The change is backward compatible: rows and calls that provide all fields
-- keep working, so this migration can be applied before the new site version
-- is deployed.

alter table public.demo_requests alter column full_name drop not null;
alter table public.demo_requests drop constraint demo_requests_full_name_chk;
alter table public.demo_requests add constraint demo_requests_full_name_chk
  check (full_name is null or (full_name = btrim(full_name) and char_length(full_name) between 2 and 120));

alter table public.demo_requests alter column interest_area drop not null;
alter table public.demo_requests drop constraint demo_requests_interest_area_chk;
alter table public.demo_requests add constraint demo_requests_interest_area_chk
  check (interest_area is null or interest_area in (
    'equipment_register',
    'service_coordination',
    'solution_recommendations',
    'tenders_sales_opportunities',
    'partnership',
    'full_presentation'
  ));

-- Deduplication now treats a missing interest area as a value of its own
-- (IS NOT DISTINCT FROM), so repeated e-mail-only sign-ups within 24 hours are
-- merged. A later submission never erases a previously stored name or message.
create or replace function public.submit_demo_request(
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
  v_full_name text := nullif(btrim(p_full_name), '');
  v_message text := nullif(btrim(p_message), '');
  v_opt_in boolean := coalesce(p_marketing_opt_in, false);
  v_existing_id uuid;
begin
  if v_opt_in and p_consent_version is null then
    raise exception 'consent version required for marketing opt-in' using errcode = '22023';
  end if;

  select id into v_existing_id
  from public.demo_requests
  where email = v_email
    and interest_area is not distinct from p_interest_area
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
      v_full_name, v_email, p_interest_area, v_message,
      v_opt_in,
      case when v_opt_in then p_consent_version end,
      case when v_opt_in then now() end,
      p_privacy_notice_version, p_source
    );
  else
    update public.demo_requests
    set full_name = coalesce(v_full_name, full_name),
        message = coalesce(v_message, message),
        privacy_notice_version = p_privacy_notice_version,
        submission_count = submission_count + 1,
        last_submitted_at = now(),
        marketing_opt_in = marketing_opt_in or v_opt_in,
        consent_version = case
          when v_opt_in and not marketing_opt_in then p_consent_version
          else consent_version
        end,
        consent_recorded_at = case
          when v_opt_in and not marketing_opt_in then now()
          else consent_recorded_at
        end
    where id = v_existing_id;
  end if;
end;
$$;

-- CREATE OR REPLACE keeps existing privileges; they are restated explicitly.
revoke all on function public.submit_demo_request(text, text, text, text, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_demo_request(text, text, text, text, boolean, text, text, text) to service_role;
