import { space, type } from '../../tokens';

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

/** Poster titles run up to three lines; the body reserves two, the common case for Turkish event names on a phone. */
export const POSTER_RESERVED_TITLE_LINES = 2;

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
}

/**
 * Height of a RowCard whose text wraps to exactly these line counts, from the same constants the card and its skeleton
 * lay out with. Text wrapping itself is only known at layout time (and grows with the system font scale), so this is
 * the planned height for a list's typical row, not a promise for every row.
 */
export function rowCardHeight(lines: RowLines): number {
  const text = type.cardTitle.lineHeight * lines.title
    + (lines.secondary ? cardLayout.secondaryGap + type.bodySmall.lineHeight * lines.secondary : 0)
    + (lines.footnote === 'none' ? 0 : cardLayout.footGap + type.caption.lineHeight + (lines.footnote === 'tag' ? cardLayout.tag + cardLayout.footTagGap : 0))
    // ÖRNEK rides in the footnote tag row when there is one; otherwise it takes its own line.
    + (lines.demo && lines.footnote !== 'tag' ? cardLayout.footGap + cardLayout.demoTag : 0);
  return cardLayout.pad * 2 + Math.max(cardLayout.leadingTile, text);
}

/**
 * - poster: cover is 16:10 whether it shows a photo or the fallback; the body's minimum reserves two title lines
 *   (a third line grows the card downward).
 * - row: padding around the 46 px leading tile.
 * - mini: fixed minimum so two cards side by side line up.
 */
export const cardMetrics = {
  poster: { coverAspect: 1.6 as const, bodyMinHeight: posterBodyMinHeight },
  row: { minHeight: cardLayout.pad * 2 + cardLayout.leadingTile },
  mini: { minHeight: 136 as const },
};
