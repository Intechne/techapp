# TechApp V5 · Faz 3a — Takım etkinlik kaydı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **Cezeri pilotunun parçası değildir** (spec §8a-1, kullanıcı kararı). Cezeri'de resmî takım kaydı TechApp dışında kalır.
> Bu plan 29 Kasım'dan önce `feat/v5-pilot-platform` dalına hiçbir şey eklemez; pilot build'i bu koddan etkilenmez.

**Goal:** `registration_mode = 'team' | 'both'` etkinliklerde kaptanın takımını kaydettiği, her üyenin kendi rızasını verdiği,
18 yaş altı her üye için mevcut veli akışının çalıştığı, kontenjanın takım sayısıyla tutulduğu uçtan uca takım kaydı.

**Architecture:** Kayıt birimi `team_event_registrations` (takım satırı) + `team_event_registration_members` (kadro anlık
görüntüsü). Üye kabul ettiğinde **kendi** `event_registrations` satırı (`team_registration_id` dolu) oluşur; böylece veli
isteği, rıza, katılım kartı, QR ve check-in mevcut bireysel altyapıyı aynen kullanır. Takımın durumu üyelerin durumundan
sunucuda türetilir (`app.recompute_team_registration`). Önce migration + RLS + RPC + testler, sonra mobil, sonra admin.

**Tech Stack:** PostgreSQL (RLS, SECURITY DEFINER, pg_cron) · Vitest + embedded-postgres · Expo SDK 57 / RN 0.86 · React Navigation 7 · TanStack Query · Vite admin.

**Spec:** `docs/superpowers/specs/2026-11-11-techapp-v5-design.md` (§4 "Takım kaydı", §8-1, §8a-1) · Yol haritası: `docs/superpowers/plans/2026-11-12-techapp-v5-roadmap.md`

## Global Constraints

