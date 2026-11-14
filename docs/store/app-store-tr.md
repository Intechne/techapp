# App Store Connect — TechApp listeleme metni (TR)

> Uygulamanın gerçek işlevlerinden yazıldı; olmayan özellik iddia edilmez. Karakter sınırları App Store Connect'e göredir.
> Veri beyanları yalnız `docs/store/data-inventory.md` tablosundan türetilir (satır numaraları oradaki #). Mağazaya gönderim: **hukuk metni yayımlanmadan yapılmaz** (aşağıda "Gönderim önkoşulları").

## Ad ve alt başlık
- **Uygulama adı** (≤30): `TechApp`
- **Alt başlık** (≤30) — biri seç:
  - `Etkinlik, takım ve dijital CV` (29)
  - `Bir fikrin varsa, bir yerin var` (31 — bir karakter kısalt: “Bir fikrin varsa bir yerin var” 30)

## Tanıtım metni (Promotional text, ≤170)
Etkinliklere katıl, takımını yönet, deneyimlerini gerçek kurumlara doğrulat. Yaptıkların tek bir dijital CV’de toplansın — istediğinde tek bağlantıyla paylaş.

## Açıklama (Description, ≤4000)
**Bir fikrin varsa, bir yerin var.**

TechApp; teknoloji, robotik ve girişimle ilgilenen gençleri etkinliklerle, takımlarla ve fırsatlarla buluşturur. Katıldığın her etkinlik, aldığın her görev ve doğrulanan her deneyim, seni anlatan tek bir dijital CV’de birikir.

**Keşfet ve katıl**
- İlgi alanlarına göre etkinlikleri keşfet: hackathon, atölye, yarışma, konferans ve daha fazlası.
- Tek dokunuşla kaydol. Kontenjan dolduysa bekleme listesine gir; yerin açıldığında haberin olsun.
- Kapıda okutulan QR katılım kartınla giriş yap. Kart uygulamada oluşur; kişisel bilgin QR’a yazılmaz.
- 18 yaşından küçüksen, etkinliğin gerektirdiği durumda veli onayı güvenli bir bağlantıyla alınır.

**Fırsatları ve son tarihleri kaçırma**
- Staj, burs, yarışma, hibe ve ödül çağrıları tek yerde.
- Son başvuru tarihlerini takip et.
- Başvururken hangi bilgilerini paylaşacağını sen seçersin; seçmediğin hiçbir alan karşı tarafa gitmez.

**Takımını yönet**
- Takımını ya da topluluğunu kur, üye davet et, katılma isteklerini değerlendir.
- Görevleri panoda takip et: sorumlu, son tarih ve öncelik herkes için net.
- Rolleri (kaptan, mentor, üye) ve unvanları (ör. “Mekanik lideri”) ata.

**Doğrulanmış dijital CV’n**
- Deneyimlerini ekle. Her kaydın kaynağı açıkça görünür: “kendi beyanı” mı, yoksa bir kurumca **doğrulanmış** mı?
- Etkinlik katılımların, düzenleyenin giriş kaydından otomatik ve doğrulanmış olarak işlenir.
- Gönüllülüklerin ve takım rollerin CV’ne yansır.
- İstediğinde CV’ni tek bir bağlantıyla paylaş; dilediğinde paylaşımı kapat.

**Gönüllü ol**
- Etkinliklere gönüllü başvur; onaylandığında görevini ve gönüllülere özel bilgileri gör.

**Gizlilik önce gelir**
- Ne paylaşacağına sen karar verirsin; yetkiler ve doğrulamalar sunucuda tutulur, uygulamada taklit edilemez.
- Doğrulamayı yalnızca gerçek kurumlar yapar; bir doğrulama geri alınırsa CV’ne anında yansır.

Bir Intechne ürünü.

## Anahtar kelimeler (Keywords, ≤100, virgülle)
etkinlik,hackathon,robotik,girişim,takım,gönüllü,staj,burs,yarışma,cv,öğrenci,topluluk,fırsat,kariyer

## Bağlantılar
- Destek URL’si: `https://techapp.intechne.com.tr/destek`
- Pazarlama URL’si: `https://techapp.intechne.com.tr`
- Gizlilik Politikası URL’si: `https://techapp.intechne.com.tr/gizlilik`

## Sürüm notu (What’s New — 5.0.0)
İlk sürüm. Etkinlik keşfi ve kaydı, QR katılım kartı, fırsat ve son tarih takibi, takım ve görev yönetimi, doğrulanmış dijital CV ve gönüllülük.

## Gizlilik etiketi (App Privacy) taslağı — data-inventory.md'den
Tüm veriler Supabase'e giden, hesapla bağlı veridir. **Tracking: Hayır** (reklam/analytics SDK'sı, reklam kimliği yok; veri aracılara satılmaz/paylaşılmaz — paylaşım yok: kod).

