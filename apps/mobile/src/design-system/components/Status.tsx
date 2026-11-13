import React from 'react';
import { Tag } from './Chips';
import type { TechIconName } from '../TechIcon';
import type { RegistrationStatus as RegStatus, GuardianStatus, TeamRegistrationStatus, TeamMemberStep } from '../../lib/database.types';
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

/** A team's registration for a team-mode event (captain / mentor view). Same family as registrationStatusView, wording only here. */
export const teamRegistrationStatusView: Record<TeamRegistrationStatus, StatusView> = {
  pending_members: { label: 'ÜYELER BEKLENİYOR', tone: 'iris', icon: 'clock' },
  pending_review: { label: 'DEĞERLENDİRMEDE', tone: 'iris', icon: 'clock' },
  confirmed: { label: 'TAKIMIN ONAYLANDI', tone: 'moss', icon: 'check' },
  waitlisted: { label: 'BEKLEME LİSTESİNDE', tone: 'apricot', icon: 'clock' },
  cancelled: { label: 'İPTAL EDİLDİ', tone: 'neutral' },
  rejected: { label: 'UYGUN BULUNMADI', tone: 'danger' },
  expired: { label: 'SÜRESİ DOLDU', tone: 'neutral' },
};

/**
 * A member's own registration inside a team registration. Their own confirmation is not the team's: until the team is confirmed
 * (or while that is still unknown) the card is not theirs yet, so "KATILIMIN ONAYLANDI" must not show. Fails closed.
 */
export const teamAwareRegistrationView = (status: RegStatus, teamStatus: TeamRegistrationStatus | undefined): StatusView =>
  status === 'confirmed' && teamStatus !== 'confirmed' ? { label: 'TAKIMIN BEKLENİYOR', tone: 'apricot', icon: 'clock' } : registrationStatusView[status];

/** One roster member of a team registration. `guardian` only says a guardian's answer is awaited: nothing more about it. */
export const teamMemberStepView: Record<TeamMemberStep, StatusView> = {
  invited: { label: 'DAVET BEKLİYOR', tone: 'iris', icon: 'clock' },
  guardian: { label: 'VELİ ONAYI BEKLENİYOR', tone: 'iris', icon: 'shield' },
  ready: { label: 'HAZIR', tone: 'moss', icon: 'check' },
  declined: { label: 'KATILMIYOR', tone: 'neutral' },
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

/** A row of the consent center: given and still in force, or withdrawn. */
export const consentStatusView = {
  active: { label: 'GEÇERLİ', tone: 'moss', icon: 'check' },
  withdrawn: { label: 'GERİ ÇEKİLDİ', tone: 'neutral' },
} as const satisfies Record<string, StatusView>;

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

/** A team's recruitment post as its managers see it: open to applications or not. */
export const recruitmentPostStatusView = {
  open: { label: 'AÇIK', tone: 'moss', icon: 'check' },
  closed: { label: 'KAPALI', tone: 'neutral' },
} as const satisfies Record<string, StatusView>;

/** Neutral age flag on a person a manager is about to decide on (server-computed `is_minor`; a missing birth date counts as under 18). */
export const minorAgeView = { label: '18 YAŞ ALTI', tone: 'neutral' } as const satisfies StatusView;

export const volunteerStatusView = {
  pending: { label: 'GÖNÜLLÜ BAŞVURUN DEĞERLENDİRİLİYOR', tone: 'iris', icon: 'clock' },
  approved: { label: 'GÖNÜLLÜ EKİPTESİN', tone: 'moss', icon: 'check' },
  rejected: { label: 'GÖNÜLLÜ BAŞVURUN KABUL EDİLMEDİ', tone: 'neutral' },
  withdrawn: { label: 'GÖNÜLLÜLÜKTEN ÇEKİLDİN', tone: 'neutral' },
} as const satisfies Record<string, StatusView>;

/** Course progress (server percent). Not started = no badge; finished = TAMAMLANDI. */
export function courseProgressView(percent: number, completed: boolean): StatusView | null {
  if (completed || percent >= 100) return { label: 'TAMAMLANDI', tone: 'moss', icon: 'check' };
  return percent > 0 ? { label: `%${percent} TAMAMLANDI`, tone: 'iris' } : null;
}
export const lessonDoneView = { label: 'TAMAMLANDI', tone: 'moss', icon: 'check' } as const satisfies StatusView;

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
/** Steps of a team registration: Gönderildi → Üyeler hazır → [İnceleme] → Onaylandı. */
export type TeamStepKey = 'registered' | 'members' | 'review' | 'confirmed';
export interface RegistrationStep { key: RegistrationStepKey | TeamStepKey; label: string; state: StepState }

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

export const teamStepLabels: Record<TeamStepKey, string> = {
  registered: 'Gönderildi',
  members: 'Üyeler hazır',
  review: 'İnceleme',
  confirmed: 'Onaylandı',
};

/**
 * Display timeline of a team registration. The server status is the authority; `requiresReview` only says whether the review step
 * belongs in the line before the organiser has acted (pending_review and rejected always show it). Cancelled has no timeline.
 */
export function teamRegistrationSteps(status: TeamRegistrationStatus, requiresReview: boolean): RegistrationStep[] {
  if (status === 'cancelled') return [];
  const review = requiresReview || status === 'pending_review' || status === 'rejected';
  const s: Record<TeamStepKey, StepState> = { registered: 'done', members: 'todo', review: 'todo', confirmed: 'todo' };
  switch (status) {
    case 'pending_members': s.members = 'current'; break;
    case 'pending_review': s.members = 'done'; s.review = 'current'; break;
    case 'confirmed': s.members = 'done'; s.review = 'done'; s.confirmed = 'done'; break;
    case 'waitlisted': s.members = 'blocked'; break;
    case 'rejected': s.members = 'done'; s.review = 'failed'; s.confirmed = 'skipped'; break;
    case 'expired': s.members = 'failed'; s.review = 'skipped'; s.confirmed = 'skipped'; break;
  }
  const keys: TeamStepKey[] = review ? ['registered', 'members', 'review', 'confirmed'] : ['registered', 'members', 'confirmed'];
  return keys.map((key) => ({ key, label: teamStepLabels[key], state: s[key] }));
}
