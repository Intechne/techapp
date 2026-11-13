-- TechApp · Faz 3b Task 9 (13 Kasım 2026) — in-app notifications, server side. Push delivery is NOT here (in-app rows only).
--
-- Copy rule (report decision 4): error copy lives in the client (errors.ts COPY); NOTIFICATION copy lives here, in
-- app.notification_copy() — the one source of the Turkish title/body. Push will later send the same stored row.
-- PII rule: the text is built ONLY from fixed phrases + the content title (event title, opportunity title, team name).
-- Never a person's name, e-mail or age — not the participant's, not the requester's, not the guardian's. Users include minors.
-- The row is self-contained (text frozen at creation, no FK to the target), so a target that is later cancelled, unpublished
-- or deleted never breaks the row; the client says "artık yayında değil" when the route no longer resolves (Review Focus 1).
--
-- Kinds → source transition → recipient (targets: event_registration | event | application | team):
--   registration.confirmed   event_registrations pending_guardian|pending_review → confirmed    participant   (event_registration)
--   registration.promoted    event_registrations waitlisted → confirmed                         participant   (event_registration)
--   registration.rejected    event_registrations → rejected (organiser review)                  participant   (event_registration)
--   registration.expired     event_registrations → expired (guardian request expired)           participant   (event_registration)
--   guardian.denied          event_registrations → cancelled, status_reason 'guardian_denied'   participant   (event_registration)
--   event.cancelled          event_registrations → cancelled, status_reason 'event_cancelled'   each live registrant (event)
--   application.status_changed applications → in_review|info_requested|accepted|declined|closed applicant   (application)
--   team_join.requested      team_memberships INSERT status 'pending'      active captains + mentors (team; no requester name)
--   team_join.accepted       team_memberships pending → active                                  requester     (team)
--   team_join.rejected       team_memberships pending → rejected                                requester     (team)
--   event.reminder_24h       app.queue_event_reminders(): confirmed + published, starts in [23 h, 25 h)  participant (event)
-- Guardian approval produces NO separate notification: the registration moves to confirmed → registration.confirmed only
-- (or to pending_review → nothing until the organiser decides). Self-service actions (register, cancel, withdraw) notify nobody.
-- Not notified on purpose (not in the kind list): guardian revoke after approval, waitlisted → pending_guardian/pending_review.
-- Faz 3a team registration does not exist on this branch (no team_event_registrations table) → no team-registration kinds.
--
-- Reminder: exactly one event.reminder_24h per (user, event) ever — unique partial index notifications_one_reminder on
-- (user_id, kind, target_id) where kind = 'event.reminder_24h', target = the EVENT (a cancel + re-register does not reopen it;
-- a starts_at change does not resend); the prune job keeps reminder rows of events that have not started yet.
-- event_reminders = false (notification_preferences) suppresses reminders only; transactional kinds always arrive.
--
-- Write paths: clients have NO insert/update/delete on notifications any more (the old notifications_mark_read_own policy
-- let the raw 'notification_read_only' trigger error reach the client). public.mark_notifications_read() is the only client
-- write; public.set_notification_preferences() the only write to notification_preferences (RLS: read own row only).
--
-- Retention: app.prune_notifications() deletes READ rows older than app.notification_retention_days(); unread rows are never
-- deleted. Schedules (pg_cron, guarded like 20260919000700 so embedded tests / local stack apply this file without pg_cron):
-- techapp-event-reminders */15 * * * *, techapp-prune-notifications daily 03:23 UTC.
--
-- Deploy order (staging push HELD until after the pilot, user approval): 20261112000300 → 20261113000100 → 20261113000200 →
-- 20261113000300 → this file. It touches no teams column grant, so it is order-independent of 000300's bulk revoke, but it
-- ships in file order with the rest. Remote regression 25–25j must pass after the push.

-- ---------------------------------------------------------------- constants
-- kullanıcı kararı 13 Kas 2026: 90 gün (okunmuş bildirimler 90 gün sonra silinir; okunmamışlar hiç silinmez).
-- The privacy / retention policy text must state this period (legal text is not written here — the policy owner adds it).
create or replace function app.notification_retention_days() returns int
language sql immutable set search_path = '' as $$ select 90 $$;

create or replace function app.notification_kinds() returns text[]
language sql immutable set search_path = '' as $$
  select array['registration.confirmed', 'registration.promoted', 'registration.rejected', 'registration.expired',
               'guardian.denied', 'application.status_changed', 'team_join.accepted', 'team_join.rejected',
               'team_join.requested', 'event.reminder_24h', 'event.cancelled']::text[];
