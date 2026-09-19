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
  guardian_send_limit: 'Bu istek için gönderim sınırına ulaştın. Destek ekibine yazabilirsin.',
  guardian_send_too_soon: 'Az önce bir bağlantı gönderdik. Bir dakika sonra tekrar deneyebilirsin.',
  birth_date_invalid: 'Doğum tarihini kontrol eder misin?',
  birth_date_locked: 'Doğum tarihi sonradan değiştirilemiyor. Bir hata varsa destek ekibine yaz.',
  below_min_account_age: 'TechApp hesabı açmak için en az 13 yaşında olmalısın.',
  display_name_invalid: 'Adın en az 2 karakter olmalı.',
  checkin_forbidden: 'Bu etkinlikte giriş kontrolü yapma yetkin yok.',
  ticket_invalid: 'Bu kod geçerli değil.',
  ticket_malformed: 'Bu bir TechApp katılım kodu değil.',
  ticket_unknown: 'Bu kodla eşleşen bir kayıt yok.',
  outside_checkin_window: 'Giriş kontrolü etkinlikten 3 saat önce açılır.',
  server_error: 'Bizim tarafta bir sorun oluştu. Birazdan tekrar dener misin?',
  unknown: 'Beklenmedik bir sorun oluştu. Tekrar dener misin?',
};

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
  if (code === 'otp_expired' || /token has expired or is invalid/i.test(message)) return makeError('otp_invalid', 422);
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return makeError('rate_limited', 429);
  if (code === 'validation_failed' || code === 'email_address_invalid') return makeError('email_invalid', 422);

  const status = typeof e.status === 'number' ? e.status : 0;
  return makeError(code || 'unknown', status);
}

export function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'retryable' in value && 'code' in value && 'status' in value;
}
