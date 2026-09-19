-- TechApp · 0003 reference data: interest taxonomy used by onboarding, discovery and events.
insert into public.interests (slug, label_tr, icon, sort_order) values
  ('teknoloji', 'Teknoloji', 'code', 10),
  ('robotik', 'Robotik', 'robot', 20),
  ('girisimcilik', 'Girişimcilik', 'rocket', 30),
  ('sosyal_etki', 'Sosyal etki', 'leaf', 40),
  ('yazilim', 'Yazılım', 'code', 50),
  ('tasarim', 'Tasarım', 'spark', 60),
  ('muhendislik', 'Mühendislik', 'settings', 70),
  ('kisisel_gelisim', 'Kişisel gelişim', 'learn', 80)
on conflict (slug) do nothing;
