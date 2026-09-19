import { audienceLabel, availability, feeLabel, placeLabel } from '../labels';

const base = { capacity: 40, seats_taken: 0, waitlist_enabled: true, registration_closes_at: '2026-12-01T00:00:00Z' };
const now = Date.parse('2026-10-01T00:00:00Z');

describe('event labels', () => {
  it('availability reflects capacity, waitlist and closing', () => {
    expect(availability(base, now)).toBeUndefined();
    expect(availability({ ...base, capacity: null }, now)).toBeUndefined();
    expect(availability({ ...base, seats_taken: 37 }, now)).toEqual({ label: 'SON 3 YER', tone: 'apricot' });
    expect(availability({ ...base, seats_taken: 40 }, now)?.label).toBe('BEKLEME LİSTESİ');
    expect(availability({ ...base, seats_taken: 41, waitlist_enabled: false }, now)?.label).toBe('KONTENJAN DOLDU');
    expect(availability({ ...base, registration_closes_at: '2026-09-01T00:00:00Z' }, now)?.label).toBe('KAYIT KAPANDI');
  });
  it('formats audience, fee and place', () => {
    expect(audienceLabel({ audience_note: null, min_age: 14, max_age: 18 })).toBe('14–18 yaş');
    expect(audienceLabel({ audience_note: null, min_age: 18, max_age: null })).toBe('18+ yaş');
    expect(audienceLabel({ audience_note: 'Lise + üniversite', min_age: 14, max_age: null })).toBe('Lise + üniversite');
    expect(audienceLabel({ audience_note: null, min_age: null, max_age: null })).toBe('Herkese açık');
    expect(feeLabel(0)).toBe('Ücretsiz');
    expect(placeLabel({ format: 'online', city: 'İstanbul' })).toBe('Çevrim içi');
    expect(placeLabel({ format: 'hybrid', city: 'Ankara' })).toBe('Ankara · Hibrit');
  });
});
