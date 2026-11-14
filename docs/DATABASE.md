# Veritabanı

Tek doğruluk kaynağı: `supabase/migrations/*.sql`. RLS sonradan eklenmez; her tablo oluşturulduğu dosyada kilitlenir.

| Dosya | İçerik |
|---|---|
| `…000100_foundation.sql` | Uzantılar, `app` şeması, profiller, ilgi alanları, kurumlar, audit, profil bootstrap |
| `…000200_events.sql` | Etkinlik, kayıt, check-in, veli onayı, rıza, katılım kartı |
| `…000300_reference_data.sql` | 8 ilgi alanı |
| `…000400_ecosystem.sql` | Takım, fırsat/başvuru, deneyim/doğrulama, öğrenme, yer imi, bildirim, cihaz, şikâyet/moderasyon |
| `…000500_storage.sql` | Özel `evidence` ve `avatars` bucket'ları (`storage` şeması yoksa no-op) |
| `20261112000300_hide_creator_columns` | `teams` ve `recruitment_posts` için sütun düzeyi SELECT (`created_by` dışarıda) — **staging'e bekletiliyor** |
| `20261113000100_covers` | `cover_path`/`cover_blurhash`, `covers` bucket'ı, `set_cover`, `app.*` kapak yardımcıları — bekletiliyor |
| `20261113000200_team_profile` | `teams.category_key`, `team_projects`, `team_public_profile`, `upsert_team_project`/`delete_team_project`, 5 argümanlı `create_team`, `reports` hedefi `team_project` — bekletiliyor |
| `20261113000300_recruitment_applicants` | `team_recruitment_applications` RPC'si, `recruitment_posts.created_by` tetikleyicisi — bekletiliyor |
| `20261113000400_notifications` | Bildirim tetikleyicileri, `notification_preferences`, `mark_notifications_read`, `set_notification_preferences`, iki pg_cron işi — bekletiliyor |
| `20261113000500_team_registration` | Takım etkinlik kaydı şeması: `team_event_registrations`, `team_event_registration_members`, `events.team_*`, `event_registrations.team_registration_id`, RLS, sayaç koruması — bekletiliyor |
| `20261113000600_team_registration_rpc` | `submit_team_registration`, `app.promote_team_waitlist`, `event_eligibility` ek alanları — bekletiliyor |
| `20261113000700_team_registration_lifecycle` | Üye yanıtı, kadro düzenleme, iptal, süre dolumu + cron, detay/davet RPC'leri, tetikleyiciler, 5 bildirim türü — bekletiliyor |
| `20261113000800_team_registration_admin` | `admin_event_team_registrations`, `review_team_registration`, ends_at'te inceleme kapanışı, onaylı katılımcı filtreleri — bekletiliyor |

Arada kalan migration'lar (`20260919…`–`20261112000200`, ör. `…hide_org_verifier`, `…stabilization_security`, `…checkin_short_code`) `supabase/migrations/` dizinindedir; yukarıdaki tablo yalnız tabloda ayrıca anlatılan dosyaları listeler. Faz 3b dosyalarının hedefte uygulanma sırası ve zorunlu remote kontroller: `docs/RELEASE.md` > "Faz 3b — bekletilen migration'lar".

## Tablo grupları

