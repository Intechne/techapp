-- TechApp · Faz 3a Task 4 (13 Kasım 2026) — team registration, ORGANISER side: the list and the review decision.
-- Plan: docs/superpowers/plans/2026-11-12-techapp-v5-faz3a-team-registration.md ("Veri modeli kararları", Task 4). Builds on
-- 20261113000500 (tables, RLS, counters), 20261113000600 (submit, promotion) and 20261113000700 (lifecycle, expiry).
--
-- Who: the event organisation's owner | admin | reviewer, and platform admins. checkin_staff, editors, other organisations and
-- everyone else → 403 (list: forbidden; decision: review_forbidden — the same codes as the individual organiser RPCs).
--
-- public.admin_event_team_registrations(p_event_id) returns setof jsonb, one object per team registration of the event (every
-- status, oldest first — the waitlist order):
--   { id, team_id, team_name, status, status_reason, roster_version, roster_size, ready_count, hold_expires_at, confirmed_at,
--     created_at, members: [{ display_name, role_at_submit, state, step }] }
--   roster_size = live rows (invited | accepted) of the CURRENT roster version; ready_count = accepted rows whose own
--   registration is confirmed; members = every row of the current version, holes (declined / removed) included — the same
--   rows the staff RLS on team_event_registration_members already shows. step: invited | guardian | ready | declined (the same
--   mapping as team_registration_detail; 'guardian' only says a guardian's approval is awaited).
--   Privacy (members include minors): display names + states only. No user id, e-mail, birth date, age or guardian detail.
--
-- public.review_team_registration(p_team_registration_id, p_approve) returns public.team_event_registrations:
--   only pending_review → confirmed | rejected; anything else → 409 team_registration_not_pending_review.
--   approve  status_reason 'roster_below_min_after_close' → confirmed, 'approved_below_min_after_close' (user decision A,
--            13 Nov 2026: the organiser accepts the smaller team as it is; app.recompute_team_registration then leaves it
--            alone after close); any other reason (requires_review: 'members_ready') → confirmed, 'approved_by_organizer'.
--            The event must still be published (409 event_not_active). Member registrations are already confirmed; the
--            existing status trigger sends team_registration.confirmed.
--   reject   → rejected, 'rejected_by_organizer'; then every live member registration → rejected ('team_registration_rejected':
--            ticket invalidated, pending guardian request revoked, consents withdrawn by 0009's trigger). The team row is
--            rejected FIRST, so the member trigger sees a dead team and keeps the member rows as history. The seat is freed
--            (recount trigger) and app.promote_team_waitlist runs — it promotes nobody once registration has closed or the
--            event is not published (same rule as every other path). Each member gets the existing registration.rejected
--            notice; managers who are not on the roster get none (open decision, with .cancelled / .removed — see Task 3).
--   Order: 404 unknown id → 403 role check (no lock taken yet) → lock order (same as Task 2/3): events row FOR UPDATE → team
--   row FOR UPDATE → member registrations. The expiry job runs lazily under the event lock first, so a team whose time ran
--   out cannot be decided any more.
--
-- Expiry (ledger CARRY T4): app.expire_team_registrations now closes EVERY pending_review team still undecided at the event's
-- ends_at ('review_not_decided') — the requires_review 'members_ready' case was unbounded in 20261113000700; the after-close
-- 'roster_below_min_after_close' case is unchanged. Otherwise the function is the same as in 20261113000700.
--
-- "Confirmed participants" (ledger CARRY T4): a team member counts only when the TEAM is confirmed — the filter already used by
-- app.queue_event_reminders, volunteer_event_brief, get_participation_card and check_in_participant:
--   public.admin_event_registrations   same signature and columns (pilot privacy test pins them); a member registration of a
--                                      team that is not confirmed is left out (the team list above shows those people with
--                                      their step) — UNLESS that person has already checked in: whoever attended never
--                                      disappears from the organiser's list (e.g. the team drops to pending_review after
--                                      close while members are on site). Individual registrations: unchanged.
--   app.is_confirmed_participant       (participant-only announcements) same filter, same check-in exception. Individual
--                                      registrations: unchanged.
-- No other organiser export / view of participants exists (admin_event_volunteers lists volunteers; the volunteer brief and the
-- reminder job were fixed in 20261113000700).
--
-- Deploy order (staging push HELD until after the Cezeri pilot, user approval): right after 20261113000700. Remote regression
-- 29–29j after the push.

-- ---------------------------------------------------------------- expiry: every undecided review is bounded by ends_at
create or replace function app.expire_team_registrations(p_event uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int := 0; v_event uuid; e public.events; r public.team_event_registrations; v_reg uuid;
begin
  for v_event in
    select distinct t.event_id from public.team_event_registrations t join public.events ev on ev.id = t.event_id
     where (p_event is null or t.event_id = p_event)
       and ((t.status = 'pending_members' and t.hold_expires_at <= now())
            or (t.status = 'waitlisted' and now() >= ev.registration_closes_at)
            or (t.status = 'pending_review' and now() >= ev.ends_at))
     order by 1
  loop
    select * into e from public.events where id = v_event for update;               -- lock order 1
    for r in
      select * from public.team_event_registrations t
       where t.event_id = v_event
         and ((t.status = 'pending_members' and t.hold_expires_at <= now())
              or (t.status = 'waitlisted' and now() >= e.registration_closes_at)
              or (t.status = 'pending_review' and now() >= e.ends_at))
       order by t.created_at, t.id for update
    loop
      -- the team row first: the member trigger then sees a dead team and leaves the member rows as history
      update public.team_event_registrations
         set status = 'expired',
             status_reason = case r.status when 'waitlisted' then 'registration_closed'
                                           when 'pending_review' then 'review_not_decided' else 'hold_expired' end
       where id = r.id;
      for v_reg in select id from public.event_registrations
                    where team_registration_id = r.id and status in ('pending_guardian', 'pending_review', 'confirmed')
      loop
        perform app.end_team_member_registration(v_reg, 'team_registration_expired', 'expired');
      end loop;
      perform app.audit('system', 'team_registration.expired', 'team_event_registration', r.id, e.organization_id,
                        jsonb_build_object('event_id', e.id, 'team_id', r.team_id, 'from', r.status));
      v_n := v_n + 1;
    end loop;
    select * into e from public.events where id = v_event;
    perform app.promote_team_waitlist(e);
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------- RPC: organiser list
create or replace function public.admin_event_team_registrations(p_event_id uuid) returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events;
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  select * into e from public.events where id = p_event_id;
  if not found then perform app.fail(404, 'event_not_found'); end if;
  if not (app.has_org_role(e.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[])
          or app.is_platform_admin()) then
    perform app.fail(403, 'forbidden');
  end if;
  return query
    select jsonb_build_object(
             'id', t.id, 'team_id', t.team_id, 'team_name', tm.name, 'status', t.status, 'status_reason', t.status_reason,
             'roster_version', t.roster_version,
             'roster_size', (select count(*) from public.team_event_registration_members m
                              where m.team_registration_id = t.id and m.roster_version = t.roster_version
                                and m.state in ('invited', 'accepted')),
             'ready_count', (select count(*) from public.team_event_registration_members m
                              join public.event_registrations r on r.id = m.registration_id
                              where m.team_registration_id = t.id and m.roster_version = t.roster_version
                                and m.state = 'accepted' and r.status = 'confirmed'),
             'hold_expires_at', t.hold_expires_at, 'confirmed_at', t.confirmed_at, 'created_at', t.created_at,
             'members', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'display_name', p.display_name, 'role_at_submit', m.role_at_submit, 'state', m.state,
                        'step', case when m.state = 'invited' then 'invited'
                                     when m.state = 'accepted' and r.status = 'confirmed' then 'ready'
                                     when m.state = 'accepted' and r.status = 'pending_guardian' then 'guardian'
                                     else 'declined' end)
                      order by m.role_at_submit, p.display_name, m.id)
                 from public.team_event_registration_members m
                 left join public.profiles p on p.id = m.user_id
                 left join public.event_registrations r on r.id = m.registration_id
                where m.team_registration_id = t.id and m.roster_version = t.roster_version), '[]'::jsonb))
      from public.team_event_registrations t
      join public.teams tm on tm.id = t.team_id
     where t.event_id = e.id
     order by t.created_at, t.id;
