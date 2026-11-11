import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Checkbox, Chip, EmptyState, ErrorState, Notice, RegistrationStatus, VerificationBadge } from '..';
import { iconFillPaths, iconPaths } from '../icons.generated';
import { makeError } from '../../lib/errors';

describe('design system', () => {
  it('ships the 50-icon Open Circuit v2 pack', () => expect(Object.keys(iconPaths)).toHaveLength(50));

  it('icons stay theme-safe: only currentColor, fill states have unique mask ids', () => {
    for (const svg of [...Object.values(iconPaths), ...Object.values(iconFillPaths)]) {
      // Mask luminance (#fff/#000) is the only literal colour allowed; everything visible follows `color`.
      expect(svg.replace(/<mask[\s\S]*?<\/mask>/g, '')).not.toMatch(/var\(|#[0-9a-f]{3,6}\b/i);
    }
    for (const [name, svg] of Object.entries(iconFillPaths)) {
      if (svg.includes('<mask')) expect(svg).toContain(`id="tf-${name}"`);
    }
    for (const tab of ['discover', 'event', 'opportunity', 'community', 'profile'] as const) expect(iconFillPaths[tab]).toBeDefined();
  });

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

  it('Notice wraps interpolated text in <Text> (bare strings crash on native)', async () => {
    const masked = 'v•••@example.test';
    await render(<Notice tone="info">Daha önce {masked} adresine gönderdik.</Notice>);
    expect(screen.getByText(`Daha önce ${masked} adresine gönderdik.`).type).toBe('Text');
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

  it('status and provenance wording comes from one place', async () => {
    await render(<><RegistrationStatus status="pending_guardian" /><VerificationBadge verified={false} /><VerificationBadge verified by="Intechne" /></>);
    expect(screen.getByText('VELİ ONAYI BEKLENİYOR')).toBeTruthy();
    expect(screen.getByText('KENDİ BEYANI')).toBeTruthy();
    expect(screen.getByText('DOĞRULANDI · Intechne')).toBeTruthy();
  });
});
