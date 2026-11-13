import { encode } from 'blurhash';

/**
 * Cover images (Faz 3b Task 4). Server contract: supabase/migrations/20261113000100_covers.sql.
 *   - bucket `covers` accepts image/webp only, <= 2 MB per file; path `<events|opportunities>/<organization uuid>/<uuid>.webp`
 *     plus the 640 px copy `<uuid>-640.webp` (client convention);
 *   - objects are immutable: every image gets a NEW uuid and is uploaded with upsert:false;
 *   - bind with set_cover AFTER both files exist; delete the OLD pair only after set_cover succeeded (a file in use cannot be deleted).
 */

/** Same pattern as `app.cover_object_pattern()` (cover.test.ts compares the two on shared fixtures). */
export const COVER_OBJECT_RE = /^(events|opportunities|teams)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-640)?\.webp$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export const FULL_WIDTH = 1600;
export const THUMB_WIDTH = 640;
const SOURCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type CoverEntity = 'events' | 'opportunities';
export type CoverErrorCode = 'too_large' | 'bad_type' | 'decode_failed' | 'encode_failed';
export class CoverError extends Error {
  constructor(public code: CoverErrorCode, message?: string) { super(message ?? code); this.name = 'CoverError'; }
}
export const COVER_ERROR_COPY: Record<CoverErrorCode, string> = {
  too_large: 'Görsel 2 MB’dan büyük. Daha küçük bir dosya seç.',
  bad_type: 'Yalnızca JPEG, PNG veya WebP görsel yüklenebilir.',
  decode_failed: 'Görsel açılamadı. Başka bir dosya dene.',
  encode_failed: 'Bu tarayıcı görseli WebP’ye çeviremedi. Güncel bir tarayıcı dene.',
};

export function coverObjectPath(entity: CoverEntity, ownerId: string, id: string, size: 'full' | 'thumb'): string {
  if (!UUID_RE.test(ownerId) || !UUID_RE.test(id)) throw new CoverError('decode_failed', 'cover path ids must be lowercase uuids');
  return `${entity}/${ownerId}/${id}${size === 'thumb' ? '-640' : ''}.webp`;
}
/** `<uuid>-640.webp` for a bound `<uuid>.webp`. */
export const thumbPathOf = (path: string) => path.replace(/\.webp$/, '-640.webp');

export function assertCoverFile(file: Pick<File, 'type' | 'size'>): void {
  if (!SOURCE_TYPES.includes(file.type)) throw new CoverError('bad_type');
  if (file.size > MAX_COVER_BYTES) throw new CoverError('too_large');
}

export interface PreparedCover { full: Blob; thumb: Blob; blurhash: string }

type Surface = { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D };
function surface(w: number, h: number): Surface {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d') as Surface['ctx'] | null;
  if (!ctx) throw new CoverError('encode_failed');
  return { canvas, ctx };
}
async function toWebp(s: Surface, quality: number): Promise<Blob> {
  const blob = 'convertToBlob' in s.canvas
    ? await s.canvas.convertToBlob({ type: 'image/webp', quality })
    : await new Promise<Blob | null>((res) => (s.canvas as HTMLCanvasElement).toBlob(res, 'image/webp', quality));
  // A browser without WebP encoding silently hands back PNG: refuse that instead of uploading something the bucket rejects.
  if (!blob || blob.type !== 'image/webp') throw new CoverError('encode_failed');
  return blob;
}

async function render(bitmap: ImageBitmap, width: number): Promise<Blob> {
  const w = Math.min(width, bitmap.width); // never upscale
  const h = Math.max(1, Math.round(bitmap.height * (w / bitmap.width)));
  const s = surface(w, h);
  s.ctx.drawImage(bitmap, 0, 0, w, h);
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await toWebp(s, q);
    if (blob.size <= MAX_COVER_BYTES) return blob;
  }
  throw new CoverError('too_large');
}

