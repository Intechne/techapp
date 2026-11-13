-- TechApp · Faz 3b Task 6 (13 Kasım 2026) — rich team profile: category key, projects, role distribution, public leaders.
--
-- Privacy rule (spec §4 "Takım profili", plan Review Focus 5): member NAMES stay inside the team (public.team_roster, members
-- only). The public reading is public.team_public_profile(): counts for everyone, and names ONLY for active captains/mentors
-- who are 18+ AND discoverable. Age is computed here, on the server, by app.age_years() (birth_date, Europe/Istanbul) — the one
-- existing definition; no birth date = not adult = never named. `discoverable` is checked as well as age, so a profile that
-- was discoverable before a birth-date correction made it a minor's is still not named. "Discoverable" is the same rule as
-- the profiles_select_discoverable policy (discoverable AND onboarded). The result carries no user id, birth date or e-mail.
--
-- Visibility = the teams rule: an active team is public (anon included); a suspended team is visible only to its active
-- members and platform admins (teams_member_read) — everyone else gets 404 team_not_found, the same answer as an unknown id.
-- team_projects follows the same rule, so a suspended team's projects disappear from public view with the team, while its
-- members keep seeing their own team's work (as they keep seeing the team itself).
--
-- Writes: team_projects has NO client INSERT/UPDATE/DELETE grant. public.upsert_team_project / public.delete_team_project
-- (SECURITY DEFINER) allow an ACTIVE captain or mentor of that team (app.is_team_manager) and platform admins (moderation —
-- a project can now be reported; same as the teams_manager_update policy). Everyone else: 403 team_manage_forbidden.
-- Writes are allowed on a suspended team too (same as editing the team itself through teams_manager_update); nothing is public
-- while suspended.
--
-- Covers for projects come later: team_projects.cover_path exists but is pinned to NULL by a CHECK (team covers are closed by
-- user decision 13 Nov 2026, see 20261113000100_covers). Opening it = a new migration that drops team_projects_cover_closed,
-- adds the path contract + a write path through public.set_cover, AND adds team_projects to app.cover_object_in_use (or a
-- bound project cover could be deleted / re-uploaded behind review's back).
--
-- events: [] until Faz 3a (team registration, planned table public.team_event_registrations with status 'confirmed') exists;
-- event_registrations.team_id is not a team registration (individual rows) and is deliberately not used.
--
-- Deploy order: 20261112000300_hide_creator_columns → 20261113000100_covers → this file (file order). 000300's bulk
-- `revoke select on public.teams from anon, authenticated` also drops column-level grants, so the category_key grant below
-- survives only if this file runs AFTER 000300. Clients that select category_key (Task 7) ship only after this file is on the
-- target project (else "column does not exist").

-- ================================================================ 1. teams.category_key (the free-text `category` stays a label)
alter table public.teams
  add column category_key text not null default 'other'
  constraint teams_category_key_check
  check (category_key in ('robotics', 'software', 'entrepreneurship', 'science', 'design', 'social_impact', 'media', 'other'));
-- Public content, like name/category (teams has column-level SELECT grants since 20261112000300; pilot-privacy.test.ts).
grant select (category_key) on public.teams to anon, authenticated;

-- Keyword map from a free-text label to a key. Case-insensitive and Turkish-aware without depending on the database locale:
-- Turkish letters are folded to ASCII first (İ/I/ı → i, ş → s, ğ → g, ü → u, ö → o, ç → c, â/î/û → a/i/u), then lower().
-- First match wins, in this order: robotics, software, media (before social: "sosyal medya"), social_impact, entrepreneurship,
-- science, design. \m … \M = whole word (short tokens like "ai", "ui", "frc" must not match inside other words).
create or replace function app.team_category_key_for(p_label text) returns text
language sql immutable set search_path = '' as $$
  with n as (select lower(translate(coalesce(p_label, ''), 'İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'iiissgguuooccaaiiuu')) as s)
  select case
    when s ~ '(robot|mekatronik|mechatronic|first lego|otonom|autonomous|drone|\m(frc|ftc|fll|vex|iha)\M)' then 'robotics'
    when s ~ '(yazilim|software|kod|code|coding|program|hackathon|bilisim|siber|cyber|yapay zeka|artificial intel|machine learning|makine ogren|veri bilimi|data science|developer|gelistirici|mobil uygulama|game|oyun gelistir|\m(web|app|ai)\M)' then 'software'
    when s ~ '(medya|media|film|video|fotograf|photo|gazete|journal|podcast|yayin|broadcast|muzik|music|sinema|cinema|radyo|radio|icerik|content)' then 'media'
    when s ~ '(sosyal|social|gonullu|volunt|toplum|sorumluluk|yardim|sivil|impact|charity|\m(stk|ngo)\M)' then 'social_impact'
    when s ~ '(girisim|entrepreneur|startup|start-up|is fikri|business|isletme)' then 'entrepreneurship'
    when s ~ '(bilim|science|fizik|physics|kimya|chemistry|biyoloji|biology|matematik|math|astronom|uzay|space|roket|rocket|arastirma|research|tubitak|ekoloji|ecology|cevre|environment|iklim|climate|surdurulebilir|sustainab|\mfen\M)' then 'science'
    when s ~ '(tasarim|design|grafik|graphic|illustr|mimar|architect|moda|fashion|sanat|\m(ui|ux)\M)' then 'design'
    else 'other' end
  from n;
$$;
revoke execute on function app.team_category_key_for(text) from public, anon, authenticated;

-- Backfill existing teams from their label; unmatched rows stay 'other' (and are not touched). Matched rows get a new
-- updated_at (teams_touch) — acceptable: the row did change. tests: team-profile.test.ts runs this exact block.
-- team-category-backfill:begin
update public.teams set category_key = app.team_category_key_for(category)
 where category_key = 'other' and app.team_category_key_for(category) <> 'other';
-- team-category-backfill:end

-- create_team gains an optional p_category_key (a new trailing parameter with a default, so every existing call — positional or
-- named, mobile included — still resolves). Not given → derived from p_category with the same map. Body otherwise unchanged
-- from 20260919000400_ecosystem. The return type gains category_key (a teams column), which existing callers ignore.
drop function public.create_team(text, public.team_kind, text, text);
create function public.create_team(
  p_name text, p_kind public.team_kind default 'team', p_category text default null, p_tagline text default null,
  p_category_key text default null
) returns public.teams
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.teams; v_slug text; v_key text;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if app.age_years(v_uid) is null then perform app.fail(409, 'profile_incomplete'); end if;
  if p_name is null or char_length(btrim(p_name)) < 2 then perform app.fail(422, 'team_name_invalid'); end if;
  v_key := coalesce(nullif(btrim(p_category_key), ''), app.team_category_key_for(p_category));
  if v_key not in ('robotics', 'software', 'entrepreneurship', 'science', 'design', 'social_impact', 'media', 'other') then
    perform app.fail(422, 'team_category_invalid');
  end if;
  if (select count(*) from public.teams where created_by = v_uid) >= 5 then
    perform app.fail(429, 'team_create_limit'); end if;
  v_slug := 'team-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.teams (slug, name, kind, category, tagline, created_by, category_key)
  values (v_slug, btrim(p_name), p_kind, nullif(btrim(p_category), ''), nullif(btrim(p_tagline), ''), v_uid, v_key)
  returning * into t;
  insert into public.team_memberships (team_id, user_id, role, status, decided_by, decided_at)
  values (t.id, v_uid, 'captain', 'active', v_uid, now());
  perform app.audit('user', 'team.created', 'team', t.id);
  select * into t from public.teams where id = t.id;
  return t;
end $$;
revoke execute on function public.create_team(text, public.team_kind, text, text, text) from public, anon;
grant execute on function public.create_team(text, public.team_kind, text, text, text) to authenticated;

-- ================================================================ 2. team_projects
create table public.team_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null constraint team_projects_title_check check (char_length(btrim(title)) between 3 and 120),
  summary text constraint team_projects_summary_check check (char_length(summary) <= 600),
  year int constraint team_projects_year_check check (year between 2000 and 2100),
  -- https only, a host, no whitespace / control characters, ≤ 500 characters. Same pattern as the RPC's friendly check.
  url text constraint team_projects_url_check
    check (char_length(url) <= 500 and url ~ '^https://[^[:space:][:cntrl:]/?#]+([/?#][^[:space:][:cntrl:]]*)?$'),
  -- Covers for projects come later (see header): pinned to NULL until a migration opens it AND adds team_projects to
  -- app.cover_object_in_use.
  cover_path text constraint team_projects_cover_closed check (cover_path is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index team_projects_team_idx on public.team_projects (team_id, year desc nulls last, created_at desc);
create trigger team_projects_touch before update on public.team_projects
  for each row execute function app.touch_updated_at();

alter table public.team_projects enable row level security;
-- Read = the team is visible to the caller (the teams rule): active → everyone; suspended → its active members and admins.
create policy team_projects_public_read on public.team_projects for select to anon, authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.moderation_status = 'active'));
create policy team_projects_member_read on public.team_projects for select to authenticated
  using (app.is_team_member(team_id) or app.is_platform_admin());
-- Writes: upsert_team_project / delete_team_project only. No client write grant at all (not even under RLS).
revoke all on public.team_projects from anon, authenticated;
grant select on public.team_projects to anon, authenticated;

create or replace function public.upsert_team_project(
  p_team_id uuid, p_project_id uuid, p_title text, p_summary text, p_year int, p_url text
) returns public.team_projects
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  r public.team_projects;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  -- Unknown team and "not your team" get the same answer (checked before any lock is taken).
  if not (app.is_team_manager(p_team_id) or app.is_platform_admin())
     or not exists (select 1 from public.teams t where t.id = p_team_id) then
    perform app.fail(403, 'team_manage_forbidden');
  end if;
  select t.organization_id into v_org from public.teams t where t.id = p_team_id for update; -- serialises the project limit
  if char_length(v_title) not between 3 and 120 then perform app.fail(422, 'team_project_title_invalid'); end if;
  if char_length(v_summary) > 600 then perform app.fail(422, 'team_project_summary_too_long'); end if;
  if p_year is not null and p_year not between 2000 and 2100 then perform app.fail(422, 'team_project_year_invalid'); end if;
  if v_url is not null and (char_length(v_url) > 500
       or v_url !~ '^https://[^[:space:][:cntrl:]/?#]+([/?#][^[:space:][:cntrl:]]*)?$') then
    perform app.fail(422, 'team_project_url_invalid');
  end if;

  if p_project_id is null then
    if (select count(*) from public.team_projects where team_id = p_team_id) >= 50 then
      perform app.fail(429, 'team_project_limit');
    end if;
    insert into public.team_projects (team_id, title, summary, year, url)
    values (p_team_id, v_title, v_summary, p_year, v_url) returning * into r;
    perform app.audit('user', 'team.project_created', 'team_project', r.id, v_org, jsonb_build_object('team_id', p_team_id));
  else
    -- the project must belong to THIS team (a project is never moved between teams)
    update public.team_projects set title = v_title, summary = v_summary, year = p_year, url = v_url
     where id = p_project_id and team_id = p_team_id returning * into r;
    if not found then perform app.fail(404, 'team_project_not_found'); end if;
    perform app.audit('user', 'team.project_updated', 'team_project', r.id, v_org, jsonb_build_object('team_id', p_team_id));
  end if;
  return r;
end $$;

create or replace function public.delete_team_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); r public.team_projects; v_org uuid;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into r from public.team_projects where id = p_project_id for update;
  if not found then perform app.fail(404, 'team_project_not_found'); end if;
  if not (app.is_team_manager(r.team_id) or app.is_platform_admin()) then perform app.fail(403, 'team_manage_forbidden'); end if;
  select t.organization_id into v_org from public.teams t where t.id = r.team_id;
  delete from public.team_projects where id = r.id;
  -- ids only (actor, project, team, organisation): no title, no text
  perform app.audit('user', 'team.project_deleted', 'team_project', r.id, v_org, jsonb_build_object('team_id', r.team_id));
end $$;

revoke execute on function public.upsert_team_project(uuid, uuid, text, text, int, text), public.delete_team_project(uuid)
  from public, anon;
grant execute on function public.upsert_team_project(uuid, uuid, text, text, int, text), public.delete_team_project(uuid)
  to authenticated;

-- ================================================================ 3. team_public_profile
-- Shape: { member_count, role_counts: {captain, mentor, member}, leaders: [{display_name, role}], projects_count, events: [] }.
-- Counts are ACTIVE memberships only (pending / rejected / left / removed are not members). leaders: active captains and
-- mentors, 18+ (app.age_years; NULL = unknown = not adult) AND discoverable AND onboarded with a display name; ordered by
-- role (captain, mentor) then display name (membership id breaks ties; it is never returned). Same answer for every caller
-- who may see the team — members read names through team_roster(), not here.
create or replace function public.team_public_profile(p_team_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_status text; v_out jsonb;
begin
  select t.moderation_status into v_status from public.teams t where t.id = p_team_id;
  if not found or (v_status <> 'active' and not (app.is_team_member(p_team_id) or app.is_platform_admin())) then
    perform app.fail(404, 'team_not_found');
  end if;

  select jsonb_build_object(
    'member_count', (select count(*) from public.team_memberships m where m.team_id = p_team_id and m.status = 'active'),
    'role_counts', jsonb_build_object(
      'captain', (select count(*) from public.team_memberships m where m.team_id = p_team_id and m.status = 'active' and m.role = 'captain'),
      'mentor', (select count(*) from public.team_memberships m where m.team_id = p_team_id and m.status = 'active' and m.role = 'mentor'),
      'member', (select count(*) from public.team_memberships m where m.team_id = p_team_id and m.status = 'active' and m.role = 'member')),
    'leaders', coalesce((
      select jsonb_agg(jsonb_build_object('display_name', p.display_name, 'role', m.role) order by m.role, p.display_name, m.id)
      from public.team_memberships m join public.profiles p on p.id = m.user_id
      where m.team_id = p_team_id and m.status = 'active' and m.role in ('captain', 'mentor')
        and p.discoverable and p.onboarded_at is not null and p.display_name is not null
        and coalesce(app.age_years(m.user_id), 0) >= 18), '[]'::jsonb),
    'projects_count', (select count(*) from public.team_projects tp where tp.team_id = p_team_id),
    'events', '[]'::jsonb  -- Faz 3a (team registration) not built yet; see header
  ) into v_out;
  return v_out;
end $$;
revoke execute on function public.team_public_profile(uuid) from public;
grant execute on function public.team_public_profile(uuid) to anon, authenticated;

-- ================================================================ 4. reports: a project can be reported
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check (target_type in
  ('event', 'opportunity', 'team', 'organization', 'profile', 'experience', 'recruitment_post', 'course', 'team_project'));
