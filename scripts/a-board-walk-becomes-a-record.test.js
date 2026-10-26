'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const {
  ROUTES_FILE, meters, densify, coverage, parseGuide, buildGraph, matchGuide, judge, main,
} = require('./build-board-line');
const { boardEntry } = require('./promote-osm-trails');
const { DEFAULT_FILES } = require('./load-production-trails');

const ROOT = path.resolve(__dirname, '..');

/**
 * Most walks a tourist board publishes are not one OpenStreetMap route: of 30
 * Val di Fassa walks the board marks "dogs accepted", one matched a relation
 * end to end. These are the guarantees that let such a walk in on a line drawn
 * on OSM ways along the operator's own, without storing the operator's line.
 */

// A 9 x 9 grid of paths about 100 m apart near Canazei, in the shape the OSM
// API's map call answers with.
const BASE = [46.470, 11.765];
const STEP_LAT = 0.0009;  // ~100 m
const STEP_LNG = 0.0013;  // ~100 m at this latitude
const nodeId = (i, j) => 1000 + i * 10 + j;
function grid({ surface = 'gravel' } = {}) {
  const elements = [];
  for (let i = 0; i < 9; i += 1) {
    for (let j = 0; j < 9; j += 1) {
      elements.push({ type: 'node', id: nodeId(i, j), lat: BASE[0] + i * STEP_LAT, lon: BASE[1] + j * STEP_LNG });
    }
  }
  let way = 1;
  for (let i = 0; i < 9; i += 1) {
    elements.push({ type: 'way', id: way++, nodes: [...Array(9).keys()].map(j => nodeId(i, j)), tags: { highway: 'path', surface } });
  }
  for (let j = 0; j < 9; j += 1) {
    elements.push({ type: 'way', id: way++, nodes: [...Array(9).keys()].map(i => nodeId(i, j)), tags: { highway: 'track' } });
  }
  return { elements };
}
const at = (i, j, offset = 0) => [BASE[0] + i * STEP_LAT + offset, BASE[1] + j * STEP_LNG];
// Along row 0 to column 8, then up column 8 to row 8: about 1.6 km, drawn a few
// metres off the paths as a GPS track would be.
const GUIDE = [at(0, 0, 0.00004), at(0, 8, 0.00004), at(8, 8, 0.00004)];

function guidePage(line, extra = {}) {
  const ld = {
    '@context': 'http://schema.org',
    '@type': 'TouristTrip',
    author: [{ '@type': 'Organization', name: 'Azienda per il Turismo della Val di Fassa' }],
    itinerary: {
      fromLocation: { '@type': 'Place', name: 'Canazei (Piaz G. Marconi)', geo: { latitude: String(line[0][0]), longitude: String(line[0][1]) } },
      toLocation: { '@type': 'Place', name: 'Canazei', geo: { latitude: String(line.at(-1)[0]), longitude: String(line.at(-1)[1]) } },
    },
    geo: { '@type': 'GeoShape', line: line.map(p => `${p[0]} ${p[1]}`).join(' ') },
    ...extra,
  };
  return `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head></html>`;
}

const ARGS = ['--id', 'fassa-testweg', '--name', 'Testweg', '--operator', 'APT Val di Fassa',
  '--source', 'https://www.fassa.com/it/itinerari/testweg', '--guide', 'https://www.outdooractive.com/it/r/1',
  '--ascent', '20', '--time', '0:30'];
const lengthKm = Math.round(GUIDE.slice(1).reduce((sum, p, i) => sum + meters(GUIDE[i], p), 0) / 100) / 10;
const fetchers = (answer = grid()) => ({
  fetchText: async () => guidePage(GUIDE),
  fetchJson: async () => answer,
  pauseMs: 0,
  log: () => {},
});
const emptyRoutes = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orma-board-')), 'routes.geojson');

describe('the guide is read from the page anyone can open', () => {
  test('its line, its start and end, and who published it', () => {
    const guide = parseGuide(guidePage(GUIDE));
    expect(guide.line).toHaveLength(3);
    expect(guide.line[0]).toEqual(GUIDE[0]);
    expect(guide.start.name).toBe('Canazei (Piaz G. Marconi)');
    expect(guide.author).toBe('Azienda per il Turismo della Val di Fassa');
  });

  test('a page with no published line has no guide', () => {
    expect(parseGuide('<html><script type="application/ld+json">{"@type":"Place"}</script></html>')).toBeNull();
    expect(parseGuide('not a page')).toBeNull();
  });
});

