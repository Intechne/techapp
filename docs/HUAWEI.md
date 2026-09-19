# Huawei / AppGallery

**Durum: HMS cihazında hiçbir test yapılmadı.** Aşağıdaki her şey statik incelemeye dayanır; "Huawei destekli" etiketi gerçek cihaz testi geçmeden kullanılmamalı.

## Hedef

- **Kapsamda:** Android tabanlı, Google Mobile Services (GMS) bulunmayan Huawei cihazları (HMS) ve AppGallery dağıtımı.
- **Kapsam dışı / ayrı fizibilite:** HarmonyOS NEXT. Mevcut React Native Android paketi NEXT'i karşılamaz; ArkTS/ArkUI ya da desteklenen bir uyarlama yolu ayrıca değerlendirilmelidir.

## Bağımlılık denetimi (`apps/mobile/package.json`)

| Alan | Durum |
|---|---|
| Firebase / Google Play Services | **Doğrudan bağımlılık yok.** |
| Giriş | E-posta OTP; Google ile giriş yok, GMS gerekmez. |
| Harita | Yok; yalnız adres metni. |
| Push | Henüz yok (aşağıya bak). |
| Oturum saklama | `expo-secure-store` → Android Keystore; GMS'e bağlı değil. **Cihazda doğrulanmalı.** |
| QR üretimi | `react-native-qrcode-svg` + `react-native-svg`; tamamen JS/SVG. |
| **QR okuma** | `expo-camera` barkod tarama Android'de CameraX + **Google ML Kit** kullanır. ML Kit'in GMS'siz cihazdaki davranışı **doğrulanmalı** (paketli model mi, Play Services üzerinden indirilen model mi). |
| Ağ | `supabase-js` → HTTPS; GMS gerekmez. |

**QR okuma için mevcut geri dönüş:** `CheckInScreen` kamera olmadan da çalışır — görevli karttaki tam kodu "Kodu elle gir" alanına yapıştırabilir. HMS cihazında tarama çalışmazsa seçenekler: HMS Scan Kit'i bir config plugin ile eklemek ya da ML Kit'in paketli (bundled) modelini zorlamak. Karar cihaz testinden sonra verilecek.

Check-in yalnız organizatör personelinin kullandığı bir ekrandır; katılımcı deneyimi (keşif, kayıt, katılım kartı) kameraya bağlı değildir.

## Push planı (uygulanmadı)

```ts
interface NotificationProvider {
  registerDevice(): Promise<void>;
  unregisterDevice(): Promise<void>;
  handleOpen(): Promise<void>;
}
```

- iOS → APNs · Android/GMS → FCM · Android/HMS → HMS Push Kit.
- Sağlayıcı seçimi çalışma anında: GMS varsa FCM, yoksa ve HMS Core varsa HMS.
- **Mükerrer bildirimi veritabanı engeller:** `devices` tablosunda `device_install_id` başına tek etkin sağlayıcı (kısmi benzersiz indeks) ve `register_device` RPC'si eski sağlayıcıyı devre dışı bırakır; `apns` yalnız iOS'ta geçerlidir.
- İzin ilk açılışta istenmez; "Etkinliği bana hatırlat" gibi bir eylemde istenecek.
- HMS Push Kit için özel native kod gerekir → Expo Go yetmez, development build + config plugin şart (proje zaten `expo-dev-client` kullanıyor).

## Derleme ve dağıtım

- AppGallery'ye giden paket, Google Play ile **aynı Android derlemesidir**. Cihaz testi için `eas build -p android --profile preview` (APK). Mağaza için AAB ya da APK, AppGallery Connect üzerinden yüklenir.
- HMS'e özgü kod eklendiğinde ayrı bir ürün çeşidi (flavor) gerekip gerekmediği o zaman değerlendirilecek; şimdilik tek paket hedefleniyor.
- İmzalama anahtarı ve AGC uygulama kaydı Intechne tarafından sağlanmalı (`docs/RELEASE.md`).

## HMS cihaz test listesi

- [ ] Uygulama açılıyor, fontlar ve ikonlar doğru
- [ ] Onboarding → Keşfet gerçek backend'den veri alıyor
- [ ] E-posta OTP ile giriş; uygulama kapatılıp açılınca oturum duruyor (Keystore)
- [ ] Etkinlik kaydı → katılım kartı → QR görünüyor
- [ ] `CheckInScreen`: kamera izni, QR tarama; çalışmıyorsa elle kod girişi
- [ ] Deep link: `techapp://events/<id>`
- [ ] Android geri tuşu ve sistem geri jesti (modal, sheet, stack)
- [ ] Logcat'te eksik GMS kaynaklı çökme / uyarı yok
- [ ] (Push eklendikten sonra) HMS token alınıyor, tek bildirim geliyor
