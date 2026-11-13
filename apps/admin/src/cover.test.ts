import { describe, expect, it, vi } from 'vitest';
import sql from '../../../supabase/migrations/20261113000100_covers.sql?raw';
import { COVER_OBJECT_RE, CoverError, MAX_COVER_BYTES, assertCoverFile, coverObjectPath, removeCover, replaceCover, type CoverClient } from './cover';

const OWNER = '11111111-2222-4333-8444-555555555555';
const ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

/** The database's own pattern, read from the migration, so the client and the check constraint cannot drift apart. */
const dbPattern = (() => {
  const from = sql.indexOf('select', sql.indexOf('function app.cover_object_pattern()'));
  const body = sql.slice(from, sql.indexOf('$$;', from));
  const parts = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((s) => s!.startsWith('^') || s!.startsWith('[0-9a-f]'));
  return new RegExp(parts.join(''));
})();

describe('coverObjectPath', () => {
  it('builds <kind>/<owner>/<uuid>.webp and the -640 thumb', () => {
    expect(coverObjectPath('events', OWNER, ID, 'full')).toBe(`events/${OWNER}/${ID}.webp`);
    expect(coverObjectPath('opportunities', OWNER, ID, 'thumb')).toBe(`opportunities/${OWNER}/${ID}-640.webp`);
  });
  it('agrees with the database pattern on the same fixtures', () => {
    const good = [`events/${OWNER}/${ID}.webp`, `opportunities/${OWNER}/${ID}-640.webp`, `teams/${OWNER}/${ID}.webp`];
    const bad = [`events/${OWNER}/${ID}.png`, `events/${OWNER}/${ID.toUpperCase()}.webp`, `events/${OWNER}/${ID}-320.webp`, `events/${OWNER}/x/${ID}.webp`,
      `news/${OWNER}/${ID}.webp`, `events/${OWNER}/${ID}.webp\n`, `/events/${OWNER}/${ID}.webp`, `events/nope/${ID}.webp`, `events/${OWNER}/${ID}.webp.exe`];
    for (const p of good) { expect(dbPattern.test(p), p).toBe(true); expect(COVER_OBJECT_RE.test(p), p).toBe(true); }
    for (const p of bad) { expect(dbPattern.test(p), p).toBe(false); expect(COVER_OBJECT_RE.test(p), p).toBe(false); }
  });
  it('refuses ids that are not lowercase uuids', () => {
    expect(() => coverObjectPath('events', 'ABC', ID, 'full')).toThrow(CoverError);
    expect(() => coverObjectPath('events', OWNER, '../x', 'full')).toThrow(CoverError);
  });
});

describe('assertCoverFile', () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], 'k', { type });
  it('accepts jpeg, png and webp up to 2 MB', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp']) expect(() => assertCoverFile(file(t, 1000))).not.toThrow();
    expect(() => assertCoverFile(file('image/png', MAX_COVER_BYTES))).not.toThrow();
  });
  it('rejects > 2 MB as too_large and other types as bad_type', () => {
    expect(() => assertCoverFile(file('image/png', MAX_COVER_BYTES + 1))).toThrowError(expect.objectContaining({ code: 'too_large' }));
    expect(() => assertCoverFile(file('application/pdf', 10))).toThrowError(expect.objectContaining({ code: 'bad_type' }));
    expect(() => assertCoverFile(file('image/svg+xml', 10))).toThrowError(expect.objectContaining({ code: 'bad_type' }));
  });
});

