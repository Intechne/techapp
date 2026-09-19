import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createEvent, createOrg, createUser, expectFail, register } from './helpers';

const soon = () => ({ starts_at: new Date(Date.now() + 36e5), ends_at: new Date(Date.now() + 5 * 36e5), registration_closes_at: new Date(Date.now() + 30 * 6e4) });

describe('event volunteers', () => {
  it('apply → organiser approves with a duty → limited brief; everyone else is refused', async () => {
    const editor = await createUser(); const otherOrgOwner = await createUser();
    const org = await createOrg({ [editor]: 'editor' }); await createOrg({ [otherOrgOwner]: 'owner' });
    const event = await createEvent(org, { ...soon(), accepts_volunteers: true, capacity: 10 });
    const closed = await createEvent(org, soon());
    const participant = await createUser({ name: 'Gizli Katılımcı' }); await register(participant, event);
    const vol = await createUser({ name: 'Gönüllü Deniz' }); const minor = await createUser({ age: 16 });

    await expectFail(asUser(vol, (q) => q(`select public.apply_as_volunteer($1)`, [closed])), 409, 'volunteers_not_accepted');
    await expectFail(asUser(minor, (q) => q(`select public.apply_as_volunteer($1)`, [event])), 403, 'volunteer_adults_only');
    await expect(asAnon((q) => q(`select public.apply_as_volunteer($1)`, [event]))).rejects.toThrow(/permission denied/);

    const app1 = (await asUser(vol, (q) => q(`select * from public.apply_as_volunteer($1, 'Kayıt masasında çalışabilirim')`, [event]))).rows[0];
    const app2 = (await asUser(vol, (q) => q(`select * from public.apply_as_volunteer($1)`, [event]))).rows[0];
    expect(app1.status).toBe('pending'); expect(app2.id).toBe(app1.id); // idempotent
    await expectFail(asUser(vol, (q) => q(`select public.volunteer_event_brief($1)`, [event])), 403, 'volunteer_not_approved');
    await expect(asUser(vol, (q) => q(`update public.event_volunteers set status = 'approved' where id = $1`, [app1.id]))).resolves.toMatchObject({ rowCount: 0 });

    await asUser(editor, (q) => q(`insert into public.event_announcements (event_id, audience, title, body, created_by) values
      ($1, 'volunteers', 'Toplanma', 'Gönüllüler 08.30''da B kapısında buluşuyor.', $2), ($1, 'participants', 'Katılımcılara', 'Kimliğinizi unutmayın.', $2)`, [event, editor]));
    expect((await asUser(vol, (q) => q(`select * from public.event_announcements`))).rowCount).toBe(0); // not approved yet

    await expectFail(asUser(otherOrgOwner, (q) => q(`select public.decide_volunteer($1, true)`, [app1.id])), 403, 'forbidden');
    await expectFail(asUser(vol, (q) => q(`select public.decide_volunteer($1, true)`, [app1.id])), 403, 'forbidden');
    await asUser(editor, (q) => q(`select public.decide_volunteer($1, true, 'Kayıt masası')`, [app1.id]));

    const brief = (await asUser(vol, (q) => q(`select public.volunteer_event_brief($1) j`, [event]))).rows[0].j;
    expect(brief.my_duty).toBe('Kayıt masası');
    expect(brief.announcements.map((a: { title: string }) => a.title)).toEqual(['Toplanma']);
    expect(brief.stats).toMatchObject({ confirmed: 1, checked_in: 0, volunteers: 1 });
    expect(JSON.stringify(brief)).not.toContain('Gizli Katılımcı'); // no participant identities

    // audience scoping through RLS
    expect((await asUser(vol, (q) => q(`select title from public.event_announcements`))).rows.map((r) => r.title)).toEqual(['Toplanma']);
    expect((await asUser(participant, (q) => q(`select title from public.event_announcements`))).rows.map((r) => r.title)).toEqual(['Katılımcılara']);
    expect((await asUser(otherOrgOwner, (q) => q(`select * from public.event_announcements`))).rowCount).toBe(0);
    await expect(asUser(vol, (q) => q(`insert into public.event_announcements (event_id, title, body, created_by) values ($1, 'Sahte', 'x', $2)`, [event, vol]))).rejects.toThrow(/row-level security/);
    // volunteers get no registration list
    await expectFail(asUser(vol, (q) => q(`select * from public.admin_event_registrations($1)`, [event])), 403, 'forbidden');
    expect((await asUser(editor, (q) => q(`select * from public.admin_event_volunteers($1)`, [event]))).rows[0]).toMatchObject({ display_name: 'Gönüllü Deniz', status: 'approved' });

    await asUser(vol, (q) => q(`select public.withdraw_volunteer($1)`, [event]));
    await expectFail(asUser(vol, (q) => q(`select public.volunteer_event_brief($1)`, [event])), 403, 'volunteer_not_approved');
  });
});

