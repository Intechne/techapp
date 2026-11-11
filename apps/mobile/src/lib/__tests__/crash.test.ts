import type { ErrorEvent, Breadcrumb } from '@sentry/react-native';

// Fake fixtures in Sentry's documented example format. Not real projects or keys.
const DSN = 'https://examplePublicKey@o0.ingest.de.sentry.io/1111111';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXBhcnQ';

type Crash = typeof import('../crash');
type SentryMock = { init: jest.Mock; captureException: jest.Mock; breadcrumbsIntegration: jest.Mock };

/** A fresh copy of crash.ts (module state: initialised or not) and the Sentry mock it sees. */
function load(envVars: Record<string, string | undefined>): { crash: Crash; Sentry: SentryMock } {
  jest.clearAllMocks();
  for (const [k, v] of Object.entries(envVars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  let out!: { crash: Crash; Sentry: SentryMock };
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module registry per test needs require()
    out = { crash: require('../crash'), Sentry: require('@sentry/react-native') };
  });
  return out;
}

const saved = { dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, appEnv: process.env.EXPO_PUBLIC_APP_ENV };
afterEach(() => {
  load({ EXPO_PUBLIC_SENTRY_DSN: saved.dsn, EXPO_PUBLIC_APP_ENV: saved.appEnv });
});

describe('initCrashReporting', () => {
  it('is a no-op without a DSN', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: undefined, EXPO_PUBLIC_APP_ENV: 'production' });
    crash.initCrashReporting();
    expect(Sentry.init).not.toHaveBeenCalled();
    crash.captureError(new Error('x'));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('is a no-op with a blank DSN', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: '  ', EXPO_PUBLIC_APP_ENV: 'development' });
    crash.initCrashReporting();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initialises once with privacy-first options and the app environment', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_APP_ENV: 'preview' });
    crash.initCrashReporting();
    crash.initCrashReporting();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = Sentry.init.mock.calls[0][0];
    expect(options).toMatchObject({
      dsn: DSN,
      environment: 'preview',
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      enableLogs: false,
      enableAutoSessionTracking: false,
      enableAutoPerformanceTracing: false,
      enableUserInteractionTracing: false,
      // iOS native SDK options (passed through to sentry-cocoa): no automatic network/UI breadcrumbs.
      enableAutoBreadcrumbTracking: false,
      enableNetworkBreadcrumbs: false,
    });
    // Tracing, profiling and replay are opt-in by the mere presence of a number: none may be present.
    for (const key of ['tracesSampleRate', 'tracesSampler', 'profilesSampleRate', 'replaysSessionSampleRate', 'replaysOnErrorSampleRate']) {
      expect(options).not.toHaveProperty(key);
    }
    // release/dist are not overridden: the native SDK sets them from the app version and build number.
    expect(options).not.toHaveProperty('release');
    expect(options).not.toHaveProperty('dist');
    expect(options.beforeSend).toBe(crash.scrubEvent);
    expect(options.beforeBreadcrumb).toBe(crash.scrubBreadcrumb);
  });

  it('replaces the default breadcrumbs with one that records no console, network, DOM or history', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_APP_ENV: 'production' });
    crash.initCrashReporting();
    const { integrations } = Sentry.init.mock.calls[0][0];
    const defaults = [{ name: 'Breadcrumbs' }, { name: 'Dedupe' }, { name: 'HttpContext' }];
    const result = integrations(defaults);
    expect(Sentry.breadcrumbsIntegration).toHaveBeenCalledWith({ console: false, xhr: false, fetch: false, dom: false, history: false, sentry: false });
    expect(result.filter((i: { name: string }) => i.name === 'Breadcrumbs')).toEqual([{ name: 'Breadcrumbs', options: expect.objectContaining({ console: false }) }]);
    expect(result.map((i: { name: string }) => i.name)).toEqual(expect.arrayContaining(['Dedupe']));
    expect(result.map((i: { name: string }) => i.name)).not.toContain('HttpContext');
  });

  it.each([
    ['local', 'local'], ['development', 'development'], ['production', 'production'], ['staging', 'local'], [undefined, 'local'],
  ])('environment for EXPO_PUBLIC_APP_ENV=%s is %s', (appEnv, expected) => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_APP_ENV: appEnv });
    crash.initCrashReporting();
    expect(Sentry.init.mock.calls[0][0].environment).toBe(expected);
  });

  it('stays off when the DSN is unusable (secret part, not a DSN)', () => {
    for (const dsn of ['https://public:secret@o0.ingest.de.sentry.io/1111111', 'not-a-dsn']) {
      const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: dsn, EXPO_PUBLIC_APP_ENV: 'development' });
      crash.initCrashReporting();
      expect(Sentry.init).not.toHaveBeenCalled();
    }
  });

  it('never throws if the SDK does', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_APP_ENV: 'development' });
    Sentry.init.mockImplementationOnce(() => { throw new Error('native module missing'); });
    expect(() => crash.initCrashReporting()).not.toThrow();
    expect(() => crash.captureError(new Error('x'))).not.toThrow();
  });
});

