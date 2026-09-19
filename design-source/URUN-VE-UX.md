# TechApp — Ürün ve UX tasarım paketi

19 Eylül 2026 · v0.1 · Tasarım önerisi / uygulanacak ürün tanımı

## Ürün fikri

TechApp; gençlerin teknoloji, girişimcilik ve sosyal etki alanlarında deneyim bulduğu, ekip kurduğu, birlikte ürettiği ve ortaya koyduklarını kaynağıyla gösterebildiği Intechne platformudur.

Ana vaat: **Bir fikrin varsa, bir yerin var.**

Ürün döngüsü: **Keşfet → katıl → üret → deneyimini görünür kıl → yeni bir fırsat bul.** Robotik, bu döngünün güçlü bir uygulama alanıdır; uygulamanın tamamı sadece yarışma katılımcılarına göre şekillenmez.

Kullanıcı tarafından doğrulanan hedef kitle: lise öğrencileri, üniversiteliler, genç mezunlar, robotik yarışmacıları ve teknoloji takımları. Mevcut teknoloji: React Native. Paylaşılan v4 arşivi ayrıca incelendi; bulgular `MEVCUT-KOD-INCELEMESI.md` içinde.

## Referansların yorumu

Youthall: Kullanıcının ilettiği 11 mobil ekran referans alındı. Ferah kartlar, kategori seçimi, şirket ve etkinlik kartlarındaki kolay tarama, sabit alt gezinme değerlidir. Bu ekranlardaki altı sekmeyi, geniş boş durumları ve uzun profil doldurma yaklaşımını aynen taşımıyoruz. Takip bulunmadığında da işe yarayan ilk içerikler, daha kısa gezinme ve aşamalı profil tamamlama öneriyoruz.

