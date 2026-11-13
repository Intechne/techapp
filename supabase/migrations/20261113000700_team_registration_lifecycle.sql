-- TechApp · Faz 3a Task 3 (13 Kasım 2026) — team registration LIFECYCLE: member answers (own consent, guardian flow), roster
-- edits with a version, cancel, expiry job, card / check-in gating, membership / registration triggers, team notifications.
-- Plan: docs/superpowers/plans/2026-11-12-techapp-v5-faz3a-team-registration.md ("Veri modeli kararları", Task 3). Builds on
-- 20261113000500_team_registration (tables, RLS, counters) and 20261113000600_team_registration_rpc (submit, promotion).
-- User decisions 13 Nov 2026: seat hold = min(registration_closes_at, submitted_at + 7 days); the active captain OR the active
-- mentor manages the registration (submit, roster edit, cancel) → otherwise 403 not_team_manager.
--
-- State machine (team row; seat-holding = pending_members | pending_review | confirmed):
--   submit → pending_members (hold) | waitlisted (no seat)                                     [Task 2]
--   waitlisted → pending_members        app.promote_team_waitlist: a seat frees up, registration still open, event published
--   pending_members ⇄ pending_review | confirmed   app.recompute_team_registration (derived, never set by a client):
--        every row of the CURRENT roster version is 'accepted' with a 'confirmed' own registration and the roster size is within
--        team_min_size..team_max_size → requires_review ? pending_review : confirmed (a confirmed team stays confirmed);
--        anything else → pending_members. Going BACK to pending_members refreshes the hold to
--        greatest(old hold, least(registration_closes_at, now() + 7 days)) — the seat is kept until then, never forever.
--   pending_members (hold passed) → expired        app.expire_team_registrations (cron */10 + lazily in the RPCs)
--   waitlisted (registration closed) → expired     same job (nobody can be promoted after close: M-6)
--   live → cancelled                                cancel_team_registration (manager) | event cancelled (cascade)
--   pending_review → confirmed | rejected           organiser, Task 4
--
-- Roster version: team_event_registrations.roster_version is the version of the CURRENT roster; member rows carry the version
-- they belong to. Every change of the roster composition bumps it (app.bump_team_roster moves every current row, holes
-- included): a decline, a member's own registration ending (user cancel, guardian deny / revoke / expiry), leaving / being
-- removed from the team, account deletion, update_team_roster. Accepting / guardian approval does NOT bump (composition is
-- unchanged). A manager editing an older version gets 409 roster_changed (Review Focus 3: never a silent overwrite).
-- update_team_roster builds version v+1: kept live rows move to v+1, new people get 'invited' rows at v+1, dropped live rows
-- become 'removed' (their registration is cancelled), holes (declined / removed) stay at v — the edit is what clears them.
--
-- Member state: invited → accepted (own event_registrations row: team_registration_id + team_id set, status from
-- app.next_member_status = pending_guardian | confirmed — review is team-level, a member row is never waitlisted, and a
-- 'self' event_participation consent row exactly like register_for_event) | declined. accepted → declined when the member's own
-- registration ends while the team is live; invited/accepted → removed when they leave / are removed from the team or are
-- dropped by a roster edit. A team that is cancelled / expired / rejected keeps its member rows as they were (history).
--
-- Lock order (same as Task 2; every path here):
--   1. public.events row FOR UPDATE   2. pg_advisory_xact_lock(event:user) per person added (ascending)
--   3. team_memberships rows FOR SHARE   — then the team row / member rows / registrations.
--   respond          event → advisory(me) → team row → member row → membership FOR SHARE
--   update_roster    event → team row → advisory(new roster, asc) → memberships FOR SHARE
--   cancel           event → team row → member registrations
--   expire job       event (one at a time, ascending id) → team rows → member registrations
--   leave / remove   events of the team's live registrations (ascending id; app.lock_team_registration_events) → teams row
--                    (leave) → membership → [trigger] team row → member row → registration
--   guardian decide / revoke, cancel_event_registration: event → registration → [trigger] member row → team row (unchanged)
--   guardian expiry (cron): guardian request → event (NEW: locked for team-member registrations) → registration → [trigger]
--   account deletion: auth.users cascade → [trigger] event → team row (the cascade holds no event lock; nothing else to order)
--
-- Pilot-used functions changed here (create or replace; same signatures, grants kept). Individual registrations behave
-- exactly as before — every new branch is guarded by team_registration_id IS NOT NULL / team rows:
--   app.next_registration_status   review is skipped only for a registration that belongs to a team registration
--   app.expire_guardian_requests   also locks the event row first when the registration is a team member's
--   app.notify_registration_status registration.confirmed / registration.expired are not sent for team-member registrations
--                                  (team_registration.confirmed / .expired replace them; the card needs the TEAM confirmed)
--   public.get_participation_card, public.check_in_participant   + 409 team_registration_not_confirmed for team members
--   app.event_cancel_cascade       also cancels the event's team rows (first, so the member trigger sees a dead team)
--   public.leave_team, public.remove_team_member   lock the team's live-registration events before the membership row
--   public.volunteer_event_brief   stats.confirmed = people who can actually check in (individual + members of CONFIRMED
--                                  teams) + additive keys; teams from confirmed team registrations too
--   app.promote_team_waitlist (Task 2) also returns at once for an event that is not published
-- guardian_decide / guardian_revoke / create_guardian_request / cancel_event_registration are NOT changed: their status
-- changes reach the team through the event_registrations trigger.
--
-- Notifications (plan: Faz 3b Task 9 merged first → the team kinds live here). Text = fixed phrase + EVENT title only;
-- target ('team_event_registration', team registration id). No name, e-mail or age.
--   team_registration.invited          member row INSERT 'invited' while the team holds a seat; waitlisted → pending_members
--                                      (invited rows). Not to the actor (the manager adding themselves).
--   team_registration.confirmed        team → confirmed: accepted members of the current roster + active captains/mentors
--   team_registration.member_declined  member row invited|accepted → declined (live team): active captains/mentors, not the
--                                      decliner (leave / remove / roster drop stay silent, like active → left in 3b)
--   team_registration.expired          team → expired: live roster members + active captains/mentors
-- Known gap (recorded): a cancel by the manager or a roster drop does not notify members (no kind in the plan).
--
-- Privacy: errors carry codes only; per-member failures of update_team_roster carry the offending member ids (JSON uuid
-- array) like submit. team_registration_detail goes to the registered team's ACTIVE members only (display names, role, state,
-- step); organisation staff use Task 4's list. No payload has an e-mail, a birth date or a guardian detail; 'step = guardian'
-- only says that a guardian's approval is awaited.
--
-- Deploy order (staging push HELD until after the Cezeri pilot, user approval): right after 20261113000600. Remote regression
-- 28–28e after the push.

