import { LARGE_TEXT_FONT_SCALE, space, type } from '../../tokens';

/**
 * Card geometry, shared by every card and its skeleton so loading → content never shifts.
 * All values derive from tokens; the only literals are the 46 px leading tile (contract) and the status row,
 * which is a Tag's height (caption line 16 + 2 × 5 padding = 26) rounded up to an even 28.
 */
export const cardLayout = {
  pad: space[4],
  statusRow: 28,
  leadingTile: 46,
  /** Status row → title. */
  titleGap: space[3],
  /** Title → first meta line. */
  metaGap: space[2],
  /** Between the two meta lines. */
  metaLineGap: space[1],
  /** Tag (Chips.tsx): caption line 16 + 2 × 5 padding. */
  tag: type.caption.lineHeight + 10,
  /** ÖRNEK tag: eyebrow line 16 + 2 × 2 padding + 2 × 1 hairline. */
  demoTag: type.eyebrow.lineHeight + space[1] + 2,
  /** Title → secondary, secondary/title → footnote row, → ÖRNEK line (RowCard). */
  secondaryGap: space[1] / 2,
  footGap: space[2],
  /** Footnote tag row → footnote text. */
  footTagGap: space[1],
  /** Card press feedback: big surfaces move less than buttons (motion.pressScale 0.97). */
  pressScale: 0.985,
  /** Fallback poster: type badge and the circuit trace. */
  badge: 40,
  trace: 2,
  node: 8,
} as const;

/**
 * Poster titles run up to three lines; the body reserves one. A vertical list does not need equal card heights, and a
 * reserved second line reads as missing content under short titles (approved at the Faz 4 preview gate, Q8).
 */
export const POSTER_RESERVED_TITLE_LINES = 1;

/** Window width (dp) under which a RowCard status tag sits under the text instead of beside it (phones; approved Q6). */
export const STACK_STATUS_BELOW = 600;

/** Window width (dp) under which MiniCards go one per row (approved Q13); also at font scale ≥ MINI_SINGLE_COLUMN_FONT_SCALE. */
export const MINI_SINGLE_COLUMN_BELOW = 360;
export const MINI_SINGLE_COLUMN_FONT_SCALE = LARGE_TEXT_FONT_SCALE;

const posterBodyMinHeight =
  cardLayout.pad * 2 + cardLayout.statusRow + cardLayout.titleGap + type.cardTitle.lineHeight * POSTER_RESERVED_TITLE_LINES
  + cardLayout.metaGap + type.caption.lineHeight * 2 + cardLayout.metaLineGap;

/** The shape of a row a list expects, so its skeleton can measure like the real rows (RowCardSkeleton `lines`). */
export interface RowLines {
  title: 1 | 2;
  secondary: 0 | 1 | 2;
  /** `tag`: a status-tag row (deadline) above the footnote text; `text`: footnote text only; `none`: no footnote. */
  footnote: 'none' | 'text' | 'tag';
  demo?: boolean;
  /** Rows carry a status (trailing slot). On phones it sits on its own line under the text, so the planned height includes it. */
  status?: boolean;
}

/**
 * Height of a RowCard whose text wraps to exactly these line counts, from the same constants the card and its skeleton
 * lay out with. Text wrapping itself is only known at layout time (and grows with the system font scale), so this is
 * the planned height for a list's typical row, not a promise for every row.
 */
export function rowCardHeight(lines: RowLines, width: number = 390): number {
  const statusLine = !!lines.status && width < STACK_STATUS_BELOW;
  const text = type.cardTitle.lineHeight * lines.title
    + (lines.secondary ? cardLayout.secondaryGap + type.bodySmall.lineHeight * lines.secondary : 0)
    + (lines.footnote === 'none' ? 0 : cardLayout.footGap + type.caption.lineHeight + (lines.footnote === 'tag' ? cardLayout.tag + cardLayout.footTagGap : 0))
    // A stacked status is a tag-only row of its own; ÖRNEK joins it. Otherwise ÖRNEK rides in the footnote tag row, or takes its own line.
    + (statusLine ? cardLayout.footGap + cardLayout.tag : 0)
    + (lines.demo && lines.footnote !== 'tag' && !statusLine ? cardLayout.footGap + cardLayout.demoTag : 0);
  return cardLayout.pad * 2 + Math.max(cardLayout.leadingTile, text);
}

/**
 * - poster: cover is 16:10 whether it shows a photo or the fallback; the body's minimum reserves one title line
 *   (longer titles grow the card downward).
 * - row: padding around the 46 px leading tile.
 * - mini: fixed minimum so two cards side by side line up.
 */
export const cardMetrics = {
  poster: { coverAspect: 1.6 as const, bodyMinHeight: posterBodyMinHeight },
  row: { minHeight: cardLayout.pad * 2 + cardLayout.leadingTile },
  mini: { minHeight: 136 as const },
};
