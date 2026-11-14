# Hukuk kapısı (Faz 6 Task 1)

> Bu dosya **hukuki metin içermez** ve içermeyecek (CLAUDE.md kural 8). Metinler Intechne'nin hukuk danışmanlarından gelir;
> burada yalnız hangi metnin gerektiği, uygulamada/web'de nerede durduğu, sürüm kimliği ve onay kaydı tutulur.

Migration: `supabase/migrations/20261114000100_policy_versions_signup_gate.sql` · Test: `supabase/tests/legal-gate.test.ts` ·
Remote regresyon: `supabase/tests/remote/security-regression.sql` blok **30–30m** (30g, 30h ve 30l MUST PASS).

## Kapı nasıl çalışır

| Parça | Ne yapar |
|---|---|
| `app.settings` | İki anahtar: `signup_open`, `allow_draft_policies`. Migration ikisini de **`false`** yazar. Satır yoksa/boolean `true` değilse kapalı sayılır (fail closed). API rollerine (anon, authenticated, service_role) okuma/yazma yok; yalnız SQL editörü / migration. |
| `complete_profile_bootstrap` | İlk profil tamamlamada kapı (`app.signup_allowed`): `signup_open = false` **ve** giriş e-postasının hash'i `signup_allowlist`'te yoksa **403 `signup_closed`**; profil, doğum tarihi, ilgi alanı, audit satırı yazılmaz. "Zaten tamamlamış" istisnası **sunucu sahipli** `profile_private.birth_date`'e bakar (yalnız bu RPC yazar; istemci grant'i yok + tetikleyici). `profiles.onboarded_at` da artık sunucu sahiplidir: tablo düzeyi UPDATE kaldırıldı, yalnız düzenlenebilir sütunlar (`display_name, headline, bio, city, education_stage, avatar_path, discoverable, skills`) authenticated'a açık + `protect_onboarded_at` tetikleyicisi (403 `onboarded_at_locked`). (Fix round 1: önceki sürümde kişi `onboarded_at`'i kendisi yazıp kapıyı atlatabiliyordu.) |
| Kapalı kapıda doğrudan yazma | `profile_private` (ad soyad, telefon, okul) ve `profile_interests` insert/update: kimliği olan çağrıda `app.signup_allowed` değilse **403 `signup_closed`** (`require_signup_allowed` tetikleyicisi). Kimliksiz sunucu yolları (kayıt tetikleyicisi, service role) etkilenmez. **Diğer tablolar kapsanmaz** — aşağıdaki "Bekleyen kalemler" 1. |
| `hook_before_user_created(event)` | Supabase **Before User Created** auth kancası (Postgres fonksiyonu): `signup_open` açık değilse ve adres (küçük harf, boşluksuz) izin listesinde değilse `{"error": {"http_code": 403, "message": "Kayıtlar henüz açık değil. …"}}`, aksi halde `{}`. Yalnız `supabase_auth_admin` çalıştırır (public/anon/authenticated/service_role'den geri alındı). **Kapalı gelir** (`supabase/config.toml` `[auth.hook.before_user_created] enabled = false`): açmak her barındırılan proje için 🔒 ayrı adım (aşağıda). Docker'sız yerel yığın aynı fonksiyonu `/otp` ve `/verify`'da kendisi çağırır (yerelde kapı açık olduğundan OTP bozulmaz). |
| `signup_allowlist` | Yalnız `sha256(lower(trim(email)))` (bytea, 32 bayt) + kısa not (`@` içeremez, ≤120) + ekleyen + tarih. Düz e-posta tabloya, audit'e, hata mesajına yazılmaz. anon/authenticated tabloyu göremez (permission denied). |
| `add_signup_allowlist(p_email, p_note)` / `remove_signup_allowlist(p_email)` | Yalnız platform admini (diğerleri 403 `forbidden`, anon çağıramaz). Hash sunucuda alınır; girdi saklanmaz. Audit: `signup_allowlist.added/removed`, metadata yalnız `{added|removed: bool}`. (RPC seçildi, çünkü SQL editöründe `delete … where email_hash = sha256('ad@…')` yazmak düz adresi editör geçmişine bırakır.) |
| `public.policy_versions` | `(purpose, version)` · `is_draft` · `published_at` · `url` (`^https://`). Herkes okur (web sürüm satırı bunu kullanır); doğrudan yazma yok. Migration bugünkü üç sürümü **taslak** satır olarak ekler: `event_participation@2026-09-draft`, `guardian_event_participation@2026-09-draft`, `application_data_sharing@2026-09-draft`. |
| `publish_policy_version(p_purpose, p_version, p_url)` | Yalnız platform admini. Sürüm biçimi `<amaç>@YYYY-AA-GG[.n]` ("draft" yayımlanamaz), `p_url` https. Aynı sürüm ikinci kez → 409 `policy_version_exists`. Audit `policy.published` (amaç + sürüm). |
| `app.current_policy_version(p_purpose)` | Yeni rıza kaydının sürümü: amacın en son yayımlanmış **taslak olmayan** sürümü. Yoksa yalnız `allow_draft_policies = true` iken taslak; aksi halde **409 `policy_not_published`** (kayıt, veli isteği, başvuru tamamen geri alınır; sessiz taslak sürüm yok). Yeni sürüm yayımlanınca **eski `consents.policy_version` değişmez**; kimse yeni metni onaylamış sayılmaz. |

İstemci: mobil `signup_closed` (RPC'den) ve kancanın reddi (`signInWithOtp` hata mesajı `Kayıtlar henüz açık değil.` ile başlar → `signup_closed`; GoTrue'nun `error_code`'una güvenilmez) → giriş ekranında ve profil ekranında "Kayıtlar henüz açık değil. Pilot ekibindeysen bize yaz: techapp.intechne.com.tr/destek" + "Bize yaz"
düğmesi (`/destek`'i açar); `policy_not_published` → dürüst "metin henüz yayımlanmadı, işlemin tamamlanmadı" cümlesi
(`apps/mobile/src/lib/errors.ts` COPY). Web `/gizlilik` ve `/kosullar`: yer tutucu "hazırlanıyor" metni kalır; yalnız
yayımlanmış (taslak olmayan) sürüm varsa altında "sürüm …, yayım tarihi …" satırı çıkar (`apps/web/components/PolicyVersions.tsx`).

## Ortamlar — bayraklar DB'dedir, ortam değişkeni değil

| Ortam | `signup_open` | `allow_draft_policies` | Nasıl |
|---|---|---|---|
| Yerel geliştirme | `true` | `true` | `supabase/seed.sql` (yeni DB) + `supabase/dev/start.mjs` (her başlatmada; seed'i tekrar koşmayan eski DB için) |
| `db:test` | `true` | `true` | `supabase/tests/global-setup.ts`; `legal-gate.test.ts` kapıyı yalnız kendi testlerinde kapatır |
| Staging | 🔒 `true` | 🔒 `true` | Migration push'uyla **aynı onaylı adımda** tek seferlik `update` (aşağıda). Yapılmazsa staging'de yeni kayıt ve tüm rıza yolları durur. |
| Production | **`false`** | **`false`** | Hukuk metinleri yayımlanana ve aşağıdaki onay tablosu dolana kadar değişmez. Kapı kapalıyken sunucunun **zorladığı**: izin listesinde olmayan hesap profilini tamamlayamaz (doğum tarihi, ad, ilgi alanı yazılmaz), `profile_private` / `profile_interests`'e doğrudan yazamaz ve yayımlanmamış amaç için hiçbir rıza kaydı oluşmaz (`policy_not_published`). Kanca **açılana kadar zorlanmayan**: OTP ile `auth.users` hesabı yine oluşur ve hesap, profil tamamlamayı gerektirmeyen diğer tablolara (deneyim, kayıtlı içerik, rapor, takım vb.) RLS'in izin verdiği kadar yazabilir. Kanca açıldıktan sonra listede olmayan adresle hesap hiç oluşmaz. |

### ⚠️ Staging'e push'un zorunlu sonucu
`20261114000100` staging'e (pilot sonrası, kullanıcı onayıyla) basıldığı anda iki bayrak `false` olur:
- izin listesinde olmayan her **yeni** hesap profil tamamlayamaz (`signup_closed`);
- **her** rıza yazan yol durur: etkinlik kaydı (`register_for_event`, takım kaydı/kadro yanıtı), veli isteği (`create_guardian_request`), başvuru (`submit_application`) → `409 policy_not_published` — çünkü hiçbir amaç için yayımlanmış sürüm yok.

Bu yüzden push ile aynı onaylı adımda (🔒 kullanıcı onayı, hedef ref iki kez kontrol):
```sql
-- STAGING ONLY. Never on production.
update app.settings set value = 'true'::jsonb where key in ('signup_open', 'allow_draft_policies');
select key, value from app.settings order by key;   -- beklenen: allow_draft_policies true, signup_open true
```
Ardından remote regresyon (blok 30 bayrak değerinden bağımsızdır; fikstürler kendi rollback'li işleminde açıp kapatır).

### Auth kancasını açma (staging ve production, ayrı ayrı) 🔒
Yalnız migration o projede uygulandıktan **sonra** (kanca yoksa Auth her yeni kaydı reddeder):
1. `supabase/config.toml` → `[auth.hook.before_user_created] enabled = true` (yerel değişiklik; commit kullanıcı onayıyla).
2. Hedef ref iki kez kontrol → `npx supabase config diff` çıktısı kullanıcıya gösterilir (yalnız bu kanca + beklenen farklar).
3. 🔒 Kullanıcı onayı → `npx supabase config push` (KNOWN-ISSUES: onay sormadan uygular — yalnız 2. adımdan sonra).
4. Doğrulama: izin listesinde olmayan yeni adresle `signInWithOtp` → 403 ve mesaj "Kayıtlar henüz açık değil…"; listedeki adres kod alır; mevcut hesap etkilenmez. Staging'de `signup_open = true` olduğu için kanca herkese izin verir (beklenen).
Not: barındırılan Auth'un kanca hata yanıtının tam biçimi (`error_code`) yerelde doğrulanamadı; mobil yalnız mesajın başına bakar, 4. adım bunu gerçek projede doğrular.

## Bekleyen kalemler (hukuk kapısına bağlı)

1. **Kapalı kapıda kişisel veri (I2) — auth kancasının açılmasına bağlı:** kanca kapalıyken OTP hesabı oluşur; bu hesap `profile_private`/`profile_interests` dışında, profil tamamlamayı istemeyen tablolara (ör. deneyimler/kanıtlar, kayıtlı içerikler, raporlar, takım istekleri) RLS'in izin verdiği kadar yazabilir. Bu sınıf, kanca production'da açıldığında kapanır (listede olmayan adresle hesap oluşmaz). **Production'da kanca açılmadan herkese açık OTP girişi duyurulmaz**; Task 2 production kurulumunda kanca açma adımı (yukarıda) zorunludur.
2. **Taslak sürümlü bekleyen veli istekleri (M1, yalnız staging):** `guardian_requests.policy_version` istek anında yazılır. `allow_draft_policies` sonradan kapatılsa bile, o sırada bekleyen (`pending`) bir istek veli onaylarsa `consents`'e **taslak** sürüm (`guardian_event_participation@2026-09-draft`) kopyalanır (`guardian_decide` istekteki sürümü kullanır). Production'da taslak hiç açılmadığı için oluşmaz; staging'de taslağı kapatmadan önce bekleyen istekler sayılmalı/süresi dolmalı.
3. **Task 2 (M3):** `supabase/tests/remote/prod-static-checks.sql` iki bayrağın da `false` olduğunu (`signup_open`, `allow_draft_policies`) ve kancanın açık olduğunu (Dashboard/`config diff`) doğrulamalı.

## Bugün kodda sürüm isteyen amaçlar

| `policy_versions.purpose` | Yazan yol (sunucu) | Bugünkü sürüm (taslak) |
|---|---|---|
| `event_participation` | `register_for_event`, takım kaydı yolları (`20261113000500/0700`) → `consents` | `event_participation@2026-09-draft` |
| `guardian_event_participation` | `create_guardian_request` → `guardian_requests.policy_version`; veli onayında `consents`'e aynen kopyalanır (`guardian_decide`, sürüm uyuşmazsa 409) | `guardian_event_participation@2026-09-draft` |
| `application_data_sharing` | `submit_application` → `consents` | `application_data_sharing@2026-09-draft` |

Belge amaçları (rıza kaydı yok, web sürüm satırı için): `privacy_policy`, `kvkk_notice`, `terms_of_use`, `retention_policy`.
Amaç listesi `app.policy_purposes()`'tadır; yeni amaç = migration.

## Gereken metinler ve yerleri

| Metin | Uygulamadaki / web'deki yeri bugün | `purpose` | Not |
|---|---|---|---|
| Gizlilik politikası | Web `/gizlilik` (yer tutucu); mobil Ayarlar → "Gizlilik politikası" (web'i açar) | `privacy_policy` | |
| KVKK aydınlatma metni | Web `/gizlilik` (aynı sayfa, yer tutucu); ayrı sayfa yok | `kvkk_notice` | Ayrı sayfa mı, aynı sayfa mı: hukuk kararı |
| Kullanım koşulları | Web `/kosullar` (yer tutucu); mobil Ayarlar → "Kullanım koşulları" | `terms_of_use` | |
| Saklama politikası | **Yeri yok** (web'de sayfa yok; `/gizlilik` sürüm satırında gösterilmeye hazır) | `retention_policy` | Saklama süreleri `docs/KNOWN-ISSUES.md` / `GUARDIAN-CONSENT.md` açık kalemleri |
| Etkinlik katılım rızası | Mobil `EventRegistrationScreen` (bugün metin bağlantısı yok, yalnız veli bilgisi notu) | `event_participation` | Kayıt anında metne bağlantı **yok** — hukuk gerektirirse ayrı görev |
| Veli onay metni | Web `/veli` (`apps/web/app/veli/GuardianConsent.tsx`; sürüm `guardian_request_preview`'dan gelir ve `guardian_decide`'a geri gönderilir) | `guardian_event_participation` | |
| Veli e-posta şablonu metni | `supabase/functions/guardian-dispatch/handler.ts` (konu + gövde) | `guardian_event_participation` ile birlikte sürümlenir | Ayrı sürüm kimliği istenirse yeni amaç = migration |
| Başvuru veri paylaşımı | Mobil `OpportunityDetailScreen` / `OpportunityApplyScreen` (paylaşılacak alanlar listesi; metin bağlantısı yok) | `application_data_sharing` | |

## Onay kaydı (hukuk onayı geldikçe doldurulur — şu an boş)

| Metin | Sürüm (`purpose@YYYY-AA-GG`) | Onaylayan (ad, unvan) | Onay tarihi | Yayın URL'i | `publish_policy_version` çalıştırıldı (ortam, tarih) |
|---|---|---|---|---|---|
| Gizlilik politikası | | | | | |
| KVKK aydınlatma metni | | | | | |
| Kullanım koşulları | | | | | |
| Saklama politikası | | | | | |
| Etkinlik katılım rızası | | | | | |
| Veli onay metni | | | | | |
| Veli e-posta şablonu metni | | | | | |
| Başvuru veri paylaşımı | | | | | |

## Kapıyı açma prosedürü (production) 🔒

1. Onay tablosunun **her** satırı dolu (metin · sürüm · onaylayan · tarih). Eksik satır varsa kapı açılmaz.
2. Metinler web'de yayında: `/gizlilik`, `/kosullar` yer tutucuları onaylı metinle değiştirilmiş (ayrı web sürümü), veli onay sayfası ve e-posta şablonu onaylı metinle güncellenmiş.
3. Her metin için platform admini olarak `select public.publish_policy_version('<purpose>', '<purpose>@YYYY-AA-GG', 'https://…');` (🔒 her biri ayrı onay; hedef ref iki kez kontrol). Kontrol: `select app.current_policy_version('<purpose>')` her amaç için yayımlanan sürümü döner.
4. Production'da `allow_draft_policies` **false kalır** (yayımlanmış sürüm olduğu için artık gerekmez).
5. Before User Created kancası production'da açık (yukarıdaki 🔒 adım) — kapı açıldığında herkese izin verir, ama öncesinde açık olmalıdır.
6. 🔒 Ancak 1–5 tamamsa: `update app.settings set value = 'true'::jsonb where key = 'signup_open';` — kullanıcı onayı ile, tek seferlik.
7. Sonra: herkese açık kayıt duman testi (izin listesinde olmayan yeni test hesabı profil tamamlar), sonuç `docs/PRODUCTION.md`'ye.

Kapı açılmadan önce pilot/görevli hesapları yalnız izin listesiyle girer:
`select public.add_signup_allowlist('<adres>', '<rol notu, adres değil>');` (platform admini oturumuyla; admin panelinde ekran yok).
Kapalı kapı + izin listesi production'da kayıt ve profil sağlar, **ama** etkinlik kaydı / veli isteği / başvuru yine
`policy_not_published` döner — bu beklenen kapıdır (plan Task 2 Step 9).
