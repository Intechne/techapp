# Yayın hazırlığı

Durum: **yayına hazır değil.** Bu belge, yayın için gerekenleri ve şu an eksik olanları listeler. Mağaza incelemesinin sonucu garanti edilemez.

## EAS profilleri (`apps/mobile/eas.json`)

| Profil | Amaç | Ortam |
|---|---|---|
| `development` | Development client, iOS simülatör | `development` |
| `development-device` | Development client, gerçek cihaz (internal) | `development` |
| `preview` | Dahili dağıtım; Android **APK** (Huawei cihaz testi için de bu) | `preview` |
| `production` | Mağaza derlemesi, `autoIncrement` | `production` |

`appVersionSource: remote`. `submit.production` bilinçli olarak boştur: v4'teki `REPLACE_*` yer tutucuları taşınmadı ve kod içine gerçek kimlik bilgisi yazılmayacak.

Her EAS ortamında tanımlanacak değişkenler: `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Intechne'nin sağlaması gerekenler

- **Expo/EAS:** kurum hesabı; `eas init` ile `projectId` (app.json'a o zaman yazılır).
- **Apple:** Developer Program üyeliği (kurumsal), Team ID, App Store Connect uygulama kaydı (ASC App ID), `com.intechne.techapp` bundle id sahipliği.
- **Google Play:** geliştirici hesabı, `com.intechne.techapp` paket adı, gönderim için servis hesabı anahtarı (depo dışında, `secrets/` git'e girmez).
- **Huawei:** AppGallery Connect hesabı ve uygulama kaydı; push için AGC yapılandırması (`docs/HUAWEI.md`).
- **Supabase:** development / preview / production projeleri, özel SMTP, Edge Function sırları.
- **Alan adı:** universal link / app link için `techapp.com.tr` altında `apple-app-site-association` ve `assetlinks.json` dosyaları. Şu an yok; yalnız `techapp://` şeması çalışır.
- Destek e-postası, gizlilik ve kullanım koşulları bağlantıları, moderasyon/iletişim sorumlusu.

## Yayın kapıları

Kaynak: `design-source/TEKNIK-VE-YAYIN.md`.

1. **Hesap ve sahiplik:** yukarıdaki hesaplar, signing, EAS proje kimliği.
2. **Gerçek altyapı:** staging/production ayrımı, yedek + geri yükleme denemesi, sırların pakete girmemesi, içerik sahipleri.
3. **Ürün uygunluğu:** uygulama içinden hesap silme (akış yazıldı; gerçek projede doğrulanmadı), içerik bildirme/engelleme (tablolar var, arayüz yok), yaş/onay uygulaması, gizlilik metni ile veri beyanlarının uyumu.
4. **Mağaza paketi:** gerçek ekran görüntüleri, ikon/splash, açıklama, yaş derecesi, privacy label / veri güvenliği formu, inceleme notları ve **kullanılabilir test hesabı** (OTP tabanlı girişte inceleme ekibi için çözüm gerekir).
5. **Test dağıtımı:** TestFlight, Play dahili test, Huawei test cihazları.
6. **Dağıtım:** kademeli yayın ve geri dönüş planı.

## Bilinen eksikler

- **Uygulama ikonu, adaptive icon ve splash görseli hâlâ Expo şablonunun yer tutucularıdır** (`apps/mobile/assets/`). Open Circuit logo işaretinden (`design-source/icons/mark.svg`) üretilmeli; marka için final görsel kimlik onayı gerekir.
- iOS ve Android development build bu makinede **derlenmedi** (disk alanı). `expo-doctor` 21/21 geçiyor; bu, derlemenin çalıştığını kanıtlamaz.
- Crash raporlama, gerçek analytics sink'i, OTA güncelleme (`expo-updates`) henüz eklenmedi; `channel` alanları bunun için hazır.
- Kamera izni metni yalnız check-in içindir; mikrofon izni Android'de bilinçli olarak engellenir (`blockedPermissions`).
- Push bildirimi yok → mağaza formlarında bildirim beyanı şimdilik gerekmez.

## Yayın öncesi asgari kontrol listesi

- [ ] iOS + Android development build açılıyor, uçtan uca kayıt akışı gerçek cihazda geçiyor
- [ ] GMS'siz Huawei cihazda aynı akış
- [ ] Gerçek Supabase projesinde migrations + Edge Functions + gerçek e-posta
- [ ] RLS testleri gerçek projeye karşı da koşuldu
- [ ] VoiceOver / TalkBack, büyük yazı, 320 pt genişlik denetimi
- [ ] Hukuk: onay metni, en küçük yaş, saklama süreleri
- [ ] İkon / splash / mağaza varlıkları
