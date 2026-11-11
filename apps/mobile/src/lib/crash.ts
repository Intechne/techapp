import * as Sentry from '@sentry/react-native';
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import { APP_ENVS, validateSentryDsn, type AppEnv } from './envValidation';

/**
 * Crash reporting (Sentry), privacy-first and OFF unless EXPO_PUBLIC_SENTRY_DSN is set. The only file that imports
 * the SDK; everything else calls initCrashReporting() once at startup and captureError() from error boundaries.
 * Users include minors: no user, e-mail, name, IP, request bodies or headers ever leave the device. Details and the
 * open decisions (retention, DSN connection): docs/CRASH-REPORTING.md.
 */

const FILTERED = '[filtered]';
// Order matters: tokens and keys first, so the e-mail and digit rules never see half a token.
const PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, FILTERED],
  [/eyJ[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]+){0,2}/g, FILTERED], // JWT (access / refresh / anon)
  [/\bsb_[A-Za-z0-9_-]+/g, FILTERED], // Supabase publishable / secret keys
  [/\bTA1\.[A-Za-z0-9._~+/=-]+/g, FILTERED], // participation card QR payload
  // UUIDs: user / registration / team ids. Issue grouping is stack based, so nothing useful is lost.
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, FILTERED],
  // E-mail, Unicode-safe (ayşe.yılmaz@okul.k12.tr): non-separators around an @ and a dotted domain. Every part is
  // bounded (local 64, label 63, at most 8 labels, TLD 24) so the cost per start position is constant: linear overall.
  [/[^\s@"'<>()[\]{},;:\/\\?=&#]{1,64}@(?:[^\s@"'<>()[\]{},;:\/\\?=&#.]{1,63}\.){1,8}[^\s@"'<>()[\]{},;:\/\\?=&#.]{2,24}/gu, FILTERED],
  [/(^|\D)\d{6}(?!\d)/g, `$1${FILTERED}`], // stand-alone 6-digit codes (OTP). No lookbehind: Hermes-safe.
];

const URL_SCHEME_TAIL = /[a-z][a-z0-9+.-]{0,31}$/i;

/**
 * Removes the query string and fragment of every `scheme://…` URL. A token scan instead of one regex: a regex over
 * `scheme://path` backtracks on every `://` (quadratic on input like `a://a://…`); this is one pass per token.
 */
function stripUrlQueries(value: string): string {
  if (!value.includes('://')) return value;
  return value.split(/([\s"'<>]+)/).map((token) => {
    const at = token.indexOf('://');
    if (at <= 0 || !URL_SCHEME_TAIL.test(token.slice(Math.max(0, at - 32), at))) return token;
    const rest = token.slice(at + 3);
    const cut = rest.search(/[?#]/);
    return cut < 0 ? token : token.slice(0, at + 3 + cut);
  }).join('');
}

// Every string is cut to 8 KB before the regex pass: a huge payload can never stall the JS thread inside beforeSend.
const MAX_STRING = 8192;
const TRUNCATED = '…[truncated]';
const TRUNCATE_STOP = /[\s"'<>()[\]{},;]/;

function truncate(value: string): string {
  if (value.length <= MAX_STRING) return value;
  // Drop the last, possibly cut, word too (back to whitespace / quote / bracket / comma): half an e-mail or token
  // (`ayse@exa`) would no longer match its pattern and leak. A plain loop, no regex.
  let end = MAX_STRING;
  while (end > 0 && !TRUNCATE_STOP.test(value.charAt(end - 1))) end--;
  return value.slice(0, end) + TRUNCATED;
}

export function scrubString(value: string): string {
  return stripUrlQueries(PATTERNS.reduce((s, [re, to]) => s.replace(re, to), truncate(value)));
}

// Values under these keys are never sent, whatever they look like.
const SENSITIVE_KEY = /token|password|passwd|secret|authorization|cookie|session|otp|email|e_mail|phone|birth|guardian/i;
// Under a "...code" key only a machine code (otp_expired, render_crash) or a numeric HTTP status survives; a code
// typed by the person (an OTP) never does.
const CODE_KEY = /code/i;
export const MACHINE_CODE = /^[a-z][a-z0-9_]{0,63}$/;

function scrubKeyed(key: string, value: unknown, depth: number): unknown {
  if (SENSITIVE_KEY.test(key)) return FILTERED;
  if (CODE_KEY.test(key)) {
    if (key === 'status_code' && typeof value === 'number') return value;
    return typeof value === 'string' && MACHINE_CODE.test(value) ? value : FILTERED;
  }
  return scrubDeep(value, depth + 1);
}

function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === 'string') return scrubString(value) as T;
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubKeyed(k, v, depth);
  return out as T;
}

// Contexts the SDK fills with technical, non-personal data; left as they are (device.name is still removed).
// Any other context (custom or unknown) is scrubbed like extra.
const SDK_CONTEXTS = new Set(['app', 'device', 'os', 'culture', 'runtime', 'trace', 'ota_updates', 'react_native_context']);

/** Pure. Drops console breadcrumbs (they may echo anything), scrubs the message and data of the rest. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;
  const out: Breadcrumb = { ...breadcrumb };
  if (typeof out.message === 'string') out.message = scrubString(out.message);
  if (out.data) out.data = scrubDeep(out.data);
  return out;
}

/** Pure, never mutates its input. Runs as beforeSend on every JS event, including native breadcrumbs merged into it. */
export function scrubEvent<E extends ErrorEvent>(event: E): E | null {
  const out: E = { ...event };
  delete out.user;
  delete out.server_name;
  if (typeof out.message === 'string') out.message = scrubString(out.message);
  if (out.exception?.values) {
    out.exception = { ...out.exception, values: out.exception.values.map((ex) => (typeof ex.value === 'string' ? { ...ex, value: scrubString(ex.value) } : ex)) };
  }
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null);
  if (out.extra) out.extra = scrubDeep(out.extra);
  if (out.tags) out.tags = scrubDeep(out.tags);
  if (out.request) {
    const { data: _data, headers: _headers, cookies: _cookies, query_string: _query, env: _env, ...rest } = out.request;
    out.request = { ...rest, ...(typeof rest.url === 'string' ? { url: scrubString(rest.url) } : {}) };
  }
  if (out.contexts) {
    const contexts: NonNullable<E['contexts']> = {};
    for (const [name, ctx] of Object.entries(out.contexts)) {
      if (!SDK_CONTEXTS.has(name)) contexts[name] = scrubDeep(ctx);
      else if (name === 'device' && ctx) {
        // Technical fields (model, family, memory…) stay; the name and any device identifier go.
        const { name: _name, id: _id, device_unique_identifier: _uid, ...device } = ctx as Record<string, unknown>;
        contexts[name] = device;
      }
      else contexts[name] = ctx;
    }
    out.contexts = contexts;
  }
  return out;
}

let initialised = false;

/** Called once from index.ts. A no-op without a DSN, with an unusable DSN, or when the SDK cannot start. */
export function initCrashReporting(): void {
  if (initialised) return;
  // Literal process.env.EXPO_PUBLIC_* reads so Metro inlines them into the bundle.
  const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();
  const rawEnv = process.env.EXPO_PUBLIC_APP_ENV;
  const environment: AppEnv = (APP_ENVS as readonly string[]).includes(rawEnv ?? '') ? (rawEnv as AppEnv) : 'local';
  if (!validateSentryDsn({ appEnv: environment, dsn }).enabled) return;
  try {
    Sentry.init({
      dsn,
      environment,
      // release / dist are deliberately not set: the native SDK reports `<bundle id>@<version>+<build>` and the build
      // number, so JS and native crashes land on the same release and match uploaded source maps / debug files.
      sendDefaultPii: false,
      maxBreadcrumbs: 30,
      // No performance tracing, profiling or session replay: their options are opt-in by presence, so none is set.
      enableAutoPerformanceTracing: false,
      enableAppStartTracking: false,
      enableNativeFramesTracking: false,
      enableStallTracking: false,
      enableUserInteractionTracing: false,
      // No sessions (release health), screenshots, view hierarchy, failed-request events or logs.
      enableAutoSessionTracking: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      enableLogs: false,
      spotlight: false,
      // Breadcrumbs: only what the app adds itself. Console may echo anything; xhr/fetch record every Supabase URL.
      integrations: (defaults) => [
        ...defaults.filter((i) => i.name !== 'Breadcrumbs' && i.name !== 'HttpContext'),
        Sentry.breadcrumbsIntegration({ console: false, xhr: false, fetch: false, dom: false, history: false, sentry: false }),
      ],
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
      // Passed through to sentry-cocoa (iOS): no automatic UI / network breadcrumbs on native crashes either,
      // which do not run beforeSend. Android's native breadcrumbs carry lifecycle and class names only.
      ...({ enableAutoBreadcrumbTracking: false, enableNetworkBreadcrumbs: false } as Record<string, boolean>),
    });
    initialised = true;
  } catch {
    // Crash reporting must never take the app down with it.
  }
}

const TAG_VALUE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

/** Reports a caught error with at most two machine tags. Nothing else is attached; beforeSend scrubs the message. */
export function captureError(e: unknown, context: { screen?: string; code?: string } = {}): void {
  if (!initialised) return;
  try {
    const tags: Record<string, string> = {};
    if (context.screen && TAG_VALUE.test(context.screen)) tags.screen = context.screen;
    if (context.code && MACHINE_CODE.test(context.code)) tags.code = context.code;
    // A thrown plain object (e.g. an AppError with fieldErrors) is never serialised as is: only its machine code.
    const code = typeof (e as { code?: unknown } | null)?.code === 'string' ? (e as { code: string }).code : '';
    const error = e instanceof Error ? e : new Error(MACHINE_CODE.test(code) ? code : 'non_error_thrown');
    Sentry.captureException(error, { tags });
  } catch {
    /* never break UX */
  }
}
