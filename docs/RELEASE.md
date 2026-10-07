> **30 Eylül 2026 notu:** Bu belgede tarihsel/eski durumlar bulunuyor. Güncel kod denetimi ve yeniden çalıştırılan testler için [hazırlık denetimini](READINESS-2026-09-30.md) esas alın.

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

Her EAS ortamında tanımlanacak değişkenler: `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Intechne'nin sağlaması gerekenler

- **Expo/EAS:** kurum hesabı; `eas init` ile `projectId` (app.json'a o zaman yazılır).
- **Apple:** Developer Program üyeliği (kurumsal), Team ID, App Store Connect uygulama kaydı (ASC App ID), `com.intechne.techapp` bundle id sahipliği.
- **Google Play:** geliştirici hesabı, `com.intechne.techapp` paket adı, gönderim için servis hesabı anahtarı (depo dışında, `secrets/` git'e girmez).
- **Huawei:** AppGallery Connect hesabı ve uygulama kaydı; push için AGC yapılandırması (`docs/HUAWEI.md`).
- **Supabase:** development / preview / production projeleri, özel SMTP, Edge Function sırları.
- **Alan adı:** `techapp.intechne.com.tr` (ayrıntı: `docs/DOMAIN.md`). Universal link / app link için bu alan adı altında `apple-app-site-association` ve `assetlinks.json` dosyaları. Şu an yok; yalnız `techapp://` şeması çalışır.
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

- ~~Uygulama ikonu placeholder~~ **Tamam:** "oyulmuş T." amblemi `design-source/brand/build.mjs` ile üretiliyor (iOS/Android/splash/favicon/mağaza); değişince tek komutla yeniden üret.
- ~~Yerel build alınamadı~~ **EAS bulut build kullanılıyor** (yerel disk yetmiyor). EAS projesi: `@intechne/techapp` (`da99e9ee-4f05-4283-9a75-ed71051575e1`).
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

## Remote Supabase'e ilk bağlanma (sırayla)
1. `npx supabase login` (kendi terminalinde; tarayıcı açılır). Token'ı sohbete/repoya yapıştırma.
2. `npx supabase projects list` → `npx supabase link --project-ref <ref>` (ref gizli değildir). Yanlış projeye push etmemek için ref'i iki kez kontrol et.
3. `npm run db:push` → yalnızca **dry-run** planını gösterir. Plan beklenen 6 migration ise `npx supabase db push`. Remote'ta **asla** `supabase db reset` çalıştırma.
4. Geliştirme projesine örnek veri: `psql "$DB_URL" -f supabase/seed.sql` (idempotent, tüm satırlar `is_demo = true`). Production'a seed uygulanmaz.
5. `npx supabase secrets set --env-file supabase/.env.functions` (git-ignored; `RESEND_API_KEY`, `GUARDIAN_PAGE_URL`, `MAIL_FROM`) → `npm run functions:deploy`.
6. Dashboard → Auth: Email OTP açık, 6 hane; e-posta şablonunda `{{ .Token }}` kullan (magic link değil). **Custom SMTP, halka açık yayından önce zorunlu**: Supabase'in varsayılan e-posta servisi düşük hız limitlidir ve yalnız geliştirme içindir.
7. `apps/mobile/.env.local` ve `apps/admin/.env.local`: proje URL'i + **publishable** key. `npm run db:types && npm run verify`.
8. İlk platform yöneticisi: SQL Editor'da `insert into public.platform_admins (user_id) values ('<auth user id>')`.
9. `pg_cron`: `select cron.schedule('expire-guardian', '*/10 * * * *', $$select app.expire_guardian_requests()$$);`

## Remote projede çalışma (development: `techapp` / `pacvhcnawtnkauvguoaw`)
```bash
npx supabase link --project-ref pacvhcnawtnkauvguoaw   # bir kez
npm run db:push                                        # plan (dry-run) → sonra: npx supabase db push
npm run db:types                                       # şema değiştiyse
npm run functions:deploy
npm run env:remote    # iki uygulamanın .env.local dosyasını .env.remote'tan yazar (geri dönüş: npm run env:local)
npm run mobile:web && npm run admin
# Uçtan uca doğrulama (secret key yalnız ortam değişkeninde; dosyaya yazma):
SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… npm --prefix apps/mobile run e2e:remote
```
`.env.remote` içeriği Dashboard → Settings → API Keys'ten alınır: proje URL'i ve **publishable** key.

## Native build ve yayın — mevcut durum (2026-09-19, 3. oturum)

EAS projesi kuruldu (`@intechne/techapp`), owner `intechne`, projectId app.json'da. `preview` / `production` / `development`
ortam değişkenleri EAS'te remote Supabase'e (`pacvhcnawtnkauvguoaw`) işaret ediyor (yalnız publishable key; secret yok).

**Alınan iç test buildleri (hesap gerektirmez, remote backend'e bağlı):**
- Android preview **APK** (`preview` profili) — herhangi bir Android cihaza kurulabilir.
- iOS **Simulator** build (`development` profili) — Mac Simulator'da açılır (dev-client: Metro ile).

**Platform gerçeği:** iOS + Android + (Android tabanlı) Huawei AppGallery mümkün. **HarmonyOS NEXT (ArkTS) native binary
bu Expo/RN kod tabanından üretilemez** — ayrı bir proje gerektirir. Huawei yolu = GMS'siz (HMS) Android AAB → AppGallery.

**Production'a geçiş — sırayla, her biri Intechne'nin bir dış girdisini bekler:**
1. **Remote migrations (ZORUNLU, ilk).** Canlı Supabase'de son 3 migration yok (`public_cv` fonksiyonu bulunmuyor —
   doğrulandı). Uygulanmadan alınan production build, CV paylaşımı / gönüllü / unvan özellikleri kırık çıkar.
   `npx supabase link` (linkli) → `npx supabase db push` (DB parolası ya da `SUPABASE_ACCESS_TOKEN` gerekir) →
   `npm --prefix apps/mobile run db:types` → `npm --prefix apps/mobile run e2e:remote` (26/26 beklenir).
2. **iOS production (Apple Developer hazır).** `eas build -p ios --profile production` → interaktif Apple girişi ister
   (EAS kimlikleri yönetir). Sonra `eas submit -p ios` (App Store Connect App ID).
3. **Android production (Play Console hazır).** `eas build -p android --profile production` (AAB) →
   `eas submit -p android` için Play servis hesabı anahtarı (repo dışı, `secrets/`).
4. **Huawei AppGallery (hesap sonra).** Aynı Android AAB; AGC hesabı açılınca elle ya da `eas submit` özel hedefiyle.
5. **Mağaza paketi ve inceleme:** ekran görüntüleri, açıklama, gizlilik/veri güvenliği formu, ve OTP girişli uygulama için
   **inceleme ekibine çalışan test hesabı** çözümü (Apple/Google inceleyicisi e-posta OTP alamaz — sabit inceleme hesabı gerekir).
