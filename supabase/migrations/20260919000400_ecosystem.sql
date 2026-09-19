-- TechApp · 0004 ecosystem: teams, recruitment, opportunities + applications, experiences +
-- attestations, learning, bookmarks, notifications, devices, reports and moderation.
-- Same rules as 0002: authority-bearing state changes only through SECURITY DEFINER RPCs,
-- RLS lives next to the table, clients never decide roles, statuses or verification.

create type public.team_kind as enum ('team', 'community');
create type public.team_role as enum ('captain', 'mentor', 'member');
create type public.membership_status as enum ('pending', 'active', 'rejected', 'left', 'removed');
create type public.task_status as enum ('todo', 'doing', 'done');
create type public.recruitment_application_status as enum ('submitted', 'accepted', 'rejected', 'withdrawn');
create type public.opportunity_type as enum
  ('internship', 'volunteering', 'entrepreneurship', 'talent_program', 'project_call');
create type public.application_status as enum
  ('draft', 'submitted', 'in_review', 'info_requested', 'accepted', 'declined', 'withdrawn', 'closed');
create type public.experience_kind as enum
  ('project', 'competition', 'volunteering', 'work', 'education', 'event_participation', 'other');
create type public.attestation_status as enum
  ('requested', 'verified', 'changes_requested', 'rejected', 'revoked');
create type public.push_provider as enum ('apns', 'fcm', 'hms');

-- ================================================================ TEAMS
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  name text not null check (char_length(name) between 2 and 80),
  kind public.team_kind not null default 'team',
  category text check (char_length(category) <= 60),
  tagline text check (char_length(tagline) <= 160),
  about text check (char_length(about) <= 3000),
  city text check (char_length(city) <= 60),
  topic_interest_id smallint references public.interests (id),
  tone text not null default 'moss' check (tone in ('iris', 'moss', 'apricot', 'ink')),
  accepts_join_requests boolean not null default true,
  moderation_status text not null default 'active' check (moderation_status in ('active', 'suspended')),
  member_count int not null default 0,
  is_demo boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_kind_idx on public.teams (kind, moderation_status, name);
create trigger teams_touch before update on public.teams
  for each row execute function app.touch_updated_at();

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.team_role not null default 'member',
  status public.membership_status not null default 'pending',
  message text check (char_length(message) <= 500),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live (pending or active) membership per person per team; history rows are kept.
create unique index team_memberships_one_live on public.team_memberships (team_id, user_id)
  where status in ('pending', 'active');
create index team_memberships_user_idx on public.team_memberships (user_id, status);
create index team_memberships_team_idx on public.team_memberships (team_id, status);
create trigger team_memberships_touch before update on public.team_memberships
  for each row execute function app.touch_updated_at();

alter table public.event_registrations
  add constraint event_registrations_team_fk foreign key (team_id) references public.teams (id) on delete set null;

create or replace function app.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_memberships m
                 where m.team_id = p_team and m.user_id = (select auth.uid()) and m.status = 'active');
$$;
create or replace function app.is_team_manager(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_memberships m
                 where m.team_id = p_team and m.user_id = (select auth.uid())
                   and m.status = 'active' and m.role in ('captain', 'mentor'));
$$;
create or replace function app.is_team_captain(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_memberships m
                 where m.team_id = p_team and m.user_id = (select auth.uid())
                   and m.status = 'active' and m.role = 'captain');
$$;

create or replace function app.team_memberships_recount() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_team uuid := coalesce(new.team_id, old.team_id);
begin
  perform set_config('app.counter_write', 'on', true);
  update public.teams t set member_count =
    (select count(*) from public.team_memberships m where m.team_id = v_team and m.status = 'active')
  where t.id = v_team;
  perform set_config('app.counter_write', 'off', true);
  return null;
end $$;
create trigger team_memberships_recount after insert or update of status or delete
  on public.team_memberships for each row execute function app.team_memberships_recount();

create or replace function app.protect_team_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if new.member_count <> old.member_count
     and coalesce(current_setting('app.counter_write', true), '') <> 'on' then
    perform app.fail(403, 'team_counters_locked');
  end if;
  if not app.is_platform_admin()
     and (new.is_demo <> old.is_demo or new.moderation_status <> old.moderation_status
          or new.organization_id is distinct from old.organization_id
          or new.created_by is distinct from old.created_by) then
    perform app.fail(403, 'team_field_locked');
  end if;
  return new;
end $$;
create trigger teams_protect before update on public.teams
  for each row execute function app.protect_team_columns();

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;

create policy teams_public_read on public.teams for select to anon, authenticated
  using (moderation_status = 'active');
create policy teams_member_read on public.teams for select to authenticated
  using (app.is_team_member(id) or app.is_platform_admin());
create policy teams_manager_update on public.teams for update to authenticated
  using (app.is_team_manager(id) or app.is_platform_admin())
  with check (app.is_team_manager(id) or app.is_platform_admin());
-- insert: create_team RPC only. delete: not available to clients.

-- Memberships: a person sees their own rows; active members see the active roster ids;
-- managers additionally see pending requests. All writes go through RPCs.
create policy team_memberships_select_own on public.team_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy team_memberships_select_team on public.team_memberships for select to authenticated
  using ((status = 'active' and app.is_team_member(team_id)) or app.is_team_manager(team_id));

-- ---------------------------------------------------------------- team tasks
create table public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  description text check (char_length(description) <= 2000),
  status public.task_status not null default 'todo',
  assignee_id uuid references auth.users (id) on delete set null,
  due_date date,
  created_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index team_tasks_team_idx on public.team_tasks (team_id, status, due_date);
create index team_tasks_assignee_idx on public.team_tasks (assignee_id) where assignee_id is not null;
create trigger team_tasks_touch before update on public.team_tasks
  for each row execute function app.touch_updated_at();

create or replace function app.protect_team_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then perform app.fail(403, 'task_team_locked'); end if;
  if new.assignee_id is not null and not exists (
       select 1 from public.team_memberships m
       where m.team_id = new.team_id and m.user_id = new.assignee_id and m.status = 'active') then
    perform app.fail(422, 'assignee_not_team_member');
  end if;
  if tg_op = 'INSERT' then new.created_by := coalesce((select auth.uid()), new.created_by); end if;
  new.completed_at := case when new.status = 'done'
                           then coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now()) end;
  return new;
end $$;
create trigger team_tasks_protect before insert or update on public.team_tasks
  for each row execute function app.protect_team_task();

alter table public.team_tasks enable row level security;
create policy team_tasks_member_read on public.team_tasks for select to authenticated
  using (app.is_team_member(team_id));
