import { metaJoin, type RowCardProps, type RowLines, type StatusView, type TechIconName } from '../../design-system';
import { formatDate } from '../../lib/dates';
import type { OpportunityRow, OpportunityType } from '../../lib/database.types';
import { EDUCATION_LABEL } from '../profile/labels';

export const OPPORTUNITY_TYPE: Record<OpportunityType, { label: string; icon: TechIconName }> = {
  internship: { label: 'Staj', icon: 'opportunity' }, volunteering: { label: 'Gönüllülük', icon: 'leaf' }, entrepreneurship: { label: 'Girişimcilik', icon: 'rocket' },
  talent_program: { label: 'Yetenek programı', icon: 'spark' }, project_call: { label: 'Proje çağrısı', icon: 'code' }, competition: { label: 'Yarışma', icon: 'badge' },
  grant: { label: 'Hibe', icon: 'rocket' }, award: { label: 'Ödül', icon: 'badge' }, scholarship: { label: 'Burs', icon: 'learn' },
};
export const TYPE_FILTERS: readonly (OpportunityType | 'all')[] = ['all', 'competition', 'grant', 'award', 'scholarship', 'internship', 'volunteering', 'entrepreneurship', 'talent_program', 'project_call'];

/** Plain-Turkish names of the profile fields an organisation may receive. Shown before every application. */
export const SHARED_FIELD_LABEL: Record<string, string> = {
  display_name: 'Adın', legal_name: 'Resmî ad soyadın', email: 'E-posta adresin', phone: 'Telefon numaran', city: 'Şehrin', education_stage: 'Eğitim aşaman',
  school_name: 'Okulun', headline: 'Profil başlığın', bio: 'Hakkında yazın', birth_year: 'Doğum yılın', interests: 'İlgi alanların', experiences: 'Profilinde gösterdiğin deneyimler',
};

export type DeadlineUrgency = 'closed' | 'today' | 'soon' | 'upcoming';
export interface DeadlineView { daysLeft: number; urgency: DeadlineUrgency; label: string }