$$;

-- ---------------------------------------------------------------- copy (single source of the Turkish text)
-- Built from fixed phrases + the content title only. Genç, sade ton; no exclamation marks, no names.
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
    when 'guardian.denied' then title := 'Velin kaydı onaylamadı.';                body := t || ' için kaydın iptal edildi.';
    when 'application.status_changed' then title := 'Başvurunda yeni bir durum var.';
                                           body := t || ' için başvurunun durumu güncellendi.';
    when 'team_join.accepted' then title := 'Takıma katıldın.';                    body := t || ' katılma isteğini kabul etti.';
    when 'team_join.rejected' then title := 'Katılma isteğin kabul edilmedi.';    body := t || ' bu kez isteğini kabul etmedi.';
    when 'team_join.requested' then title := 'Takımına katılmak isteyen var.';
                                    body := t || ' için yeni bir katılma isteği bekliyor.';
    when 'event.reminder_24h' then title := 'Etkinliğine bir gün kaldı.';         body := t || ' yaklaşık 24 saat sonra başlıyor.';
    when 'event.cancelled' then title := 'Etkinlik iptal edildi.';                 body := t || ' iptal edildi. Kaydın da kapandı.';
    else raise exception using errcode = 'P0001', message = 'notification_kind_unknown', detail = coalesce(p_kind, '');
  end case;
  return next;
end $$;

-- ---------------------------------------------------------------- table changes
-- '^[a-z_.]{3,60}$' (0004) has no digits → 'event.reminder_24h' would be refused.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind ~ '^[a-z0-9_.]{3,60}$');
-- NOT VALID: nothing wrote this table before, but a stray staging row must not block the migration.
alter table public.notifications add constraint notifications_target_type_check
  check (target_type is null or target_type in ('event', 'event_registration', 'application', 'team')) not valid;

create unique index notifications_one_reminder on public.notifications (user_id, kind, target_id)
  where kind = 'event.reminder_24h';
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_prune_idx on public.notifications (created_at) where read_at is not null;

-- Close the direct client write path. The old update policy + app.protect_notification surfaced a raw
-- 'notification_read_only' error to the client; now an API role cannot write the table at all.
drop policy notifications_mark_read_own on public.notifications;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- ---------------------------------------------------------------- preferences
create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  event_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function app.touch_updated_at();
alter table public.notification_preferences enable row level security;
create policy notification_preferences_select_own on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
-- No row = defaults (event_reminders true). Writes: set_notification_preferences only.
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;

create or replace function public.set_notification_preferences(p_event_reminders boolean)
returns public.notification_preferences
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); p public.notification_preferences;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_event_reminders is null then perform app.fail(422, 'notification_preferences_invalid'); end if;
  insert into public.notification_preferences (user_id, event_reminders) values (v_uid, p_event_reminders)
  on conflict (user_id) do update set event_reminders = excluded.event_reminders
  returning * into p;
  return p;
end $$;
revoke execute on function public.set_notification_preferences(boolean) from public, anon;
grant execute on function public.set_notification_preferences(boolean) to authenticated;

-- ---------------------------------------------------------------- read path
-- Own unread rows only; ids of other users' rows are ignored (count 0, no existence oracle). NULL = all own unread.
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_n int;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  update public.notifications set read_at = now()
   where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------- writer
create or replace function app.notify(p_user uuid, p_kind text, p_target_type text, p_target_id uuid, p_content_title text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, target_type, target_id)
  select p_user, p_kind, c.title, c.body, p_target_type, p_target_id from app.notification_copy(p_kind, p_content_title) c
  on conflict (user_id, kind, target_id) where kind = 'event.reminder_24h' do nothing;
end $$;

-- ---------------------------------------------------------------- triggers
create or replace function app.notify_registration_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text; v_type text := 'event_registration'; v_target uuid := new.id; v_title text;
begin
  if new.status = 'confirmed' then
    v_kind := case when old.status = 'waitlisted' then 'registration.promoted' else 'registration.confirmed' end;
  elsif new.status = 'rejected' then v_kind := 'registration.rejected';
  elsif new.status = 'expired' then v_kind := 'registration.expired';
  elsif new.status = 'cancelled' and new.status_reason = 'guardian_denied' then v_kind := 'guardian.denied';
  elsif new.status = 'cancelled' and new.status_reason = 'event_cancelled' then
    v_kind := 'event.cancelled'; v_type := 'event'; v_target := new.event_id;
  else
    return null; -- cancelled by the user / guardian revoke / waitlist → pending_*: no notification
  end if;
  select e.title into v_title from public.events e where e.id = new.event_id;
  perform app.notify(new.user_id, v_kind, v_type, v_target, v_title);
  return null;
