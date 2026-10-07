import { validateEnv } from '../envValidation';

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