/** Deadline maths on calendar days in Europe/Istanbul, so "son gün" is the same for everyone regardless of device zone. */
export function deadlineView(closesAtIso: string, now: Date = new Date()): DeadlineView {
  const day = (d: Date) => Math.floor((d.getTime() + 3 * 3600_000) / 86_400_000); // TRT is UTC+3 all year
  const closes = new Date(closesAtIso);
  if (closes.getTime() <= now.getTime()) return { daysLeft: -1, urgency: 'closed', label: 'Başvurular kapandı' };
  const daysLeft = day(closes) - day(now);
  if (daysLeft === 0) return { daysLeft, urgency: 'today', label: 'Son gün bugün' };
  if (daysLeft <= 7) return { daysLeft, urgency: 'soon', label: `Son ${daysLeft} gün` };
  return { daysLeft, urgency: 'upcoming', label: `${daysLeft} gün kaldı` };
}
export type DeadlineHorizon = 'Bu hafta' | 'Bu ay' | 'Sonra';
const DAY_MS = 86_400_000;
const istanbulDay = (d: Date) => Math.floor((d.getTime() + 3 * 3_600_000) / DAY_MS); // days since 1970-01-01, Istanbul calendar
const istanbulMonth = (day: number) => { const d = new Date(day * DAY_MS); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
/**
 * Son tarihler groups: Bu hafta (through Sunday of the Europe/Istanbul calendar week), Bu ay (the rest of the calendar
 * month), Sonra. A week that straddles a month end stays "Bu hafta". Closed calls are dropped; soonest first; empty groups are omitted.
 */
export function groupByHorizon<T extends Pick<OpportunityRow, 'closes_at'>>(rows: readonly T[], now: Date = new Date()): { label: DeadlineHorizon; items: T[] }[] {
  const today = istanbulDay(now);
  const weekEnd = today + (6 - ((today + 3) % 7)); // 1970-01-01 was a Thursday; Monday-based weekday = (day + 3) % 7
  const thisMonth = istanbulMonth(today);
  const groups: Record<DeadlineHorizon, T[]> = { 'Bu hafta': [], 'Bu ay': [], Sonra: [] };
  for (const row of [...rows].sort((a, b) => a.closes_at.localeCompare(b.closes_at))) {
    if (new Date(row.closes_at).getTime() <= now.getTime()) continue;
    const day = istanbulDay(new Date(row.closes_at));
    groups[day <= weekEnd ? 'Bu hafta' : istanbulMonth(day) === thisMonth ? 'Bu ay' : 'Sonra'].push(row);
  }
  return (['Bu hafta', 'Bu ay', 'Sonra'] as const).filter((label) => groups[label].length > 0).map((label) => ({ label, items: groups[label] }));
}
/** A call that is still open: lists never show a deadline that already passed, even if the data was fetched before it. */
export const isOpen = (o: Pick<OpportunityRow, 'closes_at'>, now: Date = new Date()) => new Date(o.closes_at).getTime() > now.getTime();
export const placeOf = (o: Pick<OpportunityRow, 'is_remote' | 'city'>) => (o.is_remote ? 'Çevrim içi' : o.city ?? 'Yer belirtilmedi');

/**
 * Remaining-days tag for a list row: <=1 gün apricot (a warning, not panic), <=7 gün iris, later none — the absolute
 * "Son başvuru" date is enough — and none once closed (closed calls are not listed). Clock glyph (time / deadline).
 */
export function deadlineTag(closesAtIso: string, now: Date = new Date()): StatusView | undefined {
  const d = deadlineView(closesAtIso, now);
  if (d.urgency === 'closed' || d.daysLeft > 7) return undefined;
  return { label: d.label.toLocaleUpperCase('tr'), tone: d.daysLeft <= 1 ? 'apricot' : 'iris', icon: 'clock' };
}

/** Typical opportunity row on a phone: two-line title, two-line meta, deadline tag footnote (skeleton shape). */
export const OPPORTUNITY_ROW_LINES: RowLines = { title: 2, secondary: 2, footnote: 'tag' };

type OpportunityRowSource = Pick<OpportunityRow, 'type' | 'title' | 'closes_at' | 'is_remote' | 'city' | 'audience_note' | 'reward_note' | 'is_demo'> & Partial<Pick<OpportunityRow, 'cover_path' | 'cover_blurhash'>>;

/**
 * One opportunity row everywhere (Fırsatlar list, Keşfet "Sıradaki adımın"): type · place · audience · reward as the
 * secondary line (two lines at most), footnote = remaining-days tag + absolute "Son başvuru" date. The screen adds the
 * trailing control (save / chevron) and navigation.
 */
export function toOpportunityRow(o: OpportunityRowSource, now: Date = new Date()): Omit<RowCardProps, 'trailing' | 'onPress'> {
  const type = OPPORTUNITY_TYPE[o.type];
  return {
    leading: o.cover_path ? { kind: 'image', path: o.cover_path, blurhash: o.cover_blurhash ?? null, fallbackIcon: type.icon } : { kind: 'icon', icon: type.icon },
    title: o.title,
    secondary: metaJoin([type.label, placeOf(o), o.audience_note, o.reward_note]),
    footnoteTag: deadlineTag(o.closes_at, now),
    footnote: `Son başvuru: ${formatDate(o.closes_at)}`,
    isDemo: o.is_demo,
  };
}

/** Human-readable value of a shared profile field, as the applicant will see it before sending. */
export function formatSharedValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'education_stage' && typeof value === 'string') return EDUCATION_LABEL[value as keyof typeof EDUCATION_LABEL] ?? '—';
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    return value.map((item) => (item && typeof item === 'object' ? String((item as { title?: unknown }).title ?? '') : String(item))).filter(Boolean).join(', ') || '—';
  }
  if (typeof value === 'object') return '—';
  return String(value);
}

/**
 * UX hint only: tells a user up front when an opportunity is certainly not open to them. The server decides
 * (submit_application); the app only knows whether the account is a minor, so uncertain cases return null.
 */
export function opportunityIneligibility(o: Pick<OpportunityRow, 'min_age' | 'max_age' | 'guardian_required_under'>, isMinor: boolean | null | undefined): string | null {
  if (isMinor === true && ((o.min_age ?? 0) >= 18 || (o.guardian_required_under ?? 0) >= 18)) return 'Bu fırsata şimdilik yalnızca 18 yaş ve üzeri başvurabiliyor.';
  if (isMinor === false && o.max_age !== null && o.max_age < 18) return 'Bu fırsat 18 yaş altı katılımcılar için.';
  return null;
}

/** Saving an opportunity means following its deadline (Son tarihler → Takip ettiklerim): the control is the bookmark, the words stay specific. */
export const FOLLOW_LABELS = { save: 'Son tarihi takip et', unsave: 'Takipten çıkar' };
