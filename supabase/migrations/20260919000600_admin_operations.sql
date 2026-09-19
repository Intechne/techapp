-- TechApp · 0006 admin / organiser operations for the Event Pilot panel.
-- Event status machine + audit, organiser registration list (minimal PII), event-scoped check-in.

-- ---------------------------------------------------------------- event status machine
-- draft → in_review → published → cancelled | archived ; in_review → draft (sent back) ; draft → archived.
-- Who may publish is enforced by app.protect_event_columns(); this trigger enforces WHICH moves exist.
create or replace function app.event_status_machine() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if (select auth.uid()) is not null and not (
         (old.status = 'draft'     and new.status in ('in_review', 'archived'))
      or (old.status = 'in_review' and new.status in ('draft', 'published'))
      or (old.status = 'published' and new.status in ('cancelled', 'archived'))
      or (old.status = 'cancelled' and new.status = 'archived')
    ) then
      perform app.fail(409, 'event_status_transition_invalid', old.status::text || '→' || new.status::text);
    end if;
    perform app.audit('user', 'event.status.' || new.status::text, 'event', new.id, new.organization_id,
                      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger events_status_machine before update of status on public.events
  for each row execute function app.event_status_machine();

-- Cancelling an event cancels its live registrations (history is kept, tickets are invalidated).
create or replace function app.event_cancel_cascade() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.event_registrations
       set status = 'cancelled', status_reason = 'event_cancelled', cancelled_at = now(), ticket_version = ticket_version + 1
     where event_id = new.id and status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted');
    update public.guardian_requests g set status = 'revoked', revoked_at = now(), token_hash = null
     where g.status = 'pending' and g.subject_type = 'event_registration'
       and g.subject_id in (select id from public.event_registrations where event_id = new.id);
  end if;
  return null;
end $$;
create trigger events_cancel_cascade after update of status on public.events
  for each row execute function app.event_cancel_cascade();

-- ---------------------------------------------------------------- organiser registration list
-- Organisations cannot read profiles. This returns only what check-in/review needs: display name + states.
create or replace function public.admin_event_registrations(p_event_id uuid)
returns table (
  registration_id uuid, display_name text, status public.registration_status, status_reason text,
  created_at timestamptz, confirmed_at timestamptz, checked_in_at timestamptz, guardian_status public.guardian_status
)
language plpgsql stable security definer set search_path = '' as $$
declare e public.events;
begin
  if (select auth.uid()) is null then perform app.fail(401, 'auth_required'); end if;
  select * into e from public.events where id = p_event_id;
  if not found then perform app.fail(404, 'event_not_found'); end if;
  if not (app.has_org_role(e.organization_id, array['owner', 'admin', 'editor', 'checkin_staff', 'reviewer']::public.org_member_role[])) then
    perform app.fail(403, 'forbidden'); end if;
  return query
    select r.id, p.display_name, r.status, r.status_reason, r.created_at, r.confirmed_at,
           (select min(c.created_at) from public.event_check_ins c where c.registration_id = r.id),
           (select g.status from public.guardian_requests g
             where g.subject_type = 'event_registration' and g.subject_id = r.id order by g.created_at desc limit 1)
    from public.event_registrations r join public.profiles p on p.id = r.user_id
    where r.event_id = p_event_id
    order by r.created_at;
end $$;

-- ---------------------------------------------------------------- check-in, optionally bound to the event being worked
drop function public.check_in_participant(text, uuid);
create or replace function public.check_in_participant(p_token text, p_session_id uuid default null, p_expected_event_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_parts text[]; v_reg public.event_registrations; e public.events;
  v_existing public.event_check_ins; v_new public.event_check_ins;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  v_parts := string_to_array(btrim(coalesce(p_token, '')), '.');
  if array_length(v_parts, 1) is distinct from 3 or v_parts[1] <> 'TA1'
     or v_parts[2] !~ '^[0-9a-f-]{36}$' then perform app.fail(422, 'ticket_malformed'); end if;

  select * into v_reg from public.event_registrations where id = v_parts[2]::uuid for update;
  if not found then perform app.fail(404, 'ticket_unknown'); end if;
  select * into e from public.events where id = v_reg.event_id;

  -- Authorisation first: staff of another organisation learn nothing about this ticket.
  if not app.has_org_role(e.organization_id, array['owner', 'admin', 'checkin_staff']::public.org_member_role[]) then
    perform app.fail(403, 'checkin_forbidden'); end if;
  if app.ticket_token(v_reg) <> btrim(p_token) then perform app.fail(422, 'ticket_invalid'); end if;
  if p_expected_event_id is not null and p_expected_event_id <> e.id then
    perform app.fail(409, 'ticket_wrong_event', e.title); end if;
  if v_reg.status <> 'confirmed' then perform app.fail(409, 'registration_not_confirmed', v_reg.status::text); end if;
  if e.status <> 'published' then perform app.fail(409, 'event_not_active'); end if;
  if now() < e.starts_at - interval '3 hours' or now() > e.ends_at then
    perform app.fail(409, 'outside_checkin_window'); end if;
  if p_session_id is not null and not exists
     (select 1 from public.event_sessions s where s.id = p_session_id and s.event_id = e.id) then
    perform app.fail(422, 'session_mismatch'); end if;

  select * into v_existing from public.event_check_ins
   where registration_id = v_reg.id and session_id is not distinct from p_session_id;
  if found then
    return jsonb_build_object('result', 'already_checked_in', 'registration_id', v_reg.id, 'event_id', e.id,
                              'checked_in_at', v_existing.created_at,
                              'holder_name', (select display_name from public.profiles where id = v_reg.user_id));
  end if;

  insert into public.event_check_ins (registration_id, session_id, checked_in_by)
  values (v_reg.id, p_session_id, v_uid) returning * into v_new;
  perform app.audit('user', 'registration.checked_in', 'event_registration', v_reg.id, e.organization_id,
                    jsonb_build_object('event_id', e.id));
  return jsonb_build_object('result', 'checked_in', 'registration_id', v_reg.id, 'event_id', e.id,
                            'checked_in_at', v_new.created_at,
                            'holder_name', (select display_name from public.profiles where id = v_reg.user_id));
end $$;

-- Only the functions created here are touched: earlier migrations own the grants of their RLS helper functions.
revoke execute on function app.event_status_machine(), app.event_cancel_cascade() from public, anon, authenticated;
revoke execute on function public.admin_event_registrations(uuid), public.check_in_participant(text, uuid, uuid) from public, anon;
grant execute on function public.admin_event_registrations(uuid), public.check_in_participant(text, uuid, uuid) to authenticated;