describe('the line is drawn on OSM ways along the guide', () => {
  test('it follows the guide both ways and names the ways it uses', () => {
    const drawn = matchGuide(buildGraph([grid()]), GUIDE);
    expect(drawn.refused).toBeUndefined();
    expect(coverage(densify(GUIDE, 15), drawn.line)).toBeGreaterThanOrEqual(0.95);
    expect(coverage(densify(drawn.line, 15), GUIDE)).toBeGreaterThanOrEqual(0.95);
    // Row 0 (way 1) then column 8 (way 18), and nothing else.
    expect(drawn.ways).toEqual([1, 18]);
    expect(Math.abs(drawn.meters / 1000 - lengthKm)).toBeLessThan(0.05);
  });

  test('an out-and-back keeps its way back', () => {
    // Up column 0 and back down it: every step is a there-and-back, and only
    // a few metres of snapping are a spur.
    const outAndBack = [at(0, 0, 0.00004), at(8, 0, 0.00004), at(0, 0, 0.00004)];
    const drawn = matchGuide(buildGraph([grid()]), outAndBack);
    expect(drawn.refused).toBeUndefined();
    expect(drawn.meters / 1000).toBeGreaterThan(1.5);
    expect(judge(outAndBack, drawn.line, 1.6).keep).toBe(true);
  });

  test('and so does one whose path is mapped in pieces shorter than a snap', () => {
    // One path 1 km long with a node every 20 m: each step back is shorter
    // than a snap, but the way back as a whole is not, so none of it goes.
    const elements = [];
    for (let k = 0; k <= 50; k += 1) elements.push({ type: 'node', id: 5000 + k, lat: BASE[0] + k * 0.00018, lon: BASE[1] });
    elements.push({ type: 'way', id: 900, nodes: [...Array(51).keys()].map(k => 5000 + k), tags: { highway: 'path' } });
    const there = [BASE[0] + 0.00002, BASE[1] + 0.00003];
    const turn = [BASE[0] + 50 * 0.00018, BASE[1] + 0.00003];
    const drawn = matchGuide(buildGraph([{ elements }]), [there, turn, there]);
    expect(drawn.meters / 1000).toBeGreaterThan(1.9);
  });

  test('a side street nearer the guide than the path itself is not walked out and back', () => {
    // A straight path 1 km long with no node between 500 m and 800 m, and a
    // side street from its node at 500 m to a corner 20 m off the guide point
    // at 667 m. The corner is the nearest node to that guide point, but walking
    // to it and back is a 370 m detour no walker takes: Canazei's streets
    // added 1.1 km this way.
    const LAT = 0.0009 / 100;  // one metre north
    const LNG = 0.0013 / 100;  // one metre east
    const elements = [];
    const marks = [0, 100, 200, 300, 400, 500, 800, 900, 1000];
    for (const m of marks) elements.push({ type: 'node', id: 6000 + m, lat: BASE[0] + m * LAT, lon: BASE[1] });
    elements.push({ type: 'node', id: 7001, lat: BASE[0] + 500 * LAT, lon: BASE[1] + 20 * LNG });
    elements.push({ type: 'node', id: 7002, lat: BASE[0] + (2000 / 3) * LAT, lon: BASE[1] + 20 * LNG });
    elements.push({ type: 'way', id: 910, nodes: marks.map(m => 6000 + m), tags: { highway: 'path' } });
    elements.push({ type: 'way', id: 911, nodes: [6500, 7001, 7002], tags: { highway: 'residential' } });
    const guide = [[BASE[0], BASE[1]], [BASE[0] + 1000 * LAT, BASE[1]]];
    const drawn = matchGuide(buildGraph([{ elements }]), guide);
    expect(drawn.meters).toBeLessThan(1050);
    expect(drawn.ways).toEqual([910]);
  });

  test('and nothing drawn is never a walk', () => {
    expect(judge(GUIDE, [], lengthKm)).toMatchObject({ keep: false, reasons: ['nothing was drawn'] });
  });

  test('its surfaces are summed from the ways, so the promoter can describe the ground', () => {
    const drawn = matchGuide(buildGraph([grid()]), GUIDE);
    expect(drawn.surfaces).toEqual({ gravel: 0.8 });
  });

  test('a guide with no OSM path near it cannot be drawn', () => {
    const far = [at(0, 0, -0.002), at(0, 8, -0.002)];   // 220 m south of the grid
    expect(matchGuide(buildGraph([grid()]), far).refused).toMatch(/no OSM path within 50 m of the guide at km 0\.00/);
  });

  test('a motorway is never part of a walk', () => {
    const answer = grid();
    for (const element of answer.elements) if (element.type === 'way') element.tags.highway = 'motorway';
    expect(matchGuide(buildGraph([answer]), GUIDE).refused).toMatch(/no OSM path/);
  });
});

