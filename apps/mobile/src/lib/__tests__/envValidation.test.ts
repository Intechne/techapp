import { validateEnv, validateSentryDsn } from '../envValidation';

const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.y`;
const REF = 'abcdefghijklmnopqrst';
const good = { url: `https://${REF}.supabase.co`, key: 'sb_publishable_abc123' };

describe('validateEnv', () => {
  it('accepts a public Supabase project with a publishable key for preview and production', () => {
    expect(validateEnv({ appEnv: 'production', ...good }).problems).toEqual([]);
    expect(validateEnv({ appEnv: 'preview', ...good, releaseBuild: true }).problems).toEqual([]);
    expect(validateEnv({ appEnv: 'production', url: good.url, key: jwt('anon') }).problems).toEqual([]); // legacy anon key
  });

  it.each([
    ['http', `http://${REF}.supabase.co`],
    ['localhost', 'https://localhost:54321'],
    ['127.0.0.1', 'https://127.0.0.1:54321'],
    ['LAN 192.168', 'https://192.168.8.102:54321'],
    ['LAN 10.x', 'https://10.0.0.4'],
    ['LAN 172.16-31', 'https://172.20.10.5:54321'],
    ['mDNS .local', 'https://omer-mac.local:54321'],
    ['unexpected host', 'https://api.example.com'],
  ])('production refuses %s', (_label, url) => {
    expect(validateEnv({ appEnv: 'production', url, key: good.key }).problems.length).toBeGreaterThan(0);
  });

  it('production never uses the staging project; development and preview may', () => {
    const staging = { url: 'https://pacvhcnawtnkauvguoaw.supabase.co', key: good.key };
    expect(validateEnv({ appEnv: 'production', ...staging, releaseBuild: true }).problems)
      .toContain('production must not use the staging Supabase project');
    expect(validateEnv({ appEnv: 'preview', ...staging, releaseBuild: true }).problems).toEqual([]);
    expect(validateEnv({ appEnv: 'development', ...staging }).problems).toEqual([]);
  });

  it('refuses secret / service-role keys everywhere, even locally', () => {
    for (const appEnv of ['local', 'development', 'preview', 'production']) {
      expect(validateEnv({ appEnv, url: good.url, key: 'sb_secret_abc' }).problems).toContain('a secret / service-role key must never be in the app');
      // eslint-disable-next-line no-restricted-syntax -- test fixture for the detector, not a key
      expect(validateEnv({ appEnv, url: good.url, key: jwt('service_role') }).problems).toContain('a secret / service-role key must never be in the app');
    }
  });

  it('requires a key and a known environment', () => {
    expect(validateEnv({ appEnv: 'production', url: good.url, key: '' }).problems).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
    expect(validateEnv({ appEnv: 'staging', ...good }).problems[0]).toMatch(/EXPO_PUBLIC_APP_ENV/);
  });

  it('local and development may use a LAN backend over http', () => {
    expect(validateEnv({ appEnv: 'local', url: 'http://192.168.8.102:54321', key: 'sb_publishable_x' }).problems).toEqual([]);
    expect(validateEnv({ appEnv: 'development', url: 'http://127.0.0.1:54321', key: jwt('anon') }).problems).toEqual([]);
  });

  it('a release bundle (store build / OTA) with local settings fails closed', () => {
    const check = validateEnv({ appEnv: 'local', url: 'http://192.168.8.102:54321', key: 'sb_publishable_x', releaseBuild: true });
    expect(check.strict).toBe(true);
    expect(check.problems).toEqual(expect.arrayContaining([
      'a release build must use EXPO_PUBLIC_APP_ENV=preview or production',
      'EXPO_PUBLIC_SUPABASE_URL points to a local or private network host',
    ]));
  });
});

describe('validateSentryDsn', () => {
  // Fake fixtures in Sentry's documented example format.
  const DEV = 'https://examplePublicKey@o0.ingest.de.sentry.io/1111111';
  const PROD = 'https://examplePublicKey@o0.ingest.de.sentry.io/2222222';

  it('no DSN means crash reporting is off, which is not a problem', () => {
    for (const dsn of [undefined, '', '   ']) expect(validateSentryDsn({ appEnv: 'production', dsn })).toEqual({ enabled: false, projectId: null, problems: [] });
  });

  it('accepts a public https DSN and reads its project id', () => {
    expect(validateSentryDsn({ appEnv: 'production', dsn: PROD })).toEqual({ enabled: true, projectId: '2222222', problems: [] });
    expect(validateSentryDsn({ appEnv: 'development', dsn: 'https://k@sentry.example.org/team/42' }).projectId).toBe('42');
  });

  it('refuses a DSN with a secret key, http, a private host or garbage', () => {
    expect(validateSentryDsn({ appEnv: 'local', dsn: 'https://pub:secret@o0.ingest.sentry.io/1' }).problems).toContain('EXPO_PUBLIC_SENTRY_DSN must be the public DSN, without a secret key');
    expect(validateSentryDsn({ appEnv: 'local', dsn: 'http://pub@o0.ingest.sentry.io/1' }).problems).toContain('EXPO_PUBLIC_SENTRY_DSN must use https');
    expect(validateSentryDsn({ appEnv: 'local', dsn: 'https://pub@192.168.1.5/1' }).problems).toContain('EXPO_PUBLIC_SENTRY_DSN points to a local or private network host');
    for (const dsn of ['not-a-dsn', 'https://o0.ingest.sentry.io/1', 'https://pub@o0.ingest.sentry.io/', 'https://pub@o0.ingest.sentry.io/abc']) {
      expect(validateSentryDsn({ appEnv: 'local', dsn }).enabled).toBe(false);
    }
  });

  it('production never reports into a non-production project; other environments may', () => {
    const nonProductionProjectIds = ['1111111'];
    expect(validateSentryDsn({ appEnv: 'production', dsn: DEV, nonProductionProjectIds }).problems).toEqual(['production must not report into a non-production Sentry project']);
    expect(validateSentryDsn({ appEnv: 'production', dsn: PROD, nonProductionProjectIds }).enabled).toBe(true);
    expect(validateSentryDsn({ appEnv: 'preview', dsn: DEV, nonProductionProjectIds }).enabled).toBe(true);
  });
});
