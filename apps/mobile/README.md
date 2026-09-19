# TechApp · Mobil uygulama

Expo SDK 57 · React Native 0.86 · TypeScript (strict) · React Navigation 7 · TanStack Query · Supabase JS.

```bash
npm install
npm run web        # tarayıcı önizlemesi (hızlı geliştirme)
npm run ios        # development build — Xcode gerekir
npm run android    # development build — Android Studio gerekir
npm run verify     # typecheck + lint + jest
```

Backend adresi `.env.local` dosyasından okunur (`.env.example`'a bak). Yerelde `npm run db:dev` (depo kökü) bu dosyayı kendisi yazar.

| Klasör | İçerik |
|---|---|
| `src/design-system` | Open Circuit token'ları, `<Text>`, `<TechIcon>`, ~40 ortak bileşen |
| `src/features` | `auth`, `onboarding`, `discovery`, `events`, `guardian`, `checkin`, `opportunities`, `community`, `profile` |
| `src/lib` | Supabase istemcisi, hata sözleşmesi, güvenli oturum deposu, `database.generated.ts` (elle düzenlenmez) |
| `src/navigation` | 5 sekme, sekme başına stack, paylaşılan etkinlik yolculuğu, deep link |

Beş sekme: **Keşfet · Etkinlikler · Fırsatlar · Topluluk · Profil.** Expo Go hedef değildir; kamera ve güvenli depolama development build ister.
Mimari ayrıntılar: [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
