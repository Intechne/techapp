import { env } from './env';
import type { AppEnv } from './envValidation';

/**
 * Feature flags, derived from the build's app environment (never a runtime switch a user could flip).
 * teamRegistration: on for local | development | preview, OFF in production. Turning it on there needs the user's approval and
 * the legal gate (Faz 6 Task 1); the migrations 20261113000500..000800 must be on the server before any client with it ships.
 */
export const featuresFor = (appEnv: AppEnv) => ({ teamRegistration: appEnv !== 'production' }) as const;

export const features = featuresFor(env.appEnv);
