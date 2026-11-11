import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { RECRUITMENT_POST_COLUMNS, TEAM_PUBLIC_COLUMNS } from '../api';

// teams / recruitment_posts: the API roles may read every column except created_by (the founder's user id, possibly a minor's),
// see supabase/migrations/20261112000300_hide_creator_columns.sql. Any `*` read of these tables therefore fails at runtime with
// "permission denied" — on the very screens that list teams. These checks catch it before a device does.
const SRC = join(__dirname, '..', '..', '..');
const MIGRATION = join(SRC, '..', '..', '..', 'supabase', 'migrations', '20261112000300_hide_creator_columns.sql');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '__tests__') sourceFiles(path, out); }
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** A read of every column: select('*') / select() on the table itself, or a `teams(*)` embed in any select string. */
const STAR_READS = [
  /from\(\s*['"](teams|recruitment_posts)['"]\s*\)[^;]*?\.select\(\s*(\)|['"`]\s*\*)/,
  /\b(teams|recruitment_posts)(![a-z_]+)?\s*\(\s*\*\s*\)/,
];

const columns = (list: string) => list.split(',').map((c) => c.trim()).sort();
function grantedColumns(table: string): string[] {
  const sql = readFileSync(MIGRATION, 'utf8');
  const m = sql.match(new RegExp(`grant select \\(([^)]*)\\)\\s*on public\\.${table} to anon, authenticated`));
  if (!m) throw new Error(`no column grant for ${table} in ${MIGRATION}`);
  return columns(m[1]!);
}

describe('teams / recruitment_posts are read by explicit column list (created_by is not granted)', () => {
  it('no source file reads every column of teams or recruitment_posts', () => {
    const files = sourceFiles(SRC);
    const rel = files.map((f) => relative(SRC, f));
    expect(rel).toEqual(expect.arrayContaining(['features/teams/api.ts', 'features/discovery/DiscoverScreen.tsx']));
    const offenders = files.flatMap((f) => {
      const code = stripComments(readFileSync(f, 'utf8'));
      return STAR_READS.filter((re) => re.test(code)).map((re) => `${relative(SRC, f)} ~ ${re}`);
    });
    expect(offenders).toEqual([]);
  });

  it('the pattern itself catches the old queries (the check is not vacuous)', () => {
    const old = [
      `getSupabase().from('teams').select('*').eq('kind', kind)`,
      `supabase.from('recruitment_posts').select('*').eq('team_id', id)`,
      `getSupabase().from('team_memberships').select('*, team:teams(*)')`,
      `getSupabase().from('teams').update(x).eq('id', id).select().single()`,
    ];
    for (const code of old) expect([code, STAR_READS.some((re) => re.test(code))]).toEqual([code, true]);
    expect(STAR_READS.some((re) => re.test(`getSupabase().from('team_tasks').select('*')`))).toBe(false);
  });

  it('the client column lists are exactly the columns the migration grants, and never created_by', () => {
    expect(columns(TEAM_PUBLIC_COLUMNS)).toEqual(grantedColumns('teams'));
    expect(columns(RECRUITMENT_POST_COLUMNS)).toEqual(grantedColumns('recruitment_posts'));
    expect(columns(TEAM_PUBLIC_COLUMNS)).not.toContain('created_by');
    expect(columns(RECRUITMENT_POST_COLUMNS)).not.toContain('created_by');
  });
});
