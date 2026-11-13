import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../mobile/src/lib/database.generated';

export type Db = Database['public'];
export type EventRow = Db['Tables']['events']['Row'];
export type EventInsert = Db['Tables']['events']['Insert'];
export type PublishStatus = Db['Enums']['publish_status'];
export type RegistrationStatus = Db['Enums']['registration_status'];
export type OrgRole = Db['Enums']['org_member_role'];
export type RegistrationItem = Db['Functions']['admin_event_registrations']['Returns'][number];
export type VolunteerItem = Db['Functions']['admin_event_volunteers']['Returns'][number];
export type VolunteerStatus = Db['Enums']['volunteer_status'];
export type AnnouncementRow = Db['Tables']['event_announcements']['Row'];
export type Audience = Db['Enums']['announcement_audience'];
export type OpportunityRow = Db['Tables']['opportunities']['Row'];
export type OpportunityInsert = Db['Tables']['opportunities']['Insert'];
export type OpportunityType = Db['Enums']['opportunity_type'];
export type ApplicationRow = Db['Tables']['applications']['Row'];
export type ApplicationStatus = Db['Enums']['application_status'];
export type ApplicationHistoryRow = Db['Tables']['application_status_history']['Row'];
export type AttestationRow = Db['Tables']['attestations']['Row'];
export type AttestationStatus = Db['Enums']['attestation_status'];
export type ExperienceRow = Db['Tables']['experiences']['Row'];

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configured = !!url && !!key;
// Staff sessions live only as long as the browser tab (sessionStorage), not indefinitely on a shared office machine.
export const supabase = createClient<Database>(url ?? 'http://invalid.local', key ?? 'missing', {
  auth: { storage: typeof window !== 'undefined' ? window.sessionStorage : undefined, persistSession: true, autoRefreshToken: true },
});

export interface Account { user_id: string; is_platform_admin: boolean; organization_roles: { organization_id: string; role: OrgRole }[] }

