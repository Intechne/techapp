# Test ve doğrulama

Kural: kod yazmak tamamlanma değildir. Test edilmeyen bir şey için "çalışıyor" denmez; doğru ifade **"statik olarak hazırlandı, gerçek cihaz doğrulaması bekliyor"**dur.

## Komutlar

```bash
npm run db:test                        # veritabanı + Edge: 125 test, 11 dosya (tercih 54339; doluysa boş port, 54329 asla)
npm --prefix apps/mobile run typecheck # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm --prefix apps/mobile run lint      # expo lint + mimari kuralları
npm --prefix apps/mobile test          # jest: 295 test (38 süit), --forceExit gerekmez
npm --prefix apps/mobile run verify    # typecheck + lint (0) + test (295/295)
npm --prefix apps/mobile run doctor    # expo-doctor 1.20.5 (sabit): 21/21
```

Sayılar 11 Kasım 2026'da, final review düzeltmelerinden sonra ölçüldü. HIG Doctor `--fail-on serious`: 0 critical, 1 moderate, kapı geçer. `db:test` geçici Postgres'i tercihen `54339`'da açar; doluysa işletim sisteminden boş bir port alır. `54329` (Keşif'in yerel Postgres'i) hiçbir durumda seçilmez — Keşif kapalı olsa bile (`AVOID_PORTS`, `supabase/tests/free-port.test.ts`). Sabit port gerekiyorsa `TECHAPP_TEST_PG_PORT=<port> npm run db:test`. HIG Doctor: `npx hig-doctor apps/mobile` (bkz. `docs/audits/2026-11-11-hig-doctor.md`).

## Veritabanı testleri — 125 test, Edge dahil (`supabase/tests/`; aşağıdaki dosya dökümü 2026-09 tarihli ve eksiktir)

Altyapı: Vitest + `embedded-postgres` (gerçek PostgreSQL 18, çoklu bağlantı) + `supabase-shim.sql` (`anon` / `authenticated` / `service_role` rolleri, `auth.users`, `auth.uid()`, Supabase varsayılan yetkileri). `helpers.ts` içindeki `asUser` / `asAnon` / `asService`, her sorguyu API'den gelirmiş gibi ilgili rol ve JWT claim'leriyle çalıştırır; RLS ve `execute` yetkileri gerçekten uygulanır.

`events.test.ts` (19):
- Çift dokunma / aynı anahtar / yeni anahtar → **tek kayıt**
- **Kapasite yarışı:** 3 kişilik etkinliğe 12 eşzamanlı kayıt → tam 3 `confirmed`, 9 `waitlisted`
- Bekleme listesi kapalıyken `409 event_full`
- Auth, profil eksikliği, yaş sınırı, kayıt penceresi, taslak etkinlik — hepsi sunucuda
- İptal → bekleme listesinden otomatik yükselme; iptal eden yeniden kayıt olabilir
- İstemci kayıt satırı ekleyemez/güncelleyemez; sayaçlara dokunamaz
- Uygunluk önizlemesi tüm engelleri hatasız raporlar (canlı testte bulunan hatanın regresyon testi)
- Veli: `pending_guardian` iken kart yok; katılımcı token üretemez/okuyamaz; kendi e-postası reddedilir; tek kullanımlık onay; sürüm denetimi; ret; süre dolumu; geri çekme yeri boşaltır; kural etkinlik bazındadır
- Check-in: yetkili personel bir kez; tekrar → `already_checked_in`; yabancı, başka kurumun sahibi ve katılımcının kendisi → `403`; sahte imza → `422`; iptal edilen kaydın QR'ı geçersiz; QR kişisel veri içermez
- RLS: kayıt / özel profil / rıza yalıtımı; kurumlar arası kiracı yalıtımı; anonim yalnız yayınlanmış etkinlik görür; organizatör kendi kendine yayınlayamaz/doğrulayamaz; doğum tarihi bir kez yazılır; reşit olmayan `discoverable` olamaz

`ecosystem.test.ts` (18): yetkisiz takım rolü değişikliği, kendi kendini terfi, son kaptan koruması, katılma isteği akışı, başvurularda kiracı yalıtımı, snapshot'ın yalnız `shared_fields` içermesi ve değişmezliği, durum geçişi doğrulaması + geçmiş, mükerrer başvuru, kendi deneyimini doğrulayamama ve geri çekilen doğrulamanın gizlenmesi, yer imi yalıtımı, sunucuda hesaplanan kurs ilerlemesi, `seed.sql`'in iki kez yüklenip 12/8/6/3 sayılarını vermesi.

## Mobil testler — 295 test, 38 süit (jest-expo + Testing Library; aşağıdaki liste ilk 30 testin dökümüdür)

- `lib/dates`: takvim dışı tarihler (31.02, 29.02.2007), artık yıl, gelecek tarih, biçim
- `lib/errors`: `PTxxx` eşlemesi, 401/403/404/429/5xx ayrımı, ağ hatası = `retryable`, ham backend mesajının sızmaması (bir gerçek hata bu testle bulundu)
- `lib/secureSessionStorage`: 2 KB üstü oturum, parça temizliği, yarım yazma
- `lib/localPrefs`: bozuk JSON, yanlış şema, eski sürüm, IO hatası, tam temizlik
- `features/events/labels`: doluluk / bekleme listesi / kapanış etiketleri, kitle ve ücret
- `design-system`: 30 ikon, `Button` yüklenirken etkisiz + `busy`, `Chip`/`Checkbox` erişilebilirlik durumu, `ErrorState` yalnız `retryable` hatada tekrar dene, `EventCard` kart ve yer imi ayrı hedef, durum metinleri

