> **V5 — 11 Kasım 2026 (dal `feat/v5-pilot-platform`).** Güncel durum bu bölümdedir. 7 Ekim ve daha eski bölümler **tarihsel kayıttır**; çelişen yerde bu bölüm geçerlidir. ✅ yalnız bugün ölçülen ya da kanıtı yazılı olan şey içindir.

## Faz 3b — çekirdek modüller (dal `feat/v5-product`, sürüyor)
Plan: `docs/superpowers/plans/2026-11-12-techapp-v5-faz3b-core-modules.md`. Görev kaydı: `.superpowers/sdd/2026-11-12-techapp-v5-faz3b-core-modules/` (yerel).

| Görev | Konu | Commit'ler | Staging |
|---|---|---|---|
| T1 | Pilot borçları (Katılım etiketi, yenileme, veli sorgusu, kart anahtarı) | `eedcb43`, `584c72a` | — (yalnız istemci) |
| T2 | `teams.created_by` / `recruitment_posts.created_by` sütun gizliliği (`20261112000300`) | `d4254af` + belge düzeltmesi | ⏸ bekletildi (önce istemci) |
| T3 | Kapak görselleri — sunucu (`20261113000100_covers`) | `79dd2b1` + fix round 1 (`5e33daf`) + fix round 2 (`b0fbba4`) | ⏸ bekletildi — staging'de 22g ve 22k geçmeden kabul edilmez |
| T5 | Takım kapağı mobilde kaptan için | — **ATLANDI** (kullanıcı kararı 13 Kas 2026) | — |

