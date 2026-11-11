import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RegistrationStatus } from '..';

describe('RegistrationStatus checked-in label', () => {
  it('confirmed + checked in shows GİRİŞ YAPILDI instead of KATILIMIN ONAYLANDI', async () => {
    await render(<RegistrationStatus status="confirmed" checkedIn />);
    expect(screen.getByText('GİRİŞ YAPILDI')).toBeTruthy();
    expect(screen.queryByText('KATILIMIN ONAYLANDI')).toBeNull();
  });
  it('confirmed without check-in keeps the approval label; other statuses ignore the flag', async () => {
    await render(<><RegistrationStatus status="confirmed" /><RegistrationStatus status="waitlisted" checkedIn /></>);
    expect(screen.getByText('KATILIMIN ONAYLANDI')).toBeTruthy();
    expect(screen.getByText('BEKLEME LİSTESİNDESİN')).toBeTruthy();
  });
});