create policy team_tasks_manager_insert on public.team_tasks for insert to authenticated
  with check (app.is_team_manager(team_id));
create policy team_tasks_manager_update on public.team_tasks for update to authenticated
  using (app.is_team_manager(team_id)) with check (app.is_team_manager(team_id));
create policy team_tasks_manager_delete on public.team_tasks for delete to authenticated
  using (app.is_team_manager(team_id));
-- Plain members move their own task through set_team_task_status().

-- ---------------------------------------------------------------- recruitment
create table public.recruitment_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  role_label text check (char_length(role_label) <= 60),
  description text check (char_length(description) <= 2000),
  skills text[] not null default '{}' check (coalesce(array_length(skills, 1), 0) <= 12),
  is_open boolean not null default true,
  closes_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recruitment_posts_team_idx on public.recruitment_posts (team_id, is_open);
create trigger recruitment_posts_touch before update on public.recruitment_posts
  for each row execute function app.touch_updated_at();

create table public.recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.recruitment_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text check (char_length(message) <= 1000),
  status public.recruitment_application_status not null default 'submitted',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index recruitment_applications_one_live on public.recruitment_applications (post_id, user_id)
  where status = 'submitted';
create index recruitment_applications_user_idx on public.recruitment_applications (user_id, created_at desc);
create trigger recruitment_applications_touch before update on public.recruitment_applications
  for each row execute function app.touch_updated_at();

alter table public.recruitment_posts enable row level security;
alter table public.recruitment_applications enable row level security;

create policy recruitment_posts_public_read on public.recruitment_posts for select to anon, authenticated
  using (is_open and (closes_at is null or closes_at > now())
         and exists (select 1 from public.teams t where t.id = team_id and t.moderation_status = 'active'));
create policy recruitment_posts_member_read on public.recruitment_posts for select to authenticated
  using (app.is_team_member(team_id));
create policy recruitment_posts_manager_insert on public.recruitment_posts for insert to authenticated
  with check (app.is_team_manager(team_id));
create policy recruitment_posts_manager_update on public.recruitment_posts for update to authenticated
  using (app.is_team_manager(team_id)) with check (app.is_team_manager(team_id));
create policy recruitment_posts_manager_delete on public.recruitment_posts for delete to authenticated
  using (app.is_team_manager(team_id));

create policy recruitment_applications_select_own on public.recruitment_applications for select to authenticated
  using (user_id = (select auth.uid()));
create policy recruitment_applications_select_managers on public.recruitment_applications for select to authenticated
  using (exists (select 1 from public.recruitment_posts p where p.id = post_id and app.is_team_manager(p.team_id)));

-- ================================================================ OPPORTUNITIES
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 4 and 120),
  summary text not null check (char_length(summary) <= 280),
  description text check (char_length(description) <= 6000),
  type public.opportunity_type not null,
  topic_interest_id smallint references public.interests (id),
  tone text not null default 'iris' check (tone in ('iris', 'moss', 'apricot', 'ink')),
  city text check (char_length(city) <= 60),
  is_remote boolean not null default false,
  audience_note text check (char_length(audience_note) <= 120),
  skills text[] not null default '{}' check (coalesce(array_length(skills, 1), 0) <= 12),
  min_age int check (min_age between 0 and 120),
  max_age int check (max_age between 0 and 120),
  -- Guardian consent for applications is not implemented yet: applicants younger than this
  -- age are refused by submit_application(). NULL = the organisation accepts minors directly.
  guardian_required_under int default 18 check (guardian_required_under between 0 and 21),
  opens_at timestamptz,
  closes_at timestamptz not null,
  -- Exactly which profile fields the applicant shares with the organisation.
  shared_fields text[] not null default array['display_name', 'education_stage']
    check (shared_fields <@ array['display_name', 'legal_name', 'email', 'phone', 'city', 'education_stage',
                                  'school_name', 'headline', 'bio', 'birth_year', 'interests', 'experiences']),
  status public.publish_status not null default 'draft',
  published_at timestamptz,
  approved_by uuid references auth.users (id),
  is_demo boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_age is null or max_age is null or min_age <= max_age)
);
create index opportunities_feed_idx on public.opportunities (status, closes_at, id);
create index opportunities_org_idx on public.opportunities (organization_id);
create trigger opportunities_touch before update on public.opportunities
  for each row execute function app.touch_updated_at();

-- Shared by opportunities and courses: publishing is an Intechne approval; tenant is fixed.
create or replace function app.protect_publishable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_api_user boolean := (select auth.uid()) is not null;
begin
  if new.organization_id is distinct from old.organization_id then perform app.fail(403, 'tenant_locked'); end if;
  if v_api_user and not app.is_platform_admin() then
    if new.status = 'published' and old.status <> 'published' then
      perform app.fail(403, 'publish_requires_platform_approval');
    end if;
    if new.is_demo <> old.is_demo or new.approved_by is distinct from old.approved_by then
      perform app.fail(403, 'field_locked');
    end if;
  end if;
  if new.status = 'published' and old.status <> 'published' then
    new.published_at := now();
    new.approved_by := coalesce((select auth.uid()), new.approved_by);
  end if;
  return new;
end $$;
create trigger opportunities_protect before update on public.opportunities
  for each row execute function app.protect_publishable();

alter table public.opportunities enable row level security;
create policy opportunities_public_read on public.opportunities for select to anon, authenticated
  using (status = 'published');
create policy opportunities_org_read on public.opportunities for select to authenticated
  using (app.is_org_member(organization_id) or app.is_platform_admin());
create policy opportunities_org_insert on public.opportunities for insert to authenticated
  with check (app.has_org_role(organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])
              and status in ('draft', 'in_review'));
create policy opportunities_org_update on public.opportunities for update to authenticated
  using (app.has_org_role(organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])
         or app.is_platform_admin())
  with check (app.has_org_role(organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])
              or app.is_platform_admin());
create policy opportunities_org_delete on public.opportunities for delete to authenticated
  using (status = 'draft'
         and app.has_org_role(organization_id, array['owner', 'admin']::public.org_member_role[]));

-- ---------------------------------------------------------------- applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.application_status not null,
  motivation text check (char_length(motivation) <= 2000),
  -- What the organisation receives: frozen at submission, limited to shared_fields.
  shared_fields text[] not null default '{}',
  snapshot jsonb not null default '{}'::jsonb check (pg_column_size(snapshot) < 32768),
  idempotency_key uuid not null,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
-- One live application per person per opportunity; only a withdrawn one may be replaced.
create unique index applications_one_live on public.applications (opportunity_id, user_id)
  where status <> 'withdrawn';
