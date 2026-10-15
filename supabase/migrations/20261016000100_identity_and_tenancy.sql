-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1a — Identity & tenancy
--
-- Tables: organizations, departments, profiles, invites, audit_logs.
--
-- Security model (see docs/DATABASE.md):
--  * Row Level Security on every table; the database is the final authority.
--  * Policies call private.my_org_id() / my_role(), which read the caller's
--    *current* profile, so a role change or deactivation applies immediately.
--  * Tenant consistency: composite foreign keys (org_id, id) make it impossible
--    for a row to reference another organization's row.
--  * Members may only change personal columns (column-level GRANTs). Role,
--    department and status change only through admin_* functions, which check
--    permissions and write the audit row in the same transaction.
--  * Sign-up is invite-only, enforced by a trigger on auth.users.
--  * audit_logs is append-only, even for the table owner.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists private;
revoke all on schema private from public;
-- Policies run as the caller, so the caller must be able to execute the helpers.
grant usage on schema private to authenticated;

-- ─────────────────────────────── Types ───────────────────────────────

create type public.user_role as enum ('super_admin', 'org_admin', 'manager', 'member');
create type public.org_status as enum ('active', 'suspended');
create type public.profile_status as enum ('active', 'deactivated');

-- ─────────────────────────────── Tables ──────────────────────────────

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 120),
  slug       text not null unique
             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  -- IANA timezone; work dates are computed in it. Validated by trigger below.
  timezone   text not null default 'Asia/Kolkata',
  status     public.org_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete restrict,
  name       text not null check (char_length(btrim(name)) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, name)
);

/** One row per login (auth.users). Not created by clients: see triggers below. */
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  -- NULL only for the platform Super Admin (CHECK below).
  org_id             uuid references public.organizations (id) on delete restrict,
  -- Mirrored from auth.users so admins can list members (auth.users is not exposed).
  email              text not null check (email = lower(email)),
  role               public.user_role not null default 'member',
  full_name          text not null default '' check (char_length(full_name) <= 120),
  avatar_url         text check (avatar_url is null or char_length(avatar_url) <= 500),
  -- BCP-47-style code; the app decides which locales it supports.
  preferred_language text not null default 'en' check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  theme              text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notification_prefs jsonb not null default '{"email": true, "push": false}'
                     check (jsonb_typeof(notification_prefs) = 'object'),
  department_id      uuid,
  status             public.profile_status not null default 'active',
  -- Soft delete: the row stays for history; personal data is purged by the
  -- retention job (Phase 11).
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, id),
  -- Same-organization department only; deleting it just clears the link.
  foreign key (org_id, department_id)
    references public.departments (org_id, id) on delete set null (department_id),
  constraint profiles_super_admin_has_no_org check ((role = 'super_admin') = (org_id is null))
);

create index profiles_org_idx on public.profiles (org_id, role);
create index profiles_department_idx on public.profiles (org_id, department_id);

/**
 * Invitations. Email invites are single-use and bound to one address; link
 * invites (email NULL) carry a short shareable code and may allow several uses.
 * Only a SHA-256 hash of the token/code is stored.
 */
create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  email         text check (email is null or email = lower(email)),
  role          public.user_role not null check (role <> 'super_admin'),
  department_id uuid,
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  max_uses      integer not null default 1 check (max_uses between 1 and 500),
  uses          integer not null default 0,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  accepted_at   timestamptz,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (org_id, department_id)
    references public.departments (org_id, id) on delete set null (department_id),
  constraint invites_uses_within_limit check (uses between 0 and max_uses),
  constraint invites_email_is_single_use check (email is null or max_uses = 1)
);

create index invites_org_idx on public.invites (org_id, created_at desc);

/** Append-only audit trail. Never store passwords, tokens or biometric data in metadata. */
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  org_id      uuid references public.organizations (id) on delete restrict,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null,
  entity_id   text,
  metadata    jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  ip          inet,
  user_agent  text check (user_agent is null or char_length(user_agent) <= 512),
  created_at  timestamptz not null default now()
);

create index audit_logs_org_idx on public.audit_logs (org_id, created_at desc);

