import { describe, expect, it } from 'vitest';
import { toUiError, type TeamRegItem } from './lib';
import { approveLabel, holdLapsed, memberLabel, parseTeamRegs, teamChangeNeedsReview, teamStatusLabel, validateTeamSettings } from './team';

type Member = TeamRegItem['members'][number];
const m = (state: Member['state'], step: Member['step']) => ({ state, step });

describe('memberLabel', () => {
  it('shows "ended" for every member of a dead team, never a refusal', () => {
    for (const status of ['cancelled', 'rejected', 'expired'] as const)
      expect(memberLabel({ status }, m('accepted', 'declined'))).toEqual({ text: 'Takım sona erdi', tone: 'neutral' });
  });
  it('maps live-team steps and states', () => {
    expect(memberLabel({ status: 'pending_members' }, m('invited', 'invited')).text).toBe('Davet bekliyor');
    expect(memberLabel({ status: 'pending_members' }, m('accepted', 'guardian')).text).toBe('Veli onayı bekliyor');
    expect(memberLabel({ status: 'pending_review' }, m('accepted', 'ready'))).toEqual({ text: 'Hazır', tone: 'moss' });
    expect(memberLabel({ status: 'confirmed' }, m('declined', 'declined')).text).toBe('Daveti reddetti');
    expect(memberLabel({ status: 'confirmed' }, m('removed', 'declined')).text).toBe('Kadrodan çıkarıldı');
    expect(memberLabel({ status: 'waitlisted' }, m('accepted', 'declined')).text).toBe('Katılımı sona erdi');
  });
});

describe('lapsed hold', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  it('is lapsed only for pending_members past hold_expires_at', () => {
    expect(holdLapsed({ status: 'pending_members', hold_expires_at: '2026-11-14T11:57:00Z' }, now)).toBe(true);
    expect(holdLapsed({ status: 'pending_members', hold_expires_at: '2026-11-14T12:30:00Z' }, now)).toBe(false);
    expect(holdLapsed({ status: 'pending_members', hold_expires_at: null }, now)).toBe(false);
    expect(holdLapsed({ status: 'pending_review', hold_expires_at: '2026-11-14T11:57:00Z' }, now)).toBe(false);
  });
  it('labels it', () => {
    expect(teamStatusLabel({ status: 'pending_members', hold_expires_at: '2026-11-14T11:57:00Z' }, now)).toBe('Süresi doldu, kapanıyor');
    expect(teamStatusLabel({ status: 'confirmed', hold_expires_at: null }, now)).toBe('Onaylı');
  });
});

describe('approveLabel', () => {
  it('offers "as is" only for the below-min-after-close case', () => {
    expect(approveLabel({ status_reason: 'roster_below_min_after_close' })).toBe('Bu kadroyla onayla');
    expect(approveLabel({ status_reason: 'members_ready' })).toBe('Onayla');
    expect(approveLabel({ status_reason: null })).toBe('Onayla');
  });
});

describe('validateTeamSettings', () => {
  const ok = { team_capacity: '4', team_min_size: '3', team_max_size: '5' };
  it('accepts valid and empty-optional values', () => {
    expect(validateTeamSettings(ok)).toBeNull();
    expect(validateTeamSettings({ team_capacity: '', team_min_size: '1', team_max_size: '' })).toBeNull();
    expect(validateTeamSettings({ ...ok, team_min_size: '5' })).toBeNull();
  });
  it('mirrors the database checks', () => {
    expect(validateTeamSettings({ ...ok, team_capacity: '0' })).toMatch(/kontenjan/);
    expect(validateTeamSettings({ ...ok, team_capacity: '2.5' })).toMatch(/kontenjan/);
    expect(validateTeamSettings({ ...ok, team_min_size: '' })).toMatch(/en az/);
    expect(validateTeamSettings({ ...ok, team_min_size: '101' })).toMatch(/en az/);
    expect(validateTeamSettings({ ...ok, team_max_size: '0' })).toMatch(/en çok/);
    expect(validateTeamSettings({ ...ok, team_min_size: '6' })).toMatch(/büyük olamaz/);
  });
});

describe('teamChangeNeedsReview', () => {
  const orig = { team_capacity: 10, team_min_size: 3, team_max_size: 5 };
  const same = { team_capacity: '10', team_min_size: '3', team_max_size: '5' };
  it('warns only for lowered or newly set capacity, or changed size limits', () => {
    expect(teamChangeNeedsReview(orig, same)).toBe(false);
    expect(teamChangeNeedsReview(orig, { ...same, team_capacity: '12' })).toBe(false);
    expect(teamChangeNeedsReview(orig, { ...same, team_capacity: '' })).toBe(false);
    expect(teamChangeNeedsReview(orig, { ...same, team_capacity: '8' })).toBe(true);
    expect(teamChangeNeedsReview({ ...orig, team_capacity: null }, { ...same, team_capacity: '8' })).toBe(true);
    expect(teamChangeNeedsReview(orig, { ...same, team_min_size: '2' })).toBe(true);
    expect(teamChangeNeedsReview(orig, { ...same, team_max_size: '' })).toBe(true);
    expect(teamChangeNeedsReview(null, same)).toBe(false);
  });
});

describe('parseTeamRegs', () => {
  it('keeps well-formed rows, drops malformed ones, rejects a non-array', () => {
    const row = { id: 'a', team_name: 'X', status: 'confirmed', roster_size: 3, ready_count: 3, members: [] };
    expect(parseTeamRegs([row, { id: 1 }, null])).toHaveLength(1);
    expect(() => parseTeamRegs({})).toThrow();
  });
});

describe('toUiError for team review', () => {
  it('maps the 409 from review_team_registration', () => {
    expect(toUiError({ code: 'PT409', message: 'team_registration_not_pending_review' })).toEqual({ code: 'team_registration_not_pending_review', message: 'Bu takım kaydı artık değerlendirme beklemiyor.' });
  });
  it('reports a network failure honestly', () => {
    expect(toUiError(new TypeError('Failed to fetch')).code).toBe('network');
  });
});
