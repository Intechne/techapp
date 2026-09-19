# TechApp — Teknik mimari ve yayın planı

19 Eylül 2026 · v0.1 · Mevcut v4 kod incelemesiyle güncellendi

## Karar

React Native + TypeScript ile devam etmek en verimli başlangıç. Kullanıcının verdiği paket zaten Expo 52 / React Native 0.76.5 ve React Navigation kullanıyor. Önce derlenebilir ve güncellenebilir bir başlangıç elde edilir; ardından yeni tasarım ortak bileşenlere uygulanır. Flutter’a geçiş şu an mevcut emeği yeniden üretmek anlamına gelir ve eldeki bilgiyle bir faydası gösterilmiş değil.

Expo development build ve gerekirse config plugin / yerel modül kullanımı öneriliyor. Mevcut navigasyon korunabilir; sırf yeni yapı kurmak için router değişimi gerekmiyor. Expo, özel native kodu development build içinde destekler. HMS entegrasyonu için Expo Go yeterli kabul edilmemeli. [Expo özel native kod](https://docs.expo.dev/workflow/customizing/)

SDK yükseltme hedefi bu belgede sabitlenmiyor. Mevcut paketin kilit dosyası yok; uygulama işinde güncel desteklenen Expo/RN kombinasyonu resmi uyumluluk araçlarıyla belirlenir, lockfile commit edilir ve aynı sürümler CI’da kullanılır.

## Mimari

```text
React Native mobil                  Next.js yönetim paneli
iOS / Android-GMS / Android-HMS      kurum / organizatör / Intechne
              \                       /
               Kimlik ve yetki katmanı
                         |
       PostgreSQL + RLS + yetkili sunucu işlemleri
            |            |                |
       Özel Storage   İş kuyruğu     Denetim kayıtları
                         |
               APNs / FCM / HMS adaptörleri
```

Başlangıç önerisi: Supabase Auth + PostgreSQL + Storage; kullanıcı yetkileri için RLS, hassas çok adımlı işlemler için sunucu fonksiyonları / işlemler. RLS, istemciden erişilen tablolarda satır seviyesinde kontrol uygular; servis anahtarı mobil uygulamaya konulmaz. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Mevcut bir Intechne backend’i sonradan paylaşılırsa önce ona uyum değerlendirilir. Prototipteki `apiBaseUrl` tek başına bir backend’in çalıştığını göstermez; bu incelemede o adrese istek gönderilmedi.

Kullanıcı ve sunucu durumu ayrılır: ekran filtresi / modal / yerel taslak için küçük UI state; sunucu verisi için TanStack Query benzeri cache katmanı. İlk aşamada mikroservisler yerine tek veri modeli ve anlaşılır modül sınırları yeterli. Kalıcı görev kuyruğu, yeniden deneme ve idempotency gerektiren işler için kullanılır.

## Platform farkları

| Özellik | iOS | Android / Google Play | Android tabanlı Huawei / AppGallery |
|---|---|---|---|
| Ana UI ve iş akışları | Ortak RN | Ortak RN | Ortak RN |
| Temel giriş | E-posta OTP | E-posta OTP | E-posta OTP; GMS gerektirmez |
| Sosyal giriş | Eklenirse mağaza koşullarına uygun | İsteğe bağlı Google | Huawei veya e-posta; Google zorunlu değil |
| Push | APNs | FCM | HMS Push Kit |
| Harita | İlk sürümde adres / dış harita | Aynı | Aynı; Google SDK zorunluluğu yok |
| Dosya / kamera | İhtiyaç anında izin | İhtiyaç anında izin | Gerçek HMS cihazında doğrulama |
| Gizli token | Keychain | Keystore | Keystore; cihaz testi |
| Dağıtım | TestFlight → App Store | İç test → uygun test kanalı → Play | Test → AppGallery Connect |

Expo bildirim katmanı APNs/FCM tarafında değerlendirilebilir; HMS için ayrıca sağlayıcı gerekir. Huawei Push Kit Android (HMS) desteği sağlar. Soyutlama örneği: `NotificationProvider.registerDevice()`, `unregisterDevice()`, `handleOpen()`. Cihazın desteklediği tek sağlayıcı seçilir, aynı kullanıcıya mükerrer bildirim gönderilmez. [Expo bildirimleri](https://docs.expo.dev/versions/latest/sdk/notifications/), [Huawei Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/)

AppGallery, dağıtım hedefidir. HarmonyOS NEXT ise ayrı geliştirme araçları ve yerel uygulama yaklaşımıyla ele alınmalıdır; mevcut RN Android paketinin o hedefi otomatik karşıladığı varsayılmaz. İlk kapsam Türkiye’deki Android tabanlı Huawei/HMS cihazlarıdır. NEXT hedeflenirse cihaz/pazar kararı, ArkTS/ArkUI veya desteklenen uyarlama fizibilitesi ayrı iş olur. [Huawei NEXT geliştirme](https://developer.huawei.com/consumer/en/harmonyos/develop/)

## Çekirdek veri modeli

| Varlık | Temel alan ve kural |
|---|---|
| users / profiles | Auth kullanıcısı, eğitim aşaması, yaşa ilişkin kontrollü alanlar, ilgi alanları, görünürlük |
| organizations / organization_members | Kurum türü, doğrulama, kullanıcı rolü; tenant sınırı |
| teams / team_memberships | Kurum/danışman ilişkisi, kaptan/mentor/üye rolleri; ayrı üyelik durumları |
| team_tasks / recruitment_posts | Atayan, sorumlu, durum, son tarih; takım yetki sınırı |
| events / event_sessions | Tür, zaman dilimi, kapasite, yaş koşulu, başvuru biçimi, yayın durumu |
| event_registrations | Kullanıcı veya takım, durum, idempotency anahtarı; mükerrer kayıt engeli |
| guardian_requests / consents | Amaç, metin versiyonu, doğrulama kaynağı, süre, geri çekilme, audit |
| opportunities / applications | Koşullar, son tarih, paylaşılacak alanlar, durum geçmişi |
| experiences / evidence / attestations | Katkı, özel kanıt dosyası, doğrulayan, kaynak, kapsam, revocation |
| courses / lessons / progress | İçerik, tamamlama koşulları, ilerleme; üretimde sunucu otoritesi |
| bookmarks / notifications | Kullanıcıya ait kayıt, cihaz sağlayıcısı, tercih, iletim durumu |
| reports / moderation_actions | İçerik bildirimi, inceleyen, karar, gerekçe, itiraz |
| audit_events | İşlemi yapan, hedef, zaman, işlem türü; erişimi kısıtlı, PII minimizasyonu |

Başvuru, rol, bakiye, yetkinlik doğrulaması ve veli onayı istemci boolean’ına dayanmaz. Cache kaydı yetki vermez. İçerik ve özel profil tabloları ayrılır. Kanıt dosyaları için kısa süreli yetkili bağlantılar; dosya boyutu/tür kısıtı ve tarama uygulanır.

## API ve durum sözleşmeleri

Önerilen servis sınırları; mevcut bir servis bulunursa endpoint isimleri ona uyarlanır:

```text
GET    /discovery                     ilgi / yaşa uygun içerik
GET    /events?cursor=&topic=          cursor pagination
POST   /events/:id/registrations       Idempotency-Key + uygunluk kontrolü
GET    /registrations/:id              pending_guardian / confirmed / waitlisted
POST   /registrations/:id/cancel       atomik kapasite iadesi
POST   /events/:id/check-ins           organizatör yetkisi + tekrar giriş kontrolü
POST   /opportunities/:id/applications başvuru snapshot + paylaşım kapsamı
PATCH  /applications/:id/status        kurum rolü + durum geçiş kontrolü
POST   /teams/:id/join-requests        istek / onay iş akışı
PATCH  /team-tasks/:id                 üye sadece kendi görevinde izinli geçiş
POST   /experiences                   kendi beyanı
POST   /experiences/:id/attestations   yetkili doğrulayıcı
POST   /guardian-requests             sunucu tarafından süreli token
POST   /guardian-requests/:id/confirm  ayrı doğrulama, tek kullanımlık işlem
DELETE /me                            kimlik yeniden doğrulama + silme süreci
```

Örnek hata sözleşmesi: `{ code, message, fieldErrors, retryable, requestId }`. Uygunluk / yetki / kapasite hataları birbirinden ayrılır. Kullanıcı bağlantı kopunca başarı ekranına geçirilmez. 401 oturum yenileme; 403 yetki; 409 dolu veya mükerrer; 422 alan hatası; 429 tekrar deneme politikası.

`event_registration`: draft → pending_guardian / pending_review / confirmed / waitlisted. Pending durumundan onay ancak sunucu koşulları tamamlanınca mümkündür. Her durumdan geçerli iptal kuralları tanımlanır. Katılım sonrası check-in ayrı olgudur; kayıt olmak, katılmak değildir.

## Operasyon paneli

Mobil uygulamadan önce veya onunla birlikte minimum panel gerekir: kurum ve organizatör doğrulama, etkinlik taslağı / yayın, başvuru listesi, kapasite ve giriş kontrolü, takım rolü incelemesi, deneyim doğrulama, bildirim kuyruğu, şikâyet/engelleme, hesap silme talepleri. Panelde bir yöneticinin yaptığı işlem denetim kaydına yazılır.

İçerik onaylanmadan uygulamaya çıkmaz. Katılımcı listeleri başka organizatöre açılamaz. Kurumlar bütün genç kullanıcı profillerini otomatik göremez; paylaşım kapsamı ve amaç ayrıdır.

## Eski kapsam ve fazlar

| Faz | Teslim | Çıkış ölçütü |
|---|---|---|
| 0 · Temel | v4 incelemesi, yeni tasarım, kilit dosyası, uyumlu SDK, HMS denemesi | Üç cihaz grubunda açılış/giriş/push fizibilitesi; mevcut özellik matrisi |
| 1 · Etkinlik pilotu | Auth, profil, keşif, etkinlik, bireysel/takım kayıt, gerekli veli akışı, mini panel | Gerçek organizatörle uçtan uca kayıt ve giriş; yetki testleri |
| 2 · Ekosistem | Fırsatlar, takım görevleri, üye alımı, deneyim doğrulama, ücretsiz eğitim | Durumlar cihazlar arasında tutarlı; rol/tenant ayrımı; moderasyon |
| 3 · Yayın | Mağaza varlıkları, gerçek cihaz testleri, geri dönüş planı, pilot düzeltmeleri | Kritik hata yok; mağaza başvuruları ve operasyon hazır |
| 4 · Genişleme | Ücretli eğitim, Fonla, cüzdan modeli, ayrıcalıklar, CV, gelişmiş öneriler | Her modülün gerçek servis, işletme ve mağaza koşulları tamam |

Bu bir bağımlılık sırasıdır; ekip kapasitesi ve mevcut backend bilinmeden kesin tarih/bütçe vaadi verilmez. Fonla ve ücretli eğitim silinmiş değil; ilk pilotun ön koşulu yapılmayacak ayrı iş kalemleri olarak tutulur. İlk sürüm kapsamına alınmaları istenirse ilgili kapılar yayın fazının önüne taşınır.

TechRank ve ARENO: yarışma sonucunun kaynağı, kişi/takım/rol ilişkisi, itiraz ve veri güncelleme sözleşmesi gerektirir. v4’teki yerel ağırlıklar ve sabit bağlam puanı doğrulanmış değerlendirme yöntemi sayılmaz. İlk öneriler ilgi alanı, uygunluk ve tercih üzerinden açıklanabilir biçimde çalışır; eğitim/istihdam kabul kararını otomatik vermez.

## Ödeme kapsamı

Ücretsiz pilot için ödeme SDK’sı gerekmez. Ücretli eğitim açıldığında mağaza, ülke ve dağıtım modeline uygun satın alma; sunucuda entitlement ve makbuz/olay doğrulama; restore/refund akışı gerekir. Fonla için kampanyanın hukuki/operasyonel modeli, PSP, iade ve başarısız kampanya davranışı ayrıca belirlenir. Mevcut arşivdeki “dijital = IAP / fiziksel = PSP” açıklaması bütün senaryolar için nihai politika yerine geçmez. [Apple inceleme kuralları](https://developer.apple.com/app-store/review/guidelines/)

Gerçek para bakiyesi, uygulamadaki bir sayı değildir. Muhasebe ve ödeme altyapısı tamamlanmadan mevcut demo cüzdan üretimde açılmaz.

## Yayın kapıları

1. **Hesap ve sahiplik:** Intechne kurumsal Apple, Google Play ve Huawei geliştirici hesapları; şirket bilgileri; bundle/package ID sahipliği; signing; EAS proje kimliği. Arşivdeki REPLACE_* alanları canlı değerlerle kontrollü tamamlanır.
2. **Gerçek altyapı:** staging/production ayrımı, yedek ve geri yükleme denemesi, servis sırlarının mobil pakete girmemesi, moderasyon/iletişim sorumlusu, içerik sahipleri.
3. **Ürün uygunluğu:** hesap silme, içerik bildirme/engelleme, gerekli yaş/onay uygulaması, destek, gizlilik metni ve uygulamadaki veri beyanlarının uyumu. Hesap açan uygulamalarda Apple’ın uygulama içinden silme başlatma beklentisi dikkate alınır. [Apple hesap silme](https://developer.apple.com/support/offering-account-deletion-in-your-app)
4. **Mağaza paketi:** gerçek sürüm ekran görüntüleri, ikon/splash, açıklama, yaş derecesi, destek ve gizlilik bağlantıları, veri güvenliği/privacy label, inceleme notları ve kullanılabilir test hesabı.
5. **Test dağıtımı:** TestFlight, Play test kanalı ve Huawei test cihazları. Google’ın yeni kişisel hesaplara uyguladığı 12 testçi / kesintisiz 14 gün koşulu, hesap türüne bağlıdır; şirket hesabına otomatik uygulanmaz. [Google test koşulları](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
6. **Dağıtım:** geçerli build kabul koşulları yayın tarihinde yeniden doğrulanır. AppGallery başvurusu AppGallery Connect üzerinden yürür. Kademeli yayın ve geri dönüş planı uygulanır; mağaza incelemesinin sonucu garanti edilmez. [Huawei AppGallery](https://developer.huawei.com/consumer/en/appgallery)

## Kritik doğrulama senaryoları

- Başka kullanıcıya ait başvuru, taslak, kanıt veya veli kaydını okuyamama.
- Üyenin kaptan/mentor rolüne çıkamaması; başka takıma görev atayamaması.
- Aynı son kontenjana eşzamanlı iki kayıt; kapasitenin aşılmaması.
- Tekrarlanan POST / webhook / QR; mükerrer kayıt, ödeme veya check-in oluşmaması.
- Doğrulanmamış veli onayıyla kısıtlı işlemin tamamlanamaması.
- Kaydı iptal etme, oturum yenileme, logout, silme ve yerel belleğin temizlenmesi.
- GMS bulunmayan Huawei cihazında giriş, bağlantı açma, dosya, push ve temel ekranlar.
- VoiceOver/TalkBack, büyük yazı, 320 genişlik, klavye, Android back ve ekran kesikleri.
- Zayıf bağlantı, boş liste, API hatası, cihaz saatinin yanlış olması, token süresi dolması.

Test başarısı ölçülmeden “mağazaya hazır”, “KVKK uyumlu” veya “Huawei destekli” etiketi kullanılmaz. Şu an test edilen teslim, tarayıcıda çalışan tasarım prototipidir; native paket için uygulama/test fazı henüz yapılmadı.
