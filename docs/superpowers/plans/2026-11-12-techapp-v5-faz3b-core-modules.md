# TechApp V5 · Faz 3b — Eksik temel modüller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pilot sonrası ürünün eksik temel modüllerini tek tek, her biri tek başına yayınlanabilir şekilde tamamlamak:
pilot borçları + gizlilik açığı, kapak görselleri, zengin takım profili ve açık roller, kaydedilenler, uygulama içi
bildirimler, ayarlar ve gizlilik, öğrenme, birleşik arama, kurum profili ve içerik bildirme.

**Architecture:** Her modül önce sunucu (migration + RLS + RPC + vitest), sonra mobil (feature klasörü + jest + ekran görüntüsü).
Kart/ekran görselliği Faz 4'ün onaylı kart ailesini kullanır; Faz 4 önizleme kapısı bu fazdan önce geçmediyse mevcut
`Card`/`ListCard` ile yapılır ve Faz 4'te yeniden giydirilir (davranış değişmez). Push yok; bildirimler yalnız uygulama içi.

**Tech Stack:** PostgreSQL + Supabase Storage + pg_cron · Vitest/embedded-postgres · Expo SDK 57 · `expo-image` (ilk kullanım: Task 4) · `expo-image-picker` (Task 5, karar bekliyor) · React Navigation 7 · TanStack Query · Vite admin.

**Spec:** `docs/superpowers/specs/2026-11-11-techapp-v5-design.md` (§2 hedef 3, §4 Kapak/Takım profili/Kaydedilenler/Bildirimler/Ayarlar/Öğrenme/Arama, §5) · Yol haritası: `docs/superpowers/plans/2026-11-12-techapp-v5-roadmap.md`

## Global Constraints

- Dal: her modül kendi dalında (`feat/v5-<modül>`), pilot etiketinden ya da bir önceki birleşmiş modülden; `main`'e doğrudan yazılmaz. Destructive git yok (stash dahil).
- Yeni bağımlılık yalnız `npx expo install` (mobil) ve yalnız onu ilk kullanan task'ta (spec §8a-7). expo-doctor 21/21 kalır.
- Yeni tablo = aynı migration'da RLS + test. Uygulanmış migration düzenlenmez. `SECURITY DEFINER` + `search_path = ''`.
- Storage politikaları gömülü test DB'de yoktur (`…000500_storage.sql` no-op): bucket/politika davranışı **staging remote regresyonu** ile kanıtlanır (push kullanıcı onayıyla).
- Renk/ölçü/font hardcode yok; durum metni `Status.tsx`; hata metni `errors.ts` `COPY`; `errorCopyCoverage` yeşil.
- 18 yaş altı adı/fotoğrafı takım dışına çıkmaz; bildirim metinlerinde PII yok (yalnız içerik başlığı); PII URL/log/analytics'e yazılmaz.
- Hukuki metin uydurulmaz: Yardım/Yasal yalnız `WEB_ORIGIN` + `/destek`, `/gizlilik`, `/kosullar` bağlantısıdır.
- Her task: `npm run db:test` (DB), `npm --prefix apps/mobile run verify` (mobil), `npm --prefix apps/admin run typecheck` (admin) yeşil; UI ekranda görülmeden (web önizleme 390 + 320, gerektiğinde Android emülatör) bitmez.
- Ton: "Kaydettin." ✔ · "İçerik başarıyla kaydedilmiştir." ✘

## Review Focus

1. **Yayından kalkan hedef:** kaydedilmiş / bildirimi gelmiş bir etkinlik iptal edilir ya da incelemeye düşer → Kaydedilenler ve bildirim satırı çökmeden "artık yayında değil" der, dokununca 404 ekranı değil açıklama gösterir (Task 8, 10 testleri).
2. **Hatırlatma çift gönderimi:** cron iki kez üst üste çalışır ya da etkinlik saati değişir → kullanıcı başına etkinlik başına tek 24 saat hatırlatması (Task 9 testi).
3. **Arama girdisi:** `%`, `_`, `,`, `(`, `)` ve Türkçe büyük/küçük harf (`İSTANBUL` / `istanbul`) — PostgREST filtresi kırılmaz, enjeksiyon yok, sonuç bulunur (Task 13 testi).
4. **Kapak yolu sahteciliği:** başka kurumun klasörüne yükleme ya da başka etkinliğin kapak yolunu bağlama → RLS/RPC reddeder (Task 3 testi + staging regresyonu).
5. **Reşit olmayan kaptan / üye:** takım profilinde, açık rol başvurusunda ve bildirimlerde 18 yaş altı kişinin adı takım dışına sızmaz; 18+ ama `discoverable=false` kaptanın adı da görünmez (Task 6 testi).

