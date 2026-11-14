# Google Play Console — TechApp taslağı (TR)

> Koddan türetildi; olmayan özellik iddia edilmez. Veri beyanı kaynağı: `docs/store/data-inventory.md` (satır # oradaki). Paket: `com.intechne.techapp` (`apps/mobile/app.json`), sürüm 5.0.0.
> **Hukuk metni yayımlanmadan Play gönderimi yapılmaz.** Bu belge hukuki metin içermez.

## Mağaza girişi (listing)
- **Uygulama adı** (≤30): `TechApp`
- **Kısa açıklama** (≤80): `Etkinlik, takım ve dijital CV — yaptıkların tek yerde, doğrulanmış.` (68)
- **Tam açıklama** (≤4000): `docs/store/app-store-tr.md` "Açıklama" metni aynen kullanılır (aynı işlevler; Play'de ek iddia yok). Karakter sınırı ve biçim Play Console'da doğrulanır.
- Kategori / etiketler: Eğitim veya Sosyal — **kullanıcı kararı bekleniyor**.
- İletişim e-postası: **kullanıcı kararı bekleniyor** (destek kanalı `/destek` sayfasında henüz duyurulmadı).
- Web sitesi: `https://techapp.intechne.com.tr` · Gizlilik politikası URL: `https://techapp.intechne.com.tr/gizlilik` (**yer tutucu sayfa; hukuk metni bekleniyor**).
- Grafik varlıklar ve ekran görüntüleri: **bekliyor: pilot sonrası staging + `is_demo` içermeyen hesap.** Şimdi alınmadı; "ÖRNEK" etiketli içerik görüntüye girmez.

## Hesap silme (Play zorunluluğu)
- **Uygulama içi yol:** Profil → Ayarlar → **Hesabımı sil** (onay penceresi) → `delete-account` Edge Function (`SettingsScreen.tsx`, `authService.ts`, `supabase/functions/delete-account/`).
- **Hesap silme URL'si (Play Console alanı):** `https://techapp.intechne.com.tr/hesap-silme` — sayfa kodda var (`apps/web/app/hesap-silme/page.tsx`). İçeriği: uygulamadan silme adımları, silinenlerin listesi ("profilin, ilgi alanların, etkinlik kayıtların, başvuruların, yüklediğin dosyalar ve verdiğin izin kayıtları sunucudan silinir"), "Saklanan kayıtlar" bölümü hukuk metni bekliyor.
- **Eksik (Play'in web yolu şartı):** Sayfa uygulamaya erişemeyenler için silme talebi kanalını "açıldığında duyurulacak" diye erteliyor; **çalışan bir talep yolu bugün yok** (`/destek` sayfasında da iletişim kanalı yok). Play, uygulama dışı bir silme talebi yolunu ister → destek e-postası/formu kararı **kullanıcı kararı bekleniyor**; kanal açılınca sayfa güncellenir. Bugünkü sayfa metni değiştirilmedi.
- Sayfadaki adım "Profil sekmesi → Hesabımı sil" Ayarlar adımını atlıyor (gerçek yol: Profil → Ayarlar → Hesabımı sil) — küçük metin düzeltmesi, web sürümüyle birlikte (bu görevde kod/metin değiştirilmedi).
- Sunucu davranışı: tüm hesap verisi cascade ile silinir; `evidence`/`avatars` dosyaları silinir; moderasyon geçmişi olan hesap uygulamadan silinemez (`account_deletion_requires_support`); denetim kayıtları kimlik numarasıyla kalır; kullanıcının oluşturduğu takım/ilan/proje satırları `created_by` boşalarak kalır (envanter satır 20, 26).

## Hedef kitle ve içerik
- **Hedef yaş grupları:** 13–15, 16–17, 18+. **13 altı seçilmez** (asgari hesap yaşı 13: `app.min_account_age()`, sunucu `below_min_age`; `ProfileBootstrapScreen`). Çocuklara yönelik değil → **Families programı dışı**.
- Kullanıcı/hukuk teyidi bekliyor: asgari yaş 13 kararı, 13–17 için veli onayı eşiği (`GUARDIAN-CONSENT.md` açık sorular 3 ve 5), Play "Çocuklar için tasarlandı mı" sorusuna "Hayır" yanıtı.
- Kullanıcı tarafından oluşturulan içerik: **Var** (takım/proje/ilan metinleri, profil, deneyim). Serbest mesajlaşma/sohbet **yok**. İçerik bildirme: istemci var (`reports`), **yönetim konsolu yok** → UGC politikası beklentisi için açık önkoşul.
- Reklam: yok. Uygulama içi satın alma: yok. Konum: yok.
- İçerik derecelendirme anketi yanıtları: `app-store-tr.md` "Yaş derecelendirmesi anketi" tablosu (aynı olgular); IARC formu kullanıcı tarafından doldurulur.

## Veri güvenliği (Data safety) formu taslağı
Genel: Veri toplanıyor — **evet**. Üçüncü taraflarla paylaşım — **hayır** (kodda reklam/analitik/ortak SDK'sı yok; altyapı sağlayıcıları — Supabase, Resend, ileride Sentry — "hizmet sağlayıcı" sayılır, Play tanımında paylaşım değil; **kullanıcı/hukuk teyidi**). Aktarımda şifreleme — evet (Supabase HTTPS; üretim kurulumu doğrulaması Task 2/RELEASE'e bağlı, **teyit bekliyor**). Kullanıcı veri silme talep edebilir — evet (yukarıdaki yollar). Reklam kimliği — kullanılmıyor.

| Play veri türü | Toplanıyor | Paylaşılıyor | Zorunlu/İsteğe bağlı | Amaç | Envanter # |
|---|---|---|---|---|---|
| Personal info › Email address | Evet | Hayır | Zorunlu (hesap) | Hesap yönetimi, App functionality | 1 (+2), 18 (veli e-postası) |
| Personal info › Name | Evet | Hayır | Zorunlu | App functionality | 3, 18 |
| Personal info › User IDs | Evet | Hayır | Zorunlu | App functionality | 27, 28 |
| Personal info › Other info (doğum tarihi, eğitim aşaması, ilgi alanları, profil başlığı/hakkında/şehir) | Evet | Hayır | Doğum tarihi/eğitim aşaması zorunlu; kalanı isteğe bağlı | App functionality | 4–7 |
| App activity › Other user-generated content (deneyim, takım/proje/ilan, başvuru, gönüllülük, rapor, CV bağlantısı) | Evet | Hayır | İsteğe bağlı | App functionality | 9, 12–14, 20, 21, 25 |
| App activity › App interactions (ders ilerlemesi) | Evet | Hayır | İsteğe bağlı | App functionality | 23 |
| App activity › Other actions (etkinlik kaydı, check-in, rıza, bildirim, kaydedilenler, denetim kaydı) | Evet | Hayır | İsteğe bağlı / işlemin parçası | App functionality, güvenlik | 15–17, 19, 22, 24, 26 |
| App info and performance › Crash logs / Diagnostics | **Yalnız Sentry bağlanırsa** | Hayır (hizmet sağlayıcı) | Hayır (kapatılamaz) | Analytics/ayıklama | 31 |
| Device or other IDs | **Yalnız Sentry bağlanırsa** (Android rastgele kurulum kimliği; kişiye bağlanmaz) — kullanıcı teyidi | Hayır | — | Ayıklama | 31 |
| Konum, Kişiler, Fotoğraf/video, Ses, Dosyalar, Sağlık, Finans, Mesajlar, Arama/tarama geçmişi | **Toplanmıyor** | — | — | — | Envanter "Kapsam dışı"; #10–11 mobilde yükleme yok; #30 kamera görüntüsü saklanmaz |

Sentry notu: bugün kapalı; production'a bağlanmadan form "Crash logs: toplanmıyor" ile gider, bağlanırsa satır eklenir. Saklama süresi **kullanıcı kararı bekleniyor** (öneri 30 gün, AB; `CRASH-REPORTING.md` açık madde 1).

## İzinler (Play "Uygulama izinleri" incelemesi)
| İzin | Nereden | Neden | Not |
|---|---|---|---|
| `android.permission.CAMERA` | `app.json` `android.permissions` + `expo-camera` | Etkinlik girişinde (yalnız görevli) QR okutma | Görüntü saklanmaz/gönderilmez. İzin ilk kullanımda istenir |
| `android.permission.INTERNET` | Manifest birleşmesi (React Native çekirdeği/Sentry) | Sunucuya bağlantı | Kişisel veri değil |
| `android.permission.ACCESS_NETWORK_STATE` | RNSentry manifest birleşmesi (`CRASH-REPORTING.md`) | Ağ durumu | DSN olmasa da APK/AAB'ye girer; yalnız ağ durumunu okur, kişisel veri değil |
| Bloklu (eklenmez) | `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | — | `app.json` `blockedPermissions` |
Birleştirilmiş manifest gerçek EAS build çıktısıyla **doğrulanmadı** (bu makinede derleme yok); Task 6'da AAB'den `aapt dump permissions` ile teyit edilir. Push (`POST_NOTIFICATIONS`), konum, rehber izni yok.

## Önkoşullar (açık)
Hukuk metinleri (gizlilik, KVKK, koşullar, saklama, veli onay) · yönetim rapor/moderasyon konsolu · Before User Created kancası production'da açık · hesap silme için uygulama dışı talep kanalı · destek iletişim e-postası · ekran görüntüleri (pilot sonrası) · kategori kararı · test hesabı: `docs/store/review-notes.md` (karar bekleniyor). Giriş alanı kenarlık kontrastı kararı mağazayı bloklamaz, not.
