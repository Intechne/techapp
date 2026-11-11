import type { ConfigContext, ExpoConfig } from 'expo/config';
import { validateEnv, validateSentryDsn } from './src/lib/envValidation';

/**
 * app.json stays the source of the native config; this wrapper only refuses to build/export/publish a bundle whose
 * public configuration is unsafe. Expo evaluates it for `eas build`, `eas update` and `expo export`, after loading
 * EAS environment variables and .env files, so the check sees exactly what would be inlined into the bundle.
 *
 * Sentry: the runtime SDK (@sentry/react-native) is autolinked and needs no config plugin. The plugin
 * (@sentry/react-native/expo) only adds the native build steps that upload source maps and debug symbols; without an
 * auth token those steps fail the release build (sentry-xcode.sh exits 1, the Gradle upload task errors). So it is
 * added only when the upload is fully configured (SENTRY_AUTH_TOKEN as an EAS secret + SENTRY_ORG + SENTRY_PROJECT).
 * metro.config.js uses the same condition. docs/CRASH-REPORTING.md.
 */
const sentryUploadConfigured = (env: NodeJS.ProcessEnv = process.env) =>
  Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);

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
  // A bad DSN only switches crash reporting off at runtime; a release build refuses it so it is noticed.
  check.problems.push(...validateSentryDsn({ appEnv, dsn: process.env.EXPO_PUBLIC_SENTRY_DSN }).problems);
  if (strict && check.problems.length) {
    throw new Error(`TechApp: unsafe ${appEnv ?? ''} configuration, refusing to build:\n  - ${check.problems.join('\n  - ')}\n` +
      'Set the values in the EAS environment (eas env:create --environment <env>) and run eas build/update with --environment.');
  }
  if (!sentryUploadConfigured()) return config as ExpoConfig;
  return {
    ...config,
    // organization / project are slugs, not secrets; the token is read from SENTRY_AUTH_TOKEN by sentry-cli, never written.
    plugins: [...(config.plugins ?? []), ['@sentry/react-native/expo', {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      ...(process.env.SENTRY_URL ? { url: process.env.SENTRY_URL } : {}),
    }]],
  } as ExpoConfig;
};
