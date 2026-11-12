# Faz 4 son görüntüleri — onaylı taslakla karşılaştırma

Tarih: 13 Kasım 2026 · Dal `feat/v5-product` · Onay kapısı: `docs/design/faz4-preview/REVIEW.md` (12 Kasım, “önerilerle onay”).

Her sayfada soldan sağa: **onaylı taslak (web 390)** — `faz4-preview/0X-*.jpg`'den kırpıldı — ve **son hâl**: web 390, web 320, Android 1.0, Android 2.0.
Ham kareler repoya girmedi (scratchpad). Toplam boyut ≈ 1,5 MB (JPEG, sınır 3 MB).

| Dosya | Ekran |
|---|---|
| `04-kesfet.jpg` | Keşfet |
| `05-etkinlikler.jpg` | Etkinlikler + filtre sheet'i |
| `06-firsatlar.jpg` | Fırsatlar |
| `07-topluluk.jpg` | Topluluk (Android sütunlarında ana ekran + takım profili) |
| `08-profil.jpg` | Profil (son hâlde misafir ekranı da var) |
| `09-detay-kayit-kapali.jpg` | Etkinlik detayı, kayıt kapalı |
| `10-detay-kayit-acik.jpg` | Etkinlik detayı, kayıt açık |
| `11-onboarding-giris.jpg` | Onboarding, e-posta, kod, profil adımı — **onaylı taslağı yok** (taslak kapısı bu ekranları kapsamadı); yalnız son hâl |

