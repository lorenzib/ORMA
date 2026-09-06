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
const { expectBundled, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');

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
    expect(manifest.elevationProfile).toMatchObject({
      strategy:'route-profile-v1', pointCount:3, distanceKm:1.3, ascentM:20,
      demPackaged:false,
    });
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
      'route-rejoin',
      'hike-distance',
      'footpath-router',
      'elevation-engine',
      'footpath-network',
      'elevation-profile',
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
    expect(manifest.routingGraph).toEqual({
      strategy:'osm-walking-graph-v1',
      nodeCount:224,
      edgeCount:223,
      trailNodeCount:95,
      maxRejoinRouteM:1500,
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
    expect(manifest.resources.find(resource => resource.role === 'route-rejoin').required).toBe(true);
    expect(manifest.resources.find(resource => resource.role === 'hike-distance').required).toBe(true);
    expect(manifest.resources.find(resource => resource.role === 'footpath-router').required).toBe(true);
    expect(manifest.resources.find(resource => resource.role === 'footpath-network').required).toBe(true);
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
    expect(app).toContain('Vetted by ORMA.');
  });

  test('presents downloaded route essentials and stored map context clearly', () => {
    const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'offline', 'offline.css'), 'utf8');

    expect(shell).toContain('class="route-at-a-glance"');
    expect(shell).toContain('id="mapDistance"');
    expect(shell).toContain('id="mapAnnotations"');
    expect(shell).toContain('class="package-details"');
    expect(app).toContain('renderMapDetails(safety, manifest.bounds)');
    expect(app).toContain('Start / finish');
    expect(css).toContain('.route-at-a-glance');
    expect(css).toContain('.map-annotation');
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
    expect(shell).toContain('src="../route-rejoin.js"');
    expect(shell).toContain('src="../hike-distance.js"');
    expect(shell).toContain('src="../footpath-router.js"');
    expect(shell.indexOf('hike-gps-policy.js')).toBeLessThan(shell.indexOf('offline-app.js'));
    expect(shell.indexOf('route-rejoin.js')).toBeLessThan(shell.indexOf('offline-app.js'));
    expect(shell.indexOf('footpath-router.js')).toBeLessThan(shell.indexOf('offline-app.js'));
    expect(shell).toContain('id="offlineRouteWarning"');
    expect(app).toContain('DoloPawsGpsPolicy.assessFix');
    expect(app).toContain("assessment.offRouteState === 'confirmed'");
    expect(app).toContain('DoloPawsHikeDistance.update');
    expect(shell).toContain('id="offlineRejoinBtn"');
    expect(app).toContain('last valid fix');
    expect(app).toContain("? 'On trail'");
    expect(app).toContain("? 'Checking route position'");
    expect(app).toContain('DoloPawsRouteRejoin.guidance');
    expect(app).toContain('DoloPawsFootpathRouter.routeToTrail');
    expect(app).toContain('follow the blue mapped path');
    expect(app).not.toContain('do not follow the straight line');
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
    expectTrailBundleLoaded();
    expectBundled('offline-packages.js');
    expect(controller).toContain('window.DoloPawsAuth.currentUser');
    expect(controller).toContain("request('download')");
  });

  test('the trail-detail package panel localizes lifecycle and recovery states', () => {
    const trailPage = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
    const controller = fs.readFileSync(path.join(root, 'offline-packages.js'), 'utf8');

    expect(trailPage).toContain('data-i18n="offlinePanel.title"');
    expect(trailPage).toContain('data-i18n="offlinePanel.action.download"');
    expect(controller).toContain("tr('offlinePanel.updateAvailable'");
    expect(controller).toContain("tr('offlinePanel.stale'");
    expect(controller).toContain("tr('offlinePanel.ready'");
    expect(controller).not.toContain("tr('offlinePanel.test.passed'");
    expect(controller).not.toContain("getElementById('offlineTestBtn')");
    expect(controller).toContain("tr('offlinePanel.remove.removing'");
  });
});

describe('OFF package revisions follow the packaged bytes', () => {
  const builder = fs.readFileSync(path.join(__dirname, 'scripts', 'build-offline-manifest.js'), 'utf8');

  test('a rebuild that changes no byte keeps the revision and the build stamp', () => {
    // The physical device-test gates are tied to the revision, so a cosmetic
    // bump silently invalidates QA evidence that is still valid. Twice today a
    // scoringVersion stamp moved the revision without a single downloadable
    // byte changing.
    expect(builder).toContain('function sameBytes(');
    expect(builder).toContain('version:unchanged ? previous.version : config.version');
    expect(builder).toContain('generatedAt:unchanged && previous.generatedAt');
  });

  test('changed bytes under an unchanged revision are refused, not published', () => {
    // The opposite failure is worse: replacing what people already downloaded
    // while keeping the label they downloaded it under.
    expect(builder).toContain('packaged bytes changed but the revision is still');
    expect(builder).toContain('process.exit(1)');
  });

  test('both shipped manifests record a revision and a byte total', () => {
    for(const id of ['lago-carezza', 'alpe-siusi']){
      const manifest = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'offline', 'packages', id, 'manifest.json'), 'utf8'));
      expect(manifest.version).toMatch(/^\d{4}\.\d{2}\.\d{2}-beta\.\d+$/);
      expect(manifest.packageBytes).toBe(
        manifest.resources.reduce((total, item) => total + item.bytes, 0));
    }
  });
});
