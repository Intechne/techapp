export declare const APP_ENVS: readonly ['local', 'development', 'preview', 'production'];
export declare const STAGING_PROJECT_REFS: readonly string[];
export type AppEnv = (typeof APP_ENVS)[number];
export interface EnvInput { appEnv?: string; url?: string; key?: string; releaseBuild?: boolean }
export interface EnvCheck { appEnv: AppEnv | null; strict: boolean; problems: string[] }
export declare function isSecretKey(key: string): boolean;
export declare function isPrivateHost(host: string): boolean;
export declare function validateEnv(input: EnvInput): EnvCheck;
