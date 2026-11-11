import { cardLabel, cardMetrics, clipForSpeech, formatCount, keepTogether, metaJoin, spoken } from '..';
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

describe('keepTogether', () => {
  it('replaces spaces with non-breaking spaces', () => {
    expect(keepTogether('20 Kasım 2026')).toBe('20\u00A0Kasım\u00A02026');
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0 üye'], [1, '1 üye'], [999, '999 üye'], [1000, '1.000+ üye'], [12000, '12.000+ üye'], [12345, '12.000+ üye'], [-3, '0 üye'], [Number.NaN, '0 üye'],
  ])('%p → %s', (n, out) => {
    expect(formatCount(n, UYE)).toBe(out);
  });
});

describe('cardMetrics', () => {
  it('matches the contract and derives from tokens', () => {
    expect(cardMetrics.poster.coverAspect).toBe(1.6);
    expect(cardMetrics.mini.minHeight).toBe(136);
    expect(cardMetrics.row.minHeight).toBe(space[4] * 2 + 46);
    // pad + status row + gap + one title line + gap + two meta lines (+ gap) + pad
    expect(cardMetrics.poster.bodyMinHeight).toBe(space[4] + 28 + space[3] + type.cardTitle.lineHeight + space[2] + type.caption.lineHeight * 2 + space[1] + space[4]);
  });
});
