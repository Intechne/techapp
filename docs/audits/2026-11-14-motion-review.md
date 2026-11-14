# Hareket incelemesi — 2026-11-14 (Faz 5 · Task 3)

Kapsam: `apps/mobile/src` altındaki tüm `react-native-reanimated` kullanımları ve kalan çekirdek `Animated`. Ölçüt: Faz 5 planındaki küresel kısıtlar, "Hareket haritası" ve "Reddedilenler" listesi; review-animations standartları (amaç, sıklık, ease-out, token, kesinti, yalnız transform/opacity, reduced motion). Taban: `be021e7`. Düzeltmeler aynı dalda (`feat/v5-product`) ayrı `fix(mobile)` commit'leri.

Sonuç: **8 Reanimated kullanımı**, çekirdek `Animated` yok (kaynak taramasıyla kilitli). Reddedilenler listesinden hiçbiri uygulanmamış. 4 bulgu düzeltildi, 3 madde kayıt altında bırakıldı.

## Kullanım tablosu

| # | Yer | Amaç (haritada) | Süre / eğri | Reduced motion | Kesinti | Thread | Özellik |
|---|---|---|---|---|---|---|---|
| 1 | `PressableScale` | Basma geri bildirimi (var) | `snappy` yay (`spring('snappy')`); eskiden ham token | JS dalı: ölçek yok; sistem ayarı da yayda | `scale.set(withSpring)` mevcut değerden devam eder | UI thread; render'da okuma yok (`.get()` yalnız worklet) | transform (scale) |
| 2 | `CardBase` | Basma (kart) (var) | `snappy`, `pressScale` | `reduced` → ölçek yok; arka plan tonu tek ipucu | aynı | UI thread | transform |
| 3 | `BookmarkButton` | Kaydet dolumu (var) | `snappy`, 0.9 → 1 | **eksikti**; artık `useReducedMotion` dalı | yay mevcut değerden; hızlı 4 dokunuş testli | UI thread | transform |
| 4 | `CardSkeletonFrame` | İskelet nabzı (var) | 900 ms, `EASE_IN_OUT`; **iki kopya** idi → `skeletonPulse()` | durur, opaklık 1 | `cancelAnimation` temizlikte | UI thread | opacity |
| 5 | `Skeleton` (States) | İskelet nabzı (var) | aynı `skeletonPulse()` | durur | aynı | UI thread | opacity |
| 6 | `ToastProvider` (Overlays) | Toast (var) | giriş `standard`, çıkış `exit`, `EASE_OUT` (`timing()`) | yalnız opaklık; `ReduceMotion.System` | `show` her çağrıda zamanlayıcıları temizler, `withTiming` mevcut değerden devam eder | UI thread | opacity + translateY |
| 7 | `SuccessMark` | Onay/sonuç rozeti (var) | `standard`, `EASE_OUT`, bir kez | yalnız opaklık | mount'ta bir kez; unmount'ta `cancelAnimation` | UI thread | opacity + scale |
| 8 | `ShakeOnError` | Doğrulama hatası (var) | 7 × 40 ms = 280 ms, `EASE_IN_OUT`, ±6 px | transform hiç yok; haptic + metin + duyuru sürer | yeni tetikleyicide `withSequence` baştan değil mevcut x'ten başlar | UI thread | transform (translateX) |

Haritada olup uygulanmayan: "İskelet → içerik opaklık geçişi" ve "İlk açılış (onboarding) başlık". Aşağıda (K2, K3).

Reanimated dışı hareket: `CoverImage` kapak geçişi (expo-image `transition` = `fast`, reduced → 0); `Modal` `fade`/`none` (haritadaki onay diyaloğu); sheet'ler native-stack `formSheet` (platform eğrisi, platform reduced motion'a uyar); `Overlays` `scrollToEnd({animated:true})` klavye açılışında (kullanıcı eylemi sonrası tek sefer, kaydırma, karar: kalsın); native `RefreshControl`. `onUpdate`/gesture kodu yok, dolayısıyla per-frame `scheduleOnRN`/`runOnJS` yok.

