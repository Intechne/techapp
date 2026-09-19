import { describe, expect, it } from 'vitest';
import { asAnon, asUser, createOrg, createUser, expectFail } from './helpers';

describe('team titles and task priority', () => {
  it('managers set a title; it grants nothing and members cannot write it', async () => {
    const captain = await createUser({ name: 'Kaptan Ada' }); const member = await createUser({ name: 'Üye Can' }); const outsider = await createUser();
    const team = (await asUser(captain, (q) => q(`select * from public.create_team('Orbit Robotik', 'team', 'Robotik', null)`))).rows[0];
    const join = (await asUser(member, (q) => q(`select * from public.request_team_join($1)`, [team.id]))).rows[0];
    await expectFail(asUser(captain, (q) => q(`select public.set_team_member_title($1, 'Erken')`, [join.id])), 409, 'membership_not_active');
    await asUser(captain, (q) => q(`select public.decide_team_join($1, true)`, [join.id]));

    await expectFail(asUser(member, (q) => q(`select public.set_team_member_title($1, 'Kendi unvanım')`, [join.id])), 403, 'team_manage_forbidden');
    await expectFail(asUser(outsider, (q) => q(`select public.set_team_member_title($1, 'x')`, [join.id])), 403, 'team_manage_forbidden');
    await expect(asUser(member, (q) => q(`update public.team_memberships set title = 'Sahte' where id = $1`, [join.id]))).resolves.toMatchObject({ rowCount: 0 });
    await expectFail(asUser(captain, (q) => q(`select public.set_team_member_title($1, $2)`, [join.id, 'x'.repeat(61)])), 422, 'title_too_long');

    await asUser(captain, (q) => q(`select public.set_team_member_title($1, '  Mekanik lideri ')`, [join.id]));
    const roster = (await asUser(member, (q) => q(`select * from public.team_roster($1)`, [team.id]))).rows;
    expect(roster.find((r) => r.user_id === member)).toMatchObject({ title: 'Mekanik lideri', role: 'member' });
    // a title is not a permission: the member still cannot create tasks
    await expect(asUser(member, (q) => q(`insert into public.team_tasks (team_id, title, created_by) values ($1, 'İzinsiz', $2)`, [team.id, member]))).rejects.toThrow(/row-level security/);

    const task = (await asUser(captain, (q) => q(`insert into public.team_tasks (team_id, title, assignee_id, priority, created_by) values ($1, 'Şasi montajı', $2, 'high', $3) returning priority`, [team.id, member, captain]))).rows[0];
    expect(task.priority).toBe('high');
    expect((await asUser(member, (q) => q(`select public.my_cv() j`))).rows[0].j.teams[0]).toMatchObject({ name: 'Orbit Robotik', title: 'Mekanik lideri' });

    await asUser(captain, (q) => q(`select public.set_team_member_title($1, '')`, [join.id]));
    expect((await asUser(captain, (q) => q(`select title from public.team_roster($1) where user_id = $2`, [team.id, member]))).rows[0].title).toBeNull();
  });
});

describe('shareable verified CV', () => {
  it('opt-in link, public reading hides private data, switching off kills the link', async () => {
    const reviewer = await createUser({ name: 'Değerlendirici' }); const org = await createOrg({ [reviewer]: 'reviewer' });
    const user = await createUser({ name: 'Elif Demir' }); const minor = await createUser({ age: 16 });
    const mk = (title: string, status: string, visibility: string) => asUser(user, async (q) => (await q(
      `insert into public.experiences (user_id, kind, title, status, visibility) values ($1, 'project', $2, $3, $4) returning id`, [user, title, status, visibility])).rows[0].id);
    const verified = await mk('Doğrulanmış proje', 'published', 'profile'); const pending = await mk('Bekleyen proje', 'published', 'profile');
    await mk('Gizli proje', 'published', 'private'); await mk('Taslak proje', 'draft', 'profile');
    const att = (await asUser(user, (q) => q(`select * from public.request_attestation($1, $2)`, [verified, org]))).rows[0];
    await asUser(user, (q) => q(`select public.request_attestation($1, $2)`, [pending, org]));

    // the reviewer learns who is asking, by name only; other organisations learn nothing
    const stranger = await createUser(); await createOrg({ [stranger]: 'owner' });
    const names = (await asUser(reviewer, (q) => q(`select * from public.admin_attestation_requesters()`))).rows;
    expect(names.find((n) => n.attestation_id === att.id)?.display_name).toBe('Elif Demir');
    expect((await asUser(stranger, (q) => q(`select * from public.admin_attestation_requesters()`))).rowCount).toBe(0);
    await asUser(reviewer, (q) => q(`select public.decide_attestation($1, 'verified', 'Yazılım ekibinde görev aldı', 'Reddetme notu değil')`, [att.id]));

    expect((await asUser(user, (q) => q(`select public.my_cv() j`))).rows[0].j.share_token).toBeNull();
    await expectFail(asUser(minor, (q) => q(`select public.set_cv_sharing(true)`)), 403, 'cv_sharing_adults_only');
    await expect(asAnon((q) => q(`select public.set_cv_sharing(true)`))).rejects.toThrow(/permission denied/);
    const token = (await asUser(user, (q) => q(`select public.set_cv_sharing(true) t`))).rows[0].t as string;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect((await asUser(user, (q) => q(`select public.my_cv() j`))).rows[0].j.share_token).toBe(token);

    const pub = (await asAnon((q) => q(`select public.public_cv($1) j`, [token]))).rows[0].j;
    expect(pub.profile).toEqual({ display_name: 'Elif Demir', headline: null, bio: null, city: null, education_stage: 'university', skills: [] });
    expect(pub.experiences.map((x: { title: string }) => x.title).sort()).toEqual(['Bekleyen proje', 'Doğrulanmış proje']);
    const byTitle = Object.fromEntries(pub.experiences.map((x: { title: string }) => [x.title, x]));
    expect(byTitle['Doğrulanmış proje'].attestation).toMatchObject({ status: 'verified', organization: 'Test Org', scope: 'Yazılım ekibinde görev aldı' });
    expect(byTitle['Bekleyen proje'].attestation).toBeNull(); // an open request is not shown to the public
    const raw = JSON.stringify(pub);
    for (const leak of [user, att.id, 'decision_note', 'Reddetme notu değil', 'discoverable', 'example.test']) expect(raw).not.toContain(leak);

    // another user's token table is not readable, and bad tokens look the same as unknown ones
    expect((await asUser(stranger, (q) => q(`select cv_share_token from public.profile_private`))).rows.every((r) => r.cv_share_token === null)).toBe(true);
    await expectFail(asAnon((q) => q(`select public.public_cv('kisa')`)), 404, 'cv_not_found');
    await expectFail(asAnon((q) => q(`select public.public_cv($1)`, ['x'.repeat(32)])), 404, 'cv_not_found');

    await asUser(reviewer, (q) => q(`select public.revoke_attestation($1, 'Kayıt hatalıydı')`, [att.id]));
    const after = (await asAnon((q) => q(`select public.public_cv($1) j`, [token]))).rows[0].j;
    expect(after.experiences.every((x: { attestation: unknown }) => x.attestation === null)).toBe(true); // revocation reaches the shared CV at once

    await asUser(user, (q) => q(`select public.set_cv_sharing(false)`));
    await expectFail(asAnon((q) => q(`select public.public_cv($1)`, [token])), 404, 'cv_not_found');
    const next = (await asUser(user, (q) => q(`select public.set_cv_sharing(true) t`))).rows[0].t;
    expect(next).not.toBe(token);
  });
});