describe('it is refused unless it is the operator’s walk', () => {
  test('a line far longer or shorter than the published distance', () => {
    const drawn = matchGuide(buildGraph([grid()]), GUIDE);
    expect(judge(GUIDE, drawn.line, lengthKm).keep).toBe(true);
    const verdict = judge(GUIDE, drawn.line, lengthKm * 1.3);
    expect(verdict.keep).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/km published/);
  });

  test('a line that leaves the guide', () => {
    const elsewhere = [at(4, 0), at(4, 8)];
    const verdict = judge(GUIDE, elsewhere, lengthKm);
    expect(verdict.keep).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/of the guide is within 25 m/);
  });

  test('and a walk with no published distance', () => {
    expect(judge(GUIDE, GUIDE, NaN).reasons).toContain('no published distance to compare the line with');
  });
});

describe('it adds one walk and nothing else', () => {
  test('a dry run writes nothing', async () => {
    const file = emptyRoutes();
    const result = await main({ argv: [...ARGS, '--km', String(lengthKm)], routesPath: file, ...fetchers() });
    expect(result.status).toBe('dry-run');
    expect(fs.existsSync(file)).toBe(false);
  });

  test('--apply writes the drawn line, the operator’s facts and the ways, not the guide', async () => {
    const file = emptyRoutes();
    await main({ argv: [...ARGS, '--km', String(lengthKm), '--apply'], routesPath: file, ...fetchers() });
    const [feature] = JSON.parse(fs.readFileSync(file, 'utf8')).features;
    expect(feature.properties).toMatchObject({
      trail_id: 'fassa-testweg', name: 'Testweg', operator: 'APT Val di Fassa',
      source_url: 'https://www.fassa.com/it/itinerari/testweg',
      official: { distance_km: lengthKm, ascent_m: 20, time: '0:30' },
      osm_ways: [1, 18], loop: false,
    });
    // The guide's own points are not in the file: every stored point is an
    // OSM node of the drawn line.
    const nodes = new Set(grid().elements.filter(e => e.type === 'node').map(e => `${e.lat.toFixed(6)},${e.lon.toFixed(6)}`));
    for (const [lng, lat] of feature.geometry.coordinates) expect(nodes.has(`${lat.toFixed(6)},${lng.toFixed(6)}`)).toBe(true);
  });

  test('a walk already in the file is left alone', async () => {
    const file = emptyRoutes();
    await main({ argv: [...ARGS, '--km', String(lengthKm), '--apply'], routesPath: file, ...fetchers() });
    const before = fs.readFileSync(file, 'utf8');
    const again = await main({ argv: [...ARGS, '--km', String(lengthKm), '--apply'], routesPath: file, ...fetchers() });
    expect(again.status).toBe('already-present');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });

  test('a refused walk writes nothing', async () => {
    const file = emptyRoutes();
    const result = await main({ argv: [...ARGS, '--km', String(lengthKm * 2), '--apply'], routesPath: file, ...fetchers() });
    expect(result.status).toBe('refused');
    expect(fs.existsSync(file)).toBe(false);
  });

  test('an id is <area>-<slug>, never osm-, and every fact is given', async () => {
    const file = emptyRoutes();
    const withId = id => ARGS.map(a => (a === 'fassa-testweg' ? id : a));
    expect(await main({ argv: [...withId('osm-123'), '--km', '1'], routesPath: file, ...fetchers() })).toBeNull();
    expect(await main({ argv: [...withId('Testweg'), '--km', '1'], routesPath: file, ...fetchers() })).toBeNull();
    expect(await main({ argv: ARGS, routesPath: file, ...fetchers() })).toBeNull();
  });
});

