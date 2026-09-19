# TechApp — Implementation Plan

2026-09-19 · v1 · Canlı durum için: `IMPLEMENTATION-STATUS.md`

## 1. Current state (incelemede bulunan gerçek durum)
| Kaynak | Yer | Durum |
|---|---|---|
| Tasarım paketi v0.1 (prototip, 30 SVG, tokens, ürün/teknik belgeler) | `design-source/` (özgün paket Intechne arşivinde) | Tarayıcı prototipi; `127.0.0.1:8765`'te çalışıyordu, DOM + görsel olarak incelendi |
| TechApp v4 (Expo 52 / RN 0.76 / Nav 6, 33 ekran, ~3.700 satır) | Intechne arşivi (`TechApp-Mobile-v4-FINAL.zip`); bu depoya kopyalanmadı | Lockfile yok, hiç derlenmemiş, backend çağrısı yok. P0: client-only auth, demo guardian bypass, varsayılan kaptan rolü, demo billing. P1'ler kod üzerinde doğrulandı |
| v5 iskeleti (yalnız `package.json`, Expo 57) | — | Boş; kullanılmadı |

## 2. Kararlar
- **SDK:** v4'ün Expo 52'si destek dışı ve hiç build almamış → "upgrade" yerine Expo SDK 57 (npm `latest`, RN 0.86, React 19) temiz iskelet + taşıma. Sürümler `expo install` ile çözüldü, `expo-doctor` 21/21.
- **Router:** React Navigation korunur (6→7, SDK gereği). expo-router'a geçilmez.
- **Reuse:** v4'ün ekran kapsamı, alan modelleri (takım rolleri, görev durumları, amaç bazlı izin fikri), Türkçe içerik tonu, `secure.ts` niyeti. **Replace:** `AppContext` (otorite olan yerel state), mock veri, tema (Be Vietnam/Fraunces → Open Circuit), Ionicons, auth/guardian/verify/billing/matching demo mantıkları.
- **Repo:** hafif monorepo, workspace aracı yok: `apps/mobile`, `apps/guardian-web`, `apps/admin` (Faz 5), `supabase/`, `design-source/`, `docs/`.
- **Backend:** Supabase (Auth + Postgres + Storage + Edge Functions). Yetki = RLS + `SECURITY DEFINER` RPC. Docker olmadığı için testler gömülü Postgres + Supabase shim ile, yerel geliştirme PostgREST + GoTrue-uyumlu dev gateway ile yapılır; staging/production gerçek Supabase projesidir.

## 3. Target architecture
```
apps/mobile (Expo dev build: iOS · Android/GMS · Android/HMS)      apps/admin (Next.js, Faz 5)
   design-system → features/* → lib (supabase, errors, storage)        kurum / organizatör / Intechne
                         \                                             /
                 Supabase Auth (e-posta OTP)  ·  PostgREST + RLS  ·  RPC (atomik işlemler)
                         |                         |
              Edge Functions (guardian-dispatch, delete-account)   Storage (private: evidence, avatars)
                         |
        apps/guardian-web (statik veli onay sayfası; token URL fragment'ında)
```
State: sunucu verisi TanStack Query; yerel yalnız UI (filtre, sheet, form, onboarding tercihleri, pending intent).

## 4. Database & RLS (özet — ayrıntı `docs/DATABASE.md`)
Migrations: `0100 foundation` (profiles/profile_private, interests, organizations, audit, bootstrap RPC) · `0200 events` (events, sessions, registrations, check-ins, guardian_requests, consents + RPC'ler) · `0300 reference_data` · `0400 ecosystem` (teams, opportunities/applications, experiences/attestations, courses, bookmarks, notifications, devices, moderation) · `0500 storage`.
İlkeler: kayıt/başvuru/rol/doğrulama tablolarına istemciden yazma yok; event satırı kilidiyle kapasite; partial unique index + idempotency key; yayın = platform onayı; kurumlar yalnız kendi içerik ve kendilerine yapılan başvuru snapshot'ını görür; genç profilleri sorgulanamaz; QR = HMAC, PII yok.

## 5. Auth & guardian (ayrıntı `docs/AUTH.md`, `docs/GUARDIAN-CONSENT.md`)
Misafir keşif → korumalı eylemde `PendingIntent` kaydedilir → e-posta → OTP → `my_account_state` → gerekirse profil bootstrap (doğum tarihi tek sefer) → kaldığı eyleme dönüş. Veli onayı etkinlik bazlı (`guardian_required_under`), token yalnız service role ile üretilir, 72 saat, tek kullanımlık, geri çekilebilir.

## 6. Migration strategy (v4 → v5)
Ekran ekran kopya değil, faz faz taşıma: her v4 modülü önce şema+RPC+test, sonra feature klasörü, en son ekran. Eşleme tablosu `docs/PRODUCT-SCOPE.md`. Fonla/Wallet/ücretli eğitim/TechRank/AI Coach `env.features` arkasında, pilotta kapalı. ARENO için yalnız arayüz; sözleşme gelmeden API yazılmaz.

## 7. Phases
0 Audit & bootstrap → 1 Design system → 2 Auth + onboarding → 3 Discovery → 4 Event pilot → 5 Admin pilot → 6 Opportunities → 7 Community/teams → 8 Profile/experience → 9 Learning → 10 Release hardening. Her faz: checklist → uygulama → typecheck/lint/test → çalışan uygulamada doğrulama → status + docs güncellemesi.

**Sıradaki işler (öncelik sırasıyla)**
1. Gerçek Supabase projesine `db push` + Edge Function deploy + OTP/SMTP; `supabase gen types` ile `database.types.ts`'i üret.
2. iOS simülatör + Android emülatör dev build (disk açılınca veya EAS Build); VoiceOver/TalkBack, 320 px, büyük yazı turu.
3. Faz 5 mini admin: login, etkinlik CRUD + yayın onayı, kayıt listesi/review, web check-in, audit görünümü.
4. Faz 4 kalanı: takım kaydı, hatırlatma (push izni bağlamında), katılım geçmişi, kaydet (bookmark) UI.
5. Faz 6–9 mobil ekranları (RPC'ler hazır): başvuru + paylaşım önizlemesi, takım profili/katılma/Takımım görevleri, deneyim + doğrulama, öğrenme.
6. Maestro E2E: yeni kullanıcı → onboarding → kayıt → OTP → profil → registration → kart.

## 8. Dependencies & risks
| Risk | Etki | Önlem |
|---|---|---|
| Native build bu makinede alınamadı (disk) | Q kriteri açık | EAS Build veya disk temizliği; web önizleme yalnız ara doğrulama |
| Yerel auth gateway ≠ gerçek GoTrue | OTP kenar durumları | İlk iş staging Supabase'de tekrar test |
| Elle yazılmış DB tipleri | Şema kayması | Tip üretimi CI adımı |
| `expo-camera` barkod tarama HMS'te | Huawei check-in | Elle kod girişi mevcut; HMS cihaz testi |
| Veli doğrulama gücü (yalnız e-posta) | Hukuki yeterlilik | Hukukla netleşene kadar metin "draft" sürümlü; model yöntem alanını taşıyor |
| E-posta teslimi | Veli akışı kilitlenir | Resend/SMTP + yeniden gönder + süre/limit |
| Edge Functions + storage migration çalıştırılmadı | Deploy sürprizi | Staging'de ilk deploy kontrol listesi (`docs/DATABASE.md`) |

## 9. Acceptance criteria
İlk milestone: §47 A–R (tablo `IMPLEMENTATION-STATUS.md`). Biri eksikse Event Pilot tamamlanmış sayılmaz.
