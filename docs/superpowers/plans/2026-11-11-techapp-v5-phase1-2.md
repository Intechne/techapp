# TechApp V5 · Faz 1–2 (koruma + pilot hattı) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut işi güvenle commit'leyip belgeleri gerçeğe eşitlemek, ardından pilot yolculuğunun (spec §3) 8 adımını
sağlamlaştırmak ve tek bir native build ile Android emülatörde uçtan uca doğrulamak.

**Architecture:** Mevcut feature-first yapı korunur. Pilot build'ine yalnız pilotta kullanılan native paketler girer (Reanimated+worklets, expo-haptics, Sentry; spec §8a-7). Sunucu tarafı
değişikliği bu planda yok (takım kaydı §8-1 cevabına göre ayrı plan).

**Tech Stack:** Expo SDK 57 · RN 0.86 · React Navigation 7 · TanStack Query · Supabase JS · Jest/RNTL · Vitest + embedded-postgres.

**Spec:** `docs/superpowers/specs/2026-11-11-techapp-v5-design.md`

## Global Constraints

- Dal: `feat/v5-pilot-platform` (taban `feat/techapp-stabilization` @ a0a97c5). `main`'e yazılmaz; push/PR kullanıcı onayıyla.
- Destructive git yok (reset --hard, force push, checkout ile dosya atma, stash drop). Kontrol noktası: `checkpoint/v5-start-2026-11-11`, `refs/checkpoints/v5-start-wip`.
- Yeni bağımlılık yalnız `npx expo install <pkg>`; sonuç expo-doctor 21/21.
- Renk/ölçü/font-size hardcode yok; token'lar `design-source/tokens.json` → `tokens.ts`.
- Durum metinleri yalnız `design-system/components/Status.tsx`; hata metinleri yalnız `lib/errors.ts` `COPY`.
- PII URL'e, log'a, analytics'e yazılmaz. 18 yaş altı verisi takım/kurum dışına çıkmaz.
- Her task: `npm --prefix apps/mobile run verify` yeşil; DB'ye dokunan task'ta `npm run db:test` yeşil; UI task'ı web önizlemede ekran görüntüsüyle görülmeden bitmiş sayılmaz.
- UI dili Türkçe, ton: "Başvurun alındı." ✔

## Review Focus

1. **Hesap değişimi:** A kullanıcısının çevrimdışı kaydedilmiş katılım kartı, çıkış sonrası B kullanıcısına asla görünmez (Task 7 testi).
2. **Saat dilimi sınırı:** kayıt kapanışı Europe/Istanbul gece yarısına yakınken vitrin seçimi doğru (Task 4 testi, sabit `now` ile).
3. **Reduced motion açık:** basma ölçeği ve skeleton nabzı devre dışı, işlev aynı (Task 10 testi).
4. **Görevli çift okutma:** aynı QR iki kez → ikinci sonuç `already_checked_in`, başarı haptic'i yalnız ilkinde (Task 12 testi).
5. **OTP ekranına derin bağlantı/yenileme:** e-posta bellekte yoksa kullanıcı e-posta ekranına döner, boş kodla gönderim yok (Task 5 testi).

---

## FAZ 1 — Koruma ve tutarlılık

### Task 1: Dal + Open Circuit v2 ikon işinin incelenerek commit'lenmesi

**Files:**
- Modify (commit only, reviewed): `design-source/icons/**`, `design-source/ICON-SYSTEM.md`, `design-source/icon-master/**`, `apps/mobile/scripts/generate-icons.mjs`, `apps/mobile/src/design-system/{TechIcon.tsx,icons.generated.ts,components/States.tsx,__tests__/components.test.tsx}`, `apps/mobile/src/features/{opportunities/labels.ts,profile/ProfileScreen.tsx}`, `apps/mobile/src/navigation/RootNavigator.tsx`, `CLAUDE.md`, `design-source/URUN-VE-UX.md`

