# Staging uçtan uca doğrulama (Task 14) — 11 Kasım 2026

**Ortam:** Android 16 emülatörü (`Medium_Phone_API_36.1`), **EAS preview build `5e6c9ee3`** (commit `a73e774`, sürüm 5.0.0 build 2),
staging Supabase `pacvhcnawtnkauvguoaw` (migration 17/17), gerçek e-posta teslimi (Resend). Kullanıcının izniyle yürütüldü.
**Kişisel veri:** gerçek çocuk verisi yok. 14 yaş akışı Eylül'de oluşturulmuş sentetik staging test hesabıyla, yetişkin akışı bu test için
açılıp sonunda **uygulamadan silinen** bir takma ad hesabıyla, veli rolü kullanıcının iş e-postasıyla yapıldı. Test kurumu/etkinliği `is_demo`.

Kanıtlar: `2026-11-staging-e2e/*.jpg`.

| # | Adım | Sonuç | Kanıt / not |
|---|---|---|---|
| 1 | Soğuk açılış, onboarding | **PASS** | Beyaz ekran yok; onboarding → misafir |
| 2 | Misafir keşif (staging verisi) | **PASS** | `01` — vitrinde kaydı açık test etkinliği |
| 3 | Etkinlik detayı + kayıt koşulları | **PASS** | `02` — "Bireysel kayıt · 18 yaş altına veli onayı" (D7) |
| 4 | Gerçek e-posta OTP ile giriş | **PASS** | `03` — kod gelen kutusuna ulaştı; girişten sonra kayıt ekranına dönüş (PendingIntent) |
| 5a | 14 yaş: kayıt → veli onayı bekleniyor | **PASS** | `04` — sunucu `pending_guardian`; zaman çizelgesi |
| 5b | Veli e-postası (gerçek) → web'de onay | **PASS** | `05` maskeli adres + son geçerlilik tarih/saat; veli onayladı |
| 5c | Uygulama öne gelince durum yenilendi | **PASS** | `06` — "KATILIMIN ONAYLANDI" kendiliğinden (D4) |
| 6a | Katılım kartı + QR + kısa kod | **PASS** | `07` |
| 6b | Uçak modu + soğuk açılış → Katılımlarım'da kayıtlı kart | **PASS (yavaş)** | `08` — liste ~60 sn'de göründü (M2: düzeltildi (commit f90c3bf), cihazda yeniden ölçülecek) |
| 6c | **Token süresi dolmuş** (cihaz saati +2 sa) + uçak modu + soğuk açılış | **PASS** | `09`, `10` — açılış ekranında kayıtlı kartlar, "Son güncelleme: 11 Kasım, 22:43 · çevrimdışı" (C1, I2) |
| 6d | Bağlantı dönünce oturum yenilendi | **PASS** | Ana ekran isimle açıldı |
| — | Çıkış → başka hesapla giriş | **PASS** | Yeni hesapta önceki hesabın kayıt/kartı görünmedi |
| — | Yeni yetişkin hesap: ilk profil | **PASS** | `11` — sayaç etiketi "Katılım" |
| — | Yetişkin kayıt (çift dokunuş) | **PASS** | `12` — doğrudan onay, veli adımı yok; staging'de **tek** kayıt (sayıyla) |
| 7a | Görevli: etkinlik seçici + küçük harfli kısa kod | **PASS** | `13` — tek etkinlik önceden seçili; "GİRİŞ ONAYLANDI" (D1) |
| 7b | Aynı kod tekrar | **PASS** | `14` — "DAHA ÖNCE GİRİŞ YAPILMIŞ", ilk giriş saati |
| 7c | Yanlış kod | **PASS** | `15` — "Bu kodla eşleşen bir kayıt yok." |
| — | Hesabımı sil (uygulamadan) | **PASS** | Kullanıcı, kayıt, görevli üyeliği silindi; `seats_taken` 2→1 (sayıyla) |
| 8 | Profilde katıldığı etkinlik (check-in sonrası) | **PASS (12 Kasım)** | OTA sonrası yeni yetişkin hesap: kayıt → kart → staging'de sentetik görevliyle kısa kod check-in → profil "Katılım 1" |

**Temizlik (staging, sayılarla doğrulandı):** test etkinliği, kurum, kayıtlar, check-in, veli isteği/gönderim kaydı, rızalar,
kısa kod denemeleri, yetişkin test hesabı → **0**. Eylül tarihli 14 yaş test hesabı silinmedi (bu testte oluşturulmadı).
Emülatörde eski TechApp 1.0 (aynı paket adı, 2025) kullanıcı onayıyla kaldırıldı.

## Açık bulgular
- **M2 (düzeltildi (commit f90c3bf), cihazda yeniden ölçülecek):** çevrimdışı açılışta Katılımlarım'daki kayıtlı kart listesi ~60 sn sonra görünüyor (15 sn zaman aşımı × yeniden denemeler).
  Görevlinin önünde bekleyen bir katılımcı için uzun. Öneri: ağ hatası sınıfında yeniden denemeyi kısalt veya kayıtlı kartları
  sorgu beklerken de göster.
- **Gözlem:** bir seferde uçak modunda Katılımlarım'dan karta, dokunulmadan geçildiği görüldü; kodda otomatik geçiş yok. Tekrar
  üretilemedi (adb dokunuş kuyruğu şüphesi). Cihazda gözlenecek.
- Kamera ile QR okutma emülatörde denenmedi (kısa kod yolu doğrulandı). Gerçek Android/iPhone/Huawei cihaz turu ⛔.
- TalkBack bu turda da sürülemedi.

## 12 Kasım ek tur — OTA + M2 + adım 8
- **OTA:** `eas update --channel preview --environment preview` (commit `dc29d5d`) → update grubu `9e0e992d` (android `01a1cc7e`, runtime 5.0.0).
  Emülatörde 1. açılışta indirildi (`DownloadComplete`), 2. açılışta çalıştı (`No update available`). Pilotta acil düzeltme yolu doğrulandı.
- **M2 (cihazda ölçüldü):** uçak modu + soğuk açılış → Katılımlarım'a dokunduktan **4,3 sn** sonra "Kayıtlı kartların" bölümü kartla görünür
  (önce ~60 sn). → **PASS**.
- **Adım 8:** PASS (yukarıda).
- **Ek gözlemler (küçük):** (1) İlk profil formunda alan düzeltildikten sonra eski doğrulama hatası yeniden gönderene kadar kalıyor.
  (2) Check-in yapılmış ama henüz başlamamış etkinlik profilde "Yaklaşan" satırında "KATILIMIN ONAYLANDI" olarak kalıyor ("Giriş yapıldı" daha doğru olur).
  (3) Emülatör yeniden başlatılınca `default_boot` snapshot'ı eski TechApp 1.0'ı geri getirdi → yeniden kaldırıldı (test ortamı, ürün sorunu değil).
- **Temizlik (12 Kasım):** test etkinliği/kurumu, kayıtlar, iki yetişkin test hesabı (uygulamadan silindi), sentetik görevli → **0**.
