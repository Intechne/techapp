jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
// Crash reporting never talks to the real SDK in tests. src/lib/crash.ts is the only importer.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  breadcrumbsIntegration: jest.fn((options: unknown) => ({ name: 'Breadcrumbs', options })),
}));

// TanStack Query delivers observer updates from a setTimeout(0) batch. When that batch lands between a test's awaited
// steps React sees a state update outside act() and warns. Delivering each notification inside act() keeps every test's
// output clean without sprinkling waits through the suites (the act() warning is a test-harness artefact, not app behaviour).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act: actForQuery } = require('react') as typeof import('react');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { notifyManager } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
/** React only checks act() while the renderer marks the environment as an act environment; elsewhere run plainly. */
const inActEnvironment = () => (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT === true;
notifyManager.setNotifyFunction((fn) => { if (inActEnvironment()) actForQuery(fn); else fn(); });

// VirtualizedList (FlatList) renders more cells from a 50 ms timer. When that timer fires between a test's awaited
// steps the setState lands outside act() and React warns. Running the timer's update inside act() is exactly what a
// real frame would do; synchronous calls during a render already sit inside the caller's act() scope.
jest.mock('@react-native/virtualized-lists/Lists/VirtualizedList', () => {
  const actual = jest.requireActual('@react-native/virtualized-lists/Lists/VirtualizedList');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { act } = require('react') as typeof import('react');
  class ActVirtualizedList extends actual.default {
    constructor(props: object) {
      super(props);
      const self = this as unknown as { _updateCellsToRender: () => void };
      const update = self._updateCellsToRender;
      self._updateCellsToRender = () => {
        if ((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT === true) act(() => { update(); });
        else update();
      };
    }
  }
  return { __esModule: true, ...actual, default: ActVirtualizedList };
});

// The default analytics sink prints each event with console.debug while __DEV__ is true, which is every jest run.
// Tests have no use for that stream, so the default sink is swapped for a silent one (a test may still install its own).
// eslint-disable-next-line @typescript-eslint/no-require-imports
(require('./src/lib/analytics') as typeof import('./src/lib/analytics')).setAnalyticsSink({ track: () => {} });
