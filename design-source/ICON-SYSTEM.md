# TechApp ikon sistemi — Open Circuit v2

> Kaynak: `design-source/icons/<kategori>/<ad>.svg` (+ `<ad>.fill.svg`) · Geometri: `icon-master/tools/spec.py`
> Illustrator master: `icon-master/TechApp-Icons-OpenCircuit-v2.ai` (82 artboard) · Önizlemeler: `icon-master/previews/`
> Uygulamada tek API: `<TechIcon name=… filled? />` — `npm --prefix apps/mobile run icons` ile üretilir.

## 1. Mevcut sistemin sorunları (v1, 30 ikon)

| Sorun | İkonlar |
|---|---|
| **Çizgi çakışması / kirli birleşim** | `leaf` (sap kontur içinden geçiyor), `rocket` (kanat + alev + gövde düğüm yığını), `link` (çapraz çizgi iki halkayı kesiyor), `code` (eğik çizgi köşeli parantezlere çok yakın) |
| **Canlı alan taşması (2–22 px dışı)** | `code` ve `robot` x = 1 / 23'e kadar çıkıyor; `bell` sapı y = 2'de; `learn` püskülü kenarda |
| **Simetri / optik merkez** | `shield` tiki sağa kaymış, `discover` elması merkez dışı, `learn` tek taraflı püskül, `chevron` 9–16 aralığında sağa ağır |
| **Tema hatası** | `settings` dairelerinde `fill="var(--surface,white)"` → koyu zeminde beyaz disk, RN'de CSS değişkeni çözülmüyor |
| **Dolu (active) durum yok** | `filled` her path'i dolduruyordu: `event`, `shield`, `verified`, `opportunity` içindeki tik/çizgiler kayboluyordu; yalnız `bookmark` çalışıyordu. Sekme çubuğunda aktif durum sadece renkti. |
| **Ağırlık dengesizliği** | `mark` dolu blok, `opportunity` (çanta) yoğun, `check`/`chevron` incecik; `clock` r 9 ile `play` arasında belirgin boyut farkı |
| **Jenerik** | `search`, `bell`, `bookmark`, `profile`, `community` (iki silüet), `location`, `opportunity` (çanta), `learn` (kep), `event` (takvim+tik) stok ikon dilindeydi; `discover` (tarama köşeleri + elmas) QR/AR tarama gibi okunuyordu |
| **Eksik ikonlar** | paylaş, düzenle, sil, daha fazla, hata, bilgi, uyarı, çevrim dışı, takım, mentor, deneyim, proje, takvim, yüz yüze, online, başvuru, görev, rozet, QR |

## 2. Yeniden tasarım stratejisi

- **Tek imza: düğüm (node).** Marka işaretindeki T + nokta ilişkisinden türetilen dolu nokta (r 1.5–1.9). Ana navigasyonun beşinde de var,
  ürün nesnelerinde gerektiğinde (öğren, deneyim, rozet, konum, robot…). Sistem ikonlarında **yok** — onlar sessiz ve saf kalır.
- **Açık devre.** Karakterli ikonlarda kontur bir yerde açılır ve o açıklıktan bir şey çıkar: Keşfet'te ibre halkayı deler, Profil'de omuz çizgisi düğüme dönüşür, Fırsatlar'da kapı aralanır.
- **Dolu durum gerçek bir çizim.** Gövde dolar, iç detaylar 1.75 kanal olarak oyulur (SVG mask), düğümlerin etrafında 1.75 boşluk (halo) açılır. Böylece aktif sekme hem açık hem koyu zeminde okunur.
- **Üç katman:** sistem (saf çizgi) → durum (tek çember r 9 + tek işaret) → ürün nesneleri / navigasyon (karakter + düğüm).

## 3. İkon stil kuralları

| Kural | Değer |
|---|---|
| Izgara | 24 × 24; mürekkep (kontur dahil) **2–22** canlı alanında. Optik ölçüler: daire r 9 · kare 17–18 · dikey 14 × 18 · yatay 18 × 12–14 |
| Kontur | **1.75** tek ağırlık (16 px'te 1.17, 22 px'te 1.6 px). Cap/join **round**. Optik kalınlık varyantı yok. |
| Köşe | ≥ 16 px kaplar **rx 4** (marka karosunun %25 oranı) · 8–12 px parçalar rx 2–2.5 · küçük parçalar rx 1.5 · çokgenler `rounded_poly` r 0.9–2.2 |
| Boşluk | Birbirine değmeyen iki kontur arasında **≥ 0.75 net** boşluk (merkez aralığı ≥ 2.5). Kesişme yalnızca tasarlanmış birleşim noktasında (kapı menteşesi, yaprak sapı). |
| Düğüm | Dolu nokta r 1.5–1.9; çevresindeki konturdan ≥ 1.5 net. Bir ikonda en fazla bir anlamlı düğüm (QR/daha fazla gibi modül ikonları hariç). |
| Simetri | Simetrik nesneler (kalkan, zil, rozet, konum, çöp…) tam eksende; yönlü ikonlarda (play, chevron) kütle merkezi 12'ye ±0.25 içinde. |
| Dolu durum | `b` gövde dolar · `c` detay oyulur · `dc` nokta oyulur · `h/hs/hd` halo: 1.75 boşlukla ayrılıp üstte çizilir. Rol tablosu `tools/build.py`. |
| Renk | Görünür her şey `currentColor`; tek literal renk mask'taki #fff/#000 (test ile korunur). |

