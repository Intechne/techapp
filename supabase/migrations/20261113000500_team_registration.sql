-- TechApp · Faz 3a Task 1 (13 Kasım 2026) — team event registration: schema, RLS and counters. No RPCs yet: submitting
-- (submit_team_registration, Task 2), member answers / guardian flow / roster edits / cancel / expiry (Task 3) and the
-- organiser side (Task 4) come in their own migrations. Plan: docs/superpowers/plans/2026-11-12-techapp-v5-faz3a-team-registration.md
-- ("Veri modeli kararları" is the contract; user decisions 13 Nov 2026: seat hold = min(registration_closes_at,
-- submitted_at + 7 days); the submitter is an active captain OR an active mentor of the team).
--
-- Model. The unit of registration is a TEAM row (team_event_registrations) + a roster SNAPSHOT (team_event_registration_members,
-- one row per invited person, versioned by roster_version). When a member accepts, their OWN event_registrations row is created
-- with team_registration_id set, so guardian consent, the participation card, QR and check-in reuse the individual machinery.
--
-- Two independent pools (Review Focus 2):
--   individual  capacity / seats_taken / waitlist_count  ← event_registrations WHERE team_registration_id IS NULL only
--   team        team_capacity / teams_taken / team_waitlist_count ← team_event_registrations (seat-holding: pending_members,
--               pending_review, confirmed; waitlisted → team_waitlist_count)
-- app.recount_event, app.promote_waitlist and register_for_event are narrowed to team_registration_id IS NULL here, so a team
-- member's registration never takes (or frees) an individual seat in a 'both' event. A member registration is never
-- 'waitlisted' (CHECK): the team row holds the seat.
--
-- Privacy (Global Constraints): team members include minors. Rows are readable only by (a) active members of the registered
-- team (the same circle that already sees team_roster), (b) the event organisation's owner|admin|reviewer|checkin_staff,
-- (c) platform admins; plus a person's own roster row. anon has no grant at all. No table here stores a name, e-mail, birth
-- date or guardian detail — only ids and states. Clients have NO insert/update/delete grant on either table.
--
-- Counters are server-owned: app.protect_event_columns now also locks teams_taken / team_waitlist_count (403
-- event_counters_locked) unless app.counter_write is on (set only inside app.recount_event / app.recount_team_event).
-- Critical fields: team_min_size, team_max_size join app.event_critical_fields(); a team_capacity DECREASE (or a limit where
-- there was none) is critical exactly like capacity; more team seats / no limit is logged as an after-approval edit.
--
-- Notifications: no team-registration kinds yet (app.notification_kinds() unchanged) — they come with Task 3's lifecycle. Until
-- then the existing registration triggers would fire for member registrations like for any registration (no RPC creates them yet).
--
-- Deploy order (staging push HELD until after the Cezeri pilot, user approval): after 20261113000400_notifications, in file
-- order. This file grants no column-level SELECT and touches no teams / recruitment_posts grant, so it is independent of
-- 20261112000300's bulk revoke. Remote regression 26–26h must pass after the push.

-- ---------------------------------------------------------------- enums
create type public.team_registration_status as enum
  ('pending_members', 'pending_review', 'confirmed', 'waitlisted', 'cancelled', 'rejected', 'expired');
create type public.team_registration_member_state as enum ('invited', 'accepted', 'declined', 'removed');

-- ---------------------------------------------------------------- events: team pool + team size
alter table public.events
  add column team_capacity int check (team_capacity is null or team_capacity > 0),
  add column teams_taken int not null default 0 check (teams_taken >= 0),
  add column team_waitlist_count int not null default 0 check (team_waitlist_count >= 0),
  add column team_min_size int not null default 1 check (team_min_size between 1 and 100),
  add column team_max_size int check (team_max_size is null or team_max_size between 1 and 100),
  add constraint events_team_size_range check (team_max_size is null or team_min_size <= team_max_size);

-- ---------------------------------------------------------------- team registration (the unit)
create table public.team_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete restrict,
  status public.team_registration_status not null,
  status_reason text check (char_length(status_reason) <= 120),
  -- the captain or mentor who submitted; kept as history (account deletion clears it, the registration stays)
  submitted_by uuid references auth.users (id) on delete set null,
  idempotency_key uuid not null,
  roster_version int not null default 1 check (roster_version >= 1),
  -- min(registration_closes_at, submitted_at + 7 days) — set by the submit / promote RPCs; a seat is never held without one
  hold_expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submitted_by, idempotency_key),
  unique (id, event_id),  -- target of event_registrations' composite FK (a member registration is for the team's event)
  check (status <> 'pending_members' or hold_expires_at is not null)
);
-- One live registration per team per event (waitlisted is live: a team cannot queue twice). History rows stay.
create unique index team_event_registrations_one_live on public.team_event_registrations (event_id, team_id)
  where status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted');
