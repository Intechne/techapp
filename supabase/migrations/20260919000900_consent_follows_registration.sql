-- TechApp · 0009 a consent never outlives the registration it was given for.
-- Found in the live guardian test: after a guardian revoked, the participant's own consent row stayed active.
-- One trigger covers every path (user cancel, guardian deny/revoke, expiry, organiser reject, event cancelled).
create or replace function app.withdraw_consents_on_registration_end() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('cancelled', 'rejected', 'expired') and old.status is distinct from new.status then
    update public.consents set withdrawn_at = now()
     where subject_type = 'event_registration' and subject_id = new.id and withdrawn_at is null;
  end if;
  return null;
end $$;
revoke execute on function app.withdraw_consents_on_registration_end() from public, anon, authenticated;
create trigger event_registrations_consents after update of status on public.event_registrations
  for each row execute function app.withdraw_consents_on_registration_end();