const COPY: Record<string, string> = {
  forbidden: 'Bu işlem için yetkin yok.', auth_required: 'Oturumun kapanmış. Tekrar giriş yap.',
  publish_requires_platform_approval: 'Yayına alma Intechne onayıyla yapılır. Etkinliği incelemeye gönderebilirsin.',
  event_status_transition_invalid: 'Bu durum geçişi yapılamıyor.', event_counters_locked: 'Kontenjan sayaçları sunucu tarafından yönetilir.',
  checkin_forbidden: 'Bu etkinlikte giriş kontrolü yapma yetkin yok.', ticket_malformed: 'Bu bir TechApp katılım kodu değil.',
  ticket_unknown: 'Bu kodla eşleşen bir kayıt yok.', ticket_invalid: 'Kod geçersiz: iptal edilmiş ya da yenilenmiş bir karta ait olabilir.',
  ticket_wrong_event: 'Bu kart başka bir etkinliğe ait', registration_not_confirmed: 'Kayıt onaylı değil', event_not_active: 'Etkinlik yayında değil.',
  outside_checkin_window: 'Giriş kontrolü etkinlikten 3 saat önce açılır ve etkinlik bitince kapanır.',
  registration_not_pending_review: 'Bu kayıt artık değerlendirme beklemiyor.', review_forbidden: 'Kayıt değerlendirme yetkin yok.',
  team_registration_not_found: 'Bu takım kaydı bulunamadı.', team_registration_not_pending_review: 'Bu takım kaydı artık değerlendirme beklemiyor.',
  tenant_locked: 'Kayıt başka bir kuruma taşınamaz.', field_locked: 'Bu alan yalnızca Intechne tarafından değiştirilebilir.',
  volunteer_application_not_found: 'Gönüllü başvurusu bulunamadı.', volunteer_withdrawn: 'Başvuru sahibi gönüllülükten çekilmiş; karar verilemez.',
  application_review_forbidden: 'Bu başvuruyu değerlendirme yetkin yok.', cannot_review_own_application: 'Kendi başvurunu değerlendiremezsin.',
  application_transition_invalid: 'Bu başvuru bu duruma geçirilemez', attestation_forbidden: 'Bu doğrulama talebinde işlem yapma yetkin yok.',
  self_attestation_forbidden: 'Kendi deneyimini doğrulayamazsın.', attestation_not_pending: 'Bu talep artık karar beklemiyor.',
  attestation_scope_required: 'Doğrulamak için kapsamı yazman gerekiyor: tam olarak neyi doğruluyorsun?', attestation_decision_invalid: 'Geçersiz karar.',
  attestation_not_verified: 'Yalnızca doğrulanmış kayıtlar iptal edilebilir.', revoke_reason_required: 'İptal gerekçesi yazman gerekiyor.',
  event_not_found: 'Etkinlik bulunamadı.',
  cover_forbidden: 'Bu içeriğin kapağını değiştirme yetkin yok.', cover_path_forbidden: 'Görsel yalnızca bu içeriğin kurum klasörüne bağlanabilir.',
  cover_path_invalid: 'Görsel yolu geçersiz. Yeniden yükle.', cover_blurhash_invalid: 'Görsel önizlemesi hazırlanamadı. Yeniden yükle.',
  cover_upload_missing: 'Görsel dosyaları (tam boy ve 640 px) yüklenmemiş. Yeniden yükle.', cover_entity_invalid: 'Bu içerik türüne kapak eklenemez.',
  cover_target_not_found: 'Kapak eklenecek içerik bulunamadı.', cover_write_forbidden: 'Kapak yalnızca kapak yükleme adımıyla değiştirilebilir.',
  team_cover_disabled: 'Takım kapakları şimdilik kapalı (hukuki inceleme ve fotoğraf politikası bekleniyor); yalnız platform yöneticisi ekleyebilir.',
  otp_disabled: 'Bu e-posta ile kayıtlı bir ekip hesabı yok.', otp_expired: 'Kod hatalı ya da süresi dolmuş.', over_email_send_rate_limit: 'Çok sık denedin. Biraz bekleyip tekrar dene.',
  '23505': 'Bu kısa ad (slug) zaten kullanılıyor.', '23514': 'Alanlardan biri kurallara uymuyor (tarih sırası, yaş aralığı ya da metin uzunluğu).',
  '42501': 'Bu işlem için yetkin yok.',
};
const REG_STATUS_TR: Record<string, string> = { cancelled: 'iptal edilmiş', waitlisted: 'bekleme listesinde', pending_guardian: 'veli onayı bekliyor', pending_review: 'değerlendirmede', rejected: 'uygun bulunmadı', expired: 'süresi dolmuş' };

export interface UiError { code: string; message: string }
export function toUiError(e: unknown): UiError {
  const err = (e ?? {}) as { code?: string; message?: string; details?: string };
  if (/failed to fetch|network/i.test(err.message ?? '')) return { code: 'network', message: 'Sunucuya ulaşılamadı. İşlem tamamlanmadı.' };
  const code = /^PT\d{3}$/.test(err.code ?? '') ? (err.message ?? 'unknown') : (err.code ?? 'unknown');
  let message = COPY[code] ?? 'İşlem tamamlanamadı.';
  if (code === 'application_transition_invalid' && err.details) message += ` (${err.details}).`;
  if (code === 'ticket_wrong_event' && err.details) message += `: ${err.details}.`;
  if (code === 'registration_not_confirmed' && err.details) message += ` (${REG_STATUS_TR[err.details] ?? err.details}).`;
  return { code, message };
}

export const STATUS_LABEL: Record<PublishStatus, string> = { draft: 'Taslak', in_review: 'İncelemede', published: 'Yayında', cancelled: 'İptal edildi', archived: 'Arşiv' };
export const REG_LABEL: Record<RegistrationStatus, string> = { confirmed: 'Onaylı', waitlisted: 'Bekleme listesi', pending_guardian: 'Veli onayı bekliyor', pending_review: 'Değerlendirmede', cancelled: 'İptal', rejected: 'Uygun bulunmadı', expired: 'Süresi doldu' };
export const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }) : '—');
export const closedForRegistration = (e: EventRow) => e.status === 'published' && new Date(e.registration_closes_at) <= new Date();