---

### Task 1: Pilot borçları (ledger'daki ertelenmiş küçükler)

**Files:** Modify: `apps/mobile/src/features/profile/{ProfileScreen.tsx,profileStats.ts}`, `apps/mobile/src/features/events/{api.ts,RegistrationStatusScreen.tsx}`, `apps/mobile/src/features/checkin/CheckInScreen.tsx`, `apps/mobile/src/design-system/components/Status.tsx`, `apps/mobile/src/lib/__tests__/errorCopyCoverage.test.ts`; ilgili `__tests__`

**Interfaces:** Produces `eventKeys.card(userId: string | null, registrationId: string)`; `checkInResultView` (Status.tsx, CheckIn ekranındaki iki ayrıntı metni buraya taşınır).

- [ ] **Step 0:** `.superpowers/sdd/2026-11-11-techapp-v5-phase1-2/progress.md`'deki "minor (deferred)" satırlarından pilot sırasında kapananları çıkar; kalanları bu task'ın kapsamı olarak commit mesajına yaz.
- [ ] **Step 1: Failing testler:**
  - profil: sayaç etiketi "Katılım" (a11y etiketi "N katıldığı etkinlik" kalır); `onRefresh` hem CV'yi hem kayıtları yeniden çeker.
  - kayıt durumu: veli sorgusu yalnız `event_eligibility.guardian_required === true` iken çalışır (yetişkinde istek yok); eligibility beklenirken çizgi 4 adımlı iskeletle çizilir (3→4 kayma yok); veli sorgusu hata verirse adım gizlenmez, satır içi "Veli durumu alınamadı · Tekrar dene" gösterir; yenileme veli sorgusunu koşulsuz yeniler.
  - `eventKeys.card` `userId` içerir; oturum geç gelse de ilk yüklemede çevrimdışı yedek kart bulunur.
  - `errorCopyCoverage`: aynı kod iki farklı status ile fırlatılıyorsa her ikisi de raporlanır (Map anahtarı `status:code`).
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** `verify` yeşil; web'de profil ve yetişkin `confirmed` durum ekranı görüntüsü.
- [ ] **Step 5: Commit** `fix(mobile): pilot sonrası küçük borçlar — Katılım etiketi, yenileme, veli sorgusu, kart önbellek anahtarı`

### Task 2: `teams.created_by` / `recruitment_posts.created_by` gizlilik düzeltmesi

**Files:** Create: `supabase/migrations/YYYYMMDDHHMMSS_hide_creator_columns.sql`; Modify: `supabase/tests/pilot-privacy.test.ts`, `supabase/tests/remote/security-regression.sql` (20–20b), `apps/mobile/src/features/teams/api.ts`, `apps/mobile/src/features/discovery/DiscoverScreen.tsx` (`fetchPreview`), `apps/mobile/src/lib/database.types.ts`

**Interfaces:** Produces `TEAM_PUBLIC_COLUMNS`, `RECRUITMENT_POST_COLUMNS` (string sabitleri, `features/teams/api.ts`); istemcide `teams`/`recruitment_posts` için `select('*')` kalmaz.

- [ ] **Step 1: Failing testler** (`pilot-privacy.test.ts`): `it('anon and a non-member cannot select teams.created_by or recruitment_posts.created_by (permission denied)')`; `it('the public column list of teams still reads for anon')`; `it('create_team and recruitment RPCs still work (definer path unaffected)')`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Migration: tablo düzeyi `select` yetkisi `anon, authenticated`'tan alınır, `created_by` hariç kolon listesine verilir (iki tablo). Mobil sorgular sabit kolon listesine geçer; `jest` sorgu testlerinde `select('*')` araması (grep testi) `features/teams` ve `features/discovery` için 0.
- [ ] **Step 4:** `db:test` + `verify` yeşil; web'de Topluluk ve takım detayı açılıyor (regresyon görüntüsü).
- [ ] **Step 5:** Staging push + regresyon 20–20b **kullanıcı onayıyla**; `KNOWN-ISSUES.md`'deki "Açık" maddesi kapatılır.
- [ ] **Step 6: Commit** `fix(db): takım ve ilan kurucusu kimliği herkese açık okunmaz; istemci kolon listesine geçti`

### Task 3: Kapak görselleri — sunucu

**Files:** Create: `supabase/migrations/YYYYMMDDHHMMSS_covers.sql`, `supabase/tests/covers.test.ts`; Modify: `supabase/tests/remote/security-regression.sql` (22–22e)

