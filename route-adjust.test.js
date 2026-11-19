'use strict';

// "Adjust this walk" (route-adjust.js) against real catalogue walks: the
// points the planner starts from, how much of a new line stays on the checked
// one, and the record the score engine reads.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.window = global;
require('./data/regions/dolomites-trails.js');
require('./route-return.js');
const adjust = require('./route-adjust.js');

// The score engine as the planner page loads it.
const engine = { console };
engine.window = engine;
engine.globalThis = engine;
vm.createContext(engine);
['breeds-data.js', 'trust/evidence-v1.js', 'scoring/recommendation-v1.js',
  'scoring/recommendation-adapters-v1.js', 'scoring.js'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), engine);
});
const recommend = (record, dog) => vm.runInContext(
  `recommendTrail(${JSON.stringify(record)}, ${dog ? `effectiveOverrides(${JSON.stringify(dog)}, null)` : '{}'})`, engine);
const categoriesOf = record => vm.runInContext(
  `DoloPawsRecommendationAdaptersV1.normalizeTrail(${JSON.stringify(record)}).verification.categories`, engine);

const trails = window.trails;
const byId = id => trails.find(trail => trail.id === id);
const asPoints = path => path.map(([lat, lng]) => ({ lat, lng }));

function metres(a, b){
  const rad = value => value * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// A walk of each shape with a line, taken from the data rather than named, so
// the test keeps working as the catalogue changes.
const loop = trails.find(trail => trail.routeShape === 'loop' && Array.isArray(trail.path) && trail.path.length > 40);
const oneWay = trails.find(trail => trail.routeShape === 'point-to-point' && Array.isArray(trail.path) && trail.path.length > 40);

describe('the points the planner starts from', () => {
  test('a loop: inside the planner limit, on the walk, the end left to the planner', () => {
    const seeded = adjust.seed(loop);
    expect(seeded.shape).toBe('loop');
    expect(seeded.points.length).toBeGreaterThanOrEqual(3);
    expect(seeded.points.length).toBeLessThanOrEqual(adjust.MAX_SEED_POINTS);
    const line = asPoints(loop.path);
    seeded.points.forEach(point => {
      expect(Math.min(...line.map(other => metres(point, other)))).toBeLessThan(1);
    });
    expect(seeded.points[0]).toEqual(line[0]);
    // The planner closes the loop itself, so the start is not repeated.
    expect(metres(seeded.points[seeded.points.length - 1], line[0])).toBeGreaterThan(50);
  });

  test('a one-way walk keeps both its ends', () => {
    const seeded = adjust.seed(oneWay);
    const line = asPoints(oneWay.path);
    expect(seeded.shape).toBe('point-to-point');
    expect(seeded.points[0]).toEqual(line[0]);
    expect(seeded.points[seeded.points.length - 1]).toEqual(line[line.length - 1]);
  });

  test('an out-and-back stored there and back is sampled on the way out only', () => {
    const out = [[46.50, 11.80], [46.505, 11.805], [46.51, 11.81], [46.515, 11.815]];
    const trail = { id:'x', routeShape:'out-and-back', path:out.concat(out.slice(0, -1).reverse()) };
    const seeded = adjust.seed(trail);
    expect(seeded.shape).toBe('out-and-back');
    expect(seeded.points[seeded.points.length - 1]).toEqual({ lat:46.515, lng:11.815 });
  });

  test('a walk with no line has nothing to start from', () => {
    expect(adjust.seed({ id:'x', path:[] })).toBeNull();
  });
});

describe('how much of the new line is the checked walk', () => {
  test('the walk itself is all on its line', () => {
    const result = adjust.compare(loop.path, loop.path);
    expect(result.share).toBeGreaterThan(0.99);
    expect(result.offLines).toEqual([]);
  });

  test('a detour away from the walk is counted off it and drawn apart', () => {
    const line = loop.path;
    const mid = Math.floor(line.length / 2);
    const [lat, lng] = line[mid];
    // Out 600 m to the north and back again, in the middle of the walk.
    const detour = line.slice(0, mid + 1).concat([[lat + 0.0054, lng], [lat, lng]], line.slice(mid + 1));
    const result = adjust.compare(detour, line);
    expect(result.share).toBeLessThan(0.99);
    expect(result.share).toBeGreaterThan(0.5);
    expect(result.offLines).toHaveLength(1);
    expect(result.totalM - result.onM).toBeGreaterThan(1000);
  });

  test('a straight cut across the walk is not counted on it because its ends are', () => {
    const line = [[46.5, 11.8], [46.51, 11.8], [46.51, 11.81], [46.5, 11.81]];
    const cut = [[46.5, 11.8], [46.51, 11.81]];
    expect(adjust.compare(cut, line).share).toBeLessThan(0.1);
  });
});

describe('the record the engine scores', () => {
  const route = trail => ({
    path:asPoints(trail.path),
    distanceM:trail.distance * 1000,
    ascentM:trail.elevation,
    shape:'loop',
    heights:trail.path.map((unused, index) => 1500 + (index % 10)),
  });

  test('carries the walk’s facts, never its review, and measures its own line', () => {
    const comparison = adjust.compare(loop.path, loop.path);
    const record = adjust.scoringRecord(loop, route(loop), comparison);
    expect(record.id).toBe(`custom-${loop.id}`);
    expect(record.distance).toBeCloseTo(loop.distance, 1);
    expect(record.elevation).toBe(loop.elevation);
    expect(record.heatRisk).toBe(loop.heatRisk);
    expect(record.surfaceHazards).toEqual(loop.surfaceHazards);
    expect(record.verified).toBeUndefined();
    expect(record.graduation).toBeUndefined();
    expect(record.curated).toBe(false);
    expect(record.elevationProfile.length).toBeGreaterThan(1);
    expect(Number.isFinite(record.hours)).toBe(true);
  });

  test('the engine scores it, with nothing reviewed', () => {
    const comparison = adjust.compare(loop.path, loop.path);
    const record = adjust.scoringRecord(loop, route(loop), comparison);
    const result = recommend(record);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(Object.values(categoriesOf(record))).not.toContain('verified');
    // The walk itself, with its review, is not scored lower for having one.
    expect(Object.values(categoriesOf(loop)).length).toBeGreaterThan(0);
  });

  test('a longer walk with the same facts scores no better', () => {
    const comparison = { share:0.8, offLines:[], totalM:0, onM:0 };
    const short = adjust.scoringRecord(loop, route(loop), comparison);
    const long = adjust.scoringRecord(loop, { ...route(loop), distanceM:loop.distance * 3000, ascentM:loop.elevation * 3 }, comparison);
    const dog = { name:'Pip', weightBand:'5-10', fitness:'low', conditions:[] };
    expect(recommend(long, dog).score).toBeLessThan(recommend(short, dog).score);
  });

  test('below half on the checked line there is no score', () => {
    expect(adjust.scoringRecord(loop, route(loop), { share:0.49, offLines:[] })).toBeNull();
    expect(adjust.scoringRecord(loop, route(loop), { share:0.5, offLines:[] })).not.toBeNull();
  });

  test('water stays only where the new line still passes it', () => {
    const line = [[46.5, 11.8], [46.5, 11.81], [46.5, 11.82]];
    const trail = { id:'w', path:line, waterSources:[{ km:0.1, label:'start' }, { km:1.4, label:'far end' }] };
    const half = { path:asPoints(line.slice(0, 2)), distanceM:800, ascentM:10, shape:'point-to-point' };
    const record = adjust.scoringRecord(trail, half, { share:1, offLines:[] });
    expect(record.waterSources.map(water => water.label)).toEqual(['start']);
  });
});

describe('the height profile', () => {
  test('is in steps the engine reads, from start to end', () => {
    const path = asPoints(loop.path);
    const heights = path.map((unused, index) => 1000 + index);
    const profile = adjust.profileOf(path, heights);
    expect(profile[0]).toEqual({ km:0, elev:1000 });
    expect(profile[profile.length - 1].elev).toBe(1000 + path.length - 1);
    // Every step but the last, which ends where the line ends.
    for(let i = 1; i < profile.length - 1; i++) expect(profile[i].km - profile[i - 1].km).toBeGreaterThanOrEqual(0.3);
  });

  test('is empty without a height for every point', () => {
    expect(adjust.profileOf(asPoints(loop.path), [1, 2])).toEqual([]);
  });
});
