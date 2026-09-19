#!/usr/bin/env node
// Chooses which backend the apps talk to by (re)writing their `.env.local` from a git-ignored source file:
//   node supabase/dev/use-env.mjs local    → .env.localstack   (written by `npm run db:dev`)
//   node supabase/dev/use-env.mjs remote   → .env.remote       (project URL + publishable key; create it yourself)
// Expo and Vite always give `.env.local` priority over shell variables, so switching the file is the only reliable way.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!['local', 'remote'].includes(target)) { console.error('usage: use-env.mjs local|remote'); process.exit(2); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const app of ['apps/mobile', 'apps/admin', 'apps/web']) {
  const source = join(root, app, target === 'local' ? '.env.localstack' : '.env.remote');
  if (!existsSync(source)) { console.error(`missing ${source}${target === 'local' ? ' — run `npm run db:dev` once' : ' — see docs/RELEASE.md'}`); process.exit(1); }
  copyFileSync(source, join(root, app, '.env.local'));
  console.log(`${app}/.env.local ← ${target}`);
}
console.log('Restart the dev servers (Expo with --clear) to pick up the change.');
