-- TechApp · stabilization sprint — findings from the first Supabase advisor run on the remote staging project.
-- Additive: no table, column or row is touched.
--
--  1. my_guardian_requests was an owner-rights (SECURITY DEFINER) view and, being a simple view, auto-updatable.
--     Supabase's default grants give API roles write access to every new relation, so a minor could
--     PATCH/DELETE their own guardian request through it (status → 'approved', send_count/last_sent_at reset,
--     row deleted) — verified on staging in a rolled-back transaction. The view is now security_invoker and reads
--     from a filtered SECURITY DEFINER function in the unexposed app schema: not updatable, and the table itself
--     still has no client access at all (token hashes never leave the server).
--  2. Pinned search_path on the remaining app.* functions (advisor 0011). All of them already schema-qualify.

-- ================================================================ 1. my_guardian_requests
create or replace function app.my_guardian_requests() returns table (
  id uuid, consent_purpose text, subject_type text, subject_id uuid, status public.guardian_status, policy_version text,
  requested_at timestamptz, expires_at timestamptz, confirmed_at timestamptz, denied_at timestamptz, revoked_at timestamptz,
  send_count int, last_sent_at timestamptz, guardian_email_masked text
)
language sql stable security definer set search_path = '' as $$
  select g.id, g.consent_purpose, g.subject_type, g.subject_id, g.status, g.policy_version,
         g.requested_at, g.expires_at, g.confirmed_at, g.denied_at, g.revoked_at,
         g.send_count, g.last_sent_at,
         regexp_replace(g.guardian_email, '^(.).*(@.*)$', '\1•••\2')
  from public.guardian_requests g
  where g.user_id = (select auth.uid());
$$;
revoke execute on function app.my_guardian_requests() from public, anon;
grant execute on function app.my_guardian_requests() to authenticated;

-- Same name, same columns, same order: the mobile app and guardian-dispatch keep working unchanged.
create or replace view public.my_guardian_requests with (security_invoker = true) as
  select * from app.my_guardian_requests();
alter view public.my_guardian_requests reset (security_barrier);
revoke all on public.my_guardian_requests from anon, authenticated;
grant select on public.my_guardian_requests to authenticated;

-- ================================================================ 2. search_path
alter function app.touch_updated_at() set search_path = '';
alter function app.min_account_age() set search_path = '';
alter function app.current_policy_version(text) set search_path = '';
alter function app.protect_application_snapshot() set search_path = '';
alter function app.protect_birth_date() set search_path = '';
alter function app.application_transition_allowed(public.application_status, public.application_status) set search_path = '';
alter function app.protect_notification() set search_path = '';
alter function app.fail(int, text, text) set search_path = '';
alter function app.protect_cv_share_token() set search_path = '';
alter function app.guardian_limits() set search_path = '';
alter function app.event_critical_fields() set search_path = '';
alter function app.opportunity_critical_fields() set search_path = '';
alter function app.content_text_fields() set search_path = '';