create index applications_user_idx on public.applications (user_id, created_at desc);
create index applications_opportunity_idx on public.applications (opportunity_id, status, created_at);
create trigger applications_touch before update on public.applications
  for each row execute function app.touch_updated_at();

create or replace function app.protect_application_snapshot() returns trigger
language plpgsql as $$
begin
  if old.submitted_at is not null
     and (new.snapshot is distinct from old.snapshot or new.shared_fields is distinct from old.shared_fields
          or new.motivation is distinct from old.motivation or new.user_id <> old.user_id
          or new.opportunity_id <> old.opportunity_id or new.submitted_at is distinct from old.submitted_at) then
    raise exception using errcode = 'PT409', message = 'application_snapshot_immutable';
  end if;
  return new;
end $$;
create trigger applications_protect before update on public.applications
  for each row execute function app.protect_application_snapshot();

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  actor_kind text not null check (actor_kind in ('applicant', 'organization', 'system')),
  changed_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 500), -- applicant-facing
  created_at timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history (application_id, created_at);

create or replace function app.can_review_application(p_application uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
    where a.id = p_application and a.status <> 'draft'
      and app.has_org_role(o.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]));
$$;

alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;

create policy applications_select_own on public.applications for select to authenticated
  using (user_id = (select auth.uid()));
-- The organisation sees applications to ITS opportunities only, and only the frozen snapshot:
-- there is no policy anywhere that lets an organisation read profiles/profile_private of applicants.
create policy applications_select_org on public.applications for select to authenticated
  using (app.can_review_application(id));
create policy application_history_select_own on public.application_status_history for select to authenticated
  using (exists (select 1 from public.applications a
                 where a.id = application_id and a.user_id = (select auth.uid())));
create policy application_history_select_org on public.application_status_history for select to authenticated
  using (app.can_review_application(application_id));

-- ================================================================ EXPERIENCES + ATTESTATIONS
create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.experience_kind not null default 'project',
  title text not null check (char_length(title) between 3 and 140),
  role text check (char_length(role) <= 80),
  contribution text check (char_length(contribution) <= 2000),
  organization_name text check (char_length(organization_name) <= 120),
  link_url text check (link_url ~ '^https://'),
  started_on date,
  ended_on date,
  status text not null default 'draft' check (status in ('draft', 'published')),
  visibility text not null default 'private' check (visibility in ('private', 'profile')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (started_on is null or ended_on is null or started_on <= ended_on)
);
create index experiences_user_idx on public.experiences (user_id, created_at desc);
create trigger experiences_touch before update on public.experiences
  for each row execute function app.touch_updated_at();

create table public.experience_evidence (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 400), -- bucket "evidence", <uid>/...
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  caption text check (char_length(caption) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index experience_evidence_exp_idx on public.experience_evidence (experience_id);
create trigger experience_evidence_touch before update on public.experience_evidence
  for each row execute function app.touch_updated_at();

-- The attestation is a separate record: who verified what, when, from which source, for which scope.
create table public.attestations (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  status public.attestation_status not null default 'requested',
  scope text check (char_length(scope) <= 300),          -- e.g. "Etkinliğe katıldı" vs "Yazılım ekibinde görev aldı"
  source text check (char_length(source) <= 120),         -- e.g. "organizatör katılım kaydı"
  requested_by uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 500),
  valid_until timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text check (char_length(revoke_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index attestations_one_live on public.attestations (experience_id, organization_id)
  where status in ('requested', 'verified', 'changes_requested');
create index attestations_org_idx on public.attestations (organization_id, status, requested_at);
create trigger attestations_touch before update on public.attestations
  for each row execute function app.touch_updated_at();

-- SECURITY DEFINER helpers break the policy cycle experiences <-> attestations.
create or replace function app.owns_experience(p_experience uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.experiences e where e.id = p_experience and e.user_id = (select auth.uid()));
$$;
create or replace function app.can_review_experience(p_experience uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.attestations a
    where a.experience_id = p_experience and a.status in ('requested', 'verified', 'changes_requested')
      and app.has_org_role(a.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]));
$$;
create or replace function app.experience_is_public(p_experience uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.experiences e join public.profiles p on p.id = e.user_id
    where e.id = p_experience and e.status = 'published' and e.visibility = 'profile'
      and p.discoverable and p.onboarded_at is not null);
$$;

-- Editing the substance of a verified experience invalidates the verification.
create or replace function app.experience_edit_revokes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id <> old.user_id then perform app.fail(403, 'experience_owner_locked'); end if;
  if (new.title, new.role, new.contribution, new.organization_name, new.started_on, new.ended_on, new.kind)
     is distinct from
     (old.title, old.role, old.contribution, old.organization_name, old.started_on, old.ended_on, old.kind) then
    update public.attestations
       set status = 'revoked', revoked_at = now(), revoke_reason = 'experience_edited'
     where experience_id = old.id and status = 'verified';
  end if;
  return new;
end $$;
create trigger experiences_edit_revokes before update on public.experiences
  for each row execute function app.experience_edit_revokes();

alter table public.experiences enable row level security;
alter table public.experience_evidence enable row level security;
alter table public.attestations enable row level security;

create policy experiences_owner_all on public.experiences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy experiences_public_read on public.experiences for select to authenticated
  using (app.experience_is_public(id));
create policy experiences_reviewer_read on public.experiences for select to authenticated
  using (status = 'published' and app.can_review_experience(id));

-- Evidence is never public: the owner, and reviewers of a live attestation request, only.
create policy experience_evidence_owner_all on public.experience_evidence for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and app.owns_experience(experience_id)
              and storage_path like ((select auth.uid())::text || '/%'));
create policy experience_evidence_reviewer_read on public.experience_evidence for select to authenticated
  using (app.can_review_experience(experience_id));

create policy attestations_owner_read on public.attestations for select to authenticated
  using (app.owns_experience(experience_id));
create policy attestations_org_read on public.attestations for select to authenticated
  using (app.has_org_role(organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]));
create policy attestations_public_read on public.attestations for select to authenticated
  using (status = 'verified' and app.experience_is_public(experience_id));

-- "Kendi beyanı" vs "Doğrulanmış": derived, never stored on the experience.
create view public.experiences_with_status with (security_invoker = true) as
  select e.*,
         exists (select 1 from public.attestations a
                 where a.experience_id = e.id and a.status = 'verified'
                   and (a.valid_until is null or a.valid_until > now())) as is_verified
  from public.experiences e;
grant select on public.experiences_with_status to authenticated;

