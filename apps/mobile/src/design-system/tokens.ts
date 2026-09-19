/**
 * TechApp / Open Circuit design tokens. Mirrors design-source/tokens.json.
 * Screens and components must not hardcode colours, radii, spacing or font sizes.
 */
export const colors = {
  primary: '#4B46D6',
  primaryPressed: '#3832AF',
  primarySoft: '#EEEDFF',
  lime: '#D9F36E',
  ink: '#20241F',
  textSecondary: '#666D66',
  canvas: '#F6F7F2',
  surface: '#FFFFFF',
  surfaceSunken: '#E9ECE2',
  border: '#E3E6DD',
  borderStrong: '#D1D7C9',
  moss: '#157461',
  mossSoft: '#E5F3EB',
  apricot: '#FFD1BD',
  danger: '#B8323D',
  dangerSoft: '#FFF0F1',
  white: '#FFFFFF',
  scrim: 'rgba(32, 36, 31, 0.45)',
} as const;

/** Poster tones for event / content visuals: [background, foreground]. */
export const tones = {
  iris: { bg: '#E7E4FF', fg: '#3F36A3' },
  moss: { bg: '#E4EDC7', fg: '#374D25' },
  apricot: { bg: '#FFD9C9', fg: '#763C2C' },
  ink: { bg: '#283A32', fg: '#E8F4B8' },
} as const;
export type Tone = keyof typeof tones;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48 } as const;
export const radius = { small: 8, control: 14, card: 22, hero: 26, pill: 999 } as const;
export const layout = { gutter: 20, touchTarget: 44, bottomNavHeight: 76, baseWidth: 390, minWidth: 320 } as const;
export const motion = { fast: 160, standard: 220 } as const;

export const fonts = {
  heading: 'Manrope_800ExtraBold',
  headingBold: 'Manrope_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemibold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
} as const;

/** Native type scale. Nothing below 12pt (prototype 9–11px labels were raised for accessibility). */
export const type = {
  display: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 37, letterSpacing: -1.2 },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, letterSpacing: -0.7 },
  section: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
} as const;
export type TypeVariant = keyof typeof type;
