> **30 Eylül 2026 notu:** Bu belgede tarihsel/eski durumlar bulunuyor. Güncel kod denetimi ve yeniden çalıştırılan testler için [hazırlık denetimini](READINESS-2026-09-30.md) esas alın.

# Bilinen sorunlar ve sınırlar

Son güncelleme: 2026-11-11 (V5). Güncel durumun tek kaynağı `IMPLEMENTATION-STATUS.md` başındaki V5 bölümüdür; bu liste onunla çelişmez. Bu liste bilinçli olarak eksiksiz tutulur; buradaki bir madde kapanmadan ilgili alan "tamamlandı" sayılmaz.

## Doğrulanmamış olanlar

| # | Konu | Durum |
|---|---|---|
| 1 | iOS / Android build | 🟡 Android development build `3e02e2cf` (commit `b28ea0a`) derlendi ve **Android 16 emülatöründe** çalıştırıldı: 8 adımlık yolculuk 7/8, bulunan D1–D10 kodda düzeltildi, emülatörde yeniden doğrulama bekliyor (`docs/qa/2026-11-pilot-journey-android.md`). Preview/release build yok; **gerçek Android cihaz, iOS cihaz/simülatör ve Huawei denenmedi**. iOS production `8af1d94c` / development `cb297b76` (2026-09-19) hiç çalıştırılmadı. Kamera ile QR okutma ve haptic emülatörde doğrulanmadı. `expo-doctor` 21/21 (11 Kasım). |
| 2 | Gerçek Supabase projesi (staging) | 🟡 11 Kasım: staging `pacvhcnawtnkauvguoaw` **17/17** migration (`20261111000100`, `20261112000100`, `20261112000200` dahil), remote regresyon **38/38** (rollback, kalıntı 0). Uygulama üzerinden gerçek e-postalı E2E 7 Ekim'de PASS, 11 Kasım'da henüz koşulmadı. Yepyeni adult hesap E2E'si de PASS (onaylanan tek kullanımlık test hesabı, sonra silindi). |
| 3 | Edge Functions (`guardian-dispatch`, `delete-account`) | Deploy edildi ve gerçek JWT ile çağrıldı (veli e-postası; test hesabı silme). Personel/moderatör silme yolu yalnız yerel testte. Function logları CLI'dan okunamıyor (Dashboard). |
| 4 | `…000500_storage.sql` | Testlerde no-op. `storage.buckets` sütunları ve `storage.foldername()` canlı projeye karşı denenmedi. |
| 5 | Gerçek e-posta teslimi (OTP, veli) | 🟡 7 Ekim'de doğrulandı (OTP kodu ve veli e-postası gerçek gelen kutusuna ulaştı), bugün yeniden çalıştırılmadı. OTP süre dolumu / hız limiti denenmedi. |
| 6 | Huawei / HMS | Cihaz testi yok. `expo-camera` QR taramasının GMS'siz davranışı bilinmiyor (`docs/HUAWEI.md`). |
| 7 | Erişilebilirlik | 🟡 Roller, etiketler, 44 pt hedefler, reduced motion kodda var. Emülatörde yazı ölçeği 2.0 PASS ve 320 dp turu yapıldı (D6/D8 bulundu, kodda düzeltildi, yeniden bakılacak). **TalkBack/VoiceOver sesli turu yapılmadı** (emülatörde adb dokunuşu TouchExplorer'dan geçmiyor). |
| 8 | PostgREST'in `experiences_with_status` görünümünü embed edebilmesi | Denenmedi. |

## Remote Supabase ile ilgili açıklar

- **7 Ekim 2026: giriş yalnız OTP kodu.** Magic link yolu (deep link token işleme, web `/auth-callback`) kaldırıldı. Supabase'in varsayılan e-postası yalnız link içerdiği için **her uzak projede kodlu şablon (`supabase/templates/otp.html`) `supabase config push` ile yüklenmeli**; aksi halde kullanıcı giriş yapamaz.
- OTP e-postası: özel SMTP (Resend, `no-reply@auth.intechne.com.tr`) kuruldu ve 6 haneli kodlu Türkçe şablon yüklendi (2026-09-19). Kutuya düşen e-postanın kodu içerdiği kullanıcı tarafından doğrulanmalı; süre dolumu ve hız limiti denenmedi.
- Veli e-postası çalışıyor (7 Ekim): Resend secret'ları staging'de, sayfa `techapp.intechne.com.tr/veli`. Gönderim limitleri sunucuda.
- **Production projesi yok** (pilot kapısı 2, ⛔). Tek Supabase projesi staging'dir (örnek veri). Production için **ayrı proje** açılmalı, seed uygulanmamalı. EAS `production` ortamı hâlâ staging URL'ini taşıyor; `envValidation.js` bunu reddettiği için production build/update bilerek başarısız olur.
- `supabase config push` onay sorusunu stdin'den almaz: `echo n |` ile bile uygular. Önizleme için `supabase config diff` kullanın.
- Remote güvenlik regresyonu: `npx supabase db query --linked -f supabase/tests/remote/security-regression.sql | python3 supabase/tests/remote/report.py` (yalnız staging; her koşu rollback).
- Remote e2e betiği secret key ister; yalnız geliştirme/staging projesinde çalıştırılmalı.

## Teknik borç

- `database.generated.ts` artık staging'den (`supabase gen types --linked`) üretiliyor; kanonik kaynak budur. `db:types:local` (yerel üretici) kozmetik olarak farklı çıktı verir (`isOneToOne`, `__InternalSupabase` yok) — `db:types:check` remote'a karşı çalıştırılmalı.
- Web önizleme: `RegistrationStatus` / `EventDetail` derin bağlantısı (URL ile doğrudan açma) Keşfet'e düşüyor; kenar çubuğu "Etkinlikler" sekmesi tıklamada gezinmiyor. Native'de ayrıca bakılacak.
- ~~Web: OTP ekranı e-postayı URL'ye yazıyor (`AuthOtp?email=…`)~~ — **Çözüldü** (a8d9c5a + düzeltme turu): e-posta route param yerine yalnız modül belleğinde (`otpFlow`) tutuluyor.
- ~~Profil özetindeki "Katılım" sayacı onaylı kayıtta 0 kalıyor~~ — **Çözüldü** (6fb7d52): sayaç check-in'e dayanır (katıldığı etkinlik), yaklaşan kayıtlar ayrı listelenir; etiket "Katılım".
- Admin paneli bir SPA'dır: oturum 7 Ekim'den beri `sessionStorage`'da (sekme kapanınca biter; httpOnly cookie değil). Build-time CSP + `public/_headers`. Yetki tamamen RLS/RPC'de olduğu için veri sızıntısı yaratmaz; XSS yüzeyini küçük tutmak için panelde üçüncü taraf script yok. Disk kısıtı nedeniyle Next.js yerine Vite seçildi; SSR gerekirse taşınabilir.
- Admin panelinde eksikler: kapak görseli yükleme, oturum (session) programı düzenleme, kurum/üye yönetimi, audit log ekranı, etiketler. Rol kapısı ekranı (rolsüz kullanıcı) görsel olarak denenmedi; veri tarafı DB testleriyle kanıtlı.
- Yerel auth gateway gerçek GoTrue değildir (hız sınırı, kod süresi, e-posta şablonu farklıdır).
- **Çözüldü:** `AuthOtp` artık parametre taşımaz; web URL'sinde e-posta görünmez (`/AuthOtp`). Diğer rotalarda PII param yok.
- Veli isteklerinin süre dolumu tembel çalışır; `pg_cron` zamanlaması dağıtımda eklenmeli.
- `app.current_policy_version()` sabit bir taslak sürüm döner; gerçek sürümleme tablosu yok.
- Uygulama ikonu / splash artık yer tutucu değil ("Açık devre T" amblemi, `design-source/brand`); cihazda bakılmadı.
- **Crash raporlama kapalı:** Sentry kodu kurulu (PII temizleme, ortam ayrımı) ama DSN olmadığı için `Sentry.init` hiç çağrılmaz. Açık: DSN bağlantısı, saklama süresi kararı ve pilot kapısı 7 için "kapalı"nın yazılı kabulü (`docs/CRASH-REPORTING.md`). Gerçek analytics sink'i yok (`expo-updates` var). **Push bildirimi yok.**
- HIG Doctor (11 Kasım, final review düzeltmeleri sonrası): `--fail-on serious` kapısı geçer, **0 critical**, 1 moderate (OTP alanı `autoFocus`, bilinçli). İlk rapor `docs/audits/2026-11-11-hig-doctor.md`. Otomatik denetim HIG uyumunu kanıtlamaz.
- Reanimated + worklets + `expo-haptics` kurulu (PressableScale, check-in geri bildirimi; dev build'de derlendi). Gesture Handler yok.
- **Dal `feat/v5-pilot-platform`:** fe5a478'e kadar GitHub'a itildi (yedek push, kullanıcı izniyle, Intechne hesabı üzerinden); sonraki commit'ler her görev incelemesinden sonra itilir.
- **Düzeltildi (yerelde), staging'e uygulanmadı** (12 Kasım, Faz 3b Task 2): `teams.created_by` ve `recruitment_posts.created_by` artık API rollerine (anon + authenticated) okunmuyor — migration `20261112000300_hide_creator_columns.sql` tablo düzeyi SELECT'i kaldırıp `created_by` dışındaki sütunlara verir. Önceden reşit olmayan bir takım kurucusunun kullanıcı UUID'si herkese açıktı (18 yaşını doldurup `discoverable` olduğunda profiline bağlanabilirdi). Mobil sorgular sabit sütun listesine geçti (`TEAM_PUBLIC_COLUMNS`, `RECRUITMENT_POST_COLUMNS`); bu iki tabloda `select('*')` / `teams(*)` / `returning *` artık "permission denied" verir. Bu tablolara yeni sütun eklenirse yeni migration'da grant'e ve istemci sabitine eklenmeli; `pilot-privacy.test.ts` ve `columnGrants.test.ts` unutulursa kırılır. Staging'e push + uzak regresyon 21–21d kullanıcı onayı bekliyor; o zamana kadar staging'de açık sürüyor.
- Yerel yığın 7 Ekim'den beri yeni migration'ları mevcut veritabanına uygular (`supabase_migrations.schema_migrations`).

## Eksik ürün kapsamı

- **Fırsatlar ve Topluluk salt okunur değildir** (11 Kasım, kodda kontrol edildi): fırsat detayı, başvuru, başvurularım, son tarihler; takım detayı + katılma isteği, takım oluşturma, takım çalışma alanı (kanban), görev düzenleyici mobilde var. Profilde deneyim düzenleyici/detay, doğrulama talebi, CV paylaşımı ve gönüllü alanı var. Bunlar yalnız yerel/Expo web ortamında denendi; cihazda değil.
- **Takım etkinlik kaydı yok.** DB `registration_mode = 'team'` kaydını reddeder; arayüz "yalnız takım" uyarısı verir. Cezeri'de resmî takım kaydı TechApp dışında kalır (kullanıcı kararı); ürün kapsamında Faz 3a.
- **Yer imi arayüzü yalnız fırsatlarda bağlı**; etkinliklerde `onToggleSave` verilmiyor, **Kaydedilenler ekranı yok.**
- **Arama yalnız etkinlikleri kapsar** (başlık + özet, `ilike`). Fırsat / takım araması ve tam metin arama yok.
- **Etkinlik / fırsat / takım kapak görselleri yok** (kolon yok); pilot için tek etkinlik, poster tonuyla.
- **Başlamamış:** bildirimler (push + uygulama içi), öğrenme ekranları (tablolar ve seed hazır), uygulama içi ayarlar / görünürlük / rıza merkezi / yardım / yasal ekranlar, içerik bildirme arayüzü, veri dışa aktarma talebi.
- **Yönetim paneli (`apps/admin`) boş değildir:** etkinlik, fırsat, doğrulama talepleri, Intechne onay kuyruğu, kayıt listesi ve web check-in var. Eksik: kapak yükleme, oturum programı düzenleyici, kurum/üye yönetimi, audit ekranı.
- Organizatör tarafında mobilde yalnız check-in var; etkinlik oluşturma/yayınlama ve kayıt değerlendirme admin web'de.
- Fırsat başvurularında veli akışı yok; yaşı tutmayan başvuran reddedilir.
- Fonla, Cüzdan, ücretli eğitim, TechRank, AI Koç, ARENO: **kodu taşınmadı**; uygulamada bu modüller yok. Feature flag de yok (`src/lib/env.ts`'te `features` nesnesi bulunmuyor); gelecekte eklenirse flag + sunucu doğrulamasıyla gelir.

## Hukuki / politika kararı bekleyenler

- En küçük hesap yaşı (şu an 13) ve veli onayı eşiği (etkinlik başına, varsayılan 18).
- Onay metinleri, e-posta bağlantısının doğrulama gücü, saklama süreleri.
- Reşit olmayanların takım üyeliği için veli onayı gerekip gerekmediği.
- Uygulamada hukuki metin **yoktur**; uydurulmadı. **Gizlilik politikası, KVKK aydınlatma metni, kullanım koşulları, saklama politikası ve veli onay metni eksiktir** (web `/gizlilik` ve `/kosullar` "hazırlanıyor" der).
- **Gerçek kullanıcıya açılma blokeri:** hukuki onay olmadan gerçek 18 yaş altı kullanıcının kişisel verisini toplayan akış ve herkese açık kayıt açılmaz (kullanıcı kararı, 2026-11-11). Yerel ve staging testleri devam eder. Pilot kapısı 3 ⛔.

## Bu oturumda bulunup düzeltilenler

- **`event_eligibility` dizi birleştirme hatası.** `v_reasons || 'kod'` ifadesinde PostgreSQL sabiti `text[]` olarak yorumlayıp "malformed array literal" veriyordu; bir engel nedeni olan her durumda RPC 400 dönüyordu. Birim testleri yalnız mutlu yolu kapsadığı için canlı testte ortaya çıktı. `array_append` ile düzeltildi, regresyon testi eklendi.
- **`makeError('unknown')`** kendi kopya tablosunda bulunduğu için "bilinen kod" sayılıyor, 5xx hatalar `server_error` yerine `unknown` oluyordu (jest testi yakaladı).
- **Yeniden deneme kuralı:** durum kodu olmayan her hata `retryable` sayılıyordu; artık yalnız ağ hatası, 429 ve 5xx.
- `HeroCard` içinde iç içe başlık rolü (web'de `<h1>` içinde `<h1>`), `TechIcon`'un web'de geçersiz DOM özniteliği, `useRef(...).current`'ın render sırasında okunması.
