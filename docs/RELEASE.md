> **30 Eylül 2026 notu:** Bu belgede tarihsel/eski durumlar bulunuyor. Güncel kod denetimi ve yeniden çalıştırılan testler için [hazırlık denetimini](READINESS-2026-09-30.md) esas alın.

# Yayın hazırlığı

Durum: **yayına hazır değil.** Bu belge, yayın için gerekenleri ve şu an eksik olanları listeler. Mağaza incelemesinin sonucu garanti edilemez.

## EAS profilleri (`apps/mobile/eas.json`)

| Profil | Amaç | Ortam |
|---|---|---|
| `development` | Development client, iOS simülatör | `development` |
| `development-device` | Development client, gerçek cihaz (internal) | `development` |
| `preview` | Dahili dağıtım; Android **APK** (Huawei cihaz testi için de bu) | `preview` |
| `production` | Mağaza derlemesi, `autoIncrement` | `production` |

`appVersionSource: remote`. `submit.production` bilinçli olarak boştur: v4'teki `REPLACE_*` yer tutucuları taşınmadı ve kod içine gerçek kimlik bilgisi yazılmayacak.

Her EAS ortamında tanımlanacak değişkenler: `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
İsteğe bağlı: `EXPO_PUBLIC_SENTRY_DSN` (boş = crash raporlama kapalı).

## Crash raporlama (Sentry) — 11 Kasım 2026

Kod hazır, **bağlantı açık madde**: hesap/DSN/token yok, bu yüzden kapalı. Ayrıntı, gönderilen/gönderilmeyen veri, saklama
süresi kararı ve bağlantı adımları: [`docs/CRASH-REPORTING.md`](CRASH-REPORTING.md).
- Source map / debug symbol yükleme: `SENTRY_AUTH_TOKEN` **yalnız EAS secret** (`--visibility secret`) + `SENTRY_ORG` +
  `SENTRY_PROJECT`. Üçü yoksa Sentry config plugin'i ve Metro config'i eklenmez; build yükleme adımı olmadan geçer.
- OTA (`eas update`): debug ID için token + org + project bundle'ı derleyen ortamda olmalı (EAS Workflow/CI; secret yerel
  komuta inmez), sonra `npx sentry-expo-upload-sourcemaps dist`. Yoksa güncelleme yine yayınlanır, yalnız sembolizasyon kaybolur.
- Production build preview/development DSN'iyle derlenmez (`envValidation.js` → `NON_PRODUCTION_SENTRY_PROJECT_IDS`).

## Intechne'nin sağlaması gerekenler

- **Expo/EAS:** kurum hesabı; `eas init` ile `projectId` (app.json'a o zaman yazılır).
- **Apple:** Developer Program üyeliği (kurumsal), Team ID, App Store Connect uygulama kaydı (ASC App ID), `com.intechne.techapp` bundle id sahipliği.
- **Google Play:** geliştirici hesabı, `com.intechne.techapp` paket adı, gönderim için servis hesabı anahtarı (depo dışında, `secrets/` git'e girmez).
- **Huawei:** AppGallery Connect hesabı ve uygulama kaydı; push için AGC yapılandırması (`docs/HUAWEI.md`).
- **Supabase:** development / preview / production projeleri, özel SMTP, Edge Function sırları.
- **Alan adı:** `techapp.intechne.com.tr` (ayrıntı: `docs/DOMAIN.md`). Universal link / app link için bu alan adı altında `apple-app-site-association` ve `assetlinks.json` dosyaları. Şu an yok; yalnız `techapp://` şeması çalışır.
- Destek e-postası, gizlilik ve kullanım koşulları bağlantıları, moderasyon/iletişim sorumlusu.

## Yayın kapıları

Kaynak: `design-source/TEKNIK-VE-YAYIN.md`.

1. **Hesap ve sahiplik:** yukarıdaki hesaplar, signing, EAS proje kimliği.
2. **Gerçek altyapı:** staging/production ayrımı, yedek + geri yükleme denemesi, sırların pakete girmemesi, içerik sahipleri.
3. **Ürün uygunluğu:** uygulama içinden hesap silme (akış yazıldı; gerçek projede doğrulanmadı), içerik bildirme/engelleme (tablolar var, arayüz yok), yaş/onay uygulaması, gizlilik metni ile veri beyanlarının uyumu.
4. **Mağaza paketi:** gerçek ekran görüntüleri, ikon/splash, açıklama, yaş derecesi, privacy label / veri güvenliği formu, inceleme notları ve **kullanılabilir test hesabı** (OTP tabanlı girişte inceleme ekibi için çözüm gerekir).
5. **Test dağıtımı:** TestFlight, Play dahili test, Huawei test cihazları.
6. **Dağıtım:** kademeli yayın ve geri dönüş planı.

