# Faz 4 · Önizleme kapısı (Task 4) — kart ailesi ve beş sekme

> **Durum: onay bekliyor.** Bu belge bir karar için kanıttır. Onay gelene kadar Task 5–10 (ekran uygulamaları) başlamaz.
> Tarih: 12 Kasım 2026 · Plan: `docs/superpowers/plans/2026-11-12-techapp-v5-faz4-design-system-and-five-tabs.md` (Task 4, "Tasarım kararları", "Sekme planları")

## Nasıl hazırlandı

- **Taslaklar** gerçek ekran bileşenleriyle, "Sekme planları" tablosundaki hiyerarşiye göre yazıldı ve **birleştirilmeyecek** ayrı bir dalda duruyor:
  `feat/v5-design-preview` → commit `88aa011` (`wip(design): önizleme taslağı — onay bekliyor`). `feat/v5-product` bu taslakları içermez.
  Taslak dalında typecheck, lint ve `noHardcodedStyle` yeşil; 8 test bilerek kırmızı (eski davranışı bekliyorlar: fırsat son tarih tonları, "Takımlarım" listesi) — Task 7/8'de yeniden yazılacaklar.
- **Veri:** yerel yığın, `npm run db:dev -- --reset --worst-case` (tüm satırlar `is_demo = true`). Giriş yapan kullanıcı `audit.adult@techapp.test`, adı bilerek uzun:
  "Ayşegül Nur Karaosmanoğlu-Çağlayan"; kaptanı olduğu takımın adı 76 karakter ("Şehit Öğretmen Ayşe Gülşen Çağlayan Mesleki ve Teknik Anadolu Lisesi Robotik").
- **Görüntüler:** web (Expo web, Playwright) 390×844 ve 320×640, yazı ölçeği 1.0; Android emülatör (Medium Phone API 36.1, 411 dp genişlik, EAS geliştirme
  derlemesi + yerel Metro) yazı ölçeği 1.0 ve 2.0. Ham görüntüler repoya girmedi (scratchpad `shots/f4t4/`, 160 dosya).
- **"Önce" sütunu** pilot dönemi görüntüleridir (390, Task 1 öncesi). Etkinlik detayının "kayıt açık" hâli için pilotta görüntü yoktu; orada pilotun detay
  ekranının kaydırılmış hâli düzen referansı olarak durur.
- Kontak sayfaları bu klasörde (JPEG, toplam ≈1,9 MB). Her sayfada soldan sağa: önce · taslak web 390 · web 320 · Android 1.0 · Android 2.0.

## Kontak sayfaları

| # | Dosya | İçerik |
|---|---|---|
| 01 | `01-kart-ailesi-demo.jpg` | DesignPreview rotası, demo veri (390 + 320) |
| 02 | `02-kart-ailesi-en-kotu.jpg` | aynı rota, en kötü veri (390, sayfanın tamamı) |
| 03 | `03-kart-ailesi-durumlar.jpg` | yükleniyor · boş · filtre boş · hata · çevrimdışı (390) + en kötü veri 320 |
| 04 | `04-kesfet.jpg` | Keşfet ana |
| 05 | `05-etkinlikler.jpg` | Etkinlikler listesi |
| 06 | `06-firsatlar.jpg` | Fırsatlar listesi |
| 07 | `07-topluluk.jpg` | Topluluk ana |
| 08 | `08-profil.jpg` | Profil (giriş yapmış) |
| 09 | `09-detay-kayit-kapali.jpg` | Etkinlik detayı — kayıt kapalı (+ takım kaydı + yaş: üç neden birden) |
| 10 | `10-detay-kayit-acik.jpg` | Etkinlik detayı — kayıt açık (6000 karakterlik açıklama) |
| 11 | `11-kararlar.jpg` | aşağıdaki soruların görselleri (S1, S2, S3, S6, S8, S9) |

Break-ui sınıfları: **Kırık** (okunamıyor / yanlış), **Çirkin** (okunur ama görünür biçimde yanlış), **Kırılgan** (şimdilik iyi, bir adım ötesi kırık). "Düzeltildi" = bu taslakta ya da Task 1–3'te kapandı; "Karar" = soru listesinde.

---

## 01–03 · Kart ailesi

