-- TenderMed Intelligence platform – foundation
--
-- Profiles, organizations, memberships, invitations, supplier approvals and
-- audit events. Additive: the public-website inquiry tables are untouched.
--
-- Security model (see docs/security-model.md)
--   * Every table has RLS enabled. Access is granted to the `authenticated`
--     role only through policies based on verified membership (auth.uid()).
--   * `anon` has no table access. Public invitation previews go through one
--     narrow SECURITY DEFINER function.
--   * Roles live only in organization_memberships, never in user metadata.
--   * Membership helpers are SECURITY DEFINER in the non-exposed `private`
--     schema. Reason: policies on organization_memberships (and on every
--     tenant table) must look up the caller's membership; doing that with an
--     invoker function would re-enter the membership policies recursively.
--     The helpers only ever answer questions about auth.uid().

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.role_rank(p_role text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner' then 4
    when 'admin' then 3
    when 'equipment_manager' then 2
    when 'viewer' then 1
    else 0
  end
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Copy of auth.users.email so co-members can see who is who.
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_chk
    check (full_name is null or (full_name = btrim(full_name) and char_length(full_name) between 1 and 120))
);

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Profiles are created by a trigger on auth.users (definer: auth.users and
-- public.profiles are not writable by the signing-up user).
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), left(v_name, 120))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- organizations and memberships
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null,
  require_completion_acknowledgment boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_chk check (name = btrim(name) and char_length(name) between 2 and 160),
  constraint organizations_kind_chk
    check (kind in ('healthcare_provider', 'distributor', 'service_provider', 'manufacturer'))
);

create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();

create table public.organization_memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (organization_id, user_id),
  constraint organization_memberships_role_chk
    check (role in ('owner', 'admin', 'equipment_manager', 'viewer'))
);

create index organization_memberships_user_idx on public.organization_memberships (user_id);

-- Membership helpers (see header for why they are SECURITY DEFINER).
create function private.org_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_memberships m
  where m.organization_id = p_org and m.user_id = auth.uid()
$$;

create function private.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.role = any (p_roles)
     from public.organization_memberships m
     where m.organization_id = p_org and m.user_id = auth.uid()),
    false)
$$;

create function private.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = auth.uid())
$$;

-- True when the caller and p_user share at least one organization.
create function private.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user)
$$;

revoke all on function private.org_role(uuid), private.has_org_role(uuid, text[]),
  private.is_org_member(uuid), private.shares_org_with(uuid) from public;
grant execute on function private.org_role(uuid), private.has_org_role(uuid, text[]),
  private.is_org_member(uuid), private.shares_org_with(uuid), private.role_rank(text)
  to authenticated, service_role;

-- Membership rules: no self-promotion, admins cannot touch owners, the last
-- owner cannot be removed or demoted. Actor rules apply to statements run by
-- the `authenticated` role; trusted paths (definer functions such as
-- accept_invitation, and the service role) skip them. The last-owner rule
-- always applies.
create function private.enforce_membership_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_owner_count integer;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
      raise exception 'TM_MEMBERSHIP_IMMUTABLE' using errcode = 'P0001';
    end if;
  end if;

  if current_user = 'authenticated' then
    select m.role into v_actor_role
    from public.organization_memberships m
    where m.organization_id = old.organization_id and m.user_id = v_actor;

    if tg_op = 'UPDATE' then
      if old.user_id = v_actor then
        raise exception 'TM_MEMBERSHIP_SELF_CHANGE' using errcode = 'P0001';
      end if;
      if v_actor_role is distinct from 'owner' and (old.role = 'owner' or new.role = 'owner') then
        raise exception 'TM_MEMBERSHIP_OWNER_ONLY' using errcode = 'P0001';
      end if;
    elsif tg_op = 'DELETE' and old.user_id is distinct from v_actor then
      if v_actor_role is distinct from 'owner' and old.role = 'owner' then
        raise exception 'TM_MEMBERSHIP_OWNER_ONLY' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into v_owner_count
    from public.organization_memberships m
    where m.organization_id = old.organization_id and m.role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'TM_LAST_OWNER' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organization_memberships_rules
  before update or delete on public.organization_memberships
  for each row execute function private.enforce_membership_change();

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  email text not null,
  role text,
  -- For kind = 'service_assignment'; the foreign key is added together with
  -- the service_requests table.
  service_request_id uuid,
  token_hash bytea not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  constraint invitations_kind_chk check (kind in ('membership', 'service_assignment')),
  constraint invitations_email_chk
    check (email = lower(btrim(email)) and char_length(email) between 3 and 254
           and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint invitations_role_chk check (role is null or role in ('owner', 'admin', 'equipment_manager', 'viewer')),
  constraint invitations_shape_chk check (
    (kind = 'membership' and role is not null and service_request_id is null)
    or (kind = 'service_assignment' and role is null and service_request_id is not null)),
  constraint invitations_token_chk check (octet_length(token_hash) = 32),
  constraint invitations_expiry_chk check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  constraint invitations_state_chk check (not (accepted_at is not null and revoked_at is not null))
);

