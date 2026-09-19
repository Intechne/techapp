# Ürün kapsamı

## Tanım

**TechApp**; gençlerin teknoloji, girişimcilik, robotik, mühendislik, sosyal etki, kişisel gelişim, takım çalışması ve proje üretimi alanlarında fırsat keşfettiği, etkinliklere katıldığı, takım ve topluluklara dahil olduğu, ürettiklerini kaydettiği ve gerektiğinde kurumlarca doğrulanabilen bir gelişim profili oluşturduğu Intechne platformudur.

Ana vaat: **"Bir fikrin varsa, bir yerin var."**
Döngü: **KEŞFET → KATIL → ÜRET → DENEYİMİNİ GÖRÜNÜR KIL → YENİ FIRSAT BUL**

Robotik güçlü bir alandır; ürün yalnız robotik yarışmacıları için tasarlanmaz.

**Kullanıcılar:** lise ve üniversite öğrencileri, genç mezunlar, robotik yarışmacıları, teknoloji takımları, kaptanlar, mentorlar, topluluk yöneticileri, organizatörler, kurumlar, Intechne yöneticileri ve gerektiğinde veli / yasal temsilci.

**Değişmez kurallar**
- Eğitim seviyesi yaş değildir; yaşa bağlı kararlar gerçek doğum tarihinden, sunucuda verilir.
- İstemci durumu yetki değildir. Üretimde demo geçişi yoktur.
- "Kendi beyanı" ile "Doğrulanmış deneyim" her zaman ayrı görünür; etkinliğe katılım teknik beceri kanıtı sayılmaz.
- Demo skorlar (TechRank, eşleşme yüzdesi) üretim gerçeği gibi sunulmaz.
- Dil Türkçe; ton genç, açık, abartısız. İşlem tamamlanmadıysa "alındı" denmez.

## Beş sekme

| Sekme | İçerik | Şu anki durum |
|---|---|---|
| **Keşfet** | İlgiye göre etkinlikler, öne çıkan, arama, fırsat ve takım önizlemeleri | Gerçek backend; arama yalnız etkinlik |
| **Etkinlikler** | Liste, tür filtresi, çevrim içi filtresi, detay, uygunluk, kayıt, veli, bekleme listesi, kayıt durumu, katılım kartı, iptal, katılımlarım | Uçtan uca (bireysel kayıt); takım kaydı yok |
| **Fırsatlar** | Staj, gönüllülük, girişimcilik, yetenek programı, proje çağrısı | Salt okunur liste; başvuru backend'i hazır |
| **Topluluk** | Topluluklar / Takımlar | Salt okunur liste; üyelik/görev backend'i hazır |
| **Profil** | Profil kartı, katılımlarım, giriş kontrolü (yetkiliyse), çıkış, hesap silme | Temel; deneyim/proje/doğrulama yok |

## v4 → yeni yapı eşlemesi (33 ekran)

Durum: ✅ taşındı · 🟡 kısmen · ⚪ başlamadı · 🔒 feature flag arkasında, pilot dışı

