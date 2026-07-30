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
    expect(roles).toEqual(new Set([
      'shell',
      'style',
      'app',
      'completion',
      'gps-policy',
      'outcome',
      'session',
      'map',
      'route',
      'safety',
    ]));
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
    expect(manifest.resources.find(resource => resource.role === 'gps-policy').required).toBe(true);
    expect(manifest.resources.find(resource => resource.role === 'completion').required).toBe(true);
    expect(manifest.resources.find(resource => resource.role === 'outcome').required).toBe(true);
    expect(manifest.resources.find(resource => resource.role === 'session').required).toBe(true);
    expect(app).toContain('if(resource.required !== false) throw error');
  });

  test('stores the complete evidence and freshness snapshot without inventing dates', () => {
    expect(manifest.evidence.version).toBe('1.0.0');
    expect(manifest.evidence.tier).toBe('mapped');
    expect(Object.keys(manifest.evidence.categories).sort()).toEqual([
      'access',
      'exposure',
      'heat',
      'livestock',
      'route',
      'surfaceHazards',
      'water',
    ]);
    for(const category of Object.values(manifest.evidence.categories)){
      expect(category.freshnessState).toBe('unknown');
      expect(category.observedAt).toBeNull();
      expect(category.observedLabel).toBe('date unknown');
    }
  });

  test('keeps detailed evidence metadata internal to the package', () => {
    const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    expect(shell).not.toContain('Stored evidence snapshot');
    expect(shell).not.toContain('evidenceList');
    expect(app).not.toContain('Freshness unknown');
    expect(app).toContain('Vetted by DoloPaws.');
  });

  test('offers private structured feedback after an offline completion', () => {
    const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    expect(shell).toContain('src="../post-hike-outcomes.js"');
    expect(shell).toContain('It never becomes a public review.');
    expect(shell).toContain('value="appropriate_with_unexpected_cautions"');
    expect(shell).toContain('value="did_not_complete"');
    expect(app).toContain('offlinePackageUsed:true');
    expect(app).toContain('Saved privately · pending sync until you reconnect.');
  });

  test('restores, pauses, and discards an unfinished hike without a network dependency', () => {
    const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    expect(shell).toContain('src="../hike-session.js"');
    expect(shell.indexOf('hike-session.js')).toBeLessThan(shell.indexOf('offline-app.js'));
    expect(shell).toContain('id="hikeResumeBtn"');
    expect(shell).toContain('id="hikePauseBtn"');
    expect(shell).toContain('id="hikeDiscardBtn"');
    expect(app).toContain('DoloPawsHikeSession.recoveryState');
    expect(app).toContain('DoloPawsHikeSession.updateProgress');
    expect(app).toContain('packageAvailable: true');
  });

  test('keeps offline GPS and off-route messaging accuracy-aware', () => {
    const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    expect(shell).toContain('src="../hike-gps-policy.js"');
    expect(shell.indexOf('hike-gps-policy.js')).toBeLessThan(shell.indexOf('offline-app.js'));
    expect(shell).toContain('id="offlineRouteWarning"');
    expect(app).toContain('DoloPawsGpsPolicy.assessFix');
    expect(app).toContain("assessment.offRouteState === 'confirmed'");
    expect(app).toContain('last valid fix');
  });

  test('persists offline completion before clearing the active session', () => {
    const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    const finishStart = app.indexOf('function finishRecoveredHike');
    const finishEnd = app.indexOf('function discardRecoveredHike', finishStart);
    const finishFlow = app.slice(finishStart, finishEnd);
    expect(shell).toContain('src="../hike-completions.js"');
    expect(shell.indexOf('hike-completions.js')).toBeLessThan(shell.indexOf('offline-app.js'));
    expect(shell).toContain('id="hikeFinishBtn"');
    expect(finishFlow).toContain('DoloPawsHikeCompletions.save');
    expect(finishFlow.indexOf('DoloPawsHikeCompletions.save'))
      .toBeLessThan(finishFlow.indexOf('DoloPawsHikeSession.clear'));
    expect(finishFlow).toContain('ready for a later journal or synchronization step');
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
