# Mağaza inceleme notları (App Store + Google Play)

> Durum 14 Kasım 2026: **karar bekleniyor — inceleme hesabı yolu seçilmeden hiçbir mağazaya gönderim yapılmaz.** Bu belge hukuki metin içermez.

## Sorun
Giriş yalnızca e-postaya gelen tek kullanımlık kod (OTP) ile; şifre yok (`docs/AUTH.md`, `authService.ts`). İnceleme ekibi kendi e-postasında kod alamaz. Ayrıca kayıt kapısı kapalıyken (`signup_open=false`) izin listesinde olmayan adres hesap açamaz (`docs/legal/LEGAL-GATE.md`); kapı açıkken de bir hesap profil tamamlamalıdır (doğum tarihi vb. envanter #3–5).

## Seçenekler (kullanıcıya)
**(a) — önerilen:** Intechne kontrolünde, inceleme süresince açık tutulan paylaşılan bir posta kutusu + izin listesi girişi. Kodun incelemeciye ulaşma yöntemi (kutuya erişim verilmesi ya da Intechne'den birinin kodu iletmesi) **kullanıcı kararı bekleniyor**. Adım listesi:
1. Intechne kontrolünde bir posta kutusu (ör. mağaza incelemesi için ayrılmış) açılır — **adres ve sahibi kullanıcı kararı bekleniyor.**
2. Adres izin listesine eklenir: platform admini oturumuyla `select public.add_signup_allowlist('<adres>', '<rol notu, adres değil>');` (`LEGAL-GATE.md`). Hash saklanır, düz adres tabloya yazılmaz. 🔒 production'da kullanıcı onayı.
3. Hesabın profili (ad, doğum tarihi ≥18 önerilir — veli onayı akışına takılmasın —, eğitim aşaması) önceden tamamlanır; incelemeci kodla girer.
4. İncelemeciye gösterilecek veri **gerçek (ve `is_demo` olmayan)** içerik olmalıdır; "ÖRNEK" içerik yok (ekran görüntüsü kuralıyla tutarlı).
5. İnceleme bitince adres izin listesinden `remove_signup_allowlist` ile çıkarılır, posta kutusu kapatılır, hesap silinir (uygulama içinden).
Etkinlik kaydı/başvuru/veli isteği yolları, yayımlanmış politika sürümü yoksa `409 policy_not_published` döner (kapı beklenen davranışı) — **hukuk metni yayımlanıp `publish_policy_version` çalışmadan incelemeci bu akışları deneyemez**; bu yüzden hukuk metinleri gönderim önkoşuludur.

**(b) — önerilmez:** Yalnız inceleme hesabı için sabit kod. CLAUDE.md kural 2 (demo bypass yasağı) ve "geçersiz kılma yok" ilkesine yakındır. Seçilirse yalnızca: sunucu tarafında **tek hesapla** sınırlı, **süreli** (bitiş tarihli), kod uygulamaya/istemciye hiç girmeden, audit'li ve inceleme bitince kaldırılır; bu yeni bir sunucu özelliğidir (migration + test + hukuk bakışı) — bugün **yok**.

## İnceleme notu taslağı (karardan sonra doldurulacak)
- Giriş: e-posta adresi + OTP; şifre yok. İnceleme hesabı: `<karar bekleniyor>`.
- Hesapsız gezinme mümkündür: etkinlik, fırsat, takım, eğitim listeleri.
- Kamera izni yalnız görevli hesabında QR okutmak içindir (inceleme hesabı görevli değilse ekran görünmez); görüntü saklanmaz.
- 18 yaş altı: etkinlik başına veli onayı e-posta bağlantısıyla; incelemecinin bunu denemesi gerekmez.
- Kullanıcı içeriği: takım/proje/ilan; serbest mesajlaşma yok; içerik bildirme uygulamada var. **Yönetim moderasyon konsolu hazır değil** — gönderimden önce kapatılacak.
- Hesap silme: Profil → Ayarlar → Hesabımı sil. Web: `/hesap-silme`.
- Push bildirimi, ödeme, reklam, konum yok.

## Gönderim önkoşulları (hâlâ açık)
1. Bu belgedeki inceleme hesabı kararı (a/b).
2. Hukuk metinleri yayımlanmış (`LEGAL-GATE.md` onay tablosu dolu) — gizlilik URL'si yer tutucu iken gönderilmez.
3. Yönetim rapor/moderasyon konsolu (UGC).
4. Before User Created kancası production'da açık.
5. Hesap silme: uygulama dışı talep kanalı (Play) + destek iletişimi.
6. Mağaza görselleri: pilot sonrası staging, `is_demo` içermeyen hesap.
7. Not (bloklamaz): giriş alanı kenarlık kontrastı kararı (WCAG 1.4.11).
