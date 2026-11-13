import { coverUrl, thumbPath } from '../covers';

jest.mock('../env', () => ({ env: { supabaseUrl: 'https://abc.supabase.co' } }));

const OWNER = '11111111-2222-4333-8444-555555555555';
const FILE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PATH = `events/${OWNER}/${FILE}.webp`;

describe('coverUrl', () => {
  it('is null without a path (the fallback poster shows)', () => {
    expect(coverUrl(null, 'full')).toBeNull();
    expect(coverUrl(null, 'thumb')).toBeNull();
    expect(coverUrl(undefined, 'thumb')).toBeNull();
  });
  it('full = the public object URL of the bound path', () => {
    expect(coverUrl(PATH, 'full')).toBe(`https://abc.supabase.co/storage/v1/object/public/covers/${PATH}`);
  });
  it('thumb = the -640 copy next to it', () => {
    expect(coverUrl(PATH, 'thumb')).toBe(`https://abc.supabase.co/storage/v1/object/public/covers/events/${OWNER}/${FILE}-640.webp`);
    expect(thumbPath(PATH)).toBe(`events/${OWNER}/${FILE}-640.webp`);
  });
  it('never builds a URL from anything but a well-formed bucket path', () => {
    for (const bad of ['', 'https://example.invalid/covers/x.jpg', `../${PATH}`, `${PATH}?x=1`, `news/${OWNER}/${FILE}.webp`, `events/${OWNER}/${FILE}-640.webp`]) {
      expect(coverUrl(bad, 'full')).toBeNull();
    }
  });
});
