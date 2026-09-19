# TechApp · Web (`techapp.intechne.com.tr`)

Next.js (App Router) · TypeScript. Tanıtım sitesi + uygulamanın web'e değen bütün uçları tek origin altında.

| Yol | Ne |
|---|---|
| `/` | Tanıtım sayfası. Yaklaşan etkinlikler Supabase'den (publishable key + RLS → yalnız yayındakiler), 5 dk önbellek |
| `/events/[id]` | Paylaşım sayfası: sunucuda render, Open Graph + `schema.org/Event`; "Uygulamada aç" + mağaza rozetleri. Örnek (`is_demo`) içerik indekslenmez |
| `/veli` | Veli onay sayfası. Token URL **fragment**'ında (`/veli#<token>`); `no-referrer`, `no-store`, `noindex`. Karar veritabanı fonksiyonlarında |
| `/auth-callback` | E-postadaki giriş bağlantısı tarayıcıda açılırsa uygulamaya devreder; token'ları adres çubuğundan siler |
| `/gizlilik` · `/kosullar` | **Yer tutucu**: metinler hukuktan gelecek, uydurulmadı (`noindex`) |
| `/destek` · `/hesap-silme` | Mağazaların istediği sayfalar; destek kanalı açıklanınca güncellenecek |

```bash
npm install
npm run dev        # http://localhost:3100  (.env.local: kökte `npm run env:local` ya da `env:remote`)
npm run build
```

## Vercel
1. Vercel → **Add New → Project** → `Intechne/techapp` deposunu içe aktar.
2. **Root Directory: `apps/web`** (Framework: Next.js otomatik algılanır).
3. Environment Variables (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (yalnız *publishable* key). Mağaza bağlantıları hazır olunca `NEXT_PUBLIC_APP_STORE_URL` vb.
4. **Domains** → `techapp.intechne.com.tr` ekle; DNS'te `techapp` için Vercel'in verdiği CNAME kaydını oluştur.
5. Yayından sonra: `supabase secrets set GUARDIAN_PAGE_URL=https://techapp.intechne.com.tr/veli`.

Mağaza rozetleri bağlantı yokken "Yakında" gösterir; ölü bağlantı basılmaz. `.well-known` (universal/app link) dosyaları Apple Team ID ve imza parmak izleri gelince `public/.well-known/` altına eklenecek (`docs/DOMAIN.md`).