function fake(opts: { failSetCover?: boolean; failUploadAt?: number; failRemove?: boolean } = {}) {
  const calls: string[] = [];
  let uploads = 0;
  const client: CoverClient = {
    storage: { from: (bucket) => ({
      upload: async (path, _blob, o) => { calls.push(`upload:${bucket}:${path}:upsert=${o.upsert}:${o.contentType}`); uploads += 1;
        return opts.failUploadAt === uploads ? { error: { message: 'boom' } } : { error: null }; },
      remove: async (paths) => { calls.push(`remove:${paths.join(',')}`); return opts.failRemove ? { error: { message: 'nope' } } : { error: null }; },
    }) },
    rpc: async (name, args) => { calls.push(`rpc:${name}:${JSON.stringify(args)}`); return opts.failSetCover ? { error: { code: 'PT409', message: 'cover_upload_missing' } } : { error: null }; },
  };
  return { client, calls };
}
const prepared = { full: new Blob(['f'], { type: 'image/webp' }), thumb: new Blob(['t'], { type: 'image/webp' }), blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' };
const target = { entity: 'events' as const, entityId: 'e1', ownerId: OWNER };
const OLD = `events/${OWNER}/dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
const OLD_THUMB = OLD.replace('.webp', '-640.webp');

describe('replaceCover order', () => {
  it('uploads both files (no upsert, webp) -> set_cover -> deletes the old pair', async () => {
    const { client, calls } = fake();
    const r = await replaceCover(client, { ...target, oldPath: OLD, prepared, newId: ID });
    expect(r).toEqual({ path: `events/${OWNER}/${ID}.webp`, cleanupFailed: false });
    expect(calls).toEqual([
      `upload:covers:events/${OWNER}/${ID}.webp:upsert=false:image/webp`,
      `upload:covers:events/${OWNER}/${ID}-640.webp:upsert=false:image/webp`,
      `rpc:set_cover:${JSON.stringify({ p_entity: 'events', p_entity_id: 'e1', p_path: `events/${OWNER}/${ID}.webp`, p_blurhash: prepared.blurhash })}`,
      `remove:${OLD},${OLD_THUMB}`,
    ]);
  });
  it('a first cover has nothing to delete', async () => {
    const { client, calls } = fake();
    await replaceCover(client, { ...target, oldPath: null, prepared, newId: ID });
    expect(calls.some((c) => c.startsWith('remove:'))).toBe(false);
  });
  it('set_cover failure deletes the just-uploaded pair, keeps the old binding and rethrows', async () => {
    const { client, calls } = fake({ failSetCover: true });
    await expect(replaceCover(client, { ...target, oldPath: OLD, prepared, newId: ID })).rejects.toMatchObject({ code: 'PT409' });
    expect(calls.at(-1)).toBe(`remove:events/${OWNER}/${ID}.webp,events/${OWNER}/${ID}-640.webp`);
    expect(calls.join('|')).not.toContain(OLD);
  });
  it('second upload failure cleans the first and never binds', async () => {
    const { client, calls } = fake({ failUploadAt: 2 });
    await expect(replaceCover(client, { ...target, oldPath: OLD, prepared, newId: ID })).rejects.toBeTruthy();
    expect(calls.some((c) => c.startsWith('rpc:'))).toBe(false);
    expect(calls.at(-1)).toMatch(/^remove:/);
  });
  it('a failed delete of the old pair does not un-bind: reported, not thrown', async () => {
    const { client } = fake({ failRemove: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(replaceCover(client, { ...target, oldPath: OLD, prepared, newId: ID })).resolves.toMatchObject({ cleanupFailed: true });
    warn.mockRestore();
  });
});

describe('removeCover', () => {
  it('set_cover(null) first, then deletes the pair', async () => {
    const { client, calls } = fake();
    expect(await removeCover(client, { ...target, oldPath: OLD })).toEqual({ cleanupFailed: false });
    expect(calls).toEqual([`rpc:set_cover:${JSON.stringify({ p_entity: 'events', p_entity_id: 'e1', p_path: null, p_blurhash: null })}`, `remove:${OLD},${OLD_THUMB}`]);
  });
  it('does not delete anything when set_cover fails', async () => {
    const { client, calls } = fake({ failSetCover: true });
    await expect(removeCover(client, { ...target, oldPath: OLD })).rejects.toBeTruthy();
    expect(calls.some((c) => c.startsWith('remove:'))).toBe(false);
  });
});