-- recount + waitlist promotion order (created_at, id) + organiser list
create index team_event_registrations_event_idx on public.team_event_registrations (event_id, status, created_at, id);
create index team_event_registrations_team_idx on public.team_event_registrations (team_id, created_at desc);
-- expiry job (Task 3)
create index team_event_registrations_hold_idx on public.team_event_registrations (hold_expires_at)
  where status = 'pending_members';
create trigger team_event_registrations_touch before update on public.team_event_registrations
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------- roster snapshot
create table public.team_event_registration_members (
  id uuid primary key default gen_random_uuid(),
  team_registration_id uuid not null references public.team_event_registrations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_at_submit public.team_role not null,
  roster_version int not null check (roster_version >= 1),
  state public.team_registration_member_state not null default 'invited',
  -- the member's own event_registrations row, created when they accept
  registration_id uuid references public.event_registrations (id) on delete cascade,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (state <> 'accepted' or registration_id is not null)
);
create unique index team_event_registration_members_one_live
  on public.team_event_registration_members (team_registration_id, user_id) where state in ('invited', 'accepted');
create unique index team_event_registration_members_registration_idx
  on public.team_event_registration_members (registration_id) where registration_id is not null;
create index team_event_registration_members_team_reg_idx on public.team_event_registration_members (team_registration_id);
create index team_event_registration_members_user_idx on public.team_event_registration_members (user_id, state);

-- ---------------------------------------------------------------- event_registrations: the member link
alter table public.event_registrations
  add column team_registration_id uuid,
  add constraint event_registrations_team_registration_fk foreign key (team_registration_id, event_id)
    references public.team_event_registrations (id, event_id) on delete restrict,
  add constraint event_registrations_team_member_not_waitlisted
    check (team_registration_id is null or status <> 'waitlisted');
create index event_registrations_team_registration_idx on public.event_registrations (team_registration_id)
  where team_registration_id is not null;

