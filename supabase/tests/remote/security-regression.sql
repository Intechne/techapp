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
  v_pt_team uuid; v_pt_cap uuid; v_pt_minor uuid; v_pt_hidden uuid; v_pt_mem uuid; v_pt_proj uuid; v_ra_post uuid; v_ra_app uuid; v_ra_by uuid; v_ra_cols text;
  v_nt_team uuid; v_nt_id uuid; v_nt_cap uuid; v_nt_req uuid;
  v_tr_org uuid; v_tr_owner uuid; v_tr_editor uuid; v_tr_event uuid; v_tr_team uuid; v_tr_cap uuid; v_tr_minor uuid; v_tr_reg uuid; v_tr_mrow uuid;
  v_t2_cap uuid; v_t2_mentor uuid; v_t2_member uuid; v_t2_event uuid; v_t2_team uuid;
  v_t3_reg uuid; v_t3_caprow uuid; v_t3_memrow uuid; v_t3_capreg uuid;
  v_t4_reviewer uuid; v_t4_staff uuid; v_t4_member_status text;
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
  -- user decision 13 Nov 2026: team covers closed until legal review + photo policy; the team's own captain gets a dedicated code
  perform pg_temp.t_fail('22i team captain set_cover → team_cover_disabled (team covers closed, 13 Nov 2026)', 'authenticated', v_captain,
    format($q$select public.set_cover('teams', %L, %L, null)$q$, v_team, 'teams/' || v_team || '/' || gen_random_uuid() || '.webp'),
    '^PT403 team_cover_disabled');
  if to_regclass('storage.objects') is null then
    -- local dry-run only (the embedded/dev database has no storage schema); staging always has it
    perform pg_temp.t_rec('22 / 22b / 22c / 22g / 22j SKIPPED: no storage schema on this database', true, 'skipped');
  else
    v_cv_path := 'events/' || v_org || '/' || gen_random_uuid() || '.webp';
    insert into storage.objects (bucket_id, name) values ('covers', v_cv_path);
    -- Listing is owner-only. Bound covers are served by the public bucket URL (/storage/v1/object/public/covers/…), which does
    -- not go through these policies — that path is not testable in SQL (check it with curl after the push).
    begin
      v_n := pg_temp.t_val('anon', null, format(
        $q$select count(*)::text from storage.objects where bucket_id = 'covers' and name = %L$q$, v_cv_path))::int;
      v_text := pg_temp.t_val('authenticated', v_editor, format(
        $q$select count(*)::text from storage.objects where bucket_id = 'covers' and name = %L$q$, v_cv_path));
      perform pg_temp.t_rec('22 anon cannot list the covers bucket; the folder owner can', v_n = 0 and v_text = '1',
                            'anon_rows=' || v_n || ' owner_rows=' || coalesce(v_text, 'null'));
    exception when others then
      perform pg_temp.t_rec('22 anon cannot list the covers bucket; the folder owner can', false, sqlstate || ' ' || sqlerrm);
    end;
    perform pg_temp.t_fail('22b org A editor cannot upload into org B''s covers folder', 'authenticated', v_editor,
      format($q$insert into storage.objects (bucket_id, name) values ('covers', %L)$q$, 'events/' || v_org_b || '/' || gen_random_uuid() || '.webp'),
      '^42501');
    perform pg_temp.t_fail('22j team captain upload into the team''s covers folder → team_cover_disabled', 'authenticated', v_captain,
      format($q$insert into storage.objects (bucket_id, name) values ('covers', %L)$q$, 'teams/' || v_team || '/' || gen_random_uuid() || '.webp'),
      '^PT403 team_cover_disabled');
    select format('%s/%s/%s', b.public::text, b.file_size_limit, b.allowed_mime_types) into v_text from storage.buckets b where b.id = 'covers';
    perform pg_temp.t_rec('22c covers bucket: public, 2 MB, image/webp only',
                          v_text = 'true/2097152/{image/webp}', 'bucket=' || coalesce(v_text, 'missing'));
    -- MUST PASS before the covers migration is accepted on any project: set_cover verifies the uploaded files by reading
    -- storage.objects as its owner, and storage.objects SELECT is owner-folder only. That works only if the owner bypasses RLS.
    select format('%s/%s', r.rolname, r.rolbypassrls or r.rolsuper) into v_text
      from pg_proc p join pg_roles r on r.oid = p.proowner
     where p.oid = 'public.set_cover(text, uuid, text, text)'::regprocedure;
    perform pg_temp.t_rec('22k set_cover owner bypasses RLS on storage.objects (MUST PASS — else every cover bind fails)',
                          split_part(v_text, '/', 2) = 't', 'owner=' || coalesce(v_text, 'missing'));
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
      perform pg_temp.t_rec('22g own-folder upload (2 files) + set_cover on a published event → in_review + revision (control, MUST PASS)',
                            v_n = 2 and v_text = 'in_review cover_path', 'uploaded=' || v_n || ' ' || coalesce(v_text, 'null'));
    exception when others then
      perform pg_temp.t_rec('22g own-folder upload (2 files) + set_cover on a published event → in_review + revision (control, MUST PASS)',
                            false, sqlstate || ' ' || sqlerrm);
    end;
  end if;

  -- 20261113000200: team profile — a minor's name never leaves the team; projects are written by captains/mentors via RPC only.
  -- Team founded by a 16-year-old (captain); + an 18+ discoverable captain, an 18+ NON-discoverable mentor, an adult member.
  v_pt_minor := pg_temp.t_user(16, 'Remote Reşit Olmayan Kaptan'); v_pt_cap := pg_temp.t_user(30, 'Remote Açık Kaptan');
  v_pt_hidden := pg_temp.t_user(35, 'Remote Gizli Mentor'); v_pt_mem := pg_temp.t_user(20, 'Remote Üye');
  perform pg_temp.t_val('authenticated', v_pt_cap,
    format('update public.profiles set discoverable = true where id = %L returning id::text', v_pt_cap));
  v_pt_team := (pg_temp.t_val('authenticated', v_pt_minor, $q$select (public.create_team('Remote Profil Takımı')).id::text$q$))::uuid;
  insert into public.team_memberships (team_id, user_id, role, status)
  values (v_pt_team, v_pt_cap, 'captain', 'active'), (v_pt_team, v_pt_hidden, 'mentor', 'active'), (v_pt_team, v_pt_mem, 'member', 'active');
  begin
    j := (pg_temp.t_val('anon', null, format('select public.team_public_profile(%L)::text', v_pt_team)))::jsonb;
    perform pg_temp.t_rec('23 anon team_public_profile: only the 18+ discoverable captain is named (no minor, no hidden adult, no ids)',
      j -> 'leaders' = '[{"display_name": "Remote Açık Kaptan", "role": "captain"}]'::jsonb
        and j::text !~ '(Reşit Olmayan|Gizli Mentor|Remote Üye)'
        and strpos(j::text, v_pt_minor::text) = 0 and strpos(j::text, v_pt_cap::text) = 0
        and (j -> 'role_counts' ->> 'captain')::int + (j -> 'role_counts' ->> 'mentor')::int + (j -> 'role_counts' ->> 'member')::int
            = (j ->> 'member_count')::int and (j ->> 'member_count')::int = 4,
      j::text);
  exception when others then
    perform pg_temp.t_rec('23 anon team_public_profile: only the 18+ discoverable captain is named (no minor, no hidden adult, no ids)',
                          false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    v_pt_proj := (pg_temp.t_val('authenticated', v_pt_cap, format(
      $q$select (public.upsert_team_project(%L, null, 'Remote Proje', null, 2026, 'https://example.org/p')).id::text$q$, v_pt_team)))::uuid;
    v_n := pg_temp.t_val('anon', null, format('select count(*)::text from public.team_projects where team_id = %L', v_pt_team))::int;
    perform pg_temp.t_rec('23b captain adds a project via RPC; anon reads it on the active team (control)', v_n = 1, 'rows=' || v_n);
  exception when others then
    perform pg_temp.t_rec('23b captain adds a project via RPC; anon reads it on the active team (control)', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('23c plain member upsert_team_project → 403', 'authenticated', v_pt_mem,
    format($q$select public.upsert_team_project(%L, null, 'Üye projesi', null, 2026, null)$q$, v_pt_team), '^PT403 team_manage_forbidden');
  perform pg_temp.t_fail('23d outsider upsert_team_project → 403', 'authenticated', v_other,
    format($q$select public.upsert_team_project(%L, null, 'Dış proje', null, 2026, null)$q$, v_pt_team), '^PT403 team_manage_forbidden');
  perform pg_temp.t_fail('23e captain direct insert into team_projects → permission denied', 'authenticated', v_pt_cap,
    format($q$insert into public.team_projects (team_id, title) values (%L, 'Doğrudan')$q$, v_pt_team), '^42501');
  perform pg_temp.t_fail('23f anon cannot call upsert_team_project', 'anon', null,
    format($q$select public.upsert_team_project(%L, null, 'Anon', null, 2026, null)$q$, v_pt_team), '^42501');
  perform pg_temp.t_fail('23g javascript: link → 422 team_project_url_invalid', 'authenticated', v_pt_cap,
    format($q$select public.upsert_team_project(%L, null, 'Bağlantı', null, 2026, 'javascript:alert(1)')$q$, v_pt_team),
    '^PT422 team_project_url_invalid');
  update public.teams set moderation_status = 'suspended' where id = v_pt_team;
  perform pg_temp.t_fail('23h suspended team: anon team_public_profile → 404', 'anon', null,
    format('select public.team_public_profile(%L)', v_pt_team), '^PT404 team_not_found');
  begin
    v_n := pg_temp.t_val('anon', null, format('select count(*)::text from public.team_projects where team_id = %L', v_pt_team))::int
         + pg_temp.t_val('authenticated', v_other, format('select count(*)::text from public.team_projects where team_id = %L', v_pt_team))::int;
    perform pg_temp.t_rec('23i suspended team: anon and outsiders read 0 projects', v_n = 0, 'rows=' || v_n);
  exception when others then
    perform pg_temp.t_rec('23i suspended team: anon and outsiders read 0 projects', false, sqlstate || ' ' || sqlerrm);
  end;


  -- 20261113000300: managers see WHO applied (name + is_minor, never ids); recruitment_posts.created_by is server-set.
  begin
    v_ra_post := (pg_temp.t_val('authenticated', v_pt_cap, format(
      $q$insert into public.recruitment_posts (team_id, title, created_by) values (%L, 'Remote ilan', %L) returning id::text$q$, v_pt_team, v_pt_minor)))::uuid;
    select created_by into v_ra_by from public.recruitment_posts where id = v_ra_post;
    perform pg_temp.t_rec('24 created_by is forced to the inserting manager (spoofed value ignored)', v_ra_by = v_pt_cap, coalesce(v_ra_by::text, 'null'));
  exception when others then
    perform pg_temp.t_rec('24 created_by is forced to the inserting manager (spoofed value ignored)', false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    perform pg_temp.t_val('authenticated', v_other, format($q$select public.apply_to_recruitment(%L, 'Merhaba')::text$q$, v_ra_post));
  exception when others then null; -- an applicant row for the checks below; failure shows up in 24b
  end;
  begin
    v_ra_cols := (pg_temp.t_val('authenticated', v_pt_cap, format(
      $q$select string_agg(k, ',' order by k) from (select jsonb_object_keys(to_jsonb(r)) k from public.team_recruitment_applications(%L) r limit 6) z$q$, v_ra_post)));
    perform pg_temp.t_rec('24b manager reads applicants: no user_id column (name + is_minor only)',
      v_ra_cols is not null and v_ra_cols !~ 'user_id' and v_ra_cols ~ 'display_name' and v_ra_cols ~ 'is_minor', coalesce(v_ra_cols, 'null'));
  exception when others then
    perform pg_temp.t_rec('24b manager reads applicants: no user_id column (name + is_minor only)', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('24c non-manager (plain member) team_recruitment_applications → 403', 'authenticated', v_pt_mem,
    format('select * from public.team_recruitment_applications(%L)', v_ra_post), '^PT403 team_manage_forbidden');
  perform pg_temp.t_fail('24c outsider team_recruitment_applications → 403', 'authenticated', v_other,
    format('select * from public.team_recruitment_applications(%L)', v_ra_post), '^PT403 team_manage_forbidden');
  perform pg_temp.t_fail('24c anon cannot call team_recruitment_applications', 'anon', null,
    format('select * from public.team_recruitment_applications(%L)', v_ra_post), '^42501');

  -- 20261113000400: in-app notifications — own rows only, no direct write path, copy without PII, preferences own-row, cron.
  -- A fresh team (v_pt_team is suspended above): an adult captain, a 16-year-old requester → captain gets team_join.requested.
  v_nt_cap := pg_temp.t_user(30, 'Remote Bildirim Kaptanı'); v_nt_req := pg_temp.t_user(16, 'Remote Bildirim İsteyen');
  begin
    v_nt_team := (pg_temp.t_val('authenticated', v_nt_cap, $q$select (public.create_team('Remote Bildirim Takımı')).id::text$q$))::uuid;
    perform pg_temp.t_val('authenticated', v_nt_req, format($q$select (public.request_team_join(%L, 'Merhaba')).id::text$q$, v_nt_team));
    select n.id, n.title || ' ' || coalesce(n.body, '') into v_nt_id, v_text from public.notifications n
     where n.user_id = v_nt_cap and n.kind = 'team_join.requested' and n.target_id = v_nt_team;
    perform pg_temp.t_rec('25 join request → captain gets team_join.requested with the team name, no requester name (control, MUST PASS)',
      v_nt_id is not null and v_text ~ 'Remote Bildirim Takımı' and v_text !~ '(İsteyen|@)', coalesce(v_text, 'no row'));
  exception when others then
    perform pg_temp.t_rec('25 join request → captain gets team_join.requested with the team name, no requester name (control, MUST PASS)',
                          false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    v_n := pg_temp.t_val('authenticated', v_other, format('select count(*)::text from public.notifications where user_id = %L', v_nt_cap))::int;
    perform pg_temp.t_rec('25b another user reads 0 of my notifications', v_n = 0, 'rows=' || v_n);
    v_n := pg_temp.t_val('authenticated', v_other, format('select public.mark_notifications_read(array[%L]::uuid[])::text', v_nt_id))::int;
    select count(*) into i from public.notifications where id = v_nt_id and read_at is null;
    perform pg_temp.t_rec('25c another user mark_notifications_read(my id) → 0, my row stays unread', v_n = 0 and i = 1,
                          'marked=' || v_n || ' still_unread=' || i);
  exception when others then
    perform pg_temp.t_rec('25b/25c cross-user read/mark', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('25d owner direct update of notifications → permission denied (never notification_read_only)', 'authenticated', v_nt_cap,
    format('update public.notifications set read_at = now() where id = %L', v_nt_id), '^42501');
  perform pg_temp.t_fail('25e user direct insert into notifications → permission denied', 'authenticated', v_nt_cap,
    format($q$insert into public.notifications (user_id, kind, title) values (%L, 'registration.confirmed', 'Sahte')$q$, v_nt_cap), '^42501');
  perform pg_temp.t_fail('25f anon cannot call mark_notifications_read', 'anon', null, 'select public.mark_notifications_read()', '^42501');
  begin
    v_n := pg_temp.t_val('authenticated', v_nt_cap, 'select public.mark_notifications_read()::text')::int;
    perform pg_temp.t_rec('25g owner marks own notifications read via RPC (control)', v_n >= 1, 'marked=' || v_n);
  exception when others then
    perform pg_temp.t_rec('25g owner marks own notifications read via RPC (control)', false, sqlstate || ' ' || sqlerrm);
  end;
  select count(*) into v_n from unnest(app.notification_kinds()) k, app.notification_copy(k, 'Remote İçerik') c
   where c.title || ' ' || c.body ~ '[@!]';
  select count(*) into i from unnest(app.notification_kinds()) k, app.notification_copy(k, 'Remote İçerik') c;
  perform pg_temp.t_rec('25h notification_copy: every kind has copy, none contains @ or !', v_n = 0 and i = 18,  -- 13 + 5 team_registration.* (20261113000700)
                        'kinds_with_copy=' || i || ' bad=' || v_n);
  begin
    select string_agg(k || '=' || c.title || ' ' || c.body, ' | ' order by k) into v_text
      from unnest(array['registration.promoted_pending', 'guardian.revoked']) k, app.notification_copy(k, 'Remote İçerik') c;
    perform pg_temp.t_rec('25k new kinds registration.promoted_pending + guardian.revoked have copy without @',
      v_text ~ 'registration\.promoted_pending=' and v_text ~ 'guardian\.revoked=' and v_text !~ '@', coalesce(v_text, 'missing'));
  exception when others then
    perform pg_temp.t_rec('25k new kinds registration.promoted_pending + guardian.revoked have copy without @', false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    v_text := pg_temp.t_val('authenticated', v_nt_cap, 'select (public.set_notification_preferences(false)).event_reminders::text');
    v_n := pg_temp.t_val('authenticated', v_other, format('select count(*)::text from public.notification_preferences where user_id = %L', v_nt_cap))::int;
    perform pg_temp.t_rec('25i preferences: own write via RPC; another user reads 0 of them', v_text = 'false' and v_n = 0,
                          'own=' || coalesce(v_text, 'null') || ' other_rows=' || v_n);
  exception when others then
    perform pg_temp.t_rec('25i preferences: own write via RPC; another user reads 0 of them', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('25i direct insert into notification_preferences → permission denied', 'authenticated', v_other,
    format('insert into public.notification_preferences (user_id, event_reminders) values (%L, false)', v_other), '^42501');
  if to_regclass('cron.job') is null then
    perform pg_temp.t_rec('25j cron jobs (pg_cron not installed here — n/a)', true, 'no cron.job');
  else
    execute $q$select string_agg(jobname || ' ' || schedule, ', ' order by jobname) from cron.job
               where jobname in ('techapp-event-reminders', 'techapp-prune-notifications')$q$ into v_text;
    perform pg_temp.t_rec('25j cron: techapp-event-reminders */15 and techapp-prune-notifications scheduled',
      v_text ~ 'techapp-event-reminders \*/15 \* \* \* \*' and v_text ~ 'techapp-prune-notifications ', coalesce(v_text, 'missing'));
  end if;

  -- 20261113000500: team event registration — schema only (no RPCs yet). Rows readable by the team's active members, the
  -- event organisation's owner|admin|reviewer|checkin_staff and platform admins; no client write path; team counters locked;
  -- team members' own registrations never count toward the individual pool. Fixtures are written by the fixture user.
  v_tr_owner := pg_temp.t_user(35, 'Remote Takım Kurum'); v_tr_editor := pg_temp.t_user(33);
  v_tr_cap := pg_temp.t_user(30, 'Remote Takım Kaptanı'); v_tr_minor := pg_temp.t_user(15, 'Remote Takım Üyesi');
  v_tr_org := pg_temp.t_org();
  insert into public.organization_members (organization_id, user_id, role) values (v_tr_org, v_tr_owner, 'owner'), (v_tr_org, v_tr_editor, 'editor');
  v_tr_event := pg_temp.t_event(v_tr_org);
  update public.events set registration_mode = 'both', team_capacity = 4, team_min_size = 2, team_max_size = 5 where id = v_tr_event;
  begin
    v_tr_team := (pg_temp.t_val('authenticated', v_tr_cap, $q$select (public.create_team('Remote Kayıt Takımı')).id::text$q$))::uuid;
    insert into public.team_memberships (team_id, user_id, role, status) values (v_tr_team, v_tr_minor, 'member', 'active');
    v_tr_reg := gen_random_uuid();
    insert into public.team_event_registrations (id, event_id, team_id, status, submitted_by, idempotency_key, hold_expires_at)
    values (v_tr_reg, v_tr_event, v_tr_team, 'pending_members', v_tr_cap, gen_random_uuid(), now() + interval '7 days');
    insert into public.team_event_registration_members (team_registration_id, user_id, role_at_submit, roster_version, state)
    values (v_tr_reg, v_tr_cap, 'captain', 1, 'invited'), (v_tr_reg, v_tr_minor, 'member', 1, 'invited');
    select id into v_tr_mrow from public.team_event_registration_members where team_registration_id = v_tr_reg and user_id = v_tr_minor;
    v_n := pg_temp.t_val('authenticated', v_tr_minor, 'select count(*)::text from public.team_event_registrations')::int
         + pg_temp.t_val('authenticated', v_tr_minor, 'select count(*)::text from public.team_event_registration_members')::int;
    i := pg_temp.t_val('authenticated', v_tr_owner, format('select count(*)::text from public.team_event_registration_members where team_registration_id = %L', v_tr_reg))::int;
    perform pg_temp.t_rec('26 team member reads own team row + roster (3), organiser owner reads the roster (2) (control, MUST PASS)',
                          v_n = 3 and i = 2, 'member_rows=' || v_n || ' owner_roster=' || i);
  exception when others then
    perform pg_temp.t_rec('26 team member reads own team row + roster (3), organiser owner reads the roster (2) (control, MUST PASS)',
                          false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('26a anon cannot read team_event_registrations → permission denied (no grant)', 'anon', null,
    'select count(*) from public.team_event_registrations', '^42501');
  perform pg_temp.t_fail('26a anon cannot read team_event_registration_members → permission denied (no grant)', 'anon', null,
    'select count(*) from public.team_event_registration_members', '^42501');
  begin
    v_n := pg_temp.t_val('authenticated', v_other, format('select count(*)::text from public.team_event_registrations where id = %L', v_tr_reg))::int
         + pg_temp.t_val('authenticated', v_other, format('select count(*)::text from public.team_event_registration_members where team_registration_id = %L', v_tr_reg))::int
         + pg_temp.t_val('authenticated', v_tr_editor, format('select count(*)::text from public.team_event_registration_members where team_registration_id = %L', v_tr_reg))::int;
    perform pg_temp.t_rec('26b non-member and org editor read 0 team rows / roster rows', v_n = 0, 'rows=' || v_n);
  exception when others then
    perform pg_temp.t_rec('26b non-member and org editor read 0 team rows / roster rows', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('26c captain direct insert into team_event_registrations → permission denied', 'authenticated', v_tr_cap,
    format($q$insert into public.team_event_registrations (event_id, team_id, status, submitted_by, idempotency_key, hold_expires_at)
              values (%L, %L, 'confirmed', %L, gen_random_uuid(), now())$q$, v_tr_event, v_tr_team, v_tr_cap), '^42501');
  perform pg_temp.t_fail('26d organiser owner direct update of team_event_registrations → permission denied', 'authenticated', v_tr_owner,
    format($q$update public.team_event_registrations set status = 'confirmed' where id = %L$q$, v_tr_reg), '^42501');
  perform pg_temp.t_fail('26e member direct update of own roster row → permission denied', 'authenticated', v_tr_minor,
    format($q$update public.team_event_registration_members set state = 'declined' where id = %L$q$, v_tr_mrow), '^42501');
  perform pg_temp.t_fail('26f org editor writes teams_taken → 403 event_counters_locked', 'authenticated', v_tr_editor,
    format('update public.events set teams_taken = 9 where id = %L', v_tr_event), '^PT403 event_counters_locked');
  perform pg_temp.t_fail('26f org editor writes team_waitlist_count → 403 event_counters_locked', 'authenticated', v_tr_editor,
    format('update public.events set team_waitlist_count = 9 where id = %L', v_tr_event), '^PT403 event_counters_locked');
  begin
    -- an accepted member's own registration (team_registration_id set) → the team pool counts, the individual pool does not
    insert into public.event_registrations (event_id, user_id, status, idempotency_key, team_registration_id, confirmed_at)
    values (v_tr_event, v_tr_cap, 'confirmed', gen_random_uuid(), v_tr_reg, now());
    select seats_taken, teams_taken into v_n, i from public.events where id = v_tr_event;
    perform pg_temp.t_rec('26g team member registration: seats_taken 0, teams_taken 1 (pools independent)', v_n = 0 and i = 1,
                          'seats_taken=' || v_n || ' teams_taken=' || i);
  exception when others then
    perform pg_temp.t_rec('26g team member registration: seats_taken 0, teams_taken 1 (pools independent)', false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    select string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'execute')::text || '/'
                      || has_function_privilege('authenticated', p.oid, 'execute')::text, ' ' order by p.proname) into v_text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname in ('is_team_registration_member', 'is_team_registration_staff', 'recount_team_event');
    perform pg_temp.t_rec('26h app helpers: RLS helpers authenticated-only, recount_team_event not callable by API roles',
      v_text = 'is_team_registration_member=false/true is_team_registration_staff=false/true recount_team_event=false/false', coalesce(v_text, 'missing'));
  end;

  -- 20261113000600: submit_team_registration — an ACTIVE captain or mentor submits (here: the mentor, not on the roster);
  -- a plain member → 403 not_team_manager; anon cannot call it; the tables still have no client write path.
  v_t2_cap := pg_temp.t_user(30, 'Remote Gönderen Kaptan'); v_t2_mentor := pg_temp.t_user(40, 'Remote Mentor');
  v_t2_member := pg_temp.t_user(16, 'Remote Gönderim Üyesi');
  v_t2_event := pg_temp.t_event(v_tr_org);
  update public.events set registration_mode = 'team', team_capacity = 2, team_min_size = 2, team_max_size = 4 where id = v_t2_event;
  begin
    v_t2_team := (pg_temp.t_val('authenticated', v_t2_cap, $q$select (public.create_team('Remote Gönderim Takımı')).id::text$q$))::uuid;
    insert into public.team_memberships (team_id, user_id, role, status)
    values (v_t2_team, v_t2_mentor, 'mentor', 'active'), (v_t2_team, v_t2_member, 'member', 'active');
  exception when others then
    perform pg_temp.t_rec('27 fixture: team with captain + mentor + member', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('27a plain member submits → 403 not_team_manager', 'authenticated', v_t2_member,
    format('select public.submit_team_registration(%L, %L, array[%L, %L]::uuid[], gen_random_uuid())', v_t2_event, v_t2_team, v_t2_cap, v_t2_member),
    '^PT403 not_team_manager');
  perform pg_temp.t_fail('27b anon cannot call submit_team_registration → permission denied', 'anon', null,
    format('select public.submit_team_registration(%L, %L, array[%L]::uuid[], gen_random_uuid())', v_t2_event, v_t2_team, v_t2_cap), '^42501');
  begin
    v_text := pg_temp.t_val('authenticated', v_t2_mentor,
      format('select (public.submit_team_registration(%L, %L, array[%L, %L]::uuid[], gen_random_uuid())).status::text',
             v_t2_event, v_t2_team, v_t2_cap, v_t2_member));
    select teams_taken, (select count(*) from public.team_event_registration_members tm
                         join public.team_event_registrations t on t.id = tm.team_registration_id
                         where t.event_id = v_t2_event and tm.state = 'invited')
      into i, v_n from public.events where id = v_t2_event;
    perform pg_temp.t_rec('27 mentor submits 2 members → pending_members, 2 invited, teams_taken 1 (control, MUST PASS)',
      v_text = 'pending_members' and i = 1 and v_n = 2, 'status=' || coalesce(v_text, 'null') || ' teams_taken=' || i || ' invited=' || v_n);
  exception when others then
    perform pg_temp.t_rec('27 mentor submits 2 members → pending_members, 2 invited, teams_taken 1 (control, MUST PASS)', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('27c captain direct insert into team_event_registrations still denied after the RPC exists', 'authenticated', v_t2_cap,
    format($q$insert into public.team_event_registrations (event_id, team_id, status, submitted_by, idempotency_key, hold_expires_at)
              values (%L, %L, 'confirmed', %L, gen_random_uuid(), now())$q$, v_t2_event, v_tr_team, v_t2_cap), '^42501');
  begin
    j := pg_temp.t_val('authenticated', v_t2_mentor, format('select public.event_eligibility(%L)::text', v_t2_event))::jsonb;
    v_n := jsonb_array_length(pg_temp.t_val('authenticated', v_t2_member, format('select public.event_eligibility(%L)::text', v_t2_event))::jsonb -> 'manageable_teams');
    perform pg_temp.t_rec('27d event_eligibility: mentor manages the team (3 active, live registration), plain member manages none',
      j ->> 'registration_mode' = 'team' and (j ->> 'team_seats_left')::int = 1 and jsonb_array_length(j -> 'manageable_teams') = 1
        and (j -> 'manageable_teams' -> 0 ->> 'team_id')::uuid = v_t2_team and (j -> 'manageable_teams' -> 0 ->> 'active_member_count')::int = 3
        and j -> 'manageable_teams' -> 0 ->> 'registration_status' = 'pending_members' and v_n = 0,
      left(j::text, 300) || ' member_manageable=' || v_n);
  exception when others then
    perform pg_temp.t_rec('27d event_eligibility: mentor manages the team (3 active, live registration), plain member manages none', false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    select string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'execute')::text || '/'
                      || has_function_privilege('authenticated', p.oid, 'execute')::text, ' ' order by p.proname) into v_text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname = 'public' and p.proname = 'submit_team_registration') or (n.nspname = 'app' and p.proname = 'promote_team_waitlist');
    perform pg_temp.t_rec('27e grants: submit_team_registration authenticated-only, promote_team_waitlist not callable by API roles',
      v_text = 'promote_team_waitlist=false/false submit_team_registration=false/true', coalesce(v_text, 'missing'));
  end;
  -- block 26's 15-year-old is invited on a live team roster of a 'both' event → no individual registration on top of it
  perform pg_temp.t_fail('27f invited roster member registers individually for the same event → 409 already_on_team_roster', 'authenticated', v_tr_minor,
    format('select public.register_for_event(%L, gen_random_uuid())', v_tr_event), '^PT409 already_on_team_roster');

  -- 20261113000700: team registration lifecycle on block 27's registration (mentor submitted captain + 16-year-old member).
  -- Nobody answers for someone else; a stale roster version is refused; a member of an unconfirmed team gets no card; the
  -- detail payload has no e-mail / birth date / guardian field; the expiry job is scheduled where pg_cron exists.
  begin
    select id into v_t3_reg from public.team_event_registrations where event_id = v_t2_event and team_id = v_t2_team;
    select id into v_t3_caprow from public.team_event_registration_members where team_registration_id = v_t3_reg and user_id = v_t2_cap;
    select id into v_t3_memrow from public.team_event_registration_members where team_registration_id = v_t3_reg and user_id = v_t2_member;
    j := pg_temp.t_val('authenticated', v_t2_cap,
      format('select public.respond_team_registration(%L, true, gen_random_uuid())::text', v_t3_caprow))::jsonb;
    v_t3_capreg := (j ->> 'registration_id')::uuid;
    perform pg_temp.t_rec('28 captain accepts own invite → own registration confirmed, team still pending_members (control, MUST PASS)',
      j ->> 'member_state' = 'accepted' and j ->> 'registration_status' = 'confirmed' and j ->> 'team_status' = 'pending_members'
        and (select team_registration_id from public.event_registrations where id = v_t3_capreg) = v_t3_reg, left(j::text, 300));
  exception when others then
    perform pg_temp.t_rec('28 captain accepts own invite → own registration confirmed, team still pending_members (control, MUST PASS)', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('28a captain answers the member''s invite → 403 not_invite_owner', 'authenticated', v_t2_cap,
    format('select public.respond_team_registration(%L, true, gen_random_uuid())', v_t3_memrow), '^PT403 not_invite_owner');
  perform pg_temp.t_fail('28b mentor edits the roster with a stale version → 409 roster_changed', 'authenticated', v_t2_mentor,
    format('select public.update_team_roster(%L, array[%L, %L]::uuid[], 99)', v_t3_reg, v_t2_cap, v_t2_member), '^PT409 roster_changed');
  perform pg_temp.t_fail('28c confirmed member of an unconfirmed team asks for the card → 409 team_registration_not_confirmed', 'authenticated', v_t2_cap,
    format('select public.get_participation_card(%L)', v_t3_capreg), '^PT409 team_registration_not_confirmed');
  begin
    v_text := pg_temp.t_val('authenticated', v_t2_member, format('select public.team_registration_detail(%L)::text', v_t3_reg));
    perform pg_temp.t_rec('28d team_registration_detail (member, 16): 2 members, no email / birth / guardian field or @',
      jsonb_array_length(v_text::jsonb -> 'members') = 2 and v_text !~* '(email|birth|guardian_|@)', left(v_text, 300));
  exception when others then
    perform pg_temp.t_rec('28d team_registration_detail (member, 16): 2 members, no email / birth / guardian field or @', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('28d an outsider reads the detail → 404 team_registration_not_found', 'authenticated', v_other,
    format('select public.team_registration_detail(%L)', v_t3_reg), '^PT404 team_registration_not_found');
  if to_regclass('cron.job') is null then
    perform pg_temp.t_rec('28e cron: techapp-expire-team-registrations (pg_cron not installed here — n/a; MUST PASS on staging)', true, 'no cron.job');
  else
    execute $q$select string_agg(jobname || ' ' || schedule, ', ') from cron.job where jobname = 'techapp-expire-team-registrations'$q$ into v_text;
    perform pg_temp.t_rec('28e cron: techapp-expire-team-registrations */10 scheduled (MUST PASS on staging)',
      coalesce(v_text, '') ~ '^techapp-expire-team-registrations \*/10 \* \* \* \*$', coalesce(v_text, 'missing'));
  end if;
  begin
    select string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'execute')::text || '/'
                      || has_function_privilege('authenticated', p.oid, 'execute')::text, ' ' order by p.proname) into v_text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname = 'public' and p.proname in ('respond_team_registration', 'update_team_roster', 'cancel_team_registration',
                                                   'team_registration_detail', 'my_team_registration_invites'))
        or (n.nspname = 'app' and p.proname in ('recompute_team_registration', 'expire_team_registrations'));
    perform pg_temp.t_rec('28f grants: the five lifecycle RPCs authenticated-only; recompute / expire not callable by API roles',
      v_text = 'cancel_team_registration=false/true expire_team_registrations=false/false my_team_registration_invites=false/true '
               'recompute_team_registration=false/false respond_team_registration=false/true team_registration_detail=false/true '
               'update_team_roster=false/true', coalesce(v_text, 'missing'));
  end;

  -- 20261113000800: organiser side on block 27/28's registration (team pending_members; the captain accepted, the 16-year-old
  -- is still invited). Only the event organisation's owner|admin|reviewer (and platform admins) list / decide; checkin_staff,
  -- another organisation, a non-member and anon do not; the list has no e-mail / birth date / guardian key; tables keep no
  -- client write path; counters stay server-owned; a team member is a "confirmed participant" only once the TEAM is confirmed.
  v_t4_reviewer := pg_temp.t_user(36, 'Remote Değerlendirici'); v_t4_staff := pg_temp.t_user(31);
  insert into public.organization_members (organization_id, user_id, role)
  values (v_tr_org, v_t4_reviewer, 'reviewer'), (v_tr_org, v_t4_staff, 'checkin_staff');
  begin
    v_text := pg_temp.t_val('authenticated', v_tr_owner,
      format('select coalesce(jsonb_agg(j), ''[]'')::text from public.admin_event_team_registrations(%L) j', v_t2_event));
    j := v_text::jsonb;
    perform pg_temp.t_rec('29 organiser owner lists the team: 1 row, roster_size 2, ready_count 1, 2 members (control, MUST PASS)',
      jsonb_array_length(j) = 1 and (j -> 0 ->> 'id')::uuid = v_t3_reg and (j -> 0 ->> 'roster_size')::int = 2
        and (j -> 0 ->> 'ready_count')::int = 1 and jsonb_array_length(j -> 0 -> 'members') = 2, left(v_text, 300));
    perform pg_temp.t_rec('29d organiser list: no e-mail / birth / guardian / phone / user_id key and no @ anywhere',
      v_text !~* '"\w*(birth|email|guardian|phone|user_id)\w*"\s*:' and position('@' in v_text) = 0, left(v_text, 300));
  exception when others then
    perform pg_temp.t_rec('29 organiser owner lists the team: 1 row, roster_size 2, ready_count 1, 2 members (control, MUST PASS)', false, sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.t_fail('29a anon cannot call admin_event_team_registrations → permission denied', 'anon', null,
    format('select * from public.admin_event_team_registrations(%L)', v_t2_event), '^42501');
  perform pg_temp.t_fail('29a anon cannot call review_team_registration → permission denied', 'anon', null,
    format('select public.review_team_registration(%L, true)', v_t3_reg), '^42501');
  perform pg_temp.t_fail('29b signed-in non-member lists → 403 forbidden', 'authenticated', v_other,
    format('select * from public.admin_event_team_registrations(%L)', v_t2_event), '^PT403 forbidden');
  perform pg_temp.t_fail('29b another organisation''s owner lists → 403 forbidden', 'authenticated', v_owner_b,
    format('select * from public.admin_event_team_registrations(%L)', v_t2_event), '^PT403 forbidden');
  perform pg_temp.t_fail('29b another organisation''s owner decides → 403 review_forbidden', 'authenticated', v_owner_b,
    format('select public.review_team_registration(%L, false)', v_t3_reg), '^PT403 review_forbidden');
  perform pg_temp.t_fail('29c checkin_staff of the event organisation lists → 403 forbidden', 'authenticated', v_t4_staff,
    format('select * from public.admin_event_team_registrations(%L)', v_t2_event), '^PT403 forbidden');
  perform pg_temp.t_fail('29c checkin_staff of the event organisation decides → 403 review_forbidden', 'authenticated', v_t4_staff,
    format('select public.review_team_registration(%L, true)', v_t3_reg), '^PT403 review_forbidden');
  perform pg_temp.t_fail('29e reviewer decides a pending_members team → 409 team_registration_not_pending_review', 'authenticated', v_t4_reviewer,
    format('select public.review_team_registration(%L, true)', v_t3_reg), '^PT409 team_registration_not_pending_review');
  perform pg_temp.t_fail('29f reviewer direct update of team_event_registrations → permission denied', 'authenticated', v_t4_reviewer,
    format($q$update public.team_event_registrations set status = 'confirmed' where id = %L$q$, v_t3_reg), '^42501');
  perform pg_temp.t_fail('29f reviewer direct update of a roster row → permission denied', 'authenticated', v_t4_reviewer,
    format($q$update public.team_event_registration_members set state = 'accepted' where id = %L$q$, v_t3_memrow), '^42501');
  perform pg_temp.t_fail('29g organiser owner writes teams_taken → 403 event_counters_locked', 'authenticated', v_tr_owner,
    format('update public.events set teams_taken = 0 where id = %L', v_t2_event), '^PT403 event_counters_locked');
  begin
    v_n := pg_temp.t_val('authenticated', v_tr_owner, format('select count(*)::text from public.admin_event_registrations(%L)', v_t2_event))::int;
    perform pg_temp.t_rec('29h admin_event_registrations leaves out the captain''s confirmed registration while the team is not confirmed',
      v_n = 0, 'rows=' || v_n);
  exception when others then
    perform pg_temp.t_rec('29h admin_event_registrations leaves out the captain''s confirmed registration while the team is not confirmed', false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    -- fixture: the team waits for the organiser (as on a requires_review event)
    update public.team_event_registrations set status = 'pending_review', status_reason = 'members_ready' where id = v_t3_reg;
    v_text := pg_temp.t_val('authenticated', v_t4_reviewer, format('select (public.review_team_registration(%L, false)).status::text', v_t3_reg));
    select teams_taken into i from public.events where id = v_t2_event;
    select r.status::text into v_t4_member_status from public.event_registrations r where r.id = v_t3_capreg;
    perform pg_temp.t_rec('29i reviewer rejects a pending_review team → rejected, member registration rejected, teams_taken 0 (MUST PASS)',
      v_text = 'rejected' and v_t4_member_status = 'rejected' and i = 0,
      'status=' || coalesce(v_text, 'null') || ' member=' || coalesce(v_t4_member_status, 'null') || ' teams_taken=' || i);
  exception when others then
    perform pg_temp.t_rec('29i reviewer rejects a pending_review team → rejected, member registration rejected, teams_taken 0 (MUST PASS)', false, sqlstate || ' ' || sqlerrm);
  end;
  begin
    select string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'execute')::text || '/'
                      || has_function_privilege('authenticated', p.oid, 'execute')::text, ' ' order by p.proname) into v_text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('admin_event_team_registrations', 'review_team_registration');
    perform pg_temp.t_rec('29j grants: admin_event_team_registrations / review_team_registration authenticated-only',
      v_text = 'admin_event_team_registrations=false/true review_team_registration=false/true', coalesce(v_text, 'missing'));
  end;

  -- ================================================================ report (always rolls back)
  select jsonb_build_object('pass', count(*) filter (where pass), 'fail', count(*) filter (where not pass),
                            'results', jsonb_agg(jsonb_build_object('t', name, 'ok', pass, 'd', detail) order by n))
    into v_out from t_results;
  raise exception 'REMOTE_RESULT %', v_out;
end $$;
