-- TechApp · 0008 shorter guardian links. Tokens become 24 random bytes as base64url (32 characters, 192 bits of entropy)
-- instead of 64 hex characters. Storage (sha256 hash only), single use and expiry are unchanged.
create or replace function app.url_token() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
$$;
revoke execute on function app.url_token() from public, anon, authenticated;

create or replace function public.issue_guardian_token(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.guardian_requests; v_token text := app.url_token();
begin
  select * into g from public.guardian_requests where id = p_request_id for update;
  if not found then perform app.fail(404, 'guardian_request_not_found'); end if;
  if g.status <> 'pending' or g.expires_at <= now() then perform app.fail(409, 'guardian_request_not_pending'); end if;
  if g.send_count >= 5 then perform app.fail(429, 'guardian_send_limit'); end if;
  if g.last_sent_at is not null and g.last_sent_at > now() - interval '60 seconds' then
    perform app.fail(429, 'guardian_send_too_soon'); end if;
  update public.guardian_requests
     set token_hash = app.sha256(v_token), send_count = send_count + 1, last_sent_at = now()
   where id = g.id;
  perform app.audit('service', 'guardian_request.token_issued', 'guardian_request', g.id);
  return jsonb_build_object(
    'token', v_token, 'guardian_email', g.guardian_email, 'guardian_name', g.guardian_name, 'expires_at', g.expires_at,
    -- context for the e-mail body; nothing here identifies the minor beyond a first name
    'participant_first_name', split_part((select display_name from public.profiles where id = g.user_id), ' ', 1),
    'event_title', (select e.title from public.event_registrations r join public.events e on e.id = r.event_id where r.id = g.subject_id),
    'event_starts_at', (select e.starts_at from public.event_registrations r join public.events e on e.id = r.event_id where r.id = g.subject_id));
end $$;
revoke execute on function public.issue_guardian_token(uuid) from public, anon, authenticated;
grant execute on function public.issue_guardian_token(uuid) to service_role;

-- Same function as in 0002; only the revoke token generator changes.
create or replace function public.guardian_decide(
  p_token text, p_approve boolean, p_guardian_full_name text, p_policy_version text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.guardian_requests; v_reg public.event_registrations; e public.events;
  v_next public.registration_status; v_revoke text;
begin
  select * into g from public.guardian_requests where token_hash = app.sha256(coalesce(p_token, '')) for update;
  if not found then perform app.fail(404, 'guardian_token_invalid'); end if;
  if g.status <> 'pending' then perform app.fail(409, 'guardian_request_' || g.status::text); end if;
  if g.expires_at <= now() then perform app.fail(409, 'guardian_request_expired'); end if;
  if p_guardian_full_name is null or char_length(btrim(p_guardian_full_name)) < 5 then
    perform app.fail(422, 'guardian_name_required'); end if;
  if p_policy_version is distinct from g.policy_version then perform app.fail(409, 'policy_version_mismatch'); end if;

  select * into v_reg from public.event_registrations where id = g.subject_id;
  select * into e from public.events where id = v_reg.event_id for update;
  select * into v_reg from public.event_registrations where id = g.subject_id for update;

  if p_approve then
    v_revoke := app.url_token();
    update public.guardian_requests
       set status = 'approved', confirmed_at = now(), decided_name = btrim(p_guardian_full_name),
           token_hash = null, revoke_token_hash = app.sha256(v_revoke)
     where id = g.id;
    insert into public.consents (user_id, purpose, policy_version, granted_by, guardian_request_id, subject_type, subject_id)
    values (g.user_id, g.consent_purpose, g.policy_version, 'guardian', g.id, g.subject_type, g.subject_id);
    if v_reg.status = 'pending_guardian' then
      v_next := app.next_registration_status(e, v_reg.user_id, v_reg.id);
      update public.event_registrations
         set status = v_next, confirmed_at = case when v_next = 'confirmed' then now() end,
             status_reason = 'guardian_approved'
       where id = v_reg.id;
    end if;
    perform app.audit('guardian', 'guardian_request.approved', 'guardian_request', g.id, e.organization_id);
    return jsonb_build_object('status', 'approved', 'revoke_token', v_revoke);
  end if;

  update public.guardian_requests
     set status = 'denied', denied_at = now(), decided_name = btrim(p_guardian_full_name), token_hash = null
   where id = g.id;
  if v_reg.status = 'pending_guardian' then
    update public.event_registrations set status = 'cancelled', status_reason = 'guardian_denied', cancelled_at = now()
     where id = v_reg.id;
    perform app.promote_waitlist(e);
  end if;
  perform app.audit('guardian', 'guardian_request.denied', 'guardian_request', g.id, e.organization_id);
  return jsonb_build_object('status', 'denied');
end $$;
revoke execute on function public.guardian_decide(text, boolean, text, text) from public;
grant execute on function public.guardian_decide(text, boolean, text, text) to anon, authenticated;