**T3 — ne geldi (yalnız yerelde kanıtlı: `npm run db:test`, remote regresyonun yerel kuru koşusu; staging'de koşulmadı):**
- `events`, `opportunities`, `teams`: `cover_path` + `cover_blurhash`; yol sözleşmesi `<tür>/<kurum ya da takım id>/<uuid>.webp` (+ istemci kuralı `-640` küçük kopya). Klasör = satırın kendi sahibi (CHECK).
- Tek yazma yolu `public.set_cover(p_entity, p_entity_id, p_path, p_blurhash)`: kurum owner|admin|editor (etkinlik/fırsat), platform admini; **takım kapağı şimdilik yalnız platform admini** (aşağıda); başka yazma trigger ile 403. `cover_path` kritik alan: yayındaki etkinlik/fırsatta kapak koyma, değiştirme **ve kaldırma** yeniden incelemeye düşürür; takım kapağı audit'e (yalnız id) yazılır.
- `covers` bucket'ı: public URL ile servis, **yalnız `image/webp`**, ≤2 MB. Listeleme/okuma API'de yalnız klasör sahibine; yükleme/silme yalnız klasör sahibine; UPDATE yok; kullanımdaki dosya silinemez ve aynı adla yeniden yüklenemez.
- **Takım kapağı sunucuda kapalı (kullanıcı kararı 13 Kas 2026):** takım fotoğrafları çoğunlukla 18 yaş altını gösterir; hukuki inceleme ve fotoğraf politikası olana kadar takımlar devre posteriyle kalır ve Task 5 atlandı. Takımın etkin kaptanı `set_cover('teams', …)` ve `teams/…` klasörüne yüklemede 403 `team_cover_disabled` alır; yalnız platform admini yazabilir. Kaptan kuralı silinmedi: tek anahtar `app.team_cover_writes_enabled()` (şu an `false`); yeniden açmak = bu fonksiyonu `true` döndüren yeni migration.
- İstemci şartları (T4 admin; T5 mobil yeniden açılırsa): her görsel WebP'ye yeniden kodlanır (EXIF/GPS silinir); `upsert: false`, her görsel yeni uuid; önce iki dosya, sonra `set_cover`; başarılı değiştirme/kaldırmadan sonra eski dosya çifti Storage API ile silinir.
- Kaldırma talebi (moderasyon, veli, kurum): iki adım zorunlu — `set_cover(…, null)` sonra iki dosyanın Storage API ile silinmesi. CDN ve istemci disk önbelleği görseli silindikten sonra bir süre daha gösterebilir.
- Yetim dosyalar: kullanımda olmayan ve 24 saatten eski `covers` nesnelerini Storage API ile (SQL DELETE değil) silen zamanlanmış temizlik **henüz yok** → Faz 6 ops.

**Bekletilen (Step 5, kullanıcı onayı gerekir):** staging `db push` + remote regresyon 22–22j — Cezeri pilotu (27–29 Kasım) bitene kadar yok. Yayın sırası: (1) sütun listeli istemci OTA/build → (2) `20261112000300` → (3) `20261113000100` → (4) remote regresyon + kalıntı kontrolü + public URL'nin curl ile kontrolü. `20261112000300`, `20261113000100`'den **önce** uygulanmalı: içindeki toplu `revoke select on public.teams` sütun düzeyi SELECT'leri de kaldırır, sonra uygulanırsa kapak sütunlarının grant'i düşer.

**Notlar (karar bekleyen / sonraki görev):** askıya alınmış (`moderation_status = 'suspended'`) takımın kaptanı kapağı hâlâ değiştirebilir (takım herkese gizli); takım kapağı yeniden açılmadan önce hukuki inceleme + fotoğraf politikası gerekir (Task 5 atlandı); `team_projects.cover_path` (T6) bu sözleşmeye henüz bağlı değil.

## Faz 4 — tasarım sistemi ve beş sekme (12–13 Kasım 2026, dal `feat/v5-product`)
Plan: `docs/superpowers/plans/2026-11-12-techapp-v5-faz4-design-system-and-five-tabs.md`. Önizleme kapısı kullanıcı tarafından onaylandı (12 Kasım, “önerilerle onay”; `docs/design/faz4-preview/REVIEW.md`). Son görüntüler onaylı taslakla yan yana: `docs/design/faz4-final/` (README'de sapmalar). Bu dal pilot dalından ayrıdır; pilot yolu etkilenmedi.

| Görev | Konu | Commit'ler |
|---|---|---|
| T1 | Token borcu, semantik katman, elevation, hardcode koruma testi, ikon anlamları | `92a47a3`, `d37c9cc` |
| T2 | Kart ailesi (CardBase · PosterCard · RowCard · MiniCard · HeroCard), iskeletler | `25fad43`, `c4c5756`, `75ef0d6` |
| T3 | En kötü durum verisi, yalnız yerelde açılan önizleme rotası, `check:no-dev-preview` | `75e9d78`, `d930736`, `dd76a4f` (CI) |
| T4 | Önizleme kapısı (taslak dalı `feat/v5-design-preview` birleşmez) + onay | `13836de`, `3537074` |
| T4b | Onaylı kart kararları (durum altta, tek satır poster başlığı, dar ekranda tek sütun, bölünmeyen adlar) | `b701f60` |
| T5 | Keşfet | `1f3869c`, `2e4f150` |
| T6 | Etkinlikler (filtre sheet'i), detay, kayıt, check-in | `d9d45d1`, `dab1907`, `3485c74`, `1765d7d` |
| T7 | Fırsatlar, detay, başvuru, Son tarihler, Başvurularım | `035d411`, `fe0c304` |
| T8 | Topluluk, takım profili, çalışma alanı | `a59190f`, `418d5a8` |
| T9 | Profil | `157723f`, `575af50` |
| T10 | Onboarding ve giriş | `8eb1e58`, `6a52504` |
| T11 | Kapanış: HIG Doctor, küçük düzeltmeler, son görüntüler, belgeler | `9ca8768` + belge commit'i |

**Ölçüm (T11):** `npm --prefix apps/mobile run verify` → typecheck temiz, lint 0, jest **634 geçti + 2 todo** (68 süit), konsol çıktısı temiz; `noHardcodedStyle` izin listesi boş; `check:no-dev-preview` OK; HIG Doctor `--fail-on serious` çıkış 0, 0 concern ([rapor](docs/audits/2026-11-13-hig-doctor.md)).

**Yapılmayanlar (Faz 3b'ye bağlı satırlar, plan “Self-review”):** Arama ekranı ve arama alanından geçiş, bildirim zili/rozeti, detayda Kaydet ve Kaydedilenler/Bildirimler/Ayarlar girişleri, kurs ekranı (Gelişim bölümü gizli; “Bu etkinliğe hazırlan” yok), kurum profili sayfası, kurum logosu ve kapak görselleri (öncü karo hep ikon), takım profilinde Projeler/Etkinlikler. Rol dağılımı bölümü gizlilik nedeniyle yapılmadı (veri yalnız üyelere açık RPC'de). Açık bilinen sorunlar: `docs/KNOWN-ISSUES.md` “Faz 4 kapanışı”.

**Doğrulandığı yerler:** web (Expo web, Playwright) 390×844 ve 320×640; Android emülatör (API 36.1, 411 dp) yazı ölçeği 1.0 ve 2.0, EAS development derlemesi. **Doğrulanmadı:** iOS (simülatör dahil), gerçek cihaz (Android veya iPhone), TalkBack/VoiceOver sesli tur, QR'ın gerçek cihazda taranması, iOS OTP odak zamanı.

## V5 — 11 Kasım 2026
Dal `feat/v5-pilot-platform` (`feat/techapp-stabilization` @ `a0a97c5`'ten). Commit'ler: `97f9cea`, `b1f0cf3`, `fef8e5a` (Open Circuit v2 ikonları), `1815770` (test portu / expo-doctor / SDK 57 yamaları), `fe5a478` (HIG denetimi), sonra pilot görevleri ve final review düzeltmeleri (`89f0556`…`f0a03fd`). Dal `feat/v5-pilot-platform` fe5a478'e kadar GitHub'a itildi (yedek push, kullanıcı izniyle, Intechne hesabı üzerinden); sonraki commit'ler her görev incelemesinden sonra itilir.
Pilot adayı: Cezeri Robot Ligi, Ümraniye, 27–29 Kasım 2026 — yalnız görevliler, Intechne ekibi ve az sayıda gönüllü test kullanıcısıyla kontrollü pilot; resmî takım kaydı TechApp dışında kalır. Hedef dondurma 21 Kasım; go/no-go 24 Kasım, kararı kullanıcı verir.

### Bugünkü ölçümler (2026-11-11, son güncelleme final-review düzeltmeleri sonrası)
| Kalem | Durum | Kanıt |
|---|---|---|
| Veritabanı + Edge testleri | ✅ | `npm run db:test` **125/125** (11 dosya; 122 + 3 `free-port`). Geçici Postgres tercihen `54339`'da; `54329` (Keşif) hiçbir durumda seçilmez. 17 migration |
| Mobil | ✅ | `npm --prefix apps/mobile run verify` → typecheck temiz, lint **0**, jest **295/295** (38 süit), `--forceExit` olmadan, "worker failed to exit" uyarısı yok |
| Admin / web | ✅ | `npm --prefix apps/admin run typecheck` ve `apps/web` typecheck temiz |
| expo-doctor | ✅ | `npm --prefix apps/mobile run doctor` **21/21** (expo-doctor 1.20.5 sabit) |
| HIG Doctor | ✅ (otomatik) | `npx hig-doctor apps/mobile --fail-on serious` → **0 critical**, 1 moderate (OTP `autoFocus`, bilinçli), kapı geçer. Otomatik denetim HIG uyumunu kanıtlamaz; ilk rapor [docs/audits/2026-11-11-hig-doctor.md](docs/audits/2026-11-11-hig-doctor.md) |
| EAS Android build | 🟡 | Development build `3e02e2cf` (commit `b28ea0a`) derlendi ve **Android 16 emülatöründe çalıştırıldı**: 8 adımlık yolculuk 7/8 PASS (adım 7 FAIL → D1), bulunan D1–D10 kodda düzeltildi; emülatörde yeniden doğrulama bekliyor ([QA](docs/qa/2026-11-pilot-journey-android.md)). Preview/release build yok; gerçek Android cihaz yok |
| EAS preview ortamı | ✅ | `preview` ortamı doğrulandı: `EXPO_PUBLIC_APP_ENV=preview`, staging URL + publishable key, DSN yok; `preview` kanalında OTA update yok |
| EAS iOS build | 🟡 | production `8af1d94c` FINISHED 2026-09-19 (`34dbc05`); development/simulator `cb297b76` 2026-09-19. Cihazda/simülatörde çalıştırılmadı |
| Staging Supabase `pacvhcnawtnkauvguoaw` | 🟡 | Migration geçmişi **17/17** senkron (`20261111000100`, `20261112000100`, `20261112000200` dahil); remote güvenlik regresyonu **38/38 PASS** (20–20f kısa kodla check-in dahil), rollback, kalıntı 0. Gerçek e-postalı uygulama E2E'si (adult + minor/veli) bu dal için henüz koşulmadı |
| Production Supabase | ⛔ | Ayrı proje yok; EAS `production` ortamı hâlâ staging'i gösteriyor, env guard bunu bilerek reddeder |
| Crash reporting | 🟡 | Sentry kodu kurulu (PII temizleme, ortam ayrımı) ama **KAPALI**: DSN yok → `Sentry.init` çağrılmaz. Açık: DSN bağlantısı ve saklama süresi kararı ([CRASH-REPORTING](docs/CRASH-REPORTING.md)) |
| Haptics / Reanimated | ✅ (kod) | `react-native-reanimated` + `react-native-worklets` + `expo-haptics` kurulu (PressableScale, check-in geri bildirimi); dev build'de derlendi. Haptic emülatörde gözlemlenemedi |

**Final review düzeltmeleri (11 Kasım):** C1 süresi dolmuş token ile çevrimdışı soğuk açılışta kayıtlı kartlar açılış ekranında; I1 iptal edilen
kaydın çevrimdışı kartı silinir; I2 "Son güncelleme" tarih + saat; M1 çıkıştan sonra biten kart isteği kaydedilmez; M3 jest çıkış uyarısı;
M4 hatalı OTP'de yeniden gönderme beklemesi; M6 test portu. Ayrıntı ve cihaz yeniden test adımları:
`.superpowers/sdd/2026-11-11-techapp-v5-phase1-2/final-review.md` → "Final fixes". Hepsi yalnız jest/vitest ile kanıtlı; cihazda değil.

### Pilot kapısı (spec §7 — hepsi ✅ olmadan "pilota hazır" denmez)
| # | Kapı | Durum | Neden · sorumlu |
|---|---|---|---|
| 1 | Staging adult + minor/veli E2E, gerçek e-posta teslimiyle, son build üzerinde | 🟡 | 7 Ekim PASS (eski commit); bu dalın build'iyle yeniden koşulmadı · geliştirme |
| 2 | Ayrı production Supabase (migration, OTP şablonu, SMTP, secret'lar) | ⛔ | Proje yok; açılması kullanıcı onayı gerektirir · kullanıcı + geliştirme |
| 3 | Hukuk: aydınlatma + veli onayı + koşullar onaylı ve sürümlü | ⛔ | Metinler yok (`/gizlilik`, `/kosullar` "hazırlanıyor"); gerçek kullanıcıya açılma blokeri · kullanıcı / hukuk |
| 4 | EAS Android + iOS, emülatörde 8 adımlık yolculuk, gerçek iPhone + Android, Huawei check-in | ⛔ | Dev build emülatörde koştu (7/8, D1–D10 sonradan kodda düzeltildi); preview build + emülatör tekrarı, gerçek Android cihaz, iOS ve Huawei yok · geliştirme + kullanıcı |
| 5 | Remote güvenlik regresyonu, yeni tablo RLS, 18 yaş altı görünürlük denetimi | 🟡 | Staging remote regresyon 38/38 PASS; yerel `pilot-privacy`; açık: `teams.created_by` / `recruitment_posts.created_by` anon okunabilir (KNOWN-ISSUES) · geliştirme |
| 6 | Erişilebilirlik turu + HIG Doctor'da serious yok | 🟡 | HIG Doctor 0 critical / 1 moderate; emülatörde yazı ölçeği 2.0 PASS, 320 dp turu yapıldı (D6/D8 bulundu, kodda düzeltildi, yeniden bakılacak); TalkBack sesli turu yapılamadı · geliştirme |
| 7 | Crash reporting açık veya kapalı olduğu yazılı kabul | ⛔ | Sentry kurulu ama kapalı (DSN yok); "kapalı" için yazılı kabul ya da DSN + saklama kararı yok · geliştirme + kullanıcı |
| 8 | Etkinlik günü planı (görevli hesapları, cihaz başına check-in testi, admin web + kısa kod yedeği) | ⛔ | Plan yazılmadı · kullanıcı + geliştirme |

### Ürün gerçeği (kod üzerinde kontrol edildi, cihazda değil)
- **Var:** Fırsatlar (detay, başvuru, başvurularım, son tarihler) ve Topluluk (takım detayı, takım oluşturma, takım çalışma alanı kanban, görev düzenleyici) artık salt okunur değil; profilde deneyim düzenleyici/detay, CV paylaşımı ve gönüllü alanı var. `apps/admin` boş değil (etkinlik, fırsat, doğrulama, onay, check-in sayfaları).
- **Yok:** öğrenme ekranları, Kaydedilenler ekranı (yer imi arayüzü yalnız fırsatlarda), bildirimler (uygulama içi + push), uygulama içi ayarlar/gizlilik/rıza merkezi/yardım/yasal ekranlar, takım etkinlik kaydı (DB `registration_mode='team'` kaydı reddeder), birleşik arama (yalnız etkinlik), etkinlik/fırsat/takım kapak görselleri (kolon yok), Gesture Handler (Reanimated + Haptics + Sentry kodu var; Sentry DSN'siz kapalı). Ödeme / Cüzdan / Fonla / TechRank / AI Koç modülleri taşınmadı (feature flag yok; `env.ts`'te `features` nesnesi yok). Admin'de kapak yükleme, oturum programı düzenleyici, kurum/üye yönetimi, audit ekranı eksik.
- Uygulama ikonu/splash Expo yer tutucusu **değil** ("Açık devre T" amblemi); ikon sistemi Open Circuit v2 (50 SVG + 32 dolu durum).

> **Tarihsel bölümler:** aşağıdaki 7 Ekim ve daha eski bölümler geçmiş kaydıdır; güncel hâli için yukarıdaki V5 bölümüne bakın.

> **7 Ekim 2026 — stabilization sprint (dal `feat/techapp-stabilization`).** Güncel durum bu bölümdedir; aşağıdaki
> eski bölümler tarihsel kayıttır. Kaynak: 7 Ekim denetim raporu.

## Stabilization sprint — 7 Ekim 2026
Verdict: **WORKING DEVELOPMENT BUILD** — remote staging doğrulandı; native build + cihaz kabulü olmadan PILOT READY değil.

Ortamlar: **local** (`npm run db:dev`, `.env.localstack`) · **staging** = Supabase `techapp` / `pacvhcnawtnkauvguoaw` (EAS development + preview,
`.env.remote`) · **production** = henüz ayrı proje yok; `envValidation.js` production'ın staging ref'ini kullanmasını reddeder.

| Kalem | Durum | Kanıt |
|---|---|---|
| Uzak Supabase (staging) | ✅ | ACTIVE_HEALTHY, CLI link'li. Migration geçmişi **14/14** senkron (`20261007000100_stabilization_security`, `20261007000200_advisor_hardening` remote'ta) |
| Supabase advisors | ✅ | İlk taramada 1 ERROR (`my_guardian_requests` SECURITY DEFINER view) — **gerçek P1**: reşit olmayan, view üzerinden kendi veli isteğini `approved` yapıp sayaçlarını sıfırlayabiliyor / silebiliyordu (staging'de rollback'li probe ile kanıtlandı). `…200_advisor_hardening` ile kapatıldı + 13 mutable `search_path`. Kalan: 50 "SECURITY DEFINER RPC çağrılabilir" (tasarım gereği, kural 5), leaked-password (OTP-only, geçersiz), 21 performans WARN (P3) |
| Remote güvenlik regresyonu | ✅ | `supabase/tests/remote/security-regression.sql` — **28/28 PASS**, gerçek API rolleriyle; her koşu tamamen rollback (kalıntı yok, sayılarla doğrulandı) |
| Generated types | ✅ | `database.generated.ts` remote'tan (`supabase gen types --linked`); tek şema farkı view'in artık Insert/Update taşımaması |
| 6 haneli OTP (remote) | ✅ | Resend SMTP, kodlu şablon. Yepyeni hesap (`confirmation` şablonu, 11 sn'de doğrulandı) + iki mevcut hesap (`magic_link` şablonu) + çıkış→tekrar giriş |
| Edge Functions | ✅ | `guardian-dispatch` v5, `delete-account` v4 ACTIVE, `verify_jwt` açık. Hosted runtime: kimliksiz/sahte JWT 401, publishable-only 401 `auth_required`, GET 405. `guardian-dispatch` gerçek JWT ile e-posta gönderdi. `delete-account` yalnız onaylanan test hesabında (onaylanan tek kullanımlık test hesabı) uygulamadan çağrıldı: kullanıcı/profil/kayıt/rıza silindi, `seats_taken` 1→0, audit `deletion_requested→deleted`. Personel/moderatör yolu yalnız yerel testte |
| Veli e-posta secret'ları | ✅ | `RESEND_API_KEY`, `MAIL_FROM`, `GUARDIAN_PAGE_URL` tanımlı (değerler görülmedi); link `techapp.intechne.com.tr/veli` |
| Minor / veli remote E2E | ✅ | kayıt → `pending_guardian` → veli e-postası gerçekten ulaştı → `/veli` onay → `confirmed`; token tek kullanım (hash silindi), self + guardian rızaları sürümlü, audit `created→sent→approved`, `seats_taken` tutarlı, imzalı QR + kısa kod eşleşmesi. Resend cooldown remote DB seviyesinde (UI'dan değil); süre dolumu yalnız yerel testte |
| Adult remote E2E | ✅ | Yepyeni hesap: OTP → ilk profil (26 yaş) → veli isteği yok → çift tıklamada tek kayıt, doğrudan `confirmed` → `seats_taken` +1 → imzalı QR + kısa kod eşleşmesi → yenileme → çıkış (kişisel ekranlar temizlendi) → tekrar giriş → profil + kayıt korundu |
| P0 açılışta beyaz ekran | ✅ | (önceki tur) Jest + web'de backend kapat/aç |
| P1 CV / veli limitleri / onaylı içerik / doğrulama / hesap silme FK | ✅ remote | Yerel testler + remote regresyon 01–18 |
| Production env guard | ✅ | + production staging ref'ini kullanamaz (test + `expo config` simülasyonu). ⚠️ EAS `production` ortamı hâlâ staging URL'ini taşıyor → production build şimdi bilerek başarısız olur; production projesi açılınca güncellenecek |
| EAS env | ✅ dev/preview | development + preview → staging URL + publishable key, LAN/secret yok |
| Native çökme riski (`Notice`) | ✅ | Değişkenli metin `<Text>` dışında kalıyordu (web'de serif, native'de çökme: veli formu, fırsat detayı). Düzeltildi + test |
| Hesap değişiminde önceki kullanıcının ekranları | ✅ | E2E'de bulundu: yeni hesapla girişte Keşfet yığınında önceki kişinin katılım kartı (QR + kısa kod) görünüyordu (sunucu 404 veriyordu; yalnız istemci belleği). Oturumlu kimlik bitince önbellek temizlenir + `NavigationContainer` yeniden kurulur; misafir→giriş akışı korunur. Test + tarayıcıda doğrulandı |
| EAS iOS/Android build | ⛔ | Sıradaki adım |
| Native kabul | ⛔ | Build bekliyor |
| Testler | ✅ | DB+Edge **95/95** · mobil **92/92** + typecheck + lint · admin/web typecheck · remote regresyon **28/28** |

> **30 Eylül 2026 notu:** Bu belgede tarihsel/eski durumlar bulunuyor. Güncel kod denetimi ve yeniden çalıştırılan testler için [hazırlık denetimini](docs/READINESS-2026-09-30.md) esas alın.

# TechApp — Implementation Status

Son güncelleme: 2026-09-19 (3. oturum) · Dal: `feat/release-readiness` · ✅ Completed · 🟡 Partial · ⛔ Blocked · ⚪ Not started

"Doğrulandı" = bu makinede otomatik test ve/veya çalışan uygulamada gözle kontrol edildi. Native cihaz doğrulaması ayrıca belirtilir.

## Fazlar
| Faz | Durum | Not |
|---|---|---|
| 0 · Audit & bootstrap | ✅ | v4 P0/P1 bulguları kod üzerinde yeniden doğrulandı; Expo SDK 57 iskeleti, lockfile, strict TS, ESLint, Jest, env yapısı, expo-doctor 21/21 (7 Ekim: WARNING — 5 paket bir yama geride) |
| 1 · Design system | ✅ | Token, tipografi, 30 ikonluk `TechIcon`, ~40 ortak bileşen, 5 sekmeli kabuk. Web önizlemede gözle kontrol edildi |
| 2 · Auth + onboarding | 🟡 | Misafir onboarding, e-posta OTP, güvenli oturum, profil bootstrap, hesap silme akışı yazıldı ve yerel yığında uçtan uca çalıştı. ⛔ Gerçek Supabase Auth + SMTP ile doğrulanmadı |
| 3 · Discovery | 🟡 | Keşfet gerçek backend'den: ilgi alanına göre etkinlik, arama, fırsat/takım önizleme. Arama yalnız etkinlik; bildirimler yok |
| 4 · Event pilot | 🟡 | Liste (cursor pagination, filtre), detay, sunucu uygunluğu, atomik/idempotent kayıt, bekleme listesi, veli akışı, QR katılım kartı, check-in. Takım kaydı ⚪. Native build ⛔ |
| 5 · Admin pilot | 🟡 | `apps/admin` (Vite + React + TS): OTP ekip girişi (hesap oluşturmaz), rol kapısı, etkinlik listesi/oluştur/düzenle, yayın akışı (taslak→inceleme→Intechne onayı→yayın/iptal/arşiv, DB durum makinesi + audit), kayıt listesi (filtre/arama/değerlendirme, minimum PII), web check-in (kamera/okuyucu/elle; geçerli · tekrar · yanlış etkinlik · geçersiz). Yerel yığında tarayıcıda uçtan uca doğrulandı; 5 DB entegrasyon testi. ⛔ Gerçek Supabase'e karşı denenmedi; kapak görseli, kurum/üye yönetimi, audit ekranı yok |
| 6 · Opportunities | 🟡 | Şema + `submit_application` (snapshot, idempotent, durum geçmişi) testli. Mobilde salt-okunur liste |
| 7 · Community / teams | 🟡 | Şema + join/rol/görev RPC'leri testli. Mobilde salt-okunur liste |
| 8 · Profile / experience | 🟡 | Şema + attestation (ayrı kayıt, revoke) testli. Mobilde temel profil + hesap |
| 9 · Learning | 🟡 | Şema + `complete_lesson` testli, seed'de 3 kurs. Mobil ekran ⚪ |
| 10 · Release hardening | ⚪ | Analytics soyutlaması var; crash reporting, push, offline cache, mağaza varlıkları yok |

## 3. oturum — yayına hazırlık (2026-09-19)
"Doğrulandı" aynı anlamda: otomatik test ve/veya çalışan uygulamada gözle kontrol. Hepsi **yerel yığında**; remote'a henüz uygulanmadı (aşağıya bak).

| Alan | Durum | Ne yapıldı · kanıt |
|---|---|---|
| Admin paneli (masaüstü) | ✅ | Eksik 5 sayfa yazıldı: Fırsatlar listesi/formu/detayı (başvuru incelemesi, dondurulmuş paylaşım verisi, durum geçişleri), Doğrulama talepleri (talep edenin adı, kapsam/dayanak/geçerlilik, iptal, kanıt dosyası imzalı bağlantıyla), Intechne yayın onayı kuyruğu. 1024 px altı yalnız giriş kontrolü. `tsc` + `vite build` temiz; tarayıcıda gerçek seed verisiyle gezildi, konsol hatasız |
| Gönüllü etkinlik alanı | ✅ | Mobil: etkinlik sayfasında "Gönüllü ol" (misafir → giriş → form geri açılır), başvuru/çekilme, onaylı gönüllüye `VolunteerHub` (görev, program, gönüllü duyuruları, takım adları, sayılar). Katılımcı kimliği yok: DB testiyle kanıtlı |
| Doğrulanmış dijital CV | ✅ | `app.cv_document` tek kaynak; `my_cv()` (özel) + `public_cv(token)` (herkese açık, anon). Uygulamada paylaşım kartı (aç/kapat, her açılışta yeni bağlantı), web'de `/cv/<token>` sayfası (noindex, no-referrer, önbelleksiz, yazdırılabilir). Taslak/gizli kayıt, kimlik, karar notu ve geçersiz doğrulama sızmıyor; iptal anında yansıyor: DB testi. Yalnız 18+ (hukuk kararı bekliyor) |
| Takım yönetimi | ✅ | Kanban (3 sütun), görev atama, son tarih, **öncelik**, "Bana atananlar" filtresi, ilerleme özeti, roller, katılma istekleri ve **unvan atama** (`set_team_member_title`; unvan yetki vermez, CV'de görünür). DB + jest testli |
| Responsive | 🟡 | Web kökündeki 430 px sabitleme kaldırıldı (pencere genişliğiyle çelişip içeriği ~250 px'e sıkıştırıyordu). Yeni `xlarge` sınıfı (≥1600: TV / geniş masaüstü, 4 sütun, 1480 px sınır). 900 px'te yan gezinme + tam genişlik gözle doğrulandı. ⛔ ≥1200 ve gerçek TV/tablet cihazında bakılamadı (bu makinede pencere 900 css px'i geçmiyor; native build yok) |
| Amblem / uygulama ikonu | ✅ | Expo'nun varsayılan ikonu değiştirildi. "Açık devre T." amblemi: `design-source/brand/build.mjs` tek geometriden iOS, Android adaptive (ön/arka/monokrom), splash, favicon, web `icon.svg`/`apple-icon.png`, admin favicon ve 1024/512 mağaza ikonlarını üretir. iOS maskesi, Android dairesi, temalı ikon ve 16 px'te gözle kontrol edildi |
| Lint borcu | ✅ | Üç form ekranındaki `set-state-in-effect` hataları "yükle → formu mount et" kalıbıyla giderildi |

Test toplamı: DB **52/52**, mobil jest **41/41**, mobil typecheck + lint temiz, admin build temiz, web typecheck temiz.

### Bu oturumdan sonra yayın için kalan adımlar
1. `supabase/migrations/20260920000100_*`, `20260920000200_*` ve `20260920000300_*` **remote'a uygulanmadı**. `npm run db:push` (dry-run planını oku) → `npm run db:types` → `npm --prefix apps/mobile run e2e:remote`. Uygulanana kadar canlıda CV paylaşımı, unvan ve gönüllü alanı çalışmaz (mobil şema eski sunucuyu da okur).
2. Vercel: `apps/web` yeniden deploy (yeni `/cv/[token]` rotası), `apps/admin` ayrı proje olarak deploy (`VITE_SUPABASE_*`).
3. Native build hâlâ ⛔ (EAS Build ya da ≥15 GB disk). Yeni ikonlar `expo prebuild` ile alınır; cihazda bakılmadı.
4. Hukuk: reşit olmayanların CV bağlantısı paylaşımı ve gönüllülüğü (ikisi de şimdilik 18+).
5. Bilinen küçükler: web'de `/profile` derin bağlantısı oturum açılışından sonra Keşfet'e düşüyor; admin paket boyutu uyarısı (>500 kB, kod bölme yapılmadı).

## Güvenlik denetimi (2026-09-19, 3. oturum)
İki bağımsız denetim yapıldı (yalnız yerel yığın; remote'a dokunulmadı).

**Backend (RLS/RPC) — temiz.** 4 saldırgan profiliyle (anon, normal kullanıcı, düşük rollü kurum üyesi, takım dışı) 28/28 aktif istismar denemesi engellendi. Statik denetim: her tabloda RLS açık; SECURITY DEFINER fonksiyonlarında `search_path=''`; anon-çalıştırılabilir yalnız 5 fonksiyon (hepsi kendini savunuyor); yetki taşıyan kolonlar (birth_date, discoverable, org verification/is_demo, event status/seats_taken, team member_count, attestation status) trigger korumalı. Check-in token'ları HMAC-SHA256 + sabit-zaman; veli token'ları sha256 hash, tek kullanımlık.

**Mobil istemci + web yüzeyi — kritik/yüksek yok.** Sır sızıntısı yok (yalnız publishable key; eslint `service_role`'ü yasaklıyor). Oturum `expo-secure-store`'da (Keychain/Keystore), token log/analytics'e yazılmıyor. Yetki daima sunucudan (`my_account_state`). Deep link yalnız salt-okunur ekranlara; yan etki tetiklemiyor. Analytics yalnız id+enum. QR opak imzalı token. WebView yok; `eval`/`Function` yok. Web CV: token URL fragment/path'te, `no-referrer` + `noindex`, serbest metin React ile escape'li, JSON-LD `<` kaçışlı.

**Bulgular kapatıldı (hepsi düşük/bilgi):**
- Mobil `Linking.openURL` çağrıları artık `openExternalUrl` ile https doğruluyor (`lib/links.ts` + test).
- Auth callback yalnız bu cihazın başlattığı girişte token kabul ediyor (magic-link login-CSRF kapatıldı).
- Web CV'de `new URL(link_url)` → `safeHost()` (bozuk değer 500 vermiyor).
- `organizations.verified_by/verified_at` artık anon'a kapalı (kolon-düzeyi grant).

## İlk milestone kabul kriterleri (§47)
| | Kriter | Durum | Kanıt |
|---|---|---|---|
| A | Yeni kullanıcı uygulamayı açar | 🟡 | Expo web'de doğrulandı; native build bekliyor |
| B | İlgi alanı seçer | ✅ | Canlı test |
| C | Keşfet'te gerçek backend etkinlikleri | ✅ | PostgREST üzerinden seed verisi; mock yok |
| D | Etkinlik detayı | ✅ | Canlı test + deep link `/events/:id` |
| E | "Katıl" | ✅ | Canlı test |
| F | Gerekirse OTP | 🟡 | Yerel GoTrue-uyumlu gateway ile doğrulandı (yanlış kod reddi dahil); gerçek Supabase Auth ⛔ |
| G | Uygunluk sunucuda | ✅ | `event_eligibility` + `register_for_event` testleri |
| H | 18 yaş altı → guardian durumu | ✅ | DB testleri + canlı test (16 yaş → `pending_guardian`) |
| I | Atomik registration | ✅ | Event satırı kilidi; DB testi |
| J | Mükerrer kayıt yok | ✅ | Partial unique index + idempotency; paralel çift istek testi + canlı çift tıklama |
| K | Kapasite sunucuda korunur | ✅ | 3 yer / 12 eşzamanlı kayıt → 3 confirmed, 9 waitlisted |
| L | Başka cihazda aynı durum | ✅ | Durum yalnız sunucuda; sayfa yenileme/yeni oturumla doğrulandı |
| M | Gerçek katılım kartı | ✅ | HMAC imzalı opak QR, PII yok; iptalde geçersiz |
| N | Yetkili organizer check-in | ✅ | HTTP: 200 `checked_in`, tekrar → `already_checked_in` |
| O | Yetkisiz check-in yapamaz | ✅ | HTTP 403 (yabancı, katılımcının kendisi, başka kurum) |
| P | Kritik RLS testleri | ✅ | 47/47 DB testi (RLS denetim + admin paketi dahil) |
| Q | iOS + Android dev build açılır | ⛔ | Denenmedi: diskte ~4 GB boş (Pods + Gradle build sığmıyor). Statik olarak hazırlandı, gerçek cihaz doğrulaması bekliyor |
| R | Huawei/GMS durumu belgeli | 🟡 | `docs/HUAWEI.md`; HMS cihaz testi ve push sağlayıcısı yok |

**Sonuç: Event Pilot "tamamlandı" DEĞİL.** Q, F'nin gerçek servis ayağı ve R açık.

## v4 bulgularının durumu
| Bulgu | Durum |
|---|---|
| Auth `loggedIn: true` | ✅ Kaldırıldı; gerçek OTP oturumu |
| Guardian "Devam Et (Demo)" | ✅ Yok; onay yalnız sunucu token'ıyla, ayrı web sayfasında |
| Varsayılan kaptan / client yetkisi | ✅ Roller yalnız sunucuda; RPC'ler testli |
| `BILLING_MODE='demo'` | ✅ Taşınmadı; `env.features` ile kapalı |
| Settings reset stale state | ✅ Fonksiyonel update + `clearLocalData`; testli |
| AsyncStorage parse/IO | ✅ Zod şema + sürüm + fallback; testli |
| SecureStore kullanılmıyor | ✅ Supabase oturum deposu (parçalı); testli |
| Matching NaN / sabit 0.8 | ✅ Taşınmadı (TechRank fazı); kural CLAUDE.md'de |
| Takvim dışı / gelecek doğum tarihi | ✅ İstemci + sunucu; testli |
| Client `verified=true` | ✅ Yok; attestation ayrı tablo |
| EAS `REPLACE_*` | ✅ Placeholder yok; gerekenler `docs/RELEASE.md` |

## Remote Supabase (development) — proje `techapp` · ref `pacvhcnawtnkauvguoaw` · eu-central-1 — ⛔ TARİHSEL (19 Eylül)
> 7 Ekim 2026: bu projeye erişilemiyor (NXDOMAIN). Aşağıdaki ✅'ler o tarihteki ölçümdür, bugünkü durum değildir.
| Kriter | Durum | Kanıt |
|---|---|---|
| Remote linked | ✅ | `supabase link`; proje boştu (tablo yok, migration geçmişi yok) — push öncesi doğrulandı |
| Migrations applied | ✅ | 7 migration (`0100`–`0700`), dry-run planı kontrol edilerek. `0500 storage` ilk kez gerçek Supabase'de çalıştı. `db reset` hiç kullanılmadı |
| Seed | ✅ | Yalnız `is_demo = true` örnek veri: 12 etkinlik · 8 fırsat · 6 takım · 3 eğitim (idempotent) |
| RLS | ✅ | Canlı API'de anonim anahtar 7 hassas tablodan 0 satır; e2e'de kullanıcılar arası okuma/yazma engeli, özel profil izolasyonu |
| Generated types | ✅ | `npm run db:types` remote şemadan; yerel üretimle yalnız kozmetik fark. typecheck temiz |
| Edge Functions | ✅ | `guardian-dispatch`, `delete-account` ACTIVE, `verify_jwt = true`; ikisi de gerçek kullanıcı JWT'siyle çağrıldı |
| Auth config | ✅ | OTP 6 hane / 10 dk, yönlendirme listesi, özel SMTP (Resend · `no-reply@auth.intechne.com.tr`, Dashboard'da), kodlu Türkçe e-posta şablonu `config push` ile yüklendi |
| Gerçek OTP doğrulaması | ✅ / 🟡 | Supabase Auth `verifyOtp` ile gerçek oturum (kod admin API'den alındı); yanlış kod reddi, oturum geri yükleme + yenileme. 🟡 E-postanın kutuya düşmesi, süre dolumu ve hız limiti elle denenmedi |
| Event registration E2E (remote) | ✅ | `npm --prefix apps/mobile run e2e:remote` → **26/26**: misafir keşif, sunucu uygunluğu, son yer için paralel 2 kayıt → 1 confirmed + 1 waitlisted, tekrar kayıt tek satır, `pending_guardian` kalıcı, veli onayı (tek kullanımlık token) → confirmed, imzalı QR, yetkisiz check-in 403, yanlış etkinlik, çift okutma tek kayıt, iptal, hesap silme. Test verisi kendini temizler |
| Zamanlanmış iş | ✅ | `pg_cron`: veli isteklerinin süre dolumu 10 dk'da bir |
| Veli e-postası teslimi | ⛔ | `RESEND_API_KEY`, `GUARDIAN_PAGE_URL`, `MAIL_FROM` secrets yok → function 502 `mail_delivery_failed` (beklenen). Veli sayfası henüz bir alan adında yayınlanmadı |
| Mobil/admin uygulamanın remote'a karşı arayüz testi | 🟡 | `npm run env:remote` ile uygulamalar remote'a bağlanır; arayüzden giriş gerçek e-posta kutusu gerektirir — kullanıcı adımı |
| Publishable key standardı | ✅ | İstemciler yalnız `sb_publishable_…` kullanır; secret key hiçbir dosyaya yazılmadı |

## Blocker'lar (dış girdi gerekir)
1. Supabase projesi (URL + anon key; `supabase db push` yetkisi) ve SMTP/Resend anahtarı.
2. Disk alanı (native build için ≥15 GB) veya EAS Build hesabı.
3. Apple / Google Play / Huawei geliştirici hesapları, EAS projectId.
4. HMS'li (GMS'siz) Huawei test cihazı.
5. Hukuk: asgari yaş, veli onay metni ve doğrulama yöntemi, saklama süreleri.

## Build durumu (2. oturum)
- `expo prebuild --platform all` başarılı: iOS ve Android native projeleri config plugin'lerle üretildi (sonra silindi; repo CNG kullanır). Android Gradle dosyalarında GMS/Firebase bağımlılığı yok. Gereksiz depolama/mikrofon izinleri `blockedPermissions` ile kapatıldı.
- ⛔ Derleme/çalıştırma yapılmadı: diskte ~3 GB boş. Seçenekler: (a) ≥15 GB yer açıp `npm --prefix apps/mobile run ios|android`, (b) `npx eas-cli login && npx eas-cli init && npx eas-cli build --profile development --platform android` (Expo hesabı gerekir; iOS cihaz build'i için Apple Developer hesabı).
- ⚪ Erişilebilirlik turu (VoiceOver/TalkBack, font ölçeği, 320 px) dev build'e bağlı; yapılmadı.