- Dal: `feat/v5-team-registration`, pilot etiketinden (`pilot/cezeri-2026-11`, pilot sonrası atılır) dallanır. `main`'e yazılmaz; push/PR kullanıcı onayıyla. Destructive git yok (stash dahil).
- Yeni tablo = aynı migration dosyasında RLS + test (CLAUDE.md kural 5). Uygulanmış migration düzenlenmez; yeni dosya `YYYYMMDDHHMMSS_team_registration.sql` (20261111000100'dan sonra).
- Yazma yalnız `SECURITY DEFINER` RPC; istemcinin yeni tablolara INSERT/UPDATE/DELETE yolu yok. Fonksiyonlarda `set search_path = ''`.
- Kaptan **başkası adına rıza veremez**: her üyenin `event_participation` rızası `granted_by = 'self'`, 18 yaş altında ayrıca `granted_by = 'guardian'`.
- 18 yaş altı üyelerin adı takım (`team_roster` kuralı) ve etkinliğin yetkili kurum personeli dışına çıkmaz; e-posta/doğum tarihi/veli bilgisi hiçbir RPC'den başka üyeye dönmez.
- Hata kodu → `errors.ts` `COPY` (Türkçe yalnız istemcide); durum metni → `Status.tsx`. `errorCopyCoverage` testi yeni kodları yakalar.
- Mobil arayüz `features.teamRegistration` bayrağının arkasında: `local | development | preview` için açık, `production` için **kapalı** — açılması kullanıcı onayı + hukuk kapısı (Faz 6 Task 1) ister.
- Remote/staging'e migration push ve EAS build kullanıcı onayıyla; production'a dokunulmaz.
- Her task: `npm run db:test` (DB task'ı), `npm --prefix apps/mobile run verify` (mobil task'ı), `npm --prefix apps/admin run typecheck` (admin task'ı) yeşil; UI task'ı ekran görüntüsüyle görülmeden bitmez.

## Review Focus

1. **Son takım koltuğu yarışı:** iki kaptan aynı anda son takım koltuğuna başvurur → biri `pending_members`, diğeri `waitlisted` (veya bekleme kapalıysa `team_event_full`); asla iki koltuk (Task 2 paralel testi).
2. **Bireysel sayaç kirlenmesi:** takım üyelerinin `event_registrations` satırları `seats_taken`/bireysel kontenjana sayılmaz; `both` modunda bireysel kayıt takım satırlarından etkilenmez (Task 1 + 2 testleri).
3. **Kadro düzenleme yarışı:** kaptan eski sürümü düzenlerken bir üye ayrılır → `roster_changed` (409), sessiz üzerine yazma yok (Task 3 testi).
4. **Takımdan çıkarılan / ayrılan üye:** kayıttan sonra takımdan ayrılan üyenin kaydı iptal olur, katılım kartı alınamaz; takım tekrar `pending_members` (Task 3 testi).
5. **Takım onaylanmadan kart:** kendi kaydı `confirmed` olan ama takımı henüz onaylanmamış üyeye kart/QR verilmez, check-in reddedilir (Task 3 testi).

---

## Veri modeli kararları (Task 1–4'ün ortak sözleşmesi)

| Konu | Karar |
|---|---|
| Kontenjan | `events.team_capacity int null` (null = sınırsız), `teams_taken`, `team_waitlist_count` (sunucu sayacı, `app.counter_write` korumalı). `capacity`/`seats_taken` yalnız bireysel kayıtlar. `both` modunda iki havuz bağımsız |
| Takım boyu | `events.team_min_size int not null default 1`, `team_max_size int null`; check `team_min_size <= team_max_size` |
| Takım durumu | enum `team_registration_status`: `pending_members · pending_review · confirmed · waitlisted · cancelled · rejected · expired`. Koltuk tutan: `pending_members`, `pending_review`, `confirmed` |
| Üye durumu | `team_event_registration_members.state`: `invited · accepted · declined · removed`; `accepted` olunca `registration_id` dolar |
| Üye kaydı | `event_registrations.team_registration_id uuid null` FK; üye kaydı hiçbir zaman `waitlisted` olmaz (koltuğu takım tutar); `requires_review` üye düzeyinde değil takım düzeyinde uygulanır |
| Türetme | Tüm üyeler `accepted` + kayıtları `confirmed` + kadro `team_min_size..team_max_size` içinde → `requires_review ? pending_review : confirmed`; aksi halde `pending_members` |
| Bekleme süresi | `hold_expires_at = least(registration_closes_at, submitted_at + interval '7 days')`; dolunca `expired`, koltuk serbest, bekleme listesindeki ilk takım yükselir. **7 gün kullanıcı kararı** (rapor, açık soru 1) |
| Idempotency | `unique (submitted_by, idempotency_key)`; aynı takım+etkinlik için canlı satır varsa onu döner (bireysel `register_for_event` ile aynı sözleşme) |
| Kim gönderir | Yalnız takımın etkin `captain`'ı (mentor değil). Kadroda kaptan zorunlu değil |
| Kart/check-in | `get_participation_card` ve `check_in_participant`: kayıt `team_registration_id` taşıyorsa takım `confirmed` olmalı, değilse 409 `team_registration_not_confirmed` |

---

### Task 1: Şema, RLS ve sayaçlar

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_team_registration.sql`, `supabase/tests/team-registration.test.ts`
- Modify: `supabase/tests/helpers.ts` (`createTeam(captainId, memberIds)`, `createTeamEvent(orgId, overrides)` yardımcıları)

**Interfaces:**
- Produces: tablolar `public.team_event_registrations(id, event_id, team_id, status, status_reason, submitted_by, idempotency_key, roster_version int, hold_expires_at, confirmed_at, cancelled_at, created_at, updated_at)`, `public.team_event_registration_members(id, team_registration_id, user_id, role_at_submit team_role, roster_version, state, registration_id, responded_at, created_at)`; `events` kolonları yukarıdaki tabloya göre; `app.recount_team_event(p_event uuid) returns void`; `app.is_team_registration_member(p_team_registration_id uuid) returns boolean`.

- [ ] **Step 1: Failing testler** (`describe('team registration · schema')`):
  - `it('anon and a signed-in non-member read zero rows from both tables')`
  - `it('a team member reads only their own team’s registration and member rows')`
  - `it('authenticated cannot insert/update/delete either table directly (permission denied)')`
  - `it('recount_team_event: teams_taken counts pending_members+pending_review+confirmed; waitlisted goes to team_waitlist_count')`
  - `it('recount_event ignores event_registrations with team_registration_id: seats_taken unchanged')`
  - `it('teams_taken cannot be written by an org editor (counter guard, 403/permission)')`
- [ ] **Step 2:** `npm run db:test -- team-registration` → FAIL (tablo yok).
- [ ] **Step 3:** Migration: enum, iki tablo, kısmi benzersiz indeksler (`(event_id, team_id) where status in (canlı)`, `(team_registration_id, user_id) where state in ('invited','accepted')`), RLS (select: `app.is_team_registration_member` veya ilgili kurumun `owner|admin|reviewer|checkin_staff` üyesi veya platform admini; yazma yok), `events` kolonları + check'ler + `app.event_critical_fields()`'e `team_min_size`, `team_max_size` eklenir; `team_capacity` azalması `capacity` gibi kritik. `app.recount_event` ve `register_for_event` içindeki sayımlar `team_registration_id is null` ile daraltılır (fonksiyonlar `create or replace`).
- [ ] **Step 4:** `npm run db:test` → tümü PASS (önceki 109 dahil).
- [ ] **Step 5: Commit** `feat(db): takım kaydı şeması — takım satırı, kadro anlık görüntüsü, takım kontenjanı`

### Task 2: Gönderim, kontenjan ve bekleme listesi

**Files:** Modify: aynı migration'a değil — **yeni** migration `…_team_registration_rpc.sql` (Task 1 commit'lendiyse); `supabase/tests/team-registration.test.ts`

**Interfaces:**
- Consumes: Task 1 tabloları.
- Produces: `public.submit_team_registration(p_event_id uuid, p_team_id uuid, p_member_ids uuid[], p_idempotency_key uuid) returns public.team_event_registrations`; `app.promote_team_waitlist(p_event public.events) returns void` (çağıran etkinlik satır kilidini tutar); `public.event_eligibility` dönüşüne `registration_mode`, `team_seats_left`, `captain_teams: [{team_id, name, active_member_count}]` (yalnız oturum açık kullanıcının kaptanı olduğu etkin takımlar).

- [ ] **Step 1: Failing testler** (`describe('team registration · submit')`):
  - `it('captain submits 3 active members → pending_members, 3 invited rows, roster_version 1, teams_taken 1')`
  - `it('same idempotency key twice → same row; another key while live → same live row')`
  - `it('mentor or member submits → 403 not_team_captain')`
  - `it('roster size outside team_min_size..team_max_size → 422 team_size_out_of_range')`
  - `it('pending/left/removed member in roster → 422 member_not_active')`
  - `it('member with a live individual registration, or in another team’s live registration for this event → 409 member_already_registered')`
  - `it('individual-mode event → 409 individual_registration_only; team-mode event still rejects register_for_event with team_registration_only')`
  - `it('member outside min_age/max_age → 403 member_age_not_eligible (no name or age in the error payload)')`
  - `it('team_capacity 2: third team → waitlisted when waitlist_enabled, 409 team_event_full otherwise; seats_taken unchanged')`
  - `it('two captains race for the last team seat in parallel → exactly one pending_members and one waitlisted')` (iki ayrı bağlantı, `Promise.all`)
  - `it('event_eligibility lists only teams where the caller is an active captain, with active_member_count')`
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Uygula. Sıra: `auth` → idempotency → etkinlik `for update` → `registration_mode`/tarih kontrolleri → kaptan kontrolü → üyeler için tek sorguda uygunluk (etkin üyelik, yaş, çakışan canlı kayıt; `pg_advisory_xact_lock(hashtextextended(event_id || ':' || user_id))` üye başına) → kontenjan → satırlar → `app.audit('user','team_registration.submitted', …)` (PII yok: yalnız id'ler ve kadro boyu).
- [ ] **Step 4:** `npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat(db): submit_team_registration — kaptan gönderir, takım kontenjanı, bekleme listesi`

### Task 3: Üye yanıtı, veli akışı, kadro düzenleme, iptal ve süre dolumu

**Files:** Create: yeni migration `…_team_registration_lifecycle.sql`; Modify: `supabase/tests/team-registration.test.ts`, `supabase/migrations/20260919000700_scheduled_jobs.sql` **değil** — cron kaydı yeni migration'da (aynı `pg_cron` yoksa no-op kalıbıyla)

**Interfaces:**
- Produces:
  - `public.respond_team_registration(p_member_id uuid, p_accept boolean, p_idempotency_key uuid) returns jsonb` → `{ member_state, registration_id, registration_status }`
  - `public.update_team_roster(p_team_registration_id uuid, p_member_ids uuid[], p_expected_roster_version int) returns public.team_event_registrations`
  - `public.cancel_team_registration(p_team_registration_id uuid) returns public.team_event_registrations`
  - `public.team_registration_detail(p_team_registration_id uuid) returns jsonb` → `{ id, status, hold_expires_at, roster_version, event: {id,title,starts_at}, team: {id,name}, members: [{member_id, display_name, role_at_submit, state, step: 'invited'|'guardian'|'ready'|'declined'}] , can_edit: boolean }` — `step = 'guardian'` yalnız "veli onayı bekleniyor" demektir; veli e-postası/adı/durum ayrıntısı dönmez.
  - `public.my_team_registration_invites() returns setof jsonb` → `{ member_id, team_registration_id, event: {...}, team: {id,name}, state }`
  - `app.recompute_team_registration(p_id uuid) returns void`, `app.expire_team_registrations() returns int`
  - Trigger: `event_registrations` üzerinde `team_registration_id is not null` satırlar için durum değişiminde `recompute`; `team_memberships` üzerinde `active → left|removed` geçişinde canlı takım kayıtlarındaki üyeyi `removed` + kaydını iptal.

- [ ] **Step 1: Failing testler** (`describe('team registration · members')` + `('· lifecycle')`):
  - `it('16-year-old accepts → own registration pending_guardian with team_registration_id; create_guardian_request + guardian_decide(approve) → confirmed; team confirmed when all ready')`
  - `it('adult accepts → registration confirmed, self consent row (subject_type event_registration); team stays pending_members until everyone is ready')`
  - `it('captain cannot respond for another member → 403 not_invite_owner')`
  - `it('member declines → team pending_members; update_team_roster with expected version replaces them; stale version → 409 roster_changed')`
  - `it('roster edit after registration_closes_at → 409 team_registration_closed')`
  - `it('member leaves the team after accepting → member removed, registration cancelled, consents withdrawn, team pending_members')`
  - `it('member of an unconfirmed team: get_participation_card → 409 team_registration_not_confirmed; check_in_participant refuses')`
  - `it('requires_review event: complete team → pending_review (members stay confirmed individually)')`
  - `it('captain cancels → every member registration cancelled, pending guardian requests revoked, teams_taken −1, first waitlisted team promoted to pending_members')`
  - `it('expire_team_registrations: pending_members past hold_expires_at → expired, member registrations expired, guardian requests revoked, waitlist promoted; confirmed teams untouched')`
  - `it('member cancels own registration via cancel_event_registration → member declined, team pending_members (seat kept until hold expiry)')`
  - `it('team_registration_detail: a member sees display names of their own team only; no email, birth_date or guardian fields anywhere in the payload')`
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Uygula. Üye kabulü: yeni `event_registrations` satırı `status = app.next_member_status(e, uid, reg_id)` (`pending_guardian` | `confirmed`; review yok), rıza satırı `register_for_event` ile aynı. `get_participation_card` ve `check_in_participant` `create or replace` ile takım kontrolü alır (mevcut testler korunur). Cron: `techapp-expire-team-registrations`, `*/10 * * * *`.
- [ ] **Step 4:** `npm run db:test` → PASS. `errorCopyCoverage` yeni `app.fail` kodlarını yakalayacağı için bu task `apps/mobile/src/lib/errors.ts` `COPY`'ye Türkçe karşılıklarını ekler (`not_team_captain, team_size_out_of_range, member_not_active, member_already_registered, member_age_not_eligible, individual_registration_only, team_event_full, roster_changed, team_registration_closed, team_registration_not_confirmed, not_invite_owner, team_registration_not_found`); `npm --prefix apps/mobile run verify` yeşil.
- [ ] **Step 5: Commit** `feat(db): takım kaydı yaşam döngüsü — üye rızası, veli akışı, kadro sürümü, iptal, süre dolumu`

### Task 4: Organizatör tarafı RPC'leri ve staging regresyonu

**Files:** Create: yeni migration `…_team_registration_admin.sql`; Modify: `supabase/tests/team-registration.test.ts`, `supabase/tests/remote/security-regression.sql` (yeni kontroller 21–21d)

**Interfaces:**
- Produces: `public.admin_event_team_registrations(p_event_id uuid) returns setof jsonb` → `{ id, team_name, status, roster_size, ready_count, hold_expires_at, members: [{display_name, state, step}] }` (yalnız etkinliğin kurumunda `owner|admin|reviewer` veya platform admini); `public.review_team_registration(p_team_registration_id uuid, p_approve boolean) returns public.team_event_registrations` (`pending_review → confirmed | rejected`, red → üye kayıtları `rejected`, koltuk serbest, bekleme listesi yükselir).

- [ ] **Step 1: Failing testler** (`describe('team registration · organizer')`): başka kurumun personeli → 403; `checkin_staff` listeleyemez; dönen JSON'da `birth_date|email|guardian` anahtarı yok; red sonrası `teams_taken` düşer ve sıradaki takım yükselir.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** `npm run db:test` PASS.
- [ ] **Step 5:** `security-regression.sql`'e 21–21d (anon/takım dışı okuma yok, doğrudan yazma yok, sayaç koruması, başka kurum 403). Staging'e `db push` **kullanıcı onayıyla** (dry-run planı okunur, yalnız bu fazın dosyaları görünmeli) → regresyon PASS + kalıntı 0 → `IMPLEMENTATION-STATUS.md` V5 tablosuna satır.
- [ ] **Step 6: Commit** `feat(db): takım kayıtları için organizatör listesi ve değerlendirme; staging regresyonu 21–21d`

### Task 5: Mobil — kaptanın takım kaydı akışı

**Files:**
- Create: `apps/mobile/src/lib/features.ts`, `apps/mobile/src/features/teamRegistration/{api.ts,labels.ts,logic.ts,TeamRegistrationScreen.tsx,TeamRegistrationStatusScreen.tsx}`, `apps/mobile/src/features/teamRegistration/__tests__/{logic.test.ts,teamRegistrationScreen.test.tsx}`
- Modify: `apps/mobile/src/navigation/{types.ts,RootNavigator.tsx}` (`SharedEventParamList`: `TeamRegistration: { eventId: string }`, `TeamRegistrationStatus: { teamRegistrationId: string }`), `apps/mobile/src/features/events/EventDetailScreen.tsx`, `apps/mobile/src/design-system/components/Status.tsx`, `apps/mobile/src/lib/errors.ts`, `apps/mobile/src/lib/database.types.ts` (yerel tipler; `db:types` staging push'tan sonra)

**Interfaces:**
- Produces: `features.teamRegistration: boolean`; `eventCta(input: { mode: 'individual'|'team'|'both'; eligibility: Eligibility | undefined; signedIn: boolean; flag: boolean }): { kind: 'individual'|'team'|'team_info'|'sign_in'|'none'; label: string }`; `rosterProblem(selected: number, min: number, max: number | null): 'too_few'|'too_many'|null`; `teamRegistrationStatusView: Record<TeamRegistrationStatus, StatusView>`, `teamMemberStepView: Record<'invited'|'guardian'|'ready'|'declined', StatusView>`.

- [ ] **Step 1: Failing testler:**
  - `logic.test.ts`: `eventCta` — team modu + kaptan takımı yok → `team_info` ("Takım kaydını kaptanın yapar"); team + kaptan → `team`; both + kaptan → `individual` birincil, takım ikincil (`team`) ayrı döner; flag kapalı → team modunda `team_info`, asla `team`; misafir → `sign_in`. `rosterProblem(1, 2, 5) === 'too_few'`, `(6, 2, 5) === 'too_many'`, `(3, 2, null) === null`.
  - `teamRegistrationScreen.test.tsx`: kadro listesi `team_roster`'dan; boy sınırı dışındayken gönder düğmesi pasif + neden metni; çift dokunuş tek `submit_team_registration` çağrısı ve **aynı** `p_idempotency_key` (yeniden deneme de aynı anahtar); sunucu `member_already_registered` → ilgili satırın altında `COPY` metni; başarı → `TeamRegistrationStatus`'a `replace`.
- [ ] **Step 2:** `npm --prefix apps/mobile test -- teamRegistration` → FAIL.
- [ ] **Step 3:** Uygula. Durum ekranı: `StatusTimeline` takım adımları (Gönderildi → Üyeler hazır → [İnceleme] → Onaylandı); üye listesi `teamMemberStepView` rozetleriyle; kaptan için "Kadroyu düzenle" (aynı ekran, `p_expected_roster_version` ile) ve "Takım kaydını iptal et" (onay `Modal`'ı). `hold_expires_at` "… tarihine kadar tamamlanmalı" olarak sunucudan.
- [ ] **Step 4:** `verify` yeşil; yerel yığında (`db:dev`, takım modlu demo etkinlik) web önizlemede: etkinlik detayı CTA, kadro seçimi, durum ekranı ekran görüntüleri (390 + 320 genişlik).
- [ ] **Step 5: Commit** `feat(mobile): kaptan için takım kaydı — kadro seçimi, durum ekranı, düzenleme ve iptal (bayrak arkasında)`

### Task 6: Mobil — üye daveti ve kabul

**Files:** Create: `apps/mobile/src/features/teamRegistration/TeamInviteScreen.tsx`, `__tests__/teamInvite.test.tsx`; Modify: `apps/mobile/src/features/events/MyRegistrationsScreen.tsx`, `navigation/types.ts` (`TeamInvite: { memberId: string }`), `features/events/RegistrationStatusScreen.tsx`

**Interfaces:** Consumes `respond_team_registration`, `my_team_registration_invites` (Task 3).

- [ ] **Step 1: Failing testler:** Katılımlarım'da "Takım davetleri" bölümü yalnız davet varsa; davet ekranı etkinlik + takım adı + "Kabul edersen katılımın senin adına kaydedilir; 18 yaşından küçüksen velinden onay isteyeceğiz." metni; kabul → yanıt `registration_status = 'pending_guardian'` ise `GuardianRequest`'e, `confirmed` ise `RegistrationStatus`'a `replace`; ret onay modalı ister; `RegistrationStatus` takım kaydına bağlı kayıtta "Takımın: <ad> · takım durumu" satırını gösterir ve takım onaylanmadıysa kart düğmesi yerine "Takımın tamamlanınca kartın açılır" yazar.
- [ ] **Step 2–4:** FAIL → uygula → `verify` yeşil; web'de 16 yaş test hesabıyla kabul → veli ekranı; yetişkinle kabul → durum ekranı görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): takım daveti — üye kendi rızasını verir, gerekiyorsa veli akışına geçer`

### Task 7: Admin — etkinlik formu ve takım kayıtları sayfası

**Files:** Create: `apps/admin/src/pages/EventTeamRegistrations.tsx`; Modify: `apps/admin/src/pages/{EventForm.tsx,EventDetail.tsx}`, `apps/admin/src/App.tsx` (rota), `apps/admin/.env.example` (`VITE_FEATURE_TEAM_REGISTRATION`)

- [ ] **Step 1:** EventForm: `registration_mode` seçimi (`team`/`both` yalnız `VITE_FEATURE_TEAM_REGISTRATION=1` iken), `team_capacity`, `team_min_size`, `team_max_size` alanları; istemci doğrulaması DB check'leriyle aynı (min ≤ max, >0).
- [ ] **Step 2:** Takım kayıtları sayfası: tablo (takım, durum, hazır/kadro, son tarih), satır açılınca üye adları + adım; `pending_review` için Onayla/Reddet (`review_team_registration`, `ConfirmButton`). Üye e-postası/yaşı gösterilmez.
- [ ] **Step 3:** `npm --prefix apps/admin run typecheck` + `vite build` temiz; yerel yığında tarayıcıda: takım modlu etkinlik oluştur → mobilde kaptan gönderir → admin listede görünür → onay (ekran görüntüleri).
- [ ] **Step 4: Commit** `feat(admin): takım kaydı ayarları ve takım kayıtları değerlendirme sayfası`

### Task 8: Belgeler ve kapanış

**Files:** Modify: `IMPLEMENTATION-STATUS.md` (V5), `docs/KNOWN-ISSUES.md` ("Takım etkinlik kaydı yok" maddesi kapanır; bayrak/hukuk notu kalır), `docs/PRODUCT-SCOPE.md` (EventDetail satırı), `docs/DATABASE.md`, `docs/GUARDIAN-CONSENT.md` (takım üyesi için veli akışı)

- [ ] **Step 1:** Belgeler güncellenir; iki belgede aynı konu farklı durum göstermez (elle çapraz kontrol).
- [ ] **Step 2:** `npx hig-doctor apps/mobile --fail-on serious` → 0.
- [ ] **Step 3: Commit** `docs: takım etkinlik kaydı — durum, veri modeli, veli akışı`

> **Bildirimler (bağımlı):** Faz 3b Task 9 (sunucu bildirimleri) bu fazdan **önce** birleştiyse Task 3'e `team_registration.invited`, `team_registration.confirmed`, `team_registration.member_declined` (kaptana), `team_registration.expired` türleri eklenir; sonra birleşirse 3b Task 9 bu türleri ekler. Aynı tür iki yerde tanımlanmaz.

---

## Self-review (yazar notu)

- **Spec kapsamı:** takım = kayıt birimi (T1–2), her 18 yaş altı üye için veli (T3, mevcut akış), kaptan başvurur (T2), kapasite takım sayısıyla (T1–2), idempotency (T2), bekleme listesi (T2–3), roster snapshot (T1, `roster_version`), mobil (T5–6), admin (T7), pilot dışı işareti (üst not + bayrak). Hukuk: "takım üyeliği için veli onayı" sorusu (KNOWN-ISSUES) bu planın kapsamı **dışında**; burada yalnız etkinlik katılımı için veli onayı var.
- **Tip tutarlılığı:** `team_registration_detail.members[].step` ile `teamMemberStepView` anahtarları aynı (`invited|guardian|ready|declined`); `p_expected_roster_version` T3 ↔ T5 aynı.
- **Orantı:** kod gövdesi yok; algoritma yalnız sıralama olarak (T2 Step 3) verildi.
