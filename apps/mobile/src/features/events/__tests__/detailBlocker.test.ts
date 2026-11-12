import { primaryBlocker } from '../detailBlocker';

describe('primaryBlocker — one deciding reason, one helpful secondary action', () => {
  it('closed + team-only: the closed registration decides, secondary is "similar", team-only is listed as another reason', () => {
    expect(primaryBlocker(['registration_closed', 'team_registration_only'], false))
      .toEqual({ reason: 'registration_closed', secondary: 'similar', others: ['team_registration_only'] });
  });

  it('priority: registered → registration_closed → event_full → age → team_registration_only', () => {
    const all = ['team_registration_only', 'below_min_age', 'event_full', 'registration_closed'];
    expect(primaryBlocker(all, true)).toBeNull();
    expect(primaryBlocker(all, false)?.reason).toBe('registration_closed');
    expect(primaryBlocker(['team_registration_only', 'above_max_age', 'event_full'], false)?.reason).toBe('event_full');
    expect(primaryBlocker(['team_registration_only', 'above_max_age'], false)?.reason).toBe('above_max_age');
    expect(primaryBlocker(['team_registration_only', 'below_min_age'], false)?.reason).toBe('below_min_age');
    expect(primaryBlocker(['team_registration_only'], false)).toEqual({ reason: 'team_registration_only', secondary: 'find_team', others: [] });
  });

  it('others keep the priority order', () => {
    expect(primaryBlocker(['team_registration_only', 'below_min_age', 'event_full', 'registration_closed'], false)?.others)
      .toEqual(['event_full', 'below_min_age', 'team_registration_only']);
  });

  it('secondary actions: closed / full / age → similar; team-only → find_team; not yet open → save', () => {
    expect(primaryBlocker(['event_full'], false)?.secondary).toBe('similar');
    expect(primaryBlocker(['below_min_age'], false)?.secondary).toBe('similar');
    expect(primaryBlocker(['above_max_age'], false)?.secondary).toBe('similar');
    expect(primaryBlocker(['registration_not_open'], false)?.secondary).toBe('save');
  });

  it('nothing blocks: null; an unknown server reason still blocks, after the known ones, with "similar"', () => {
    expect(primaryBlocker([], false)).toBeNull();
    expect(primaryBlocker(['something_new'], false)).toEqual({ reason: 'something_new', secondary: 'similar', others: [] });
    expect(primaryBlocker(['something_new', 'event_full'], false)?.reason).toBe('event_full');
  });

  it('never mutates the input', () => {
    const reasons = ['team_registration_only', 'registration_closed'];
    primaryBlocker(reasons, false);
    expect(reasons).toEqual(['team_registration_only', 'registration_closed']);
  });
});
