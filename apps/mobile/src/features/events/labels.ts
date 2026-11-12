import type { PosterCardProps, StatusView, TechIconName } from '../../design-system';
import { formatDateRange } from '../../lib/dates';
import type { EventFormat, EventRow, EventType } from '../../lib/database.types';
import type { EventPublicRow } from './api';

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  hackathon: 'HACKATHON', competition: 'YARIŞMA', workshop: 'ATÖLYE', conference: 'KONFERANS',
  meetup: 'BULUŞMA', social_impact: 'SOSYAL ETKİ', training: 'EĞİTİM', festival: 'ŞENLİK',
};
/** Type glyph on the fallback poster (icon meaning table: robot stays reserved for the robotics category). */
export const EVENT_TYPE_ICON: Record<EventType, TechIconName> = {
  hackathon: 'code', competition: 'badge', workshop: 'project', conference: 'mentor',
  meetup: 'community', social_impact: 'leaf', training: 'learn', festival: 'spark',
};
export const EVENT_TYPE_FILTERS: readonly { value: EventType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tümü' }, { value: 'hackathon', label: 'Hackathon' }, { value: 'competition', label: 'Yarışma' },
  { value: 'workshop', label: 'Atölye' }, { value: 'meetup', label: 'Buluşma' }, { value: 'conference', label: 'Konferans' },
  { value: 'social_impact', label: 'Sosyal etki' }, { value: 'training', label: 'Eğitim' }, { value: 'festival', label: 'Şenlik' },
];
/** No-break spaces: a two-word format never splits across lines ("Yüz / yüze"). */
const FORMAT_LABEL: Record<EventFormat, string> = { in_person: 'Yüz\u00A0yüze', online: 'Çevrim\u00A0içi', hybrid: 'Hibrit' };

export type EventWithOrg = EventPublicRow & { organization: { id: string; name: string; verification: string } | null };

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

const MODE_LABEL: Record<EventRow['registration_mode'], string> = { individual: 'Bireysel kayıt', team: 'Takım kaydı', both: 'Bireysel veya takım kaydı' };

/** Registration type and age / guardian terms for the detail screen. Display-only: the server decides eligibility. */
export function registrationTermsLabel(e: Pick<EventRow, 'registration_mode' | 'min_age' | 'guardian_required_under'>): string {
  return [
    MODE_LABEL[e.registration_mode],
    e.min_age ? `${e.min_age} yaş ve üzeri` : null,
    e.guardian_required_under ? `${e.guardian_required_under} yaş altına veli onayı` : null,
  ].filter(Boolean).join(' · ');
}

/** Registration window rule, in one place (availability, vitrin, Keşfet): closes_at is NOT NULL in the schema, so there is no "always open". */
export const isRegistrationClosed = (e: Pick<EventRow, 'registration_closes_at'>, now = Date.now()): boolean =>
  new Date(e.registration_closes_at).getTime() <= now;
/** The window is open: opened (null opens_at = open from the start) and not yet closed. Capacity is a separate question. */
export const isRegistrationOpen = (e: Pick<EventRow, 'registration_opens_at' | 'registration_closes_at'>, now = Date.now()): boolean =>
  (e.registration_opens_at === null || new Date(e.registration_opens_at).getTime() <= now) && !isRegistrationClosed(e, now);

/** Availability is display-only; the server decides again at registration time. */
export function availability(e: Pick<EventRow, 'capacity' | 'seats_taken' | 'waitlist_enabled' | 'registration_closes_at'>, now = Date.now()): StatusView | undefined {
  if (isRegistrationClosed(e, now)) return { label: 'KAYIT KAPANDI', tone: 'danger' };
  if (e.capacity === null) return undefined;
  const left = e.capacity - e.seats_taken;
  if (left <= 0) return e.waitlist_enabled ? { label: 'BEKLEME LİSTESİ', tone: 'apricot' } : { label: 'KONTENJAN DOLDU', tone: 'danger' };
  if (left <= Math.max(3, Math.ceil(e.capacity * 0.1))) return { label: `SON ${left} YER`, tone: 'apricot' };
  return undefined;
}

/** Everything a PosterCard shows for an event; the screen adds navigation (and saving, when it exists). */
export type EventPosterModel = Omit<PosterCardProps, 'onPress' | 'saved' | 'onToggleSave'>;

export function toEventPoster(e: EventWithOrg): EventPosterModel {
  return {
    title: e.title, typeLabel: EVENT_TYPE_LABEL[e.type], availability: availability(e),
    dateLabel: formatDateRange(e.starts_at, e.ends_at), placeLabel: placeLabel(e),
    audienceLabel: audienceLabel(e), feeLabel: feeLabel(e.fee_minor_units),
    cover: { path: null, blurhash: null },
    fallback: { tone: e.tone, icon: EVENT_TYPE_ICON[e.type], line: e.poster_line ?? e.title },
    isDemo: e.is_demo,
  };
}

/**
 * Why registration is not possible, for the detail screen's single notice and footer line (approved S11): `short` is the
 * deciding reason, shown as the notice title and alone in the footer; `detail` is the notice body. Unknown codes fall back.
 */
export const BLOCKER_COPY: Record<string, { short: string; detail: string }> = {
  registration_closed: { short: 'Kayıtlar kapandı.', detail: 'Bu etkinliğin son kayıt tarihi geçti.' },
  registration_not_open: { short: 'Kayıtlar henüz açılmadı.', detail: 'Kayıtlar açıldığında bu sayfadan katılabilirsin.' },
  event_full: { short: 'Kontenjan doldu.', detail: 'Bu etkinlikte boş yer kalmadı ve bekleme listesi yok.' },
  below_min_age: { short: 'Bu etkinlik senin yaş grubuna açık değil.', detail: 'Yaş sınırını etkinliği düzenleyen kurum belirler.' },
  above_max_age: { short: 'Bu etkinlik senin yaş grubuna açık değil.', detail: 'Yaş sınırını etkinliği düzenleyen kurum belirler.' },
  team_registration_only: { short: 'Bu etkinliğe takım olarak kayıt olunuyor.', detail: 'Bir takımla katılmak için Topluluk’ta takımını bulabilirsin.' },
};
const BLOCKER_FALLBACK = { short: 'Bu etkinliğe şu an kayıt olamıyorsun.', detail: '' };
export const blockerCopy = (reason: string) => BLOCKER_COPY[reason] ?? BLOCKER_FALLBACK;