/**
 * Re-encodes the picture to WebP at 1600 px and 640 px wide and computes a 4x3 blurhash.
 * Drawing the decoded pixels onto a canvas and encoding them again writes a brand-new file: EXIF (camera, GPS position,
 * timestamps) and every other metadata block of the original are NOT carried over. That is deliberate and relied on:
 * covers are public, and the original is never uploaded.
 */
export async function prepareCover(file: File): Promise<PreparedCover> {
  assertCoverFile(file);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new CoverError('decode_failed'); }
  try {
    const full = await render(bitmap, FULL_WIDTH);
    const thumb = await render(bitmap, THUMB_WIDTH);
    const bw = 32, bh = Math.max(1, Math.round(32 * (bitmap.height / bitmap.width)));
    const s = surface(bw, bh);
    s.ctx.drawImage(bitmap, 0, 0, bw, bh);
    const { data } = s.ctx.getImageData(0, 0, bw, bh);
    return { full, thumb, blurhash: encode(data, bw, bh, 4, 3) };
  } finally { bitmap.close(); }
}

/** The slice of supabase-js the flow needs; the real client satisfies it, tests pass a fake. */
export interface CoverClient {
  storage: { from(bucket: string): {
    upload(path: string, body: Blob, opts: { upsert: boolean; contentType: string }): PromiseLike<{ error: { message: string } | null }>;
    remove(paths: string[]): PromiseLike<{ error: { message: string } | null }>;
  } };
  rpc(name: 'set_cover', args: { p_entity: string; p_entity_id: string; p_path: string | null; p_blurhash: string | null }): PromiseLike<{ error: { code?: string; message: string } | null }>;
}
interface Target { entity: CoverEntity; entityId: string; ownerId: string }

async function removePair(client: CoverClient, path: string): Promise<boolean> {
  try {
    const { error } = await client.storage.from('covers').remove([path, thumbPathOf(path)]);
    if (error) { console.warn('cover cleanup failed', error.message); return false; }
    return true;
  } catch (e) { console.warn('cover cleanup failed', e); return false; }
}

/**
 * Upload both files -> set_cover -> delete the OLD pair. A failed upload or set_cover removes what this call uploaded and
 * leaves the old binding alone. A failed delete of the old pair never un-binds the new cover: it is reported
 * (`cleanupFailed`) so the screen can say so; the scheduled orphan cleanup (Faz 6) will pick the files up.
 */
export async function replaceCover(client: CoverClient, p: Target & { oldPath: string | null; prepared: PreparedCover; newId?: string }): Promise<{ path: string; cleanupFailed: boolean }> {
  const id = p.newId ?? crypto.randomUUID();
  const path = coverObjectPath(p.entity, p.ownerId, id, 'full');
  const thumb = coverObjectPath(p.entity, p.ownerId, id, 'thumb');
  const bucket = client.storage.from('covers');
  const up = async (name: string, blob: Blob) => {
    const { error } = await bucket.upload(name, blob, { upsert: false, contentType: 'image/webp' });
    if (error) throw new Error(error.message);
  };
  try {
    await up(path, p.prepared.full);
    await up(thumb, p.prepared.thumb);
  } catch (e) { await removePair(client, path); throw e; }
  const { error } = await client.rpc('set_cover', { p_entity: p.entity, p_entity_id: p.entityId, p_path: path, p_blurhash: p.prepared.blurhash });
  if (error) { await removePair(client, path); throw error; }
  const cleanupFailed = p.oldPath ? !(await removePair(client, p.oldPath)) : false;
  return { path, cleanupFailed };
}

/** set_cover(null) first (files are then no longer in use), then delete the pair. */
export async function removeCover(client: CoverClient, p: Target & { oldPath: string }): Promise<{ cleanupFailed: boolean }> {
  const { error } = await client.rpc('set_cover', { p_entity: p.entity, p_entity_id: p.entityId, p_path: null, p_blurhash: null });
  if (error) throw error;
  return { cleanupFailed: !(await removePair(client, p.oldPath)) };
}
