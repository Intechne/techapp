# HIG Doctor denetimi — Faz 3a kapanışı (14 Kasım 2026)

> Otomatik statik tarama; HIG uyumunu **kanıtlamaz**, yalnız kod desenlerini işaretler. Cihazda / ekran okuyucuyla denenmedi.

## Komut
`~/.npm/_npx/92b14c55f469d890/node_modules/.bin/hig-doctor apps/mobile --stdout` ve `--fail-on serious` (yerel npx önbelleği; 13 Kasım denetimiyle aynı araç). Kapsam: 169 kod dosyası.

## Sayılar
| | 13 Kasım (`9ca8768`) | 14 Kasım, başlangıç (`6a84065`) | 14 Kasım, sonra |
|---|---|---|---|
| Concern | 0 | 2 (1 critical · 1 moderate) | **1 (moderate)** |
| `--fail-on serious` | 0 | 1 (gate tripped) | **0** |

## Bulgular
1. **critical — `CoverImage.tsx` `<Image>` "alt yok"** (Faz 3b kapak görselleri, takım kaydıyla ilgisiz). Görsel dekoratiftir (başlık yanında metin; `accessible={false}`); araç `alt` özniteliği arar. `alt=""` eklendi (expo-image'da `accessibilityLabel` takma adı; dekoratif). `src/design-system` testleri 211/211 geçti. **Kapandı.**
2. **moderate — `SearchScreen.tsx:80` `autoFocus`** (Faz 3b T13). Düzeltilmedi: OTP'deki gibi ekran okuyucuya duyarlı odak ayrı bir tasarım kararı; kapı (serious) etkilenmiyor. Faz 5 listesine.

Takım kaydı ekranlarında (`features/teamRegistration`, `EventDetailScreen` takım parçaları) araç bulgu vermedi.

## Faz 5 kapanışı (14 Kasım 2026, `feat/v5-product` @ f17ba96)
Aynı komutlar (`hig-doctor apps/mobile --stdout` ve `--fail-on serious`). Kapsam: 177 kod dosyası (+4 yapılandırma).

| | Faz 3a sonrası | Faz 5 kapanışı |
|---|---|---|
| Concern | 1 (moderate) | **1 (moderate)** |
| `--fail-on serious` | 0 | **0** |
| Olumlu desen | — | 216 |

- Tek bulgu hâlâ `SearchScreen.tsx:80` `autoFocus` (moderate, bilinçli: arama ekranı klavyeyle açılır). Faz 5 T3'te OTP odağı `transitionEnd` ile düzeltildi; arama alanı için ekran okuyucuya duyarlı odak ayrı bir tasarım kararı olarak kalıyor.
- Faz 5 Task 5'in TechIcon bulgusu (F-01…F-04, F-08, F-09 düzeltmeleri) sonrası serious/critical yok.
- Otomatik statik tarama; HIG uyumunu veya TalkBack/VoiceOver deneyimini **kanıtlamaz**.
