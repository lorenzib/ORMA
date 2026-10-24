#!/usr/bin/env node
'use strict';

// Draws an ORMA illustration for each trail listed in data/trail-illustrations.json
// and records it as the trail's picture in data/trail-image-overrides.json.
//
// A trail gets one when no licensed photograph of it exists, or when the one it
// carried shows somewhere else. The card is drawn only from the trail's own
// data -- its climb profile as contour bands and its route as a line -- in the
// ORMA palette and type, and says "Illustration" on its face.
//
// An illustration is not a photograph. Its imageSourceType is
// 'orma-illustration', which NOT_A_PHOTOGRAPH in
// backoffice/workflows/build-publication-staging.js lists, so it can never
// satisfy the photo check: an illustrated trail stays Reviewed until a real
// photograph is uploaded and reviewed.
//
// Usage: node scripts/render-trail-illustrations.js [--only=<id>]

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { loadProductionTrails } = require('./load-production-trails');

const ROOT = path.resolve(__dirname, '..');
const LIST = path.join(ROOT, 'data', 'trail-illustrations.json');
const OVERRIDES = path.join(ROOT, 'data', 'trail-image-overrides.json');
const OUT_DIR = path.join(ROOT, 'images', 'trails');
const SOURCE_TYPE = 'orma-illustration';

const PINE = '#2E3B31';
const PINE_LIGHT = '#3F5043';
const CREAM = '#F3EDDD';
const PAPER = '#F5F2E8';
const BLUE = '#92AEC9';

const b64 = file => fs.readFileSync(path.join(ROOT, file)).toString('base64');
const FONT_CSS = `@font-face{font-family:'ORMA Display';src:url(data:font/ttf;base64,${b64('images/brand/fonts/BricolageGrotesque-Bold.ttf')})}` +
  `@font-face{font-family:'ORMA Text';src:url(data:font/ttf;base64,${b64('images/brand/fonts/Inter-SemiBold.ttf')})}`;
const ICON = `data:image/png;base64,${b64('images/brand/orma-icon-1024.png')}`;

const escapeXml = value => String(value).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const pathData = points => 'M' + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');

function smooth(points, passes){
  let out = points;
  for(let pass = 0; pass < passes; pass++){
    out = out.map((point, i) => (i === 0 || i === out.length - 1) ? point
      : [(out[i - 1][0] + 2 * point[0] + out[i + 1][0]) / 4, (out[i - 1][1] + 2 * point[1] + out[i + 1][1]) / 4]);
  }
  return out;
}

