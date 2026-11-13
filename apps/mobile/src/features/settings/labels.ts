/** One row of public.consents as the client reads it (explicit columns, own rows only). */
export interface ConsentRow {
  id: string; purpose: string; policy_version: string; granted_by: string;
  subject_type: string | null; subject_id: string | null; granted_at: string; withdrawn_at: string | null;
}

/** What the database writes today. Anything else is shown as "Diğer izin": no description is made up for a purpose we do not know. */
const PURPOSE_LABEL: Record<string, string> = {
  event_participation: 'Etkinliğe katılım',
  application_data_sharing: 'Başvuruda bilgi paylaşımı',
};
export const consentPurposeLabel = (purpose: string): string => PURPOSE_LABEL[purpose] ?? 'Diğer izin';

export const consentGrantedByLabel = (grantedBy: string): string => (grantedBy === 'guardian' ? 'Velin' : grantedBy === 'self' ? 'Sen' : 'Bilinmiyor');

export type ConsentAction = { kind: 'cancel_registration' | 'withdraw_application'; target: string } | { kind: 'none' };

/**
 * There is no generic "geri çek" RPC. A participation consent is undone by cancelling the registration (cancel_event_registration
 * also withdraws its consents), an application consent by withdrawing the application (withdraw_application). Only an active
 * consent whose subject we know gets an action; the screen opens the existing screen that runs that RPC.
 */
export function consentAction(c: ConsentRow): ConsentAction {
  if (c.withdrawn_at || !c.subject_id) return { kind: 'none' };
  if (c.subject_type === 'event_registration') return { kind: 'cancel_registration', target: c.subject_id };
  if (c.subject_type === 'application') return { kind: 'withdraw_application', target: c.subject_id };
  return { kind: 'none' };
}

/**
 * What switching discoverability on does, as it is true today: team pages are readable without an account and name the
 * adult captains / mentors who are discoverable (team_public_profile); signed-in users can open a discoverable profile
 * (profiles_select_discoverable — the whole profiles row: display_name, headline, bio, city, education_stage, skills,
 * avatar_path) and the experiences it shows on the profile with their attestations. profile_private (birth date, contact)
 * stays owner-only. No legal wording.
 */
export const DISCOVERABLE_HELP =
  'Açık olduğunda adın, kaptanı ya da mentoru olduğun takımların sayfasında herkese görünür. Giriş yapmış kullanıcılar profilini açıp adını, başlığını, hakkında yazını, şehrini, eğitim düzeyini, becerilerini ve profil fotoğrafını; “profilimde göster” dediğin deneyimleri (kurum, rol, katkı, tarih ve varsa doğrulama bilgisiyle) görebilir. İletişim bilgilerin ve doğum tarihin hiçbir zaman görünmez.';
export const MINOR_DISCOVERABLE_TEXT = '18 yaşını doldurduğunda açabilirsin.';
export const MINOR_DISCOVERABLE_EXPLAIN = '18 yaşından küçük kullanıcıların profilleri başkaları tarafından bulunamaz ve takım sayfalarında adı geçmez.';
export const RETENTION_FACT = 'Bildirimler oluşturulmasından 90 gün sonra, okunmuşsa silinir.';
