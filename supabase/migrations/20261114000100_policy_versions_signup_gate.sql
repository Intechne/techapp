-- TechApp · Faz 6 Task 1 · legal gate (hukuk kapısı)
-- Until the legal texts (privacy policy, KVKK notice, terms, retention, guardian consent) are approved and published:
--   * nobody outside the allow-list can complete sign-up (complete_profile_bootstrap → 403 signup_closed), and
--   * no consent is recorded against a draft policy text unless the environment explicitly allows drafts
--     (app.current_policy_version → 409 policy_not_published).
-- Both switches live in the DATABASE (app.settings), not in environment variables, and default to FALSE here:
--   local dev  : supabase/seed.sql + supabase/dev/start.mjs turn both on (local only)
--   db tests   : supabase/tests/global-setup.ts turns both on
--   staging    : 🔒 a one-time `update app.settings` in the same user-approved step as this push (docs/RELEASE.md)
--   production : both stay false until the legal texts are published (docs/legal/LEGAL-GATE.md)
-- No legal text lives here: policy_versions only stores version ids and the https URL where the approved text is published.

-- ---------------------------------------------------------------- settings (private schema, no API access)
create table app.settings (
  key text primary key check (key ~ '^[a-z_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint settings_flags_are_boolean
    check (key not in ('signup_open', 'allow_draft_policies') or jsonb_typeof(value) = 'boolean')
);
create trigger settings_touch before update on app.settings
  for each row execute function app.touch_updated_at();
alter table app.settings enable row level security;
-- no policies and no grants: only the owner (migrations, SECURITY DEFINER helpers, the SQL editor) reads or writes it.
revoke all on app.settings from public, anon, authenticated, service_role;
insert into app.settings (key, value) values
  ('signup_open', 'false'::jsonb),
  ('allow_draft_policies', 'false'::jsonb)
on conflict (key) do nothing;

-- A boolean switch. A missing row or a non-true value counts as OFF (fail closed).
create or replace function app.setting_enabled(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value = 'true'::jsonb from app.settings s where s.key = p_key), false);
$$;

-- ---------------------------------------------------------------- versioned policies
-- Every purpose the app records consent for, plus the public documents the web site shows a version for.
create or replace function app.policy_purposes() returns text[]
language sql immutable set search_path = '' as $$
  select array['event_participation', 'guardian_event_participation', 'application_data_sharing',
               'privacy_policy', 'kvkk_notice', 'terms_of_use', 'retention_policy']::text[];
$$;

create table public.policy_versions (
  purpose text not null check (purpose = any (app.policy_purposes())),
  version text not null check (char_length(version) <= 80 and left(version, char_length(purpose) + 1) = purpose || '@'),
  is_draft boolean not null default true,
  published_at timestamptz,
  url text check (url ~ '^https://' and char_length(url) <= 500),
  created_at timestamptz not null default now(),
  primary key (purpose, version),
  -- a draft is never "published"; a published version always says where its approved text lives
  constraint policy_versions_draft_unpublished check (is_draft = (published_at is null)),
  constraint policy_versions_published_has_url check (is_draft or url is not null)
);
create index policy_versions_current_idx on public.policy_versions (purpose, published_at desc) where not is_draft;
alter table public.policy_versions enable row level security;
create policy policy_versions_read on public.policy_versions for select to anon, authenticated using (true);
revoke all on public.policy_versions from public, anon, authenticated;
grant select on public.policy_versions to anon, authenticated;

-- The versions the code has written so far (app.current_policy_version returned a constant) — registered as drafts.
insert into public.policy_versions (purpose, version, is_draft) values
  ('event_participation', 'event_participation@2026-09-draft', true),
  ('guardian_event_participation', 'guardian_event_participation@2026-09-draft', true),
  ('application_data_sharing', 'application_data_sharing@2026-09-draft', true)
on conflict do nothing;