// Fit the route into a box, keeping its shape (east-west scaled by latitude).
function fitRoute(route, box){
  const lat0 = route.reduce((sum, p) => sum + p[0], 0) / route.length;
  const k = Math.cos(lat0 * Math.PI / 180);
  const xs = route.map(p => p[1] * k), ys = route.map(p => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(box.w / ((maxX - minX) || 1), box.h / ((maxY - minY) || 1));
  const ox = box.x + (box.w - (maxX - minX) * scale) / 2, oy = box.y + (box.h - (maxY - minY) * scale) / 2;
  return route.map((p, i) => [ox + (xs[i] - minX) * scale, oy + (ys[i] - minY) * scale]);
}

// The climb profile across the card; a flat walk is drawn with a gentle rise
// so it still reads as ground rather than a ruled line.
function profileLine(profile, box){
  const elevations = profile.map(p => p.elev);
  const low = Math.min(...elevations), span = Math.max(Math.max(...elevations) - low, 60);
  const lastKm = profile[profile.length - 1].km || 1;
  return smooth(profile.map(p => [box.x + p.km / lastKm * box.w, box.y + box.h - (p.elev - low) / span * box.h]), 1);
}

function cardSvg(trail){
  const ridge = profileLine(trail.elevationProfile, { x: -20, y: 230, w: 1080, h: 220 });
  let bands = '';
  for(let i = 0; i < 12; i++){
    const line = ridge.map(([x, y]) => [x, y + i * 24]);
    bands += `<path d="${pathData(line)} L1060 700 L-20 700 Z" fill="${i % 2 ? PINE : PINE_LIGHT}"/>` +
      `<path d="${pathData(line)}" fill="none" stroke="${CREAM}" stroke-opacity="${(0.8 - i * 0.05).toFixed(2)}" stroke-width="1.6"/>`;
  }
  const route = smooth(fitRoute(trail.path, { x: 760, y: 60, w: 220, h: 150 }), 2);
  const start = route[0];
  const stats = `${trail.distance} km · ${trail.elevation} m climb`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 650" width="1040" height="650">
  <rect width="1040" height="650" fill="${CREAM}"/>${bands}
  <rect x="740" y="40" width="260" height="190" rx="28" fill="${PAPER}" opacity=".96"/>
  <path d="${pathData(route)}" fill="none" stroke="${PINE}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${start[0].toFixed(1)}" cy="${start[1].toFixed(1)}" r="6" fill="${BLUE}" stroke="${PINE}" stroke-width="2"/>
  <rect x="32" y="30" width="136" height="30" rx="15" fill="rgba(46,59,49,.08)"/>
  <text x="100" y="50" text-anchor="middle" font-family="ORMA Text" font-size="12.5" letter-spacing="1.5" fill="${PINE}">ILLUSTRATION</text>
  <image href="${ICON}" x="34" y="560" width="54" height="54"/>
  <text x="100" y="584" font-family="ORMA Display" font-size="22" fill="${CREAM}">ORMA</text>
  <text x="100" y="604" font-family="ORMA Text" font-size="13" fill="${CREAM}" opacity=".8">${escapeXml(stats)}</text>
</svg>`;
}

function overrideFor(trail, image){
  const credit = 'ORMA illustration of this walk, drawn from its route and climb, not a photograph';
  return {
    id: trail.id,
    approvedReviewId: `orma-illustration-${trail.id}`,
    approvedAt: new Date().toISOString().replace(/\.\d+Z$/, '.000Z'),
    fields: {
      imageIcon: image,
      heroImage: image,
      imageAlt: `ORMA illustration of ${trail.name}: its climb drawn as contour bands and its route shape, not a photograph`,
      imageCredit: credit,
      imageCreditText: credit,
      imageCreator: 'ORMA',
      imageLicence: 'ORMA-owned',
      imageSourceType: SOURCE_TYPE,
    },
  };
}

async function main(){
  const only = (process.argv.find(arg => arg.startsWith('--only=')) || '').slice(7);
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8')).trails.filter(entry => !only || entry.id === only);
  const catalogue = new Map(loadProductionTrails(ROOT).map(trail => [trail.id, trail]));
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1040, height: 650, deviceScaleFactor: 1.6 });
    for(const entry of list){
      const trail = catalogue.get(entry.id);
      if(!trail) throw new Error(`${entry.id} is not in the catalogue`);
      if(!Array.isArray(trail.path) || trail.path.length < 2) throw new Error(`${entry.id} has no line to draw`);
      if(!Array.isArray(trail.elevationProfile) || trail.elevationProfile.length < 2) throw new Error(`${entry.id} has no climb profile to draw`);
      // Never on a verified trail: its photograph is part of what was checked.
      if(trail.graduation?.status === 'verified') throw new Error(`${entry.id} is verified; it keeps its photograph`);
      await page.setContent(`<html><head><style>${FONT_CSS}html,body{margin:0}</style></head><body>${cardSvg(trail)}</body></html>`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const image = `images/trails/${trail.id}-orma-illustration.jpg`;
      await page.screenshot({ path: path.join(ROOT, image), type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1040, height: 650 } });
      overrides.trails = overrides.trails.filter(item => item.id !== trail.id).concat(overrideFor(trail, image));
      console.log(`drew ${image} (${entry.reason})`);
    }
  } finally {
    await browser.close();
  }
  overrides.trails.sort((a, b) => a.id.localeCompare(b.id));
  overrides.updatedAt = new Date().toISOString().replace(/\.\d+Z$/, '.000Z');
  fs.writeFileSync(OVERRIDES, `${JSON.stringify(overrides, null, 2)}\n`);
}

if(require.main === module){
  main().catch(error => { console.error(error); process.exit(1); });
}

module.exports = { cardSvg, SOURCE_TYPE };
