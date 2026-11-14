# Hareket temeli — Android gözlemi (Faz 5 Task 1)

Tarih: 2026-11-14. Cihaz: Android emülatörü (emulator-5554, Pixel sınıfı, Android 16, edge-to-edge).

## Ne gözlendi, ne gözlenmedi

- **Gözlenen yapı: EAS dev client + yerel Metro.** Bu bir **release build değildir**; hız/akıcılık kanıtı sayılmaz.
- **Release build gözlemi: yapılmadı — pilot sonrası tek EAS build'inde.** (Kullanıcı kararı 2026-11-14: şimdi release build yok.)
- iOS simülatörü: bu makinede gözlenmedi.
- Mevcut dev client (12 Kas) `expo-image` yerel modülünü içermiyor (13 Kas'ta eklendi). Gözlem süresince `metro.config.js`'e **geçici** bir `expo-image` → RN `Image` yönlendirmesi eklendi ve gözlem sonunda kaldırıldı (dosya eski haline kopyalandı). Kapak görselleri bu yüzden bu gözlemin konusu değildir.
- Yerel yığın: `npm run db:dev -- --reset --worst-case`, `npm run env:local`; giriş `organizator@techapp.test` (OTP yerel günlükten).
- Ekran görüntüleri: `$S/shots/5-1-*.png` (`$S` = oturum scratchpad dizini).

## Sheet'ler (hepsi native-stack `formSheet`, kök yığında, tab bar'ı örter)

| Rota | Detent | Açan ekran |
|---|---|---|
| `ReportSheet` | `[0.6, 1]` | Etkinlik, Fırsat, Kurum, Takım (takım/proje/rol) |
| `RecruitmentApply` | `fitToContents` | Takım profili (Başvur; girişten dönüşte otomatik) |
| `TeamJoinRequest` | `fitToContents` | Takım profili (Katılma isteği gönder) |
| `ExperienceVerify` | `[0.6, 1]` | Deneyim detayı (Doğrulama iste) |

`EventFilters` (Faz 4) olduğu gibi kaldı. Kadro düzenleme bir sheet değil (kendi ekranı), taşınacak bir şey yok.

## Gözlemler (dev client)

| Adım | Sonuç |
|---|---|
| Aç (misafir Bildir) | Sheet %60'ta açılır, giriş istemi görünür; geri tuşu kapatır; aşağı kaydırma kapatır. |
| Detent değiştir (Bildir, girişli) | %60 → tam yükseklik, yukarı çekerek; içerik kaydırılabilir. |
| Klavye (`fitToContents`: katılma isteği, başvuru) | Native sheet klavyenin üstüne yükselir; gönder düğmesi görünür kalır. |
| Klavye (tam detent Bildir) | Sheet **yükselmiyor** (Android 16 edge-to-edge): metin alanı ve gönder düğmesi klavyenin altında kalıyordu. Düzeltme: `SheetFrame` klavyenin örttüğü miktarı ölçüp kaydırma alanını kısaltır ve klavye açılınca sona kaydırır. Düzeltmeden sonra alan ve "Bildirimi gönder" klavyenin hemen üstünde görünür. |
| Geri tuşu sırası | 1. basış klavyeyi kapatır (sheet açık, yazılan metin duruyor); 2. basış sheet'i kapatır. Native-stack varsayılanı, ek kod yok. |
| Aşağı kaydırarak kapat | `fitToContents` ve `[0.6, 1]` sheet'lerde çalıştı. |
| Gönderim sonrası | Rapor: sheet kapanır, "Bildirimin alındı." toast'ı görünür. Başvuru: kapanır, rol kartında GÖNDERİLDİ (sorgu geçersizleştirmesiyle, callback yok). Katılma isteği: kapanır, "İsteğin gönderildi." ve sayfa "İsteğin kaptana ulaştı" durumuna geçer. |
| Bulunan hata | Programatik kapanışta (gönder sonrası) klavye alttaki ekranın üstünde açık kalıyordu. Düzeltme: `closeSheet()` önce `Keyboard.dismiss()`, sonra `goBack()`. Sonra katılma isteğinde klavyenin kapandığı doğrulandı. |
| `ExperienceVerify` | Emülatörde **gözlenmedi** (test kullanıcısında deneyim yok); yalnız jest ile doğrulandı. |

## Reduced motion (`animator_duration_scale=0`, `transition_animation_scale=0`)

- Sheet açılır/kapanır, içerik eksiksiz (sheet animasyonunu platform kendi ayarına göre yönetir).
- Toast ("İsteğin geri çekildi."): 0,4 sn'de son konumunda ve tam görünür; ~4 sn sonra kayboldu. Ekran görüntüleriyle "kayma yok"u ispatlamak mümkün değil; kayma yokluğu birim testiyle kanıtlı (`design-system/__tests__/motion.test.tsx`: reduced motion'da stilde `transform` yok, yalnız `opacity`).
- İskelet: emülatörde yakalanamadı; reduced motion'da opaklık 1'de sabit ve nabız başlamıyor (birim testi).
- Ayarlar 1'e geri alındı.

