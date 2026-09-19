-- TechApp · 0002 events, registrations, guardian consent, participation card, check-in.
-- All state-changing operations go through SECURITY DEFINER RPCs; clients have no
-- INSERT/UPDATE/DELETE on registrations, guardian requests, consents or check-ins.

create type public.event_type as enum
  ('hackathon', 'competition', 'workshop', 'conference', 'meetup', 'social_impact', 'training', 'festival');
create type public.event_format as enum ('in_person', 'online', 'hybrid');
create type public.registration_mode as enum ('individual', 'team', 'both');
create type public.registration_status as enum
  ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted', 'cancelled', 'rejected', 'expired');
create type public.guardian_status as enum ('pending', 'approved', 'denied', 'expired', 'revoked');

-- ---------------------------------------------------------------- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 4 and 120),
  poster_line text check (char_length(poster_line) <= 80),
  summary text not null check (char_length(summary) <= 280),
  description text check (char_length(description) <= 6000),
  type public.event_type not null,
  format public.event_format not null,
  topic_interest_id smallint references public.interests (id),
  tone text not null default 'iris' check (tone in ('iris', 'moss', 'apricot', 'ink')),
  city text,
  venue text,
  online_url text check (online_url ~ '^https://'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/Istanbul',
  registration_opens_at timestamptz,
  registration_closes_at timestamptz not null,
  capacity int check (capacity is null or capacity > 0),
  waitlist_enabled boolean not null default true,
  requires_review boolean not null default false,
  registration_mode public.registration_mode not null default 'individual',
  min_age int check (min_age between 0 and 120),
  max_age int check (max_age between 0 and 120),
  -- Guardian consent is required when the participant is younger than this age. NULL = never.
  guardian_required_under int default 18 check (guardian_required_under between 0 and 21),
  audience_note text check (char_length(audience_note) <= 120),
  fee_minor_units int not null default 0 check (fee_minor_units >= 0),
  cancellation_policy text check (char_length(cancellation_policy) <= 1000),
  support_contact text check (char_length(support_contact) <= 200),
  status public.publish_status not null default 'draft',
  published_at timestamptz,
  approved_by uuid references auth.users (id),
  seats_taken int not null default 0,
  waitlist_count int not null default 0,
  is_demo boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registration_closes_at <= ends_at),
  check (min_age is null or max_age is null or min_age <= max_age)
);
create index events_feed_idx on public.events (status, starts_at, id);
create index events_org_idx on public.events (organization_id);
create index events_topic_idx on public.events (topic_interest_id) where status = 'published';
create trigger events_touch before update on public.events
  for each row execute function app.touch_updated_at();

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_sessions_event_idx on public.event_sessions (event_id, starts_at);
create trigger event_sessions_touch before update on public.event_sessions
  for each row execute function app.touch_updated_at();

alter table public.events enable row level security;
alter table public.event_sessions enable row level security;

create policy events_public_read on public.events for select to anon, authenticated
  using (status = 'published');
create policy events_org_read on public.events for select to authenticated
  using (app.is_org_member(organization_id) or app.is_platform_admin());
create policy events_org_insert on public.events for insert to authenticated
  with check (app.has_org_role(organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])
              and status in ('draft', 'in_review'));
create policy events_org_update on public.events for update to authenticated
  using (app.has_org_role(organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])
         or app.is_platform_admin())
  with check (app.has_org_role(organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])
              or app.is_platform_admin());
create policy events_org_delete on public.events for delete to authenticated
  using (status = 'draft'
         and app.has_org_role(organization_id, array['owner', 'admin']::public.org_member_role[]));

-- Publishing is an Intechne approval. Counters and tenant are server-owned.
create or replace function app.protect_event_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_api_user boolean := (select auth.uid()) is not null;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then perform app.fail(403, 'event_tenant_locked'); end if;
    if v_api_user and coalesce(current_setting('app.counter_write', true), '') <> 'on'
       and (new.seats_taken <> old.seats_taken or new.waitlist_count <> old.waitlist_count) then
      perform app.fail(403, 'event_counters_locked');
    end if;
    if v_api_user and not app.is_platform_admin() then
      if new.status = 'published' and old.status <> 'published' then
        perform app.fail(403, 'publish_requires_platform_approval');
      end if;
      if new.is_demo <> old.is_demo or new.approved_by is distinct from old.approved_by then
        perform app.fail(403, 'event_field_locked');
      end if;
    end if;
    if new.status = 'published' and old.status <> 'published' then
      new.published_at := now();
      new.approved_by := coalesce((select auth.uid()), new.approved_by);
    end if;
  end if;
  return new;
