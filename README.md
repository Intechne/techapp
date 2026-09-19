# TechApp Platform

Intechne'nin **TechApp** ürününün tek deposu: mobil uygulama (React Native / Expo), veli onay sayfası, Supabase backend'i (şema, RLS, RPC, Edge Functions), testler ve dokümantasyon.

> "Bir fikrin varsa, bir yerin var." — KEŞFET → KATIL → ÜRET → DENEYİMİNİ GÖRÜNÜR KIL → YENİ FIRSAT BUL

Bu depo bir demo değildir; ancak henüz yayına hazır da değildir. Güncel durum için `IMPLEMENTATION-STATUS.md` ve `docs/KNOWN-ISSUES.md` dosyalarına bak.

## Dizin yapısı

```text
apps/
  mobile/         Expo SDK 57 · React Native 0.86 · TypeScript strict · React Navigation 7
  guardian-web/   Veli onay sayfası (tek statik HTML; token URL fragment'ında)
  admin/          Yönetim paneli için yer tutucu (boş · Phase 5)
supabase/
  migrations/     Şema + RLS + RPC (tek doğruluk kaynağı)
  seed.sql        Yalnız geliştirme için sahte veri (hepsi is_demo = true)
  functions/      Edge Functions: guardian-dispatch, delete-account
  tests/          Vitest + gömülü Postgres + Supabase shim (RLS, yarış, idempotency)
  dev/            Docker gerektirmeyen yerel geliştirme yığını (start.mjs)
design-source/    Open Circuit tasarım paketi: tokens.json, 30 SVG ikon, ürün/teknik belgeler
docs/             Mimari, veritabanı, auth, veli onayı, yayın, Huawei, test, bilinen sorunlar
```

## Ön koşullar

- Node.js 22+ ve npm
- Yerel yığın için PostgREST: `brew install postgrest`
- Native derleme için Xcode / Android Studio (development build; Expo Go hedef değildir)
- Docker ve Supabase CLI yerel geliştirme için **gerekmez**; gerçek bir Supabase projesine dağıtım için Supabase CLI gerekir (`docs/DATABASE.md`).

## Hızlı başlangıç

```bash
npm install                      # kök: test araçları + yerel yığın
npm --prefix apps/mobile install # mobil uygulama

npm run db:dev                   # yerel backend'i başlatır (açık kalır)
npm --prefix apps/mobile run web # tarayıcı önizlemesi (yalnız geliştirme hedefi)
npm --prefix apps/mobile run ios # veya: run android  → development build
```

`npm run db:dev` şunları ayağa kaldırır (yalnız `127.0.0.1`):

| Parça | Port | Not |
|---|---|---|
| Gömülü PostgreSQL | 54322 | İlk açılışta shim + migrations + seed uygulanır |
| PostgREST | 54323 | `/rest/v1` arkasında |
| Gateway | 54321 | Supabase uyumlu yollar: `/rest/v1`, `/auth/v1`, `/functions/v1`, `/guardian` |

- `apps/mobile/.env.local` dosyasını otomatik yazar (URL + yerel anon key).
- E-posta gönderilmez: **OTP kodları ve veli bağlantıları bu terminale yazılır**.
- Veritabanını sıfırlamak için: `npm run db:dev -- --reset`
- Hazır organizatör hesabı: `organizator@techapp.test` (demo kurumların sahibi + platform yöneticisi). OTP yine terminalde görünür.
- Bu yığın yalnız yerel geliştirme içindir; staging/production gerçek bir Supabase projesi kullanır.

## Doğrulama komutları

```bash
npm run db:test                      # veritabanı testleri (37)
npm --prefix apps/mobile run verify  # typecheck + lint + jest (30)
npm --prefix apps/mobile run doctor  # expo-doctor
npm run verify                       # hepsi
```

## Ortam değişkenleri

`apps/mobile/.env.example` dosyasına bak. Yalnız `EXPO_PUBLIC_*` değerleri istemciye girer. **Service role key, imzalama sırrı veya parola hiçbir zaman mobil uygulamaya ya da depoya konmaz.** Edge Function sırları Supabase tarafında tutulur (`docs/GUARDIAN-CONSENT.md`).

## Kaynak materyal (değiştirilmedi)

- Tasarım paketi ve çalışan web prototipi: `~/Documents/Codex/2026-09-19/in/outputs/techapp/` (kopyası `design-source/` içinde)
- Eski React Native v4 kodu (33 ekran): `~/Documents/Codex/2026-09-19/in/work/import-v4/techapp-mobile/`
- Özgün arşiv: `~/Downloads/TechApp-Mobile-v4-FINAL.zip`

v4 kodu bu depoya kopyalanmadı; ekran kapsamı ve alan modeli `docs/PRODUCT-SCOPE.md` içindeki eşleme tablosuyla yeni mimariye taşınıyor.

## Dokümanlar

| Dosya | İçerik |
|---|---|
| `TECHAPP-IMPLEMENTATION-PLAN.md` | Hedef mimari, fazlar, riskler, kabul kriterleri |
| `IMPLEMENTATION-STATUS.md` | Modül bazında güncel durum |
| `docs/ARCHITECTURE.md` | Katmanlar, state ayrımı, hata sözleşmesi, navigasyon |
| `docs/DATABASE.md` | Tablolar, kısıtlar, RPC kataloğu, RLS, dağıtım |
| `docs/AUTH.md` | E-posta OTP, oturum saklama, hesap silme |
| `docs/GUARDIAN-CONSENT.md` | Veli onayı modeli ve token yaşam döngüsü |
| `docs/RELEASE.md` · `docs/HUAWEI.md` | Yayın kapıları, EAS profilleri, HMS durumu |
| `docs/TESTING.md` · `docs/KNOWN-ISSUES.md` | Neyin doğrulandığı, neyin doğrulanmadığı |