Yirmi Üç: Ana sayfa görsel olarak da incelendi. Güçlü tipografik başlıklar, koyu sahne görselleri, açık turkuaz vurgu ve birlikte gelişme anlatımı referans oluşturuyor. TechApp’te günlük kullanım için açık yüzeyler; özel kampanyalarda güçlü renk blokları kullanılıyor. [Yirmi Üç](https://yirmiuc.org/)

Youthall’ın şirket, kariyer, etkinlik ve öğrenme alanlarının birlikte sunulması, bilgi mimarisi için karşılaştırma noktasıdır. TechApp’in ayrışması takım üretimi ve kaynağı belli deneyim kayıtlarıdır. [Youthall](https://www.youthall.com/tr/)

Referans marka logoları, fotoğrafları veya arayüzleri prototipe kopyalanmadı. Ekran görüntülerindeki kişi ve iletişim bilgileri tasarım verisi olarak kullanılmadı.

## Kullanıcılar ve ihtiyaçlar

| Kullanıcı | Birincil ihtiyaç | Başlangıç önerisi |
|---|---|---|
| Lise öğrencisi | Nereden başlayacağını bulmak; yaşa uygun etkinlik ve takım | Başlangıç atölyesi, danışmanlı takım, yaşa uygun gönüllülük |
| Üniversiteli | Yetkinlik geliştirmek, proje ve çevre edinmek | Hackathon, topluluk, staj, girişim programı |
| Genç mezun | Ürettiklerini göstermek, fırsat ve mentorluk bulmak | Portföy, yetenek programı, açık proje |
| Robotik yarışmacısı | Takım, sezon, görev ve yarışma hazırlığı | Takımım, açık roller, yarışmalar ve hazırlık eğitimleri |
| Kaptan / mentor | Kadro, görev, başvuru ve takım kaydı yönetmek | Rol bazlı takım çalışma alanı |
| Organizatör / kurum | İçerik yayınlamak, başvuru değerlendirmek, katılım doğrulamak | Web yönetim paneli |
| Veli / danışman | İlgili katılımı ve paylaşımı anlayarak onaylamak | Ayrı, süreli ve doğrulanabilir onay bağlantısı |

Eğitim seviyesi ile yaş ayrı alanlardır. Lise öğrencisi otomatik olarak 18 yaş altı, üniversiteli otomatik olarak yetişkin kabul edilmez. İlk prototipteki yaş kutusu sadece durumları canlandırır; gerçek hesap sistemi için uygun değildir.

## Bilgi mimarisi

| Alt sekme | İçerik | İkincil ekranlar |
|---|---|---|
| Keşfet | İlgi temelli başlangıç ve seçilmiş içerikler | Arama, öğrenme, kurumlar, bildirimler, ileride ayrıcalıklar |
| Etkinlikler | Atölye, yarışma, hackathon, buluşma, sosyal etki | Detay, bireysel/takım başvurusu, katılım kartı, program, hazırlık eğitimi |
| Fırsatlar | Staj, gönüllülük, girişim ve yetenek programları | Kurum profili, uygunluk, başvuru, durum takibi; ileride burs |
| Topluluk | Topluluklar ve Takımlar alt sekmeleri | Açık roller, takım profili, Takımım, görevler ve üye alımı |
| Profil | Deneyimler, projeler ve kullanıcı kontrolü | Kaydedilenler, başvurular, katılımlar, paylaşım tercihleri, hesap ayarları |

Arama globaldir. Filtreler içerik bağlamına göre değişir. Alt sekme değiştirme kendi ekran durumunu ve kaydırma konumunu korumalı; geri hareketi aynı filtreye dönmelidir. Prototipte bazı geçişler ekranı baştan açar; native uygulamada sekme başına stack uygulanacak.

## Kritik kullanıcı akışları

### İlk karşılaşma ve hesap

Karşılama → eğitim aşaması → ilgi alanları → misafir keşif. Bir kayıt, başvuru veya kişisel paylaşım gerektiğinde: e-posta → tek kullanımlık doğrulama → yaş bilgisi → gerekli kullanım koşulları → gerekiyorsa veli süreci → bekleyen eyleme dönüş.

İsteğe bağlı profil alanları sonradan tamamlanır. Pazarlama izni üyelik şartı yapılmaz. Bildirim izni ilk açılışta değil, bir etkinliği hatırlatmak gibi faydasının anlaşıldığı anda istenir.

### Bireysel etkinlik katılımı

Keşfet / Etkinlikler → kategori / arama → detay → uygunluk / kontenjan → kayıt bilgileri → gerekiyorsa veli onayı → sunucu onayı → katılım kartı → hatırlatma → giriş kontrolü → doğrulanmış katılım kaydı.

Katılım onayı, sadece formun doldurulmasıyla verilmez; sunucu kontenjan ve uygunluk kararını atomik olarak tamamlar. Aynı başvurunun yeniden gönderilmesi ikinci bir kayıt açmamalı. Kontenjan doluysa bekleme listesi açıkça ayrı gösterilir.

### Takım etkinlik kaydı

Takımım / etkinlik detayı → takım kaydı → kaptan / mentor yetkisi → kadro ve zorunlu belgeler → katılımcı uygunlukları → eksik onayları tamamlama → organizatör değerlendirmesi → takım kaydı onayı.

Kadro değişikliği, kayıt kapandıktan sonra organizatör sürecine bağlıdır. Üyeler kendi rollerini değiştiremez. Takım kaydı her üyenin veri paylaşım izninin yerine geçmez.

### Fırsat başvurusu

Fırsatlar → ilan detayı → yaş / eğitim / konum şartları → paylaşılacak profil alanlarının önizlemesi → kısa motivasyon → son kontrol → gönderim → durum takibi.

Durumlar: taslak, gönderildi, incelemede, ek bilgi isteniyor, kabul, uygun bulunmadı, geri çekildi, kapandı. Otomatik başvuru yok. Öneri, işe uygunluk veya kabul kararı değildir.

### Topluluk ve takımlar

Topluluk → Takımlar → takım profili → açık rol → katılma isteği → moderatör / kaptan incelemesi → kabul → Takımım.

Takımım: görevler (yapılacak/devam/tamam), açık üye alımları, yarışmalar, üyeler ve kaynaklar. Mevcut v4 bu akışların cihaz içi demosunu içeriyor. Yeni tasarım bu yetenekleri ayrı bir iş listesine taşıyarak koruyor.

18 yaş altı kullanıcıların telefon/e-posta bilgileri açık listelerde gösterilmez. İlk sürümde serbest özel mesajlaşma yerine moderasyonlu takım alanı öneriliyor.

### Deneyim ve doğrulama

Profil → deneyim veya proje ekle → kendi rolü ve katkısı → çıktı / kanıt → kendi beyanı → doğrulama talebi → yetkili inceleme → doğrulandı / düzeltme istendi / uygun bulunmadı.

Kayıt, kapsamını açıkça belirtir: “Etkinliğe katıldı” veya “Şu projeye şu rolde katkı verdi”. Katılım kaydı, teknik yetkinlik ölçümü değildir. Doğrulayan kurum, kaynak, tarih ve varsa geçerlilik süresi görünür. İptal edilmiş doğrulama eski rozetle görünmeye devam etmez.

### Öğrenme

Keşfet → öğrenme listesi → eğitim detayı → koşullar → ders → ilerleme → gerekiyorsa değerlendirme → tamamlama. Eğitim etkinlikle ilişkiliyse “Bu etkinliğe hazırlan” bağlantısı bulunur.

İlk yayın için ücretsiz içerik öneriliyor. Ücretli eğitimlerin kapsamı korunur ancak ödeme altyapısıyla aynı fazda açılır.

## Ekran envanteri ve teslim kapsamı

| Grup | Ekranlar | Bu pakette |
|---|---|---|
| Başlangıç | Eğitim aşaması, ilgi seçimi | Etkileşimli |
| Keşif | Ana sayfa, arama, sonuç / boş sonuç, bildirimler | Etkileşimli |
| Etkinlik | Liste / kategori / çevrim içi filtre, detay, kayıt, sonuç, katılım kartı | Etkileşimli demo |
| Fırsat | Liste / kategori, detay, başvuru, 18+ şartı, takip / boş takip | Etkileşimli demo |
| Topluluk | Topluluklar, takımlar, profil, katılma isteği | Etkileşimli demo |
| Profil | Deneyim / proje / kayıt sekmeleri, düzenleme, deneyim taslağı | Etkileşimli demo |
| Ayarlar | Tercihler, gizlilik yaklaşımı, yardım | Yerel tercih / açıklama |
| Gelişim | Eğitim detayı, üç adımlı mini öğrenme | Etkileşimli metin dersi |
| Kimlik | Gerçek OTP, oturum, veli bağlantısı, şifre / oturum iptali | Akış tanımı; canlı servis yok |
| Takımım | Görev, kadro, rol, takım kaydı, alım yönetimi | v4’ten taşınacak; yeni yüksek detaylı ekranlar sonraki uygulama işi |
| Operasyon | Organizasyon / kurum / moderasyon web paneli | Rol, veri ve kabul kriterleri tanımlı; arayüzü henüz üretilmedi |
| Sonraki modüller | Fonla, cüzdan, ücretli eğitim, TechRank, ARENO | Kapsam korunuyor; geliştirme aşamaları teknik belgede |

Bu paket bütün native uygulamanın tamamlandığı iddiası değildir. İlk ürün mimarisi, ana UI/UX yönü, temel tıklanabilir akışlar, ikonlar ve uygulama planını somutlaştırır.

## Tasarım sistemi: Open Circuit

Ana eylem Iris `#4B46D6`; enerji Lime `#D9F36E`; Ink `#20241F`; doğrulama Moss `#157461`; sıcaklık Apricot `#FFD1BD`; zemin Canvas `#F6F7F2`; yüzey `#FFFFFF`; ikincil metin `#666D66`.

Başlıklarda Manrope, gövdede DM Sans önerisi. `tokens.json` taşınabilir ölçü ve renk kaynağıdır. Native uygulamada font dosyaları paketlenir; sistem fontu geri dönüşü bulunur.

Mobil hedef: 16/24 gövde, 14/20 etiket, 12/16 yardımcı yazı; 24–32 başlık. Kartların içeriği Dynamic Type ile büyüyebilir. Prototipte bazı yoğun meta/etiket alanları 11 px'tir; bunlar final native erişilebilirlik düzenlemesinde en az 12 px'e yükseltilmeli. Bu prototip erişilebilirlik sertifikası değildir.

Aralık dizisi: 4, 8, 12, 16, 20, 24, 32, 40, 48. Kontrol köşesi 14, kart 22, kahraman 26. Dokunma hedefi en az 44 × 44; kaydırmalı kategori pill’leri native sürümde hitSlop ile bu sınıra tamamlanır. Safe area, klavye, geri jesti, Android back ve ekran okuyucu etiketleri native bileşenlerde ele alınır.

30 özgün SVG: logo işareti, keşfet, etkinlik, fırsat, topluluk, profil, arama, bildirim, yönler, kayıt, kıvılcım, robot, yaprak, roket, kod, doğrulama, bilet, konum, saat, öğrenme, oynat, ayarlar, onay, kapat, ekle, bağlantı, güvenlik, filtre. 24 × 24 ızgara; 1.75 çizgi. Navigasyonda daima görünür metin etiketi. `icons/` içindeki dosyalar doğrudan kullanılabilir; uygulama markası için final görsel kimlik kontrolü gerekir.

Hareket: 160–220 ms, tek bir işlevi açıklayan geçişler; azaltılmış hareket tercihi. Otomatik oynayan carousel veya sürekli parlayan arka plan yok.

## İçerik ve operasyon

İlk yayına örnek hazırlık hedefi: 12 gerçek etkinlik, 8 fırsat, 6 topluluk/takım ve 3 ücretsiz öğrenme içeriği. Bunlar mevcut içerik sayıları değil, boş kalmayan bir pilot için önerilen başlangıç miktarlarıdır.

Her kayıtta: içerik sahibi, doğrulama durumu, hedef kitle, tarih/saat dilimi, konum/çevrim içi bağlantı, ücret, kapasite, koşullar, iptal politikası, destek kanalı ve görsel kullanım hakkı. İlan son tarihleri sunucuda kapatılır; eski ilan yeniymiş gibi listelenmez.

Organizatör: taslak → inceleme → yayın → katılım yönetimi → giriş kontrolü → sonuç ve kayıt. Intechne yönetici: kurum doğrulama, yayın onayı, şikâyet ve itiraz, içerik takvimi. Takım danışmanı: kadro ve uygunluk. Yetkiler mobilde görünürlükle, sunucuda zorunlu kontrollerle uygulanır.

## Başarı ölçütleri ve doğrulama

İlk araştırma: 4 lise öğrencisi, 4 üniversiteli/mezun, 2 takım yöneticisi, 2 organizatörle moderasyonlu görev testi. Önerilen başarı kriterleri: bir etkinliği bulup katılım adımına ulaşma; takımdaki açık rolü bulma; doğrulanmış kayıt ile kendi beyanını ayırt edebilme; görünürlük ayarını bulma. Kullanıcıların en az %80’inin kritik görevleri yönlendirmesiz tamamlaması pilot hedefidir, ölçülmüş sonuç değildir.

Ürün ölçümleri: ilk anlamlı eyleme ulaşma oranı, kayıt tamamlanması, gerçek katılım, tekrar katılım, ekip isteği kabulü, doğrulama dönüş süresi, hata oranı. Salt ekran süresini büyütmek ana hedef değil.

## Bir sonraki kararlar

Yeni tasarımın yönü bu prototip üzerinden yorumlanabilir. Önce çekirdek yolculuklar ve takım katmanının önceliği netleşir; ardından mevcut 33 ekran bu sisteme taşınır. Kurumsal yasal ad, geliştirici hesapları ve mevcut canlı backend bilgileri kodda yazılı oldukları için doğrulanmış kabul edilmeyecek.
