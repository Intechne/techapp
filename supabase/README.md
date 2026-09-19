# TechApp · Backend (Supabase)

| Yol | İçerik |
|---|---|
| `migrations/` | Şema, RLS politikaları, sunucu fonksiyonları. **Tek doğruluk kaynağı.** Uygulanmış dosya değiştirilmez; yeni dosya eklenir |
| `functions/` | Edge Functions: `guardian-dispatch` (veli e-postası), `delete-account` |
| `seed.sql` | Yalnız geliştirme: 12 etkinlik, 8 fırsat, 6 takım/topluluk, 3 eğitim — hepsi `is_demo = true`, tekrar çalıştırılabilir |
| `tests/` | Vitest + gömülü PostgreSQL. `supabase-shim.sql`, Supabase'in `auth` şeması ve rollerinin test karşılığıdır |
| `dev/` | Docker'sız yerel backend (`start.mjs`) ve tip üretimi (`gen-types.mjs`) |
| `config.toml` | Supabase CLI proje ayarları (OTP uzunluğu, function JWT doğrulaması) |

```bash
npm run db:test            # tüm veritabanı testleri
npm run db:dev             # yerel backend  (-- --reset ile sıfırla)
npm run db:types:local     # TypeScript tiplerini yeniden üret
npm run db:push            # remote için dry-run planı
```

Migration sırası: `0100 foundation` → `0200 events` → `0300 reference_data` → `0400 ecosystem` → `0500 storage` → `0600 admin_operations`.
Tablolar, fonksiyon kataloğu ve RLS özeti: [`docs/DATABASE.md`](../docs/DATABASE.md). Remote projeye ilk bağlanma: [`docs/RELEASE.md`](../docs/RELEASE.md).

> Remote veritabanında **asla** `supabase db reset` çalıştırma.
