# Crash raporlama (Sentry)

Durum (11 Kasım 2026): **kod hazır, bağlantı yok.** `@sentry/react-native` 7.11.0 kurulu (Expo SDK 57'nin
`bundledNativeModules.json` sabitlediği sürüm, `npx expo install` ile). Sentry hesabı, DSN ve auth token henüz yok;
bu yüzden uygulamada crash raporlama **kapalı** ve native build'e Sentry yükleme adımı **eklenmiyor**.

Bağlayıcı karar: tasarım dokümanı §8a madde 5 (Sentry onaylı; prod/dev ayrı; PII/OTP/token/secret yok; 18 yaş altı için
veri minimizasyonu; saklama süresi belgelenir; DSN yoksa kurulum hazır, bağlantı adımı açık).

## Nasıl çalışır

- Tek giriş noktası `apps/mobile/src/lib/crash.ts`. SDK'yı başka hiçbir dosya import etmez.
  - `initCrashReporting()` — `index.ts`'te ilk render'dan önce bir kez. `EXPO_PUBLIC_SENTRY_DSN` yoksa, boşsa ya da
    geçersizse **hiçbir şey yapmaz** (`Sentry.init` çağrılmaz, native SDK başlamaz, ağ isteği olmaz).
  - `captureError(e, { screen?, code? })` — yalnız `AppErrorBoundary` çağırır (`code: 'render_crash'`). Yakalanmamış JS
    hataları ve native çökmeler SDK'nın kendi handler'larıyla gelir.
  - `scrubEvent` / `scrubBreadcrumb` — saf fonksiyonlar, `beforeSend` / `beforeBreadcrumb` olarak çalışır; testleri
    `src/lib/__tests__/crash.test.ts`.
- DSN doğrulaması `src/lib/envValidation.js` → `validateSentryDsn`: https, public key var, **secret key yok**, sayısal proje
  kimliği, yerel/özel ağ host'u değil; `production` ortamı `NON_PRODUCTION_SENTRY_PROJECT_IDS` listesindeki bir projeye
  rapor gönderemez. Hatalı DSN çalışma zamanında yalnız crash raporlamayı kapatır (uygulama "yapılandırılmadı" ekranına
  düşmez); preview/production build'i ise `app.config.ts` tarafından durdurulur.

## Gönderilen veri

| Veri | Neden |
|---|---|
| Hata türü, (filtrelenmiş) mesajı, stack trace | Hatayı bulmak |
| `environment` = `EXPO_PUBLIC_APP_ENV` (`local` / `development` / `preview` / `production`) | Ortam ayrımı |
| `release` / `dist` = native SDK'nın uygulama sürümü ve build numarası (`com.intechne.techapp@5.0.0+<build>`) | Hangi sürümde olduğu; JS ve native çökmeler aynı release'te |
| Cihaz modeli, OS sürümü, uygulama/Expo bağlamı (runtime version, update id, kanal), bellek/ekran gibi teknik bilgiler | Cihaza özgü hatalar |
| Etiketler: `screen`, `code` (yalnız kısa makine kimliği, örn. `render_crash`) | Gruplama |
| Uygulamanın kendisinin eklediği breadcrumb'lar (şu an yok) ve Android'in native yaşam döngüsü breadcrumb'ları (activity / sınıf adları) | Hatadan önceki adımlar |
| Native çökmelerde (Java/ObjC/NDK): Android SDK'nın kurulum başına ürettiği **rastgele kurulum kimliği** | §8a'nın izin verdiği tek kimlik; kişiye bağlanmaz |

## Asla gönderilmeyen veri