## Reddedilenler denetimi

Sekme geçişi, liste stagger, çip seçimi, segment değişimi, kanban geçişi, sayaç sayma, kapak paralaksı, özel pull-to-refresh: kod tabanında yok (`entering`/`exiting`/`Layout`/`LayoutAnimation` kullanımı sıfır). Bildirim rozeti sayısı animasyonsuz.

## Bulgular ve kararlar

| ID | Bulgu | Karar |
|---|---|---|
| B1 | `BookmarkButton` reduced motion dalı yoktu (ölçek yalnız sistem ayarına bırakılmıştı, ham `withSpring` yayında `reduceMotion` yok) | **Düzeltildi** — `useReducedMotion` ile ölçek yazılmaz; haptic + `onToggle` sürer. Test: reduced'da sıfır `scale.set`. |
| B2 | `PressableScale` ve `CardBase` yayı ham `motion.spring.snappy` ile çağırıyordu (`reduceMotion` seçeneği yok; `spring()` ile tutarsız); `PressableScale` `scale.value` okuyordu | **Düzeltildi** — hepsi `spring('snappy')` + `.get()`. Kaynak taraması: ham `motion.spring` yok, bileşenlerde `.value` yok, çekirdek `Animated` yok. |
| B3 | İskelet nabzı iki yerde kopya (`duration: 900` sabiti token dışı, iki bileşen) | **Düzeltildi** — `motion.ts` `skeletonPulse()` / `SKELETON_PULSE_MS`; taramada `withRepeat` yalnız motion.ts'te. |
| B4 | OTP odağı 350 ms tahmini zamanlayıcıydı | **Düzeltildi** — native-stack `transitionEnd` (closing değil) ile odak; zamanlayıcı (700 ms) yalnız yedek; ekran okuyucu açıkken yok; unmount'ta dinleyici ve zamanlayıcı iptal; bir kez. Testler: transitionEnd'de odak + yedek iptali, okuyucu cevabından önce gelen transitionEnd, closing, okuyucu açık, unmount. |
| K1 | Tüm düğme/kart animasyonlarında basma sırasında `useReducedMotion` değişince yay yarıda kalabilir | Kayıt: etkisi yok sayılır (ayar uygulama çalışırken nadiren değişir; yay saniyenin altında biter). |
| K2 | Haritadaki "iskelet → içerik opaklık" uygulanmadı | Kayıt, **bilinçli**: iskelet ve içerik aynı ölçüde (Faz 4), yerleşim kayması yok; liste girişi sayılır ve "liste girişleri animasyonsuz" kuralıyla çelişir. Gerekirse kapak görseli (`CoverImage` `fast`) yeterli. |
| K3 | Haritadaki "onboarding ilk ekran başlık animasyonu" ve HeroOrbit yok | Kayıt: kod tabanında hero/orbit ve onboarding ilk ekran girişi bulunmuyor; "sayfa girişleri animasyonsuz" kuralı ve ilk-ekran öğesinin henüz tasarlanmamış olması nedeniyle eklenmedi. Tasarım onayı sonrası ≤400 ms opaklık + 8 px yükseliş tek yerde (`ShakeOnError` gibi bir sarmalayıcı) eklenebilir. |

## Doğrulama notları

- iOS'ta `transitionEnd` ve formSheet davranışı gözlenmedi (yalnız Jest + önceki Android dev gözlemi); release build gözlemi ve performans ölçümü ortak sonraki EAS derlemesine bırakıldı ("yapılmadı / ölçülmedi").
- `AuthOtp` pilotun giriş yolunda: davranış aynı (ekran okuyucu yoksa alan açılışta odaklanır), yalnız zamanlama push'un gerçek bitişine bağlandı.
