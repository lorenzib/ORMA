#!/usr/bin/env node
'use strict';

/**
 * render-brand-logos.js, draw the ORMA logo files used for marketing.
 *
 * logo.svg is not vector artwork: it wraps a single 512px JPEG of the
 * topographic paw. This script lifts that picture out of logo.svg, so the
 * marketing files follow any change to the site logo, and sets the wordmark
 * beside it in the site's own type (Bricolage Grotesque and Inter, from the
 * licensed TTFs already in the repo) and the topnav colours.
 *
 * The paw stays a 512px source however large it is drawn here. It looks right
 * on screens, slides and small print; a poster needs the paw redrawn as vector.
 *
 * Usage: node scripts/render-brand-logos.js   (writes images/brand/*.png)
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'brand');
const FONTS = path.join(ROOT, 'images', 'social', 'instagram', 'welcome-to-orma', 'fonts');

const logo = fs.readFileSync(path.join(ROOT, 'logo.svg'), 'utf8');
const embedded = logo.match(/href="(data:image\/[a-z]+;base64,[^"]+)"/);
if (!embedded) throw new Error('logo.svg no longer embeds a raster image; update this script.');
const PAW = embedded[1];

const fontFace = (family, file) => `@font-face{font-family:'${family}';` +
  `src:url(data:font/ttf;base64,${fs.readFileSync(path.join(FONTS, file)).toString('base64')}) format('truetype');` +
  'font-weight:100 900}';
const FONT_CSS = fontFace('Bricolage Grotesque', 'BricolageGrotesque.ttf') + fontFace('Inter', 'Inter.ttf');

// Clipped tighter than logo.svg's own 6px inset: at marketing sizes the JPEG's
// cream corner shows as a sliver against a dark background.
const tile = px => `<svg width="${px}" height="${px}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">` +
  '<defs><clipPath id="t"><rect x="14" y="14" width="484" height="484" rx="92"/></clipPath></defs>' +
  `<image href="${PAW}" width="512" height="512" clip-path="url(#t)"/></svg>`;

const lockup = (bg, name, tag, divider) => `
  <div style="display:inline-flex;align-items:center;gap:56px;padding:80px 96px;background:${bg}">
    ${tile(220)}
    <div style="display:flex;align-items:baseline;gap:36px">
      <span style="font:600 168px/1 'Bricolage Grotesque',sans-serif;color:${name};letter-spacing:-.01em">ORMA</span>
      <span style="font:600 50px/1.2 'Inter',sans-serif;color:${tag};letter-spacing:.015em"><span style="color:${divider}">|</span>&nbsp; Dog Trails &amp; Terrain Guide</span>
    </div>
  </div>`;

const stacked = (bg, name, tag) => `
  <div style="display:inline-flex;flex-direction:column;align-items:center;gap:40px;padding:96px 120px;background:${bg}">
    ${tile(360)}
    <span style="font:600 190px/1 'Bricolage Grotesque',sans-serif;color:${name};letter-spacing:-.01em">ORMA</span>
    <span style="font:600 52px/1 'Inter',sans-serif;color:${tag};letter-spacing:.015em;margin-top:-8px">Dog Trails &amp; Terrain Guide</span>
  </div>`;

// Topnav background, wordmark and tagline colours on dark; --ink and --ink-soft on cream.
const DARK = ['#26352A', '#F2EEE2', '#DCE1D4', '#8FA08F'];
const LIGHT = ['#F6F2E7', '#2E4034', '#59695D', '#A8B2A6'];

const FILES = [
  ['orma-icon-2048.png', tile(512), 4],
  ['orma-icon-1024.png', tile(512), 2],
  ['orma-lockup-dark.png', lockup(...DARK), 2],
  ['orma-lockup-light.png', lockup(...LIGHT), 2],
  ['orma-lockup-transparent.png', lockup('transparent', ...LIGHT.slice(1)), 2],
  ['orma-stacked-dark.png', stacked(...DARK.slice(0, 3)), 2],
  ['orma-stacked-light.png', stacked(...LIGHT.slice(0, 3)), 2],
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    for (const [file, body, scale] of FILES) {
      await page.setViewport({ width: 3000, height: 1600, deviceScaleFactor: scale });
      await page.setContent(`<html><head><style>${FONT_CSS}html,body{margin:0;background:transparent}</style></head>` +
        `<body><div id="art" style="display:inline-block">${body}</div></body></html>`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const art = await page.$('#art');
      await art.screenshot({ path: path.join(OUT, file), omitBackground: true });
      console.log(`wrote images/brand/${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
