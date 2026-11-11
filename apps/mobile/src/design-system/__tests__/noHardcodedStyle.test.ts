import fs from 'fs';
import path from 'path';

/**
 * Guard: screens and components take colours, font sizes and radii from tokens.
 * Scanned: src/features/**, src/design-system/components/** and src/dev/** (the design preview: layout only, tokens only) (tests excluded).
 * tokens.ts and *.generated.ts live outside the scanned roots by design.
 * ALLOW is intentionally empty: add `'relative/path.tsx'` (with a reason) only for debt that belongs to a later task.
 */
const ALLOW: string[] = [];

const SRC = path.resolve(__dirname, '..', '..');
const ROOTS = ['features', 'design-system/components', 'dev'];

const RULES: { name: string; re: RegExp }[] = [
  { name: 'hex colour literal', re: /#[0-9A-Fa-f]{3,8}\b/ },
  { name: 'rgb/rgba literal', re: /\brgba?\(/ },
  { name: 'numeric fontSize', re: /\bfontSize\s*:\s*-?\d/ },
  { name: 'numeric border radius', re: /\bborder\w*Radius\s*:\s*-?\d/ },
];

/** Comments are prose, not styles. Strings stay (a hex inside a string is exactly what we catch). */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

export function findViolations(source: string): { rule: string; line: number; text: string }[] {
  const out: { rule: string; line: number; text: string }[] = [];
  stripComments(source).split('\n').forEach((text, i) => {
    for (const r of RULES) if (r.re.test(text)) out.push({ rule: r.name, line: i + 1, text: text.trim().slice(0, 100) });
  });
  return out;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.(tsx?|jsx?)$/.test(e.name) && !/\.(test|spec|generated)\./.test(e.name) ? [p] : [];
  });
}

describe('noHardcodedStyle guard', () => {
  it('detects the patterns it is meant to forbid', () => {
    expect(findViolations("const a = { color: '#B8323D' };")).toHaveLength(1);
    expect(findViolations('const a = { bg: "rgba(0,0,0,.4)" };')).toHaveLength(1);
    expect(findViolations('const a = { fontSize: 22 };')).toHaveLength(1);
    expect(findViolations('const a = { borderRadius: 19 };')).toHaveLength(1);
    expect(findViolations('const a = { borderTopLeftRadius: 8 };')).toHaveLength(1);
  });
  it('allows token references, derived radii and comments', () => {
    expect(findViolations('const a = { fontSize: type.body.fontSize, borderRadius: s / 2, borderRadius: radius.pill };')).toHaveLength(0);
    expect(findViolations('// issue #123 and #FFF in prose\n/* #FF0000 */ const a = 1;')).toHaveLength(0);
  });
  it('finds no hardcoded colour, font size or radius in features and design-system components', () => {
    const files = ROOTS.flatMap((r) => walk(path.join(SRC, r))).filter((f) => !ALLOW.includes(path.relative(SRC, f)));
    expect(files.length).toBeGreaterThan(20);
    const hits = files.flatMap((f) => findViolations(fs.readFileSync(f, 'utf8')).map((v) => `${path.relative(SRC, f)}:${v.line} [${v.rule}] ${v.text}`));
    expect(hits).toEqual([]);
  });
});