**Interfaces:**
- Produces: `events|opportunities|teams` kolonları `cover_path text check (cover_path ~ '^(events|opportunities|teams)/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')`, `cover_blurhash text check (char_length(cover_blurhash) between 6 and 100)`; `public.set_cover(p_entity text, p_entity_id uuid, p_path text, p_blurhash text) returns void` (`p_path null` = kaldır); public bucket `covers` (`image/webp|jpeg|png`, ≤2 MB).
- Yol sözleşmesi: `events/<organization_id>/<uuid>.webp`, `opportunities/<organization_id>/<uuid>.webp`, `teams/<team_id>/<uuid>.webp`; küçük kopya aynı ad + `-640` son eki (`<uuid>-640.webp`). Görsel dönüştürme servisi kullanılmaz (ücretli plan özelliği; karar: yükleyen iki boyut üretir).

- [ ] **Step 1: Failing testler** (`covers.test.ts`): kurumun `owner|admin|editor` üyesi kendi etkinliğine kapak bağlar; başka kurumun klasör öneki → 403 `cover_path_forbidden`; etkinlik ile klasör kurumu uyuşmazsa 403; takımda yalnız etkin `captain` (mentor 403); platform admini her şeye; `cover_path`'i doğrudan `update events set cover_path` ile yazmak → reddedilir (trigger: yalnız `set_cover` yolu, `app.cover_write` bayrağı); **yayındaki** etkinlik/fırsatta kapak değişimi `content_revisions` satırı üretir ve `status = 'in_review'` (cover_path kritik alan — spec §4); takım kapağı değişimi `audit_events`'e düşer, yayın durumu yok.
- [ ] **Step 2:** FAIL → **Step 3:** migration (kolonlar, trigger, `set_cover`, `app.event_critical_fields()`/`opportunity_critical_fields()`'e `cover_path`; storage bucket + `storage.objects` politikaları `to_regnamespace('storage')` korumalı blokta: insert/update/delete yalnız klasör sahibine, select herkese) → **Step 4:** `db:test` PASS.
- [ ] **Step 5:** Staging push (onaylı) → regresyon 22–22e: anon `covers`'tan okur; başka kurum klasörüne `storage.objects` insert reddedilir; MIME/boyut sınırı (bucket ayarı) okunur.
- [ ] **Step 6: Commit** `feat(db): kapak görselleri — covers bucket, kurum/takım kapsamlı yazma, yeniden inceleme bağlantısı`

### Task 4: Kapak görselleri — admin yükleme + mobil gösterim

**Files:**
- Admin: Create `apps/admin/src/components/CoverField.tsx`, `apps/admin/src/cover.ts`, `apps/admin/src/cover.test.ts` (+ `vitest` devDependency ve `test` script'i admin'e); Modify `apps/admin/src/pages/{EventForm.tsx,OpportunityForm.tsx}`, `apps/admin/package.json`
- Mobil: Create `apps/mobile/src/design-system/components/CoverImage.tsx`, `apps/mobile/src/lib/covers.ts`, `apps/mobile/src/design-system/__tests__/coverImage.test.tsx`, `apps/mobile/src/lib/__tests__/covers.test.ts`; Modify `design-system/index.ts`, `design-system/components/Content.tsx` (Poster), `features/events/{EventDetailScreen.tsx,labels.ts,api.ts}`, `features/opportunities/{OpportunityDetailScreen.tsx,OpportunityCardView.tsx,api.ts}`, `features/teams/TeamCover.tsx`, `apps/mobile/package.json`

**Interfaces:**
- Produces (admin): `coverObjectPath(entity: 'events'|'opportunities', ownerId: string, id: string, size: 'full'|'thumb'): string`; `prepareCover(file: File): Promise<{ full: Blob; thumb: Blob; blurhash: string }>` (1600 px ve 640 px genişlik, webp, `blurhash` npm ile 4×3 bileşen); dosya >2 MB veya tür dışı → `CoverError` `'too_large'|'bad_type'`.
- Produces (mobil): `coverUrl(path: string | null, size: 'full'|'thumb'): string | null` (`${supabaseUrl}/storage/v1/object/public/covers/…`); `<CoverImage path blurhash fallback={{ tone, icon, eyebrow, line }} aspect={16/10} />`.

- [ ] **Step 1: Failing testler:** admin `cover.test.ts`: yol formatı DB check regex'iyle birebir; 2 MB üstü/yanlış tür reddi. Mobil: `coverUrl(null) === null`; thumb son eki; `CoverImage` path yoksa Open Circuit yedek posterini (tür ikonu + devre çizgisi, dekoratif yuvarlak kare **yok**) çizer; `onError` → yedek; görsel `accessible={false}` (başlık zaten metin).
- [ ] **Step 2:** FAIL → **Step 3:** `npx expo install expo-image`; uygula (`cachePolicy="memory-disk"`, `placeholder={{ blurhash }}`, `transition` yalnız reduced motion kapalıyken 160 ms). Listelerde `thumb`, detayda `full`.
- [ ] **Step 4:** `verify` + `doctor` 21/21 + admin typecheck/test; yerel yığında admin'den kapak yükle → mobil web'de liste + detay; kapaksız etkinlik yedek poster (ekran görüntüleri 390/320).
- [ ] **Step 5: Commit** `feat: kapak görselleri — admin yükleme (iki boyut + blurhash), mobilde expo-image ve Open Circuit yedek posteri`

### Task 5: Takım kapağı mobilde kaptan için (karar bekliyor)

> `expo-image-picker` yeni izin beyanı demektir (iOS `NSPhotoLibraryUsageDescription`; Android 13+ sistem seçicisi izinsiz). Kullanıcı onaylamazsa bu task atlanır, takım kapağı yedek posterle kalır.

**Files:** Create `apps/mobile/src/features/teams/{TeamCoverEditorScreen.tsx,coverUpload.ts}`, `__tests__/coverUpload.test.ts`; Modify `apps/mobile/app.json` (izin metni), `navigation/types.ts` (`TeamCoverEditor: { teamId: string }`), `features/teams/TeamWorkspaceScreen.tsx`

**Interfaces:** Produces `uploadTeamCover(teamId: string, asset: { uri: string; width: number; height: number }): Promise<void>` (`expo-image-manipulator` ile 1600/640 webp — o da `npx expo install`; `Image.generateBlurhashAsync`; `set_cover('teams', …)`).

- [ ] **Step 1–4:** test (kaptan değilse giriş noktası yok; yükleme hatasında dürüst hata, yarım kapak bağlanmaz: önce iki dosya, sonra `set_cover`) → FAIL → uygula → `verify` + `doctor`; Android emülatörde seçici + yükleme ekran görüntüsü.
- [ ] **Step 5: Commit** `feat(mobile): kaptan takım kapağını değiştirebilir`

### Task 6: Zengin takım profili — sunucu

**Files:** Create `supabase/migrations/YYYYMMDDHHMMSS_team_profile.sql`, `supabase/tests/team-profile.test.ts`

**Interfaces:**
- Produces: `teams.category_key text not null default 'other' check (category_key in ('robotics','software','entrepreneurship','science','design','social_impact','media','other'))` (mevcut `category` serbest etiket olarak kalır; migration anahtar kelimeyle geri doldurur, eşleşmeyen `other`); tablo `public.team_projects(id, team_id, title 3–120, summary ≤600, year int 2000–2100, url text check '^https://', cover_path null, created_at, updated_at)` + RLS (okuma: takım `moderation_status='active'` ise herkese; yazma yok); `public.upsert_team_project(p_team_id uuid, p_project_id uuid null, p_title text, p_summary text, p_year int, p_url text) returns public.team_projects`, `public.delete_team_project(p_project_id uuid) returns void` (yalnız etkin kaptan/mentor); `public.team_public_profile(p_team_id uuid) returns jsonb` → `{ member_count, role_counts: {captain, mentor, member}, leaders: [{display_name, role}], projects_count, events: [{id, title, starts_at}] }` — `leaders` yalnız 18+ **ve** `discoverable` kaptan/mentor; `events` yalnız Faz 3a varsa `confirmed` takım kayıtlarından, yoksa boş dizi. `reports.target_type` check'ine `team_project` eklenir.

- [ ] **Step 1: Failing testler:** 16 yaşındaki kaptan `leaders`'ta yok; 18+ `discoverable=false` mentor yok; 18+ `discoverable=true` kaptan var; `role_counts` toplamı `member_count`; üye olmayan proje ekleyemez (403); `url` `javascript:` → check ihlali; askıya alınmış takımın projeleri anon'a görünmez; `category_key` geri doldurma: "FRC takımı"/"Robotik" → `robotics`.
- [ ] **Step 2–4:** FAIL → uygula → `db:test` PASS.
- [ ] **Step 5: Commit** `feat(db): takım profili — kategori anahtarı, projeler, rol dağılımı, yalnız 18+ keşfedilebilir liderler`

### Task 7: Zengin takım profili ve açık roller — mobil

**Files:** Create `apps/mobile/src/features/teams/{TeamProjectEditorScreen.tsx,RecruitmentPostEditorScreen.tsx,RecruitmentApplySheet.tsx,categoryIcon.ts}`, `__tests__/{categoryIcon.test.ts,teamProfile.test.tsx,recruitment.test.tsx}`; Modify `features/teams/{TeamDetailScreen.tsx,TeamWorkspaceScreen.tsx,labels.ts,api.ts}`, `features/community/CommunityScreen.tsx`, `features/discovery/DiscoverScreen.tsx` (MiniCard ikonu), `navigation/types.ts` (`TeamProjectEditor: { teamId: string; projectId?: string }`, `RecruitmentPostEditor: { teamId: string; postId?: string }`)

**Interfaces:** Produces `categoryIcon(key: TeamCategoryKey, kind: 'team'|'community'): TechIconName` — `robotics→robot, software→code, entrepreneurship→rocket, science→leaf, design→spark, social_impact→community, media→play, other→team (community türünde other→community)`; robot **yalnız** robotics.

- [ ] **Step 1: Failing testler:** `categoryIcon('entrepreneurship','team') === 'rocket'`, `robot` yalnız `robotics` için; takım detayı bölüm sırası Hakkında → Rol dağılımı → Açık roller → Projeler → Etkinlikler, boş bölüm gizlenir ama "Açık roller" boşken tek satır açıklama kalır; liderler listesinde yalnız sunucunun döndürdüğü adlar; açık role başvuru (`apply_to_recruitment`) misafirde giriş ister, ikinci başvuruda sunucu kodu `COPY` ile gösterilir; kaptan Takım alanında ilan aç/kapat (`recruitment_posts` mevcut politika) ve başvuruyu karara bağlar (`decide_recruitment_application`); "Takımım" kısayolu Topluluk başlığında yalnız etkin üyelik varsa.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; web'de (worst-case seed: uzun takım adı, 0 ve 999 üye, 0 proje) takım detayı + Takım alanı ilan yönetimi ekran görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): zengin takım profili — kategori ikonu, rol dağılımı, projeler, açık roller ve başvuru`

### Task 8: Kaydedilenler

**Files:** Create `apps/mobile/src/features/saved/{api.ts,useBookmarks.ts,SavedScreen.tsx}`, `__tests__/{useBookmarks.test.tsx,savedScreen.test.tsx}`; Modify `features/opportunities/{useFollow.ts→ silinir, OpportunitiesScreen.tsx, DeadlinesScreen.tsx, OpportunityDetailScreen.tsx}`, `features/events/{EventsListScreen.tsx,EventDetailScreen.tsx}`, `features/discovery/DiscoverScreen.tsx`, `features/teams/TeamDetailScreen.tsx`, `features/community/CommunityScreen.tsx`, `features/profile/ProfileScreen.tsx` (giriş), `navigation/types.ts` (`ProfileStackParamList.Saved: undefined`)

**Interfaces:** Produces `type BookmarkType = 'event'|'opportunity'|'team'|'course'`; `useBookmarks(type: BookmarkType): { ids: Set<string>; toggle(id: string): void; pending: boolean; requiresAuth: boolean }` (iyimser güncelleme + hata olursa geri al + toast); `fetchSaved(): Promise<SavedItem[]>`, `SavedItem = { type: BookmarkType; id: string; title: string | null; available: boolean }`.

- [ ] **Step 1: Failing testler:** misafir kaydet → `AuthEmail` + `pendingIntent` ile dönüşte kayıt tamamlanır; iyimser dolu ikon, sunucu hatasında geri döner + `COPY` toast; aynı id'ye hızlı çift dokunuş tek sonuç; Kaydedilenler tür filtresi (Tümü/Etkinlik/Fırsat/Takım/Eğitim); yayından kalkmış hedef `available=false` → soluk satır "Artık yayında değil" + "Listeden çıkar"; Son tarihler ekranı fırsat yer imlerinden beslenmeye devam eder (davranış değişmez, `useFollow` testleri `useBookmarks`'a taşınır).
- [ ] **Step 2–4:** FAIL → uygula → `verify`; web'de dört türde kaydet + Kaydedilenler (boş, dolu, filtreli-boş) ekran görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): kaydedilenler — tüm kartlarda kaydet, Profil > Kaydedilenler`