## Elle uçtan uca doğrulama — 2026-09-19

Ortam: Expo **web** önizlemesi (yalnız geliştirme hedefi) + yerel yığın (gerçek Postgres + PostgREST + RLS).

Onboarding (Lise + Robotik) → Keşfet gerçek veriyle, ilgi alanına göre → etkinlik detayı → "Etkinliğe katıl" → e-posta → **yanlış OTP reddedildi** → doğru OTP → profil: **31.02.2010 reddedildi**, 14.05.2010 kabul → bekleyen eylem sürdürüldü → onay kutusu olmadan gönderim engellendi → **çift tıklama tek kayıt** → `pending_guardian` → **kendi e-postası veli olarak reddedildi** → veli bağlantısı → veli sayfasında onay → `confirmed` (`guardian_approved`, `seats_taken = 1`) → sayfa yenilemede oturum korundu → QR'lı katılım kartı → HTTP üzerinden check-in: yabancı **403**, katılımcının kendisi **403**, yetkili ama etkinlik haftalar sonra **409**, etkinlik günü **200 `checked_in`**, tekrar **200 `already_checked_in`**; başka kullanıcı kaydı okuyamadı (`[]`). Deep link `/events/<id>` çalıştı.

Bu sırada bulunan ve düzeltilen hata: `event_eligibility` içinde `text[] || 'literal'` dizi birleştirmesi (`docs/KNOWN-ISSUES.md`).

## YAPILMAYANLAR

- **Gerçek cihazda hiçbir build çalıştırılmadı.** Android development build `3e02e2cf` (commit `b28ea0a`) Android 16 emülatöründe koştu: 8 adımlık yolculuk 7/8, D1–D10 sonra kodda düzeltildi, emülatörde yeniden doğrulama bekliyor (`docs/qa/2026-11-pilot-journey-android.md`). Preview/release build, iOS, Huawei, kamera ile QR ve haptic doğrulanmadı. Çevrimdışı soğuk açılışta erişim token'ı 1 saatten eski olduğunda kart (C1) yalnız jest ile kanıtlı; cihaz adımları `.superpowers/sdd/2026-11-11-techapp-v5-phase1-2/final-review.md` → "Final fixes".
- Staging (gerçek Supabase, Auth, e-posta, Edge Functions): migration 17/17, remote regresyon **38/38** (11 Kasım; 19–19d takım üyeliği gizliliği, 20–20f kısa kodla check-in); uygulama üzerinden gerçek e-postalı E2E en son 7 Ekim. Production projesi yok.
- GMS'siz Huawei cihaz testi.
- VoiceOver / TalkBack sesli denetimi (emülatörde yazı ölçeği 2.0 ve 320 dp turu yapıldı; D6/D8 düzeltildi, yeniden bakılacak).
- Otomatik E2E. Öneri: **Maestro** (Expo development build ile uyumlu, HMS cihazda da çalışır).

### Önerilen Maestro akışları

1. `guest-discovery`: onboarding → Keşfet → filtre → detay → geri (filtre ve scroll korunuyor mu)
2. `adult-registration`: OTP → profil → kayıt → `confirmed` → katılım kartı
3. `minor-guardian`: kayıt → `pending_guardian` → veli isteği → (backend'den onay) → kart
4. `waitlist-and-cancel`: dolu etkinlik → bekleme listesi → iptal
5. `offline-submit`: uçak modunda gönderim → başarı ekranı **gösterilmiyor**, tekrar denemede tek kayıt
6. `organizer-checkin`: personel girişi → QR / elle kod → tekrar okutma
7. `signout-and-delete`: çıkış sonrası önbellek boş; hesap silme

"Event Pilot hazır" denmesi için 2., 3. ve 6. akışların gerçek cihazda ve gerçek backend'de geçmesi gerekir.

## Sonradan eklenen paketler
| Dosya | Kanıtladığı |
|---|---|
| `supabase/tests/rls-audit.test.ts` | Tüm `public` tablolarda RLS açık · her `SECURITY DEFINER` fonksiyonda `search_path` sabit · anonim ziyaretçi 24 hassas tablodan satır okuyamaz · kullanıcı yalnız kendi profil/yer imini yönetir · doğrulama, check-in, kurum rolü, platform yöneticiliği ve veli rızası tabloya doğrudan yazılarak üretilemez |
| `supabase/tests/admin.test.ts` | Rolsüz kullanıcı panel verisine erişemez · kurum A, kurum B'nin kayıt/taslaklarını göremez · etkinlik yöneticisi oluşturur/düzenler/incelemeye gönderir, yayını yalnız platform yöneticisi yapar, geçersiz durum geçişi reddedilir, hepsi audit'lenir · etkinlik iptali kayıtları iptal eder ve kartları geçersizleştirir · check-in görevlisi yalnız kendi kurumunda çalışır; yanlış etkinlik / iptal / paralel çift okutma ayrışır |

CI (`.github/workflows/ci.yml`) her PR'da: veritabanı testleri · mobil typecheck + lint + jest · panel build · gizli anahtar taraması.