## Açık kalanlar

- Toast'ın alt konumu bir ekranın sabit alt düğmesini (Katılma isteği gönder) kısa süre örtüyor; bu konum Faz 5 öncesinden geliyor, değiştirilmedi.
- Dev client'ta `System UI isn't responding` penceresi bir kez görüldü (emülatör yükü); uygulamayla ilgisi yok.

## Task 2 — durum hareketleri ve haptic haritası (Android emülatörü)

- **Yapı:** EAS dev client + yerel Metro (Task 1 ile aynı); `expo-image` için geçici Metro yönlendirmesi kullanıldı, gözlem sonunda `metro.config.js` bayt bayt eski haline getirildi (md5 doğrulandı).
- **Release build gözlemi: yapılmadı — pilot sonrası tek EAS build'inde.** Bu gözlemler hız/akıcılık kanıtı değildir.
- iOS simülatörü bu makinede gözlenmedi. **iOS klavye/fit-sheet davranışı doğrulanmadı** (Task 1'den devreden madde).
- Haptic titreşimi emülatörde duyulmaz/görülmez: haptic çağrıları yalnız jest ile (`hapticsMap.test.ts`, ekran testleri) doğrulandı.

| Durum | Sonuç |
|---|---|
| Kaydet, hızlı basış (4 ve 3 ardışık dokunuş, etkinlik detayı) | Çökme/hata yok; son görünüm sunucu cevabıyla (kaydedildi/kaydedilmedi) aynı. Dokunuş sayısı çift/tek olmayabilir: `useBookmarks.toggle` o anki sunucu durumundan türetir, uçuştaki yazma bitmeden gelen dokunuşlar aynı hedefe yazar (Task 2 öncesi davranış, değiştirilmedi). |
| Kaydet glifi | **Bulunan hata:** kaydedilmişten kaydedilmemişe dönüşte glif dolu kalıyordu (react-native-svg Android, kalkan `fill` özniteliğini sıfırlamıyor). `TechIcon` doldurma durumuna göre `key`'lenerek düzeltildi; sonra kaydet → kaldır → outline glif doğrulandı. |
| Toast ve sabit alt düğme | **Bulunan hata:** "Kaydedildi" toast'ı sekme çubuğu üstündeki sabit "Etkinliğe katıl" düğmesini örtüyordu (alt alan sekme çubuğunun üstünde, pencere altından uzak). Düzeltme: `Screen` alt alanın pencere altından uzaklığını `measureInWindow` ile ölçüp toast sağlayıcısına bildirir. Sonra toast ("Kayıt kaldırıldı.") düğmenin üstünde göründü. |
| Kayıt onayı (`fresh`) | "Yerini ayırdık." ekranı `SuccessMark` ile geldi (yerleşim eski ikonla aynı: 76 px yumuşak plaka, ortalı). Animasyon karesi yakalanamadı (220 ms; yakalanan kareler yükleme iskeleti ve yerleşmiş ekran). |
| Check-in: geçersiz kod | Kırmızı sonuç bloğu, beyaz rozet + ✕, tek blok. |
| Check-in: geçerli kod | Yeşil blok, ✓, ad, "Hoş geldin diyebilirsin." (yerel DB'de kaydı bugünkü etkinliğe taşıdım; yalnız yerel test verisi). |
| Check-in: aynı kod tekrar | Kayısı blok, saat ikonu, "ilk giriş saati". |
| Doğrulama sarsması (e-posta alanı, geçersiz giriş) | 6 ardışık ekran görüntüsünden birinde alan ~6 dp sağa kaymış, yerleşmiş karelerde 0 px: sarsma çalışıyor. Hata metni alanın altında göründü. |
| Reduced motion (`animator`, `transition`, `window` = 0) | Check-in sonucu tam ve eksiksiz görünür (yalnız opaklık yolu). Doğrulama sarsması reduced motion'da emülatörde **gözlenmedi** (formu hata verecek biçimde yeniden sürmek için oturum kapatmak gerekiyordu); `shake.test.tsx` reduced motion'da `transform` olmadığını ve hata metninin `accessibilityLiveRegion="polite"` ile geldiğini doğrular. Ayarlar 1'e geri alındı. |
| Ekran okuyucu | Check-in sonucu: sonuç bloğundaki `alert` rolü kaldırıldı; duyuru yalnız `announceForAccessibility` ile (çift okuma kapandı). TalkBack ile emülatörde dinlenmedi; Task 4 betiğinde. |
