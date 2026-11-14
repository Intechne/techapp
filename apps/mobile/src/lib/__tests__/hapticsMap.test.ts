import fs from 'fs';
import path from 'path';

/**
 * The haptic map is a contract, not a habit: each semantic call may only be made from the places the map names.
 * (Faz 5 haritası: selection yalnız kaydet; success yalnız check-in geçerli ve kayıt onayı ilk görünümü.)
 */
const SRC = path.resolve(__dirname, '../..');
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); }
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC).filter((f) => !f.endsWith(`${path.sep}lib${path.sep}haptics.ts`));
const callers = (call: string) => files.filter((f) => fs.readFileSync(f, 'utf8').includes(`haptics.${call}(`)).map((f) => path.basename(f)).sort();

describe('haptic map call sites', () => {
  it('success: only the check-in screen and the registration status screen', () => {
    expect(callers('success')).toEqual(['CheckInScreen.tsx', 'RegistrationStatusScreen.tsx']);
  });
  it('selection: only the bookmark button', () => {
    expect(callers('selection')).toEqual(['BookmarkButton.tsx']);
  });
  it('warning: only check-in (repeat) and the registration status screen (waitlisted)', () => {
    expect(callers('warning')).toEqual(['CheckInScreen.tsx', 'RegistrationStatusScreen.tsx']);
  });
  it('error: check-in (invalid) and the shared field error shake', () => {
    expect(callers('error')).toEqual(['CheckInScreen.tsx', 'ShakeOnError.tsx']);
  });
});
