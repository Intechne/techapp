/** Public runtime configuration. Only EXPO_PUBLIC_* values may live here: never secrets or service keys. */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
// Canonical: the new publishable key (sb_publishable_…). The legacy anon JWT is accepted only as a fallback for older projects.
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const env = {
  appEnv: (process.env.EXPO_PUBLIC_APP_ENV ?? 'local') as 'local' | 'development' | 'preview' | 'production',
  supabaseUrl: url,
  supabasePublishableKey: publishableKey,
  isConfigured: /^https?:\/\//.test(url) && publishableKey.length > 20,
  features: {
    // Later-phase modules stay in the codebase behind flags; they are never shown as working in the pilot.
    funding: false,
    wallet: false,
    paidLearning: false,
    techRank: false,
    aiCoach: false,
  },
} as const;
