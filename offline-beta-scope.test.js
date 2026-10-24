const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const offlineElevation = require('./offline-elevation.js');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { isVerified, PILOT_IDS } = require('./scripts/build-offline-packages');

const root = __dirname;
const packagesDir = path.join(root, 'offline', 'packages');

function registeredNames(){
  const source = fs.readFileSync(path.join(root, 'offline-packages.js'), 'utf8');
  const block = source.match(/\/\/ <offline-package-registry>\n {2}const PACKAGE_NAMES = \{\n([\s\S]*?)\n {2}\};\n {2}\/\/ <\/offline-package-registry>/);
  if(!block) throw new Error('offline-packages.js has no generated package registry');
  return Object.fromEntries([...block[1].matchAll(/^ {4}'([a-z0-9-]+)': (".*"),$/gm)]
    .map(match => [match[1], JSON.parse(match[2])]));
}

function packageIds(){
  return fs.readdirSync(packagesDir, { withFileTypes:true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

const manifests = Object.fromEntries(packageIds().map(id => [id,
  JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'manifest.json'), 'utf8'))]));

describe('controlled offline beta scope (OFF-07)', () => {
  test('the download list is exactly the packages that exist', () => {
    const names = registeredNames();
    expect(Object.keys(names).sort()).toEqual(packageIds());
    for(const [id, name] of Object.entries(names)) expect(manifests[id].name).toBe(name);
  });

  test('the two pilots stay in the beta', () => {
    for(const id of PILOT_IDS) expect(manifests[id]).toBeDefined();
  });

  test('every other package belongs to a trail the site shows as Verified', () => {
    // A trail that loses its seal must lose its download with it:
    //   node scripts/build-offline-packages.js --prune
    const trails = new Map(loadProductionTrails(root).map(trail => [trail.id, trail]));
    const outside = packageIds()
      .filter(id => !PILOT_IDS.includes(id))
      .filter(id => !(trails.has(id) && isVerified(trails.get(id))));
    expect(outside).toEqual([]);
  });

  test('every package says what its trail page says about the route (OFF-08)', () => {
    // A trail page showing "Verified by ORMA" and an offline map of the same
    // line saying it was never reviewed contradict each other.
    const trails = new Map(loadProductionTrails(root).map(trail => [trail.id, trail]));
    for(const [id, manifest] of Object.entries(manifests)){
      const status = trails.has(id) && isVerified(trails.get(id)) ? 'source-verified' : 'not-verified';
      expect(manifest.trailId).toBe(id);
      expect(`${id} ${manifest.verificationStatus}`).toBe(`${id} ${status}`);
      const safety = JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'safety.json'), 'utf8'));
      const route = JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'route.geojson'), 'utf8'));
      expect(safety.verificationStatus).toBe(status);
      expect(route.features[0].properties.verificationStatus).toBe(status);
      if(status === 'source-verified'){
        expect(safety.cautions.join(' ')).not.toMatch(/field review|not yet|beta/i);
      }
    }
  });
});

describe('every offline package is complete and verifiable', () => {
  const bytesCache = new Map();
  const read = file => {
    if(!bytesCache.has(file)) bytesCache.set(file, fs.readFileSync(file));
    return bytesCache.get(file);
  };
  const roles = [
    'app', 'completion', 'elevation-engine', 'elevation-profile', 'footpath-network',
    'footpath-router', 'gps-policy', 'hike-distance', 'map', 'outcome', 'route',
    'route-rejoin', 'safety', 'session', 'shell', 'style',
  ];

  test.each(packageIds())('%s matches its manifest byte for byte', id => {
    const manifest = manifests[id];
    expect(manifest.resources.map(resource => resource.role).sort()).toEqual(roles);
    expect(manifest.version).toMatch(/^\d{4}\.\d{2}\.\d{2}-beta\.\d+$/);
    let total = 0;
    for(const resource of manifest.resources){
      expect(resource.required).toBe(true);
      const file = resource.url.startsWith('/')
        ? path.join(root, resource.url)
        : path.join(packagesDir, id, resource.url);
      const data = read(file);
      expect(data.byteLength).toBe(resource.bytes);
      expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(resource.sha256);
      total += data.byteLength;
    }
    expect(manifest.packageBytes).toBe(total);
    expect(total).toBeLessThanOrEqual(manifest.packageBudgetBytes);
  });

  test.each(packageIds())('%s has a profile the offline page will draw', id => {
    // The page runs this exact check and refuses the whole package if it
    // fails; Fenn Promenade downloaded fine and then would not open.
    const profile = JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'elevation-profile.json'), 'utf8'));
    expect(offlineElevation.validProfile(profile, id)).toBe(true);
  });

  test.each(packageIds())('%s draws its route inside its own map', id => {
    const manifest = manifests[id];
    const map = fs.readFileSync(path.join(packagesDir, id, 'map.svg'), 'utf8');
    const route = JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'route.geojson'), 'utf8'));
    const graph = JSON.parse(fs.readFileSync(path.join(packagesDir, id, 'footpath-network.json'), 'utf8'));
    expect(map).toContain(`viewBox="0 0 ${manifest.image.width} ${manifest.image.height}"`);
    expect(map).toContain('class="route"');
    expect(map).toContain('© OpenStreetMap contributors · ODbL');
    expect(manifest.bounds).toEqual(graph.bounds);
    expect(graph.trailNodes.length).toBeGreaterThan(0);
    for(const [lng, lat] of route.features[0].geometry.coordinates){
      expect(lat).toBeGreaterThanOrEqual(manifest.bounds.south);
      expect(lat).toBeLessThanOrEqual(manifest.bounds.north);
      expect(lng).toBeGreaterThanOrEqual(manifest.bounds.west);
      expect(lng).toBeLessThanOrEqual(manifest.bounds.east);
    }
  });
});
