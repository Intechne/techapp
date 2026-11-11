#!/usr/bin/env node
/**
 * Docker-free LOCAL development stack. Not for staging/production: those use a real Supabase project.
 *
 *   embedded PostgreSQL (:54322)  ←  PostgREST (:54323)  ←  gateway (:54321, Supabase-compatible paths)
 *
 * The gateway serves /rest/v1 (PostgREST), a minimal GoTrue-compatible /auth/v1 (e-mail OTP; the code is printed
 * to this terminal instead of being e-mailed), dev versions of our Edge Functions under /functions/v1, (the guardian
 * consent page is apps/web → http://localhost:3100/veli). The mobile app runs unmodified against it with the real supabase-js client.
 * Binds to 127.0.0.1 only. Requires `brew install postgrest`. Use `--reset` to recreate the database; `--reset --worst-case` also loads the hostile break-ui data set (local only).
 * `--lan` additionally opens the GATEWAY (never Postgres or PostgREST) to the local network and points the MOBILE app at this
 * machine's LAN address, so a phone on the same Wi-Fi can use it. The dev gateway hands out OTP codes without e-mail: use it on a
 * network you trust, and drop the flag when you are done.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { deleteAccount } from '../functions/delete-account/handler.ts';
import { guardianDispatch } from '../functions/guardian-dispatch/handler.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dataDir = join(here, '.pgdata');
const secretFile = join(here, '.jwt-secret');
const PG_PORT = 54322, REST_PORT = 54323, GATEWAY_PORT = 54321;

const LAN = process.argv.includes('--lan');
const lanAddress = () => Object.values(networkInterfaces()).flat().find((n) => n && n.family === 'IPv4' && !n.internal)?.address;
const LAN_IP = LAN ? lanAddress() : undefined;
if (LAN && !LAN_IP) { console.error('--lan: no local network address found (is Wi-Fi on?)'); process.exit(1); }

const WORST_CASE = process.argv.includes('--worst-case');
if (WORST_CASE && !process.argv.includes('--reset')) { console.error('--worst-case needs --reset: the hostile data set is only ever loaded into a freshly created LOCAL database (npm run db:dev -- --reset --worst-case).'); process.exit(1); }
if (process.argv.includes('--reset')) rmSync(dataDir, { recursive: true, force: true });
if (!existsSync(secretFile)) { mkdirSync(here, { recursive: true }); writeFileSync(secretFile, randomBytes(32).toString('hex')); }
const JWT_SECRET = readFileSync(secretFile, 'utf8').trim();

const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
function signJwt(claims) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}`;
  return `${body}.${createHmac('sha256', JWT_SECRET).update(body).digest('base64url')}`;
}
function verifyJwt(token) {
  const [h, p, s] = (token ?? '').split('.');
  if (!s || createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  return claims.exp && claims.exp < Date.now() / 1000 ? null : claims;
}
const ANON_KEY = signJwt({ role: 'anon', iss: 'techapp-local', exp: 4102444800 });

// ------------------------------------------------------------------ database
const fresh = !existsSync(join(dataDir, 'PG_VERSION'));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: true, onLog: () => {}, onError: () => {} });
if (fresh) await server.initialise();
await server.start();
if (fresh) await server.createDatabase('techapp');
const db = new pg.Pool({ connectionString: `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/techapp` });

// Migrations are tracked like the Supabase CLI does, so an existing dev database picks up new ones on the next start.
const migrationFiles = readdirSync(join(root, 'supabase/migrations')).filter((x) => x.endsWith('.sql')).sort();
const version = (f) => f.split('_')[0];
async function applyPendingMigrations() {
  await db.query(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, applied_at timestamptz default now())`);
  const tracked = new Set((await db.query(`select version from supabase_migrations.schema_migrations`)).rows.map((r) => r.version));
  if (!fresh && tracked.size === 0) {
    // Dev databases created before tracking existed contain every migration up to 20260920000300.
    for (const f of migrationFiles.filter((x) => version(x) <= '20260920000300')) {
      await db.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)`, [version(f), f]);
      tracked.add(version(f));
    }
  }
  for (const f of migrationFiles.filter((x) => !tracked.has(version(x)))) {
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(join(root, 'supabase/migrations', f), 'utf8'));
      await client.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)`, [version(f), f]);
      await client.query('commit');
      if (!fresh) console.log(`migration applied: ${f}`);
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw new Error(`migration ${f} failed: ${e.message}`);
    } finally { client.release(); }
  }
}

if (fresh) await db.query(readFileSync(join(root, 'supabase/tests/supabase-shim.sql'), 'utf8'));
await applyPendingMigrations();
if (fresh) {
  await db.query(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  // Dev organiser: owner of the first demo organisation + platform admin. Sign in with this address (OTP is printed here).
  const id = randomUUID();
  await db.query(`insert into auth.users (id, email) values ($1, 'organizator@techapp.test')`, [id]);
  await db.query(`insert into public.organization_members (organization_id, user_id, role) select id, $1, 'owner' from public.organizations where is_demo`, [id]);
  await db.query(`insert into public.platform_admins (user_id) values ($1)`, [id]);
  console.log('database created: migrations + seed applied');
  if (WORST_CASE) {
    // Break-ui data (supabase/dev/seed-worst-case.sql). Refuses anything but the embedded LOCAL Postgres started by this script.
    const where = (await db.query(`select inet_server_addr()::text as addr, inet_server_port() as port, current_setting('data_directory') as dir`)).rows[0];
    const loopback = ['127.0.0.1', '::1'].includes(where.addr?.replace(/\/\d+$/, ''));
    if (!loopback || Number(where.port) !== PG_PORT || where.dir !== dataDir) {
      console.error(`--worst-case refused: the database is not this script's local embedded Postgres (${where.addr}:${where.port} ${where.dir}).`);
      process.exit(1);
    }
    await db.query(readFileSync(join(here, 'seed-worst-case.sql'), 'utf8'));
    console.log('worst-case seed applied (every row is_demo = true)');
  }
}

// ------------------------------------------------------------------ PostgREST
const postgrest = spawn('postgrest', [], {
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:authenticator@127.0.0.1:${PG_PORT}/techapp`, PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: JWT_SECRET, PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(REST_PORT), PGRST_LOG_LEVEL: 'error' },
});

// ------------------------------------------------------------------ gateway
const otps = new Map(); // email -> { code, expires }
const refreshTokens = new Map(); // token -> userId

const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: u.created_at });
function sessionFor(u) {
  const expires_in = 3600, refresh_token = randomBytes(24).toString('hex');
  refreshTokens.set(refresh_token, u.id);
  const access_token = signJwt({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: Math.floor(Date.now() / 1000) + expires_in });
  return { access_token, token_type: 'bearer', expires_in, expires_at: Math.floor(Date.now() / 1000) + expires_in, refresh_token, user: userJson(u) };
}
const readBody = (req) => new Promise((resolve) => { let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } }); });
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const bearer = (req) => verifyJwt((req.headers.authorization ?? '').replace(/^Bearer /i, ''));

async function auth(req, res, path, url) {
  const body = await readBody(req);
  if (path === '/otp' && req.method === 'POST') {
    const email = String(body.email ?? '').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 422, { code: 422, error_code: 'validation_failed', msg: 'invalid email' });
    if (body.create_user === false && !(await db.query(`select 1 from auth.users where email = $1`, [email])).rowCount) {
      return send(res, 422, { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    otps.set(email, { code, expires: Date.now() + 10 * 60_000 });
    writeFileSync(join(here, '.last-otp'), code);
    console.log(`\n  ✉  OTP for ${email}: ${code}\n`);
    return send(res, 200, {});
  }
  if (path === '/verify' && req.method === 'POST') {
    const email = String(body.email ?? '').toLowerCase(); const entry = otps.get(email);
    if (!entry || entry.code !== String(body.token) || entry.expires < Date.now()) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    otps.delete(email);
    await db.query(`insert into auth.users (email) values ($1) on conflict (email) do nothing`, [email]);
    const { rows } = await db.query(`select * from auth.users where email = $1`, [email]);
    return send(res, 200, sessionFor(rows[0]));
  }
  if (path === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const userId = refreshTokens.get(body.refresh_token);
    const { rows } = userId ? await db.query(`select * from auth.users where id = $1`, [userId]) : { rows: [] };
    if (!rows[0]) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    refreshTokens.delete(body.refresh_token);
    return send(res, 200, sessionFor(rows[0]));
  }
  if (path === '/logout') return send(res, 204);
  if (path === '/user') {
    const claims = bearer(req);
    const { rows } = claims?.sub ? await db.query(`select * from auth.users where id = $1`, [claims.sub]) : { rows: [] };
    return rows[0] ? send(res, 200, userJson(rows[0])) : send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid token' });
  }
  return send(res, 404, { msg: 'not found' });
}

// The real Edge Function logic (supabase/functions/*/handler.ts), wired to this database. E-mail is replaced by a
// console link. Needs Node's TypeScript type stripping (see the db:dev script).
async function asRole(role, sub, sql, params) {
  const client = await db.connect();
  try {
    await client.query('begin'); await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: sub ?? '', role })]);
    const result = await client.query(sql, params);
    await client.query('commit');
    return result;
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; } finally { client.release(); }
}
const authenticate = async (authorization) => {
  const claims = verifyJwt(authorization.replace(/^Bearer /i, ''));
  return claims?.role === 'authenticated' && claims.sub ? claims.sub : null;
};

