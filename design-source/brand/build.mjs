#!/usr/bin/env node
// TechApp emblem: one geometry → every platform asset. Run: node design-source/brand/build.mjs
// The mark is the "T." of the wordmark drawn as an OPEN CIRCUIT: bar and stem never touch; the lime node is the point that
// closes it ("Bir fikrin varsa, bir yerin var"). Pure geometry, no font, so it renders identically everywhere.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const sharp = createRequire(join(root, 'apps/web/'))('sharp'); // sharp ships with Next in apps/web
// Colours mirror design-source/tokens.json.
const IRIS = '#4B46D6', LIME = '#D9F36E', INK = '#20241F', WHITE = '#FFFFFF';

/** Glyph on a 1024 grid, optically centred. `scale` keeps it inside each platform's safe zone. */
const glyph = (bar, node, scale) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">`
  + `<rect x="269" y="262" width="480" height="132" rx="36" fill="${bar}"/><rect x="443" y="428" width="132" height="334" rx="36" fill="${bar}"/>`
  + `<circle cx="689" cy="696" r="66" fill="${node}"/></g>`;
const svg = (inner, size = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}" role="img" aria-label="TechApp">${inner}</svg>`;
const ground = (fill, rx = 0) => `<rect width="1024" height="1024" rx="${rx}" fill="${fill}"/>`;

const art = {
  full: svg(ground(IRIS) + glyph(WHITE, LIME, 1.12)),               // iOS / store: full bleed, the OS applies the mask
  tile: svg(ground(IRIS, 229) + glyph(WHITE, LIME, 1.12)),          // self-masked tile: favicons, splash, documents
  tileInk: svg(ground(INK, 229) + glyph(LIME, '#8B87FF', 1.12)),    // dark alternative for print / merchandise
  foreground: svg(glyph(WHITE, LIME, 0.8)),                         // Android adaptive: content inside the 66% safe zone
  monochrome: svg(glyph(WHITE, WHITE, 0.8)),                        // Android themed icon: single colour, alpha only
  background: svg(ground(IRIS)),
  markIris: svg(glyph(IRIS, INK, 1.4)),                             // glyph alone on light grounds
  markWhite: svg(glyph(WHITE, LIME, 1.4)),                          // glyph alone on iris / ink / photography
};

const out = (p) => { const f = join(root, p); mkdirSync(dirname(f), { recursive: true }); return f; };
const png = (name, file, size, flatten) => { let img = sharp(Buffer.from(art[name]), { density: 300 }).resize(size, size); if (flatten) img = img.flatten({ background: flatten }); return img.png({ compressionLevel: 9 }).toFile(out(file)); };

for (const [name, source] of Object.entries(art)) writeFileSync(out(`design-source/brand/techapp-${name}.svg`), source + '\n');
writeFileSync(out('apps/web/app/icon.svg'), art.tile + '\n');
writeFileSync(out('apps/admin/public/favicon.svg'), art.tile + '\n');
await Promise.all([
  png('full', 'apps/mobile/assets/icon.png', 1024, IRIS),                      // no alpha: App Store rejects transparent icons
  png('foreground', 'apps/mobile/assets/android-icon-foreground.png', 1024),
  png('background', 'apps/mobile/assets/android-icon-background.png', 1024, IRIS),
  png('monochrome', 'apps/mobile/assets/android-icon-monochrome.png', 1024),
  png('tile', 'apps/mobile/assets/splash-icon.png', 640),
  png('tile', 'apps/mobile/assets/favicon.png', 96),
  png('full', 'apps/web/app/apple-icon.png', 180, IRIS),
  png('full', 'design-source/brand/store-icon-1024.png', 1024, IRIS),
  png('full', 'design-source/brand/play-icon-512.png', 512, IRIS),
]);
console.log('emblem assets written');