describe('verified CV', () => {
  it('separates declared from verified, and derives participation from organiser check-ins', async () => {
    const staff = await createUser(); const reviewer = await createUser();
    const org = await createOrg({ [staff]: 'checkin_staff', [reviewer]: 'reviewer' });
    const event = await createEvent(org, soon()); const noShow = await createEvent(org, soon());
    const user = await createUser({ name: 'Elif Demir' });
    const reg = await register(user, event); await register(user, noShow);
    const token = (await asUser(user, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j.qr_payload;
    await asUser(staff, (q) => q(`select public.check_in_participant($1)`, [token]));

    await asUser(user, (q) => q(`update public.profiles set skills = array['Python', 'CAD'] where id = $1`, [user]));
    const mk = (title: string) => asUser(user, async (q) => (await q(`insert into public.experiences (user_id, kind, title, role, contribution, status, visibility)
      values ($1, 'project', $2, 'Yazılım', 'Sensör füzyonu yazdım', 'published', 'profile') returning id`, [user, title])).rows[0].id);
    const declared = await mk('Çizgi izleyen robot'); const verified = await mk('Hackathon projesi');
    const att = (await asUser(user, (q) => q(`select * from public.request_attestation($1, $2)`, [verified, org]))).rows[0];
    await asUser(reviewer, (q) => q(`select public.decide_attestation($1, 'verified', 'Yazılım ekibinde görev aldı', null)`, [att.id]));

    const cv = (await asUser(user, (q) => q(`select public.my_cv() j`))).rows[0].j;
    expect(cv.profile.skills).toEqual(['Python', 'CAD']);
    expect(cv.participations.map((p: { title: string }) => p.title)).toHaveLength(1); // the no-show is not a participation
    const byId = Object.fromEntries(cv.experiences.map((x: { id: string }) => [x.id, x]));
    expect(byId[declared].attestation).toBeNull();
    expect(byId[verified].attestation).toMatchObject({ status: 'verified', organization: 'Test Org' });
    expect(JSON.stringify(cv)).not.toContain('birth_date');
    await expect(asAnon((q) => q(`select public.my_cv()`))).rejects.toThrow(/permission denied/);
  });

  it('tasks can only be assigned to active members of that team', async () => {
    const captain = await createUser(); const outsider = await createUser();
    const team = (await asUser(captain, (q) => q(`select * from public.create_team('Nova Robotik', 'team', 'Robotik', null)`))).rows[0];
    await expectFail(asUser(captain, (q) => q(`insert into public.team_tasks (team_id, title, assignee_id, created_by) values ($1, 'Şasi çizimi', $2, $3)`, [team.id, outsider, captain])), 422, 'assignee_not_team_member');
    const ok = await asUser(captain, (q) => q(`insert into public.team_tasks (team_id, title, assignee_id, created_by, status) values ($1, 'Şasi çizimi', $2, $2, 'done') returning completed_at`, [team.id, captain]));
    expect(ok.rows[0].completed_at).not.toBeNull();
  });
});
