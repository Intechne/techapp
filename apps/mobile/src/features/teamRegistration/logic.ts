import type { AppError } from '../../lib/errors';
import type { EventEligibility, ManageableTeam } from '../../lib/database.types';

export type RegistrationMode = 'individual' | 'team' | 'both';
export type CtaKind = 'individual' | 'team' | 'team_info' | 'sign_in' | 'none';
/** What the detail screen offers for team events. `teamRegistrationId` set = the team is already registered: open its status. */
export interface TeamCta { kind: 'team'; label: string; teamRegistrationId: string | null }
export interface EventCta { kind: CtaKind; label: string; teamRegistrationId?: string | null; secondary?: TeamCta }
export type Eligibility = Partial<Pick<EventEligibility, 'manageable_teams'>>;

export const TEAM_INFO_LABEL = 'Takım kaydını kaptanın ya da mentorun yapar';

/** The "Takımımı kaydet" / "Takım kaydını gör" button for the teams the user manages (captain or mentor; display only: the server decides). */
function teamAction(teams: readonly ManageableTeam[]): TeamCta | null {
  if (teams.length === 0) return null;
  if (teams.some((t) => !t.registration_id)) return { kind: 'team', label: 'Takımımı kaydet', teamRegistrationId: null };
  return { kind: 'team', label: 'Takım kaydını gör', teamRegistrationId: teams[0]!.registration_id };
}

/**
 * Which call to action the event detail shows. The flag is checked here, so a screen cannot show a team CTA with the flag off.
 * Individual events and the individual side of a "both" event are unchanged; a guest on a team event signs in first.
 */
export function eventCta(input: { mode: RegistrationMode; eligibility: Eligibility | undefined; signedIn: boolean; flag: boolean }): EventCta {
  const { mode, eligibility, signedIn, flag } = input;
  if (mode === 'individual') return { kind: 'individual', label: 'Etkinliğe katıl' };
  const action = flag && signedIn ? teamAction(eligibility?.manageable_teams ?? []) : null;
  if (mode === 'both') return action ? { kind: 'individual', label: 'Etkinliğe katıl', secondary: action } : { kind: 'individual', label: 'Etkinliğe katıl' };
  if (!signedIn) return { kind: 'sign_in', label: 'Giriş yap' };
  if (!flag) return { kind: 'team_info', label: TEAM_INFO_LABEL };
  if (!eligibility) return { kind: 'none', label: '' };
  return action ?? { kind: 'team_info', label: TEAM_INFO_LABEL };
}

export type RosterProblem = 'too_few' | 'too_many';
export function rosterProblem(selected: number, min: number, max: number | null): RosterProblem | null {
  if (selected < min) return 'too_few';
  if (max !== null && selected > max) return 'too_many';
  return null;
}

/** Everyone starts selected when the whole team fits the event's size window; a larger team starts empty so the manager chooses. */
export function initialSelection(userIds: readonly string[], _min: number, max: number | null): Set<string> {
  return max !== null && userIds.length > max ? new Set() : new Set(userIds);
}

/** The offending member ids of a per-member server error: a JSON uuid array in `detail`. Anything else yields []. */
export function memberIdsFromError(error: Pick<AppError, 'detail'>): string[] {
  if (!error.detail) return [];
  try {
    const parsed: unknown = JSON.parse(error.detail);
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? (parsed as string[]) : [];
  } catch { return []; }
}

/** Codes that name specific roster members in `detail`. */
export const MEMBER_ERROR_CODES = ['member_not_active', 'member_already_registered', 'member_age_not_eligible'] as const;
export const isMemberError = (code: string): boolean => (MEMBER_ERROR_CODES as readonly string[]).includes(code);
