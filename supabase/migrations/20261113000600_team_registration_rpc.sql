-- TechApp · Faz 3a Task 2 (13 Kasım 2026) — submit_team_registration: submission, team capacity and the team waitlist.
-- Plan: docs/superpowers/plans/2026-11-12-techapp-v5-faz3a-team-registration.md ("Veri modeli kararları", Task 2). Builds on
-- 20261113000500_team_registration (tables, RLS, counters). Member answers / guardian flow / roster edits / cancel / expiry come
-- in Task 3's migration, the organiser side in Task 4's.
--
-- Who submits: the team's ACTIVE captain or ACTIVE mentor (user decision 13 Nov 2026) → otherwise 403 not_team_manager. The
-- submitter need not be on the roster. Nobody consents for anyone else: submitting only creates 'invited' roster rows; each
-- member's own event_registrations row (and consent, and guardian request) appears when THEY accept (Task 3).
--
-- Lock order (every team-registration write path must follow it; Task 3/4 included):
--   1. public.events row  FOR UPDATE           — serialises every team status / counter change for the event (race test)
--   2. pg_advisory_xact_lock(hashtextextended(event_id || ':' || user_id, 0)) per roster member, ascending user_id
--                                               — the "same person invited into two live team registrations" guard for
--                                                 paths that add people to a roster (submit now, update_team_roster later)
--   3. team_memberships rows of the roster  FOR SHARE — a member cannot leave between the check and the insert; a concurrent
--                                                 leave waits and its (Task 3) trigger then sees the committed roster row.
--      Task 3 note: a leave/remove path that must also change a team registration should lock the event row (1) BEFORE it
--      updates the membership row, or it can deadlock against a submit (Postgres aborts one side with 40P01).
--
-- Capacity is decided from count(*) of seat-holding rows (pending_members, pending_review, confirmed) under the event lock,
-- never from events.teams_taken (a display counter rebuilt by app.recount_team_event). Full + waitlist_enabled → 'waitlisted'
-- (no hold, no seat; the roster snapshot is kept for promotion); full + no waitlist → 409 team_event_full.
-- Seat hold: hold_expires_at = least(registration_closes_at, submitted_at + 7 days) (user decision 13 Nov 2026) on every
-- seat-holding row; a waitlisted row holds no seat and gets its hold when promoted (app.promote_team_waitlist).
--
-- Privacy: members include minors. Errors are bare machine codes (no detail): never a name, an age, or even which member
-- failed. The audit row carries ids, the status and the roster size only.
--
-- event_eligibility gains ADDITIVE keys only (mobile parses the old shape today): registration_mode, team_seats_left,
-- manageable_teams [{team_id, name, role, active_member_count, registration_id, registration_status}] — the teams the
-- caller can submit for (active captain or mentor of an active team).
--
-- Deploy order (staging push HELD until after the Cezeri pilot, user approval): right after 20261113000500_team_registration.
-- Remote regression 27–27e after the push.

-- ---------------------------------------------------------------- waitlist promotion
-- Give freed team seats to waitlisted teams, oldest first. Caller must hold the event row lock (lock order step 1).
-- After registration has closed nobody is promoted: the hold would already be over (hold ≤ registration_closes_at).
create or replace function app.promote_team_waitlist(p_event public.events) returns void
language plpgsql security definer set search_path = '' as $$
declare v_free int; r public.team_event_registrations;
begin
  if now() >= p_event.registration_closes_at then return; end if;
  loop
    if p_event.team_capacity is not null then
      select p_event.team_capacity - count(*) into v_free from public.team_event_registrations
        where event_id = p_event.id and status in ('pending_members', 'pending_review', 'confirmed');
      exit when v_free <= 0;
    end if;
    select * into r from public.team_event_registrations
      where event_id = p_event.id and status = 'waitlisted' order by created_at, id limit 1 for update;
    exit when not found;
    update public.team_event_registrations
       set status = 'pending_members', status_reason = 'promoted_from_waitlist',
           hold_expires_at = least(p_event.registration_closes_at, now() + interval '7 days')
     where id = r.id;
    perform app.audit('system', 'team_registration.promoted', 'team_event_registration', r.id, p_event.organization_id,
                      jsonb_build_object('event_id', p_event.id, 'team_id', r.team_id, 'status', 'pending_members'));
  end loop;
