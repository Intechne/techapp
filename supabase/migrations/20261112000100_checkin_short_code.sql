-- TechApp · D1 (pilot journey step 7): manual check-in by the 8-character short code printed on the participation card.
-- The card shows upper(first 8 hex chars of the ticket HMAC) — 32 bits, so a short code is only meaningful inside ONE event
-- and lookups are throttled per (staff member, event). The check-in itself is delegated to public.check_in_participant
-- with the full token, so status/window/published/idempotency rules stay in exactly one place.

-- ---------------------------------------------------------------- failed-lookup log (throttle state)
-- Written only by public.check_in_by_short_code (SECURITY DEFINER). No API role has privileges; RLS on, no policies.
create table app.checkin_short_code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index checkin_short_code_attempts_window_idx on app.checkin_short_code_attempts (user_id, event_id, created_at);
create index checkin_short_code_attempts_age_idx on app.checkin_short_code_attempts (created_at);
alter table app.checkin_short_code_attempts enable row level security;
revoke all on app.checkin_short_code_attempts from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- RPC
-- Errors: 401 auth_required · 403 checkin_forbidden (also for an unknown event: nothing is learned about it) ·
-- 422 short_code_malformed · 429 short_code_rate_limited (20 failed lookups / 10 min per caller+event; a valid code is
-- refused too while the limit holds, which is what stops enumeration) · 404 ticket_unknown · 409 short_code_ambiguous ·
-- everything else comes unchanged from check_in_participant.
--
-- 404 is NOT raised: a raise rolls back the transaction and with it the failed-attempt row the throttle counts. Instead
-- the function sets PostgREST's `response.status` and returns a PostgREST-shaped error body ({code: 'PT404', message:
-- 'ticket_unknown'}), which supabase-js surfaces as `error` exactly like an app.fail(404, …). The transaction commits.
--
-- Lookup cost: one HMAC per registration of the event (hundreds to low thousands) — fine for the pilot. If events grow,
-- store the short code in an indexed column maintained on ticket_version change instead of computing it here.
create or replace function public.check_in_by_short_code(p_event_id uuid, p_short_code text, p_session_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); e public.events; v_code text; v_failures int; v_tokens text[];
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  select * into e from public.events where id = p_event_id;
  -- Same authority as check_in_participant.
  if not found or not app.has_org_role(e.organization_id, array['owner', 'admin', 'checkin_staff']::public.org_member_role[]) then
    perform app.fail(403, 'checkin_forbidden'); end if;

  v_code := upper(regexp_replace(coalesce(p_short_code, ''), '[[:space:]-]', '', 'g'));
  if v_code !~ '^[0-9A-F]{8}$' then perform app.fail(422, 'short_code_malformed'); end if;

  -- Serialise one caller's lookups for one event so parallel requests cannot overshoot the limit.
  perform pg_advisory_xact_lock(hashtextextended('checkin_short_code:' || v_uid::text || ':' || e.id::text, 0));
  select count(*) into v_failures from app.checkin_short_code_attempts
   where user_id = v_uid and event_id = e.id and created_at > now() - interval '10 minutes';
  if v_failures >= 20 then perform app.fail(429, 'short_code_rate_limited'); end if;

  select array_agg(t.token) into v_tokens from (
    select app.ticket_token(r) as token from public.event_registrations r where r.event_id = e.id
  ) t where upper(substr(split_part(t.token, '.', 3), 1, 8)) = v_code;

  if v_tokens is null then
    insert into app.checkin_short_code_attempts (user_id, event_id) values (v_uid, e.id);
    delete from app.checkin_short_code_attempts where created_at < now() - interval '1 day';
    if v_failures + 1 = 20 then
      perform app.audit('user', 'checkin.short_code_locked', 'event', e.id, e.organization_id,
                        jsonb_build_object('window_minutes', 10));
    end if;
    perform set_config('response.status', '404', true);
    return jsonb_build_object('code', 'PT404', 'message', 'ticket_unknown', 'details', '', 'hint', null);
  end if;
  if array_length(v_tokens, 1) > 1 then perform app.fail(409, 'short_code_ambiguous'); end if;

  return public.check_in_participant(v_tokens[1], p_session_id, e.id);
end $$;

revoke execute on function public.check_in_by_short_code(uuid, text, uuid) from public, anon;
grant execute on function public.check_in_by_short_code(uuid, text, uuid) to authenticated;
