-- TechApp · WORST-CASE development seed (break-ui). EVERYTHING HERE IS FAKE.
--
-- Loaded ONLY by `npm run db:dev -- --reset --worst-case` (supabase/dev/start.mjs), and only into the embedded
-- LOCAL Postgres. It is not loaded by `npm run db:test`, and the start script refuses to run it against anything
-- but the local embedded database. Never load this file into staging or production.
--
-- Every row carries is_demo = true (the last statement fails the whole load otherwise). Every value is either
-- something a real organiser could type or the longest value the column's CHECK accepts. Where the schema is
-- stricter than the break-ui catalog, the schema wins and the case is covered by the client fixture instead:
--   * organisations / teams need >= 2 characters and events / courses >= 4, so the one-letter NAME lives in
--     apps/mobile/src/dev/fixtures/worstCase.ts (and the 2-character names here are the shortest the schema allows);
--   * events.city / events.venue have no length limit (unbounded: tested with a long but believable address).
-- Dates are relative to now() so "past / today / tomorrow" stay true whenever the stack is created.
-- Fixed UUIDs (prefix a0f*) + on conflict do nothing: idempotent.

-- ---------------------------------------------------------------- organisations
insert into public.organizations (id, slug, name, type, tagline, about, website, verification, verified_at, is_demo) values
  -- 108 characters, Turkish capitals İ/Ş/Ğ inside, verified
  ('00000000-0000-4000-a0f0-000000000001', 'wc-uzun-kurum-adi',
   'Türkiye Bilimsel ve Teknolojik Araştırma Kurumu Bilim ve Toplum Destek Programları Başkanlığı Gençlik Birimi', 'public_institution',
   'Kurum adı, sloganı ve açıklaması şemanın izin verdiği en uzun biçimde: gerçek kurumların resmî adları da bu kadar uzar.',
   'Bu kayıt en kötü durum testi içindir; gerçek bir kurumu temsil etmez.', 'https://example.org/wc-uzun-kurum', 'verified', now(), true),
  -- 2 characters: the shortest name the schema accepts
  ('00000000-0000-4000-a0f0-000000000002', 'wc-kisa-kurum', 'Öz', 'company', null, null, null, 'unverified', null, true),
  -- one unbreakable word + emoji
  ('00000000-0000-4000-a0f0-000000000003', 'wc-kirilmaz-kurum', 'Mühendislikbilimleriuygulamalarımerkezi 🤖', 'university',
   'Boşluksuz uzun sözcük + emoji', null, null, 'unverified', null, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- events
-- 1  title at the 120-char limit, long venue/city/audience, 12 345 / 12 345 seats with a 999-person waitlist, paid
-- 2  4-character title, online, no city / venue / audience / description / poster line, no capacity, registration closes tomorrow
-- 3  unbreakable single-word title, long organisation, 1/1 seats and no waitlist: full
-- 4  emoji title, registration already closed, event tomorrow
-- 5  deadline today (3 hours left), 999 seats with 998 taken
-- 6  already over (past), free
-- 7  dotted/dotless I, İ ı Ş Ğ Ü Ö Ç in one title; 6000-character description
-- 8  non-Latin (Arabic + Japanese) title
insert into public.events
  (id, organization_id, slug, title, poster_line, summary, description, type, format, topic_interest_id, tone,
   city, venue, online_url, starts_at, ends_at, registration_opens_at, registration_closes_at,
   capacity, waitlist_enabled, requires_review, registration_mode, min_age, max_age, guardian_required_under,
   audience_note, fee_minor_units, cancellation_policy, support_contact, status, published_at, seats_taken, waitlist_count, is_demo)
values
  ('00000000-0000-4000-a0f1-000000000001', '00000000-0000-4000-a0f0-000000000001', 'wc-uzun-baslikli-yaz-okulu',
   'Uluslararası Gençlik Teknoloji, Robotik, Yapay Zekâ ve Sürdürülebilir Kalkınma Yaz Okulu Final Sunumları ve Ödül Töreni',
   E'Şehit Öğretmen Ayşe Çağlayan\nanısına: Ğ Ü Ö Ç İ Ş ı',
   'Özet alanı şemanın izin verdiği 280 karaktere yakın: Türkiye genelinden gelen takımlar üç gün boyunca jüri önünde sunum yapar, atölyelere katılır, mentorlarla birebir görüşür ve ödül töreninde bir araya gelir; tüm oturumlar altyazılıdır ve kayıt gerektirir.',
   'Açıklama alanı kısa tutuldu; 6000 karakterlik sürüm ayrı bir kayıtta (7).',
   'conference', 'in_person', (select id from public.interests where slug = 'teknoloji'), 'iris',
   'Kahramanmaraş · Pazarcık · Yeşilyurt Mahallesi', 'Şehit Öğretmen Ayşe Çağlayan Çok Amaçlı Gençlik ve Spor Salonu · Zemin Kat Konferans Salonu B Blok',
   null, now() + interval '20 days', now() + interval '22 days', now() - interval '30 days', now() + interval '15 days',
   12345, true, false, 'both', 14, null, 18,
   'Lise 9–12. sınıf ve üniversite 1–2. sınıf öğrencileri · takım kaptanları · mentörler · öğretmen danışmanlar',
   12345000, 'Etkinlikten 48 saat öncesine kadar kaydını uygulamadan iptal edebilirsin.', 'destek@example.org',
   'published', now(), 12345, 999, true),

  ('00000000-0000-4000-a0f1-000000000002', '00000000-0000-4000-a0f0-000000000002', 'wc-kisa-cevrimici',
   'Ğ-26', null, 'Bu kayıtta şehir, mekân, hedef kitle, açıklama ve kontenjan yok.', null,
   'workshop', 'online', null, 'moss',
   null, null, 'https://example.org/wc/kisa',
   now() + interval '3 days', now() + interval '3 days 2 hours', null, now() + interval '1 day',
   null, true, false, 'individual', null, null, null,
   null, 0, null, null, 'published', now(), 0, 0, true),

  ('00000000-0000-4000-a0f1-000000000003', '00000000-0000-4000-a0f0-000000000003', 'wc-kirilmaz-tek-sozcuk',
   'Mühendislikbilimleriuygulamalarıhackathonu', E'Mühendislikbilimleri-\nuygulamaları', 'Tek sözcükten oluşan, hiçbir yerinden bölünemeyen bir başlık.', null,
   'hackathon', 'in_person', (select id from public.interests where slug = 'muhendislik'), 'ink',
   'İstanbul', 'Mühendislikbilimleriuygulamalarımerkezi Kampüsü', null,
   now() + interval '9 days', now() + interval '10 days', null, now() + interval '8 days',
   1, false, false, 'individual', 16, 24, 18,
   'Üniversite', 0, null, null, 'published', now(), 1, 0, true),

  ('00000000-0000-4000-a0f1-000000000004', '00000000-0000-4000-a0f0-000000000001', 'wc-emoji-kapali-kayit',
   '🤖 Robo Kızlar 🚀 Yarışması ✨', E'🤖 Takımını kur 🚀', 'Kayıtlar dün kapandı; etkinlik yarın.', 'Emoji içeren başlık ve poster satırı.',
   'competition', 'in_person', (select id from public.interests where slug = 'robotik'), 'apricot',
   'Ankara', 'Örnek Spor Salonu', null,
   now() + interval '1 day', now() + interval '1 day 8 hours', now() - interval '20 days', now() - interval '1 day',
   40, true, true, 'team', 13, 19, 18,
   'Lise takımları', 5000, null, 'destek@example.org', 'published', now(), 31, 4, true),

  ('00000000-0000-4000-a0f1-000000000005', '00000000-0000-4000-a0f0-000000000001', 'wc-son-gun-bugun',
   'Son Gün Bugün Atölyesi', E'Kapanışa\n3 saat var.', 'Kayıt kapanışı bugün, bir kontenjan kaldı.', null,
   'training', 'hybrid', (select id from public.interests where slug = 'yazilim'), 'iris',
   'İzmir', 'Örnek Kongre Merkezi', 'https://example.org/wc/son-gun',
   now() + interval '5 days', now() + interval '5 days 3 hours', null, now() + interval '3 hours',
   999, true, false, 'individual', 15, null, 18,
   'Tüm seviyeler', 0, null, null, 'published', now(), 998, 0, true),

  ('00000000-0000-4000-a0f1-000000000006', '00000000-0000-4000-a0f0-000000000002', 'wc-gecmis-etkinlik',
   'Geçen Hafta Biten Meetup', E'Bitti.\nKayıtlar kapalı.', 'Bitmiş bir etkinlik de listede görünebilir.', null,
   'meetup', 'in_person', (select id from public.interests where slug = 'robotik'), 'moss',
   'Bursa', 'Örnek Bilim Merkezi', null,
   now() - interval '7 days', now() - interval '7 days' + interval '3 hours', now() - interval '30 days', now() - interval '8 days',
   60, false, false, 'individual', null, null, null,
   null, 0, null, null, 'published', now(), 60, 0, true),

  ('00000000-0000-4000-a0f1-000000000007', '00000000-0000-4000-a0f0-000000000001', 'wc-turkce-buyuk-kucuk-harf',
   'IĞDIR İÇİN Işıl Işıklı Şeker Öğrenci Çağrısı: ığdır ılgaz İstanbul', E'ıİ  şŞ  ğĞ\nüÜ  öÖ  çÇ',
   'Noktalı ve noktasız I, ş, ğ, ü, ö, ç büyük/küçük harf dönüşümlerini bir arada sınar: IĞDIR / ığdır, İSTANBUL / İstanbul.',
   (select string_agg('Takımlar sahada üç gün boyunca otonom robotlarını sınar, jüri her turdan sonra geri bildirim verir.', ' ') from generate_series(1, 55)),
   'festival', 'in_person', (select id from public.interests where slug = 'teknoloji'), 'apricot',
   'Iğdır', 'Işıl Işıklı Şeker Fabrikası Kültür Merkezi', null,
   now() + interval '12 days', now() + interval '13 days', null, now() + interval '11 days',
   300, true, false, 'both', null, null, 16,
   'Herkese açık', 25000, null, 'etkinlik@example.org', 'published', now(), 120, 0, true),

  ('00000000-0000-4000-a0f1-000000000008', '00000000-0000-4000-a0f0-000000000003', 'wc-latin-disi',
   'ورشة عمل الروبوتات للشباب · ロボット工学ワークショップ', null, 'Arapça ve Japonca karışık başlık: sağdan sola ve çok baytlı karakterler.', null,
   'workshop', 'online', null, 'ink',
   null, null, 'https://example.org/wc/latin-disi',
   now() + interval '6 days', now() + interval '6 days 2 hours', null, now() + interval '5 days',
   200, true, false, 'individual', 13, null, 18,
   null, 0, null, null, 'published', now(), 17, 0, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- opportunities
-- deadlines: past, today, tomorrow, far; reward 122 chars; 12 skills; nothing optional filled
insert into public.opportunities
  (id, organization_id, slug, title, summary, description, type, topic_interest_id, tone, city, is_remote,
   audience_note, skills, min_age, max_age, guardian_required_under, closes_at, apply_url, reward_note, team_based,
   shared_fields, status, published_at, is_demo)
values
  ('00000000-0000-4000-a0f3-000000000001', '00000000-0000-4000-a0f0-000000000001', 'wc-uzun-baslikli-hibe',
   'Uluslararası Gençlik Teknoloji, Robotik, Yapay Zekâ ve Sürdürülebilir Kalkınma Projeleri Hibe ve Ödül Programı 2027',
   'Özet 280 karakterin altında ama uzun: hibe, mentorluk ve ekipman desteğiyle genç takımların ilk çalışan prototiplerini üretmelerini hedefleyen çok aşamalı bir program; başvurular iki turda değerlendirilir ve finalistler jüri karşısında sunum yapar.',
   null, 'grant', (select id from public.interests where slug = 'teknoloji'), 'iris', 'Kahramanmaraş · Afşin', false,
   'Lise 9–12. sınıf ve üniversite 1–2. sınıf öğrencileri · takım kaptanları · mentörler · öğretmen danışmanlar',
   array['Python','C/C++','Arduino','ROS 2','OpenCV','CAD','3D baskı','Devre tasarımı','Sunum','Proje yönetimi','Takım çalışması','İngilizce'],
   14, 26, 18, now() + interval '25 days', 'https://example.org/wc/uzun-hibe',
   'Birinciye 250.000 TL nakit ödül, yurt dışı fuar gezisi, 6 ay mentorluk, ekipman desteği ve Teknofest finalinde sahne hakkı',
   true, array['display_name','email','education_stage','school_name','city','experiences'], 'published', now(), true),

  ('00000000-0000-4000-a0f3-000000000002', '00000000-0000-4000-a0f0-000000000002', 'wc-son-tarihi-gecmis',
   'Süresi Dünden Dolan Burs', 'Son başvuru tarihi geçmiş bir çağrı hâlâ listede görünebilir.', null,
   'scholarship', null, 'ink', null, true, null, '{}', null, null, null, now() - interval '2 days', null, null, false,
   array['display_name'], 'published', now(), true),

  ('00000000-0000-4000-a0f3-000000000003', '00000000-0000-4000-a0f0-000000000002', 'wc-son-gun-bugun',
   'Son Gün Bugün Staj Çağrısı', 'Başvuru bugün 23:59 değil, üç saat sonra kapanıyor.', null,
   'internship', (select id from public.interests where slug = 'yazilim'), 'moss', 'İstanbul', false, null,
   array['Python'], 18, null, null, now() + interval '3 hours', null, null, false, array['display_name','education_stage'], 'published', now(), true),

  ('00000000-0000-4000-a0f3-000000000004', '00000000-0000-4000-a0f0-000000000003', 'wc-yarin-emoji',
   '🚀 Yarın Kapanan Girişim Programı ✨', 'Emoji içeren başlık; son başvuru yarın.', null,
   'entrepreneurship', (select id from public.interests where slug = 'girisimcilik'), 'apricot', null, true,
   'Üniversite + mezun', array['Girişimcilik','Sunum'], 18, 29, null, now() + interval '1 day', 'https://example.org/wc/yarin',
   '🏆 İlk 3 takıma mentorluk', false, array['display_name','email'], 'published', now(), true),

  ('00000000-0000-4000-a0f3-000000000005', '00000000-0000-4000-a0f0-000000000001', 'wc-ekip-yarismasi',
   'Ğ-Lig Robot Yarışması', 'Takım başvurusu; ödül alanı boş.', null,
   'competition', (select id from public.interests where slug = 'robotik'), 'moss', 'Ankara', false,
   'Lise takımları', array['Robotik'], 13, 19, 18, now() + interval '9 days', null, null, true,
   array['display_name','school_name'], 'published', now(), true),

  ('00000000-0000-4000-a0f3-000000000006', '00000000-0000-4000-a0f0-000000000003', 'wc-kirilmaz-odul',
   'Mühendislikbilimleriuygulamalarıödülü', 'Başlığın tamamı tek sözcük.', null,
   'award', (select id from public.interests where slug = 'muhendislik'), 'ink', null, true, null, '{}', null, null, null,
   now() + interval '40 days', 'https://example.org/wc/odul', 'Mühendislikbilimleriuygulamalarıödülü: 1.000.000 TL', false,
   array['display_name'], 'published', now(), true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- teams and communities
-- member_count 12 345 / 999 / 1 / 0; one 2-char name; nothing optional filled
insert into public.teams
  (id, organization_id, slug, name, kind, category, tagline, about, city, topic_interest_id, tone, accepts_join_requests, member_count, is_demo)
values
  ('00000000-0000-4000-a0f4-000000000001', '00000000-0000-4000-a0f0-000000000001', 'wc-uzun-takim-adi',
   'Şehit Öğretmen Ayşe Çağlayan Mesleki ve Teknik Anadolu Lisesi Robotik Takımı', 'team',
   'Robotik ve yapay zekâ yarışma takımı · lise',
   'Tagline 160 karakterin sınırında: sezon boyunca haftada üç gün atölyede buluşan, yazılım, mekanik ve elektronik ekipleriyle çalışan takım.',
   'Örnek en kötü durum takımı.', 'Kahramanmaraş · Afşin', (select id from public.interests where slug = 'robotik'), 'moss', true, 12345, true),
  ('00000000-0000-4000-a0f4-000000000002', null, 'wc-kisa-takim', 'Ğ.', 'team', null, null, null, null, null, 'iris', false, 0, true),
  ('00000000-0000-4000-a0f4-000000000003', null, 'wc-tek-uyeli-takim', 'Işık', 'team', 'Ekip', 'Tek kişilik başlangıç.', null, 'Iğdır', null, 'apricot', true, 1, true),
  ('00000000-0000-4000-a0f4-000000000004', '00000000-0000-4000-a0f0-000000000003', 'wc-emoji-topluluk',
   '🤖 Robo Kızlar 🚀 Topluluğu ✨', 'community', 'Üretici topluluğu', 'Emoji içeren ad.', null, null, null, 'iris', true, 999, true),
  ('00000000-0000-4000-a0f4-000000000005', null, 'wc-kirilmaz-takim', 'Mühendislikbilimleriuygulamalarıtakımı', 'team',
   'Mühendislikbilimleriuygulamalarıkategorisi', null, null, 'Mühendislikbilimleriuygulamalarışehri', null, 'ink', true, 12, true),
  ('00000000-0000-4000-a0f4-000000000006', null, 'wc-latin-disi-topluluk', 'مجتمع الروبوتات · ロボット部', 'community', null, null, null, null, null, 'moss', true, 40, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- courses
insert into public.courses
  (id, organization_id, slug, title, poster_line, summary, level, topic_interest_id, tone, estimated_minutes, status, published_at, is_demo)
values
  ('00000000-0000-4000-a0f5-000000000001', null, 'wc-uzun-baslikli-kurs',
   'Sıfırdan Gömülü Sistemlere, Oradan Otonom Robotlara: Yapay Zekâ Destekli Sensör Füzyonu ve Kontrol Kuramı Uygulamaları',
   E'Sensörden karara,\nkarardan harekete.', 'Süre 6000 dakika (100 saat), seviye ileri.', 'advanced',
   (select id from public.interests where slug = 'robotik'), 'ink', 6000, 'published', now(), true),
  ('00000000-0000-4000-a0f5-000000000002', null, 'wc-bir-dakikalik-kurs', 'Ğ-26', null, 'Süre 1 dakika, poster satırı yok.', 'beginner', null, 'moss', 1, 'published', now(), true),
  ('00000000-0000-4000-a0f5-000000000003', null, 'wc-emoji-kurs', '🚀 Roket Biliminin ABC''si ✨', null, 'Emoji içeren başlık, süre belirtilmemiş.', 'intermediate',
   (select id from public.interests where slug = 'teknoloji'), 'apricot', null, 'published', now(), true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- guard: nothing in this file may be a real (non-demo) row
do $$
declare bad int;
begin
  select
    (select count(*) from public.organizations where id::text like '00000000-0000-4000-a0f%' and not is_demo)
  + (select count(*) from public.events        where id::text like '00000000-0000-4000-a0f%' and not is_demo)
  + (select count(*) from public.opportunities where id::text like '00000000-0000-4000-a0f%' and not is_demo)
  + (select count(*) from public.teams         where id::text like '00000000-0000-4000-a0f%' and not is_demo)
  + (select count(*) from public.courses       where id::text like '00000000-0000-4000-a0f%' and not is_demo)
  into bad;
  if bad > 0 then raise exception 'worst-case seed: % row(s) without is_demo = true', bad; end if;
end $$;
