/**
 * One rule set for the app's public configuration, used at runtime (lib/env.ts) and at build/update time
 * (app.config.ts). Plain CommonJS on purpose: Expo's config loader runs imported files without transpiling them.
 * Types: envValidation.d.ts.
 *
 *   local / development  any URL (LAN, http) is fine — but never a secret key
 *   preview / production https, a public *.supabase.co project host, a publishable (or legacy anon) key
 *   production           never the staging project (STAGING_PROJECT_REFS): staging data must not reach store users
 *   release JS bundle    must be preview or production: a bundle built with local settings must not run in a store
 *                        build or arrive through an OTA update
 *
 * Crash reporting (validateSentryDsn) is separate on purpose: a missing or bad DSN only switches crash reporting off,
 * it never makes the app "not configured". Builds (app.config.ts) refuse a bad DSN for preview/production.
 */
const APP_ENVS = ['local', 'development', 'preview', 'production'];

const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*)$|\.(local|lan|internal|home|localhost)$/i;
const SUPABASE_PROJECT_HOST = /^[a-z0-9]{20}\.supabase\.co$/;
// Remote staging (Supabase project "techapp"). development and preview builds use it; production must not.
const STAGING_PROJECT_REFS = ['pacvhcnawtnkauvguoaw'];

function jwtRole(key) {
  const part = key.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(b64) : globalThis.Buffer.from(b64, 'base64').toString('utf8');
    const role = JSON.parse(json).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line no-restricted-syntax -- detects (and rejects) a service-role key; contains no key
const isSecretKey = (key) => key.startsWith('sb_secret_') || jwtRole(key) === 'service_role';
const isPrivateHost = (host) => PRIVATE_HOST.test(host);

// Sentry project ids that receive local / development / preview events (docs/CRASH-REPORTING.md). A production build
// must never report into one of them, so production and test data stay in separate projects. Filled in when the
// projects are created; only the numeric project id is listed, never a key.
const NON_PRODUCTION_SENTRY_PROJECT_IDS = [];

// https://<public key>@<host>[:port]/[path/]<project id>. Parsed with a regex: lib/crash.ts runs before the URL polyfill loads.
const SENTRY_DSN = /^([a-z]+):\/\/([^:@/\s]+)(?::([^@/\s]*))?@([^/:@\s]+)(?::\d+)?(?:\/[^\s?#]*)?\/(\d+)\/?$/i;

function validateSentryDsn({ appEnv, dsn = '', nonProductionProjectIds = NON_PRODUCTION_SENTRY_PROJECT_IDS }) {
  const value = (dsn ?? '').trim();
  if (!value) return { enabled: false, projectId: null, problems: [] };
  const m = SENTRY_DSN.exec(value);
  if (!m) return { enabled: false, projectId: null, problems: ['EXPO_PUBLIC_SENTRY_DSN is not a Sentry DSN'] };
  const [, protocol, , secret, host, projectId] = m;
  const problems = [];
  if (secret !== undefined) problems.push('EXPO_PUBLIC_SENTRY_DSN must be the public DSN, without a secret key');
  if (protocol.toLowerCase() !== 'https') problems.push('EXPO_PUBLIC_SENTRY_DSN must use https');
  if (isPrivateHost(host)) problems.push('EXPO_PUBLIC_SENTRY_DSN points to a local or private network host');
  if (appEnv === 'production' && nonProductionProjectIds.includes(projectId)) {
    problems.push('production must not report into a non-production Sentry project');
  }
  return { enabled: problems.length === 0, projectId, problems };
}

function validateEnv({ appEnv, url = '', key = '', releaseBuild = false }) {
  const problems = [];
  const known = APP_ENVS.includes(appEnv ?? '') ? appEnv : null;
  if (!known) problems.push(`EXPO_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(', ')}`);
  const strict = releaseBuild || known === 'preview' || known === 'production';
  if (releaseBuild && known !== 'preview' && known !== 'production') {
    problems.push('a release build must use EXPO_PUBLIC_APP_ENV=preview or production');
  }

  let parsed = null;
  try { parsed = new URL(url); } catch { problems.push('EXPO_PUBLIC_SUPABASE_URL is missing or not a URL'); }
  if (parsed && !/^https?:$/.test(parsed.protocol)) problems.push('EXPO_PUBLIC_SUPABASE_URL must be http(s)');

  if (!key) problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
  else if (isSecretKey(key)) problems.push('a secret / service-role key must never be in the app');

  if (strict && parsed) {
    if (parsed.protocol !== 'https:') problems.push('EXPO_PUBLIC_SUPABASE_URL must use https');
    if (isPrivateHost(parsed.hostname)) problems.push('EXPO_PUBLIC_SUPABASE_URL points to a local or private network host');
    else if (!SUPABASE_PROJECT_HOST.test(parsed.hostname)) problems.push('EXPO_PUBLIC_SUPABASE_URL must be a <project-ref>.supabase.co host');
    else if (known === 'production' && STAGING_PROJECT_REFS.includes(parsed.hostname.split('.')[0])) {
      problems.push('production must not use the staging Supabase project');
    }
  }
  if (strict && key && !isSecretKey(key) && !key.startsWith('sb_publishable_') && jwtRole(key) !== 'anon') {
    problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a publishable key');
  }
  return { appEnv: known, strict, problems };
}

module.exports = { APP_ENVS, NON_PRODUCTION_SENTRY_PROJECT_IDS, STAGING_PROJECT_REFS, isPrivateHost, isSecretKey, validateEnv, validateSentryDsn };
