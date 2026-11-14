import fs from 'fs';
import path from 'path';
import { colors, semantic, tones } from '../tokens';
import { TEXT_PAIRS, DISABLED_PAIRS, TAG_TONES, NOTICE_TONES, THRESHOLD, audit, auditDark, composite, contrastRatio } from '../contrastAudit';
import { tagTones } from '../components/Chips';
import { noticeTones } from '../components/Surface';

const darkDraft = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../design-source/tokens.json'), 'utf8')).semantic.dark.colors;
const L = semantic.light;

describe('contrastRatio (WCAG 2.x)', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });
  it('is symmetric and composite() blends', () => {
    expect(contrastRatio('#20241F', '#D9F36E')).toBeCloseTo(contrastRatio('#D9F36E', '#20241F'), 10);
    expect(composite('#FFFFFF', '#000000', 0.5)).toBe('#808080');
  });
});

describe('every text/background pair in use (light)', () => {
  it('thresholds: body 4.5, large 3, icon 3', () => expect(THRESHOLD).toEqual({ body: 4.5, large: 3, icon: 3 }));
  it('audits a broad list', () => expect(TEXT_PAIRS.length).toBeGreaterThanOrEqual(80));
  it.each(audit(TEXT_PAIRS).map((r) => [r.usage, r.kind, r.min, r.ratio, r.pass] as const))('%s (%s >= %s): %d', (_u, _k, _m, _r, pass) => {
    expect(pass).toBe(true);
  });
  it('no pair uses Lime or white-on-Lime as text', () => {
    const lime = colors.lime.toLowerCase();
    for (const p of TEXT_PAIRS) {
      // White on lime: never. Lime as foreground: only on an ink/Iris ground and only large.
      expect(p.fg.toLowerCase() === '#ffffff' && [lime, colors.limePressed.toLowerCase()].includes(p.bg.toLowerCase())).toBe(false);
      if (p.fg.toLowerCase() === lime) {
        expect(p.kind).toBe('large');
        expect([tones.ink.bg, colors.primary].map((c) => c.toLowerCase())).toContain(p.bg.toLowerCase());
      }
    }
  });
  it('Ink on Lime (and pressed Lime) meets body text', () => {
    expect(contrastRatio(L.text.onLime, L.action.lime)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(L.text.onLime, L.action.limePressed)).toBeGreaterThanOrEqual(4.5);
  });
  it('documents why Lime is not text on light surfaces', () => {
    expect(contrastRatio(L.action.lime, L.bg.surface)).toBeLessThan(3);
    expect(contrastRatio(L.action.lime, L.bg.canvas)).toBeLessThan(3);
  });
  it('KNOWN LIMIT (recorded, brand colour kept): text.secondary on bg.sunken is below 4.5, so it must not carry text there', () => {
    const r = contrastRatio(L.text.secondary, L.bg.sunken);
    expect(r).toBeLessThan(4.5);
    expect(r).toBeGreaterThanOrEqual(3);
    expect(TEXT_PAIRS.some((p) => p.fg === L.text.secondary && p.bg === L.bg.sunken && p.kind === 'body')).toBe(false);
  });
  it('disabled controls are exempt from AA but their ratio is on record', () => {
    for (const r of audit(DISABLED_PAIRS)) expect(r.ratio).toBeGreaterThan(1);
  });
});

describe('the audit list is derived from what components render (drift guard)', () => {
  it('Tag tones equal Chips.tsx (onDark is audited over the darkest photo)', () => {
    for (const [k, t] of Object.entries(tagTones)) {
      if (k === 'onDark') { expect(t.fg).toBe(TAG_TONES[k]!.fg); continue; }
      expect(TAG_TONES[k]).toEqual(t);
    }
    expect(Object.keys(TAG_TONES).sort()).toEqual(Object.keys(tagTones).sort());
  });
  it('Notice tones equal Surface.tsx', () => {
    for (const [k, t] of Object.entries(noticeTones)) expect(NOTICE_TONES[k]).toEqual({ bg: t.bg, fg: t.fg });
  });
  it('every poster tone and every Tag/Notice tone is in TEXT_PAIRS', () => {
    for (const t of [...Object.values(tones), ...Object.values(TAG_TONES), ...Object.values(NOTICE_TONES)]) {
      expect(TEXT_PAIRS.some((p) => p.fg === t.fg && p.bg === t.bg)).toBe(true);
    }
  });
});

describe('semantic.dark draft (report only: never blocks)', () => {
  it('is audited with the same thresholds and reports a result per semantic pair', () => {
    const rows = auditDark(darkDraft);
    expect(rows.length).toBeGreaterThan(20);
    for (const r of rows) expect(Number.isFinite(r.ratio)).toBe(true);
    // The numbers are printed by `npm run contrast`; nothing here may fail on the draft.
  });
});
