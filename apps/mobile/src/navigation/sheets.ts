import { Keyboard } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, radius } from '../design-system';

const base = { presentation: 'formSheet', sheetGrabberVisible: true, sheetCornerRadius: radius.hero, contentStyle: { backgroundColor: colors.canvas } } as const;

/** A short form: the sheet is as tall as its content (join request, apply). */
export const fitSheet: NativeStackNavigationOptions = { ...base, sheetAllowedDetents: 'fitToContents' };
/** A long form or a list: opens at 60 % and can be pulled to full height (report, verification request). */
export const tallSheet: NativeStackNavigationOptions = { ...base, sheetAllowedDetents: [0.6, 1] };

/** Close a form sheet from code (send succeeded, a close button): the keyboard goes first, or it stays up over the screen underneath (seen on Android). */
export function closeSheet(navigation: { goBack: () => void }): void {
  Keyboard.dismiss();
  navigation.goBack();
}
