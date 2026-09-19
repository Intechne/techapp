import { cvSchema } from '../cvSchema';
import { cvShareUrl } from '../logic';

const base = {
  profile: { id: 'u1', display_name: 'Elif', headline: null, bio: null, city: null, education_stage: 'university', discoverable: false, skills: [] },
  interests: [], experiences: [], participations: [], volunteering: [],
};

describe('cv contract', () => {
  it('accepts the current server document: team titles and the share token', () => {
    const cv = cvSchema.parse({ ...base, teams: [{ team_id: 't1', name: 'Orbit', kind: 'team', role: 'member', title: 'Mekanik lideri', since: null }], share_token: 'a'.repeat(32) });
    expect(cv.teams[0]?.title).toBe('Mekanik lideri');
    expect(cv.share_token).toHaveLength(32);
  });

  it('still reads a server that has not received the titles/sharing migration yet', () => {
    const cv = cvSchema.parse({ ...base, teams: [{ team_id: 't1', name: 'Orbit', kind: 'team', role: 'captain', since: null }] });
    expect(cv.teams[0]?.title).toBeNull();
    expect(cv.share_token).toBeNull();
  });

  it('builds the public link on the single web origin', () => {
    expect(cvShareUrl('tok_en-123')).toBe('https://techapp.intechne.com.tr/cv/tok_en-123');
  });
});
