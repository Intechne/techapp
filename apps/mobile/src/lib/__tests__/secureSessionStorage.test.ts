import { createChunkedStorage, type KeyValueBackend } from '../secureSessionStorage';

jest.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1 }));

function memoryBackend(limit = 2048) {
  const map = new Map<string, string>();
  const backend: KeyValueBackend = {
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => { if (v.length > limit) throw new Error('value too large'); map.set(k, v); },
    remove: async (k) => { map.delete(k); },
  };
  return { map, backend };
}

describe('chunked secure session storage', () => {
  it('round-trips a session larger than the SecureStore value limit', async () => {
    const { backend, map } = memoryBackend();
    const storage = createChunkedStorage(backend);
    const session = JSON.stringify({ access_token: 'a'.repeat(5000), refresh_token: 'r'.repeat(200) });
    await storage.setItem('sb-project-auth-token', session);
    expect(await storage.getItem('sb-project-auth-token')).toBe(session);
    expect([...map.values()].every((v) => v.length <= 2048)).toBe(true);
  });
  it('removes every chunk on sign-out and when overwriting with a shorter value', async () => {
    const { backend, map } = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('k', 'x'.repeat(6000));
    await storage.setItem('k', 'short');
    expect(map.size).toBe(2);
    await storage.removeItem('k');
    expect(map.size).toBe(0);
    expect(await storage.getItem('k')).toBeNull();
  });
  it('treats a torn write as signed-out instead of returning a corrupt token', async () => {
    const { backend, map } = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('k', 'x'.repeat(4000));
    map.delete('k.1');
    expect(await storage.getItem('k')).toBeNull();
  });
});