-- ================================================================ LEARNING
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete restrict, -- NULL = TechApp editorial
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 4 and 120),
  poster_line text check (char_length(poster_line) <= 80),
  summary text not null check (char_length(summary) <= 280),
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  topic_interest_id smallint references public.interests (id),
  tone text not null default 'moss' check (tone in ('iris', 'moss', 'apricot', 'ink')),
  estimated_minutes int check (estimated_minutes between 1 and 6000),
  lesson_count int not null default 0,
  status public.publish_status not null default 'draft',
  published_at timestamptz,
  approved_by uuid references auth.users (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger courses_touch before update on public.courses
  for each row execute function app.touch_updated_at();
create trigger courses_protect before update on public.courses
  for each row execute function app.protect_publishable();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  body text not null check (char_length(body) <= 12000),
  sort_order int not null,
  estimated_minutes int check (estimated_minutes between 1 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, sort_order)
);
create trigger lessons_touch before update on public.lessons
  for each row execute function app.touch_updated_at();

-- "Bu etkinliğe hazırlan": which courses prepare for which event.
create table public.event_courses (
  event_id uuid not null references public.events (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, course_id)
);

create table public.course_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed_lesson_ids uuid[] not null default '{}',
  percent int not null default 0 check (percent between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create trigger course_progress_touch before update on public.course_progress
  for each row execute function app.touch_updated_at();

create or replace function app.lessons_recount() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_course uuid := coalesce(new.course_id, old.course_id);
begin
  update public.courses c set lesson_count = (select count(*) from public.lessons l where l.course_id = v_course)
   where c.id = v_course;
  return null;
end $$;
create trigger lessons_recount after insert or delete on public.lessons
  for each row execute function app.lessons_recount();

create or replace function app.can_edit_course(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_platform_admin() or exists (
    select 1 from public.courses c where c.id = p_course and c.organization_id is not null
      and app.has_org_role(c.organization_id, array['owner', 'admin', 'editor']::public.org_member_role[]));
$$;

alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.event_courses enable row level security;
alter table public.course_progress enable row level security;

create policy courses_public_read on public.courses for select to anon, authenticated
  using (status = 'published');
create policy courses_editor_read on public.courses for select to authenticated
  using (app.can_edit_course(id));
create policy courses_editor_insert on public.courses for insert to authenticated
  with check (status in ('draft', 'in_review')
              and (app.is_platform_admin()
                   or (organization_id is not null
                       and app.has_org_role(organization_id, array['owner', 'admin', 'editor']::public.org_member_role[]))));
create policy courses_editor_update on public.courses for update to authenticated
  using (app.can_edit_course(id)) with check (app.can_edit_course(id));

create policy lessons_read on public.lessons for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
         or app.can_edit_course(course_id));
create policy lessons_editor_write on public.lessons for all to authenticated
  using (app.can_edit_course(course_id)) with check (app.can_edit_course(course_id));

create policy event_courses_read on public.event_courses for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published')
         and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));
create policy event_courses_manage on public.event_courses for all to authenticated
  using (app.is_platform_admin() or exists (select 1 from public.events e where e.id = event_id
           and app.has_org_role(e.organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])))
  with check (app.is_platform_admin() or exists (select 1 from public.events e where e.id = event_id
           and app.has_org_role(e.organization_id, array['owner', 'admin', 'editor']::public.org_member_role[])));

create policy course_progress_select_own on public.course_progress for select to authenticated
  using (user_id = (select auth.uid()));
-- writes: complete_lesson() only.

-- ================================================================ BOOKMARKS
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('event', 'opportunity', 'team', 'course', 'organization')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index bookmarks_user_idx on public.bookmarks (user_id, created_at desc);

create or replace function app.bookmark_target_exists() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  v_ok := case new.target_type
    when 'event' then exists (select 1 from public.events where id = new.target_id and status = 'published')
    when 'opportunity' then exists (select 1 from public.opportunities where id = new.target_id and status = 'published')
    when 'team' then exists (select 1 from public.teams where id = new.target_id and moderation_status = 'active')
    when 'course' then exists (select 1 from public.courses where id = new.target_id and status = 'published')
    when 'organization' then exists (select 1 from public.organizations where id = new.target_id and verification = 'verified')
    else false end;
  if not v_ok then perform app.fail(404, 'bookmark_target_not_found'); end if;
  return new;
end $$;
create trigger bookmarks_target_check before insert on public.bookmarks
  for each row execute function app.bookmark_target_exists();

alter table public.bookmarks enable row level security;
create policy bookmarks_select_own on public.bookmarks for select to authenticated
  using (user_id = (select auth.uid()));
create policy bookmarks_insert_own on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy bookmarks_delete_own on public.bookmarks for delete to authenticated
  using (user_id = (select auth.uid()));

-- ================================================================ NOTIFICATIONS + DEVICES
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_.]{3,60}$'),
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 400),
  target_type text,
  target_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc, id);
create trigger notifications_touch before update on public.notifications
  for each row execute function app.touch_updated_at();

create or replace function app.protect_notification() returns trigger
language plpgsql as $$
begin
  if (select auth.uid()) is not null
     and (new.user_id, new.kind, new.title, new.body, new.target_type, new.target_id, new.created_at)
         is distinct from (old.user_id, old.kind, old.title, old.body, old.target_type, old.target_id, old.created_at) then
    raise exception using errcode = 'PT403', message = 'notification_read_only';
  end if;
  return new;
end $$;
create trigger notifications_protect before update on public.notifications
  for each row execute function app.protect_notification();

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_mark_read_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- insert: service role / server functions only.

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_install_id text not null check (char_length(device_install_id) between 8 and 80),
  provider public.push_provider not null,
  push_token text not null unique check (char_length(push_token) between 8 and 4096),
  platform text not null check (platform in ('ios', 'android')),
  app_version text check (char_length(app_version) <= 40),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider = 'apns') = (platform = 'ios'))
);
-- One active provider per app install: a device never receives the same push twice (FCM + HMS).
create unique index devices_one_active_per_install on public.devices (device_install_id) where is_active;
create index devices_user_idx on public.devices (user_id) where is_active;
create trigger devices_touch before update on public.devices
  for each row execute function app.touch_updated_at();

alter table public.devices enable row level security;
create policy devices_select_own on public.devices for select to authenticated
  using (user_id = (select auth.uid()));
-- writes: register_device() / unregister_device() only.

