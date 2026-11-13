import { EVENT_PUBLIC_COLUMNS } from '../api';

// A production build (flag off) must not ask the server for team_* columns: the server may not have them yet.
jest.mock('../../../lib/features', () => ({ features: { teamRegistration: false } }));

describe('events reads with features.teamRegistration off', () => {
  it('EVENT_PUBLIC_COLUMNS has no team_* column', () => {
    expect(EVENT_PUBLIC_COLUMNS).not.toMatch(/team_/);
    expect(EVENT_PUBLIC_COLUMNS).toContain('registration_mode');
  });
});
