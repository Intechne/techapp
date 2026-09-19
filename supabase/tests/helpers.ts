import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.TECHAPP_TEST_DB_URL, max: 40 });

type Q = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;

async function withClaims<T>(role: 'anon' | 'authenticated' | 'service_role', sub: string | null, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: sub ?? '', role })]);
    const result = await fn((sql, params) => client.query(sql, params as never[]));
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Run as a signed-in end user: RLS and function grants apply exactly as through the API. */
export const asUser = <T>(userId: string, fn: (q: Q) => Promise<T>) => withClaims('authenticated', userId, fn);
export const asAnon = <T>(fn: (q: Q) => Promise<T>) => withClaims('anon', null, fn);
export const asService = <T>(fn: (q: Q) => Promise<T>) => withClaims('service_role', null, fn);
/** Superuser: test fixtures only. */
export const admin: Q = (sql, params) => pool.query(sql, params as never[]);

export async function createUser(opts: { age?: number | null; name?: string } = {}): Promise<string> {
  const id = randomUUID();
  await admin(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@example.test`]);
  const age = opts.age === undefined ? 20 : opts.age;
  if (age !== null) {
    await asUser(id, (q) =>
      q(`select public.complete_profile_bootstrap($1, 'university', (current_date - make_interval(years => $2, days => 30))::date, '{}')`,
        [opts.name ?? 'Test Kullanıcı', age]));
  }
  return id;
}

export async function createOrg(members: Record<string, string> = {}, verified = true): Promise<string> {
  const id = randomUUID();
  await admin(
    `insert into public.organizations (id, slug, name, type, verification, is_demo) values ($1, $2, 'Test Org', 'ngo', $3, true)`,
    [id, `org-${id.slice(0, 8)}`, verified ? 'verified' : 'unverified']);
  for (const [userId, role] of Object.entries(members)) {
    await admin(`insert into public.organization_members (organization_id, user_id, role) values ($1, $2, $3)`, [id, userId, role]);
  }
  return id;
}

export async function createEvent(orgId: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  const base: Record<string, unknown> = {
    id, organization_id: orgId, slug: `event-${id.slice(0, 8)}`, title: 'Test Etkinliği', summary: 'Özet',
    type: 'workshop', format: 'in_person', status: 'published', is_demo: true,
    starts_at: new Date(Date.now() + 7 * 864e5), ends_at: new Date(Date.now() + 7 * 864e5 + 6 * 36e5),
    registration_closes_at: new Date(Date.now() + 6 * 864e5),
    ...overrides,
  };
  const cols = Object.keys(base);
  await admin(`insert into public.events (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(base));
  return id;
}

export const register = (userId: string, eventId: string, key: string = randomUUID()) =>
  asUser(userId, async (q) => (await q(`select * from public.register_for_event($1, $2)`, [eventId, key])).rows[0]);

/** Assert a PostgREST-style failure: SQLSTATE PT<status> + machine code in message. */
export async function expectFail(promise: Promise<unknown>, status: number, code?: string) {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (e.code !== `PT${status}` || (code && e.message !== code)) {
      throw new Error(`Expected PT${status}/${code ?? '*'} but got ${e.code}/${e.message}`);
    }
    return;
  }
  throw new Error(`Expected PT${status}/${code ?? '*'} but the call succeeded`);
}
