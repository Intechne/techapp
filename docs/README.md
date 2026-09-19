# Dokümantasyon

Okuma sırası önerisi (yeni başlayan için): **ARCHITECTURE → DATABASE → AUTH → GUARDIAN-CONSENT → TESTING → KNOWN-ISSUES.**

| Belge | Ne anlatır | Ne zaman güncellenir |
|---|---|---|
| [ARCHITECTURE](ARCHITECTURE.md) | Katmanlar, state ayrımı, hata sözleşmesi, navigasyon, ortamlar | Yeni katman/kalıp eklendiğinde |
| [DATABASE](DATABASE.md) | Tablolar, kısıtlar, fonksiyon kataloğu, RLS, dağıtım | Her migration'da |
| [AUTH](AUTH.md) | E-posta OTP, oturum, hesap silme | Auth akışı değişince |
| [GUARDIAN-CONSENT](GUARDIAN-CONSENT.md) | 18 yaş altı, veli onayı modeli, token yaşam döngüsü | Politika/akış değişince |
| [PRODUCT-SCOPE](PRODUCT-SCOPE.md) | Ürün tanımı, eski 33 ekranın yeni yapıya eşlemesi, fazlar | Kapsam kararı değişince |
| [TESTING](TESTING.md) | Hangi test neyi kanıtlıyor, neler elle doğrulandı | Test eklenince |
| [RELEASE](RELEASE.md) | Supabase'e bağlanma, EAS profilleri, mağaza gereksinimleri | Yayın süreci değişince |
| [DOMAIN](DOMAIN.md) | `techapp.intechne.com.tr` URL haritası, e-posta alan adı, universal link dosyaları | Alan adı / URL kararı değişince |
| [HUAWEI](HUAWEI.md) | GMS'siz cihaz durumu, HMS planı | Bağımlılık eklenince |
| [KNOWN-ISSUES](KNOWN-ISSUES.md) | Doğrulanmamış alanlar, teknik borç, eksik kapsam | **Her PR'da gözden geçir** |

Kökte: [`IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md) (canlı durum) · [`TECHAPP-IMPLEMENTATION-PLAN.md`](../TECHAPP-IMPLEMENTATION-PLAN.md) (plan) · [`CONTRIBUTING.md`](../CONTRIBUTING.md) · [`CLAUDE.md`](../CLAUDE.md).