- **Kimlik:** `profiles` (herkese açık olabilecek alanlar), `profile_private` (doğum tarihi, yasal ad, telefon — yalnız sahibi), `interests`, `profile_interests`, `platform_admins`
- **Kiracı sınırı:** `organizations`, `organization_members` (`owner`, `admin`, `editor`, `checkin_staff`, `reviewer`)
- **Etkinlik:** `events`, `event_sessions`, `event_registrations`, `event_check_ins`, `event_courses`
- **Onay:** `guardian_requests`, `consents`
- **Takım etkinlik kaydı (Faz 3a):** `team_event_registrations` (kayıt birimi: `status`, `status_reason`, `roster_version`, `hold_expires_at`, `submitted_by`, `idempotency_key`; takım başına etkinlikte tek canlı kayıt), `team_event_registration_members` (kadro anlık görüntüsü: `role_at_submit`, `roster_version`, `state`, üyenin kendi `registration_id`'si; ad/e-posta/doğum tarihi/veli bilgisi tutmaz). `events`: `team_capacity`, `teams_taken`, `team_waitlist_count` (sunucu sayaçları), `team_min_size` (varsayılan 1, 1–100), `team_max_size` (boş = sınırsız, 1–100). `event_registrations.team_registration_id`: üyenin kendi kaydı, takım kaydına bağlı; üye kaydı hiç `waitlisted` olmaz, bireysel kontenjana/bekleme listesine sayılmaz.
- **Takım:** `teams` (`team` | `community`; `category_key`, `cover_path`/`cover_blurhash` ile), `team_memberships`, `team_tasks`, `team_projects`, `recruitment_posts`, `recruitment_applications`
- **Fırsat:** `opportunities`, `applications`, `application_status_history`
- **Deneyim:** `experiences`, `experience_evidence`, `attestations`
- **Öğrenme:** `courses`, `lessons`, `course_progress`
- **Diğer:** `bookmarks`, `notifications`, `notification_preferences`, `devices`, `reports`, `moderation_actions`, `audit_events`
- **Özel:** `app.secrets` (API'ye kapalı)

`profile_private` ve `event_check_ins` kullanıcı listesindeki tablolara ek olarak bilinçli eklendi: sütun bazlı gizlilik RLS ile sağlıklı yapılamıyor; check-in ise oturum kapsamı taşıyor. `event_courses` "Bu etkinliğe hazırlan" ilişkisini taşır.

## Enum'lar

`education_stage`, `org_type`, `org_member_role`, `verification_status`, `publish_status` (`draft`→`in_review`→`published`…), `event_type`, `event_format`, `registration_mode`, `registration_status` (`pending_guardian`, `pending_review`, `confirmed`, `waitlisted`, `cancelled`, `rejected`, `expired`), `guardian_status`, `team_kind`, `team_role`, `membership_status`, `task_status`, `recruitment_application_status`, `opportunity_type`, `application_status`, `experience_kind`, `attestation_status`, `push_provider`.

Takım kaydı enum'ları: `team_registration_status` (`pending_members`, `pending_review`, `confirmed`, `waitlisted`, `cancelled`, `rejected`, `expired`), `team_registration_member_state` (`invited`, `accepted`, `declined`, `removed`).

## Kritik kısıtlar

| Kısıt | Amaç |
|---|---|
| `event_registrations_one_active` — `(event_id, user_id)` üzerinde, canlı durumlar için kısmi benzersiz indeks | Kişi başına etkinlikte tek canlı kayıt; iptal/ret geçmiş olarak kalır |
| `unique (user_id, idempotency_key)` | Aynı isteğin tekrarı ikinci kayıt açmaz |
| `event_check_ins_once` — `(registration_id, coalesce(session_id, sıfır-uuid))` | Aynı QR ile ikinci giriş kaydı oluşmaz |
| `guardian_requests_one_pending` — `(subject_type, subject_id)` kısmi | Konu başına tek bekleyen veli isteği |
| `guardian_requests_token_idx` / `_revoke_idx` | Token özetleri benzersiz |
| `register_for_event` içinde `select … for update` (etkinlik satırı) | Kapasite yarışı serileştirilir |

**Sayaç tetikleyicisi.** `event_registrations` üzerindeki `event_registrations_recount`, her ekleme/durum değişimi/silmede `events.seats_taken` ve `waitlist_count` alanlarını yeniden sayar. Yer tutan durumlar: `confirmed`, `pending_guardian`, `pending_review`. İstemciler bu sütunları yazamaz (`app.protect_event_columns`).

Diğer koruyucu tetikleyiciler: doğum tarihi bir kez yazılır (`app.protect_birth_date`); reşit olmayan `discoverable` olamaz; kurum kendi kendini doğrulayamaz; yayınlama (`published`) yalnız platform yöneticisiyle; gönderilmiş başvurunun `snapshot`'ı değiştirilemez.

## RPC kataloğu

| RPC | Kim çağırabilir |
|---|---|
| `event_eligibility` | `anon`, `authenticated` |
| `guardian_request_preview`, `guardian_decide`, `guardian_revoke` | `anon`, `authenticated` (yetki token'ın kendisidir) |
| `issue_guardian_token` | **yalnız `service_role`** |
| `my_account_state`, `complete_profile_bootstrap` | `authenticated` |
| `submit_team_registration(event, team, member_ids, idempotency_key)` | `authenticated`; çağıran takımın etkin kaptanı **veya** mentoru (403 `not_team_manager`) |
| `respond_team_registration(member_id, accept, idempotency_key)` | `authenticated`; yalnız davet edilen kişinin kendisi (403 `not_invite_owner`); kabul için doğum tarihi gerekli (409 `profile_incomplete`) |
| `update_team_roster(team_registration, member_ids, expected_roster_version)`, `cancel_team_registration` | `authenticated`; etkin kaptan/mentor; eski sürüm 409 `roster_changed`; kapanıştan sonra 409 `team_registration_closed` |
| `team_registration_detail`, `my_team_registration_invites` | `authenticated`; takımın etkin üyeleri (+ platform admini) / kişinin kendi açık davetleri. Reddeden/ayrılan adları ve `user_id` yalnız kaptan/mentor/platform admine |
| `admin_event_team_registrations(event)`, `review_team_registration(id, approve)` | `authenticated` + etkinlik kurumunda `owner`/`admin`/`reviewer` (+ platform admini); `checkin_staff` ve kurum dışı 403 |
| `register_for_event`, `cancel_event_registration`, `get_participation_card`, `create_guardian_request` | `authenticated` (yalnız kendi kaydı) |
| `check_in_participant` | `authenticated` + o etkinliğin kurumunda `owner`/`admin`/`checkin_staff` |
| `review_event_registration` | `authenticated` + `owner`/`admin`/`reviewer` |
| `create_team` (5 argümanlı: `p_name, p_kind, p_category, p_tagline, p_category_key`), `request_team_join`, `withdraw_team_join`, `leave_team`, `team_roster` | `authenticated` (`create_team`: kişi başına en çok 5 takım, 429 `team_create_limit`; `p_category_key` verilmezse etiketten türetilir, bilinmeyen anahtar 422 `team_category_invalid`) |
| `decide_team_join`, `set_team_task_status` | o takımın kaptanı/mentoru (görev sahibi kendi görevini ilerletebilir) |
| `set_team_member_role`, `remove_team_member` | yalnız o takımın kaptanı; kimse kendi rolünü değiştiremez; son kaptan korunur |
| `apply_to_recruitment`, `decide_recruitment_application` | üye / takım yöneticisi |
| `team_recruitment_applications(p_post_id)` | yalnız etkin kaptan/mentor ve platform admini (başkası, bilinmeyen ilan dahil, aynı 403); yalnız `submitted` başvurular; ad + `is_minor` + not döner, kullanıcı id'si/doğum tarihi/e-posta dönmez |
| `upsert_team_project`, `delete_team_project` | etkin kaptan/mentor ve platform admini; takım başına en çok 50 proje (429 `team_project_limit`); `anon` çağıramaz |
| `team_public_profile(p_team_id)` | `anon`, `authenticated`; sayılar + rol dağılımı + yalnız 18+ **ve** `discoverable` kaptan/mentor adı; askıdaki takım üye/admin dışına 404 |
| `set_cover(p_entity, p_entity_id, p_path, p_blurhash)` | `authenticated` (anon yok): etkinlik/fırsat için kurum owner/admin/editor, takım için **şimdilik yalnız platform admini** (403 `team_cover_disabled`); kapak yazımının tek yolu |
| `mark_notifications_read(p_ids)`, `set_notification_preferences(p_event_reminders)` | `authenticated` (yalnız kendi satırları; `anon` çağıramaz) |
| `application_share_preview`, `submit_application`, `withdraw_application` | `authenticated` (kendi başvurusu) |
| `set_application_status` | fırsatın kurumundaki inceleme rolleri; geçişler doğrulanır, geçmişe yazılır |
| `request_attestation` / `decide_attestation` / `revoke_attestation` | deneyim sahibi / doğrulayan kurumun yetkilisi (kendi deneyimini doğrulayamaz) |
| `complete_lesson` | `authenticated`; ilerlemeyi sunucu hesaplar |
| `register_device`, `unregister_device` | `authenticated` |

Tüm RPC'ler `SECURITY DEFINER` + `set search_path = ''`. Her migration sonunda `execute` yetkileri açıkça geri alınıp yeniden verilir.

## RLS özeti

- **Yayınlanmış içerik** (`events`, `event_sessions`, `opportunities`, `courses`, doğrulanmış `organizations`, etkin `teams`): `anon` dahil okunur. Taslaklar yalnız ilgili kurum üyelerine ve platform yöneticisine.
- **Kişiye ait** (`profile_private`, `consents`, `bookmarks`, `applications`, `course_progress`, `notifications`, `notification_preferences`, `devices`, deneyim taslakları): yalnız sahibi. `notifications` ve `notification_preferences` için istemcide yalnız SELECT grant'i vardır (INSERT/UPDATE/DELETE kaldırıldı); yazma `mark_notifications_read` / `set_notification_preferences` ile.
- **`teams`, `recruitment_posts` sütun düzeyi SELECT (`20261112000300`):** tablo düzeyi SELECT geri alındı; `created_by` hiçbir istemciye açık değil. Sonradan eklenen her sütun açıkça grant edilmelidir (`pilot-privacy.test.ts` bunu denetler): `teams.category_key`, `cover_path`, `cover_blurhash` bu yolla grant edilir. `select('*')` bu tablolarda "permission denied" verir; istemci `TEAM_PUBLIC_COLUMNS` / `RECRUITMENT_POST_COLUMNS` kullanır. `recruitment_posts.created_by` API çağıranı için sunucuda sabittir (insert'te çağıranın uid'i, update'te değişmez, API'den temizlenemez; yalnız kullanıcı silinince FK `ON DELETE SET NULL` boşaltır).
- **`team_projects`:** okuma = takım görünürse (aktif takım → herkes; askıdaki → yalnız etkin üyeler ve platform admini); istemcinin tabloya yazma grant'i yok (`cover_path` CHECK ile şimdilik hep NULL).
- **`covers` bucket'ı:** public URL ile servis, yalnız `image/webp`, ≤2 MB. `storage.objects` politikaları: listeleme/SELECT ve yükleme yalnız klasör sahibine (`app.can_write_cover_object` / `app.can_insert_cover_object`), silme klasör sahibine ve yalnız kullanımda olmayan dosyaya; UPDATE politikası yok; bir satırın kullandığı ad yeniden yüklenemez. Yol sözleşmesi `<events|opportunities|teams>/<kurum ya da takım id>/<uuid>.webp` (+ `-640` küçük kopya), klasör = satırın kendi sahibi (CHECK). Takım kapağı yazımı `app.team_cover_writes_enabled()` ile kapalıdır (kullanıcı kararı 13 Kasım 2026).
- **`reports`:** `target_type` değerleri `event, opportunity, team, organization, profile, experience, recruitment_post, course, team_project`; kişi kendi raporunu okur, aynı içeriğe ikinci açık rapor reddedilir. Raporları okuyan/işleyen bir yönetici arayüzü henüz yok (Faz 6 ön koşulu).
- **`event_registrations`, `event_check_ins`:** sahibi okur; etkinliğin kurumundaki yetkili roller okur; **istemciden INSERT/UPDATE/DELETE yoktur**.
- **Takım kaydı tabloları:** istemcide yalnız SELECT (yazma grant'i ve politikası yok; `anon` hiç). Takımın etkin üyeleri, etkinlik kurumunun `owner`/`admin`/`reviewer`/`checkin_staff`'ı ve platform admini okur; kişi kendi kadro satırını her durumda görür, takım arkadaşları yalnız canlı kadroyu (`invited`/`accepted`). Yazma yalnız `SECURITY DEFINER` RPC'ler ve tetikleyicilerle. Sayaçlar (`seats_taken`, `waitlist_count`, `teams_taken`, `team_waitlist_count`) API çağıranı için kilitli (403 `event_counters_locked`; eklemede 0'a zorlanır).
- **`guardian_requests`:** doğrudan tablo erişimi yok. Sahibi `my_guardian_requests` görünümünden okur.
- **`applications`:** kurum yalnız kendi fırsatlarına gelen başvuruları ve yalnız `snapshot`'ı görür; `profile_private` hiçbir kuruma açılmaz. Kurumlar genç profillerini listeleyemez.
- **`experience_evidence`:** hiçbir zaman herkese açık değil; bucket özeldir.
- **`audit_events`:** platform yöneticisi ve ilgili kurumun `owner`/`admin` rolü.

`my_guardian_requests` **bilinçli olarak sahip yetkisiyle çalışan** bir görünümdür: tabloya politika vermeden, token özetlerini dışarıda bırakıp e-postayı maskeleyerek yalnız `auth.uid()` satırlarını döner. Supabase linter'ı "security definer view" uyarısı verebilir; tasarım gereğidir. `experiences_with_status` ise `security_invoker` görünümüdür.

## `app` şeması

API'ye açılmayan yardımcılar: `app.fail`, `app.audit`, `app.age_years`, `app.min_account_age`, `app.has_org_role`, `app.is_platform_admin`, `app.ticket_token`, `app.next_registration_status`, `app.promote_waitlist`, `app.expire_guardian_requests`; Faz 3a ile: `app.recount_team_event`, `app.promote_team_waitlist`, `app.recompute_team_registration`, `app.expire_team_registrations`, `app.bump_team_roster`, `app.end_team_member_registration`, `app.is_team_registration_member`, `app.is_team_registration_staff`, `app.is_confirmed_participant` ve takım tetikleyici işlevleri; Faz 3b ile: `app.cover_object_pattern`, `app.team_cover_writes_enabled`, `app.can_write_cover_folder`, `app.fail_if_team_cover_disabled`, `app.guard_cover_columns`, `app.team_category_key_for`, `app.recruitment_post_creator`, `app.notification_retention_days`, `app.notification_kinds`, `app.notification_copy`, `app.notify`, `app.notify_registration_status`, `app.notify_application_status`, `app.notify_team_membership`, `app.queue_event_reminders`, `app.prune_notifications` (hepsinden `anon`/`public` execute geri alınmıştır; bildirim yardımcılarında `authenticated` ve `service_role` dahil). İstisna: storage politikaları çağıranın yetkisiyle çalıştığı için `app.can_write_cover_object`, `app.can_insert_cover_object` ve `app.cover_object_in_use` `authenticated`'a **açıkça** grant edilir (`anon` yok); `service_role` için kapak temizleme işi yazılırsa `app.cover_object_in_use` grant'i ayrıca verilmelidir.

**Bildirimler.** `public.notifications` satırlarını yalnız tetikleyiciler yazar (18 tür; Faz 3a ile eklenen 5'i `team_registration.invited|confirmed|member_declined|expired|guardian_expired`, hedef türü `team_event_registration`; ilk 13: `registration.confirmed|promoted|promoted_pending|rejected|expired`, `guardian.denied|revoked`, `application.status_changed`, `team_join.accepted|rejected|requested`, `event.reminder_24h`, `event.cancelled`); metin `app.notification_copy` içinde sabit cümle + içerik başlığıdır (kişi adı yok), satıra oluşurken dondurulur ve hedefe FK yoktur. `target_type` yalnız `event | event_registration | application | team | team_event_registration`. 24 saat hatırlatması kullanıcı + etkinlik başına bir kez (`notifications_one_reminder` kısmi benzersiz indeks). Saklama: okunmuş bildirimler oluşturulmalarından 90 gün sonra silinir, okunmamışlar silinmez (kullanıcı kararı 13 Kasım 2026); istisna olarak etkinliği hâlâ gelecekte olan hatırlatma satırı "gönderildi" işareti olduğu için silinmez. pg_cron işleri (pg_cron varsa kurulur, yoksa uyarı verip geçer): `techapp-event-reminders` `*/15 * * * *` → `app.queue_event_reminders()`, `techapp-prune-notifications` `23 3 * * *` → `app.prune_notifications()`, `techapp-expire-team-registrations` `*/10 * * * *` → `app.expire_team_registrations()` (20261113000700; 7 günlük tutmanın süre dolumu, kapanış sonrası bekleme listesi kapatma, `ends_at`'te karar bekleyen incelemelerin kapanışı). `app.secrets`, QR imzası için ortam başına migration anında üretilen `ticket_hmac_v1` anahtarını tutar; kaynak kodda sır yoktur.

## Gerçek Supabase projesine dağıtım

```bash
supabase link --project-ref <ref>
supabase db push                 # migrations
psql "$DEV_DB_URL" -f supabase/seed.sql   # YALNIZ development ortamında
supabase functions deploy guardian-dispatch delete-account
supabase secrets set RESEND_API_KEY=… GUARDIAN_PAGE_URL=… MAIL_FROM=…
```

- Seed production'a uygulanmaz; tüm satırları `is_demo = true` taşır ve uygulamada "ÖRNEK İÇERİK" etiketiyle görünür.
- İlk platform yöneticisi SQL ile eklenir: `insert into public.platform_admins (user_id) values ('<uuid>')`.
- **pg_cron önerisi:** `select cron.schedule('expire-guardian', '*/15 * * * *', $$select app.expire_guardian_requests()$$);` Şu an süre dolumu yalnız tembel (yeni kayıt sırasında) çalışıyor. (`20261113000400_notifications` iki bildirim işini kendisi kurar; yukarıdaki "Bildirimler".)
- **Tip üretimi (TODO):** `apps/mobile/src/lib/database.types.ts` elle yazılmış bir alt kümedir. Proje bağlanınca `supabase gen types typescript` çıktısıyla değiştirilmeli.

## Doğrulama durumu

Migration 0100–0400 gömülü PostgreSQL 18 üzerinde 47 testle çalıştırıldı (0600 dahil). `…000500_storage.sql` ve Edge Functions **statik olarak hazırlandı; gerçek Supabase projesinde hiç çalıştırılmadı.**

**Faz 3b (13 Kasım 2026):** `npm run db:test` yerelde geçiyor (Task 14 sonunda 283 test, bu görevde yeniden koşuldu — `IMPLEMENTATION-STATUS.md`); remote regresyon betiğinin Faz 3b maddeleri (21–21d, 22–22k, 23–23i, 24–24c, 25–25k) yalnız yerel kuru koşuyla denendi, **staging'de koşulmadı** (beş migration bekletiliyor). `covers` bucket'ının `storage.objects` politikaları yerel yığında Storage olmadığı için bir stand-in üzerinde test edilir (`covers.test.ts`); gerçek Storage'a karşı doğrulama 22g ve 22k ile staging'de yapılacak.
