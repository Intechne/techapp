import fs from 'fs';
import path from 'path';
import { Keyboard } from 'react-native';
import { closeSheet, fitSheet, tallSheet } from '../sheets';
import { radius } from '../../design-system';

describe('sheet routes', () => {
  it('every sheet is a native formSheet with a grabber and the hero radius', () => {
    for (const o of [fitSheet, tallSheet]) {
      expect(o).toMatchObject({ presentation: 'formSheet', sheetGrabberVisible: true, sheetCornerRadius: radius.hero });
    }
    expect(fitSheet.sheetAllowedDetents).toBe('fitToContents');
    expect(tallSheet.sheetAllowedDetents).toEqual([0.6, 1]);
  });
  it('are registered on the root stack (they cover the tab bar)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'RootNavigator.tsx'), 'utf8');
    const root = src.slice(src.indexOf('export function RootNavigator'));
    for (const n of ['ReportSheet', 'RecruitmentApply', 'TeamJoinRequest', 'ExperienceVerify']) expect(root).toContain(`name="${n}"`);
  });
  it('closing from code dismisses the keyboard first, then pops the sheet', () => {
    const order: string[] = [];
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => { order.push('keyboard'); });
    closeSheet({ goBack: () => order.push('back') });
    expect(order).toEqual(['keyboard', 'back']);
    dismiss.mockRestore();
  });
});
