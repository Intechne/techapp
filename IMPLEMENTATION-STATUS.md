> **V5 — 11 Kasım 2026 (dal `feat/v5-pilot-platform`).** Güncel durum bu bölümdedir. 7 Ekim ve daha eski bölümler **tarihsel kayıttır**; çelişen yerde bu bölüm geçerlidir. ✅ yalnız bugün ölçülen ya da kanıtı yazılı olan şey içindir.

## Faz 3a — takım etkinlik kaydı (dal `feat/v5-product`; staging'e uygulanmadı)
Plan: `docs/superpowers/plans/2026-11-12-techapp-v5-faz3a-team-registration.md`. Görev kaydı: `.superpowers/sdd/2026-11-12-techapp-v5-faz3a-team-registration/` (yerel).

| Görev | Konu | Commit'ler | Staging |
|---|---|---|---|
| T1 | Şema, RLS, sayaçlar (`20261113000500_team_registration`): takım satırı + kadro anlık görüntüsü, iki bağımsız kontenjan havuzu (bireysel / takım), sayaç koruması, kritik alanlar | `e01c025` + takip (`d8aa0b0`) | ⏸ bekletildi (pilot sonrası; `20261113000400`'ten sonra, dosya sırası; remote regresyon 26–26h) |
| T2 | Gönderim (`20261113000600_team_registration_rpc`): `submit_team_registration` — etkin kaptan **veya** mentor gönderir, takım kontenjanı satır sayımından, bekleme listesi, `app.promote_team_waitlist`; `event_eligibility` ek alanları; bireysel kayıt takım kadrosuyla çakışmaz (`already_on_team_roster`) | `2b4851b` + düzeltme `58686b1` | ⏸ bekletildi (pilot sonrası; `20261113000500`'ün hemen ardından; remote regresyon 27–27f) |
| T3 | Yaşam döngüsü (`20261113000700_team_registration_lifecycle`): üye kendi kaydı + kendi rızası (`respond_team_registration`; 18 yaş altı mevcut veli akışıyla), kadro düzenleme sürümlü (`update_team_roster`, 409 `roster_changed`), iptal, 7 günlük tutmanın süre dolumu (`app.expire_team_registrations` + cron), kart/check-in takım onayına bağlı, ayrılma/kayıt sonu/hesap silme tetikleyicileri, etkinlik iptali takım satırlarını da kapatır, 5 takım kaydı bildirim türü | `ee55782` + düzeltme `bf15db0` | ⏸ bekletildi (pilot sonrası; `20261113000600`'ün hemen ardından; remote regresyon 28–28f, 25h artık 18 tür) |

**T1 — ne geldi (yalnız yerelde kanıtlı: `npm run db:test` 299, remote regresyonun yerel kuru koşusu 85/85 ve Storage'lı 90/90; staging'de koşulmadı):** RPC yok (gönderim T2, üye yanıtı/veli/iptal/süre dolumu T3, organizatör T4). Okuma: takımın etkin üyeleri, etkinlik kurumunun owner|admin|reviewer|checkin_staff'ı, platform admini; kişi kendi kadro satırını her zaman görür, takım arkadaşları yalnız canlı kadroyu (`invited`/`accepted`; başkasının reddettiği/çıkarıldığı satır görünmez); anon hiç göremez; istemcinin iki tabloya yazma yetkisi yok. Takım üyelerinin kendi kayıtları (`team_registration_id` dolu) bireysel `seats_taken`/bekleme listesine sayılmaz ve hiçbir zaman `waitlisted` olamaz. API çağıranı etkinlik eklerken dört sayaç 0'a zorlanır ("dolu" etkinlik oluşturulamaz; servis rolü/migration yolu değişmez). Bildirim türleri henüz yok (T3).

**T2 — ne geldi (yalnız yerelde kanıtlı: `npm run db:test` 317, kuru koşu 92/92 ve Storage'lı 97/97; staging'de koşulmadı):** `submit_team_registration(event, team, member_ids, idempotency_key)` → takım satırı `pending_members` (koltuk tutma `least(kayıt kapanışı, gönderim + 7 gün)`) ya da kontenjan doluysa `waitlisted` (bekleme kapalıysa 409 `team_event_full`) + her kişi için `invited` kadro satırı; kimse başkası adına rıza vermez (üyenin kendi kaydı T3'te kabul edince açılır). Gönderen takımın etkin kaptanı ya da mentoru (değilse 403 `not_team_manager`). Kadro: takım büyüklüğü (422 `team_size_out_of_range`), herkes etkin üye (422 `member_not_active`), yaş aralığı (403 `member_age_not_eligible`), etkinlikte başka canlı kaydı/kadrosu yok (409 `member_already_registered`); bu üç hata `detail`'de yalnız sorunlu üyelerin id'lerini (JSON dizi) döner — ad, yaş, doğum tarihi asla; denetim kaydında yalnız id'ler + kadro boyu. Ters yön: takım kadrosunda (davetli/kabul etmiş, takım satırı canlı) olan kişi aynı etkinliğe bireysel kayıt olamaz (409 `already_on_team_roster`). Süresi geçmiş veli isteği, üyenin bekleyen bireysel kaydını engel olarak bırakmaz (gönderimde `app.expire_guardian_requests`). Son takım koltuğu yarışı gerçek paralel testle kanıtlı (biri `pending_members`, diğeri `waitlisted`). `event_eligibility`: `registration_mode`, `team_seats_left`, `manageable_teams` (çağıranın kaptan/mentor olduğu etkin takımlar, `active_member_count`, takımın canlı kaydı). Mobil: yalnız `COPY` (8 yeni kod); ekran T5'te.

**T3 — ne geldi (yalnız yerelde kanıtlı: `npm run db:test` 341, kuru koşu 100/100 ve Storage'lı 105/105; staging'de koşulmadı):** Davet edilen kişi daveti **kendisi** yanıtlar (başkası adına 403 `not_invite_owner`); kabulde kendi `event_registrations` satırı (`team_registration_id`, `team_id` dolu) + kendi `self` rızası açılır, durum `pending_guardian` (18 yaş altı → mevcut `create_guardian_request` / `guardian_decide`) ya da `confirmed`; inceleme takım düzeyinde. Doğum tarihi bilinmeyen kabul edemez (409 `profile_incomplete`); bekleme listesindeki takımın daveti kabul edilemez, reddedilebilir (409 `team_registration_waitlisted`). Takım durumu sunucuda türetilir: güncel kadro sürümündeki herkes kabul etmiş + kaydı onaylı + boy sınırlar içinde → `confirmed` (inceleme varsa `pending_review`), değilse `pending_members`; kapanış öncesi geri düşüşte tutma `least(kayıt kapanışı, şimdi + 7 gün)` olur (**kullanıcı kararı 13 Kas 2026**). **Kapanıştan sonra (kullanıcı kararı 13 Kas 2026):** yalnız hazır üyeler sayılır; `team_min_size` ve üstü → durum ve kartlar korunur; altı → `pending_review` (`roster_below_min_after_close`), kapanışta düşmez, organizatör karar verir (T4); etkinlik bitene (`ends_at`) kadar karar yoksa `expired` (`review_not_decided`) — kimse karar vermediği için `cancelled` değil. Kadro bileşimini değiştiren her şey (ret, üyenin kendi kaydının bitmesi, takımdan ayrılma/çıkarılma, hesap silme, kadro düzenleme) `roster_version`'ı artırır; eski sürümle düzenleme 409 `roster_changed`. Kaptan **veya** mentor düzenler/iptal eder (403 `not_team_manager`); kapanıştan sonra ya da canlı olmayan kayıtta 409 `team_registration_closed`. İptal ve süre dolumu üye kayıtlarını kapatır, bekleyen veli isteklerini geri alır, koltuğu bekleme listesindeki ilk takıma verir. Kart ve check-in takım onaylanmadan 409 `team_registration_not_confirmed`. Etkinlik iptali takım satırlarını da iptal eder (yükseltme yok). Gönüllü özeti `confirmed`'ı yalnız giriş yapabilecek kişilerden sayar (+ ek anahtarlar). `team_registration_detail` takımın etkin üyelerine (+ platform admini): ad, rol, durum, adım; reddeden / ayrılan üyelerin adları yalnız kaptan, mentor ve platform admine — e-posta / doğum tarihi / veli bilgisi yok. Bildirim türleri: `team_registration.invited`, `.confirmed`, `.member_declined` (kaptan + mentora), `.expired`, `.guardian_expired` (takım içinde veli isteği dolan üyeye); takım üyesinin kendi kaydı için `registration.confirmed` ve takım süresi dolunca `registration.expired` gönderilmez; 24 saat hatırlatması takım onaylanmadan gitmez. Bireysel kayıt davranışı aynı (önceki testler değişmeden yeşil; yalnız bildirim türü listesi testi 13 → 18). Mobil: yalnız `COPY` (7 yeni kod); ekranlar T5–T6.

**T3 — bilinen sorunlar / açık kararlar:**
- Kilit sırası (önceden var, değiştirilmedi — pilot fonksiyonları): `guardian_decide` / `guardian_revoke` önce veli isteğini, sonra etkinliği kilitler; `cancel_event_registration` önce etkinliği, en son veli isteğini → aynı kayıtta eşzamanlı ret/iptal Postgres'te deadlock ile birini düşürebilir (kullanıcı yeniden dener). Süre dolumu cron'u takım dalında artık etkinlik → istek `SKIP LOCKED` sırasıyla gider, beklemez.
- Hesap silme: `auth.users` cascade'i kişinin satırlarını kilitledikten sonra tetikleyici etkinliği kilitler (RPC sırasının tersi); aynı etkinlikte eşzamanlı bir yazmayla nadir deadlock olasılığı. Silinen üyenin satırı kalmadığı için kalan kadro tamam ve sınırlar içindeyse takım yönetici eylemi olmadan onaylanabilir.
- **Bayrak açılmadan önce karar:** takımı yönetici iptal ettiğinde ya da üye kadrodan çıkarıldığında / takımdan ayrıldığında üyeye bildirim yok (`team_registration.cancelled` / `.removed` türleri eklenmedi).

## Faz 3b — çekirdek modüller (dal `feat/v5-product`, kod tamam; staging'e uygulanmadı)
Plan: `docs/superpowers/plans/2026-11-12-techapp-v5-faz3b-core-modules.md`. Görev kaydı: `.superpowers/sdd/2026-11-12-techapp-v5-faz3b-core-modules/` (yerel).

| Görev | Konu | Commit'ler | Staging |
|---|---|---|---|
| T1 | Pilot borçları (Katılım etiketi, yenileme, veli sorgusu, kart anahtarı) | `eedcb43`, `584c72a` | — (yalnız istemci) |
| T2 | `teams.created_by` / `recruitment_posts.created_by` sütun gizliliği (`20261112000300`) | `d4254af` + belge düzeltmesi | ⏸ bekletildi (önce istemci) |
| T3 | Kapak görselleri — sunucu (`20261113000100_covers`) | `79dd2b1` + fix round 1 (`5e33daf`) + fix round 2 (`b0fbba4`) | ⏸ bekletildi — staging'de 22g ve 22k geçmeden kabul edilmez |
| T4 | Kapak görselleri — admin yükleme (iki boyut + blurhash, WebP) + mobilde expo-image ve yedek poster | `4b93de2`, `f6d6e5e`, `cd036d1` | ⏸ istemci, `20261113000100` uygulanana kadar yayınlanmaz |
| T5 | Takım kapağı mobilde kaptan için | — **ATLANDI** (kullanıcı kararı 13 Kas 2026) | — |
| T6 | Zengin takım profili — sunucu (`20261113000200_team_profile`) | `80feaf5` | ⏸ bekletildi (pilot sonrası, `000300` → `20261113000100` → bu dosya) |
| T7 | Zengin takım profili — mobil (kategori ikonu, Rol dağılımı, Projeler, Açık roller + başvuru, proje/ilan editörü, Takım alanı > İlanlar) | `1460cab`, `e3b62f1`, `23fe957` + fix round 1 (`792c93f`, `51b106a`, `063abea`) | ⏸ istemci, `20261113000200` (+ `000300`, `000100`) uygulanana kadar yayınlanmaz |
| T8 | Kaydedilenler — tüm kartlarda kaydet, Profil > Kaydedilenler (misafir kaydet → giriş) | `24bcb9b`, `fe5c747`, `db06590` | ⏸ istemci, T7 ile aynı sıra; migration eklemez |
| T9 | Uygulama içi bildirimler — sunucu (`20261113000400_notifications`) | `29d734b` + takip (`e061b6d`) + belge (`640b360`) | ⏸ bekletildi (pilot sonrası; `000300` → `000100` → `000200` → `20261113000300` → bu dosya) |
| T10 | Uygulama içi bildirimler — mobil (Keşfet zili + okunmamış rozeti, Bildirimler ekranı, Profil girişi) | `ba2ff98`, `6807f63` | ⏸ istemci, `20261113000400_notifications` hedefte uygulanana kadar yayınlanmaz (sıra: `000300` → `000100` → `000200` → `20261113000300` → `000400` → remote regresyon 25–25j → T10) |
| T11 | Ayarlar ve gizlilik — mobil (Hesap, bildirim tercihi, dokunsal geri bildirim, keşfedilebilirlik 18+, CV paylaşımı, rıza merkezi, Yardım/Yasal bağlantıları) | `cde7788`, `2d51302` | ⏸ istemci, `20261113000400_notifications` (`set_notification_preferences`, `notification_preferences`) ve T6–T10 parçaları hedefte uygulanana kadar yayınlanmaz (sıra: `000300` → `000100` → `000200` → `20261113000300` → `000400` → remote regresyon 25–25j → T10 → T11) |
| T12 | Gelişim — mobil (kurs listesi, kurs detayı + ilerleme, ders okuyucu, Keşfet "Gelişim", etkinlikte "Bu etkinliğe hazırlan", Kaydedilenler'den kurs) | `255de5a`, `faced86` | ⏸ istemci, T7/T8 ile aynı sıra (`20261112000300` → `20261113000100` → `20261113000200` → `20261113000300`); migration eklemez |
| T13 | Birleşik arama — mobil (Keşfet alanı → Arama; Etkinlikler / Fırsatlar / Takımlar / Eğitimler grupları, grup başına 5 + "Tümünü gör" tek grup ekranı; Türkçe büyük/küçük harf; grup hatası satır içi) | `e0f0aa0`, `3f2605c` | ⏸ istemci, T7/T8/T12 ile aynı sıra (`20261112000300` → `20261113000100` → `20261113000200` → `20261113000300`); migration eklemez |
| T14 | Kurum profili + içerik bildirme ("Bildir": etkinlik, fırsat, takım, proje, ilan, kurum) — mobil | `864a794`, `46c77b4`, `d2d5b74` | ⏸ istemci, T7/T8/T12/T13 ile aynı sıra (`20261112000300` → `20261113000100` → `20261113000200` → `20261113000300`); migration eklemez. `team_project` raporu `20261113000200`'e bağlı |

**T3 — ne geldi (yalnız yerelde kanıtlı: `npm run db:test`, remote regresyonun yerel kuru koşusu; staging'de koşulmadı):**
- `events`, `opportunities`, `teams`: `cover_path` + `cover_blurhash`; yol sözleşmesi `<tür>/<kurum ya da takım id>/<uuid>.webp` (+ istemci kuralı `-640` küçük kopya). Klasör = satırın kendi sahibi (CHECK).
- Tek yazma yolu `public.set_cover(p_entity, p_entity_id, p_path, p_blurhash)`: kurum owner|admin|editor (etkinlik/fırsat), platform admini; **takım kapağı şimdilik yalnız platform admini** (aşağıda); başka yazma trigger ile 403. `cover_path` kritik alan: yayındaki etkinlik/fırsatta kapak koyma, değiştirme **ve kaldırma** yeniden incelemeye düşürür; takım kapağı audit'e (yalnız id) yazılır.
- `covers` bucket'ı: public URL ile servis, **yalnız `image/webp`**, ≤2 MB. Listeleme/okuma API'de yalnız klasör sahibine; yükleme/silme yalnız klasör sahibine; UPDATE yok; kullanımdaki dosya silinemez ve aynı adla yeniden yüklenemez.
- **Takım kapağı sunucuda kapalı (kullanıcı kararı 13 Kas 2026):** takım fotoğrafları çoğunlukla 18 yaş altını gösterir; hukuki inceleme ve fotoğraf politikası olana kadar takımlar devre posteriyle kalır ve Task 5 atlandı. Takımın etkin kaptanı `set_cover('teams', …)` ve `teams/…` klasörüne yüklemede 403 `team_cover_disabled` alır; yalnız platform admini yazabilir. Kaptan kuralı silinmedi: tek anahtar `app.team_cover_writes_enabled()` (şu an `false`); yeniden açmak = bu fonksiyonu `true` döndüren yeni migration.
- İstemci şartları (T4 admin; T5 mobil yeniden açılırsa): her görsel WebP'ye yeniden kodlanır (EXIF/GPS silinir); `upsert: false`, her görsel yeni uuid; önce iki dosya, sonra `set_cover`; başarılı değiştirme/kaldırmadan sonra eski dosya çifti Storage API ile silinir.
- Kaldırma talebi (moderasyon, veli, kurum): iki adım zorunlu — `set_cover(…, null)` sonra iki dosyanın Storage API ile silinmesi. CDN ve istemci disk önbelleği görseli silindikten sonra bir süre daha gösterebilir.
- Yetim dosyalar: kullanımda olmayan ve 24 saatten eski `covers` nesnelerini Storage API ile (SQL DELETE değil) silen zamanlanmış temizlik **henüz yok** → Faz 6 ops.

**T4 — ne geldi (yerelde kanıtlı; dev yığınında Storage yok):** admin `CoverField` (etkinlik/fırsat formu, yalnız kayıtlı içerikte): dosya (JPEG/PNG/WebP, ≤2 MB) tarayıcıda WebP'ye yeniden kodlanır (1600 + 640 px, EXIF/GPS yüklenmez) + 4×3 blurhash; sıra: iki dosya (`upsert:false`, yeni uuid) → `set_cover` → eski çift silinir; `set_cover` hatasında yeni çift silinir, eski bağ kalır; eski çiftin silinememesi bağı bozmaz, ekranda dürüstçe yazar. Yayındaki içerikte onaydan önce "yeniden onaya gider" uyarısı. Mobil: `coverUrl()` + `CoverImage`/`CoverFill` (expo-image, `memory-disk`, blurhash, 160 ms geçiş — azaltılmış harekette yok, hata → Open Circuit yedek posteri); listelerde 640 px, detayda ve vitrinde tam boy; Keşfet vitrini ve takım kapağında metin için mürekkep perdesi.
**T4 yayın sırası (zorunlu):** istemci OTA (`000300` için) → `db push 20261112000300` → `db push 20261113000100` (+ remote 22g/22k geçmeli) → **kapaklı istemci**. Kapak sütunlarını okuyan kod `20261113000100`'den önce yayınlanırsa tüm liste sorguları "unknown column" ile kırılır. Bu dal pilotun `preview` kanalına asla OTA ile yayınlanmaz (`docs/RELEASE.md`).
**T4 açık:** gerçek Storage ile uçtan uca yükleme yerelde denenmedi (yığında Storage yok; staging'de 22g/22k ile denenecek); `expo-doctor` 20/21 (Expo'nun yeni yama sürümleri: expo, expo-constants, expo-linking, expo-updates — bu görevle ilgisiz).

**Bekletilen (Step 5, kullanıcı onayı gerekir):** staging `db push` + remote regresyon 22–22j — Cezeri pilotu (27–29 Kasım) bitene kadar yok. Yayın sırası: (1) sütun listeli istemci OTA/build → (2) `20261112000300` → (3) `20261113000100` → (4) remote regresyon + kalıntı kontrolü + public URL'nin curl ile kontrolü. `20261112000300`, `20261113000100`'den **önce** uygulanmalı: içindeki toplu `revoke select on public.teams` sütun düzeyi SELECT'leri de kaldırır, sonra uygulanırsa kapak sütunlarının grant'i düşer.

**T6 — ne geldi (yalnız yerelde kanıtlı: `npm run db:test` 202/202, remote regresyonun yerel kuru koşusu 23–23i; staging'de koşulmadı):**
- `teams.category_key` (`robotics|software|entrepreneurship|science|design|social_impact|media|other`, varsayılan `other`); serbest `category` etiket olarak kalır. Geri doldurma: `app.team_category_key_for()` anahtar kelime haritası (TR + EN, İ/ı duyarlı; "FRC takımı"/"Robotik" → `robotics`), eşleşmeyen `other`. `create_team` sona isteğe bağlı `p_category_key` aldı (verilmezse etiketten türetilir; bilinmeyen anahtar 422 `team_category_invalid`); eski çağrılar aynen çalışır. Kaptan/mentor `category_key`'i mevcut `teams_manager_update` yoluyla da değiştirebilir (CHECK sınırlar).
- `public.team_projects` (başlık 3–120, özet ≤600, yıl 2000–2100, yalnız `https://` bağlantı ≤500, `cover_path` CHECK ile şimdilik hep NULL) + RLS: okuma = takım görünürse (aktif → herkes; askıdaki → yalnız etkin üyeler ve platform admini). İstemcinin tabloya INSERT/UPDATE/DELETE grant'i yok. Yazma: `upsert_team_project` / `delete_team_project` — yalnız etkin kaptan/mentor ve platform admini (moderasyon); takım başına en çok 50 proje (429); audit yalnız id.
- `public.team_public_profile(p_team_id)` (anon dahil): `{ member_count, role_counts, leaders, projects_count, events }`. Sayılar yalnız etkin üyelik. **`leaders` yalnız etkin, 18+ (sunucuda `app.age_years`, doğum tarihi yoksa yetişkin sayılmaz) VE `discoverable` (+ onboarded) kaptan/mentor**; yalnız `display_name` + `role`, sıra rol → ad. Kullanıcı id'si, doğum tarihi, e-posta yok. Askıdaki takım: üye/admin dışı herkese 404 `team_not_found`. `events` Faz 3a gelene kadar `[]`.
- `reports.target_type` → `team_project` eklendi.
**T6 yayın sırası:** `20261112000300` → `20261113000100` → `20261113000200` (dosya sırası; `000300`'ün toplu `revoke select on public.teams`'i `category_key` grant'ini de düşürür, bu yüzden bu dosya ondan sonra uygulanmalı). `category_key` okuyan / yeni RPC'leri çağıran istemci (Task 7) yalnız bu dosya hedefte uygulandıktan **sonra** yayınlanır; `TEAM_PUBLIC_COLUMNS` ve `database.generated.ts` Task 7'de güncellenir. Remote regresyon 23–23i push sonrası koşulur.

**T7 yayın şartı (zorunlu):** bu istemci `teams.category_key`'i (`TEAM_PUBLIC_COLUMNS`), `team_public_profile`, `team_projects`, `upsert_team_project` / `delete_team_project` ve `team_recruitment_applications`'ı okur/çağırır; hepsi yalnız `20261113000200` + `20261113000300_recruitment_applicants` sonrasında vardır. **Sıra:** `20261112000300` → `20261113000100` → `20261113000200` → `20261113000300` (başvuranlar) → T7 istemcisi (+ remote regresyon 23–23i ve 24–24c). Önce yayınlanırsa **her takım listesi ve Keşfet önizlemesi** "unknown column category_key" ile kırılır. Bu dal `preview` kanalına OTA ile **asla** yayınlanmaz.
**T7 fix round 1 (`20261113000300_recruitment_applicants`):** `team_recruitment_applications(p_post_id)` — yalnız etkin kaptan/mentor (ve platform admini) başvuranın adını, `is_minor` bayrağını (sunucuda `app.age_years < 18`; doğum tarihi yoksa reşit sayılmaz), notunu görür; kullanıcı id'si/doğum tarihi/e-posta dönmez; başvuran, başvururken yönetici görünürlüğünü bilir (katılma isteğindeki `team_roster` kuralıyla aynı). `recruitment_posts.created_by` artık sunucuda sabit (insert'te çağıranın uid'i, update'te değişmez ve API çağıranı tarafından temizlenemez; yalnız kullanıcı silinince FK `ON DELETE SET NULL` boşaltır — `20261113000300`). Sütun grant'leri değişmedi.
**T8 (Kaydedilenler) yayın şartı:** migration eklemez; ama `fetchSaved` takım başlıklarını `TEAM_PUBLIC_COLUMNS` (`category_key`) ile okur ve Topluluk/Keşfet kartlarına takım yer imi eklenir — T7 ile **aynı sırada** yayınlanır (`20261112000300` → `20261113000100` → `20261113000200` → `20261113000300` → T7 + T8 istemcisi). `bookmarks` tablosu ve RLS'i `20260919000400_ecosystem`'dedir. Bu dal `preview` kanalına OTA ile yayınlanmaz.
**T9 — ne geldi (yalnız yerelde kanıtlı: `npm run db:test` 245, remote regresyonun yerel kuru koşusu 74/74 ve Storage'lı 79/79; staging'de koşulmadı):**
- Durum tetikleyicileri `public.notifications`'a yazar: kayıt onaylandı / bekleme listesinden yükseldi / onaylanmadı / veli onayı süresi doldu, veli reddi, etkinlik iptali, başvuru durumu (kurumun her hamlesi), takıma katılma isteği (etkin kaptan + mentora; isteyenin adı **yok**) ve kararı; bekleme listesinden bir onay adımına (`pending_guardian` / `pending_review`) yükselme (`registration.promoted_pending`) ve velinin onayı geri çekmesi (`guardian.revoked`). Veli onayı ayrı bildirim üretmez: kayıt `confirmed`'a geçince yalnız `registration.confirmed`. Kendi işlemin (kayıt, iptal, geri çekme) ve aynı durumu yeniden yazan güncelleme bildirim üretmez (testli sessiz geçiş listesi: görev raporu).
- Metin tek kaynak `app.notification_copy(kind, içerik başlığı)`; yalnız sabit cümle + içerik başlığı (etkinlik/fırsat başlığı, takım adı) — kişi adı, e-posta, yaş yok. Satır metni oluşurken dondurulur, hedefe FK yok: hedef iptal/yayından kalkınca satır bozulmaz (istemci "artık yayında değil" der).
- 24 saat hatırlatması `app.queue_event_reminders()` (pg_cron `techapp-event-reminders`, 15 dk'da bir): yayındaki etkinlikte `confirmed` kayıt, başlangıç 23–25 saat sonra; kullanıcı + etkinlik başına **bir kez** (benzersiz kısmi indeks; saat değişse, iptal + yeniden kayıt olsa da tekrar yok). `notification_preferences.event_reminders = false` yalnız hatırlatmayı kapatır.
- Tek istemci yazma yolları: `mark_notifications_read(ids | null)` ve `set_notification_preferences(bool)`. `notifications` üzerinde doğrudan update/insert/delete yetkisi kaldırıldı (eski update politikası ham `notification_read_only` hatasını istemciye taşıyordu). Yeni hata kodu `notification_preferences_invalid` (`COPY`'de).
- Saklama: `app.prune_notifications()` (pg_cron `techapp-prune-notifications`, günlük 03:23 UTC) okunmuş ve `app.notification_retention_days()` (90) günden eski satırları siler; okunmamışlar hiç silinmez (kullanıcı kararı 13 Kas 2026: 90 gün).
- **Hukuk (açık):** gizlilik / saklama politikası metni bu süreyi belirtmeli: bildirim oluşturulmasından 90 gün sonra, okunmuşsa silinir; okunmamış bildirim silinmez — hukuki metin burada yazılmaz, politika sahibi ekler.
- Push yok (yalnız uygulama içi satırlar). Takım kaydı türleri (5) Faz 3a T3 ile eklendi (`20261113000700`, hedef türü `team_event_registration`). `database.generated.ts` güncellenmedi (T10 istemcisiyle).
**T9 yayın sırası:** `20261112000300` → `20261113000100` → `20261113000200` → `20261113000300` → `20261113000400_notifications` (+ remote regresyon 25–25k; 25 ve 25j staging'de geçmeli: tetikleyici gerçek sahiple yazıyor ve iki cron işi kurulu). Bildirim ekranı (T10) bu dosya hedefte uygulandıktan sonra yayınlanır. Bu dal `preview` kanalına OTA ile yayınlanmaz.
**T10 notu:** istemci `notifications` satırlarını RLS ile (açık kolonlar), yazmayı yalnız `mark_notifications_read` ile yapar; sunucunun `title`/`body` metnini olduğu gibi gösterir. Rozet sayısı odakta ve uygulama ön plana gelince yenilenir (realtime/polling yok). `event.cancelled` iptal edilmiş etkinliğin sayfasına değil Katılımlarım'a açılır (iptal edilen etkinlik `events_public_read` gereği herkese kapalı). Cihazda denenmedi; web ekran görüntüleriyle doğrulandı. `database.generated.ts`'e yalnız `mark_notifications_read` eklendi (yerel üretici eski dosyanın biçimini bozduğu için el ile; `notification_preferences` T11'de). Bu dal `preview` kanalına OTA ile yayınlanmaz.
**T11 notu:** Profil'de tek "Ayarlar" girişi var; Hesap bölümü (e-posta salt okunur, Çıkış, Hesabı sil — mevcut akış) ve `CvShareCard` Ayarlar'a / Ayarlar > Gizlilik'e taşındı, Profil düzenle'deki "Profilimi keşfe aç" kutusu Gizlilik'e taşındı (aynı `profiles.discoverable` güncellemesi; yaş kuralını sunucu tetikleyicisi `discoverable_requires_adult` uygular, `is_minor` `my_account_state`'ten okunur; reşit olmayana anahtar yerine "18 yaşını doldurduğunda açabilirsin." metni). Keşfedilebilirlik yardım metni gerçek davranışı söyler: açıkken ad, kaptanı/mentoru olunan takım sayfalarında hesapsız herkese görünür (`team_public_profile`, anon grant) ve giriş yapmış kullanıcılar profili + "profilimde göster" deneyimlerini görür. Bildirim ayarları: yalnız etkinlik hatırlatması kapatılabilir (`set_notification_preferences`, `notification_preferences` sorgusu; satır yoksa varsayılan açık); "Okunmuş bildirimler 90 gün sonra silinir." düz olgu satırı. Rıza merkezi yalnız `public.consents` satırlarını gösterir (amaç etiketi, `policy_version`, veren Sen/Velin, tarih, geri çekilme tarihi); genel "geri çek" RPC'si yoktur — eylem mevcut ekranı açar (katılım rızası → "Kaydı iptal et" → `RegistrationStatus`; başvuru rızası → "Başvuruyu geri çek" → Başvurularım). Rıza satırı hangi etkinliğe/başvuruya ait olduğunu göstermez (satırda yalnız `subject_id` var; başlık için ek sorgu yapılmadı). Yardım/Yasal bağlantıları yalnız `WEB_ORIGIN + WEB_PATHS` açar; uygulamada hukuki metin yok. **Web sayfaları (`apps/web/app`):** `/destek`, `/gizlilik`, `/kosullar`, `/hesap-silme` dosyaları **var**; ama `/gizlilik` ve `/kosullar` yalnız "hazırlanıyor" uyarısı + bugünkü işleyişin kısa maddelerini taşır (hukuk onaylı metin yok) → **yayından önce hukuk onaylı metinler gerekli** (açık pilot kapısı maddesi; yer tutucu hukuki sayfa yazılmadı). `database.generated.ts`'e `notification_preferences` tablosu ve `set_notification_preferences` el ile eklendi. Cihazda denenmedi; web ekran görüntüleriyle doğrulandı. Bu dal `preview` kanalına OTA ile yayınlanmaz.
**T12 notu:** migration eklemez; `courses`, `lessons`, `event_courses`, `course_progress` ve `complete_lesson` `20260919000400_ecosystem`'dedir. İlerleme yüzdesi sunucudan gelir (`course_progress.percent`, `complete_lesson`'ın döndürdüğü satır); istemci hesaplamaz. Ders metni düz paragraf (boş satırla ayrılır); markdown/HTML işlenmez, bağlantı açılmaz. Keşfet Discover'ı `TEAM_PUBLIC_COLUMNS` okuduğu için bu istemci T7/T8 ile **aynı sırada** yayınlanır (ship-after listesi aynı). `preview` kanalına OTA yok.
**T13 notu:** migration/RPC eklemez — istemci `ilike` (spec §4 "şimdilik ilike, paralel sorgular"). Kullanıcı metni yalnız tekil `.ilike(kolon, desen)` filtresinin DEĞERİ olur (supabase-js URL-kodlar, PostgREST `ILIKE $1` ile bağlar); `or()`/`filter()` dizesine hiç girmez. `toIlikePattern` `\`→`%`→`_` kaçışlar; PostgREST `*`'ı `%`'ye çevirdiği ve kaçışı olmadığı için `*` tek karakter jokeri `_` olur. Türkçe harf: gömülü DB (`tr_TR.UTF-8`), `pg_c_utf8`, `en_US.UTF-8` İ/I'yı i'ye katlar ama ı'yı katlamaz; `"C"` yalnız ASCII katlar → istemci yazılanı + Türkçe küçük + Türkçe büyük biçimi arar (ASCII farkı olanlar tek istek), ı/I tek karakter jokeri olur; sonuçlar id ile birleşir (`supabase/tests/search.test.ts`, dört collation). Görünürlük liste ekranlarıyla aynı: etkinlik yayında + bitmemiş, fırsat yayında + son tarih geçmemiş, kurs yayında + ders > 0; takım `moderation_status = 'active'` (Topluluk RLS'e bırakıyor; arama açıkça ister). Aranan kolon yalnız başlık/ad (özet, şehir, kategori yok; tam metin arama sonraki iş). Keşfet'in yerinde etkinlik araması ve `fetchEventsPage`'in `or()` ile kurulan `search` filtresi kaldırıldı. Keşfet takım önizlemesi gibi `TEAM_PUBLIC_COLUMNS` (`category_key`, `cover_*`) okuduğu için T7/T8/T12 ile **aynı sırada** yayınlanır. `preview` kanalına OTA yok.
**T14 notu:** migration eklemez — `reports` tablosu, `reports_insert_own` / `reports_select_own` ve açık rapor için kısmi benzersiz indeks (`reports_one_open`) `20260919000400_ecosystem`'dedir; `team_project` hedef türü `20261113000200`'den gelir. İstemci rapor satırını doğrudan yazar (RPC yok); aynı kişinin aynı içeriğe ikinci açık raporu SQLSTATE 23505 verir ve `already_reported` olarak gösterilir. Nedenler sunucunun yedi değeriyle birebir (`inappropriate … other`), ayrıntı ≤1000 (kırpılır, boşsa NULL). Misafir yalnız "giriş yap" istemi görür; PendingIntent **kullanılmaz** — giriş sonrası rapor kendiliğinden gitmez, kişi sayfaya dönüp sheet'i yeniden açar. Takım üyesi kendi takımında/projesinde/ilanında Bildir görmez. Kurum profili (`OrganizationScreen`): logo hattı yok → `mark` ikonu; `organizations` herkese yalnız `verification='verified'` satırı gösterir (üyeler kendininkini), bu yüzden doğrulanmamış kurum profiline yalnız kendi üyesi ulaşır (etkinlik/fırsat satırındaki kurum embed'i doğrulanmamışta boş döner). **Moderasyon konsolu YOK:** `apps/admin`'de rapor kuyruğu/sayfası bulunmuyor; `reports_platform_update` ve `moderation_actions` politikaları var ama onları kullanan arayüz yok. Mevcut sunucu yetenekleri: `delete_team_project` (platform admini), `teams.moderation_status`. **Faz 6 ön koşulu (mağaza incelemesi — kullanıcı içeriği raporlanabiliyor ama raporu okuyup işlem yapan arayüz şart):** admin'de rapor kuyruğu (hedef türüne göre içerik önizleme: `team_project` dahil), `reports.status` güncelleme ve `moderation_actions` kaydı, takım gizleme/proje silme eylemleri; küçük yaşta kişi adı içeren proje/ilan metni için "gizle" eylemi yok, yalnız silme var. Bu görev admin'e dokunmadı.
**T9 bilinen sorunlar (kayıt altında, düzeltilmedi):**
- Takım ilanı başvurusu kabulünde (`public.decide_recruitment_application`, `supabase/migrations/20260919000400_ecosystem.sql:977`, INSERT `:996`) başvuranın bekleyen katılma isteği yoksa üyelik doğrudan `active` olarak INSERT edilir → `team_join.accepted` bildirimi **gitmez** (bekleyen istek varsa `pending → active` olduğu için gider). İlan başvurusu için ayrı bir tür yok.
- Bekleme listesinden yükseltme veli isteği oluşturmaz: `app.promote_waitlist` (`supabase/migrations/20260919000200_events.sql:318-340`) reşit olmayanı `waitlisted → pending_guardian` yapar, ama `guardian_requests` satırı oluşturmaz (veli isteğini yalnız katılımcı `create_guardian_request` ile başlatır). `app.expire_guardian_requests` (aynı dosya :298-316) yalnız mevcut `pending` veli isteklerini süresi dolunca kapatır; istek hiç açılmazsa kayıt `pending_guardian`'da **süresiz** kalır, kontenjanda yer tutar (`promote_waitlist`'teki boş yer sayımı `pending_guardian`'ı dolu sayar) ve arkasındaki bekleme listesi ilerlemez. T9 bunu yalnız `registration.promoted_pending` ile katılımcıya bildirir; davranış bu görevde değiştirilmedi.
**T7 açık:** `apply_to_recruitment` ikinci başvuruda hata değil mevcut satırı döndürür; istemci bunu "GÖNDERİLDİ" olarak gösterir.
**Notlar (karar bekleyen / sonraki görev):** askıya alınmış (`moderation_status = 'suspended'`) takımın kaptanı kapağı hâlâ değiştirebilir (takım herkese gizli); takım kapağı yeniden açılmadan önce hukuki inceleme + fotoğraf politikası gerekir (Task 5 atlandı); `team_projects.cover_path` (T6) bu sözleşmeye henüz bağlı değil — CHECK ile NULL'a sabit; açan migration `team_projects_cover_closed`'ı kaldırmalı ve tabloyu `app.cover_object_in_use`'a eklemeli.

### Faz 3b kapanışı — ölçüm tablosu (13 Kasım 2026)
✅ yalnız test + ekran görüntüsü kanıtı olan yerde; **hiçbir Faz 3b parçası cihazda denenmedi** (web ekran görüntüleri + jest). Sunucu parçalarının hiçbiri staging'de çalıştırılmadı.

| Modül | Kanıt | Durum |
|---|---|---|
| T1 pilot borçları | jest; web ekran görüntüleri (bootstrap hataları, Profil Yaklaşan, kayıt durumu); "GİRİŞ YAPILDI" web'de gösterilemedi (check-in penceresi) | ✅ kod; cihazda denenmedi |
| T2 `created_by` gizliliği | `db:test`, kolon yetkisi testi, remote kuru koşu; web ekran görüntüleri | ✅ yerel; staging bekletiliyor (önce istemci) |
| T3 kapak sunucusu | `db:test`, kuru koşu (Storage'lı 53/53), 22g + 22k MUST PASS | ✅ yerel; staging'de koşulmadı |
| T4 kapak admin + mobil | jest + admin testleri; Storage yerel yığında yok → Playwright ile yakalanmış istek, gerçek Storage'a karşı yükleme denenmedi | 🟡 gerçek Storage ile uçtan uca denenmedi |
| T5 takım kapağı mobil | — | atlandı (kullanıcı kararı) |
| T6–T7 takım profili | `db:test`, kuru koşu 23–23i, 24–24c; jest; 390 ve 320 px web ekran görüntüleri | ✅ yerel; cihazda denenmedi |
| T8 Kaydedilenler | jest (+ mutasyon kontrollü titreme testi); web ekran görüntüleri | ✅ yerel; cihazda denenmedi |
| T9–T10 bildirimler | `db:test`, kuru koşu 25–25k; jest; web ekran görüntüleri | ✅ yerel; push yok; cihazda denenmedi |
| T11 ayarlar/gizlilik/rıza/yardım/yasal | jest; web ekran görüntüleri (raporda "açılmayanlar" listesi var); Velin rızası SQL ile tohumlandı | ✅ kısmi; hukuk metni yok; cihazda denenmedi |
| T12 Gelişim | jest; 390/320 web ekran görüntüleri | ✅ yerel; cihazda denenmedi |
| T13 birleşik arama | jest + `db:test` (`search.test.ts`, dört collation); web ekran görüntüleri | ✅ yerel; staging collation kontrolü açık |
| T14 kurum profili + Bildir | `db:test` (rapor hedefleri), jest; web ekran görüntüleri (uzun ad ve etkinlik/fırsat/takım Bildir ekran görüntüsü yok, jest kapsar) | ✅ yerel; moderasyon konsolu yok |

**Son doğrulama (13 Kasım, bu kapanışta):** `npm --prefix apps/mobile run verify` 92 suite / 937 test yeşil, lint 0, test çıktısında hiç konsol satırı yok; `npm run db:test` 283/283; `apps/admin` tsc temiz.

**Kullanıcı kararları (13 Kasım 2026):** Task 5 takım kapağı atlandı (sunucuda yazma yalnız platform admini); bildirim saklaması oluşturmadan 90 gün, yalnız okunmuş olanlar.
**Önceden var olan hata:** `app.promote_waitlist` → `pending_guardian` veli isteği/son kullanma tarihi olmadan kontenjan tutar (`20260919000200_events.sql:318-340`); pilot dalında kontrol listesi kuralı `9380d5d`; ürün düzeltmesi yok.
**Faz 6 ön koşulları:** `/gizlilik` ve `/kosullar` hukuk metinleri (bugün yer tutucu); admin rapor/moderasyon konsolu; beş bekletilen migration'ın kullanıcı onayıyla staging'e basılması + remote regresyon; expo yama sürümleri (`expo-doctor` 20/21). Bilinen sorunlar: `docs/KNOWN-ISSUES.md` > Faz 3b kapanışı. Yayın sırası: `docs/RELEASE.md` > Faz 3b — bekletilen migration'lar.

## Faz 4 — tasarım sistemi ve beş sekme (12–13 Kasım 2026, dal `feat/v5-product`)
Plan: `docs/superpowers/plans/2026-11-12-techapp-v5-faz4-design-system-and-five-tabs.md`. Önizleme kapısı kullanıcı tarafından onaylandı (12 Kasım, “önerilerle onay”; `docs/design/faz4-preview/REVIEW.md`). Son görüntüler onaylı taslakla yan yana: `docs/design/faz4-final/` (README'de sapmalar). Bu dal pilot dalından ayrıdır; pilot yolu etkilenmedi.

| Görev | Konu | Commit'ler |
|---|---|---|
| T1 | Token borcu, semantik katman, elevation, hardcode koruma testi, ikon anlamları | `92a47a3`, `d37c9cc` |
| T2 | Kart ailesi (CardBase · PosterCard · RowCard · MiniCard · HeroCard), iskeletler | `25fad43`, `c4c5756`, `75ef0d6` |
| T3 | En kötü durum verisi, yalnız yerelde açılan önizleme rotası, `check:no-dev-preview` | `75e9d78`, `d930736`, `dd76a4f` (CI) |
| T4 | Önizleme kapısı (taslak dalı `feat/v5-design-preview` birleşmez) + onay | `13836de`, `3537074` |
| T4b | Onaylı kart kararları (durum altta, tek satır poster başlığı, dar ekranda tek sütun, bölünmeyen adlar) | `b701f60` |
| T5 | Keşfet | `1f3869c`, `2e4f150` |
| T6 | Etkinlikler (filtre sheet'i), detay, kayıt, check-in | `d9d45d1`, `dab1907`, `3485c74`, `1765d7d` |
| T7 | Fırsatlar, detay, başvuru, Son tarihler, Başvurularım | `035d411`, `fe0c304` |
| T8 | Topluluk, takım profili, çalışma alanı | `a59190f`, `418d5a8` |
| T9 | Profil | `157723f`, `575af50` |
| T10 | Onboarding ve giriş | `8eb1e58`, `6a52504` |
| T11 | Kapanış: HIG Doctor, küçük düzeltmeler, son görüntüler, belgeler | `9ca8768` + belge commit'i |

**Ölçüm (T11):** `npm --prefix apps/mobile run verify` → typecheck temiz, lint 0, jest **634 geçti + 2 todo** (68 süit), konsol çıktısı temiz; `noHardcodedStyle` izin listesi boş; `check:no-dev-preview` OK; HIG Doctor `--fail-on serious` çıkış 0, 0 concern ([rapor](docs/audits/2026-11-13-hig-doctor.md)).

**Yapılmayanlar (Faz 3b'ye bağlı satırlar, plan “Self-review”):** Arama ekranı ve arama alanından geçiş, bildirim zili/rozeti, detayda Kaydet ve Kaydedilenler/Bildirimler/Ayarlar girişleri, kurs ekranı (Gelişim bölümü gizli; “Bu etkinliğe hazırlan” yok), kurum profili sayfası, kurum logosu ve kapak görselleri (öncü karo hep ikon), takım profilinde Projeler/Etkinlikler. Rol dağılımı bölümü gizlilik nedeniyle yapılmadı (veri yalnız üyelere açık RPC'de). Açık bilinen sorunlar: `docs/KNOWN-ISSUES.md` “Faz 4 kapanışı”.

**Doğrulandığı yerler:** web (Expo web, Playwright) 390×844 ve 320×640; Android emülatör (API 36.1, 411 dp) yazı ölçeği 1.0 ve 2.0, EAS development derlemesi. **Doğrulanmadı:** iOS (simülatör dahil), gerçek cihaz (Android veya iPhone), TalkBack/VoiceOver sesli tur, QR'ın gerçek cihazda taranması, iOS OTP odak zamanı.

## V5 — 11 Kasım 2026
Dal `feat/v5-pilot-platform` (`feat/techapp-stabilization` @ `a0a97c5`'ten). Commit'ler: `97f9cea`, `b1f0cf3`, `fef8e5a` (Open Circuit v2 ikonları), `1815770` (test portu / expo-doctor / SDK 57 yamaları), `fe5a478` (HIG denetimi), sonra pilot görevleri ve final review düzeltmeleri (`89f0556`…`f0a03fd`). Dal `feat/v5-pilot-platform` fe5a478'e kadar GitHub'a itildi (yedek push, kullanıcı izniyle, Intechne hesabı üzerinden); sonraki commit'ler her görev incelemesinden sonra itilir.
Pilot adayı: Cezeri Robot Ligi, Ümraniye, 27–29 Kasım 2026 — yalnız görevliler, Intechne ekibi ve az sayıda gönüllü test kullanıcısıyla kontrollü pilot; resmî takım kaydı TechApp dışında kalır. Hedef dondurma 21 Kasım; go/no-go 24 Kasım, kararı kullanıcı verir.

### Bugünkü ölçümler (2026-11-11, son güncelleme final-review düzeltmeleri sonrası)
| Kalem | Durum | Kanıt |
|---|---|---|
| Veritabanı + Edge testleri | ✅ | `npm run db:test` **125/125** (11 dosya; 122 + 3 `free-port`). Geçici Postgres tercihen `54339`'da; `54329` (Keşif) hiçbir durumda seçilmez. 17 migration |
| Mobil | ✅ | `npm --prefix apps/mobile run verify` → typecheck temiz, lint **0**, jest **295/295** (38 süit), `--forceExit` olmadan, "worker failed to exit" uyarısı yok |
| Admin / web | ✅ | `npm --prefix apps/admin run typecheck` ve `apps/web` typecheck temiz |
| expo-doctor | ✅ | `npm --prefix apps/mobile run doctor` **21/21** (expo-doctor 1.20.5 sabit) |
| HIG Doctor | ✅ (otomatik) | `npx hig-doctor apps/mobile --fail-on serious` → **0 critical**, 1 moderate (OTP `autoFocus`, bilinçli), kapı geçer. Otomatik denetim HIG uyumunu kanıtlamaz; ilk rapor [docs/audits/2026-11-11-hig-doctor.md](docs/audits/2026-11-11-hig-doctor.md) |
| EAS Android build | 🟡 | Development build `3e02e2cf` (commit `b28ea0a`) derlendi ve **Android 16 emülatöründe çalıştırıldı**: 8 adımlık yolculuk 7/8 PASS (adım 7 FAIL → D1), bulunan D1–D10 kodda düzeltildi; emülatörde yeniden doğrulama bekliyor ([QA](docs/qa/2026-11-pilot-journey-android.md)). Preview/release build yok; gerçek Android cihaz yok |
| EAS preview ortamı | ✅ | `preview` ortamı doğrulandı: `EXPO_PUBLIC_APP_ENV=preview`, staging URL + publishable key, DSN yok; `preview` kanalında OTA update yok |
| EAS iOS build | 🟡 | production `8af1d94c` FINISHED 2026-09-19 (`34dbc05`); development/simulator `cb297b76` 2026-09-19. Cihazda/simülatörde çalıştırılmadı |
| Staging Supabase `pacvhcnawtnkauvguoaw` | 🟡 | Migration geçmişi **17/17** senkron (`20261111000100`, `20261112000100`, `20261112000200` dahil); remote güvenlik regresyonu **38/38 PASS** (20–20f kısa kodla check-in dahil), rollback, kalıntı 0. Gerçek e-postalı uygulama E2E'si (adult + minor/veli) bu dal için henüz koşulmadı |
| Production Supabase | ⛔ | Ayrı proje yok; EAS `production` ortamı hâlâ staging'i gösteriyor, env guard bunu bilerek reddeder |
| Crash reporting | 🟡 | Sentry kodu kurulu (PII temizleme, ortam ayrımı) ama **KAPALI**: DSN yok → `Sentry.init` çağrılmaz. Açık: DSN bağlantısı ve saklama süresi kararı ([CRASH-REPORTING](docs/CRASH-REPORTING.md)) |
| Haptics / Reanimated | ✅ (kod) | `react-native-reanimated` + `react-native-worklets` + `expo-haptics` kurulu (PressableScale, check-in geri bildirimi); dev build'de derlendi. Haptic emülatörde gözlemlenemedi |

**Final review düzeltmeleri (11 Kasım):** C1 süresi dolmuş token ile çevrimdışı soğuk açılışta kayıtlı kartlar açılış ekranında; I1 iptal edilen
kaydın çevrimdışı kartı silinir; I2 "Son güncelleme" tarih + saat; M1 çıkıştan sonra biten kart isteği kaydedilmez; M3 jest çıkış uyarısı;
M4 hatalı OTP'de yeniden gönderme beklemesi; M6 test portu. Ayrıntı ve cihaz yeniden test adımları:
`.superpowers/sdd/2026-11-11-techapp-v5-phase1-2/final-review.md` → "Final fixes". Hepsi yalnız jest/vitest ile kanıtlı; cihazda değil.

### Pilot kapısı (spec §7 — hepsi ✅ olmadan "pilota hazır" denmez)
| # | Kapı | Durum | Neden · sorumlu |
|---|---|---|---|
| 1 | Staging adult + minor/veli E2E, gerçek e-posta teslimiyle, son build üzerinde | 🟡 | 7 Ekim PASS (eski commit); bu dalın build'iyle yeniden koşulmadı · geliştirme |
| 2 | Ayrı production Supabase (migration, OTP şablonu, SMTP, secret'lar) | ⛔ | Proje yok; açılması kullanıcı onayı gerektirir · kullanıcı + geliştirme |
| 3 | Hukuk: aydınlatma + veli onayı + koşullar onaylı ve sürümlü | ⛔ | Metinler yok (`/gizlilik`, `/kosullar` "hazırlanıyor"); gerçek kullanıcıya açılma blokeri · kullanıcı / hukuk |
| 4 | EAS Android + iOS, emülatörde 8 adımlık yolculuk, gerçek iPhone + Android, Huawei check-in | ⛔ | Dev build emülatörde koştu (7/8, D1–D10 sonradan kodda düzeltildi); preview build + emülatör tekrarı, gerçek Android cihaz, iOS ve Huawei yok · geliştirme + kullanıcı |
| 5 | Remote güvenlik regresyonu, yeni tablo RLS, 18 yaş altı görünürlük denetimi | 🟡 | Staging remote regresyon 38/38 PASS; yerel `pilot-privacy`; açık: `teams.created_by` / `recruitment_posts.created_by` anon okunabilir (KNOWN-ISSUES) · geliştirme |
| 6 | Erişilebilirlik turu + HIG Doctor'da serious yok | 🟡 | HIG Doctor 0 critical / 1 moderate; emülatörde yazı ölçeği 2.0 PASS, 320 dp turu yapıldı (D6/D8 bulundu, kodda düzeltildi, yeniden bakılacak); TalkBack sesli turu yapılamadı · geliştirme |
| 7 | Crash reporting açık veya kapalı olduğu yazılı kabul | ⛔ | Sentry kurulu ama kapalı (DSN yok); "kapalı" için yazılı kabul ya da DSN + saklama kararı yok · geliştirme + kullanıcı |
| 8 | Etkinlik günü planı (görevli hesapları, cihaz başına check-in testi, admin web + kısa kod yedeği) | ⛔ | Plan yazılmadı · kullanıcı + geliştirme |

### Ürün gerçeği (kod üzerinde kontrol edildi, cihazda değil)
- **Var:** Fırsatlar (detay, başvuru, başvurularım, son tarihler) ve Topluluk (takım detayı, takım oluşturma, takım çalışma alanı kanban, görev düzenleyici) artık salt okunur değil; profilde deneyim düzenleyici/detay, CV paylaşımı ve gönüllü alanı var. `apps/admin` boş değil (etkinlik, fırsat, doğrulama, onay, check-in sayfaları).
- **Yok:** öğrenme ekranları, Kaydedilenler ekranı (yer imi arayüzü yalnız fırsatlarda), bildirimler (uygulama içi + push), uygulama içi ayarlar/gizlilik/rıza merkezi/yardım/yasal ekranlar, takım etkinlik kaydı (DB `registration_mode='team'` kaydı reddeder), birleşik arama (yalnız etkinlik), etkinlik/fırsat/takım kapak görselleri (kolon yok), Gesture Handler (Reanimated + Haptics + Sentry kodu var; Sentry DSN'siz kapalı). Ödeme / Cüzdan / Fonla / TechRank / AI Koç modülleri taşınmadı (feature flag yok; `env.ts`'te `features` nesnesi yok). Admin'de kapak yükleme, oturum programı düzenleyici, kurum/üye yönetimi, audit ekranı eksik.
- Uygulama ikonu/splash Expo yer tutucusu **değil** ("Açık devre T" amblemi); ikon sistemi Open Circuit v2 (50 SVG + 32 dolu durum).

> **Tarihsel bölümler:** aşağıdaki 7 Ekim ve daha eski bölümler geçmiş kaydıdır; güncel hâli için yukarıdaki V5 bölümüne bakın.

> **7 Ekim 2026 — stabilization sprint (dal `feat/techapp-stabilization`).** Güncel durum bu bölümdedir; aşağıdaki
> eski bölümler tarihsel kayıttır. Kaynak: 7 Ekim denetim raporu.

## Stabilization sprint — 7 Ekim 2026
Verdict: **WORKING DEVELOPMENT BUILD** — remote staging doğrulandı; native build + cihaz kabulü olmadan PILOT READY değil.

Ortamlar: **local** (`npm run db:dev`, `.env.localstack`) · **staging** = Supabase `techapp` / `pacvhcnawtnkauvguoaw` (EAS development + preview,
`.env.remote`) · **production** = henüz ayrı proje yok; `envValidation.js` production'ın staging ref'ini kullanmasını reddeder.

| Kalem | Durum | Kanıt |
|---|---|---|
| Uzak Supabase (staging) | ✅ | ACTIVE_HEALTHY, CLI link'li. Migration geçmişi **14/14** senkron (`20261007000100_stabilization_security`, `20261007000200_advisor_hardening` remote'ta) |
| Supabase advisors | ✅ | İlk taramada 1 ERROR (`my_guardian_requests` SECURITY DEFINER view) — **gerçek P1**: reşit olmayan, view üzerinden kendi veli isteğini `approved` yapıp sayaçlarını sıfırlayabiliyor / silebiliyordu (staging'de rollback'li probe ile kanıtlandı). `…200_advisor_hardening` ile kapatıldı + 13 mutable `search_path`. Kalan: 50 "SECURITY DEFINER RPC çağrılabilir" (tasarım gereği, kural 5), leaked-password (OTP-only, geçersiz), 21 performans WARN (P3) |
| Remote güvenlik regresyonu | ✅ | `supabase/tests/remote/security-regression.sql` — **28/28 PASS**, gerçek API rolleriyle; her koşu tamamen rollback (kalıntı yok, sayılarla doğrulandı) |
| Generated types | ✅ | `database.generated.ts` remote'tan (`supabase gen types --linked`); tek şema farkı view'in artık Insert/Update taşımaması |
| 6 haneli OTP (remote) | ✅ | Resend SMTP, kodlu şablon. Yepyeni hesap (`confirmation` şablonu, 11 sn'de doğrulandı) + iki mevcut hesap (`magic_link` şablonu) + çıkış→tekrar giriş |
| Edge Functions | ✅ | `guardian-dispatch` v5, `delete-account` v4 ACTIVE, `verify_jwt` açık. Hosted runtime: kimliksiz/sahte JWT 401, publishable-only 401 `auth_required`, GET 405. `guardian-dispatch` gerçek JWT ile e-posta gönderdi. `delete-account` yalnız onaylanan test hesabında (onaylanan tek kullanımlık test hesabı) uygulamadan çağrıldı: kullanıcı/profil/kayıt/rıza silindi, `seats_taken` 1→0, audit `deletion_requested→deleted`. Personel/moderatör yolu yalnız yerel testte |
| Veli e-posta secret'ları | ✅ | `RESEND_API_KEY`, `MAIL_FROM`, `GUARDIAN_PAGE_URL` tanımlı (değerler görülmedi); link `techapp.intechne.com.tr/veli` |
| Minor / veli remote E2E | ✅ | kayıt → `pending_guardian` → veli e-postası gerçekten ulaştı → `/veli` onay → `confirmed`; token tek kullanım (hash silindi), self + guardian rızaları sürümlü, audit `created→sent→approved`, `seats_taken` tutarlı, imzalı QR + kısa kod eşleşmesi. Resend cooldown remote DB seviyesinde (UI'dan değil); süre dolumu yalnız yerel testte |
| Adult remote E2E | ✅ | Yepyeni hesap: OTP → ilk profil (26 yaş) → veli isteği yok → çift tıklamada tek kayıt, doğrudan `confirmed` → `seats_taken` +1 → imzalı QR + kısa kod eşleşmesi → yenileme → çıkış (kişisel ekranlar temizlendi) → tekrar giriş → profil + kayıt korundu |
| P0 açılışta beyaz ekran | ✅ | (önceki tur) Jest + web'de backend kapat/aç |
| P1 CV / veli limitleri / onaylı içerik / doğrulama / hesap silme FK | ✅ remote | Yerel testler + remote regresyon 01–18 |
| Production env guard | ✅ | + production staging ref'ini kullanamaz (test + `expo config` simülasyonu). ⚠️ EAS `production` ortamı hâlâ staging URL'ini taşıyor → production build şimdi bilerek başarısız olur; production projesi açılınca güncellenecek |
| EAS env | ✅ dev/preview | development + preview → staging URL + publishable key, LAN/secret yok |
| Native çökme riski (`Notice`) | ✅ | Değişkenli metin `<Text>` dışında kalıyordu (web'de serif, native'de çökme: veli formu, fırsat detayı). Düzeltildi + test |
| Hesap değişiminde önceki kullanıcının ekranları | ✅ | E2E'de bulundu: yeni hesapla girişte Keşfet yığınında önceki kişinin katılım kartı (QR + kısa kod) görünüyordu (sunucu 404 veriyordu; yalnız istemci belleği). Oturumlu kimlik bitince önbellek temizlenir + `NavigationContainer` yeniden kurulur; misafir→giriş akışı korunur. Test + tarayıcıda doğrulandı |
| EAS iOS/Android build | ⛔ | Sıradaki adım |
| Native kabul | ⛔ | Build bekliyor |
| Testler | ✅ | DB+Edge **95/95** · mobil **92/92** + typecheck + lint · admin/web typecheck · remote regresyon **28/28** |

> **30 Eylül 2026 notu:** Bu belgede tarihsel/eski durumlar bulunuyor. Güncel kod denetimi ve yeniden çalıştırılan testler için [hazırlık denetimini](docs/READINESS-2026-09-30.md) esas alın.

# TechApp — Implementation Status

Son güncelleme: 2026-09-19 (3. oturum) · Dal: `feat/release-readiness` · ✅ Completed · 🟡 Partial · ⛔ Blocked · ⚪ Not started

"Doğrulandı" = bu makinede otomatik test ve/veya çalışan uygulamada gözle kontrol edildi. Native cihaz doğrulaması ayrıca belirtilir.

## Fazlar
| Faz | Durum | Not |
|---|---|---|
| 0 · Audit & bootstrap | ✅ | v4 P0/P1 bulguları kod üzerinde yeniden doğrulandı; Expo SDK 57 iskeleti, lockfile, strict TS, ESLint, Jest, env yapısı, expo-doctor 21/21 (7 Ekim: WARNING — 5 paket bir yama geride) |
| 1 · Design system | ✅ | Token, tipografi, 30 ikonluk `TechIcon`, ~40 ortak bileşen, 5 sekmeli kabuk. Web önizlemede gözle kontrol edildi |
| 2 · Auth + onboarding | 🟡 | Misafir onboarding, e-posta OTP, güvenli oturum, profil bootstrap, hesap silme akışı yazıldı ve yerel yığında uçtan uca çalıştı. ⛔ Gerçek Supabase Auth + SMTP ile doğrulanmadı |
| 3 · Discovery | 🟡 | Keşfet gerçek backend'den: ilgi alanına göre etkinlik, arama, fırsat/takım önizleme. Arama yalnız etkinlik; bildirimler yok |
| 4 · Event pilot | 🟡 | Liste (cursor pagination, filtre), detay, sunucu uygunluğu, atomik/idempotent kayıt, bekleme listesi, veli akışı, QR katılım kartı, check-in. Takım kaydı ⚪. Native build ⛔ |
| 5 · Admin pilot | 🟡 | `apps/admin` (Vite + React + TS): OTP ekip girişi (hesap oluşturmaz), rol kapısı, etkinlik listesi/oluştur/düzenle, yayın akışı (taslak→inceleme→Intechne onayı→yayın/iptal/arşiv, DB durum makinesi + audit), kayıt listesi (filtre/arama/değerlendirme, minimum PII), web check-in (kamera/okuyucu/elle; geçerli · tekrar · yanlış etkinlik · geçersiz). Yerel yığında tarayıcıda uçtan uca doğrulandı; 5 DB entegrasyon testi. ⛔ Gerçek Supabase'e karşı denenmedi; kapak görseli, kurum/üye yönetimi, audit ekranı yok |
| 6 · Opportunities | 🟡 | Şema + `submit_application` (snapshot, idempotent, durum geçmişi) testli. Mobilde salt-okunur liste |
| 7 · Community / teams | 🟡 | Şema + join/rol/görev RPC'leri testli. Mobilde salt-okunur liste |
| 8 · Profile / experience | 🟡 | Şema + attestation (ayrı kayıt, revoke) testli. Mobilde temel profil + hesap |
| 9 · Learning | 🟡 | Şema + `complete_lesson` testli, seed'de 3 kurs. Mobil ekran ⚪ |
| 10 · Release hardening | ⚪ | Analytics soyutlaması var; crash reporting, push, offline cache, mağaza varlıkları yok |

## 3. oturum — yayına hazırlık (2026-09-19)
"Doğrulandı" aynı anlamda: otomatik test ve/veya çalışan uygulamada gözle kontrol. Hepsi **yerel yığında**; remote'a henüz uygulanmadı (aşağıya bak).

| Alan | Durum | Ne yapıldı · kanıt |
|---|---|---|
| Admin paneli (masaüstü) | ✅ | Eksik 5 sayfa yazıldı: Fırsatlar listesi/formu/detayı (başvuru incelemesi, dondurulmuş paylaşım verisi, durum geçişleri), Doğrulama talepleri (talep edenin adı, kapsam/dayanak/geçerlilik, iptal, kanıt dosyası imzalı bağlantıyla), Intechne yayın onayı kuyruğu. 1024 px altı yalnız giriş kontrolü. `tsc` + `vite build` temiz; tarayıcıda gerçek seed verisiyle gezildi, konsol hatasız |
| Gönüllü etkinlik alanı | ✅ | Mobil: etkinlik sayfasında "Gönüllü ol" (misafir → giriş → form geri açılır), başvuru/çekilme, onaylı gönüllüye `VolunteerHub` (görev, program, gönüllü duyuruları, takım adları, sayılar). Katılımcı kimliği yok: DB testiyle kanıtlı |
| Doğrulanmış dijital CV | ✅ | `app.cv_document` tek kaynak; `my_cv()` (özel) + `public_cv(token)` (herkese açık, anon). Uygulamada paylaşım kartı (aç/kapat, her açılışta yeni bağlantı), web'de `/cv/<token>` sayfası (noindex, no-referrer, önbelleksiz, yazdırılabilir). Taslak/gizli kayıt, kimlik, karar notu ve geçersiz doğrulama sızmıyor; iptal anında yansıyor: DB testi. Yalnız 18+ (hukuk kararı bekliyor) |
| Takım yönetimi | ✅ | Kanban (3 sütun), görev atama, son tarih, **öncelik**, "Bana atananlar" filtresi, ilerleme özeti, roller, katılma istekleri ve **unvan atama** (`set_team_member_title`; unvan yetki vermez, CV'de görünür). DB + jest testli |
| Responsive | 🟡 | Web kökündeki 430 px sabitleme kaldırıldı (pencere genişliğiyle çelişip içeriği ~250 px'e sıkıştırıyordu). Yeni `xlarge` sınıfı (≥1600: TV / geniş masaüstü, 4 sütun, 1480 px sınır). 900 px'te yan gezinme + tam genişlik gözle doğrulandı. ⛔ ≥1200 ve gerçek TV/tablet cihazında bakılamadı (bu makinede pencere 900 css px'i geçmiyor; native build yok) |
| Amblem / uygulama ikonu | ✅ | Expo'nun varsayılan ikonu değiştirildi. "Açık devre T." amblemi: `design-source/brand/build.mjs` tek geometriden iOS, Android adaptive (ön/arka/monokrom), splash, favicon, web `icon.svg`/`apple-icon.png`, admin favicon ve 1024/512 mağaza ikonlarını üretir. iOS maskesi, Android dairesi, temalı ikon ve 16 px'te gözle kontrol edildi |
| Lint borcu | ✅ | Üç form ekranındaki `set-state-in-effect` hataları "yükle → formu mount et" kalıbıyla giderildi |

Test toplamı: DB **52/52**, mobil jest **41/41**, mobil typecheck + lint temiz, admin build temiz, web typecheck temiz.

### Bu oturumdan sonra yayın için kalan adımlar
1. `supabase/migrations/20260920000100_*`, `20260920000200_*` ve `20260920000300_*` **remote'a uygulanmadı**. `npm run db:push` (dry-run planını oku) → `npm run db:types` → `npm --prefix apps/mobile run e2e:remote`. Uygulanana kadar canlıda CV paylaşımı, unvan ve gönüllü alanı çalışmaz (mobil şema eski sunucuyu da okur).
2. Vercel: `apps/web` yeniden deploy (yeni `/cv/[token]` rotası), `apps/admin` ayrı proje olarak deploy (`VITE_SUPABASE_*`).
3. Native build hâlâ ⛔ (EAS Build ya da ≥15 GB disk). Yeni ikonlar `expo prebuild` ile alınır; cihazda bakılmadı.
4. Hukuk: reşit olmayanların CV bağlantısı paylaşımı ve gönüllülüğü (ikisi de şimdilik 18+).
5. Bilinen küçükler: web'de `/profile` derin bağlantısı oturum açılışından sonra Keşfet'e düşüyor; admin paket boyutu uyarısı (>500 kB, kod bölme yapılmadı).

## Güvenlik denetimi (2026-09-19, 3. oturum)
İki bağımsız denetim yapıldı (yalnız yerel yığın; remote'a dokunulmadı).

**Backend (RLS/RPC) — temiz.** 4 saldırgan profiliyle (anon, normal kullanıcı, düşük rollü kurum üyesi, takım dışı) 28/28 aktif istismar denemesi engellendi. Statik denetim: her tabloda RLS açık; SECURITY DEFINER fonksiyonlarında `search_path=''`; anon-çalıştırılabilir yalnız 5 fonksiyon (hepsi kendini savunuyor); yetki taşıyan kolonlar (birth_date, discoverable, org verification/is_demo, event status/seats_taken, team member_count, attestation status) trigger korumalı. Check-in token'ları HMAC-SHA256 + sabit-zaman; veli token'ları sha256 hash, tek kullanımlık.

**Mobil istemci + web yüzeyi — kritik/yüksek yok.** Sır sızıntısı yok (yalnız publishable key; eslint `service_role`'ü yasaklıyor). Oturum `expo-secure-store`'da (Keychain/Keystore), token log/analytics'e yazılmıyor. Yetki daima sunucudan (`my_account_state`). Deep link yalnız salt-okunur ekranlara; yan etki tetiklemiyor. Analytics yalnız id+enum. QR opak imzalı token. WebView yok; `eval`/`Function` yok. Web CV: token URL fragment/path'te, `no-referrer` + `noindex`, serbest metin React ile escape'li, JSON-LD `<` kaçışlı.

**Bulgular kapatıldı (hepsi düşük/bilgi):**
- Mobil `Linking.openURL` çağrıları artık `openExternalUrl` ile https doğruluyor (`lib/links.ts` + test).
- Auth callback yalnız bu cihazın başlattığı girişte token kabul ediyor (magic-link login-CSRF kapatıldı).
- Web CV'de `new URL(link_url)` → `safeHost()` (bozuk değer 500 vermiyor).
- `organizations.verified_by/verified_at` artık anon'a kapalı (kolon-düzeyi grant).

## İlk milestone kabul kriterleri (§47)
| | Kriter | Durum | Kanıt |
|---|---|---|---|
| A | Yeni kullanıcı uygulamayı açar | 🟡 | Expo web'de doğrulandı; native build bekliyor |
| B | İlgi alanı seçer | ✅ | Canlı test |
| C | Keşfet'te gerçek backend etkinlikleri | ✅ | PostgREST üzerinden seed verisi; mock yok |
| D | Etkinlik detayı | ✅ | Canlı test + deep link `/events/:id` |
| E | "Katıl" | ✅ | Canlı test |
| F | Gerekirse OTP | 🟡 | Yerel GoTrue-uyumlu gateway ile doğrulandı (yanlış kod reddi dahil); gerçek Supabase Auth ⛔ |
| G | Uygunluk sunucuda | ✅ | `event_eligibility` + `register_for_event` testleri |
| H | 18 yaş altı → guardian durumu | ✅ | DB testleri + canlı test (16 yaş → `pending_guardian`) |
| I | Atomik registration | ✅ | Event satırı kilidi; DB testi |
| J | Mükerrer kayıt yok | ✅ | Partial unique index + idempotency; paralel çift istek testi + canlı çift tıklama |
| K | Kapasite sunucuda korunur | ✅ | 3 yer / 12 eşzamanlı kayıt → 3 confirmed, 9 waitlisted |
| L | Başka cihazda aynı durum | ✅ | Durum yalnız sunucuda; sayfa yenileme/yeni oturumla doğrulandı |
| M | Gerçek katılım kartı | ✅ | HMAC imzalı opak QR, PII yok; iptalde geçersiz |
| N | Yetkili organizer check-in | ✅ | HTTP: 200 `checked_in`, tekrar → `already_checked_in` |
| O | Yetkisiz check-in yapamaz | ✅ | HTTP 403 (yabancı, katılımcının kendisi, başka kurum) |
| P | Kritik RLS testleri | ✅ | 47/47 DB testi (RLS denetim + admin paketi dahil) |
| Q | iOS + Android dev build açılır | ⛔ | Denenmedi: diskte ~4 GB boş (Pods + Gradle build sığmıyor). Statik olarak hazırlandı, gerçek cihaz doğrulaması bekliyor |
| R | Huawei/GMS durumu belgeli | 🟡 | `docs/HUAWEI.md`; HMS cihaz testi ve push sağlayıcısı yok |

**Sonuç: Event Pilot "tamamlandı" DEĞİL.** Q, F'nin gerçek servis ayağı ve R açık.

## v4 bulgularının durumu
| Bulgu | Durum |
|---|---|
| Auth `loggedIn: true` | ✅ Kaldırıldı; gerçek OTP oturumu |
| Guardian "Devam Et (Demo)" | ✅ Yok; onay yalnız sunucu token'ıyla, ayrı web sayfasında |
| Varsayılan kaptan / client yetkisi | ✅ Roller yalnız sunucuda; RPC'ler testli |
| `BILLING_MODE='demo'` | ✅ Taşınmadı; `env.features` ile kapalı |
| Settings reset stale state | ✅ Fonksiyonel update + `clearLocalData`; testli |
| AsyncStorage parse/IO | ✅ Zod şema + sürüm + fallback; testli |
| SecureStore kullanılmıyor | ✅ Supabase oturum deposu (parçalı); testli |
| Matching NaN / sabit 0.8 | ✅ Taşınmadı (TechRank fazı); kural CLAUDE.md'de |
| Takvim dışı / gelecek doğum tarihi | ✅ İstemci + sunucu; testli |
| Client `verified=true` | ✅ Yok; attestation ayrı tablo |
| EAS `REPLACE_*` | ✅ Placeholder yok; gerekenler `docs/RELEASE.md` |

## Remote Supabase (development) — proje `techapp` · ref `pacvhcnawtnkauvguoaw` · eu-central-1 — ⛔ TARİHSEL (19 Eylül)
> 7 Ekim 2026: bu projeye erişilemiyor (NXDOMAIN). Aşağıdaki ✅'ler o tarihteki ölçümdür, bugünkü durum değildir.
| Kriter | Durum | Kanıt |
|---|---|---|
| Remote linked | ✅ | `supabase link`; proje boştu (tablo yok, migration geçmişi yok) — push öncesi doğrulandı |
| Migrations applied | ✅ | 7 migration (`0100`–`0700`), dry-run planı kontrol edilerek. `0500 storage` ilk kez gerçek Supabase'de çalıştı. `db reset` hiç kullanılmadı |
| Seed | ✅ | Yalnız `is_demo = true` örnek veri: 12 etkinlik · 8 fırsat · 6 takım · 3 eğitim (idempotent) |
| RLS | ✅ | Canlı API'de anonim anahtar 7 hassas tablodan 0 satır; e2e'de kullanıcılar arası okuma/yazma engeli, özel profil izolasyonu |
| Generated types | ✅ | `npm run db:types` remote şemadan; yerel üretimle yalnız kozmetik fark. typecheck temiz |
| Edge Functions | ✅ | `guardian-dispatch`, `delete-account` ACTIVE, `verify_jwt = true`; ikisi de gerçek kullanıcı JWT'siyle çağrıldı |
| Auth config | ✅ | OTP 6 hane / 10 dk, yönlendirme listesi, özel SMTP (Resend · `no-reply@auth.intechne.com.tr`, Dashboard'da), kodlu Türkçe e-posta şablonu `config push` ile yüklendi |
| Gerçek OTP doğrulaması | ✅ / 🟡 | Supabase Auth `verifyOtp` ile gerçek oturum (kod admin API'den alındı); yanlış kod reddi, oturum geri yükleme + yenileme. 🟡 E-postanın kutuya düşmesi, süre dolumu ve hız limiti elle denenmedi |
| Event registration E2E (remote) | ✅ | `npm --prefix apps/mobile run e2e:remote` → **26/26**: misafir keşif, sunucu uygunluğu, son yer için paralel 2 kayıt → 1 confirmed + 1 waitlisted, tekrar kayıt tek satır, `pending_guardian` kalıcı, veli onayı (tek kullanımlık token) → confirmed, imzalı QR, yetkisiz check-in 403, yanlış etkinlik, çift okutma tek kayıt, iptal, hesap silme. Test verisi kendini temizler |
| Zamanlanmış iş | ✅ | `pg_cron`: veli isteklerinin süre dolumu 10 dk'da bir |
| Veli e-postası teslimi | ⛔ | `RESEND_API_KEY`, `GUARDIAN_PAGE_URL`, `MAIL_FROM` secrets yok → function 502 `mail_delivery_failed` (beklenen). Veli sayfası henüz bir alan adında yayınlanmadı |
| Mobil/admin uygulamanın remote'a karşı arayüz testi | 🟡 | `npm run env:remote` ile uygulamalar remote'a bağlanır; arayüzden giriş gerçek e-posta kutusu gerektirir — kullanıcı adımı |
| Publishable key standardı | ✅ | İstemciler yalnız `sb_publishable_…` kullanır; secret key hiçbir dosyaya yazılmadı |

## Blocker'lar (dış girdi gerekir)
1. Supabase projesi (URL + anon key; `supabase db push` yetkisi) ve SMTP/Resend anahtarı.
2. Disk alanı (native build için ≥15 GB) veya EAS Build hesabı.
3. Apple / Google Play / Huawei geliştirici hesapları, EAS projectId.
4. HMS'li (GMS'siz) Huawei test cihazı.
5. Hukuk: asgari yaş, veli onay metni ve doğrulama yöntemi, saklama süreleri.

## Build durumu (2. oturum)
- `expo prebuild --platform all` başarılı: iOS ve Android native projeleri config plugin'lerle üretildi (sonra silindi; repo CNG kullanır). Android Gradle dosyalarında GMS/Firebase bağımlılığı yok. Gereksiz depolama/mikrofon izinleri `blockedPermissions` ile kapatıldı.
- ⛔ Derleme/çalıştırma yapılmadı: diskte ~3 GB boş. Seçenekler: (a) ≥15 GB yer açıp `npm --prefix apps/mobile run ios|android`, (b) `npx eas-cli login && npx eas-cli init && npx eas-cli build --profile development --platform android` (Expo hesabı gerekir; iOS cihaz build'i için Apple Developer hesabı).
- ⚪ Erişilebilirlik turu (VoiceOver/TalkBack, font ölçeği, 320 px) dev build'e bağlı; yapılmadı.
