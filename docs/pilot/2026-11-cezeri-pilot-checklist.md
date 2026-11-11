# TechApp · Cezeri Robot Ligi kontrollü saha pilotu — kabul kontrol listesi

Pilot: Cezeri Robot Ligi, Ümraniye, 27–29 Kasım 2026 · Hazırlandı: 11 Kasım 2026 · Dal `feat/v5-pilot-platform` (GitHub'a itildi, main'e birleştirilmedi)
Bağlayıcı kaynak: `docs/superpowers/specs/2026-11-11-techapp-v5-design.md` §3, §7, §8a. Güncel durumun tek kaynağı `IMPLEMENTATION-STATUS.md` V5 bölümüdür.

**Kural:** ✅ yalnız yazılı kanıt bağlantısı olan madde içindir. 🟡 kısmen kanıtlı. ⛔ kanıt yok / bloke. Cihaz, iOS, Huawei ve gerçek kullanıcı sonucu olmayan şey "doğrulandı" diye yazılmaz.

## 1. Pilot kapısı (spec §7)

| # | Madde | Durum | Kanıt | Sahip | Kapanması için gereken |
|---|---|---|---|---|---|
| 1 | Staging'de adult + minor/veli uçtan uca, gerçek e-posta, son build | 🟡 | `docs/qa/2026-11-staging-e2e.md` — EAS preview `5e6c9ee3` (commit `a73e774`), Android 16 emülatörü, staging `pacvhcnawtnkauvguoaw`: adım 1–7 PASS (gerçek OTP, veli onayı, çevrimdışı kart C1, görevli check-in, hesap silme). Açık: **M2** kodda düzeltildi (`f90c3bf`, cihazda ölçülmedi), adım 8 bu turda bakılmadı, istemsiz otomatik geçiş gözlemi, kamerayla QR denenmedi | dev | M2 düzeltmesi (JS) yeni build veya OTA ile gelecek → onay sonrası aynı emülatör/staging turunun yinelenmesi; adım 8 yeniden bakılacak |
| 2 | Ayrı production Supabase projesi (migration, seed yok, OTP şablonu, SMTP, secret) | ⛔ | `docs/KNOWN-ISSUES.md` "Remote Supabase": production projesi yok; EAS `production` ortamı hâlâ staging URL'i taşıyor (`envValidation.js` production build'i bilerek reddeder) | **kullanıcı/Intechne** karar + onay; dev uygular | Karar: production projesi açılsın mı, yoksa pilot staging'de yalnız sentetik/personel hesaplarla mı koşulsun (bkz. go/no-go belgesi, madde B). Production açılırsa spec §7.2 adımları, kullanıcı onayıyla |
| 3 | Hukuk: aydınlatma, veli onayı, kullanım koşulları (onaylı, sürümlü) | ⛔ | `KNOWN-ISSUES.md` "Hukuki": metinler **yok**, uydurulmadı; web `/gizlilik`, `/kosullar` "hazırlanıyor" | **kullanıcı/Intechne** (hukuk) | Onaylı metinler + sürüm. Gelmezse gerçek kullanıcıya açılma yok (§8a.3); pilot yalnız bu kısıtla koşar |
| 4 | EAS Android+iOS build; emülatörde 8 adım PASS; gerçek iPhone + gerçek Android; Huawei check-in | ⛔ | Android: dev build `3e02e2cf` ve preview `5e6c9ee3` emülatörde çalıştı (`2026-11-pilot-journey-android.md`, `2026-11-staging-e2e.md`). **Gerçek Android, iPhone, Huawei: sonuç yok.** iOS build alınmadı | **kullanıcı** (cihaz, Apple hesabı), dev | En az bir gerçek Android telefonda kontrol listesi turu (bkz. §6); iOS için §2.2; Huawei pilot dışı, "doğrulanmadı" kalır |
| 5 | Remote güvenlik regresyonu, yeni tablolar için RLS, 18 yaş altı görünürlük denetimi | ✅ | Staging migration 17/17 senkron; remote regresyon **38/38** (rollback, kalıntı 0), commit `ec57862`; DB testleri 125/125; D2 "benim kayıtlarım" sorgu denetimi + üyelik notları gizliliği (`6281653`…`b6f79ca`, final review). Not: `teams.created_by` / `recruitment_posts.created_by` anon okunur — takım kaydı pilot dışı olduğu için pilotu etkilemez, takımlar açılmadan önce kapatılacak | dev | Kapalı. M2 yamasından sonra regresyonu yeniden koşmak gerekmez (JS-only); migration eklenirse yeniden |
| 6 | Erişilebilirlik turu (TalkBack, büyük yazı, 320 pt) + HIG Doctor serious yok | 🟡 | HIG Doctor `--fail-on serious`: 0 critical (11 Kasım; `docs/audits/2026-11-11-hig-doctor.md`, `KNOWN-ISSUES.md`); emülatörde yazı ölçeği 2.0 PASS, 320 dp turu yapıldı (D6/D8 düzeltildi). **TalkBack sesli tur yapılamadı** (adb dokunuşu TouchExplorer'dan geçmiyor) | dev + **kullanıcı** (gerçek cihaz) | Gerçek Android cihazda TalkBack ile görevli akışı + katılım kartı turu |
| 7 | Crash reporting açık **veya** kapalılığın yazılı kabulü | ⛔ | `docs/CRASH-REPORTING.md`: Sentry kodu kurulu, DSN yok → kapalı; açık: saklama süresi kararı (öneri 30 gün, AB), hesap/DSN | **kullanıcı/Intechne** | Ya Sentry hesabı + DSN (kurulum adımları belgede; sunucu tarafı temizleyici + IP engeli zorunlu, yeni build gerekir) ya da "pilotta crash reporting kapalı" yazılı kabulü (go/no-go belgesindeki Karar bölümü bu kabulü taşıyabilir) |
| 8 | Etkinlik günü planı: görevli hesapları, cihaz başına check-in testi, bağlantı kesilirse admin web + kısa kod yedeği | 🟡 | Plan bu belgede (§3–§6). Kısa kod yolu emülatörde PASS (`2026-11-staging-e2e.md` 7a–7c); admin web check-in kodda var ve yerel testlidir, **bu pilot için prova yapılmadı**; görevli hesapları açılmadı | **kullanıcı/Intechne** (görevli listesi), dev | Görevli hesaplarının oluşturulması, cihaz başına prova (§6), admin web adresinin ve girişinin provası |

**Özet:** ✅ 1 · 🟡 3 · ⛔ 4 (8 madde). "Pilota hazır" denmez.

## 2. Kullanıcı kararları (spec §8a) — uygulama durumu

| §8a | Karar | Durum | Kanıt / not |
|---|---|---|---|
| 1 | Cezeri'de resmî takım kaydı TechApp'e bağlanmaz; bireysel test kaydı | ✅ uygulandı | DB `registration_mode='team'` kaydı reddeder; etkinlik detayında "yalnız takım" uyarısı (`KNOWN-ISSUES.md`) |
| 2 | Kullanıcılar: görevli + Intechne ekibi + az gönüllü; Android EAS preview; iOS yalnız TestFlight hazırlığı | 🟡 | Android preview APK var (`5e6c9ee3`); iOS hazırlığı **yapılmadı** (§2.2); cihaz turu yok |
| 3 | Hukuk eksik; gerçek 18 yaş altı verisi ve herkese açık kayıt yok | ⛔ metinler yok | Kısıt bu belgenin veri kuralları (§3) ile uygulanır |
| 4 | Dondurma 21 Kasım, go/no-go 24 Kasım (kullanıcı) | 🟡 | `2026-11-24-go-no-go.md` hazır; karar bekliyor |
| 5 | Sentry şartlı onaylı | 🟡 | Kod ve veri minimizasyonu hazır (`CRASH-REPORTING.md`); DSN ve saklama kararı açık |
| 6 | Pilot ≠ ürün; Faz 3b–5 planları | ✅ | Planlar yazıldı ve commit'lendi (ledger Task 16) |
| 7 | Yalnız kullanılan native paket | ✅ | Reanimated+worklets, expo-haptics, Sentry; dev ve preview build derlendi (`3e02e2cf`, `5e6c9ee3`) |
| 8 | Git kuralları | ✅ | Dal itildi, force push yok, main'e merge yok, production DB'ye dokunulmadı |

## 2.1 Android dağıtımı (pilot kullanıcıları)

- Yalnız **EAS preview APK** (profil `preview`, dahili dağıtım). Mevcut: build `5e6c9ee3` (commit `a73e774`). M2 düzeltmesi ya yeni preview build ya da `eas update --channel preview --environment preview` (preview kanalında şu an hiç OTA yok) ile gelir; **her ikisi de kullanıcı onayı ister**.
- Kurulum: Intechne'nin EAS hesabındaki build sayfasından APK/QR bağlantısı yalnız pilot listesindeki kişilere gönderilir; "bilinmeyen kaynaktan kurulum" izni cihazda açılır. Eski TechApp 1.0 (aynı paket adı) varsa önce kaldırılır (emülatörde böyle yapıldı).
- Uygulama **staging** Supabase'ine bağlıdır (preview ortamı doğrulandı). Etkinlik ve veri örnek/sentetiktir.

## 2.2 iOS — TestFlight iç test (durum: YAPILMADI)

Gerekenler: (1) Apple Developer Program üyeliği (kurumsal) ve Team ID; (2) `com.intechne.techapp` bundle id sahipliği; (3) App Store Connect'te uygulama kaydı (ASC App ID); (4) `eas build -p ios` ile iOS build (interaktif Apple girişi, EAS kimlik yönetir; **maliyet/onay kullanıcıdan**) ve `eas submit -p ios`; (5) App Store Connect kullanıcıları olarak eklenmiş iç test kullanıcıları (en çok 100, Apple ID gerekir). Bugün: hiçbiri tamamlanmadı, iOS build alınmadı, iPhone'da hiçbir doğrulama yok. Sonuç: **iOS "doğrulanmadı"**. Dış test (TestFlight Beta App Review) bu pilotun kapsamı değildir (§8a.2; dondurmayı ~1 hafta öne çeker). Tester e-postası gönderme/yayın adımları kullanıcı onayıyla.

## 3. Pilot kullanıcı listesi ve veri kuralları

**Kimler kurabilir:** yalnız (a) etkinlik görevlileri, (b) Intechne ekibi, (c) kullanıcının seçtiği az sayıda gönüllü test kullanıcısı. Liste yazılı tutulur (ad, rol, cihaz modeli/Android sürümü, kurulum tarihi); listede olmayan kişiye APK bağlantısı verilmez. Herkese açık kayıt, katılımcı dağıtımı, mağaza yayını yok.

**Veri kuralları**
- Yalnız **sentetik hesaplar** ve **18 yaşını doldurmuş personel/ekip hesapları**. Staging verisi örnek veridir; gerçek katılımcı listesi içeri aktarılmaz.
- **18 yaş altı gönüllü bu pilotta yer alamaz.** Gönüllü test kullanıcısı 18 yaşın altındaysa kurulum ve kayıt yapılmaz; gerekirse yetişkin görevli/ekip üyesi onun yerine senaryoyu yürütür. Hukuk onayı (aydınlatma + veli onay metni) gelmeden gerçek reşit olmayan verisi toplanmaz.
- Veli/minör akışı yalnız sentetik hesapla (ör. +alias e-posta) ve Intechne'ye ait veli e-postasıyla denenir; gerçek çocuk e-postası kullanılmaz.
- Takım kaydı yok; yalnız **bireysel test kaydı** (§8a.1). Katılımcılara pilot sırasında "resmî kayıt TechApp'te değil" bilgisi verilir.
- Test hesapları pilot sonunda uygulamadan "Hesabımı sil" ile (doğrulandı: kullanıcı, kayıt, görevli üyeliği silinir) veya staging temizliğiyle sıfırlanır; sayıyla doğrulanır.
- Sentry kapalıyken kayıp çökme verisi olur; kullanıcılar sorunu elle bildirir (§5).

## 4. Etkinlik günü operasyonu

**Önceden (21 Kasım dondurmadan sonra; ilk cihaz turu 22–23 Kasım'da yapılmalı ki 24 Kasım kararı kanıta dayansın, son tur 26 Kasım):**
1. Staging'de pilot etkinliği tek kayıt olarak yayınlanır (hangi etkinlik/ad: kullanıcı onayı bekler; admin web'den, bireysel mod, kontenjan). Yalnız bu etkinlik vitrinde olmalı.
2. Görevli hesapları: her görevli kendi e-postasıyla OTP ile girer; admin web'de etkinlik için **görevli (organizatör) rolü** atanır. Görevli sayısı ≥ 2 artı bir yedek; her görevlinin e-posta kutusuna erişimi test edilir (OTP gerçek e-postayla gelir).
3. Cihaz başına prova (her görevli cihazı, §6 betiğinin 5–9. adımları): kamera izni, QR tarama, kısa kod, yanlış kod, tekrar okutma.
4. Test katılımcı kayıtları önceden yapılır; her biri kartını bir kez açar (kart önbelleğe alınır, çevrimdışı görüntüleme için).

**Etkinlik günü akışı:** Görevli uygulamayı açar → Check-in → etkinlik önceden seçili gelir → katılımcının QR'ı okutulur. Sonuç ekranı: "GİRİŞ ONAYLANDI" / "DAHA ÖNCE GİRİŞ YAPILMIŞ" (ilk giriş saatiyle) / eşleşme yok.

**Yedekler:**
- **Kamera/QR okunmuyor:** kartın altındaki **kısa kod** elle girilir (büyük/küçük harf fark etmez; sunucu denemeleri sınırlar, art arda yanlış kod hız limitine takılır).
- **Görevli cihazı çalışmıyor/çökerse:** başka görevli cihazı veya **admin web check-in** (apps/admin; yayın adresi ve oturum açma bu pilot için prova edilecek — şu an doğrulanmış bir prod adresi kayıtlı değil).
- **Bağlantı yok:**
  - Katılımcı tarafı: kart çevrimdışı görünür ("Son güncelleme … · çevrimdışı"); soğuk açılışta bile kayıtlı kartlar açılır (C1 emülatörde PASS). **M2:** ölçülen ~60 sn gecikme kodda düzeltildi (`f90c3bf`, 3 sn sonra kayıtlı kartlar); cihazdaki build'e henüz gitmedi — gitmezse katılımcıya "uygulamayı bağlantı varken açın, karta bir kez girin" denir.
  - Görevli tarafı: **çevrimdışı check-in yoktur (bilinçli)**; doğrulama ağ ister. Yedek: görevli telefonunun mobil verisi / başka hattan hotspot; o da yoksa katılımcı adı **kâğıt listeden** elle işaretlenir ve bağlantı dönünce admin web/kısa kodla sisteme işlenir. Kâğıt liste pilot katılımcı sayısı küçük olduğundan makul; yine de önceden basılır.

## 5. Olay yönetimi

- **Kime:** pilot sorumlusu (Intechne tarafı, **ad ve telefon etkinlikten önce buraya yazılacak**: `______`) → geliştirme (dev) → gerekirse kullanıcı. Önem ölçeği: P1 = check-in yapılamıyor / veri sızıntısı şüphesi / uygulama açılmıyor; P2 = yavaş/yanlış metin; P3 = kozmetik.
- **Uzaktan kapatma anahtarı (kill switch) YOKTUR.** Push yok, uzaktan yapılandırma yok. Seçenekler:
  1. **Sunucu tarafı:** etkinliğin kayıt durumunu admin web'den kapatmak/yayından kaldırmak; belirli hesabı silmek veya engellemek (kayıt oluşturmayı durdurur, kurulu uygulama açık kalır).
  2. **Staging'i durdurmak:** Supabase proje duraklatma (**kullanıcı kararı**, tüm uygulamayı kırar, staging tek ortam).
  3. **OTA düzeltme:** JS-only hata için `eas update --channel preview` (onay gerekir, kullanıcı uygulamayı yeniden açınca alır; garanti süre yok).
  4. **Yeni APK:** native sorun için; dağıtım ve kurulum süresi saatler.
  5. Son çare: kullanıcılara APK'yı kaldırmaları söylenir (listedeki kişilerle telefonla).
- **Veri olayı şüphesi:** 18 yaş altı verisi gördüğü iddia edilirse hemen P1; ilgili hesap(lar) silinir, kullanıcıya haber verilir, `docs/` altına tarihli not düşülür. Sentry yok → ekran görüntüsü + cihaz modeli + saat istenir.
- Bildirim biçimi: ekran görüntüsü, saat, hesap rolü (e-posta değil), cihaz modeli, Android sürümü.

## 6. Prova betiği (ilk tur 22–23 Kasım, go/no-go kanıtı için; ikinci tur gün öncesi 26 Kasım; her görevli cihazında)

Ön koşul: pilot APK kurulu, staging'de pilot etkinliği yayında, 2 test katılımcı hesabı (A: yetişkin, B: sentetik minör + Intechne veli e-postası), görevli hesapları atanmış.

| # | Adım | Beklenen sonuç |
|---|---|---|
| 1 | Uygulamayı soğuk aç | Beyaz ekran yok; onboarding/misafir keşif |
| 2 | Misafir olarak vitrine bak | Yalnız pilot etkinliği öne çıkar; detayda "Bireysel kayıt · 18 yaş altına veli onayı" |
| 3 | A hesabıyla gerçek e-posta OTP ile giriş | Kod gelen kutusuna ulaşır, girişten sonra kayıt ekranına dönülür |
| 4 | A kayıt olur (tek dokunuş) | Doğrudan onay, veli adımı yok; yalnız **bir** kayıt oluşur |
| 5 | A kartı açar (QR + kısa kod) | Kart görünür; ekran parlaklığı ipucu |
| 6 | B kayıt olur | "Veli onayı bekleniyor"; veli e-postası gelir, onay sayfası maskeli adres ve son geçerlilik gösterir; veli onaylar; uygulama öne gelince B "KATILIMIN ONAYLANDI" |
| 7 | **Uçak modu + uygulamayı kapat/aç** (A cihazında) | Kayıtlı kart erişilir, "Son güncelleme … · çevrimdışı"; **liste gecikmesi süresini ölç ve yaz** (hedef: M2 sonrası birkaç sn; ~60 sn ise rapora yaz) |
| 8 | Görevli cihazı: Check-in → etkinlik seçili → A'nın QR'ını **kamerayla** oku | "GİRİŞ ONAYLANDI", haptik geri bildirim |
| 9 | Aynı kodu tekrar; yanlış kısa kod; küçük harfli kısa kod | "DAHA ÖNCE GİRİŞ YAPILMIŞ" (saatiyle) · "Bu kodla eşleşen bir kayıt yok" · küçük harf kabul edilir |
| 10 | Görevli cihazını uçak moduna al, kısa kod dene | Net hata (ağ yok); çevrimdışı check-in beklenmez; yedek (§4) uygulanır |
| 11 | Admin web check-in: aynı katılımcıyı bu kez web'den doğrula | Önceden check-in'li katılımcı "daha önce" döner; B için yeni check-in çalışır |
| 12 | A profili aç | "Katılım" sayacı check-in'li etkinliği sayar |
| 13 | Çıkış → başka hesapla giriş | Önceki hesabın kayıt/kartı görünmez |
| 14 | Yazı ölçeği büyük + dar ekran; mümkünse TalkBack ile 5–8 | Metin kırpılmaz, hedefler basılabilir; TalkBack sonucu yazılır (yapılmadıysa "doğrulanmadı") |
| 15 | Temizlik | Test hesapları "Hesabımı sil" ile silinir; staging'de kalıntı sayısı 0 |

Her cihaz için sonuç tablosu (cihaz, Android sürümü, adım, PASS/FAIL, not) 24 Kasım paketine eklenir. Provası yapılmamış cihaz sahada kullanılmaz.
