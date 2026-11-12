-- TechApp · remote security regression (staging). Run against the linked project:
--   npx supabase db query --linked -f supabase/tests/remote/security-regression.sql
-- The whole file is one implicit transaction and ALWAYS ends in RAISE, so every fixture (auth users, org, events,
-- requests …) is rolled back. The result is in the error message: REMOTE_RESULT {"pass": n, "fail": n, "results": [...]}.
-- Each call runs under the real API role (authenticated / anon / service_role) with JWT claims, so the remote RLS
-- policies, column grants and function EXECUTE grants are what is being tested. Never point this at production.

create temp table t_results (n serial, name text, pass boolean, detail text);

create function pg_temp.t_role(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  if p_role = 'none' then  -- back to the fixture superuser, with no API identity left behind
    perform set_config('role', 'none', true); perform set_config('request.jwt.claims', '', true); return;
  end if;
  perform set_config('role', p_role, true);
  -- anon / service_role tokens carry no sub, exactly like the real API keys
  perform set_config('request.jwt.claims', (case when p_uid is null then jsonb_build_object('role', p_role)
                                            else jsonb_build_object('sub', p_uid, 'role', p_role) end)::text, true);
end $$;

create function pg_temp.t_rec(p_name text, p_pass boolean, p_detail text) returns void language plpgsql as $$
begin insert into t_results (name, pass, detail) values (p_name, coalesce(p_pass, false), p_detail); end $$;

-- Run p_sql as (p_role, p_uid); expect an error whose "SQLSTATE message" matches p_expect (regex).
create function pg_temp.t_fail(p_name text, p_role text, p_uid uuid, p_sql text, p_expect text) returns void language plpgsql as $$
declare v_err text;
begin
  begin
    perform pg_temp.t_role(p_role, p_uid);
    execute p_sql;
    perform pg_temp.t_role('none', null);
    perform pg_temp.t_rec(p_name, false, 'succeeded, expected ' || p_expect);
  exception when others then
    v_err := sqlstate || ' ' || sqlerrm;
    perform pg_temp.t_role('none', null);
    perform pg_temp.t_rec(p_name, v_err ~ p_expect, v_err);
  end;
end $$;

-- Run p_sql as (p_role, p_uid) and return the first column of the first row as text (errors propagate).
create function pg_temp.t_val(p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.t_role(p_role, p_uid);
  execute p_sql into v;
  perform pg_temp.t_role('none', null);
  return v;
exception when others then
  perform pg_temp.t_role('none', null);
  raise;
end $$;

create function pg_temp.t_user(p_age int, p_name text default 'Remote Test') returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role) values (v, v || '@remote-test.invalid', 'authenticated', 'authenticated');
  perform pg_temp.t_val('authenticated', v, format(
    $q$select public.complete_profile_bootstrap(%L, 'university', (current_date - make_interval(years => %s, days => 30))::date, '{}')::text$q$,
    p_name, p_age));
  return v;
end $$;

create function pg_temp.t_org() returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into public.organizations (id, slug, name, type, verification, is_demo)
  values (v, 'rt-' || substr(replace(v::text, '-', ''), 1, 12), 'Remote Test Org', 'ngo', 'verified', true);
  return v;
end $$;

create function pg_temp.t_event(p_org uuid, p_guardian int default null, p_min_age int default null, p_soon boolean default false)
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid(); v_start timestamptz := now() + case when p_soon then interval '2 hours' else interval '7 days' end;
begin
  insert into public.events (id, organization_id, slug, title, summary, type, format, status, is_demo, starts_at, ends_at,
                             registration_closes_at, guardian_required_under, min_age, capacity)
  values (v, p_org, 'rt-' || substr(replace(v::text, '-', ''), 1, 12), 'Remote Test Etkinliği', 'Özet', 'workshop', 'in_person',
          'published', true, v_start, v_start + interval '6 hours', v_start - interval '1 hour', p_guardian, p_min_age, 50);
  return v;
end $$;

create function pg_temp.t_register(p_uid uuid, p_event uuid) returns uuid language sql as $$
  select (pg_temp.t_val('authenticated', p_uid,
    format('select (public.register_for_event(%L, gen_random_uuid())).id::text', p_event)))::uuid;
$$;

create function pg_temp.t_guardian_req(p_uid uuid, p_reg uuid, p_email text) returns uuid language sql as $$
  select (pg_temp.t_val('authenticated', p_uid,
    format('select public.create_guardian_request(%L, %L, %L)::text', p_reg, p_email, 'Veli Test')))::uuid;
$$;

create function pg_temp.t_issue(p_req uuid) returns jsonb language sql as $$
  select (pg_temp.t_val('service_role', null, format('select public.issue_guardian_token(%L)::text', p_req)))::jsonb;
$$;

do $$
declare
  v_adult uuid; v_minor uuid; v_other uuid; v_token text; v_token2 text; v_org uuid; v_org_b uuid; v_event uuid; v_event_b uuid;
  v_reg uuid; v_reg2 uuid; v_req uuid; v_req2 uuid; j jsonb; v_text text; v_n int; i int; v_editor uuid; v_opp uuid;
  v_owner_a uuid; v_owner_b uuid; v_staff uuid; v_captain uuid; v_member uuid; v_team uuid; v_cap_m uuid; v_mem_m uuid;
  v_appl uuid; v_sc_event uuid; v_sc_user uuid; v_sc_reg uuid; v_sc_code text; v_post uuid;
  v_cv_event uuid; v_cv_path text;
  v_out jsonb;
begin
  -- ================================================================ CV
  v_adult := pg_temp.t_user(22, 'Remote Yetişkin'); v_minor := pg_temp.t_user(15);
  v_token := pg_temp.t_val('authenticated', v_adult, 'select public.set_cv_sharing(true)');
  v_text := pg_temp.t_val('anon', null, format($q$select public.public_cv(%L) -> 'profile' ->> 'display_name'$q$, v_token));
  perform pg_temp.t_rec('01 adult set_cv_sharing → success + public link', length(v_token) >= 32 and v_text = 'Remote Yetişkin',
                        'token_len=' || length(v_token) || ' name=' || coalesce(v_text, 'null'));
  perform pg_temp.t_fail('02 minor set_cv_sharing → rejected', 'authenticated', v_minor,
                         'select public.set_cv_sharing(true)', '^PT403 cv_sharing_adults_only');
  perform pg_temp.t_fail('03 adult direct cv_share_token update → rejected', 'authenticated', v_adult,
                         format($q$update public.profile_private set cv_share_token = repeat('a', 40) where user_id = %L$q$, v_adult),
                         '^42501 permission denied');
  perform pg_temp.t_fail('04 minor direct cv_share_token update → rejected', 'authenticated', v_minor,
                         format($q$update public.profile_private set cv_share_token = repeat('b', 40) where user_id = %L$q$, v_minor),
                         '^42501 permission denied');
  perform pg_temp.t_fail('05 anonymous invalid CV token → no profile', 'anon', null,
                         $q$select public.public_cv(repeat('x', 64))$q$, '^PT404 cv_not_found');
  perform pg_temp.t_val('authenticated', v_adult, 'select public.set_cv_sharing(false)');
  perform pg_temp.t_fail('06 sharing disabled → old token no longer serves the CV', 'anon', null,
                         format('select public.public_cv(%L)', v_token), '^PT404 cv_not_found');

  -- ================================================================ Guardian e-mail limits (DB level, no e-mail sent)
  v_org := pg_temp.t_org(); v_event := pg_temp.t_event(v_org, 18);
  v_minor := pg_temp.t_user(15); v_reg := pg_temp.t_register(v_minor, v_event);
  v_req := pg_temp.t_guardian_req(v_minor, v_reg, 'veli.tekrar@remote-test.invalid');
  v_req2 := pg_temp.t_guardian_req(v_minor, v_reg, '  VELI.TEKRAR@remote-test.invalid ');
  select count(*) into v_n from public.guardian_requests where subject_id = v_reg;
  perform pg_temp.t_rec('07 same guardian request again → reused, no duplicate row', v_req = v_req2 and v_n = 1,
                        'same_id=' || (v_req = v_req2) || ' rows=' || v_n);
  j := pg_temp.t_issue(v_req);
  v_out := pg_temp.t_issue(v_req);
  perform pg_temp.t_rec('08 resend within cooldown (120 s) → throttled',
                        (j ->> 'throttled')::boolean = false and v_out ->> 'code' = 'guardian_send_too_soon',
                        'first=' || (j ->> 'throttled') || ' second=' || coalesce(v_out ->> 'code', v_out::text));

  -- 09: per user, max 5 sends per hour across registrations
  v_minor := pg_temp.t_user(15); v_text := '';
  for i in 1..6 loop
    v_reg := pg_temp.t_register(v_minor, pg_temp.t_event(v_org, 18));
    j := pg_temp.t_issue(pg_temp.t_guardian_req(v_minor, v_reg, format('veli.saat%s@remote-test.invalid', i)));
    v_text := v_text || coalesce(j ->> 'code', 'ok') || ' ';
  end loop;
  perform pg_temp.t_rec('09 user hourly send limit enforced', v_text = 'ok ok ok ok ok guardian_send_limit_user ', v_text);

  -- 10: per recipient, max 5 sends per day across all accounts
  v_text := '';
  for i in 1..6 loop
    v_other := pg_temp.t_user(15); v_reg := pg_temp.t_register(v_other, v_event);
    j := pg_temp.t_issue(pg_temp.t_guardian_req(v_other, v_reg, 'hedef.veli@remote-test.invalid'));
    v_text := v_text || coalesce(j ->> 'code', 'ok') || ' ';
  end loop;
  perform pg_temp.t_rec('10 recipient daily limit enforced', v_text = 'ok ok ok ok ok guardian_send_limit_recipient ', v_text);

  -- guardian view is read-only (advisor finding, migration 20261007000200)
  perform pg_temp.t_fail('10b minor cannot approve own guardian request through the view', 'authenticated', v_other,
                         $q$update public.my_guardian_requests set status = 'approved', send_count = 0$q$, '^55000 cannot update view');

  -- ================================================================ Content approval
  v_editor := pg_temp.t_user(30);
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_editor, 'editor');
  v_event := pg_temp.t_event(v_org, null, 14);
  perform pg_temp.t_val('authenticated', v_editor, format('update public.events set min_age = 10 where id = %L returning id::text', v_event));
  select status::text into v_text from public.events where id = v_event;
  perform pg_temp.t_rec('11 critical event edit → back to review', v_text = 'in_review', 'status=' || v_text);

  v_opp := gen_random_uuid();
  insert into public.opportunities (id, organization_id, slug, title, summary, type, status, is_demo, closes_at, shared_fields)
  values (v_opp, v_org, 'rt-' || substr(replace(v_opp::text, '-', ''), 1, 12), 'Remote Staj', 'Özet', 'internship', 'published', true,
          now() + interval '7 days', array['display_name', 'education_stage']);
  perform pg_temp.t_val('authenticated', v_editor,
    format($q$update public.opportunities set shared_fields = array['display_name','email'] where id = %L returning id::text$q$, v_opp));
  select status::text into v_text from public.opportunities where id = v_opp;
  perform pg_temp.t_rec('12 critical opportunity edit → back to review', v_text = 'in_review', 'status=' || v_text);

  v_event := pg_temp.t_event(v_org);
  perform pg_temp.t_val('authenticated', v_editor,
    format($q$update public.events set title = 'Yazım düzeltildi', description = 'Yeni metin' where id = %L returning id::text$q$, v_event));
  select status::text into v_text from public.events where id = v_event;
  perform pg_temp.t_rec('13 non-critical copy edit → stays published', v_text = 'published', 'status=' || v_text);

  update public.opportunities set status = 'published', shared_fields = array['display_name', 'education_stage', 'phone'] where id = v_opp;
  perform pg_temp.t_fail('14 shared fields changed after preview → submit rejected', 'authenticated', v_adult,
    format($q$select public.submit_application(%L, gen_random_uuid(), null, array['display_name','education_stage'])$q$, v_opp),
    '^PT409 shared_fields_changed');
  select count(*) into v_n from public.applications where opportunity_id = v_opp;
  perform pg_temp.t_rec('14b … and nothing was stored', v_n = 0, 'applications=' || v_n);

  -- ================================================================ Authorization
  v_event := pg_temp.t_event(v_org, null, null, true);
  v_reg := pg_temp.t_register(v_adult, v_event);
  v_other := pg_temp.t_user(25);
  -- RLS hides the row: a direct PATCH on someone else's registration matches nothing (or is denied outright)
  begin
    v_n := pg_temp.t_val('authenticated', v_other, format(
      $q$with u as (update public.event_registrations set status = 'cancelled' where id = %L returning 1) select count(*)::text from u$q$, v_reg))::int;
    perform pg_temp.t_rec('15 user cannot update another user''s registration', v_n = 0, 'rows_updated=' || v_n);
  exception when others then
    perform pg_temp.t_rec('15 user cannot update another user''s registration', sqlstate = '42501', sqlstate || ' ' || sqlerrm);
  end;
  -- and the owner cannot write their own registration state either (RPC only)
  begin
    v_n := pg_temp.t_val('authenticated', v_adult, format(
      $q$with u as (update public.event_registrations set status = 'waitlisted', status_reason = 'forged' where id = %L returning 1) select count(*)::text from u$q$, v_reg))::int;
    perform pg_temp.t_rec('15d owner cannot write own registration state directly', v_n = 0, 'rows_updated=' || v_n);
  exception when others then
    perform pg_temp.t_rec('15d owner cannot write own registration state directly', sqlstate = '42501',
                          sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('15b user cannot cancel another user''s registration via RPC', 'authenticated', v_other,
    format('select public.cancel_event_registration(%L)', v_reg), '^PT40[34]');
  select status::text into v_text from public.event_registrations where id = v_reg;
  perform pg_temp.t_rec('15c registration unchanged', v_text = 'confirmed', 'status=' || v_text);

  v_token2 := pg_temp.t_val('authenticated', v_adult, format($q$select public.get_participation_card(%L) ->> 'qr_payload'$q$, v_reg));
  perform pg_temp.t_fail('16 outsider check-in → rejected', 'authenticated', v_other,
    format('select public.check_in_participant(%L, null, %L)', v_token2, v_event), '^PT403');
  perform pg_temp.t_fail('16b participant self check-in → rejected', 'authenticated', v_adult,
    format('select public.check_in_participant(%L, null, %L)', v_token2, v_event), '^PT403');
  v_staff := pg_temp.t_user(30);
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_staff, 'checkin_staff');
  v_text := pg_temp.t_val('authenticated', v_staff, format($q$select public.check_in_participant(%L, null, %L) ->> 'result'$q$, v_token2, v_event));
  perform pg_temp.t_rec('16c authorised staff check-in → accepted (control)', v_text is not null, 'result=' || coalesce(v_text, 'null'));

  v_org_b := pg_temp.t_org(); v_owner_b := pg_temp.t_user(35); v_owner_a := pg_temp.t_user(35);
  insert into public.organization_members (organization_id, user_id, role) values (v_org_b, v_owner_b, 'owner'), (v_org, v_owner_a, 'owner');
  perform pg_temp.t_fail('17 org B owner → org A registrations (admin RPC) rejected', 'authenticated', v_owner_b,
    format('select * from public.admin_event_registrations(%L)', v_event), '^PT403 forbidden');
  v_n := pg_temp.t_val('authenticated', v_owner_b, format('select count(*)::text from public.event_registrations where event_id = %L', v_event))::int;
  perform pg_temp.t_rec('17b org B owner reads 0 org A registration rows', v_n = 0, 'rows=' || v_n);
  v_n := pg_temp.t_val('authenticated', v_owner_a, format('select count(*)::text from public.admin_event_registrations(%L)', v_event))::int;
  perform pg_temp.t_rec('17c org A owner sees own registration (control)', v_n = 1, 'rows=' || v_n);

  v_captain := pg_temp.t_user(20); v_member := pg_temp.t_user(20);
  v_team := (pg_temp.t_val('authenticated', v_captain, $q$select (public.create_team('Remote Test Takımı')).id::text$q$))::uuid;
  select id into v_cap_m from public.team_memberships where team_id = v_team and user_id = v_captain;
  insert into public.team_memberships (team_id, user_id, role, status) values (v_team, v_member, 'member', 'active') returning id into v_mem_m;
  perform pg_temp.t_fail('18 member cannot change captain''s role', 'authenticated', v_member,
    format($q$select public.set_team_member_role(%L, 'member')$q$, v_cap_m), '^PT403 team_manage_forbidden');
  perform pg_temp.t_fail('18b member cannot promote self', 'authenticated', v_member,
    format($q$select public.set_team_member_role(%L, 'captain')$q$, v_mem_m), '^PT403 team_manage_forbidden');

  -- 20261111000100: a (minor) applicant's join note is visible to the team's managers only, never to other members or anon
  v_appl := pg_temp.t_user(16);
  insert into public.team_memberships (team_id, user_id, role, status, message)
  values (v_team, v_appl, 'member', 'pending', 'remote-test join note');
  v_n := pg_temp.t_val('authenticated', v_member, format(
    $q$select count(*)::text from public.team_memberships where team_id = %L and user_id = %L$q$, v_team, v_appl))::int;
  perform pg_temp.t_rec('19 member cannot read a teammate''s membership row (minor join note)', v_n = 0, 'rows=' || v_n);
  v_text := pg_temp.t_val('authenticated', v_captain, format(
    $q$select message from public.team_memberships where team_id = %L and user_id = %L$q$, v_team, v_appl));
  perform pg_temp.t_rec('19b captain reads the applicant''s join note (control)', v_text = 'remote-test join note',
                        'message=' || coalesce(v_text, 'null'));
  begin
    v_n := pg_temp.t_val('anon', null, format('select count(*)::text from public.team_memberships where team_id = %L', v_team))::int;
    perform pg_temp.t_rec('19c anon reads 0 membership rows', v_n = 0, 'rows=' || v_n);
  exception when others then
    perform pg_temp.t_rec('19c anon reads 0 membership rows', sqlstate = '42501', sqlstate || ' ' || sqlerrm);
  end;
  v_n := pg_temp.t_val('authenticated', v_member, format(
    $q$select count(*)::text from public.team_roster(%L) where user_id = %L$q$, v_team, v_appl))::int;
  perform pg_temp.t_rec('19d plain member''s roster hides the pending minor applicant', v_n = 0, 'rows=' || v_n);

  -- 20261112000100/0200: short-code check-in is event-scoped, staff-only, and counts failed lookups
  v_sc_event := pg_temp.t_event(v_org, null, null, true);
  v_sc_user := pg_temp.t_user(27); v_sc_reg := pg_temp.t_register(v_sc_user, v_sc_event);
  v_sc_code := upper(substr(split_part(app.ticket_token((select r from public.event_registrations r where r.id = v_sc_reg)), '.', 3), 1, 8));
  v_text := pg_temp.t_val('authenticated', v_staff, format(
    $q$select public.check_in_by_short_code(%L, %L) ->> 'result'$q$, v_sc_event, lower(v_sc_code)));
  perform pg_temp.t_rec('20 staff short-code check-in → checked_in', v_text = 'checked_in', 'result=' || coalesce(v_text, 'null'));
  v_text := pg_temp.t_val('authenticated', v_staff, format(
    $q$select public.check_in_by_short_code(%L, %L) ->> 'result'$q$, v_sc_event, v_sc_code));
  perform pg_temp.t_rec('20b same code again → already_checked_in', v_text = 'already_checked_in', 'result=' || coalesce(v_text, 'null'));
  perform pg_temp.t_fail('20c malformed short code → 422', 'authenticated', v_staff,
    format($q$select public.check_in_by_short_code(%L, 'ZZZZ0000')$q$, v_sc_event), '^PT422 short_code_malformed');
  begin
    v_text := pg_temp.t_val('authenticated', v_staff, format(
      $q$select public.check_in_by_short_code(%L, '00000000') ->> 'message'$q$, v_sc_event));
    v_n := (select count(*) from app.checkin_short_code_attempts where event_id = v_sc_event);
    perform pg_temp.t_rec('20d unknown code → ticket_unknown and the failed attempt is recorded',
                          v_text = 'ticket_unknown' and v_n >= 1, 'message=' || coalesce(v_text, 'null') || ' attempts=' || v_n);
  exception when others then
    perform pg_temp.t_rec('20d unknown code → ticket_unknown and the failed attempt is recorded', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('20e non-staff short-code check-in → rejected', 'authenticated', v_other,
    format($q$select public.check_in_by_short_code(%L, %L)$q$, v_sc_event, v_sc_code), '^PT403');
  perform pg_temp.t_fail('20f anon cannot call short-code check-in', 'anon', null,
    format($q$select public.check_in_by_short_code(%L, %L)$q$, v_sc_event, v_sc_code), '^42501');

  -- 20261112000300: the founder's user id (teams.created_by / recruitment_posts.created_by) is not readable by the API roles
  insert into public.recruitment_posts (team_id, title, created_by) values (v_team, 'Remote test ilanı', v_captain) returning id into v_post;
  perform pg_temp.t_fail('21 anon cannot select teams.created_by', 'anon', null,
    format('select created_by::text from public.teams where id = %L', v_team), '^42501');
  perform pg_temp.t_fail('21b anon cannot select recruitment_posts.created_by', 'anon', null,
    format('select created_by::text from public.recruitment_posts where id = %L', v_post), '^42501');
  begin
    v_n := pg_temp.t_val('anon', null, format(
      $q$select ((select count(*) from public.teams where id = %L and member_count >= 1 and moderation_status = 'active')
              + (select count(*) from public.recruitment_posts where id = %L and team_id = %L and is_open))::text$q$,
      v_team, v_post, v_team))::int;
    perform pg_temp.t_rec('21c anon still reads the public columns of both tables (control)', v_n = 2, 'rows=' || v_n);
  exception when others then
    perform pg_temp.t_rec('21c anon still reads the public columns of both tables (control)', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('21d signed-in non-member cannot select * from teams', 'authenticated', v_other,
    format('select * from public.teams where id = %L', v_team), '^42501');

  -- 20261113000100: covers — public bucket, folder = owner (org / team), one write path (set_cover), re-review on change.
  -- v_editor = editor of v_org (org A); v_owner_b = owner of v_org_b (org B).
  v_cv_event := pg_temp.t_event(v_org);
  perform pg_temp.t_fail('22d set_cover with another organisation''s folder → cover_path_forbidden', 'authenticated', v_editor,
    format($q$select public.set_cover('events', %L, %L, null)$q$, v_cv_event, 'events/' || v_org_b || '/' || gen_random_uuid() || '.webp'),
    '^PT403 cover_path_forbidden');
  perform pg_temp.t_fail('22e direct update of events.cover_path → cover_write_forbidden', 'authenticated', v_editor,
    format($q$update public.events set cover_path = %L where id = %L$q$, 'events/' || v_org || '/' || gen_random_uuid() || '.webp', v_cv_event),
    '^PT403 cover_write_forbidden');
  perform pg_temp.t_fail('22f org B owner cannot set the cover of an org A event', 'authenticated', v_owner_b,
    format($q$select public.set_cover('events', %L, %L, null)$q$, v_cv_event, 'events/' || v_org || '/' || gen_random_uuid() || '.webp'),
    '^PT403 cover_forbidden');
  perform pg_temp.t_fail('22h anon cannot call set_cover', 'anon', null,
    format($q$select public.set_cover('events', %L, null, null)$q$, v_cv_event), '^42501');
  if to_regclass('storage.objects') is null then
    -- local dry-run only (the embedded/dev database has no storage schema); staging always has it
    perform pg_temp.t_rec('22 / 22b / 22c / 22g SKIPPED: no storage schema on this database', true, 'skipped');
  else
    v_cv_path := 'events/' || v_org || '/' || gen_random_uuid() || '.webp';
    insert into storage.objects (bucket_id, name) values ('covers', v_cv_path);
    begin
      v_n := pg_temp.t_val('anon', null, format(
        $q$select count(*)::text from storage.objects where bucket_id = 'covers' and name = %L$q$, v_cv_path))::int;
      perform pg_temp.t_rec('22 anon reads an object of the public covers bucket', v_n = 1, 'rows=' || v_n);
    exception when others then
      perform pg_temp.t_rec('22 anon reads an object of the public covers bucket', false, sqlstate || ' ' || sqlerrm);
    end;
    perform pg_temp.t_fail('22b org A editor cannot upload into org B''s covers folder', 'authenticated', v_editor,
      format($q$insert into storage.objects (bucket_id, name) values ('covers', %L)$q$, 'events/' || v_org_b || '/' || gen_random_uuid() || '.webp'),
      '^42501');
    select format('%s/%s/%s', b.public::text, b.file_size_limit, b.allowed_mime_types) into v_text from storage.buckets b where b.id = 'covers';
    perform pg_temp.t_rec('22c covers bucket: public, 2 MB, webp/jpeg/png only',
                          v_text = 'true/2097152/{image/webp,image/jpeg,image/png}', 'bucket=' || coalesce(v_text, 'missing'));
    -- control: own-folder upload of both sizes, then set_cover on a PUBLISHED event → back to review with a revision row
    begin
      v_cv_path := 'events/' || v_org || '/' || gen_random_uuid() || '.webp';
      v_n := pg_temp.t_val('authenticated', v_editor, format(
        $q$with i as (insert into storage.objects (bucket_id, name) values ('covers', %L), ('covers', %L) returning 1) select count(*)::text from i$q$,
        v_cv_path, replace(v_cv_path, '.webp', '-640.webp')))::int;
      perform pg_temp.t_val('authenticated', v_editor, format(
        $q$select 'ok' from public.set_cover('events', %L, %L, 'LEHV6nWB2yk8pyo0adR*.7kCMdnj')$q$, v_cv_event, v_cv_path));
      select e.status::text || ' ' || coalesce((select array_to_string(r.changed_fields, ',') from public.content_revisions r
                                                where r.entity_id = e.id order by r.id desc limit 1), 'no-revision')
        into v_text from public.events e where e.id = v_cv_event;
      perform pg_temp.t_rec('22g own-folder upload (2 files) + set_cover on a published event → in_review + revision (control)',
                            v_n = 2 and v_text = 'in_review cover_path', 'uploaded=' || v_n || ' ' || coalesce(v_text, 'null'));
    exception when others then
      perform pg_temp.t_rec('22g own-folder upload (2 files) + set_cover on a published event → in_review + revision (control)',
                            false, sqlstate || ' ' || sqlerrm);
    end;
  end if;

  -- ================================================================ report (always rolls back)
  select jsonb_build_object('pass', count(*) filter (where pass), 'fail', count(*) filter (where not pass),
                            'results', jsonb_agg(jsonb_build_object('t', name, 'ok', pass, 'd', detail) order by n))
    into v_out from t_results;
  raise exception 'REMOTE_RESULT %', v_out;
end $$;