-- ================================================================ REPORTS + MODERATION
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in
    ('event', 'opportunity', 'team', 'organization', 'profile', 'experience', 'recruitment_post', 'course')),
  target_id uuid not null,
  reason text not null check (reason in
    ('inappropriate', 'misleading', 'spam', 'safety', 'harassment', 'privacy', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index reports_one_open on public.reports (reporter_id, target_type, target_id) where status = 'open';
create index reports_queue_idx on public.reports (status, created_at);
create trigger reports_touch before update on public.reports
  for each row execute function app.touch_updated_at();

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  moderator_id uuid not null references auth.users (id) on delete restrict,
  action text not null check (action in
    ('dismiss', 'warn', 'hide_content', 'restore_content', 'suspend_team', 'restore_team', 'suspend_account')),
  target_type text not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id);

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and resolved_by is null and resolved_at is null);
create policy reports_select_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or app.is_platform_admin());
create policy reports_platform_update on public.reports for update to authenticated
  using (app.is_platform_admin()) with check (app.is_platform_admin());
create policy moderation_platform_read on public.moderation_actions for select to authenticated
  using (app.is_platform_admin());
create policy moderation_platform_insert on public.moderation_actions for insert to authenticated
  with check (app.is_platform_admin() and moderator_id = (select auth.uid()));

-- ================================================================ RPCs: teams
create or replace function public.create_team(
  p_name text, p_kind public.team_kind default 'team', p_category text default null, p_tagline text default null
) returns public.teams
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.teams; v_slug text;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if app.age_years(v_uid) is null then perform app.fail(409, 'profile_incomplete'); end if;
  if p_name is null or char_length(btrim(p_name)) < 2 then perform app.fail(422, 'team_name_invalid'); end if;
  if (select count(*) from public.teams where created_by = v_uid) >= 5 then
    perform app.fail(429, 'team_create_limit'); end if;
  v_slug := 'team-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.teams (slug, name, kind, category, tagline, created_by)
  values (v_slug, btrim(p_name), p_kind, nullif(btrim(p_category), ''), nullif(btrim(p_tagline), ''), v_uid)
  returning * into t;
  insert into public.team_memberships (team_id, user_id, role, status, decided_by, decided_at)
  values (t.id, v_uid, 'captain', 'active', v_uid, now());
  perform app.audit('user', 'team.created', 'team', t.id);
  select * into t from public.teams where id = t.id;
  return t;
end $$;

create or replace function public.request_team_join(p_team_id uuid, p_message text default null)
returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.teams; m public.team_memberships;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into t from public.teams where id = p_team_id and moderation_status = 'active' for update;
  if not found then perform app.fail(404, 'team_not_found'); end if;
  if app.age_years(v_uid) is null then perform app.fail(409, 'profile_incomplete'); end if;

  select * into m from public.team_memberships
   where team_id = t.id and user_id = v_uid and status in ('pending', 'active');
  if found then return m; end if; -- idempotent
  if not t.accepts_join_requests then perform app.fail(409, 'team_closed_to_requests'); end if;

  insert into public.team_memberships (team_id, user_id, role, status, message)
  values (t.id, v_uid, 'member', 'pending', nullif(left(btrim(p_message), 500), ''))
  returning * into m;
  perform app.audit('user', 'team.join_requested', 'team_membership', m.id, t.organization_id);
  return m;
end $$;

create or replace function public.withdraw_team_join(p_membership_id uuid) returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m public.team_memberships;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into m from public.team_memberships where id = p_membership_id and user_id = v_uid for update;
  if not found then perform app.fail(404, 'membership_not_found'); end if;
  if m.status <> 'pending' then perform app.fail(409, 'membership_not_pending'); end if;
  update public.team_memberships set status = 'left', decided_at = now() where id = m.id returning * into m;
  return m;
end $$;

create or replace function public.decide_team_join(p_membership_id uuid, p_accept boolean)
returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m public.team_memberships;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into m from public.team_memberships where id = p_membership_id for update;
  -- Same answer for "unknown" and "not yours": other teams' requests are not discoverable.
  if not found or not app.is_team_manager(m.team_id) then perform app.fail(403, 'team_manage_forbidden'); end if;
  if m.status <> 'pending' then perform app.fail(409, 'membership_not_pending'); end if;
  update public.team_memberships
     set status = case when p_accept then 'active' else 'rejected' end::public.membership_status,
         role = 'member', decided_by = v_uid, decided_at = now()
   where id = m.id returning * into m;
  perform app.audit('user', case when p_accept then 'team.join_accepted' else 'team.join_rejected' end,
                    'team_membership', m.id);
  return m;
end $$;

create or replace function public.set_team_member_role(p_membership_id uuid, p_role public.team_role)
returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m public.team_memberships; v_captains int;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into m from public.team_memberships where id = p_membership_id;
  if not found then perform app.fail(403, 'team_manage_forbidden'); end if;
  perform 1 from public.teams where id = m.team_id for update; -- serialise role changes per team
  select * into m from public.team_memberships where id = p_membership_id for update;
  if not app.is_team_captain(m.team_id) then perform app.fail(403, 'team_manage_forbidden'); end if;
  if m.user_id = v_uid then perform app.fail(403, 'cannot_change_own_role'); end if;
  if m.status <> 'active' then perform app.fail(409, 'membership_not_active'); end if;
  if m.role = 'captain' and p_role <> 'captain' then
    select count(*) into v_captains from public.team_memberships
     where team_id = m.team_id and status = 'active' and role = 'captain';
    if v_captains <= 1 then perform app.fail(409, 'last_captain'); end if;
  end if;
  update public.team_memberships set role = p_role, decided_by = v_uid, decided_at = now()
   where id = m.id returning * into m;
  perform app.audit('user', 'team.role_changed', 'team_membership', m.id, null, jsonb_build_object('role', p_role));
  return m;
end $$;

create or replace function public.remove_team_member(p_membership_id uuid) returns public.team_memberships
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m public.team_memberships;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
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

-- Roster with names: visible to active members of that team only (minors are never listed publicly).
create or replace function public.team_roster(p_team_id uuid)
returns table (membership_id uuid, user_id uuid, display_name text, role public.team_role, status public.membership_status, message text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  if not app.is_team_member(p_team_id) then perform app.fail(403, 'team_members_only'); end if;
  return query
    select m.id, m.user_id, p.display_name, m.role, m.status,
           case when app.is_team_manager(p_team_id) then m.message end
    from public.team_memberships m join public.profiles p on p.id = m.user_id
    where m.team_id = p_team_id
      and (m.status = 'active' or (m.status = 'pending' and app.is_team_manager(p_team_id)))
    order by m.status, m.role, p.display_name;
end $$;

create or replace function public.set_team_task_status(p_task_id uuid, p_status public.task_status)
returns public.team_tasks
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); t public.team_tasks;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into t from public.team_tasks where id = p_task_id for update;
  if not found or not app.is_team_member(t.team_id) then perform app.fail(404, 'task_not_found'); end if;
  if not (app.is_team_manager(t.team_id) or t.assignee_id = v_uid) then
    perform app.fail(403, 'task_forbidden'); end if;
  update public.team_tasks set status = p_status where id = t.id returning * into t;
  return t;
