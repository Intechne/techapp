/**
 * WCAG 2.x contrast audit data. One `contrastRatio`, one `TEXT_PAIRS` list: every text/background (and glyph/background) pair
 * the design system actually renders, tagged with the threshold that applies to it. Pure data + maths (no React Native), so
 * `scripts/contrast-audit.mjs` and the Jest test read the same list.
 *
 * Thresholds: body text >= 4.5; large text (>= 18 pt, or bold >= 14 pt) and icons/glyphs >= 3.
 * Rule: Lime is a fill (carrying Ink) on light surfaces. Lime as text only on Iris / Ink grounds, and only at large size.
 * Fixes go to the USAGE (use the tone's `fg`, a darker text role), never to the palette tokens.
 */
import { colors, semantic, tones } from './tokens';

type Rgb = [number, number, number];
const parse = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as Rgb;
};
const toHex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** `fg` laid over opaque `bg` at `alpha` (opacity on a View/Text, or an rgba chip). */
export function composite(fg: string, bg: string, alpha: number): string {
  const f = parse(fg), b = parse(bg);
  return toHex([0, 1, 2].map((i) => f[i]! * alpha + b[i]! * (1 - alpha)) as Rgb);
}

/** WCAG relative luminance of an sRGB hex colour. */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1..21. Both colours opaque hex. */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type PairKind = 'body' | 'large' | 'icon';
export const THRESHOLD: Record<PairKind, number> = { body: 4.5, large: 3, icon: 3 };

export interface TextPair {
  /** Where it is drawn. */
  usage: string;
  fg: string;
  bg: string;
  kind: PairKind;
  /** Dark-draft counterpart: semantic role paths (e.g. `text.primary`, `bg.canvas`). Only pairs built from semantic roles have one. */
  roles?: { fg: string; bg: string };
}

const L = semantic.light;
const role = (path: string, map: any = L): string => path.split('.').reduce<any>((o, k) => o[k], map);
const sem = (usage: string, fg: string, bg: string, kind: PairKind = 'body'): TextPair => ({ usage, fg: role(fg), bg: role(bg), kind, roles: { fg, bg } });
const raw = (usage: string, fg: string, bg: string, kind: PairKind = 'body'): TextPair => ({ usage, fg, bg, kind });

/** Tag tones as Chips.tsx draws them (caption 12 bold, so body text). `onDark`: the 86% white chip over the darkest possible photo. */
export const TAG_TONES: Record<string, { bg: string; fg: string }> = {
  iris: { bg: colors.primarySoft, fg: colors.primary },
  moss: { bg: colors.mossSoft, fg: colors.moss },
  neutral: { bg: colors.surfaceSunken, fg: colors.ink },
  onDark: { bg: composite('#FFFFFF', '#000000', 0.86), fg: colors.ink },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  apricot: { bg: tones.apricot.bg, fg: tones.apricot.fg },
};
/** Notice tones as Surface.tsx draws them (title 14 semibold + body 14, icon 20). */
export const NOTICE_TONES: Record<string, { bg: string; fg: string }> = {
  info: { bg: L.status.infoSoft, fg: L.status.info },
  success: { bg: L.status.successSoft, fg: L.status.success },
  warning: { bg: L.status.warningSoft, fg: L.status.warning },
  danger: { bg: L.status.dangerSoft, fg: L.status.danger },
};

const buttonPalette = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.white },
  secondary: { bg: colors.surface, pressed: colors.canvas, fg: colors.ink },
  lime: { bg: colors.lime, pressed: colors.limePressed, fg: colors.ink },
  danger: { bg: colors.dangerSoft, pressed: colors.dangerSoftPressed, fg: colors.danger },
};

