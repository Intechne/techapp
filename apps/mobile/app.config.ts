import type { ConfigContext, ExpoConfig } from 'expo/config';
import { validateEnv } from './src/lib/envValidation';

/**
 * app.json stays the source of the native config; this wrapper only refuses to build/export/publish a bundle whose
 * public configuration is unsafe. Expo evaluates it for `eas build`, `eas update` and `expo export`, after loading
 * EAS environment variables and .env files, so the check sees exactly what would be inlined into the bundle.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV;
  const strict = appEnv === 'preview' || appEnv === 'production' || process.env.EAS_BUILD_PROFILE === 'preview' || process.env.EAS_BUILD_PROFILE === 'production';
  const check = validateEnv({
    appEnv,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    releaseBuild: strict,
  });
  // A profile and its environment must agree: a production build never runs with preview/local settings.
  if (process.env.EAS_BUILD_PROFILE && ['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE) && appEnv !== process.env.EAS_BUILD_PROFILE) {
    check.problems.push(`EAS profile "${process.env.EAS_BUILD_PROFILE}" needs EXPO_PUBLIC_APP_ENV=${process.env.EAS_BUILD_PROFILE} (got ${appEnv ?? 'unset'})`);
  }
  if (strict && check.problems.length) {
    throw new Error(`TechApp: unsafe ${appEnv ?? ''} configuration, refusing to build:\n  - ${check.problems.join('\n  - ')}\n` +
      'Set the values in the EAS environment (eas env:create --environment <env>) and run eas build/update with --environment.');
  }
  return config as ExpoConfig;
};
