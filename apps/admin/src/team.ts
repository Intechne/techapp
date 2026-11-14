import { TEAM_LIVE, TEAM_STATUS_LABEL, type EventRow, type TeamMemberStep, type TeamRegItem } from './lib';

export const BELOW_MIN = 'roster_below_min_after_close';
const STEP_LABEL: Record<TeamMemberStep, string> = { invited: 'Davet bekliyor', guardian: 'Veli onayı bekliyor', ready: 'Hazır', declined: 'Katılmıyor' };

/** A live team's member steps mean what they say. For an ended team the server derives 'declined' from the member's registration
 *  being cancelled/rejected/expired, which would read as a refusal the member never made: those show an "ended" label (ledger M-2). */
export function memberLabel(t: Pick<TeamRegItem, 'status'>, m: Pick<TeamRegItem['members'][number], 'state' | 'step'>): { text: string; tone: string } {
  if (!TEAM_LIVE.includes(t.status)) return { text: 'Takım sona erdi', tone: 'neutral' };
  if (m.state === 'declined') return { text: 'Daveti reddetti', tone: 'neutral' };
  if (m.state === 'removed') return { text: 'Kadrodan çıkarıldı', tone: 'neutral' };
  if (m.step === 'declined') return { text: 'Katılımı sona erdi', tone: 'danger' };
  return { text: STEP_LABEL[m.step], tone: m.step === 'ready' ? 'moss' : m.step === 'guardian' ? 'apricot' : '' };
}

/** A hold past hold_expires_at is shown as lapsed even before the server's expiry job has closed it (ledger M-5). */
export const holdLapsed = (t: Pick<TeamRegItem, 'status' | 'hold_expires_at'>, now: number) =>
  t.status === 'pending_members' && !!t.hold_expires_at && new Date(t.hold_expires_at).getTime() <= now;
export const teamStatusLabel = (t: Pick<TeamRegItem, 'status' | 'hold_expires_at'>, now: number) => (holdLapsed(t, now) ? 'Süresi doldu, kapanıyor' : TEAM_STATUS_LABEL[t.status]);

export const approveLabel = (t: Pick<TeamRegItem, 'status_reason'>) => (t.status_reason === BELOW_MIN ? 'Bu kadroyla onayla' : 'Onayla');

export interface TeamSettings { team_capacity: string; team_min_size: string; team_max_size: string }
/** Same limits as the database checks (events.team_* and events_team_size_range). Returns the message, or null when valid. */
export function validateTeamSettings(f: TeamSettings): string | null {
  const whole = (v: string, lo: number, hi: number) => /^\d+$/.test(v.trim()) && Number(v) >= lo && Number(v) <= hi;
  if (f.team_capacity.trim() !== '' && !whole(f.team_capacity, 1, 1_000_000)) return 'Takım kontenjanı 1 veya daha büyük bir tam sayı olmalı; sınırsız için boş bırak.';
  if (!whole(f.team_min_size, 1, 100)) return 'Takımın en az kişi sayısı 1 ile 100 arasında olmalı.';
  if (f.team_max_size.trim() !== '' && !whole(f.team_max_size, 1, 100)) return 'Takımın en çok kişi sayısı 1 ile 100 arasında olmalı; sınırsız için boş bırak.';
  if (f.team_max_size.trim() !== '' && Number(f.team_min_size) > Number(f.team_max_size)) return 'Takımın en az kişi sayısı en çok kişi sayısından büyük olamaz.';
  return null;
}

/** Does saving these values send a published event back to review? (server: min/max size change, team_capacity lowered or newly set). */
export function teamChangeNeedsReview(orig: Pick<EventRow, 'team_capacity' | 'team_min_size' | 'team_max_size'> | null, f: TeamSettings): boolean {
  if (!orig) return false;
  const cap = f.team_capacity.trim() === '' ? null : Number(f.team_capacity);
  const max = f.team_max_size.trim() === '' ? null : Number(f.team_max_size);
  const capLowered = cap !== null && (orig.team_capacity === null || cap < orig.team_capacity);
  return capLowered || Number(f.team_min_size) !== orig.team_min_size || max !== orig.team_max_size;
}

/** The RPC returns loose jsonb: keep only well-formed rows (a malformed row is dropped, never rendered half-way). */
export function parseTeamRegs(data: unknown): TeamRegItem[] {
  if (!Array.isArray(data)) throw new Error('contract_mismatch');
  const ok = (x: unknown): x is TeamRegItem => {
    const r = x as Partial<TeamRegItem> | null;
    return !!r && typeof r.id === 'string' && typeof r.team_name === 'string' && typeof r.status === 'string' && typeof r.roster_size === 'number'
      && typeof r.ready_count === 'number' && Array.isArray(r.members);
  };
  return data.filter(ok);
}
