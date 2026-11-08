-- Verification script for the inquiry migration.
-- Run by scripts/verify-migrations.sh against a throwaway PostgreSQL cluster
-- with emulated Supabase roles. Every check raises an exception on failure.

\set ON_ERROR_STOP on

-- 1. RLS is enabled and there are no policies -------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('demo_requests', 'contact_messages', 'form_rate_limits')
    and c.relrowsecurity;
  if v_count <> 3 then raise exception 'RLS must be enabled on all inquiry tables'; end if;

  select count(*) into v_count from pg_policies
  where schemaname = 'public' and tablename in ('demo_requests', 'contact_messages', 'form_rate_limits');
  if v_count <> 0 then raise exception 'No RLS policies expected, found %', v_count; end if;
end $$;

-- 2. anon / authenticated cannot read, write or call functions --------------
do $$
declare
  r record;
begin
  for r in select * from (values ('anon'), ('authenticated')) as t(role_name) loop
    if has_table_privilege(r.role_name, 'public.demo_requests', 'SELECT, INSERT, UPDATE, DELETE')
       or has_table_privilege(r.role_name, 'public.contact_messages', 'SELECT, INSERT, UPDATE, DELETE')
       or has_table_privilege(r.role_name, 'public.form_rate_limits', 'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'role % must not have table privileges', r.role_name;
    end if;
    if has_function_privilege(r.role_name, 'public.submit_demo_request(text,text,text,text,boolean,text,text,text)', 'EXECUTE')
       or has_function_privilege(r.role_name, 'public.consume_form_rate_limit(text,text,integer,integer)', 'EXECUTE') then
      raise exception 'role % must not execute inquiry functions', r.role_name;
    end if;
  end loop;
end $$;

set role anon;
do $$
begin
  begin
    insert into public.contact_messages (full_name, email, message, privacy_notice_version, source)
    values ('Test Oseba', 'test@example.com', 'Sporočilo za test.', 'v1', 'website:contact');
    raise exception 'anon insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.consume_form_rate_limit('contact:ip', repeat('a', 64), 5, 600);
    raise exception 'anon rpc unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 3. service_role can submit; constraints and deduplication behave ---------
set role service_role;

select public.submit_demo_request('Ana Novak', '  Ana.Novak@Example.com ', 'equipment_register', 'Prvo sporočilo', false, null, 'v1', 'website:pilot');
select public.submit_demo_request('Ana Novak', 'ana.novak@example.com', 'equipment_register', '', true, 'consent-v1', 'v1', 'website:pilot');
select public.submit_demo_request('Ana Novak', 'ana.novak@example.com', 'partnership', null, false, null, 'v1', 'website:pilot');

do $$
declare
  v_rows integer;
  v_row public.demo_requests;
begin
  select count(*) into v_rows from public.demo_requests;
  if v_rows <> 2 then raise exception 'expected 2 rows after dedupe, found %', v_rows; end if;

  select * into v_row from public.demo_requests where interest_area = 'equipment_register';
  if v_row.email <> 'ana.novak@example.com' then raise exception 'email not normalized'; end if;
  if v_row.submission_count <> 2 then raise exception 'submission_count should be 2'; end if;
  if v_row.message <> 'Prvo sporočilo' then raise exception 'empty message must not overwrite previous message'; end if;
  if not v_row.marketing_opt_in or v_row.consent_version <> 'consent-v1' or v_row.consent_recorded_at is null then
    raise exception 'marketing consent should be recorded on later opt-in';
  end if;
end $$;

-- Opting out in a later submission does not silently erase recorded consent.
select public.submit_demo_request('Ana Novak', 'ana.novak@example.com', 'equipment_register', null, false, null, 'v1', 'website:pilot');
do $$
begin
  if not (select marketing_opt_in from public.demo_requests where interest_area = 'equipment_register') then
    raise exception 'consent must not be withdrawn implicitly';
  end if;
end $$;

-- Constraint checks
do $$
begin
  begin
    insert into public.contact_messages (full_name, email, message, privacy_notice_version, source)
    values ('A', 'a@example.com', 'Prekratko', 'v1', 'website:contact');
    raise exception 'short name/message accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.contact_messages (full_name, email, message, privacy_notice_version, source)
    values ('Test Oseba', 'Upper@Example.com', 'Dovolj dolgo sporočilo.', 'v1', 'website:contact');
    raise exception 'non-normalized email accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.demo_requests (full_name, email, interest_area, privacy_notice_version, source, marketing_opt_in)
    values ('Test Oseba', 'test@example.com', 'equipment_register', 'v1', 'website:pilot', true);
    raise exception 'opt-in without consent version accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.demo_requests (full_name, email, interest_area, privacy_notice_version, source)
    values ('Test Oseba', 'test@example.com', 'unknown_area', 'v1', 'website:pilot');
    raise exception 'unknown interest area accepted';
  exception when check_violation then null;
  end;
end $$;

insert into public.contact_messages (full_name, email, message, privacy_notice_version, source)
values ('Test Oseba', 'test@example.com', 'Dovolj dolgo sporočilo.', 'v1', 'website:contact');

-- 4. Rate limiting ----------------------------------------------------------
do $$
declare
  v_key text := repeat('b', 64);
  v_allowed boolean;
  i integer;
begin
  for i in 1..3 loop
    v_allowed := public.consume_form_rate_limit('contact:ip', v_key, 3, 600);
    if not v_allowed then raise exception 'hit % should be allowed', i; end if;
  end loop;
  v_allowed := public.consume_form_rate_limit('contact:ip', v_key, 3, 600);
  if v_allowed then raise exception '4th hit should be rejected'; end if;

  -- A different key is independent.
  if not public.consume_form_rate_limit('contact:ip', repeat('c', 64), 3, 600) then
    raise exception 'independent key should be allowed';
  end if;

  -- Expired windows are deleted on the next call.
  insert into public.form_rate_limits (bucket, key_hash, window_start, hits)
  values ('contact:ip', repeat('d', 64), now() - interval '2 days', 10);
  perform public.consume_form_rate_limit('contact:ip', repeat('e', 64), 3, 600);
  if exists (select 1 from public.form_rate_limits where key_hash = repeat('d', 64)) then
    raise exception 'expired rate-limit rows should be deleted';
  end if;

  begin
    perform public.consume_form_rate_limit('contact:ip', v_key, 0, 600);
    raise exception 'invalid limit accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

reset role;

select 'inquiry migration verification passed' as result;
