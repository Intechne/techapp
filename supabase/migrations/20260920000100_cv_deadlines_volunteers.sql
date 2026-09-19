-- TechApp · 0010  verified CV, deadline-driven opportunities, team task guard, event volunteers + announcements.

-- ================================================================ OPPORTUNITIES: competitions, grants, awards
alter type public.opportunity_type add value if not exists 'competition';
alter type public.opportunity_type add value if not exists 'grant';
alter type public.opportunity_type add value if not exists 'award';
alter type public.opportunity_type add value if not exists 'scholarship';

alter table public.opportunities
  -- Some calls (grants, awards, third-party competitions) are applied to on the owner's site. Then TechApp only tracks the deadline.
  add column if not exists apply_url text check (apply_url ~ '^https://'),
  add column if not exists reward_note text check (char_length(reward_note) <= 160),
  add column if not exists team_based boolean not null default false;
create index if not exists opportunities_deadline_idx on public.opportunities (closes_at) where status = 'published';

-- ================================================================ PROFILE: self-declared skills (never "verified" by themselves)
alter table public.profiles
  add column if not exists skills text[] not null default '{}'
    check (coalesce(array_length(skills, 1), 0) <= 15 and char_length(array_to_string(skills, '')) <= 400);

-- ================================================================ TEAM TASKS: only active members can be assigned
create or replace function app.task_assignee_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.team_memberships m where m.team_id = new.team_id and m.user_id = new.assignee_id and m.status = 'active') then
    perform app.fail(422, 'assignee_not_team_member');
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now(); end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end $$;
revoke execute on function app.task_assignee_guard() from public, anon, authenticated;
drop trigger if exists team_tasks_assignee_guard on public.team_tasks;
create trigger team_tasks_assignee_guard before insert or update on public.team_tasks
  for each row execute function app.task_assignee_guard();

-- ================================================================ VOLUNTEERS + ANNOUNCEMENTS
create type public.volunteer_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.announcement_audience as enum ('all', 'participants', 'volunteers');

alter table public.events add column if not exists accepts_volunteers boolean not null default false;

create table public.event_volunteers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.volunteer_status not null default 'pending',
  note text check (char_length(note) <= 500),
  duty text check (char_length(duty) <= 120),            -- set by the organiser, e.g. "Kayıt masası"
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index event_volunteers_event_idx on public.event_volunteers (event_id, status);
create trigger event_volunteers_touch before update on public.event_volunteers
  for each row execute function app.touch_updated_at();

create table public.event_announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  audience public.announcement_audience not null default 'all',
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  pinned boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_announcements_event_idx on public.event_announcements (event_id, created_at desc);
create trigger event_announcements_touch before update on public.event_announcements
  for each row execute function app.touch_updated_at();

create or replace function app.is_approved_volunteer(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_volunteers v
                 where v.event_id = p_event and v.user_id = (select auth.uid()) and v.status = 'approved');
$$;
create or replace function app.is_confirmed_participant(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.event_registrations r
                 where r.event_id = p_event and r.user_id = (select auth.uid()) and r.status = 'confirmed');
$$;
create or replace function app.manages_event(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event
                 and app.has_org_role(e.organization_id, array['owner', 'admin', 'editor']::public.org_member_role[]));
$$;
revoke execute on function app.is_approved_volunteer(uuid), app.is_confirmed_participant(uuid), app.manages_event(uuid) from public;
grant execute on function app.is_approved_volunteer(uuid), app.is_confirmed_participant(uuid), app.manages_event(uuid) to authenticated;

alter table public.event_volunteers enable row level security;
alter table public.event_announcements enable row level security;

-- Volunteers: you see your own row; the organising team sees theirs. All writes go through RPCs.
create policy event_volunteers_select_own on public.event_volunteers for select to authenticated
  using (user_id = (select auth.uid()));
create policy event_volunteers_select_org on public.event_volunteers for select to authenticated
  using (app.manages_event(event_id));

-- Announcements: audience-scoped reads; only the organising team writes.
create policy event_announcements_read on public.event_announcements for select to authenticated
  using (app.manages_event(event_id)
         or (audience in ('all', 'volunteers') and app.is_approved_volunteer(event_id))
         or (audience in ('all', 'participants') and app.is_confirmed_participant(event_id)));
