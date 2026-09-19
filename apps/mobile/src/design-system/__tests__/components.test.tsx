import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Checkbox, Chip, EmptyState, ErrorState, EventCard, RegistrationStatus, VerificationBadge } from '..';
import { iconPaths } from '../icons.generated';
import { makeError } from '../../lib/errors';

describe('design system', () => {
  it('ships the full 30-icon Open Circuit pack', () => expect(Object.keys(iconPaths)).toHaveLength(30));

  it('Button: fires onPress, and is inert + announced busy while loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Etkinliğe katıl" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Etkinliğe katıl' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    await rerender(<Button label="Etkinliğe katıl" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1); // double tap while submitting does nothing
    expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('Chip and Checkbox expose selected/checked state to screen readers', async () => {
    const onChange = jest.fn();
    await render(<><Chip label="Robotik" selected /><Checkbox label="Kabul ediyorum" checked={false} onChange={onChange} error="Gerekli" /></>);
    expect(screen.getByRole('button', { name: 'Robotik' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Gerekli')).toBeTruthy();
  });

  it('ErrorState offers retry only for retryable errors', async () => {
    const retry = jest.fn();
    const { rerender } = await render(<ErrorState error={makeError('network_unreachable', 0)} onRetry={retry} />);
    await fireEvent.press(screen.getByText('Tekrar dene'));
    expect(retry).toHaveBeenCalled();
    await rerender(<ErrorState error={makeError('forbidden', 403)} onRetry={retry} />);
    expect(screen.queryByText('Tekrar dene')).toBeNull();
  });

  it('EmptyState renders its call to action', async () => {
    const go = jest.fn();
    await render(<EmptyState title="Henüz bir katılımın yok" actionLabel="Etkinlikleri keşfet" onAction={go} />);
    await fireEvent.press(screen.getByText('Etkinlikleri keşfet'));
    expect(go).toHaveBeenCalled();
  });

  it('EventCard: whole card is one accessible button, bookmark is separate', async () => {
    const open = jest.fn(); const save = jest.fn();
    await render(<EventCard onPress={open} onToggleSave={save} model={{ id: '1', title: 'İyi Bir Gelecek Hackathonu', posterLine: 'Bir fikir.', tone: 'iris', typeLabel: 'HACKATHON', organizer: 'Intechne', dateLabel: '17 Ekim 2026', placeLabel: 'İstanbul', audienceLabel: 'Lise + üniversite', feeLabel: 'Ücretsiz' }} />);
    await fireEvent.press(screen.getByLabelText('Kaydet'));
    expect(save).toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('İyi Bir Gelecek Hackathonu'));
    expect(open).toHaveBeenCalled();
  });

  it('status and provenance wording comes from one place', async () => {
    await render(<><RegistrationStatus status="pending_guardian" /><VerificationBadge verified={false} /><VerificationBadge verified by="Intechne" /></>);
    expect(screen.getByText('VELİ ONAYI BEKLENİYOR')).toBeTruthy();
    expect(screen.getByText('KENDİ BEYANI')).toBeTruthy();
    expect(screen.getByText('DOĞRULANDI · Intechne')).toBeTruthy();
  });
});