**Do:** tek ağırlık · round cap/join · düğümü anlam taşıdığında kullan · dolu durumu kanal + halo ile kur · 16 px'te kontrol et.
**Don't:** ikinci kontur kalınlığı · dekoratif iç detay · kontur üstüne kontur · `var(--…)`/sabit renk · bir ikonda iki imza öğesi · sistem ikonuna düğüm.

## 4. Düzeltilen / yeniden tasarlanan / yeniden yorumlanan

| Grup | İkonlar |
|---|---|
| **Yalnız düzeltildi** (geometri, merkez, canlı alan) | `arrow`, `back`, `chevron`, `check`, `close`, `plus`, `filter`, `search`, `bookmark`, `clock`, `play`, `code`, `mark` (değişmedi, marka) |
| **Kısmen yeniden tasarlandı** | `bell` (sap kalktı, simetrik gövde), `link` (temiz iki yarım), `shield` (eksende tik), `verified` (16 köşeli yumuşak mühür), `ticket` (nokta perforasyon), `location` (iç halka → dolu düğüm), `robot` (kulaklar kalktı, anten düğümü), `rocket` (temiz gövde/kanat), `leaf` (simetrik yaprak, sap dışarıda), `spark` (içbükey kenarlar), `settings` (sürgüler → 6 dişli çark; "Mühendislik" ile de uyumlu) |
| **Tamamen yeniden yorumlandı** | `discover` (açık halka + yarı dolu ibre halkayı deliyor), `event` (takvim + "senin günün" düğümü), `opportunity` (**fırsat kapısı** — aralık kapı + kapı kolu düğümü; ekran metni "Potansiyeline bir kapı aç."), `community` (iki kişi + ortak fikir düğümü), `profile` (omuz çizgisi düğüme dönüşür), `learn` (açık kitap + fikir düğümü) |
| **Yeni** | `share`, `edit`, `trash`, `more`, `success`, `error`, `info`, `warning`, `offline`, `team`, `mentor`, `experience`, `project`, `calendar`, `in-person`, `online`, `application`, `task`, `badge`, `qr` |

## 5. Final ikon ailesi yönü

Ana navigasyon için iki yaklaşım çizildi (`previews/02-navigation-variations.png`): **sade** (klasik pusula, düz takvim, çanta, iki kişi, düz büst) ve
**karakterli**. **Önerilen ve uygulanan final: karakterli.** Beşi aynı düğüm diliyle aile olur, sade versiyonlarla aynı okunurluktadır, dolu durumda daha güçlüdür.
Ton: teknoloji odaklı, topluluk merkezli, genç ama ciddi; düğüm marka işaretine bağlar, açık devre "Bir fikrin varsa, bir yerin var." fikrini taşır.

## 6. Export ve uygulama notları

```
design-source/icons/
  navigation/  discover event opportunity community profile          (hepsi + .fill)
  system/      search filter settings bookmark share bell edit trash plus close check back arrow chevron link more play
  status/      success error info warning clock offline
  entities/    team mentor verified experience project calendar location in-person online application task badge qr
               ticket shield learn robot rocket code leaf spark mark
```
- 50 çizgi + 32 dolu SVG; ad = kebab-case, kategori klasörü yalnız organizasyon içindir (ad benzersiz olmalı; üretici çakışmada hata verir).
- `TechIcon filled` → `iconFillPaths[name]`, yoksa çizgi sürümüne düşer. Sekme çubuğu `filled={focused}` kullanır.
- Dolu varyantlar `react-native-svg` `<mask>` kullanır (id `tf-<ad>`, ikon başına sabit; aynı ikonun iki kopyası aynı içeriği paylaşır).
- Geometriyi değiştirmek: `tools/spec.py` düzenle → `python tools/export.py design-source/icons` → `npm --prefix apps/mobile run icons`.
  Önizleme: `python tools/render_spec.py out.png` (resvg-py + Pillow gerekir). Illustrator master: `tools/parts.py` + `build-master.jsx.tmpl`
  (Illustrator Beta, osascript; dolu durumlar Pathfinder ile gerçek vektöre dönüştürülür — SVG mask'ı Illustrator içe almaz).
- Mevcut adlar korundu (geri uyumlu). Kullanım güncellemeleri: hata durumu `warning`, çevrim dışı `offline`, ödül fırsatı `badge`, profilde takım `team`.