Kare kaynakları: Etkinlikler web (filtre sheet'i dahil) ve misafir Profil, Topluluk misafir karesi bu görevde yeni alındı (13 Kasım, güncel kod).
Diğer kareler ilgili görevin ekran turundandır; sonradan yalnız test, belge ve (yukarıdaki) küçük düzeltmeler değişti. Taslakta veri “giriş yapmış, boş” iken son karelerde seed verisi dolu olduğu için içerik farkı görünür; bu sapma değil, veri farkıdır.

## Taslaktan sapmalar (neden)

**Keşfet (04)** — 
1. Arama alanı Arama ekranına gitmiyor, bildirim zili yok: Faz 3b birleşmedi (Q16). Yerinde etkinlik araması korundu.
2. Gelişim (kurs) bölümü gizli: kurs ekranı yok, gidilecek yeri olmayan kart vaat edilmez (Q4b).
3. “Yaklaşan etkinlikler” kaydı kapanmış etkinlikleri göstermez (Q4a; taslakta vardı).
4. Bölüm başlığı eylemi 320 dp altında ve yazı ölçeği ≥1.5'te başlığın altına iner (D1; taslakta 2 satıra kırılıyordu).

**Etkinlikler (05)** —
5. Tarih filtresi serbest aralık yerine **7 / 30 / 90 gün** hazır seçenekleri (tarih seçici bileşeni yok).
6. Filtre sheet'i: Android formSheet %60'ta alt düğmeyi ekran dışında bırakıyordu; değişiklikler listeye anında uygulanır, “Temizle” başlıkta, “Sonuçları göster” tam yükseklikte.
7. “Çevrim içi” biçimi hibrit etkinlikleri de kapsar (eski “yalnızca çevrim içi katılabileceklerim” anlamı), sheet'te açıklama satırı var.
8. Check-in sonuç başlığı `title` (display yalnız sekme köklerinde).

**Fırsatlar (06)** —
9. Kurum logosu yok, öncü karo hep tür ikonu (3b).
10. Özet liste satırında yok, detayda (Q7). Kalan-gün tonu: ≤1 gün apricot, ≤7 gün iris, sonrası etiketsiz (onaylandığı gibi); “Son başvuru: …” %200'de iki satıra iner (F3, kabul edildi).

**Topluluk (07)** —
11. **Rol dağılımı bölümü yapılmadı**: veri yalnız üyelere açık `team_roster` RPC'sinde; ziyaretçiye açmak gizlilik sınırını aşar.
12. Kapak/logo, Projeler ve Etkinlikler bölümleri yok (3b).
13. Takım dipnotu sırası **üye · kategori · şehir** (plandaki “kategori · şehir · üye” iki satır kırpmasında sayıyı kesiyordu).
14. “Takımım” yalnız ilk etkin takımı gösterir; diğerleri “+N takım daha” ve “Tüm takımların (N)” bağlantısı Profil > Takımlar'a gider.
15. **Bekleyen istekler** ayrı küçük grup olarak Profil > Takımlar'da (Q15; ana ekranda yok). Taslakta bu yerleşim yoktu.
16. Tek sözcüklü çok uzun ad (40+ karakter) sözcük ortasından bölünür (K3, kabul edildi).

**Profil (08)** —
17. E-posta kimlik kartında değil, “Hesap” bölümünde küçük satır (Ayarlar 3b'ye kadar).
18. Yaklaşan kendi kayıtlarını gösterir; check-in'li kayıt “GİRİŞ YAPILDI” etiketi taşır.
19. Kaydedilenler / Bildirimler / Ayarlar girişleri yok (modül yok, ölü giriş yok).
20. Segmentler ve sayaçlar yazı ölçeği ≥1.5'te alt alta; segment yalnız en uzun sözcük sığmıyorsa tek sütun (13 Kasım kuralı: Profil'in üç segmenti yığılır, iki kısa etiketli Topluluk/Çalışma alanı yığılmaz).
21. Misafir ekranında dikey ritim genişletildi (başlık, açıklama, fayda kartı, düğme arası); içerik aynı, altta boş alan ~68 dp azaldı.

**Etkinlik detayı, kapalı/açık (09, 10)** —
22. Detayda Kaydet yok; kapalı/dolu/yaş durumlarında “Benzer etkinlikler”, yalnız takım kaydında “Takımını bul” (3b: Kaydedilenler yok).
23. “Bu etkinliğe hazırlan” (bağlı kurslar) yok; düzenleyen satırı kurum profiline gitmez (rota yok).
24. Uzun açıklama 8 satırdan sonra “Devamını oku” (Q12). Android'de kayıt açık detay için ayrı kare alınmadı (sütunlar yok).

**Onboarding ve giriş (11)** — onaylı taslağı yok; sapma değerlendirmesi yapılmadı.
25. Slogan eyebrow'ları (“HESABIN”, “SON ADIM”) kalktı (Q2); 3 adımlı onboarding, “Şimdilik geç” her adımda.
26. 18 yaş altı bilgi notu kaldırıldı: erişilemiyordu (`is_minor` yalnız kayıttan sonra gelir). Takip önerisi KNOWN-ISSUES'ta.

**Sapma sayısı: 26** (yukarıdaki numaralı maddeler; çoğu 3b bağımlılığı veya onaylı karar sonucu). Kullanıcıya özellikle not düşülecekler: 5 (tarih filtresi ön ayarları), 11 (Rol dağılımı yok), 15 (bekleyen istek yerleşimi), 26 (18 yaş altı notu).

> **Görüntü notu:** `04-kesfet.jpg` son hâl görüntüleri Task 5'te, Task 7'deki son tarih tonu değişikliğinden önce çekildi;
> "Sıradaki adımın" satırlarındaki kırmızı "SON GÜN BUGÜN" etiketi koddaki güncel hâl değildir (güncel: apricot). Kod ve testler
> günceldir; görüntü yenilemesi bir sonraki görsel turda yapılacak.
> **OTP odağı:** RN 0.86'da `InteractionManager` erişimi çalışma zamanı uyarısı verdiği için odak 350 ms gecikmeli; iOS'ta doğrulanmadı.
> Daha doğru sinyal native-stack `transitionEnd` olayıdır — Faz 5'e not edildi.
