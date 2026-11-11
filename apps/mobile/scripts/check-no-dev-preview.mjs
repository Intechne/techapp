#!/usr/bin/env node
/**
 * Release guard: the developer-only design preview route and the worst-case fixtures must not exist in a release bundle.
 *
 *   npm run check:no-dev-preview            exports Android (`expo export --platform android --no-bytecode`) into a temp
 *                                            dir, scans every file, deletes the dir
 *   npm run check:no-dev-preview -- --dir X scans an existing export directory instead (nothing is exported or deleted)
 *
 * Fails when a marker string is present, and also when the bundle looks wrong (no JS, or the control string that every
 * real bundle contains is missing), so an empty or truncated export cannot pass for a clean one.
 * The export runs with EXPO_PUBLIC_APP_ENV=local on purpose: even then, `__DEV__ === false` must remove the route.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Strings that exist only in dev code: the fixture marker, the screen marker, the route's deep-link path and its screen file. */
const MARKERS = ['techapp-worst-case-fixture', 'techapp-design-preview-screen', 'design-preview', 'DesignPreviewScreen', 'Mühendislikbilimleriuygulamaları', 'ışıklı şeker'.toLowerCase()];
/** Present in every real bundle of this app (error code → copy table in lib/errors.ts). */
const CONTROL = 'network_unreachable';

const argDir = process.argv.indexOf('--dir');
let dir = argDir > -1 ? process.argv[argDir + 1] : undefined;
const temp = !dir;
if (!dir) {
  dir = mkdtempSync(join(tmpdir(), 'techapp-export-'));
  const r = spawnSync('npx', ['expo', 'export', '--platform', 'android', '--no-bytecode', '--output-dir', dir], {
    cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1', EXPO_PUBLIC_APP_ENV: 'local' },
  });
  if (r.status !== 0) { rmSync(dir, { recursive: true, force: true }); console.error('check:no-dev-preview: expo export failed'); process.exit(1); }
}

const files = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]));
const bundles = files(dir).filter((f) => /\.(js|hbc)$/.test(f));
let failed = false;
const fail = (m) => { console.error(`check:no-dev-preview FAIL: ${m}`); failed = true; };

if (!bundles.length) fail(`no JS bundle found under ${dir}`);
let sawControl = false;
for (const f of bundles) {
  const text = readFileSync(f, 'utf8');
  if (text.includes(CONTROL)) sawControl = true;
  for (const m of MARKERS) if (text.toLowerCase().includes(m.toLowerCase())) fail(`${f.replace(dir, '<export>')} contains "${m}"`);
  console.log(`scanned ${f.replace(dir, '<export>')} (${(statSync(f).size / 1024 / 1024).toFixed(1)} MB)`);
}
if (bundles.length && !sawControl) fail(`control string "${CONTROL}" not found: the bundle is not a real app bundle`);
if (temp) rmSync(dir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log('check:no-dev-preview OK: no design-preview route or worst-case fixture in the release export');
