import fs from 'fs';
import path from 'path';
import { colors, elevation, radius, semantic, tones } from '../tokens';
import { elevationStyle } from '../elevation';
import { Platform } from 'react-native';
import { noticeTones } from '../components/Surface';

const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../design-source/tokens.json'), 'utf8'));

describe('tokens.ts mirrors design-source/tokens.json', () => {
  it('raw colours and radii match', () => {
    const c = json.color;
    expect(colors).toMatchObject({
      primary: c.primary, primaryPressed: c.primaryPressed, primarySoft: c.primarySoft, lime: c.lime, ink: c.ink, textSecondary: c.secondaryText,
      canvas: c.canvas, surface: c.surface, border: c.border, moss: c.teal, mossSoft: c.tealSoft, apricot: c.coral, danger: c.danger, dangerSoft: c.dangerSoft,
      limePressed: c.limePressed, dangerSoftPressed: c.dangerSoftPressed, onDarkChip: c.onDarkChip, irisMuted: c.irisMuted,
    });
    expect(radius).toMatchObject({ control: json.radius.control, card: json.radius.card, hero: json.radius.hero, pill: json.radius.pill });
    expect(elevation).toEqual(json.elevation);
  });
  it('semantic.light matches', () => {
    expect(semantic.light).toEqual(json.semantic.light);
  });
  it('semantic.dark is a draft and is not exported to the app', () => {
    expect(json.semantic.dark.status).toBe('draft');
    expect((semantic as Record<string, unknown>).dark).toBeUndefined();
  });
  it('irisMuted is Iris mixed 20-35% toward white (derived, not invented)', () => {
    const iris = [0x4b, 0x46, 0xd6], hex = colors.irisMuted.slice(1).match(/../g)!.map((h) => parseInt(h, 16));
    const t = iris.map((v, i) => ((hex[i] ?? 0) - v) / (255 - v));
    t.forEach((x) => { expect(x).toBeGreaterThan(0.2); expect(x).toBeLessThan(0.35); });
  });
});

describe('notice tones', () => {
  it('use token colours and meaning-correct icons', () => {
    expect(noticeTones.danger.icon).toBe('error');
    expect(noticeTones.warning.icon).toBe('warning');
    expect(noticeTones.warning.fg).toBe(tones.apricot.fg);
    expect(noticeTones.info.fg).toBe(semantic.light.status.info);
  });
});

describe('elevationStyle', () => {
  afterEach(() => jest.restoreAllMocks());
  it('maps one level to Android elevation and to an iOS/web shadow', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(elevationStyle('sheet')).toEqual({ elevation: 8 });
    expect(elevationStyle('none')).toEqual({ elevation: 0 });
    jest.replaceProperty(Platform, 'OS', 'ios');
    const raised = elevationStyle('raised'), sheet = elevationStyle('sheet');
    expect(raised.elevation).toBeUndefined();
    expect(sheet.shadowRadius as number).toBeGreaterThan(raised.shadowRadius as number);
    expect(elevationStyle('none')).toEqual({});
  });
});
