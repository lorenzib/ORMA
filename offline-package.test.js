const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const packageDir = path.join(root, 'offline', 'packages', 'lago-carezza');
const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8'));
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

    let totalBytes = 0;
    for(const resource of manifest.resources){
      const data = fs.readFileSync(localPathFor(resource));
      expect(data.byteLength).toBe(resource.bytes);
      expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(resource.sha256);
      totalBytes += data.byteLength;
    }
    expect(totalBytes).toBe(manifest.packageBytes);
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
