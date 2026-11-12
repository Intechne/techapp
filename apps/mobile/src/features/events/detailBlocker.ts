/**
 * Of every reason the server gave for "you cannot register", the one that decides the detail screen, plus the secondary
 * action that still helps (approved Faz 4 S11). Priority: kayıtlı → kapandı → (henüz açılmadı) → dolu → yaş → takım.
 * Display only: the server decides eligibility again at registration time.
 */
export type BlockerAction = 'save' | 'find_team' | 'similar' | null;
export interface PrimaryBlocker { reason: string; secondary: BlockerAction; others: string[] }

const ORDER = ['registration_closed', 'registration_not_open', 'event_full', 'below_min_age', 'above_max_age', 'team_registration_only'] as const;
const ACTION: Record<string, BlockerAction> = {
  registration_closed: 'similar', registration_not_open: 'save', event_full: 'similar',
  below_min_age: 'similar', above_max_age: 'similar', team_registration_only: 'find_team',
};
const rank = (r: string) => { const i = (ORDER as readonly string[]).indexOf(r); return i === -1 ? ORDER.length : i; };

/** `registered`: the user already has a registration — that, not a blocker, decides the screen. */
export function primaryBlocker(reasons: string[], registered: boolean): PrimaryBlocker | null {
  if (registered || reasons.length === 0) return null;
  const [reason, ...others] = [...reasons].sort((a, b) => rank(a) - rank(b)) as [string, ...string[]];
  return { reason, secondary: ACTION[reason] ?? 'similar', others };
}
