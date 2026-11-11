-- TechApp · D1 follow-up (security review): check_in_by_short_code must not be an enumeration oracle.
--
-- PostgREST runs `GET /rpc/…` in a READ ONLY transaction. In 20261112000100 a wrong code then failed at the attempts INSERT
-- (nothing counted, never 429) and a right code failed later at check_in_participant's SELECT … FOR UPDATE with a different
-- message — an unthrottled match/no-match oracle. Now:
--   1. a read-only transaction is refused first thing, before auth, lookup or HMAC — the same answer for every input;
--   2. the attempt row is written BEFORE the lookup and removed only when exactly one registration was chosen and the
--      check-in is handed over, so any path that cannot write fails identically for matching and non-matching codes;
--   3. a (theoretical) 32-bit collision prefers the single confirmed registration among the matches; otherwise 409.
create or replace function public.check_in_by_short_code(p_event_id uuid, p_short_code text, p_session_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); e public.events; v_code text; v_failures int; v_attempt bigint;
  v_matches jsonb; v_token text;
begin
  -- (1) Writes are part of the contract (throttle + check-in): refuse read-only calls before touching anything.
  if current_setting('transaction_read_only') = 'on' then perform app.fail(405, 'method_not_allowed'); end if;

  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into e from public.events where id = p_event_id;
  -- Same authority as check_in_participant. An unknown event answers like a foreign one.
  if not found or not app.has_org_role(e.organization_id, array['owner', 'admin', 'checkin_staff']::public.org_member_role[]) then
    perform app.fail(403, 'checkin_forbidden'); end if;

  v_code := upper(regexp_replace(coalesce(p_short_code, ''), '[[:space:]-]', '', 'g'));
  if v_code !~ '^[0-9A-F]{8}$' then perform app.fail(422, 'short_code_malformed'); end if;

  perform pg_advisory_xact_lock(hashtextextended('checkin_short_code:' || v_uid::text || ':' || e.id::text, 0));
  select count(*) into v_failures from app.checkin_short_code_attempts
   where user_id = v_uid and event_id = e.id and created_at > now() - interval '10 minutes';
  if v_failures >= 20 then perform app.fail(429, 'short_code_rate_limited'); end if;

  -- (2) Count the attempt before looking anything up.
  insert into app.checkin_short_code_attempts (user_id, event_id) values (v_uid, e.id) returning id into v_attempt;

  select coalesce(jsonb_agg(jsonb_build_object('token', t.token, 'confirmed', t.status = 'confirmed')), '[]'::jsonb)
    into v_matches
    from (select app.ticket_token(r) as token, r.status from public.event_registrations r where r.event_id = e.id) t
   where upper(substr(split_part(t.token, '.', 3), 1, 8)) = v_code;

  if jsonb_array_length(v_matches) = 1 then
    v_token := v_matches -> 0 ->> 'token';
  elsif jsonb_array_length(v_matches) > 1 then
    -- (3) Collision: exactly one confirmed registration wins; anything else is ambiguous (staff scans the QR).
    select min(m ->> 'token') into v_token from jsonb_array_elements(v_matches) m where (m ->> 'confirmed')::boolean
    having count(*) = 1;
    if v_token is null then perform app.fail(409, 'short_code_ambiguous'); end if;
  end if;

  if v_token is null then
    -- No match: the attempt row stays (committed with the 404 below) and feeds the throttle.
    delete from app.checkin_short_code_attempts where created_at < now() - interval '1 day';
    if v_failures + 1 = 20 then
      perform app.audit('user', 'checkin.short_code_locked', 'event', e.id, e.organization_id,
                        jsonb_build_object('window_minutes', 10));
    end if;
    -- Not raised: a raise would roll back the attempt row. PostgREST sends this body with HTTP 404, which supabase-js
    -- surfaces as `error` exactly like app.fail(404, 'ticket_unknown').
    perform set_config('response.status', '404', true);
    return jsonb_build_object('code', 'PT404', 'message', 'ticket_unknown', 'details', '', 'hint', null);
  end if;

  delete from app.checkin_short_code_attempts where id = v_attempt;
  return public.check_in_participant(v_token, p_session_id, e.id);
end $$;

revoke execute on function public.check_in_by_short_code(uuid, text, uuid) from public, anon;
grant execute on function public.check_in_by_short_code(uuid, text, uuid) to authenticated;
