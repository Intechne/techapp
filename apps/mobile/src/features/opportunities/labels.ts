import type { TechIconName } from '../../design-system';
import type { OpportunityRow, OpportunityType } from '../../lib/database.types';

export const OPPORTUNITY_TYPE: Record<OpportunityType, { label: string; icon: TechIconName }> = {
  internship: { label: 'Staj', icon: 'opportunity' }, volunteering: { label: 'Gönüllülük', icon: 'leaf' }, entrepreneurship: { label: 'Girişimcilik', icon: 'rocket' },
  talent_program: { label: 'Yetenek programı', icon: 'spark' }, project_call: { label: 'Proje çağrısı', icon: 'code' }, competition: { label: 'Yarışma', icon: 'robot' },
  grant: { label: 'Hibe', icon: 'rocket' }, award: { label: 'Ödül', icon: 'verified' }, scholarship: { label: 'Burs', icon: 'learn' },
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
export const urgencyTone = (u: DeadlineUrgency) => (u === 'closed' ? 'neutral' : u === 'today' ? 'danger' : u === 'soon' ? 'apricot' : 'moss') as 'neutral' | 'danger' | 'apricot' | 'moss';

const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
/** Groups open calls by the month of their deadline, soonest first. */
export function groupByMonth<T extends Pick<OpportunityRow, 'closes_at'>>(rows: readonly T[]): { month: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const row of [...rows].sort((a, b) => a.closes_at.localeCompare(b.closes_at))) {
    const key = monthFmt.format(new Date(row.closes_at));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([month, items]) => ({ month, items }));
}
export const placeOf = (o: Pick<OpportunityRow, 'is_remote' | 'city'>) => (o.is_remote ? 'Çevrim içi' : o.city ?? 'Yer belirtilmedi');