-- ---------------------------------------------------------------- status of a member's own registration
-- Guardian first (same rule as next_registration_status); no review: review is applied to the team.
create or replace function app.next_member_status(
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
  return 'confirmed';
end $$;

-- Same as 0002 for individual registrations. A team member's registration (guardian_decide calls this on approval) is never
-- sent to individual review: the team row goes to pending_review instead.
create or replace function app.next_registration_status(
  p_event public.events, p_user uuid, p_registration uuid
) returns public.registration_status
language plpgsql stable security definer set search_path = '' as $$
declare v_status public.registration_status := app.next_member_status(p_event, p_user, p_registration);
begin
  if v_status = 'pending_guardian' then return v_status; end if;
  if p_event.requires_review and not exists (
       select 1 from public.event_registrations r where r.id = p_registration and r.team_registration_id is not null) then
    return 'pending_review';
  end if;
  return 'confirmed';
end $$;

-- ---------------------------------------------------------------- internal helpers
-- Lock order step 1 for paths that start from a team (leave / remove): every event with a live registration of the team.
create or replace function app.lock_team_registration_events(p_team uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.events e
   where e.id in (select t.event_id from public.team_event_registrations t
                   where t.team_id = p_team and t.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted'))
   order by e.id for update;
end $$;

-- A new roster version: the team row and every row of the current version (holes included) move to v+1.
create or replace function app.bump_team_roster(p_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v_new int;
begin
  update public.team_event_registrations set roster_version = roster_version + 1 where id = p_id returning roster_version into v_new;
  if v_new is null then return null; end if;
  update public.team_event_registration_members set roster_version = v_new
   where team_registration_id = p_id and roster_version = v_new - 1;
  return v_new;
end $$;

-- End a team member's own registration (not by their own choice): ticket invalidated, a pending guardian request revoked.
-- Consents are withdrawn by event_registrations_consents (0009).
create or replace function app.end_team_member_registration(p_registration uuid, p_reason text, p_status public.registration_status default 'cancelled')
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.event_registrations
     set status = p_status, status_reason = p_reason, ticket_version = ticket_version + 1,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
   where id = p_registration and status in ('pending_guardian', 'pending_review', 'confirmed');
  update public.guardian_requests set status = 'revoked', revoked_at = now(), token_hash = null
   where subject_type = 'event_registration' and subject_id = p_registration and status = 'pending';
end $$;

-- ---------------------------------------------------------------- derived team status
create or replace function app.recompute_team_registration(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.team_event_registrations; e public.events; v_total int; v_ready int; v_next public.team_registration_status;
begin
  select * into t from public.team_event_registrations where id = p_id;
  if not found then return; end if;
  select * into e from public.events where id = t.event_id for update;              -- lock order 1 (no-op when held)
  select * into t from public.team_event_registrations where id = p_id for update;
  if t.status not in ('pending_members', 'pending_review', 'confirmed') then return; end if;

  select count(*), count(*) filter (where m.state = 'accepted' and r.status = 'confirmed')
    into v_total, v_ready
    from public.team_event_registration_members m
    left join public.event_registrations r on r.id = m.registration_id
   where m.team_registration_id = t.id and m.roster_version = t.roster_version;

  if v_total = v_ready and v_total >= e.team_min_size and (e.team_max_size is null or v_total <= e.team_max_size) then
    v_next := case when t.status = 'confirmed' then 'confirmed'
                   when e.requires_review then 'pending_review' else 'confirmed' end;
  else
    v_next := 'pending_members';
  end if;
  if v_next = t.status then return; end if;

  update public.team_event_registrations set
    status = v_next,
    status_reason = case when v_next = 'pending_members' then 'roster_incomplete' else 'members_ready' end,
    confirmed_at = case when v_next = 'confirmed' then now() end,
    hold_expires_at = case when v_next = 'pending_members'
                           then greatest(coalesce(t.hold_expires_at, now()), least(e.registration_closes_at, now() + interval '7 days'))
                           else t.hold_expires_at end
   where id = t.id;
  perform app.audit('system', 'team_registration.status_changed', 'team_event_registration', t.id, e.organization_id,
                    jsonb_build_object('event_id', e.id, 'team_id', t.team_id, 'from', t.status, 'to', v_next));
end $$;

-- ---------------------------------------------------------------- waitlist promotion (Task 2 + published guard)
create or replace function app.promote_team_waitlist(p_event public.events) returns void
language plpgsql security definer set search_path = '' as $$
declare v_free int; r public.team_event_registrations;
begin
  if p_event.status <> 'published' or now() >= p_event.registration_closes_at then return; end if;
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
    -- a promoted roster may already be complete (members answer only once the team holds a seat, so normally it is not)
    perform app.recompute_team_registration(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------- expiry job
-- pending_members whose hold has passed, and waitlisted rows once registration has closed → expired; member registrations
-- expired, pending guardian requests revoked, freed seats promoted. p_event narrows it to one event (the RPCs call it lazily
-- under their own event lock). Returns the number of team rows expired.
create or replace function app.expire_team_registrations(p_event uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int := 0; v_event uuid; e public.events; r public.team_event_registrations; v_reg uuid;
begin
  for v_event in
    select distinct t.event_id from public.team_event_registrations t join public.events ev on ev.id = t.event_id
     where (p_event is null or t.event_id = p_event)
       and ((t.status = 'pending_members' and t.hold_expires_at <= now())
            or (t.status = 'waitlisted' and now() >= ev.registration_closes_at))
     order by 1
  loop
    select * into e from public.events where id = v_event for update;               -- lock order 1
    for r in
      select * from public.team_event_registrations t
       where t.event_id = v_event
         and ((t.status = 'pending_members' and t.hold_expires_at <= now())
              or (t.status = 'waitlisted' and now() >= e.registration_closes_at))
       order by t.created_at, t.id for update
    loop
      -- the team row first: the member trigger then sees a dead team and leaves the member rows as history
      update public.team_event_registrations
         set status = 'expired', status_reason = case when r.status = 'waitlisted' then 'registration_closed' else 'hold_expired' end
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

-- Same as 0002, plus: a team member's registration locks its event row before it changes (the team trigger needs the event
-- lock first; the cron path holds none). Individual registrations are handled exactly as before.
create or replace function app.expire_guardian_requests(p_event uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  for r in
    select g.id, g.subject_id, er.event_id, er.team_registration_id from public.guardian_requests g
    join public.event_registrations er on er.id = g.subject_id and g.subject_type = 'event_registration'
    where g.status = 'pending' and g.expires_at <= now() and (p_event is null or er.event_id = p_event)
    for update of g skip locked
  loop
    if r.team_registration_id is not null then
      perform 1 from public.events where id = r.event_id for update;
    end if;
    update public.guardian_requests set status = 'expired', token_hash = null where id = r.id;
    update public.event_registrations set status = 'expired', status_reason = 'guardian_request_expired'
      where id = r.subject_id and status = 'pending_guardian';
    perform app.audit('system', 'guardian_request.expired', 'guardian_request', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------- triggers
-- A team member's own registration changed status (accept → guardian approval, user cancel, guardian deny / revoke / expiry,
-- organiser reject …): an end while the team is live turns the member into 'declined' (new roster version); then recompute.
create or replace function app.team_member_registration_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.events where id = new.event_id for update;                -- lock order 1 (no-op when held)
  if new.status in ('cancelled', 'rejected', 'expired') then
    update public.team_event_registration_members m set state = 'declined', responded_at = now()
     where m.registration_id = new.id and m.state = 'accepted'
       and exists (select 1 from public.team_event_registrations t where t.id = m.team_registration_id
                     and t.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted'));
    if found then perform app.bump_team_roster(new.team_registration_id); end if;
  end if;
  perform app.recompute_team_registration(new.team_registration_id);
  return null;
end $$;
create trigger event_registrations_team_member after update of status on public.event_registrations
  for each row when (new.team_registration_id is not null and old.status is distinct from new.status)
  execute function app.team_member_registration_changed();

-- Someone stops being an ACTIVE member of the team (leave_team, remove_team_member, any other path): on every live registration
-- of that team they are 'removed', their own registration is cancelled, the roster version moves on, the team is recomputed.
create or replace function app.team_membership_ended() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; v_reason text := case when new.status = 'removed' then 'team_member_removed' else 'team_member_left' end;
begin
  for r in
    select tm.id, tm.team_registration_id, tm.registration_id, t.event_id, e.organization_id
      from public.team_event_registration_members tm
      join public.team_event_registrations t on t.id = tm.team_registration_id
      join public.events e on e.id = t.event_id
     where t.team_id = new.team_id and tm.user_id = new.user_id and tm.state in ('invited', 'accepted')
       and t.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted')
     order by t.event_id, t.id
  loop
    perform 1 from public.events where id = r.event_id for update;
    perform 1 from public.team_event_registrations where id = r.team_registration_id for update;
    update public.team_event_registration_members set state = 'removed' where id = r.id;
    if r.registration_id is not null then perform app.end_team_member_registration(r.registration_id, v_reason); end if;
    perform app.bump_team_roster(r.team_registration_id);
    perform app.recompute_team_registration(r.team_registration_id);
    perform app.audit('system', 'team_registration.member_removed', 'team_event_registration', r.team_registration_id,
                      r.organization_id, jsonb_build_object('event_id', r.event_id, 'reason', v_reason));
  end loop;
  return null;
end $$;
create trigger team_memberships_team_registration after update of status on public.team_memberships
  for each row when (old.status = 'active' and new.status in ('left', 'removed'))
  execute function app.team_membership_ended();

-- A roster row disappears only through a cascade (account deletion: auth.users → roster row / own registration). The team must
-- not keep a status derived from a row that no longer exists: new roster version + recompute.
create or replace function app.team_member_row_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.team_event_registrations;
begin
  select * into t from public.team_event_registrations where id = old.team_registration_id;
  if not found or t.status not in ('pending_members', 'pending_review', 'confirmed', 'waitlisted') then return null; end if;
  perform 1 from public.events where id = t.event_id for update;
  if old.roster_version = t.roster_version then perform app.bump_team_roster(t.id); end if;
  perform app.recompute_team_registration(t.id);
  return null;
end $$;
create trigger team_event_registration_members_deleted after delete on public.team_event_registration_members
  for each row execute function app.team_member_row_deleted();

-- Cancelling an event: same as 0006, plus its team rows (first, so member registrations are cancelled under a dead team and
-- the member rows stay as history). Counters follow through the recount triggers; nothing is promoted (the event is cancelled).
create or replace function app.event_cancel_cascade() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.team_event_registrations
       set status = 'cancelled', status_reason = 'event_cancelled', cancelled_at = now()
     where event_id = new.id and status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted');
    update public.event_registrations
       set status = 'cancelled', status_reason = 'event_cancelled', cancelled_at = now(), ticket_version = ticket_version + 1
     where event_id = new.id and status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted');
    update public.guardian_requests g set status = 'revoked', revoked_at = now(), token_hash = null
     where g.status = 'pending' and g.subject_type = 'event_registration'
       and g.subject_id in (select id from public.event_registrations where event_id = new.id);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------- notifications
-- '^[a-z0-9_.]{3,60}$' already allows the new kinds; the target type gains 'team_event_registration'.
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type is null or target_type in ('event', 'event_registration', 'application', 'team', 'team_event_registration'));

create or replace function app.notification_kinds() returns text[]
language sql immutable set search_path = '' as $$
  select array['registration.confirmed', 'registration.promoted', 'registration.promoted_pending', 'registration.rejected',
               'registration.expired', 'guardian.denied', 'guardian.revoked', 'application.status_changed', 'team_join.accepted', 'team_join.rejected',
               'team_join.requested', 'event.reminder_24h', 'event.cancelled',
               'team_registration.invited', 'team_registration.confirmed', 'team_registration.member_declined',
               'team_registration.expired']::text[];
$$;

-- Same as 20261113000400 + the four team-registration kinds (content title = the EVENT title).
create or replace function app.notification_copy(p_kind text, p_content_title text)
returns table (title text, body text)
language plpgsql immutable set search_path = '' as $$
declare t text := coalesce(nullif(btrim(regexp_replace(left(coalesce(p_content_title, ''), 120), '\s+', ' ', 'g')), ''), 'Bu içerik');
begin
  case p_kind
    when 'registration.confirmed' then title := 'Kaydın onaylandı.';               body := t || ' için yerin hazır.';
    when 'registration.promoted' then title := 'Bekleme listesinden yer açıldı.';  body := t || ' için kaydın onaylandı.';
    when 'registration.rejected' then title := 'Kaydın onaylanmadı.';              body := t || ' için kaydın bu kez onaylanmadı.';
    when 'registration.expired' then title := 'Veli onayı zamanında gelmedi.';
                                     body := t || ' için kaydın kapandı. Yer varsa yeniden kaydolabilirsin.';
    when 'registration.promoted_pending' then title := 'Bekleme listesinden yer açıldı.';
                                              body := t || ' için yerin ayrıldı. Kaydını tamamlamak için bir adım kaldı.';
    when 'guardian.denied' then title := 'Velin kaydı onaylamadı.';                body := t || ' için kaydın iptal edildi.';
    when 'guardian.revoked' then title := 'Velin onayını geri çekti.';             body := t || ' için kaydın iptal edildi.';
    when 'application.status_changed' then title := 'Başvurunda yeni bir durum var.';
                                           body := t || ' için başvurunun durumu güncellendi.';
    when 'team_join.accepted' then title := 'Takıma katıldın.';                    body := t || ' katılma isteğini kabul etti.';
    when 'team_join.rejected' then title := 'Katılma isteğin kabul edilmedi.';    body := t || ' bu kez isteğini kabul etmedi.';
    when 'team_join.requested' then title := 'Takımına katılmak isteyen var.';
                                    body := t || ' için yeni bir katılma isteği bekliyor.';
    when 'event.reminder_24h' then title := 'Etkinliğine bir gün kaldı.';         body := t || ' yaklaşık 24 saat sonra başlıyor.';
    when 'event.cancelled' then title := 'Etkinlik iptal edildi.';                 body := t || ' iptal edildi. Kaydın da kapandı.';
    when 'team_registration.invited' then title := 'Takımın seni bir etkinliğe kaydetti.';
                                          body := t || ' için katılıp katılmayacağını söylemen bekleniyor.';
    when 'team_registration.confirmed' then title := 'Takımın hazır.';             body := t || ' için takım kaydı onaylandı.';
    when 'team_registration.member_declined' then title := 'Kadroda bir eksik var.';
                                                  body := t || ' için bir üye katılamayacak. Kadroyu güncelleyebilirsin.';
    when 'team_registration.expired' then title := 'Takım kaydı tamamlanmadı.';
                                          body := t || ' için takım kaydının süresi doldu.';
    else raise exception using errcode = 'P0001', message = 'notification_kind_unknown', detail = coalesce(p_kind, '');
  end case;
  return next;
end $$;

-- Same as 20261113000400, plus: a team member's own registration does not announce 'confirmed' (the card needs the TEAM
-- confirmed → team_registration.confirmed) nor 'expired' (team expiry → team_registration.expired; a lapsed guardian
-- request → the managers get team_registration.member_declined). Individual registrations: unchanged.
create or replace function app.notify_registration_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text; v_type text := 'event_registration'; v_target uuid := new.id; v_title text;
begin
  if new.team_registration_id is not null and new.status in ('confirmed', 'expired') then return null; end if;
  if new.status = 'confirmed' then
    v_kind := case when old.status = 'waitlisted' then 'registration.promoted' else 'registration.confirmed' end;
  elsif old.status = 'waitlisted' and new.status in ('pending_guardian', 'pending_review') then
    v_kind := 'registration.promoted_pending';
  elsif new.status = 'rejected' then v_kind := 'registration.rejected';
  elsif new.status = 'expired' then v_kind := 'registration.expired';
  elsif new.status = 'cancelled' and new.status_reason = 'guardian_denied' then v_kind := 'guardian.denied';
  elsif new.status = 'cancelled' and new.status_reason = 'guardian_revoked' then v_kind := 'guardian.revoked';
  elsif new.status = 'cancelled' and new.status_reason = 'event_cancelled' then
    v_kind := 'event.cancelled'; v_type := 'event'; v_target := new.event_id;
  else
    return null; -- cancelled by the user / by the team / roster change, pending_guardian → pending_review: no notification
  end if;
  select e.title into v_title from public.events e where e.id = new.event_id;
  perform app.notify(new.user_id, v_kind, v_type, v_target, v_title);
  return null;
end $$;

create or replace function app.notify_team_registration_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.team_event_registrations; v_title text; r record; v_actor uuid := (select auth.uid());
begin
  select * into t from public.team_event_registrations where id = new.team_registration_id;
  select e.title into v_title from public.events e where e.id = t.event_id;
  if tg_op = 'INSERT' then
    if new.state = 'invited' and t.status in ('pending_members', 'pending_review', 'confirmed')
       and new.user_id is distinct from v_actor then
      perform app.notify(new.user_id, 'team_registration.invited', 'team_event_registration', t.id, v_title);
    end if;
  elsif new.state = 'declined' and old.state in ('invited', 'accepted')
        and t.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted') then
    for r in
      select m.user_id from public.team_memberships m
       where m.team_id = t.team_id and m.status = 'active' and m.role in ('captain', 'mentor')
         and m.user_id <> new.user_id and m.user_id is distinct from v_actor
    loop
      perform app.notify(r.user_id, 'team_registration.member_declined', 'team_event_registration', t.id, v_title);
    end loop;
  end if;
  return null;
end $$;
create trigger team_event_registration_members_notify_insert after insert on public.team_event_registration_members
  for each row execute function app.notify_team_registration_member();
create trigger team_event_registration_members_notify_state after update of state on public.team_event_registration_members
  for each row when (old.state is distinct from new.state) execute function app.notify_team_registration_member();

create or replace function app.notify_team_registration_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text; v_title text; r record; v_actor uuid := (select auth.uid());
begin
  if new.status = 'confirmed' then v_kind := 'team_registration.confirmed';
  elsif new.status = 'expired' then v_kind := 'team_registration.expired';
  elsif old.status = 'waitlisted' and new.status = 'pending_members' then v_kind := 'team_registration.invited';
  else return null;
  end if;
  select e.title into v_title from public.events e where e.id = new.event_id;
  for r in
    select distinct x.user_id from (
      select m.user_id from public.team_event_registration_members m
       where m.team_registration_id = new.id and m.roster_version = new.roster_version
         and case v_kind when 'team_registration.invited' then m.state = 'invited'
                         when 'team_registration.confirmed' then m.state = 'accepted'
                         else m.state in ('invited', 'accepted') end
      union
      select tm.user_id from public.team_memberships tm
       where v_kind <> 'team_registration.invited' and tm.team_id = new.team_id and tm.status = 'active'
         and tm.role in ('captain', 'mentor')
    ) x
    where v_kind <> 'team_registration.invited' or x.user_id is distinct from v_actor
  loop
    perform app.notify(r.user_id, v_kind, 'team_event_registration', new.id, v_title);
  end loop;
  return null;
end $$;
create trigger team_event_registrations_notify after update of status on public.team_event_registrations
  for each row when (old.status is distinct from new.status) execute function app.notify_team_registration_status();

-- ---------------------------------------------------------------- RPC: member answers their own invite
create or replace function public.respond_team_registration(p_member_id uuid, p_accept boolean, p_idempotency_key uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  m public.team_event_registration_members; t public.team_event_registrations; e public.events;
  v_reg public.event_registrations; v_age int; v_status public.registration_status; v_id uuid := gen_random_uuid();
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_idempotency_key is null then perform app.fail(422, 'idempotency_key_required'); end if;
  if p_accept is null then perform app.fail(422, 'contract_mismatch'); end if;

  select * into m from public.team_event_registration_members where id = p_member_id;
  if not found then perform app.fail(404, 'team_registration_not_found'); end if;
  if m.user_id <> v_uid then perform app.fail(403, 'not_invite_owner'); end if;   -- nobody answers for someone else
  select * into t from public.team_event_registrations where id = m.team_registration_id;

  select * into e from public.events where id = t.event_id for update;               -- lock order 1
  perform app.expire_team_registrations(e.id);                                       -- a lapsed hold is closed first
  perform pg_advisory_xact_lock(hashtextextended(e.id::text || ':' || v_uid::text, 0));  -- lock order 2
  select * into t from public.team_event_registrations where id = t.id for update;
  select * into m from public.team_event_registration_members where id = p_member_id for update;

  -- Idempotency: this key already created my registration for this team registration.
  select * into v_reg from public.event_registrations where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_reg.team_registration_id is distinct from t.id then perform app.fail(409, 'idempotency_key_reused'); end if;
    return jsonb_build_object('member_state', m.state, 'registration_id', v_reg.id, 'registration_status', v_reg.status,
                              'team_status', t.status);
  end if;
  -- the same answer again (another key) returns the current state
  if m.state = 'accepted' and p_accept then
    select * into v_reg from public.event_registrations where id = m.registration_id;
    return jsonb_build_object('member_state', m.state, 'registration_id', v_reg.id, 'registration_status', v_reg.status,
                              'team_status', t.status);
  end if;
  if m.state = 'declined' and not p_accept then
    return jsonb_build_object('member_state', m.state, 'registration_id', null, 'registration_status', null, 'team_status', t.status);
  end if;
  if m.state <> 'invited' or t.status not in ('pending_members', 'pending_review', 'confirmed', 'waitlisted') then
    perform app.fail(409, 'invite_not_pending');
  end if;

  if not p_accept then
    update public.team_event_registration_members set state = 'declined', responded_at = now() where id = m.id returning * into m;
    perform app.bump_team_roster(t.id);
    perform app.recompute_team_registration(t.id);
    select * into t from public.team_event_registrations where id = t.id;
    perform app.audit('user', 'team_registration.member_declined', 'team_event_registration', t.id, e.organization_id,
                      jsonb_build_object('event_id', e.id, 'member_id', m.id));
    return jsonb_build_object('member_state', m.state, 'registration_id', null, 'registration_status', null, 'team_status', t.status);
  end if;

  -- accept: the team must hold a seat (a member registration is never waitlisted), registration still open
  if t.status = 'waitlisted' then perform app.fail(409, 'team_registration_waitlisted'); end if;
  if e.status <> 'published' or now() >= e.registration_closes_at then perform app.fail(409, 'registration_closed'); end if;
  perform 1 from public.team_memberships tm
   where tm.team_id = t.team_id and tm.user_id = v_uid and tm.status = 'active' for share;    -- lock order 3
  if not found then perform app.fail(409, 'invite_not_pending'); end if;

  -- the guardian decision needs a known birth date (M-3); the age range is re-checked for the person themselves
  v_age := app.age_years(v_uid);
  if v_age is null then perform app.fail(409, 'profile_incomplete'); end if;
  if e.min_age is not null and v_age < e.min_age then perform app.fail(403, 'below_min_age'); end if;
  if e.max_age is not null and v_age > e.max_age then perform app.fail(403, 'above_max_age'); end if;
  if exists (select 1 from public.event_registrations r where r.event_id = e.id and r.user_id = v_uid
               and r.status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted')) then
    perform app.fail(409, 'member_already_registered', to_jsonb(array[v_uid])::text);
  end if;

  v_status := app.next_member_status(e, v_uid, v_id);
  insert into public.event_registrations (id, event_id, user_id, team_id, team_registration_id, status, idempotency_key, confirmed_at)
  values (v_id, e.id, v_uid, t.team_id, t.id, v_status, p_idempotency_key, case when v_status = 'confirmed' then now() end)
  returning * into v_reg;
  -- the member's OWN consent (never the captain's): same row as register_for_event
  insert into public.consents (user_id, purpose, policy_version, granted_by, subject_type, subject_id)
  values (v_uid, 'event_participation', app.current_policy_version('event_participation'), 'self', 'event_registration', v_reg.id);
  update public.team_event_registration_members
     set state = 'accepted', registration_id = v_reg.id, responded_at = now() where id = m.id returning * into m;

  perform app.recompute_team_registration(t.id);
  select * into t from public.team_event_registrations where id = t.id;
  perform app.audit('user', 'team_registration.member_accepted', 'event_registration', v_reg.id, e.organization_id,
                    jsonb_build_object('event_id', e.id, 'team_registration_id', t.id, 'status', v_status));
  return jsonb_build_object('member_state', m.state, 'registration_id', v_reg.id, 'registration_status', v_reg.status,
                            'team_status', t.status);
end $$;

-- ---------------------------------------------------------------- RPC: roster edit (captain or mentor, versioned)
create or replace function public.update_team_roster(
  p_team_registration_id uuid, p_member_ids uuid[], p_expected_roster_version int
) returns public.team_event_registrations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  t public.team_event_registrations; e public.events;
  v_members uuid[]; v_member uuid; v_current uuid[]; v_new_ids uuid[]; v_bad_ids uuid[]; v_size int; v_next int; r record;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into t from public.team_event_registrations where id = p_team_registration_id;
  if not found then perform app.fail(404, 'team_registration_not_found'); end if;
  if not app.is_team_manager(t.team_id) then
    if app.is_team_registration_member(t.id) then perform app.fail(403, 'not_team_manager'); end if;
    perform app.fail(404, 'team_registration_not_found');
  end if;

  select * into e from public.events where id = t.event_id for update;               -- lock order 1
  perform app.expire_team_registrations(e.id);
  select * into t from public.team_event_registrations where id = t.id for update;
  if t.status not in ('pending_members', 'pending_review', 'confirmed', 'waitlisted')
     or e.status <> 'published' or now() >= e.registration_closes_at then
    perform app.fail(409, 'team_registration_closed');
  end if;
  if p_expected_roster_version is distinct from t.roster_version then perform app.fail(409, 'roster_changed'); end if;

  v_members := array(select distinct x from unnest(coalesce(p_member_ids, '{}')) x where x is not null order by x);
  v_current := array(select m.user_id from public.team_event_registration_members m
                      where m.team_registration_id = t.id and m.roster_version = t.roster_version
                        and m.state in ('invited', 'accepted') order by m.user_id);
  -- nothing to change: same people and no hole in the current version
  if v_members = v_current and not exists (
       select 1 from public.team_event_registration_members m
        where m.team_registration_id = t.id and m.roster_version = t.roster_version and m.state in ('declined', 'removed')) then
    return t;
  end if;
  v_size := cardinality(v_members);
  if v_size < e.team_min_size or (e.team_max_size is not null and v_size > e.team_max_size) then
    perform app.fail(422, 'team_size_out_of_range');
  end if;

  foreach v_member in array v_members loop                                           -- lock order 2
    perform pg_advisory_xact_lock(hashtextextended(e.id::text || ':' || v_member::text, 0));
  end loop;

  -- lock order 3 + eligibility (same rules and the same id-only details as submit_team_registration)
  with roster as (select unnest(v_members) as user_id),
  active as (
    select m.user_id from public.team_memberships m
    where m.team_id = t.team_id and m.status = 'active' and m.user_id = any (v_members)
    order by m.user_id for share
  )
  select array(select x.user_id from roster x left join active a on a.user_id = x.user_id
               where a.user_id is null order by x.user_id) into v_bad_ids;
  if cardinality(v_bad_ids) > 0 then perform app.fail(422, 'member_not_active', to_jsonb(v_bad_ids)::text); end if;

  v_new_ids := array(select x from unnest(v_members) x where x <> all (v_current) order by x);
  if e.min_age is not null or e.max_age is not null then
    select array(select u.user_id from unnest(v_new_ids) u(user_id)
                 cross join lateral (select app.age_years(u.user_id) as age) a
                 where a.age is null or (e.min_age is not null and a.age < e.min_age) or (e.max_age is not null and a.age > e.max_age)
                 order by u.user_id) into v_bad_ids;
    if cardinality(v_bad_ids) > 0 then perform app.fail(403, 'member_age_not_eligible', to_jsonb(v_bad_ids)::text); end if;
  end if;
  select array(select u.user_id from unnest(v_new_ids) u(user_id)
               where exists (select 1 from public.event_registrations x
                             where x.event_id = e.id and x.user_id = u.user_id
                               and x.status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted'))
                  or exists (select 1 from public.team_event_registration_members tm
                             join public.team_event_registrations o on o.id = tm.team_registration_id
                             where o.event_id = e.id and tm.user_id = u.user_id and tm.state in ('invited', 'accepted')
                               and o.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted'))
               order by u.user_id) into v_bad_ids;
  if cardinality(v_bad_ids) > 0 then perform app.fail(409, 'member_already_registered', to_jsonb(v_bad_ids)::text); end if;

  v_next := t.roster_version + 1;
  -- dropped live members: removed (their registration ends); kept: move to v+1; new: invited at v+1; holes stay behind
  for r in
    select m.id, m.registration_id from public.team_event_registration_members m
     where m.team_registration_id = t.id and m.roster_version = t.roster_version
       and m.state in ('invited', 'accepted') and m.user_id <> all (v_members)
  loop
    update public.team_event_registration_members set state = 'removed' where id = r.id;
    if r.registration_id is not null then perform app.end_team_member_registration(r.registration_id, 'team_roster_changed'); end if;
  end loop;
  update public.team_event_registration_members set roster_version = v_next
   where team_registration_id = t.id and roster_version = t.roster_version and state in ('invited', 'accepted')
     and user_id = any (v_members);
  update public.team_event_registrations set roster_version = v_next where id = t.id;
  insert into public.team_event_registration_members (team_registration_id, user_id, role_at_submit, roster_version, state)
  select t.id, m.user_id, m.role, v_next, 'invited'
    from public.team_memberships m
   where m.team_id = t.team_id and m.status = 'active' and m.user_id = any (v_new_ids);

  perform app.recompute_team_registration(t.id);
  select * into t from public.team_event_registrations where id = t.id;
  perform app.audit('user', 'team_registration.roster_updated', 'team_event_registration', t.id, e.organization_id,
                    jsonb_build_object('event_id', e.id, 'roster_version', t.roster_version, 'roster_size', v_size));
  return t;
end $$;

-- ---------------------------------------------------------------- RPC: cancel (captain or mentor)
create or replace function public.cancel_team_registration(p_team_registration_id uuid)
returns public.team_event_registrations
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.team_event_registrations; e public.events; v_reg uuid;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into t from public.team_event_registrations where id = p_team_registration_id;
  if not found then perform app.fail(404, 'team_registration_not_found'); end if;
  if not app.is_team_manager(t.team_id) then
    if app.is_team_registration_member(t.id) then perform app.fail(403, 'not_team_manager'); end if;
    perform app.fail(404, 'team_registration_not_found');
  end if;

  select * into e from public.events where id = t.event_id for update;               -- lock order 1
  select * into t from public.team_event_registrations where id = t.id for update;
  if t.status in ('cancelled', 'rejected', 'expired') then return t; end if;
  if now() >= e.starts_at then perform app.fail(409, 'event_already_started'); end if;

  update public.team_event_registrations
     set status = 'cancelled', status_reason = 'cancelled_by_team', cancelled_at = now()
   where id = t.id returning * into t;
  for v_reg in select id from public.event_registrations
                where team_registration_id = t.id and status in ('pending_guardian', 'pending_review', 'confirmed')
  loop
    perform app.end_team_member_registration(v_reg, 'team_registration_cancelled');
  end loop;
  select * into e from public.events where id = e.id;
  perform app.promote_team_waitlist(e);
  perform app.audit('user', 'team_registration.cancelled', 'team_event_registration', t.id, e.organization_id,
                    jsonb_build_object('event_id', e.id, 'team_id', t.team_id));
  return t;
end $$;

-- ---------------------------------------------------------------- RPC: reads
-- The registered team's ACTIVE members only (the team_roster circle). Current roster version; display names, role, state, step.
create or replace function public.team_registration_detail(p_team_registration_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.team_event_registrations; e public.events; tm public.teams;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into t from public.team_event_registrations where id = p_team_registration_id;
  if not found or not app.is_team_registration_member(t.id) then perform app.fail(404, 'team_registration_not_found'); end if;
  select * into e from public.events where id = t.event_id;
  select * into tm from public.teams where id = t.team_id;
  return jsonb_build_object(
    'id', t.id, 'status', t.status, 'hold_expires_at', t.hold_expires_at, 'roster_version', t.roster_version,
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at),
    'team', jsonb_build_object('id', tm.id, 'name', tm.name),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'member_id', m.id, 'display_name', p.display_name, 'role_at_submit', m.role_at_submit, 'state', m.state,
               'step', case when m.state = 'invited' then 'invited'
                            when m.state = 'accepted' and r.status = 'confirmed' then 'ready'
                            when m.state = 'accepted' and r.status = 'pending_guardian' then 'guardian'
                            else 'declined' end)
             order by m.role_at_submit, p.display_name, m.id)
        from public.team_event_registration_members m
        left join public.profiles p on p.id = m.user_id
        left join public.event_registrations r on r.id = m.registration_id
       where m.team_registration_id = t.id and m.roster_version = t.roster_version), '[]'::jsonb),
    'can_edit', app.is_team_manager(t.team_id) and t.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted')
                and e.status = 'published' and now() < e.registration_closes_at);
end $$;

-- My open invites: ids, event, team name, the team's status. Nothing about other members.
create or replace function public.my_team_registration_invites() returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'member_id', m.id, 'team_registration_id', t.id, 'state', m.state, 'team_status', t.status,
           'hold_expires_at', t.hold_expires_at,
           'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at),
           'team', jsonb_build_object('id', tm.id, 'name', tm.name))
    from public.team_event_registration_members m
    join public.team_event_registrations t on t.id = m.team_registration_id
    join public.events e on e.id = t.event_id
    join public.teams tm on tm.id = t.team_id
   where m.user_id = (select auth.uid()) and m.state = 'invited' and m.roster_version = t.roster_version
     and t.status in ('pending_members', 'pending_review', 'confirmed', 'waitlisted')
     and (t.status <> 'pending_members' or t.hold_expires_at > now())
   order by e.starts_at, t.id;
$$;

-- ---------------------------------------------------------------- card + check-in: a team member needs the TEAM confirmed
-- Same as 0002 + the team check (Review Focus 5).
create or replace function public.get_participation_card(p_registration_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_reg public.event_registrations; e public.events;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into v_reg from public.event_registrations where id = p_registration_id and user_id = v_uid;
  if not found then perform app.fail(404, 'registration_not_found'); end if;
  if v_reg.status <> 'confirmed' then perform app.fail(409, 'registration_not_confirmed'); end if;
  if v_reg.team_registration_id is not null and not exists (
       select 1 from public.team_event_registrations t where t.id = v_reg.team_registration_id and t.status = 'confirmed') then
    perform app.fail(409, 'team_registration_not_confirmed');
  end if;
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

-- Same as 0006 + the team check right after the registration status check.
create or replace function public.check_in_participant(p_token text, p_session_id uuid default null, p_expected_event_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_parts text[]; v_reg public.event_registrations; e public.events;
  v_existing public.event_check_ins; v_new public.event_check_ins;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  v_parts := string_to_array(btrim(coalesce(p_token, '')), '.');
  if array_length(v_parts, 1) is distinct from 3 or v_parts[1] <> 'TA1'
     or v_parts[2] !~ '^[0-9a-f-]{36}$' then perform app.fail(422, 'ticket_malformed'); end if;

  select * into v_reg from public.event_registrations where id = v_parts[2]::uuid for update;
  if not found then perform app.fail(404, 'ticket_unknown'); end if;
  select * into e from public.events where id = v_reg.event_id;

  -- Authorisation first: staff of another organisation learn nothing about this ticket.
  if not app.has_org_role(e.organization_id, array['owner', 'admin', 'checkin_staff']::public.org_member_role[]) then
    perform app.fail(403, 'checkin_forbidden'); end if;
  if app.ticket_token(v_reg) <> btrim(p_token) then perform app.fail(422, 'ticket_invalid'); end if;
  if p_expected_event_id is not null and p_expected_event_id <> e.id then
    perform app.fail(409, 'ticket_wrong_event', e.title); end if;
  if v_reg.status <> 'confirmed' then perform app.fail(409, 'registration_not_confirmed', v_reg.status::text); end if;
  if v_reg.team_registration_id is not null and not exists (
       select 1 from public.team_event_registrations t where t.id = v_reg.team_registration_id and t.status = 'confirmed') then
    perform app.fail(409, 'team_registration_not_confirmed');
  end if;
  if e.status <> 'published' then perform app.fail(409, 'event_not_active'); end if;
  if now() < e.starts_at - interval '3 hours' or now() > e.ends_at then
    perform app.fail(409, 'outside_checkin_window'); end if;
  if p_session_id is not null and not exists
     (select 1 from public.event_sessions s where s.id = p_session_id and s.event_id = e.id) then
    perform app.fail(422, 'session_mismatch'); end if;

  select * into v_existing from public.event_check_ins
   where registration_id = v_reg.id and session_id is not distinct from p_session_id;
  if found then
    return jsonb_build_object('result', 'already_checked_in', 'registration_id', v_reg.id, 'event_id', e.id,
                              'checked_in_at', v_existing.created_at,
                              'holder_name', (select display_name from public.profiles where id = v_reg.user_id));
  end if;

  insert into public.event_check_ins (registration_id, session_id, checked_in_by)
  values (v_reg.id, p_session_id, v_uid) returning * into v_new;
  perform app.audit('user', 'registration.checked_in', 'event_registration', v_reg.id, e.organization_id,
                    jsonb_build_object('event_id', e.id));
  return jsonb_build_object('result', 'checked_in', 'registration_id', v_reg.id, 'event_id', e.id,
                            'checked_in_at', v_new.created_at,
                            'holder_name', (select display_name from public.profiles where id = v_reg.user_id));
end $$;

-- ---------------------------------------------------------------- team membership changes lock the events first
-- Same as 0004 + app.lock_team_registration_events before the membership row (lock order: event → … → membership; a
-- concurrent submit holds event → advisory → membership FOR SHARE, so taking the membership first could deadlock).
create or replace function public.remove_team_member(p_membership_id uuid) returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m public.team_memberships; v_team uuid;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select team_id into v_team from public.team_memberships where id = p_membership_id;
  if found and app.is_team_captain(v_team) then perform app.lock_team_registration_events(v_team); end if;
  select * into m from public.team_memberships where id = p_membership_id for update;
  if not found or not app.is_team_captain(m.team_id) then perform app.fail(403, 'team_manage_forbidden'); end if;
  if m.user_id = v_uid then perform app.fail(403, 'cannot_remove_self'); end if;
  if m.status <> 'active' then perform app.fail(409, 'membership_not_active'); end if;
  if m.role = 'captain' then perform app.fail(409, 'demote_captain_first'); end if;
  update public.team_memberships set status = 'removed', decided_by = v_uid, decided_at = now()
   where id = m.id returning * into m;
  update public.team_tasks set assignee_id = null where team_id = m.team_id and assignee_id = m.user_id and status <> 'done';
  perform app.audit('user', 'team.member_removed', 'team_membership', m.id);
  return m;
end $$;

create or replace function public.leave_team(p_team_id uuid) returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m public.team_memberships; v_captains int;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if exists (select 1 from public.team_memberships where team_id = p_team_id and user_id = v_uid and status = 'active') then
    perform app.lock_team_registration_events(p_team_id);
  end if;
  perform 1 from public.teams where id = p_team_id for update;
  select * into m from public.team_memberships
   where team_id = p_team_id and user_id = v_uid and status = 'active' for update;
  if not found then perform app.fail(404, 'membership_not_found'); end if;
  if m.role = 'captain' then
    select count(*) into v_captains from public.team_memberships
     where team_id = p_team_id and status = 'active' and role = 'captain';
    if v_captains <= 1 then perform app.fail(409, 'last_captain'); end if;
  end if;
  update public.team_memberships set status = 'left', decided_at = now() where id = m.id returning * into m;
  update public.team_tasks set assignee_id = null where team_id = p_team_id and assignee_id = v_uid and status <> 'done';
  return m;
end $$;

-- ---------------------------------------------------------------- volunteer brief: counts that mean "can check in"
-- Same as 20260920000100 except: stats.confirmed counts people who can check in — confirmed individual registrations plus
-- confirmed members of CONFIRMED teams (a member whose team is not complete cannot check in) — and additive keys
-- confirmed_individual, confirmed_team_members, confirmed_teams, team_capacity. `teams` also lists confirmed team
-- registrations (team names only; still no participant identity).
create or replace function public.volunteer_event_brief(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; v public.event_volunteers; v_individual int; v_members int;
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  select * into v from public.event_volunteers where event_id = p_event_id and user_id = (select auth.uid());
  if not found or v.status <> 'approved' then perform app.fail(403, 'volunteer_not_approved'); end if;
  select * into e from public.events where id = p_event_id;
  select count(*) into v_individual from public.event_registrations r
   where r.event_id = e.id and r.status = 'confirmed' and r.team_registration_id is null;
  select count(*) into v_members from public.event_registrations r
   join public.team_event_registrations t on t.id = r.team_registration_id and t.status = 'confirmed'
   where r.event_id = e.id and r.status = 'confirmed';
  return jsonb_build_object(
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'city', e.city, 'venue', e.venue,
                                'format', e.format, 'support_contact', e.support_contact,
                                'organizer', (select name from public.organizations o where o.id = e.organization_id)),
    'my_duty', v.duty,
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'location_note', s.location_note) order by s.starts_at)
                          from public.event_sessions s where s.event_id = e.id), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'pinned', a.pinned, 'created_at', a.created_at)
                                               order by a.pinned desc, a.created_at desc)
                               from public.event_announcements a where a.event_id = e.id and a.audience in ('all', 'volunteers')), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(distinct jsonb_build_object('name', t.name, 'category', t.category))
                       from public.teams t
                       where t.id in (select r.team_id from public.event_registrations r
                                       where r.event_id = e.id and r.status = 'confirmed' and r.team_registration_id is null)
                          or t.id in (select tr.team_id from public.team_event_registrations tr
                                       where tr.event_id = e.id and tr.status = 'confirmed')), '[]'::jsonb),
    'stats', jsonb_build_object(
      'confirmed', v_individual + v_members,
      'confirmed_individual', v_individual,
      'confirmed_team_members', v_members,
      'confirmed_teams', (select count(*) from public.team_event_registrations tr where tr.event_id = e.id and tr.status = 'confirmed'),
      'checked_in', (select count(distinct c.registration_id) from public.event_check_ins c join public.event_registrations r on r.id = c.registration_id where r.event_id = e.id),
      'capacity', e.capacity,
      'team_capacity', e.team_capacity,
      'volunteers', (select count(*) from public.event_volunteers x where x.event_id = e.id and x.status = 'approved')));
