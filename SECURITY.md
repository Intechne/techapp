# Güvenlik

TechApp, 18 yaş altı kullanıcıların verisini de işler. Güvenlik ve gizlilik hataları en yüksek önceliktedir.

## Açık bildirimi
Bir güvenlik açığı bulduysan **herkese açık issue açma.** GitHub'da bu deponun **Security → Report a vulnerability** (private advisory) akışını kullan ya da Intechne teknik sorumlusuna doğrudan ulaş. Bildirime şunları ekle: etkilenen bileşen, yeniden üretme adımları, olası etki. Gerçek kullanıcı verisiyle deneme yapma.

## Yanlışlıkla gizli anahtar commit'lediysen
1. Anahtarı **hemen iptal et / döndür** (Supabase Dashboard → API Keys, Resend, EAS…). Geçmişten silmek tek başına yeterli değildir.
2. Ekibe haber ver; sonra geçmiş temizliğini birlikte planlayın.

## Depoda asla bulunmaması gerekenler
`service_role` / `sb_secret_…` anahtarları · veritabanı parolası · SMTP/Resend anahtarı · imzalama sertifikaları (`.p12`, `.jks`, `.mobileprovision`) · Play/App Store servis hesabı JSON'ları · gerçek kullanıcı verisi içeren dökümler.
İstemcilerde yalnız **publishable key** bulunur; bu anahtar gizli değildir, yetki RLS ile sınırlanır.

## Güvenlik modeli (özet)
- Her tabloda Row Level Security açıktır; bunu bir test garanti eder (`supabase/tests/rls-audit.test.ts`).
- Kayıt, başvuru, rol, doğrulama, check-in ve veli onayı yalnız sunucu fonksiyonlarıyla değişir.
- Veli onay token'ı yalnız sunucuda üretilir, hash'i saklanır, tek kullanımlık ve sürelidir; uygulama token'ı hiç görmez.
- Katılım QR'ı kişisel veri içermez (kayıt kimliği + HMAC).
- Audit kayıtlarında kişisel veri tutulmaz.
Ayrıntı: [`docs/DATABASE.md`](docs/DATABASE.md), [`docs/GUARDIAN-CONSENT.md`](docs/GUARDIAN-CONSENT.md).
