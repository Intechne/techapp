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
