> **30 Eylül 2026 notu:** Bu belgede tarihsel/eski durumlar bulunuyor. Güncel kod denetimi ve yeniden çalıştırılan testler için [hazırlık denetimini](READINESS-2026-09-30.md) esas alın.

# Bilinen sorunlar ve sınırlar

Son güncelleme: 2026-10-07 (stabilization sprint). Bu liste bilinçli olarak eksiksiz tutulur; buradaki bir madde kapanmadan ilgili alan "tamamlandı" sayılmaz.

## Doğrulanmamış olanlar

| # | Konu | Durum |
|---|---|---|
| 1 | iOS / Android development build | **Hiç derlenmedi.** Makinede ~4 GB boş alan vardı. `expo-doctor` 21/21 ve web önizleme çalışıyor; bu native doğrulama yerine geçmez. |
| 2 | Gerçek Supabase projesi | ✅ 7 Ekim (akşam): staging `pacvhcnawtnkauvguoaw` erişilebilir, 14/14 migration, remote regresyon 28/28, minor/veli E2E PASS. Yepyeni adult hesap E2E'si de PASS (onaylanan tek kullanımlık test hesabı, sonra silindi). |
| 3 | Edge Functions (`guardian-dispatch`, `delete-account`) | Deploy edildi ve gerçek JWT ile çağrıldı (veli e-postası; test hesabı silme). Personel/moderatör silme yolu yalnız yerel testte. Function logları CLI'dan okunamıyor (Dashboard). |
| 4 | `…000500_storage.sql` | Testlerde no-op. `storage.buckets` sütunları ve `storage.foldername()` canlı projeye karşı denenmedi. |
| 5 | Gerçek e-posta teslimi (OTP, veli) | ✅ OTP kodu ve veli e-postası gerçek gelen kutusuna ulaştı (7 Ekim). OTP süre dolumu / hız limiti denenmedi. |
| 6 | Huawei / HMS | Cihaz testi yok. `expo-camera` QR taramasının GMS'siz davranışı bilinmiyor (`docs/HUAWEI.md`). |
| 7 | Erişilebilirlik | Roller, etiketler, 44 pt hedefler, reduced motion kodda var. VoiceOver/TalkBack, en büyük yazı ölçeği ve 320 pt genişlik **denetlenmedi**. |
| 8 | PostgREST'in `experiences_with_status` görünümünü embed edebilmesi | Denenmedi. |

## Remote Supabase ile ilgili açıklar

- **7 Ekim 2026: giriş yalnız OTP kodu.** Magic link yolu (deep link token işleme, web `/auth-callback`) kaldırıldı. Supabase'in varsayılan e-postası yalnız link içerdiği için **her uzak projede kodlu şablon (`supabase/templates/otp.html`) `supabase config push` ile yüklenmeli**; aksi halde kullanıcı giriş yapamaz.
- OTP e-postası: özel SMTP (Resend, `no-reply@auth.intechne.com.tr`) kuruldu ve 6 haneli kodlu Türkçe şablon yüklendi (2026-09-19). Kutuya düşen e-postanın kodu içerdiği kullanıcı tarafından doğrulanmalı; süre dolumu ve hız limiti denenmedi.
- Veli e-postası çalışıyor (7 Ekim): Resend secret'ları staging'de, sayfa `techapp.intechne.com.tr/veli`. Gönderim limitleri sunucuda.
- Tek Supabase projesi var (staging, örnek veri). Production için **ayrı proje** açılmalı, seed uygulanmamalı. EAS `production` ortamı hâlâ staging URL'ini taşıyor; `envValidation.js` bunu reddettiği için production build/update bilerek başarısız olur.
- `supabase config push` onay sorusunu stdin'den almaz: `echo n |` ile bile uygular. Önizleme için `supabase config diff` kullanın.
- Remote güvenlik regresyonu: `npx supabase db query --linked -f supabase/tests/remote/security-regression.sql | python3 supabase/tests/remote/report.py` (yalnız staging; her koşu rollback).
- Remote e2e betiği secret key ister; yalnız geliştirme/staging projesinde çalıştırılmalı.

## Teknik borç

