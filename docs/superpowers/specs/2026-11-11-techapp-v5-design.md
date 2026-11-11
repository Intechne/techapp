# TechApp V5 — Pilot hattı ve platform tamamlama · Tasarım

2026-11-11 · Durum: **onay bekliyor** · Dal tabanı: `feat/techapp-stabilization` @ `a0a97c5` (+ commit edilmemiş Open Circuit v2 ikonları)
Kontrol noktası: etiket `checkpoint/v5-start-2026-11-11`, commit'siz iş `refs/checkpoints/v5-start-wip` (6892e2b), yedek `~/techapp-backups/techapp-v5-start-2026-11-11.bundle`.

## 1. Niyet

TechApp'i, Intechne'nin kendi kimliğiyle (Open Circuit) üst düzey bir mobil ürüne dönüştürmek. Bunu yaparken mevcut çalışan
mimari, güvenlik modeli ve tamamlanmış işler korunacak. Hedef yalnızca bir etkinlik uygulaması değil; gençlerin etkinlik, fırsat,
takım, proje ve öğrenme etrafında buluştuğu bir platform. Ana vaat: **"Bir fikrin varsa, bir yerin var."**

**İlk saha pilotu (aday):** Cezeri Robot Ligi · Ümraniye · 27–29 Kasım 2026. Bu tarih bir genel lansman değil, kontrollü bir
pilottur. §7'deki pilot kapısı geçilmezse pilot **yapılmaz**: gerçek kullanıcılar ya da etkinlik operasyonu riske atılmaz.
Kullanıcılar ağırlıklı olarak lise/üniversite öğrencileri, robotik takım üyeleri, mentorlar ve katılımcılar; önemli bir kısmı
18 yaş altıdır.

## 2. Hedefler, hedef dışı olanlar, başarısızlık sayılanlar

**Hedefler (öncelik sırasıyla, kullanıcı onaylı):**
1. Mevcut işin korunması, güvenli geliştirme dalı, belge tutarlılığı.
2. Kritik hatalar, auth, izinler ve gerçek kullanıcı akışı (pilot yolculuğu §3).
3. Eksik temel modüller: ayarlar/gizlilik, kaydedilenler, uygulama içi bildirimler, zengin takım profili, kapak görselleri,
   öğrenme, birleşik arama.
4. Open Circuit v2 tasarım sisteminin güçlendirilip tüm ekranlara uygulanması.
5. Anlamlı hareket, ölçülü haptic, erişilebilirlik ve performans.
6. EAS build, Android emülatör kabulü, gerçek cihaz testleri, pilot hazırlığı.