| App Store veri türü | Toplanıyor mu | Kullanıcıya bağlı | Tracking | Amaç | Envanter # |
|---|---|---|---|---|---|
| Contact Info › Email Address | Evet | Evet | Hayır | App Functionality (giriş) | 1 (+2 özet), 18 (veli e-postası) |
| Contact Info › Name | Evet | Evet | Hayır | App Functionality | 3, 18 (veli adı) |
| User Content › Other User Content | Evet | Evet | Hayır | App Functionality | 7, 9, 12–15, 17, 20, 21, 22, 25 |
| Identifiers › User ID | Evet | Evet | Hayır | App Functionality | 27, 28 |
| Usage Data › Product Interaction | Evet (ders ilerlemesi) | Evet | Hayır | App Functionality | 23 |
| Other Data Types (doğum tarihi, eğitim aşaması, ilgi alanı, rıza/bildirim/denetim kayıtları) | Evet | Evet | Hayır | App Functionality | 4, 5, 6, 19, 24, 26 |
| Diagnostics › Crash Data | **Yalnız Sentry bağlanırsa** (bugün kapalı) | **Hayır** (kişiye bağlanmaz) | Hayır | App Functionality | 31 |

Toplanmayan: konum, rehber, fotoğraf/video, ses, sağlık, finans, tarama/arama geçmişi, reklam verisi (envanter "Kapsam dışı"). Kamera: yalnız görevli hesabında QR okutmak için; görüntü kaydedilmez/gönderilmez (#30) → "toplanmıyor".
Sentry kararına bağlı satır: Sentry production'a bağlanmadan sürüm çıkarsa "Crash Data" satırı beyandan çıkarılır; bağlanırsa eklenir. Beyanın sürüm anındaki durumu `CRASH-REPORTING.md` ile birebir tutulur.
Kullanıcı/hukuk teyidi bekleyen kategori eşlemeleri: envanter satır 2 (izin listesi özeti), 6 (ilgi alanı kategorisi), 26 (denetim kaydı).

## Yaş derecelendirmesi anketi (taslak yanıtlar)
> App Store Connect'in güncel soru listesine göre kullanıcı formda doğrular; aşağıda kodla desteklenen yanıtlar. Sürüm başına soru adları değişebilir.

| Konu | Yanıt | Dayanak |
|---|---|---|
| Şiddet, korku, cinsel içerik, çıplaklık, alkol/uyuşturucu/tütün, kumar, küfür, tıbbi içerik | Yok | Uygulamada üretilmiş/barındırılan böyle bir içerik türü yok (etkinlik/fırsat/takım listeleri) |
| Uygulama içi satın alma / reklam / loot box | Yok | Kodda ödeme/reklam bağımlılığı yok |
| Kullanıcı tarafından üretilen içerik | **Var, sınırlı:** takım/proje/ilan metinleri, profil, deneyim, katılma mesajı | Envanter 7, 9, 20 |
| Serbest mesajlaşma / sohbet | **Yok** — yalnız tek yönlü formlar (katılma mesajı ≤500, ilan başvurusu mesajı ≤1000, motivasyon ≤2000) ilgili takım/kuruma gider | `team_memberships.message`, `recruitment_applications.message`, `applications.motivation` |
| Kullanıcı içeriğini bildirme | **Var (istemci):** raporlar `reports` tablosuna yazılır. **Yönetim konsolu yok** (aşağıda önkoşul) | `features/reports/api.ts`; `docs/KNOWN-ISSUES.md` |
| Kullanıcı engelleme | Yok (kodda engelleme özelliği bulunmadı) | — |
| Konum paylaşımı | Yok | — |
| Sınırsız web erişimi | Yok (uygulama içi tarayıcı yok; bağlantılar sistem tarayıcısında) | — |
| Çocuklara yönelik kategori | **Hayır** — hedef kitle 13+ | `app.min_account_age() = 13` (`20260919000100`), sunucu `below_min_age` 422; 18 yaş altı için etkinlik başına veli onayı |
| Yaş doğrulaması | Beyan edilen doğum tarihi, sunucuda yaş hesabı; ID doğrulama yok | `complete_profile_bootstrap` |

Not: Önerilen derece 13+ / 12+ bandı sonucu **mağaza formundan çıkan değerdir**; burada tahmin edilmez. Asgari yaş 13 ve veli onayı yaş eşiği (varsayılan 18) **kullanıcı/hukuk teyidi bekliyor** (`GUARDIAN-CONSENT.md` açık soru 5). 13 altı hesap yok → Kids Category dışında.

## İnceleme notları
Ayrıntı ve karar seçenekleri: `docs/store/review-notes.md`. **Karar gelmeden inceleme hesabı yok, gönderim yok.**

## Gönderim önkoşulları (hâlâ açık — durum 14 Kasım 2026)
1. **Hukuk metinleri** (gizlilik, KVKK aydınlatma, kullanım koşulları, saklama, veli onay metni): web `/gizlilik` ve `/kosullar` yer tutucu. Hukuk metni yayımlanmadan mağaza gönderimi yapılmaz (`docs/legal/LEGAL-GATE.md`).
2. **Yönetim: rapor/moderasyon konsolu** — kullanıcı içeriği (takım, proje, ilan) raporlanabiliyor ama `apps/admin`'de raporu okuyup işlem yapan ekran yok. Mağaza inceleme beklentisi (UGC: bildirme + tepki) için gerekli; açık.
3. **Before User Created kancası production'da açık** (hesap birikimini önler; `LEGAL-GATE.md` "Auth kancasını açma").
4. **Hesap silme web yolu**: bkz. `google-play-tr.md` (Play zorunluluğu; `/hesap-silme` bugün uygulama içi akışı anlatıyor, uygulamaya erişemeyenler için çalışan talep kanalı yok).
5. Ekran görüntüleri: **bekliyor: pilot sonrası staging + `is_demo` içermeyen hesap** (aşağıda).
6. (Mağazayı bloklamaz, not) Giriş alanı kenarlık kontrastı kararı (WCAG 1.4.11).

## Ekran görüntüleri
Bekliyor: pilot sonrası staging + `is_demo` içermeyen hesap. Yalnız gerçek ekran görüntüsü; "ÖRNEK" etiketli içerik görüntüye girmez. Şimdi alınmadı.

## Hesap silme (App Store 5.1.1(v))
Uygulama içi: Profil → Ayarlar → **Hesabımı sil** (onay penceresi; `SettingsScreen.tsx` → `delete-account` Edge Function). Ayrıca Ayarlar'da "Hesap silme" satırı `/hesap-silme` web sayfasını açar. Sunucu davranışı: profil, kayıt, başvuru, rıza, veli isteği, deneyim ve kullanıcı dosyaları silinir; moderasyon geçmişi olan hesap uygulamadan silinemez, destek gerekir (`account_deletion_requires_support`); denetim kayıtları kimlik numarasıyla kalır (envanter notları).
