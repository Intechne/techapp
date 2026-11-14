import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Button, Input, Notice, SwitchRow, Text } from '..';
import { TabLabel, tabAccessibilityLabel, tabLabelFontScaleCap, TAB_LABEL_WIDEST_DP } from '../../navigation/TabLabel';

describe('a11y round (Task 4 findings)', () => {
  it('F-01: Button keeps its label as the accessible name while loading (and after), busy is state not name', async () => {
    const { rerender } = await render(<Button label="Doğrula" onPress={() => {}} loading />);
    const loading = screen.getByRole('button');
    expect(loading.props.accessibilityLabel).toBe('Doğrula');
    expect(loading.props.accessibilityState).toMatchObject({ busy: true });
    await rerender(<Button label="Doğrula" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Doğrula' }).props.accessibilityLabel).toBe('Doğrula');
    expect(JSON.stringify(screen.getByRole('button').props.accessibilityLabel)).not.toMatch(/busy/i);
  });

  it('F-01: an explicit accessibilityLabel still wins', async () => {
    await render(<Button label="Doğrula" accessibilityLabel="Kodu doğrula" />);
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Kodu doğrula');
  });

  it('F-02: tab labels follow the system font scale, capped at 1.3', async () => {
    await render(<TabLabel color="#000" focused={false} position="below-icon" width={390}>Keşfet</TabLabel>);
    const t = screen.getByText('Keşfet');
    expect(t.props.allowFontScaling).not.toBe(false);
    expect(t.props.maxFontSizeMultiplier).toBe(1.3);
    expect(t.props.numberOfLines).toBe(1);
  });

  it('F-02: the widest label ("Etkinlikler") still fits its tab at 320 dp with the capped scale, and at 200% font scale', () => {
    for (const width of [320, 360, 390, 412]) {
      const avail = width / 5 - 2;
      for (const fontScale of [1, 1.3, 2]) {
        expect(TAB_LABEL_WIDEST_DP * Math.min(fontScale, tabLabelFontScaleCap(width))).toBeLessThanOrEqual(avail);
      }
    }
    expect(tabLabelFontScaleCap(320)).toBeGreaterThan(1);
    expect(tabLabelFontScaleCap(1024)).toBe(1.3);
  });

  it('F-03: a blocker notice (alert opt-in) is one alert stop: title + body merged', async () => {
    await render(<Notice tone="warning" alert title="Kayıtlar kapandı.">Başvuru süresi bitti.</Notice>);
    const n = screen.getByRole('alert');
    expect(n.props.accessible).toBe(true);
    expect(n.props.accessibilityLabel).toBe('Kayıtlar kapandı. Başvuru süresi bitti.');
  });

  it('F-03: alert is opt-in: danger defaults on, informational warnings stay plain, the merged label is kept', async () => {
    await render(<Notice tone="warning" title="Takımın bekleme listesinde">Yer açılınca.</Notice>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Takımın bekleme listesinde Yer açılınca.').props.accessible).toBe(true);
    await render(<Notice tone="danger">Hata.</Notice>);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('tab accessible name: iOS spells "Keşfet, sekme, 1/5"; Android stays plain (role tab already announces role and position)', () => {
    expect(tabAccessibilityLabel('Keşfet', 0, 5, 'ios')).toBe('Keşfet, sekme, 1/5');
    expect(tabAccessibilityLabel('Profil', 4, 5, 'ios')).toBe('Profil, sekme, 5/5');
    expect(tabAccessibilityLabel('Keşfet', 0, 5, 'android')).toBe('Keşfet');
  });

  it('F-04: info notices stay a plain (non-alert) single stop', async () => {
    await render(<Notice tone="info" title="Başlık">Gövde</Notice>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Başlık Gövde').props.accessible).toBe(true);
  });

  it('F-04: the visible field label is not a second stop; the help text rides on the field as a hint', async () => {
    await render(<Input label="Doğrulama kodu" help="6 haneli kod" />);
    expect(screen.getByLabelText('Doğrulama kodu').props.accessibilityHint).toBe('6 haneli kod');
    expect(screen.getByText('Doğrulama kodu', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no');
    expect(screen.getByText('6 haneli kod', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no');
  });

  it('F-04: with an error the hint is dropped and the error stays a visible polite live region', async () => {
    await render(<Input label="Doğrulama kodu" help="6 haneli kod" error="Kod hatalı." />);
    expect(screen.getByLabelText('Doğrulama kodu').props.accessibilityHint).toBeUndefined();
    const err = screen.getByText('Kod hatalı.');
    expect(err.props.accessibilityLiveRegion).toBe('polite');
    expect(err.props.importantForAccessibility).not.toBe('no');
    expect(err.props.accessibilityElementsHidden).not.toBe(true);
  });

  it('F-08: switch row speaks the title once and its description as the hint', async () => {
    await render(<SwitchRow label="Dokunsal geri bildirim" description="Dokunuşlarda hafif titreşim." value onValueChange={() => {}} />);
    const sw = screen.getByLabelText('Dokunsal geri bildirim');
    expect(sw.props.accessibilityHint).toBe('Dokunuşlarda hafif titreşim.');
    expect(screen.getByText('Dokunsal geri bildirim', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no');
  });

  it('display headlines scale up to 1.6, other headings stay at 1.4', async () => {
    await render(<><Text variant="display">Manşet</Text><Text variant="title">Başlık</Text><Text variant="section">Bölüm</Text></>);
    expect(screen.getByText('Manşet').props.maxFontSizeMultiplier).toBe(1.6);
    expect(screen.getByText('Başlık').props.maxFontSizeMultiplier).toBe(1.4);
    expect(screen.getByText('Bölüm').props.maxFontSizeMultiplier).toBe(1.4);
  });
});
