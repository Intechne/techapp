#!/usr/bin/env node
/**
 * WCAG contrast audit of every text/background pair the design system renders.
 *
 *   npm run contrast
 *
 * Prints pair, ratio, threshold and result. Exits 1 when a LIGHT pair fails (usable as a CI gate); the `semantic.dark`
 * draft is reported with the same thresholds but never affects the exit code. The data lives in
 * src/design-system/contrastAudit.ts (shared with the Jest test); this script only transpiles and prints it.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  module._compile(out.outputText, filename);
};
const { TEXT_PAIRS, DISABLED_PAIRS, audit, auditDark } = require(path.join(root, 'src/design-system/contrastAudit.ts'));
const dark = JSON.parse(fs.readFileSync(path.resolve(root, '../../design-source/tokens.json'), 'utf8')).semantic.dark.colors;

const table = (title, rows) => {
  const w = Math.max(...rows.map((r) => r.usage.length), 4);
  console.log(`\n${title}`);
  console.log(`${'pair'.padEnd(w)}  ${'fg'.padEnd(7)} ${'bg'.padEnd(7)} ${'ratio'.padStart(6)}  need  result`);
  for (const r of rows) {
    console.log(`${r.usage.padEnd(w)}  ${r.fg.toUpperCase()} ${r.bg.toUpperCase()} ${r.ratio.toFixed(2).padStart(6)}  ${String(r.min).padStart(3)}   ${r.pass ? 'pass' : 'FAIL'}`);
  }
  const bad = rows.filter((r) => !r.pass);
  console.log(`${rows.length} pairs, ${rows.length - bad.length} pass, ${bad.length} fail`);
  return bad;
};

const light = audit(TEXT_PAIRS);
const failures = table('LIGHT (the shipped theme): body >= 4.5, large text and icons >= 3', light);
table('DISABLED controls (exempt from WCAG 1.4.3; ratios on record, not enforced)', audit(DISABLED_PAIRS).map((r) => ({ ...r, pass: true, min: 0 })));
const darkBad = table('DARK DRAFT (semantic.dark in tokens.json; report only, never fails)', auditDark(dark));
if (darkBad.length) console.log('dark draft: below threshold -> ' + darkBad.map((r) => r.usage).join('; '));

if (failures.length) {
  console.error(`\ncontrast: ${failures.length} light pair(s) below threshold`);
  process.exit(1);
}
console.log('\ncontrast: all light pairs pass');
