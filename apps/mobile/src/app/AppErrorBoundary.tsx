import React from 'react';
import { View } from 'react-native';
import { Button, Text, colors, space } from '../design-system';
import { track } from '../lib/analytics';

interface State { failed: boolean }

/**
 * Last line of defence for render-time crashes: a calm screen with a retry instead of a white page.
 * Retry remounts the tree. No stack traces or debug data are shown to the user.
 */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    track('app_crash_caught', { name: error.name });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', padding: space[6], gap: space[3] }} accessibilityRole="alert">
        <Text variant="title">Bir şeyler ters gitti.</Text>
        <Text variant="body" color="textSecondary">Uygulamayı yeniden yükleyip tekrar deneyebilirsin.</Text>
        <Button label="Tekrar Dene" onPress={() => this.setState({ failed: false })} style={{ marginTop: space[3] }} />
      </View>
    );
  }
}
