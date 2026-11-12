// Faz 3b Task 3 — cover images (migration *_covers.sql). Review focus 4: cover path spoofing.
// A cover is bound only by public.set_cover(); the folder in the path is the owner (organisation or team) and must be the
// caller's AND the entity's. The storage policies use the same helper; the automated database has no `storage` schema, so
// the storage part is exercised here inside a rolled-back transaction against a minimal stand-in of storage.buckets /
// storage.objects (the real behaviour on Supabase is checked by supabase/tests/remote/security-regression.sql 22–22g).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asService, asUser, createEvent, createOrg, createUser, expectFail, pool } from './helpers';

type Entity = 'events' | 'opportunities' | 'teams';
const BLUR = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
const PERMISSION_DENIED = /permission denied/;
const path = (kind: Entity, folder: string, file: string = randomUUID()) => `${kind}/${folder}/${file}.webp`;

const setCover = (uid: string, entity: string, id: string, p: string | null, blur: string | null = p === null ? null : BLUR) =>
  asUser(uid, (q) => q(`select public.set_cover($1, $2, $3, $4)`, [entity, id, p, blur]));
const cover = async (table: Entity, id: string) =>
  (await admin(`select cover_path, cover_blurhash from public.${table} where id = $1`, [id])).rows[0] as { cover_path: string | null; cover_blurhash: string | null };
const statusOf = async (table: 'events' | 'opportunities', id: string) =>
  (await admin(`select status from public.${table} where id = $1`, [id])).rows[0].status as string;
const revisions = async (id: string) =>
  (await admin(`select changed_fields, approved_snapshot from public.content_revisions where entity_id = $1 order by id`, [id])).rows as
    { changed_fields: string[]; approved_snapshot: Record<string, unknown> }[];
const audits = async (id: string) =>
  (await admin(`select action, actor_id, organization_id, metadata from public.audit_events where target_id = $1 order by id`, [id])).rows as
    { action: string; actor_id: string; organization_id: string | null; metadata: Record<string, unknown> }[];

async function createOpportunity(orgId: string, status = 'published'): Promise<string> {
  const id = randomUUID();
  await admin(`insert into public.opportunities (id, organization_id, slug, title, summary, type, status, is_demo, closes_at)
               values ($1, $2, $3, 'Staj Programı', 'Özet', 'internship', $4, true, now() + interval '7 days')`,
    [id, orgId, `opp-${id.slice(0, 8)}`, status]);
  return id;
}

/** Team with an active captain, mentor and member, a former captain (left) and a pending applicant. */
async function createTeam() {
  const [captain, mentor, member, formerCaptain, pending] = await Promise.all([createUser(), createUser(), createUser(), createUser(), createUser()]);
  const id = randomUUID();
  await admin(`insert into public.teams (id, slug, name, created_by) values ($1, $2, 'Kapak Takımı', $3)`, [id, `team-${id.slice(0, 8)}`, captain]);
  await admin(`insert into public.team_memberships (team_id, user_id, role, status) values
      ($1, $2, 'captain', 'active'), ($1, $3, 'mentor', 'active'), ($1, $4, 'member', 'active'), ($1, $5, 'captain', 'left'), ($1, $6, 'captain', 'pending')`,
    [id, captain, mentor, member, formerCaptain, pending]);
  return { id, captain, mentor, member, formerCaptain, pending };
}

async function platformAdmin(): Promise<string> {
  const id = await createUser();
  await admin(`insert into public.platform_admins (user_id) values ($1)`, [id]);
  return id;
}

/** Two organisations; `editor` is an editor of A only, `both` is an editor of A and B. */
async function twoOrgs() {
  const [owner, adminUser, editor, staff, reviewer, both, editorB] = await Promise.all(
    [createUser(), createUser(), createUser(), createUser(), createUser(), createUser(), createUser()]);
  const orgA = await createOrg({ [owner]: 'owner', [adminUser]: 'admin', [editor]: 'editor', [staff]: 'checkin_staff', [reviewer]: 'reviewer', [both]: 'editor' });
  const orgB = await createOrg({ [editorB]: 'editor', [both]: 'editor' });
  return { owner, adminUser, editor, staff, reviewer, both, editorB, orgA, orgB };
}