## Bilinen eksikler

- ~~Uygulama ikonu placeholder~~ **Tamam:** "oyulmuş T." amblemi `design-source/brand/build.mjs` ile üretiliyor (iOS/Android/splash/favicon/mağaza); değişince tek komutla yeniden üret.
- ~~Yerel build alınamadı~~ **EAS bulut build kullanılıyor** (yerel disk yetmiyor). EAS projesi: `@intechne/techapp` (`da99e9ee-4f05-4283-9a75-ed71051575e1`).
- Gerçek analytics sink'i henüz yok. Crash raporlama (Sentry) kodu hazır, DSN bağlantısı açık madde (`docs/CRASH-REPORTING.md`).
- Kamera izni metni yalnız check-in içindir; mikrofon izni Android'de bilinçli olarak engellenir (`blockedPermissions`).
- Push bildirimi yok → mağaza formlarında bildirim beyanı şimdilik gerekmez.

## Yayın öncesi asgari kontrol listesi

- [ ] iOS + Android development build açılıyor, uçtan uca kayıt akışı gerçek cihazda geçiyor
- [ ] GMS'siz Huawei cihazda aynı akış
- [ ] Gerçek Supabase projesinde migrations + Edge Functions + gerçek e-posta
- [ ] RLS testleri gerçek projeye karşı da koşuldu
- [ ] VoiceOver / TalkBack, büyük yazı, 320 pt genişlik denetimi
- [ ] Hukuk: onay metni, en küçük yaş, saklama süreleri
- [ ] Sentry: DSN bağlandı, saklama süresi kararı yazıldı, bağlantı sonrası doğrulama (`docs/CRASH-REPORTING.md`) geçti
- [ ] İkon / splash / mağaza varlıkları

## Faz 3b + Faz 3a — bekletilen migration'lar: tek sıra (13 Kasım 2026)