-- The version a NEW consent is recorded against: the latest published non-draft version of the purpose. Without one, the
-- draft only where allow_draft_policies is on; otherwise 409 policy_not_published (never a silent draft version).
-- Existing consents keep the version they were given — publishing never rewrites consents.policy_version.
create or replace function app.current_policy_version(p_purpose text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text;
begin
  select pv.version into v from public.policy_versions pv
   where pv.purpose = p_purpose and not pv.is_draft
   order by pv.published_at desc, pv.version desc limit 1;
  if v is not null then return v; end if;
  if app.setting_enabled('allow_draft_policies') then
    select pv.version into v from public.policy_versions pv
     where pv.purpose = p_purpose and pv.is_draft
     order by pv.created_at desc, pv.version desc limit 1;
    if v is not null then return v; end if;
  end if;
  perform app.fail(409, 'policy_not_published', p_purpose);
  return null;
end $$;

-- Platform admins publish a version once its text is approved and live at p_url. Version id: <purpose>@YYYY-MM-DD[.n].
create or replace function public.publish_policy_version(p_purpose text, p_version text, p_url text)
returns public.policy_versions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.policy_versions;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if not app.is_platform_admin() then perform app.fail(403, 'forbidden'); end if;
  if p_purpose is null or not (p_purpose = any (app.policy_purposes()))
     or p_version is null or p_version !~ ('^' || p_purpose || '@[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]{1,3})?$') then
    perform app.fail(422, 'policy_version_invalid');
  end if;
  if p_url is null or p_url !~ '^https://[^[:space:]]+$' or char_length(p_url) > 500 then
    perform app.fail(422, 'policy_url_invalid');
  end if;
  if exists (select 1 from public.policy_versions pv where pv.purpose = p_purpose and pv.version = p_version) then
    perform app.fail(409, 'policy_version_exists');
  end if;
  insert into public.policy_versions (purpose, version, is_draft, published_at, url)
  values (p_purpose, p_version, false, now(), p_url)
  returning * into v_row;
  perform app.audit('user', 'policy.published', 'policy_version', null, null,
                    jsonb_build_object('purpose', p_purpose, 'version', p_version));
  return v_row;
end $$;

-- ---------------------------------------------------------------- sign-up allow-list
-- Only sha256(lower(trim(email))) is stored. The plaintext address is hashed inside the RPC and never written to a table,
-- the audit log or an error. `note` is a free label for the admin (e.g. "pilot görevlisi") and may not contain an address.
create table public.signup_allowlist (
  email_hash bytea primary key check (length(email_hash) = 32),
  note text check (char_length(note) <= 120 and position('@' in note) = 0),
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);
alter table public.signup_allowlist enable row level security;
-- no policies and no API grants: invisible to anon / authenticated; platform admins work through the RPCs below.
revoke all on public.signup_allowlist from public, anon, authenticated;

create or replace function app.email_hash(p_email text) returns bytea
language sql immutable set search_path = '' as $$ select app.sha256(lower(btrim(p_email))) $$;

-- Shared input check for the two admin RPCs. Returns the normalised address (kept in a local variable only).
create or replace function app.allowlist_email(p_email text) returns text
language plpgsql stable set search_path = '' as $$
declare v text := lower(btrim(coalesce(p_email, '')));
begin
  if v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v) > 254 then
    perform app.fail(422, 'email_invalid');
  end if;
  return v;
end $$;

create or replace function public.add_signup_allowlist(p_email text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_added boolean;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if not app.is_platform_admin() then perform app.fail(403, 'forbidden'); end if;
  if v_note is not null and (char_length(v_note) > 120 or position('@' in v_note) > 0) then
    perform app.fail(422, 'allowlist_note_invalid');
  end if;
  insert into public.signup_allowlist (email_hash, note, added_by)
  values (app.sha256(app.allowlist_email(p_email)), v_note, v_uid)
  on conflict (email_hash) do nothing;
  v_added := found;
  perform app.audit('user', 'signup_allowlist.added', 'signup_allowlist', null, null, jsonb_build_object('added', v_added));
  return jsonb_build_object('added', v_added);
end $$;

create or replace function public.remove_signup_allowlist(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_removed boolean;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if not app.is_platform_admin() then perform app.fail(403, 'forbidden'); end if;
  delete from public.signup_allowlist where email_hash = app.sha256(app.allowlist_email(p_email));
  v_removed := found;
  perform app.audit('user', 'signup_allowlist.removed', 'signup_allowlist', null, null, jsonb_build_object('removed', v_removed));
  return jsonb_build_object('removed', v_removed);
end $$;

-- May this account complete its profile? Gate open, or already onboarded (the gate guards the first completion only),
-- or the sign-in address is on the allow-list.
create or replace function app.signup_allowed(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.setting_enabled('signup_open')
      or exists (select 1 from public.profiles p where p.id = p_uid and p.onboarded_at is not null)
      or exists (select 1 from auth.users u
                   join public.signup_allowlist s on s.email_hash = app.email_hash(u.email)
                  where u.id = p_uid and u.email is not null);
$$;

-- ---------------------------------------------------------------- profile bootstrap: gate first
-- Same body as 20260919000100_foundation, with the sign-up gate before anything is validated or written.
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
  if not app.signup_allowed(v_uid) then perform app.fail(403, 'signup_closed'); end if;
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

-- ---------------------------------------------------------------- grants
revoke execute on function app.setting_enabled(text), app.policy_purposes(), app.current_policy_version(text),
  app.email_hash(text), app.allowlist_email(text), app.signup_allowed(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.publish_policy_version(text, text, text), public.add_signup_allowlist(text, text),
  public.remove_signup_allowlist(text) from public, anon, service_role;
grant execute on function public.publish_policy_version(text, text, text), public.add_signup_allowlist(text, text),
  public.remove_signup_allowlist(text) to authenticated;
revoke execute on function public.complete_profile_bootstrap(text, public.education_stage, date, text[]) from public, anon;
grant execute on function public.complete_profile_bootstrap(text, public.education_stage, date, text[]) to authenticated;