### Task 9: Uygulama içi bildirimler — sunucu

**Files:** Create `supabase/migrations/YYYYMMDDHHMMSS_notifications.sql`, `supabase/tests/notifications.test.ts`

**Interfaces:**
- Produces: `app.notification_copy(p_kind text, p_content_title text) returns table(title text, body text)` — Türkçe metin **tek kaynak burada** (push da aynı satırı gönderecek; kural: hata metinleri istemcide, bildirim metinleri sunucuda — rapor karar 4); `app.notify(p_user uuid, p_kind text, p_target_type text, p_target_id uuid, p_content_title text) returns void`; tablo `public.notification_preferences(user_id pk, event_reminders boolean default true, updated_at)` + RLS (yalnız kendi satırını okur; yazma RPC); `public.set_notification_preferences(p_event_reminders boolean) returns public.notification_preferences`; `public.mark_notifications_read(p_ids uuid[] default null) returns int` (null = hepsi); `app.queue_event_reminders() returns int`; benzersiz kısmi indeks `(user_id, kind, target_id) where kind = 'event.reminder_24h'`; cron `techapp-event-reminders` (`*/15 * * * *`) ve `techapp-prune-notifications` (okunmuş ve 90 günden eski satırları siler — **süre kullanıcı kararı**, saklama politikasıyla uyumlu olmalı).
- Türler: `registration.confirmed`, `registration.promoted`, `registration.rejected`, `registration.expired`, `guardian.denied`, `application.status_changed`, `team_join.accepted`, `team_join.rejected`, `team_join.requested` (kaptan/mentora; isteyenin adı **yok**), `event.reminder_24h`, `event.cancelled`.

