import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env } from './env';
import { createTimeoutFetch } from './fetchWithTimeout';
import { makeError } from './errors';
import { secureSessionStorage } from './secureSessionStorage';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

/** The only Supabase client. Uses the public publishable key (never a secret/service-role key); authorisation is enforced by RLS and RPCs on the server. */
export function getSupabase(): SupabaseClient<Database> {
  if (!env.isConfigured) throw makeError('not_configured', 0, { retryable: false });
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
      // OTP only: sessions never arrive through a URL, so supabase-js must not look for tokens in one.
      auth: { storage: secureSessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      // Every request has a deadline: a dead network or unreachable host must surface as an error, never an endless wait.
      global: { fetch: createTimeoutFetch() },
    });
    if (Platform.OS !== 'web') {
      const c = client;
      AppState.addEventListener('change', (state) => {
        if (state === 'active') c.auth.startAutoRefresh(); else c.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}
