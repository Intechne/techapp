-- TechApp · 0001 foundation
-- Extensions, enums, private helper schema, profiles, interests, organizations, audit.
-- RLS is part of the schema: every table created here is locked down in this file.

create extension if not exists pgcrypto with schema extensions;

-- Private schema: helpers and secrets that must never be exposed through the API.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------- enums
create type public.education_stage as enum ('middle_school', 'high_school', 'university', 'graduate', 'other');
create type public.org_type as enum ('intechne', 'company', 'university', 'school', 'ngo', 'community', 'public_institution');
create type public.org_member_role as enum ('owner', 'admin', 'editor', 'checkin_staff', 'reviewer');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected', 'revoked');
create type public.publish_status as enum ('draft', 'in_review', 'published', 'cancelled', 'archived');

-- ---------------------------------------------------------------- generic helpers
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Raise an API error. PostgREST maps SQLSTATE 'PTxxx' to HTTP status xxx.
-- message = stable machine code (client maps it to Turkish copy), detail = optional context.
create or replace function app.fail(p_status int, p_code text, p_detail text default null) returns void
language plpgsql as $$
begin
  raise exception using
    errcode = 'PT' || p_status::text,
    message = p_code,
    detail = coalesce(p_detail, '');
end $$;

-- Server-side secrets (generated per environment at migration time, never in source control).
create table app.secrets (
  name text primary key,
  value bytea not null,
  created_at timestamptz not null default now()
);
revoke all on app.secrets from public, anon, authenticated;
insert into app.secrets (name, value) values ('ticket_hmac_v1', extensions.gen_random_bytes(32));

-- Platform (Intechne) administrators. Managed only with the service role / SQL.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- no policies: invisible to API clients.

create or replace function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------- profiles
-- Public-facing profile. Age-related and contact data live in profile_private.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 2 and 60),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 600),
  city text check (char_length(city) <= 60),
  education_stage public.education_stage,
  avatar_path text,
  discoverable boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

