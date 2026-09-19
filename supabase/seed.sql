-- TechApp · development seed. EVERYTHING HERE IS FAKE.
-- All rows carry is_demo = true and organisations are named "Örnek …" / "Intechne (demo)".
-- Never load this file into production. Idempotent: fixed UUIDs + on conflict do nothing.
-- No auth.users rows are required; create test accounts through the normal OTP flow.

-- ---------------------------------------------------------------- organisations
insert into public.organizations (id, slug, name, type, tagline, about, website, verification, verified_at, is_demo) values
  ('00000000-0000-4000-a000-000000000001', 'intechne-demo', 'Intechne (demo)', 'intechne',
   'Gençlerin teknolojiyle ürettiği bir ekosistem.',
   'Bu kayıt geliştirme ortamı için oluşturulmuş örnek bir organizasyondur.', 'https://example.org/intechne-demo',
   'verified', now(), true),
  ('00000000-0000-4000-a000-000000000002', 'ornek-teknoloji-studyosu', 'Örnek Teknoloji Stüdyosu', 'company',
   'Ürün geliştiren küçük ve meraklı bir ekip.',
   'Örnek şirket. Gerçek bir kurumu temsil etmez.', 'https://example.org/ornek-studyo', 'verified', now(), true),
  ('00000000-0000-4000-a000-000000000003', 'ornek-sosyal-etki-atolyesi', 'Örnek Sosyal Etki Atölyesi', 'ngo',
   'Teknolojiyi toplumsal fayda için kullanan gönüllüler.',
   'Örnek sivil toplum kuruluşu. Gerçek bir kurumu temsil etmez.', 'https://example.org/ornek-atolye', 'verified', now(), true),
  ('00000000-0000-4000-a000-000000000004', 'ornek-universite-girisim-merkezi', 'Örnek Üniversite Girişim Merkezi', 'university',
   'Fikirden ilk prototipe giden yolda yanındayız.',
   'Örnek üniversite birimi. Gerçek bir kurumu temsil etmez.', 'https://example.org/ornek-girisim', 'verified', now(), true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- events (12, Oct–Dec 2026)
insert into public.events
  (id, organization_id, slug, title, poster_line, summary, description, type, format, topic_interest_id, tone,
   city, venue, online_url, starts_at, ends_at, registration_opens_at, registration_closes_at,
   capacity, waitlist_enabled, requires_review, registration_mode, min_age, max_age, guardian_required_under,
   audience_note, cancellation_policy, support_contact, status, published_at, is_demo)
values
  ('00000000-0000-4000-a001-000000000001', '00000000-0000-4000-a000-000000000001', 'iyi-bir-gelecek-hackathonu',
   'İyi Bir Gelecek Hackathonu', E'Bir fikir.\nGerçek bir etki.',
   'Bir toplumsal soruna teknolojiyle çözüm üret. Takımını kur, fikrini çalışan bir prototipe dönüştür.',
   'İki gün boyunca farklı disiplinlerden gençlerle bir araya gel. Mentorlar yanında olacak; kod yazmayı bilmen şart değil, merak etmen yeterli. Yemek ve atölye malzemeleri bizden.',
   'hackathon', 'in_person', (select id from public.interests where slug = 'teknoloji'), 'iris',
   'İstanbul', 'Örnek Kampüs · Ana Salon', null,
   '2026-10-17 09:30+03', '2026-10-18 18:00+03', '2026-09-15 10:00+03', '2026-10-14 23:59+03',
   120, true, false, 'both', 14, null, 18, 'Lise + üniversite',
   'Etkinlikten 48 saat öncesine kadar kaydını uygulamadan iptal edebilirsin.', 'destek@example.org',
   'published', now(), true),

  ('00000000-0000-4000-a001-000000000002', '00000000-0000-4000-a000-000000000001', 'robotik-takimlari-bulusmasi',
   'Robotik Takımları Buluşması', E'Takımını bul.\nBirlikte üret.',
   'Robotik takımlarıyla tanış. Yazılım, mekanik ve elektronikte deneyimini paylaş, yeni sezona takım arkadaşı bul.',
   'Takım standları, kısa sunumlar ve serbest tanışma saatleri. Takımı olmayanlar için açık rol panosu kurulacak.',
   'meetup', 'in_person', (select id from public.interests where slug = 'robotik'), 'moss',
   'İstanbul', 'Örnek Atölye', null,
   '2026-10-24 11:00+03', '2026-10-24 16:00+03', null, '2026-10-22 23:59+03',
   80, true, false, 'both', 13, null, 18, 'Lise + üniversite',
   'Gelemeyeceksen kaydını iptal et; yerin bekleme listesindeki birine geçsin.', 'destek@example.org',
   'published', now(), true),

  ('00000000-0000-4000-a001-000000000003', '00000000-0000-4000-a000-000000000003', 'kent-icin-bir-fikir',
   'Kent İçin Bir Fikir', E'Küçük adımlar.\nOrtak gelecek.',
   'Yaşadığın kentte değiştirmek istediğin bir şey var mı? İhtiyacı keşfet, uygulanabilir bir çözüm tasarla.',
   'Çevrim içi bir tasarım oturumu. Küçük gruplarda çalışacak, sonunda fikrini iki dakikada anlatacaksın.',
   'social_impact', 'online', (select id from public.interests where slug = 'sosyal_etki'), 'apricot',
   null, null, 'https://example.org/canli/kent-icin-bir-fikir',
   '2026-10-31 13:00+03', '2026-10-31 17:00+03', null, '2026-10-30 18:00+03',
   null, true, false, 'individual', 13, null, 16, 'Tüm seviyeler',
   'Çevrim içi etkinliklerde iptal için son saat yok.', 'destek@example.org',
   'published', now(), true),

  ('00000000-0000-4000-a001-000000000004', '00000000-0000-4000-a000-000000000004', 'fikirden-ilk-prototipe',
   'Fikirden İlk Prototipe', E'Aklındaki fikre\nbir şans ver.',
   'Bir fikri nasıl sınarsın? Hedef kullanıcını tanımla, ilk görüşmelerini planla, prototipe başlayacak kadar netleş.',
   'Üç saatlik uygulamalı atölye. Yanında bir fikir getirmen yeterli; olgun olması gerekmiyor.',
   'workshop', 'online', (select id from public.interests where slug = 'girisimcilik'), 'ink',
   null, null, 'https://example.org/canli/fikirden-prototipe',
   '2026-11-07 14:00+03', '2026-11-07 17:00+03', null, '2026-11-06 20:00+03',
   60, true, false, 'individual', 15, null, 18, 'Tüm seviyeler',
   null, 'destek@example.org', 'published', now(), true),

  ('00000000-0000-4000-a001-000000000005', '00000000-0000-4000-a000-000000000001', 'cizgi-izleyen-robot-yarismasi',
   'Çizgi İzleyen Robot Yarışması', E'Pist hazır.\nSıra sende.',
   'Kendi robotunla piste çık. Başlangıç ve ileri seviye olmak üzere iki kategori var.',
   'Teknik kontrol sabah yapılır. Kurallar ve pist ölçüleri kayıt sonrası paylaşılır. Takım kaydı kaptan veya mentor tarafından yapılır.',
   'competition', 'in_person', (select id from public.interests where slug = 'robotik'), 'moss',
   'Ankara', 'Örnek Spor Salonu', null,
   '2026-11-14 09:00+03', '2026-11-14 18:00+03', '2026-10-01 10:00+03', '2026-11-05 23:59+03',
   40, true, true, 'team', 13, 19, 18, 'Lise takımları',
   'Takım kayıtları son başvuru tarihine kadar geri çekilebilir.', 'destek@example.org',
   'published', now(), true),

  ('00000000-0000-4000-a001-000000000006', '00000000-0000-4000-a000-000000000002', 'genc-urun-gelistiriciler-konferansi',
   'Genç Ürün Geliştiriciler Konferansı', E'Üretenler\nanlatıyor.',
   'Tasarımcılar, yazılımcılar ve ürün yöneticileri ilk işlerinde öğrendiklerini anlatıyor.',
   'Bir gün, altı konuşma, bol soru-cevap. Konuşmalar kayıt altına alınmayacak; sorularını hazırlayıp gel.',
   'conference', 'hybrid', (select id from public.interests where slug = 'yazilim'), 'iris',
   'İzmir', 'Örnek Kongre Merkezi', 'https://example.org/canli/genc-urun',
   '2026-11-21 10:00+03', '2026-11-21 17:30+03', null, '2026-11-19 23:59+03',
   300, true, false, 'individual', 16, null, 18, 'Üniversite + genç mezun',
   null, 'etkinlik@example.org', 'published', now(), true),

  ('00000000-0000-4000-a001-000000000007', '00000000-0000-4000-a000-000000000001', 'arduino-ile-ilk-devren',
   'Arduino ile İlk Devren', E'Bir LED yak.\nGerisi gelir.',
   'Hiç devre kurmadıysan doğru yerdesin. Üç saatte ilk sensörlü projeni çalıştır.',
   'Malzemeler atölyede hazır olacak. Bilgisayarını getirmen yeterli. Kontenjan küçük tutuldu ki herkese vakit kalsın.',
   'training', 'in_person', (select id from public.interests where slug = 'muhendislik'), 'apricot',
   'Bursa', 'Örnek Bilim Merkezi', null,
   '2026-11-28 13:00+03', '2026-11-28 16:00+03', null, '2026-11-26 23:59+03',
   16, true, false, 'individual', 13, 17, 18, 'Lise · başlangıç seviyesi',
   'Kontenjan az; gelemeyeceksen lütfen en geç bir gün önce iptal et.', 'destek@example.org',
   'published', now(), true),

  ('00000000-0000-4000-a001-000000000008', '00000000-0000-4000-a000-000000000001', 'techapp-uretim-senligi',
   'TechApp Üretim Şenliği', E'Merak et.\nDene. Göster.',
   'Atölyeler, gösteri maçları ve proje sergisi. Ailenle ya da takımınla gel.',
   'Gün boyu açık alan etkinliği. Proje sergisine katılmak isteyen takımlar ayrıca başvurur.',
   'festival', 'in_person', (select id from public.interests where slug = 'teknoloji'), 'ink',
   'İstanbul', 'Örnek Etkinlik Parkı', null,
   '2026-12-05 10:00+03', '2026-12-06 18:00+03', null, '2026-12-04 23:59+03',
   1500, false, false, 'both', null, null, 16, 'Herkese açık',
   null, 'destek@example.org', 'published', now(), true),

  ('00000000-0000-4000-a001-000000000009', '00000000-0000-4000-a000-000000000003', 'acik-veriyle-iyilik-atolyesi',
   'Açık Veriyle İyilik Atölyesi', E'Veri var.\nSoru senden.',
   'Açık veri setleriyle mahallen hakkında bir soru sor, cevabını birlikte görselleştirelim.',
   'Temel tablo bilgisi yeterli. Çalışmalar açık lisansla paylaşılacak.',
   'workshop', 'hybrid', (select id from public.interests where slug = 'sosyal_etki'), 'moss',
   'Ankara', 'Örnek Gençlik Merkezi', 'https://example.org/canli/acik-veri',
   '2026-12-12 11:00+03', '2026-12-12 15:00+03', null, '2026-12-10 23:59+03',
   45, true, false, 'individual', 15, null, 18, 'Lise + üniversite',
   null, 'gonullu@example.org', 'published', now(), true),

  ('00000000-0000-4000-a001-000000000010', '00000000-0000-4000-a000-000000000004', 'yatirimci-karsisinda-ilk-sunum',
   'Yatırımcı Karşısında İlk Sunum', E'Üç dakika.\nBir fikir.',
   'Fikrini üç dakikada anlat, gerçek geri bildirim al. Yarışma değil; prova.',
   'Başvurular değerlendirilir ve 20 ekip sunuma davet edilir. 18 yaş ve üzeri katılımcılar içindir.',
   'meetup', 'in_person', (select id from public.interests where slug = 'girisimcilik'), 'iris',
   'İstanbul', 'Örnek Girişim Merkezi', null,
   '2026-12-15 18:30+03', '2026-12-15 21:00+03', null, '2026-12-08 23:59+03',
   20, true, true, 'individual', 18, null, null, 'Üniversite + mezun · 18+',
   null, 'girisim@example.org', 'published', now(), true),

  ('00000000-0000-4000-a001-000000000011', '00000000-0000-4000-a000-000000000002', 'arayuz-tasarimina-giris',
   'Arayüz Tasarımına Giriş', E'İyi tasarım\nsoru sorar.',
   'Bir ekranı nasıl okursun, nasıl sadeleştirirsin? Örnekler üzerinden birlikte bakıyoruz.',
   'İki saatlik çevrim içi oturum. Kayıt olanlara çalışma dosyası önceden gönderilir.',
   'training', 'online', (select id from public.interests where slug = 'tasarim'), 'apricot',
   null, null, 'https://example.org/canli/arayuz-tasarimi',
   '2026-12-19 15:00+03', '2026-12-19 17:00+03', null, '2026-12-18 20:00+03',
   200, true, false, 'individual', 13, null, null, 'Tüm seviyeler',
   null, 'etkinlik@example.org', 'published', now(), true),

  ('00000000-0000-4000-a001-000000000012', '00000000-0000-4000-a000-000000000001', 'kis-kodlama-maratonu',
   'Kış Kodlama Maratonu', E'24 saat.\nTek hedef.',
   'Takımınla 24 saatte bir açık kaynak araca katkı ver. Uykusuzluk şart değil, plan şart.',
   'Çevrim içi hackathon. Takımlar 2–4 kişi. Ortak bir sunucuda buluşulur, gece boyunca mentor desteği vardır.',
   'hackathon', 'online', (select id from public.interests where slug = 'yazilim'), 'ink',
   null, null, 'https://example.org/canli/kis-maratonu',
   '2026-12-26 10:00+03', '2026-12-27 10:00+03', '2026-11-15 10:00+03', '2026-12-22 23:59+03',
   100, true, false, 'both', 16, null, 18, 'Lise son + üniversite',
   null, 'destek@example.org', 'published', now(), true)
on conflict (id) do nothing;

insert into public.event_sessions (id, event_id, title, starts_at, ends_at, location_note, sort_order) values
  ('00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a001-000000000001', 'Karşılama ve takım kurma', '2026-10-17 09:30+03', '2026-10-17 11:00+03', 'Ana Salon', 1),
  ('00000000-0000-4000-a002-000000000002', '00000000-0000-4000-a001-000000000001', 'Problem seçimi ve mentor eşleşmesi', '2026-10-17 11:00+03', '2026-10-17 13:00+03', 'Atölye Katı', 2),
  ('00000000-0000-4000-a002-000000000003', '00000000-0000-4000-a001-000000000001', 'Üretim zamanı', '2026-10-17 14:00+03', '2026-10-18 13:00+03', 'Atölye Katı', 3),
  ('00000000-0000-4000-a002-000000000004', '00000000-0000-4000-a001-000000000001', 'Sunumlar ve kapanış', '2026-10-18 15:00+03', '2026-10-18 18:00+03', 'Ana Salon', 4),
  ('00000000-0000-4000-a002-000000000005', '00000000-0000-4000-a001-000000000005', 'Teknik kontrol', '2026-11-14 09:00+03', '2026-11-14 10:30+03', 'Giriş Holü', 1),
  ('00000000-0000-4000-a002-000000000006', '00000000-0000-4000-a001-000000000005', 'Sıralama turları', '2026-11-14 10:30+03', '2026-11-14 14:00+03', 'Pist A–B', 2),
  ('00000000-0000-4000-a002-000000000007', '00000000-0000-4000-a001-000000000005', 'Finaller ve ödül töreni', '2026-11-14 15:00+03', '2026-11-14 18:00+03', 'Pist A', 3),
  ('00000000-0000-4000-a002-000000000008', '00000000-0000-4000-a001-000000000006', 'Açılış: İlk işimde ne öğrendim?', '2026-11-21 10:00+03', '2026-11-21 11:00+03', 'Salon 1', 1),
  ('00000000-0000-4000-a002-000000000009', '00000000-0000-4000-a001-000000000006', 'Panel: Tasarımcı ile yazılımcı nasıl anlaşır?', '2026-11-21 11:30+03', '2026-11-21 12:30+03', 'Salon 1', 2),
  ('00000000-0000-4000-a002-000000000010', '00000000-0000-4000-a001-000000000006', 'Soru-cevap ve tanışma', '2026-11-21 16:00+03', '2026-11-21 17:30+03', 'Fuaye', 3),
  ('00000000-0000-4000-a002-000000000011', '00000000-0000-4000-a001-000000000008', '1. gün · Atölyeler ve sergi', '2026-12-05 10:00+03', '2026-12-05 18:00+03', 'Tüm alan', 1),
  ('00000000-0000-4000-a002-000000000012', '00000000-0000-4000-a001-000000000008', '2. gün · Gösteri maçları ve kapanış', '2026-12-06 10:00+03', '2026-12-06 18:00+03', 'Ana sahne', 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- opportunities (8)
insert into public.opportunities
  (id, organization_id, slug, title, summary, description, type, topic_interest_id, tone, city, is_remote,
   audience_note, skills, min_age, max_age, guardian_required_under, closes_at, shared_fields, status, published_at, is_demo)
values
  ('00000000-0000-4000-a003-000000000001', '00000000-0000-4000-a000-000000000002', 'urun-gelistirme-staj-programi',
   'Ürün Geliştirme Staj Programı',
   'Kullanıcı araştırmasından prototipe uzanan süreci deneyimle. Tasarım ve yazılım ekipleriyle gerçek bir projede çalış.',
   'Sekiz haftalık, hibrit bir program. Haftada üç gün ekiple birliktesin. Her stajyerin bir mentoru olur.',
   'internship', (select id from public.interests where slug = 'yazilim'), 'iris', 'İstanbul', false,
   'Üniversite · 18+', array['Ürün düşüncesi', 'Prototipleme', 'Takım çalışması'], 18, null, null,
   '2026-10-30 23:59+03', array['display_name', 'email', 'education_stage', 'school_name', 'city', 'experiences'],
   'published', now(), true),
  ('00000000-0000-4000-a003-000000000002', '00000000-0000-4000-a000-000000000003', 'gencler-icin-kodlama-gonullusu',
   'Gençler İçin Kodlama Gönüllüsü',
   'Akranlarınla temel kodlama atölyeleri hazırla. Kolaylaştırıcı ekibin rehberliğinde açık eğitim içerikleri üret.',
   'Haftada iki saat, çevrim içi. İçerik hazırlama ve atölye kolaylaştırma eğitimi veriyoruz.',
   'volunteering', (select id from public.interests where slug = 'sosyal_etki'), 'moss', null, true,
   'Lise + üniversite', array['Kodlama temelleri', 'Anlatım', 'Sabır'], 15, null, 18,
   '2026-11-05 23:59+03', array['display_name', 'education_stage', 'interests'],
   'published', now(), true),
  ('00000000-0000-4000-a003-000000000003', '00000000-0000-4000-a000-000000000004', 'ilk-fikrim-on-kulucka-programi',
   'İlk Fikrim Ön Kuluçka Programı',
   'Erken aşamadaki fikrini mentorluk oturumlarıyla geliştir. İhtiyacı keşfet, çözümünü test et, ilk sunumunu hazırla.',
   'On haftalık çevrim içi program. Bireysel ya da iki kişilik ekip olarak başvurabilirsin.',
   'entrepreneurship', (select id from public.interests where slug = 'girisimcilik'), 'apricot', null, true,
   'Üniversite + mezun', array['Girişimcilik', 'Kullanıcı görüşmesi', 'Sunum'], 18, 29, null,
   '2026-11-12 23:59+03', array['display_name', 'email', 'education_stage', 'headline', 'bio'],
   'published', now(), true),
  ('00000000-0000-4000-a003-000000000004', '00000000-0000-4000-a000-000000000002', 'genc-yetenek-programi-2027',
   'Genç Yetenek Programı 2027',
   'Altı aylık mentorlu gelişim programı: gerçek ürün ekiplerinde rotasyon.',
   'Programa kabul edilenler üç farklı ekipte ikişer ay çalışır. Değerlendirme portföy ve görüşmeyle yapılır.',
   'talent_program', (select id from public.interests where slug = 'teknoloji'), 'ink', 'İstanbul', false,
   'Son sınıf + genç mezun · 18+', array['Python', 'Problem çözme', 'İletişim'], 18, 27, null,
   '2026-12-01 23:59+03', array['display_name', 'legal_name', 'email', 'phone', 'education_stage', 'school_name', 'experiences'],
   'published', now(), true),
  ('00000000-0000-4000-a003-000000000005', '00000000-0000-4000-a000-000000000001', 'acik-kaynak-robot-kiti-proje-cagrisi',
   'Açık Kaynak Robot Kiti Proje Çağrısı',
   'Okul takımlarının kolayca kurabileceği açık kaynak bir robot kiti tasarlıyoruz. Katkı vermek ister misin?',
   'Mekanik, elektronik, yazılım ve dokümantasyon için ayrı çalışma grupları var. Katkılar açık lisansla yayımlanır.',
   'project_call', (select id from public.interests where slug = 'robotik'), 'moss', null, true,
   'Lise + üniversite', array['CAD', 'Gömülü yazılım', 'Dokümantasyon'], 14, null, 18,
   '2026-11-20 23:59+03', array['display_name', 'education_stage', 'interests', 'experiences'],
   'published', now(), true),
  ('00000000-0000-4000-a003-000000000006', '00000000-0000-4000-a000-000000000003', 'etkinlik-gonullusu-uretim-senligi',
   'Etkinlik Gönüllüsü · Üretim Şenliği',
   'Şenlikte atölye alanlarında ziyaretçilere eşlik et, organizasyonun mutfağını gör.',
   'İki günlük yüz yüze gönüllülük. Öncesinde bir saatlik çevrim içi hazırlık buluşması yapılır.',
   'volunteering', (select id from public.interests where slug = 'kisisel_gelisim'), 'apricot', 'İstanbul', false,
   '16 yaş ve üzeri', array['İletişim', 'Sorumluluk'], 16, null, 18,
   '2026-11-25 23:59+03', array['display_name', 'phone', 'city', 'education_stage'],
   'published', now(), true),
  ('00000000-0000-4000-a003-000000000007', '00000000-0000-4000-a000-000000000002', 'arayuz-tasarimi-yaz-staji',
   'Arayüz Tasarımı Stajı',
   'Mobil ürün ekibinde tasarım sistemine katkı ver; gerçek kullanıcı testlerine katıl.',
   'Altı haftalık, uzaktan. Portföy zorunlu değil; nasıl düşündüğünü gösteren bir çalışma yeterli.',
   'internship', (select id from public.interests where slug = 'tasarim'), 'iris', null, true,
   'Üniversite · 18+', array['Arayüz tasarımı', 'Figma', 'Geri bildirim alma'], 18, null, null,
   '2026-12-10 23:59+03', array['display_name', 'email', 'education_stage', 'headline', 'experiences'],
   'published', now(), true),
  ('00000000-0000-4000-a003-000000000008', '00000000-0000-4000-a000-000000000004', 'sosyal-girisim-fikir-cagrisi',
   'Sosyal Girişim Fikir Çağrısı',
   'Toplumsal bir soruna sürdürülebilir bir çözüm öner. Seçilen fikirlere mentor ve çalışma alanı desteği.',
   'Başvuruda bir sayfalık fikir özeti istenir. Seçim süreci iki aşamalıdır.',
   'project_call', (select id from public.interests where slug = 'sosyal_etki'), 'ink', 'Ankara', false,
   'Üniversite + mezun', array['Problem tanımı', 'Ekip kurma'], 18, null, null,
   '2026-12-20 23:59+03', array['display_name', 'email', 'city', 'bio'],
   'published', now(), true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- teams and communities (6)
insert into public.teams
  (id, organization_id, slug, name, kind, category, tagline, about, city, topic_interest_id, tone, accepts_join_requests, is_demo)
values
  ('00000000-0000-4000-a004-000000000001', null, 'nova-robotik-takimi', 'Nova Robotik Takımı (örnek)', 'team', 'Robotik yarışma takımı',
   'Yazılım ve elektronik takım arkadaşı arıyor.',
   'Lise ve üniversite öğrencilerinden oluşan örnek bir robotik takımı. Sezon boyunca haftada iki gün atölyede buluşuyoruz.',
   'İstanbul', (select id from public.interests where slug = 'robotik'), 'moss', true, true),
  ('00000000-0000-4000-a004-000000000002', null, 'pusula-otonom-araclar', 'Pusula Otonom Araçlar (örnek)', 'team', 'Otonom araç takımı',
   'Görüntü işleme ve kontrol üzerine çalışan üniversite takımı.',
   'Örnek takım. Yeni sezon için görüntü işleme ekibine iki kişi arıyoruz.',
   'Ankara', (select id from public.interests where slug = 'muhendislik'), 'ink', true, true),
  ('00000000-0000-4000-a004-000000000003', null, 'kivilcim-girisim-ekibi', 'Kıvılcım Girişim Ekibi (örnek)', 'team', 'Girişim ekibi',
   'Kampüsler için ikinci el ders kitabı paylaşım fikri üzerinde çalışıyoruz.',
   'Örnek ekip. Üç kişiyiz; tasarım tarafında desteğe ihtiyacımız var.',
   'İzmir', (select id from public.interests where slug = 'girisimcilik'), 'apricot', true, true),
  ('00000000-0000-4000-a004-000000000004', '00000000-0000-4000-a000-000000000001', 'techapp-makers', 'TechApp Makers (örnek)', 'community', 'Üretici topluluğu',
   'Yazılım, donanım ve bolca merak.',
   'Ne ürettiğini gösterdiğin, takıldığın yerde soru sorduğun açık topluluk. Örnek kayıt.',
   null, (select id from public.interests where slug = 'teknoloji'), 'iris', true, true),
  ('00000000-0000-4000-a004-000000000005', '00000000-0000-4000-a000-000000000003', 'iyilik-icin-teknoloji', 'İyilik İçin Teknoloji (örnek)', 'community', 'Sosyal etki topluluğu',
   'Teknolojiyle toplumsal fayda üretiyoruz.',
   'Gönüllü projeler, açık veri çalışmaları ve atölyeler. Örnek kayıt.',
   null, (select id from public.interests where slug = 'sosyal_etki'), 'moss', true, true),
  ('00000000-0000-4000-a004-000000000006', '00000000-0000-4000-a000-000000000002', 'tasarim-sohbetleri', 'Tasarım Sohbetleri (örnek)', 'community', 'Tasarım topluluğu',
   'Ayda bir buluşup birbirimizin işine bakıyoruz.',
   'Arayüz, ürün ve görsel tasarıma ilgi duyanlar için açık geri bildirim buluşmaları. Örnek kayıt.',
   'İstanbul', (select id from public.interests where slug = 'tasarim'), 'apricot', true, true)
on conflict (id) do nothing;

insert into public.recruitment_posts (id, team_id, title, role_label, description, skills, is_open, closes_at) values
  ('00000000-0000-4000-a007-000000000001', '00000000-0000-4000-a004-000000000001', 'Gömülü yazılım için takım arkadaşı', 'Yazılım',
   'Motor sürücü ve sensör okuma tarafında çalışacak biri. Başlangıç seviyesi olur; öğrenmeye istekli olman yeterli.',
   array['C/C++', 'Arduino', 'Sabır'], true, '2026-11-30 23:59+03'),
  ('00000000-0000-4000-a007-000000000002', '00000000-0000-4000-a004-000000000002', 'Görüntü işleme ekibine iki kişi', 'Görüntü işleme',
   'Şerit takibi ve tabela tanıma üzerinde çalışıyoruz. Python bilen ve düzenli vakit ayırabilecek arkadaşlar arıyoruz.',
   array['Python', 'OpenCV'], true, '2026-12-15 23:59+03'),
  ('00000000-0000-4000-a007-000000000003', '00000000-0000-4000-a004-000000000003', 'Arayüz tasarımcısı', 'Tasarım',
   'İlk prototipimizi birlikte çizeceğimiz bir tasarımcı arıyoruz.',
   array['Arayüz tasarımı', 'Prototipleme'], true, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- free courses (3 × 3 lessons)
insert into public.courses
  (id, organization_id, slug, title, poster_line, summary, level, topic_interest_id, tone, estimated_minutes, status, published_at, is_demo)
values
  ('00000000-0000-4000-a005-000000000001', null, 'iyi-bir-fikir-iyi-bir-soruyla-baslar',
   'İyi Bir Fikir, İyi Bir Soruyla Başlar', E'İyi bir fikir,\niyi bir soruyla başlar.',
   'Üç kısa adımda fikrini netleştir: kimin için, hangi problem, en küçük deneme.',
   'beginner', (select id from public.interests where slug = 'girisimcilik'), 'moss', 12, 'published', now(), true),
  ('00000000-0000-4000-a005-000000000002', null, 'hackathona-hazirlan',
   'Hackathon’a Hazırlan', E'İki gün.\nBir plan.',
   'İlk hackathonundan önce bilmen gerekenler: takım, kapsam ve sunum.',
   'beginner', (select id from public.interests where slug = 'teknoloji'), 'iris', 15, 'published', now(), true),
  ('00000000-0000-4000-a005-000000000003', null, 'robotige-ilk-adim',
   'Robotiğe İlk Adım', E'Sensör, karar,\nhareket.',
   'Bir robot nasıl düşünür? Sensörden motora giden yolu sade örneklerle gör.',
   'beginner', (select id from public.interests where slug = 'robotik'), 'apricot', 18, 'published', now(), true)
on conflict (id) do nothing;

insert into public.lessons (id, course_id, title, body, sort_order, estimated_minutes) values
  ('00000000-0000-4000-a006-000000000001', '00000000-0000-4000-a005-000000000001', 'Kimin için üretiyorsun?',
   '“Herkes” yerine bir kişi grubunu seç. Örneğin, ilk robotik yarışmasına hazırlanan lise takımları.', 1, 4),
  ('00000000-0000-4000-a006-000000000002', '00000000-0000-4000-a005-000000000001', 'Hangi problemi çözüyorsun?',
   'Çözümünü anlatmadan önce yaşanan sorunu tarif et. Bu takımlar hangi işi yapmakta zorlanıyor?', 2, 4),
  ('00000000-0000-4000-a006-000000000003', '00000000-0000-4000-a005-000000000001', 'En küçük denemen ne?',
   'Bir hafta içinde yapabileceğin bir deneme seç. Üç takımla görüşmek veya bir kâğıt prototip hazırlamak iyi bir başlangıç.', 3, 4),
  ('00000000-0000-4000-a006-000000000004', '00000000-0000-4000-a005-000000000002', 'Takımını nasıl kurarsın?',
   'Aynı şeyi bilen dört kişi yerine farklı şeyleri bilen üç kişi daha hızlı ilerler. Rolleri ilk saatte konuşun: kim karar verir, kim sunar, kim toparlar?', 1, 5),
  ('00000000-0000-4000-a006-000000000005', '00000000-0000-4000-a005-000000000002', 'Kapsamı küçült',
   'İki günde bitmeyecek bir fikir, bitmiş küçük bir fikirden daha az etkileyicidir. “Bunu çıkarsak yine çalışır mı?” sorusunu sık sık sor.', 2, 5),
  ('00000000-0000-4000-a006-000000000006', '00000000-0000-4000-a005-000000000002', 'Üç dakikada anlat',
   'Sorun, çözüm, gösterim. Sunumun yarısını çalışan şeyi göstermeye ayır. Slayt sayısı değil, netlik kazanır.', 3, 5),
  ('00000000-0000-4000-a006-000000000007', '00000000-0000-4000-a005-000000000003', 'Sensör: robotun duyuları',
   'Bir çizgi sensörü sadece “açık” ve “koyu” der. Robotun dünyayı ne kadar sade gördüğünü anlamak, iyi algoritmanın ilk adımı.', 1, 6),
  ('00000000-0000-4000-a006-000000000008', '00000000-0000-4000-a005-000000000003', 'Karar: eğer–ise ile başla',
   'Çizgi soldaysa sola dön. İlk sürümün bu kadar basit olsun. Çalışan basit bir kural, çalışmayan karmaşık bir kuraldan iyidir.', 2, 6),
  ('00000000-0000-4000-a006-000000000009', '00000000-0000-4000-a005-000000000003', 'Hareket: motoru yumuşat',
   'Robotun titriyorsa düzeltmelerin çok sert demektir. Hızı azalt, düzeltmeyi küçült, tekrar dene. Buna ayar yapmak denir ve işin yarısıdır.', 3, 6)
on conflict (id) do nothing;

-- "Bu etkinliğe hazırlan"
insert into public.event_courses (event_id, course_id) values
  ('00000000-0000-4000-a001-000000000001', '00000000-0000-4000-a005-000000000002'),
  ('00000000-0000-4000-a001-000000000012', '00000000-0000-4000-a005-000000000002'),
  ('00000000-0000-4000-a001-000000000004', '00000000-0000-4000-a005-000000000001'),
  ('00000000-0000-4000-a001-000000000005', '00000000-0000-4000-a005-000000000003')
on conflict do nothing;
