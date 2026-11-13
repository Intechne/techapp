import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusTimeline, teamMemberStepView, teamRegistrationStatusView, teamRegistrationSteps } from '..';

const states = (status: Parameters<typeof teamRegistrationSteps>[0], review: boolean) =>
  Object.fromEntries(teamRegistrationSteps(status, review).map((s) => [s.key, s.state]));

describe('team registration status wording', () => {
  it('has a view for every server status, wording only here', () => {
    expect(Object.keys(teamRegistrationStatusView).sort()).toEqual(['cancelled', 'confirmed', 'expired', 'pending_members', 'pending_review', 'rejected', 'waitlisted']);
    expect(teamRegistrationStatusView.pending_members.label).toBe('ÜYELER BEKLENİYOR');
    expect(teamRegistrationStatusView.confirmed.tone).toBe('moss');
  });
  it('has a view for every member step', () => {
    expect(Object.keys(teamMemberStepView).sort()).toEqual(['declined', 'guardian', 'invited', 'ready']);
    expect(teamMemberStepView.ready.label).toBe('HAZIR');
    expect(teamMemberStepView.guardian.label).toBe('VELİ ONAYI BEKLENİYOR');
  });
});

describe('teamRegistrationSteps', () => {
  it('pending_members: waiting for members; the review step belongs only to a review event', () => {
    expect(states('pending_members', false)).toEqual({ registered: 'done', members: 'current', confirmed: 'todo' });
    expect(states('pending_members', true)).toEqual({ registered: 'done', members: 'current', review: 'todo', confirmed: 'todo' });
  });
  it('pending_review always shows the review step (the server status wins)', () => {
    expect(states('pending_review', false)).toEqual({ registered: 'done', members: 'done', review: 'current', confirmed: 'todo' });
  });
  it('confirmed: every step done', () => {
    expect(states('confirmed', true)).toEqual({ registered: 'done', members: 'done', review: 'done', confirmed: 'done' });
    expect(states('confirmed', false)).toEqual({ registered: 'done', members: 'done', confirmed: 'done' });
  });
  it('waitlisted: the seat is what is blocked', () => {
    expect(states('waitlisted', false)).toEqual({ registered: 'done', members: 'blocked', confirmed: 'todo' });
  });
  it('expired / rejected / cancelled', () => {
    expect(states('expired', false)).toEqual({ registered: 'done', members: 'failed', confirmed: 'skipped' });
    expect(states('rejected', true)).toEqual({ registered: 'done', members: 'done', review: 'failed', confirmed: 'skipped' });
    expect(teamRegistrationSteps('cancelled', false)).toEqual([]);
  });
  it('renders the team labels on the shared timeline', async () => {
    await render(<StatusTimeline steps={teamRegistrationSteps('pending_members', true)} />);
    for (const l of ['Gönderildi', 'Üyeler hazır', 'İnceleme', 'Onaylandı']) expect(screen.getByText(l)).toBeTruthy();
  });
});
