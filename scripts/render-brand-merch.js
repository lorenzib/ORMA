#!/usr/bin/env node
'use strict';

/**
 * render-brand-merch.js, draw the ORMA lettering and logo files used on merch.
 *
 * Writes images/brand/merch/:
 *   - lettering on its own, ORMA and the tagline, in brand dark green and cream;
 *   - the original logo tile beside or above the lettering;
 *   - the logo tile and the paw cut out of it, at 4096 px.
 *
 * Lettering is outlined, so a printer or embroiderer needs no fonts. The fonts
 * are fixed-weight copies of the site's variable fonts (images/brand/fonts),
 * made with fonttools because opentype.js cannot read a variable instance:
 *   fonttools varLib.instancer BricolageGrotesque.ttf wght=700 opsz=96 wdth=100
 *   fonttools varLib.instancer Inter.ttf wght=600 opsz=32
 *
 * The logo itself is the 512px JPEG inside logo.svg, so it is embedded, not
 * traced: tracing it lost the fine contour lines and was worse than enlarging.
 *
 * Usage: node scripts/render-brand-merch.js
 */

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'brand', 'merch');
const FONTS = path.join(ROOT, 'images', 'brand', 'fonts');
const BRICOLAGE = opentype.loadSync(path.join(FONTS, 'BricolageGrotesque-Bold.ttf'));
const INTER = opentype.loadSync(path.join(FONTS, 'Inter-SemiBold.ttf'));

const COLOURS = { green: '#2E4034', light: '#F2EEE2' };
const TAGLINE = 'Dog Trails & Terrain Guide';

const logo = fs.readFileSync(path.join(ROOT, 'logo.svg'), 'utf8');
const embedded = logo.match(/href="(data:image\/[a-z]+;base64,[^"]+)"/);
if (!embedded) throw new Error('logo.svg no longer embeds a raster image; update this script.');
const LOGO = embedded[1];

// The tile clipped inside the JPEG's own rounded edge, which shows as a light rim when enlarged.
const TILE_INSET = 20, TILE_SIZE = 472, TILE_RADIUS = 96;
const tile = (x, y, size) => {
  const k = size / TILE_SIZE;
  return `<g transform="translate(${x} ${y}) scale(${k})">
    <clipPath id="tile"><rect width="${TILE_SIZE}" height="${TILE_SIZE}" rx="${TILE_RADIUS}"/></clipPath>
    <g clip-path="url(#tile)"><image href="${LOGO}" x="${-TILE_INSET}" y="${-TILE_INSET}" width="512" height="512"/></g></g>`;
};

// Each piece is { box: {x1, y1, x2, y2}, body } in font units, ORMA's baseline at y = 0.
const word = () => BRICOLAGE.getPath('ORMA', 0, 0, 300);
// The tagline set at ORMA's width, under it.
function taglineUnder(w) {
  const wb = w.getBoundingBox();
  const probe = INTER.getPath(TAGLINE, 0, 0, 100).getBoundingBox();
  const size = 100 * (wb.x2 - wb.x1) / (probe.x2 - probe.x1);
  const first = INTER.getPath(TAGLINE, 0, 0, size).getBoundingBox();
  return INTER.getPath(TAGLINE, wb.x1 - first.x1, wb.y2 + 48 - first.y1, size);
}
// ORMA | tagline, as in the site header.
function taglineBeside(w, colour) {
  const wb = w.getBoundingBox(), capH = -wb.y1;
  const gap = capH * 0.2, barW = capH * 0.045, barX = wb.x2 + gap;
  const t = INTER.getPath(TAGLINE, barX + barW + gap, 0, capH * 0.42);
  return { t, bar: `<rect x="${barX}" y="${-capH * 0.62}" width="${barW}" height="${capH * 0.62}" fill="${colour}"/>` };
}
const merge = (...boxes) => ({
  x1: Math.min(...boxes.map(b => b.x1)), y1: Math.min(...boxes.map(b => b.y1)),
  x2: Math.max(...boxes.map(b => b.x2)), y2: Math.max(...boxes.map(b => b.y2)),
});
const fill = (colour, ...paths) => `<path fill="${colour}" d="${paths.map(p => p.toPathData(2)).join('')}"/>`;

