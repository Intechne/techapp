/**
 * Content for the design preview route: the same card props twice, once as a polite demo set and once as the realistic
 * worst case (break-ui). Dev only: this module is `require`d from the preview screen, which is itself only `require`d
 * on `__DEV__ && env.appEnv === 'local'`. The values mirror supabase/dev/seed-worst-case.sql (schema limits) plus the
 * cases the schema forbids (one-letter name) that only the client fixture can show.
 */
import type { MiniCardProps, PosterCardProps, RowCardProps, StatusView } from '../../design-system';
import { formatCount } from '../../design-system';
import { WORST_CASE_MARKER, worstCase } from './worstCase';

export type PreviewData = 'demo' | 'worst';

type NoHandlers<T> = Omit<T, 'onPress' | 'onToggleSave' | 'trailing'>;
export type PosterSpec = NoHandlers<PosterCardProps> & { id: string; bookmark?: boolean };
export type RowSpec = NoHandlers<RowCardProps> & { id: string; trailing?: { kind: 'chevron' } | { kind: 'status'; view: StatusView } | { kind: 'bookmark' } };
export type MiniSpec = Omit<MiniCardProps, 'onPress'> & { id: string };
export interface PreviewSet { marker?: string; posters: PosterSpec[]; rows: RowSpec[]; minis: MiniSpec[]; hero: { category: string; title: string; accent?: string; meta?: string; cta?: string } }

const open: StatusView = { label: 'KAYIT AÇIK', tone: 'moss', icon: 'check' };
const full: StatusView = { label: 'KONTENJAN DOLDU', tone: 'danger', icon: 'warning' };
const waitlist: StatusView = { label: 'BEKLEME LİSTESİ AÇIK', tone: 'apricot', icon: 'clock' };
const closed: StatusView = { label: 'KAYITLAR KAPANDI', tone: 'neutral', icon: 'clock' };
const lastDay: StatusView = { label: 'SON GÜN BUGÜN', tone: 'apricot', icon: 'clock' };
const tomorrow: StatusView = { label: 'SON GÜN YARIN', tone: 'apricot', icon: 'clock' };
const past: StatusView = { label: 'SÜRESİ DOLDU', tone: 'neutral', icon: 'clock' };
const noCover = worstCase.cover.none;

const demo: PreviewSet = {
  posters: [
    { id: 'p1', title: 'İyi Bir Gelecek Hackathonu', typeLabel: 'HACKATHON', availability: open, dateLabel: '17 Ekim 2026', placeLabel: 'İstanbul · Yüz yüze', audienceLabel: 'Lise + üniversite', feeLabel: 'Ücretsiz', cover: noCover, fallback: { tone: 'iris', icon: 'event', line: 'Bir fikir. Gerçek bir etki.' }, isDemo: true, bookmark: true },
    { id: 'p2', title: 'Kent İçin Bir Fikir', typeLabel: 'ATÖLYE', dateLabel: '31 Ekim 2026', placeLabel: 'Çevrim içi', cover: noCover, fallback: { tone: 'apricot', icon: 'event', line: 'Küçük adımlar. Ortak gelecek.' } },
  ],
  rows: [
    { id: 'r1', leading: { kind: 'icon', icon: 'opportunity' }, title: 'Ürün Geliştirme Staj Programı', secondary: 'Kullanıcı araştırmasından prototipe uzanan süreci deneyimle.', footnoteTag: { label: 'SON 8 GÜN', tone: 'apricot', icon: 'clock' }, footnote: 'Son başvuru: 30 Ekim 2026', trailing: { kind: 'bookmark' }, isDemo: true },
    { id: 'r2', leading: { kind: 'icon', icon: 'community' }, title: 'Nova Robotik Takımı', secondary: 'Yazılım ve elektronik takım arkadaşı arıyor.', footnote: formatCount(24, { one: 'üye', other: 'üye' }), trailing: { kind: 'chevron' } },
    { id: 'r3', leading: { kind: 'icon', icon: 'event' }, title: 'Robotik Takımları Buluşması', footnote: '24 Ekim 2026', trailing: { kind: 'status', view: { label: 'ONAYLANDI', tone: 'moss', icon: 'check' } } },
  ],
  minis: [
    { id: 'm1', icon: 'robot', title: 'Nova Robotik Takımı', body: 'Yazılım ve elektronik takım arkadaşı arıyor.' },
    { id: 'm2', icon: 'learn', title: 'Robotiğe İlk Adım', body: 'Bir robot nasıl düşünür?' },
  ],
  hero: { category: 'ÖNE ÇIKAN', title: 'Bir fikrin varsa, bir yerin var.', accent: 'bir yerin var.', meta: '12 etkinlik · 8 fırsat', cta: 'Keşfet' },
};