create policy event_announcements_insert on public.event_announcements for insert to authenticated
  with check (app.manages_event(event_id) and created_by = (select auth.uid()));
create policy event_announcements_update on public.event_announcements for update to authenticated
  using (app.manages_event(event_id)) with check (app.manages_event(event_id));
create policy event_announcements_delete on public.event_announcements for delete to authenticated
  using (app.manages_event(event_id));

create or replace function public.apply_as_volunteer(p_event_id uuid, p_note text default null)
returns public.event_volunteers
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); e public.events; v public.event_volunteers;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into e from public.events where id = p_event_id and status = 'published';
  if not found then perform app.fail(404, 'event_not_found'); end if;
  if not e.accepts_volunteers then perform app.fail(409, 'volunteers_not_accepted'); end if;
  if now() >= e.ends_at then perform app.fail(409, 'event_already_ended'); end if;
  if app.age_years(v_uid) is null then perform app.fail(409, 'profile_incomplete'); end if;
  -- Volunteering puts a minor in a working role at a venue: adults only until a guardian flow exists for it.
  if app.age_years(v_uid) < 18 then perform app.fail(403, 'volunteer_adults_only'); end if;

  insert into public.event_volunteers (event_id, user_id, note) values (e.id, v_uid, nullif(btrim(p_note), ''))
  on conflict (event_id, user_id) do update
    set status = case when public.event_volunteers.status in ('withdrawn', 'rejected') then 'pending'::public.volunteer_status else public.event_volunteers.status end,
        note = coalesce(excluded.note, public.event_volunteers.note)
  returning * into v;
  perform app.audit('user', 'volunteer.applied', 'event_volunteer', v.id, e.organization_id);
  return v;
end $$;

create or replace function public.withdraw_volunteer(p_event_id uuid) returns public.event_volunteers
language plpgsql security definer set search_path = '' as $$
declare v public.event_volunteers;
begin
  update public.event_volunteers set status = 'withdrawn'
   where event_id = p_event_id and user_id = (select auth.uid()) and status in ('pending', 'approved') returning * into v;
  if not found then perform app.fail(404, 'volunteer_application_not_found'); end if;
  return v;
end $$;

create or replace function public.decide_volunteer(p_volunteer_id uuid, p_approve boolean, p_duty text default null)
returns public.event_volunteers
language plpgsql security definer set search_path = '' as $$
declare v public.event_volunteers; e public.events;
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  select * into v from public.event_volunteers where id = p_volunteer_id for update;
  if not found then perform app.fail(404, 'volunteer_application_not_found'); end if;
  select * into e from public.events where id = v.event_id;
  if not app.has_org_role(e.organization_id, array['owner', 'admin', 'editor']::public.org_member_role[]) then
    perform app.fail(403, 'forbidden'); end if;
  if v.status = 'withdrawn' then perform app.fail(409, 'volunteer_withdrawn'); end if;
  update public.event_volunteers
     set status = case when p_approve then 'approved' else 'rejected' end::public.volunteer_status,
         duty = case when p_approve then nullif(btrim(p_duty), '') end, decided_by = (select auth.uid()), decided_at = now()
   where id = v.id returning * into v;
  perform app.audit('user', 'volunteer.' || v.status::text, 'event_volunteer', v.id, e.organization_id);
  return v;
end $$;