**Ne değişti, neden:** eski altı kart (`EventCard`, `ListCard`, `OpportunityCard`, `TeamCard`, `CommunityCard`, `OpportunityCardView`) tek tabana
(`CardBase`) oturan üç karta indi: `PosterCard` (etkinlik/kurs), `RowCard` (fırsat, takım, kayıt, başvuru…), `MiniCard` (Keşfet rayları); `HeroCard` korunur.
Köşe yalnız `radius.card` (22), iç boşluk `space[4]`, liste aralığı `space[3]` — sözleşmedeki "Kart ailesi" tablosu. Yedek poster artık dönen yuvarlak kare
değil, Open Circuit'in kendi dili: tür ikonu bir devre pedinde + bir kez dönen iz (S3). İskeletler aynı ölçüden türer: içerik gelince liste zıplamaz (03'te
"Yükleniyor" ile "Veri" aynı yükseklik). "ÖRNEK" tek kaynaktan (`DemoTag`).

| # | Sınıf | Alan | En kötü değer | Ne oluyor | Durum |
|---|---|---|---|---|---|
| K1 | Çirkin | RowCard sağ durum etiketi | "BAŞVURUN İNCELENİYOR · 999 KİŞİ ARASINDA" | 390'da etiket kartın ~%42'sini alıyor, başlık ve ikincil satır dar sütuna sıkışıyor | **Karar S6** (320'de etiket zaten metnin altına iniyor) |
| K2 | Çirkin | PosterCard başlığı | "Ğ-26" (tek satır) | gövde 1 satıra göre ölçülü; 2–3 satırlık başlık kartı uzatır, yan yana kartlar eşit değil | **Karar S8** |
| K3 | Çirkin | tek sözcüklü ad | "Mühendislikbilimleriuygulamalarıtakımı" | web'de de Android'de de sözcük ortasından bölünüyor ("…uygula / malarıtakımı") | Task 3'teki ertelenen (c) **cihazda doğrulandı**: native da böler. Kabul önerilir (gerçek veride nadir; başlık kesilmiyor, tam ad erişilebilirlik etiketinde) |
| K4 | Çirkin | MiniCard 320 ve %200 | takım adı + 2 satır gövde | başlık 1–2 sözcükte kesiliyor ("Şehit Öğretme…"); "1 dk" %200'de "1 d / k" bölünüyor | **Karar S13** |
| K5 | Kırılgan | Vitrin (HeroCard) eyebrow | "ÖNE ÇIKAN · KAHRAMANMARAŞ" | şehir adı büyük harfe çevriliyor (önizleme fikstürü); kural adlar için "asla" diyor | **Karar S2** |
| K6 | Kırılgan | HeroCard vurgu | tek sözcüklü poster satırı "Ğ-26" | "son sözcük lime" kuralı tüm başlığı lime yapıyor (04, ilk kare) | Task 5'te: tek sözcükte vurgu yok |
| — | Düzeltildi (T2–T3) | 7 kırık: 320'de etiket taşması, ezilen Tag ikonu, "BEKLE/ME" bölünmesi, sınırsız meta/dipnot satırları, 7+ satır vitrin başlığı, 320'de "İNCELENİY/OR" | | | |

**Dayananlar:** 119 karakterlik başlık 3 satırda kesilir, tam hâli erişilebilirlik etiketinde · sayılar ve tarihler hiç kesilmiyor ("12.000+ üye", "12.345 / 12.345") ·
"0 üye / 1 üye" tekil-çoğul sorunu yok · Arapça + Japonca ve emoji satır yüksekliğini bozmuyor · İ/ı büyük-küçük dönüşümü doğru · kapaksız ve kırık kapaklı
poster aynı yükseklikte · boş / filtre boş / hata / çevrimdışı durumları tek eylemli ve dürüst.

## 04 · Keşfet ana

**Ne değişti:** sözleşmedeki sıra uygulandı — selam + manşet (`display`, 2 satır, alt slogan kalktı) → arama → ilgi çipleri → vitrin (yalnız kaydı açık; yoksa
liste yukarı çıkar, boşluk ayrılmaz) → **Yaklaşan etkinlikler 3 poster** (önce 4) → **Sıradaki adımın** 3 fırsat satırı → **Birlikte üretenler** 2 mini kart →
**Gelişim** 2 kurs mini kartı (yeni; `courses` tablosundan). Bölüm boşsa gizlenir; hepsi boşsa tek boş durum ("Şu an yayında içerik yok — ilgi alanlarını
genişlet"); filtre sonucu boşsa yalnız etkinlik bölümünde "Bu filtrelerle sonuç yok" + "Filtreleri temizle". Bölüm eylemleri tek dilde: "Tümünü gör".
Vitrin meta satırı `metaJoin` ile (satır başında "·" kalmaz). Takım ikonu: robot yalnız robotik kategoride (ikon anlam tablosu).

**Taslakta olmayanlar (Faz 3b birleşmedi, plan "Self-review" gereği atlandı):** arama alanı dokununca Arama ekranına gitmiyor (o ekran yok; yerinde etkinlik
araması korunuyor) · bildirim zili yok · kurs kartları bir yere gitmiyor (kurs ekranı yok).

| # | Sınıf | Ne oluyor | Durum |
|---|---|---|---|
| D1 | Çirkin | 320 ve %200'de "Yaklaşan etkinlikler" başlığı "Tümünü gör" yanında 2 satıra kırılıyor | Task 5: dar ekranda/büyük yazıda eylem başlığın altına ya da yalnız "Tümü" |
| D2 | Kırılgan | "Yaklaşan" başlangıç tarihine göre sıralı; kaydı dün kapanmış iki etkinlik listenin başında | **Karar S4** |
| D3 | Çirkin | Mini kartlar 320/%200'de (K4) | **Karar S13** |

**Dayananlar:** yatay taşma yok (320, %200) · fırsat satırlarında son tarih etiketi + mutlak tarih bölünmüyor · alt sekme etiketleri %200'de görünür.

## 05 · Etkinlikler listesi

**Ne değişti:** "MERAKINI HAREKETE GEÇİR" slogan eyebrow'u kalktı (eyebrow yalnız kategori/durum için — S2); manşet tek başına. "Filtrele" etkin filtre
sayısını taşıyor ("Filtrele · 2"; önce yalnız çevrim içi için "Filtre · 1"). Filtre boş metni sözleşmedeki gibi: "Bu filtrelerle sonuç yok".
Native form sheet (tür, biçim, şehir, tarih, yalnız kaydı açık) Task 6'nın işi — taslakta mevcut alt sayfa duruyor.

**Bulgular:** yeni kırık yok. Poster listesi 320'de ve %200'de taşmıyor; "KAYIT KAPANDI" + "ÖRNEK" aynı etiket satırında.

## 06 · Fırsatlar listesi

**Ne değişti:** slogan eyebrow ve tür listesi paragrafı kalktı (çipler aynı şeyi söylüyor; ilk satır kart yukarı çıktı). Son tarih etiketi sözleşmeye göre:
**≤1 gün apricot** ("SON GÜN BUGÜN", "SON 1 GÜN" — panik değil uyarı; önce bugün kırmızıydı), **≤7 gün iris**, sonrası **etiket yok** (mutlak "Son başvuru"
tarihi yeterli; önce yeşil "18 GÜN KALDI"). Yarışma ikonu robot değil rozet (Task 2). Sağda kaydet = "Son tarihi takip et". Geçmiş son tarihli fırsat listede yok.

| # | Sınıf | Ne oluyor | Durum |
|---|---|---|---|
| F1 | Çirkin | özet satırı listeden kalktı (yalnız tür · yer · hedef kitle · ödül) | **Karar S7** |
| F2 | Kırılgan | öncü karo kurum logosu yerine hep tür ikonu (logo için `expo-image` / 3b T4 yok) | 3b birleşince |
| F3 | Çirkin | %200'de "Son başvuru: 12 Kasım 2026" iki satıra iniyor, kart uzuyor | kabul önerilir (tarih kesilmiyor, bölünmüyor) |

## 07 · Topluluk ana

**Ne değişti:** slogan eyebrow kalktı. "Takımlarım" listesi (her satırda rol etiketi; K1 sıkışması) yerine **"Takımım" tek satırlık kısayol**: etkin üyelik varsa
ilk takım, ikincil satır "Takımım · Kaptan" (+ "N takım daha"), sağda chevron → Takım alanı. Segment sırası **Takımlar | Topluluklar** (plan). Robot ikonu
yalnız robotik kategoride; diğer takımlar takım, topluluklar topluluk ikonu. "Takım kur" serbest metin bloğu yerine kart (ikon karosu + başlık + ikincil düğme;
"KENDİ EKİBİN" slogan etiketi kalktı).

| # | Sınıf | Ne oluyor | Durum |
|---|---|---|---|
| T1 | Çirkin | 76 karakterlik takım adı kısayolda 2 satırda kesiliyor | kabul önerilir (tam ad Takım alanında; kartta 2 satır sözleşme) |
| T2 | Kırılgan | bekleyen katılma isteği artık ana ekranda görünmüyor (yalnız takım profili + Profil > Takımlar) | **Karar S15** |
| T3 | Çirkin | tek sözcüklü takım adı sözcük ortasından bölünüyor (K3) | K3 |

## 08 · Profil (giriş yapmış)

**Ne değişti:** diğer dört sekme gibi manşet ("Yaptıkların seni anlatsın.", `display`) — önce iris kapak + kapağa taşan avatar vardı. Kimlik **tek kart**: avatar
56 + ad + eğitim aşaması; sağda düzenle (kalem) düğmesi. **E-posta profilde yok** (Ayarlar > Hesap'a ait; o ekran henüz yok). Sayaçlar → Yaklaşan (≤3) →
Deneyimler/Katılımlar/Takımlar → Beceriler ve Dijital CV bölümleri segmentin altına indi → Katılımlarım girişi → Hesap. "Deneyim ekle" ikinci düğme olmaktan
çıkıp Deneyimler segmentine taşındı (boşken boş durumun eylemi, doluyken listenin altında).

| # | Sınıf | Ne oluyor | Durum |
|---|---|---|---|
| P1 | **Kırık** | Android 1.0 (411 dp) ve web 320'de uzun ad sözcük ortasından bölünüyor: "Karaosma / noğlu-Çağlayan", "Karaosmano / ğlu-" | **Karar S14** — ad sütununa tam genişlik (düzenle başlık çubuğuna), Android'de `textBreakStrategy="simple"` |
| P2 | **Kırık** | %200'de sayaç etiketi "Doğrulanmı / ş", segment "Deneyiml / er", CV kartı başlığı "bağl / antın" | **Karar S14** — %150 üstünde sayaçlar alt alta, segment iki satırlık etikete izin |
| P3 | Kırılgan | Kaydedilenler · Bildirimler · Ayarlar girişleri yok (modüller 3b'de) | plan gereği atlandı; "Hesap" bloğu Ayarlar gelene dek altta |

**Dayananlar:** 0/0/0 sayaçta kart dengeli · avatar hiçbir boyutta kapağa/karta taşmıyor · yalnız sunucudan gelen eğitim aşaması gösteriliyor.

## 09 · Etkinlik detayı — kayıt kapalı

**Ne değişti:** sözleşmedeki **tek uyarı kutusu**: sunucunun verdiği nedenlerden en belirleyicisi (öncelik kayıtlı → kapandı → dolu → yaş → takım) başlık,
kalanlar "Diğer nedenler: …" (önce üç ayrı kutu üst üste diziliyordu). Altta **pasif birincil düğme yok**: neden satırı + ikincil eylem — kapandı/dolu/yaş →
"Benzer etkinlikler", yalnız takım kaydı → "Takımını bul". Başlık çubuğunda "Etkinlik" yazısı yok; geri + paylaş. Gönüllü ol bölümü en sona indi.

| # | Sınıf | Ne oluyor | Durum |
|---|---|---|---|
| E1 | Çirkin | "Kayıtlar kapandı." hem uyarı kutusunda hem alt alandaki neden satırında | **Karar S11** |
| E2 | Çirkin | web'de düzenleyen satırındaki doğrulama ikonu uzun kurum adının yanında noktaya eziliyor (`OrganizerRow`, ikon `flexShrink`) | Task 6: ikona `flexShrink: 0` (Android'de doğru çiziliyor) |
| E3 | Kırılgan | detay posterinde kurum adı eyebrow stilinde (harf aralıklı, kalın) — büyük harfe çevrilmiyor ama kategori gibi okunuyor | **Karar S2** |
| E4 | Kırılgan | "Kaydet" ikincil eylemi ve başlıktaki kaydet yok (Kaydedilenler 3b) | 3b birleşince |

## 10 · Etkinlik detayı — kayıt açık

**Ne değişti:** yapışkan "Etkinliğe katıl" tek birincil eylem; meta bloğu (tarih-saat, yer, hedef kitle · ücret, kayıt biçimi, son kayıt, kontenjan);
düzenleyen → Neler olacak → Program → Bilmen gerekenler → Gönüllü ol. "Bu etkinliğe hazırlan" (bağlı kurslar) verisi taslakta çekilmedi; Task 6'da.

| # | Sınıf | Ne oluyor | Durum |
|---|---|---|---|
| E5 | Çirkin | 6000 karakterlik açıklama detayda tam: ~7 ekran boyu metin, Bilmen gerekenler çok aşağıda | **Karar S12** |
| E6 | Dayandı | "IĞDIR İÇİN … ığdır ılgaz İstanbul" başlığı 3 satır sarılıyor, kesilmiyor; İ/ı doğru | — |

---

## Sorular (her biri için önerim)

1. **Çevrimdışı etiketinin tonu** (katılım kartı, `11-kararlar` S1). Şimdi apricot + saat. **Öneri:** `OfflineBanner` ile aynı nötr ton (ink zemin, beyaz yazı,
   offline ikonu). Çevrimdışı bir bağlantı durumu; apricot "son tarih yaklaşıyor" uyarısına ayrılsın.
2. **Eyebrow kuralı** (S2). Sözleşme: BÜYÜK HARF eyebrow yalnız kategori/durum; kurum/takım/kişi adı asla büyük harf olmaz. Taslak sekme köklerindeki slogan
   eyebrow'larını kaldırdı. Açık iki yer: (a) detay posterinde kurum adı eyebrow stilinde, (b) vitrin eyebrow'unda şehir büyük harf. **Öneri:** (a) kurum adı
   posterden çıksın (düzenleyen satırında zaten var), posterde yalnız tür; (b) şehir eyebrow'dan meta satırına; slogan eyebrow'lar geri gelmesin.
3. **Kapaksız poster grafiği** (S3). Dönen yuvarlak kare yerine tür ikonu pedi + bir kez dönen devre izi, tondan zemin, Manrope poster satırı. **Öneri:** onay;
   kapak geldiğinde (3b) aynı 16:10 kutuya girer.
4. **Keşfet bölüm sırası.** Taslak: vitrin → Yaklaşan (3) → Sıradaki adımın (3) → Birlikte üretenler (2) → Gelişim (2). **Öneri:** bu sıra; ek olarak
   (a) "Yaklaşan"da kaydı kapanmış etkinlikler gösterilmesin (Etkinlikler listesinde kalırlar), (b) kurs ekranı gelene dek Gelişim gizlensin (gidilecek yer
   olmayan kart vaat etmeyelim).
5. **Etkinlik kartında düzenleyen adı.** Poster kartı sözleşmesinde alan yok; adı düşürdük. **Öneri:** kartta yok (meta 2 satırda kalsın, uzun kurum adları
   kartı şişirmesin); düzenleyen detayda, doğrulama rozetiyle.
6. **RowCard sağ durum etiketi 390'da başlığı sıkıştırıyor** (S6; Takımım/Başvurularım/Katılımlarım satırları). Seçenekler: A) sağda kalsın (bugünkü), B) telefonda
   (<600 dp) hep metnin altında — 320'de zaten öyle, C) etiket metinleri ~14 karaktere kısaltılsın, sağda kalsın. **Öneri: B** — durum okunur, başlık tam
   genişlik alır, tüm telefon boylarında tek düzen; satır ~28 pt uzar.
7. **Fırsat özeti liste satırından kalktı.** **Öneri:** kalksın; ikincil satır tür · yer · hedef kitle · ödül (karar verdiren bilgi), özet detayda.
8. **Poster başlığına 2 satır ayırmak mı, 1 satırlıkta boşluk mu?** (S8) Bugün gövde 1 satıra göre; uzun başlık kartı uzatıyor. 2 satır ayırmak tek satırlık
   başlıkların altında ~23 pt boşluk bırakıyor. **Öneri:** ayırmayalım (dikey listede eşit yükseklik gerekmiyor; boşluk "eksik" okunuyor), iskelet 1 satır kalsın.
9. **Task 1 token birleştirmesinin görünür farkları** (S9): uyarı Notice zemini `#FFF1E9 → #FFD9C9` (+ ikon saat → uyarı), apricot çip ve Son tarihler acil
   kutusu `#FFE8DD → #FFD9C9`, bilgi Notice yazısı `#4A4583 → #3F36A3`, onboarding sanat zemini `#253E35 → #283A32`, köşeler profil kapağı 32 → 22 · segment
   10 → 8 · onay kutusu 7 → 8, katılım kartı kısa kodu 18 → 17, OTP alanı 22 → 24. **Öneri:** hepsini kabul (yeni renk yok, hepsi palet tonlarına oturdu;
   apricot biraz koyulaştı ama 4.5:1 kontrastı geçiyor).
10. **Dark mode açılmıyor.** `semantic.dark` "draft" olarak duruyor, uygulamaya import edilmiyor; `userInterfaceStyle: light`. **Öneri:** Faz 4'te açık tema
    yalnız; dark mode ayrı bir fazda kendi önizleme kapısıyla.
11. **Detayda neden iki yerde** (uyarı kutusu + alt alan, E1). **Öneri:** ikisi de kalsın — kutu tam açıklamayı ve diğer nedenleri taşır, alt alan kaydırınca da
    görünen tek satırlık özet + yapılabilecek eylem; ancak alt satır kısa kalsın ("Kayıtlar kapandı.").
12. **Uzun açıklama** (E5). **Öneri:** detayda 8 satırdan sonra "Devamını oku" (yerinde açılır); kısa açıklamalarda düğme yok.
13. **Mini kartlar dar ekranda** (K4, D3). **Öneri:** 360 dp altında ya da yazı ölçeği ≥1.5'te tek sütun (tam genişlik); 390'da iki sütun kalsın.
14. **Profil kimlik kartı ve %200** (P1, P2). **Öneri:** düzenle düğmesi başlık çubuğuna (ad tam genişlik alır); Android'de adlarda `textBreakStrategy="simple"`;
    yazı ölçeği ≥1.5'te sayaçlar alt alta satır, segment etiketleri iki satıra sarılabilir.
15. **Bekleyen katılma isteği ana ekranda yok** (T2). **Öneri:** plan gibi yalnız etkin üyelik "Takımım"da; bekleyen istek takım profilinde ve Profil > Takımlar'da
    görünsün (ileride Bildirimler'e de düşer).
16. **Faz 3b'ye bağlı satırlar** (Arama ekranı, bildirim zili, detayda Kaydet, Kaydedilenler/Bildirimler/Ayarlar girişleri, kurs ekranı, kurum logosu/kapak
    görselleri). **Öneri:** Task 5–9'da bu satırlar atlanır ve her task raporuna not düşülür; 3b birleşince giydirilir (plan "Self-review").

## Ekler

- Ham görüntüler: `<scratchpad>/shots/f4t4/` — `f4t4-web-{390|320}-<ekran>-N.png`, `f4t4-and-{fs10|fs20}-<ekran>-N.png`, `f4t4-web-390-kartlar-durum-*.png`.
- Yeniden üretmek: `feat/v5-design-preview` dalında `npm run db:dev -- --reset --worst-case`, `npm run env:local`, `CI=1 npx expo start --web --clear`;
  önizleme rotası `http://localhost:8081/design-preview?data=worst&state=data` (yalnız yerel geliştirme).
- Android notu: ekran görüntüleri EAS geliştirme derlemesiyle (`3e02e2cf`) alındı; emülatöre sonra yayın önizleme APK'sı (5.0.0) geri kuruldu.

## Onay

- Tarih:
- Onaylanan kontak sayfaları:
- İstenen değişiklikler:
- Sorulara verilen cevaplar (1–16):
