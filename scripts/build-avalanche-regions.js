#!/usr/bin/env node
'use strict';

// Writes data/trail-avalanche-regions.json: for every walk inside an area an
// avalanche bulletin covers, the bulletin's small areas ("micro-regions") its
// line passes through, and the walk's high point. The hazard watch reads it to
// put a bulletin's danger on the walks in that area, at the walk's own height.
//
//   node scripts/build-avalanche-regions.js            fetch what the cache lacks
//   node scripts/build-avalanche-regions.js --offline  use the cache only
//
// The outlines are the EAWS micro-regions (CC0, regions.avalanches.org), cached
// in ~/.cache/orma/avalanche-regions.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadProductionTrails } = require('./load-production-trails');

const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'data', 'trail-avalanche-regions.json');
const cacheDir = process.env.AVALANCHE_REGIONS_CACHE || path.join(os.homedir(), '.cache', 'orma', 'avalanche-regions');
const offline = process.argv.includes('--offline');

// The areas whose bulletins the hazard watch reads, from the connectors
// themselves so the two cannot drift apart.
const { CONNECTORS } = require('../backoffice/workflows/hazard-sources');
const BULLETIN_AREAS = CONNECTORS.filter(c => c.kind === 'avalanche-bulletin').flatMap(c => c.areas);
const outlineUrl = area => `https://regions.avalanches.org/micro-regions/${area}_micro-regions.geojson.json`;

async function loadOutlines(area){
  const file = path.join(cacheDir, `${area}.geojson.json`);
  if(fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if(offline) throw new Error(`Outlines for ${area} are not cached; run without --offline`);
  const response = await fetch(outlineUrl(area), { headers: { 'User-Agent': 'ORMA/1.0 (https://www.app-orma.com; avalanche regions)' } });
  if(!response.ok) throw new Error(`Outlines for ${area}: HTTP ${response.status}`);
  const text = await response.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, text);
  return JSON.parse(text);
}

// Rings in [lng, lat], as GeoJSON has them.
function insideRing(lng, lat, ring){
  let inside = false;
  for(let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1){
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insidePolygon(lng, lat, polygon){
  return insideRing(lng, lat, polygon[0]) && !polygon.slice(1).some(hole => insideRing(lng, lat, hole));
}

function regionIndex(collections){
  const regions = [];
  for(const collection of collections){
    for(const feature of collection.features || []){
      const id = feature.properties && feature.properties.id;
      const geometry = feature.geometry;
      if(!id || !geometry) continue;
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
      const points = polygons.flat(2);
      const box = points.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
      regions.push({ id, polygons, box });
    }
  }
  return regions;
}

function regionsAlong(index, line){
  const found = new Set();
  // Every point would be thousands of tests per walk; one in five still lands
  // within a few hundred metres of any boundary the line crosses.
  const step = Math.max(1, Math.floor(line.length / 200));
  for(let i = 0; i < line.length; i += step){
    const [lat, lng] = line[i];
    for(const region of index){
      if(lng < region.box[0] || lng > region.box[2] || lat < region.box[1] || lat > region.box[3]) continue;
      if(region.polygons.some(polygon => insidePolygon(lng, lat, polygon))) found.add(region.id);
    }
  }
  return [...found].sort();
}

async function main(){
  const index = regionIndex(await Promise.all(BULLETIN_AREAS.map(loadOutlines)));
  const trails = loadProductionTrails(root).filter(t => Array.isArray(t.path) && t.path.length > 1);
  const out = {};
  for(const trail of trails){
    const regions = regionsAlong(index, trail.path);
    if(!regions.length) continue;
    const highPoint = trail.season && trail.season.highPoint;
    if(!highPoint) throw new Error(`${trail.id} has no high point in data/trail-seasons.json; run npm run build:trail-seasons`);
    out[trail.id] = { regions, highPoint };
  }
  const artifact = {
    contractVersion: 'trail-avalanche-regions-v1',
    note: 'For each walk inside an area an avalanche bulletin covers: the bulletin micro-regions its line passes through, and its high point in metres. Outlines: EAWS micro-regions (CC0, https://regions.avalanches.org). Written by npm run build:avalanche-regions.',
    bulletinAreas: BULLETIN_AREAS,
    trails: Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${Object.keys(out).length} of ${trails.length} walks lie in an avalanche bulletin area (${index.length} micro-regions).`);
}

if(require.main === module){
  main().catch(error => { console.error(error); process.exit(1); });
}

module.exports = { regionIndex, regionsAlong, insidePolygon, BULLETIN_AREAS };
