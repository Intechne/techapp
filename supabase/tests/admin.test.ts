import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createEvent, createOrg, createUser, expectFail, register } from './helpers';

const soon = () => ({ starts_at: new Date(Date.now() + 36e5), ends_at: new Date(Date.now() + 5 * 36e5), registration_closes_at: new Date(Date.now() + 30 * 6e4) });
const draftRow = (org: string, user: string) => [org, `etkinlik-${Math.random().toString(36).slice(2, 10)}`, user];
const INSERT = `insert into public.events (organization_id, slug, title, summary, type, format, starts_at, ends_at, registration_closes_at, created_by)
  values ($1, $2, 'Panelden Etkinlik', 'Özet', 'workshop', 'online', now() + interval '10 days', now() + interval '10 days 3 hours', now() + interval '9 days', $3) returning id, status`;

describe('admin panel: access', () => {
  it('a signed-in user without any organisation role gets no admin data', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' }); const event = await createEvent(org, { status: 'draft' });
    const stranger = await createUser(); await register(await createUser(), await createEvent(org));
    expect((await asUser(stranger, (q) => q(`select public.my_account_state() j`))).rows[0].j.organization_roles).toEqual([]);
    expect((await asUser(stranger, (q) => q(`select * from public.events where id = $1`, [event]))).rowCount).toBe(0); // drafts invisible
    await expectFail(asUser(stranger, (q) => q(`select * from public.admin_event_registrations($1)`, [event])), 403, 'forbidden');
    await expect(asAnon((q) => q(`select * from public.admin_event_registrations($1)`, [event]))).rejects.toThrow(/permission denied/);
    await expect(asUser(stranger, (q) => q(INSERT, draftRow(org, stranger)))).rejects.toThrow(/row-level security/);
  });

  it('organisation isolation: A never sees B registrations or drafts, and cannot edit B events', async () => {
    const a = await createUser(); const b = await createUser();
    const orgA = await createOrg({ [a]: 'owner' }); const orgB = await createOrg({ [b]: 'owner' });
    const eventB = await createEvent(orgB); const draftB = await createEvent(orgB, { status: 'draft' });
    await register(await createUser({ name: 'Gizli Katılımcı' }), eventB);
    await expectFail(asUser(a, (q) => q(`select * from public.admin_event_registrations($1)`, [eventB])), 403, 'forbidden');
    expect((await asUser(a, (q) => q(`select * from public.event_registrations`))).rowCount).toBe(0);
    expect((await asUser(a, (q) => q(`select * from public.events where id = $1`, [draftB]))).rowCount).toBe(0);
    expect((await asUser(a, (q) => q(`update public.events set title = 'Ele geçirildi' where id = $1`, [eventB]))).rowCount).toBe(0);
    expect((await asUser(b, (q) => q(`select * from public.admin_event_registrations($1)`, [eventB]))).rows[0].display_name).toBe('Gizli Katılımcı');
    expect(orgA).toBeTruthy();
  });
});