-- ───────────────────────────── Helpers ────────────────────────────────
-- SECURITY DEFINER so they can read profiles without recursing into its own
-- RLS policies. search_path = '' forces fully qualified names (no hijacking).

/** The caller's organization, or NULL if they are inactive, deleted or their org is suspended. */
create function private.my_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.org_id
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid()
    and p.status = 'active'
    and p.deleted_at is null
    and o.status = 'active'
$$;

/** The caller's role, or NULL if they are inactive or deleted. */
create function private.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null
$$;

create function private.my_department_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.department_id
  from public.profiles p
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null
$$;

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'super_admin', false)
$$;

/** Internal: append an audit row (called from SECURITY DEFINER functions and triggers). */
create function private.write_audit(
  p_org_id uuid, p_actor_id uuid, p_action text, p_entity_type text, p_entity_id text,
  p_metadata jsonb default '{}'
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (org_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_org_id, p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'))
$$;

create function private.assert_org_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.my_role() is distinct from 'org_admin' or private.my_org_id() is null then
    raise exception 'Only organization admins can do this' using errcode = '42501';
  end if;
end $$;

/** Raises unless the organization keeps another active admin besides p_excluding. */
create function private.assert_other_active_admin(p_org_id uuid, p_excluding uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where org_id = p_org_id and role = 'org_admin' and status = 'active'
      and deleted_at is null and id <> p_excluding
  ) then
    raise exception 'An organization must keep at least one active admin'
      using errcode = 'P0001', hint = 'last_admin';
  end if;
end $$;

revoke all on all functions in schema private from public;
grant execute on function
  private.my_org_id(), private.my_role(), private.my_department_id(), private.is_super_admin()
  to authenticated;

-- ───────────────────────────── Triggers ───────────────────────────────

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger departments_updated_at before update on public.departments
  for each row execute function private.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;

create trigger organizations_timezone before insert or update of timezone on public.organizations
  for each row execute function private.validate_timezone();

create function private.forbid_audit_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end $$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.forbid_audit_changes();

/**
 * Gatekeeper for every new login. A user may be created only
 *  (a) by trusted server code that sets app_metadata.bootstrap_role (clients
 *      cannot set app_metadata), or
 *  (b) with a valid invitation token in user_metadata.invite_token.
 * The token is consumed (uses + 1), replaced by the invite id in
 * app_metadata, and removed from user_metadata.
 */
create function private.before_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_token  text := new.raw_user_meta_data ->> 'invite_token';
  v_invite public.invites;
begin
  if coalesce(new.raw_app_meta_data, '{}'::jsonb) ? 'bootstrap_role' then
    return new;
  end if;

  if v_token is null or v_token = '' then
    raise exception 'An invitation is required to create an account'
      using errcode = 'P0001', hint = 'invite_required';
  end if;

  select * into v_invite
  from public.invites
  where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
  for update;

  if not found
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or v_invite.uses >= v_invite.max_uses
     or not exists (select 1 from public.organizations o
                    where o.id = v_invite.org_id and o.status = 'active') then
    raise exception 'This invitation is invalid or has expired'
      using errcode = 'P0001', hint = 'invite_invalid';
  end if;

  if v_invite.email is not null and v_invite.email <> lower(new.email) then
    raise exception 'This invitation was sent to a different email address'
      using errcode = 'P0001', hint = 'invite_email_mismatch';
  end if;

  update public.invites
  set uses = uses + 1, accepted_at = coalesce(accepted_at, now())
  where id = v_invite.id;

  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('invite_id', v_invite.id);
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'invite_token';
  return new;
end $$;

/** Creates the profile for a user admitted by the gatekeeper above. */
create function private.after_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_meta   jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_name   text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_invite public.invites;
begin
  if v_meta ? 'bootstrap_role' then
    insert into public.profiles (id, email, org_id, role, full_name)
    values (new.id, lower(new.email), nullif(v_meta ->> 'bootstrap_org_id', '')::uuid,
            (v_meta ->> 'bootstrap_role')::public.user_role, v_name);
    return new;
  end if;

  select * into strict v_invite from public.invites where id = (v_meta ->> 'invite_id')::uuid;

  insert into public.profiles (id, email, org_id, role, department_id, full_name)
  values (new.id, lower(new.email), v_invite.org_id, v_invite.role, v_invite.department_id, v_name);

  perform private.write_audit(v_invite.org_id, v_invite.created_by, 'member.created', 'profile',
                              new.id::text,
                              jsonb_build_object('invite_id', v_invite.id, 'role', v_invite.role));
  return new;
end $$;

create function private.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end $$;

/**
 * GoTrue writes user_metadata again right after inserting the user, which
 * would bring the plaintext invite token back. Strip it on every write.
 */
create function private.strip_invite_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.raw_user_meta_data := new.raw_user_meta_data - 'invite_token';
  return new;
end $$;

create trigger auth_user_strip_invite_token before update of raw_user_meta_data on auth.users
  for each row when (new.raw_user_meta_data ? 'invite_token')
  execute function private.strip_invite_token();

create trigger before_auth_user_created before insert on auth.users
  for each row execute function private.before_auth_user_created();
create trigger after_auth_user_created after insert on auth.users
  for each row execute function private.after_auth_user_created();
create trigger auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- ─────────────────────── Admin functions (RPC) ───────────────────────
-- Exposed through the API to signed-in users; each checks permissions itself.

/** Change a member's role and/or department. */
create function public.admin_update_member(
  p_member_id        uuid,
  p_role             public.user_role default null,
  p_department_id    uuid default null,
  p_clear_department boolean default false
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_org    uuid := private.my_org_id();
  v_before public.profiles;
  v_after  public.profiles;
begin
  perform private.assert_org_admin();

  select * into v_before from public.profiles
  where id = p_member_id and org_id = v_org and deleted_at is null
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if p_role = 'super_admin' then
    raise exception 'This role cannot be assigned' using errcode = '42501';
  end if;
  if p_role is not null and p_role <> v_before.role then
    if p_member_id = auth.uid() then
      raise exception 'You cannot change your own role' using errcode = '42501';
    end if;
    if v_before.role = 'org_admin' then
      perform private.assert_other_active_admin(v_org, p_member_id);
    end if;
  end if;

  update public.profiles
  set role = coalesce(p_role, role),
      department_id = case when p_clear_department then null
                           else coalesce(p_department_id, department_id) end
  where id = p_member_id
  returning * into v_after;

  perform private.write_audit(v_org, auth.uid(), 'member.updated', 'profile', p_member_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'role', case when v_after.role is distinct from v_before.role
                   then jsonb_build_object('from', v_before.role, 'to', v_after.role) end,
      'department', case when v_after.department_id is distinct from v_before.department_id
                         then jsonb_build_object('from', v_before.department_id,
                                                 'to', v_after.department_id) end)));
  return v_after;
end $$;

/** Deactivate or reactivate a member. (Phase 1g also bans the login so sessions end.) */
create function public.admin_set_member_status(
  p_member_id uuid,
  p_status    public.profile_status
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_org    uuid := private.my_org_id();
  v_before public.profiles;
  v_after  public.profiles;
begin
  perform private.assert_org_admin();

  select * into v_before from public.profiles
  where id = p_member_id and org_id = v_org and deleted_at is null
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if p_member_id = auth.uid() then
    raise exception 'You cannot change your own status' using errcode = '42501';
  end if;
  if p_status = 'deactivated' and v_before.role = 'org_admin' then
    perform private.assert_other_active_admin(v_org, p_member_id);
  end if;

  update public.profiles set status = p_status where id = p_member_id returning * into v_after;

  if v_after.status is distinct from v_before.status then
    perform private.write_audit(v_org, auth.uid(),
      case p_status when 'active' then 'member.reactivated' else 'member.deactivated' end,
      'profile', p_member_id::text, '{}');
  end if;
  return v_after;
end $$;

/** Soft-delete a member: hidden and unable to sign in; history is kept. */
create function public.admin_delete_member(p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org    uuid := private.my_org_id();
  v_before public.profiles;
begin
  perform private.assert_org_admin();

  select * into v_before from public.profiles
  where id = p_member_id and org_id = v_org and deleted_at is null
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if p_member_id = auth.uid() then
    raise exception 'You cannot delete your own account here' using errcode = '42501';
  end if;
  if v_before.role = 'org_admin' then
    perform private.assert_other_active_admin(v_org, p_member_id);
  end if;

  update public.profiles
  set deleted_at = now(), status = 'deactivated'
  where id = p_member_id;

  perform private.write_audit(v_org, auth.uid(), 'member.deleted', 'profile', p_member_id::text,
                              jsonb_build_object('role', v_before.role));
end $$;

revoke all on function
  public.admin_update_member(uuid, public.user_role, uuid, boolean),
  public.admin_set_member_status(uuid, public.profile_status),
  public.admin_delete_member(uuid)
  from public, anon;
grant execute on function
  public.admin_update_member(uuid, public.user_role, uuid, boolean),
  public.admin_set_member_status(uuid, public.profile_status),
  public.admin_delete_member(uuid)
  to authenticated;

-- ─────────────────────── Privileges (column level) ───────────────────
-- Supabase grants everything on public tables by default; tighten it.
-- Anonymous visitors get nothing: public pages read through the server.

revoke all on public.organizations, public.departments, public.profiles,
              public.invites, public.audit_logs
  from anon, authenticated;

grant select on public.organizations to authenticated;
grant insert (name, slug, timezone) on public.organizations to authenticated;
grant update (name, timezone, status) on public.organizations to authenticated;

grant select, delete on public.departments to authenticated;
grant insert (org_id, name) on public.departments to authenticated;
grant update (name) on public.departments to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, preferred_language, theme, notification_prefs)
  on public.profiles to authenticated;

grant select on public.invites to authenticated;
grant insert (org_id, email, role, department_id, token_hash, max_uses, expires_at)
  on public.invites to authenticated;
grant update (revoked_at) on public.invites to authenticated;

grant select on public.audit_logs to authenticated;

-- ─────────────────────────── RLS policies ────────────────────────────
-- `(select fn())` lets Postgres evaluate each helper once per query, not per row.

alter table public.organizations enable row level security;
alter table public.departments   enable row level security;
alter table public.profiles      enable row level security;
alter table public.invites       enable row level security;
alter table public.audit_logs    enable row level security;

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using (id = (select private.my_org_id()) or (select private.is_super_admin()));
create policy organizations_insert on public.organizations for insert to authenticated
  with check ((select private.is_super_admin()));
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.is_super_admin()))
  with check ((select private.is_super_admin()));

