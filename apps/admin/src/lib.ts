import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../mobile/src/lib/database.generated';

export type Db = Database['public'];
export type EventRow = Db['Tables']['events']['Row'];
export type EventInsert = Db['Tables']['events']['Insert'];
export type PublishStatus = Db['Enums']['publish_status'];
export type RegistrationStatus = Db['Enums']['registration_status'];
export type OrgRole = Db['Enums']['org_member_role'];
export type RegistrationItem = Db['Functions']['admin_event_registrations']['Returns'][number];

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configured = !!url && !!key;
export const supabase = createClient<Database>(url ?? 'http://invalid.local', key ?? 'missing');

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
  if (code === 'ticket_wrong_event' && err.details) message += `: ${err.details}.`;
  if (code === 'registration_not_confirmed' && err.details) message += ` (${REG_STATUS_TR[err.details] ?? err.details}).`;
  return { code, message };
}

export const STATUS_LABEL: Record<PublishStatus, string> = { draft: 'Taslak', in_review: 'İncelemede', published: 'Yayında', cancelled: 'İptal edildi', archived: 'Arşiv' };
export const REG_LABEL: Record<RegistrationStatus, string> = { confirmed: 'Onaylı', waitlisted: 'Bekleme listesi', pending_guardian: 'Veli onayı bekliyor', pending_review: 'Değerlendirmede', cancelled: 'İptal', rejected: 'Uygun bulunmadı', expired: 'Süresi doldu' };
export const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }) : '—');
export const closedForRegistration = (e: EventRow) => e.status === 'published' && new Date(e.registration_closes_at) <= new Date();
