const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const trailBundle = require('./scripts/build-trail-page-bundle.js');

describe('PERF-02 asset and regional loading contract', () => {
  test('homepage and trail detail load MapLibre on demand', () => {
    const homepage = read('index.html');
    const detail = read('trail.html');
    [homepage, detail].forEach(html => expect(html).not.toContain('unpkg.com/maplibre-gl@5.24.0'));
    expect(homepage).toContain('map-runtime.js?v=20260826-1');
    expect(detail).toContain('trail-app.bundle.js?v=20260903-1');
    const runtime = read('map-runtime.js');
    expect(runtime).toContain('IntersectionObserver');
    expect(runtime).toContain("rootMargin: opts.rootMargin || '320px 0px'");
    expect(runtime).toContain('Promise.all([loadStyle(), loadScript()])');
  });

  test('homepage lazy-loads hidden POIs while detail scheduling includes trail-adjacent POIs', () => {
    const homepage = read('script.js');
    const detail = read('trail.js');
    expect(homepage).toContain('function scheduleGuestMap()');
    expect(homepage).toContain('function scheduleTrailMap()');
    expect(homepage).toContain("renderGondolas(guestMapInstance, 'guest-gondolas', { visible: false })");
    expect(homepage).toContain('const overlayStates = { routes: true, lifts: false');
    expect(homepage).toContain('onIdle(loadSecondaryMapData, 5000)');
    const secondaryMapData = homepage.slice(
      homepage.indexOf('const loadSecondaryMapData = () =>'),
      homepage.indexOf("if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.onIdle(loadSecondaryMapData, 5000)")
    );
    expect(secondaryMapData).not.toContain('initializeWaterSources');
    expect(secondaryMapData).not.toContain('initializeHutsBars');
    expect(homepage).toContain("if(key === 'fountains') return initializeWaterSources(map)");
    expect(homepage).toContain("if(key === 'huts' || key === 'barsCafes') return initializeHutsBars(map)");
    expect(homepage).toContain('if(waterSourcesLoads.has(map)) return waterSourcesLoads.get(map)');
    expect(homepage).toContain('if(hutsBarsLoads.has(map)) return hutsBarsLoads.get(map)');
    expect(homepage.indexOf("renderGondolas(trailMapInstance, 'trailmap-gondolas')"))
      .toBeGreaterThan(homepage.indexOf('const loadSecondaryMapData = () =>'));
    expect(homepage).toContain("overlayControls.sync('lifts')");
    expect(homepage).toContain("lifts:    ['trailmap-gondolas-line', 'trailmap-gondolas-labels']");
    expect(homepage).toContain('function publicLiftNote(note)');
    expect(homepage).not.toContain('<br>${station.label}');
    expect(detail).toContain('whenVisible(detailMapTarget, initDetailMap');
    expect(detail).toContain('function publicLiftNote(note)');
    expect(detail).not.toContain("p.label ? '<br>' + p.label");
    // Trail-adjacent planning POIs are part of the primary map experience;
    // defer briefly for map interactivity, but do not leave them absent for
    // several seconds on a phone.
    expect(detail).toContain('onIdle(loadSecondaryPois, 1400)');
    expect(detail).toContain("const liftsToggleBtn = document.getElementById('liftsToggle')");
    expect(detail.indexOf('renderAllLifts(map, { visible: liftsVisible });'))
      .toBeGreaterThan(detail.indexOf('const loadSecondaryPois = () =>'));
  });

  test('trail loaders keep default and requested regions explicit', () => {
    expect(read('index.html')).toContain('data-default-region="dolomites"');
    expect(read('trail.html')).toContain('data-default-region="trail"');
    const loader = read('regional-trails-loader.js');
    const homepage = read('script.js');
    const detail = read('trail.html');
    expect(loader).toContain("mode === 'trail'");
    expect(loader).toContain('entry.details && entry.details[trailId]');
    expect(loader).toContain('alreadyPrimed');
    expect(homepage).toContain("function warmTrailDetail(t)");
    expect(detail).toContain("sessionStorage.getItem('orma-trail-detail:' + id)");
    expect(loader).toContain('primeTrailDetail: primeTrailDetail');
    expect(read('browse-trails.html')).toContain('primeTrailLink(link)');
    expect(homepage).toContain('warmTrailDetail(trail);');
    expect(loader).toContain('regionForTrail:');
  });

  test('trail identity paints before deferred detail features finish booting', () => {
    const page = read('trail.html');
    const criticalRender = page.indexOf("performance.mark('orma-trail-critical-render')");
    expect(criticalRender).toBeGreaterThan(page.indexOf('data-default-region="trail"'));
    expect(criticalRender).toBeLessThan(page.indexOf('src="trail-app.bundle.js'));
    expect(page).toContain("name.removeAttribute('aria-busy')");
  });

  test('signed-in homepage paints from cache before cloud profile and match-history reads finish', () => {
    const html = read('index.html');
    const homepage = read('script.js');
    expect(html).toContain('id="hpHeroImage" loading="lazy" fetchpriority="auto"');
    expect(html).toContain("!document.documentElement.classList.contains('early-member')");
    const authHandler = homepage.slice(
      homepage.indexOf("window.addEventListener('dolopaws-auth-changed'"),
      homepage.indexOf('// Show the dog photo bubble')
    );
    expect(authHandler.indexOf('renderReturningHomepage(profile);'))
      .toBeLessThan(authHandler.indexOf('window.DoloPawsAuth.getDogProfile()'));
    expect(authHandler).toContain('await Promise.all([');

    const renderer = homepage.slice(
      homepage.indexOf('async function renderReturningHomepage'),
      homepage.indexOf('// Attach locate + save handlers')
    );
    expect(renderer).not.toContain('await window.DoloPawsAuth.getLastMatches()');
    expect(homepage).toContain('function liScheduleNewMatchSync(scored, profile)');
  });

  test('mobile trail navigation does not wait for Firebase, fonts or MapLibre', () => {
    const page = read('trail.html');
    const runtime = read('trail.js');
    expect(page).not.toContain('<script type="module" src="firebase-init.js');
    expect(page).toContain("window.addEventListener('load', scheduleTrailFirebase");
    expect(page).toContain("window.addEventListener('load', function(){");
    expect(page).toContain('id="mobileMapLoadBtn"');
    expect(runtime).toContain("window.matchMedia('(max-width: 700px)').matches");
    expect(runtime).toContain("detailMapTarget.dataset.mapState = 'waiting'");
    expect(runtime).toContain("window.addEventListener('load', () =>");
  });

  test('trail application code ships as one ordered, reproducible request', () => {
    const page = read('trail.html');
    expect(page).toContain('<script src="trail-app.bundle.js?v=20260903-1" defer>');
    expect(page).not.toContain('<script src="map-runtime.js');
    expect(page).not.toContain('<script src="trail.js');
    expect(trailBundle.SOURCES.length).toBeGreaterThan(40);
    expect(read(trailBundle.OUTPUT)).toBe(trailBundle.bundleSource());
  });

  test('an uncached parking lookup cannot block trail-detail rendering', () => {
    const detail = read('trail.js');
    expect(detail).toContain('improveLoopStart(trail, { deferOnMiss:true })');
    expect(detail).toContain('if(deferOnMiss) return Promise.resolve()');
  });

  test('homepage selection promotes one route with detail-map hierarchy', () => {
    const homepage = read('script.js');
    expect(homepage).toContain("id:'trail-selected-route-casing'");
    expect(homepage).toContain("id:'trail-selected-route-line'");
    expect(homepage).toContain("id:'trail-selected-route-number'");
    expect(homepage).toContain("function setSelectedTrailRoute(trail, options)");
    expect(homepage).toContain('setSelectedTrailRoute(t);');
    expect(homepage).toContain('setSelectedTrailRoute(null, { fit:false });');
    expect(homepage).toContain("'trail-paths-mapped-casing','trail-paths-mapped-line','trail-paths-route-number'");
    expect(homepage).toContain("['!=', ['get','id'], trail.id]");
  });

  test('oversized trail photos have mobile WebP variants and JPEG fallbacks', () => {
    const stems = [
      'lago-di-braies',
      'lago-di-carezza',
      'boucle-du-marais-des-chassettes',
      'circuit-beatrice-de-savoie',
      'itineraire-decouverte-de-la-nature',
    ];
    stems.forEach(stem => {
      const mobile = path.join(__dirname, 'images', `${stem}-480.webp`);
      const fallback = path.join(__dirname, 'images', `${stem}.jpg`);
      expect(fs.existsSync(mobile)).toBe(true);
      expect(fs.existsSync(fallback)).toBe(true);
      expect(fs.statSync(mobile).size).toBeLessThan(100 * 1024);
      expect(fs.statSync(fallback).size).toBeLessThan(350 * 1024);
    });
    expect(read('index.html')).not.toContain('lago-di-braies.png');
    expect(read('trail-card-visual.js')).toContain('srcset=');
    expect(read('trail-card-visual.js')).toContain('responsivePhotoByTrailId');
    expect(read('trail-card-visual.js')).toContain("withWidth(source, 480)");
    const detailRuntime = read('trail.js');
    expect(detailRuntime).toContain("'lago-braies':'images/lago-di-braies.webp'");
    expect(detailRuntime).toContain("width=${width}");
  });
});
