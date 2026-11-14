# Android performans ölçümleri — Faz 5 Task 7 (14 Kasım 2026)

> Kapsam kararı (kullanıcı, 14 Kasım): ürün dalı (`feat/v5-product`) için release build **alınmaz**; ürün performansı ve release gözlemi pilot sonrası **tek EAS build**'inde (Faz 6 ile ortak) ölçülür. Bu belge bugün dürüstçe ölçülebilenleri ve ölçüm yöntemini kaydeder. Betikler: `apps/mobile/scripts/perf/{cold-start.sh,README.md}`.

## Cihaz ve build profili
| | |
|---|---|
| Cihaz | Android emülatörü `sdk_gphone64_arm64` (`emulator-5554`), Android 16 (API 36), arm64-v8a, 1080×2400. Gerçek cihaz **yok** |
| Ölçülen build | **Pilot preview APK (pilot dalı), ürün dalı değil**: `com.intechne.techapp` versionName 5.0.0, versionCode 2, kurulum 2026-11-14 07:57; staging backend. Pilot dalındaki sürüm; Faz 3–5 ürün kodunu içermez |
| Ürün dalı build'i | Yok (`feat/v5-product` @ `bd7ae39`; EAS/release build alınmadı — kullanıcı kararı) |
| Ölçüm koşulları | Emülatör yeniden başlatılmadı, kurulum/silme/oturum işlemi yapılmadı; 10 koşu arası 2 sn bekleme + 4 sn dinlenme; makinede başka işler çalışıyor olabilir (emülatör ana makine yüküne duyarlı) |

## Tablo
| Ölçüm | Sonuç | Not |
|---|---|---|
| Soğuk açılış — **pilot preview APK (pilot dalı)** | **medyan 456 ms · en kötü 941 ms** (en iyi 356 ms) | 10 koşu: 540, 477, 415, 389, 433, 436, 813, 356, 572, 941 ms. `am start -W` `TotalTime` = Activity ilk kare; JS içeriği görünene kadar geçen süreyi **içermez**. Emülatör sayısı; gerçek orta segment cihazda daha yüksek beklenir. Dağılım geniş (356–941): koşular arası değişim yüksek |
| Soğuk açılış — ürün dalı | ölçülmedi — ürün dalı release build'i yok (kullanıcı kararı 14 Kasım); pilot sonrası tek EAS build'inde ölçülecek | |
| İlk içerik (ilk `PosterCard`) | ölçülmedi — ürün dalı release build'i yok (kullanıcı kararı 14 Kasım); pilot sonrası tek EAS build'inde ölçülecek | Pilot APK'da Keşfet/PosterCard yok (ürün Faz 4 tasarımı), karşılaştırılabilir ölçüm anlamsız |
| Kaydırma UI/JS fps (100 öğe) | ölçülmedi — ürün dalı release build'i yok (kullanıcı kararı 14 Kasım); pilot sonrası tek EAS build'inde ölçülecek | Yöntem: `gfxinfo framestats` (UI) + dev client Perf Monitor (JS) |
| Görsel belleği | ölçülmedi — ürün dalı release build'i yok (kullanıcı kararı 14 Kasım); pilot sonrası tek EAS build'inde ölçülecek | |
| Basma UI fps | ölçülmedi — ürün dalı release build'i yok (kullanıcı kararı 14 Kasım); pilot sonrası tek EAS build'inde ölçülecek | |
| JS paketi (ürün dalı, `expo export --platform android`) | **Hermes bayt kodu 6.163.768 bayt (≈5,9 MiB)** (`index-….hbc`); kaynak haritası 14.121.034 bayt (yalnız ölçüm artığı) | Yalnız kayıt; bütçe kullanıcı kararı. Export + harita `--dump-sourcemap` ile alındı, commit edilmedi. Varlıklar (fontlar, ikon PNG'leri) ayrı |

### JS paketine kaba katkı sırası
Kaynak haritası `sourcesContent` karakter sayısı (bayt kodu boyutu **değil**; yalnız sıralama için): `react-native` 2,12 M · `react-native-reanimated` 0,93 M · `zod` 0,82 M · `@sentry/core` 0,78 M · uygulama kodu (`src`) 0,77 M · `@supabase/auth-js` 0,45 M · `@sentry/react-native` 0,42 M · `css-tree` 0,33 M · `@sentry-internal/replay` 0,31 M · `react-native-svg` 0,28 M (toplam 2322 kaynak, 10,4 M karakter). **Gözlem:** Sentry DSN'siz kapalı olduğu hâlde paketin kayda değer kısmını oluşturuyor; `css-tree` ve `@sentry-internal/replay` mobilde gereksiz görünüyor (kaynağı bu ölçümde incelenmedi) — bütçe kararında sorulacak.

## Karar kuralı (plandan)
- Tek sabit sayı: **UI ve JS iş parçacığı ≥55 fps** (spec). Altındaysa sırayla `React.memo`/`keyExtractor`/`getItemLayout`/görsel boyutu; hâlâ altındaysa FlashList ayrı task olarak değerlendirilir.
- Diğer bütçeler (soğuk açılış, ilk içerik, bellek, paket) **ilk ölçüm sonrası kullanıcı kararı**; onaylanan sayı bu belgeye yazılır. Ölçülmeyen = "ölçülmedi".

## Bütçe — öneri (kullanıcı kararı bekleniyor)
> Bu bir öneridir, karar değildir; yalnız pilot APK'nın emülatör medyanına dayanır ve ürün dalı için kanıt değildir.

- Soğuk açılış (`TotalTime`, emülatör): öneri medyan ≤ ~500 ms (pilot medyanı 456 ms + ~%10 pay); en kötü koşu için ayrı sayı konmaması (emülatör gürültüsü: 356–941 ms). **Gerçek orta segment cihaz ölçümü gelmeden bütçe bağlayıcı yapılmamalı.**
- İlk içerik, bellek, paket: sayı önerilmez; ürün dalı ilk ölçümünden sonra.
- Karar sahibi kullanıcı; ürün dalı ölçümü gelince bu sayı yeniden gözden geçirilir.

## Yeniden üretme
`apps/mobile/scripts/perf/README.md`. Pilot APK koşusu: `bash apps/mobile/scripts/perf/cold-start.sh` (cihaz bağlı, uygulama kurulu).
