import { registerRootComponent } from 'expo';
import App from './src/app/App';
import { initCrashReporting } from './src/lib/crash';

// Before the first render so start-up crashes are caught. A no-op without EXPO_PUBLIC_SENTRY_DSN.
initCrashReporting();

registerRootComponent(App);
