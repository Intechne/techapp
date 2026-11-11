import { formatLastUpdated, parseBirthDate } from '../dates';

const today = new Date(2026, 8, 19);

describe('parseBirthDate', () => {
  it('accepts a valid date and returns ISO', () => expect(parseBirthDate('07.03.2008', today)).toEqual({ ok: true, iso: '2008-03-07' }));
  it.each(['31.02.2008', '29.02.2007', '00.01.2008', '15.13.2008', '31.04.2010'])('rejects the impossible calendar date %s', (d) =>
    expect(parseBirthDate(d, today).ok).toBe(false));
  it('accepts a real leap day', () => expect(parseBirthDate('29.02.2008', today).ok).toBe(true));
  it('rejects future dates, including tomorrow', () => {
    expect(parseBirthDate('20.09.2026', today).ok).toBe(false);
    expect(parseBirthDate('19.09.2026', today).ok).toBe(true);
  });
  it('rejects implausible years and malformed input', () => {
    expect(parseBirthDate('01.01.1900', today).ok).toBe(false);
    expect(parseBirthDate('2008-03-07', today).ok).toBe(false);
    expect(parseBirthDate('7.3.2008', today).ok).toBe(false);
    expect(parseBirthDate('', today).ok).toBe(false);
  });
});

describe('formatLastUpdated (Europe/Istanbul)', () => {
  // 2026-11-12 14:30 in Istanbul (UTC+3)
  const now = new Date('2026-11-12T11:30:00Z');
  it('says "bugün" with the time for a copy saved today', () =>
    expect(formatLastUpdated('2026-11-12T11:02:00Z', now)).toBe('bugün 14:02'));
  it('shows day and month for an earlier day', () =>
    expect(formatLastUpdated('2026-11-10T18:40:00Z', now)).toBe('10 Kasım, 21:40'));
  it('uses the Istanbul calendar day, not UTC', () => {
    // 21:30Z on 12 Nov is already 00:30 on 13 Nov in Istanbul; 20:00Z on 12 Nov is 23:00 the day before.
    expect(formatLastUpdated('2026-11-12T20:00:00Z', new Date('2026-11-12T21:30:00Z'))).toBe('12 Kasım, 23:00');
    expect(formatLastUpdated('2026-11-12T21:10:00Z', new Date('2026-11-12T21:30:00Z'))).toBe('bugün 00:10');
  });
  it('adds the year when it is not this year', () =>
    expect(formatLastUpdated('2025-12-30T09:00:00Z', now)).toBe('30 Aralık 2025, 12:00'));
});
