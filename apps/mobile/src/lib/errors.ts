/** One error contract for the whole app. Screens never show raw backend messages. */
export interface AppError {
  code: string;
  message: string;
  status: number;
  fieldErrors?: Record<string, string>;
  retryable: boolean;
  requestId?: string;
}

const COPY: Record<string, string> = {
  network_unreachable: 'İnternet bağlantını kontrol edip tekrar dener misin? İşlemin tamamlanmadı.',
  not_configured: 'Uygulama henüz bir sunucuya bağlanmadı. Kurulum ayarlarını kontrol et.',
  auth_required: 'Devam etmek için giriş yapman gerekiyor.',
  session_expired: 'Oturumunun süresi doldu. Tekrar giriş yapar mısın?',
  otp_invalid: 'Kod hatalı ya da süresi dolmuş. Yeni bir kod isteyebilirsin.',
  otp_expired: 'Kod hatalı ya da süresi dolmuş. Kontrol edip tekrar dene ya da yeni kod iste.',
  email_invalid: 'Geçerli bir e-posta adresi yaz.',
  rate_limited: 'Çok sık denedin. Biraz bekleyip tekrar dene.',
  forbidden: 'Bu işlem için yetkin yok.',
  not_found: 'Aradığın içerik bulunamadı ya da yayından kalktı.',
  event_not_found: 'Bu etkinlik artık yayında değil.',
  event_full: 'Kontenjan doldu ve bekleme listesi kapalı.',
  registration_closed: 'Bu etkinlik için kayıtlar kapandı.',
  registration_not_open: 'Kayıtlar henüz açılmadı.',
  team_registration_only: 'Bu etkinliğe yalnızca takım olarak kayıt olunabiliyor.',
  profile_incomplete: 'Devam etmeden önce profilini tamamlaman gerekiyor.',
  below_min_age: 'Bu etkinlik senin yaş grubuna açık değil.',
  above_max_age: 'Bu etkinlik senin yaş grubuna açık değil.',
  event_already_started: 'Etkinlik başladığı için kayıt artık iptal edilemiyor.',
  already_checked_in: 'Giriş yapılmış bir kayıt iptal edilemez.',
  registration_not_confirmed: 'Katılım kartı, kaydın onaylandığında hazır olacak.',
  registration_not_found: 'Bu kayıt bulunamadı.',
  guardian_not_required: 'Bu kayıt için veli onayı gerekmiyor.',
  guardian_email_invalid: 'Velinin e-posta adresini kontrol eder misin?',
  guardian_email_same_as_user: 'Veli e-postası kendi adresinden farklı olmalı.',
  guardian_send_limit: 'Bu kayıt için gönderim sınırına ulaştın. Destek ekibine yazabilirsin.',
  guardian_send_too_soon: 'Veli onay bağlantısı kısa süre önce gönderildi. Biraz sonra tekrar deneyebilirsin.',
  guardian_send_limit_user: 'Kısa sürede çok sayıda veli bağlantısı gönderildi. Biraz sonra tekrar deneyebilirsin.',
  guardian_send_limit_recipient: 'Bu adrese bugün yeterince bağlantı gönderildi. Yarın tekrar deneyebilirsin.',
  guardian_request_limit: 'Veli adresini bugün yeterince değiştirdin. Yarın tekrar deneyebilirsin.',
  guardian_request_not_pending: 'Bu veli isteği artık geçerli değil. Kayıt sayfandan yeniden isteyebilirsin.',
  guardian_request_not_found: 'Bu veli isteği bulunamadı.',
  mail_delivery_failed: 'E-posta şu anda gönderilemedi. Birazdan tekrar dener misin?',
  account_deletion_requires_support: 'Hesabını silmek için destek ekibine yazman gerekiyor.',
  shared_fields_changed: 'Kurum paylaşılacak bilgileri değiştirdi. Güncel listeye göz atıp yeniden onaylayabilirsin.',
  guardian_consent_unavailable: 'Bu başvuru şimdilik yalnızca 18 yaş ve üzeri için açık.',
  birth_date_invalid: 'Doğum tarihini kontrol eder misin?',
  birth_date_locked: 'Doğum tarihi sonradan değiştirilemiyor. Bir hata varsa destek ekibine yaz.',
  below_min_account_age: 'TechApp hesabı açmak için en az 13 yaşında olmalısın.',
  display_name_invalid: 'Adın en az 2 karakter olmalı.',
  checkin_forbidden: 'Bu etkinlikte giriş kontrolü yapma yetkin yok.',
  ticket_invalid: 'Bu kod geçerli değil.',
  ticket_malformed: 'Bu bir TechApp katılım kodu değil.',
  ticket_unknown: 'Bu kodla eşleşen bir kayıt yok.',
  short_code_malformed: 'Kod 8 karakter olmalı (harf ve rakam).',
  short_code_rate_limited: "Çok fazla hatalı deneme. Birkaç dakika sonra tekrar dene ya da QR'ı okut.",
  short_code_ambiguous: "Bu kod birden fazla kayıtla eşleşti; QR'ı okut.",
  checkin_event_required: 'Önce etkinliği seç.',
  method_not_allowed: 'Bu istek bu şekilde yapılamıyor. Uygulamayı güncelleyip tekrar dener misin?',
  outside_checkin_window: 'Giriş kontrolü etkinlikten 3 saat önce açılır.',
  volunteers_not_accepted: 'Bu etkinlik şu an gönüllü başvurusu almıyor.',
  volunteer_adults_only: 'Gönüllülük başvurusu şimdilik 18 yaş ve üzeri için açık.',
  volunteer_not_approved: 'Bu alan, düzenleyen ekibin onayladığı gönüllülere açık.',
  volunteer_application_not_found: 'Bu etkinlikte bir gönüllülük başvurun görünmüyor.',
  event_already_ended: 'Bu etkinlik sona erdi.',
  cv_sharing_adults_only: 'CV bağlantısı paylaşımı şimdilik 18 yaş ve üzeri için açık.',
  team_manage_forbidden: 'Bunu yalnızca takımın kaptanı ya da mentoru yapabilir.',
  membership_not_active: 'Bu kişi artık takımın aktif üyesi değil.',
  title_too_long: 'Unvan en fazla 60 karakter olabilir.',
  // teams
  team_members_only: 'Bu takımın üyelerini yalnızca takım üyeleri görebilir.',
  team_not_found: 'Bu takım bulunamadı ya da artık aktif değil.',
  team_name_invalid: 'Takım adı en az 2 karakter olmalı.',
  // 5 = the only limit, the literal in public.create_team (supabase/migrations/20260919000400_ecosystem.sql); the error carries no number.
  team_create_limit: 'En fazla 5 takım kurabilirsin.',
  team_closed_to_requests: 'Bu takım şu an katılım isteği almıyor.',
  already_team_member: 'Zaten bu takımın üyesisin.',
  membership_not_found: 'Bu üyelik bulunamadı.',
  membership_not_pending: 'Bu katılım isteği artık beklemede değil.',
  last_captain: 'Takımın tek kaptanı sensin. Önce başka bir üyeyi kaptan yap.',
  demote_captain_first: 'Bir kaptanı çıkarmadan önce rolünü değiştirmen gerekiyor.',
  cannot_change_own_role: 'Kendi rolünü değiştiremezsin. Bunu takımdaki başka bir kaptan yapabilir.',
  cannot_remove_self: 'Kendini takımdan çıkaramazsın; istersen takımdan ayrılabilirsin.',
  task_not_found: 'Bu görev bulunamadı.',
  task_forbidden: 'Bu görevi yalnızca sorumlusu ya da takımın kaptanı ve mentoru güncelleyebilir.',
  assignee_not_team_member: 'Görevi yalnızca takımın aktif üyelerinden birine verebilirsin.',
  recruitment_post_not_found: 'Bu ilan artık yayında değil.',
  recruitment_closed: 'Bu ilan şu an başvuru almıyor.',
  recruitment_application_not_pending: 'Bu başvuru artık karar beklemiyor.',
  // covers (set_cover)
  cover_forbidden: 'Kapağı yalnızca takımın kaptanı değiştirebilir.',
  cover_path_forbidden: 'Bu görsel buraya bağlanamaz. Yeniden yükleyip dener misin?',
  cover_path_invalid: 'Görsel yüklenemedi. Yeniden dener misin?',
  cover_blurhash_invalid: 'Görsel hazırlanamadı. Başka bir görselle dener misin?',
  cover_upload_missing: 'Görsel yüklemesi tamamlanmadı. Yeniden yükleyip dener misin?',
  cover_entity_invalid: 'Bu içeriğe kapak eklenemiyor.',
  cover_target_not_found: 'Kapak eklemek istediğin içerik bulunamadı.',
  // opportunities, experiences, learning
  opportunity_not_found: 'Bu fırsat artık yayında değil.',
  applications_not_open: 'Bu fırsatın başvuruları henüz açılmadı.',
  applications_closed: 'Bu fırsatın başvuruları kapandı.',
  application_not_found: 'Bu başvuru bulunamadı.',
  application_not_withdrawable: 'Bu başvuru artık geri çekilemiyor.',
  motivation_too_long: 'Yazdığın metin en fazla 2000 karakter olabilir. Biraz kısaltır mısın?',
  experience_not_found: 'Bu deneyim bulunamadı.',
  experience_is_draft: 'Doğrulama istemeden önce deneyimini yayınlaman gerekiyor.',
  organization_not_found: 'Bu kurum bulunamadı.',
  lesson_not_found: 'Bu ders artık yayında değil.',
  bookmark_target_not_found: 'Kaydetmek istediğin içerik artık yayında değil.',
  // profile, CV, check-in, requests
  discoverable_requires_adult: 'Profilini keşifte göstermek şimdilik 18 yaş ve üzeri için açık.',
  cv_not_found: 'Bu CV bağlantısı geçerli değil ya da kapatılmış.',
  event_not_active: 'Bu etkinlik şu an yayında değil, giriş kontrolü yapılamıyor.',
  ticket_wrong_event: 'Bu kart başka bir etkinliğe ait.',
  session_mismatch: 'Seçilen oturum bu etkinliğe ait değil.',
  device_invalid: 'Bildirimler için cihazın kaydedilemedi. Uygulamayı yeniden açıp tekrar dener misin?',
  idempotency_key_required: 'İşlem tamamlanamadı. Uygulamayı güncelleyip tekrar dener misin?',
  idempotency_key_reused: 'Bu istek daha önce başka bir işlem için gönderilmiş. Sayfayı yenileyip tekrar dener misin?',
  contract_mismatch: 'Uygulama ile sunucu uyumsuz görünüyor. Uygulamayı güncelleyip tekrar dener misin?',
  server_error: 'Bizim tarafta bir sorun oluştu. Birazdan tekrar dener misin?',
  unknown: 'Beklenmedik bir sorun oluştu. Tekrar dener misin?',
};