describe('the promoter makes it the same kind of record', () => {
  test('the operator and its page stand where the relation stood', () => {
    const entry = boardEntry({
      trail_id: 'fassa-testweg', name: 'Testweg', operator: 'APT Val di Fassa',
      source_url: 'https://www.fassa.com/it/itinerari/testweg', osm_ways: [1, 18],
    }, {
      pts: [[46.47, 11.77], [46.48, 11.77]], totalKm: 1.1, gain: 20,
      terrain: { text: 'gravel (100%), from OSM surface data' }, rating: { terrainRank: 1, safetyLevel: 'low-risk' },
      elevationProfile: null, waterSources: [], rifugi: [], startLabel: 'Start', isLoop: false,
    });
    expect(entry).toMatchObject({
      id: 'fassa-testweg', source: 'board-line', curated: false, operator: 'APT Val di Fassa', osmWays: 2,
      routeNumberSource: { provider: 'APT Val di Fassa', url: 'https://www.fassa.com/it/itinerari/testweg' },
    });
    expect(entry).not.toHaveProperty('osmRelation');
    expect(entry).not.toHaveProperty('waymarkedtrails');
  });

  test('and keeps the operator’s start and direction', () => {
    // A loop with an access point at its far side: an imported relation would
    // be turned to start there. This one must not be.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orma-board-promote-'));
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.mkdirSync(path.join(tmp, 'data'));
    fs.copyFileSync(path.join(ROOT, 'scripts', 'promote-osm-trails.js'), path.join(tmp, 'scripts', 'promote-osm-trails.js'));
    // The promoter skips walks removed from ORMA, so it reads that list too.
    fs.copyFileSync(path.join(ROOT, 'scripts', 'removed-trails.js'), path.join(tmp, 'scripts', 'removed-trails.js'));
    fs.copyFileSync(path.join(ROOT, 'data', 'removed-trails.json'), path.join(tmp, 'data', 'removed-trails.json'));
    fs.copyFileSync(path.join(ROOT, 'regions-config.js'), path.join(tmp, 'regions-config.js'));
    const empty = JSON.stringify({ type: 'FeatureCollection', features: [] });
    fs.writeFileSync(path.join(tmp, 'water-sources-all-regions.geojson'), empty);
    fs.writeFileSync(path.join(tmp, 'huts-bars-all-regions.geojson'), empty);
    const loop = [at(0, 0), at(0, 8), at(8, 8), at(8, 0), at(0, 0)];
    fs.writeFileSync(path.join(tmp, 'data', 'access-points.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { amenity: 'parking', name: 'Far parking' }, geometry: { type: 'Point', coordinates: [at(8, 8)[1], at(8, 8)[0]] } },
    ] }));
    fs.writeFileSync(path.join(tmp, 'data', 'board-line-routes.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { trail_id: 'fassa-ring', name: 'Ring', operator: 'APT Val di Fassa', source_url: 'https://www.fassa.com/x',
        start_name: 'Piaz', loop: true, surfaces: { gravel: 3.2 }, osm_ways: [1, 18, 9, 10] },
        geometry: { type: 'LineString', coordinates: loop.map(p => [p[1], p[0]]) } },
    ] }));
    // Offline, as the generated-file check runs it: a line this short is
    // sampled at its own points, so those are the heights on file.
    fs.writeFileSync(path.join(tmp, 'data', 'elevation-cache-board.json'), JSON.stringify({
      points: Object.fromEntries(loop.map((p, i) => [`${p[0].toFixed(5)},${p[1].toFixed(5)}`, 1500 + i])),
    }));
    const run = spawnSync(process.execPath, ['scripts/promote-osm-trails.js', '--region', 'board'],
      { cwd: tmp, encoding: 'utf8', env: { ...process.env, ORMA_PROMOTE_OFFLINE: 'true' } });
    expect(run.status).toBe(0);
    const context = { trails: [], window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(tmp, 'board-trails-data.js'), 'utf8'), context);
    const [trail] = context.trails;
    expect(trail.id).toBe('fassa-ring');
    expect(trail.path[0]).toEqual([Math.round(loop[0][0] * 1e5) / 1e5, Math.round(loop[0][1] * 1e5) / 1e5]);
    expect(trail.path[1][1]).toBeGreaterThan(trail.path[0][1]);   // east along row 0 first, as drawn
    expect(trail.startPoint.label).toBe('Piaz (the start APT Val di Fassa publishes)');
  });
});

describe('it reaches every place the catalogue is read from', () => {
  test('the loader, the generated-file check and the promote script', () => {
    expect(DEFAULT_FILES).toContain('board-trails-data.js');
    const check = fs.readFileSync(path.join(ROOT, 'scripts', 'check-generated-artifacts.js'), 'utf8');
    expect(check).toContain("'board-trails-data.js',");
    expect(check).toContain("['scripts/promote-osm-trails.js', '--region', 'board']");
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['promote:trails']).toContain('--region board');
    expect(ROUTES_FILE).toBe(path.join('data', 'board-line-routes.geojson'));
  });
});