describe('captureError', () => {
  it('attaches only the screen and code tags', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_APP_ENV: 'development' });
    crash.initCrashReporting();
    const err = new Error('boom');
    crash.captureError(err, { screen: 'EventDetail', code: 'render_crash' });
    expect(Sentry.captureException).toHaveBeenCalledWith(err, { tags: { screen: 'EventDetail', code: 'render_crash' } });
    crash.captureError(err);
    expect(Sentry.captureException).toHaveBeenLastCalledWith(err, { tags: {} });
  });

  it('drops tag values that are not short machine identifiers', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_APP_ENV: 'development' });
    crash.initCrashReporting();
    crash.captureError(new Error('x'), { screen: 'ayse@example.com', code: 'Kod 123456 hatalı' });
    expect(Sentry.captureException.mock.calls[0][1]).toEqual({ tags: {} });
  });

  it('never sends a thrown non-Error object as is (it may carry field values)', () => {
    const { crash, Sentry } = load({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_APP_ENV: 'development' });
    crash.initCrashReporting();
    crash.captureError({ code: 'otp_invalid', message: 'x', fieldErrors: { email: 'ayse@example.com' } });
    const [sent] = Sentry.captureException.mock.calls[0];
    expect(sent).toBeInstanceOf(Error);
    expect(sent.message).toBe('otp_invalid');
    expect(JSON.stringify(sent)).not.toContain('ayse');
  });
});

