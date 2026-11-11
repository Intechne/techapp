import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusTimeline, registrationSteps } from '..';
import type { RegistrationStatus } from '../../lib/database.types';

const states = (status: RegistrationStatus, needsGuardian: boolean) =>
  Object.fromEntries(registrationSteps(status, needsGuardian).map((s) => [s.key, s.state]));

describe('registrationSteps', () => {
  it('pending_guardian: guardian is the current step', () => {
    expect(states('pending_guardian', true)).toEqual({ registered: 'done', guardian: 'current', confirmed: 'todo', card: 'todo' });
  });
  it('pending_guardian shows the guardian step even if the flag is false (server status wins)', () => {
    expect(states('pending_guardian', false).guardian).toBe('current');
  });
  it('confirmed without guardian: no guardian step, card is current', () => {
    const steps = registrationSteps('confirmed', false);
    expect(steps.map((s) => s.key)).toEqual(['registered', 'confirmed', 'card']);
    expect(states('confirmed', false)).toEqual({ registered: 'done', confirmed: 'done', card: 'current' });
  });
  it('confirmed after guardian consent: guardian done', () => {
    expect(states('confirmed', true)).toEqual({ registered: 'done', guardian: 'done', confirmed: 'done', card: 'current' });
  });
  it('waitlisted: confirmation is blocked', () => {
    expect(states('waitlisted', false)).toEqual({ registered: 'done', confirmed: 'blocked', card: 'todo' });
  });
  it('cancelled: no timeline', () => expect(registrationSteps('cancelled', true)).toEqual([]));
  it('pending_review: confirmation is current', () => {
    expect(states('pending_review', false)).toEqual({ registered: 'done', confirmed: 'current', card: 'todo' });
  });
  it('rejected: confirmation is blocked', () => {
    expect(states('rejected', false)).toEqual({ registered: 'done', confirmed: 'blocked', card: 'todo' });
  });
  it('expired: guardian step is blocked', () => {
    expect(states('expired', true)).toEqual({ registered: 'done', guardian: 'blocked', confirmed: 'todo', card: 'todo' });
  });
});

describe('StatusTimeline', () => {
  it('reads each step as "<label>, <state text>"', async () => {
    await render(<StatusTimeline steps={registrationSteps('pending_guardian', true)} />);
    expect(screen.getByLabelText('Başvurun alındı, tamamlandı')).toBeTruthy();
    expect(screen.getByLabelText('Veli onayı, şu an bu adımda')).toBeTruthy();
    expect(screen.getByLabelText('Katılım onayı, sırada')).toBeTruthy();
    expect(screen.getByLabelText('Katılım kartı, sırada')).toBeTruthy();
  });
  it('announces a blocked step', async () => {
    await render(<StatusTimeline steps={registrationSteps('waitlisted', false)} />);
    expect(screen.getByLabelText('Katılım onayı, beklemede')).toBeTruthy();
  });
  it('renders nothing for an empty timeline', async () => {
    await render(<StatusTimeline steps={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
