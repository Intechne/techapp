import type { EventCardModel } from '../../design-system';
import { formatDateRange } from '../../lib/dates';
import type { EventFormat, EventRow, EventType } from '../../lib/database.types';

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  hackathon: 'HACKATHON', competition: 'YARIŞMA', workshop: 'ATÖLYE', conference: 'KONFERANS',
  meetup: 'BULUŞMA', social_impact: 'SOSYAL ETKİ', training: 'EĞİTİM', festival: 'ŞENLİK',
};
export const EVENT_TYPE_FILTERS: readonly { value: EventType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tümü' }, { value: 'hackathon', label: 'Hackathon' }, { value: 'competition', label: 'Yarışma' },
  { value: 'workshop', label: 'Atölye' }, { value: 'meetup', label: 'Buluşma' }, { value: 'conference', label: 'Konferans' },
  { value: 'social_impact', label: 'Sosyal etki' }, { value: 'training', label: 'Eğitim' }, { value: 'festival', label: 'Şenlik' },
];
const FORMAT_LABEL: Record<EventFormat, string> = { in_person: 'Yüz yüze', online: 'Çevrim içi', hybrid: 'Hibrit' };

export type EventWithOrg = EventRow & { organization: { id: string; name: string; verification: string } | null };

export const placeLabel = (e: Pick<EventRow, 'format' | 'city'>) =>
  e.format === 'online' ? FORMAT_LABEL.online : [e.city, FORMAT_LABEL[e.format]].filter(Boolean).join(' · ');

export const feeLabel = (minor: number) => (minor === 0 ? 'Ücretsiz' : `${(minor / 100).toLocaleString('tr-TR')} ₺`);

export function audienceLabel(e: Pick<EventRow, 'audience_note' | 'min_age' | 'max_age'>): string {
  if (e.audience_note) return e.audience_note;
  if (e.min_age && e.max_age) return `${e.min_age}–${e.max_age} yaş`;
  if (e.min_age) return `${e.min_age}+ yaş`;
  if (e.max_age) return `${e.max_age} yaşa kadar`;
  return 'Herkese açık';
}

/** Availability is display-only; the server decides again at registration time. */
export function availability(e: Pick<EventRow, 'capacity' | 'seats_taken' | 'waitlist_enabled' | 'registration_closes_at'>, now = Date.now()): EventCardModel['availability'] {
  if (new Date(e.registration_closes_at).getTime() <= now) return { label: 'KAYIT KAPANDI', tone: 'danger' };
  if (e.capacity === null) return undefined;
  const left = e.capacity - e.seats_taken;
  if (left <= 0) return e.waitlist_enabled ? { label: 'BEKLEME LİSTESİ', tone: 'apricot' } : { label: 'KONTENJAN DOLDU', tone: 'danger' };
  if (left <= Math.max(3, Math.ceil(e.capacity * 0.1))) return { label: `SON ${left} YER`, tone: 'apricot' };
  return undefined;
}

export function toEventCardModel(e: EventWithOrg): EventCardModel {
  return {
    id: e.id, title: e.title, posterLine: e.poster_line ?? e.title, tone: e.tone,
    typeLabel: EVENT_TYPE_LABEL[e.type], organizer: e.organization?.name ?? 'TechApp',
    dateLabel: formatDateRange(e.starts_at, e.ends_at), placeLabel: placeLabel(e),
    audienceLabel: audienceLabel(e), feeLabel: feeLabel(e.fee_minor_units), availability: availability(e),
  };
}

export const ELIGIBILITY_REASON: Record<string, string> = {
  registration_not_open: 'Kayıtlar henüz açılmadı.',
  registration_closed: 'Kayıtlar kapandı.',
  team_registration_only: 'Bu etkinliğe takım olarak kayıt olunuyor.',
  profile_incomplete: 'Katılmak için profilini tamamlaman gerekiyor.',
  below_min_age: 'Bu etkinlik senin yaş grubuna açık değil.',
  above_max_age: 'Bu etkinlik senin yaş grubuna açık değil.',
};