async function functions(req, res, path) {
  const authorization = req.headers.authorization ?? ''; const body = await readBody(req); const requestId = randomUUID();
  if (path === '/guardian-dispatch') {
    const result = await guardianDispatch({
      authenticate,
      ownsRequest: async (auth, id) => {
        const sub = await authenticate(auth);
        return !!sub && (await asRole('authenticated', sub, `select id from public.my_guardian_requests where id = $1`, [id])).rowCount > 0;
      },
      issueToken: async (id) => {
        try { return { data: (await asRole('service_role', null, `select public.issue_guardian_token($1) j`, [id])).rows[0].j, error: null }; }
        catch (e) { return { data: null, error: { code: e.code, message: e.message } }; }
      },
      sendMail: async (mail) => {
        const link = /https?:\/\/\S+#[A-Za-z0-9_-]+/.exec(mail.text)?.[0] ?? '';
        writeFileSync(join(here, '.last-guardian-link'), link);
        console.log(`\n  ✉  Guardian link for ${mail.to}:\n     ${link}\n`);
        return { ok: true, status: 200 };
      },
      guardianPageUrl: 'http://localhost:3100/veli',
      log: console.error,
    }, authorization, body, requestId);
    return send(res, result.status, result.body);
  }
  if (path === '/delete-account') {
    const result = await deleteAccount({
      authenticate,
      audit: async (action, userId) => {
        await db.query(`insert into public.audit_events (actor_id, actor_kind, action, target_type, target_id) values ($1, $2, $3, 'user', $4)`,
          [action === 'account.deleted' ? null : userId, action === 'account.deleted' ? 'service' : 'user', action, userId]);
      },
      removeFiles: async () => {}, // no storage in the dev stack
      deleteUser: async (userId) => {
        try { await db.query(`delete from auth.users where id = $1`, [userId]); return { error: null }; } catch { return { error: { status: 500 } }; }
      },
      hasModerationHistory: async (userId) => (await db.query(`select 1 from public.moderation_actions where moderator_id = $1`, [userId])).rowCount > 0,
      log: console.error,
    }, authorization, requestId);
    return send(res, result.status, result.body);
  }
  return send(res, 404, { code: 'not_found' });
}

