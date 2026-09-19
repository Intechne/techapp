# Veritabanı

Tek doğruluk kaynağı: `supabase/migrations/*.sql`. RLS sonradan eklenmez; her tablo oluşturulduğu dosyada kilitlenir.

| Dosya | İçerik |
|---|---|
| `…000100_foundation.sql` | Uzantılar, `app` şeması, profiller, ilgi alanları, kurumlar, audit, profil bootstrap |
| `…000200_events.sql` | Etkinlik, kayıt, check-in, veli onayı, rıza, katılım kartı |
| `…000300_reference_data.sql` | 8 ilgi alanı |
| `…000400_ecosystem.sql` | Takım, fırsat/başvuru, deneyim/doğrulama, öğrenme, yer imi, bildirim, cihaz, şikâyet/moderasyon |
| `…000500_storage.sql` | Özel `evidence` ve `avatars` bucket'ları (`storage` şeması yoksa no-op) |

## Tablo grupları

- **Kimlik:** `profiles` (herkese açık olabilecek alanlar), `profile_private` (doğum tarihi, yasal ad, telefon — yalnız sahibi), `interests`, `profile_interests`, `platform_admins`
- **Kiracı sınırı:** `organizations`, `organization_members` (`owner`, `admin`, `editor`, `checkin_staff`, `reviewer`)
- **Etkinlik:** `events`, `event_sessions`, `event_registrations`, `event_check_ins`, `event_courses`
- **Onay:** `guardian_requests`, `consents`
- **Takım:** `teams` (`team` | `community`), `team_memberships`, `team_tasks`, `recruitment_posts`, `recruitment_applications`
- **Fırsat:** `opportunities`, `applications`, `application_status_history`
- **Deneyim:** `experiences`, `experience_evidence`, `attestations`
- **Öğrenme:** `courses`, `lessons`, `course_progress`
- **Diğer:** `bookmarks`, `notifications`, `devices`, `reports`, `moderation_actions`, `audit_events`
- **Özel:** `app.secrets` (API'ye kapalı)

`profile_private` ve `event_check_ins` kullanıcı listesindeki tablolara ek olarak bilinçli eklendi: sütun bazlı gizlilik RLS ile sağlıklı yapılamıyor; check-in ise oturum kapsamı taşıyor. `event_courses` "Bu etkinliğe hazırlan" ilişkisini taşır.

## Enum'lar

`education_stage`, `org_type`, `org_member_role`, `verification_status`, `publish_status` (`draft`→`in_review`→`published`…), `event_type`, `event_format`, `registration_mode`, `registration_status` (`pending_guardian`, `pending_review`, `confirmed`, `waitlisted`, `cancelled`, `rejected`, `expired`), `guardian_status`, `team_kind`, `team_role`, `membership_status`, `task_status`, `recruitment_application_status`, `opportunity_type`, `application_status`, `experience_kind`, `attestation_status`, `push_provider`.

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
| `register_for_event`, `cancel_event_registration`, `get_participation_card`, `create_guardian_request` | `authenticated` (yalnız kendi kaydı) |
| `check_in_participant` | `authenticated` + o etkinliğin kurumunda `owner`/`admin`/`checkin_staff` |
| `review_event_registration` | `authenticated` + `owner`/`admin`/`reviewer` |
| `create_team`, `request_team_join`, `withdraw_team_join`, `leave_team`, `team_roster` | `authenticated` |
| `decide_team_join`, `set_team_task_status` | o takımın kaptanı/mentoru (görev sahibi kendi görevini ilerletebilir) |
| `set_team_member_role`, `remove_team_member` | yalnız o takımın kaptanı; kimse kendi rolünü değiştiremez; son kaptan korunur |
| `apply_to_recruitment`, `decide_recruitment_application` | üye / takım yöneticisi |
| `application_share_preview`, `submit_application`, `withdraw_application` | `authenticated` (kendi başvurusu) |
| `set_application_status` | fırsatın kurumundaki inceleme rolleri; geçişler doğrulanır, geçmişe yazılır |
| `request_attestation` / `decide_attestation` / `revoke_attestation` | deneyim sahibi / doğrulayan kurumun yetkilisi (kendi deneyimini doğrulayamaz) |
| `complete_lesson` | `authenticated`; ilerlemeyi sunucu hesaplar |
| `register_device`, `unregister_device` | `authenticated` |

Tüm RPC'ler `SECURITY DEFINER` + `set search_path = ''`. Her migration sonunda `execute` yetkileri açıkça geri alınıp yeniden verilir.

## RLS özeti

- **Yayınlanmış içerik** (`events`, `event_sessions`, `opportunities`, `courses`, doğrulanmış `organizations`, etkin `teams`): `anon` dahil okunur. Taslaklar yalnız ilgili kurum üyelerine ve platform yöneticisine.
- **Kişiye ait** (`profile_private`, `consents`, `bookmarks`, `applications`, `course_progress`, `notifications`, `devices`, deneyim taslakları): yalnız sahibi.
- **`event_registrations`, `event_check_ins`:** sahibi okur; etkinliğin kurumundaki yetkili roller okur; **istemciden INSERT/UPDATE/DELETE yoktur**.
- **`guardian_requests`:** doğrudan tablo erişimi yok. Sahibi `my_guardian_requests` görünümünden okur.
- **`applications`:** kurum yalnız kendi fırsatlarına gelen başvuruları ve yalnız `snapshot`'ı görür; `profile_private` hiçbir kuruma açılmaz. Kurumlar genç profillerini listeleyemez.
- **`experience_evidence`:** hiçbir zaman herkese açık değil; bucket özeldir.
- **`audit_events`:** platform yöneticisi ve ilgili kurumun `owner`/`admin` rolü.

`my_guardian_requests` **bilinçli olarak sahip yetkisiyle çalışan** bir görünümdür: tabloya politika vermeden, token özetlerini dışarıda bırakıp e-postayı maskeleyerek yalnız `auth.uid()` satırlarını döner. Supabase linter'ı "security definer view" uyarısı verebilir; tasarım gereğidir. `experiences_with_status` ise `security_invoker` görünümüdür.

## `app` şeması

API'ye açılmayan yardımcılar: `app.fail`, `app.audit`, `app.age_years`, `app.min_account_age`, `app.has_org_role`, `app.is_platform_admin`, `app.ticket_token`, `app.next_registration_status`, `app.promote_waitlist`, `app.expire_guardian_requests`. `app.secrets`, QR imzası için ortam başına migration anında üretilen `ticket_hmac_v1` anahtarını tutar; kaynak kodda sır yoktur.

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
- **pg_cron önerisi:** `select cron.schedule('expire-guardian', '*/15 * * * *', $$select app.expire_guardian_requests()$$);` Şu an süre dolumu yalnız tembel (yeni kayıt sırasında) çalışıyor.
- **Tip üretimi (TODO):** `apps/mobile/src/lib/database.types.ts` elle yazılmış bir alt kümedir. Proje bağlanınca `supabase gen types typescript` çıktısıyla değiştirilmeli.

## Doğrulama durumu

Migration 0100–0400 gömülü PostgreSQL 18 üzerinde 37 testle çalıştırıldı. `…000500_storage.sql` ve Edge Functions **statik olarak hazırlandı; gerçek Supabase projesinde hiç çalıştırılmadı.**