end $$;
create trigger event_registrations_notify after update of status on public.event_registrations
  for each row when (old.status is distinct from new.status) execute function app.notify_registration_status();

create or replace function app.notify_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_title text;
begin
  -- organisation moves only; draft → submitted and withdrawals are the applicant's own actions
  if new.status not in ('in_review', 'info_requested', 'accepted', 'declined', 'closed') then return null; end if;
  select o.title into v_title from public.opportunities o where o.id = new.opportunity_id;
  perform app.notify(new.user_id, 'application.status_changed', 'application', new.id, v_title);
  return null;
end $$;
create trigger applications_notify after update of status on public.applications
  for each row when (old.status is distinct from new.status) execute function app.notify_application_status();

create or replace function app.notify_team_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text; r record;
begin
  select t.name into v_name from public.teams t where t.id = new.team_id;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then return null; end if;
    for r in
      select m.user_id from public.team_memberships m
       where m.team_id = new.team_id and m.status = 'active' and m.role in ('captain', 'mentor') and m.user_id <> new.user_id
    loop
      -- one unread "someone wants to join" per manager per team: withdraw → request again does not stack up rows
      if not exists (select 1 from public.notifications n
                      where n.user_id = r.user_id and n.kind = 'team_join.requested' and n.target_id = new.team_id
                        and n.read_at is null) then
        perform app.notify(r.user_id, 'team_join.requested', 'team', new.team_id, v_name);
      end if;
    end loop;
  elsif old.status = 'pending' and new.status in ('active', 'rejected') then
    perform app.notify(new.user_id, case when new.status = 'active' then 'team_join.accepted' else 'team_join.rejected' end,
                       'team', new.team_id, v_name);
  end if;
  return null;
end $$;
create trigger team_memberships_notify_insert after insert on public.team_memberships
  for each row execute function app.notify_team_membership();
create trigger team_memberships_notify_status after update of status on public.team_memberships
  for each row when (old.status is distinct from new.status) execute function app.notify_team_membership();

-- ---------------------------------------------------------------- scheduled jobs
create or replace function app.queue_event_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  with due as (
    select distinct r.user_id, e.id as event_id, e.title
      from public.event_registrations r join public.events e on e.id = r.event_id
     where r.status = 'confirmed' and e.status = 'published'
       and e.starts_at >= now() + interval '23 hours' and e.starts_at < now() + interval '25 hours'
       and not exists (select 1 from public.notification_preferences p where p.user_id = r.user_id and not p.event_reminders)
  ), ins as (
    insert into public.notifications (user_id, kind, title, body, target_type, target_id)
    select d.user_id, 'event.reminder_24h', c.title, c.body, 'event', d.event_id
      from due d cross join lateral app.notification_copy('event.reminder_24h', d.title) c
    on conflict (user_id, kind, target_id) where kind = 'event.reminder_24h' do nothing
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end $$;

create or replace function app.prune_notifications() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  delete from public.notifications n
   where n.read_at is not null
     and n.created_at < now() - make_interval(days => app.notification_retention_days())
     -- a reminder row is the "already sent" marker: keep it while its event is still ahead
     and not (n.kind = 'event.reminder_24h'
              and exists (select 1 from public.events e where e.id = n.target_id and e.starts_at > now()));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- app.* functions get the default PUBLIC execute grant at creation (0001's bulk revoke ran before they existed).
revoke execute on function app.notification_retention_days(), app.notification_kinds(), app.notification_copy(text, text),
  app.notify(uuid, text, text, uuid, text), app.notify_registration_status(), app.notify_application_status(),
  app.notify_team_membership(), app.queue_event_reminders(), app.prune_notifications()
  from public, anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: skipping notification jobs';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname in ('techapp-event-reminders', 'techapp-prune-notifications');
  perform cron.schedule('techapp-event-reminders', '*/15 * * * *', 'select app.queue_event_reminders()');
  perform cron.schedule('techapp-prune-notifications', '23 3 * * *', 'select app.prune_notifications()');
end $$;