function proxyRest(req, res, path, url) {
  const upstream = http.request({ host: '127.0.0.1', port: REST_PORT, path: path + url.search, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${REST_PORT}`, authorization: req.headers.authorization ?? `Bearer ${req.headers.apikey ?? ''}` } },
  (up) => { res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors(req) }); up.pipe(res); });
  upstream.on('error', () => send(res, 503, { code: 'server_error', message: 'PostgREST is not reachable' }));
  req.pipe(upstream);
}
const cors = (req) => ({ 'access-control-allow-origin': req.headers.origin ?? '*', 'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range' });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${GATEWAY_PORT}`);
  for (const [k, v] of Object.entries(cors(req))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return send(res, 204);
  try {
    if (url.pathname.startsWith('/rest/v1')) return proxyRest(req, res, url.pathname.slice('/rest/v1'.length) || '/', url);
    if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url.pathname.slice('/auth/v1'.length), url);
    if (url.pathname.startsWith('/functions/v1')) return await functions(req, res, url.pathname.slice('/functions/v1'.length));
    // The guardian page lives in apps/web (/veli). Run `npm run web` and open the printed link there.
    send(res, 404, { message: 'not found' });
  } catch (e) { console.error(e); send(res, 500, { code: 'server_error' }); }
}).listen(GATEWAY_PORT, LAN ? '0.0.0.0' : '127.0.0.1');

writeFileSync(join(root, 'apps/mobile/.env.localstack'), `EXPO_PUBLIC_APP_ENV=local\nEXPO_PUBLIC_SUPABASE_URL=http://${LAN_IP ?? '127.0.0.1'}:${GATEWAY_PORT}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}\n`);
writeFileSync(join(root, 'apps/web/.env.localstack'), `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${GATEWAY_PORT}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}\n`);
writeFileSync(join(root, 'apps/admin/.env.localstack'), `VITE_SUPABASE_URL=http://127.0.0.1:${GATEWAY_PORT}\nVITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}\n`);
if (LAN) console.log(`LAN mode: phones on this Wi-Fi reach the gateway at http://${LAN_IP}:${GATEWAY_PORT}`);
console.log(`TechApp local stack ready → http://127.0.0.1:${GATEWAY_PORT}  (.env.localstack written; run "npm run env:local" to point the apps here)\nOrganiser test login: organizator@techapp.test — OTP codes appear in this terminal.`);

const shutdown = async () => { postgrest.kill(); await db.end().catch(() => {}); await server.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
