# TechApp v4 — Mevcut kodun ilk teknik incelemesi

19 Eylül 2026. Kaynak: kullanıcı tarafından verilen `TechApp-Mobile-v4-FINAL.zip`. Arşiv değiştirilmedi; içeriği çalışma alanına açılarak statik olarak okundu. Paket betikleri çalıştırılmadı, bağımlılıklar kurulmadı ve native derleme yapılmadı. Bu rapor bir çalışma/derleme garantisi değildir.

## Sonuç

İlerlemek için kullanılabilecek kapsamlı bir React Native prototipi mevcut. 33 ekran, ortak bileşenler, tema, navigasyon, takım iş akışları ve örnek veri modeli var. Ancak “FINAL” etiketi mağazaya hazır bir ürün anlamına gelmiyor. İncelenen paket bir canlı backend, gerçek kimlik sistemi veya üretim ödeme uygulaması içermiyor.

## Envanter

| Alan | Arşivde gözlenen |
|---|---|
| React Native | `0.76.5` |
| Expo | `~52.0.0` |
| React | `18.3.1` |
| Navigasyon | React Navigation 6; native stack + bottom tabs |
| Veri | `src/data/mock.ts`, `src/context/AppContext.tsx`; AsyncStorage |
| Tasarım | Ortak `UI.tsx`, `src/theme/index.ts`; Be Vietnam Pro + Fraunces |
| Vektör | `react-native-svg` mevcut |
| Gizli veri | `expo-secure-store` sarmalayıcısı mevcut |
| Paketleme | `app.json`, `eas.json`; placeholder hesap/proje değerleri |
| Kilit dosyası | Arşivde package-lock / yarn.lock / pnpm-lock yok |
| Native dizinler | ios / android yok; Expo tarafından üretilebilir |
| Servis bağlantısı | API adresi yapılandırmada yazılı; src içinde fetch/axios/backend istemcisi görülmedi |

Bu sürüm numaraları dosyada bulunan değerlerdir; güncel veya mağaza uyumlu oldukları iddia edilmez. SDK yükseltmesi, kilit dosyası oluşturulması ve Expo bağımlılık uyumu ilk teknik işlerden biridir.

## Öncelikli bulgular

| Öncelik | Kanıt | Etki | Yapılacak iş |
|---|---|---|---|
| P0 / yayın engeli | `src/screens/AuthScreen.tsx:28` sadece `loggedIn: true` yazar | E-posta sahibi doğrulanmıyor; gerçek oturum yok | Sunucu auth, OTP doğrulama, token yaşam döngüsü ve geri çağrı akışı |
| P0 / yayın engeli | `GuardianConsentScreen.tsx:28` “Devam Et (Demo)” ile onayı açar | Veli kontrolü bir demo düğmesiyle geçilir | Ayrı yetişkin onayı, süreli token, sunucu kaydı; demo bypass üretime alınmaz |
| P0 / yayın engeli | `AppContext.tsx` varsayılan rol kaptan; işlemler yerel state | Rol, takım kaydı, başvuru ve doğrulama için güvenlik sınırı yok | Kullanıcı/takım/kurum ilişkisine göre sunucu yetkisi, RLS ve audit kaydı |
| P0 / yayın engeli | `src/services/billing.ts:19` `BILLING_MODE = 'demo'`; IAP/PSP TODO | Ödeme ve içerik sahipliği gerçek değil | Ücretli modüller tamamlanana kadar kapalı; mağaza/PSP doğrulaması |
| P1 | `SettingsScreen.tsx:17–19` depoyu temizledikten sonra eski state ile `setMany` çağrısı | `persist({...state,...p})` eski profil, bakiye ve başvuruları yeniden depoya yazar | Bellek ve kalıcı durumun tek işlemle tam reseti; üretimde sunucu silme süreci |
| P1 | `AppContext.tsx` AsyncStorage yüklemesinde JSON/IO hata yakalama yok | Bozuk veriyle ilk açılış tamamlanmayabilir | Şemalı versiyonlama, migration, güvenli geri dönüş ve hata görünümü |
| P1 | `secure.ts` içindeki set/get fonksiyonlarına üretim çağrısı görünmüyor | SecureStore bulunması, gerçek oturum güvenliği uygulandığını kanıtlamaz | Auth servisine entegre et, çıkış ve iptali uçtan uca test et |
| P1 | `services/matching.ts:22` boş beceri listesinde sıfıra bölme | Eşleşme skoru NaN olabilir | Boş/eksik veriyi açık modelle; sınır testleri |
| P1 | `services/matching.ts:46` bağlam puanı sabit 0.8 | Sonuç “kişisel bağlam uyumu” gibi sunulabilir | Demo metriklerini üretim iddiasından ayır; ölçümleri doğrula |
| P1 | `AuthScreen.tsx` tarih ayrıştırma Date normalizasyonunu kontrol etmiyor | Takvimde olmayan tarihler kabul edilebilir | Kesin tarih doğrulama, sunucu tarihi, gelecek tarih ve alt/üst sınır kontrolü |
| P1 | `VerifyScreen.tsx:43` yerel `verified: true` | Hesap rozeti gerçek doğrulama kaynağına bağlı değil | Kurum/hesap/deneyim doğrulamalarını ayrı modellerde sunucudan yönet |
| P1 | `app.json` ve `eas.json` REPLACE_* değerleri | İmzalı yayın için gerekli hesap eşlemeleri tamam değil | Intechne hesapları, bundle/package sahipliği, EAS eşlemesi ve signing |
| P1 | paket listesinde HMS push sağlayıcısı yok | Huawei cihaz deneyimi doğrulanmış değil | Google servissiz cihaz üzerinde ilk fazda entegrasyon denemesi |