**Fazlar (bu belgedeki numaralama; `IMPLEMENTATION-STATUS.md`'deki eski 0–10 faz numaraları tarihsel kalır):**
Faz 1 koruma + belge · Faz 2 pilot hattı (§3) + native temel · Faz 3a takım kaydı (§8-1'e bağlı) · Faz 3b eksik modüller ·
Faz 4 görsel tasarım geçişi · Faz 5 hareket/erişilebilirlik/performans · Faz 6 production, iOS, cihaz, pilot kapısı.

**Pilot build'inin kapsamı (benim kararım, değiştirilebilir):** pilot build = Faz 1 + Faz 2 + (gerekirse) Faz 3a + Faz 6.
Faz 3b–5 pilot için **bekletilmez**; pilottan sonra sürer. Gerekçe: 16 gün içinde EAS build, production kurulumu ve cihaz
turları sığmalı; ayrıca production'da pilot anında içerik büyük olasılıkla yalnız Cezeri etkinliğinden oluşacak, dolayısıyla
Gelişim/arama/takım profili boş durum göstermekten öteye geçmez. Faz 4'ün yalnız pilot yolculuğundaki ekranlara dokunan
küçük kısmı (vitrin, kart, katılım kartı, check-in sonucu) Faz 2'de yapılır.

**Takvim (öneri):** 21 Kasım özellik dondurma + son pilot build · 24 Kasım go/no-go (§7 kapısı) · 27–29 Kasım pilot.

**Hedef dışı:** ödeme/cüzdan/Fonla, TechRank, AI Koç, ARENO (feature flag'de kapalı kalır), serbest mesajlaşma, sosyal giriş,
HarmonyOS NEXT, web uygulaması (web yalnız tanıtım + veli + CV sayfası), Expo Router'a geçiş, state yönetimini değiştirmek.

**Başarısızlık sayılanlar (teknik olarak çalışsa bile):**
- İstemcide yetki/başarı taklidi; mock verinin canlı gibi görünmesi; doğrulanmamış bir şeyin ✅ işaretlenmesi.
- 18 yaş altı bir kullanıcının adının, iletişim bilgisinin veya profilinin yetkisiz kişilere görünmesi.
- Hareketin kullanıcıyı yavaşlatması (bir eylemi beklemeye zorlayan animasyon), reduced-motion'a uymaması, düşük uçlu Android'de takılması.
- "Gamer/cyberpunk/neon", her karta gradient, glassmorphism, banka uygulaması havası; Youthall/Yirmi Üç/Apple/Linear kopyası.
- Production veritabanında onaysız işlem.

## 3. Pilot yolculuğu (kabul ölçütü olan sekiz adım)

| # | Adım | Bugün | Bu tasarımla |
|---|---|---|---|
| 1 | Açılış: güçlü, modern, anlaşılır karşılama | Onboarding var, sade | Faz 4'te görsel geçiş + ilk açılış hareketi; soğuk açılışta beyaz ekran yok (P0 düzeltmesi korunur) |
| 2 | Hesapsız keşif: etkinlik, fırsat, takım | Var | Vitrin yalnız kaydı açık etkinliği öne çıkarır; birleşik arama; kapak görselleri |
| 3 | Etkinlik detayı + kayıt durumu | Var | Durum tek bileşende (`Status.tsx`), kapak, takım/bireysel modu açık |
| 4 | Gerekince e-posta OTP ile hesap | Var (OTP-only) | OTP ekranı: otomatik doldurma (iOS `oneTimeCode`, Android SMS değil e-posta → yapıştır algılama), hata ve süre dolumu durumları; e-posta URL'ye yazılmaz (web P3) |
| 5 | Sunucu doğrulaması, gerekirse veli onayı | Var, remote E2E PASS | Veli bekleme ekranı: ne olduğunu, ne zaman, kime gittiğini açıklar; yeniden gönderme sunucu limitine bağlı |
| 6 | Onayda katılım kartı + QR | Var | Kart: ekran parlaklığı ipucu, çevrimdışı görüntüleme (son alınan imzalı kart önbellekten, "son güncelleme" etiketiyle) |
| 7 | Etkinlik günü görevli QR doğrular | Mobil `CheckIn` + admin web check-in | Görevli akışı haptic + net sonuç ekranı; kamera yoksa kısa kod; çevrimdışı check-in **yok** (bilinçli) |
| 8 | Katıldıkları + doğrulanmış deneyimler profilde | Var, "Katılım" sayacı 0 kalıyor | Sayaç tanımı düzeltilir (aşağıda), profil yeniden düzenlenir |

**"Katılım" tanımı (benim kararım):** profil sayacı = check-in yapılmış etkinlikler (CV ile tutarlı, "etkinliğe katılım beceri
kanıtı değildir" kuralına uygun). Onaylı ama henüz gerçekleşmemiş kayıtlar ayrı bir "Yaklaşan" satırında gösterilir; böylece
sayaç yalan söylemez, kullanıcı da kaydının kaybolduğunu düşünmez.

## 4. Teknik kararlar

**Korunan:** Expo SDK 57 · RN 0.86 · React 19 · React Navigation 7 (native-stack + bottom-tabs) · TanStack Query · RHF+Zod ·
Supabase JS · feature-first klasörler · `lib/errors.ts` sözleşmesi · RLS + `SECURITY DEFINER` RPC · OTP-only giriş.

**Eklenecek bağımlılıklar (gerekçeli; sürümler `npx expo install` ile SDK 57 uyumlu çözülür, expo-doctor 21/21 hedef):**
| Paket | Gerekçe |
|---|---|
| `react-native-reanimated` (+ `react-native-worklets`) | UI thread'de basma geri bildirimi, sheet/skeleton/başarı hareketleri; JS thread yoğunken takılmaz |
| `react-native-gesture-handler` | Kaydırarak kapatma, kart üzerinde sürükleme; Reanimated ile parmağı 1:1 izleyen hareketler |
| `expo-haptics` | Seçim, başarı, uyarı geri bildirimi (ölçülü, kapatılabilir) |
| `expo-image` | Kapak görselleri: disk önbelleği, blurhash yer tutucu, yumuşak geçiş, bellek dostu |
| `expo-notifications` | Faz 3b — yalnız push sağlayıcı kimlik bilgileri geldiğinde; uygulama içi bildirimler buna bağlı değil |
| `@sentry/react-native` | Crash reporting — **yalnız onay ve DSN gelirse** (§8 soru); PII scrub zorunlu |

Eklenmeyecek: `@gorhom/bottom-sheet` (yerine native-stack `presentation: 'formSheet'` + `sheetAllowedDetents`; iOS/Android native
sheet, yeni bağımlılık yok), Moti, Lottie, Expo Router, ek UI kütüphanesi. `npm run doctor` script'i düzeltilir
(`expo-doctor` devDependency olarak sabitlenir).

**Hareket sistemi (Emil Kowalski / animate-expo ilkeleri):**
- `design-system/motion.ts`: süreler `fast 160 / standard 220 / exit 140 ms`, yaylar `snappy {damping 22, stiffness 320}`,
  `gentle {damping 26, stiffness 180}`; `tokens.json`'a `motion` alanı olarak eklenir (tek kaynak kuralı).
- `PressableScale`: basılıyken 0.97, UI thread'de; tüm kart/düğmelerin tabanı. Liste kaydırmasını engellemez.
- Hareket **yalnız** şu anlarda: basma geri bildirimi, sheet aç/kapa, durum değişimi (kayıt onaylandı, QR doğrulandı),
  form doğrulama hatası (kısa yatay sarsma), skeleton→içerik geçişi, kaydet (yer imi) dolma. Sayfa girişlerinde sıralı
  (stagger) animasyon, paralaks, dekoratif döngü **yok**.
- Reduced motion açıkken: ölçek/kaydırma yerine anlık değişim veya yalnız opaklık; skeleton nabzı durur.
- Haptic: `lib/haptics.ts` semantik API (`selection`, `success`, `warning`, `error`); Ayarlar'da kapatılabilir; check-in
  sonucu ve kayıt onayı dışında `success` kullanılmaz.
- Performans ölçütü: Android emülatörde (ve gerçek cihaz gelince) kaydırma + basma sırasında Perf Monitor'de UI ve JS
  thread'de ≥55 fps; ölçülmeyen değer raporda "ölçülmedi" yazar.

**Kapak görselleri:** yeni migration — `events`, `opportunities`, `teams` tablolarına `cover_path text` + `cover_blurhash text`;
herkese açık okunur `covers` bucket'ı (yalnız `image/jpeg|png|webp`, ≤2 MB); yazma yalnız ilgili kurumun üyesi/takım kaptanı
ve platform admini (klasör = kurum/takım id'si, RLS testli). Kapak değişikliği, yayınlanmış içeriğin yeniden incelemesini
tetikleyen mevcut mekanizmaya bağlanır. Yükleme: admin panelinde etkinlik/fırsat formu; takım kapağı mobilde kaptan için.
Kapak yoksa mevcut "poster tonu" düşer — ama dekoratif yuvarlak kare yerine içerik türüne göre Open Circuit grafiği
(etkinlik türü ikonu + devre çizgisi) üretilir, böylece kapaksız kartlar da ayırt edilir.

**Takım profili:** herkese açık görünüm = ad, kategori, şehir, hakkında, kapak, üye **sayısı**, rol dağılımı, açık roller
(`recruitment_posts`), projeler, katıldığı etkinlikler (takım kaydı geldikten sonra). **Üye adları yalnız takım üyelerine**
(`team_roster`); herkese açık görünümde yalnız 18+ ve `discoverable` olan kaptan/mentor adı gösterilebilir. 18 yaş altı üyelerin
adı/fotoğrafı takım dışına hiç çıkmaz. Yeni `team_projects` tablosu (başlık, özet, yıl, https bağlantı, kapak) — yazma kaptan RPC'si.

**Kaydedilenler:** mevcut `bookmarks` (event/opportunity/team/course) — kaydet düğmesi etkinlik, fırsat, takım kartlarına ve
detaylarına bağlanır; Profil > Kaydedilenler ekranı türe göre filtreli.

**Uygulama içi bildirimler:** `notifications` tablosu mevcut, yazan yok. Sunucu tarafında trigger/RPC ile üretilir:
kayıt onaylandı/bekleme listesinden yükseldi, veli onayladı/reddetti, başvuru durumu değişti, takıma katılma isteği
karara bağlandı, etkinlikten 24 saat önce hatırlatma (pg_cron). Metinde PII yok (yalnız içerik başlığı). Keşfet başlığında
okunmamış rozeti + Bildirimler ekranı. Push (Faz 3b) aynı kayıtları gönderir; Huawei için HMS Push ayrı sağlayıcıdır.

**Ayarlar ve gizlilik:** Profil > Ayarlar: hesap (e-posta, çıkış, hesap silme — mevcut), bildirim tercihleri, haptic,
gizlilik (keşfedilebilirlik yalnız 18+; CV paylaşımı mevcut), rıza merkezi (`consents` — sürümlü liste, geri çekilebilenler),
Yardım (`/destek`), Yasal (`/gizlilik`, `/kosullar` web sayfalarına bağlantı; uygulamada hukuki metin uydurulmaz).

**Öğrenme:** Keşfet > Gelişim bölümü + kurs listesi/detayı/ders ekranı (`courses`, `lessons`, `complete_lesson`,
`event_courses` → etkinlik detayında "Bu etkinliğe hazırlan").

**Birleşik arama:** Keşfet aramasında etkinlik + fırsat + takım + kurs; şimdilik `ilike` (paralel sorgular, sonuç grupları);
tam metin arama sonraki iş.

**Takım kaydı:** veritabanı bugün `registration_mode = 'team'` etkinlikleri reddediyor; mobilde akış yok. Bu, §8'deki 1 numaralı
sorunun cevabına göre ya pilot hattına girer (takım = kayıt birimi, her 18 yaş altı üye için veli onayı, kaptan başvurur,
kapasite takım sayısıyla) ya da pilottan sonraya kalır.

## 5. Ekran bazlı iyileştirmeler

| Ekran | Değişiklik |
|---|---|
| Onboarding | İlk ekran poster tipografisi korunur; "Başlayalım" → ilgi alanı → keşif; ilk açılış hareketi tek, kısa (≤400 ms), reduced-motion'da yok |
| Keşfet | Vitrin: kaydı açık en yakın etkinlik (yoksa vitrin yok); birleşik arama; "Yaklaşan", "Sıradaki adımın" (fırsat), "Birlikte üretenler" (takım), "Gelişim" (kurs) bölümleri; bildirim rozeti |
| Etkinlikler | Kapaklı poster kartı (16:10), durum rozeti tek kaynaktan, kaydet düğmesi; filtre native sheet |
| Etkinlik detayı | Kapak + yapışkan alt eylem; kayıt modu (bireysel/takım) açık; "Bu etkinliğe hazırlan"; program ve "bilmen gerekenler" korunur |
| Kayıt / durum / veli | Adımlı durum çizgisi (kayıt → veli → onay → kart); veli e-postası gönderildi bilgisi; hata metinleri `COPY` tablosundan |
| Katılım kartı | Tam ekran, yüksek kontrast QR, kısa kod büyük; son başarılı kart çevrimdışı gösterilir; parlaklık ipucu |
| Check-in (görevli) | Kamera + kısa kod; sonuç ekranı renk + ikon + metin (yalnız renge dayanmaz) + haptic; "Sıradaki" |
| Fırsatlar / detay / başvuru | Kapak veya kurum logolu kart; son tarih rozeti korunur; başvuru önizlemesi (paylaşılan veri) |
| Topluluk / takım profili | Kategoriye göre ikon (robot yalnız robotik); kapak; hakkında, rol dağılımı, açık roller, projeler; "Takımım" kısayolu |
| Profil | Üst kart yeniden düzenlenir (avatar hero'ya taşmaz), sayaçlar doğru, "Yaklaşan" satırı; Kaydedilenler, Bildirimler, Ayarlar girişleri |
| Misafir profil | Değer önerisi + üç fayda + tek birincil eylem; boş alan kalmaz |
| Boş/hata/yükleniyor | Her listede skeleton (içerik iskeletiyle aynı ölçüde), filtreli-boş ayrı metin, hata + tekrar dene |

Tasarım sistemi tarafında: kart ailesi (poster / satır / mini) tek `Card` temelinde birleşir; tip ölçeği ve token'lar değişmez
(yalnız `motion` ve `elevation` eklenir); dark mode **değerlendirilir ama pilotta açılmaz** (token'lar yarı-hazır tutulur).

## 6. Erişilebilirlik ve platform uyumu

- VoiceOver/TalkBack etiketleri, rol ve durum duyuruları (kayıt onayı, check-in sonucu `accessibilityLiveRegion`/announce).
- Dynamic Type / Android font ölçeği %200'de kırılmayan yerleşim; 320 pt genişlik; dokunma hedefi ≥44.
- Renk kontrastı WCAG AA (lime yalnız koyu zeminde metin).
- Huawei (GMS'siz): QR taramada `expo-camera` barkod okuması doğrulanamazsa kısa kod yolu her zaman görünür; push HMS ayrı.
- HIG Doctor her faz sonunda yeniden çalışır (`--fail-on serious`), bulgular cihaz/emülatör gözlemiyle birlikte yorumlanır.

## 7. Pilot kapısı (hepsi ✅ olmadan "pilota hazır" denmez)

1. Staging'de adult + minor/veli uçtan uca, gerçek e-posta teslimiyle, son build üzerinde PASS.
2. Ayrı **production** Supabase projesi: migration'lar, seed yok, OTP şablonu, SMTP, Edge secret'ları — **kullanıcı onayıyla**.
3. Hukuk: aydınlatma metni + veli onay metni + kullanım koşulları onaylı ve sürümlü (`/gizlilik`, `/kosullar` bugün "hazırlanıyor").
4. EAS Android + iOS build; Android emülatörde 8 adımlık yolculuk PASS; en az bir gerçek iPhone ve bir gerçek Android cihazda
   yolculuk PASS (ekip tarafından, kontrol listesiyle); Huawei cihazda check-in yolu.
5. Remote güvenlik regresyonu (staging) PASS; yeni tablolar için RLS testleri; 18 yaş altı veri görünürlüğü denetimi.
6. Erişilebilirlik turu (TalkBack emülatör, büyük yazı, 320 pt) ve HIG Doctor'da serious bulgu yok.
7. Crash reporting açık **veya** açık olmadığı yazılı olarak kabul edilmiş.
8. Etkinlik günü planı: görevli hesapları, cihaz başına check-in testi, bağlantı kesilirse admin web + kısa kod yedeği.

## 8. Kullanıcıya ait açık sorular

1. Cezeri Robot Ligi'nde kayıt TechApp üzerinden mi yapılacak, bireysel mi takım mı? (Takım kaydı pilot hattına girerse en büyük iş kalemi bu.)
2. Pilotta uygulamayı kim, nasıl kuracak: yalnız görevliler ve birkaç test kullanıcısı mı, yoksa tüm katılımcılar mı? (iOS'ta
   dahili build yalnız önceden kayıtlı cihazlara kurulur; katılımcılara açmak TestFlight dış test incelemesi veya mağaza
   yayını demek; bu, dondurma tarihini yaklaşık bir hafta öne çeker.)
3. Hukuk metinleri (aydınlatma, veli onayı, koşullar) pilot öncesi gelecek mi? Gelmezse 18 yaş altı kayıt pilotta açılamaz.
4. Go/no-go kararını kim, hangi tarihte verecek? (Öneri: 24 Kasım, sen.)
5. Sentry (veya başka bir crash reporting) hesabı kullanılabilir mi?

**Benim kararlarım (itiraz edilebilir):** push pilotta yok, uygulama içi bildirimler Faz 3b'de; dark mode pilotta yok;
"Katılım" = check-in'li etkinlik; offline check-in yok; kapak görselleri pilottan sonra (pilot için tek etkinlik poster tonuyla).

## 8a. Kullanıcı kararları (2026-11-11, bağlayıcı)

1. **Cezeri:** resmî takım kaydı ve yarışma operasyonu TechApp'e bağlanmaz. Pilotta keşif, detay, **bireysel test kaydı**,
   katılım kartı, QR kontrolü ve profil gerçekçi senaryolarla doğrulanır. Takım kaydı ürün kapsamında kalır (Faz 3a),
   pilot tarihini riske atmaz.
2. **Pilot kullanıcıları:** yalnız görevliler, Intechne ekibi ve seçilmiş az sayıda gönüllü test kullanıcısı. Android: EAS
   preview + emülatör/gerçek cihaz. iOS: TestFlight hazırlığı; cihaz ve dağıtım yetkisi olmadan "cihazda doğrulandı" denmez.
3. **Hukuk:** gizlilik politikası, aydınlatma metni, kullanım koşulları, saklama politikası ve veli onayı süreci **eksik**
   olarak işaretlenir, uydurulmaz. Hukuki onay olmadan gerçek 18 yaş altı kullanıcının kişisel verisini toplayan akış açılmaz;
   18+ için de aydınlatma koşulları sağlanmadan herkese açık kayıt başlamaz. Bu bir **gerçek kullanıcıya açılma** kriteridir;
   yerel ve staging geliştirme/testleri devam eder.
4. **Takvim:** 21 Kasım hedef dondurma; 24 Kasım go/no-go kararını kullanıcı verir. Kaliteden ödün verilerek tarihe yetişilmez.
   24 Kasım paketi: test sonuçları, açık riskler, cihaz durumu, pilot kontrol listesi.
5. **Sentry onaylı**, şartlarla: production/development ayrı ortam; PII, OTP kodu, erişim token'ı, secret gönderilmez;
   18 yaş altı için veri minimizasyonu (kullanıcı kimliği/e-posta/ad hiç gönderilmez; yalnız rastgele kurulum kimliği);
   saklama gereksinimi belgelenir; SDK Expo 57 uyumlu; DSN yoksa kurulum hazırlanır, bağlantı adımı açık bırakılır.
6. **Pilot ≠ ürün:** pilot dışındaki ekranlar 27 Kasım'a yetişmek zorunda değil ama ertelenmez; beş sekmenin tamamı için
   kapsamlı ürün/UX planı yazılır (Faz 3b–5 planları).
7. **Native paketler:** SDK 57 uyumluluğu önce doğrulanır; pilot build'inde **kullanılmayan paket eklenmez**. Pilot:
   Reanimated (+worklets, basma geri bildirimi), expo-haptics (check-in/kayıt), Sentry. Gesture Handler ve expo-image
   ilk kullanıldıkları fazda (kapaklar, sheet/swipe) eklenir.
8. **Git:** `feat/v5-pilot-platform`, GitHub'a yedek push izinli; force push yok, main'e doğrudan merge yok, production DB'ye dokunulmaz.

## 9. Builder'a bırakılanlar

Bileşen iç yapısı, dosya bölümleri, test isimleri, migration dosya adları (kural: yeni dosya, uygulanmış migration düzenlenmez),
kopya metinlerin ince ayarı (ton kuralına uyarak), skeleton ölçüleri.