- Kullanıcı kimliği, e-posta, ad, kullanıcı adı, IP adresi: `Sentry.setUser` hiç çağrılmaz, `scrubEvent` `user` alanını
  siler, `sendDefaultPii: false` (SDK Relay'e `infer_ip: never` bildirir; sunucu IP çıkarmaz). Cihaz adı ve `server_name`
  silinir.
- OTP kodu (tek başına duran 6 haneli sayı), JWT (`eyJ…`; access/refresh/anon), Supabase anahtarları (`sb_…`),
  `Bearer …` başlıkları, katılım kartı QR içeriği (`TA1.…`), e-posta adresleri: mesaj, exception, breadcrumb, `extra` ve
  etiketlerde `[filtered]` olur.
- HTTP isteği gövdesi, başlıkları, çerezleri, query string'i, ortam değişkenleri: silinir. Her URL'den `?…` ve `#…` atılır
  (veli onay bağlantısı token'ı dahil).
- Konsol çıktısı, ağ (xhr/fetch) breadcrumb'ları, dokunma/navigasyon breadcrumb'ları: kayıt edilmez. `Sentry.wrap`
  (dokunma breadcrumb'ı) ve React Navigation entegrasyonu (rota parametreleri) kullanılmaz.
- iOS native otomatik breadcrumb'ları (UI ve NSURLSession URL'leri) `enableAutoBreadcrumbTracking: false`,
  `enableNetworkBreadcrumbs: false` ile kapalı (native çökme olayları JS `beforeSend`'den geçmediği için).
- Performans izleme (trace), profiling, session replay, ekran görüntüsü, view hierarchy, kullanıcı geri bildirim
  widget'ı, loglar, oturum (release health) takibi, başarısız HTTP isteği olayları: **kapalı**. Trace/profil/replay
  seçenekleri SDK'da "varlığıyla açılır"; bu yüzden hiçbiri `init`'e yazılmaz (test bunu doğrular).
- Bir `AppError` gibi düz nesne fırlatılırsa olduğu gibi gönderilmez; yalnız makine kodu (`otp_invalid`) bir `Error`
  mesajı olarak gider (`fieldErrors` asla).

Sunucu tarafı ikinci savunma hattı (bağlantıda açılacak, aşağıda): Sentry projesinde "Data Scrubber" + "Use Default
Scrubbers" açık, "Prevent Storing of IP Addresses" açık. Native çökmeler JS filtresinden geçmediği için bu ayarlar
zorunludur.

## 18 yaş altı kuralı

Kullanıcılar arasında 13–17 yaş var. Kural: Sentry'ye kişiyi tanımlayan **hiçbir** alan gitmez — kullanıcı kimliği
(Supabase `auth.uid` dahil), e-posta, ad, doğum tarihi/yaş, okul, veli bilgisi, IP. Kimlik gerekirse yalnız SDK'nın
rastgele kurulum kimliği. Yeni bir `captureError` çağrısı ya da etiket eklemek kod incelemesinde bu kurala göre
denetlenir; etiket değerleri `^[A-Za-z][A-Za-z0-9_.-]{0,63}$` dışındaysa düşürülür.

## Ortam ayrımı

- `environment` her olayda `EXPO_PUBLIC_APP_ENV`'den gelir; `app.config.ts` EAS profili ile bu değerin eşleşmesini zaten
  zorunlu tutar (production profili = `production`).
- **Öneri: iki ayrı Sentry projesi** — `techapp-mobile` (yalnız production) ve `techapp-mobile-dev` (local/development/
  preview). Ayrı erişim yetkisi ve ayrı saklama süresi sağlar. Dev projesinin sayısal kimliği
  `NON_PRODUCTION_SENTRY_PROJECT_IDS`'e yazılınca production build'i yanlışlıkla dev DSN'iyle derlenemez.
- Tek proje + environment filtresi de çalışır; o durumda liste boş kalır ve ayrım yalnız `environment` etiketiyle olur.

## Build güvenliği (token yokken)

- Native SDK (RNSentry) autolinking ile her build'e girer; çalışmak için config plugin gerekmez.
- `@sentry/react-native/expo` config plugin'i yalnız source map / debug symbol **yükleme** adımlarını ekler. Token yokken bu
  adımlar release build'i kırar (iOS `sentry-xcode.sh` çıkış kodu 1; Android Gradle yükleme görevi hata verir). Bu yüzden
  plugin `app.json`'a sabit yazılmadı: `app.config.ts` onu **yalnız** `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` +
  `SENTRY_PROJECT` üçü birden varsa ekler. `metro.config.js` aynı koşulla `getSentryExpoConfig` (bundle'a debug ID) kullanır;
  aksi halde Expo'nun varsayılanı `getDefaultConfig`.
- Doğrulama (11 Kasım): `expo config --type public` (token yok → plugin yok; sahte değişkenlerle → plugin var, token
  hiçbir dosyaya yazılmıyor), geçici kopyada `expo prebuild --platform android --no-install --clean` (token yokken
  `build.gradle`'da Sentry satırı ve `sentry.properties` yok), `expo export --platform android` (iki yol da başarılı).
  Gerçek Gradle/Xcode derlemesi bu makinede koşulmadı; ilk EAS build'inde görülecek.

## AÇIK MADDE 1 — Saklama süresi (Intechne kararı)

Öneri: planın izin verdiği **en kısa** olay saklama süresi (Sentry'de kuruluş/proje "Data Retention"; hedef **30 gün**).
Çökme ayıklamak için 30 gün yeterli; 18 yaş altı verisinde minimizasyon ilkesine uygun. Bu bir **onay bekleyen karar**dır:
planın sunduğu seçenekler hesap açılınca görülecek, karar ve tarih buraya yazılacak; gizlilik/saklama politikası
(§8a madde 3, eksik) ile uyumlu olmalı. Ayrıca: veri bölgesi olarak **AB (de)** seçilmesi önerilir (KVKK).

| Karar | Değer | Onaylayan | Tarih |
|---|---|---|---|
| Olay saklama süresi | _(açık — öneri 30 gün)_ | | |
| Veri bölgesi | _(açık — öneri AB / de)_ | | |

## AÇIK MADDE 2 — DSN bağlantısı (adım adım)

Hiçbir anahtar repoya, sohbete ya da `.env.example`'a yazılmaz.

1. Intechne adına Sentry kuruluşu aç (bölge: AB önerilir). Kuruluş slug'ını not et (örn. `intechne`).
2. İki React Native projesi oluştur: `techapp-mobile` (production) ve `techapp-mobile-dev`. Her birinde:
   Settings → Security & Privacy → **Data Scrubber** ve **Use Default Scrubbers** açık, **Prevent Storing of IP Addresses**
   açık; Data Retention en kısa değer (açık madde 1).
3. `techapp-mobile-dev`'in sayısal proje kimliğini (DSN'in sonundaki sayı) `apps/mobile/src/lib/envValidation.js` →
   `NON_PRODUCTION_SENTRY_PROJECT_IDS` listesine ekle (yalnız sayı; anahtar değil) ve test koş.
4. DSN'leri EAS ortamlarına yaz (DSN istemciye gömülen public değerdir, yine de repoya yazılmaz):
   ```bash
   eas env:create --environment production  --name EXPO_PUBLIC_SENTRY_DSN --value '<prod DSN>' --visibility plaintext
   eas env:create --environment preview     --name EXPO_PUBLIC_SENTRY_DSN --value '<dev DSN>'  --visibility plaintext
   eas env:create --environment development --name EXPO_PUBLIC_SENTRY_DSN --value '<dev DSN>'  --visibility plaintext
   ```
5. Source map / debug symbol yüklemesi için (isteğe bağlı ama önerilir): Sentry'de **Organization Auth Token** oluştur;
   yalnız EAS secret olarak:
   ```bash
   eas env:create --environment <env> --name SENTRY_AUTH_TOKEN --value '<token>' --visibility secret
   eas env:create --environment <env> --name SENTRY_ORG        --value '<org slug>' --visibility plaintext
   eas env:create --environment <env> --name SENTRY_PROJECT    --value '<project slug>' --visibility plaintext
   # AB bölgesi / self-hosted ise gerekirse: SENTRY_URL=https://de.sentry.io/
   ```
   Üçü birden varsa `app.config.ts` plugin'i ve `metro.config.js` Sentry Metro config'ini kendiliğinden açar. Token yerel
   makinede `.env*` dosyasına yazılmaz.
6. OTA güncellemelerinin source map'leri: `eas update` sonrası `npx sentry-expo-upload-sourcemaps dist` (token yalnız o
   komutun ortamında, örn. EAS workflow secret).

## Bağladıktan sonra doğrulama

1. `development` profiliyle dev build; uygulamada geçici bir test hatası tetikle (yalnız yerel dalda, commit edilmez) →
   `techapp-mobile-dev`'de olay `environment: development` ile görünür.
2. Olayı aç ve kontrol et: `user` yok, IP yok, cihaz adı yok, breadcrumb'larda URL query'si / e-posta / 6 haneli kod yok,
   `request` gövdesi/başlığı yok, etiketler yalnız `screen`/`code`.
3. Native çökme (Android test butonu ya da `adb shell am crash` benzeri) → olayda yalnız rastgele kurulum kimliği.
4. Stack trace sembolize mi (source map yüklendi mi) bak; değilse `SENTRY_AUTH_TOKEN`/`ORG`/`PROJECT` ve build loglarındaki
   `sentry-cli` satırları.
5. `preview` build → yine dev projesi, `environment: preview`. `production` build → `techapp-mobile`, `environment:
   production`. Production build'i dev DSN'iyle derlemeyi dene → `app.config.ts` reddetmeli (madde 3 yapıldıysa).
6. Sonucu bu belgeye ve `docs/RELEASE.md` kontrol listesine tarihle yaz. Test edilmeyen şeye "çalışıyor" denmez.
