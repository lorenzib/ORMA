const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const packageDir = path.join(root, 'offline', 'packages', 'lago-carezza');
const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8'));
const mapSvg = fs.readFileSync(path.join(packageDir, 'map.svg'), 'utf8');
const osmSource = fs.readFileSync(
  path.join(root, 'data', 'offline-map-sources', 'lago-carezza.osm'),
  'utf8'
);
const scoring = require('./scoring/recommendation-v1.js');

function localPathFor(resource){
  if(resource.url.startsWith('/')) return path.join(root, resource.url);
  return path.join(packageDir, resource.url);
}

describe('Lago di Carezza offline package', () => {
  test('declares the expected beta status and geographic bounds', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.trailId).toBe('lago-carezza');
    expect(manifest.verificationStatus).toBe('field-review-required');
    expect(manifest.scoringVersion).toBe(scoring.VERSION);
    expect(manifest.bounds.north).toBeGreaterThan(manifest.bounds.south);
    expect(manifest.bounds.east).toBeGreaterThan(manifest.bounds.west);
  });

  test('all required resources match their declared size and SHA-256 hash', () => {
    const roles = new Set(manifest.resources.map(resource => resource.role));
    expect(roles).toEqual(new Set(['shell', 'style', 'app', 'map', 'route', 'safety']));
    expect(manifest.resources.every(resource => resource.required === true)).toBe(true);

    let totalBytes = 0;
    for(const resource of manifest.resources){
      const data = fs.readFileSync(localPathFor(resource));
      expect(data.byteLength).toBe(resource.bytes);
      expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(resource.sha256);
      totalBytes += data.byteLength;
    }
    expect(totalBytes).toBe(manifest.packageBytes);
  });

  test('enforces a deterministic fixed corridor and package-size ceiling', () => {
    const bounds = osmSource.match(
      /<bounds minlat="([^"]+)" minlon="([^"]+)" maxlat="([^"]+)" maxlon="([^"]+)"\/>/
    );
    expect(bounds).not.toBeNull();
    expect(manifest.bounds).toEqual({
      north: Number(bounds[3]),
      south: Number(bounds[1]),
      east: Number(bounds[4]),
      west: Number(bounds[2]),
    });
    expect(manifest.mapCorridor).toEqual({
      strategy: 'fixed-bounds-svg-v1',
      scaleLevels: [1],
      width: 1200,
      height: 1140,
    });
    expect(manifest.packageBytes).toBeLessThanOrEqual(manifest.packageBudgetBytes);
    expect(mapSvg).toContain('viewBox="0 0 1200 1140"');
  });

  test('keeps route, trailhead context, safety, and attribution in required files', () => {
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    expect(mapSvg).toContain('class="route"');
    expect(mapSvg).toContain('© OpenStreetMap contributors · ODbL');
    expect(mapSvg).toMatch(/<g transform="translate\([^"]+\)"><circle r="22"/);
    expect(manifest.resources.find(resource => resource.role === 'route').required).toBe(true);
    expect(manifest.resources.find(resource => resource.role === 'safety').required).toBe(true);
    expect(app).toContain('if(resource.required !== false) throw error');
  });

  test('route is a closed LineString inside the package bounds', () => {
    const route = JSON.parse(fs.readFileSync(path.join(packageDir, 'route.geojson'), 'utf8'));
    const coordinates = route.features[0].geometry.coordinates;
    expect(route.features[0].geometry.type).toBe('LineString');
    expect(coordinates.length).toBeGreaterThan(2);
    expect(coordinates[0]).toEqual(coordinates[coordinates.length - 1]);
    for(const [lng, lat] of coordinates){
      expect(lat).toBeGreaterThanOrEqual(manifest.bounds.south);
      expect(lat).toBeLessThanOrEqual(manifest.bounds.north);
      expect(lng).toBeGreaterThanOrEqual(manifest.bounds.west);
      expect(lng).toBeLessThanOrEqual(manifest.bounds.east);
    }
  });

  test('the trail page loads the account-gated package controller', () => {
    const trailPage = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
    const controller = fs.readFileSync(path.join(root, 'offline-packages.js'), 'utf8');
    expect(trailPage).toContain('id="offlineDownloadBtn"');
    expect(trailPage).toContain('src="offline-packages.js');
    expect(controller).toContain('window.DoloPawsAuth.currentUser');
    expect(controller).toContain("request('download')");
  });
});
