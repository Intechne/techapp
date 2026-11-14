import fs from 'fs';
import path from 'path';

/** Source-scan guards from the Faz 5 motion review (docs/audits/2026-11-14-motion-review.md). */
const SRC = path.resolve(__dirname, '../..');
function files(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== '__tests__') files(p, out); } else if (/\.tsx?$/.test(f.name)) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(SRC, p);
const read = (p: string) => fs.readFileSync(p, 'utf8');
const all = files(SRC);

describe('motion review guards', () => {
  it('the skeleton pulse has one definition (no literal 900 ms loops outside motion.ts)', () => {
    const offenders = all.filter((f) => !f.endsWith('design-system/motion.ts') && /withRepeat\(/.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });
  it('the pulse is 900 ms, ease-in-out, system reduce-motion', () => {
    const src = read(path.join(SRC, 'design-system/motion.ts'));
    expect(src).toMatch(/SKELETON_PULSE_MS = 900/);
    expect(src).toMatch(/withRepeat\([\s\S]*easing: EASE_IN_OUT[\s\S]*ReduceMotion\.System[\s\S]*ReduceMotion\.System/);
  });
});