- [ ] **Step 1:** `git switch -c feat/v5-pilot-platform` (commit'siz değişiklikler çalışma ağacında kalır; hiçbir dosya taşınmaz/silinmez). Kullanıcı worktree isterse `superpowers:using-git-worktrees` ile kurulur.
- [ ] **Step 2:** Her değiştirilmiş dosyanın `git diff`'i okunur; ikon adı değişimlerinin tüm kullanım yerlerinde karşılığı olduğu `npm --prefix apps/mobile run typecheck` ile doğrulanır. Beklenmeyen değişiklik bulunursa commit'lenmez, kullanıcıya raporlanır.
- [ ] **Step 3:** `npm --prefix apps/mobile run icons` yeniden üretir → `git diff --exit-code apps/mobile/src/design-system/icons.generated.ts` (üretim deterministik).
- [ ] **Step 4:** `npm --prefix apps/mobile run verify` → 93/93.
- [ ] **Step 5:** Üç commit: `feat(design): Open Circuit v2 ikon kaynakları ve master` (design-source) · `feat(mobile): TechIcon v2 — dolu durum, üretici, testler` · `docs: ikon sistemi v2 (CLAUDE.md, URUN-VE-UX)`. Ekran kullanım değişiklikleri ikinci commit'e girer.
- [ ] **Step 6:** `git diff refs/checkpoints/v5-start-wip HEAD --stat` → yalnız `apps/mobile/hig-audit.md` dışında fark yok (hiçbir şey kaybolmadı).

### Task 2: Test/araç hijyeni

**Files:**
- Modify: `supabase/tests/global-setup.ts`, `apps/mobile/package.json`, `apps/mobile/package-lock.json`
- Create: `docs/audits/2026-11-11-hig-doctor.md` (← `apps/mobile/hig-audit.md` taşınır)

**Interfaces:** Produces `freePort(preferred: number): Promise<number>` (global-setup içinde).

- [ ] **Step 1:** `global-setup.ts`: `TECHAPP_TEST_PG_PORT` verilmemişse 54329 doluysa `net.createServer().listen(0)` ile boş port seçer. Başka projenin Postgres'ine (Keşif, :54329) asla bağlanmaz.
- [ ] **Step 2:** :54329 doluyken `npm run db:test` → 95/95 (env değişkeni olmadan).
- [ ] **Step 3:** `npx expo install expo-doctor -- --save-dev` yoksa `npm i -D expo-doctor@sdk-57`; `npm --prefix apps/mobile run doctor` çalışır.
- [ ] **Step 4:** `npx expo install --check` ile 11 yama güncellemesi; `doctor` → 21/21; `verify` yeşil.
- [ ] **Step 5:** Commit: `chore: test portu çakışması, expo-doctor script'i, SDK 57 yama güncellemeleri`.

### Task 3: Belge tutarlılığı + spec/plan commit'i

**Files:**
- Modify: `IMPLEMENTATION-STATUS.md`, `docs/KNOWN-ISSUES.md`, `docs/TESTING.md`, `docs/PRODUCT-SCOPE.md` (durum sütunu), `README.md` (ikon sayısı)
- Add: `docs/superpowers/specs/2026-11-11-techapp-v5-design.md`, bu plan

- [ ] **Step 1:** `IMPLEMENTATION-STATUS.md` en üstüne "V5 — 11 Kasım 2026" tablosu: bugünkü ölçümler (DB 95, mobil 93, doctor, HIG Doctor 2 bulgu), EAS `cbdda535` = a0a97c5'ten Android derlendi (artefakt süresi doldu, cihazda denenmedi), pilot kapısı (spec §7) 8 satır ⛔/🟡.
- [ ] **Step 2:** `KNOWN-ISSUES.md`: "hiç derlenmedi", "Fırsatlar/Topluluk salt okunur", "ikon Expo yer tutucusu", "apps/admin boş" maddeleri düzeltilir; yeni maddeler: yasal metinler hazırlanıyor (pilot blokeri), takım kaydı yok, push/crash yok, production projesi yok. İki belgede aynı konu farklı durum göstermez (elle çapraz kontrol).
- [ ] **Step 3:** `TESTING.md` sayıları ve port notu güncellenir.
- [ ] **Step 4:** Commit: `docs: V5 tasarım + plan; durum ve bilinen sorunlar tek gerçeğe eşitlendi`.

---

## FAZ 2 — Pilot hattı

Sıra kullanıcı kararına göre: akışlar → güvenlik/hata → native altyapı + Sentry → build/emülatör → kabul → sonraki fazların planı.

### Task 4: Keşfet vitrini yalnız kaydı açık etkinliği öne çıkarır

**Files:** Create `apps/mobile/src/features/discovery/featured.ts` + `apps/mobile/src/features/discovery/__tests__/featured.test.ts`; Modify `apps/mobile/src/features/discovery/DiscoverScreen.tsx:52-96`

**Interfaces:** Produces `pickFeatured<T extends FeaturedCandidate>(events: T[], now: Date): T | null`, `FeaturedCandidate = { registration_opens_at: string | null; registration_closes_at: string; capacity: number | null; seats_taken: number; waitlist_enabled: boolean }` — ilk uygun: `(opens null veya opens <= now) && now < closes` **ve** (`capacity` null **veya** `seats_taken < capacity` **veya** `waitlist_enabled`).

- [ ] **Step 1:** Test: kaydı kapalı ilk etkinlik atlanır, sıradaki açık olan seçilir; hiçbiri uygun değilse `null`; `registration_opens_at` null = açık; kapanış `2026-11-24T20:59:59Z`, `now = 2026-11-24T21:00:00Z` → uygun değil; dolu + bekleme listesi kapalı → uygun değil; dolu + bekleme listesi açık → uygun.
- [ ] **Step 2:** Test FAIL.
- [ ] **Step 3:** Uygula; vitrin `null` ise HeroCard render edilmez, "Yaklaşan etkinlikler" ilk 4 etkinliği gösterir (vitrindeki etkinlik listede tekrarlanmaz). Etkinlik sorgusu (`EVENT_SELECT`) gereken alanları içermiyorsa eklenir.
- [ ] **Step 4:** `npm --prefix apps/mobile run verify` yeşil; web önizlemede (yerel yığın) Keşfet ekran görüntüsü: vitrinde kaydı açık etkinlik.
- [ ] **Step 5:** Commit: `fix(mobile): Keşfet vitrini kaydı kapalı etkinliği öne çıkarmaz`.

### Task 5: OTP akışı — e-posta URL'de değil, yapıştırma ve süre dolumu

**Files:** Modify `apps/mobile/src/navigation/types.ts:50`, `apps/mobile/src/features/auth/{AuthEmailScreen,AuthOtpScreen}.tsx`, `apps/mobile/src/lib/errors.ts` (gerekirse); Create `apps/mobile/src/features/auth/otpFlow.ts` + `apps/mobile/src/features/auth/__tests__/otpFlow.test.tsx`

**Interfaces:** Produces `otpFlow.begin(email: string): void`, `otpFlow.email(): string | null`, `otpFlow.clear(): void` — yalnız modül belleği, kalıcı değil; çıkışta ve doğrulama başarısında temizlenir. `RootStackParamList['AuthOtp']` = `undefined`.

- [ ] **Step 1:** Testler: `AuthEmail` gönderimi `navigate('AuthOtp')` param'sız çağırır; `otpFlow.email()` null iken OTP ekranı `navigation.replace('AuthEmail')` yapar ve doğrulama isteği atılmaz; alana 6 haneli değer yapıştırılınca (`onChangeText('123456')`) doğrulama bir kez tetiklenir; sunucu süre dolumu hatası (`otp_expired` / Supabase `otp_expired` kodu) → "Kodun süresi doldu. Yeni kod iste." metni ve yeni kod düğmesi etkin.
- [ ] **Step 2:** Testler FAIL.
- [ ] **Step 3:** Uygula. `PendingIntent` akışı (giriş sonrası kaldığı yere dönüş) bozulmaz.
- [ ] **Step 4:** `verify` yeşil; web'de OTP ekranındayken adres çubuğunda e-posta olmadığının ekran görüntüsü + giriş baştan sona yerel yığında çalışır.
- [ ] **Step 5:** Commit: `fix(mobile): OTP e-postası URL'den çıktı; yapıştırma ve süre dolumu durumu`.

### Task 6: Kayıt durumu çizgisi ve veli bekleme açıklığı

**Files:** Create `apps/mobile/src/design-system/components/StatusTimeline.tsx` (+ `index.ts` export), `apps/mobile/src/design-system/__tests__/statusTimeline.test.tsx`; Modify `apps/mobile/src/design-system/components/Status.tsx`, `apps/mobile/src/features/events/RegistrationStatusScreen.tsx`, `apps/mobile/src/features/guardian/GuardianRequestScreen.tsx`

**Interfaces:** Produces in `Status.tsx`: `registrationSteps(status: RegistrationStatus, needsGuardian: boolean): RegistrationStep[]`, `RegistrationStep = { key: 'registered' | 'guardian' | 'confirmed' | 'card'; label: string; state: 'done' | 'current' | 'todo' | 'blocked' }`; `<StatusTimeline steps={RegistrationStep[]} />`.

- [ ] **Step 1:** Testler: `pending_guardian` → registered done, guardian current, confirmed todo, card todo; `confirmed` + `needsGuardian=false` → guardian adımı yok, card current; `waitlisted` → confirmed `blocked`; `cancelled` → boş dizi (çizgi gösterilmez); bileşen her adım için `accessibilityLabel` = "<etiket>, <durum metni>".
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Uygula. Veli ekranı: e-postanın gittiği, geçerlilik süresi sunucudan gelen `expires_at` ile ("… tarihine kadar geçerli"), yeniden gönderme sunucu limitine bağlı; sabit "72 saat" metni yazılmaz.
- [ ] **Step 4:** `verify`; web'de `pending_guardian` (16 yaş test hesabı) ve `confirmed` ekran görüntüleri.
- [ ] **Step 5:** Commit: `feat(mobile): kayıt durumu çizgisi ve veli bekleme ekranı`.

### Task 7: Katılım kartı çevrimdışı görüntüleme

**Files:** Create `apps/mobile/src/features/events/offlineCard.ts` + `apps/mobile/src/features/events/__tests__/offlineCard.test.ts`; Modify `apps/mobile/src/features/events/ParticipationCardScreen.tsx`, `apps/mobile/src/features/auth/SessionProvider.tsx`

**Interfaces:** Produces `saveCard(userId: string, card: ParticipationCard): Promise<void>`, `loadCard(userId: string, registrationId: string): Promise<{ card: ParticipationCard; savedAt: string } | null>`, `dropCard(userId: string, registrationId: string): Promise<void>`, `clearCards(): Promise<void>` — `expo-secure-store` (anahtar `card.<userId>.<registrationId>`, `card.index` ile listelenir; web'de no-op/null).

- [ ] **Step 1:** Testler: kaydedilen kart aynı kullanıcıyla geri gelir; farklı `userId` → null; `clearCards` sonrası null; ekran: ağ hatasında son kart "Son güncelleme: HH:MM · çevrimdışı" etiketiyle; sunucu 404/410 (iptal/geçersiz) → `dropCard` çağrılır, kart gösterilmez; SessionProvider kimlik bitince (`identityEpoch` değişimi) `clearCards` çağrılır.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Uygula. Ekrana "Ekran parlaklığını artırırsan kod daha hızlı okunur." ipucu.
- [ ] **Step 4:** `verify`; web'de normal kart ekran görüntüsü.
- [ ] **Step 5:** Commit: `feat(mobile): katılım kartı çevrimdışı gösterilir, hesap değişiminde silinir`.

### Task 8: Profil sayaçları ve "Yaklaşan"

**Files:** Create `apps/mobile/src/features/profile/profileStats.ts` + `apps/mobile/src/features/profile/__tests__/profileStats.test.ts`; Modify `apps/mobile/src/features/profile/ProfileScreen.tsx:96-125`

**Interfaces:** Produces `profileStats(cv: Cv, registrations: MyRegistrationLike[], now: Date): { experiences: number; verified: number; attended: number; upcoming: MyRegistrationLike[] }`, `MyRegistrationLike = { id: string; status: RegistrationStatus; event: { starts_at: string } }`.

- [ ] **Step 1:** Testler: `attended` = CV'deki check-in'li katılım sayısı; `confirmed`/`pending_guardian`/`waitlisted` + gelecekte başlayan → `upcoming` (başlangıca göre artan); geçmiş tarihli onaylı ama check-in'siz kayıt hiçbir yerde sayılmaz; `cancelled` hiçbir yerde sayılmaz.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Uygula: sayaç etiketi "Katıldığı"; "Yaklaşan" satırı (durum etiketi `Status.tsx`'ten) Katılımlarım'a gider. Kullanıcının kayıtlarını getiren mevcut sorgu yeniden kullanılır.
- [ ] **Step 4:** `verify`; giriş yapmış profil ekran görüntüsü.
- [ ] **Step 5:** Commit: `fix(mobile): profil katılım sayacı check-in'e dayanır; yaklaşan kayıtlar ayrı`.

### Task 9: Güvenlik ve hata yönetimi denetimi (pilot yolculuğu)

**Files:** Create `apps/mobile/src/lib/__tests__/errorCopyCoverage.test.ts`, `supabase/tests/pilot-privacy.test.ts`; Modify (bulgulara göre) `apps/mobile/src/lib/errors.ts`, ilgili migration (yalnız **yeni** dosya)

- [ ] **Step 1:** `errorCopyCoverage.test.ts`: `supabase/migrations/*.sql` içindeki her `app.fail(<status>, '<code>')` kodunun `errors.ts` `COPY` tablosunda Türkçe karşılığı var (eksikler listelenerek FAIL).
- [ ] **Step 2:** `pilot-privacy.test.ts` (gömülü Postgres, `asUser`/`asAnon`): 16 yaşındaki üye için — anon ve takım dışı kullanıcı `profiles`/`team_memberships`/`team_roster` üzerinden adını göremez; başka kullanıcı katılım kartını (`get_participation_card`) alamaz; görevli olmayan check-in yapamaz; `public_cv` 18 yaş altında null; `discoverable=true` 18 yaş altında reddedilir.
- [ ] **Step 3:** Testleri çalıştır; FAIL eden her madde `superpowers:systematic-debugging` ile kök neden → yeni migration + test ile düzeltilir. Geçen maddeler mevcut korumanın regresyon testi olarak kalır.
- [ ] **Step 4:** `npm run db:test` + `verify` yeşil.
- [ ] **Step 5:** Commit: `test: pilot gizlilik regresyonları ve hata metni kapsamı` (+ varsa `fix(db): …`).

### Task 10: Native altyapı — Reanimated, Haptics, `PressableScale`

**Files:** Modify `apps/mobile/package.json`, `apps/mobile/babel.config.js` (gerekiyorsa), `apps/mobile/jest.config.*`/setup, `design-source/tokens.json`, `apps/mobile/src/design-system/tokens.ts`, `apps/mobile/src/design-system/components/Button.tsx`, `apps/mobile/src/design-system/index.ts`; Create `apps/mobile/src/design-system/components/PressableScale.tsx`, `apps/mobile/src/lib/haptics.ts`, `apps/mobile/src/lib/__tests__/haptics.test.ts`, `apps/mobile/src/design-system/__tests__/pressableScale.test.tsx`

**Interfaces:**
- Produces `motion` token: `{ fast: 160, standard: 220, exit: 140, pressScale: 0.97, spring: { snappy: { damping: 22, stiffness: 320 }, gentle: { damping: 26, stiffness: 180 } } }`.
- Produces `PressableScale(props: PressableProps & { scaleTo?: number })`.
- Produces `haptics: { selection(): void; success(): void; warning(): void; error(): void }`, `setHapticsEnabled(on: boolean): Promise<void>`, tercih `localPrefs`'te (varsayılan açık).

- [ ] **Step 1:** SDK 57 uyumluluğu: `npx expo install --check` temiz iken `npx expo install react-native-reanimated react-native-worklets expo-haptics --dry-run` benzeri çözüm (veya `npm view expo@57 bundledNativeModules` / `node_modules/expo/bundledNativeModules.json`) ile sürümler belgelenir; uyumsuzsa task durur ve raporlanır.
- [ ] **Step 2:** Testler: reduced motion açıkken `PressableScale` ölçek animasyonu başlatmaz, `onPress` yine çağrılır; `accessibilityRole` iletilir; haptics devre dışıyken `expo-haptics` çağrılmaz; web'de no-op.
- [ ] **Step 3:** FAIL.
- [ ] **Step 4:** `npx expo install react-native-reanimated react-native-worklets expo-haptics`; jest mock'ları; uygulama. `Button` `PressableScale` kullanır (görünüm değişmez, yalnız basma geri bildirimi).
- [ ] **Step 5:** `verify` yeşil; `doctor` 21/21; `npx expo export --platform android` başarılı (bundle derleniyor); web önizlemede düğmeler çalışıyor.
- [ ] **Step 6:** Commit: `feat(mobile): Reanimated + Haptics temeli, PressableScale`.

### Task 11: Sentry (gizlilik şartlı, DSN yoksa kapalı)

**Files:** Modify `apps/mobile/package.json`, `apps/mobile/app.json` (plugin), `apps/mobile/src/lib/env.ts`, `apps/mobile/src/lib/envValidation.js`, `apps/mobile/src/app/AppErrorBoundary.tsx`, `apps/mobile/.env.example`, `docs/RELEASE.md`; Create `apps/mobile/src/lib/crash.ts`, `apps/mobile/src/lib/__tests__/crash.test.ts`, `docs/CRASH-REPORTING.md`

**Interfaces:** Produces `initCrashReporting(): void` (DSN yoksa no-op), `captureError(e: unknown, context?: { screen?: string; code?: string }): void`, `scrubEvent(event: SentryEvent): SentryEvent | null` (saf, test edilir).

- [ ] **Step 1:** Testler (`scrubEvent`): `user` alanı silinir (id/email/ip yok); breadcrumb ve mesajlardaki e-posta, 6 haneli kod, JWT (`eyJ…`), `sb_…` anahtarları, `Bearer …`, QR payload (`TA1.…`) `[filtered]` olur; request body/headers/cookies silinir; URL query string silinir; `environment` = `EXPO_PUBLIC_APP_ENV`; `sendDefaultPii` false; DSN yoksa `Sentry.init` çağrılmaz.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `npx expo install @sentry/react-native` (Expo 57 uyumlu sürüm doğrulanır); `EXPO_PUBLIC_SENTRY_DSN` opsiyonel; `release`/`dist` uygulama sürümünden; performans izleme ve session replay **kapalı**; source map yükleme adımı `docs/RELEASE.md`'de (SENTRY_AUTH_TOKEN yalnız EAS secret). `envValidation`: production'da DSN development DSN'iyle aynı olamaz.
- [ ] **Step 4:** `verify` + `doctor` + `npx expo export --platform android`. `docs/CRASH-REPORTING.md`: gönderilen/gönderilmeyen veri listesi, ortam ayrımı, saklama süresi kararı (açık madde), DSN bağlantı adımı (açık madde).
- [ ] **Step 5:** Commit: `feat(mobile): Sentry crash reporting — PII scrub, ortam ayrımı, DSN yoksa kapalı`.

### Task 12: Görevli check-in geri bildirimi

**Files:** Modify `apps/mobile/src/features/checkin/CheckInScreen.tsx:25-63`; Create `apps/mobile/src/features/checkin/__tests__/checkInFeedback.test.tsx`

**Interfaces:** Consumes `haptics` (Task 10).

- [ ] **Step 1:** Testler: `checked_in` → `haptics.success` bir kez + `AccessibilityInfo.announceForAccessibility` "Giriş onaylandı, <ad>"; aynı kod ikinci kez → `already_checked_in` → `haptics.warning`, `success` çağrılmaz; hata → `haptics.error` + duyuru; her sonuçta ikon + metin (yalnız renk değil); kamera izni yoksa kısa kod alanı görünür.
- [ ] **Step 2–4:** FAIL → uygula → PASS; `verify`; web'de üç sonuç ekran görüntüsü.
- [ ] **Step 5:** Commit: `feat(mobile): check-in sonucu haptic + sesli duyuru + net sonuç ekranı`.

### Task 13: Android development build + emülatörde 8 adımlık yolculuk

**Files:** Create `docs/qa/2026-11-pilot-journey-android.md`

- [ ] **Step 1:** `eas build --profile development --platform android` (EAS kotası; maliyet doğurmayan plan dahilinde). Build ID belgeye.
- [ ] **Step 2:** AVD `Medium_Phone_API_36.1`; APK `adb install`; `.env.local` yedekleri alınır → `npm run db:dev` + `npm run env:local` → `expo start --dev-client`; emülatör yerel yığına bağlanır; iş bitince `.env.local` geri yüklenir.
- [ ] **Step 3:** 8 adım (spec §3), bireysel test kaydıyla: misafir keşif → detay → OTP (kod terminalden) → 16 yaş profil → `pending_guardian` → veli linki (terminalden) `/veli` onayı → kart + QR → görevli (`organizator@techapp.test`) check-in → profilde "Katıldığı 1". Ayrıca 26 yaş adult yolu. Her adım `adb exec-out screencap -p`.
- [ ] **Step 4:** TalkBack turu (adım 1–3, 6, 7), font ölçeği 2.0, 320 dp genişlik (`adb shell wm size`), Perf Monitor gözlemi (ölçülmediyse "ölçülmedi").
- [ ] **Step 5:** `npx hig-doctor apps/mobile --fail-on serious` → 0.
- [ ] **Step 6:** Bulunan hatalar ayrı fix task'ı (systematic-debugging + TDD). Commit: `docs(qa): Android emülatör pilot yolculuğu`.

### Task 14: Staging doğrulaması

- [ ] **Step 1:** Remote güvenlik regresyonu (staging, rollback'li) → 28/28 + Task 9'da eklenen yeni migration varsa önce staging'e `db push` (dry-run planı okunarak).
- [ ] **Step 2:** `eas build --profile preview --platform android` (staging); adult + 16 yaş/veli yolu gerçek e-posta ile (OTP ve veli e-postası kullanıcı/ekip gelen kutusundan — kullanıcıyla planlanır).
- [ ] **Step 3:** Sonuçlar `IMPLEMENTATION-STATUS.md` pilot kapısı tablosuna.

### Task 15: Pilot kabul paketi (24 Kasım go/no-go)

**Files:** Create `docs/pilot/2026-11-cezeri-pilot-checklist.md`, `docs/pilot/2026-11-24-go-no-go.md`

- [ ] **Step 1:** Kontrol listesi: spec §7'nin 8 maddesi + §8a kararları; her madde kanıt bağlantısı (test çıktısı, ekran görüntüsü, build ID) veya ⛔ ve sahibi.
- [ ] **Step 2:** Etkinlik günü operasyonu: görevli hesapları, cihaz başına check-in provası, bağlantı kesilirse admin web + kısa kod yedeği, pilot kullanıcı listesi (yalnız görevli/ekip/gönüllü; 18 yaş altı gerçek veri hukuk onayı yoksa yok).
- [ ] **Step 3:** iOS: TestFlight hazırlık durumu (build, internal tester listesi, eksikler); gerçek cihaz yoksa "doğrulanmadı".
- [ ] **Step 4:** Commit: `docs(pilot): Cezeri pilot kontrol listesi ve go/no-go paketi`.

### Task 16: Sonraki fazların planları

- [ ] **Step 1:** `superpowers:writing-plans` ile ayrı belgeler: Faz 3a takım kaydı · Faz 3b modüller (kapaklar, takım profili, kaydedilenler, bildirimler, ayarlar/gizlilik, öğrenme, birleşik arama) · Faz 4 beş sekmenin tam ürün/UX planı (render edilmiş önizleme kapısıyla) · Faz 5 hareket/erişilebilirlik/performans · Faz 6 production + iOS + mağaza.
- [ ] **Step 2:** Commit: `docs: V5 Faz 3–6 planları`.