-- departments: tenant data; the Super Admin deliberately has no access.
create policy departments_select on public.departments for select to authenticated
  using (org_id = (select private.my_org_id()));
create policy departments_insert on public.departments for insert to authenticated
  with check (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin');
create policy departments_update on public.departments for update to authenticated
  using (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin')
  with check (org_id = (select private.my_org_id()));
create policy departments_delete on public.departments for delete to authenticated
  using (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin');

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin')
    or (org_id = (select private.my_org_id())
        and (select private.my_role()) = 'manager'
        and department_id is not null
        and department_id = (select private.my_department_id()))
    -- The platform operator sees who administers each organization, nobody else.
    or ((select private.is_super_admin()) and role = 'org_admin')
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

-- invites
create policy invites_select on public.invites for select to authenticated
  using (
    (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin')
    or ((select private.is_super_admin()) and role = 'org_admin')
  );
create policy invites_insert on public.invites for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin')
      or ((select private.is_super_admin()) and role = 'org_admin')
    )
  );
create policy invites_update on public.invites for update to authenticated
  using (
    (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin')
    or ((select private.is_super_admin()) and role = 'org_admin')
  );

-- audit_logs: read-only for admins; rows are written by functions/triggers and
-- by the server (service role). No insert/update/delete policy exists.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    (org_id = (select private.my_org_id()) and (select private.my_role()) = 'org_admin')
    or ((select private.is_super_admin()) and (org_id is null or entity_type = 'organization'))
  );