create unique index invitations_one_pending_idx
  on public.invitations (organization_id, kind, email, coalesce(service_request_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where accepted_at is null and revoked_at is null;

-- For statements run by `authenticated`: the inviter is always the caller,
-- admins cannot invite owners, and only revocation may change an invitation
-- after creation. Acceptance runs in a definer function (current_user is the
-- function owner), which may set accepted_*.
create function private.enforce_invitation_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := v_actor;
    new.created_at := now();
    new.accepted_at := null;
    new.accepted_by := null;
    new.revoked_at := null;
    new.revoked_by := null;
    if new.kind = 'membership'
       and private.role_rank(new.role) > private.role_rank(private.org_role(new.organization_id)) then
      raise exception 'TM_INVITATION_ROLE_TOO_HIGH' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE: revocation only
  if old.revoked_at is not null or old.accepted_at is not null then
    raise exception 'TM_INVITATION_CLOSED' using errcode = 'P0001';
  end if;
  if new.revoked_at is null then
    raise exception 'TM_INVITATION_IMMUTABLE' using errcode = 'P0001';
  end if;
  new.revoked_at := now();
  new.revoked_by := v_actor;
  return new;
end;
$$;

create trigger invitations_rules
  before insert or update on public.invitations
  for each row execute function private.enforce_invitation_change();

-- Public preview of an invitation by token hash (no row = unknown token).
-- Definer: the invitee is not yet a member and cannot read invitations.
create function public.get_invitation_preview(p_token_hash bytea)
returns table (
  organization_name text,
  kind text,
  role text,
  email text,
  status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.kind, i.role, i.email,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at <= now() then 'expired'
      else 'pending'
    end,
    i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = p_token_hash
$$;

revoke all on function public.get_invitation_preview(bytea) from public;
grant execute on function public.get_invitation_preview(bytea) to anon, authenticated, service_role;

-- Accepts an invitation for the calling user, transactionally.
-- Definer: the caller is not a member yet and has no insert rights on
-- memberships. Checks: authenticated caller, token exists, not revoked, not
-- used, not expired, caller's verified e-mail equals the invited e-mail.
-- FOR UPDATE serializes concurrent acceptance of the same token.
create function public.accept_invitation(p_token_hash bytea)
returns table (organization_id uuid, kind text, service_request_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
  v_email text;
  v_confirmed timestamptz;
  v_existing_role text;
begin
  if v_uid is null then
    raise exception 'TM_NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_inv from public.invitations i where i.token_hash = p_token_hash for update;
  if not found then
    raise exception 'TM_INVITATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'TM_INVITATION_REVOKED' using errcode = 'P0001';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'TM_INVITATION_USED' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'TM_INVITATION_EXPIRED' using errcode = 'P0001';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;
  if v_email is distinct from v_inv.email then
    raise exception 'TM_INVITATION_EMAIL_MISMATCH' using errcode = 'P0001';
  end if;
  if v_confirmed is null then
    raise exception 'TM_EMAIL_NOT_VERIFIED' using errcode = 'P0001';
  end if;

  if v_inv.kind = 'membership' then
    select m.role into v_existing_role
    from public.organization_memberships m
    where m.organization_id = v_inv.organization_id and m.user_id = v_uid;

    if v_existing_role is null then
      insert into public.organization_memberships (organization_id, user_id, role, created_by)
      values (v_inv.organization_id, v_uid, v_inv.role, v_inv.created_by);
    elsif private.role_rank(v_inv.role) > private.role_rank(v_existing_role) then
      update public.organization_memberships m set role = v_inv.role
      where m.organization_id = v_inv.organization_id and m.user_id = v_uid;
    end if;
  else
    perform private.accept_service_assignment(v_inv.organization_id, v_inv.service_request_id, v_uid, v_inv.created_by);
  end if;

  update public.invitations i set accepted_at = now(), accepted_by = v_uid where i.id = v_inv.id;

  return query select v_inv.organization_id, v_inv.kind, v_inv.service_request_id;
end;
$$;

-- Placeholder replaced by the service-collaboration migration.
create function private.accept_service_assignment(p_org uuid, p_request uuid, p_user uuid, p_assigned_by uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'TM_NOT_SUPPORTED' using errcode = 'P0001';
end;
$$;

revoke all on function public.accept_invitation(bytea) from public;
grant execute on function public.accept_invitation(bytea) to authenticated;
revoke all on function private.accept_service_assignment(uuid, uuid, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- supplier approvals (written only by the platform operator via service role)
-- ---------------------------------------------------------------------------

create table public.supplier_approvals (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  status text not null default 'approved',
  commercial_relationship text not null default 'none_declared',
  note text,
  approved_at timestamptz not null default now(),
  constraint supplier_approvals_status_chk check (status in ('approved', 'suspended')),
  constraint supplier_approvals_relationship_chk check (commercial_relationship in
    ('none_declared', 'platform_operator_distributes', 'partner_listing', 'sponsored'))
);

create function private.is_approved_supplier(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.supplier_approvals s where s.organization_id = p_org and s.status = 'approved')
$$;

revoke all on function private.is_approved_supplier(uuid) from public;
grant execute on function private.is_approved_supplier(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- audit events (append-only for application roles)
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changed_columns text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint audit_events_action_chk check (action in ('insert', 'update', 'delete'))
);

create index audit_events_entity_idx on public.audit_events (organization_id, entity_type, entity_id, created_at desc);

-- Records which columns changed, never their values (documents and messages
-- may contain confidential text). Definer: users cannot insert audit rows.
create function private.audit_row()
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

revoke all on function private.audit_row() from public;

create trigger organizations_audit after update on public.organizations
  for each row execute function private.audit_row();
create trigger organization_memberships_audit after insert or update or delete on public.organization_memberships
  for each row execute function private.audit_row();
create trigger invitations_audit after insert or update on public.invitations
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Row-level security and privileges
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.supplier_approvals enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.profiles, public.organizations, public.organization_memberships,
  public.invitations, public.supplier_approvals, public.audit_events from public, anon, authenticated;

grant select, update (full_name) on table public.profiles to authenticated;
grant select, update (name, require_completion_acknowledgment) on table public.organizations to authenticated;
grant select, update (role), delete on table public.organization_memberships to authenticated;
grant select, insert (organization_id, kind, email, role, service_request_id, token_hash, expires_at),
  update (revoked_at) on table public.invitations to authenticated;
grant select on table public.supplier_approvals to authenticated;
grant select on table public.audit_events to authenticated;

grant all on table public.profiles, public.organizations, public.organization_memberships,
  public.invitations, public.supplier_approvals, public.audit_events to service_role;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_org_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
create policy organizations_update_owner on public.organizations for update to authenticated
  using (private.has_org_role(id, array['owner'])) with check (private.has_org_role(id, array['owner']));

create policy memberships_select on public.organization_memberships for select to authenticated
  using (private.is_org_member(organization_id));
create policy memberships_update on public.organization_memberships for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy memberships_delete on public.organization_memberships for delete to authenticated
  using (user_id = auth.uid() or private.has_org_role(organization_id, array['owner', 'admin']));

create policy invitations_select on public.invitations for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin']));
create policy invitations_revoke on public.invitations for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']))
  with check (private.has_org_role(organization_id, array['owner', 'admin']));

create policy supplier_approvals_select on public.supplier_approvals for select to authenticated
  using (private.is_org_member(organization_id));

create policy audit_events_select on public.audit_events for select to authenticated
  using (private.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Operator bootstrap (service role only; called by scripts/bootstrap-organization.mjs)
--
-- Creates the organization if it does not exist and an owner invitation for
-- the given e-mail. Safe to rerun: an existing owner is reported, and a
-- pending owner invitation for the same e-mail is revoked and replaced (the
-- previous link stops working). No account or password is created here.
-- ---------------------------------------------------------------------------

create function public.bootstrap_organization(
  p_name text,
  p_kind text,
  p_owner_email text,
  p_token_hash bytea
)
returns table (organization_id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_name text := btrim(p_name);
  v_email text := lower(btrim(p_owner_email));
  v_org uuid;
  v_kind text;
  v_matches integer;
begin
  select count(*) into v_matches from public.organizations o where lower(o.name) = lower(v_name);
  if v_matches > 1 then
    raise exception 'TM_BOOTSTRAP_AMBIGUOUS' using errcode = 'P0001';
  end if;

  select o.id, o.kind into v_org, v_kind from public.organizations o where lower(o.name) = lower(v_name);
  if v_org is null then
    insert into public.organizations (name, kind) values (v_name, p_kind) returning id into v_org;
  elsif v_kind <> p_kind then
    raise exception 'TM_BOOTSTRAP_KIND_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.organization_memberships m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = v_org and m.role = 'owner' and p.email = v_email
  ) then
    return query select v_org, 'already_owner'::text;
    return;
  end if;

  update public.invitations i
  set revoked_at = now()
  where i.organization_id = v_org and i.kind = 'membership' and i.email = v_email
    and i.accepted_at is null and i.revoked_at is null;

  insert into public.invitations (organization_id, kind, email, role, token_hash)
  values (v_org, 'membership', v_email, 'owner', p_token_hash);

  return query select v_org, 'invitation_created'::text;
end;
$$;

revoke all on function public.bootstrap_organization(text, text, text, bytea) from public, anon, authenticated;
grant execute on function public.bootstrap_organization(text, text, text, bytea) to service_role;