-- Private profile data: only the owner can read it. birth_date is write-once (see RPC).
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  legal_name text check (char_length(legal_name) between 3 and 120),
  birth_date date,
  birth_date_set_at timestamptz,
  phone text check (char_length(phone) <= 24),
  school_name text check (char_length(school_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profile_private_touch before update on public.profile_private
  for each row execute function app.touch_updated_at();

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.profile_private (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- Age in whole years, using the server clock in Europe/Istanbul. NULL if unknown.
create or replace function app.age_years(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select extract(year from age((now() at time zone 'Europe/Istanbul')::date, pp.birth_date))::int
  from public.profile_private pp where pp.user_id = p_user and pp.birth_date is not null;
$$;

-- Minimum account age. Product decision pending legal review (see docs/GUARDIAN-CONSENT.md).
create or replace function app.min_account_age() returns int language sql immutable as $$ select 13 $$;

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_select_discoverable on public.profiles for select to authenticated
  using (discoverable and onboarded_at is not null);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy profile_private_select_own on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()));
-- Owner may update contact fields; birth_date columns are protected by the trigger below.
create policy profile_private_update_own on public.profile_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function app.protect_birth_date() returns trigger
language plpgsql as $$
begin
  if (new.birth_date is distinct from old.birth_date or new.birth_date_set_at is distinct from old.birth_date_set_at)
     and coalesce(current_setting('app.allow_birth_date_write', true), '') <> 'on' then
    perform app.fail(403, 'birth_date_locked');
  end if;
  return new;
end $$;
create trigger profile_private_protect before update on public.profile_private
  for each row execute function app.protect_birth_date();

-- A minor can never be publicly discoverable; enforced on the server.
create or replace function app.protect_discoverable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.discoverable and coalesce(app.age_years(new.id), 0) < 18 then
    perform app.fail(403, 'discoverable_requires_adult');
  end if;
  return new;
end $$;
create trigger profiles_protect_discoverable before insert or update of discoverable on public.profiles
  for each row execute function app.protect_discoverable();

-- ---------------------------------------------------------------- interests
create table public.interests (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  label_tr text not null,
  icon text not null default 'spark',
  sort_order smallint not null default 0
);
create table public.profile_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  interest_id smallint not null references public.interests (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
create policy interests_read on public.interests for select to anon, authenticated using (true);
create policy profile_interests_own on public.profile_interests for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- organizations (tenant boundary)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  type public.org_type not null,
  tagline text check (char_length(tagline) <= 200),
  about text check (char_length(about) <= 2000),
  website text check (website ~ '^https://'),
  logo_path text,
  verification public.verification_status not null default 'unverified',
  verified_at timestamptz,
  verified_by uuid references auth.users (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function app.touch_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_member_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create or replace function app.has_org_role(p_org uuid, p_roles public.org_member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;
create or replace function app.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = (select auth.uid())
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy organizations_public_read on public.organizations for select to anon, authenticated
  using (verification = 'verified');
create policy organizations_member_read on public.organizations for select to authenticated
  using (app.is_org_member(id) or app.is_platform_admin());
create policy organizations_admin_update on public.organizations for update to authenticated
  using (app.has_org_role(id, array['owner', 'admin']::public.org_member_role[]) or app.is_platform_admin())
  with check (app.has_org_role(id, array['owner', 'admin']::public.org_member_role[]) or app.is_platform_admin());
create policy organizations_platform_insert on public.organizations for insert to authenticated
  with check (app.is_platform_admin());

-- Only platform admins decide verification; org admins cannot self-verify.
create or replace function app.protect_org_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.verification is distinct from old.verification
      or new.verified_at is distinct from old.verified_at
      or new.verified_by is distinct from old.verified_by
      or new.is_demo is distinct from old.is_demo)
     and (select auth.uid()) is not null and not app.is_platform_admin() then
    perform app.fail(403, 'org_verification_forbidden');
  end if;
  return new;
end $$;
create trigger organizations_protect before update on public.organizations
  for each row execute function app.protect_org_verification();

create policy org_members_read on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or app.is_org_member(organization_id) or app.is_platform_admin());
create policy org_members_manage on public.organization_members for all to authenticated
  using (app.has_org_role(organization_id, array['owner']::public.org_member_role[]) or app.is_platform_admin())
  with check (app.has_org_role(organization_id, array['owner']::public.org_member_role[]) or app.is_platform_admin());

-- ---------------------------------------------------------------- audit
-- Append-only. No PII in metadata: ids and machine codes only.
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('user', 'guardian', 'system', 'service')),
  action text not null,
  target_type text not null,
  target_id uuid,
  organization_id uuid references public.organizations (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_target_idx on public.audit_events (target_type, target_id);
create index audit_events_org_idx on public.audit_events (organization_id, created_at desc);
alter table public.audit_events enable row level security;
create policy audit_platform_read on public.audit_events for select to authenticated
  using (app.is_platform_admin()
         or (organization_id is not null
             and app.has_org_role(organization_id, array['owner', 'admin']::public.org_member_role[])));

create or replace function app.audit(
  p_actor_kind text, p_action text, p_target_type text, p_target_id uuid,
  p_org uuid default null, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_events (actor_id, actor_kind, action, target_type, target_id, organization_id, metadata)
  values ((select auth.uid()), p_actor_kind, p_action, p_target_type, p_target_id, p_org, p_metadata);
$$;

-- ---------------------------------------------------------------- profile bootstrap RPC
-- Called once after first sign-in: display name, education stage, birth date, interests.
create or replace function public.complete_profile_bootstrap(
  p_display_name text,
  p_education_stage public.education_stage,
  p_birth_date date,
  p_interest_slugs text[] default '{}'
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_existing date;
  v_age int;
  v_profile public.profiles;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_display_name is null or char_length(btrim(p_display_name)) < 2 then
    perform app.fail(422, 'display_name_invalid');
  end if;
  if p_birth_date is null or p_birth_date > v_today or p_birth_date < v_today - interval '100 years' then
    perform app.fail(422, 'birth_date_invalid');
  end if;
  v_age := extract(year from age(v_today, p_birth_date))::int;
  if v_age < app.min_account_age() then perform app.fail(422, 'below_min_age'); end if;

  select birth_date into v_existing from public.profile_private where user_id = v_uid for update;
  if v_existing is not null and v_existing <> p_birth_date then
    perform app.fail(409, 'birth_date_locked');
  end if;

  perform set_config('app.allow_birth_date_write', 'on', true);
  update public.profile_private
     set birth_date = p_birth_date, birth_date_set_at = coalesce(birth_date_set_at, now())
   where user_id = v_uid;
  perform set_config('app.allow_birth_date_write', 'off', true);

  update public.profiles
     set display_name = btrim(p_display_name),
         education_stage = p_education_stage,
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid
   returning * into v_profile;

  if coalesce(array_length(p_interest_slugs, 1), 0) > 0 then
    delete from public.profile_interests where user_id = v_uid;
    insert into public.profile_interests (user_id, interest_id)
    select v_uid, i.id from public.interests i where i.slug = any (p_interest_slugs);
  end if;

  perform app.audit('user', 'profile.bootstrap', 'profile', v_uid);
  return v_profile;
end $$;

-- What the client needs to know about age without exposing logic: computed on the server.
create or replace function public.my_account_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', p.id,
    'profile_complete', p.onboarded_at is not null and pp.birth_date is not null,
    'is_minor', case when pp.birth_date is null then null else app.age_years(p.id) < 18 end,
    'is_platform_admin', app.is_platform_admin(),
    'organization_roles', coalesce((
      select jsonb_agg(jsonb_build_object('organization_id', m.organization_id, 'role', m.role))
      from public.organization_members m where m.user_id = p.id), '[]'::jsonb)
  )
  from public.profiles p join public.profile_private pp on pp.user_id = p.id
  where p.id = (select auth.uid());
$$;

revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.is_platform_admin(), app.has_org_role(uuid, public.org_member_role[]),
  app.is_org_member(uuid), app.fail(int, text, text) to authenticated, anon;
revoke execute on function public.complete_profile_bootstrap(text, public.education_stage, date, text[]) from public, anon;
revoke execute on function public.my_account_state() from public, anon;
grant execute on function public.complete_profile_bootstrap(text, public.education_stage, date, text[]) to authenticated;
grant execute on function public.my_account_state() to authenticated;
