import { identityEnded } from '../SessionProvider';

jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({}) }));

describe('identityEnded — when everything shown for an account must be dropped', () => {
  it('sign-out, expiry and switching accounts end the identity', () => {
    expect(identityEnded('user-a', null)).toBe(true);
    expect(identityEnded('user-a', 'user-b')).toBe(true);
  });

  it('guest → signed in keeps the screens (the pending "join this event" flow continues)', () => {
    expect(identityEnded(null, 'user-a')).toBe(false);
    expect(identityEnded(null, null)).toBe(false);
  });

  it('a token refresh for the same account changes nothing', () => {
    expect(identityEnded('user-a', 'user-a')).toBe(false);
  });
});