end $$;
create trigger events_protect before update on public.events
  for each row execute function app.protect_event_columns();

create policy event_sessions_read on public.event_sessions for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id
                 and (e.status = 'published' or app.is_org_member(e.organization_id) or app.is_platform_admin())));
create policy event_sessions_manage on public.event_sessions for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id
                 and app.has_org_role(e.organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])))
  with check (exists (select 1 from public.events e where e.id = event_id
                 and app.has_org_role(e.organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])));

-- ---------------------------------------------------------------- registrations
create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  team_id uuid, -- FK added with the teams migration
  status public.registration_status not null,
  status_reason text,
  idempotency_key uuid not null,
  answers jsonb not null default '{}'::jsonb check (pg_column_size(answers) < 8192),
  ticket_version int not null default 1,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
-- One live registration per person per event. Cancelled/rejected/expired rows stay as history.
create unique index event_registrations_one_active
  on public.event_registrations (event_id, user_id)
  where status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted');
create index event_registrations_user_idx on public.event_registrations (user_id, created_at desc);
create index event_registrations_event_idx on public.event_registrations (event_id, status, created_at);
create trigger event_registrations_touch before update on public.event_registrations
  for each row execute function app.touch_updated_at();

create table public.event_check_ins (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations (id) on delete cascade,
  session_id uuid references public.event_sessions (id) on delete cascade,
  checked_in_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create unique index event_check_ins_once
  on public.event_check_ins (registration_id, coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Seat-holding statuses: a pending guardian/review registration keeps its seat until resolved.
create or replace function app.recount_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.counter_write', 'on', true);
  update public.events e set
    seats_taken = (select count(*) from public.event_registrations r
                   where r.event_id = p_event and r.status in ('confirmed', 'pending_guardian', 'pending_review')),
    waitlist_count = (select count(*) from public.event_registrations r
                      where r.event_id = p_event and r.status = 'waitlisted')
  where e.id = p_event;
  perform set_config('app.counter_write', 'off', true);
end $$;

create or replace function app.registrations_recount() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.recount_event(coalesce(new.event_id, old.event_id));
  return null;
end $$;
create trigger event_registrations_recount after insert or update of status or delete
  on public.event_registrations for each row execute function app.registrations_recount();

alter table public.event_registrations enable row level security;
alter table public.event_check_ins enable row level security;

create policy registrations_select_own on public.event_registrations for select to authenticated
  using (user_id = (select auth.uid()));
create policy registrations_select_org on public.event_registrations for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id
                 and app.has_org_role(e.organization_id,
                     array['owner', 'admin', 'editor', 'checkin_staff', 'reviewer']::public.org_member_role[])));
create policy check_ins_select_own on public.event_check_ins for select to authenticated
  using (exists (select 1 from public.event_registrations r
                 where r.id = registration_id and r.user_id = (select auth.uid())));
create policy check_ins_select_org on public.event_check_ins for select to authenticated
  using (exists (select 1 from public.event_registrations r join public.events e on e.id = r.event_id
                 where r.id = registration_id
                 and app.has_org_role(e.organization_id,
                     array['owner', 'admin', 'checkin_staff']::public.org_member_role[])));

-- ---------------------------------------------------------------- guardian requests + consents
create table public.guardian_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_purpose text not null check (consent_purpose in ('event_participation', 'opportunity_application', 'team_membership')),
  subject_type text not null check (subject_type in ('event_registration', 'application', 'team_membership')),
  subject_id uuid not null,
  guardian_name text check (char_length(guardian_name) <= 120),
  guardian_email text not null check (guardian_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  policy_version text not null,
  status public.guardian_status not null default 'pending',
  verification_method text not null default 'email_link' check (verification_method in ('email_link')),
  token_hash bytea,
  revoke_token_hash bytea,
  send_count int not null default 0,
  last_sent_at timestamptz,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  denied_at timestamptz,
  revoked_at timestamptz,
  decided_name text check (char_length(decided_name) <= 120),
  audit_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index guardian_requests_one_pending
  on public.guardian_requests (subject_type, subject_id) where status = 'pending';
create unique index guardian_requests_token_idx on public.guardian_requests (token_hash) where token_hash is not null;
create unique index guardian_requests_revoke_idx on public.guardian_requests (revoke_token_hash) where revoke_token_hash is not null;
create index guardian_requests_user_idx on public.guardian_requests (user_id, created_at desc);
create trigger guardian_requests_touch before update on public.guardian_requests
  for each row execute function app.touch_updated_at();

-- Versioned, purpose-bound, withdrawable consent records (self or guardian).
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null,
  policy_version text not null,
  granted_by text not null check (granted_by in ('self', 'guardian')),
  guardian_request_id uuid references public.guardian_requests (id) on delete set null,
  subject_type text,
  subject_id uuid,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, purpose);