end $$;

-- ---------------------------------------------------------------- RPC: organiser decision
create or replace function public.review_team_registration(p_team_registration_id uuid, p_approve boolean)
returns public.team_event_registrations
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.team_event_registrations; e public.events; v_reg uuid; v_from text;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_approve is null then perform app.fail(422, 'contract_mismatch'); end if;
  select * into t from public.team_event_registrations where id = p_team_registration_id;
  if not found then perform app.fail(404, 'team_registration_not_found'); end if;

  -- authorisation before any lock: someone without the role cannot hold (or wait on) the event row
  if not (exists (select 1 from public.events x where x.id = t.event_id
                    and app.has_org_role(x.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]))
          or app.is_platform_admin()) then
    perform app.fail(403, 'review_forbidden');
  end if;
  select * into e from public.events where id = t.event_id for update;               -- lock order 1
  perform app.expire_team_registrations(e.id);                                       -- time ran out → nothing to decide
  select * into t from public.team_event_registrations where id = t.id for update;   -- lock order 2
  if t.status <> 'pending_review' then perform app.fail(409, 'team_registration_not_pending_review'); end if;
  v_from := t.status_reason;

  if p_approve then
    if e.status <> 'published' then perform app.fail(409, 'event_not_active'); end if;
    update public.team_event_registrations
       set status = 'confirmed', confirmed_at = now(),
           status_reason = case when t.status_reason = 'roster_below_min_after_close' then 'approved_below_min_after_close'
                                else 'approved_by_organizer' end
     where id = t.id returning * into t;
  else
    update public.team_event_registrations
       set status = 'rejected', status_reason = 'rejected_by_organizer'
     where id = t.id returning * into t;
    for v_reg in select id from public.event_registrations                           -- lock order 3
                  where team_registration_id = t.id and status in ('pending_guardian', 'pending_review', 'confirmed')
                  order by id
    loop
      perform app.end_team_member_registration(v_reg, 'team_registration_rejected', 'rejected');
    end loop;
    select * into e from public.events where id = e.id;
    perform app.promote_team_waitlist(e);
  end if;

  perform app.audit('user', 'team_registration.reviewed', 'team_event_registration', t.id, e.organization_id,
                    jsonb_build_object('event_id', e.id, 'team_id', t.team_id, 'approved', p_approve, 'from_reason', v_from,
                                       'status', t.status));
  return t;