-- Organiser view of volunteer applications: name only, like the registration list.
create or replace function public.admin_event_volunteers(p_event_id uuid)
returns table (volunteer_id uuid, display_name text, status public.volunteer_status, note text, duty text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.manages_event(p_event_id) then perform app.fail(403, 'forbidden'); end if;
  return query select v.id, p.display_name, v.status, v.note, v.duty, v.created_at
    from public.event_volunteers v join public.profiles p on p.id = v.user_id
    where v.event_id = p_event_id order by v.status, v.created_at;
end $$;

-- What an APPROVED volunteer may see: a deliberately small operational brief. No participant names, no contact data.
create or replace function public.volunteer_event_brief(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; v public.event_volunteers;
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  select * into v from public.event_volunteers where event_id = p_event_id and user_id = (select auth.uid());
  if not found or v.status <> 'approved' then perform app.fail(403, 'volunteer_not_approved'); end if;
  select * into e from public.events where id = p_event_id;
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
                       from public.event_registrations r join public.teams t on t.id = r.team_id
                       where r.event_id = e.id and r.status = 'confirmed'), '[]'::jsonb),
    'stats', jsonb_build_object(
      'confirmed', (select count(*) from public.event_registrations r where r.event_id = e.id and r.status = 'confirmed'),
      'checked_in', (select count(distinct c.registration_id) from public.event_check_ins c join public.event_registrations r on r.id = c.registration_id where r.event_id = e.id),
      'capacity', e.capacity,
      'volunteers', (select count(*) from public.event_volunteers x where x.event_id = e.id and x.status = 'approved')));
end $$;

-- ================================================================ CV: one verified-vs-declared document
-- Participation entries come from organiser check-ins, so they are verified by construction. They certify attendance, not skill.
create or replace function public.my_cv() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'avatar_path' from public.profiles p where p.id = v_uid),
    'interests', coalesce((select jsonb_agg(i.label_tr order by i.sort_order) from public.profile_interests pi join public.interests i on i.id = pi.interest_id where pi.user_id = v_uid), '[]'::jsonb),
    'experiences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'title', x.title, 'role', x.role, 'contribution', x.contribution, 'organization_name', x.organization_name,
        'link_url', x.link_url, 'started_on', x.started_on, 'ended_on', x.ended_on, 'status', x.status, 'visibility', x.visibility,
        'attestation', (select jsonb_build_object('id', a.id, 'status', a.status, 'scope', a.scope, 'source', a.source, 'decided_at', a.decided_at,
                                                 'decision_note', a.decision_note, 'valid_until', a.valid_until,
                                                 'organization', (select name from public.organizations o where o.id = a.organization_id))
                        from public.attestations a where a.experience_id = x.id
                        order by (a.status = 'verified') desc, a.requested_at desc limit 1))
        order by coalesce(x.ended_on, x.started_on, x.created_at::date) desc)
      from public.experiences x where x.user_id = v_uid), '[]'::jsonb),
    'participations', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', e.id, 'title', e.title, 'type', e.type, 'starts_at', e.starts_at,
                                          'organizer', (select name from public.organizations o where o.id = e.organization_id),
                                          'checked_in_at', ci.first_at) order by e.starts_at desc)
      from public.event_registrations r join public.events e on e.id = r.event_id
      join lateral (select min(c.created_at) first_at from public.event_check_ins c where c.registration_id = r.id) ci on ci.first_at is not null
      where r.user_id = v_uid), '[]'::jsonb),
    'volunteering', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'duty', v.duty,
                                          'organizer', (select name from public.organizations o where o.id = e.organization_id)) order by e.starts_at desc)
      from public.event_volunteers v join public.events e on e.id = v.event_id
      where v.user_id = v_uid and v.status = 'approved' and e.ends_at < now()), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'kind', t.kind, 'role', m.role, 'since', m.decided_at) order by m.decided_at desc)
      from public.team_memberships m join public.teams t on t.id = m.team_id where m.user_id = v_uid and m.status = 'active'), '[]'::jsonb));
end $$;

-- Organisations that may be asked to verify an experience (verified ones only).
create or replace function public.attesting_organizations() returns table (id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name from public.organizations o where o.verification = 'verified' order by o.name;
$$;

-- ================================================================ grants
revoke execute on function
  public.apply_as_volunteer(uuid, text), public.withdraw_volunteer(uuid), public.decide_volunteer(uuid, boolean, text),
  public.admin_event_volunteers(uuid), public.volunteer_event_brief(uuid), public.my_cv(), public.attesting_organizations()
from public, anon;
grant execute on function
  public.apply_as_volunteer(uuid, text), public.withdraw_volunteer(uuid), public.decide_volunteer(uuid, boolean, text),
  public.admin_event_volunteers(uuid), public.volunteer_event_brief(uuid), public.my_cv(), public.attesting_organizations()
to authenticated;
