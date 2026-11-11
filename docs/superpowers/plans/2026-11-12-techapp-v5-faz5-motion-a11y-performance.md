# TechApp V5 · Faz 5 — Hareket, erişilebilirlik, performans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hareketi yalnız anlam taşıdığı yerlere (basma, sheet, durum değişimi, iskelet→içerik, kaydet dolumu, doğrulama
sarsması) koymak; reduced motion ve kesintiyi ilk günden doğru yapmak; haptic'i tek bir haritaya bağlamak; erişilebilirliği
cihazda betikli turlarla denetlemek; performansı cihazda ölçüp yalnız ölçülen sayıyla karar vermek.

**Architecture:** `design-system/motion.ts` tek kaynak (süre/yay token'dan, eğriler sabit); tüm animasyonlar Reanimated 4
(UI thread), core `Animated` kalkar. Sheet'ler native-stack `presentation: 'formSheet'` (yeni bağımlılık yok).
Gesture Handler yalnız aşağıdaki kabul ölçütünü geçen bir ihtiyaç doğarsa eklenir. Erişilebilirlik ve performans
task'ları ölçüm/denetim task'larıdır: bulgular ayrı fix commit'leriyle kapanır.

**Tech Stack:** `react-native-reanimated` + `react-native-worklets` (Faz 2'de eklendi) · `expo-haptics` (Faz 2) · react-native-screens formSheet · Jest/RNTL · Android emülatör + gerçek cihaz (varsa) · Perf Monitor · `adb`.

**Spec:** `docs/superpowers/specs/2026-11-11-techapp-v5-design.md` (§4 "Hareket sistemi", §6, §2 başarısızlık sayılanlar) · Yol haritası: `docs/superpowers/plans/2026-11-12-techapp-v5-roadmap.md`
**Uygulanan ilkeler:** animate-expo (sıklık kapısı, UI thread, reduced motion animasyonla birlikte), emil-design-eng (amaç adı, ease-out, <300 ms), review-animations, gestures (1:1 takip, hız devri, kesinti), find-animation-opportunities (reddedilenler listesi), apple-design (geri bildirim, sadelik).

## Global Constraints

- Dal `feat/v5-motion-a11y-perf`, Faz 4 birleşmiş tabandan. Destructive git yok (stash dahil).
- Süreler/yaylar yalnız token: `fast 160 / standard 220 / exit 140 ms`, `pressScale 0.97`, `snappy {damping 22, stiffness 320}`, `gentle {damping 26, stiffness 180}`. Eğriler: `EASE_OUT = bezier(0.23, 1, 0.32, 1)`, `EASE_IN_OUT = bezier(0.77, 0, 0.175, 1)`; `ease-in` UI'da yok.
- **Hiç animasyon yok:** sekme geçişi, liste girişleri (stagger), paralaks, dekoratif döngü, sayfa girişleri, kaydırma bağlı efektler.
- Her animasyon reduced motion ile birlikte gelir (`ReduceMotion.System` veya `useReducedMotion()` → anlık değişim / yalnız opaklık; iskelet nabzı durur). Hiçbir eylem animasyon bitimini beklemez.
- Animasyon yalnız `transform` ve `opacity`; `width/height/margin` animasyonu yok.
- Haptic tek API `lib/haptics.ts`; `success` yalnız check-in sonucu ve kayıt onayı. Haptic hiçbir zaman tek geri bildirim değildir.
- Performans: spec'teki tek sayı **UI ve JS thread ≥55 fps** (kaydırma + basma). Diğer bütçeler ilk ölçümden sonra kullanıcıyla konur; ölçülmeyen değer raporda "ölçülmedi" yazar.
- Her task: `verify` yeşil; hareket task'ları Android emülatörde **release** build (`--variant release` / preview APK) üzerinde gözlenmeden bitmez (dev build hız kanıtı değildir).

## Review Focus

1. **Hızlı ardışık dokunuş:** kaydet düğmesine 4 kez hızlı basılır → animasyon her basışta mevcut değerden devam eder (sıçrama yok), son durum sunucu sonucuyla aynı, tek haptic per dokunuş (Task 2 testi).
2. **Reduced motion açık + doğrulama hatası:** sarsma oynamaz, hata metni ve `accessibilityLiveRegion` duyurusu yine gelir (Task 2 testi).
3. **Sheet + klavye (Android):** formSheet içinde metin alanı açıkken klavye gönder düğmesini örtmez; geri tuşu önce klavyeyi, sonra sheet'i kapatır (Task 1 emülatör adımı).
4. **%200 yazı + TalkBack:** alt sekme etiketleri okunur ve kesilmez; durum çizgisi her adımı "etiket, durum" olarak okur (Task 5–6).
5. **Düşük uçlu Android'de soğuk açılış:** beyaz ekran yok, splash → içerik; ölçüm tekrar edilebilir komutla alınır (Task 7).

---

## Hareket haritası (Task 1–2'nin sözleşmesi)

| An | Amaç | Uygulama | Reduced motion |
|---|---|---|---|
| Basma (tüm kart/düğme) | geri bildirim | mevcut `PressableScale` 0.97, `fast`; basışta başlar, bırakışta işlem | ölçek yok, opaklık 0.85 |
| Sheet aç/kapa (filtre, katılma isteği, rapor, başvuru, kadro) | mekânsal tutarlılık | native-stack `formSheet`, `sheetAllowedDetents`, `sheetGrabberVisible`; platform eğrisi | platform kendi uyar |
| Onay/diyalog | — | RN `Modal` `fade` korunur (onay = kısa, merkezi) | `none` |
| Kayıt onaylandı / check-in sonucu | durum bildirimi | sonuç rozeti `scale 0.96→1` + `opacity 0→1`, `standard`, `EASE_OUT`, **bir kez**; haptic aynı karede | yalnız opaklık |
| İskelet → içerik | sarsıcı değişimi önleme | içerik `opacity 0→1` `fast`; yerleşim kayması yok (iskelet ölçüsü = kart ölçüsü, Faz 4) | anlık |
| Kaydet dolumu | geri bildirim | ikon `scale 0.9→1` `snappy` yay, dolu glife geçiş; `selection` haptic | anlık glif değişimi |
| Doğrulama hatası | durum bildirimi | alan `translateX` 3 salınım ±6 px, toplam 280 ms, `EASE_IN_OUT` | yok; yalnız metin + duyuru |
| Toast | durum bildirimi | `translateY 8→0` + opaklık, `standard` giriş / `exit` çıkış | yalnız opaklık |
| Bildirim rozeti sayısı | — | animasyon yok (sık değişir) | — |
| İlk açılış (onboarding ilk ekran) | açıklama | tek, ≤400 ms (spec §5) başlık opaklık + 8 px yükseliş | yok |

**Reddedilenler (find-animation-opportunities):** sekme geçişi, liste stagger, çip seçimi (yalnız renk), segment değişimi, kanban sütun geçişi, sayaç sayma efekti, kapak paralaksı, pull-to-refresh özel animasyonu (native `RefreshControl` kalır).

## Haptic haritası

| Olay | Çağrı |
|---|---|
| Kaydet aç/kapa, çip/segment seçimi değil (sık) — yalnız kaydet | `selection` |
| Sheet detent'e oturma | yok (native davranış) |
| Check-in geçerli · kayıt `confirmed` olarak ilk görünüm (yalnız `fresh` param) | `success` |
| Check-in tekrar okutma · bekleme listesine düşme | `warning` |
| Check-in geçersiz · gönderim hatası (form) | `error` |
| Kaydırma, sayfa girişi, toast, bildirim gelişi | yok |

## Gesture Handler kabul ölçütü

`react-native-gesture-handler` yalnız şu üçü birden doğruysa eklenir: (1) parmağı 1:1 izlemesi gereken bir etkileşim var,
(2) native bileşen (formSheet, ScrollView, `RefreshControl`, `Pressable`) bunu karşılamıyor, (3) kullanıcı/ürün o etkileşimi
onayladı. Bugünkü adaylar: kanban kartını sütunlar arası sürükleme (onay yok — mevcut "Başla/Tamamla" düğmeleri yeterli),
bildirim satırında kaydırarak sil (onay yok; "Tümünü okundu say" var). **Karar: bu fazda eklenmez.** Eklenirse ayrı task:
`npx expo install react-native-gesture-handler`, kök `GestureHandlerRootView`, hız devri yaylı bırakma, mesafe **veya** hız eşiği, reduced motion.

---

### Task 1: Hareket temeli ve sheet geçişi

**Files:** Create `apps/mobile/src/design-system/motion.ts`, `design-system/__tests__/motion.test.ts`; Modify `design-system/components/{States.tsx (Skeleton → Reanimated),Overlays.tsx (Toast → Reanimated; BottomSheet kullanımları rotaya taşındıkça kaldırılır)}`, `navigation/{RootNavigator.tsx,types.ts}`, sheet kullanan ekranlar (`TeamDetailScreen` katılma isteği, `EventFiltersScreen`, `ReportSheet`, `RecruitmentApplySheet`, kadro düzenleme)

**Interfaces:** Produces `EASE_OUT`, `EASE_IN_OUT`, `timing(kind: 'fast'|'standard'|'exit')`, `spring(kind: 'snappy'|'gentle')` (hepsi `reduceMotion: ReduceMotion.System`); sheet rotaları `presentation: 'formSheet'`, `sheetAllowedDetents: 'fitToContents'` veya `[0.6, 1]`, `sheetGrabberVisible: true`, `sheetCornerRadius: radius.hero`.

- [ ] **Step 1: Failing testler:** `motion.test.ts` — token değerleri `tokens.motion` ile birebir; `States.tsx` artık `react-native` `Animated` import etmez (kaynak taraması); reduced motion'da iskelet opaklığı sabit; Toast reduced motion'da translate yok.
- [ ] **Step 2:** FAIL → **Step 3:** uygula; `BottomSheet` bileşeni son kullanım taşınınca silinir (onay `Modal` kalır).
- [ ] **Step 4:** `verify`; Android emülatörde (release/preview APK) her sheet: aç, detent değiştir, klavye aç, geri tuşu sırası, aşağı kaydırarak kapat; iOS simülatörde aynı (varsa). Gözlem `docs/qa/<tarih>-motion-android.md`'ye.
- [ ] **Step 5: Commit** `feat(mobile): hareket temeli — motion.ts, Reanimated iskelet ve toast, sheet'ler native formSheet`

### Task 2: Anlamlı durum hareketleri ve haptic haritası

**Files:** Create `design-system/components/{SuccessMark.tsx,ShakeOnError.tsx}`, `design-system/__tests__/{successMark.test.tsx,shake.test.tsx}`, `lib/__tests__/hapticsMap.test.ts`; Modify `design-system/components/cards/BookmarkButton.tsx`, `features/events/RegistrationStatusScreen.tsx`, `features/checkin/CheckInScreen.tsx`, `design-system/components/Form.tsx`

**Interfaces:** Produces `<SuccessMark tone="moss"|"apricot"|"danger" icon />` (mount'ta bir kez oynar), `<ShakeOnError trigger={errorKey}>` (`errorKey` değişince oynar, aynı değerde oynamaz).

- [ ] **Step 1: Failing testler:**
  - `hapticsMap.test.ts`: kaynak taraması — `haptics.success(` çağrı yerleri yalnız `CheckInScreen.tsx` ve `RegistrationStatusScreen.tsx`; `haptics.selection(` yalnız `BookmarkButton.tsx`.
  - `BookmarkButton`: 4 hızlı basış → 4 `selection`, animasyon değeri sıfırlanmadan sürer (shared value `.set` çağrı sırası), son görünüm `saved` prop'una eşit.
  - `RegistrationStatusScreen`: `fresh=true` + `confirmed` → `SuccessMark` + `success` bir kez; geri gelip tekrar odaklanınca tekrar yok.
  - `ShakeOnError`: reduced motion → transform yok; hata metni `accessibilityLiveRegion="polite"` ile duyurulur.
  - Check-in: sonuç bloğu **tek** duyuru (ledger: a11y etiketi + announce çift okuma) — `announceForAccessibility` çağrılır, blokta ayrıca `accessibilityLiveRegion` yok.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** `verify`; release APK'da kaydet hızlı basış, kayıt onayı, check-in üç sonuç; reduced motion açık (`adb shell settings put global transition_animation_scale 0` + Android "Animasyonları kaldır") tekrar.
- [ ] **Step 5: Commit** `feat(mobile): durum hareketleri — başarı işareti, kaydet dolumu, doğrulama sarsması; haptic haritası testli`

### Task 3: Hareket incelemesi (review-animations)

**Files:** Create `docs/audits/<tarih>-motion-review.md`
- [ ] **Step 1:** Tüm `react-native-reanimated` kullanımlarını listele; her biri için: amaç adı, süre/eğri token'dan mı, reduced motion yolu, kesinti davranışı, thread (render'da `.get()` yok, `onUpdate`'te `scheduleOnRN` yok).
- [ ] **Step 2:** Bulgular → aynı dalda `fix(mobile): …` commit'leri (her bulgu için test).
- [ ] **Step 3: Commit** `docs(audit): hareket incelemesi — amaç, token, reduced motion, kesinti`

### Task 4: Erişilebilirlik betikleri

**Files:** Create `docs/qa/a11y-scripts.md` (kalıcı betik), `docs/qa/<tarih>-a11y-android.md`, `docs/qa/<tarih>-a11y-ios.md` (cihaz/simülatör varsa; yoksa "yapılmadı")

Betikler (her biri adım + beklenen okuma):
- **TalkBack (Android emülatör):** onboarding → Keşfet (vitrin okuma sırası: tür, başlık, tarih·yer, eylem) → etkinlik detayı (engel kutusu `alert` okunur) → OTP (kod alanı etiketi, hata duyurusu) → 16 yaş kayıt → durum çizgisi ("Veli onayı, şu an bu adımda") → katılım kartı (QR "Katılım QR kodu", kısa kod harf harf) → check-in sonucu (tek duyuru) → Profil sayaçları ("3 katıldığı etkinlik") → Ayarlar anahtarları (durum "açık/kapalı").
- **VoiceOver (iOS):** aynı akış; rotor ile başlık gezintisi (her ekranda tek `header` rolü).
- **Yazı ölçeği %200:** Android `adb shell settings put system font_scale 2.0`; iOS en büyük Erişilebilirlik boyutu; her sekme kökü + detay + kart + durum çizgisi + alt eylem.
- **320 dp:** `adb shell wm size 720x1520` + `adb shell wm density 360` (≈320 dp genişlik), sonra `wm size reset`/`wm density reset`.
- **Kontrast:** Task 6 aracı.

- [ ] **Step 1:** Betikleri yaz. **Step 2:** Android'de koş, her adım ekran görüntüsü + geçti/kaldı. **Step 3:** iOS (cihaz/simülatör varsa). **Step 4:** Bulgular listesi önceliklendirilir (P1: işlevi engelleyen, P2: yanlış okuma, P3: kozmetik).
- [ ] **Step 5: Commit** `docs(qa): erişilebilirlik betikleri ve ilk tur sonuçları`

### Task 5: Erişilebilirlik düzeltmeleri

**Files:** Task 4 bulgularına göre; bilinenler: `navigation/RootNavigator.tsx` (`tabBarAllowFontScaling: false` → ölçeklenir, `maxFontSizeMultiplier: 1.3` etiketlerde), `design-system/TechIcon.tsx` (HIG Doctor: SVG metin rengi bulgusu), `design-system/Text.tsx` (`maxFontSizeMultiplier` yalnız `display` için 1.6 — manşet taşmasın)

- [ ] **Step 1: Failing testler:** alt sekme etiketi `allowFontScaling` açık; `display` varyantı `maxFontSizeMultiplier=1.6`; Task 4'teki her P1/P2 bulgu için bir test (ad: bulgunun kendisi).
- [ ] **Step 2–4:** FAIL → uygula → `verify`; Task 4 betiğinin ilgili adımları yeniden koşulur, görüntü.
- [ ] **Step 5: Commit** `fix(mobile): erişilebilirlik turu bulguları — sekme etiketi ölçeği, ikon rengi, <bulgu listesi>`

### Task 6: Kontrast denetim aracı

**Files:** Create `apps/mobile/scripts/contrast-audit.mjs`, `apps/mobile/src/design-system/__tests__/contrast.test.ts`

**Interfaces:** Produces `contrastRatio(fg: string, bg: string): number` (WCAG 2.x göreli parlaklık); `TEXT_PAIRS` (tasarım sisteminde gerçekten kullanılan metin/zemin çiftleri: `semantic.light` + `tones` + `noticeTones` + etiket tonları).

- [ ] **Step 1: Failing test:** gövde metni çiftleri ≥4.5; ≥18 pt veya kalın ≥14 pt başlık ve ikonlar ≥3; lime yalnız zemin (lime üstünde ink metin ≥4.5; beyaz/lime metin çifti listede yoksa geçer, varsa FAIL); `semantic.dark` taslağı aynı eşiklerle (yalnız rapor, FAIL etmez).
- [ ] **Step 2:** FAIL/PASS gözlemi → **Step 3:** eşiği geçmeyen çift varsa token **değil** kullanım düzeltilir (palet değişmez; ör. metin rengi `fg` tonuna çekilir) → **Step 4:** `verify`.
- [ ] **Step 5: Commit** `test(design): WCAG kontrast denetimi — kullanılan tüm metin/zemin çiftleri`

### Task 7: Performans ölçümü (önce ölç, sonra karar)

**Files:** Create `docs/qa/<tarih>-performance-android.md`, `apps/mobile/scripts/perf/{cold-start.sh,README.md}`

Ölçümler (hepsi **release/preview APK**, aynı emülatör profili + varsa gerçek orta segment Android; cihaz modeli, Android sürümü, build ID yazılır):
| Ölçüm | Yöntem | Karar kuralı |
|---|---|---|
| Soğuk açılış | `adb shell am force-stop com.intechne.techapp` → `adb shell am start -W -n com.intechne.techapp/.MainActivity` → `TotalTime`, 10 koşu, medyan + en kötü | Bütçe = ilk ölçüm medyanı; kullanıcıya sunulur, onaylanan sayı `docs/qa`'ya yazılır |
| İlk içerik | Keşfet'te ilk `PosterCard` görünene kadar (dev menüsü kapalı, ekran kaydı `adb shell screenrecord`, kare sayımı) | aynı |
| Kaydırma | Etkinlikler 100 öğe (worst-case seed), Perf Monitor UI/JS fps, hızlı fling 10 sn | ≥55 fps (spec). Altındaysa önce `React.memo`/`keyExtractor`/`getItemLayout`/görsel boyutu; hâlâ altındaysa **FlashList** değerlendirilir (ayrı task, `npx expo install @shopify/flash-list`) |
| Görsel belleği | 50 kapaklı kart kaydır, `adb shell dumpsys meminfo com.intechne.techapp` önce/sonra | thumb (640) yerine full yükleniyorsa düzelt; `expo-image` `recyclingKey` listelerde |
| Basma | Perf Monitor'de basma sırasında UI fps | ≥55 |
| JS paketi | `npx expo export --platform android --dump-sourcemap` boyutu | yalnız kayıt (bütçe kullanıcı kararı) |

- [ ] **Step 1:** Ölçüm betiklerini yaz (`cold-start.sh` 10 koşu, medyan). **Step 2:** Ölç, tabloya yaz; ölçülemeyen satır "ölçülmedi" + neden. **Step 3:** Karar kuralını uygula; gereken iyileştirme ayrı `perf(mobile): …` commit'i + önce/sonra ölçüm.
- [ ] **Step 4: Commit** `docs(qa): Android performans ölçümleri ve bütçe önerisi`

### Task 8: Kapanış

**Files:** Modify `IMPLEMENTATION-STATUS.md` (pilot kapısı 6 ve performans satırları ölçümle), `docs/KNOWN-ISSUES.md` (Erişilebilirlik satırı 7), `docs/audits/<tarih>-hig-doctor.md`
- [ ] **Step 1:** `npx hig-doctor apps/mobile --fail-on serious` → 0. **Step 2:** belgeler ölçümle güncellenir; test edilmeyen platform (ör. iOS cihaz yok) açıkça yazılır.
- [ ] **Step 3: Commit** `docs: Faz 5 kapanışı — hareket, erişilebilirlik ve performans durumu`

---

## Self-review (yazar notu)

- **Kapsam:** basma/sheet/durum/iskelet/kaydet/sarsma (harita + T1–2), kesinti ve reduced motion (Global + T2 testleri), haptic haritası (T2 kaynak taraması), GH kabul ölçütü (karar: eklenmez), TalkBack/VoiceOver betikleri + %200 + 320 dp + kontrast (T4–6), cihazda ölçülen performans + FlashList karar kuralı + görsel belleği + açılış (T7). Ledger: check-in çift okuma (T2), HIG Doctor TechIcon bulgusu (T5).
- **Sayı politikası:** yalnız spec'teki ≥55 fps sabit; diğer bütçeler ölçüm sonrası kullanıcı kararı.
- **Tip tutarlılığı:** `timing/spring` T1 → T2 bileşenleri; `BookmarkButton` Faz 4 T2'den.