create index consents_subject_idx on public.consents (subject_type, subject_id);
create trigger consents_touch before update on public.consents
  for each row execute function app.touch_updated_at();

alter table public.guardian_requests enable row level security;
alter table public.consents enable row level security;
create policy consents_select_own on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
-- guardian_requests: no direct table access for clients. Token hashes must never leave the
-- database, so the owner reads through the safe view below.
create view public.my_guardian_requests with (security_barrier = true) as
  select g.id, g.consent_purpose, g.subject_type, g.subject_id, g.status, g.policy_version,
         g.requested_at, g.expires_at, g.confirmed_at, g.denied_at, g.revoked_at,
         g.send_count, g.last_sent_at,
         regexp_replace(g.guardian_email, '^(.).*(@.*)$', '\1•••\2') as guardian_email_masked
  from public.guardian_requests g
  where g.user_id = (select auth.uid());
grant select on public.my_guardian_requests to authenticated;

-- ---------------------------------------------------------------- internal helpers
create or replace function app.current_policy_version(p_purpose text) returns text
language sql immutable as $$ select p_purpose || '@2026-09-draft' $$;

create or replace function app.sha256(p_text text) returns bytea
language sql immutable set search_path = '' as $$ select extensions.digest(p_text, 'sha256') $$;

create or replace function app.ticket_token(p_registration public.event_registrations) returns text
language sql stable security definer set search_path = '' as $$
  select 'TA1.' || p_registration.id::text || '.' ||
         substr(encode(extensions.hmac(
           convert_to(p_registration.id::text || ':' || p_registration.ticket_version::text, 'utf8'),
           (select value from app.secrets where name = 'ticket_hmac_v1'), 'sha256'), 'hex'), 1, 32);
$$;