/** True when the app has its own Turkish sentence for this machine code (used by the copy-coverage test). */
export const hasErrorCopy = (code: string): boolean => Object.prototype.hasOwnProperty.call(COPY, code);

const STATUS_FALLBACK: Record<number, string> = { 401: 'session_expired', 403: 'forbidden', 404: 'not_found', 429: 'rate_limited' };

export function makeError(code: string, status = 0, extra: Partial<AppError> = {}): AppError {
  const known = code !== 'unknown' && code in COPY;
  const resolved = known ? code : STATUS_FALLBACK[status] ?? (status >= 500 ? 'server_error' : 'unknown');
  // Same machine code, different meaning: 422 comes from account creation, 403 from an event's age rule.
  const canonical = code === 'below_min_age' && status === 422 ? 'below_min_account_age' : resolved;
  return {
    code: known ? code : resolved,
    message: COPY[canonical] ?? COPY.unknown!,
    status,
    retryable: code === 'network_unreachable' || status === 429 || status >= 500,
    ...extra,
  };
}

interface ErrorLike { code?: unknown; message?: unknown; status?: unknown; name?: unknown }

/** Normalise anything thrown by supabase-js (PostgREST, Auth, Functions) or fetch into an AppError. */
export function toAppError(input: unknown): AppError {
  if (isAppError(input)) return input;
  const e = (input ?? {}) as ErrorLike;
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';

  if (/network request failed|failed to fetch|fetch failed|network error|timeout/i.test(message) || e.name === 'AuthRetryableFetchError') {
    return makeError('network_unreachable', 0);
  }
  // Our RPCs raise SQLSTATE PTxxx with a machine code as the message.
  const pt = /^PT(\d{3})$/.exec(code);
  if (pt) return makeError(message, Number(pt[1]));
  if (code === '42501') return makeError('forbidden', 403);
  if (code === 'PGRST116') return makeError('not_found', 404);
  if (code === '23505') return makeError('conflict', 409);

  // supabase auth errors
  if (code === 'otp_expired') return makeError('otp_expired', 422);
  if (/token has expired or is invalid/i.test(message)) return makeError('otp_invalid', 422);
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return makeError('rate_limited', 429);
  if (code === 'validation_failed' || code === 'email_address_invalid') return makeError('email_invalid', 422);

  const status = typeof e.status === 'number' ? e.status : 0;
  return makeError(code || 'unknown', status);
}

