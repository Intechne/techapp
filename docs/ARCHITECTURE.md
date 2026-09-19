# Mimari

## Genel görünüm

```text
apps/mobile (Expo / RN)            apps/web (/veli) (statik)      apps/admin (Phase 5, boş)
        │  supabase-js (anon key + kullanıcı JWT)      │ fetch + anon key
        └───────────────┬──────────────────────────────┘
                 Supabase: Auth (e-posta OTP) · PostgREST · Edge Functions · Storage
                        │
        PostgreSQL: RLS + SECURITY DEFINER RPC'ler + tetikleyiciler + audit_events
```

Temel ilke: **istemci durumu yetki kaynağı değildir.** Rol, yaş grubu, kapasite, kayıt durumu, doğrulama ve veli onayı yalnız sunucuda belirlenir. İstemci bu değerleri okur ve gösterir; en fazla görünürlük kararı verir (ör. "Giriş kontrolü" kartını göstermek), işlem anında sunucu yetkiyi yeniden denetler.

## Mobil katmanlar (`apps/mobile/src`)

| Dizin | Sorumluluk |
|---|---|
| `app/` | Kök bileşen, provider zinciri, font yükleme, yapılandırma kapısı |
| `navigation/` | `RootNavigator`, tipli param listeleri (`types.ts`), `linking.ts` |
| `design-system/` | Token'lar, `Text`, `TechIcon`, ortak bileşenler |
| `features/<alan>/` | Ekranlar + o alana ait `api.ts` / etiketler: `auth`, `onboarding`, `discovery`, `events`, `guardian`, `checkin`, `opportunities`, `community`, `profile` |
| `lib/` | `supabase`, `errors`, `dates`, `secureSessionStorage`, `localPrefs`, `analytics`, `queryClient`, `env`, `database.types` |

Dev bir `AppContext` ya da tek bir `api.ts` yoktur; her feature kendi sorgularını taşır.

## State ayrımı

**Server state — TanStack Query.** Etkinlikler, uygunluk, kayıtlar, katılım kartı, veli isteği, profil, `my_account_state`. Anahtarlar feature içinde tanımlıdır (`eventKeys`). Varsayılan: `staleTime` 30 sn; yalnız `retryable` hatalar en çok 2 kez yeniden denenir; **mutation'lar otomatik yeniden denenmez**.

**Local UI state.**
- `PrefsProvider` / `lib/localPrefs.ts`: misafir onboarding tercihleri (`onboarded`, `educationStage`, `interestSlugs`). AsyncStorage'da sürümlü ve zod ile doğrulanır; bozuk veri varsayılana döner. Güncellemeler fonksiyonel `setState` ile yapılır (v4'teki eski state'i geri yazma hatası yok).
- `PendingIntentProvider`: misafirin auth öncesi yapmak istediği eylem (`register_event`, `bookmark`). Bellekte tutulur, girişten sonra bir kez tüketilir.
- Ekran içi filtre, sheet, form adımı: bileşen state'i.

Oturum (`SessionProvider`) Supabase'in verdiği oturumun aynasıdır; kimlik taşır, yetki taşımaz.

## Hata sözleşmesi

`lib/errors.ts` → `AppError { code, message, status, fieldErrors?, retryable, requestId? }`.

- RPC'ler `app.fail(status, code)` ile `SQLSTATE 'PT<status>'` fırlatır; PostgREST bunu HTTP durumuna çevirir (canlı doğrulandı: 403, 409). `message` makine kodudur; Türkçe metin istemcideki `COPY` tablosundan gelir.
- Bilinmeyen kodlarda ham backend mesajı **asla** gösterilmez.
- Ağ hataları `network_unreachable` olur: `retryable`, ve hiçbir koşulda başarı ekranı gösterilmez.
- Ayrım: 401 oturum · 403 yetki · 404 yok · 409 çakışma/kapasite/durum · 422 doğrulama · 429 sınırlama · 5xx sunucu.
- Edge Functions aynı gövdeyi döner (`supabase/functions/_shared/http.ts`).

## Idempotency anahtarının yaşam döngüsü

`EventRegistrationScreen` açıldığında `expo-crypto` ile bir UUID üretilir ve `useRef` içinde tutulur. Aynı ekrandaki her gönderim (çift dokunma, bağlantı koptuktan sonra tekrar deneme) aynı anahtarı kullanır. Sunucuda `register_for_event` etkinlik satırını kilitler; aynı anahtar ya da aynı kişinin canlı kaydı varsa mevcut satırı döner. Ek güvence: `unique (user_id, idempotency_key)` ve canlı kayıt için kısmi benzersiz indeks.

## Navigasyon

- React Navigation 7 korunmuştur (router değişimi yapılmadı).
- Kök stack: `Onboarding` | `Main` + modal grup (`AuthEmail`, `AuthOtp`, `ProfileBootstrap`).
- 5 sekme, her biri kendi native stack'iyle: `DiscoverTab`, `EventsTab`, `OpportunitiesTab`, `CommunityTab`, `ProfileTab`. Sekme etiketleri her zaman görünür.
- **Paylaşılan etkinlik yolculuğu** (`EventDetail`, `EventRegistration`, `RegistrationStatus`, `GuardianRequest`, `ParticipationCard`, `MyRegistrations`) Keşfet, Etkinlikler ve Profil stack'lerine ayrı ayrı kaydedilir. Native stack liste ekranını bağlı tuttuğu için "filtre → detay → geri" filtreyi ve scroll konumunu korur.
- Deep link: `techapp://events/<id>`, `techapp://registrations/<id>` ve `https://techapp.intechne.com.tr/...` (universal link alan adı dosyaları henüz yok; `docs/RELEASE.md`).

## Tasarım sistemi

- `design-system/tokens.ts`, `design-source/tokens.json` ile aynı değerleri taşır (renk, aralık, radius, tipografi, hareket). Native ölçekte 12 pt altı yazı yoktur.
- Fontlar (`Manrope`, `DM Sans`) `@expo-google-fonts` paketlerinden **yerel asset** olarak paketlenir; yüklenemezse sistem fontuyla devam edilir.
- İkonlar: `scripts/generate-icons.mjs`, `design-source/icons/*.svg` dosyalarından `icons.generated.ts` üretir. Tek API: `<TechIcon name="event" size={24} />`. ESLint `@expo/vector-icons` importunu yasaklar.
- Durum metinleri tek yerdedir: `components/Status.tsx` (`registrationStatusView`, `guardianStatusView`, `applicationStatusView`).
- `useReducedMotion` iskelet ve sheet animasyonlarını kapatır.

## Analytics, feature flag, ortamlar

- `lib/analytics.ts`: satıcıdan bağımsız `track(event, props)`; yalnız id ve enum taşır. Gerçek sink yayın sertleştirmesinde takılır.
- `lib/env.ts` → `features`: `funding`, `wallet`, `paidLearning`, `techRank`, `aiCoach` hepsi `false`. Bu modüller pilotta çalışıyormuş gibi gösterilmez.
- Ortamlar: `local` (yerel yığın, `.env.local`), `development`, `preview`, `production` (EAS environment değişkenleri). Şablon: `apps/mobile/.env.example`.

## Bildirimler — PLANLANDI, uygulanmadı

Veritabanında `devices` tablosu ile `register_device` / `unregister_device` RPC'leri ve "kurulum başına tek etkin sağlayıcı" kısıtı hazırdır. İstemci tarafındaki `NotificationProvider` soyutlaması (APNs / FCM / HMS) henüz yazılmadı; push izni hiçbir yerde istenmiyor.
