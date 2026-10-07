import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorState, Screen, ToastProvider, colors } from '../design-system';
import { SessionProvider, useSession } from '../features/auth/SessionProvider';
import { PendingIntentProvider } from '../features/auth/pendingIntent';
import { PrefsProvider, usePrefs } from '../features/onboarding/PrefsProvider';
import { env } from '../lib/env';
import { makeError } from '../lib/errors';
import { queryClient } from '../lib/queryClient';
import { linking } from '../navigation/linking';
import { RootNavigator } from '../navigation/RootNavigator';
import { StartupUnavailableScreen } from '../features/auth/StartupUnavailableScreen';
import { AppErrorBoundary } from './AppErrorBoundary';

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.canvas, primary: colors.primary, card: colors.surface, text: colors.ink, border: colors.border } };

function Gate() {
  const prefs = usePrefs();
  const session = useSession();
  // Fonts are bundled local assets; if they fail to load the system font is used instead of blocking startup.
  const [fontsLoaded, fontError] = useFonts({ Manrope_700Bold, Manrope_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });

  if (!env.isConfigured) return <Screen><ErrorState error={makeError('not_configured', 0, { retryable: false })} /></Screen>;
  // Restore is bounded (lib/sessionRestore): this branch always ends in the app, a guest session or the screen below.
  if ((session.status === 'unavailable' || session.status === 'retrying') && session.unavailableReason) {
    return <StartupUnavailableScreen reason={session.unavailableReason} onRetry={session.retry} retrying={session.status === 'retrying'} />;
  }
  if (!prefs.ready || !session.ready || (!fontsLoaded && !fontError)) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  return <NavigationContainer theme={navTheme} linking={linking}><RootNavigator /></NavigationContainer>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PrefsProvider><SessionProvider><PendingIntentProvider><ToastProvider>
          <StatusBar style="dark" />
          <Gate />
        </ToastProvider></PendingIntentProvider></SessionProvider></PrefsProvider>
      </QueryClientProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