- [ ] **Step 1: Failing testler:** her tetikleyici için bir test (`it('pending_guardian → confirmed creates registration.confirmed for the participant only')` …); `waitlisted → confirmed` → `registration.promoted`; veli onayı tek olay üretir: kayıt `confirmed`'a geçtiği için yalnız `registration.confirmed` (ayrı "veli onayladı" bildirimi yok), veli reddi → `guardian.denied`; başlık/gövdede kişi adı, e-posta, yaş yok (`notification_copy` tüm türler için regex: `@` ve profildeki `display_name` geçmez); hatırlatma: başlangıcı 23–25 saat sonra olan `confirmed` kayıtlara bir kez, cron iki kez koşunca yine bir; `event_reminders=false` → hatırlatma yok ama işlem bildirimleri var; `starts_at` değişince yeni pencerede tekrar gönderilmez (aynı hedef, aynı tür); kullanıcı başkasının bildirimini okuyamaz/işaretleyemez; `notification_read_only` ham hatası artık istemciye ulaşmaz (doğrudan update yolu kapatılır, `mark_notifications_read` tek yol).
- [ ] **Step 2–4:** FAIL → uygula → `db:test` PASS. Faz 3a birleştiyse takım kaydı türleri burada eklenir (3a planındaki not).
- [ ] **Step 5: Commit** `feat(db): uygulama içi bildirimler — durum tetikleyicileri, 24 saat hatırlatması, okundu ve tercih RPC'leri`

