import type { RegistrationStatus } from '../../lib/database.types';
import type { Cv } from './cvSchema';
import { isVerified } from './logic';

export type MyRegistrationLike = { id: string; status: RegistrationStatus; event: { starts_at: string } };

/** Registrations that are still alive: the user may yet attend. Cancelled / rejected / expired are never listed. */
const LIVE: readonly RegistrationStatus[] = ['confirmed', 'pending_guardian', 'waitlisted', 'pending_review'];

/**
 * `attended` comes from the server CV, which only holds checked-in participations; registrations never inflate it.
 * `upcoming` is a separate list of live registrations whose event starts after `now`, soonest first.
 */
export function profileStats<R extends MyRegistrationLike>(cv: Cv, registrations: R[], now: Date) {
  const upcoming = registrations
    .filter((r) => LIVE.includes(r.status) && new Date(r.event.starts_at).getTime() > now.getTime())
    .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  return {
    experiences: cv.experiences.length,
    verified: cv.experiences.filter((x) => isVerified(x, now)).length,
    attended: cv.participations.length,
    upcoming,
  };
}
