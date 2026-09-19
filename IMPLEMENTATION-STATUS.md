# TechApp — Implementation Status

Son güncelleme: 2026-09-19 (3. oturum) · Dal: `feat/release-readiness` · ✅ Completed · 🟡 Partial · ⛔ Blocked · ⚪ Not started

"Doğrulandı" = bu makinede otomatik test ve/veya çalışan uygulamada gözle kontrol edildi. Native cihaz doğrulaması ayrıca belirtilir.

## Fazlar
| Faz | Durum | Not |
|---|---|---|
| 0 · Audit & bootstrap | ✅ | v4 P0/P1 bulguları kod üzerinde yeniden doğrulandı; Expo SDK 57 iskeleti, lockfile, strict TS, ESLint, Jest, env yapısı, expo-doctor 21/21 |
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
1. `supabase/migrations/20260920000100_*` ve `20260920000200_*` **remote'a uygulanmadı**. `npm run db:push` (dry-run planını oku) → `npm run db:types` → `npm --prefix apps/mobile run e2e:remote`. Uygulanana kadar canlıda CV paylaşımı, unvan ve gönüllü alanı çalışmaz (mobil şema eski sunucuyu da okur).
2. Vercel: `apps/web` yeniden deploy (yeni `/cv/[token]` rotası), `apps/admin` ayrı proje olarak deploy (`VITE_SUPABASE_*`).
3. Native build hâlâ ⛔ (EAS Build ya da ≥15 GB disk). Yeni ikonlar `expo prebuild` ile alınır; cihazda bakılmadı.
4. Hukuk: reşit olmayanların CV bağlantısı paylaşımı ve gönüllülüğü (ikisi de şimdilik 18+).
5. Bilinen küçükler: web'de `/profile` derin bağlantısı oturum açılışından sonra Keşfet'e düşüyor; admin paket boyutu uyarısı (>500 kB, kod bölme yapılmadı).

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

## Remote Supabase (development) — proje `techapp` · ref `pacvhcnawtnkauvguoaw` · eu-central-1
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