// ================================================================ set_cover · who may bind which path
describe('set_cover · organisation content', () => {
  it('an owner, admin or editor of the organisation binds a cover to its own draft event and opportunity', async () => {
    const o = await twoOrgs();
    for (const uid of [o.owner, o.adminUser, o.editor]) {
      const event = await createEvent(o.orgA, { status: 'draft' });
      const p = path('events', o.orgA);
      await setCover(uid, 'events', event, p);
      expect(await cover('events', event)).toEqual({ cover_path: p, cover_blurhash: BLUR });
      const opp = await createOpportunity(o.orgA, 'draft');
      const q = path('opportunities', o.orgA);
      await setCover(uid, 'opportunities', opp, q);
      expect(await cover('opportunities', opp)).toEqual({ cover_path: q, cover_blurhash: BLUR });
    }
  });

  it('check-in staff, reviewers and outsiders cannot (403 cover_forbidden)', async () => {
    const o = await twoOrgs(); const outsider = await createUser();
    const event = await createEvent(o.orgA, { status: 'draft' });
    for (const uid of [o.staff, o.reviewer, o.editorB, outsider]) {
      await expectFail(setCover(uid, 'events', event, path('events', o.orgA)), 403, 'cover_forbidden');
    }
    expect(await cover('events', event)).toEqual({ cover_path: null, cover_blurhash: null });
  });

  it('a path in another organisation\'s folder → 403 cover_path_forbidden', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await expectFail(setCover(o.editor, 'events', event, path('events', o.orgB)), 403, 'cover_path_forbidden');
    const opp = await createOpportunity(o.orgA, 'draft');
    await expectFail(setCover(o.editor, 'opportunities', opp, path('opportunities', o.orgB)), 403, 'cover_path_forbidden');
  });

  it('the folder must be the entity\'s organisation even when the caller may write both folders → 403', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await expectFail(setCover(o.both, 'events', event, path('events', o.orgB)), 403, 'cover_path_forbidden');
    // a platform admin may write every folder, and still cannot bind another organisation's folder to this event
    const pa = await platformAdmin();
    await expectFail(setCover(pa, 'events', event, path('events', o.orgB)), 403, 'cover_path_forbidden');
  });

  it('the folder kind must be the entity kind (no event cover from the opportunities or teams folder) → 403', async () => {
    const o = await twoOrgs(); const team = await createTeam();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await expectFail(setCover(o.editor, 'events', event, path('opportunities', o.orgA)), 403, 'cover_path_forbidden');
    await expectFail(setCover(o.editor, 'events', event, path('teams', team.id)), 403, 'cover_path_forbidden');
    const opp = await createOpportunity(o.orgA, 'draft');
    await expectFail(setCover(o.editor, 'opportunities', opp, path('events', o.orgA)), 403, 'cover_path_forbidden');
  });

  it('another organisation\'s event cannot be touched even with a path in the caller\'s own folder', async () => {
    const o = await twoOrgs();
    const eventB = await createEvent(o.orgB, { status: 'draft' });
    await expectFail(setCover(o.editor, 'events', eventB, path('events', o.orgA)), 403, 'cover_forbidden');
    await expectFail(setCover(o.editor, 'events', eventB, path('events', o.orgB)), 403, 'cover_forbidden');
  });

  it('unknown entity kind → 422, unknown id → 404', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    for (const kind of ['event', 'courses', 'organizations', 'EVENTS', '']) {
      await expectFail(setCover(o.editor, kind, event, path('events', o.orgA)), 422, 'cover_entity_invalid');
    }
    await expectFail(setCover(o.editor, 'events', randomUUID(), path('events', o.orgA)), 404, 'cover_target_not_found');
  });
});

