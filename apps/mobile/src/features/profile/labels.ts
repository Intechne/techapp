import type { TechIconName } from '../../design-system';
import type { Provenance } from './logic';

type Tone = 'iris' | 'moss' | 'neutral' | 'danger' | 'apricot';

export const EXPERIENCE_KINDS = [
  { value: 'project', label: 'Proje' }, { value: 'competition', label: 'Yarışma' }, { value: 'volunteering', label: 'Gönüllülük' },
  { value: 'work', label: 'İş / staj' }, { value: 'education', label: 'Eğitim' }, { value: 'event_participation', label: 'Etkinlik' }, { value: 'other', label: 'Diğer' },
] as const;
export type ExperienceKind = (typeof EXPERIENCE_KINDS)[number]['value'];
export const KIND_LABEL: Record<ExperienceKind, string> = Object.fromEntries(EXPERIENCE_KINDS.map((k) => [k.value, k.label])) as Record<ExperienceKind, string>;
export const KIND_ICON: Record<ExperienceKind, TechIconName> = { project: 'code', competition: 'robot', volunteering: 'leaf', work: 'opportunity', education: 'learn', event_participation: 'event', other: 'spark' };

/** Wording for where an entry's credibility comes from. Only `verified` uses the verified look. */
export const PROVENANCE_VIEW: Record<Provenance, { label: string; tone: Tone; icon?: TechIconName; explain: string }> = {
  verified: { label: 'DOĞRULANDI', tone: 'moss', icon: 'verified', explain: 'Bu deneyim bir kurum tarafından doğrulandı.' },
  self: { label: 'KENDİ BEYANI', tone: 'neutral', explain: 'Bu deneyimi sen ekledin. Henüz bir kurum doğrulamadı.' },
  pending: { label: 'DOĞRULAMA BEKLENİYOR', tone: 'iris', icon: 'clock', explain: 'Kurum isteğini inceliyor. Sonuçlanana kadar kendi beyanın olarak görünür.' },
  changes_requested: { label: 'DÜZELTME İSTENDİ', tone: 'apricot', explain: 'Kurum bazı bilgilerin düzeltilmesini istedi. Düzenleyip yeniden doğrulama isteyebilirsin.' },
  rejected: { label: 'UYGUN BULUNMADI', tone: 'danger', explain: 'Kurum bu deneyimi doğrulamadı. Kendi beyanın olarak kalır.' },
  revoked: { label: 'DOĞRULAMA İPTAL EDİLDİ', tone: 'neutral', explain: 'Doğrulama geri alındı. Doğrulanan bilgileri değiştirdiysen yeniden isteyebilirsin.' },
  expired: { label: 'DOĞRULAMANIN SÜRESİ DOLDU', tone: 'neutral', explain: 'Doğrulamanın geçerlilik süresi doldu. Yeniden doğrulama isteyebilirsin.' },
};

export const TEAM_ROLE_LABEL = { captain: 'Kaptan', mentor: 'Mentor', member: 'Üye' } as const;
export const EDUCATION_LABEL = { middle_school: 'Ortaokul', high_school: 'Lise', university: 'Üniversite', graduate: 'Yeni mezun', other: 'Kendi yolunda' } as const;
