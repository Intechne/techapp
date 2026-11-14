> **30 Eylül 2026 notu:** Bu belgede tarihsel/eski durumlar bulunuyor. Güncel kod denetimi ve yeniden çalıştırılan testler için [hazırlık denetimini](READINESS-2026-09-30.md) esas alın.

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
| **Keşfet** | İlgiye göre etkinlikler, öne çıkan, birleşik arama, fırsat/takım/Gelişim önizlemeleri, bildirim zili | Gerçek backend; arama etkinlik + fırsat + takım + eğitim (Faz 3b T13); Gelişim bölümü (T12). Web ekran görüntüsü + jest; cihazda denenmedi |
| **Etkinlikler** | Liste, tür filtresi, çevrim içi filtresi, detay, uygunluk, kayıt, veli, bekleme listesi, kayıt durumu, katılım kartı, iptal, katılımlarım | Uçtan uca (bireysel kayıt). Takım kaydı (Faz 3a): kodda var, `features.teamRegistration` production'da kapalı, sunucu parçası staging'de uygulanmadı, cihazda denenmedi |
| **Fırsatlar** | Staj, gönüllülük, girişimcilik, yetenek programı, proje çağrısı | Liste, detay, paylaşım önizlemeli başvuru, başvurularım, son tarihler (kodda var; cihazda denenmedi) |
| **Topluluk** | Topluluklar / Takımlar | Takım listesi/detayı, katılma isteği, takım oluşturma, çalışma alanı (kanban) ve görev düzenleyici (kodda var; cihazda denenmedi); zengin takım profili — kategori, rol dağılımı, projeler, açık roller + başvuru, ilan ve proje editörü (Faz 3b T6–T7; web ekran görüntüsü + jest, cihazda denenmedi). Takım kapağı yüklemesi **yok** (kullanıcı kararı) |
| **Profil** | Profil kartı, katılımlarım, kaydedilenler, bildirimler, giriş kontrolü (yetkiliyse), Ayarlar | Profil kartı, profil düzenleme, deneyim düzenleyici/detay + doğrulama talebi, gönüllü alanı; Kaydedilenler (T8), Bildirimler (T10), Ayarlar > Hesap / Bildirim ayarları / Gizlilik (keşfedilebilirlik 18+, CV paylaşımı) / Rıza merkezi / Yardım–Yasal bağlantıları (T11). Web ekran görüntüsü + jest, cihazda denenmedi; hukuk onaylı metin yok |

## v4 → yeni yapı eşlemesi (33 ekran)

Durum: ✅ taşındı · 🟡 kısmen · ⚪ başlamadı · 🔒 taşınmadı, pilot dışı (kodu yok; feature flag da henüz yok)