describe('set_cover · teams', () => {
  it('only an active captain binds the team cover; mentor, member, former and pending captains get 403', async () => {
    const t = await createTeam();
    for (const uid of [t.mentor, t.member, t.formerCaptain, t.pending]) {
      await expectFail(setCover(uid, 'teams', t.id, path('teams', t.id)), 403, 'cover_forbidden');
    }
    const p = path('teams', t.id);
    await setCover(t.captain, 'teams', t.id, p);
    expect(await cover('teams', t.id)).toEqual({ cover_path: p, cover_blurhash: BLUR });
    // and the mentor cannot remove it either
    await expectFail(setCover(t.mentor, 'teams', t.id, null), 403, 'cover_forbidden');
    expect((await cover('teams', t.id)).cover_path).toBe(p);
  });

  it('a captain cannot use another team\'s folder, nor set another team\'s cover', async () => {
    const t = await createTeam(); const other = await createTeam();
    await expectFail(setCover(t.captain, 'teams', t.id, path('teams', other.id)), 403, 'cover_path_forbidden');
    await expectFail(setCover(t.captain, 'teams', other.id, path('teams', t.id)), 403, 'cover_forbidden');
    await expectFail(setCover(t.captain, 'teams', other.id, path('teams', other.id)), 403, 'cover_forbidden');
  });

  it('organisation roles give no power over teams (even of the same organisation)', async () => {
    const o = await twoOrgs(); const t = await createTeam();
    await admin(`update public.teams set organization_id = $2 where id = $1`, [t.id, o.orgA]);
    await expectFail(setCover(o.owner, 'teams', t.id, path('teams', t.id)), 403, 'cover_forbidden');
  });

  it('a team cover change is audited with ids only and the team has no publish state to change', async () => {
    const t = await createTeam(); const o = await twoOrgs();
    await admin(`update public.teams set organization_id = $2 where id = $1`, [t.id, o.orgA]);
    const before = (await admin(`select moderation_status from public.teams where id = $1`, [t.id])).rows[0];
    await setCover(t.captain, 'teams', t.id, path('teams', t.id));
    await setCover(t.captain, 'teams', t.id, null);
    const rows = (await audits(t.id)).filter((a) => a.action.startsWith('team.cover'));
    expect(rows.map((a) => a.action)).toEqual(['team.cover_set', 'team.cover_removed']);
    for (const a of rows) {
      expect(a.actor_id).toBe(t.captain);
      expect(a.organization_id).toBe(o.orgA);
      expect(a.metadata).toEqual({}); // no path, no blurhash, no names
    }
    expect((await admin(`select moderation_status from public.teams where id = $1`, [t.id])).rows[0]).toEqual(before);
    expect((await admin(`select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'teams' and column_name = 'status'`)).rows[0].n).toBe(0);
  });
});

describe('set_cover · platform admin', () => {
  it('binds covers on any organisation\'s event and opportunity and on any team', async () => {
    const pa = await platformAdmin(); const o = await twoOrgs(); const t = await createTeam();
    const event = await createEvent(o.orgB, { status: 'draft' }); const opp = await createOpportunity(o.orgA, 'draft');
    const [pe, po, pt] = [path('events', o.orgB), path('opportunities', o.orgA), path('teams', t.id)];
    await setCover(pa, 'events', event, pe);
    await setCover(pa, 'opportunities', opp, po);
    await setCover(pa, 'teams', t.id, pt);
    expect([(await cover('events', event)).cover_path, (await cover('opportunities', opp)).cover_path, (await cover('teams', t.id)).cover_path])
      .toEqual([pe, po, pt]);
  });

  it('an approver changing a published event\'s cover is the review: it stays published', async () => {
    const pa = await platformAdmin(); const o = await twoOrgs();
    const event = await createEvent(o.orgA);
    await setCover(pa, 'events', event, path('events', o.orgA));
    expect(await statusOf('events', event)).toBe('published');
    expect(await revisions(event)).toEqual([]);
  });
});

// ================================================================ input validation
describe('set_cover · path and blurhash validation', () => {
  it.each([
    ['parent directory', (org: string) => `events/${org}/../${randomUUID()}.webp`],
    ['dot segment as file', (org: string) => `events/${org}/../../x.webp`],
    ['uppercase uuid', (org: string) => `events/${org.toUpperCase()}/${randomUUID()}.webp`],
    ['uppercase file', (org: string) => `events/${org}/${randomUUID().toUpperCase()}.webp`],
    ['uppercase kind', (org: string) => `Events/${org}/${randomUUID()}.webp`],
    ['png', (org: string) => `events/${org}/${randomUUID()}.png`],
    ['jpeg', (org: string) => `events/${org}/${randomUUID()}.jpg`],
    ['extra segment', (org: string) => `events/${org}/x/${randomUUID()}.webp`],
    ['missing folder', () => `events/${randomUUID()}.webp`],
    ['leading slash', (org: string) => `/events/${org}/${randomUUID()}.webp`],
    ['thumbnail name (client convention, never bound)', (org: string) => `events/${org}/${randomUUID()}-640.webp`],
    ['dashes only', (org: string) => `events/${org}/${'-'.repeat(36)}.webp`],
    ['trailing newline', (org: string) => `events/${org}/${randomUUID()}.webp\n`],
    ['url', (org: string) => `https://evil.test/events/${org}/${randomUUID()}.webp`],
    ['empty', () => ''],
  ])('%s → 422 cover_path_invalid', async (_label, make) => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await expectFail(setCover(o.editor, 'events', event, make(o.orgA)), 422, 'cover_path_invalid');
    expect((await cover('events', event)).cover_path).toBeNull();
  });

  it('blurhash must be 6–100 base83 characters; a missing blurhash is allowed', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    for (const bad of ['abc', 'x'.repeat(101), 'LEHV6n WB2yk', 'LEHV6n<script>', 'Ağaçlık-ışık']) {
      await expectFail(setCover(o.editor, 'events', event, path('events', o.orgA), bad), 422, 'cover_blurhash_invalid');
    }
    const p = path('events', o.orgA);
    await setCover(o.editor, 'events', event, p, null);
    expect(await cover('events', event)).toEqual({ cover_path: p, cover_blurhash: null });
  });

  it('removing (p_path null) clears path and blurhash; a blurhash without a path is refused', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await setCover(o.editor, 'events', event, path('events', o.orgA));
    await expectFail(setCover(o.editor, 'events', event, null, BLUR), 422, 'cover_blurhash_invalid');
    await setCover(o.editor, 'events', event, null);
    expect(await cover('events', event)).toEqual({ cover_path: null, cover_blurhash: null });
  });
});

