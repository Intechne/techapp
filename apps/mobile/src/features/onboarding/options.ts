import type { EducationStage } from '../../lib/database.types';
import type { TechIconName } from '../../design-system';

/** Education stage is NOT age. It only personalises discovery; age rules use the birth date on the server. */
export const EDUCATION_STAGES: readonly { value: EducationStage; label: string; description?: string }[] = [
  { value: 'high_school', label: 'Lise' },
  { value: 'university', label: 'Üniversite' },
  { value: 'graduate', label: 'Yeni mezun' },
  { value: 'middle_school', label: 'Ortaokul' },
  { value: 'other', label: 'Başka bir yerdeyim', description: 'Çalışıyorum, ara verdim ya da kendi yolumdayım.' },
];

/** Offline fallback for the guest onboarding; the live list comes from the `interests` table. */
export const FALLBACK_INTERESTS: readonly { slug: string; label: string; icon: TechIconName }[] = [
  { slug: 'teknoloji', label: 'Teknoloji', icon: 'code' },
  { slug: 'robotik', label: 'Robotik', icon: 'robot' },
  { slug: 'girisimcilik', label: 'Girişimcilik', icon: 'rocket' },
  { slug: 'sosyal_etki', label: 'Sosyal etki', icon: 'leaf' },
  { slug: 'yazilim', label: 'Yazılım', icon: 'code' },
  { slug: 'tasarim', label: 'Tasarım', icon: 'spark' },
  { slug: 'muhendislik', label: 'Mühendislik', icon: 'settings' },
  { slug: 'kisisel_gelisim', label: 'Kişisel gelişim', icon: 'learn' },
];