| v4 ekranı | Yeni konum | Faz | Durum |
|---|---|---|---|
| `OnboardingScreen` | `features/onboarding` — değer önerisi → eğitim aşaması → ilgi alanları → misafir keşif | 2 | ✅ |
| `AuthScreen` | `AuthEmail` + `AuthOtp` + `ProfileBootstrap` (gerçek OTP; `loggedIn: true` kaldırıldı) | 2 | ✅ |
| `GuardianConsentScreen` | `features/guardian/GuardianRequestScreen` + `apps/web` (/veli) ("Devam Et (Demo)" kaldırıldı) | 2–4 | ✅ |
| `HomeScreen` | Keşfet (`DiscoverScreen`) | 3 | ✅ |
| `SearchScreen` | Keşfet alanı → `Search` (Etkinlikler / Fırsatlar / Takımlar / Eğitimler grupları; "Tümünü gör" tek grup) | 3 / 3b T13 | ✅ jest + `db:test` (Türkçe katlama, dört collation) + web ekran görüntüsü; cihazda denenmedi. Yalnız başlık/ad aranır (tam metin yok) |
| `EventsScreen` | Etkinlikler (`EventsListScreen`, cursor pagination) | 4 | ✅ |
| `EventDetailScreen` | `EventDetailScreen` + `EventRegistration` + `RegistrationStatus` + `ParticipationCard` | 4 / 3a | ✅ bireysel · 🟡 takım kaydı (bayrak arkasında; jest + `db:test` + web ekran görüntüsü, cihazda denenmedi) |
| `TeamRegistrationScreen` / `TeamInviteScreen` | Etkinlik detayı CTA'sı (`eventCta`) → kadro seçimi + takım durumu + sürümlü kadro düzenleme + iptal (kaptan **veya** mentor); Katılımlarım > "Takım davetleri" → `TeamInvite` (üye kendi rızasını verir, 18 yaş altı → `GuardianRequest`) | 3a T5–T6 | 🟡 `features.teamRegistration` production'da kapalı; bayrak-açık build `20261113000500..000800` sonrası; web ekran görüntüsü + jest, cihazda denenmedi. Admin: `#/events/<id>/teams` (T7) |
| `NotificationsScreen` | Keşfet zili + okunmamış rozeti → `Notifications` (Profil yığını; Profil'de de giriş) | 3b T9–T10 | ✅ sunucu tetikleyicileri `db:test`; ekran jest + web ekran görüntüsü; cihazda denenmedi. Push yok (yalnız uygulama içi) |
| `TeamsScreen` | Topluluk > Takımlar | 7 | 🟡 liste (`CommunityScreen`): kodda var, cihazda denenmedi |
| `TeamDetailScreen` | Takım profili + katılma isteği | 7 | 🟡 (`TeamDetailScreen`, `request_team_join`): kodda var, cihazda denenmedi |
| `MyTeamScreen` | Topluluk > Takımım — Yapılacak / Devam ediyor / Tamamlandı | 7 | 🟡 `TeamWorkspaceScreen` + `TeamTaskEditorScreen` + `CreateTeamScreen` var |
| `CreateRecruitScreen` | Takım alanı > İlanlar → `RecruitmentPostEditor` (+ başvuranlar: `team_recruitment_applications`) | 3b T7 | ✅ jest + `db:test` + web ekran görüntüsü; cihazda denenmedi |
| `RecruitDetailScreen` | Takım profili > Açık roller + `RecruitmentApplySheet` (ayrı ekran yok; başvuru sheet'te, `apply_to_recruitment`) | 3b T7 | ✅ jest + web ekran görüntüsü; cihazda denenmedi |
| `ListingsScreen` | Fırsatlar | 6 | 🟡 (`OpportunitiesScreen`, `DeadlinesScreen`): kodda var, cihazda denenmedi |
| `ListingDetailScreen` | Fırsat detayı + paylaşım önizlemesi + başvuru + durum takibi | 6 | 🟡 (`OpportunityDetail` + `OpportunityApply` + `MyApplications`): kodda var, cihazda denenmedi |
| `CompaniesScreen` | Ayrı sekme yok; Fırsatlar içinde kurum listesi | 6 | ⚪ kurum **listesi** yok; kurum profiline etkinlik/fırsat satırındaki kurum adından gidilir (aşağıdaki satır) |
| `CompanyDetailScreen` | Kurum profili (`organizations`) → `OrganizationScreen` (Keşfet / Fırsatlar yığınlarında `Organization`) | 6 / 3b T14 | ✅ jest + web ekran görüntüsü; cihazda denenmedi. Doğrulanmamış kurum profiline yalnız kendi üyesi ulaşır; içerik bildirme ("Bildir") ile birlikte |
| `TrainingsScreen` | Keşfet > Gelişim → `CourseList` | 9 / 3b T12 | ✅ jest + web ekran görüntüsü; cihazda denenmedi |
| `TrainingDetailScreen` | `CourseDetail` + etkinlikte "Bu etkinliğe hazırlan" (`event_courses`) | 9 / 3b T12 | ✅ jest + web ekran görüntüsü; cihazda denenmedi |
| `LessonScreen` | `Lesson` + ilerleme (`complete_lesson`; yüzde sunucudan) | 9 / 3b T12 | ✅ jest + web ekran görüntüsü; cihazda denenmedi. Ders metni düz paragraf (markdown yok) |
| `ProfileScreen` | Profil | 8 | 🟡 düzenleme, deneyim, CV paylaşımı (Ayarlar > Gizlilik'te), Kaydedilenler ve Bildirimler girişleri var |
| `VerifyScreen` | Deneyim doğrulama (`attestations`); istemcide `verified: true` kaldırıldı | 8 | 🟡 `ExperienceDetailScreen` içinde talep (`request_attestation`) |
| `SettingsScreen` | Profil > Ayarlar: Hesap (e-posta salt okunur, çıkış, hesap silme), Bildirim ayarları (yalnız etkinlik hatırlatması), dokunsal geri bildirim, Gizlilik | 2 / 8 / 3b T11 | ✅ jest + web ekran görüntüsü (kısmi: raporun "açılmayanlar" listesi var); cihazda denenmedi |
| `ConsentCenterScreen` | Profil > Ayarlar > Rıza merkezi → `ConsentCenter` (`consents`: amaç, sürüm, veren Sen/Velin, tarih, geri çekilme) | 8 / 3b T11 | ✅ jest + web ekran görüntüsü; cihazda denenmedi. Genel "geri çek" eylemi yok — kayıt iptali / başvuru geri çekme ekranını açar; kart hangi etkinliğe/başvuruya ait olduğunu söylemez |
| `ChangePasswordScreen` | **Kaldırıldı** — şifresiz e-posta OTP | — | — |
| `HelpScreen` | Profil > Ayarlar > Yardım (`/destek` web sayfasını açan bağlantı) | 3b T11 | 🟡 yalnız bağlantı; uygulamada yardım ekranı yok. Cihazda denenmedi |
| `LegalScreen` | Profil > Ayarlar > Yasal: Gizlilik politikası / Kullanım koşulları / Hesap silme bağlantıları (web) | 3b T11 | 🟡 yalnız bağlantı; uygulamada hukuki metin yok, `/gizlilik` ve `/kosullar` web sayfaları "hazırlanıyor" der → **hukuk onaylı metin gerekli** (Faz 6 ön koşulu) |
| `PerksScreen` | Ayrıcalıklar | sonraki | 🔒 |
| `FundingScreen` | Fonla | sonraki | 🔒 |
| `ProjectDetailScreen` | Fonla > proje | sonraki | 🔒 |
| `CreateProjectScreen` | Fonla > proje oluştur | sonraki | 🔒 |
| `WalletScreen` | Cüzdan | sonraki | 🔒 |
| `AICoachScreen` | AI Koç / eşleşme | sonraki | 🔒 |

v4 servisleri: `services/cv.ts` (CV dışa aktarma) → Phase 8 sonrası · `services/matching.ts` → üretime taşınmadı (sabit 0.8 bağlam puanı ve boş listede sıfıra bölme; yeniden ele alınırsa açıklanabilir öneri olarak) · `services/billing.ts` (`BILLING_MODE = 'demo'`) → taşınmadı · `services/secure.ts` → `lib/secureSessionStorage.ts` olarak gerçek auth'a bağlandı · `context/AppContext.tsx` → kaldırıldı (varsayılan `captain` rolü, yerel cüzdan, yerel `verified`).

v4'te olmayan yeni ekranlar: `RegistrationStatus`, `ParticipationCard`, `MyRegistrations`, `CheckIn` (organizatör), veli web sayfası.

## Sonraki faz modülleri (taşınmadı)

Bu modüller (Fonla, Cüzdan, ücretli eğitim, TechRank, AI Koç) **v5'e taşınmadı**: kodları uygulamada yok ve şu an bir feature flag da yok (`apps/mobile/src/lib/env.ts`'te `features` nesnesi bulunmuyor). v4 kapsamı bu belgede kayıtlı; silinmiş sayılmaz. İlk pilotun ön koşulu değildir; taşındıklarında flag (varsayılan kapalı) + gerçek ödeme / ölçüm / entegrasyon altyapısıyla gelir.

- **Ödeme:** entitlement, makbuz doğrulama, restore, iade, başarısız işlem ve sunucu doğrulaması ayrı bir modül olarak tasarlanacak. Gerçek para bakiyesi uygulamadaki bir sayı değildir.
- **TechRank / eşleşme:** sonuç kaynağı, itiraz ve güncelleme sözleşmesi olmadan bilimsel yetkinlik skoru üretilmez.
- **ARENO:** entegrasyon sözleşmesi gelene kadar yalnız soyutlama; sahte üretim API'si yazılmaz.

## Pilotun açıkça dışında kalanlar

Ücretli içerik ve her türlü ödeme · Fonla / Cüzdan · TechRank, AI Koç, otomatik eşleşme skoru · ARENO entegrasyonu · serbest özel mesajlaşma · sosyal giriş (Google / Apple / Huawei) · burs, fellowship, mentorluk programları · CV dışa aktarma · HarmonyOS NEXT · web uygulaması (web yalnız geliştirme önizlemesidir).

## İlk kilometre taşı: Event Pilot

**HESAP → ETKİNLİK → KATILIM.** Kabul kriterleri (A–R) ve güncel karşılanma durumu `IMPLEMENTATION-STATUS.md` içindedir. Özet: sunucu tarafı ve uygulama akışı yerel yığında uçtan uca doğrulandı; **cihazda/emülatörde çalıştırma, production projesi, hukuk metinleri ve HMS cihaz testi tamamlanmadan pilot "tamamlandı" sayılmaz.** Güncel kapı tablosu: `IMPLEMENTATION-STATUS.md` > V5.