### Task 10: Uygulama içi bildirimler — mobil

**Files:** Create `apps/mobile/src/features/notifications/{api.ts,NotificationsScreen.tsx,route.ts}`, `__tests__/{route.test.ts,notificationsScreen.test.tsx}`; Modify `design-system/components/Screen.tsx` (`AppHeader` sağ yuvaya rozetli `IconButton`), `features/discovery/DiscoverScreen.tsx`, `features/profile/ProfileScreen.tsx`, `navigation/types.ts` (`DiscoverStackParamList.Notifications`, `ProfileStackParamList.Notifications`)

**Interfaces:** Produces `notificationRoute(n: { target_type: string | null; target_id: string | null; kind: string }): { tab: keyof MainTabParamList; screen: string; params: object } | null`; `useUnreadCount(): number` (odak + uygulama ön plana gelince yenilenir; realtime yok — karar); `formatBadge(n: number): string` (`0 → ''`, `1–99 → 'n'`, `≥100 → '99+'`).

- [ ] **Step 1: Failing testler:** `formatBadge(0) === ''`, `(100) === '99+'`; rozetin a11y etiketi "Bildirimler, 3 okunmamış"; satıra dokununca önce `mark_notifications_read([id])` sonra rota; rota yoksa (silinmiş hedef) satır yine okundu olur ve "Bu içerik artık yok" toast'u; "Tümünü okundu say" yalnız okunmamış varken; liste: Bugün / Bu hafta / Daha önce grupları; misafirde zil gösterilmez.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; web'de boş, 1 okunmamış, 120 okunmamış (rozet `99+`) ekran görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): bildirimler ekranı ve okunmamış rozeti`

### Task 11: Ayarlar ve gizlilik

**Files:** Create `apps/mobile/src/features/settings/{SettingsScreen.tsx,NotificationSettingsScreen.tsx,PrivacyScreen.tsx,ConsentCenterScreen.tsx,api.ts,labels.ts}`, `__tests__/{settings.test.tsx,consentCenter.test.tsx}`; Modify `features/profile/ProfileScreen.tsx` (hesap bölümü Ayarlar'a taşınır, Profil'de tek "Ayarlar" girişi), `features/profile/CvShareCard.tsx` (Gizlilik'e taşınır), `navigation/types.ts`, `lib/domain.ts` (`WEB_PATHS = { support: '/destek', privacy: '/gizlilik', terms: '/kosullar', deleteAccount: '/hesap-silme' }`)

**Interfaces:** Produces `consentPurposeLabel(purpose: string): string` (bugün yazılan amaçlar `event_participation`, `application_data_sharing`; bilinmeyen amaç → "Diğer izin" + ham sürüm, uydurma açıklama yok); `consentAction(c: ConsentRow): { kind: 'cancel_registration'|'withdraw_application'|'none'; target?: string }` — rıza merkezi genel bir "geri çek" RPC'si **eklemez**: katılım rızası kaydı iptal ederek, başvuru rızası başvuruyu geri çekerek geri alınır (dürüst ve mevcut RPC'lerle).

- [ ] **Step 1: Failing testler:** Ayarlar bölümleri: Hesap (e-posta salt okunur, Çıkış, Hesabı sil — mevcut akış), Bildirimler, Dokunsal geri bildirim (anahtar `PrefsProvider.update({ haptics })` çağırır; doğrudan `setHapticsEnabled` çağrısı yok), Gizlilik, Rıza merkezi, Yardım, Yasal, sürüm satırı; keşfedilebilirlik anahtarı `my_account_state.is_minor === true` iken yok, yerine "18 yaşını doldurduğunda açabilirsin" metni; sunucu `discoverable_requires_adult` dönerse `COPY` metni; rıza merkezi sürüm (`policy_version`), veren (Sen / Velin), tarih, geri çekildiyse tarihini gösterir; aktif katılım rızasında eylem "Kaydı iptal et" → `RegistrationStatus`; Yardım/Yasal `openExternalUrl(WEB_ORIGIN + path)`; uygulama içinde hukuki metin yok.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; web'de yetişkin ve 16 yaş hesaplarıyla Ayarlar + Gizlilik + Rıza merkezi ekran görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): ayarlar ve gizlilik — bildirim tercihleri, haptic, keşfedilebilirlik (18+), rıza merkezi, yardım ve yasal bağlantılar`

