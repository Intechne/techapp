-- TechApp · 0011  team titles + task priority, shareable verified CV, attestation requester names, reviewer access to evidence files.

-- ================================================================ TEAMS: titles ("Mekanik lideri") next to the permission role
-- The role (captain / mentor / member) decides what a member may do. The title only describes what they do; it grants nothing.
alter table public.team_memberships add column if not exists title text check (char_length(title) <= 60);

create or replace function public.set_team_member_title(p_membership_id uuid, p_title text) returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m public.team_memberships;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into m from public.team_memberships where id = p_membership_id for update;
  if not found or not app.is_team_manager(m.team_id) then perform app.fail(403, 'team_manage_forbidden'); end if;
  if m.status <> 'active' then perform app.fail(409, 'membership_not_active'); end if;
  if char_length(btrim(coalesce(p_title, ''))) > 60 then perform app.fail(422, 'title_too_long'); end if;
  update public.team_memberships set title = nullif(btrim(p_title), '') where id = m.id returning * into m;
  perform app.audit('user', 'team.title_changed', 'team_membership', m.id);
  return m;
end $$;

-- The return type gains a column, so the function is recreated rather than replaced.
drop function if exists public.team_roster(uuid);
create function public.team_roster(p_team_id uuid)
returns table (membership_id uuid, user_id uuid, display_name text, role public.team_role, status public.membership_status, message text, title text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  if not app.is_team_member(p_team_id) then perform app.fail(403, 'team_members_only'); end if;
  return query
    select m.id, m.user_id, p.display_name, m.role, m.status,
           case when app.is_team_manager(p_team_id) then m.message end, m.title
    from public.team_memberships m join public.profiles p on p.id = m.user_id
    where m.team_id = p_team_id
      and (m.status = 'active' or (m.status = 'pending' and app.is_team_manager(p_team_id)))
    order by m.status, m.role, p.display_name;
end $$;

create type public.task_priority as enum ('low', 'normal', 'high');
alter table public.team_tasks add column if not exists priority public.task_priority not null default 'normal';

-- ================================================================ CV: one document builder, a private and a public reading
-- Sharing is opt-in, by an unguessable link the owner can turn off. The public reading leaves out drafts, private entries,
-- every identifier, and any attestation that is not currently valid (those entries read as the owner's own declaration).
alter table public.profile_private add column if not exists cv_share_token text unique check (char_length(cv_share_token) >= 32);

create or replace function app.cv_document(p_user uuid, p_public boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select case when p_public
                  then jsonb_build_object('display_name', p.display_name, 'headline', p.headline, 'bio', p.bio, 'city', p.city,
                                          'education_stage', p.education_stage, 'skills', p.skills)
                  else to_jsonb(p) - 'avatar_path' end
                from public.profiles p where p.id = p_user),
    'interests', coalesce((select jsonb_agg(i.label_tr order by i.sort_order) from public.profile_interests pi
                           join public.interests i on i.id = pi.interest_id where pi.user_id = p_user), '[]'::jsonb),
    'experiences', coalesce((
      select jsonb_agg(
        jsonb_build_object('kind', x.kind, 'title', x.title, 'role', x.role, 'contribution', x.contribution, 'organization_name', x.organization_name,
                           'link_url', x.link_url, 'started_on', x.started_on, 'ended_on', x.ended_on)
        || case when p_public then '{}'::jsonb else jsonb_build_object('id', x.id, 'status', x.status, 'visibility', x.visibility) end
        || jsonb_build_object('attestation', (
             select jsonb_build_object('status', a.status, 'scope', a.scope, 'source', a.source, 'decided_at', a.decided_at, 'valid_until', a.valid_until,
                                       'organization', (select name from public.organizations o where o.id = a.organization_id))
                    || case when p_public then '{}'::jsonb else jsonb_build_object('id', a.id, 'decision_note', a.decision_note) end
             from public.attestations a
             where a.experience_id = x.id
               and (not p_public or (a.status = 'verified' and (a.valid_until is null or a.valid_until > now())))
             order by (a.status = 'verified') desc, a.requested_at desc limit 1))
        order by coalesce(x.ended_on, x.started_on, x.created_at::date) desc)
      from public.experiences x
      where x.user_id = p_user and (not p_public or (x.status = 'published' and x.visibility = 'profile'))), '[]'::jsonb),
    'participations', coalesce((
      select jsonb_agg(jsonb_build_object('title', e.title, 'type', e.type, 'starts_at', e.starts_at,
                                          'organizer', (select name from public.organizations o where o.id = e.organization_id),
                                          'checked_in_at', ci.first_at)
                       || case when p_public then '{}'::jsonb else jsonb_build_object('event_id', e.id) end order by e.starts_at desc)
      from public.event_registrations r join public.events e on e.id = r.event_id
      join lateral (select min(c.created_at) first_at from public.event_check_ins c where c.registration_id = r.id) ci on ci.first_at is not null
      where r.user_id = p_user), '[]'::jsonb),
    'volunteering', coalesce((
      select jsonb_agg(jsonb_build_object('title', e.title, 'starts_at', e.starts_at, 'duty', v.duty,
                                          'organizer', (select name from public.organizations o where o.id = e.organization_id))
                       || case when p_public then '{}'::jsonb else jsonb_build_object('event_id', e.id) end order by e.starts_at desc)
      from public.event_volunteers v join public.events e on e.id = v.event_id
      where v.user_id = p_user and v.status = 'approved' and e.ends_at < now()), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'kind', t.kind, 'role', m.role, 'title', m.title, 'since', m.decided_at)
                       || case when p_public then '{}'::jsonb else jsonb_build_object('team_id', t.id) end order by m.decided_at desc)
      from public.team_memberships m join public.teams t on t.id = m.team_id where m.user_id = p_user and m.status = 'active'), '[]'::jsonb));
