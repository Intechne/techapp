import { WEB_ORIGIN } from '../../lib/domain';
import type { CvAttestation, CvExperience } from './cvSchema';

/** Public address of a shared CV on the single web origin. The token is issued and revoked by the server. */
export const cvShareUrl = (token: string) => `${WEB_ORIGIN}/cv/${token}`;

export const MAX_SKILLS = 15;
export const MAX_SKILL_LENGTH = 30;

export type DateResult = { ok: true; iso: string | null } | { ok: false; error: string };

/** Strict GG.AA.YYYY → ISO date. Empty input is allowed (optional field). Rejects impossible calendar dates and the far future. */
export function parseDate(input: string, today: Date = new Date()): DateResult {
  const raw = input.trim();
  if (!raw) return { ok: true, iso: null };
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (!m) return { ok: false, error: 'Tarihi GG.AA.YYYY biçiminde yaz.' };
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return { ok: false, error: 'Takvimde böyle bir tarih yok.' };
  if (year < 1950 || year > today.getFullYear() + 5) return { ok: false, error: 'Yılı kontrol eder misin?' };
  return { ok: true, iso: `${m[3]}-${m[2]}-${m[1]}` };
}

/** ISO date (YYYY-MM-DD) → GG.AA.YYYY for editing. */
export const toInputDate = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};

export function validateRange(startIso: string | null, endIso: string | null): string | null {
  return startIso && endIso && endIso < startIso ? 'Bitiş tarihi başlangıçtan önce olamaz.' : null;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const monthYear = (iso: string) => { const [y, m] = iso.split('-'); return `${MONTHS[Number(m) - 1] ?? ''} ${y}`.trim(); };
export function formatRange(start: string | null, end: string | null): string {
  if (start && end) return monthYear(start) === monthYear(end) ? monthYear(start) : `${monthYear(start)} – ${monthYear(end)}`;
  if (start) return `${monthYear(start)} – devam ediyor`;
  if (end) return monthYear(end);
  return '';
}

/** Trim, collapse spaces, cap length, drop empties and case-insensitive duplicates (Turkish-aware), cap the count. */
export function normaliseSkills(skills: readonly string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const s of skills) {
    const clean = s.replace(/\s+/g, ' ').trim().slice(0, MAX_SKILL_LENGTH).trim();
    const key = clean.toLocaleLowerCase('tr');
    if (!clean || seen.has(key)) continue;
    seen.add(key); out.push(clean);
    if (out.length === MAX_SKILLS) break;
  }
  return out;
}
export function addSkill(current: readonly string[], input: string): { skills: string[]; error?: string } {
  const candidates = input.split(',');
  const next = normaliseSkills([...current, ...candidates]);
  if (next.length === current.length) return { skills: [...current], error: input.trim() ? 'Bu beceri zaten listede.' : undefined };
  if (current.length >= MAX_SKILLS) return { skills: [...current], error: `En fazla ${MAX_SKILLS} beceri ekleyebilirsin.` };
  return { skills: next };
}

export type Provenance = 'verified' | 'self' | 'pending' | 'changes_requested' | 'rejected' | 'revoked' | 'expired';

/** The ONLY place that decides whether an entry may look verified. Revoked, rejected and expired never do. */
export function provenanceOf(attestation: CvAttestation | null, now: Date = new Date()): Provenance {
  if (!attestation) return 'self';
  switch (attestation.status) {
    case 'verified': return attestation.valid_until && new Date(attestation.valid_until) <= now ? 'expired' : 'verified';
    case 'requested': return 'pending';
    case 'changes_requested': return 'changes_requested';
    case 'rejected': return 'rejected';
    case 'revoked': return 'revoked';
  }
}
export const isVerified = (x: Pick<CvExperience, 'attestation'>, now?: Date) => provenanceOf(x.attestation, now) === 'verified';

/** A new request makes sense only when nothing is pending or currently valid. Drafts cannot be verified. */
export function canRequestAttestation(x: Pick<CvExperience, 'status' | 'attestation'>, now?: Date): boolean {
  const p = provenanceOf(x.attestation, now);
  return x.status === 'published' && p !== 'verified' && p !== 'pending';
}

export interface ExperienceSubstance { kind: string; title: string; role: string | null; contribution: string | null; organization_name: string | null; started_on: string | null; ended_on: string | null }
/** Mirrors app.experience_edit_revokes(): these fields are what the organisation verified. */
export function substanceChanged(before: ExperienceSubstance, after: ExperienceSubstance): boolean {
  const keys: (keyof ExperienceSubstance)[] = ['kind', 'title', 'role', 'contribution', 'organization_name', 'started_on', 'ended_on'];
  return keys.some((k) => (before[k] ?? null) !== (after[k] ?? null));
}

export const isHttpsUrl = (value: string) => /^https:\/\/[^\s.]+\.[^\s]+$/.test(value.trim());
export const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);