### Task 12: Öğrenme (Gelişim)

**Files:** Create `apps/mobile/src/features/learning/{api.ts,CourseListScreen.tsx,CourseDetailScreen.tsx,LessonScreen.tsx,lessonBody.ts}`, `__tests__/{lessonBody.test.ts,learning.test.tsx}`; Modify `features/discovery/DiscoverScreen.tsx` ("Gelişim" bölümü), `features/events/EventDetailScreen.tsx` ("Bu etkinliğe hazırlan"), `navigation/types.ts` (`SharedLearningParamList`: `CourseList`, `CourseDetail: { courseId }`, `Lesson: { courseId; lessonId }` Keşfet ve Etkinlikler yığınlarına)

**Interfaces:** Produces `splitLessonBody(body: string): string[]` (boş satırla paragraf; markdown işlenmez — karar); `useCourseProgress(courseId)`; tamamlama `complete_lesson(p_lesson_id)` (mevcut RPC, idempotent).

- [ ] **Step 1: Failing testler:** `splitLessonBody` CRLF/çoklu boş satır; misafir ders okuyabilir ama "Tamamladım" giriş ister; tamamlama sonrası ilerleme yüzdesi sunucudan; ders sırası `sort_order`; etkinlikte `event_courses` yoksa "Bu etkinliğe hazırlan" yok; Keşfet "Gelişim" bölümü yayınlı kurs yoksa gizli.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; web'de seed'deki 3 kursla liste/detay/ders + ilerleme ekran görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): Gelişim — kurs listesi, detay, ders ve ilerleme; etkinlikte "Bu etkinliğe hazırlan"`

### Task 13: Birleşik arama

**Files:** Create `apps/mobile/src/features/search/{api.ts,query.ts,SearchScreen.tsx}`, `__tests__/{query.test.ts,searchScreen.test.tsx}`; Modify `features/discovery/DiscoverScreen.tsx` (arama alanı `SearchScreen`'e gider), `navigation/types.ts` (`DiscoverStackParamList.Search: undefined`)

**Interfaces:** Produces `normalizeQuery(raw: string): string | null` (trim, ≤60 karakter, <2 karakter → null); `toIlikePattern(q: string): string` (`\`, `%`, `_` kaçışlı, PostgREST `or()` için `,()` içeren girdi `.ilike()` tekil filtreleriyle sorgulanır, `or()` dizesine gömülmez); `searchAll(q: string): Promise<{ events: Hit[]; opportunities: Hit[]; teams: Hit[]; courses: Hit[] }>` (dört paralel sorgu, her biri 5 sonuç, kolon listeleri Task 2 sabitleri).

- [ ] **Step 1: Failing testler:** `toIlikePattern('100%_robot')` kaçışlı; `normalizeQuery(' a ')` null; `supabase/tests/search.test.ts` Türkçe `İ/ı` ile `ilike` davranışını sabitler (`'İSTANBUL'` → `'İstanbul'` satırı bulunur mu); bulunmuyorsa `searchAll` ikinci desen olarak `q.toLocaleLowerCase('tr')` ile de sorgular ve sonuçları id'ye göre birleştirir (test iki yolu da kapsar); grup başına "Tümünü gör" yalnız 5 sonuç varsa; bir grup hata verirse diğerleri gösterilir + o grupta satır içi hata; 300 ms debounce, eski istek sonucu yenisini ezmez (`queryKey` sorgu dizesi).
- [ ] **Step 2–4:** FAIL → uygula → `verify` + `db:test`; web'de sonuçlu, sonuçsuz, kısmi hata ekran görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): birleşik arama — etkinlik, fırsat, takım ve eğitim gruplu`