| v4 ekranı | Yeni konum | Faz | Durum |
|---|---|---|---|
| `OnboardingScreen` | `features/onboarding` — değer önerisi → eğitim aşaması → ilgi alanları → misafir keşif | 2 | ✅ |
| `AuthScreen` | `AuthEmail` + `AuthOtp` + `ProfileBootstrap` (gerçek OTP; `loggedIn: true` kaldırıldı) | 2 | ✅ |
| `GuardianConsentScreen` | `features/guardian/GuardianRequestScreen` + `apps/guardian-web` ("Devam Et (Demo)" kaldırıldı) | 2–4 | ✅ |
| `HomeScreen` | Keşfet (`DiscoverScreen`) | 3 | ✅ |
| `SearchScreen` | Keşfet içi arama | 3 | 🟡 yalnız etkinlik |
| `EventsScreen` | Etkinlikler (`EventsListScreen`, cursor pagination) | 4 | ✅ |
| `EventDetailScreen` | `EventDetailScreen` + `EventRegistration` + `RegistrationStatus` + `ParticipationCard` | 4 | ✅ bireysel · ⚪ takım kaydı |
| `NotificationsScreen` | Keşfet > Bildirimler (`notifications` tablosu hazır) | 10 | ⚪ |
| `TeamsScreen` | Topluluk > Takımlar | 7 | 🟡 salt okunur |
| `TeamDetailScreen` | Takım profili + katılma isteği | 7 | ⚪ (RPC hazır) |
| `MyTeamScreen` | Topluluk > Takımım — Yapılacak / Devam ediyor / Tamamlandı | 7 | ⚪ (RPC hazır) |
| `CreateRecruitScreen` | Takımım > açık rol oluştur | 7 | ⚪ (tablo hazır) |
| `RecruitDetailScreen` | Takım profili > açık roller | 7 | ⚪ (RPC hazır) |
| `ListingsScreen` | Fırsatlar | 6 | 🟡 salt okunur |
| `ListingDetailScreen` | Fırsat detayı + paylaşım önizlemesi + başvuru + durum takibi | 6 | ⚪ (RPC hazır) |
| `CompaniesScreen` | Ayrı sekme yok; Fırsatlar içinde kurum listesi | 6 | ⚪ |
| `CompanyDetailScreen` | Kurum profili (`organizations`) | 6 | ⚪ |
| `TrainingsScreen` | Keşfet > Gelişim | 9 | ⚪ (tablolar + seed hazır) |
| `TrainingDetailScreen` | Eğitim detayı + "Bu etkinliğe hazırlan" (`event_courses`) | 9 | ⚪ |
| `LessonScreen` | Ders + ilerleme (`complete_lesson`) | 9 | ⚪ |
| `ProfileScreen` | Profil | 8 | 🟡 temel |
| `VerifyScreen` | Deneyim doğrulama (`attestations`); istemcide `verified: true` kaldırıldı | 8 | ⚪ (RPC hazır) |
| `SettingsScreen` | Profil > Hesap (çıkış, sunucu tarafı hesap silme; eski reset yarışı giderildi) | 2 / 8 | 🟡 |
| `ConsentCenterScreen` | Profil > Gizlilik ve izinler (`consents`: sürümlü, geri çekilebilir) | 8 | ⚪ (tablo hazır) |
| `ChangePasswordScreen` | **Kaldırıldı** — şifresiz e-posta OTP | — | — |
| `HelpScreen` | Profil > Yardım | 10 | ⚪ |
| `LegalScreen` | Profil > Yasal metinler (metinler hukuktan gelecek; uydurulmadı) | 10 | ⚪ |
| `PerksScreen` | Ayrıcalıklar | sonraki | 🔒 |
| `FundingScreen` | Fonla | sonraki | 🔒 `features.funding` |
| `ProjectDetailScreen` | Fonla > proje | sonraki | 🔒 |
| `CreateProjectScreen` | Fonla > proje oluştur | sonraki | 🔒 |
| `WalletScreen` | Cüzdan | sonraki | 🔒 `features.wallet` |
| `AICoachScreen` | AI Koç / eşleşme | sonraki | 🔒 `features.aiCoach` |

v4 servisleri: `services/cv.ts` (CV dışa aktarma) → Phase 8 sonrası · `services/matching.ts` → üretime taşınmadı (sabit 0.8 bağlam puanı ve boş listede sıfıra bölme; yeniden ele alınırsa açıklanabilir öneri olarak) · `services/billing.ts` (`BILLING_MODE = 'demo'`) → taşınmadı · `services/secure.ts` → `lib/secureSessionStorage.ts` olarak gerçek auth'a bağlandı · `context/AppContext.tsx` → kaldırıldı (varsayılan `captain` rolü, yerel cüzdan, yerel `verified`).

v4'te olmayan yeni ekranlar: `RegistrationStatus`, `ParticipationCard`, `MyRegistrations`, `CheckIn` (organizatör), veli web sayfası.

## Sonraki faz modülleri (feature flag)

`apps/mobile/src/lib/env.ts` → `features`: `funding`, `wallet`, `paidLearning`, `techRank`, `aiCoach` — hepsi `false`. Bu modüller silinmedi; ilk pilotun ön koşulu değildir ve gerçek ödeme / ölçüm / entegrasyon altyapısı olmadan açılmaz.

- **Ödeme:** entitlement, makbuz doğrulama, restore, iade, başarısız işlem ve sunucu doğrulaması ayrı bir modül olarak tasarlanacak. Gerçek para bakiyesi uygulamadaki bir sayı değildir.
- **TechRank / eşleşme:** sonuç kaynağı, itiraz ve güncelleme sözleşmesi olmadan bilimsel yetkinlik skoru üretilmez.
- **ARENO:** entegrasyon sözleşmesi gelene kadar yalnız soyutlama; sahte üretim API'si yazılmaz.

## Pilotun açıkça dışında kalanlar

Ücretli içerik ve her türlü ödeme · Fonla / Cüzdan · TechRank, AI Koç, otomatik eşleşme skoru · ARENO entegrasyonu · serbest özel mesajlaşma · sosyal giriş (Google / Apple / Huawei) · burs, fellowship, mentorluk programları · CV dışa aktarma · HarmonyOS NEXT · web uygulaması (web yalnız geliştirme önizlemesidir).

## İlk kilometre taşı: Event Pilot

**HESAP → ETKİNLİK → KATILIM.** Kabul kriterleri (A–R) ve güncel karşılanma durumu `IMPLEMENTATION-STATUS.md` içindedir. Özet: sunucu tarafı ve uygulama akışı yerel yığında uçtan uca doğrulandı; **native derleme, gerçek Supabase projesi, gerçek e-posta ve HMS cihaz testi tamamlanmadan pilot "tamamlandı" sayılmaz.**
