import { useWindowDimensions } from 'react-native';
import { layout } from './tokens';

/**
 * Responsive breakpoints for every surface the app runs on: phones (320+), large phones, tablets, foldables,
 * desktop-class windows and TVs. Screens never read the window size themselves; they ask for columns / content width.
 */
export type SizeClass = 'compact' | 'medium' | 'expanded' | 'large' | 'xlarge';

export function useLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  // xlarge = TVs and wide desktop windows (1080p and up): one more column, never edge-to-edge text.
  const sizeClass: SizeClass = width >= 1600 ? 'xlarge' : width >= 1200 ? 'large' : width >= 840 ? 'expanded' : width >= 600 ? 'medium' : 'compact';
  const gutter = sizeClass === 'compact' ? layout.gutter : sizeClass === 'medium' ? 28 : sizeClass === 'xlarge' ? 56 : 40;
  // Reading width stays comfortable on big screens; grids may use the wider limit.
  const contentMaxWidth = sizeClass === 'compact' ? undefined : sizeClass === 'medium' ? 720 : sizeClass === 'xlarge' ? 1480 : 1180;
  const readingMaxWidth = sizeClass === 'compact' ? undefined : sizeClass === 'xlarge' ? 760 : 680;
  const base = sizeClass === 'xlarge' ? 4 : sizeClass === 'large' ? 3 : sizeClass === 'expanded' ? 3 : sizeClass === 'medium' ? 2 : 1;
  // Large accessibility fonts need room: drop a column rather than squeeze text.
  const columns = Math.max(1, fontScale > 1.3 ? base - 1 : base);
  return { width, height, sizeClass, gutter, contentMaxWidth, readingMaxWidth, columns, isCompact: sizeClass === 'compact', sideNavigation: width >= 840 && width > height };
}