describe('admin panel: event management', () => {
  it('an event manager creates, edits and submits; only Intechne publishes; invalid jumps are refused; all audited', async () => {
    const editor = await createUser(); const org = await createOrg({ [editor]: 'editor' });
    const platformAdmin = await createUser(); await admin(`insert into public.platform_admins (user_id) values ($1)`, [platformAdmin]);

    const created = (await asUser(editor, (q) => q(INSERT, draftRow(org, editor)))).rows[0];
    expect(created.status).toBe('draft');
    await expect(asUser(editor, (q) => q(INSERT.replace(`$3) returning`, `$3) returning`).replace(`'online',`, `'online',`).replace('values ($1', `values ($1`).replace('created_by)', 'created_by, status)').replace('$3) returning', `$3, 'published') returning`), draftRow(org, editor)))).rejects.toThrow(/row-level security/);

    expect((await asUser(editor, (q) => q(`update public.events set capacity = 40, title = 'Güncel Başlık' where id = $1`, [created.id]))).rowCount).toBe(1);
    await expectFail(asUser(editor, (q) => q(`update public.events set status = 'published' where id = $1`, [created.id])), 403, 'publish_requires_platform_approval');
    await asUser(editor, (q) => q(`update public.events set status = 'in_review' where id = $1`, [created.id]));
    await asUser(platformAdmin, (q) => q(`update public.events set status = 'published' where id = $1`, [created.id]));
    await expectFail(asUser(editor, (q) => q(`update public.events set status = 'draft' where id = $1`, [created.id])), 409, 'event_status_transition_invalid');

    const audit = await asUser(platformAdmin, (q) => q(`select action from public.audit_events where target_id = $1 order by id`, [created.id]));
    expect(audit.rows.map((r) => r.action)).toEqual(['event.status.in_review', 'event.status.published']);
  });

  it('cancelling an event cancels live registrations and invalidates tickets', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' }); const event = await createEvent(org, soon());
    const user = await createUser(); const reg = await register(user, event);
    const card = (await asUser(user, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j;
    await asUser(owner, (q) => q(`update public.events set status = 'cancelled' where id = $1`, [event]));
    expect((await admin(`select status, status_reason from public.event_registrations where id = $1`, [reg.id])).rows[0]).toEqual({ status: 'cancelled', status_reason: 'event_cancelled' });
    await expectFail(asUser(owner, (q) => q(`select public.check_in_participant($1)`, [card.qr_payload])), 422, 'ticket_invalid');
  });
});

describe('admin panel: web check-in', () => {
  it('check-in staff work only their organisation’s events; wrong event, cancelled and duplicates are told apart', async () => {
    const staff = await createUser(); const otherStaff = await createUser();
    const org = await createOrg({ [staff]: 'checkin_staff' }); await createOrg({ [otherStaff]: 'checkin_staff' });
    const event = await createEvent(org, soon()); const sibling = await createEvent(org, soon());
    const user = await createUser({ name: 'Deniz Yılmaz' }); const reg = await register(user, event);
    const token = (await asUser(user, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j.qr_payload;

    await expectFail(asUser(otherStaff, (q) => q(`select public.check_in_participant($1, null, $2)`, [token, event])), 403, 'checkin_forbidden');
    await expectFail(asUser(staff, (q) => q(`select public.check_in_participant($1, null, $2)`, [token, sibling])), 409, 'ticket_wrong_event');
    await expectFail(asUser(staff, (q) => q(`select public.check_in_participant('TA1.nope.x', null, $1)`, [event])), 422, 'ticket_malformed');
    // staff may check in but may not edit the event
    expect((await asUser(staff, (q) => q(`update public.events set title = 'x y z w' where id = $1`, [event]))).rowCount).toBe(0);

    const results = await Promise.all([1, 2, 3].map(() => asUser(staff, async (q) => (await q(`select public.check_in_participant($1, null, $2) j`, [token, event])).rows[0].j.result)));
    expect(results.filter((r) => r === 'checked_in')).toHaveLength(1);
    expect(results.filter((r) => r === 'already_checked_in')).toHaveLength(2);
    expect((await admin(`select count(*)::int n from public.event_check_ins where registration_id = $1`, [reg.id])).rows[0].n).toBe(1);

    const list = (await asUser(staff, (q) => q(`select * from public.admin_event_registrations($1)`, [event]))).rows;
    expect(list).toHaveLength(1); expect(list[0].checked_in_at).not.toBeNull();
    expect(Object.keys(list[0])).not.toContain('email');

    const late = await createUser(); const lateReg = await register(late, event);
    const lateToken = (await asUser(late, (q) => q(`select public.get_participation_card($1) j`, [lateReg.id]))).rows[0].j.qr_payload;
    await asUser(late, (q) => q(`select public.cancel_event_registration($1)`, [lateReg.id]));
    await expectFail(asUser(staff, (q) => q(`select public.check_in_participant($1, null, $2)`, [lateToken, event])), 422, 'ticket_invalid');
  });
});
