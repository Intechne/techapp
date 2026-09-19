# Test ve doğrulama

Kural: kod yazmak tamamlanma değildir. Test edilmeyen bir şey için "çalışıyor" denmez; doğru ifade **"statik olarak hazırlandı, gerçek cihaz doğrulaması bekliyor"**dur.

## Komutlar

```bash
npm run db:test                        # veritabanı: 37 test
npm --prefix apps/mobile run typecheck # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm --prefix apps/mobile run lint      # expo lint + mimari kuralları
npm --prefix apps/mobile test          # jest: 30 test
npm --prefix apps/mobile run verify    # typecheck + lint + test
npm --prefix apps/mobile run doctor    # expo-doctor: 21/21
```

## Veritabanı testleri — 37 test (`supabase/tests/`)

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

## Mobil testler — 30 test (jest-expo + Testing Library)

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

- **iOS / Android development build çalıştırılmadı** (makinede ~4 GB boş alan vardı). Native SecureStore, kamera, klavye, safe area, geri jesti doğrulanmadı.
- Gerçek Supabase projesi, gerçek Supabase Auth, gerçek e-posta teslimi.
- Edge Functions (`guardian-dispatch`, `delete-account`) ve storage migration'ı hiç çalıştırılmadı.
- GMS'siz Huawei cihaz testi.
- VoiceOver / TalkBack denetimi, Dynamic Type en büyük ölçek, 320 pt genişlik.
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
