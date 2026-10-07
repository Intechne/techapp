-- TechApp · stabilization sprint (7 Ekim 2026 denetimi) — P1/P2 server-side security fixes.
-- Additive and non-destructive: no table or column is dropped, no data is deleted except CV share links
-- that minors could only have obtained through the bypass closed below.
--
--  1. CV share token: clients can no longer write profile_private.cv_share_token (column grants + trigger);
--     set_cv_sharing() is the only writer; public_cv() refuses minors' profiles.
--  2. Guardian e-mail abuse: request reuse, per-registration / per-user / per-recipient limits, durable throttle audit.
--  3. Approved content: a critical edit to a published event/opportunity sends it back to review, with history.
--     submit_application() can refuse when the shared fields changed after the applicant's preview.
--  4. Verified experiences: link_url is part of the verified substance; the verified data is snapshotted.
--  5. Account deletion: user references without ON DELETE no longer block deleting staff accounts.

-- ================================================================ 1. CV share token
-- The owner may still update contact fields directly; every other column is server-owned.
revoke insert, update, delete on public.profile_private from anon, authenticated;
grant update (legal_name, phone, school_name) on public.profile_private to authenticated;

-- Defence in depth, same pattern as birth_date: even a future grant cannot open the token column.
create or replace function app.protect_cv_share_token() returns trigger
language plpgsql as $$
begin
  if new.cv_share_token is distinct from old.cv_share_token
     and coalesce(current_setting('app.allow_cv_token_write', true), '') <> 'on' then
    perform app.fail(403, 'cv_token_locked');
  end if;
  return new;
end $$;
create trigger profile_private_protect_cv before update on public.profile_private
  for each row execute function app.protect_cv_share_token();