export const TEXT_PAIRS: TextPair[] = [
  // ---- semantic roles on the surfaces they sit on
  sem('text.primary on canvas', 'text.primary', 'bg.canvas'), sem('text.primary on surface', 'text.primary', 'bg.surface'), sem('text.primary on sunken', 'text.primary', 'bg.sunken'),
  sem('text.secondary on canvas (screen meta, help)', 'text.secondary', 'bg.canvas'), sem('text.secondary on surface (card secondary, footnote, MiniCard body)', 'text.secondary', 'bg.surface'),
  sem('text.secondary on primarySoft', 'text.secondary', 'action.primarySoft'), sem('text.secondary on successSoft', 'text.secondary', 'status.successSoft'), sem('text.secondary on dangerSoft', 'text.secondary', 'status.dangerSoft'),
  sem('text.inverse on bg.inverse', 'text.inverse', 'bg.inverse'), sem('text.onInverseAccent on bg.inverse', 'text.onInverseAccent', 'bg.inverse'),
  sem('text.onAction on action.primary', 'text.onAction', 'action.primary'), sem('text.onAction on action.primaryPressed', 'text.onAction', 'action.primaryPressed'),
  sem('text.onLime on action.lime', 'text.onLime', 'action.lime'), sem('text.onLime on action.limePressed', 'text.onLime', 'action.limePressed'),
  sem('link/eyebrow action.primary on surface', 'action.primary', 'bg.surface'), sem('link/eyebrow action.primary on canvas', 'action.primary', 'bg.canvas'),
  sem('action.primary on primarySoft (Tag iris, tile glyph)', 'action.primary', 'action.primarySoft'),
  sem('status.success on successSoft', 'status.success', 'status.successSoft'), sem('status.success on surface', 'status.success', 'bg.surface'),
  sem('status.warning on warningSoft', 'status.warning', 'status.warningSoft'), sem('status.warning on surface', 'status.warning', 'bg.surface'),
  sem('status.danger on dangerSoft', 'status.danger', 'status.dangerSoft'), sem('status.danger on surface (field error)', 'status.danger', 'bg.surface'), sem('status.danger on canvas (field error)', 'status.danger', 'bg.canvas'),
  sem('status.info on infoSoft', 'status.info', 'status.infoSoft'), sem('status.info on surface', 'status.info', 'bg.surface'),
  sem('action.lime text on bg.inverse (onboarding title, hero accent ground)', 'action.lime', 'bg.inverse', 'large'),
  // ---- glyphs and non-text UI
  sem('chevron / secondary glyph on surface', 'text.secondary', 'bg.surface', 'icon'),
  sem('bookmark / primary glyph on surface', 'action.primary', 'bg.surface', 'icon'),
  sem('primary glyph on primarySoft (RowCard / MiniCard tile)', 'action.primary', 'action.primarySoft', 'icon'),
  sem('unread dot action.primary on surface', 'action.primary', 'bg.surface', 'icon'),
  raw('verified glyph moss on surface', colors.moss, colors.surface, 'icon'),
  // ---- Tag tones (Status views resolve to these)
  ...Object.entries(TAG_TONES).map(([k, t]) => raw(`Tag ${k}`, t.fg, t.bg)),
  // ---- Notice tones
  ...Object.entries(NOTICE_TONES).flatMap(([k, t]) => [raw(`Notice ${k} text`, t.fg, t.bg), raw(`Notice ${k} icon`, t.fg, t.bg, 'icon')]),
  // ---- Poster / cover panel / Avatar: tone fg on tone bg (eyebrow 12, line 17-24, initials 14)
  ...Object.entries(tones).map(([k, t]) => raw(`Cover panel / Avatar ${k}`, t.fg, t.bg)),
  // ---- Buttons (label 14 semibold), pressed fills included
  ...Object.entries(buttonPalette).flatMap(([k, p]) => [raw(`Button ${k}`, p.fg, p.bg), raw(`Button ${k} pressed`, p.fg, p.pressed)]),
  // ---- Chips / segmented control
  raw('Chip selected (white on ink)', colors.white, colors.ink), raw('Chip unselected (ink on surface)', colors.ink, colors.surface),
  raw('Segmented active (ink on surface plate)', colors.ink, colors.surface), raw('Segmented inactive (ink on sunken track)', colors.ink, colors.surfaceSunken),
  // ---- Tab bar
  raw('TabLabel active (primary on surface)', colors.primary, colors.surface), raw('TabLabel inactive (secondary on surface)', colors.textSecondary, colors.surface),
  // ---- Hero / Poster on Iris (lime is a fill here; accent text is large)
  raw('Hero eyebrow / title (white on Iris)', colors.white, colors.primary), raw('Hero title (white on Iris pressed)', colors.white, colors.primaryPressed),
  raw('Hero meta (white 85% on Iris)', composite('#FFFFFF', colors.primary, 0.85), colors.primary),
  raw('Hero accent word (lime on Iris, title 24)', colors.lime, colors.primary, 'large'),
  raw('Hero CTA (ink on lime pill)', colors.ink, colors.lime),
  // ---- Offline / toast / counters (white text on solid grounds)
  raw('OfflineLabel / OfflineBanner (white on ink)', colors.white, colors.ink),
  raw('Toast neutral (white on ink)', colors.white, colors.ink), raw('Toast success (white on moss)', colors.white, colors.moss), raw('Toast danger (white on danger)', colors.white, colors.danger),
  raw('Icon badge count (white on Iris)', colors.white, colors.primary), raw('Checkbox / timeline glyph (white on Iris)', colors.white, colors.primary, 'icon'), raw('Timeline done glyph (white on moss)', colors.white, colors.moss, 'icon'),
  // ---- Inputs
  raw('Input value (ink on surface)', colors.ink, colors.surface), raw('Input placeholder (secondary on surface)', colors.textSecondary, colors.surface),
  raw('Field help (secondary on canvas)', colors.textSecondary, colors.canvas), raw('DemoTag (secondary on surface)', colors.textSecondary, colors.surface),
];

/** Disabled controls are exempt from WCAG 1.4.3; reported (Button: opacity .45 over canvas) so the number is on record. */
export const DISABLED_PAIRS: TextPair[] = Object.entries(buttonPalette).map(([k, p]) => ({
  usage: `Button ${k} disabled (opacity .45 over canvas)`,
  fg: composite(p.fg, colors.canvas, 0.45), bg: composite(p.bg, colors.canvas, 0.45), kind: 'body' as PairKind,
}));

export interface AuditRow { usage: string; ratio: number; min: number; pass: boolean; fg: string; bg: string; kind: PairKind }
export const audit = (pairs: readonly TextPair[], resolve: (p: TextPair) => { fg: string; bg: string } = (p) => p): AuditRow[] =>
  pairs.map((p) => {
    const { fg, bg } = resolve(p);
    const ratio = contrastRatio(fg, bg);
    const min = THRESHOLD[p.kind];
    return { usage: p.usage, ratio, min, pass: ratio >= min, fg, bg, kind: p.kind };
  });

/** Dark draft (`design-source/tokens.json` semantic.dark.colors): same thresholds, semantic-role pairs only. Report-only. */
export const auditDark = (dark: unknown): AuditRow[] =>
  audit(TEXT_PAIRS.filter((p) => p.roles), (p) => ({ fg: role(p.roles!.fg, dark), bg: role(p.roles!.bg, dark) }));
