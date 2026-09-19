# Alan adı planı — `techapp.intechne.com.tr`

Karar (2026-09-19): TechApp'in tek genel web adresi `intechne.com.tr`'nin alt alan adıdır. Tanıtım sitesi, paylaşılabilir içerik bağlantıları, veli onay sayfası ve uygulama bağlantı (universal/app link) dosyaları **aynı origin** altında yaşar. Kodda tek kaynak: `apps/mobile/src/lib/domain.ts`.

## URL haritası
| Yol | Ne | Sunan | Durum |
|---|---|---|---|
| `/` | Tanıtım sitesi (ürün, mağaza bağlantıları, kurumlar için) | `apps/web` (henüz yok) | ⚪ |
| `/events/:id` · `/registrations/:id` · `/opportunities` · `/community` | Paylaşılabilir bağlantılar. Uygulama kuruluysa uygulamada açılır (deep link eşlemesi `navigation/linking.ts`), değilse sitede içerik özeti + "uygulamayı indir" | `apps/web` | ⚪ (uygulama tarafı hazır) |
| `/veli` | Veli onay sayfası (`apps/guardian-web/index.html`). Token URL **fragment**'ında (`/veli#<token>`), sunucu günlüklerine düşmez | statik | 🟡 sayfa hazır, yayınlanmadı |
| `/auth-callback` | E-postadaki giriş bağlantısının döndüğü yer (uygulama kurulu değilse "uygulamayı aç" yönlendirmesi) | `apps/web` | ⚪ |
| `/gizlilik` · `/kosullar` · `/destek` · `/hesap-silme` | Mağazaların zorunlu tuttuğu sayfalar. **Metinler hukuktan gelir**; hesap silme sayfası uygulama dışından silme talebini anlatır (Google Play şartı) | `apps/web` | ⚪ |
| `/.well-known/apple-app-site-association` | iOS universal links (`applinks`, Team ID + `com.intechne.techapp`) | statik, `application/json`, yönlendirmesiz | ⛔ Apple Team ID gerekli |
| `/.well-known/assetlinks.json` | Android App Links (paket adı + imza SHA-256 parmak izi; Play ve AppGallery imzaları ayrı ayrı) | statik | ⛔ imza anahtarları gerekli |

Alt alan adları (öneri): `panel.techapp.intechne.com.tr` → yönetim paneli (`apps/admin`). API için ayrı alan adı gerekmez (Supabase proje adresi kullanılır); istenirse ileride Supabase custom domain ile `api.techapp.intechne.com.tr`.

## E-posta
- **Karar:** ürün e-postaları `auth.intechne.com.tr` alt alan adından, Resend üzerinden gider. Giriş kodları: `no-reply@auth.intechne.com.tr` (Supabase Auth → özel SMTP; kimlik bilgileri yalnız Dashboard'da, repoda değil).
- OTP şablonu `supabase/templates/otp.html` (6 haneli `{{ .Token }}`), `config.toml` üzerinden `confirmation` + `magic_link` için yüklendi.
- Veli onay e-postası (`guardian-dispatch` Edge Function) aynı alan adını kullanabilir. Secrets: `MAIL_FROM="TechApp <no-reply@auth.intechne.com.tr>"`, `GUARDIAN_PAGE_URL=https://techapp.intechne.com.tr/veli`, `RESEND_API_KEY` (yalnız `supabase secrets set` ile; dosyaya/sohbete yazılmaz).

## Alan adı hazır olduğunda yapılacaklar
1. DNS: `techapp` CNAME → barındırma (Vercel / Cloudflare Pages / Netlify); `panel.techapp` CNAME → panel barındırması. HTTPS zorunlu.
2. `apps/guardian-web` derlemesinde `__SUPABASE_URL__` ve `__SUPABASE_PUBLISHABLE_KEY__` yer tutucularını doldurup `/veli` altında yayınla.
3. `supabase secrets set` ile yukarıdaki iki değeri + `RESEND_API_KEY` gir → `npm run functions:deploy`.
4. Supabase Auth: `site_url = https://techapp.intechne.com.tr`, yönlendirme listesi `config.toml`'da hazır (`npx supabase config push`).
5. `app.json`: iOS `associatedDomains: ["applinks:techapp.intechne.com.tr"]`, Android `intentFilters` (autoVerify) — `.well-known` dosyaları yayınlandıktan **sonra** eklenir; aksi halde doğrulama başarısız olur ve bağlantılar tarayıcıda kalır.
6. Mağaza kayıtlarında gizlilik/destek URL'leri bu alan adından verilir.
