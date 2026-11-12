import { audienceLabel, availability, feeLabel, isRegistrationClosed, isRegistrationOpen, placeLabel, registrationTermsLabel } from '../labels';

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
    expect(placeLabel({ format: 'online', city: 'İstanbul' })).toBe('Çevrim\u00A0içi'); // no-break: the format never splits across lines
    expect(placeLabel({ format: 'hybrid', city: 'Ankara' })).toBe('Ankara · Hibrit');
  });
  it('registration terms: mode, minimum age and guardian threshold', () => {
    const t = (registration_mode: 'individual' | 'team' | 'both', min_age: number | null, guardian_required_under: number | null) => registrationTermsLabel({ registration_mode, min_age, guardian_required_under });
    expect(t('individual', null, null)).toBe('Bireysel kayıt');
    expect(t('team', 13, null)).toBe('Takım kaydı · 13 yaş ve üzeri');
    expect(t('both', 13, 18)).toBe('Bireysel veya takım kaydı · 13 yaş ve üzeri · 18 yaş altına veli onayı');
    expect(t('individual', null, 18)).toBe('Bireysel kayıt · 18 yaş altına veli onayı');
  });
});

describe('isRegistrationOpen / isRegistrationClosed (the one registration-window rule)', () => {
  const NOW = Date.parse('2026-11-12T12:00:00Z');
  const win = (opens: string | null, closes: string) => ({ registration_opens_at: opens, registration_closes_at: closes });
  it('open inside the window; null opens_at means open from the start', () => {
    expect(isRegistrationOpen(win('2026-11-01T00:00:00Z', '2026-11-20T00:00:00Z'), NOW)).toBe(true);
    expect(isRegistrationOpen(win(null, '2026-11-20T00:00:00Z'), NOW)).toBe(true);
  });
  it('not open before opens_at', () => {
    expect(isRegistrationOpen(win('2026-11-13T00:00:00Z', '2026-11-20T00:00:00Z'), NOW)).toBe(false);
  });
  it('closed exactly at closes_at, open one millisecond before', () => {
    expect(isRegistrationClosed(win(null, '2026-11-12T12:00:00Z'), NOW)).toBe(true);
    expect(isRegistrationOpen(win(null, '2026-11-12T12:00:00Z'), NOW)).toBe(false);
    expect(isRegistrationClosed(win(null, '2026-11-12T12:00:00.001Z'), NOW)).toBe(false);
  });
  it('opens_at exactly now counts as opened', () => {
    expect(isRegistrationOpen(win('2026-11-12T12:00:00Z', '2026-11-20T00:00:00Z'), NOW)).toBe(true);
  });
});