// ================================================================ direct writes
describe('cover columns are written only through set_cover', () => {
  it('a direct update of cover_path / cover_blurhash by someone with row update rights → 403 cover_write_forbidden', async () => {
    const o = await twoOrgs(); const t = await createTeam();
    const event = await createEvent(o.orgA, { status: 'draft' }); const opp = await createOpportunity(o.orgA, 'draft');
    await expectFail(asUser(o.editor, (q) => q(`update public.events set cover_path = $2 where id = $1`, [event, path('events', o.orgA)])), 403, 'cover_write_forbidden');
    await expectFail(asUser(o.editor, (q) => q(`update public.opportunities set cover_path = $2 where id = $1`, [opp, path('opportunities', o.orgA)])), 403, 'cover_write_forbidden');
    await expectFail(asUser(t.captain, (q) => q(`update public.teams set cover_path = $2 where id = $1`, [t.id, path('teams', t.id)])), 403, 'cover_write_forbidden');
    // the blurhash too (it would let a client change what the placeholder shows)
    await setCover(o.editor, 'events', event, path('events', o.orgA));
    await expectFail(asUser(o.editor, (q) => q(`update public.events set cover_blurhash = 'LKO2?U%2Tw=w' where id = $1`, [event])), 403, 'cover_write_forbidden');
    await expectFail(asUser(o.editor, (q) => q(`update public.events set cover_path = null where id = $1`, [event])), 403, 'cover_write_forbidden');
    // other columns on the same row are still editable through the table (RLS path unaffected)
    expect((await asUser(o.editor, (q) => q(`update public.events set title = 'Yeni başlık burada' where id = $1`, [event]))).rowCount).toBe(1);
  });

  it('inserting a row that already carries a cover is refused', async () => {
    const o = await twoOrgs();
    const id = randomUUID();
    await expectFail(asUser(o.editor, (q) => q(
      `insert into public.events (id, organization_id, slug, title, summary, type, format, status, starts_at, ends_at, registration_closes_at, cover_path)
       values ($1, $2, $3, 'Kapaklı etkinlik', 'Özet', 'workshop', 'in_person', 'draft', now() + interval '7 days', now() + interval '8 days', now() + interval '6 days', $4)`,
      [id, o.orgA, `event-${id.slice(0, 8)}`, path('events', o.orgA)])), 403, 'cover_write_forbidden');
  });

  it('a platform admin, the service role and a superuser cannot write the columns directly either (one write path)', async () => {
    const pa = await platformAdmin(); const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await expectFail(asUser(pa, (q) => q(`update public.events set cover_path = $2 where id = $1`, [event, path('events', o.orgA)])), 403, 'cover_write_forbidden');
    await expectFail(asService((q) => q(`update public.events set cover_path = $2 where id = $1`, [event, path('events', o.orgA)])), 403, 'cover_write_forbidden');
    await expectFail(admin(`update public.events set cover_path = $2 where id = $1`, [event, path('events', o.orgA)]), 403, 'cover_write_forbidden');
  });

  it('defence in depth: even with a forged write flag, a row can never point into another owner\'s folder (CHECK)', async () => {
    // A client cannot run set_config() through the API (checked below); this simulates it anyway with raw SQL.
    const o = await twoOrgs(); const t = await createTeam(); const other = await createTeam();
    const event = await createEvent(o.orgA, { status: 'draft' });
    const forged = (table: string, id: string, p: string) => asUser(o.editor, async (q) => {
      await q(`select set_config('app.cover_write', $1, true)`, [`${table}:${id}`]);
      return q(`update public.${table} set cover_path = $2 where id = $1`, [id, p]);
    });
    await expect(forged('events', event, path('events', o.orgB))).rejects.toMatchObject({ code: '23514' });
    await expect(forged('events', event, path('teams', t.id))).rejects.toMatchObject({ code: '23514' });
    await expect(forged('events', event, `events/${o.orgA}/../x.webp`)).rejects.toMatchObject({ code: '23514' });
    await expect(asUser(t.captain, async (q) => {
      await q(`select set_config('app.cover_write', $1, true)`, [`teams:${t.id}`]);
      return q(`update public.teams set cover_path = $2 where id = $1`, [t.id, path('teams', other.id)]);
    })).rejects.toMatchObject({ code: '23514' });
    // and a flag for one row does not open another row
    const event2 = await createEvent(o.orgA, { status: 'draft' });
    await expectFail(asUser(o.editor, async (q) => {
      await q(`select set_config('app.cover_write', $1, true)`, [`events:${event}`]);
      return q(`update public.events set cover_path = $2 where id = $1`, [event2, path('events', o.orgA)]);
    }), 403, 'cover_write_forbidden');
  });

  it('a published event edited with a forged flag still goes back to review (re-review does not depend on the flag)', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA);
    await asUser(o.editor, async (q) => {
      await q(`select set_config('app.cover_write', $1, true)`, [`events:${event}`]);
      return q(`update public.events set cover_path = $2 where id = $1`, [event, path('events', o.orgA)]);
    });
    expect(await statusOf('events', event)).toBe('in_review');
  });

  it('set_cover clears the write flag after its own update', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    const flag = await asUser(o.editor, async (q) => {
      await q(`select public.set_cover($1, $2, $3, $4)`, ['events', event, path('events', o.orgA), BLUR]);
      return (await q(`select coalesce(current_setting('app.cover_write', true), '') v`)).rows[0].v;
    });
    expect(flag).toBe('');
  });

  it('no function the API exposes can set a caller-chosen setting (the flag cannot be pre-set through PostgREST)', async () => {
    // Exposed schema = public. Every set_config() call in a public function must use a literal setting name, and the only
    // public function that knows the cover flag is set_cover itself.
    const { rows } = await admin(`select p.proname, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosrc ~* 'set_config'`);
    for (const r of rows) {
      const calls = [...(r.prosrc as string).matchAll(/set_config\s*\(\s*([^,]*),/gi)].map((m) => m[1]!.trim());
      expect([r.proname, calls.every((c) => /^'[a-z_.]+'$/.test(c))]).toEqual([r.proname, true]);
    }
    const flagged = (await admin(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosrc like '%cover_write%'`)).rows.map((r) => r.proname);
    expect(flagged).toEqual(['set_cover']);
    // pg_catalog.set_config is not in an exposed schema; the API roles have no SQL access beyond PostgREST.
  });
});

// ================================================================ grants
describe('set_cover · grants', () => {
  it('anon cannot call set_cover (permission denied); authenticated can; SECURITY DEFINER with an empty search_path', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await expect(asAnon((q) => q(`select public.set_cover('events', $1, $2, null)`, [event, path('events', o.orgA)]))).rejects.toThrow(PERMISSION_DENIED);
    const p = (await admin(`select p.prosecdef, p.proconfig,
        has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth,
        has_function_privilege('public', p.oid, 'execute') pub
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_cover'`)).rows;
    expect(p).toEqual([{ prosecdef: true, proconfig: ['search_path=""'], anon: false, auth: true, pub: false }]);
  });

  it('anyone reads the cover columns of published events / opportunities and public teams', async () => {
    const o = await twoOrgs(); const t = await createTeam();
    const event = await createEvent(o.orgA, { status: 'draft' });
    const p = path('events', o.orgA);
    await setCover(o.editor, 'events', event, p);
    await admin(`update public.events set status = 'published' where id = $1`, [event]);
    await setCover(t.captain, 'teams', t.id, path('teams', t.id));
    expect((await asAnon((q) => q(`select cover_path, cover_blurhash from public.events where id = $1`, [event]))).rows).toEqual([{ cover_path: p, cover_blurhash: BLUR }]);
    expect((await asAnon((q) => q(`select cover_path from public.teams where id = $1`, [t.id]))).rows[0].cover_path).toMatch(/^teams\//);
  });
});

// ================================================================ re-review (spec §4: cover_path is a critical field)
describe('cover change on approved content goes back to review', () => {
  it('published event: a new cover → content_revisions row with the approved cover, status in_review', async () => {
    const o = await twoOrgs(); const pa = await platformAdmin();
    const event = await createEvent(o.orgA);
    const approved = path('events', o.orgA);
    await setCover(pa, 'events', event, approved); // set by the approver: stays published
    const next = path('events', o.orgA);
    await setCover(o.editor, 'events', event, next);
    expect(await statusOf('events', event)).toBe('in_review');
    const rev = await revisions(event);
    expect(rev).toHaveLength(1);
    expect(rev[0]!.changed_fields).toEqual(['cover_path']);
    expect(rev[0]!.approved_snapshot.cover_path).toBe(approved);
    expect(rev[0]!.approved_snapshot.status).toBe('published');
    expect((await audits(event)).map((a) => a.action)).toEqual(expect.arrayContaining(['event.cover_set', 'event.rereview_required']));
    // hidden from the public until re-approved
    expect((await asAnon((q) => q(`select id from public.events where id = $1`, [event]))).rowCount).toBe(0);
  });

  it('published event: removing the cover also goes back to review', async () => {
    const o = await twoOrgs(); const pa = await platformAdmin();
    const event = await createEvent(o.orgA);
    await setCover(pa, 'events', event, path('events', o.orgA));
    await setCover(o.editor, 'events', event, null);
    expect(await statusOf('events', event)).toBe('in_review');
    expect((await revisions(event)).map((r) => r.changed_fields)).toEqual([['cover_path']]);
  });

  it('published opportunity: a new cover → content_revisions row, status in_review', async () => {
    const o = await twoOrgs();
    const opp = await createOpportunity(o.orgA);
    await setCover(o.editor, 'opportunities', opp, path('opportunities', o.orgA));
    expect(await statusOf('opportunities', opp)).toBe('in_review');
    expect((await revisions(opp)).map((r) => r.changed_fields)).toEqual([['cover_path']]);
  });

  it('a draft event changes cover freely: no revision row, status unchanged', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await setCover(o.editor, 'events', event, path('events', o.orgA));
    await setCover(o.editor, 'events', event, path('events', o.orgA));
    expect(await statusOf('events', event)).toBe('draft');
    expect(await revisions(event)).toEqual([]);
  });

  it('re-sending the same path (only the blurhash differs) is not a critical change', async () => {
    const o = await twoOrgs(); const pa = await platformAdmin();
    const event = await createEvent(o.orgA);
    const p = path('events', o.orgA);
    await setCover(pa, 'events', event, p);
    await setCover(o.editor, 'events', event, p, 'LKO2?U%2Tw=w');
    expect(await statusOf('events', event)).toBe('published');
    expect(await cover('events', event)).toEqual({ cover_path: p, cover_blurhash: 'LKO2?U%2Tw=w' });
  });

  it('cover_path is in both critical-field lists; cover_blurhash is not', async () => {
    const r = (await admin(`select 'cover_path' = any (app.event_critical_fields()) ev, 'cover_path' = any (app.opportunity_critical_fields()) op,
                                   'cover_blurhash' = any (app.event_critical_fields() || app.opportunity_critical_fields()) bh`)).rows[0];
    expect(r).toEqual({ ev: true, op: true, bh: false });
  });
});

// ================================================================ storage (stand-in schema, rolled back)
const MIGRATIONS = join(__dirname, '..', 'migrations');
function storageBlock(): string {
  const file = readdirSync(MIGRATIONS).find((f) => f.endsWith('_covers.sql'));
  if (!file) throw new Error('covers migration not found');
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
  const m = sql.match(/-- covers-storage:begin\n([\s\S]*?)-- covers-storage:end/);
  if (!m) throw new Error('storage block markers not found in ' + file);
  return m[1]!;
}
// Only the columns the policies and set_cover touch; the real tables have more.
const STORAGE_STANDIN = `
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
                                file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
                                name text not null, owner uuid, created_at timestamptz default now(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
  alter table storage.buckets enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;`;

type Who = { role: 'anon' | 'authenticated'; uid: string | null };
const anon: Who = { role: 'anon', uid: null };
const user = (uid: string): Who => ({ role: 'authenticated', uid });

async function withStorage(fn: (run: (who: Who | null, sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: Record<string, unknown>[] }>) => Promise<void>) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(STORAGE_STANDIN);
    await c.query(storageBlock());
    await fn(async (who, sql, params = []) => {
      await c.query('savepoint s');
      try {
        if (who) {
          await c.query(`set local role ${who.role}`);
          await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who.uid ?? '', role: who.role })]);
        }
        const r = await c.query(sql, params as never[]);
        await c.query('reset role');
        await c.query(`select set_config('request.jwt.claims', '', true)`);
        await c.query('release savepoint s');
        return { rowCount: r.rowCount ?? 0, rows: r.rows };
      } catch (error) {
        await c.query('rollback to savepoint s');
        throw error;
      }
    });
  } finally {
    await c.query('rollback').catch(() => {});
    c.release();
  }
}
const put = (name: string) => `insert into storage.objects (bucket_id, name) values ('covers', '${name}')`;
const RLS_DENIED = /row-level security/;

