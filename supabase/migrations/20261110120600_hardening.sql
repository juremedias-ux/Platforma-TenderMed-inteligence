-- TenderMed Intelligence platform – privilege hardening
--
-- Supabase grants EXECUTE on new public functions to anon and authenticated
-- through default privileges; `revoke ... from public` does not remove those
-- explicit grants. accept_invitation already refuses anonymous callers
-- (TM_NOT_AUTHENTICATED), but anon should not be able to call it at all.
-- tests/db/security.test.ts checks that only get_invitation_preview remains
-- callable by anon.

revoke execute on function public.accept_invitation(bytea) from anon;

-- Profiles for accounts that existed before the platform migrations (the
-- profile trigger only covers accounts created afterwards).
insert into public.profiles (id, email, full_name)
select u.id, lower(u.email), left(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''), 120)
from auth.users u
where u.email is not null
on conflict (id) do nothing;