Bu bölüm, aşağıdaki "Production'a geçiş" 1. maddesindeki dağınık notların **tek ve bağlayıcı özetidir**; çelişki halinde bu bölüm geçerlidir. Dokuz migration (`feat/v5-product`: Faz 3b'nin beşi + Faz 3a takım kaydının dördü) **staging'e uygulanmadı**; Cezeri pilotu (freeze 21 Kasım, pilot 27–29 Kasım) bitene ve kullanıcı açıkça onaylayana kadar uygulanmaz. Hiçbiri `preview` kanalına OTA ile gitmez.

**Uygulama sırası (dosya sırası, her adım bir öncekinden sonra):**
1. Önce istemci: `teams` / `recruitment_posts` için açık sütun listeli (`select('*')` yok) istemci OTA/build — pilotun `preview` kanalına **değil**, hedef sürüm kanalına. Yoksa 2. adım Topluluk, takım detayı, Takımlarım ve Keşfet'i kırar.
2. `20261112000300_hide_creator_columns` — remote regresyon **21–21d** geçmeli.
3. `20261113000100_covers` — remote regresyon **22–22k** koşulur; **22g ve 22k MUST PASS** (`set_cover` sahibinin `storage.objects` RLS'ini atladığı ve kapak bağlama akışı).
4. `20261113000200_team_profile` — **23–23i** geçmeli. (`000300`'den önce uygulanırsa toplu revoke `category_key` grant'ini düşürür; dosya sırası bunu önler.)
5. `20261113000300_recruitment_applicants` — **24–24c** geçmeli.
6. `20261113000400_notifications` — **25–25k** geçmeli; **25 ve 25j MUST PASS** (tetikleyici gerçek sahiple yazıyor; `techapp-event-reminders` ve `techapp-prune-notifications` `cron.job`'da). pg_cron yoksa migration iş kurmadan uyarı verip geçer; 25j bunu yakalar. (Bu satırdaki 25h, 9. adım uygulandıktan sonra 18 tür bekler — remote regresyon dokuz dosya birlikte uygulandıktan sonra koşulur.)
7. `20261113000500_team_registration` (Faz 3a T1) — **26–26h** geçmeli; **26 MUST PASS**.
8. `20261113000600_team_registration_rpc` (Faz 3a T2) — **27–27f** geçmeli; **27 MUST PASS**.
9. `20261113000700_team_registration_lifecycle` (Faz 3a T3) — **28–28f** geçmeli; **28 ve 28e MUST PASS** (28e: `techapp-expire-team-registrations` `cron.job`'da).
10. `20261113000800_team_registration_admin` (Faz 3a T4) — **29–29j** geçmeli; **29 ve 29i MUST PASS** (organizatör listesi; reviewer reddi → takım `rejected`, üye kaydı `rejected`, `teams_taken` 0).
11. Push sonrası: remote regresyonun tamamı (`npx supabase db query --linked -f supabase/tests/remote/security-regression.sql | python3 supabase/tests/remote/report.py`; rollback, kalıntı 0), `covers` bucket public URL'inin curl ile kontrolü, `supabase gen types --linked` ile `database.generated.ts` yeniden üretimi.
12. Sonra istemci (aşağıdaki liste).

**Push öncesi salt okunur kontroller (hepsi 0 / beklenen olmalı, değilse push yapılmaz):**
- `select count(*) from public.notifications where target_type not in ('event','event_registration','application','team')` → 0 (aksi halde `000400` `VALIDATE CONSTRAINT notifications_target_type_check` adımında durur).
- `npx supabase db push` dry-run planı yalnız bu dokuz dosyayı (ve daha önce uygulanmamış başkasını) göstermeli; hedef proje ref'i iki kez kontrol edilir.
- Hedef veritabanının `datctype`'ı not alınır (arama için; `"C"` ise istemci üçlü deseni zaten kullanır).

**Zorunlu remote kontroller özeti:** 21–21d · 22g · 22k · 23–23i · 24–24c · 25 + 25j · 26 · 27 · 28 + 28e · 29 + 29i (diğer 22/25–29 harfli maddeler de geçmeli; yalnız bunlar "MUST PASS" işaretlidir). Yerel prova (gömülü Postgres, tüm migration'lar + regresyon dosyası, rollback; 13 Kasım, `20261113000800` dahil): son koşu sonucu `IMPLEMENTATION-STATUS.md` > Faz 3a'da.

**İstemci, ilgili migration'lardan SONRA yayınlanır (T = Faz 3b görevi):** T4 (kapaklı admin/mobil — `000100`), T7 (zengin takım profili — `000200` + `000300`), T8 (Kaydedilenler — takım başlıkları `category_key` okur), T10 (Bildirimler — `000400`), T11 (Ayarlar/Gizlilik — `000400` + `000200`), T12 (Gelişim), T13 (Arama), T14 (Kurum profili + Bildir; `team_project` raporu `000200`'e bağlı, yoksa 23514). T12–T14 migration eklemez ama `TEAM_PUBLIC_COLUMNS` / `cover_*` okuduklarından T7 ile aynı sırada gider. Pratikte: yukarıdaki sıranın tüm migration'ları + zorunlu remote kontroller → tek `feat/v5-product` istemcisi.

**Kural:** `feat/v5-product` dalı pilotun `preview` kanalına **asla** OTA ile yayınlanmaz (preview build eski JS ile çalışıyor; yeni sütunları okuyan kod onu kırar, eski sorgular da `000300`'ü kırar).

**Hâlâ açık (yayın öncesi):** `/gizlilik` ve `/kosullar` hukuk metinleri, admin rapor/moderasyon konsolu, expo yama sürümleri — `docs/KNOWN-ISSUES.md` > Faz 3b kapanışı.

## Faz 3a — takım kaydı migration'ları (13 Kasım 2026, bekletiliyor)

`20261113000500_team_registration` (Task 1: şema, RLS, sayaçlar; RPC yok) **staging'e uygulanmadı**; Faz 3b'nin beş dosyasıyla aynı kural: pilot (27–29 Kasım) bitene ve kullanıcı onaylayana kadar push yok, `preview` kanalına OTA yok.
- **Sıra:** yukarıdaki Faz 3b listesinin 6. adımından (`20261113000400_notifications`) **sonra**, dosya sırasıyla. Sütun düzeyi grant vermez, `teams` / `recruitment_posts` grant'ine dokunmaz → `20261112000300`'ün toplu revoke'una bağımlı değildir; yine de dosya sırasıyla gider.
- **Ne değişir:** yeni tablolar `team_event_registrations`, `team_event_registration_members` (istemciye yalnız SELECT, yazma yok); `events`'e `team_capacity`, `teams_taken`, `team_waitlist_count`, `team_min_size` (varsayılan 1), `team_max_size`; `event_registrations.team_registration_id`. `app.recount_event`, `app.promote_waitlist`, `register_for_event` bireysel sayımı `team_registration_id is null` ile daraltır (bugün hiçbir satırda dolu değil → davranış aynı). `team_min_size` / `team_max_size` kritik alan, `team_capacity` azalması `capacity` gibi yeniden incelemeye düşürür.
- **Push sonrası:** remote regresyon **26–26h** geçmeli; **26 MUST PASS** (takım üyesi kendi takımının satırlarını, kurum sahibi kadroyu görüyor). Ek olarak `supabase gen types --linked` (yeni sütunlar/tablolar) — istemci Task 5–7'de.
- `20261113000600_team_registration_rpc` (Task 2: `submit_team_registration`, `app.promote_team_waitlist`, `event_eligibility`'ye ek alanlar) — **staging'e uygulanmadı**, aynı bekletme. **Sıra:** `20261113000500_team_registration`'ın hemen ardından (ona bağımlı: tablolar, `app.recount_team_event` tetikleyicisi). `event_eligibility` yalnız alan **ekler** (`registration_mode`, `team_seats_left`, `manageable_teams`); bugünkü mobil sürüm eski alanları okumaya devam eder. Push sonrası remote regresyon **27–27e** geçmeli; **27 MUST PASS** (etkin mentor gönderir → `pending_members`, 2 `invited`, `teams_taken` 1); 27a düz üye → 403 `not_team_manager`, 27b anon çağıramaz, 27c doğrudan insert hâlâ reddedilir, 27f takım kadrosundaki kişi bireysel kayıt olamaz (409 `already_on_team_roster`; `register_for_event` bu kontrolü `20261113000500` içinde alır).
- `20261113000700_team_registration_lifecycle` (Task 3, commit `ee55782` + düzeltme `bf15db0`: üye yanıtı, veli akışı, sürümlü kadro düzenleme, iptal, süre dolumu, kart/check-in takım kontrolü, tetikleyiciler, 5 takım kaydı bildirim türü) — **staging'e uygulanmadı**, aynı bekletme. **Sıra:** `20261113000600_team_registration_rpc`'nin hemen ardından (ona bağımlı: `app.promote_team_waitlist`'i yeniden tanımlar). Pilotun kullandığı fonksiyonları `create or replace` ile değiştirir (`get_participation_card`, `check_in_participant`, `app.next_registration_status`, `app.expire_guardian_requests`, `app.notify_registration_status`, `app.event_cancel_cascade`, `leave_team`, `remove_team_member`, `volunteer_event_brief`); her yeni dal `team_registration_id is not null` / takım satırlarıyla sınırlı, bireysel kayıt davranışı aynı — **bu yüzden pilot dalına gitmez**, pilot sonrası push edilir. `notifications.target_type` kısıtı `team_event_registration` ile genişler. Cron `techapp-expire-team-registrations` (*/10, pg_cron yoksa no-op). Push sonrası remote regresyon **28–28f** geçmeli; **28 MUST PASS** (kaptan kendi davetini kabul eder → kendi kaydı `confirmed`, takım `pending_members`) ve **28e MUST PASS** (cron işi kurulu); 28a başkası adına yanıt 403, 28b eski sürüm 409 `roster_changed`, 28c onaysız takım üyesine kart 409, 28d ayrıntıda e-posta/doğum/veli alanı yok + dışarıdan 404, 28f grant'ler. **25h** artık 18 tür bekler (bu dosya olmadan 13 → push sırası korunmalı). Düzeltme `bf15db0` aynı dosyayı yerinde değiştirdi (hiç uygulanmadı): `app.queue_event_reminders` da yeniden tanımlanır (takım onaylanmadan hatırlatma yok).
- `20261113000800_team_registration_admin` (Task 4: organizatör listesi `admin_event_team_registrations`, karar `review_team_registration`) — **staging'e uygulanmadı**, aynı bekletme. **Sıra:** `20261113000700`'ün hemen ardından (`app.expire_team_registrations`'ı yeniden tanımlar: karar bekleyen her `pending_review` takım `ends_at`'te `expired`/`review_not_decided`). Pilotun kullandığı `admin_event_registrations` ve `app.is_confirmed_participant` `create or replace` ile değişir (imza, sütunlar, roller aynı): takımı `confirmed` olmayan **takım üyesinin** kaydı organizatör listesinde ve "katılımcılara" duyurularında sayılmaz — giriş (check-in) yapmış olan hariç: katılmış kişi listeden hiç düşmez; bireysel kayıtlar aynen — **pilot dalına gitmez**. Push sonrası remote regresyon **29–29j** geçmeli; **29 MUST PASS** (kurum sahibi takımı listeler: kadro 2, hazır 1) ve **29i MUST PASS** (reviewer reddi); 29a anon çağıramaz, 29b kurum dışı/başka kurum 403, 29c `checkin_staff` listeleyemez/karar veremez, 29d listede e-posta/doğum/veli anahtarı ve `@` yok, 29e `pending_members` takıma karar 409, 29f doğrudan yazma yok, 29g sayaç koruması, 29h onaysız takım üyesi `admin_event_registrations`'ta yok, 29j grant'ler. Admin istemcisi (Task 7) bu dosyadan **sonra** yayınlanır.

- **Faz 3a T5 istemcisi (takım kaydı, kaptan/mentor):** `features.teamRegistration` bayrağı `local | development | preview` için açık, **`production` için kapalı** (açmak kullanıcı onayı + Faz 6 Task 1 hukuk kapısı ister). İstemci `events.team_min_size/team_max_size/team_capacity/teams_taken` sütunlarını her etkinlik okumasında ister: **`20261113000500..000800` staging'e basıldıktan SONRA** build/OTA edilir, önce asla. `preview` kanalına bu daldan OTA yok.

## Remote Supabase'e ilk bağlanma (sırayla)
1. `npx supabase login` (kendi terminalinde; tarayıcı açılır). Token'ı sohbete/repoya yapıştırma.
2. `npx supabase projects list` → `npx supabase link --project-ref <ref>` (ref gizli değildir). Yanlış projeye push etmemek için ref'i iki kez kontrol et.
3. `npm run db:push` → yalnızca **dry-run** planını gösterir. Plan beklenen 6 migration ise `npx supabase db push`. Remote'ta **asla** `supabase db reset` çalıştırma.
4. Geliştirme projesine örnek veri: `psql "$DB_URL" -f supabase/seed.sql` (idempotent, tüm satırlar `is_demo = true`). Production'a seed uygulanmaz.
5. `npx supabase secrets set --env-file supabase/.env.functions` (git-ignored; `RESEND_API_KEY`, `GUARDIAN_PAGE_URL`, `MAIL_FROM`) → `npm run functions:deploy`.
6. Dashboard → Auth: Email OTP açık, 6 hane; e-posta şablonunda `{{ .Token }}` kullan (magic link değil). **Custom SMTP, halka açık yayından önce zorunlu**: Supabase'in varsayılan e-posta servisi düşük hız limitlidir ve yalnız geliştirme içindir.
7. `apps/mobile/.env.local` ve `apps/admin/.env.local`: proje URL'i + **publishable** key. `npm run db:types && npm run verify`.
8. İlk platform yöneticisi: SQL Editor'da `insert into public.platform_admins (user_id) values ('<auth user id>')`.
9. `pg_cron`: `select cron.schedule('expire-guardian', '*/10 * * * *', $$select app.expire_guardian_requests()$$);`

## Remote projede çalışma — ⛔ 7 Ekim 2026: `pacvhcnawtnkauvguoaw` erişilemiyor (NXDOMAIN)
Hedef: önce **TechApp Staging** (ayrı proje, örnek veri serbest), sonra ayrı **production** (seed yok). Production'a
doğrudan migration basılmaz. Kodlu e-posta şablonu `npx supabase config push` ile yüklenmeli (giriş yalnız OTP kodu).
```bash
npx supabase link --project-ref <staging-ref>          # bir kez; ref'i iki kez kontrol et
npm run db:push                                        # plan (dry-run) → sonra: npx supabase db push
npm run db:types                                       # şema değiştiyse (CLI çıktısı kanonik)
npx supabase config push                               # OTP kod şablonu + boş redirect listesi
npm run functions:deploy
npm run env:remote    # iki uygulamanın .env.local dosyasını .env.remote'tan yazar (geri dönüş: npm run env:local)
npm run mobile:web && npm run admin
# Uçtan uca doğrulama (secret key yalnız ortam değişkeninde; dosyaya yazma):
SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… npm --prefix apps/mobile run e2e:remote
```
`.env.remote` içeriği Dashboard → Settings → API Keys'ten alınır: proje URL'i ve **publishable** key.

## Ortamlar ve env guard (7 Ekim 2026)
| EAS environment | Supabase | Not |
|---|---|---|
| development | staging | dev client; LAN backend yalnız yerel `.env.local` ile |
| preview | staging | iç test (APK / ad-hoc) |
| production | production (ayrı proje) | seed yok |

- `src/lib/envValidation.js` tek kural seti: preview/production ve **her release bundle** için https + `<ref>.supabase.co` +
  publishable key; localhost/LAN/secret key reddedilir. `app.config.ts` build/update/export'u durdurur; runtime'da uygulama
  bağlanmadan "yapılandırılmadı" ekranında kalır.
- OTA yalnız: `eas update --channel preview --environment preview` / `--channel production --environment production`.
  `--environment` olmadan çalıştırma: EAS değişkenleri yerine makinedeki `.env.local` okunur (guard bunu reddeder).
- **11 Kasım 2026 (salt okunur kontrol, `eas env:list --environment preview`):** preview ortamında `EXPO_PUBLIC_APP_ENV=preview`,
  `EXPO_PUBLIC_SUPABASE_URL` = staging (`pacvhcnawtnkauvguoaw`), publishable key tanımlı, `EXPO_PUBLIC_SENTRY_DSN` yok (Sentry kapalı kalır).
  `eas channel:view preview`: preview kanalında/dalında **hiç OTA güncellemesi yok** → yeni preview build eski JS ile ezilmez.
  `production` ortamı hâlâ staging URL'ini taşıyor; `envValidation.js` production build'ini bilerek reddeder (production projesi yok).
  (7 Ekim notu "eski ref" artık geçersiz.)

## Native build ve yayın — 19 Eylül durumu (tarihsel; backend'i artık erişilemiyor)

EAS projesi kuruldu (`@intechne/techapp`), owner `intechne`, projectId app.json'da. `preview` / `production` / `development`
ortam değişkenleri EAS'te remote Supabase'e (`pacvhcnawtnkauvguoaw`) işaret ediyordu — 7 Ekim'de bu proje erişilemiyor; o buildler kullanılamaz.

**Alınan iç test buildleri (hesap gerektirmez, remote backend'e bağlı):**
- Android preview **APK** (`preview` profili) — herhangi bir Android cihaza kurulabilir.
- iOS **Simulator** build (`development` profili) — Mac Simulator'da açılır (dev-client: Metro ile).

**Platform gerçeği:** iOS + Android + (Android tabanlı) Huawei AppGallery mümkün. **HarmonyOS NEXT (ArkTS) native binary
bu Expo/RN kod tabanından üretilemez** — ayrı bir proje gerektirir. Huawei yolu = GMS'siz (HMS) Android AAB → AppGallery.

**Production'a geçiş — sırayla, her biri Intechne'nin bir dış girdisini bekler:**
1. **Remote migrations (ZORUNLU, ilk — istisna aşağıda).** **İstisna:** yetki *daraltan* migration'lar (ör. `20261112000300_hide_creator_columns`) eski istemcinin sorgularını kırar → önce yeni istemci (OTA/build), sonra migration (bkz. `KNOWN-ISSUES.md`). **Sıra zorunlu:** `20261112000300` (bekletiliyor) `20261113000100_covers`'dan önce uygulanır — içindeki toplu `revoke select on public.teams` sütun düzeyi grant'leri de kaldırır; sonra uygulanırsa `teams.cover_path`/`cover_blurhash` okunamaz olur. 7 Ekim: önce staging projesi; 13 migration (20261007000100 dahil) uygulanacak.
   **Kapak görselleri (Faz 3b T4, 13 Kasım 2026) — istemci SONRA:** `20261112000300`'ün tersine, `cover_path` / `cover_blurhash` sütunlarını SELECT eden mobil ve admin kodu
   (`EVENT_PUBLIC_COLUMNS`, `OPPORTUNITY_PUBLIC_FIELDS`/`OPPORTUNITY_CARD_FIELDS`, `TEAM_PUBLIC_COLUMNS`) yalnızca `20261113000100_covers` hedef projede uygulandıktan **sonra** yayınlanır; önce yayınlanırsa
   her liste sorgusu "unknown column" ile kırılır. Sıra: (1) `000300` için sütun listeli istemci OTA/build → (2) `db push` `20261112000300` → (3) `db push` `20261113000100` (+ remote 22g ve 22k geçmeli) → (4) kapaklı istemci.
   **Takım profili (Faz 3b T6, 13 Kasım 2026):** `20261113000200_team_profile`, `20261113000100_covers`'dan **sonra** (dosya sırası) uygulanır; `20261112000300`'ten önce uygulanırsa oradaki toplu revoke `teams.category_key` grant'ini düşürür. `category_key` / `team_projects` / `team_public_profile` kullanan istemci (T7) bu migration hedefte uygulandıktan sonra yayınlanır. Push sonrası remote regresyon 23–23i geçmeli.
   **Zengin takım profili — mobil (Faz 3b T7, 13 Kasım 2026) — istemci SONRA:** `TEAM_PUBLIC_COLUMNS` (`category_key`), `team_public_profile`, `team_projects`, `upsert_team_project`/`delete_team_project` yalnız `20261113000200` hedefte uygulandıktan sonra vardır; T7 istemcisi bundan önce yayınlanırsa tüm takım listeleri ve Keşfet önizlemesi kırılır. Sıra: `20261112000300` istemcisi (açık sütun listeleri) → `20261112000300` → `20261113000100` → `20261113000200` → `20261113000300_recruitment_applicants` (+ remote 23–23i ve 24–24c) → T7 istemcisi. `000300_recruitment_applicants` başvuranların adını yalnız takım yöneticisine açan RPC'yi ve `recruitment_posts.created_by` tetikleyicisini ekler. `preview` kanalına OTA yok.
   **Uygulama içi bildirimler — sunucu (Faz 3b T9, 13 Kasım 2026) — ⏸ staging push bekletiliyor (pilot):** `20261113000400_notifications` dosya sırasında en sona: `20261112000300` → `20261113000100` → `20261113000200` → `20261113000300` → `20261113000400`. `notifications` üzerindeki doğrudan istemci UPDATE yolunu kapatır (bugün onu çağıran istemci yok); `mark_notifications_read` / `set_notification_preferences` / `notification_preferences` kullanan istemci (T10 — Bildirimler ekranı ve rozet; T11) bu dosya hedefte uygulandıktan **sonra** yayınlanır (T10 istemcisi `notifications` okur ve `mark_notifications_read` çağırır; hedefte yoksa zil sayısı 0'da kalır, ekran hata durumu gösterir). Hiçbiri `preview` kanalına OTA ile gitmez. pg_cron yoksa iş kurmaz (uyarı verir); staging'de push sonrası remote regresyon 25–25k geçmeli (25j: `techapp-event-reminders` ve `techapp-prune-notifications` `cron.job`'da). **Push öncesi ön kontrol (salt okunur):** `select count(*) from public.notifications where target_type not in ('event','event_registration','application','team')` → 0 olmalı; değilse migration `VALIDATE CONSTRAINT notifications_target_type_check` adımında durur — push yapılmaz, satırlar önce incelenir. Saklama: bildirim oluşturulmasından 90 gün sonra, okunmuşsa silinir (`app.notification_retention_days()`); okunmamışlar silinmez — gizlilik/saklama politikası bunu belirtmeli.
   **Ayarlar ve gizlilik — mobil (Faz 3b T11, 13 Kasım 2026) — istemci SONRA:** bu istemci `notification_preferences` okur ve `set_notification_preferences` çağırır; ikisi de `20261113000400_notifications` hedefte uygulanana kadar yoktur (Bildirim ayarları ekranı hata durumu gösterir). Rıza merkezi (`consents`) ve Gizlilik (`profiles.discoverable`, `team_public_profile` yardım metni) T6'ya (`20261113000200`) bağlıdır; sıra T10 ile aynı: `000300` → `000100` → `000200` → `20261113000300` → `000400` → remote regresyon 25–25j → T10 → T11. Yardım/Yasal bağlantıları `WEB_ORIGIN` altındaki `/destek`, `/gizlilik`, `/kosullar`, `/hesap-silme` sayfalarını açar: dosyalar var, ama `/gizlilik` ve `/kosullar` hukuk onaylı metin olmadan "hazırlanıyor" gösterir — **mağaza/production yayınından önce hukuk onaylı metinler yayında olmalı** (açık pilot kapısı maddesi). `preview` kanalına OTA ile gitmez.
   **Gelişim — mobil (Faz 3b T12, 13 Kasım 2026) — istemci SONRA:** migration yok (`courses`/`lessons`/`event_courses`/`course_progress`/`complete_lesson` `20260919000400`'de). Keşfet ana ekranı takım önizlemesinde `TEAM_PUBLIC_COLUMNS` okuduğundan bu istemci T7/T8 ile aynı sırada gider: `20261112000300` istemcisi → `20261112000300` → `20261113000100` → `20261113000200` → `20261113000300` → T7 + T8 + T12 istemcisi. `preview` kanalına OTA yok. İlerleme yüzdesi yalnız sunucudan okunur; ders metni düz paragraftır (markdown/HTML yok).
   **Birleşik arama — mobil (Faz 3b T13, 13 Kasım 2026) — istemci SONRA:** migration yok. Arama `TEAM_PUBLIC_COLUMNS` (`category_key`, `cover_*`), `OPPORTUNITY_CARD_COLUMNS` ve etkinlik `cover_*` sütunlarını okur → T7 + T8 + T12 ile aynı sırada: `20261112000300` istemcisi → `20261112000300` → `20261113000100` → `20261113000200` → `20261113000300` → T7 + T8 + T12 + T13 istemcisi. `preview` kanalına OTA yok. Staging'de bakılacak: hedef veritabanının `datctype`'ı (`"C"` ise "istanbul" → "İstanbul" yalnız ikinci desenle bulunur; istemci bunu zaten yapar).
   **Kurum profili ve Bildir — mobil (Faz 3b T14, 13 Kasım 2026) — istemci SONRA:** migration yok. Kurum profili etkinlik/fırsat listesinde `cover_*` sütunlarını okur ve proje bildirimi `team_project` hedef türünü kullanır → T7 + T8 + T12 + T13 ile aynı sırada: `20261112000300` istemcisi → `20261112000300` → `20261113000100` → `20261113000200` → `20261113000300` → T7 + T8 + T12 + T13 + T14 istemcisi (`20261113000200` önce uygulanmazsa proje raporu `reports_target_type_check`'ten 23514 alır). `preview` kanalına OTA yok. **Mağaza/production öncesi:** raporlar yalnız veritabanında birikir; `apps/admin`'de rapor kuyruğu yok (Faz 6 ön koşulu, IMPLEMENTATION-STATUS T14 notu) — kullanıcı içeriği yayına çıkmadan önce raporları okuyup işlem yapacak bir arayüz ve sorumlu kişi olmalı.
   Bu dal (`feat/v5-product`) pilotun kullandığı `preview` kanalına **asla** OTA ile yayınlanmaz.
   (19 Eylül notu: o tarihte canlıda son 3 migration yoktu.) Uygulanmadan alınan production build, CV paylaşımı / gönüllü / unvan özellikleri kırık çıkar.
   `npx supabase link` (linkli) → `npx supabase db push` (DB parolası ya da `SUPABASE_ACCESS_TOKEN` gerekir) →
   `npm --prefix apps/mobile run db:types` → `npm --prefix apps/mobile run e2e:remote` (beklenen sonuç staging'de yeniden ölçülecek).
2. **iOS production (Apple Developer hazır).** `eas build -p ios --profile production` → interaktif Apple girişi ister
   (EAS kimlikleri yönetir). Sonra `eas submit -p ios` (App Store Connect App ID).
3. **Android production (Play Console hazır).** `eas build -p android --profile production` (AAB) →
   `eas submit -p android` için Play servis hesabı anahtarı (repo dışı, `secrets/`).
4. **Huawei AppGallery (hesap sonra).** Aynı Android AAB; AGC hesabı açılınca elle ya da `eas submit` özel hedefiyle.
5. **Mağaza paketi ve inceleme:** ekran görüntüleri, açıklama, gizlilik/veri güvenliği formu, ve OTP girişli uygulama için
   **inceleme ekibine çalışan test hesabı** çözümü (Apple/Google inceleyicisi e-posta OTP alamaz — sabit inceleme hesabı gerekir).
