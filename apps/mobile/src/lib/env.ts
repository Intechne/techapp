import { validateEnv, type AppEnv } from './envValidation';

/** Public runtime configuration. Only EXPO_PUBLIC_* values may live here: never secrets or service keys. */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
// Canonical: the new publishable key (sb_publishable_…). The legacy anon JWT is accepted only as a fallback for older projects.
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// A release bundle (store build or OTA update) with local/LAN settings fails closed: the app shows the
// "not configured" screen instead of talking to a developer machine. app.config.ts refuses to build one in the first place.
const check = validateEnv({ appEnv: process.env.EXPO_PUBLIC_APP_ENV, url, key: publishableKey, releaseBuild: !__DEV__ });

export const env = {
  appEnv: (check.appEnv ?? 'local') as AppEnv,
  supabaseUrl: url,
  supabasePublishableKey: publishableKey,
  isConfigured: check.problems.length === 0,
  /** Developer-facing reasons (never shown to users). */
  configProblems: check.problems,
} as const;
