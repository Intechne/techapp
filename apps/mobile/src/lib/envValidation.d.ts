export declare const APP_ENVS: readonly ['local', 'development', 'preview', 'production'];
export declare const STAGING_PROJECT_REFS: readonly string[];
export type AppEnv = (typeof APP_ENVS)[number];
export interface EnvInput { appEnv?: string; url?: string; key?: string; releaseBuild?: boolean }
export interface EnvCheck { appEnv: AppEnv | null; strict: boolean; problems: string[] }
export declare function isSecretKey(key: string): boolean;
export declare function isPrivateHost(host: string): boolean;
export declare function validateEnv(input: EnvInput): EnvCheck;
export declare const NON_PRODUCTION_SENTRY_PROJECT_IDS: readonly string[];
export interface SentryDsnInput { appEnv?: string | null; dsn?: string | null; nonProductionProjectIds?: readonly string[] }
export interface SentryDsnCheck { enabled: boolean; projectId: string | null; problems: string[] }
export declare function validateSentryDsn(input: SentryDsnInput): SentryDsnCheck;
