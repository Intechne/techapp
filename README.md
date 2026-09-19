# TechApp

> **Bir fikrin varsa, bir yerin var.**
> Keşfet → Katıl → Üret → Deneyimini görünür kıl → Yeni fırsat bul

TechApp, [Intechne](https://github.com/Intechne)'nin gençler için geliştirdiği platformdur: teknoloji, girişimcilik, robotik ve sosyal etki alanlarında etkinlik ve fırsat keşfi, takım/topluluk katılımı ve kurumlarca doğrulanabilen bir deneyim profili.

Bu depo ürünün **tamamını** içerir: mobil uygulama, yönetim paneli, veli onay sayfası ve Supabase backend'i.

| | |
|---|---|
| **Durum** | Geliştirme aşamasında — yayına hazır **değil**. Güncel tablo: [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) |
| **Hedef platformlar** | iOS · Android (Google Play) · Android tabanlı Huawei (AppGallery) |
| **Dil** | Arayüz Türkçe · kod ve tanımlayıcılar İngilizce |

---

## İçindekiler
1. [Depo yapısı](#depo-yapısı)
2. [Teknoloji](#teknoloji)
3. [5 dakikada çalıştır](#5-dakikada-çalıştır)
4. [Günlük komutlar](#günlük-komutlar)
5. [Nasıl katkı verilir](#nasıl-katkı-verilir)
6. [Değişmez kurallar](#değişmez-kurallar)
7. [Dokümantasyon haritası](#dokümantasyon-haritası)

## Depo yapısı

```text
apps/
  mobile/          Mobil uygulama — Expo SDK 57 · React Native · TypeScript
  admin/           Yönetim paneli (etkinlik, kayıt, giriş kontrolü) — Vite · React · TypeScript
  guardian-web/    Veli onay sayfası — tek dosyalık statik HTML
supabase/
  migrations/      Veritabanı şeması + RLS + sunucu fonksiyonları (tek doğruluk kaynağı)
  functions/       Edge Functions (Deno): guardian-dispatch, delete-account
  seed.sql         Yalnız geliştirme için örnek veri (tümü is_demo = true)
  tests/           Veritabanı entegrasyon testleri (Vitest + gömülü PostgreSQL)
  dev/             Docker gerektirmeyen yerel backend
design-source/     "Open Circuit" tasarım paketi: tokens.json, 30 SVG ikon, ürün/UX belgeleri
docs/              Mimari, veritabanı, auth, veli onayı, yayın, test, bilinen sorunlar
.github/           CI, PR ve issue şablonları
```

Her uygulamanın kendi `README.md` dosyası vardır: [`apps/mobile`](apps/mobile/README.md) · [`apps/admin`](apps/admin/README.md) · [`supabase`](supabase/README.md)

## Teknoloji

| Katman | Seçim |
|---|---|
| Mobil | React Native 0.86 · Expo SDK 57 (development build) · React Navigation 7 · TanStack Query · React Hook Form + Zod |
| Backend | Supabase: PostgreSQL + Row Level Security · Auth (e-posta OTP) · Storage · Edge Functions |
| Panel | Vite · React 19 · Supabase JS (yetki tamamen sunucuda) |
| Test | Vitest + gömülü PostgreSQL (backend) · Jest + Testing Library (mobil) |

Temel ilke: **istemci hiçbir zaman yetki kaynağı değildir.** Rol, yaş, kontenjan, kayıt durumu, veli onayı ve doğrulama kararlarını veritabanı (RLS + `SECURITY DEFINER` fonksiyonlar) verir.

## 5 dakikada çalıştır

Gereken: **Node.js 22** (`nvm use`) ve **PostgREST** (`brew install postgrest`). Docker, Supabase hesabı veya e-posta servisi **gerekmez**.

```bash
git clone https://github.com/Intechne/techapp.git && cd techapp
npm install
npm --prefix apps/mobile install
npm --prefix apps/admin install

npm run db:dev          # 1. terminal — yerel backend (açık kalır)
npm run mobile:web      # 2. terminal — mobil uygulama, tarayıcı önizlemesi → http://localhost:8081
npm run admin           # 3. terminal — yönetim paneli → http://127.0.0.1:5180
```

`npm run db:dev` ne yapar?

- Gömülü PostgreSQL (`:54322`) + PostgREST (`:54323`) + Supabase uyumlu gateway (`:54321`) başlatır; ilk açılışta migration'ları ve örnek veriyi yükler.
- `.env.localstack` dosyalarını yazar; `npm run env:local` uygulamaları yerel backend'e, `npm run env:remote` gerçek Supabase projesine bağlar (Expo/Vite `.env.local`'ı kabuk değişkenlerinden üstün tutar, bu yüzden geçiş dosya üzerinden yapılır).
- E-posta göndermez: **giriş (OTP) kodları ve veli onay bağlantıları bu terminale yazılır.**
- Hazır ekip hesabı: `organizator@techapp.test` (örnek kurumların sahibi + platform yöneticisi).
- Sıfırlamak için: `npm run db:dev -- --reset`

> Tarayıcı önizlemesi hızlı geliştirme içindir. Asıl hedef native development build'dir: `npm --prefix apps/mobile run ios` / `run android`. Gerçek Supabase projesine bağlanma adımları: [`docs/RELEASE.md`](docs/RELEASE.md).

## Günlük komutlar

| Komut | Ne yapar |
|---|---|
| `npm run verify` | **PR öncesi çalıştır:** backend testleri + mobil typecheck/lint/test + panel typecheck |
| `npm run db:test` | Veritabanı testleri: RLS, kontenjan yarışı, idempotency, veli akışı, panel yetkileri |
| `npm run db:types:local` | Şema değiştiyse TypeScript tiplerini yerel DB'den yeniden üretir |
| `npm run db:types` | Aynısı, bağlı (linked) Supabase projesinden |
| `npm run db:push` | Remote'a uygulanacak migration planını **dry-run** olarak gösterir |
| `npm --prefix apps/mobile run icons` | `design-source/icons` → uygulama ikon haritası |
| `npm --prefix apps/mobile run doctor` | Expo bağımlılık/yapılandırma denetimi |

## Nasıl katkı verilir

Kısa hali: `main`'den dal aç → değiştir → `npm run verify` → PR aç. Ayrıntılar, dal/commit kuralları ve "yeni tablo / yeni ekran nasıl eklenir" tarifleri: [`CONTRIBUTING.md`](CONTRIBUTING.md). Güvenlik açığı bildirimi: [`SECURITY.md`](SECURITY.md).

## Değişmez kurallar

1. **Client state is not authority** — istemcide `isCaptain`, `verified`, `loggedIn` benzeri yetki bayrağı tutulmaz.
2. **No demo bypass** — sahte giriş, sahte QR, sahte ödeme, "demo için devam et" yok. Örnek veri `is_demo = true` ile işaretlidir.
3. **Yeni tablo = aynı migration'da RLS + test.** Yetki taşıyan yazmalar yalnız sunucu fonksiyonlarıyla yapılır.
4. **Gizli anahtar asla depoda veya istemcide olmaz** (`service_role`, `sb_secret_…`, SMTP/Resend anahtarı…). İstemcide yalnız *publishable* key bulunur.
5. **Dürüst durum** — test edilmeyen şeye "çalışıyor" denmez; bağlantı koptuysa başarı ekranı gösterilmez.
6. Tasarım token'ları ve `<TechIcon />` dışında renk/ölçü/ikon hardcode edilmez.

Tam liste ve gerekçeler: [`CLAUDE.md`](CLAUDE.md) (yapay zekâ asistanları ve insanlar için ortak proje talimatları).

## Dokümantasyon haritası

| Soru | Dosya |
|---|---|
| Şu an ne bitti, ne eksik? | [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) · [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md) |
| Nereye gidiyoruz, hangi sırayla? | [`TECHAPP-IMPLEMENTATION-PLAN.md`](TECHAPP-IMPLEMENTATION-PLAN.md) · [`docs/PRODUCT-SCOPE.md`](docs/PRODUCT-SCOPE.md) |
| Kod nasıl organize? | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Tablolar, RLS, sunucu fonksiyonları? | [`docs/DATABASE.md`](docs/DATABASE.md) |
| Giriş / oturum / hesap silme? | [`docs/AUTH.md`](docs/AUTH.md) |
| 18 yaş altı ve veli onayı? | [`docs/GUARDIAN-CONSENT.md`](docs/GUARDIAN-CONSENT.md) |
| Testler neyi kanıtlıyor? | [`docs/TESTING.md`](docs/TESTING.md) |
| Supabase'e bağlanma, EAS, mağazalar? | [`docs/RELEASE.md`](docs/RELEASE.md) · [`docs/HUAWEI.md`](docs/HUAWEI.md) |
| Ürün ve tasarım kararlarının kaynağı? | [`design-source/`](design-source/) |

---

© Intechne. Tüm hakları saklıdır. Bu depo Intechne'ye aittir; açık kaynak lisansı verilmemiştir.
