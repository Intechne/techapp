#!/usr/bin/env node
/**
 * Docker-free LOCAL development stack. Not for staging/production: those use a real Supabase project.
 *
 *   embedded PostgreSQL (:54322)  ←  PostgREST (:54323)  ←  gateway (:54321, Supabase-compatible paths)
 *
 * The gateway serves /rest/v1 (PostgREST), a minimal GoTrue-compatible /auth/v1 (e-mail OTP; the code is printed
 * to this terminal instead of being e-mailed), dev versions of our Edge Functions under /functions/v1, and the
 * guardian consent page under /guardian. The mobile app runs unmodified against it with the real supabase-js client.
 * Binds to 127.0.0.1 only. Requires `brew install postgrest`. Use `--reset` to recreate the database.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dataDir = join(here, '.pgdata');
const secretFile = join(here, '.jwt-secret');
const PG_PORT = 54322, REST_PORT = 54323, GATEWAY_PORT = 54321;

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

if (fresh) {
  await db.query(readFileSync(join(root, 'supabase/tests/supabase-shim.sql'), 'utf8'));
  for (const f of readdirSync(join(root, 'supabase/migrations')).filter((x) => x.endsWith('.sql')).sort()) {
    await db.query(readFileSync(join(root, 'supabase/migrations', f), 'utf8'));
  }
  await db.query(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  // Dev organiser: owner of the first demo organisation + platform admin. Sign in with this address (OTP is printed here).
  const id = randomUUID();
  await db.query(`insert into auth.users (id, email) values ($1, 'organizator@techapp.test')`, [id]);
  await db.query(`insert into public.organization_members (organization_id, user_id, role) select id, $1, 'owner' from public.organizations where is_demo`, [id]);
  await db.query(`insert into public.platform_admins (user_id) values ($1)`, [id]);
  console.log('database created: migrations + seed applied');
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

// Dev equivalents of supabase/functions/*. Same contracts; e-mail is replaced by a console link.
async function functions(req, res, path) {
  const claims = bearer(req); const body = await readBody(req);
  if (claims?.role !== 'authenticated') return send(res, 401, { code: 'auth_required' });
  if (path === '/guardian-dispatch') {
    const owner = await db.query(`select 1 from public.guardian_requests where id = $1 and user_id = $2`, [body.request_id, claims.sub]);
    if (!owner.rowCount) return send(res, 404, { code: 'guardian_request_not_found' });
    const client = await db.connect();
    try {
      await client.query('begin'); await client.query('set local role service_role');
      const { rows } = await client.query(`select public.issue_guardian_token($1) j`, [body.request_id]);
      await client.query('commit');
      const link = `http://127.0.0.1:${GATEWAY_PORT}/guardian#${rows[0].j.token}`;
      writeFileSync(join(here, '.last-guardian-link'), link);
      console.log(`\n  ✉  Guardian link for ${rows[0].j.guardian_email}:\n     ${link}\n`);
      return send(res, 200, { sent: true });
    } catch (e) {
      await client.query('rollback').catch(() => {});
      const status = /^PT(\d{3})$/.exec(e.code ?? '')?.[1];
      return send(res, status ? Number(status) : 500, { code: status ? e.message : 'server_error' });
    } finally { client.release(); }
  }
  if (path === '/delete-account') {
    await db.query(`delete from auth.users where id = $1`, [claims.sub]);
    return send(res, 200, { deleted: true });
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
    if (url.pathname === '/guardian') {
      const html = readFileSync(join(root, 'apps/guardian-web/index.html'), 'utf8')
        .replace('__SUPABASE_URL__', `http://127.0.0.1:${GATEWAY_PORT}`).replace('__SUPABASE_PUBLISHABLE_KEY__', ANON_KEY);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html);
    }
    send(res, 404, { message: 'not found' });
  } catch (e) { console.error(e); send(res, 500, { code: 'server_error' }); }
}).listen(GATEWAY_PORT, '127.0.0.1');

writeFileSync(join(root, 'apps/mobile/.env.local'), `EXPO_PUBLIC_APP_ENV=local\nEXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:${GATEWAY_PORT}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}\n`);
console.log(`TechApp local stack ready → http://127.0.0.1:${GATEWAY_PORT}  (apps/mobile/.env.local written)\nOrganiser test login: organizator@techapp.test — OTP codes appear in this terminal.`);

const shutdown = async () => { postgrest.kill(); await db.end().catch(() => {}); await server.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