### Task 14: Kurum profili ve içerik bildirme

**Files:** Create `apps/mobile/src/features/organizations/{api.ts,OrganizationScreen.tsx}`, `apps/mobile/src/features/reports/{api.ts,ReportSheet.tsx}`, `__tests__/{organization.test.tsx,report.test.tsx}`, `supabase/tests/reports.test.ts`; Modify `design-system/components/Content.tsx` (`OrganizerRow` `onPress`), etkinlik/fırsat/takım/proje/ilan detayları ("Bildir" menüsü), `navigation/types.ts`

**Interfaces:** Produces `submitReport(input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string }): Promise<void>` (mevcut `reports_insert_own` politikası; açık rapor varken ikinci rapor sunucu benzersiz indeksinden `already_reported` → `COPY`).

- [ ] **Step 1: Failing testler:** kurum ekranı: ad, doğrulama rozeti, hakkında, yayınlı etkinlik ve fırsatları (logo yoksa `mark` ikonu); misafir bildiremez (giriş ister); aynı hedefe ikinci rapor dürüst mesaj; DB: raporlayan kendi raporunu okur, başkasınınkini okuyamaz.
- [ ] **Step 2–4:** FAIL → uygula → `verify` + `db:test`; web ekran görüntüleri.
- [ ] **Step 5: Commit** `feat(mobile): kurum profili ve içerik bildirme` — mağaza incelemesi (kullanıcı içeriği: takım/proje/ilan) için Faz 6 Task 8'in ön koşulu.

### Task 15: Belgeler

**Files:** Modify `IMPLEMENTATION-STATUS.md`, `docs/KNOWN-ISSUES.md`, `docs/PRODUCT-SCOPE.md` (Notifications, Trainings, Lesson, ConsentCenter, Help, Legal, Companies, CreateRecruit, RecruitDetail satırları), `docs/DATABASE.md`

- [ ] **Step 1:** Her modülün durumu ölçüme dayalı yazılır (✅ yalnız test + ekran görüntüsü kanıtıyla; cihazda denenmediyse "cihazda denenmedi").
- [ ] **Step 2: Commit** `docs: Faz 3b modülleri — durum, kapsam eşlemesi, veri modeli`

---

## Self-review (yazar notu)

- **Spec kapsamı:** kapaklar (T3–5), takım profili (T6–7), kaydedilenler (T8), bildirimler + 24 saat hatırlatma + rozet (T9–10, push yok), ayarlar/gizlilik/haptic/18+ keşfedilebilirlik/CV/rıza/yardım/yasal (T11), öğrenme + `event_courses` (T12), birleşik arama (T13); ledger: Katılım etiketi, onRefresh, veli sorgusu titremesi, kart anahtarı, CheckIn metinleri, `errorCopyCoverage` (T1), `created_by` (T2). v4 kapsamı (kural 4): CompanyDetail, CreateRecruit, RecruitDetail (T7, T14).
- **Faz 4'e bırakılan ledger maddeleri:** fırsatta `competition` robot ikonu, OTP hatasında kalkan ikonu, saat glifi rozeti, çevrimdışı etiketinin apricot tonu (ikon/renk anlamı). **Faz 5'e:** check-in sonucu çift okuma.
- **Tip tutarlılığı:** `BookmarkType` T8 ↔ T13 `Hit` türleri; `TEAM_PUBLIC_COLUMNS` T2 → T7, T13; `coverUrl` T4 → Faz 4 `PosterCard`.
- **Bağımsız yayın:** T1, T2, T8, T11, T12, T13, T14 tek başına; T4 T3'e, T5 T4'e, T7 T6'ya, T10 T9'a bağlı.