end $$;

-- ---------------------------------------------------------------- grants
-- app.* functions get the default PUBLIC execute grant at creation (0001's bulk revoke ran before they existed).
revoke execute on function app.next_member_status(public.events, uuid, uuid), app.lock_team_registration_events(uuid),
  app.bump_team_roster(uuid), app.end_team_member_registration(uuid, text, public.registration_status),
  app.recompute_team_registration(uuid), app.expire_team_registrations(uuid), app.team_member_registration_changed(),
  app.team_membership_ended(), app.team_member_row_deleted(), app.notify_team_registration_member(),
  app.notify_team_registration_status()
  from public, anon, authenticated, service_role;
revoke execute on function public.respond_team_registration(uuid, boolean, uuid), public.update_team_roster(uuid, uuid[], int),
  public.cancel_team_registration(uuid), public.team_registration_detail(uuid), public.my_team_registration_invites()
  from public, anon;
grant execute on function public.respond_team_registration(uuid, boolean, uuid), public.update_team_roster(uuid, uuid[], int),
  public.cancel_team_registration(uuid), public.team_registration_detail(uuid), public.my_team_registration_invites()
  to authenticated;
-- create or replace keeps the existing grants of every redefined function.

-- ---------------------------------------------------------------- schedule (no-op where pg_cron is unavailable)
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: skipping team registration expiry job';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'techapp-expire-team-registrations';
  perform cron.schedule('techapp-expire-team-registrations', '*/10 * * * *', 'select app.expire_team_registrations()');
end $$;