end $$;

create or replace function public.apply_to_recruitment(p_post_id uuid, p_message text default null)
returns public.recruitment_applications
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); p public.recruitment_posts; a public.recruitment_applications;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into p from public.recruitment_posts where id = p_post_id for update;
  if not found then perform app.fail(404, 'recruitment_post_not_found'); end if;
  select * into a from public.recruitment_applications where post_id = p.id and user_id = v_uid and status = 'submitted';
  if found then return a; end if;
  if not p.is_open or (p.closes_at is not null and p.closes_at <= now()) then
    perform app.fail(409, 'recruitment_closed'); end if;
  if app.age_years(v_uid) is null then perform app.fail(409, 'profile_incomplete'); end if;
  if exists (select 1 from public.team_memberships m
             where m.team_id = p.team_id and m.user_id = v_uid and m.status = 'active') then
    perform app.fail(409, 'already_team_member'); end if;
  insert into public.recruitment_applications (post_id, user_id, message)
  values (p.id, v_uid, nullif(left(btrim(p_message), 1000), '')) returning * into a;
  return a;
end $$;

create or replace function public.decide_recruitment_application(p_application_id uuid, p_accept boolean)
returns public.recruitment_applications
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); a public.recruitment_applications; p public.recruitment_posts;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into a from public.recruitment_applications where id = p_application_id for update;
  if found then select * into p from public.recruitment_posts where id = a.post_id; end if;
  if a.id is null or not app.is_team_manager(p.team_id) then perform app.fail(403, 'team_manage_forbidden'); end if;
  if a.status <> 'submitted' then perform app.fail(409, 'recruitment_application_not_pending'); end if;
  update public.recruitment_applications
     set status = case when p_accept then 'accepted' else 'rejected' end::public.recruitment_application_status,
         decided_by = v_uid, decided_at = now()
   where id = a.id returning * into a;
  if p_accept then
    update public.team_memberships set status = 'active', role = 'member', decided_by = v_uid, decided_at = now()
     where team_id = p.team_id and user_id = a.user_id and status = 'pending';
    if not found and not exists (select 1 from public.team_memberships m
        where m.team_id = p.team_id and m.user_id = a.user_id and m.status = 'active') then
      insert into public.team_memberships (team_id, user_id, role, status, decided_by, decided_at)
      values (p.team_id, a.user_id, 'member', 'active', v_uid, now());
    end if;
  end if;
  perform app.audit('user', 'recruitment.decided', 'recruitment_application', a.id, null,
                    jsonb_build_object('accepted', p_accept));
  return a;
end $$;

-- ================================================================ RPCs: applications
-- The snapshot contains ONLY the fields the opportunity declares. Nothing else leaves the profile.
create or replace function app.build_application_snapshot(p_user uuid, p_fields text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb := '{}'::jsonb; f text;
  p public.profiles; pp public.profile_private;
begin
  select * into p from public.profiles where id = p_user;
  select * into pp from public.profile_private where user_id = p_user;
  foreach f in array coalesce(p_fields, '{}') loop
    v := v || jsonb_build_object(f, case f
      when 'display_name' then to_jsonb(p.display_name)
      when 'headline' then to_jsonb(p.headline)
      when 'bio' then to_jsonb(p.bio)
      when 'city' then to_jsonb(p.city)
      when 'education_stage' then to_jsonb(p.education_stage)
      when 'legal_name' then to_jsonb(pp.legal_name)
      when 'school_name' then to_jsonb(pp.school_name)
      when 'phone' then to_jsonb(pp.phone)
      when 'birth_year' then to_jsonb(extract(year from pp.birth_date)::int)
      when 'email' then (select to_jsonb(u.email) from auth.users u where u.id = p_user)
      when 'interests' then coalesce((select jsonb_agg(i.label_tr order by i.sort_order)
                                      from public.profile_interests pi join public.interests i on i.id = pi.interest_id
                                      where pi.user_id = p_user), '[]'::jsonb)
      when 'experiences' then coalesce((
        select jsonb_agg(jsonb_build_object(
                 'title', e.title, 'role', e.role, 'contribution', e.contribution, 'kind', e.kind,
                 'verified', exists (select 1 from public.attestations a where a.experience_id = e.id
                                     and a.status = 'verified' and (a.valid_until is null or a.valid_until > now())))
               order by e.created_at desc)
        from public.experiences e where e.user_id = p_user and e.status = 'published'), '[]'::jsonb)
      else 'null'::jsonb end);
  end loop;
  return v;
end $$;

-- Preview for the "Bu başvuruyla şu bilgiler paylaşılacak" screen: same builder as the real submit.
create or replace function public.application_share_preview(p_opportunity_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); o public.opportunities;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into o from public.opportunities where id = p_opportunity_id and status = 'published';
  if not found then perform app.fail(404, 'opportunity_not_found'); end if;
  return jsonb_build_object(
    'opportunity_id', o.id,
    'organization', (select name from public.organizations where id = o.organization_id),
    'shared_fields', to_jsonb(o.shared_fields),
    'snapshot', app.build_application_snapshot(v_uid, o.shared_fields));
end $$;

create or replace function public.submit_application(
  p_opportunity_id uuid, p_idempotency_key uuid, p_motivation text default null
) returns public.applications
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); o public.opportunities; a public.applications; v_age int;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_idempotency_key is null then perform app.fail(422, 'idempotency_key_required'); end if;
  select * into o from public.opportunities where id = p_opportunity_id and status = 'published' for share;
  if not found then perform app.fail(404, 'opportunity_not_found'); end if;
  -- serialise per (user) so a double tap cannot race the unique index into a 500
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || o.id::text, 0));

  select * into a from public.applications
   where user_id = v_uid and (idempotency_key = p_idempotency_key
      or (opportunity_id = o.id and status <> 'withdrawn'))
   order by (opportunity_id = o.id) desc, created_at desc limit 1;
  if found then
    if a.opportunity_id <> o.id then perform app.fail(409, 'idempotency_key_reused'); end if;
    if a.status <> 'draft' then return a; end if;
  end if;

  if o.opens_at is not null and now() < o.opens_at then perform app.fail(409, 'applications_not_open'); end if;
  if now() >= o.closes_at then perform app.fail(409, 'applications_closed'); end if;
  v_age := app.age_years(v_uid);
  if v_age is null then perform app.fail(409, 'profile_incomplete'); end if;
  if o.min_age is not null and v_age < o.min_age then perform app.fail(403, 'below_min_age'); end if;
  if o.max_age is not null and v_age > o.max_age then perform app.fail(403, 'above_max_age'); end if;
  if o.guardian_required_under is not null and v_age < o.guardian_required_under then
    perform app.fail(403, 'guardian_consent_unavailable'); end if;
  if p_motivation is not null and char_length(p_motivation) > 2000 then
    perform app.fail(422, 'motivation_too_long'); end if;

  if a.id is not null then -- promote an existing draft
    update public.applications
       set status = 'submitted', motivation = nullif(btrim(p_motivation), ''), shared_fields = o.shared_fields,
           snapshot = app.build_application_snapshot(v_uid, o.shared_fields), submitted_at = now()
     where id = a.id returning * into a;
  else
    insert into public.applications
      (opportunity_id, user_id, status, motivation, shared_fields, snapshot, idempotency_key, submitted_at)
    values (o.id, v_uid, 'submitted', nullif(btrim(p_motivation), ''), o.shared_fields,
            app.build_application_snapshot(v_uid, o.shared_fields), p_idempotency_key, now())
    returning * into a;
  end if;

  insert into public.application_status_history (application_id, from_status, to_status, actor_kind, changed_by)
  values (a.id, null, 'submitted', 'applicant', v_uid);
  insert into public.consents (user_id, purpose, policy_version, granted_by, subject_type, subject_id)
  values (v_uid, 'application_data_sharing', app.current_policy_version('application_data_sharing'), 'self',
          'application', a.id);
  perform app.audit('user', 'application.submitted', 'application', a.id, o.organization_id,
                    jsonb_build_object('shared_fields', o.shared_fields));
  return a;
