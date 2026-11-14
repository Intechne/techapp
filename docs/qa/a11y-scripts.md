# Erişilebilirlik betikleri (kalıcı)

Her tur bu betikle yapılır; sonuçlar `docs/qa/<tarih>-a11y-android.md` ve `<tarih>-a11y-ios.md` dosyalarına yazılır.
Her adım: **yap → beklenen okuma → sonuç (geçti / kaldı / doğrulanamadı) + ekran görüntüsü adı**.

Sonuç sözlüğü: **geçti** (gözlendi, beklenenle aynı) · **kaldı** (gözlendi, beklenenden farklı; bulgu açılır) ·
**doğrulanamadı** (bu araçla görülemiyor; neden yazılır, varsa kapsayan jest testi adı verilir).

## Yöntem

| Yöntem | Ne zaman | Sınır |
|---|---|---|
| **Canlı TalkBack / VoiceOver** | Gerçek cihaz (tercih) | Ekran okuyucu konuşması, rotor, odak sırası, `announceForAccessibility` duyuruları ancak burada duyulur. |
| **Erişilebilirlik ağacı denetimi** (Android emülatör, TalkBack yok / kullanılamıyor) | Emülatörde | `adb shell uiautomator dump` ile her adımın ağacı alınır: odaklanabilir düğümler okuma sırasında, `text` / `content-desc`, sınıf (`Button`, `RadioButton`, `CheckBox`, `Switch`), durum (`checked`, `selected`, `DISABLED`), gruplama (tek `content-desc`'li kapsayıcı = tek durak). **Görülemeyenler:** başlık (`heading`) bayrağı, `accessibilityRole="alert"`, canlı bölge (`accessibilityLiveRegion`), `announceForAccessibility` duyuruları, `no-hide-descendants` etkisi (uiautomator gizlenen düğümleri de listeler). Bunlar için kaynak/jest kanıtı gösterilir, yoksa "doğrulanamadı". |

Ağaç denetiminin yardımcı komutu (örnek): `adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml`;
düğüm başına `class`, `text`, `content-desc`, `checkable/checked/selected/enabled/focusable/clickable`, `bounds` okunur.
Bir `content-desc`'li odaklanabilir kapsayıcının içindeki metinler tek durak sayılır (ayrı okunmaz).

## Hazırlık (Android)

1. Yerel yığın: `npm run db:dev -- --reset --worst-case`, `npm run env:local` (üç `.env.local` yedeklenir, iş bitince geri konur).
2. Dev client + Metro: `cd apps/mobile && npx expo start --dev-client --port 8081`; `adb reverse tcp:8081 tcp:8081`, `adb reverse tcp:54321 tcp:54321`.
3. Hesaplar: 16 yaş (doğum 10.05.2010) bir katılımcı (OTP `db:dev` terminalinde), görevli `organizator@techapp.test`.
   Etkinlik: `genc-urun-gelistiriciler-konferansi` (16+, 18 altı veli onayı). 18+ engel için `yatirimci-karsisinda-ilk-sunum`.
   Veli onayı: db:dev çıktısındaki bağlantı jetonu ile `guardian_decide` ya da `apps/web` `/veli` sayfası.
   Check-in penceresi için yalnız yerel DB'de etkinliğin `starts_at`/`ends_at`/`registration_closes_at` değerleri değiştirilir, sonra özgün değerlere döndürülür.
4. Bitişte: dev client kaldırılır, önizleme APK'sı kurulur, `adb reverse --remove-all`, ölçek/yoğunluk ayarları sıfırlanır.

## A. TalkBack (Android) — akış

| # | Adım | Beklenen okuma |
|---|---|---|
| T1 | Onboarding 3 adım | Üstte "Adım n/3, başlık"; başlık bir `header`; seçenekler `RadioButton` (seçili = `checked`), ilgi alanları düğme + `selected`; "Devam et" seçim yapılana kadar devre dışı. |
| T2 | Keşfet vitrini | Vitrin tek düğüm: başlık, tarih·yer·biçim (·ücret). Beklenen sıra **tür, başlık, tarih·yer, eylem**: kart (liste) okunuşu "başlık. tür. tarih. yer. kitle. ücret. durum"; vitrinde tür etiketi okunmuyorsa bulgu. Arama çubuğu tek düğme "Ara: …" (içindeki alan gizli). Filtre düğmeleri `selected`. |
| T3 | Etkinlik detayı: engel kutusu | Engelli kullanıcıda (ör. 18+ etkinlik, 16 yaş) uyarı kutusu **tek duyuruda** (`alert`) başlık+açıklama okunur; altta alt eylem ("Benzer etkinlikler"). Aynı mesaj üç kez okunmaz. |
| T4 | OTP: kod alanı etiketi | Alan "Doğrulama kodu"; etiket bir kez okunur; "Yeni kod iste (n sn)" geri sayımda devre dışı. |
| T5 | OTP: hata duyurusu | Yanlış kodda hata kutusu `alert` ile duyulur ("Kod hatalı ya da süresi dolmuş…"). |
| T6 | OTP: hata sonrası "Doğrula" adı | Bekleme bitince düğme tekrar "Doğrula, düğme" okunur ("busy" gibi bir ad kalmaz). |
| T7 | 16 yaş kayıt | Rıza `CheckBox` (işaretli = `checked`); "Veli onayı gerekecek" uyarısı okunur; alt eylem "Katılımı tamamla". |
| T8 | Durum çizgisi | Her adım tek durak: "Başvurun alındı, tamamlandı" / "Veli onayı, şu an bu adımda" / "Katılım onayı, sırada" / "Katılım kartı, sırada". |
| T9 | Katılım kartı | QR tek görsel düğüm adı **"Katılım QR kodu"**, ardından kısa kod harf harf ("Kısa kod: 0 F 1 D 9 9 D C"); kod ayrıca ayrı metin olarak okunmaz (çift okuma yok). |
| T10 | Check-in sonucu (ağaç) | Sonuç bloğu **tek** grup etiketi ("Giriş onaylandı. <ad> Hoş geldin diyebilirsin."); tekrar/hata durumlarında da tek etiket; "Sıradaki katılımcı" düğmesi. |
| T11 | Check-in sonucu (duyuru) | Sonuç değişince **tek** `announceForAccessibility`; blokta `alert`/canlı bölge yok. (Canlı TalkBack gerekir.) |
| T12 | Profil sayaçları | Sayaç satırı tek durak: "0 deneyim, 0 doğrulanmış, 3 katılım" (görünen etiketle uyumlu). |
| T13 | Ayarlar anahtarları | `Switch` adı = satır başlığı; durum `checked` (TalkBack "açık/kapalı"); dokununca durum değişir. Satır başlığı iki kez okunmaz. |
| T14 | Başlık gezintisi (rotor/başlıklar) | Her ekranda bir ana başlık (`header`); bölüm başlıkları da `header`; süs metin/marka başlık olmaz. (Canlı TalkBack gerekir; ağaçta `heading` görünmez.) |

## B. VoiceOver (iOS) — aynı akış

T1–T14 aynı adımlar; ek olarak **rotor ile başlık gezintisi** (her ekranda ana başlık `header`), **Dynamic Type en büyük Erişilebilirlik boyutu**
(Ayarlar → Erişilebilirlik → Ekran ve Metin Boyutu → Daha Büyük Metin → en büyük) ve sheet'lerde (formSheet) VoiceOver odağının sheet içinde kalması.
Sonuç `docs/qa/<tarih>-a11y-ios.md`'ye yazılır. Xcode/iOS cihaz yoksa dosya "yapılmadı — neden" olarak açılır.

## C. Yazı ölçeği %200

- Android: `adb shell settings put system font_scale 2.0` … iş bitince `font_scale 1.0`. (Not: ölçek değişince uygulama kökte yeniden açılabilir; ekranı yeniden aç.)
- iOS: en büyük Erişilebilirlik boyutu.
- Ekranlar: **her sekme kökü** (Keşfet, Etkinlikler, Fırsatlar, Topluluk, Profil) + **etkinlik detayı** + **katılım kartı** + **durum çizgisi** + **alt eylem**.
- Beklenen: metin kırpılmaz/üst üste binmez, kaydırma ile her içeriğe ulaşılır, alt eylem görünür ve dokunulabilir,
  **alt sekme etiketleri de ölçeklenir** (sınırlı: `maxFontSizeMultiplier`) ve kesilmez; başlıklar sınırlı büyür (taşmaz).

## D. 320 dp genişlik

- `adb shell wm size 720x1520` + `adb shell wm density 360` (720 px / 2,25 = 320 dp). İş bitince `wm size reset`, `wm density reset`.
- Aynı ekranlar; ayrıca **320 dp + %200** birleşimi (detay + durum çizgisi).
- Beklenen: yatay kaydırma yok; alt sekme etiketleri okunur ve kesilmez; sabit alt eylem içeriği örtmez; içerik penceresi kullanılabilir kalır.

## E. Kontrast

Otomatik: Task 6 aracı (`apps/mobile/scripts/contrast-audit.mjs`, `design-system/__tests__/contrast.test.ts`). Bu betikte elle kontrast ölçülmez;
fotoğraf/kapak üstü metin ve ikon rengi bulguları oradan gelir.

## Tur sonunda

Bulgular **P1** (işlevi engelleyen / adı kaybeden birincil eylem), **P2** (yanlış okuma, ölçeklenmeyen metin), **P3** (kozmetik, gürültü) olarak
ekran + kanıt + önerilen düzeltmeyle yazılır; her P1/P2 için sonraki düzeltme turunda bir test açılır.
