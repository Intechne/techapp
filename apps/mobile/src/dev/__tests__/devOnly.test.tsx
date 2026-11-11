/* eslint-disable @typescript-eslint/no-require-imports -- isolateModules loads the modules under test per app environment */
import type React from 'react';
import type { getStateFromPath, LinkingOptions } from '@react-navigation/native';

/**
 * The design preview route and the worst-case fixtures are developer tools: they exist only for `__DEV__ && appEnv ===
 * 'local'`. Jest runs with __DEV__ = true, so the environment is the switch under test here; the release side
 * (`__DEV__ === false`, fixtures absent from the bundle) is proven on a real export by `npm run check:no-dev-preview`.
 */
/** RootNavigator is called as a plain function below, so its one effect is stubbed. */
jest.mock('react', () => ({ ...jest.requireActual('react'), useEffect: () => {} }));
/** Records the screens each navigator is given; nothing is rendered natively. */
const registered: string[] = [];
jest.mock('@react-navigation/native-stack', () => {
  const { Children, isValidElement } = jest.requireActual('react') as typeof import('react');
  const collect = (nodes: React.ReactNode) => {
    Children.forEach(nodes, (n) => {
      if (!isValidElement(n)) return;
      const props = n.props as { name?: string; children?: React.ReactNode };
      if (props.name) registered.push(props.name); else collect(props.children);
    });
  };
  return { createNativeStackNavigator: () => ({ Navigator: ({ children }: { children: React.ReactNode }) => { collect(children); return null; }, Screen: () => null, Group: () => null }) };
});
jest.mock('expo-linking', () => ({ createURL: (path: string) => `techapp://${path}` }));
jest.mock('../../features/onboarding/PrefsProvider', () => ({ usePrefs: () => ({ prefs: { onboarded: true }, update: jest.fn() }) }));
jest.mock('../../features/auth/SessionProvider', () => ({ useSession: () => ({ userId: null }), useAccountState: () => ({ data: undefined }) }));

type AppEnvName = 'local' | 'development' | 'preview' | 'production';

/** Everything (React included) is loaded inside one isolated registry, so the module under test and the renderer share one React. */
function inEnv<T>(appEnv: AppEnvName, run: (m: { linking: LinkingOptions<ReactNavigation.RootParamList>; routeNames: () => string[]; getStateFromPath: typeof getStateFromPath }) => T): T {
  let out!: T;
  jest.isolateModules(() => {
    jest.doMock('../../lib/env', () => ({ env: { appEnv, supabaseUrl: '', supabasePublishableKey: '', isConfigured: false, configProblems: [] } }));
    const nav = require('@react-navigation/native') as typeof import('@react-navigation/native');
    const { linking } = require('../../navigation/linking');
    const { RootNavigator } = require('../../navigation/RootNavigator');
    const routeNames = () => {
      registered.length = 0;
      const tree = RootNavigator() as React.ReactElement; // the Navigator element, collected by the mock when it is invoked
      (tree.type as (p: unknown) => unknown)(tree.props);
      return [...registered];
    };
    out = run({ linking, routeNames, getStateFromPath: nav.getStateFromPath });
  });
  return out;
}

describe('design preview is dev-only', () => {

  it.each(['development', 'preview', 'production'] as const)('has no route and no deep link when appEnv is %s', (appEnv) => {
    inEnv(appEnv, ({ linking, routeNames, getStateFromPath: parse }) => {
      expect(JSON.stringify(linking.config)).not.toContain('design-preview');
      expect(parse('design-preview', linking.config)).toBeUndefined();
      expect(parse('design-preview?data=worst', linking.config)).toBeUndefined();
      expect(routeNames()).not.toContain('DesignPreview');
    });
  });

  it('registers the route and the deep link only for the local stack', () => {
    inEnv('local', ({ linking, routeNames, getStateFromPath: parse }) => {
      const state = parse('design-preview?data=worst&state=error', linking.config);
      const last = state?.routes[state.routes.length - 1];
      expect(last?.name).toBe('DesignPreview');
      expect(last?.params).toEqual({ data: 'worst', state: 'error' });
      expect(routeNames()).toContain('DesignPreview');
    });
  });

  it('keeps worst-case fixtures out of the production feature code', () => {
    // Nothing a release bundle reaches may import src/dev: only navigation (inside the dev-only branch) and tests do.
    const fs = require('fs') as typeof import('fs'); const path = require('path') as typeof import('path');
    const src = path.resolve(__dirname, '..', '..');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' || e.name === 'dev' ? [] : walk(path.join(d, e.name))) : /\.(tsx?)$/.test(e.name) ? [path.join(d, e.name)] : []));
    const offenders = walk(src).filter((f) => /from ['"](\.\.?\/)+dev\/|require\(['"](\.\.?\/)+dev\//.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(src, f));
    expect(offenders).toEqual(['navigation/RootNavigator.tsx']);
  });
});