-- Lazily expire guardian requests (and their held seats). Also scheduled via pg_cron in production.
create or replace function app.expire_guardian_requests(p_event uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  for r in
    select g.id, g.subject_id from public.guardian_requests g
    join public.event_registrations er on er.id = g.subject_id and g.subject_type = 'event_registration'
    where g.status = 'pending' and g.expires_at <= now() and (p_event is null or er.event_id = p_event)
    for update of g skip locked
  loop
    update public.guardian_requests set status = 'expired', token_hash = null where id = r.id;
    update public.event_registrations set status = 'expired', status_reason = 'guardian_request_expired'
      where id = r.subject_id and status = 'pending_guardian';
    perform app.audit('system', 'guardian_request.expired', 'guardian_request', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Give freed seats to the waitlist, oldest first. Caller must hold the event row lock.
create or replace function app.promote_waitlist(p_event public.events) returns void
language plpgsql security definer set search_path = '' as $$
declare v_free int; r public.event_registrations; v_next public.registration_status;
begin
  if p_event.capacity is null then return; end if;
  loop
    select p_event.capacity - count(*) into v_free from public.event_registrations
      where event_id = p_event.id and status in ('confirmed', 'pending_guardian', 'pending_review');
    exit when v_free <= 0;
    select * into r from public.event_registrations
      where event_id = p_event.id and status = 'waitlisted' order by created_at, id limit 1 for update;
    exit when not found;
    v_next := app.next_registration_status(p_event, r.user_id, r.id);
    update public.event_registrations
       set status = v_next, confirmed_at = case when v_next = 'confirmed' then now() end,
           status_reason = 'promoted_from_waitlist'
     where id = r.id;
    perform app.audit('system', 'registration.promoted', 'event_registration', r.id, p_event.organization_id,
                      jsonb_build_object('status', v_next));
  end loop;
end $$;

-- Decide the non-capacity status for a participant: guardian → review → confirmed.
create or replace function app.next_registration_status(
  p_event public.events, p_user uuid, p_registration uuid
) returns public.registration_status
language plpgsql stable security definer set search_path = '' as $$
declare v_age int := app.age_years(p_user);
begin
  if p_event.guardian_required_under is not null and v_age < p_event.guardian_required_under then
    if not exists (
      select 1 from public.consents c
      join public.guardian_requests g on g.id = c.guardian_request_id
      where c.user_id = p_user and c.purpose = 'event_participation' and c.granted_by = 'guardian'
        and c.subject_type = 'event_registration' and c.subject_id = p_registration
        and c.withdrawn_at is null and g.status = 'approved'
    ) then
      return 'pending_guardian';
    end if;
  end if;
  if p_event.requires_review then return 'pending_review'; end if;
  return 'confirmed';
end $$;

-- ---------------------------------------------------------------- RPC: eligibility (read-only)
create or replace function public.event_eligibility(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  e public.events; v_age int; v_reasons text[] := '{}'; v_reg public.event_registrations;
begin
  select * into e from public.events where id = p_event_id and status = 'published';
  if not found then perform app.fail(404, 'event_not_found'); end if;

  if e.registration_opens_at is not null and now() < e.registration_opens_at then
    v_reasons := array_append(v_reasons, 'registration_not_open'); end if;
  if now() >= e.registration_closes_at then v_reasons := array_append(v_reasons, 'registration_closed'); end if;
  if e.registration_mode = 'team' then v_reasons := array_append(v_reasons, 'team_registration_only'); end if;

  if v_uid is not null then
    v_age := app.age_years(v_uid);
    if v_age is null then
      v_reasons := array_append(v_reasons, 'profile_incomplete');
    else
      if e.min_age is not null and v_age < e.min_age then v_reasons := array_append(v_reasons, 'below_min_age'); end if;
      if e.max_age is not null and v_age > e.max_age then v_reasons := array_append(v_reasons, 'above_max_age'); end if;
    end if;
    select * into v_reg from public.event_registrations
      where event_id = e.id and user_id = v_uid
        and status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted');
  end if;

  return jsonb_build_object(
    'event_id', e.id,
    'authenticated', v_uid is not null,
    'eligible', coalesce(array_length(v_reasons, 1), 0) = 0,
    'reasons', to_jsonb(v_reasons),
    'guardian_required', v_age is not null and e.guardian_required_under is not null and v_age < e.guardian_required_under,
    'is_full', e.capacity is not null and e.seats_taken >= e.capacity,
    'waitlist_enabled', e.waitlist_enabled,
    'seats_left', case when e.capacity is null then null else greatest(e.capacity - e.seats_taken, 0) end,
    'registration_id', v_reg.id,
    'registration_status', v_reg.status
  );
end $$;

-- ---------------------------------------------------------------- RPC: register (atomic + idempotent)
create or replace function public.register_for_event(
  p_event_id uuid, p_idempotency_key uuid, p_answers jsonb default '{}'::jsonb
) returns public.event_registrations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  e public.events; v_age int; v_reg public.event_registrations;
  v_status public.registration_status; v_taken int; v_id uuid := gen_random_uuid();
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_idempotency_key is null then perform app.fail(422, 'idempotency_key_required'); end if;

  -- Serialises every registration/cancellation for this event: capacity cannot be oversold.
  select * into e from public.events where id = p_event_id and status = 'published' for update;
  if not found then perform app.fail(404, 'event_not_found'); end if;

  -- Idempotency: same key or an existing live registration returns the same row.
  select * into v_reg from public.event_registrations
    where user_id = v_uid and (idempotency_key = p_idempotency_key
      or (event_id = e.id and status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted')))
    order by (event_id = e.id) desc, created_at desc limit 1;
  if found then
    if v_reg.event_id <> e.id then perform app.fail(409, 'idempotency_key_reused'); end if;
    return v_reg;
  end if;

  perform app.expire_guardian_requests(e.id);

  if e.registration_opens_at is not null and now() < e.registration_opens_at then
    perform app.fail(409, 'registration_not_open'); end if;
  if now() >= e.registration_closes_at then perform app.fail(409, 'registration_closed'); end if;
  if e.registration_mode = 'team' then perform app.fail(409, 'team_registration_only'); end if;

  v_age := app.age_years(v_uid);
  if v_age is null then perform app.fail(409, 'profile_incomplete'); end if;
  if e.min_age is not null and v_age < e.min_age then perform app.fail(403, 'below_min_age'); end if;
  if e.max_age is not null and v_age > e.max_age then perform app.fail(403, 'above_max_age'); end if;

  select count(*) into v_taken from public.event_registrations
    where event_id = e.id and status in ('confirmed', 'pending_guardian', 'pending_review');
  if e.capacity is not null and v_taken >= e.capacity then
    if not e.waitlist_enabled then perform app.fail(409, 'event_full'); end if;
    v_status := 'waitlisted';
  else
    v_status := app.next_registration_status(e, v_uid, v_id);
  end if;

  insert into public.event_registrations (id, event_id, user_id, status, idempotency_key, answers, confirmed_at)
  values (v_id, e.id, v_uid, v_status, p_idempotency_key, coalesce(p_answers, '{}'::jsonb),
          case when v_status = 'confirmed' then now() end)
  returning * into v_reg;

  insert into public.consents (user_id, purpose, policy_version, granted_by, subject_type, subject_id)
  values (v_uid, 'event_participation', app.current_policy_version('event_participation'), 'self',
          'event_registration', v_reg.id);

  perform app.audit('user', 'registration.created', 'event_registration', v_reg.id, e.organization_id,
                    jsonb_build_object('status', v_status));
  return v_reg;
end $$;

-- ---------------------------------------------------------------- RPC: cancel
create or replace function public.cancel_event_registration(p_registration_id uuid)
returns public.event_registrations
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_reg public.event_registrations; e public.events;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into v_reg from public.event_registrations where id = p_registration_id and user_id = v_uid;
  if not found then perform app.fail(404, 'registration_not_found'); end if;
  select * into e from public.events where id = v_reg.event_id for update;
  select * into v_reg from public.event_registrations where id = p_registration_id for update;
  if v_reg.status in ('cancelled', 'rejected', 'expired') then return v_reg; end if;
  if now() >= e.starts_at then perform app.fail(409, 'event_already_started'); end if;
  if exists (select 1 from public.event_check_ins c where c.registration_id = v_reg.id) then
    perform app.fail(409, 'already_checked_in'); end if;

  update public.event_registrations
     set status = 'cancelled', status_reason = 'cancelled_by_user', cancelled_at = now(),
         ticket_version = ticket_version + 1
   where id = v_reg.id returning * into v_reg;
  update public.guardian_requests set status = 'revoked', revoked_at = now(), token_hash = null
   where subject_type = 'event_registration' and subject_id = v_reg.id and status = 'pending';
  update public.consents set withdrawn_at = now()
   where subject_type = 'event_registration' and subject_id = v_reg.id and withdrawn_at is null;

  perform app.promote_waitlist(e);
  perform app.audit('user', 'registration.cancelled', 'event_registration', v_reg.id, e.organization_id);
  return v_reg;
end $$;

-- ---------------------------------------------------------------- RPC: participation card
create or replace function public.get_participation_card(p_registration_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_reg public.event_registrations; e public.events;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into v_reg from public.event_registrations where id = p_registration_id and user_id = v_uid;
  if not found then perform app.fail(404, 'registration_not_found'); end if;
  if v_reg.status <> 'confirmed' then perform app.fail(409, 'registration_not_confirmed'); end if;
  select * into e from public.events where id = v_reg.event_id;
  return jsonb_build_object(
    'registration_id', v_reg.id,
    'status', v_reg.status,
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
                                'city', e.city, 'venue', e.venue, 'format', e.format),
    'holder_name', (select display_name from public.profiles where id = v_uid),
    'qr_payload', app.ticket_token(v_reg),                 -- opaque: id + HMAC, no personal data
    'short_code', upper(substr(split_part(app.ticket_token(v_reg), '.', 3), 1, 8)),
    'valid_from', e.starts_at - interval '3 hours',
    'valid_until', e.ends_at,
    'checked_in_at', (select min(c.created_at) from public.event_check_ins c where c.registration_id = v_reg.id)
  );
end $$;

-- ---------------------------------------------------------------- RPC: check-in (organizer staff only)
create or replace function public.check_in_participant(p_token text, p_session_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_parts text[]; v_reg public.event_registrations; e public.events;
  v_existing public.event_check_ins; v_new public.event_check_ins;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  v_parts := string_to_array(coalesce(p_token, ''), '.');
  if array_length(v_parts, 1) <> 3 or v_parts[1] <> 'TA1'
     or v_parts[2] !~ '^[0-9a-f-]{36}$' then perform app.fail(422, 'ticket_malformed'); end if;

  select * into v_reg from public.event_registrations where id = v_parts[2]::uuid for update;
  if not found then perform app.fail(404, 'ticket_unknown'); end if;
  select * into e from public.events where id = v_reg.event_id;

  -- Authorisation first: staff of another organisation learn nothing about this ticket.
  if not app.has_org_role(e.organization_id, array['owner', 'admin', 'checkin_staff']::public.org_member_role[]) then
    perform app.fail(403, 'checkin_forbidden'); end if;
  if app.ticket_token(v_reg) <> p_token then perform app.fail(422, 'ticket_invalid'); end if;
  if v_reg.status <> 'confirmed' then perform app.fail(409, 'registration_not_confirmed'); end if;
  if now() < e.starts_at - interval '3 hours' or now() > e.ends_at then
    perform app.fail(409, 'outside_checkin_window'); end if;
  if p_session_id is not null and not exists
     (select 1 from public.event_sessions s where s.id = p_session_id and s.event_id = e.id) then
    perform app.fail(422, 'session_mismatch'); end if;

  select * into v_existing from public.event_check_ins
   where registration_id = v_reg.id and session_id is not distinct from p_session_id;
  if found then
    return jsonb_build_object('result', 'already_checked_in', 'registration_id', v_reg.id,
                              'checked_in_at', v_existing.created_at,
                              'holder_name', (select display_name from public.profiles where id = v_reg.user_id));
  end if;

  insert into public.event_check_ins (registration_id, session_id, checked_in_by)
  values (v_reg.id, p_session_id, v_uid) returning * into v_new;
  perform app.audit('user', 'registration.checked_in', 'event_registration', v_reg.id, e.organization_id);
  return jsonb_build_object('result', 'checked_in', 'registration_id', v_reg.id,
                            'checked_in_at', v_new.created_at,
                            'holder_name', (select display_name from public.profiles where id = v_reg.user_id));
end $$;

-- ---------------------------------------------------------------- RPC: organizer review decision
create or replace function public.review_event_registration(p_registration_id uuid, p_approve boolean, p_reason text default null)
returns public.event_registrations
language plpgsql security definer set search_path = '' as $$
declare v_reg public.event_registrations; e public.events;
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  select * into v_reg from public.event_registrations where id = p_registration_id;
  if not found then perform app.fail(404, 'registration_not_found'); end if;
  select * into e from public.events where id = v_reg.event_id for update;
  if not app.has_org_role(e.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]) then
    perform app.fail(403, 'review_forbidden'); end if;
  select * into v_reg from public.event_registrations where id = p_registration_id for update;
  if v_reg.status <> 'pending_review' then perform app.fail(409, 'registration_not_pending_review'); end if;

  update public.event_registrations
     set status = case when p_approve then 'confirmed' else 'rejected' end::public.registration_status,
         confirmed_at = case when p_approve then now() end,
         status_reason = left(p_reason, 200)
   where id = v_reg.id returning * into v_reg;
  if not p_approve then perform app.promote_waitlist(e); end if;
  perform app.audit('user', 'registration.reviewed', 'event_registration', v_reg.id, e.organization_id,
                    jsonb_build_object('approved', p_approve));
  return v_reg;
end $$;

-- ---------------------------------------------------------------- RPC: guardian flow
-- 1) The minor asks for consent. No token is created here: the requester must never see it.
create or replace function public.create_guardian_request(
  p_registration_id uuid, p_guardian_email text, p_guardian_name text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_reg public.event_registrations; v_id uuid; v_own_email text;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into v_reg from public.event_registrations where id = p_registration_id and user_id = v_uid for update;
  if not found then perform app.fail(404, 'registration_not_found'); end if;
  if v_reg.status <> 'pending_guardian' then perform app.fail(409, 'guardian_not_required'); end if;
  if p_guardian_email is null or p_guardian_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform app.fail(422, 'guardian_email_invalid'); end if;
  select email into v_own_email from auth.users where id = v_uid;
  if lower(btrim(p_guardian_email)) = lower(coalesce(v_own_email, '')) then
    perform app.fail(422, 'guardian_email_same_as_user'); end if;

  update public.guardian_requests set status = 'revoked', revoked_at = now(), token_hash = null
   where subject_type = 'event_registration' and subject_id = v_reg.id and status = 'pending';

  insert into public.guardian_requests
    (user_id, consent_purpose, subject_type, subject_id, guardian_name, guardian_email, policy_version, expires_at)
  values (v_uid, 'event_participation', 'event_registration', v_reg.id, nullif(btrim(p_guardian_name), ''),
          lower(btrim(p_guardian_email)), app.current_policy_version('guardian_event_participation'),
          now() + interval '72 hours')
  returning id into v_id;
  perform app.audit('user', 'guardian_request.created', 'guardian_request', v_id);
  return v_id;
end $$;

-- 2) Service role only (Edge Function): mint a fresh single-use token and hand it to the mailer.
create or replace function public.issue_guardian_token(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.guardian_requests; v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into g from public.guardian_requests where id = p_request_id for update;
  if not found then perform app.fail(404, 'guardian_request_not_found'); end if;
  if g.status <> 'pending' or g.expires_at <= now() then perform app.fail(409, 'guardian_request_not_pending'); end if;
  if g.send_count >= 5 then perform app.fail(429, 'guardian_send_limit'); end if;
  if g.last_sent_at is not null and g.last_sent_at > now() - interval '60 seconds' then
    perform app.fail(429, 'guardian_send_too_soon'); end if;
  update public.guardian_requests
     set token_hash = app.sha256(v_token), send_count = send_count + 1, last_sent_at = now()
   where id = g.id;
  perform app.audit('service', 'guardian_request.token_issued', 'guardian_request', g.id);
  return jsonb_build_object('token', v_token, 'guardian_email', g.guardian_email,
                            'guardian_name', g.guardian_name, 'expires_at', g.expires_at);
end $$;

-- 3) Guardian opens the link (anon): minimal context, no contact data of the minor.
create or replace function public.guardian_request_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.guardian_requests; e public.events;
begin
  select * into g from public.guardian_requests where token_hash = app.sha256(coalesce(p_token, ''));
  if not found then perform app.fail(404, 'guardian_token_invalid'); end if;
  if g.status <> 'pending' then perform app.fail(409, 'guardian_request_' || g.status::text); end if;
  if g.expires_at <= now() then perform app.fail(409, 'guardian_request_expired'); end if;
  select ev.* into e from public.event_registrations r join public.events ev on ev.id = r.event_id
   where r.id = g.subject_id;
  return jsonb_build_object(
    'purpose', g.consent_purpose, 'policy_version', g.policy_version, 'expires_at', g.expires_at,
    'participant_first_name', split_part((select display_name from public.profiles where id = g.user_id), ' ', 1),
    'event', jsonb_build_object('title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
                                'city', e.city, 'venue', e.venue, 'format', e.format,
                                'organizer', (select name from public.organizations o where o.id = e.organization_id)));
end $$;

-- 4) Guardian decides (anon, single use). On approval a separate revoke token is returned once.
create or replace function public.guardian_decide(
  p_token text, p_approve boolean, p_guardian_full_name text, p_policy_version text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.guardian_requests; v_reg public.event_registrations; e public.events;
  v_next public.registration_status; v_revoke text;
begin
  select * into g from public.guardian_requests where token_hash = app.sha256(coalesce(p_token, '')) for update;
  if not found then perform app.fail(404, 'guardian_token_invalid'); end if;
  if g.status <> 'pending' then perform app.fail(409, 'guardian_request_' || g.status::text); end if;
  if g.expires_at <= now() then perform app.fail(409, 'guardian_request_expired'); end if;
  if p_guardian_full_name is null or char_length(btrim(p_guardian_full_name)) < 5 then
    perform app.fail(422, 'guardian_name_required'); end if;
  if p_policy_version is distinct from g.policy_version then perform app.fail(409, 'policy_version_mismatch'); end if;

  select * into v_reg from public.event_registrations where id = g.subject_id;
  select * into e from public.events where id = v_reg.event_id for update;
  select * into v_reg from public.event_registrations where id = g.subject_id for update;

  if p_approve then
    v_revoke := encode(extensions.gen_random_bytes(32), 'hex');
    update public.guardian_requests
       set status = 'approved', confirmed_at = now(), decided_name = btrim(p_guardian_full_name),
           token_hash = null, revoke_token_hash = app.sha256(v_revoke)
     where id = g.id;
    insert into public.consents (user_id, purpose, policy_version, granted_by, guardian_request_id, subject_type, subject_id)
    values (g.user_id, g.consent_purpose, g.policy_version, 'guardian', g.id, g.subject_type, g.subject_id);
    if v_reg.status = 'pending_guardian' then
      v_next := app.next_registration_status(e, v_reg.user_id, v_reg.id);
      update public.event_registrations
         set status = v_next, confirmed_at = case when v_next = 'confirmed' then now() end,
             status_reason = 'guardian_approved'
       where id = v_reg.id;
    end if;
    perform app.audit('guardian', 'guardian_request.approved', 'guardian_request', g.id, e.organization_id);
    return jsonb_build_object('status', 'approved', 'revoke_token', v_revoke);
  end if;

  update public.guardian_requests
     set status = 'denied', denied_at = now(), decided_name = btrim(p_guardian_full_name), token_hash = null
   where id = g.id;
  if v_reg.status = 'pending_guardian' then
    update public.event_registrations set status = 'cancelled', status_reason = 'guardian_denied', cancelled_at = now()
     where id = v_reg.id;
    perform app.promote_waitlist(e);
  end if;
  perform app.audit('guardian', 'guardian_request.denied', 'guardian_request', g.id, e.organization_id);
  return jsonb_build_object('status', 'denied');
end $$;

-- 5) Guardian withdraws an earlier approval (anon, with the revoke token).
create or replace function public.guardian_revoke(p_revoke_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.guardian_requests; v_reg public.event_registrations; e public.events;
begin
  select * into g from public.guardian_requests
   where revoke_token_hash = app.sha256(coalesce(p_revoke_token, '')) for update;
  if not found then perform app.fail(404, 'guardian_token_invalid'); end if;
  if g.status <> 'approved' then perform app.fail(409, 'guardian_request_' || g.status::text); end if;

  select * into v_reg from public.event_registrations where id = g.subject_id;
  select * into e from public.events where id = v_reg.event_id for update;
  update public.guardian_requests set status = 'revoked', revoked_at = now(), revoke_token_hash = null where id = g.id;
  update public.consents set withdrawn_at = now() where guardian_request_id = g.id and withdrawn_at is null;
  update public.event_registrations
     set status = 'cancelled', status_reason = 'guardian_revoked', cancelled_at = now(),
         ticket_version = ticket_version + 1
   where id = v_reg.id and status in ('pending_review', 'confirmed', 'waitlisted');
  perform app.promote_waitlist(e);
  perform app.audit('guardian', 'guardian_request.revoked', 'guardian_request', g.id, e.organization_id);
  return jsonb_build_object('status', 'revoked');
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.is_platform_admin(), app.has_org_role(uuid, public.org_member_role[]),
  app.is_org_member(uuid), app.fail(int, text, text) to authenticated, anon;

revoke execute on function
  public.register_for_event(uuid, uuid, jsonb), public.cancel_event_registration(uuid),
  public.get_participation_card(uuid), public.check_in_participant(text, uuid),
  public.review_event_registration(uuid, boolean, text),
  public.create_guardian_request(uuid, text, text), public.issue_guardian_token(uuid),
  public.guardian_request_preview(text), public.guardian_decide(text, boolean, text, text),
  public.guardian_revoke(text), public.event_eligibility(uuid)
from public, anon, authenticated;

grant execute on function public.event_eligibility(uuid) to anon, authenticated;
grant execute on function
  public.register_for_event(uuid, uuid, jsonb), public.cancel_event_registration(uuid),
  public.get_participation_card(uuid), public.check_in_participant(text, uuid),
  public.review_event_registration(uuid, boolean, text),
  public.create_guardian_request(uuid, text, text)
to authenticated;
grant execute on function public.issue_guardian_token(uuid) to service_role;
grant execute on function
  public.guardian_request_preview(text), public.guardian_decide(text, boolean, text, text),
  public.guardian_revoke(text)
to anon, authenticated;
