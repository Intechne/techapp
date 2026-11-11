# TechApp V5 · Pilot sonrası yol haritası

2026-11-12 · Spec: `docs/superpowers/specs/2026-11-11-techapp-v5-design.md` · Pilot planı: `2026-11-11-techapp-v5-phase1-2.md`
Kesin tarihler yalnız şunlar: **21 Kasım** özellik dondurma · **24 Kasım** go/no-go (kararı kullanıcı verir) · **27–29 Kasım** Cezeri pilotu.
Sonrası için tarih verilmez; sıra ve bağımlılık verilir. Pilot ≠ ürün (§8a-6): aşağıdakiler ertelenmez, pilottan sonra sırayla yürür.

## Sıra

| # | İş | Plan | Bağımlılık | Tek başına yayınlanır mı |
|---|---|---|---|---|
| 0 | Pilot (Faz 1–2, Task 13–15) + pilot dersleri → düzeltmeler | phase1-2 | — | — |
| 1 | Pilot borçları + `created_by` gizlilik düzeltmesi | 3b T1–T2 | 0 | evet; **takımlar pilot dışına açılmadan önce zorunlu** |
| 2 | Tasarım temeli + **render edilmiş önizleme kapısı** | 4 T1–T4 | 1 | T1–T3 evet; T4 kullanıcı onayı |
| 3 | Eksik modüller (her biri DB önce) | 3b T3–T15 | 1; UI'lar 2'nin onaylı kart ailesiyle | her modül ayrı |
| 4 | Takım etkinlik kaydı | 3a T1–T8 | 1 (gizlilik), 3b T9 varsa bildirim türleri | evet; production'da bayrak kapalı |
| 5 | Beş sekmeye uygulama | 4 T5–T11 | 2 onayı; ilgili 3b modülleri | sekme sekme |
| 6 | Hareket, erişilebilirlik, performans | 5 T1–T8 | 5 | evet |
| 7 | Production, iOS, Android, Huawei, mağaza | 6 T1–T9 | Hukuk; 6 T1 erken başlayabilir | kapı kapalı yayınlanabilir |

**Paralel yürüyebilenler:** Faz 6 T1 (hukuk kapısı kodu) ve hesap ön koşulları (Apple, Play, AppGallery, Sentry, Supabase prod) 1. adımla birlikte başlayabilir — çoğu kullanıcı/Intechne tarafında bekler. 3a'nın DB task'ları (T1–T4) 3b UI task'larıyla çakışmaz.
**Neden 4 (tasarım kapısı) 3b UI'larından önce:** kaydet düğmesi, kapaklar, bildirim satırları, arama sonuçları yeni kart ailesine oturur; önce onay alınırsa her ekran bir kez yapılır.
**Pilot kapısı 2 ile ilişki:** production Supabase pilot için açıldıysa Faz 6 T2 doğrulama/sertleştirme moduna geçer.

## Kullanıcı kararı / onayı gereken her şey

**Ürün ve kapsam**
1. Sıralama: tasarım kapısı (Faz 4 T1–T4) 3b modüllerinden önce mi? (öneri: evet)
2. Takım kaydı bekleme süresi: tamamlanmamış takımın koltuğu en çok 7 gün / kayıt kapanışı (3a).
3. Takım kaydında mentor da gönderebilsin mi? (öneri: hayır, yalnız kaptan)
4. Takım kapağı mobilde (`expo-image-picker` + fotoğraf izni beyanı) eklensin mi? (3b T5)
5. Kapak değişimi yayındaki etkinliği/fırsatı yeniden incelemeye düşürür (geçici olarak listeden kalkar) — spec'e uygun; kabul mü? (3b T3)
6. Bildirim metinleri sunucuda (`app.notification_copy`) — hata metinlerinin istemcide olması kuralının istisnası (push aynı metni kullanacak). (3b T9)
7. Okunmuş bildirimlerin silinme süresi (öneri 90 gün; saklama politikasıyla uyumlu olmalı). (3b T9)
8. Gesture Handler bu sürümde eklenmez (kanban sürükleme / kaydırarak silme onaylanırsa ayrı task). (Faz 5)
9. Performans bütçeleri: ilk ölçümden sonra (yalnız ≥55 fps spec'te sabit). (Faz 5 T7)
10. Push bildirimleri: hiçbir planda yok; sağlayıcı kimlik bilgileri (APNs, FCM, HMS) ve ayrı plan gerekir.

**Tasarım (Faz 4 T4 önizleme kapısında)**
11. Kart ailesi, beş sekme hiyerarşisi, eyebrow kuralı (adlar büyük harf olmaz), çevrimdışı etiketi tonu, kapaksız poster grafiği.

**Altyapı ve maliyet (🔒 her biri ayrı onay)**
12. Staging'e her migration push'u; her EAS build (kota/maliyet); Vercel production dağıtımı.
13. Production Supabase: bölge (öneri AB), plan, PITR/yedekleme.
14. Sentry: saklama süresi (öneri 30 gün), bölge (öneri AB), hesap/DSN.
15. Apple Developer / App Store Connect, Play Console, AppGallery Connect hesapları ve imza anahtarları.

**Hukuk (sert kapı — §8a-3)**
16. Gizlilik politikası, KVKK aydınlatma, kullanım koşulları, saklama politikası, veli onay metni ve e-posta metni; sürüm yayını (`policy_versions`).
17. Hedef kitle beyanı (13+; 13 altı yok) ve reşit olmayanların takım üyeliği için veli onayı gerekip gerekmediği.
18. `signup_open = true` (herkese açık kayıt) — yalnız 16. madde tamamlanınca, yazılı onayla.
19. Mağaza inceleme hesabı yolu (OTP-only giriş için).

## Kaba sıralama

- **12–21 Kasım:** yalnız pilot (dondurma 21 Kasım). Bu planlar okunur, kararlar (1–9, 13–17) toplanır; hesap başvuruları başlatılır.
- **22–29 Kasım:** go/no-go (24) ve pilot. Yeni özellik yok; yalnız pilot hata düzeltmesi.
- **Pilottan sonra:** adım 1 → 2 (önizleme kapısı, onay) → 3 ve 4 (modül modül) → 5 → 6 → 7. Faz 6'nın mağaza gönderimi hukuk metinleri gelmeden yapılmaz; gelmezse ürün staging + internal test dağıtımında olgunlaşmaya devam eder.