- `database.generated.ts` artık staging'den (`supabase gen types --linked`) üretiliyor; kanonik kaynak budur. `db:types:local` (yerel üretici) kozmetik olarak farklı çıktı verir (`isOneToOne`, `__InternalSupabase` yok) — `db:types:check` remote'a karşı çalıştırılmalı.
- Web önizleme: `RegistrationStatus` / `EventDetail` derin bağlantısı (URL ile doğrudan açma) Keşfet'e düşüyor; kenar çubuğu "Etkinlikler" sekmesi tıklamada gezinmiyor. Native'de ayrıca bakılacak.
- Web: OTP ekranı e-postayı URL'ye yazıyor (`AuthOtp?email=…`) — kural 9 (PII URL'e yazılmaz) ile çelişiyor; route param yerine bellekte taşınmalı.
- Profil özetindeki "Katılım" sayacı onaylı kayıtta 0 kalıyor (muhtemelen yalnız check-in sayıyor) — ürün kararı teyit edilmeli.
- Admin paneli bir SPA'dır: oturum 7 Ekim'den beri `sessionStorage`'da (sekme kapanınca biter; httpOnly cookie değil). Build-time CSP + `public/_headers`. Yetki tamamen RLS/RPC'de olduğu için veri sızıntısı yaratmaz; XSS yüzeyini küçük tutmak için panelde üçüncü taraf script yok. Disk kısıtı nedeniyle Next.js yerine Vite seçildi; SSR gerekirse taşınabilir.
- Admin panelinde eksikler: kapak görseli yükleme, oturum (session) programı düzenleme, kurum/üye yönetimi, audit log ekranı, etiketler. Rol kapısı ekranı (rolsüz kullanıcı) görsel olarak denenmedi; veri tarafı DB testleriyle kanıtlı.
- Yerel auth gateway gerçek GoTrue değildir (hız sınırı, kod süresi, e-posta şablonu farklıdır).
- **Açık (P3):** Web geliştirme hedefi rota parametrelerini URL'ye koyar (ör. `AuthOtp?email=…`). Native uygulamada URL yoktur, etkilenmez. Web bir yayın hedefi değildir; olacaksa e-posta parametreden çıkarılmalı.
- Veli isteklerinin süre dolumu tembel çalışır; `pg_cron` zamanlaması dağıtımda eklenmeli.
- `app.current_policy_version()` sabit bir taslak sürüm döner; gerçek sürümleme tablosu yok.
- Uygulama ikonu / adaptive icon / splash **Expo şablon yer tutucusu**.
- Crash raporlama ve gerçek analytics sink'i yok (`expo-updates` var).
- Yerel yığın 7 Ekim'den beri yeni migration'ları mevcut veritabanına uygular (`supabase_migrations.schema_migrations`).

## Eksik ürün kapsamı

- **Fırsatlar ve Topluluk sekmeleri salt okunur.** Backend (başvuru, snapshot, katılma isteği, görevler) hazır ve testli; mobil ekranlar Phase 6–7.
- **Yer imi (kaydet) arayüzü bağlı değil.** `bookmarks` tablosu ve `EventCard` üzerindeki düğme desteği var; ekranlar `onToggleSave` vermiyor, Kaydedilenler ekranı yok.
- **Arama yalnız etkinlikleri kapsar** (başlık + özet, `ilike`). Fırsat / takım araması ve tam metin arama yok.
- **Başlamamış:** bildirimler (push + uygulama içi), yönetim paneli (`apps/admin` boş), takım etkinlik kaydı (`registration_mode = 'team'` etkinlikler "yalnız takım" uyarısı verir), deneyim/doğrulama ekranları, öğrenme ekranları, profil düzenleme, görünürlük ayarları, rıza merkezi, içerik bildirme arayüzü, veri dışa aktarma talebi.
- Organizatör tarafında mobilde yalnız check-in var; etkinlik oluşturma/yayınlama ve kayıt değerlendirme için arayüz yok (RPC ve RLS hazır).
- Fırsat başvurularında veli akışı yok; yaşı tutmayan başvuran reddedilir.
- Fonla, Cüzdan, ücretli eğitim, TechRank, AI Koç, ARENO: feature flag arkasında kapalı, kodu taşınmadı.

## Hukuki / politika kararı bekleyenler

- En küçük hesap yaşı (şu an 13) ve veli onayı eşiği (etkinlik başına, varsayılan 18).
- Onay metinleri, e-posta bağlantısının doğrulama gücü, saklama süreleri.
- Reşit olmayanların takım üyeliği için veli onayı gerekip gerekmediği.
- Uygulamada hukuki metin **yoktur**; uydurulmadı.

## Bu oturumda bulunup düzeltilenler

- **`event_eligibility` dizi birleştirme hatası.** `v_reasons || 'kod'` ifadesinde PostgreSQL sabiti `text[]` olarak yorumlayıp "malformed array literal" veriyordu; bir engel nedeni olan her durumda RPC 400 dönüyordu. Birim testleri yalnız mutlu yolu kapsadığı için canlı testte ortaya çıktı. `array_append` ile düzeltildi, regresyon testi eklendi.
- **`makeError('unknown')`** kendi kopya tablosunda bulunduğu için "bilinen kod" sayılıyor, 5xx hatalar `server_error` yerine `unknown` oluyordu (jest testi yakaladı).
- **Yeniden deneme kuralı:** durum kodu olmayan her hata `retryable` sayılıyordu; artık yalnız ağ hatası, 429 ve 5xx.
- `HeroCard` içinde iç içe başlık rolü (web'de `<h1>` içinde `<h1>`), `TechIcon`'un web'de geçersiz DOM özniteliği, `useRef(...).current`'ın render sırasında okunması.