describe('covers bucket · storage policies (stand-in storage schema, rolled back)', () => {
  it('the bucket is public, webp/jpeg/png only, at most 2 MB', async () => {
    await withStorage(async (run) => {
      const b = (await run(null, `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'covers'`)).rows;
      expect(b).toEqual([{ public: true, file_size_limit: '2097152', allowed_mime_types: ['image/webp', 'image/jpeg', 'image/png'] }]);
    });
  });

  it('upload: only into a folder the caller owns (org editor+, active team captain, platform admin)', async () => {
    const o = await twoOrgs(); const t = await createTeam(); const pa = await platformAdmin();
    await withStorage(async (run) => {
      const file = randomUUID();
      expect((await run(user(o.editor), put(`events/${o.orgA}/${file}.webp`))).rowCount).toBe(1);
      expect((await run(user(o.editor), put(`events/${o.orgA}/${file}-640.webp`))).rowCount).toBe(1); // thumbnail
      expect((await run(user(o.adminUser), put(`opportunities/${o.orgA}/${randomUUID()}.webp`))).rowCount).toBe(1);
      expect((await run(user(t.captain), put(`teams/${t.id}/${randomUUID()}.webp`))).rowCount).toBe(1);
      expect((await run(user(pa), put(`teams/${t.id}/${randomUUID()}.webp`))).rowCount).toBe(1);
      expect((await run(user(pa), put(`events/${o.orgB}/${randomUUID()}.webp`))).rowCount).toBe(1);
      const refused: [Who, string][] = [
        [user(o.editor), `events/${o.orgB}/${randomUUID()}.webp`],          // another organisation
        [user(o.editor), `teams/${t.id}/${randomUUID()}.webp`],              // org role → team folder
        [user(o.staff), `events/${o.orgA}/${randomUUID()}.webp`],            // check-in staff
        [user(o.reviewer), `events/${o.orgA}/${randomUUID()}.webp`],
        [user(t.mentor), `teams/${t.id}/${randomUUID()}.webp`],              // mentor
        [user(t.formerCaptain), `teams/${t.id}/${randomUUID()}.webp`],
        [user(t.captain), `teams/${randomUUID()}/${randomUUID()}.webp`],     // another team
        [user(o.editor), `events/${o.orgA}/../${randomUUID()}.webp`],
        [user(o.editor), `events/${o.orgA}/${randomUUID()}.png`],
        [user(o.editor), `events/${o.orgA}/sub/${randomUUID()}.webp`],
        [user(o.editor), `EVENTS/${o.orgA}/${randomUUID()}.webp`],
        [user(o.editor), `avatars/${o.orgA}/${randomUUID()}.webp`],
        [anon, `events/${o.orgA}/${randomUUID()}.webp`],
      ];
      for (const [who, name] of refused) {
        await expect(run(who, put(name)), name).rejects.toThrow(RLS_DENIED);
      }
    });
  });

  it('read: anyone (anon included) reads objects of the covers bucket, and only of that bucket', async () => {
    const o = await twoOrgs();
    await withStorage(async (run) => {
      const name = `events/${o.orgA}/${randomUUID()}.webp`;
      await run(null, `insert into storage.buckets (id, name) values ('other', 'other')`);
      await run(null, put(name));
      await run(null, `insert into storage.objects (bucket_id, name) values ('other', 'x/y.webp')`);
      expect((await run(anon, `select name from storage.objects`)).rows).toEqual([{ name }]);
    });
  });

  it('objects are immutable: no update (an approved cover cannot be swapped in place); delete only when not in use', async () => {
    const o = await twoOrgs(); const pa = await platformAdmin();
    const event = await createEvent(o.orgA);
    await withStorage(async (run) => {
      const file = randomUUID();
      const main = `events/${o.orgA}/${file}.webp`; const thumb = `events/${o.orgA}/${file}-640.webp`;
      await run(user(o.editor), put(main)); await run(user(o.editor), put(thumb));
      await run(user(pa), `select public.set_cover('events', '${event}', '${main}', null)`);
      // overwrite / rename in place: no update policy → nothing matches
      expect((await run(user(o.editor), `update storage.objects set owner = '${o.editor}' where name = '${main}'`)).rowCount).toBe(0);
      expect((await run(user(o.editor), `update storage.objects set name = '${o.orgB}/x.webp' where name = '${main}'`)).rowCount).toBe(0);
      // delete-then-reupload of the approved image: the bound cover and its thumbnail cannot be deleted
      expect((await run(user(o.editor), `delete from storage.objects where name in ('${main}', '${thumb}')`)).rowCount).toBe(0);
      // an unused upload in the own folder can be deleted; another organisation's cannot
      const spare = `events/${o.orgA}/${randomUUID()}.webp`; const foreign = `events/${o.orgB}/${randomUUID()}.webp`;
      await run(user(o.editor), put(spare)); await run(null, put(foreign));
      expect((await run(user(o.editor), `delete from storage.objects where name = '${spare}'`)).rowCount).toBe(1);
      expect((await run(user(o.editor), `delete from storage.objects where name = '${foreign}'`)).rowCount).toBe(0);
      // after the cover is removed (re-review follows), the old files can be cleaned up
      await run(user(o.editor), `select public.set_cover('events', '${event}', null, null)`);
      expect((await run(user(o.editor), `delete from storage.objects where name in ('${main}', '${thumb}')`)).rowCount).toBe(2);
    });
  });

  it('a platform admin can take down an image that is in use (moderation)', async () => {
    const o = await twoOrgs(); const pa = await platformAdmin();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await withStorage(async (run) => {
      const file = randomUUID(); const main = `events/${o.orgA}/${file}.webp`;
      await run(user(o.editor), put(main)); await run(user(o.editor), put(`events/${o.orgA}/${file}-640.webp`));
      await run(user(o.editor), `select public.set_cover('events', '${event}', '${main}', null)`);
      expect((await run(user(pa), `delete from storage.objects where name = '${main}'`)).rowCount).toBe(1);
    });
  });

  it('with storage present, set_cover requires both uploaded files (main + -640) → otherwise 409 cover_upload_missing', async () => {
    const o = await twoOrgs();
    const event = await createEvent(o.orgA, { status: 'draft' });
    await withStorage(async (run) => {
      const file = randomUUID(); const main = `events/${o.orgA}/${file}.webp`;
      const call = `select public.set_cover('events', '${event}', '${main}', '${BLUR}')`;
      await expectFail(run(user(o.editor), call), 409, 'cover_upload_missing'); // nothing uploaded yet
      await run(user(o.editor), put(main));
      await expectFail(run(user(o.editor), call), 409, 'cover_upload_missing'); // thumbnail missing
      await run(user(o.editor), put(`events/${o.orgA}/${file}-640.webp`));
      await run(user(o.editor), call);
      expect((await run(null, `select cover_path from public.events where id = '${event}'`)).rows).toEqual([{ cover_path: main }]);
      // a file of the same name in another bucket does not count
      const other = randomUUID(); const otherMain = `events/${o.orgA}/${other}.webp`;
      await run(null, `insert into storage.buckets (id, name) values ('avatars', 'avatars') on conflict do nothing`);
      await run(null, `insert into storage.objects (bucket_id, name) values ('avatars', '${otherMain}'), ('avatars', 'events/${o.orgA}/${other}-640.webp')`);
      await expectFail(run(user(o.editor), `select public.set_cover('events', '${event}', '${otherMain}', null)`), 409, 'cover_upload_missing');
    });
  });
});