const PIECES = {
  wordmark(c) {
    const w = word();
    return { box: w.getBoundingBox(), body: fill(c, w) };
  },
  tagline(c) {
    const t = INTER.getPath(TAGLINE, 0, 0, 120);
    return { box: t.getBoundingBox(), body: fill(c, t) };
  },
  'wordmark-tagline-stacked'(c) {
    const w = word(), t = taglineUnder(w);
    return { box: merge(w.getBoundingBox(), t.getBoundingBox()), body: fill(c, w, t) };
  },
  'wordmark-tagline-line'(c) {
    const w = word(), { t, bar } = taglineBeside(w, c);
    return { box: merge(w.getBoundingBox(), t.getBoundingBox()), body: fill(c, w, t) + bar };
  },
  // Logo tile above ORMA and the tagline.
  'logo-stacked'(c) {
    const w = word(), t = taglineUnder(w), wb = w.getBoundingBox();
    const size = 420, x = wb.x1 + (wb.x2 - wb.x1 - size) / 2, y = wb.y1 - 70 - size;
    return { box: merge({ x1: x, y1: y, x2: x + size, y2: y + size }, wb, t.getBoundingBox()), body: tile(x, y, size) + fill(c, w, t) };
  },
  // Logo tile just before ORMA.
  'logo-side'(c) {
    const w = word(), wb = w.getBoundingBox(), capH = -wb.y1;
    const size = capH * 1.55, x = wb.x1 - capH * 0.32 - size, y = -capH / 2 - size / 2;
    return { box: merge({ x1: x, y1: y, x2: x + size, y2: y + size }, wb), body: tile(x, y, size) + fill(c, w) };
  },
  // Logo tile, then ORMA | tagline.
  'logo-side-line'(c) {
    const w = word(), wb = w.getBoundingBox(), capH = -wb.y1, { t, bar } = taglineBeside(w, c);
    const size = capH * 1.55, x = wb.x1 - capH * 0.32 - size, y = -capH / 2 - size / 2;
    return { box: merge({ x1: x, y1: y, x2: x + size, y2: y + size }, wb, t.getBoundingBox()), body: tile(x, y, size) + fill(c, w, t) + bar };
  },
  // Logo tile spanning ORMA and the tagline under it.
  'logo-side-stacked'(c) {
    const w = word(), t = taglineUnder(w), wb = w.getBoundingBox(), tb = t.getBoundingBox();
    const h = tb.y2 - wb.y1, size = h * 1.08, x = wb.x1 - h * 0.2 - size, y = (wb.y1 + tb.y2) / 2 - size / 2;
    return { box: merge({ x1: x, y1: y, x2: x + size, y2: y + size }, wb, tb), body: tile(x, y, size) + fill(c, w, t) };
  },
};

function svg({ box, body }, scale = 1) {
  const pad = 8, w = box.x2 - box.x1 + 2 * pad, h = box.y2 - box.y1 + 2 * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(box.x1 - pad).toFixed(1)} ${(box.y1 - pad).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" ` +
    `width="${Math.round(w * scale)}" height="${Math.round(h * scale)}">${body}</svg>`;
}

// PNG width for each piece, so the files stay usable without being enormous.
const PNG_WIDTH = 3000;

async function renderPieces(page) {
  for (const [name, make] of Object.entries(PIECES)) {
    for (const [tone, colour] of Object.entries(COLOURS)) {
      const piece = make(colour), file = `orma-${name}-${tone}`;
      fs.writeFileSync(path.join(OUT, file + '.svg'), svg(piece) + '\n');
      const scale = PNG_WIDTH / (piece.box.x2 - piece.box.x1 + 16);
      await page.setViewport({ width: PNG_WIDTH + 100, height: 2000 });
      await page.setContent(`<body style="margin:0"><div id="art" style="display:inline-block">${svg(piece, scale)}</div></body>`, { waitUntil: 'load' });
      await (await page.$('#art')).screenshot({ path: path.join(OUT, file + '.png'), omitBackground: true });
      console.log(`wrote images/brand/merch/${file}.svg and .png`);
    }
  }
}