$$;
revoke execute on function app.cv_document(uuid, boolean) from public, anon, authenticated;

create or replace function public.my_cv() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  return app.cv_document(v_uid, false)
    || jsonb_build_object('share_token', (select pp.cv_share_token from public.profile_private pp where pp.user_id = v_uid));
end $$;

-- Turning sharing on again always issues a NEW link: an old link stays dead once it was switched off.
-- Adults only until the legal review decides how (and whether) a minor's CV may be shared outside the app.
create or replace function public.set_cv_sharing(p_enabled boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_token text;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_enabled then
    if coalesce(app.age_years(v_uid), 0) < 18 then perform app.fail(403, 'cv_sharing_adults_only'); end if;
    v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  end if;
  update public.profile_private set cv_share_token = v_token where user_id = v_uid;
  if not found then perform app.fail(409, 'profile_incomplete'); end if;
  perform app.audit('user', case when p_enabled then 'cv.sharing_enabled' else 'cv.sharing_disabled' end, 'profile', v_uid);
  return v_token;
end $$;

-- Unknown, malformed and switched-off links give the same answer.
create or replace function public.public_cv(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid;
begin
  if p_token is null or char_length(p_token) < 32 then perform app.fail(404, 'cv_not_found'); end if;
  select pp.user_id into v_user from public.profile_private pp where pp.cv_share_token = p_token;
  if v_user is null then perform app.fail(404, 'cv_not_found'); end if;
  return app.cv_document(v_user, true);
end $$;

-- ================================================================ ATTESTATIONS: who is asking
-- A reviewer has to know whose experience they are putting the organisation's name under. Name only: no contact data, no age.
create or replace function public.admin_attestation_requesters()
returns table (attestation_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select a.id, p.display_name
  from public.attestations a join public.profiles p on p.id = a.requested_by
  where app.has_org_role(a.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]);
$$;

-- ================================================================ grants
revoke execute on function
  public.set_team_member_title(uuid, text), public.team_roster(uuid), public.my_cv(), public.set_cv_sharing(boolean),
  public.public_cv(text), public.admin_attestation_requesters()
from public, anon;
grant execute on function
  public.set_team_member_title(uuid, text), public.team_roster(uuid), public.my_cv(), public.set_cv_sharing(boolean),
  public.admin_attestation_requesters()
to authenticated;
grant execute on function public.public_cv(text) to anon, authenticated;

-- ================================================================ STORAGE: reviewers of a live request may open its evidence files
-- (signed URLs are created with the reviewer's own session). No-op in the automated test database, which has no `storage` schema.
do $$
begin
  if to_regnamespace('storage') is null then return; end if;
  execute $sql$
    create policy evidence_reviewer_select on storage.objects for select to authenticated
      using (bucket_id = 'evidence' and exists (
        select 1 from public.experience_evidence ev
        where ev.storage_path = name and app.can_review_experience(ev.experience_id)))
  $sql$;
end $$;
