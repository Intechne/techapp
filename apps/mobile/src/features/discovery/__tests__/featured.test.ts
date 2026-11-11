import { pickFeatured, type FeaturedCandidate } from '../featured';

const NOW = new Date('2026-11-11T12:00:00Z');
const open = (over: Partial<FeaturedCandidate> & { id?: string } = {}): FeaturedCandidate & { id: string } => ({
  id: 'e', registration_opens_at: '2026-11-01T00:00:00Z', registration_closes_at: '2026-11-24T20:59:59Z',
  capacity: 100, seats_taken: 10, waitlist_enabled: false, ...over,
});

describe('pickFeatured', () => {
  it('skips a closed first event and picks the next open one', () => {
    const closed = open({ id: 'a', registration_closes_at: '2026-11-05T00:00:00Z' });
    const ok = open({ id: 'b' });
    expect(pickFeatured([closed, ok], NOW)?.id).toBe('b');
  });
  it('returns null when none qualifies', () => {
    expect(pickFeatured([open({ registration_closes_at: '2026-11-05T00:00:00Z' })], NOW)).toBeNull();
    expect(pickFeatured([], NOW)).toBeNull();
  });
  it('treats null registration_opens_at as open', () => {
    expect(pickFeatured([open({ registration_opens_at: null })], NOW)).not.toBeNull();
  });
  it('not yet opened is not eligible', () => {
    expect(pickFeatured([open({ registration_opens_at: '2026-11-20T00:00:00Z' })], NOW)).toBeNull();
  });
  it('is not eligible at the closing instant', () => {
    expect(pickFeatured([open()], new Date('2026-11-24T21:00:00Z'))).toBeNull();
  });
  it('full with waitlist off is not eligible; with waitlist on it is', () => {
    expect(pickFeatured([open({ capacity: 10, seats_taken: 10 })], NOW)).toBeNull();
    expect(pickFeatured([open({ capacity: 10, seats_taken: 10, waitlist_enabled: true })], NOW)).not.toBeNull();
  });
  it('null capacity is unlimited', () => {
    expect(pickFeatured([open({ capacity: null, seats_taken: 999 })], NOW)).not.toBeNull();
  });
});