/**
 * Edge Function errors: supabase-js wraps every non-2xx response in a generic FunctionsHttpError and keeps the
 * Response in `context`. Our functions answer with the same { code, requestId } contract, so read it from there.
 */
export async function fromFunctionError(input: unknown): Promise<AppError> {
  const e = (input ?? {}) as { name?: unknown; context?: unknown };
  if (e.name === 'FunctionsFetchError' || e.name === 'FunctionsRelayError') return makeError('network_unreachable', 0);
  const response = e.context as { status?: unknown; clone?: () => { json: () => Promise<unknown> } } | undefined;
  if (e.name === 'FunctionsHttpError' && response && typeof response.clone === 'function') {
    const status = typeof response.status === 'number' ? response.status : 0;
    const body = (await response.clone().json().catch(() => null)) as { code?: unknown; requestId?: unknown } | null;
    if (body && typeof body.code === 'string') {
      return makeError(body.code, status, typeof body.requestId === 'string' ? { requestId: body.requestId } : {});
    }
    return makeError('unknown', status);
  }
  return toAppError(input);
}

export function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'retryable' in value && 'code' in value && 'status' in value;
}

/** Validate a jsonb RPC payload at the boundary: a contract drift becomes a clear error, not a crash deep in a screen. */
export function parsePayload<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw makeError('contract_mismatch', 500, { retryable: false });
  return result.data;
}
