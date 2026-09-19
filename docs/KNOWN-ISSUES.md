# Bilinen sorunlar ve sınırlar

Son güncelleme: 2026-09-19. Bu liste bilinçli olarak eksiksiz tutulur; buradaki bir madde kapanmadan ilgili alan "tamamlandı" sayılmaz.

## Doğrulanmamış olanlar

| # | Konu | Durum |
|---|---|---|
| 1 | iOS / Android development build | **Hiç derlenmedi.** Makinede ~4 GB boş alan vardı. `expo-doctor` 21/21 ve web önizleme çalışıyor; bu native doğrulama yerine geçmez. |
| 2 | Gerçek Supabase projesi | **Bağlandı ve doğrulandı** (development; 26/26 remote e2e). Aşağıdaki eski not tarihsel: Tüm backend doğrulaması gömülü Postgres + PostgREST + shim üzerinde. Gerçek Supabase Auth ile hiç konuşulmadı. |
| 3 | Edge Functions (`guardian-dispatch`, `delete-account`) | Statik olarak hazırlandı, **hiç çalıştırılmadı** (Deno yok). Yerel yığındaki eşdeğerleri aynı sözleşmeyi uygular ama aynı kod değildir. |
| 4 | `…000500_storage.sql` | Testlerde no-op. `storage.buckets` sütunları ve `storage.foldername()` canlı projeye karşı denenmedi. |
| 5 | Gerçek e-posta teslimi (OTP, veli) | Denenmedi; SMTP / Resend kimlik bilgisi gerekli. |
| 6 | Huawei / HMS | Cihaz testi yok. `expo-camera` QR taramasının GMS'siz davranışı bilinmiyor (`docs/HUAWEI.md`). |
| 7 | Erişilebilirlik | Roller, etiketler, 44 pt hedefler, reduced motion kodda var. VoiceOver/TalkBack, en büyük yazı ölçeği ve 320 pt genişlik **denetlenmedi**. |
| 8 | PostgREST'in `experiences_with_status` görünümünü embed edebilmesi | Denenmedi. |

## Remote Supabase ile ilgili açıklar

- **Doğrulandı (2026-09-19):** Supabase'in varsayılan e-postası yalnız giriş bağlantısı içeriyor, 6 haneli kod içermiyor. Uygulama artık ikisini de kabul ediyor (web: URL'den oturum, cihaz: `techapp://auth-callback` deep link). Bağlantı, e-postanın açıldığı cihazda uygulama kurulu değilse çalışmaz; bu yüzden kodlu şablon yine de hedef.
- OTP e-postası: özel SMTP (Resend, `no-reply@auth.intechne.com.tr`) kuruldu ve 6 haneli kodlu Türkçe şablon yüklendi (2026-09-19). Kutuya düşen e-postanın kodu içerdiği kullanıcı tarafından doğrulanmalı; süre dolumu ve hız limiti denenmedi.
- Veli e-postası gönderilemiyor (Resend/SMTP anahtarı ve yayınlanmış veli sayfası adresi yok).
- Tek Supabase projesi var ve örnek veri içeriyor; production için **ayrı proje** açılmalı, seed uygulanmamalı.
- Remote e2e betiği secret key ister; yalnız geliştirme/staging projesinde çalıştırılmalı.

## Teknik borç

- `database.generated.ts` şu an **yerel** veritabanından üretildi (Supabase'in kullandığı aynı üreteç). Remote proje bağlanınca `npm run db:types` ile yeniden üretilip fark kontrol edilmeli; şema değişen her PR'da `db:types:check` çalışmalı.
- Admin paneli bir SPA'dır: oturum tarayıcı `localStorage`'ında durur (httpOnly cookie değil). Yetki tamamen RLS/RPC'de olduğu için veri sızıntısı yaratmaz; XSS yüzeyini küçük tutmak için panelde üçüncü taraf script yok. Disk kısıtı nedeniyle Next.js yerine Vite seçildi; SSR gerekirse taşınabilir.
- Admin panelinde eksikler: kapak görseli yükleme, oturum (session) programı düzenleme, kurum/üye yönetimi, audit log ekranı, etiketler. Rol kapısı ekranı (rolsüz kullanıcı) görsel olarak denenmedi; veri tarafı DB testleriyle kanıtlı.
- Yerel auth gateway gerçek GoTrue değildir (hız sınırı, kod süresi, e-posta şablonu farklıdır).
- **Web geliştirme hedefi rota parametrelerini URL'ye koyar** (ör. `AuthOtp?email=…`). Native uygulamada URL yoktur, etkilenmez. Web bir yayın hedefi değildir; olacaksa e-posta parametreden çıkarılmalı.
- Veli isteklerinin süre dolumu tembel çalışır; `pg_cron` zamanlaması dağıtımda eklenmeli.
- `app.current_policy_version()` sabit bir taslak sürüm döner; gerçek sürümleme tablosu yok.
- Uygulama ikonu / adaptive icon / splash **Expo şablon yer tutucusu**.
- Crash raporlama, gerçek analytics sink'i, `expo-updates` yok.
- Yerel yığın yeni migration'ları mevcut veritabanına uygulamaz; `npm run db:dev -- --reset` gerekir.

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