// The tile alone at 4096 px, and the paw cut out of it with the green removed.
// Runs in the page: canvas does the enlarging and the pixel work.
async function renderLogoAndPaw(page) {
  await page.setContent('<canvas id="c"></canvas>');
  const { logoPng, pawPng } = await page.evaluate(async (src, inset, size, radius) => {
    const img = new Image(); img.src = src; await img.decode();
    const N = 4096, k = N / size;
    const c = document.getElementById('c'); c.width = c.height = N;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';

    g.save(); g.beginPath(); g.roundRect(0, 0, N, N, radius * k); g.clip();
    g.drawImage(img, -inset * k, -inset * k, 512 * k, 512 * k); g.restore();
    const logoPng = c.toDataURL('image/png');

    // Only pixels well inside the tile may survive: its soft edge would otherwise read as a line.
    const m = document.createElement('canvas'); m.width = m.height = N;
    const mg = m.getContext('2d'); mg.fillStyle = '#fff';
    mg.beginPath(); mg.roundRect(10 * k, 10 * k, N - 20 * k, N - 20 * k, (radius - 10) * k); mg.fill();
    const keep = mg.getImageData(0, 0, N, N).data;
    // Paint outside it dark so the background fill below takes it too.
    g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, N, N);
    g.roundRect(10 * k, 10 * k, N - 20 * k, N - 20 * k, (radius - 10) * k); g.fill('evenodd');
    const im = g.getImageData(0, 0, N, N), d = im.data;
    const lum = i => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

    // Background: every dark pixel reachable from the edge. The pad's own contour lines are
    // enclosed by its cream outline, so they are never reached.
    const LO = 95, HI = 150, bg = new Uint8Array(N * N), stack = [];
    for (let i = 0; i < N; i++) stack.push(i, (N - 1) * N + i, i * N, i * N + N - 1);
    while (stack.length) {
      const p = stack.pop();
      if (bg[p] || lum(p * 4) >= LO) continue;
      bg[p] = 1;
      const x = p % N;
      if (x > 0) stack.push(p - 1);
      if (x < N - 1) stack.push(p + 1);
      if (p >= N) stack.push(p - N);
      if (p < N * (N - 1)) stack.push(p + N);
    }
    // The contour lines between the toes and the pad are drawn on the background, darker than
    // the green. Keep them as dark strokes whose opacity follows how much darker they are.
    const sample = [];
    for (let p = 0; p < N * N; p += 97) if (bg[p] && keep[p * 4 + 3] === 255) sample.push(lum(p * 4));
    sample.sort((a, b) => a - b);
    const green = sample[Math.floor(sample.length * 0.5)], ink = sample[Math.floor(sample.length * 0.01)];
    let minX = N, minY = N, maxX = 0, maxY = 0;
    for (let p = 0; p < N * N; p++) {
      const i = p * 4, x = p % N, y = (p / N) | 0;
      if (bg[p]) {
        let a = keep[i + 3] === 255 ? (green - lum(i)) / (green - ink) : 0;
        a = Math.min(1, Math.max(0, (a - 0.3) / 0.7)); // ignore JPEG grain in the flat green
        d[i] = 0x1E; d[i + 1] = 0x26; d[i + 2] = 0x21; d[i + 3] = Math.round(255 * a);
      } else if ((x > 0 && bg[p - 1]) || (x < N - 1 && bg[p + 1]) || (y > 0 && bg[p - N]) || (y < N - 1 && bg[p + N])) {
        d[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (lum(i) - LO) / (HI - LO))));
      }
      if (d[i + 3] > 40) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    g.putImageData(im, 0, 0);
    const pad = 48, w = maxX - minX + 1 + 2 * pad, h = maxY - minY + 1 + 2 * pad;
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    o.getContext('2d').drawImage(c, minX - pad, minY - pad, w, h, 0, 0, w, h);
    return { logoPng, pawPng: o.toDataURL('image/png') };
  }, LOGO, TILE_INSET, TILE_SIZE, TILE_RADIUS);
  fs.writeFileSync(path.join(OUT, 'orma-logo-4096.png'), Buffer.from(logoPng.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'orma-paw-4096.png'), Buffer.from(pawPng.split(',')[1], 'base64'));
  console.log('wrote images/brand/merch/orma-logo-4096.png and orma-paw-4096.png');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await renderPieces(page);
    await renderLogoAndPaw(page);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
