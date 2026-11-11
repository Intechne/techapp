# Android emülatör pilot yolculuğu — 11 Kasım 2026

İlk native koşu: EAS Android development build emülatöre kuruldu, spec §3'teki sekiz adım yerel yığına karşı uçtan uca
yürütüldü (bireysel test kaydı, §8a; Cezeri takım kaydı kapsam dışı). Bu belge gözlem ve kanıttır. Ürün kodu
değiştirilmedi; bulunan hatalar aşağıda ayrı fix task'ı olacak biçimde yazıldı.

Kanıt görselleri: [`2026-11-pilot-journey-android/`](2026-11-pilot-journey-android/) (720 px'e küçültülmüş JPEG). Tam
çözünürlüklü PNG'ler yalnız oturum scratchpad'inde kaldı.

## Ortam

| | |
|---|---|
| Build | EAS `3e02e2cf-d2f1-4b93-a528-0b0f10fb9521` · profil `development` (dev client) · Android · **FINISHED** |
| Commit | `b28ea0a` (`feat/v5-pilot-platform`). Koşu sırasında dala yalnız doküman/test commit'leri geldi (`afdf190`, `1c7e6e0`); `apps/mobile` değişmedi |
| Build süreleri | kuyruk 817 s (~13,6 dk) · derleme 1267 s (~21 dk) · bitiş 14:30 UTC |
| APK | 269 MB (dev client, tüm ABI'ler) · sha256 `22b9260d…5d53f038` · versionName 5.0.0 · versionCode 2 · minSdk 24 · targetSdk 36 |
| Cihaz | AVD `Medium_Phone_API_36.1` · Android 16 (API 36) · 1080×2400 · 420 dpi · headless, `swiftshader_indirect` (yazılımsal GPU) |
| JS | Metro `expo start --dev-client --port 8081`, `adb reverse tcp:8081` (dev bundle, minify yok) |
| Backend | `npm run db:dev` (yerel yığın, `127.0.0.1:54321`) + `npm run env:local`; emülatörden `adb reverse tcp:54321` ile erişildi, `.env.local` URL'ine dokunulmadı |
| Veli sayfası | `apps/web` `npm run dev` → `http://localhost:3100/veli#…`; Playwright (headless Chromium) ile gerçek sayfa üzerinden onaylandı |
| Hesaplar | reşit olmayan `pilot.minor.1794407945@techapp.test` (doğum 10.05.2010 → 16 yaş) · yetişkin `pilot.adult.1794408866@techapp.test` (15.03.2000 → 26 yaş) · görevli `organizator@techapp.test` |
| Etkinlik | `genc-urun-gelistiriciler-konferansi` (bireysel, 16+, 18 altı veli onayı, kayıt açık) |

**Yerel DB müdahalesi (yalnız dev DB, :54322):** check-in penceresi için etkinliğin `starts_at` = şimdi+1 sa,
`ends_at` = şimdi+6 sa, `registration_closes_at` = şimdi+20 dk yapıldı; adım 7–8 ve yetişkin yolundan sonra özgün değerlere
(`2026-11-21 10:00+03` / `17:30+03` / `2026-11-19 23:59+03`) geri döndürüldü. 54329'a dokunulmadı.

**Not:** yerel yığın ayakta iken (16:57–17:33 arası, APK kurulmadan önce) başka bir istemci aynı yığını kullandı
(`omerakblt05@gmail.com`, `omer@intechne.com.tr`, `organizator@` için OTP; organizatörün bu etkinliğe 17:16 kaydı).
Detaydaki "299 / 300 yer açık" bu kayıttan geliyor; hata değil.

## Sekiz adım

| # | Adım | Sonuç | Kanıt | Not |
|---|---|---|---|---|
| 1 | Soğuk açılış | **PASS** (dev build sınırıyla) | `01-cold-2.jpg`, `01-first-screen.jpg` | Native splash (iris zemin, logo) → karşılama ekranı; uygulamaya ait beyaz ekran görülmedi. `am start -W` TotalTime: 1830 ms (ilk), 1965 ms (ikinci). İlk uygulama ekranı Metro'dan bundle ile ≤ ~9,7 s (UI dump aralığı kaba). Splash ile JS arasında **dev launcher'ın kendi** beyaz "Bundling…/Loading from 127.0.0.1:8081" ekranı var — dev client'a özgü. Release soğuk açılış süresi ve beyaz ekran yokluğu **ölçülmedi** (preview/production build gerekir). |
| 2 | Misafir keşif | **PASS** | `02-kesfet.jpg`, `02-etkinlikler.jpg`, `02-firsatlar.jpg`, `02-topluluk.jpg` | Hesapsız giriş "Şimdilik sadece göz at". Vitrin (hero) kaydı açık etkinliği gösteriyor: "Üretenler anlatıyor." → Genç Ürün Geliştiriciler Konferansı. Dört sekme açıldı, veri geldi. |
| 3 | Etkinlik detayı + kayıt durumu | **PASS** (D7) | `03-detail.jpg` | Kapak, tür, tarih/saat, yer, kitle, son kayıt, kontenjan, doğrulanmış düzenleyen, program, "Etkinliğe katıl". Kayıt modu (bireysel) ve yaş/veli şartı misafire görünmüyor → D7. |
| 4 | OTP ile hesap | **PASS** (D5) | `04-otp-wrong.jpg`, `04-otp-paste.jpg`, `04-keyboard-covers-footer.jpg` | "Etkinliğe katıl" → e-posta → OTP. `AuthOtp` rotası parametresiz (e-posta rota/URL'de yok; e-posta yalnız modül belleğinde). Yanlış kod (000000) → "Kod hatalı ya da süresi dolmuş…". **Yapıştırma çalışıyor:** kod pano üzerinden (Ctrl+V) alana yapıştırıldı → tek seferde doğrulandı → profil adımı. Klavyeyle yazma da çalışıyor (görevli/yetişkin girişleri). Doğrulama sonrası kayıt akışına geri dönüldü (bağlam korunuyor). |
| 5 | Reşit olmayan: kayıt → veli onayı → onaylı | **PASS** (D4) | `05-after-register.jpg`, `05-pending-scrolled.jpg`, `05-veli-after.jpg`, `05-confirmed.jpg` | Profil 16 yaş → kayıt formunda "Veli onayı gerekecek" → DB `pending_guardian`. Durum zaman çizelgesi (Başvurun alındı ✓ / Veli onayı ← şu an / Katılım onayı / Katılım kartı). Veli formu → "v•••@techapp.test adresine… Son geçerlilik: 14 Kasım 2026, 17:44" (maskeli alıcı + süre). Veli linki db:dev çıktısından alındı, **apps/web `/veli` sayfasında** ad + onay kutusu + "Onaylıyorum" → "Onayınız alındı. Katılım kesinleşti." → DB `confirmed`. Uygulama öne gelince durum kendiliğinden yenilenmedi; aşağı çekip yenileyince "Yerini ayırdık." → D4. |
| 6 | Katılım kartı + QR, çevrimdışı | **PASS** (oturum içi) / D3 | `06-card.jpg`, `06-card-offline.jpg`, `06-offline-myregs-error.jpg` | Kart: etkinlik, tarih/saat, yer, katılımcı adı, QR, kısa kod `0B8E1BD1`, parlaklık ipucu, "Giriş kontrolü etkinlikten 3 saat önce açılır" notu. Uçak modu **ve** `adb reverse tcp:54321` kaldırılarak (adb tüneli uçak modundan etkilenmediği için) backend kesildi → karta geri dönüldü → "Son güncelleme: 17:44 · çevrimdışı" etiketiyle önbellekten açıldı. Ancak çevrimdışıyken uygulama yeniden başlatılınca karta ulaşan hiçbir yol yok → D3. |
| 7 | Görevli check-in | **FAIL** (D1 — düzeltildi (commit 9c3af36 + 4a33514), emülatörde yeniden doğrulanacak) | `07-shortcode-result.jpg`, `07-checkin-success.jpg`, `07-checkin-again.jpg`, `07-checkin-invalid.jpg` | `organizator@` → Profil → "Giriş kontrolü". Emülatörde kamera izni verilmedi, elle giriş kullanıldı. **Kartta görünen kısa kod `0B8E1BD1` reddedildi:** "GİRİŞ ONAYLANMADI · Bu bir TechApp katılım kodu değil." → D1. Tam token (`TA1.<kayıt-id>.<imza>`, yerel DB'den `app.ticket_token()` ile okundu — katılımcının bunu görmesinin yolu yok) ile: başarı "GİRİŞ ONAYLANDI · Deniz Pilot · Hoş geldin diyebilirsin." → aynı kod "DAHA ÖNCE GİRİŞ YAPILMIŞ · İlk giriş saati: 17:51. Aynı kodla ikinci giriş kaydedilmedi." → imzası bozuk kod "Bu kod geçerli değil." Sonuç ekranları net; haptic emülatörde gözlemlenemedi. |
| 8 | Profil: katıldıkları | **PASS** (D2) | `08-profile-after.jpg`, `08-card-checked-in.jpg`, `07-org-profile.jpg` | Reşit olmayan hesap yeniden girişte: "0 Deneyim · 0 Doğrulanmış · **1 Katıldığı**" + "Yaklaşan" satırında kayıt; kartta "GİRİŞ YAPILDI · 17:51". Etiket hâlâ "Katıldığı" (bilinen, ertelendi). Görevli hesabının profilinde başka kullanıcıların kayıtları "Yaklaşan" olarak listelendi → D2. |

**Yetişkin yolu (26 yaş): PASS.** Detay → OTP → profil (15.03.2000, Yeni mezun) → kayıt formunda veli bölümü yok →
"Katılımı tamamla" → doğrudan "KATILIMIN ONAYLANDI" (DB `confirmed`) → kart (`2E4536DC`). Kanıt: `font2-card.jpg` (aynı kart).

## Erişilebilirlik, yazı ölçeği, genişlik, hareket, performans

| Kontrol | Sonuç | Kanıt / not |
|---|---|---|
| TalkBack | **Doğrulanmadı** (TalkBack yüklü ve açıldı) | `com.google.android.marvin.talkback` imajda var, servis bağlandı. Ancak `adb shell input` ile enjekte edilen dokunuş/kaydırmalar TouchExplorer'dan geçmiyor: kaydırma odağı ilerletmedi, tek dokunuş doğrudan etkinleştirdi; Alt+→ klavye gezinmesi de odağı taşımadı. Sesli tur (adım 1–3, 6, 7) gerçek kişiyle ya da cihazda yapılmalı. Yerine erişilebilirlik ağacı (uiautomator) incelendi: hero/liste kartları tek etiketli düğme, zaman çizelgesi adımları "Veli onayı, şu an bu adımda", QR "Giriş kodu. Kısa kod: 0 B 8 E 1 B D 1", check-in sonucu tek grup etiketi ("Giriş onaylandı. Deniz Pilot Hoş geldin diyebilirsin."), profil sayaçları tek etiket. Hero etiketinde çift nokta → D9. |
| Yazı ölçeği 2.0 | **PASS** (notlarla) | `font2-kesfet.jpg`, `font2-detail.jpg`, `font2-card.jpg`. Kırpılma yok. Başlıklar, uygulama başlığı ve alt sekme etiketleri sınırlı büyüyor (maxFontSizeMultiplier); kartta QR katlamanın altına iniyor (kaydırma gerekli); düzenleyen satırı "…" ile kısalıyor. Hero'da dekoratif halka meta metnine biniyor → D8. |
| 320 dp genişlik | **FAIL** (D6) | `320dp-kesfet.jpg` — `wm size 720x1600` + `wm density 360` (= 320 dp). Alt sekmede "Etkinlikl…" kesiliyor; hero halkası "Hibrit" üzerine biniyor (D8). Geri kalan içerik sığıyor. |
| Azaltılmış hareket | **PASS** (gözlemsel) | `reduced-motion-detail.jpg` — `animator_duration_scale 0` ile gezinme ve ekranlar sorunsuz render oldu, görünmez kalan öğe yok. Animasyonların gerçekten kapandığı durağan görüntüyle doğrulanamaz; kodda `useReducedMotion` PressableScale/States/Overlays'te kullanılıyor. |
| Perf Monitor | **Ölçüldü ama temsil etmez** | `perf-scroll-down-2.jpg`. Dev menüsünden açıldı (overlay izni geçici verildi, sonra `default`'a alındı). Keşfet'te 1,5 sn'lik kaydırmalar sırasında okunan UI değerleri: 55,7 / 18,0 / 36,4 / 35,2 / 45,0 fps; düşen kare sayacı 116 → 245, "stutter (4+)" 7 → 10. Bu Perf Monitor sürümü JS fps göstermiyor. Koşullar: headless emülatör + yazılımsal GPU (swiftshader) + dev bundle + ölçüm sırasında `screencap`. Gerçek cihazda release build ile tekrar ölçülmeli; bu sayılar performans kararı için kullanılmamalı. |

## HIG Doctor

`npx hig-doctor apps/mobile --fail-on serious` → **exit 1, gate tripped** (hig-doctor 2.0.3; Node 24 istiyor, Node 22.16 ile
uyarıyla çalıştı). 106 dosya, 357 tespit: 131 iyi, **1 critical**, 1 moderate.

- critical `web/svg-without-a11y` — `src/design-system/TechIcon.tsx:21` (regex motoru, SvgXml'e verilen `<svg>` string'i).
  Native'de ikon `accessibilityElementsHidden` + `importantForAccessibility="no"` ile gizli, yani native için yanlış pozitif;
  web hedefinde ise hiçbir gizleme yok (`aria-hidden` yok) → D10.
- moderate `web/auto-focus` — `src/features/auth/AuthOtpScreen.tsx:90` OTP alanındaki `autoFocus` (bilinçli tasarım; tek alanlı kod ekranı).

## Hatalar (her biri ayrı fix task'ı)

### D1 — P1 · Kısa kodla check-in yapılamıyor (adım 7 kırık)
- **Beklenen (spec §3 adım 7):** kamera yoksa kısa kod ile giriş.
- **Gerçek:** kart 8 karakterlik kısa kodu gösteriyor (`get_participation_card` → `upper(substr(imza,1,8))`), ama `CheckInScreen`
  elle girilen değeri olduğu gibi `check_in_participant(p_token)`'a yolluyor; RPC yalnız `TA1.<uuid>.<imza>` kabul ediyor →
  422 `ticket_malformed` → "Bu bir TechApp katılım kodu değil." Alanın yardım metni "karttaki tam kodu yapıştırabilirsin" diyor,
  fakat kart tam kodu göstermiyor ve kopyalama yolu yok. Sonuç: kamera çalışmazsa girişin hiçbir yolu yok.
- **Tekrar:** kayıtlı + onaylı katılımcının kartındaki kısa kodu not al → görevli hesabıyla Profil → Giriş kontrolü →
  "Kodu elle gir" alanına kısa kodu yaz → "Kodu doğrula".
- **Kanıt:** `07-shortcode-result.jpg`, `06-card.jpg`.
- **Fix yönü (karar fix task'ında):** görevlinin yetkili olduğu etkinlik(ler) kapsamında kısa kodla arayan bir RPC
  (çakışma/brute-force sınırıyla), istemcide kısa kod ↔ tam token ayrımı ve yardım metninin düzeltilmesi.
- **Durum:** düzeltildi (commit 9c3af36 + 4a33514), emülatörde yeniden doğrulanacak. Sunucu: `check_in_by_short_code(etkinlik, kod)`
  (`20261112000100_checkin_short_code.sql`; görevli+etkinlik başına 10 dk'da 20 hatalı arama → 429, eşleşen kayıt tam token ile
  `check_in_participant`'a devredilir). Mobil: Giriş kontrolü ekranında etkinlik seçimi (tek etkinlik otomatik seçili), kısa kod →
  yeni RPC, `TA1.` token ve kamera → eski RPC (seçili etkinlik `p_expected_event_id` olarak gider). Yerel web önizlemesinde doğrulandı;
  staging'e migration henüz uygulanmadı (kullanıcı onayıyla).

### D2 — P1 · Düzenleyen/görevli hesabında "Katılımlarım" ve profil "Yaklaşan" başkalarının kayıtlarını gösteriyor
- **Durum:** düzeltildi (commit 1a7a0a3), emülatörde yeniden doğrulanacak. Web önizlemede organizatör Profil ve Katılımlarım'da yalnız kendi tek kaydını görüyor.
- **Gerçek:** `organizator@` profilinde "Yaklaşan" altında Genç Ürün Geliştiriciler Konferansı **iki kez** (kendi kaydı +
  Deniz Pilot'un kaydı) ve **Arduino ile İlk Devren — VELİ ONAYI BEKLENİYOR** (audit.minor'un kaydı; organizatörün bu
  etkinlikte kaydı yok) "yaklaşan kayıt. Durumu aç" olarak listelendi. DB'de organizatörün tek kaydı var.
- **Kök neden:** `apps/mobile/src/features/events/api.ts` `fetchMyRegistrations()` (`event_registrations` select) kullanıcı
  filtresi içermiyor; RLS `registrations_select_org` org rolüne (owner/admin/editor/checkin_staff/reviewer) etkinliğin tüm
  kayıtlarını okutuyor. "Benim kayıtlarım" sorgusu RLS'nin dar olduğunu varsayıyor.
- **Etki:** görevli kendi kartı sandığı başka kişinin kaydını açabilir; reşit olmayan katılımcıların durumları "benim"
  ekranlarında görünür (PII/kafa karışıklığı). Katılımcı hesaplarında görünmez (RLS yalnız kendi kaydı).
- **Tekrar:** organizatör (herhangi bir org rolü) hesabıyla, aynı org'un etkinliğine başka kullanıcı kaydolmuşken Profil'i aç.
- **Kanıt:** `07-org-profile.jpg`.
- **Fix yönü:** sorguya `user_id = auth.uid()` filtresi (ya da `my_registrations` görünümü/RPC'si) + rol sahibi kullanıcıyla test.

### D3 — P1 · Çevrimdışı soğuk açılışta katılım kartına ulaşılamıyor
- **Durum:** düzeltildi (commit 4898898; Katılımlarım'da 'Çevrimdışı · kayıtlı kartların'), emülatörde yeniden doğrulanacak. Profil 'Yaklaşan' kapsam dışı.
- **Beklenen (spec §3 adım 6):** son alınan imzalı kart önbellekten, "son güncelleme" etiketiyle görüntülenir.
- **Gerçek:** önbellek (`offlineCard.ts`, SecureStore) var ve aynı oturumda karta dönünce çalışıyor. Ama uygulama çevrimdışıyken
  yeniden başlatılınca karta giden tüm yollar ağa bağlı: Etkinlikler → Katılımlarım ~30 sn iskelet sonrası "Bağlantı yok gibi
  görünüyor"; Profil aynı hata; Kayıt durumu ekranına da bu listelerden gidiliyor. Etkinlik günü salonda çekim zayıfsa kart açılmaz.
- **Tekrar:** onaylı kayıtla kartı bir kez aç → uçak modu (emülatörde ayrıca `adb reverse --remove tcp:54321`) → uygulamayı
  kapat/aç → Katılımlarım veya Profil.
- **Kanıt:** `06-offline-myregs-error.jpg`; oturum içi başarılı durum `06-card-offline.jpg`.
- **Fix yönü:** önbellekteki kartların listesi için çevrimdışı giriş noktası (Katılımlarım'da önbellek yedeği ya da
  "Kartlarım" kısayolu); `fetchCardWithOfflineFallback` benzeri liste yedeği.

### D4 — P2 · Uygulama öne geldiğinde kayıt durumu yenilenmiyor
- **Gerçek:** veli onayladıktan sonra uygulama arka plandan öne getirildi; ekran "Veli onayı bekleniyor" olarak kaldı. Ancak
  aşağı çekip yenileyince "Yerini ayırdık." geldi. Kodda TanStack Query `focusManager`/`AppState` bağlantısı yok
  (`AppState` yalnız `lib/supabase.ts`'te oturum yenileme için).
- **Etki:** veli onayını bekleyen genç, onay geldiğini uygulamayı yeniden açınca görmez; spec §5 bekleme ekranı amacına aykırı.
- **Tekrar:** reşit olmayan kayıt → veli linkini başka cihazda onayla → uygulamayı arka plana al/öne getir.
- **Kanıt:** önce/sonra dump'ları ve `05-confirmed.jpg` (yenileme sonrası).
- **Fix yönü:** RN için `focusManager.setEventListener(AppState…)` + `onlineManager`; durum ekranında odakta yeniden çekme.
- **Durum:** düzeltildi (commit 0cc12a4), emülatörde yeniden doğrulanacak. AppState↔focusManager (onlineManager bağlanmadı); kayıt durumu odakta her zaman yeniden çekilir. Emülatörde: veli onayı → arka plan/öne getirme.

### D5 — P2 · Klavye açıkken alt eylem düğmesi klavyenin altında kalıyor
- **Gerçek:** Android 16 (edge-to-edge, targetSdk 36), yerleşik Gboard açıkken e-posta ekranının alt düğmesi "Kodu gönder"
  görünmüyor; ilk dokunuş klavyeye gidiyor. IME "Gönder" tuşu formu gönderiyor (bu yol çalışıyor). Aynı `Screen footer` deseni
  OTP "Doğrula" ve profil "Devam et" ekranlarında da var (floating klavyede sorun görünmüyor, yerleşik klavyede görülüyor).
- **Kanıt:** `04-keyboard-covers-footer.jpg`.
- **Fix yönü:** `Screen` footer'ını klavyeden kaçınan yapıya almak (KeyboardAvoidingView/keyboard controller) ve Android 16'da doğrulamak.
- **Durum:** düzeltildi (commit 46cb3e2 + 96c9f7c), emülatörde yeniden doğrulanacak. Android'de Screen alt eylemi klavye yüksekliğine göre yukarı alınır (yalnız jest ile mock'lu klavye olayı kanıtlandı). **Görsel kanıt emülatörde gerekir (Gboard, Android 16)**: e-posta, OTP, profil ekranları.

### D6 — P2 · 320 dp genişlikte alt sekme etiketi kesiliyor
- **Gerçek:** "Etkinlikler" → "Etkinlikl…". Proje kuralı: "Alt sekmede etiket her zaman görünür", minimum genişlik 320.
- **Kanıt:** `320dp-kesfet.jpg` (`wm size 720x1600`, `wm density 360`).
- **Fix yönü:** sekme etiket stili (font boyutu/letterSpacing/numberOfLines/adjustsFontSizeToFit) 320'de test edilerek.
- **Durum:** düzeltildi (commit eb8df4c), emülatörde yeniden doğrulanacak. etiket 12 pt'te kaldı, öğe iç boşluğunu kullanır; web 320×640'ta tüm etiketler sığıyor. Emülatörde (320 dp, DM Sans metrikleri) yeniden bakılacak.

### D7 — P3 · Detayda kayıt modu ve yaş/veli şartı görünmüyor
- **Gerçek:** misafir detayında "Üniversite + genç mezun · Ücretsiz" görünüyor; `audienceLabel()` `audience_note` doluysa
  `min_age` (16+) bilgisini düşürüyor; `registration_mode` (bireysel/takım) hiç gösterilmiyor; "18 yaş altına veli onayı"
  ancak giriş yapıp kayıt formuna gelince görülüyor. Spec §3 adım 3: "takım/bireysel modu açık".
- **Kanıt:** `03-detail.jpg`.
- **Durum:** düzeltildi (commit fd8c215), emülatörde yeniden doğrulanacak. 'Bireysel/Takım kaydı · N yaş ve üzeri · M yaş altına veli onayı' satırı.

### D8 — P3 · Hero kartında dekoratif halka meta metnine biniyor
- **Gerçek:** 320 dp'de ve yazı ölçeği 2.0'da lime halka "Hibrit ·" kelimesinin üzerinden geçiyor. Varsayılan ölçekte çakışma yok.
- **Kanıt:** `320dp-kesfet.jpg`, `font2-kesfet.jpg`.
- **Durum:** düzeltildi (commit 1264465), emülatörde yeniden doğrulanacak. halka kart genişliğine göre küçüldü, sağ alt köşeye alındı, dokunuşa şeffaf ve erişilebilirlikten gizli; yazı ölçeği >1,3'te hiç çizilmez. Emülatörde 320 dp + font 2.0 ile bakılacak.

### D9 — P3 · Hero erişilebilirlik etiketinde çift nokta
- **Gerçek:** content-desc "Üretenler anlatıyor.. 21 Kasım 2026 · İzmir · Hibrit · Ücretsiz" (afiş cümlesi zaten noktayla bitiyor,
  birleştirmede bir nokta daha ekleniyor). Ekran okuyucuda duraklama/okuma tuhaflığı.
- **Durum:** düzeltildi (commit 1264465), emülatörde yeniden doğrulanacak. etiket, sondaki noktalama kırpılarak birleştirilir.

### D10 — P3 · HIG Doctor critical: `TechIcon` web hedefinde gizlenmiyor
- **Gerçek:** `--fail-on serious` kapısı `TechIcon.tsx:21` yüzünden düşüyor. Native'de doğru gizli; web'de `aria-hidden` yok.
- **Fix yönü:** web dalında `aria-hidden`/`role="presentation"` verip kapıyı yeşile döndürmek (baseline'a almak yerine).
- **Durum:** düzeltildi (commit 0007c49), emülatörde yeniden doğrulanacak. dekoratif ikon web'de aria-hidden, native'de gizli; etiketli ikon role=image. `hig-doctor apps/mobile --fail-on serious` önce: 1 critical (kapı düştü) → sonra: 0 critical, 1 moderate (kapı geçer).

## Gözlemler (hata değil)
- Görevli, etkinlik başlamadan (3 saatlik pencerede) check-in yapınca kayıt profilde hem "Katıldığı 1" sayılıyor hem de
  "Yaklaşan"da "KATILIMIN ONAYLANDI" olarak duruyor; etkinlik başlayınca Yaklaşan'dan düşer. Faz 4 profil düzeninde ele alınabilir.
- Dev client'ın "Tools" yüzen düğmesi başlıktaki "Katılımlarım" düğmesinin üstüne biniyor (yalnız dev build).
- Emülatör saati host'tan ~1 dk geride (check-in saati 17:51, durum çubuğu 17:50) — ortam kaynaklı.
- Gboard'un "stylus" tanıtım penceresi `input text`'i yuttu; koşu boyunca `stylus_handwriting_enabled=0` yapıldı, sonra silindi.

## Doğrulanmadı
- Gerçek Android cihaz (yalnız emülatör, yazılımsal GPU).
- Release/preview build: soğuk açılış süresi, beyaz ekran yokluğu, bundle'ın gömülü olduğu durum.
- iOS (cihaz/TestFlight yok).
- Huawei (HMS/Google servissiz cihaz).
- Kamera ile QR okutma (emülatörde kamera izni verilmedi; yalnız elle giriş).
- Gerçek e-posta teslimi (OTP ve veli linki yerel yığın çıktısından alındı).
- TalkBack sesli turu (yukarıdaki nedenle) ve haptic geri bildirim.
- Performans (gerçek cihaz, release build, JS fps).
- Veli sayfasının mobil tarayıcıda açılması (masaüstü headless Chromium, 420×900 görünüm alanı).
- Çevrimdışı senaryoda gerçek ağ kesintisi (emülatörde uçak modu + adb tünelinin kaldırılmasıyla benzetildi).