end $$;

create or replace function public.withdraw_application(p_application_id uuid) returns public.applications
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); a public.applications; v_from public.application_status;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into a from public.applications where id = p_application_id and user_id = v_uid for update;
  if not found then perform app.fail(404, 'application_not_found'); end if;
  if a.status = 'withdrawn' then return a; end if;
  if a.status not in ('draft', 'submitted', 'in_review', 'info_requested') then
    perform app.fail(409, 'application_not_withdrawable'); end if;
  v_from := a.status;
  update public.applications set status = 'withdrawn', decided_at = now() where id = a.id returning * into a;
  insert into public.application_status_history (application_id, from_status, to_status, actor_kind, changed_by)
  values (a.id, v_from, 'withdrawn', 'applicant', v_uid);
  update public.consents set withdrawn_at = now()
   where subject_type = 'application' and subject_id = a.id and withdrawn_at is null;
  perform app.audit('user', 'application.withdrawn', 'application', a.id);
  return a;
end $$;

create or replace function app.application_transition_allowed(
  p_from public.application_status, p_to public.application_status
) returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('submitted', 'in_review'), ('submitted', 'closed'),
    ('in_review', 'info_requested'), ('in_review', 'accepted'), ('in_review', 'declined'), ('in_review', 'closed'),
    ('info_requested', 'in_review'), ('info_requested', 'declined'), ('info_requested', 'closed'));
$$;

create or replace function public.set_application_status(
  p_application_id uuid, p_status public.application_status, p_note text default null
) returns public.applications
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); a public.applications; o public.opportunities; v_from public.application_status;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into a from public.applications where id = p_application_id for update;
  if found then select * into o from public.opportunities where id = a.opportunity_id; end if;
  -- Unknown id and foreign tenant give the same answer.
  if a.id is null or a.status = 'draft'
     or not app.has_org_role(o.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]) then
    perform app.fail(403, 'application_review_forbidden'); end if;
  if a.user_id = v_uid then perform app.fail(403, 'cannot_review_own_application'); end if;
  if not app.application_transition_allowed(a.status, p_status) then
    perform app.fail(409, 'application_transition_invalid', a.status::text || '->' || p_status::text); end if;
  v_from := a.status;
  update public.applications
     set status = p_status,
         decided_at = case when p_status in ('accepted', 'declined', 'closed') then now() end
   where id = a.id returning * into a;
  insert into public.application_status_history (application_id, from_status, to_status, actor_kind, changed_by, note)
  values (a.id, v_from, p_status, 'organization', v_uid, nullif(left(btrim(p_note), 500), ''));
  perform app.audit('user', 'application.status_changed', 'application', a.id, o.organization_id,
                    jsonb_build_object('from', v_from, 'to', p_status));
  return a;
end $$;

-- ================================================================ RPCs: attestations
create or replace function public.request_attestation(
  p_experience_id uuid, p_org_id uuid, p_scope text default null
) returns public.attestations
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); e public.experiences; att public.attestations;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into e from public.experiences where id = p_experience_id and user_id = v_uid for update;
  if not found then perform app.fail(404, 'experience_not_found'); end if;
  if e.status <> 'published' then perform app.fail(409, 'experience_is_draft'); end if;
  if not exists (select 1 from public.organizations o where o.id = p_org_id and o.verification = 'verified') then
    perform app.fail(404, 'organization_not_found'); end if;

  select * into att from public.attestations
   where experience_id = e.id and organization_id = p_org_id
     and status in ('requested', 'verified', 'changes_requested') for update;
  if found then
    if att.status = 'changes_requested' then
      update public.attestations set status = 'requested', requested_at = now(),
             scope = coalesce(nullif(btrim(p_scope), ''), scope), decided_by = null, decided_at = null
       where id = att.id returning * into att;
    end if;
    return att;
  end if;
  insert into public.attestations (experience_id, organization_id, scope, requested_by)
  values (e.id, p_org_id, nullif(left(btrim(p_scope), 300), ''), v_uid) returning * into att;
  perform app.audit('user', 'attestation.requested', 'attestation', att.id, p_org_id);
  return att;
end $$;

create or replace function public.decide_attestation(
  p_attestation_id uuid, p_decision public.attestation_status,
  p_scope text default null, p_note text default null, p_source text default null, p_valid_until timestamptz default null
) returns public.attestations
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); att public.attestations; e public.experiences;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_decision not in ('verified', 'changes_requested', 'rejected') then
    perform app.fail(422, 'attestation_decision_invalid'); end if;
  select * into att from public.attestations where id = p_attestation_id for update;
  if not found
     or not app.has_org_role(att.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[]) then
    perform app.fail(403, 'attestation_forbidden'); end if;
  select * into e from public.experiences where id = att.experience_id;
  if e.user_id = v_uid then perform app.fail(403, 'self_attestation_forbidden'); end if;
  if att.status <> 'requested' then perform app.fail(409, 'attestation_not_pending'); end if;
  if p_decision = 'verified' and coalesce(nullif(btrim(p_scope), ''), att.scope) is null then
    perform app.fail(422, 'attestation_scope_required'); end if;

  update public.attestations
     set status = p_decision, decided_by = v_uid, decided_at = now(),
         scope = coalesce(nullif(left(btrim(p_scope), 300), ''), scope),
         source = nullif(left(btrim(p_source), 120), ''),
         decision_note = nullif(left(btrim(p_note), 500), ''),
         valid_until = case when p_decision = 'verified' then p_valid_until end
   where id = att.id returning * into att;
  perform app.audit('user', 'attestation.' || p_decision::text, 'attestation', att.id, att.organization_id);
  return att;
