const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadProductionTrails } = require('./scripts/load-production-trails');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

function loadRegionalTrailFile(file) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read(file), context, { filename: file });
  return JSON.parse(JSON.stringify(context.window.trails));
}

function loadRegionalLiftFile(file) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read(file), context, { filename: file });
  return JSON.parse(JSON.stringify(context.window.gondolas));
}

function loadTrailDetailFile(file) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read(file), context, { filename: file });
  return JSON.parse(JSON.stringify(context.window.trails));
}

function loadCanonicalTrails() {
  return loadProductionTrails(root);
}

describe('DATA-03 regional runtime boundaries', () => {
  const manifest = json('data/regions-manifest.json');

  test('manifest maps every published trail to exactly one regional payload', () => {
    const canonical = loadCanonicalTrails();
    const dolomites = loadRegionalTrailFile('data/regions/dolomites-trails.js');
    const savoy = loadRegionalTrailFile('data/regions/savoy-trails.js');
    const ids = [...dolomites, ...savoy].map(trail => trail.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(dolomites).toHaveLength(manifest.regions.dolomites.trailCount);
    expect(savoy).toHaveLength(manifest.regions.savoy.trailCount);
    expect(Object.keys(manifest.trailRegion)).toHaveLength(ids.length);
    expect(new Set(ids)).toEqual(new Set(canonical.map(trail => trail.id)));
    expect(dolomites.every(trail => trail.region === 'dolomites')).toBe(true);
    expect(savoy.every(trail => trail.region === 'savoy')).toBe(true);
  });

  test('each region owns separate trail, water, amenity and dog-route assets', () => {
    for (const region of ['dolomites', 'savoy']) {
      const entry = manifest.regions[region];
      expect(entry.trails).toContain(`${region}-trails.js`);
      expect(entry.water).toContain(`${region}-water.geojson`);
      expect(entry.hutsBars).toContain(`${region}-huts-bars.geojson`);
      expect(entry.dogRoutes).toMatch(/dog-friendly-routes/);
      [entry.trails, entry.water, entry.hutsBars, entry.dogRoutes].forEach(file => {
        expect(fs.existsSync(path.join(root, file.split('?')[0]))).toBe(true);
      });
    }
  });

  test('detail pages can load a single published trail before the regional catalogue', () => {
    for (const region of ['dolomites', 'savoy']) {
      const entry = manifest.regions[region];
      const detailEntries = Object.entries(entry.details || {});
      expect(detailEntries).toHaveLength(entry.trailCount);
      detailEntries.forEach(([trailId, file]) => {
        expect(fs.existsSync(path.join(root, file.split('?')[0]))).toBe(true);
        const payload = loadTrailDetailFile(file.split('?')[0]);
        expect(payload).toHaveLength(1);
        expect(payload[0].id).toBe(trailId);
      });
    }
  });

  test('regional trail payloads include the lift lines and station endpoints used by maps', () => {
    const dolomites = loadRegionalLiftFile('data/regions/dolomites-trails.js');
    const savoy = loadRegionalLiftFile('data/regions/savoy-trails.js');
    expect(dolomites.length).toBeGreaterThan(0);
    expect(savoy.length).toBeGreaterThan(0);
    expect(dolomites.every(lift => lift.from.lng >= 9 && lift.to.lng >= 9)).toBe(true);
    expect(savoy.every(lift => lift.from.lng < 9 && lift.to.lng < 9)).toBe(true);
    [...dolomites, ...savoy].forEach(lift => {
      expect(lift.from).toEqual(expect.objectContaining({ lat:expect.any(Number), lng:expect.any(Number) }));
      expect(lift.to).toEqual(expect.objectContaining({ lat:expect.any(Number), lng:expect.any(Number) }));
    });
  });

  test('scoped route-reference verification reaches the regional trail payload without verifying the whole trail', () => {
    const trail = loadRegionalTrailFile('data/regions/dolomites-trails.js')
      .find(item => item.id === 'osm-9511973');
    expect(trail.ormaVerified).not.toBe(true);
    expect(trail.routeRefSegments).toEqual(expect.arrayContaining([
      expect.objectContaining({ ref:'15A', path:expect.any(Array) }),
    ]));
    expect(trail.routeRefSegments[0].source).toEqual(expect.objectContaining({
      url:'https://api.openstreetmap.org/api/0.6/relation/9511973/full',
      checkedAt:'2026-09-01',
    }));
  });

  test('homepage and detail page load one region while catalog surfaces may request all', () => {
    expect(read('index.html')).toContain('data-default-region="dolomites"');
    expect(read('trail.html')).toContain('data-default-region="trail"');
    expect(read('browse-trails.html')).toContain('data-default-region="all"');
    expect(read('index.html')).not.toContain('osm-trails-savoy-data.js');
    expect(read('trail.html')).not.toContain('osm-trails-savoy-data.js');
  });

  test('runtime POI consumers request the selected regional asset', () => {
    expect(read('script.js')).toContain("DoloPawsRegionalData.poiUrl(activeRegion, 'water')");
    expect(read('script.js')).toContain("DoloPawsRegionalData.poiUrl(activeRegion, 'huts-bars')");
    expect(read('detail-pois.js')).toContain("regionalPoiUrl('water')");
    expect(read('detail-pois.js')).toContain("regionalPoiUrl('huts-bars')");
    expect(read('dog-routes-layer.js')).toContain("poiUrl(activeRegion, 'dog-routes')");
  });

  test('background route overlays do not open third-party route popups', () => {
    const layer = read('dog-routes-layer.js');
    expect(layer).toContain("id: 'dog-routes-line'");
    expect(layer).not.toContain("map.on('click', 'dog-routes-line'");
    expect(layer).not.toContain('View on Waymarked Trails');
    expect(layer).not.toContain('new maplibregl.Popup');
  });

  test('static generation still reads the complete canonical source catalog', () => {
    const generator = read('scripts/generate-trail-pages.js');
    const loader = read('scripts/load-production-trails.js');
    expect(generator).toContain("require('./load-production-trails')");
    expect(generator).toContain('loadProductionTrails(ROOT)');
    ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js']
      .forEach(file => expect(loader).toContain(`'${file}'`));
  });
});