create or replace function public.set_cv_sharing(p_enabled boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_token text; v_rows int;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_enabled then
    if coalesce(app.age_years(v_uid), 0) < 18 then perform app.fail(403, 'cv_sharing_adults_only'); end if;
    v_token := app.url_token();
  end if;
  perform set_config('app.allow_cv_token_write', 'on', true);
  update public.profile_private set cv_share_token = v_token where user_id = v_uid;
  get diagnostics v_rows = row_count;
  perform set_config('app.allow_cv_token_write', '', true);
  if v_rows = 0 then perform app.fail(409, 'profile_incomplete'); end if;
  perform app.audit('user', case when p_enabled then 'cv.sharing_enabled' else 'cv.sharing_disabled' end, 'profile', v_uid);
  return v_token;
end $$;

-- Unknown, malformed, switched-off and minors' links give the same answer.
create or replace function public.public_cv(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid;
begin
  if p_token is null or char_length(p_token) < 32 then perform app.fail(404, 'cv_not_found'); end if;
  select pp.user_id into v_user from public.profile_private pp where pp.cv_share_token = p_token;
  if v_user is null or coalesce(app.age_years(v_user), 0) < 18 then perform app.fail(404, 'cv_not_found'); end if;
  return app.cv_document(v_user, true);
end $$;

-- Links a minor could only have set through the closed bypass are switched off.
do $$
declare v_count int;
begin
  perform set_config('app.allow_cv_token_write', 'on', true);
  update public.profile_private set cv_share_token = null
   where cv_share_token is not null and coalesce(app.age_years(user_id), 0) < 18;
  get diagnostics v_count = row_count;
  perform set_config('app.allow_cv_token_write', '', true);
  if v_count > 0 then
    perform app.audit('system', 'cv.minor_links_revoked', 'profile', null, null, jsonb_build_object('count', v_count));
  end if;
end $$;

-- ================================================================ 2. Guardian e-mail abuse
-- One row per e-mail actually handed to the mailer. Survives request/account deletion so limits cannot be reset;
-- the recipient is stored only as a hash.
create table public.guardian_send_log (
  id bigint generated always as identity primary key,
  request_id uuid references public.guardian_requests (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  recipient_hash bytea not null,
  sent_at timestamptz not null default now()
);
create index guardian_send_log_user_idx on public.guardian_send_log (user_id, sent_at desc);
create index guardian_send_log_recipient_idx on public.guardian_send_log (recipient_hash, sent_at desc);
alter table public.guardian_send_log enable row level security;
revoke all on public.guardian_send_log from anon, authenticated;

create or replace function app.guardian_limits() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'resend_cooldown_seconds', 120,      -- per request
    'sends_per_request', 5,
    'sends_per_user_hour', 5,
    'sends_per_user_day', 10,
    'sends_per_recipient_day', 5,        -- across all users
    'requests_per_registration_day', 3,  -- i.e. changing the guardian address
    'requests_per_user_day', 6);
$$;

-- 1) The minor asks for consent. An active request to the same address is reused (no new row, no reset of limits).
create or replace function public.create_guardian_request(
  p_registration_id uuid, p_guardian_email text, p_guardian_name text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_reg public.event_registrations; v_id uuid; v_own_email text;
  v_email text := lower(btrim(coalesce(p_guardian_email, ''))); v_existing public.guardian_requests;
  v_limits jsonb := app.guardian_limits();
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into v_reg from public.event_registrations where id = p_registration_id and user_id = v_uid for update;
  if not found then perform app.fail(404, 'registration_not_found'); end if;
  if v_reg.status <> 'pending_guardian' then perform app.fail(409, 'guardian_not_required'); end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' or char_length(v_email) > 254 then
    perform app.fail(422, 'guardian_email_invalid'); end if;
  select email into v_own_email from auth.users where id = v_uid;
  if v_email = lower(btrim(coalesce(v_own_email, ''))) then perform app.fail(422, 'guardian_email_same_as_user'); end if;

  select * into v_existing from public.guardian_requests
   where subject_type = 'event_registration' and subject_id = v_reg.id and status = 'pending' and expires_at > now()
   for update;
  if found and v_existing.guardian_email = v_email then
    if nullif(btrim(p_guardian_name), '') is not null then
      update public.guardian_requests set guardian_name = btrim(p_guardian_name) where id = v_existing.id;
    end if;
    perform app.audit('user', 'guardian_request.reused', 'guardian_request', v_existing.id);
    return v_existing.id;
  end if;

  if (select count(*) from public.guardian_requests
       where subject_type = 'event_registration' and subject_id = v_reg.id and requested_at > now() - interval '24 hours')
     >= (v_limits ->> 'requests_per_registration_day')::int
  or (select count(*) from public.guardian_requests where user_id = v_uid and requested_at > now() - interval '24 hours')
     >= (v_limits ->> 'requests_per_user_day')::int then
    perform app.fail(429, 'guardian_request_limit');
  end if;

  update public.guardian_requests set status = 'revoked', revoked_at = now(), token_hash = null
   where subject_type = 'event_registration' and subject_id = v_reg.id and status = 'pending';

  insert into public.guardian_requests
    (user_id, consent_purpose, subject_type, subject_id, guardian_name, guardian_email, policy_version, expires_at)
  values (v_uid, 'event_participation', 'event_registration', v_reg.id, nullif(btrim(p_guardian_name), ''),
          v_email, app.current_policy_version('guardian_event_participation'), now() + interval '72 hours')
  returning id into v_id;
  perform app.audit('user', 'guardian_request.created', 'guardian_request', v_id);
  return v_id;
end $$;

-- 2) Service role only (Edge Function). The ONLY path that leads to an e-mail. A throttled call does not raise:
--    it returns {throttled, code, retry_after_seconds} so that the 'throttled' audit row is committed.
create or replace function public.issue_guardian_token(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.guardian_requests; v_token text; v_limits jsonb := app.guardian_limits(); v_hash bytea;
  v_code text; v_retry int := 0;
begin
  select * into g from public.guardian_requests where id = p_request_id for update;
  if not found then perform app.fail(404, 'guardian_request_not_found'); end if;
  if g.status <> 'pending' or g.expires_at <= now() then perform app.fail(409, 'guardian_request_not_pending'); end if;
  v_hash := app.sha256(lower(btrim(g.guardian_email)));
  -- serialise per recipient so parallel calls cannot slip past the counters
  perform pg_advisory_xact_lock(hashtextextended(encode(v_hash, 'hex'), 0));

  if g.last_sent_at is not null and g.last_sent_at > now() - make_interval(secs => (v_limits ->> 'resend_cooldown_seconds')::int) then
    v_code := 'guardian_send_too_soon';
    v_retry := ceil(extract(epoch from (g.last_sent_at + make_interval(secs => (v_limits ->> 'resend_cooldown_seconds')::int) - now())))::int;
  elsif g.send_count >= (v_limits ->> 'sends_per_request')::int then
    v_code := 'guardian_send_limit';
  elsif (select count(*) from public.guardian_send_log where user_id = g.user_id and sent_at > now() - interval '1 hour')
        >= (v_limits ->> 'sends_per_user_hour')::int then
    v_code := 'guardian_send_limit_user'; v_retry := 3600;
  elsif (select count(*) from public.guardian_send_log where user_id = g.user_id and sent_at > now() - interval '24 hours')
        >= (v_limits ->> 'sends_per_user_day')::int then
    v_code := 'guardian_send_limit_user'; v_retry := 86400;
  elsif (select count(*) from public.guardian_send_log where recipient_hash = v_hash and sent_at > now() - interval '24 hours')
        >= (v_limits ->> 'sends_per_recipient_day')::int then
    v_code := 'guardian_send_limit_recipient'; v_retry := 86400;
  end if;

  if v_code is not null then
    perform app.audit('service', 'guardian_request.throttled', 'guardian_request', g.id, null, jsonb_build_object('reason', v_code));
    return jsonb_build_object('throttled', true, 'code', v_code, 'retry_after_seconds', v_retry);
  end if;

  v_token := app.url_token();
  update public.guardian_requests
     set token_hash = app.sha256(v_token), send_count = send_count + 1, last_sent_at = now()
   where id = g.id;
  insert into public.guardian_send_log (request_id, user_id, recipient_hash) values (g.id, g.user_id, v_hash);
  perform app.audit('service', case when g.send_count = 0 then 'guardian_request.sent' else 'guardian_request.resent' end,
                    'guardian_request', g.id, null, jsonb_build_object('send_count', g.send_count + 1));
  return jsonb_build_object(
    'throttled', false,
    'token', v_token, 'guardian_email', g.guardian_email, 'guardian_name', g.guardian_name, 'expires_at', g.expires_at,
    'participant_first_name', split_part((select display_name from public.profiles where id = g.user_id), ' ', 1),
    'event_title', (select e.title from public.event_registrations r join public.events e on e.id = r.event_id where r.id = g.subject_id),
    'event_starts_at', (select e.starts_at from public.event_registrations r join public.events e on e.id = r.event_id where r.id = g.subject_id));
end $$;
revoke execute on function public.issue_guardian_token(uuid) from public, anon, authenticated;
grant execute on function public.issue_guardian_token(uuid) to service_role;

-- ================================================================ 3. Approved content re-review
-- Approved versions that were sent back to review because of a critical edit. Read: the organisation and the platform.
create table public.content_revisions (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('event', 'opportunity')),
  entity_id uuid not null,
  organization_id uuid references public.organizations (id) on delete set null,
  approved_snapshot jsonb not null,
  changed_fields text[] not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_revisions_entity_idx on public.content_revisions (entity_type, entity_id, created_at desc);
alter table public.content_revisions enable row level security;
revoke insert, update, delete on public.content_revisions from anon, authenticated;
create policy content_revisions_read on public.content_revisions for select to authenticated
  using (app.is_org_member(organization_id) or app.is_platform_admin());

-- Critical = changes who may take part, what they share, or the when/where/what they decided on.
-- Wording (title, summary, description, tone, topic, notes) is not critical; it is still logged.
create or replace function app.event_critical_fields() returns text[] language sql immutable as $$
  select array['type', 'format', 'city', 'venue', 'online_url', 'starts_at', 'ends_at', 'timezone',
               'registration_opens_at', 'registration_closes_at', 'requires_review', 'registration_mode',
               'min_age', 'max_age', 'guardian_required_under', 'fee_minor_units', 'cancellation_policy'];
$$;
create or replace function app.opportunity_critical_fields() returns text[] language sql immutable as $$
  select array['type', 'city', 'is_remote', 'min_age', 'max_age', 'guardian_required_under',
               'opens_at', 'closes_at', 'shared_fields'];
$$;
-- Wording fields whose post-approval edits are logged (never the server-owned counters).
create or replace function app.content_text_fields() returns text[] language sql immutable as $$
  select array['title', 'poster_line', 'summary', 'description', 'tone', 'topic_interest_id', 'audience_note',
               'support_contact', 'skills', 'waitlist_enabled', 'capacity'];
$$;

create or replace function app.rereview_on_critical_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := to_jsonb(old); v_new jsonb := to_jsonb(new);
  v_entity text := case tg_table_name when 'events' then 'event' else 'opportunity' end;
  v_critical text[]; v_text text[]; v_changed text[];
begin
  -- Only edits made through the API by organisation staff to live content. Platform approvers are the review.
  if old.status <> 'published' or new.status <> 'published' then return new; end if;
  if (select auth.uid()) is null or app.is_platform_admin() then return new; end if;

  v_critical := case v_entity when 'event' then app.event_critical_fields() else app.opportunity_critical_fields() end;
  select coalesce(array_agg(k order by k), '{}') into v_changed
    from unnest(v_critical) k where (v_new -> k) is distinct from (v_old -> k);
  -- Fewer seats is critical (it can push registered people out); more seats or no limit is not.
  -- (read through jsonb: opportunities have no capacity column)
  if v_entity = 'event' and (v_new ->> 'capacity') is not null
     and ((v_old ->> 'capacity') is null or (v_new ->> 'capacity')::int < (v_old ->> 'capacity')::int) then
    v_changed := array_append(v_changed, 'capacity');
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
-- Runs after the existing *_protect triggers (alphabetical order), so locked columns are rejected first.
create trigger events_rereview before update on public.events
  for each row execute function app.rereview_on_critical_edit();
create trigger opportunities_rereview before update on public.opportunities
  for each row execute function app.rereview_on_critical_edit();

-- Applying: what the applicant previewed must still be what they share. p_expected_shared_fields is optional for
-- older app builds; when given and different (as a set), the application is refused and nothing is stored.
drop function if exists public.submit_application(uuid, uuid, text);
create or replace function public.submit_application(
  p_opportunity_id uuid, p_idempotency_key uuid, p_motivation text default null, p_expected_shared_fields text[] default null
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

  if p_expected_shared_fields is not null
     and not (p_expected_shared_fields @> o.shared_fields and o.shared_fields @> p_expected_shared_fields) then
    perform app.fail(409, 'shared_fields_changed');
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
revoke execute on function public.submit_application(uuid, uuid, text, text[]) from public, anon;
grant execute on function public.submit_application(uuid, uuid, text, text[]) to authenticated;

-- ================================================================ 4. Verified experience integrity
-- link_url is part of what an organisation vouched for: swapping the link now drops the verification too.
create or replace function app.experience_edit_revokes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id <> old.user_id then perform app.fail(403, 'experience_owner_locked'); end if;
  if (new.title, new.role, new.contribution, new.organization_name, new.started_on, new.ended_on, new.kind, new.link_url)
     is distinct from
     (old.title, old.role, old.contribution, old.organization_name, old.started_on, old.ended_on, old.kind, old.link_url) then
    update public.attestations
       set status = 'revoked', revoked_at = now(), revoke_reason = 'experience_edited'
     where experience_id = old.id and status = 'verified';
  end if;
  return new;
end $$;

-- Keep exactly what was verified, so a later dispute can compare against it.
alter table public.attestations add column if not exists verified_snapshot jsonb;
create or replace function app.attestation_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.verified_snapshot := (
      select jsonb_build_object('kind', x.kind, 'title', x.title, 'role', x.role, 'contribution', x.contribution,
                                'organization_name', x.organization_name, 'link_url', x.link_url,
                                'started_on', x.started_on, 'ended_on', x.ended_on, 'captured_at', now())
      from public.experiences x where x.id = new.experience_id);
  end if;
  return new;
end $$;
create trigger attestations_snapshot before update on public.attestations
  for each row execute function app.attestation_snapshot();

-- ================================================================ 5. Account deletion
-- Staff who approved, created or checked people in can delete their account; the records stay, unattributed.
alter table public.organizations drop constraint if exists organizations_verified_by_fkey,
  add constraint organizations_verified_by_fkey foreign key (verified_by) references auth.users (id) on delete set null;
alter table public.events drop constraint if exists events_approved_by_fkey,
  add constraint events_approved_by_fkey foreign key (approved_by) references auth.users (id) on delete set null;
alter table public.events drop constraint if exists events_created_by_fkey,
  add constraint events_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.event_check_ins alter column checked_in_by drop not null;
alter table public.event_check_ins drop constraint if exists event_check_ins_checked_in_by_fkey,
  add constraint event_check_ins_checked_in_by_fkey foreign key (checked_in_by) references auth.users (id) on delete set null;
alter table public.opportunities drop constraint if exists opportunities_approved_by_fkey,
  add constraint opportunities_approved_by_fkey foreign key (approved_by) references auth.users (id) on delete set null;
alter table public.opportunities drop constraint if exists opportunities_created_by_fkey,
  add constraint opportunities_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.courses drop constraint if exists courses_approved_by_fkey,
  add constraint courses_approved_by_fkey foreign key (approved_by) references auth.users (id) on delete set null;