-- ---------------------------------------------------------------- read helpers (RLS)
-- Active member of the registered team (not merely on the roster: someone who left the team stops seeing it).
create or replace function app.is_team_registration_member(p_team_registration_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_event_registrations t
    join public.team_memberships m on m.team_id = t.team_id
    where t.id = p_team_registration_id and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;
-- Staff of the event's organisation who work with registrations (editor excluded: content, not participants).
create or replace function app.is_team_registration_staff(p_team_registration_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_event_registrations t
    join public.events e on e.id = t.event_id
    where t.id = p_team_registration_id
      and app.has_org_role(e.organization_id, array['owner', 'admin', 'reviewer', 'checkin_staff']::public.org_member_role[])
  );
$$;

alter table public.team_event_registrations enable row level security;
alter table public.team_event_registration_members enable row level security;

create policy team_event_registrations_select on public.team_event_registrations for select to authenticated
  using (app.is_team_registration_member(id) or app.is_team_registration_staff(id) or app.is_platform_admin());
create policy team_event_registration_members_select on public.team_event_registration_members for select to authenticated
  using (user_id = (select auth.uid())
         or app.is_team_registration_member(team_registration_id)
         or app.is_team_registration_staff(team_registration_id)
         or app.is_platform_admin());
-- No write policies, and no write grants: every change goes through SECURITY DEFINER RPCs (Tasks 2–4).
revoke all on public.team_event_registrations, public.team_event_registration_members from anon, authenticated;
grant select on public.team_event_registrations, public.team_event_registration_members to authenticated;

-- ---------------------------------------------------------------- counters
create or replace function app.recount_team_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.counter_write', 'on', true);
  update public.events e set
    teams_taken = (select count(*) from public.team_event_registrations t
                   where t.event_id = p_event and t.status in ('pending_members', 'pending_review', 'confirmed')),
    team_waitlist_count = (select count(*) from public.team_event_registrations t
                           where t.event_id = p_event and t.status = 'waitlisted')
  where e.id = p_event;
  perform set_config('app.counter_write', 'off', true);
end $$;

create or replace function app.team_registrations_recount() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.recount_team_event(coalesce(new.event_id, old.event_id));
  return null;
end $$;
create trigger team_event_registrations_recount after insert or update of status or delete
  on public.team_event_registrations for each row execute function app.team_registrations_recount();

-- Individual pool: only registrations that do not belong to a team registration.
create or replace function app.recount_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.counter_write', 'on', true);
  update public.events e set
    seats_taken = (select count(*) from public.event_registrations r
                   where r.event_id = p_event and r.team_registration_id is null
                     and r.status in ('confirmed', 'pending_guardian', 'pending_review')),
    waitlist_count = (select count(*) from public.event_registrations r
                      where r.event_id = p_event and r.team_registration_id is null and r.status = 'waitlisted')
  where e.id = p_event;
  perform set_config('app.counter_write', 'off', true);
end $$;

-- Same as 0002; the free-seat count and the queue are individual-only.
create or replace function app.promote_waitlist(p_event public.events) returns void
language plpgsql security definer set search_path = '' as $$
declare v_free int; r public.event_registrations; v_next public.registration_status;
begin
  if p_event.capacity is null then return; end if;
  loop
    select p_event.capacity - count(*) into v_free from public.event_registrations
      where event_id = p_event.id and team_registration_id is null
        and status in ('confirmed', 'pending_guardian', 'pending_review');
    exit when v_free <= 0;
    select * into r from public.event_registrations
      where event_id = p_event.id and team_registration_id is null and status = 'waitlisted'
      order by created_at, id limit 1 for update;
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

-- Same as 0002; only the capacity count is individual-only.
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

  -- individual pool only: team members' registrations hold no individual seat
  select count(*) into v_taken from public.event_registrations
    where event_id = e.id and team_registration_id is null and status in ('confirmed', 'pending_guardian', 'pending_review');
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

-- Same as 0002 + the two team counters.
create or replace function app.protect_event_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_api_user boolean := (select auth.uid()) is not null;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id then perform app.fail(403, 'event_tenant_locked'); end if;
    if v_api_user and coalesce(current_setting('app.counter_write', true), '') <> 'on'
       and (new.seats_taken <> old.seats_taken or new.waitlist_count <> old.waitlist_count
            or new.teams_taken <> old.teams_taken or new.team_waitlist_count <> old.team_waitlist_count) then
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

-- ---------------------------------------------------------------- critical fields
-- Team size limits decide who may take part → critical. team_capacity follows capacity: fewer (or a new limit) is critical,
-- more or none is a logged edit (content_text_fields).
create or replace function app.event_critical_fields() returns text[] language sql immutable set search_path = '' as $$
  select array['type', 'format', 'city', 'venue', 'online_url', 'starts_at', 'ends_at', 'timezone',
               'registration_opens_at', 'registration_closes_at', 'requires_review', 'registration_mode',
               'min_age', 'max_age', 'guardian_required_under', 'fee_minor_units', 'cancellation_policy',
               'cover_path', 'team_min_size', 'team_max_size'];
$$;
create or replace function app.content_text_fields() returns text[] language sql immutable set search_path = '' as $$
  select array['title', 'poster_line', 'summary', 'description', 'tone', 'topic_interest_id', 'audience_note',
               'support_contact', 'skills', 'waitlist_enabled', 'capacity', 'team_capacity'];
$$;

-- Same as 20261007000100 + the team_capacity rule next to the capacity rule.
create or replace function app.rereview_on_critical_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := to_jsonb(old); v_new jsonb := to_jsonb(new);
  v_entity text := case tg_table_name when 'events' then 'event' else 'opportunity' end;
  v_critical text[]; v_text text[]; v_changed text[]; v_seats text;
begin
  -- Only edits made through the API by organisation staff to live content. Platform approvers are the review.
  if old.status <> 'published' or new.status <> 'published' then return new; end if;
  if (select auth.uid()) is null or app.is_platform_admin() then return new; end if;

  v_critical := case v_entity when 'event' then app.event_critical_fields() else app.opportunity_critical_fields() end;
  select coalesce(array_agg(k order by k), '{}') into v_changed
    from unnest(v_critical) k where (v_new -> k) is distinct from (v_old -> k);
  -- Fewer seats is critical (it can push registered people / teams out); more seats or no limit is not.
  -- (read through jsonb: opportunities have no capacity columns)
  if v_entity = 'event' then
    foreach v_seats in array array['capacity', 'team_capacity'] loop
      if (v_new ->> v_seats) is not null
         and ((v_old ->> v_seats) is null or (v_new ->> v_seats)::int < (v_old ->> v_seats)::int) then
        v_changed := array_append(v_changed, v_seats);
      end if;
    end loop;
  end if;

  if cardinality(v_changed) > 0 then
    insert into public.content_revisions (entity_type, entity_id, organization_id, approved_snapshot, changed_fields, changed_by)
    values (v_entity, old.id, old.organization_id, v_old, v_changed, (select auth.uid()));
    new.status := 'in_review';
    perform app.audit('user', v_entity || '.rereview_required', v_entity, old.id, old.organization_id,
                      jsonb_build_object('changed_fields', v_changed));
  else
    select coalesce(array_agg(k order by k), '{}') into v_text
      from unnest(app.content_text_fields()) k where (v_new ? k) and (v_new -> k) is distinct from (v_old -> k);
    if cardinality(v_text) > 0 then
      perform app.audit('user', v_entity || '.edited_after_approval', v_entity, old.id, old.organization_id,
                        jsonb_build_object('changed_fields', v_text));
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- grants
-- app.* functions get the default PUBLIC execute grant at creation (0001's bulk revoke ran before they existed). The two
-- read helpers are called by the RLS policies as the caller → authenticated only.
revoke execute on function app.is_team_registration_member(uuid), app.is_team_registration_staff(uuid),
  app.recount_team_event(uuid), app.team_registrations_recount()
  from public, anon, authenticated, service_role;
grant execute on function app.is_team_registration_member(uuid), app.is_team_registration_staff(uuid) to authenticated;
