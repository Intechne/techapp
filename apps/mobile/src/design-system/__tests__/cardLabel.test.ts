import { cardLabel, cardMetrics, clipForSpeech, formatCount, keepNumbersTogether, keepTogether, metaJoin, rowCardHeight, spoken } from '..';
import { space, type } from '../tokens';

const UYE = { one: 'üye', other: 'üye' };

describe('cardLabel', () => {
  it('drops empty parts and joins with ". "', () => {
    expect(cardLabel(['Robotik Günü', null, '', '   ', undefined, 'Hackathon'])).toBe('Robotik Günü. Hackathon');
  });
  it('never doubles a full stop when a part already ends with one', () => {
    expect(cardLabel(['Bir fikir. Bir hafta sonu.', 'Kayıt kapandı.', '17 Ekim…'])).toBe('Bir fikir. Bir hafta sonu. Kayıt kapandı. 17 Ekim');
  });
  it('returns an empty string when there is nothing to say', () => {
    expect(cardLabel([null, undefined, ''])).toBe('');
  });
});

describe('spoken', () => {
  it('turns capitals (eyebrow labels) into Turkish sentence case', () => {
    expect(spoken('KAYIT KAPANDI')).toBe('Kayıt kapandı');
    expect(spoken('İNCELEMEDE')).toBe('İncelemede');
    expect(spoken('SON 3 YER')).toBe('Son 3 yer');
  });
  it('leaves names and mixed-case text alone', () => {
    expect(spoken('Şehit Öğretmen Ayşe Gülşen Çağlayan Lisesi')).toBe('Şehit Öğretmen Ayşe Gülşen Çağlayan Lisesi');
    expect(spoken(undefined)).toBeUndefined();
  });
});

describe('clipForSpeech', () => {
  it('keeps short text and clips long text on a word boundary', () => {
    expect(clipForSpeech('Kısa özet')).toBe('Kısa özet');
    const long = 'kelime '.repeat(100);
    const out = clipForSpeech(long)!;
    expect(out.length).toBeLessThanOrEqual(141);
    expect(out.endsWith('kelime…')).toBe(true);
    expect(clipForSpeech('   ')).toBeUndefined();
  });
});

describe('metaJoin', () => {
  it('drops empty parts and keeps the dot attached to the word before it', () => {
    expect(metaJoin(['Yarışma', null, '', 'Son gün bugün', 'Çevrim içi'])).toBe('Yarışma\u00A0· Son gün bugün\u00A0· Çevrim içi');
  });
});

describe('keepNumbersTogether', () => {
  const BREAKABLE_AROUND_DIGIT = /\d [^\s]|[^\s:] \d/u; // a plain U+0020 next to a digit
  it.each(['Son başvuru: 20 Kasım 2026', '8 gün kaldı', 'Son 3 gün', '5 Aralık – 6 Aralık 2026 · İstanbul', '12.000+ üye', 'SON 1 YER'])('%p keeps numbers with their units', (s) => {
    const out = keepNumbersTogether(s);
    expect(out).not.toMatch(BREAKABLE_AROUND_DIGIT);
    expect(out.replace(/\u00A0/g, ' ')).toBe(s);
  });
  it('lets a label break after its colon, never inside the date', () => {
    expect(keepNumbersTogether('Son başvuru: 20 Kasım 2026')).toBe('Son başvuru: 20\u00A0Kasım\u00A02026');
  });
  it('leaves spaces away from numbers breakable', () => {
    expect(keepNumbersTogether('Lise takımları · Ücretsiz')).toBe('Lise takımları · Ücretsiz');
  });
});

describe('keepTogether', () => {
  it('replaces spaces with non-breaking spaces', () => {
    expect(keepTogether('20 Kasım 2026')).toBe('20\u00A0Kasım\u00A02026');
  });
  it('lets a long label wrap at spaces (a nowrap label wider than its slot breaks mid-word) but keeps its numbers', () => {
    const long = 'KONTENJAN DOLDU · BEKLEME LİSTESİ AÇIK 999 KİŞİ';
    expect(keepTogether(long)).toBe(keepNumbersTogether(long));
    expect(keepTogether(long)).toContain('KONTENJAN DOLDU');
    expect(keepTogether(long)).toContain('999\u00A0KİŞİ');
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0 üye'], [1, '1 üye'], [999, '999 üye'], [1000, '1.000+ üye'], [12000, '12.000+ üye'], [12345, '12.000+ üye'], [-3, '0 üye'], [Number.NaN, '0 üye'],
  ])('%p → %s (number and noun never split)', (n, out) => {
    expect(formatCount(n, UYE)).toBe(out.replace(' ', '\u00A0'));
  });
});

describe('cardMetrics', () => {
  it('matches the contract and derives from tokens', () => {
    expect(cardMetrics.poster.coverAspect).toBe(1.6);
    expect(cardMetrics.mini.minHeight).toBe(136);
    expect(cardMetrics.row.minHeight).toBe(space[4] * 2 + 46);
    // a row never measures below its tile; text lines add their line boxes and gaps
    expect(rowCardHeight({ title: 1, secondary: 0, footnote: 'none' })).toBe(cardMetrics.row.minHeight);
    // footnote 'tag' = tag row (26) + 4 + caption line (16); ÖRNEK rides in that tag row
    expect(rowCardHeight({ title: 2, secondary: 2, footnote: 'tag' })).toBe(space[4] * 2 + 23 * 2 + 2 + 21 * 2 + 8 + 26 + 4 + 16);
    expect(rowCardHeight({ title: 2, secondary: 2, footnote: 'tag', demo: true })).toBe(rowCardHeight({ title: 2, secondary: 2, footnote: 'tag' }));
    expect(rowCardHeight({ title: 1, secondary: 1, footnote: 'text', demo: true })).toBe(space[4] * 2 + 23 + 2 + 21 + 8 + 16 + 8 + 22);
    // pad + status row + gap + ONE reserved title line (Q8) + gap + two meta lines (+ gap) + pad
    expect(cardMetrics.poster.bodyMinHeight).toBe(space[4] + 28 + space[3] + type.cardTitle.lineHeight + space[2] + type.caption.lineHeight * 2 + space[1] + space[4]);
  });
});
