import React from 'react';
import { Tag } from './Chips';
import type { TechIconName } from '../TechIcon';
import type { RegistrationStatus as RegStatus, GuardianStatus } from '../../lib/database.types';
import { formatTime } from '../../lib/dates';

type Tone = 'iris' | 'moss' | 'neutral' | 'danger' | 'apricot';
/** A status as cards and badges show it: capitalised label, tag tone, optional glyph. */
export interface StatusView { label: string; tone: Tone; icon?: TechIconName }

/** Single source for status wording: status strings are never re-typed in screens. */
export const registrationStatusView: Record<RegStatus, StatusView> = {
  confirmed: { label: 'KATILIMIN ONAYLANDI', tone: 'moss', icon: 'check' },
  waitlisted: { label: 'BEKLEME LİSTESİNDESİN', tone: 'apricot', icon: 'clock' },
  pending_guardian: { label: 'VELİ ONAYI BEKLENİYOR', tone: 'iris', icon: 'shield' },
  pending_review: { label: 'DEĞERLENDİRMEDE', tone: 'iris', icon: 'clock' },
  cancelled: { label: 'İPTAL EDİLDİ', tone: 'neutral' },
  rejected: { label: 'UYGUN BULUNMADI', tone: 'danger' },
  expired: { label: 'SÜRESİ DOLDU', tone: 'neutral' },
};

/** A confirmed registration whose holder has already been checked in: the card is no longer what matters. */
export const checkedInRegistrationView: StatusView = { label: 'GİRİŞ YAPILDI', tone: 'moss', icon: 'check' };

export const guardianStatusView: Record<GuardianStatus | 'not_sent', StatusView> = {
  not_sent: { label: 'VELİ ONAYI GEREKLİ', tone: 'apricot', icon: 'shield' },
  pending: { label: 'VELİ ONAYI GÖNDERİLDİ · BEKLENİYOR', tone: 'iris', icon: 'clock' },
  approved: { label: 'VELİ ONAYLADI', tone: 'moss', icon: 'check' },
  denied: { label: 'VELİ REDDETTİ', tone: 'danger' },
  expired: { label: 'BAĞLANTININ SÜRESİ DOLDU', tone: 'neutral' },
  revoked: { label: 'ONAY GERİ ÇEKİLDİ', tone: 'neutral' },
};

export const applicationStatusView = {
  draft: { label: 'TASLAK', tone: 'neutral' },
  submitted: { label: 'GÖNDERİLDİ', tone: 'iris' },
  in_review: { label: 'İNCELEMEDE', tone: 'iris' },
  info_requested: { label: 'EK BİLGİ İSTENİYOR', tone: 'apricot' },
  accepted: { label: 'KABUL EDİLDİ', tone: 'moss' },
  declined: { label: 'UYGUN BULUNMADI', tone: 'danger' },
  withdrawn: { label: 'GERİ ÇEKİLDİ', tone: 'neutral' },
  closed: { label: 'KAPANDI', tone: 'neutral' },
} as const satisfies Record<string, StatusView>;

/** A user's own team membership (Takımlarım). Roles are labels, not statuses: they stay in features/teams/labels. */
export const membershipStatusView = {
  active: { label: 'ÜYESİN', tone: 'moss' },
  pending: { label: 'İSTEĞİN BEKLİYOR', tone: 'apricot', icon: 'clock' },
} as const satisfies Record<string, StatusView>;

export const volunteerStatusView = {
  pending: { label: 'GÖNÜLLÜ BAŞVURUN DEĞERLENDİRİLİYOR', tone: 'iris', icon: 'clock' },
  approved: { label: 'GÖNÜLLÜ EKİPTESİN', tone: 'moss', icon: 'check' },
  rejected: { label: 'GÖNÜLLÜ BAŞVURUN KABUL EDİLMEDİ', tone: 'neutral' },
  withdrawn: { label: 'GÖNÜLLÜLÜKTEN ÇEKİLDİN', tone: 'neutral' },
} as const satisfies Record<string, StatusView>;

