import { createTimeoutFetch, RequestTimeoutError } from '../fetchWithTimeout';
import { classifyRestoreError, restoreSessionOnLaunch } from '../sessionRestore';
import { toAppError } from '../errors';

jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) }));

type GetSession = () => Promise<{ data: { session: unknown }; error: unknown }>;
function fakeClient(getSession: GetSession) {
  const signOut = jest.fn(async () => ({ error: null }));
  return { client: { auth: { getSession, signOut } } as never, signOut };
}
const online = async () => false;
const offline = async () => true;
const session = { access_token: 'a', user: { id: 'u1' } };

describe('createTimeoutFetch', () => {
  it('aborts a request that never answers and reports a timeout', async () => {
    const neverAnswers = ((_input: unknown, init: RequestInit = {}) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as typeof fetch;
    const f = createTimeoutFetch(20, neverAnswers);
    await expect(f('https://example.test')).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('passes through normal responses and caller aborts', async () => {
    const ok = (async () => new Response('ok')) as unknown as typeof fetch;
    await expect((await createTimeoutFetch(1000, ok)('https://example.test')).text()).resolves.toBe('ok');
    const controller = new AbortController();
    const hang = ((_i: unknown, init: RequestInit = {}) => new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new Error('caller aborted'))))) as typeof fetch;
    const p = createTimeoutFetch(1000, hang)('https://example.test', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toThrow('caller aborted');
  });

  it('timeouts map to the network error copy shown to users', () => {
    expect(toAppError(new RequestTimeoutError(15000)).code).toBe('network_unreachable');
  });
});

describe('classifyRestoreError', () => {
  it.each([
    [{ name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' }, 'dead_session'],
    [{ name: 'AuthApiError', status: 400, message: 'Invalid Refresh Token: Already Used' }, 'dead_session'],
    [{ name: 'AuthApiError', status: 401, code: 'bad_jwt' }, 'dead_session'],
    [{ name: 'AuthRetryableFetchError', status: 503 }, 'server_error'],
    [{ name: 'AuthUnknownError', status: 500 }, 'server_error'],
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' }, 'network'],
    [new TypeError('getaddrinfo ENOTFOUND project.supabase.co'), 'network'],
    [new RequestTimeoutError(15000), 'network'],
    [{ status: 429 }, 'network'],
  ])('%o → %s', (err, expected) => {
    expect(classifyRestoreError(err)).toBe(expected);
  });
});

describe('restoreSessionOnLaunch', () => {
  it('opens the app with the restored session', async () => {
    const { client } = fakeClient(async () => ({ data: { session }, error: null }));
    await expect(restoreSessionOnLaunch(client, { offlineCheck: online })).resolves.toEqual({ kind: 'ok', session });
  });

  it('opens the app as a guest when nobody is signed in', async () => {
    const { client } = fakeClient(async () => ({ data: { session: null }, error: null }));
    await expect(restoreSessionOnLaunch(client, { offlineCheck: online })).resolves.toEqual({ kind: 'ok', session: null });
  });

  it('never waits forever: a hanging restore becomes "unreachable" after the timeout', async () => {
    const { client, signOut } = fakeClient(() => new Promise(() => {}));
    await expect(restoreSessionOnLaunch(client, { timeoutMs: 30, offlineCheck: online })).resolves.toEqual({ kind: 'unavailable', reason: 'unreachable' });
    expect(signOut).not.toHaveBeenCalled(); // the stored session is kept for the retry
  });

  it('reports "offline" when the device has no internet', async () => {
    const { client } = fakeClient(async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' } }));
    await expect(restoreSessionOnLaunch(client, { offlineCheck: offline })).resolves.toEqual({ kind: 'unavailable', reason: 'offline' });
  });

  it('reports "unreachable" for DNS failures while online', async () => {
    const { client } = fakeClient(async () => { throw new TypeError('Network request failed'); });
    await expect(restoreSessionOnLaunch(client, { offlineCheck: online })).resolves.toEqual({ kind: 'unavailable', reason: 'unreachable' });
  });

  it('reports "server_error" for Supabase 5xx', async () => {
    const { client } = fakeClient(async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError', status: 503 } }));
    await expect(restoreSessionOnLaunch(client, { offlineCheck: online })).resolves.toEqual({ kind: 'unavailable', reason: 'server_error' });
  });

  it('drops a dead session (expired/revoked refresh token) and continues as a guest', async () => {
    const { client, signOut } = fakeClient(async () => ({ data: { session: null }, error: { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' } }));
    await expect(restoreSessionOnLaunch(client, { offlineCheck: online })).resolves.toEqual({ kind: 'ok', session: null });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