export const VOLUNTEER_LABEL: Record<VolunteerStatus, string> = { pending: 'Bekliyor', approved: 'Onaylı', rejected: 'Reddedildi', withdrawn: 'Çekildi' };
export const AUDIENCE_LABEL: Record<Audience, string> = { all: 'Herkes', participants: 'Katılımcılar', volunteers: 'Gönüllüler' };
export const AUDIENCE_HELP: Record<Audience, string> = {
  all: 'Kaydı onaylanmış katılımcılar ve onaylı gönüllüler görür.',
  participants: 'Yalnızca kaydı onaylanmış katılımcılar görür. Bekleme listesindekiler göremez.',
  volunteers: 'Yalnızca bu etkinlikte onayladığın gönüllüler görür.',
};
export const OPP_TYPE_LABEL: Record<OpportunityType, string> = {
  internship: 'Staj', volunteering: 'Gönüllülük', entrepreneurship: 'Girişimcilik', talent_program: 'Yetenek programı', project_call: 'Proje çağrısı',
  competition: 'Yarışma', grant: 'Hibe', award: 'Ödül', scholarship: 'Burs',
};
export const APP_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Taslak', submitted: 'Gönderildi', in_review: 'İncelemede', info_requested: 'Ek bilgi istendi', accepted: 'Kabul', declined: 'Uygun bulunmadı', withdrawn: 'Geri çekildi', closed: 'Kapandı',
};
/** Mirror of app.application_transition_allowed(): the server re-checks every move. */
export const APP_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  submitted: ['in_review', 'closed'], in_review: ['info_requested', 'accepted', 'declined', 'closed'], info_requested: ['in_review', 'declined', 'closed'],
};
export const ATT_STATUS_LABEL: Record<AttestationStatus, string> = { requested: 'Karar bekliyor', verified: 'Doğrulandı', changes_requested: 'Düzeltme istendi', rejected: 'Uygun bulunmadı', revoked: 'İptal edildi' };
/** The 12 profile fields an opportunity may ask applicants to share (database check constraint). */
export const SHARED_FIELDS: [string, string][] = [
  ['display_name', 'Profil adı'], ['legal_name', 'Resmî ad soyad'], ['email', 'E-posta adresi'], ['phone', 'Telefon'], ['city', 'Şehir'], ['education_stage', 'Eğitim aşaması'],
  ['school_name', 'Okul / üniversite'], ['headline', 'Profil başlığı'], ['bio', 'Hakkında yazısı'], ['birth_year', 'Doğum yılı (gün/ay değil)'], ['interests', 'İlgi alanları'], ['experiences', 'Deneyimler (doğrulama durumuyla)'],
];
export const EDUCATION_LABEL: Record<string, string> = { middle_school: 'Ortaokul', high_school: 'Lise', university: 'Üniversite', graduate: 'Yeni mezun', other: 'Diğer' };
export const EDIT_ROLES: OrgRole[] = ['owner', 'admin', 'editor'];
export const REVIEW_ROLES: OrgRole[] = ['owner', 'admin', 'reviewer'];
export const orgsWith = (account: Account, roles: OrgRole[]) => account.organization_roles.filter((r) => roles.includes(r.role)).map((r) => r.organization_id);
export const roleIn = (account: Account, orgId: string | undefined) => account.organization_roles.find((r) => r.organization_id === orgId)?.role;
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' }) : '—');
export function daysLeft(iso: string): number { return Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5); }
// <input type="datetime-local"> helpers (the panel is operated in the browser's zone).
export const toLocalInput = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export const fromLocalInput = (local: string) => (local ? new Date(local).toISOString() : null);
export const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
export const slugify = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
