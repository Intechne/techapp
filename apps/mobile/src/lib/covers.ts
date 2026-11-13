import { env } from './env';

/**
 * Cover images live in the public Storage bucket `covers` (migration 20261113000100). The row stores the main path
 * `<events|opportunities|teams>/<owner uuid>/<uuid>.webp`; the 640 px copy sits next to it as `<uuid>-640.webp`.
 * Clients only ever build PUBLIC object URLs: listing the bucket is owner-only (never call `list()`), and no image
 * transformation service is involved.
 */
const BOUND_PATH = /^(events|opportunities|teams)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export type CoverSize = 'full' | 'thumb';

export const thumbPath = (path: string): string => path.replace(/\.webp$/, '-640.webp');

/** Lists and rows use `thumb` (640 px), detail screens and the vitrin use `full`. Null = no (usable) cover: draw the fallback poster. */
export function coverUrl(path: string | null | undefined, size: CoverSize): string | null {
  if (!path || !BOUND_PATH.test(path)) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/covers/${size === 'thumb' ? thumbPath(path) : path}`;
}