end $$;

-- ---------------------------------------------------------------- RPC: submit (atomic + idempotent)
create or replace function public.submit_team_registration(
  p_event_id uuid, p_team_id uuid, p_member_ids uuid[], p_idempotency_key uuid
) returns public.team_event_registrations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  e public.events; v_reg public.team_event_registrations;
  v_members uuid[]; v_member uuid; v_size int; v_taken int; v_bad int;
  v_status public.team_registration_status; v_hold timestamptz;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_idempotency_key is null then perform app.fail(422, 'idempotency_key_required'); end if;

  -- Idempotency (fast path, before any lock): the caller's own earlier submission with this key.
  select * into v_reg from public.team_event_registrations where submitted_by = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_reg.event_id <> p_event_id or v_reg.team_id <> p_team_id then perform app.fail(409, 'idempotency_key_reused'); end if;
    return v_reg;
  end if;

  -- Lock order 1: serialises every team registration change for this event — the last seat cannot be sold twice.
  select * into e from public.events where id = p_event_id and status = 'published' for update;
  if not found then perform app.fail(404, 'event_not_found'); end if;

  -- Same key again under the lock (a concurrent double tap waited on the lock above).
  select * into v_reg from public.team_event_registrations where submitted_by = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_reg.event_id <> p_event_id or v_reg.team_id <> p_team_id then perform app.fail(409, 'idempotency_key_reused'); end if;
    return v_reg;
  end if;

  if not exists (select 1 from public.teams t where t.id = p_team_id and t.moderation_status = 'active') then
    perform app.fail(404, 'team_not_found');
  end if;
  if not app.is_team_manager(p_team_id) then perform app.fail(403, 'not_team_manager'); end if;

  -- A live registration of this team for this event (any key, any manager) is THE registration.
  select * into v_reg from public.team_event_registrations
    where event_id = e.id and team_id = p_team_id and status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted');
  if found then return v_reg; end if;

  if e.registration_mode = 'individual' then perform app.fail(409, 'individual_registration_only'); end if;
  if e.registration_opens_at is not null and now() < e.registration_opens_at then
    perform app.fail(409, 'registration_not_open'); end if;
  if now() >= e.registration_closes_at then perform app.fail(409, 'registration_closed'); end if;

  -- Roster: distinct, non-null ids, ascending (the advisory locks below are taken in this order).
  v_members := array(select distinct m from unnest(coalesce(p_member_ids, '{}')) m where m is not null order by m);
  v_size := cardinality(v_members);
  if v_size < e.team_min_size or (e.team_max_size is not null and v_size > e.team_max_size) then
    perform app.fail(422, 'team_size_out_of_range');
  end if;

  -- Lock order 2: one advisory lock per (event, person).
  foreach v_member in array v_members loop
    perform pg_advisory_xact_lock(hashtextextended(e.id::text || ':' || v_member::text, 0));
  end loop;

  -- Lock order 3 + eligibility in one pass: every person is an ACTIVE member of the team (rows held FOR SHARE) …
  with roster as (select unnest(v_members) as user_id),
  active as (
    select m.user_id from public.team_memberships m
    where m.team_id = p_team_id and m.status = 'active' and m.user_id = any (v_members)
    order by m.user_id for share
  )
  select count(*) filter (where a.user_id is null) into v_bad from roster r left join active a on a.user_id = r.user_id;
  if v_bad > 0 then perform app.fail(422, 'member_not_active'); end if;

  -- … within the event's age range (unknown birth date counts as outside a limit) …
  if e.min_age is not null or e.max_age is not null then
    select count(*) into v_bad from unnest(v_members) u(user_id)
      cross join lateral (select app.age_years(u.user_id) as age) a
     where a.age is null or (e.min_age is not null and a.age < e.min_age) or (e.max_age is not null and a.age > e.max_age);
    if v_bad > 0 then perform app.fail(403, 'member_age_not_eligible'); end if;
  end if;

  -- … and not already taking part: no live registration of their own (individual or as a team member), and not on the live
  -- roster of another team's live registration (waitlisted included) for this event.
  if exists (select 1 from public.event_registrations r
             where r.event_id = e.id and r.user_id = any (v_members)
               and r.status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted'))
     or exists (select 1 from public.team_event_registration_members tm
                join public.team_event_registrations t on t.id = tm.team_registration_id
                where t.event_id = e.id and tm.user_id = any (v_members) and tm.state in ('invited', 'accepted')
                  and t.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted')) then
    perform app.fail(409, 'member_already_registered');
  end if;

  -- Team capacity from the rows (never from teams_taken).
  select count(*) into v_taken from public.team_event_registrations
    where event_id = e.id and status in ('pending_members', 'pending_review', 'confirmed');
  if e.team_capacity is not null and v_taken >= e.team_capacity then
    if not e.waitlist_enabled then perform app.fail(409, 'team_event_full'); end if;
    v_status := 'waitlisted';
  else
    v_status := 'pending_members';
    v_hold := least(e.registration_closes_at, now() + interval '7 days');
  end if;

  insert into public.team_event_registrations (event_id, team_id, status, submitted_by, idempotency_key, roster_version, hold_expires_at)
  values (e.id, p_team_id, v_status, v_uid, p_idempotency_key, 1, v_hold)
  returning * into v_reg;

  insert into public.team_event_registration_members (team_registration_id, user_id, role_at_submit, roster_version, state)
  select v_reg.id, m.user_id, m.role, 1, 'invited'
    from public.team_memberships m
   where m.team_id = p_team_id and m.status = 'active' and m.user_id = any (v_members);

  perform app.audit('user', 'team_registration.submitted', 'team_event_registration', v_reg.id, e.organization_id,
                    jsonb_build_object('event_id', e.id, 'team_id', p_team_id, 'status', v_status, 'roster_size', v_size));
  return v_reg;
end $$;

-- ---------------------------------------------------------------- RPC: eligibility (read-only) — additive keys
-- Same as 0002 + registration_mode, team_seats_left (from the rows), manageable_teams.
create or replace function public.event_eligibility(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  e public.events; v_age int; v_reasons text[] := '{}'; v_reg public.event_registrations;
  v_team_taken int; v_teams jsonb := '[]'::jsonb;
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

    -- Teams the caller can submit for: active captain or mentor of an active team. Ids, team name, counts and the team's
    -- own live registration state only — no member names.
    select coalesce(jsonb_agg(jsonb_build_object(
             'team_id', t.id, 'name', t.name, 'role', m.role,
             'active_member_count', (select count(*) from public.team_memberships am where am.team_id = t.id and am.status = 'active'),
             'registration_id', tr.id, 'registration_status', tr.status) order by t.name, t.id), '[]'::jsonb)
      into v_teams
      from public.team_memberships m
      join public.teams t on t.id = m.team_id and t.moderation_status = 'active'
      left join public.team_event_registrations tr on tr.event_id = e.id and tr.team_id = t.id
        and tr.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted')
     where m.user_id = v_uid and m.status = 'active' and m.role in ('captain', 'mentor');
  end if;

  if e.team_capacity is not null then
    select count(*) into v_team_taken from public.team_event_registrations
      where event_id = e.id and status in ('pending_members', 'pending_review', 'confirmed');
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
    'registration_status', v_reg.status,
    'registration_mode', e.registration_mode,
    'team_seats_left', case when e.team_capacity is null then null else greatest(e.team_capacity - v_team_taken, 0) end,
    'manageable_teams', v_teams
  );
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.submit_team_registration(uuid, uuid, uuid[], uuid) from public, anon;
grant execute on function public.submit_team_registration(uuid, uuid, uuid[], uuid) to authenticated;
revoke execute on function app.promote_team_waitlist(public.events) from public, anon, authenticated, service_role;
-- create or replace keeps event_eligibility's existing grants (anon + authenticated).
