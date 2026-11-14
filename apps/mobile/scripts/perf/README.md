# Android performans ölçümleri

Plan: `docs/superpowers/plans/2026-11-12-techapp-v5-faz5-motion-a11y-performance.md` > Task 7. Sonuçlar `docs/qa/2026-11-14-performance-android.md`'de.

Ortak kurallar: **release/preview APK** (dev client ölçüm vermez), aynı cihaz/emülatör profili, ölçüm başlığına cihaz modeli, Android sürümü ve `versionName`/build ID yazılır. Dev menüsü kapalı. Ölçülemeyen satır "ölçülmedi" + neden olarak yazılır; sayı uydurulmaz. `adb` yolu: `~/Library/Android/sdk/platform-tools/adb` (`ADB=` ile verilir). Betikler uygulamayı kurmaz, silmez, oturum açmaz/kapatmaz.

| Ölçüm | Yöntem | Karar kuralı |
|---|---|---|
| Soğuk açılış | `./cold-start.sh` (10 koşu: `force-stop` → `am start -W -n com.intechne.techapp/.MainActivity` → `TotalTime`; başlık + medyan + en kötü). `SERIAL=`, `RUNS=`, `SETTLE=` ortam değişkenleri | Bütçe = ilk ölçüm medyanı; kullanıcıya sunulur, onaylanan sayı `docs/qa`'ya yazılır |
| İlk içerik | Bkz. "İlk içerik" | aynı |
| Kaydırma | Bkz. "Kaydırma" | ≥55 fps (spec); altındaysa memo/`keyExtractor`/`getItemLayout`/görsel boyutu, sonra FlashList (ayrı task) |
| Görsel belleği | Bkz. "Bellek" | thumb (640) yerine full yükleniyorsa düzelt; listelerde `recyclingKey` |
| Basma | Perf Monitor UI fps (dev) veya `gfxinfo` (release) | ≥55 |
| JS paketi | `npx expo export --platform android --dump-sourcemap --output-dir <geçici dizin>` | yalnız kayıt |

`TotalTime` = `am start`'tan Activity'nin ilk karesine kadar; React Native'de JS içeriğinin göründüğü anı **içermez** (bunun için "İlk içerik"). Soğuk açılış sayıları bu yüzden tek başına "kullanıcı içeriği ne zaman gördü" demez.

## Kaydırma (jank) — release'te Perf Monitor olmadan
```sh
adb shell dumpsys gfxinfo com.intechne.techapp reset
# Etkinlikler listesi (100 öğe worst-case seed), 10 sn hızlı fling:
adb shell input swipe 540 1900 540 400 150   # tekrarla; ya da elle
adb shell dumpsys gfxinfo com.intechne.techapp          # "Janky frames", yüzdelikler
adb shell dumpsys gfxinfo com.intechne.techapp framestats   # kare başına zaman damgaları
```
`gfxinfo` UI (render) iş parçacığını verir: "Total frames rendered", "Janky frames (%)", 50/90/95/99th percentile ms. 55 fps ≈ kare başına ≤18,2 ms. **JS iş parçacığı fps'i** yalnız dev client Perf Monitor'ünde (Dev menüsü → Show Perf Monitor) okunur; release'te yoktur — bu satır dev client'ta tamamlayıcı olarak alınır ve öyle etiketlenir.

## Bellek (görseller)
```sh
adb shell dumpsys meminfo com.intechne.techapp | grep -E "TOTAL PSS|Graphics|Native Heap|Java Heap"   # önce
# Keşfet/Etkinlikler'de 50 kapaklı kart kaydır
adb shell dumpsys meminfo com.intechne.techapp | grep -E "TOTAL PSS|Graphics|Native Heap|Java Heap"   # sonra
```
Farkı ve cihaz/profili yaz.

## İlk içerik
Ekran kaydı ile kare sayımı:
```sh
adb shell screenrecord --time-limit 12 --bit-rate 4000000 /sdcard/cold.mp4 &
adb shell am force-stop com.intechne.techapp; adb shell am start -W -n com.intechne.techapp/.MainActivity
wait; adb pull /sdcard/cold.mp4; adb shell rm /sdcard/cold.mp4
ffmpeg -i cold.mp4 -vsync 0 frames/%04d.png    # ilk PosterCard'ın göründüğü kare numarası / kare hızı
```
Süre = ilk `PosterCard` karesinin zamanı − `am start` karesi (kayıt başlangıcına göre). Oturum açık/Keşfet'in açılması gerekir (onboarding ekranında ölçülmez).

## JS paketi
```sh
cd apps/mobile && npx expo export --platform android --dump-sourcemap --output-dir "$TMPDIR/techapp-export"
ls -l "$TMPDIR/techapp-export/_expo/static/js/android/"
```
`.hbc` = Hermes bayt kodu (cihaza giden boyut). Kaynak haritasındaki `sourcesContent` uzunluğu pakete **katkı sırası** için kaba göstergedir (bayt kodu boyutu değildir). Çıktı commit edilmez.
