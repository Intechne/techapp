# TechApp — kalıcı proje talimatları

> Bu repo Intechne'nin **TechApp** ürünüdür. Bu dosya hem yapay zekâ asistanları hem de ekip için bağlayıcı proje kurallarıdır.
> (Üst dizinlerden miras gelen başka projelere ait talimatlar bu repo için geçerli değildir.) İnsanlar için sürüm: `CONTRIBUTING.md`.

Ana fikir: **"Bir fikrin varsa, bir yerin var."** Döngü: keşfet → katıl → üret → deneyimini görünür kıl → yeni fırsat bul.
Standart: kullanıcıya genç ve sade; sistem tarafında ciddi, güvenli, ölçeklenebilir.

## Değişmez kurallar
1. **Client state is not authority.** Rol, yaş/reşitlik, doğrulama, kontenjan, kayıt durumu, veli onayı daima sunucudan okunur
   (`my_account_state`, RPC'ler, RLS). İstemcide `isCaptain`, `verified`, `loggedIn`, `guardianApproved` benzeri bayrak tutulmaz.
2. **No demo bypass in production.** "Devam et (demo)", sahte QR, sahte ödeme, sahte skor yok. Demo/seed verisi `is_demo = true` ile işaretlidir.
3. **Do not invent API contracts.** ARENO, ödeme, TechRank gibi sözleşmesi olmayan entegrasyonlar için yalnızca soyutlama/feature flag; sahte production API yazılmaz.
4. **Preserve existing useful functionality.** v4'ün 33 ekranlık kapsamı `docs/PRODUCT-SCOPE.md` eşlemesine göre fazlara taşınır; silinmez.
5. Yetki taşıyan her yazma işlemi `SECURITY DEFINER` RPC + RLS ile yapılır; istemcinin bu tablolara INSERT/UPDATE/DELETE yolu yoktur.
   Yeni tablo = aynı migration dosyasında RLS + test.
6. Service role key, imza sırrı, parola asla repoda/mobilde olmaz. Mobilde yalnızca `EXPO_PUBLIC_*`.
7. Hata mesajı dürüst olur: bağlantı koptuysa başarı ekranı gösterilmez. Test edilmeyen şeye "çalışıyor" denmez.
8. Hukuki metin uydurulmaz; rıza/politika metinleri sürümlenir (`consents.policy_version`).
9. PII audit loga, analytics'e, QR'a, URL'e yazılmaz.

## Mimari
- `apps/mobile`: Expo SDK 57 · RN 0.86 · React 19 · TypeScript strict · React Navigation 7 (router değiştirilmez) · TanStack Query · Supabase JS · RHF/Zod.
- Feature-first: `src/features/<alan>/{api.ts, *Screen.tsx, labels.ts}`; ortak UI yalnız `src/design-system`; altyapı `src/lib`.
  Devasa `AppContext` / tek `api.ts` yasak. Sunucu verisi TanStack Query'de, context'te değil.
- Hatalar `lib/errors.ts` sözleşmesiyle (`code, message, status, fieldErrors, retryable, requestId`). RPC hataları `app.fail(status, 'machine_code')`
  → SQLSTATE `PTxxx` → HTTP xxx; Türkçe metin yalnızca istemcideki `COPY` tablosunda.
- Durum metinleri tek yerde: `design-system/components/Status.tsx`. Status string'leri ekranlara saçılmaz.
- Yazma işlemleri kullanıcı tarafından tekrarlanır, otomatik retry yok; aynı `idempotency_key` yeniden kullanılır.
- `supabase/`: migrations (şema+RLS+RPC), `seed.sql` (yalnız dev), `functions/` (Deno Edge), `tests/` (vitest + gömülü Postgres), `dev/` (Docker'sız yerel yığın).

## Tasarım sistemi — TechApp / Open Circuit
Token kaynağı `design-source/tokens.json` → `src/design-system/tokens.ts`. Ekranlarda renk/radius/spacing/font-size hardcode edilmez.
Iris `#4B46D6` · Pressed `#3832AF` · Soft `#EEEDFF` · Lime `#D9F36E` · Ink `#20241F` · Secondary `#666D66` · Canvas `#F6F7F2` · Surface `#FFF` ·
Border `#E3E6DD` · Moss `#157461`/`#E5F3EB` · Apricot `#FFD1BD` · Danger `#B8323D`/`#FFF0F1`.
Manrope (başlık) + DM Sans (gövde), yerel paketli. Spacing 4–48, radius 14/22/26/999, dokunma hedefi ≥44, gutter 20, 390 referans / 320 minimum, min yazı 12.
İkon: yalnızca `<TechIcon name=… />` (30 SVG, `npm run icons` ile üretilir). `@expo/vector-icons` lint ile yasak. Alt sekmede etiket her zaman görünür.
Görsel yön: temiz, karakterli, genç. Gamer/cyberpunk/neon, her karta gradient, glassmorphism, banka uygulaması havası yok. Youthall/Yirmi Üç kopyalanmaz.
UI dili Türkçe; ton genç, açık, abartısız: "Başvurun alındı." ✔ · "İşleminiz sisteme başarılı şekilde aktarılmıştır." ✘

## Komutlar
```bash
npm run db:test                      # şema + RLS + RPC testleri (gömülü Postgres)
npm run db:dev [-- --reset]          # yerel backend :54321 (OTP ve veli linki terminale yazılır)
npm --prefix apps/mobile run verify  # typecheck + lint + jest
npm --prefix apps/mobile run web     # hızlı görsel kontrol; asıl hedef dev build (ios/android)
npm --prefix apps/mobile run icons   # design-source/icons → icons.generated.ts
npx --prefix apps/mobile expo-doctor
```
Her değişiklikten sonra: typecheck → lint → test → çalışan uygulamada doğrulama. UI değişikliği ekranda görülmeden bitmiş sayılmaz.
`IMPLEMENTATION-STATUS.md` ve ilgili `docs/*.md` her fazda güncellenir. Git: `main` korunur, iş `feat/…` `fix/…` dallarında PR ile gelir (`CONTRIBUTING.md`); destructive komut (reset --hard, force push vb.) yok.
