import fs from 'fs';
import path from 'path';
import { semantic } from '../tokens';

const { dark } = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../design-source/tokens.json'), 'utf8')).semantic;

const lum = (hex: string) => {
  const [r = 0, g = 0, b = 0] = hex.slice(1).match(/../g)!.map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a: string, b: string) => {
  const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
};

const L = semantic.light;
/**
 * Every text/background pair the app uses from the light map. `min` 4.5 = normal text, 3 = large text (>=24 px, or >=18.66 px bold) and UI glyphs.
 * Rule recorded here: Lime is NEVER text on a light background; on light it is a fill carrying Ink text (`text.onLime`). Lime text only on `bg.inverse`.
 */
const PAIRS: [string, string, string, number][] = [
  ['text.primary', L.text.primary, 'bg.canvas', 4.5], ['text.primary', L.text.primary, 'bg.surface', 4.5], ['text.primary', L.text.primary, 'bg.sunken', 4.5],
  ['text.secondary', L.text.secondary, 'bg.canvas', 4.5], ['text.secondary', L.text.secondary, 'bg.surface', 4.5],
  ['text.inverse', L.text.inverse, 'bg.inverse', 4.5], ['text.onInverseAccent', L.text.onInverseAccent, 'bg.inverse', 4.5],
  ['text.onAction', L.text.onAction, 'action.primary', 4.5], ['text.onAction', L.text.onAction, 'action.primaryPressed', 4.5],
  ['text.onLime', L.text.onLime, 'action.lime', 4.5], ['text.onLime', L.text.onLime, 'action.limePressed', 4.5],
  ['action.primary (link text)', L.action.primary, 'bg.surface', 4.5], ['action.primary (link text)', L.action.primary, 'bg.canvas', 4.5],
  ['action.primary', L.action.primary, 'action.primarySoft', 4.5],
  ['status.success', L.status.success, 'status.successSoft', 4.5], ['status.success', L.status.success, 'bg.surface', 4.5],
  ['status.warning', L.status.warning, 'status.warningSoft', 4.5], ['status.warning', L.status.warning, 'bg.surface', 4.5],
  ['status.danger', L.status.danger, 'status.dangerSoft', 4.5], ['status.danger', L.status.danger, 'bg.surface', 4.5],
  ['status.info', L.status.info, 'status.infoSoft', 4.5], ['status.info', L.status.info, 'bg.surface', 4.5],
  ['action.lime (as text)', L.action.lime, 'bg.inverse', 4.5],
];
const resolve = (name: string) => name.split('.').reduce<any>((o, k) => o[k], L);

describe('semantic.light contrast (WCAG AA)', () => {
  it.each(PAIRS)('%s on %s', (fgName, fg, bgName, min) => {
    expect(ratio(fg, resolve(bgName))).toBeGreaterThanOrEqual(min);
  });
  it('KNOWN FAIL (recorded, brand colour kept): text.secondary on bg.sunken is 4.45:1, so secondary text is not allowed on sunken; use text.primary there', () => {
    const r = ratio(L.text.secondary, L.bg.sunken);
    expect(r).toBeLessThan(4.5);
    expect(r).toBeGreaterThanOrEqual(3); // still fine for large text and non-text UI
  });
  it('documents why lime is not text on light: it fails AA there', () => {
    expect(ratio(L.action.lime, L.bg.surface)).toBeLessThan(3);
    expect(ratio(L.action.lime, L.bg.canvas)).toBeLessThan(3);
  });
  it('draft dark map: primary and secondary text meet AA on its surfaces', () => {
    const D = (dark as any).colors;
    for (const bg of [D.bg.canvas, D.bg.surface]) {
      expect(ratio(D.text.primary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(D.text.secondary, bg)).toBeGreaterThanOrEqual(4.5);
      for (const k of ['success', 'warning', 'danger', 'info']) expect(ratio(D.status[k], bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('ratio helper is sane', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });
});
