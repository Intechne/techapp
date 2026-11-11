import type { RegistrationStatus } from '../../lib/database.types';
import type { Cv } from './cvSchema';
import { isVerified } from './logic';

export type MyRegistrationLike = { id: string; status: RegistrationStatus; event_id?: string; event: { starts_at: string } };

/** Registrations that are still alive: the user may yet attend. Cancelled / rejected / expired are never listed. */
const LIVE: readonly RegistrationStatus[] = ['confirmed', 'pending_guardian', 'waitlisted', 'pending_review'];

/**
 * `attended` comes from the server CV, which only holds checked-in participations; registrations never inflate it.
 * `upcoming` entries carry `checkedIn`: true when the server CV already holds a check-in for that registration's event (no extra request).
 * `upcoming` is a separate list of live registrations whose event starts after `now`, soonest first.
 */
export function profileStats<R extends MyRegistrationLike>(cv: Cv, registrations: R[], now: Date) {
  const checkedInEvents = new Set(cv.participations.map((p) => p.event_id));
  const upcoming = registrations
    .filter((r) => LIVE.includes(r.status) && new Date(r.event.starts_at).getTime() > now.getTime())
    .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime())
    .map((r) => ({ ...r, checkedIn: r.status === 'confirmed' && !!r.event_id && checkedInEvents.has(r.event_id) }));
  return {
    experiences: cv.experiences.length,
    verified: cv.experiences.filter((x) => isVerified(x, now)).length,
    attended: cv.participations.length,
    upcoming,
  };
}