/** Staff check-in outcomes: title for the result block + spoken prefix for the screen-reader announcement. */
export const checkInOutcomeView = {
  checked_in: { title: 'GİRİŞ ONAYLANDI', tone: 'moss', icon: 'check', spoken: 'Giriş onaylandı' },
  already_checked_in: { title: 'DAHA ÖNCE GİRİŞ YAPILMIŞ', tone: 'apricot', icon: 'clock', spoken: 'Daha önce giriş yapılmış' },
  failed: { title: 'GİRİŞ ONAYLANMADI', tone: 'danger', icon: 'close', spoken: 'Giriş onaylanmadı' },
} as const satisfies Record<string, { title: string; tone: Tone; icon: TechIconName; spoken: string }>;

/** Result block of a successful scan: outcome wording plus the two detail sentences (kept here, not in the screen). */
export function checkInResultView(r: { result: 'checked_in' | 'already_checked_in'; checked_in_at: string; holder_name: string | null }) {
  return {
    ...checkInOutcomeView[r.result],
    detail: r.result === 'checked_in' ? 'Hoş geldin diyebilirsin.' : `İlk giriş saati: ${formatTime(r.checked_in_at)}. Aynı kodla ikinci giriş kaydedilmedi.`,
    name: r.holder_name ?? 'Katılımcı',
  };
}

export function StatusBadge({ view }: { view: StatusView }) {
  return <Tag label={view.label} tone={view.tone} icon={view.icon} />;
}
export const RegistrationStatus = ({ status, checkedIn }: { status: RegStatus; checkedIn?: boolean }) =>
  <StatusBadge view={checkedIn && status === 'confirmed' ? checkedInRegistrationView : registrationStatusView[status]} />;
export const ApplicationStatus = ({ status }: { status: keyof typeof applicationStatusView }) => <StatusBadge view={applicationStatusView[status]} />;
export const VolunteerStatus = ({ status }: { status: keyof typeof volunteerStatusView }) => <StatusBadge view={volunteerStatusView[status]} />;

export type RegistrationStepKey = 'registered' | 'guardian' | 'confirmed' | 'card';
/** blocked = waiting on something outside the user's control (waitlist); failed/skipped = final, will not happen. */
export type StepState = 'done' | 'current' | 'todo' | 'blocked' | 'failed' | 'skipped';
export interface RegistrationStep { key: RegistrationStepKey; label: string; state: StepState }

export const registrationStepLabels: Record<RegistrationStepKey, string> = {
  registered: 'Başvurun alındı',
  guardian: 'Veli onayı',
  confirmed: 'Katılım onayı',
  card: 'Katılım kartı',
};
/** Spoken/visible state text; also the non-colour cue next to each step. */
export const stepStateText: Record<StepState, string> = {
  done: 'tamamlandı',
  current: 'şu an bu adımda',
  todo: 'sırada',
  blocked: 'beklemede',
  failed: 'gerçekleşmedi',
  skipped: 'gerçekleşmeyecek',
};

/**
 * Maps the server's registration status to a display timeline. It never decides anything: `status` is the authority,
 * `needsGuardian` only says whether the guardian step belongs in the line (a minor's registration).
 * Cancelled registrations have no timeline.
 */
export function registrationSteps(status: RegStatus, needsGuardian: boolean): RegistrationStep[] {
  if (status === 'cancelled') return [];
  const guardian = needsGuardian || status === 'pending_guardian';
  const s: Record<RegistrationStepKey, StepState> = { registered: 'done', guardian: 'todo', confirmed: 'todo', card: 'todo' };
  switch (status) {
    case 'pending_guardian': s.guardian = 'current'; break;
    case 'pending_review': s.confirmed = 'current'; break;
    case 'confirmed': s.guardian = 'done'; s.confirmed = 'done'; s.card = 'current'; break;
    case 'waitlisted': s.guardian = 'done'; s.confirmed = 'blocked'; break;
    case 'rejected': s.confirmed = 'failed'; s.card = 'skipped'; break;
    case 'expired':
      if (guardian) { s.guardian = 'failed'; s.confirmed = 'skipped'; } else s.confirmed = 'failed';
      s.card = 'skipped'; break;
  }
  const keys: RegistrationStepKey[] = guardian ? ['registered', 'guardian', 'confirmed', 'card'] : ['registered', 'confirmed', 'card'];
  return keys.map((key) => ({ key, label: registrationStepLabels[key], state: s[key] }));
}
