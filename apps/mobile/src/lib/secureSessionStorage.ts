import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage adapter for the Supabase session. Tokens live in Keychain / Keystore, never AsyncStorage.
 * SecureStore values are limited to ~2KB, a session is larger, so values are split into chunks.
 * Web is a development-only target and falls back to localStorage.
 */
const CHUNK = 1800;
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export interface KeyValueBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const nativeBackend: KeyValueBackend = {
  get: (k) => SecureStore.getItemAsync(k, options),
  set: (k, v) => SecureStore.setItemAsync(k, v, options),
  remove: (k) => SecureStore.deleteItemAsync(k, options),
};
const webBackend: KeyValueBackend = {
  get: async (k) => globalThis.localStorage?.getItem(k) ?? null,
  set: async (k, v) => globalThis.localStorage?.setItem(k, v),
  remove: async (k) => globalThis.localStorage?.removeItem(k),
};

export function createChunkedStorage(backend: KeyValueBackend) {
  const removeChunks = async (key: string) => {
    const count = Number((await backend.get(`${key}.n`)) ?? 0);
    await Promise.all(Array.from({ length: count }, (_, i) => backend.remove(`${key}.${i}`)));
    await backend.remove(`${key}.n`);
  };
  return {
    async getItem(rawKey: string): Promise<string | null> {
      const key = safeKey(rawKey);
      try {
        const count = Number((await backend.get(`${key}.n`)) ?? 0);
        if (!count) return null;
        const parts = await Promise.all(Array.from({ length: count }, (_, i) => backend.get(`${key}.${i}`)));
        if (parts.some((p) => p === null)) { await removeChunks(key); return null; } // torn write → signed out, not crashed
        return parts.join('');
      } catch {
        return null;
      }
    },
    async setItem(rawKey: string, value: string): Promise<void> {
      const key = safeKey(rawKey);
      await removeChunks(key);
      const count = Math.ceil(value.length / CHUNK);
      for (let i = 0; i < count; i += 1) await backend.set(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
      await backend.set(`${key}.n`, String(count));
    },
    async removeItem(rawKey: string): Promise<void> {
      await removeChunks(safeKey(rawKey)).catch(() => {});
    },
  };
}

export const secureSessionStorage = createChunkedStorage(Platform.OS === 'web' ? webBackend : nativeBackend);
