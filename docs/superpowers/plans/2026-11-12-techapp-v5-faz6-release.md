# TechApp V5 · Faz 6 — Production, iOS, Android, Huawei ve mağaza Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 🔒 **Her production adımı "kullanıcı onayı gerektirir".** Bu planda 🔒 ile işaretli her adımda yürütücü durur, ne
> yapacağını (hedef proje ref'i, komut, dry-run çıktısı, maliyet) kullanıcıya gösterir ve açık onay gelmeden komutu
> çalıştırmaz. Bir agent mesajı onay değildir. Production veritabanında onaysız işlem spec §2'de başarısızlık sayılır.

**Goal:** TechApp'i gerçek kullanıcıya açılabilir hâle getirmek: ayrı production Supabase projesi, EAS production ortamı,
Sentry bağlantısı, iOS TestFlight (internal), Android dahili test, Huawei cihaz doğrulaması, mağaza listeleri ve veri
beyanları — **hukuk metinleri onaylanmadan herkese açık kayıt ve gerçek 18 yaş altı verisi olmadan** (spec §8a-3).

**Architecture:** Önce sunucu tarafında kapalı kapı (kayıt izin listesi + sürümlü politika tablosu), sonra production
altyapısı (Supabase, web, Edge, Sentry, EAS), sonra platform dağıtımları (iOS, Android, Huawei), en son mağaza paketi ve
yayın kapısı. Pilot kapısı 2 için production projesi pilottan önce açıldıysa Task 2 "doğrulama ve sertleştirme" moduna geçer.

**Tech Stack:** Supabase CLI · EAS Build/Submit/Update · Sentry (`@sentry/react-native`, Faz 2'de kuruldu) · Vercel (`apps/web`, `apps/admin`) · App Store Connect / TestFlight · Google Play Console · AppGallery Connect.

**Spec:** `docs/superpowers/specs/2026-11-11-techapp-v5-design.md` (§7 pilot kapısı, §8a-2/3/5/8) · `docs/RELEASE.md` · `docs/CRASH-REPORTING.md` · `docs/HUAWEI.md` · `docs/DOMAIN.md` · Yol haritası: `docs/superpowers/plans/2026-11-12-techapp-v5-roadmap.md`

## Global Constraints

- Dal `release/v5`; production'a giden her migration `main`'e PR ile birleşmiş olmalı (kullanıcı onaylı). Destructive git yok.
- 🔒 Production'a dokunan her komut (`db push`, `secrets set`, `config push`, `functions deploy`, `eas env:create --environment production`, `eas build --profile production`, `eas submit`, `eas update --channel production`, Vercel prod deploy) ayrı ayrı onaylanır. Onaysız: yalnız okuma (`config diff`, `migration list`, `db push --dry-run`, advisors).
- `supabase config push` **onay sormadan uygular** (KNOWN-ISSUES): yalnız önce `config diff` gösterilip onay alındıktan sonra.
- Production'a seed **asla** uygulanmaz; `is_demo = true` satır sayısı 0 olmalı (doğrulama sorgusu).
- Secret değerleri hiçbir dosyaya, sohbete, log'a yazılmaz; yalnız `supabase secrets set` / EAS `--visibility secret` / platform panelleri. Service role key mobil/repoda yok.
- Hukuki metin uydurulmaz. Gizlilik, KVKK aydınlatma, koşullar, saklama, veli onay metni hukuktan gelir; gelene kadar herkese açık kayıt kapalıdır (Task 1).
- Mağaza beyanları koddan türetilir; olmayan özellik iddia edilmez; "cihazda doğrulandı" yalnız cihazda koşulmuş kontrol listesiyle.

## Review Focus

1. **Yanlış proje hedefi:** CLI staging'e bağlıyken production sanılarak (veya tersi) `db push` — her komut öncesi hedef ref doğrulaması zorunlu, uyuşmazlıkta komut koşmaz (Task 2 `assert-target` testi).
2. **Kapı kapalıyken kayıt:** izin listesinde olmayan biri OTP ile giriş yapıp profil oluşturmaya çalışır → profil oluşmaz, dürüst "Kayıtlar henüz açık değil" ekranı; izin listesindeki görevli sorunsuz (Task 1 testi).
3. **Yeni politika sürümü:** yayın sonrası yeni gizlilik sürümü yayınlanır → eski rızalar eski sürümle kalır, yeni kayıtlar yeni sürümü yazar, kimse sessizce "yeni sürüme onay vermiş" sayılmaz (Task 1 testi).
4. **Production build'e staging/dev değer sızması:** production profili staging URL'i veya dev Sentry DSN'iyle derlenmeye çalışılır → `app.config.ts`/`envValidation` reddeder (Task 3 testi).
5. **İnceleme ekibi giriş yapamaz:** OTP-only girişte App Review/Play inceleme hesabı kod alamaz → inceleme notlarında çalışan, kurum kontrolündeki bir yol var ve denendi (Task 8 adımı).

---

### Task 1: Hukuk kapısı — sürümlü politika ve kapalı kayıt (sunucu)

**Files:** Create `supabase/migrations/YYYYMMDDHHMMSS_policy_versions_signup_gate.sql`, `supabase/tests/legal-gate.test.ts`, `docs/legal/LEGAL-GATE.md`; Modify `apps/mobile/src/features/auth/ProfileBootstrapScreen.tsx`, `apps/mobile/src/lib/errors.ts`, `apps/web/app/{gizlilik,kosullar}/page.tsx` (yalnız sürüm numarasını sunucudan gösterme altyapısı; metin yer tutucusu "hazırlanıyor" olarak kalır)

**Interfaces:**
- Produces: `public.policy_versions(purpose text, version text, is_draft boolean, published_at timestamptz, url text check '^https://', primary key (purpose, version))` (okuma herkese; yazma yalnız platform admini RPC'si `publish_policy_version(p_purpose, p_version, p_url)`); migration bugünkü `…@2026-09-draft` sürümlerini `is_draft = true` satırları olarak ekler. `app.settings(key text pk, value jsonb)`: `signup_open` (varsayılan **false**), `allow_draft_policies` (varsayılan **false**). `app.current_policy_version(p_purpose)` en son yayımlanmış taslak olmayan sürümü döner; yoksa yalnız `allow_draft_policies = true` iken taslağı, aksi halde 409 `policy_not_published`. `public.signup_allowlist(email_hash bytea pk, note text, added_at)` (yalnız platform admini; e-posta düz metin saklanmaz, `app.sha256(lower(email))`); `complete_profile_bootstrap` başına kapı: `signup_open=false` ve e-posta hash'i listede değilse 403 `signup_closed`.
- Ortamlar: ayar DB'dedir, ortam değişkeni değil. `supabase/seed.sql` (yalnız local) ve test `global-setup.ts` iki bayrağı `true` yapar; staging'de 🔒 tek seferlik `update app.settings` (staging için de onay); production'da ikisi de `false` kalır — hukuk metni yayımlanana kadar production'da kayıt **teknik olarak** yapılamaz.

- [ ] **Step 1: Failing testler:** kapı kapalı + listede değil → `signup_closed` ve profil satırı yok; listede → başarı; kapı açık → herkes; politika yayımlanmamış amaç için kayıt → 409 `policy_not_published` (sessiz taslak sürüm yok); yeni sürüm yayımlanınca eski `consents.policy_version` değişmez, yeni kayıt yeni sürümü yazar; anon/authenticated `signup_allowlist`'i okuyamaz.
- [ ] **Step 2:** FAIL → **Step 3:** uygula; mobilde `signup_closed` → "Kayıtlar henüz açık değil. Pilot ekibindeysen bize yaz: <destek bağlantısı>" (COPY) → **Step 4:** `db:test` + `verify` yeşil.
- [ ] **Step 5:** `LEGAL-GATE.md`: bugün kodda sürüm isteyen amaçlar `event_participation`, `guardian_event_participation`, `application_data_sharing`; gereken metinler (gizlilik politikası, KVKK aydınlatma, kullanım koşulları, saklama politikası, veli onay metni + veli e-posta şablonu metni), her birinin uygulamadaki/web'deki yeri, `policy_versions` amaç adları, onay kaydı tablosu (metin · sürüm · onaylayan · tarih — boş), kapı açma prosedürü (🔒 `signup_open=true` yalnız tüm satırlar dolunca).
- [ ] **Step 6: Commit** `feat(db): hukuk kapısı — sürümlü politika tablosu, kapalı kayıt ve izin listesi`

### Task 2: Production Supabase projesi 🔒

**Files:** Create `scripts/assert-supabase-target.mjs`, `scripts/__tests__/assert-supabase-target.test.mjs` (root vitest), `supabase/tests/remote/prod-static-checks.sql` (salt okunur), `docs/PRODUCTION.md`; Modify `package.json` (`db:push` script'i önce `assert-supabase-target` çağırır), `docs/RELEASE.md`

**Interfaces:** Produces `assertTarget(expected: 'staging'|'production', linkedRef: string, knownRefs: { staging: string; production: string }): void` (uyuşmazlıkta hata, production'da ayrıca etkileşimli "production yazıp onayla" sorusu; CI'da production için her zaman hata).

- [ ] **Step 1: Failing test:** staging ref'i bağlıyken `expected='production'` → hata; bilinmeyen ref → hata; production + etkileşimsiz → hata.
- [ ] **Step 2–3:** FAIL → uygula → PASS.
- [ ] **Step 4 🔒:** Proje oluşturma (Intechne kuruluşu, bölge **kullanıcı kararı** — öneri AB/Frankfurt, KVKK; plan/PITR/yedekleme seçimi kullanıcı kararı). Ref `docs/PRODUCTION.md`'ye (anahtar değil).
- [ ] **Step 5 🔒:** `supabase link --project-ref <prod>` → `npm run db:push` (dry-run çıktısı kullanıcıya; yalnız `main`'deki migration'lar) → onay → push → `migration list` senkron. **Seed yok.**
- [ ] **Step 6 🔒:** Auth: `config diff` → onay → `config push` (OTP şablonu `templates/otp.html`, `otp_length 6`, `otp_expiry 600`, `site_url`); özel SMTP (Resend, `no-reply@auth.intechne.com.tr`) Dashboard'da; OTP hız limitleri Dashboard'da gözden geçirilir.
- [ ] **Step 7 🔒:** Edge: `supabase secrets set RESEND_API_KEY MAIL_FROM GUARDIAN_PAGE_URL` (değerler kullanıcı/terminalde) → `npm run functions:deploy` → kimliksiz çağrı 401, GET 405 (salt okunur kontrol).
- [ ] **Step 8:** `prod-static-checks.sql` (yazmasız): tüm `public` tablolarda RLS açık; `SECURITY DEFINER` fonksiyonlarda `search_path` boş; anon'a açık fonksiyon listesi staging ile aynı; `is_demo` satır sayısı 0; `app.settings.signup_open = false`; pg_cron işleri kayıtlı (`techapp-expire-guardian-requests`, varsa `techapp-event-reminders`, `techapp-expire-team-registrations`); `covers` public, `evidence`/`avatars` private; `ticket_hmac_v1` var (değeri okunmaz, yalnız `count`). Advisors çıktısı kaydedilir. **Tam remote regresyon production'da koşmaz** (yazma içerir; yalnız staging).
- [ ] **Step 9 🔒:** Gerçek e-posta duman testi, yalnız izin listesine eklenmiş tek Intechne test hesabıyla: OTP kodu gelir → giriş → profil (profil oluşturma politika sürümü yazmaz; kayıt/başvuru denenmez — onlar `policy_not_published` döner, bu beklenen kapıdır) → uygulama içi hesap silme → kullanıcı/profil satırı yok (sayımla). Production'da test etkinliği açılmaz. Sonuç `docs/PRODUCTION.md`'ye.
- [ ] **Step 10: Commit** `chore(release): production hedef koruması, salt okunur production denetimi ve kurulum kaydı`

### Task 3: Web, admin ve alan adı 🔒

**Files:** Modify `docs/DOMAIN.md`, `apps/web/README.md`; Create `apps/web/public/.well-known/{apple-app-site-association,assetlinks.json}` (yalnız Team ID ve imza parmak izleri geldikten sonra), `apps/mobile/app.json` (`associatedDomains`, `intentFilters` — `.well-known` yayınlandıktan **sonra**)

- [ ] **Step 1 🔒:** `apps/web` Vercel production (`/veli`, `/cv/[token]`, `/events/[id]`, `/destek`, `/gizlilik`, `/kosullar`, `/hesap-silme`) production Supabase değerleriyle; `apps/admin` `panel.techapp.intechne.com.tr`.
- [ ] **Step 2:** Doğrulama: `/veli#<geçersiz>` dürüst hata; `/gizlilik` "hazırlanıyor" (Task 1 kapısı açılana kadar); başlıklar (`noindex` CV, CSP admin) `curl -I` ile.
- [ ] **Step 3:** Universal/App Links: dosyalar → yayın → doğrulama (`curl` içerik türü, yönlendirmesiz) → `app.json` güncellemesi → sonraki build'de cihazda `techapp.intechne.com.tr/events/<id>` uygulamada açılır.
- [ ] **Step 4: Commit** `chore(release): web ve panel production dağıtımı, uygulama bağlantıları`

### Task 4: EAS production ortamı ve Sentry bağlantısı 🔒

**Files:** Modify `docs/CRASH-REPORTING.md` (açık madde 1–2 kapanır), `apps/mobile/src/lib/envValidation.js` (`NON_PRODUCTION_SENTRY_PROJECT_IDS`), `apps/mobile/src/lib/__tests__/envValidation.test.ts`, `docs/RELEASE.md`

- [ ] **Step 1 (karar):** Sentry saklama süresi (öneri 30 gün) ve veri bölgesi (öneri AB/de) kullanıcı onayıyla `CRASH-REPORTING.md` karar tablosuna.
- [ ] **Step 2 🔒:** `CRASH-REPORTING.md` "AÇIK MADDE 2" adımları 1–6 (kuruluş, `techapp-mobile` + `techapp-mobile-dev`, Data Scrubber + IP saklama kapalı, DSN'ler EAS env'e, `SENTRY_AUTH_TOKEN` yalnız secret).
- [ ] **Step 3: Failing test** `envValidation.test.ts`: dev projesinin kimliği listedeyken production profili o DSN ile reddedilir → uygula → PASS.
- [ ] **Step 4 🔒:** EAS `production` ortamı: `EXPO_PUBLIC_APP_ENV=production`, production Supabase URL + publishable key, production DSN; `npx expo config --type public` (EAS env ile) env guard'dan geçer; staging URL'iyle bilerek deneme → reddedilir.
- [ ] **Step 5:** "Bağladıktan sonra doğrulama" 1–7 (dev/preview build ile; production build Task 5–6'da). Sonuç tarihle belgeye.
- [ ] **Step 6: Commit** `chore(release): Sentry bağlandı (saklama ve bölge kararıyla), EAS production ortamı`

### Task 5: iOS — build ve TestFlight internal 🔒

**Files:** Create `docs/qa/<tarih>-ios-journey.md`; Modify `docs/RELEASE.md`, `apps/mobile/eas.json` (`submit.production.ios` — yalnız ASC App ID gibi gizli olmayan kimlikler; anahtar yok)

- [ ] **Step 1 (ön koşul, kullanıcı):** Apple Developer Program (kurumsal), Team ID, App Store Connect kaydı, bundle `com.intechne.techapp`. Yoksa task ⛔ ve raporlanır.
- [ ] **Step 2 🔒:** `eas build --profile production --platform ios` (maliyet/kota onayı) → `eas submit --platform ios` → TestFlight **internal** test grubu (yalnız Intechne ekibi; dış test beta incelemesi ve hukuk kapısı ister).
- [ ] **Step 3:** Gerçek iPhone'da 8 adımlık yolculuk (spec §3) kontrol listesiyle; production'da kapı kapalı olduğundan izin listesindeki yetişkin hesapla; minor/veli yolu **staging preview build** ile (gerçek 18 yaş altı verisi yok). Her adım ekran görüntüsü; VoiceOver betiği (Faz 5 Task 4).
- [ ] **Step 4: Commit** `docs(qa): iOS TestFlight internal ve gerçek cihaz yolculuğu`

### Task 6: Android — Play dahili test 🔒

**Files:** Create `docs/qa/<tarih>-android-journey.md`; Modify `docs/RELEASE.md`, `apps/mobile/eas.json` (`submit.production.android.track = "internal"`)

- [ ] **Step 1 (ön koşul, kullanıcı):** Play Console hesabı, uygulama kaydı, servis hesabı anahtarı yalnız EAS'te (`eas credentials`), repoda yok.
- [ ] **Step 2 🔒:** `eas build --profile production --platform android` (AAB) → `eas submit` internal track.
- [ ] **Step 3:** Gerçek Android cihazda 8 adımlık yolculuk + TalkBack betiği + %200 yazı; Play pre-launch report çıktısı okunur.
- [ ] **Step 4: Commit** `docs(qa): Android dahili test ve gerçek cihaz yolculuğu`

### Task 7: Huawei / HMS

**Files:** Modify `docs/HUAWEI.md` (cihaz test listesi sonuçları), `docs/qa/<tarih>-huawei.md`

- [ ] **Step 1 (ön koşul):** GMS'siz Huawei cihaz + AppGallery Connect kaydı (kullanıcı).
- [ ] **Step 2:** Preview APK (staging) ile `HUAWEI.md` test listesi; özellikle `expo-camera` QR taraması. Çalışmazsa: kısa kod yolu görünür ve çalışır (zorunlu); HMS Scan Kit / ML Kit paketli model kararı **kullanıcıya** sunulur (ayrı task, bu planda uygulanmaz).
- [ ] **Step 3:** Push sağlayıcısı: push bu ürün sürümünde yok (3b yalnız uygulama içi); HMS Push Kit planı `HUAWEI.md`'de "push fazına ertelendi" olarak kalır. AppGallery'ye gönderim 🔒 ayrı onay.
- [ ] **Step 4: Commit** `docs(qa): Huawei/HMS cihaz sonuçları ve QR geri dönüş doğrulaması`

### Task 8: Mağaza listeleri, gizlilik etiketleri, veri güvenliği

**Files:** Modify `docs/store/app-store-tr.md`; Create `docs/store/{google-play-tr.md,data-inventory.md,review-notes.md}`

**Interfaces:** `data-inventory.md` = tek kaynak tablo: veri · kaynak (tablo/kolon veya SDK) · amaç · kullanıcıya bağlı mı · izleme (hayır) · isteğe bağlı mı · saklama (Task 1 hukuk metnine bağlı, boşsa "hukuk bekleniyor") · App Store kategorisi · Play veri türü.

- [ ] **Step 1:** Envanter koddan çıkarılır: e-posta (Auth), ad (`profiles.display_name`), doğum tarihi (`profile_private.birth_date`), eğitim aşaması, ilgi alanları, deneyimler/kanıt dosyaları, CV paylaşım bağlantısı, başvuru paylaşım verisi, takım/proje içerikleri, veli e-postası/adı (`guardian_requests`), check-in kayıtları, rastgele kurulum kimliği + çökme verisi (Sentry, Task 4), kamera (yalnız görevli, saklanmaz). İzinler: `CAMERA`, `ACCESS_NETWORK_STATE` (+`INTERNET`, Sentry manifest birleşmesi — kişisel veri değil, `CRASH-REPORTING.md`). Push token yok.
- [ ] **Step 2:** App Store privacy label ve Play Data safety formu taslakları bu tablodan; yaş derecelendirmesi anketi yanıtları (kullanıcı içeriği var → içerik bildirme: 3b Task 14 ön koşul; serbest mesajlaşma yok); hedef kitle 13+ (Play "Hedef kitle ve içerik": 13–15, 16–17, 18+; 13 altı yok → Families programı dışı — **kullanıcı/hukuk teyidi**).
- [ ] **Step 3:** Hesap silme: uygulama içi akış + web `/hesap-silme` URL'si (Play zorunlu). Gizlilik URL'si `/gizlilik` — **hukuk metni yayımlanmadan mağaza gönderimi yapılmaz**.
- [ ] **Step 4:** `review-notes.md`: OTP-only girişte inceleme hesabı yolu — seçenekler kullanıcıya: (a) Intechne kontrolünde, inceleme süresince açık paylaşılan bir posta kutusu + izin listesi; (b) yalnız inceleme hesabı için sabit kod (**önerilmez**, demo bypass yasağına yakın; seçilirse sunucu tarafında tek hesapla sınırlı ve süreli). Karar gelmeden gönderim yok.
- [ ] **Step 5:** Mağaza görselleri: gerçek ekran görüntüleri (Faz 4 sonrası, production olmayan ama `is_demo` içerik görünmeyen staging hesabından; "ÖRNEK" etiketli içerik görüntüye girmez).
- [ ] **Step 6: Commit** `docs(store): veri envanteri, gizlilik etiketleri, veri güvenliği, inceleme notları`

### Task 9: Yayın kapısı ve geri dönüş

**Files:** Create `docs/release/<tarih>-go-no-go.md`; Modify `docs/RELEASE.md` ("Yayın öncesi asgari kontrol listesi" kanıt bağlantılarıyla), `IMPLEMENTATION-STATUS.md`

- [ ] **Step 1:** Kontrol listesi, her madde kanıtla (test çıktısı, build ID, ekran görüntüsü) veya ⛔ + sahip: hukuk kapısı (Task 1 tablosu dolu mu), production denetimi (Task 2 Step 8), Sentry doğrulaması, iOS/Android/Huawei cihaz yolculukları, erişilebilirlik turu, HIG Doctor 0 serious, mağaza beyanları, inceleme hesabı.
- [ ] **Step 2:** Geri dönüş planı: OTA (`eas update --channel production` önceki güncellemeye `eas update:republish`) 🔒; native sürüm geri çekme mağaza tarafında; DB geri dönüşü yalnız ileri migration ile (down migration yok), yedekten geri yükleme yalnız kullanıcı kararıyla.
- [ ] **Step 3:** Kademeli yayın önerisi (Play staged rollout %, iOS phased release) — kararı kullanıcı verir.
- [ ] **Step 4 🔒:** `signup_open = true` yalnız Task 1 kayıt tablosu tamamen doluysa ve kullanıcı yazılı onay verdiyse; tek SQL, öncesi/sonrası `app.settings` çıktısı kaydedilir.
- [ ] **Step 5: Commit** `docs(release): yayın kapısı paketi ve geri dönüş planı`

---

## Self-review (yazar notu)

- **Kapsam:** ayrı production projesi, seed yok, OTP şablonu, SMTP, Edge secret'ları, her adım 🔒 (T2); EAS production env (T4); iOS build + TestFlight internal (T5); Android internal (T6); Huawei QR geri dönüşü + push sağlayıcı kararı (T7); Sentry açık maddeleri (T4); mağaza listeleri, privacy label, data safety, `ACCESS_NETWORK_STATE` (T8); hukuk sert kapı + gerçek 18 yaş altı verisi yok + herkese açık kayıt yok (T1, T9). Web/veli sayfası production'da olmadan 18 yaş altı akış çalışmaz → T3.
- **Kullanıcı kararları (rapor):** bölge, plan/PITR, saklama, inceleme hesabı yolu, hedef kitle beyanı, kademeli yayın oranı, kapı açma.
- **Orantı:** komutlar yalnız onay noktalarını belirlemek için; kod gövdesi yok.
