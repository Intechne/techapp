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
  /** Card press feedback: big surfaces move less than buttons (motion.pressScale 0.97). */
  pressScale: 0.985,
  /** Fallback poster: type badge and the circuit trace. */
  badge: 40,
  trace: 2,
  node: 8,
} as const;

const posterBodyMinHeight =
  cardLayout.pad * 2 + cardLayout.statusRow + cardLayout.titleGap + type.cardTitle.lineHeight
  + cardLayout.metaGap + type.caption.lineHeight * 2 + cardLayout.metaLineGap;

/**
 * - poster: cover is 16:10 whether it shows a photo or the fallback; the body's minimum is the one-line-title layout
 *   (longer titles grow the card downward, up to three lines).
 * - row: padding around the 46 px leading tile.
 * - mini: fixed minimum so two cards side by side line up.
 */
export const cardMetrics = {
  poster: { coverAspect: 1.6 as const, bodyMinHeight: posterBodyMinHeight },
  row: { minHeight: cardLayout.pad * 2 + cardLayout.leadingTile },
  mini: { minHeight: 136 as const },
};
