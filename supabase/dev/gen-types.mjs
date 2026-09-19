#!/usr/bin/env node
// Docker-free type generation against the LOCAL dev database, using the same generator as `supabase gen types`
// (@supabase/postgres-meta). Installed on demand into supabase/dev/.pgmeta (git-ignored). The output file is
// replaced only when generation succeeds. For the linked remote project use `npm run db:types`.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '.pgmeta');
const out = join(here, '..', '..', 'apps/mobile/src/lib/database.generated.ts');
const entry = join(cache, 'node_modules/@supabase/postgres-meta/dist/server/server.js');

if (!existsSync(entry)) {
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, 'package.json'), '{"private":true}');
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '@supabase/postgres-meta'], { cwd: cache, stdio: 'inherit' });
}
const run = spawnSync('node', [entry], {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, PG_META_DB_URL: process.env.TECHAPP_DB_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/techapp',
    PG_META_GENERATE_TYPES: 'typescript', PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS: 'public' },
});
if (run.status !== 0 || !run.stdout.includes('export type Database')) {
  console.error(run.stderr || 'type generation produced no output (is `npm run db:dev` running?)');
  process.exit(1);
}
writeFileSync(out, run.stdout);
console.log(`wrote ${out} (${run.stdout.split('\n').length} lines)`);