const worst: PreviewSet = {
  marker: WORST_CASE_MARKER,
  posters: [
    { id: 'p1', title: 'Uluslararası Gençlik Teknoloji, Robotik, Yapay Zekâ ve Sürdürülebilir Kalkınma Yaz Okulu Final Sunumları ve Ödül Töreni', typeLabel: 'KONFERANS', availability: { label: 'KONTENJAN DOLDU · BEKLEME LİSTESİ AÇIK', tone: 'danger', icon: 'warning' }, dateLabel: '24 Kasım – 26 Kasım 2026', placeLabel: 'Kahramanmaraş · Pazarcık · Yeşilyurt Mahallesi · Şehit Öğretmen Ayşe Çağlayan Çok Amaçlı Gençlik ve Spor Salonu', audienceLabel: 'Lise 9–12. sınıf ve üniversite 1–2. sınıf öğrencileri · takım kaptanları · mentörler · öğretmen danışmanlar', feeLabel: '12.345 TL', cover: worstCase.cover.broken, fallback: { tone: 'iris', icon: 'event', line: 'Şehit Öğretmen Ayşe Çağlayan anısına: Ğ Ü Ö Ç İ Ş ı' }, isDemo: true, bookmark: true },
    { id: 'p2', title: 'Ğ-26', typeLabel: 'ATÖLYE', dateLabel: '15 Kasım 2026', placeLabel: 'Çevrim içi', cover: noCover, fallback: { tone: 'moss', icon: 'event', line: 'Ğ' } },
    { id: 'p3', title: worstCase.names.unbreakable + 'hackathonu', typeLabel: 'HACKATHON', availability: full, dateLabel: '21 Kasım 2026', placeLabel: 'İstanbul', audienceLabel: 'Üniversite', cover: noCover, fallback: { tone: 'ink', icon: 'event', line: 'Mühendislikbilimleri-\nuygulamaları' }, isDemo: true },
    { id: 'p4', title: worstCase.names.emoji, typeLabel: 'YARIŞMA', availability: closed, dateLabel: '13 Kasım 2026', placeLabel: 'Ankara · Örnek Spor Salonu', audienceLabel: 'Lise takımları', feeLabel: '50 TL', cover: noCover, fallback: { tone: 'apricot', icon: 'event', line: '🤖 Takımını kur 🚀' }, bookmark: true },
    { id: 'p5', title: 'IĞDIR İÇİN Işıl Işıklı Şeker Öğrenci Çağrısı: ığdır ılgaz İstanbul', typeLabel: 'FESTİVAL', availability: lastDay, dateLabel: '24 Kasım 2026', placeLabel: 'Iğdır · Işıl Işıklı Şeker Fabrikası Kültür Merkezi', audienceLabel: 'Herkese açık', feeLabel: '250 TL', cover: noCover, fallback: { tone: 'apricot', icon: 'event', line: 'ıİ  şŞ  ğĞ\nüÜ  öÖ  çÇ' } },
    { id: 'p6', title: 'ورشة عمل الروبوتات للشباب · ロボット工学ワークショップ', typeLabel: 'ATÖLYE', availability: waitlist, dateLabel: '18 Kasım 2026', placeLabel: 'Çevrim içi', cover: noCover, fallback: { tone: 'ink', icon: 'event', line: 'ロボット工学' } },
  ],
  rows: [
    { id: 'r1', leading: { kind: 'image', path: worstCase.cover.broken.path, fallbackIcon: 'opportunity' }, title: 'Uluslararası Gençlik Teknoloji, Robotik, Yapay Zekâ ve Sürdürülebilir Kalkınma Projeleri Hibe ve Ödül Programı 2027', secondary: 'Özet 280 karakterin altında ama uzun: hibe, mentorluk ve ekipman desteğiyle genç takımların ilk çalışan prototiplerini üretmelerini hedefleyen çok aşamalı bir program; başvurular iki turda değerlendirilir.', footnoteTag: past, footnote: 'Son başvuru: 20 Kasım 2026 · Birinciye 250.000 TL nakit ödül, yurt dışı fuar gezisi, 6 ay mentorluk', trailing: { kind: 'bookmark' }, isDemo: true },
    { id: 'r2', leading: { kind: 'icon', icon: 'community' }, title: worstCase.names.long, secondary: worstCase.organization, footnote: formatCount(12345, { one: 'üye', other: 'üye' }), trailing: { kind: 'chevron' } },
    { id: 'r3', leading: { kind: 'icon', icon: 'community' }, title: 'Ğ.', footnote: formatCount(0, { one: 'üye', other: 'üye' }), trailing: { kind: 'chevron' } },
    { id: 'r4', leading: { kind: 'icon', icon: 'community' }, title: 'Işık', secondary: 'Tek kişilik başlangıç.', footnote: formatCount(1, { one: 'üye', other: 'üye' }), trailing: { kind: 'status', view: { label: 'BAŞVURUN İNCELENİYOR · 999 KİŞİ ARASINDA', tone: 'iris', icon: 'clock' } } },
    { id: 'r5', leading: { kind: 'icon', icon: 'opportunity' }, title: worstCase.names.emoji, secondary: worstCase.city, footnoteTag: tomorrow, footnote: 'Son başvuru: 13 Kasım 2026', trailing: { kind: 'bookmark' } },
    { id: 'r6', leading: { kind: 'icon', icon: 'opportunity' }, title: worstCase.names.unbreakable + 'ödülü', secondary: worstCase.names.unbreakable + 'sonuçları', footnote: worstCase.names.unbreakable, trailing: { kind: 'status', view: { label: 'KAYIT', tone: 'moss', icon: 'check' } }, isDemo: true },
    { id: 'r7', leading: { kind: 'icon', icon: 'event' }, title: 'Son Gün Bugün Staj Çağrısı', footnoteTag: lastDay, trailing: { kind: 'chevron' }, isDemo: true },
  ],
  minis: [
    { id: 'm1', icon: 'robot', title: worstCase.names.long, body: worstCase.organization },
    { id: 'm2', icon: 'learn', title: 'Ğ.', body: formatCount(0, { one: 'üye', other: 'üye' }) },
    { id: 'm3', icon: 'robot', title: worstCase.names.unbreakable, body: worstCase.names.unbreakable },
    { id: 'm4', icon: 'learn', title: worstCase.names.emoji },
  ],
  hero: { category: 'ÖNE ÇIKAN', title: 'Şehit Öğretmen Ayşe Çağlayan Mesleki ve Teknik Anadolu Lisesi Robotik Takımı', accent: 'Robotik Takımı', meta: `Kahramanmaraş · ${worstCase.organization}`, cta: 'Hemen incele' },
};

export const previewData: Record<PreviewData, PreviewSet> = { demo, worst };
