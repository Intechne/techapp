# HIG Doctor denetimi — Faz 4 kapanışı (13 Kasım 2026)

> Otomatik bir statik tarama; Apple HIG uyumunu **kanıtlamaz**. Yalnız kod desenlerini işaretler. Erişilebilirlik ve yerleşim için asıl kanıt, Faz 4 ekran
> turlarıdır (web 390 / 320, Android emülatör yazı ölçeği 1.0 ve 2.0; bkz. `docs/design/faz4-final/`).

## Komut ve sürüm
- Araç: `hig-doctor` **2.0.3** (HIG anlık görüntüsü 2025-02-02). İndirme izni olmadığı için yerel npx önbelleğindeki kopya çalıştırıldı:
  `~/.npm/_npx/92b14c55f469d890/node_modules/.bin/hig-doctor apps/mobile --fail-on serious` (planın `npx hig-doctor apps/mobile --fail-on serious` komutuyla aynı araç).
- Kapsam: `apps/mobile`, 128 kod dosyası, 0 stil, 4 yapılandırma dosyası.

## Sayılar
| | Görev başında (HEAD `6a52504`) | Sonra (`9ca8768`) |
|---|---|---|
| Concern (toplam) | **1** (critical 1 · serious 0 · moderate 0) | **0** |
| Pozitif desen | 163 | 164 |
| Desen (toplam) | 225 | 225 |
| `--fail-on serious` çıkış kodu | 1 | **0** (“gate clean”) |

Önceki rapor (`2026-11-11-hig-doctor.md`): 2 concern. Faz 4'te OTP `autoFocus` (Task 10) ve `TechIcon` SVG (Task 11) kapandı.

## Kapanan concern'ler
1. **OTP alanı `autoFocus`** (Task 10, `8eb1e58`): `autoFocus` yerine ref ile odak, yalnız ekran okuyucu kapalıyken. Task 11'de odak gecikmesi,
   React Native 0.86'da kullanımdan kalkan `InteractionManager` yerine 350 ms'lik zamanlayıcıyla yapıldı (testte konsol uyarısı çıkıyordu).
2. **`TechIcon.tsx:24` — “svg without a11y” (critical)** (Task 11): kural, `<svg` etiketinde `aria-label` / `aria-hidden` / `role` arar. `aria-hidden` işaretlemeye
   konamaz (react-native-svg bunu DOM'da `ariaHidden`'a çevirip React uyarısı verir; Task 1). Etikete `role="presentation"` eklendi: glifin kendisi
   erişilebilir düğüm değildir; gizleme/etiketleme sarmalayıcıdadır (dekoratifse gizli, `accessibilityLabel` varsa `image`). Web konsolunda yeni uyarı yok.

## Kalan
- Concern yok. Taramanın göremedikleri: gerçek ekran okuyucu turu (TalkBack/VoiceOver sesli tur yapılmadı), iOS, gerçek cihaz.
- Araç “düşük UI yoğunluğu” uyarısı verir (dosya başına 3.0 desen); sonuçlar bu yüzden zayıf kanıttır.
