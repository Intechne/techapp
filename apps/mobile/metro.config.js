// Without this file Expo uses getDefaultConfig(__dirname); that stays the default.
// Sentry's Metro config (debug IDs in the bundle so uploaded source maps match) is used only when the upload is fully
// configured, the same condition as the Sentry config plugin in app.config.ts. docs/CRASH-REPORTING.md.
const sentryUploadConfigured = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

module.exports = sentryUploadConfigured
  ? require('@sentry/react-native/metro').getSentryExpoConfig(__dirname)
  : require('expo/metro-config').getDefaultConfig(__dirname);