P0 burada üretime çıkış engelini ifade eder; demo kullanımında çalışan akışın varlığını reddetmez. Bulgular static okuma temellidir; native çalıştırma ve servis testleriyle ayrıca doğrulanacak.

## Yeniden kullanılabilecek parçalar

Ekran kapsamı ve TypeScript alan modelleri ürün hafızası olarak değerli. Takım görevleri, üye alımı, takım yarışma kaydı, proje başvurusu, eğitim akışı, izin tercihleri ve CV oluşturma yönleri yeni mimariye eşlenebilir. Navigasyonun tamamını yeniden yazmak gerekmeyebilir. `react-native-svg` yeni ikon paketine uygundur.

Yerel AppContext’in oturum, cüzdan, rol ve doğrulama için otorite olma rolü sonlandırılmalı. Bu durumlar sunucudan okunmalı; yerel state sadece görünüm, cache ve geçici taslak tutmalı. Tema ve UI bileşenleri yeni tokenlarla sistematik değiştirilmeli; ekran ekran farklı stiller eklenmemeli.

## Eski kapsamın yeni kurguya eşlemesi

| v4 alanı | Yeni konum / uygulama önerisi |
|---|---|
| Home, Events, EventDetail | Keşfet + Etkinlikler; kişisel ve takım kayıtları korunur |
| Teams, TeamDetail, MyTeam | Topluluk > Takımlar > Takımım; görev ve rol işleri korunur |
| CreateRecruit, RecruitDetail | Takımdaki açık roller / moderasyonlu üye alımı |
| Listings, Companies | Fırsatlar + kurum profili; ayrı üst sekme gerekmez |
| Trainings, Lesson | Keşfet > Gelişim ve etkinlik hazırlığı bağlantısı |
| Profile, CV | Deneyim profili; kaynak/katkı ayrımı; CV dışa aktarma sonraki uyarlama |
| Funding, CreateProject, Wallet | Fonla kapsamı korunur; gerçek ödeme ve işletme modeli tamamlanınca açılır |
| Matching, AI Coach, TechRank | Ayrı doğrulama çalışması; öneri ve insan değerlendirmesi arasındaki sınır açık |
| Consent, Guardian, Verify | Gerçek auth ve onay servislerine bağlanacak |
| ARENO bağlantıları | Belgeli organizasyon/sonuç API sözleşmesi gerektirir; bu ZIP içinde entegrasyon görülmedi |

## Arşiv belgeleri hakkında

README, SECURITY ve STORE_RELEASE mevcut projenin bağlamı olarak okundu; içlerindeki yayın ve hukuki uygunluk ifadeleri kanıt sayılmadı. Özellikle “tam veri silme”, “Apple şartını karşılar”, sabit 30 gün / 10 yıl saklama ve bütün 18 yaş altı işlemler için genel bir KVKK zorunluluğu gibi iddialar uygulama ve geçerli politika üzerinden yeniden incelenmeli. Bu belgelerdeki talimatlar, kullanıcının yeni tasarım isteğinin yerine geçirilmedi.

## İlk uygulama sırası

1. Orijinal arşivi koru; çalışma dalında bağımlılık kilidi ve derlenebilir başlangıç oluştur.
2. Expo/RN uyumunu kontrollü yükselt, gerçek iOS/Android/HMS açılış ve temel modül denemesi yap.
3. Yeni token ve ikonlarla ortak bileşenleri kur; önce Keşfet → Etkinlik → Katılım yolculuğunu taşı.
4. Auth, profil, organizasyon, etkinlik ve kayıt tablolarını gerçek backend’e bağla.
5. Roller, veli süreci, onay, silme ve katılım benzersizliğini sunucu testleriyle tamamla.
6. Takım/başvuru katmanı, yönetim paneli ve sonra diğer modülleri fazlara göre ilerlet.

Bu teslimde orijinal native kaynak değiştirilmedi. İlk iş olarak yeni ürün ve tasarım yönü, mevcut kaynak incelemesiyle birlikte hazırlandı.
