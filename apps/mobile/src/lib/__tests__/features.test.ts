import { featuresFor } from '../features';

describe('feature flags by app environment', () => {
  it.each(['local', 'development', 'preview'] as const)('teamRegistration is on in %s', (appEnv) => {
    expect(featuresFor(appEnv).teamRegistration).toBe(true);
  });
  it('teamRegistration is OFF in production (needs user approval and the legal gate, Faz 6 Task 1)', () => {
    expect(featuresFor('production').teamRegistration).toBe(false);
  });
});