end $$;

-- ---------------------------------------------------------------- confirmed participants: team members need a confirmed team
-- Same as 20260919000600 (signature, columns, roles), plus: a team member's registration is listed only while the TEAM is
-- confirmed or once the member has checked in. Individual registrations are listed exactly as before.
create or replace function public.admin_event_registrations(p_event_id uuid)
returns table (
  registration_id uuid, display_name text, status public.registration_status, status_reason text,
  created_at timestamptz, confirmed_at timestamptz, checked_in_at timestamptz, guardian_status public.guardian_status
)
language plpgsql stable security definer set search_path = '' as $$
declare e public.events;
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  select * into e from public.events where id = p_event_id;
  if not found then perform app.fail(404, 'event_not_found'); end if;
  if not (app.has_org_role(e.organization_id, array['owner', 'admin', 'editor', 'checkin_staff', 'reviewer']::public.org_member_role[])) then
    perform app.fail(403, 'forbidden'); end if;
  return query
    select r.id, p.display_name, r.status, r.status_reason, r.created_at, r.confirmed_at,
           (select min(c.created_at) from public.event_check_ins c where c.registration_id = r.id),
           (select g.status from public.guardian_requests g
             where g.subject_type = 'event_registration' and g.subject_id = r.id order by g.created_at desc limit 1)
    from public.event_registrations r join public.profiles p on p.id = r.user_id
    where r.event_id = p_event_id
      and (r.team_registration_id is null
           or exists (select 1 from public.team_event_registrations t where t.id = r.team_registration_id and t.status = 'confirmed')
           -- someone who already checked in has attended: never drops off the list when the team later stops being confirmed
           or exists (select 1 from public.event_check_ins c where c.registration_id = r.id))
    order by r.created_at;
end $$;

-- Same as 20260920000100, plus the team filter with the check-in exception (participant-only announcements).
create or replace function app.is_confirmed_participant(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_registrations r
                 where r.event_id = p_event and r.user_id = (select auth.uid()) and r.status = 'confirmed'
                   and (r.team_registration_id is null
                        or exists (select 1 from public.team_event_registrations t
                                    where t.id = r.team_registration_id and t.status = 'confirmed')
                        or exists (select 1 from public.event_check_ins c where c.registration_id = r.id)));
$$;

-- ---------------------------------------------------------------- grants
-- create or replace keeps the grants of the redefined functions (expire: none; admin_event_registrations: authenticated;
-- is_confirmed_participant: authenticated).
revoke execute on function public.admin_event_team_registrations(uuid), public.review_team_registration(uuid, boolean)
  from public, anon;
grant execute on function public.admin_event_team_registrations(uuid), public.review_team_registration(uuid, boolean)
  to authenticated;
