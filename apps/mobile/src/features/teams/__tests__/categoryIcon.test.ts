import { CATEGORY_LABEL, TEAM_CATEGORY_KEYS, categoryIcon } from '../categoryIcon';

describe('categoryIcon', () => {
  it('maps every category key to the icon of the meaning table', () => {
    expect(categoryIcon('robotics', 'team')).toBe('robot');
    expect(categoryIcon('software', 'team')).toBe('code');
    expect(categoryIcon('entrepreneurship', 'team')).toBe('rocket');
    expect(categoryIcon('science', 'team')).toBe('leaf');
    expect(categoryIcon('design', 'team')).toBe('spark');
    expect(categoryIcon('social_impact', 'team')).toBe('community');
    expect(categoryIcon('media', 'team')).toBe('play');
    expect(categoryIcon('other', 'team')).toBe('team');
  });
  it('a community with no specific category gets the community glyph, not the team glyph', () => {
    expect(categoryIcon('other', 'community')).toBe('community');
    expect(categoryIcon('science', 'community')).toBe('leaf');
  });
  it('the robot glyph belongs to robotics only', () => {
    for (const key of TEAM_CATEGORY_KEYS) for (const kind of ['team', 'community'] as const) {
      expect(categoryIcon(key, kind) === 'robot').toBe(key === 'robotics');
    }
  });
  it('an unknown or missing key (older server, hostile data) falls back like "other"; free text never picks an icon', () => {
    expect(categoryIcon(null, 'team')).toBe('team');
    expect(categoryIcon(undefined, 'community')).toBe('community');
    expect(categoryIcon('Robotik ve yapay zekâ', 'team')).toBe('team');
  });
  it('has a Turkish label for every key', () => {
    for (const key of TEAM_CATEGORY_KEYS) expect(CATEGORY_LABEL[key]).toBeTruthy();
  });
});
