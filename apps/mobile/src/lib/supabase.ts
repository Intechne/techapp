import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env } from './env';
import { makeError } from './errors';
import { secureSessionStorage } from './secureSessionStorage';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

/** The only Supabase client. Uses the public publishable key (never a secret/service-role key); authorisation is enforced by RLS and RPCs on the server. */
export function getSupabase(): SupabaseClient<Database> {
  if (!env.isConfigured) throw makeError('not_configured', 0, { retryable: false });
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
      auth: { storage: secureSessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
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
