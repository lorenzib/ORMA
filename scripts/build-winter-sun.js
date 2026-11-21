#!/usr/bin/env node
'use strict';

// Writes data/winter-sun.json: for every walk, the hours of direct sun the
// terrain allows on 21 December, averaged along its line (scripts/winter-sun.js).
//
//   npm run build:winter-sun                 every walk (downloads tiles once)
//   npm run build:winter-sun -- --only a,b   just these walks, merged into the file
//   npm run build:winter-sun -- --offline    cached tiles only
//
// The file is built by hand, like the other season files, not by the quality
// gate: it needs the terrain tiles, which are not in the repository. A walk
// added later gets its entry with --only.

const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./load-production-trails');
const { walkWinterSun, HORIZON_MAX_M, samplePath } = require('./winter-sun');
const terrain = require('./terrain-tiles');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'winter-sun.json');
const CONTRACT_VERSION = '1.0.0';

function parseArgs(argv){
  const args = { only: null, offline: false };
  for(let i = 0; i < argv.length; i += 1){
    if(argv[i] === '--only') args.only = new Set(String(argv[++i]).split(',').filter(Boolean));
    else if(argv[i] === '--offline') args.offline = true;
    else throw new Error(`Unknown option ${argv[i]}`);
  }
  return args;
}

// The tiles a walk's skyline reads: its sampled points, out to the horizon
// distance in every direction.
function tilesForWalk(trail){
  const points = samplePath(trail.path, 20);
  const lats = points.map(p => p[0]);
  const lngs = points.map(p => p[1]);
  const padLat = HORIZON_MAX_M / 111320;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLng = padLat / Math.cos(midLat * Math.PI / 180);
  return terrain.tilesForBox(Math.min(...lats) - padLat, Math.min(...lngs) - padLng, Math.max(...lats) + padLat, Math.max(...lngs) + padLng);
}

function round(value, places){
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

async function main(argv){
  const args = parseArgs(argv);
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { trails: {} };
  const trails = loadProductionTrails(ROOT).filter(trail => !args.only || args.only.has(trail.id));
  if(args.only && trails.length !== args.only.size) throw new Error(`Unknown walk in --only: ${[...args.only].filter(id => !trails.some(t => t.id === id)).join(', ')}`);

  // Walks near each other share tiles: group by the walk's own tile, and load
  // one group's tiles at a time so memory stays small.
  const groups = new Map();
  for(const trail of trails){
    const [x, y] = terrain.tileXY(trail.path[0][0], trail.path[0][1], 8).map(Math.floor);
    const key = `${x}/${y}`;
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trail);
  }

  const results = { ...(existing.trails || {}) };
  let done = 0;
  for(const [, group] of groups){
    const keys = [...new Set(group.flatMap(tilesForWalk))];
    const tiles = await terrain.loadTiles(keys, { offline: args.offline });
    const heightAt = terrain.heightReader(tiles);
    for(const trail of group){
      const sun = walkWinterSun(trail.path, heightAt);
      if(!sun) throw new Error(`No winter sun for ${trail.id}: no ground heights along its line`);
      results[trail.id] = { hours: sun.hours, noSunShare: round(sun.noSunShare, 2), points: sun.points };
      done += 1;
    }
    process.stdout.write(`\r${done} of ${trails.length} walks`);
  }
  process.stdout.write('\n');

  const known = new Set(loadProductionTrails(ROOT).map(trail => trail.id));
  const sorted = {};
  for(const id of Object.keys(results).sort()) if(known.has(id)) sorted[id] = results[id];
  const artifact = {
    contractVersion: CONTRACT_VERSION,
    note: 'Hours of direct sun the terrain allows on 21 December, averaged over up to 20 points along the walk. Trees, buildings and weather are not counted. Built by npm run build:winter-sun.',
    source: terrain.TERRAIN_SOURCE,
    trails: sorted,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} walks to data/winter-sun.json.`);
}

if(require.main === module){
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { tilesForWalk };
