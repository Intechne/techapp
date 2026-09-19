import { parseBirthDate } from '../dates';

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