end $$;

create or replace function public.revoke_attestation(p_attestation_id uuid, p_reason text)
returns public.attestations
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); att public.attestations;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into att from public.attestations where id = p_attestation_id for update;
  if not found or not (app.is_platform_admin()
       or app.has_org_role(att.organization_id, array['owner', 'admin', 'reviewer']::public.org_member_role[])) then
    perform app.fail(403, 'attestation_forbidden'); end if;
  if att.status <> 'verified' then perform app.fail(409, 'attestation_not_verified'); end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then perform app.fail(422, 'revoke_reason_required'); end if;
  update public.attestations
     set status = 'revoked', revoked_by = v_uid, revoked_at = now(), revoke_reason = left(btrim(p_reason), 300)
   where id = att.id returning * into att;
  perform app.audit('user', 'attestation.revoked', 'attestation', att.id, att.organization_id);
  return att;
end $$;

-- ================================================================ RPCs: learning
create or replace function public.complete_lesson(p_lesson_id uuid) returns public.course_progress
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); l public.lessons; cp public.course_progress; v_total int; v_done uuid[];
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select ls.* into l from public.lessons ls join public.courses c on c.id = ls.course_id
   where ls.id = p_lesson_id and c.status = 'published';
  if not found then perform app.fail(404, 'lesson_not_found'); end if;

  insert into public.course_progress (user_id, course_id) values (v_uid, l.course_id)
  on conflict (user_id, course_id) do nothing;
  select * into cp from public.course_progress where user_id = v_uid and course_id = l.course_id for update;

  -- Only lessons that still exist in the course count; the percentage is always server-computed.
  select array_agg(x.id) into v_done from public.lessons x
   where x.course_id = l.course_id and (x.id = l.id or x.id = any (cp.completed_lesson_ids));
  select count(*) into v_total from public.lessons where course_id = l.course_id;

  update public.course_progress
     set completed_lesson_ids = v_done,
         percent = (100 * coalesce(array_length(v_done, 1), 0)) / greatest(v_total, 1),
         completed_at = case when coalesce(array_length(v_done, 1), 0) >= v_total
                             then coalesce(completed_at, now()) end
   where user_id = v_uid and course_id = l.course_id returning * into cp;
  return cp;
end $$;

-- ================================================================ RPCs: devices
create or replace function public.register_device(
  p_install_id text, p_provider public.push_provider, p_push_token text, p_platform text, p_app_version text default null
) returns public.devices
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); d public.devices;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_install_id is null or char_length(p_install_id) < 8 or p_push_token is null or char_length(p_push_token) < 8
     or p_platform not in ('ios', 'android') or ((p_provider = 'apns') <> (p_platform = 'ios')) then
    perform app.fail(422, 'device_invalid'); end if;
  perform pg_advisory_xact_lock(hashtextextended('device:' || p_install_id, 0));
  -- The install gets exactly one active provider/token; a token moves with whoever signed in last.
  update public.devices set is_active = false
   where device_install_id = p_install_id and is_active and push_token <> p_push_token;
  insert into public.devices (user_id, device_install_id, provider, push_token, platform, app_version)
  values (v_uid, p_install_id, p_provider, p_push_token, p_platform, left(p_app_version, 40))
  on conflict (push_token) do update
    set user_id = excluded.user_id, device_install_id = excluded.device_install_id, provider = excluded.provider,
        platform = excluded.platform, app_version = excluded.app_version, is_active = true, last_seen_at = now()
  returning * into d;
  return d;
end $$;

create or replace function public.unregister_device(p_install_id text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_count int;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  update public.devices set is_active = false
   where device_install_id = p_install_id and user_id = v_uid and is_active;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ================================================================ grants
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function
  app.is_platform_admin(), app.has_org_role(uuid, public.org_member_role[]), app.is_org_member(uuid),
  app.fail(int, text, text),
  app.is_team_member(uuid), app.is_team_manager(uuid), app.is_team_captain(uuid),
  app.can_review_application(uuid), app.owns_experience(uuid), app.can_review_experience(uuid),
  app.experience_is_public(uuid), app.can_edit_course(uuid)
to authenticated, anon;

revoke execute on function
  public.create_team(text, public.team_kind, text, text), public.request_team_join(uuid, text),
  public.withdraw_team_join(uuid), public.decide_team_join(uuid, boolean),
  public.set_team_member_role(uuid, public.team_role), public.remove_team_member(uuid), public.leave_team(uuid),
  public.team_roster(uuid), public.set_team_task_status(uuid, public.task_status),
  public.apply_to_recruitment(uuid, text), public.decide_recruitment_application(uuid, boolean),
  public.application_share_preview(uuid), public.submit_application(uuid, uuid, text),
  public.withdraw_application(uuid), public.set_application_status(uuid, public.application_status, text),
  public.request_attestation(uuid, uuid, text),
  public.decide_attestation(uuid, public.attestation_status, text, text, text, timestamptz),
  public.revoke_attestation(uuid, text), public.complete_lesson(uuid),
  public.register_device(text, public.push_provider, text, text, text), public.unregister_device(text)
from public, anon, authenticated;

grant execute on function
  public.create_team(text, public.team_kind, text, text), public.request_team_join(uuid, text),
  public.withdraw_team_join(uuid), public.decide_team_join(uuid, boolean),
  public.set_team_member_role(uuid, public.team_role), public.remove_team_member(uuid), public.leave_team(uuid),
  public.team_roster(uuid), public.set_team_task_status(uuid, public.task_status),
  public.apply_to_recruitment(uuid, text), public.decide_recruitment_application(uuid, boolean),
  public.application_share_preview(uuid), public.submit_application(uuid, uuid, text),
  public.withdraw_application(uuid), public.set_application_status(uuid, public.application_status, text),
  public.request_attestation(uuid, uuid, text),
  public.decide_attestation(uuid, public.attestation_status, text, text, text, timestamptz),
  public.revoke_attestation(uuid, text), public.complete_lesson(uuid),
  public.register_device(text, public.push_provider, text, text, text), public.unregister_device(text)
to authenticated;
