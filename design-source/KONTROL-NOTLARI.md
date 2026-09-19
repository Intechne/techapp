# Teslim kontrolü

19 Eylül 2026 · Tarayıcı prototipi v0.1

## Yapılan kontroller

| Kontrol | Gözlenen sonuç |
|---|---|
| JavaScript sözdizimi | `node --check app.js` ve `icons.js` başarılı |
| İlk keşif görünümü | Masaüstü ve 390 × 844 mobil görünüm görsel olarak incelendi |
| Küçük ekran | 320 genişlikte ana ekran, filtreli liste, akış, tasarım sistemi ve geliştirme planında sayfa yatay taşması yok |
| Alt gezinme | Mobilde 5 sekme; 390 genişlikte görünür ve ekran sınırları içinde |
| Etkinlik katılımı | Form → yetişkin koşulu → onay → başarı ekranı canlandırıldı |
| Veli durumu | Yetişkin kutusu boşken veli bekleme ekranı; katılım kartı düğmesi gösterilmedi |
| Staj yaş koşulu | 18+ kutusu seçilmemiş başvuruda alan hatası; seçilince demo başvurusu alındı |
| Başvuru takibi | Başvurulan staj programı takip ekranında göründü |
| Kaydetme | Etkinlik kaydedildi ve Profil > Kaydedilenler içinde bulundu |
| Profil düzenleme | Örnek ad değiştirildi; profil başlığı güncellendi |
| Deneyim taslağı | Başlık ve katkı gönderildi; profil listesinde kendi beyanı taslağı olarak bulundu |
| Takım isteği | İstek sonrası moderatör bekleme durumu; geri çekince başlangıç eylemine dönüş |
| Arama | Robotik araması 2 sonuç; olmayan kelime için boş sonuç yönlendirmesi |
| Çevrim içi filtre | Filtre sonrası 2 çevrim içi etkinlik |
| İkon paketi | Tasarım sisteminde 30 indirilebilir SVG bağlantısı |
| Başlangıç | Lise ve ilgi alanı seçimi → Keşfet geçişi tamamlandı |
| Öğrenme | Üç adımlı mini ders tamamlanıp eğitim ekranına dönüldü |
| Ana renk kontrastları | Iris/beyaz 6.67:1; ink/lime 12.74:1; ikincil metin/zemin 4.95:1; moss/beyaz 5.67:1 |
| Tarayıcı hataları | İncelenen oturumda yakalanan error düzeyinde konsol kaydı yok |

## Sınırlar

Bu kontroller native uygulama, gerçek hesap, API, ödeme, veli doğrulama veya mağaza testi değildir. React Native v4 paketi statik olarak incelendi; kurulmadı ve derlenmedi. Kontroller tarayıcıda örnek veriyle çalışan yeni tasarım prototipi içindir.

Ana ekranlar görsel olarak incelendi; tüm ekranların erişilebilirlik, cihaz/font ölçekleme ve ekran okuyucu denetimi henüz yapılmadı. Bazı prototip etiketleri 11 px; native bileşenlerde 12+ hedefi uygulanmalı. Sesli okuma ve klavye etkileşimi için semantic elemanlar, focus görünümü ve modal focus sınırı bulunur; bunlar tam erişilebilirlik denetimi yerine geçmez.

Prototip bellekte çalışır; sayfa yenilenince taslaklar ve seçimler temizlenir. Başvuru/katılım/veli sonucu bir sunucu işlemine bağlı değildir. Katılım kartındaki metin gerçek QR veya geçerli giriş kodu değildir.

Gönderilen native ZIP’in orijinali değiştirilmedi. Eski belgelerdeki “final”, güvenlik ve hukuki uygunluk beyanları doğrulanmış sonuç olarak kullanılmadı.
