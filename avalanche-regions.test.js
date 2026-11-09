'use strict';

// data/trail-avalanche-regions.json joins each walk to the avalanche bulletin's
// small areas its line crosses. A walk added after it was last built has no
// entry, and the hazard watch would then never put a bulletin on it. Every
// walk in a province a bulletin covers must be in it; when this fails, run
// npm run build:avalanche-regions.

const path = require('path');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { CONNECTORS } = require('./backoffice/workflows/hazard-sources');
const artifact = require('./data/trail-avalanche-regions.json');

const COVERED_PROVINCES = ['alto-adige', 'trentino', 'belluno'];
const trails = loadProductionTrails(path.resolve(__dirname));

test('every walk in South Tyrol, Trentino and Belluno is joined to its avalanche areas', () => {
  const missing = trails.filter(trail => COVERED_PROVINCES.includes(trail.province) && !artifact.trails[trail.id]).map(trail => trail.id);
  expect(missing).toEqual([]);
});

test('every entry is a walk on the site, with areas and a high point', () => {
  const ids = new Set(trails.map(trail => trail.id));
  for(const [id, entry] of Object.entries(artifact.trails)){
    expect(ids.has(id)).toBe(true);
    expect(entry.regions.length).toBeGreaterThan(0);
    expect(entry.highPoint).toBeGreaterThan(0);
  }
});

test('the areas are the ones the hazard watch reads bulletins for', () => {
  const read = CONNECTORS.filter(connector => connector.kind === 'avalanche-bulletin').flatMap(connector => connector.areas);
  expect(artifact.bulletinAreas).toEqual(read);
  for(const entry of Object.values(artifact.trails)){
    for(const region of entry.regions) expect(read.some(area => region.startsWith(`${area}-`))).toBe(true);
  }
});