describe('scrubEvent', () => {
  const { scrubEvent } = jest.requireActual<Crash>('../crash');
  const F = '[filtered]';

  it('removes the user entirely (no id, e-mail or IP)', () => {
    const out = scrubEvent({ type: undefined, user: { id: 'u-1', email: 'a@b.co', ip_address: '1.2.3.4', username: 'ayse' } } as ErrorEvent)!;
    expect(out.user).toBeUndefined();
  });

  it.each([
    ['e-mail', 'login failed for ayse.yilmaz+test@example.com.tr', `login failed for ${F}`],
    ['6-digit code', 'verify 482913 failed', `verify ${F} failed`],
    ['6-digit code at start', '482913', F],
    ['JWT', `token ${JWT} rejected`, `token ${F} rejected`],
    ['sb_ key', 'key sb_publishable_AbC123_x-y used', `key ${F} used`],
    ['sb_secret key', 'sb_secret_ZZZ999', F],
    ['Bearer', 'Authorization: Bearer abc.def-ghi_123', `Authorization: ${F}`],
    ['QR payload', 'scan TA1.6f1c2d3e-0000-4000-8000-000000000001.Zm9vYmFy ok', `scan ${F} ok`],
    ['URL query', 'GET https://abc.supabase.co/rest/v1/events?select=*&id=eq.42 500', 'GET https://abc.supabase.co/rest/v1/events 500'],
    ['deep link query', 'open techapp://guardian/approve?token=xyz#frag', 'open techapp://guardian/approve'],
  ])('filters %s in messages, exceptions and breadcrumbs', (_label, input, expected) => {
    const out = scrubEvent({
      type: undefined,
      message: input,
      exception: { values: [{ type: 'Error', value: input }] },
      breadcrumbs: [{ message: input, data: { note: input, nested: { deep: [input] } } }],
      extra: { detail: input },
      tags: { t: input },
    } as unknown as ErrorEvent)!;
    expect(out.message).toBe(expected);
    expect(out.exception!.values![0]!.value).toBe(expected);
    expect(out.breadcrumbs![0]!.message).toBe(expected);
    expect(out.breadcrumbs![0]!.data).toEqual({ note: expected, nested: { deep: [expected] } });
    expect(out.extra).toEqual({ detail: expected });
    expect(out.tags).toEqual({ t: expected });
  });

  it('keeps longer digit runs and ids intact (only stand-alone 6-digit codes are codes)', () => {
    const out = scrubEvent({ type: undefined, message: 'build 1234567 id 6f1c2d3e-0000-4000-8000-000000000001' } as ErrorEvent)!;
    expect(out.message).toBe('build 1234567 id 6f1c2d3e-0000-4000-8000-000000000001');
  });

  it('removes request body, headers, cookies and query string; strips the URL query', () => {
    const out = scrubEvent({
      type: undefined,
      request: {
        url: 'https://abc.supabase.co/auth/v1/verify?token=482913&email=a@b.co',
        method: 'POST',
        data: { email: 'a@b.co', token: '482913' },
        headers: { Authorization: `Bearer ${JWT}`, apikey: 'sb_publishable_x' },
        cookies: { sid: 'x' },
        query_string: 'token=482913',
        env: { REMOTE_ADDR: '1.2.3.4' },
      },
    } as ErrorEvent)!;
    expect(out.request).toEqual({ url: 'https://abc.supabase.co/auth/v1/verify', method: 'POST' });
  });

  it('strips URL queries in breadcrumb data and drops console breadcrumbs', () => {
    const out = scrubEvent({
      type: undefined,
      breadcrumbs: [
        { category: 'console', message: 'debug ayse@example.com' },
        { type: 'http', category: 'xhr', data: { url: 'https://abc.supabase.co/rest/v1/profiles?id=eq.1', method: 'GET', status_code: 200 } },
      ],
    } as ErrorEvent)!;
    expect(out.breadcrumbs).toEqual([{ type: 'http', category: 'xhr', data: { url: 'https://abc.supabase.co/rest/v1/profiles', method: 'GET', status_code: 200 } }]);
  });

  it('drops the device name and server name', () => {
    const out = scrubEvent({ type: undefined, server_name: 'Ayse-iPhone', contexts: { device: { name: "Ayşe'nin iPhone'u", model: 'iPhone15,2' } } } as ErrorEvent)!;
    expect(out.server_name).toBeUndefined();
    expect(out.contexts!.device).toEqual({ model: 'iPhone15,2' });
  });

  it('does not mutate its input', () => {
    const input = { type: undefined, message: 'code 482913', user: { id: 'u' } } as ErrorEvent;
    scrubEvent(input);
    expect(input).toEqual({ type: undefined, message: 'code 482913', user: { id: 'u' } });
  });
});

describe('scrubBreadcrumb', () => {
  const { scrubBreadcrumb } = jest.requireActual<Crash>('../crash');

  it('drops console breadcrumbs and scrubs the rest', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: 'Otp?email=a@b.co', to: 'Home' } } as Breadcrumb))
      .toEqual({ category: 'navigation', data: { from: 'Otp?email=[filtered]', to: 'Home' } });
    expect(scrubBreadcrumb({ message: 'code 482913', data: { url: 'https://x.io/a?b=c' } })).toEqual({ message: 'code [filtered]', data: { url: 'https://x.io/a' } });
  });
});
