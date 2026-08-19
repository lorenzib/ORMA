const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTrailScript(overrides = {}){
  const context = {
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Promise,
    module: {},
    exports: {},
    maplibregl: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    navigator: { userAgent: 'jest' },
    location: { search: '' },
    document: {
      readyState: 'loading',
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {},
        className: '',
        textContent: '',
        innerHTML: '',
        hidden: false,
        appendChild: () => {},
        addEventListener: () => {},
        setAttribute: () => {},
      }),
      addEventListener: () => {},
    },
    t: (key, params) => {
      const translations = {
        'legendTrail.start': '🚩 Start',
        'legendTrail.dir': '➤ Direction of travel',
        'legendTrail.switch': '🔀 Trail switch',
        'legend.hut': 'Mountain hut',
        'legend.food': 'Food stop',
        'legend.water': 'Water source',
        'safety.low': 'Easy',
        'safety.moderate': 'Moderate',
        'safety.caution': 'Caution',
        'trail.route': `Route · ${(params && params.label) || ''}`.trim(),
      };
      return translations[key] || key;
    },
    window: null,
    globalThis: null,
    ...overrides,
  };
  context.window = context;
  context.globalThis = context;
  context.window.location = context.location;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8'), context);
  return context;
}

describe('trail page map controls', () => {
  test('uses the main-map Layers pattern and removes the redundant map key', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;
    expect(document.querySelector('.map-key--bar')).toBeNull();
    expect(document.getElementById('detailLayersBtn')).not.toBeNull();
    expect(document.getElementById('detailLayersPanel')).not.toBeNull();
    expect(document.getElementById('fountainsToggle')).not.toBeNull();
    expect(document.getElementById('hutsToggle')).not.toBeNull();
    expect(document.getElementById('foodToggle')).not.toBeNull();
  });

  test('marked routes and relief are on by default, opt-out via the toggle', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const trail = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    const home = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    document.body.innerHTML = html;
    const toggle = document.getElementById('routesToggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.className).toContain('on');
    // The waymarked overlay starts visible on both interactive maps, and
    // both carry the always-on base hillshade.
    expect(trail).toContain("layout: { visibility: 'visible' }");
    expect(home).toContain('routes: true');
    expect(trail).toContain("id: 'base-hillshade'");
    expect(home).toContain("id: 'base-hillshade'");
  });

  test('contains a dedicated Nearby trails section and no bottom decision banner', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;

    const nearbyWrap = document.getElementById('nearbyTrails');
    expect(nearbyWrap).not.toBeNull();
    expect(nearbyWrap.querySelector('h3').textContent).toMatch(/Similar trails/i);
    expect(document.getElementById('nearbyToggle')).not.toBeNull();

    expect(document.getElementById('decisionBar')).toBeNull();
    expect(html).not.toContain('Gentler nearby');
  });

  test('nearby trail candidates are distance-ranked and exclude the current trail', () => {
    const context = loadTrailScript();
    const current = { id:'current', path:[[46.64, 11.72], [46.65, 11.73]] };
    const nearby = { id:'nearby', path:[[46.66, 11.74], [46.67, 11.75]] };
    const farther = { id:'farther', path:[[46.75, 11.80], [46.76, 11.81]] };
    const outside = { id:'outside', path:[[47.5, 13.0], [47.51, 13.01]] };

    const result = context.nearbyTrailCandidates(current, [outside, farther, current, nearby], 25, 5);

    expect(result.map(item => item.trail.id)).toEqual(['nearby', 'farther']);
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm);
    expect(result[0].mapPoint).toEqual(nearby.path[0]);
  });

  test('match, safety, risk, and live conditions each have one clear owner', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const blueprint = fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8');
    const trail = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    document.body.innerHTML = html;

    expect(document.getElementById('tdRiskLine')).not.toBeNull();
    expect(document.querySelectorAll('#sideForecast')).toHaveLength(1);
    expect(document.getElementById('sideConditions')).toBeNull();
    expect(document.getElementById('matchAdvice')).toBeNull();
    expect(document.querySelector('.td-safety-intro').textContent).toMatch(/Heat, shade and the route cautions/i);

    expect(blueprint).toContain("['route', 'Route effort'");
    expect(blueprint).toContain('trust.heatAssessment(t)');
    expect(blueprint).toContain('if (!item || item.ok) return;');
    expect(blueprint).toContain('const visible = rows.slice(0, 3)');
    expect((blueprint.match(/api\.open-meteo\.com/g) || [])).toHaveLength(1);
    expect(trail).not.toContain('api.open-meteo.com');
  });

  test('the description card has the same section-label treatment as other trail cards', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;

    const about = document.querySelector('.td2-about');
    expect(about).not.toBeNull();
    expect(about.querySelector('.td2-kick').textContent.trim()).toBe('About this trail');
    expect(about.querySelector('#matchDescription')).not.toBeNull();
    const legacyTags = about.querySelector('#trailTags');
    expect(legacyTags).not.toBeNull();
    expect(legacyTags.hidden).toBe(true);
    expect(legacyTags.getAttribute('aria-hidden')).toBe('true');
  });

  test('map-rendering scripts rotate their cache keys with the detail markup', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');

    expect(html).toContain('i18n.js?v=20260819-4');
    expect(html).toContain('trail.js?v=20260819-4');
    expect(html).toContain('trail-blueprint.js?v=20260819-6');
    expect(html).toContain('trail-recommendation.js?v=20260819-4');
    expect(html).toContain('offline-packages.js?v=20260819-5');
  });

  test('the map workspace places elevation below the map while dog fit stays alongside it', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;

    const heroWeather = document.querySelector('.td2-hero-weather');
    expect(heroWeather.querySelector('#tdConditions')).not.toBeNull();
    expect(heroWeather.querySelector('#sideForecast').tagName).toBe('DETAILS');

    const workspace = document.querySelector('.td2-workspace');
    const mapStack = workspace.querySelector('.td2-map-stack');
    expect(workspace.firstElementChild).toBe(mapStack);
    expect(mapStack.firstElementChild.classList.contains('td2-mapcard')).toBe(true);
    expect(mapStack.lastElementChild.id).toBe('tdElevationPanel');
    expect(html).toContain('.td2-map-stack>.td2-elev[hidden]{display:none!important;}');
    const plan = workspace.querySelector('.td2-plan-stack');
    const fit = plan.querySelector('.td2-fit-shell');
    const safety = fit.querySelector('#td2SafetyCard');
    const guides = safety.querySelector('#trailGuideLinks');
    expect(fit.querySelector('#recommendationDecision')).not.toBeNull();
    expect(guides).not.toBeNull();
    expect(document.getElementById('td2DogCard')).toBeNull();
  });

  test('below-map content follows the requested story and logistics sequence', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;

    const story = document.querySelector('.td2-story');
    expect(Array.from(story.children).map(node => node.id)).toEqual([
      'td2AboutCard', 'td2ParkingCard', 'td2PhotosCard', 'td2ReviewsCard'
    ]);
    const logistics = document.querySelector('.td2-logistics');
    expect(Array.from(logistics.children).map(node => node.id)).toEqual([
      'td2Hazards'
    ]);
    const gettingThere = document.getElementById('td2ParkingCard');
    expect(gettingThere.hidden).toBe(false);
    expect(gettingThere.querySelector('.td2-kick').textContent.trim()).toBe('Getting there');
    expect(html).toContain('.td2-workspace,.td2-lower-grid{grid-template-columns:1fr;}');
    expect(html).not.toContain('id="offlineTestBtn"');
  });

  test('card copy normalises long dash separators', () => {
    const blueprint = fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8');

    expect(blueprint).toContain(".replace(/\\s*(?:—|--)+\\s*/g, '. ')");
    expect(blueprint).toContain('descEl.textContent = cardCopy(t.desc)');
    expect(blueprint).not.toContain('is warm — walk early');
  });

  test('the hero groups compact facts, weather, and every primary trail action', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;

    const copy = document.querySelector('.td2-hero-copy');
    expect(copy.querySelector('#trailName').nextElementSibling.id).toBe('heroVerdict');
    expect(copy.querySelector('#trailFacts')).not.toBeNull();
    expect(copy.querySelector('.td2-hero-weather')).not.toBeNull();
    const actionIds = Array.from(copy.querySelector('.td2-actrow').children)
      .map(node => node.id)
      .filter(Boolean);
    expect(actionIds).toEqual(expect.arrayContaining([
      'detailSaveBtn', 'heroStartHike', 'getDirectionsBtn', 'logWalkBtn',
      'exportGpxBtn', 'detailShareBtn'
    ]));
    expect(copy.querySelector('#offlineDownloadBtn')).not.toBeNull();
    expect(document.getElementById('tdHeroPhoto')).not.toBeNull();
    expect(html).toContain('grid-template-areas:"tags weather" "title weather" "facts weather" "actions weather"');
    expect(html).toContain('.td2-hero-weather{grid-area:weather;');
  });

  test('routes without elevation data remove the current elevation card completely', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const trail = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');

    expect(trail).toContain("const elevationCard = document.getElementById('tdElevationPanel')");
    expect(trail).not.toContain("document.getElementById('elevCard')");
    expect(html).toContain('.td2-map-stack>.td2-elev[hidden]{display:none!important;}');
  });

  test('the personalised match links to the scoring explanation', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const trail = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    const scoring = fs.readFileSync(path.join(__dirname, 'how-scoring-works.html'), 'utf8');

    expect(trail).toContain('id="statMatchLink" href="how-scoring-works.html"');
    expect(trail).toContain("statMatchLink.href = 'how-scoring-works.html'");
    expect(html).toContain('.td2-match-link:focus-visible');
    expect(scoring).toContain('id="how-scoring-works"');
  });

  test('addTerrainToggle creates a terrain button anchored with the terrain-specific class', () => {
    const createdButtons = [];
    const mapContainer = {
      style: {},
      appendChild: (el) => createdButtons.push(el),
    };
    const context = loadTrailScript({
      document: {
        readyState: 'loading',
        getElementById: (id) => (id === 'trailDetailMap' ? mapContainer : null),
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({
          style: {},
          className: '',
          textContent: '',
          innerHTML: '',
          hidden: false,
          appendChild: () => {},
          addEventListener: () => {},
          setAttribute: () => {},
        }),
        addEventListener: () => {},
      },
    });

    context.addTerrainToggle({}, 'trailDetailMap', 1.5, 45);

    expect(createdButtons).toHaveLength(1);
    expect(createdButtons[0].textContent).toBe('trail.view3d');
    expect(createdButtons[0].className).toContain('map-btn--terrain');
    expect(createdButtons[0].style.left).toBeUndefined();
  });

  test('addTerrainToggle joins the grouped layer switch when given its 3D button', () => {
    const context = loadTrailScript({
      document: {
        readyState: 'loading',
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({}),
        addEventListener: () => {},
      },
    });
    const classes = new Set();
    let clickHandler = null;
    const attrs = {};
    const groupBtn = {
      textContent: '3D',
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
      },
      setAttribute: (k, v) => { attrs[k] = v; },
      addEventListener: (type, fn) => { if(type === 'click') clickHandler = fn; },
    };
    const terrainCalls = [];
    const cameraCalls = [];
    const fakeMap = {
      setTerrain: value => terrainCalls.push(value),
      getLayer: () => true,
      removeLayer: () => {},
      addLayer: () => {},
      easeTo: value => cameraCalls.push(value),
    };

    context.addTerrainToggle(fakeMap, 'trailDetailMap', 1.5, 45, groupBtn);
    expect(typeof clickHandler).toBe('function');

    clickHandler();
    expect(classes.has('on')).toBe(true);
    expect(attrs['aria-pressed']).toBe('true');
    // Label must stay put — the pressed state carries the meaning.
    expect(groupBtn.textContent).toBe('3D');
    expect(terrainCalls[0]).toEqual({ source: 'terrain-dem-3d', exaggeration: 1.5 });
    expect(cameraCalls[0].pitch).toBe(45);
    expect(cameraCalls[0].zoom).toBe(12.25);

    clickHandler();
    expect(classes.has('on')).toBe(false);
    expect(attrs['aria-pressed']).toBe('false');
    expect(terrainCalls[1]).toBeNull();
  });

  test('hike mode keeps live elevation visible and offers explicit relief choices', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const trail = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    const hikeMode = fs.readFileSync(path.join(__dirname, 'hike-mode.js'), 'utf8');
    document.body.innerHTML = html;

    expect(document.getElementById('tdElevationPanel')).not.toBeNull();
    expect(document.getElementById('tdElevLive')).not.toBeNull();
    expect(document.querySelector('[data-maplayer="map"]').textContent).toBe('Map');
    expect(document.querySelector('[data-maplayer="satellite"]').textContent).toBe('Satellite');
    expect(document.querySelector('[data-map3d]').textContent).toBe('3D');
    expect(trail).toContain('mapBox.appendChild(elevationPanel)');
    expect(trail).toContain('route elevation`');
    expect(trail).toContain("'hillshade-method': 'igor'");
    expect(trail).toContain("on ? 'Close map' : 'Expand map'");
    expect(hikeMode).toContain('rejoin.segmentFraction');
    expect(html.indexOf('hike-distance.js')).toBeLessThan(html.indexOf('hike-mode.js'));
    expect(hikeMode).toContain("window.t('hike.walked'");
    expect(hikeMode).not.toContain("window.t('hike.kmOf'");
    expect(hikeMode).toContain("rejoinBtn.id = 'mapHikeRejoinBtn'");
    expect(hikeMode).toContain("rejoinBtn.textContent = hikeLabel('hike.rejoinAction', 'Route me to the trail')");
    expect(hikeMode).toContain("rejoinBtn.textContent = hikeLabel('hike.rejoinWaitingGps'");
    expect(hikeMode).toContain('rejoinBtn.hidden = false');
    expect(hikeMode).not.toContain('routeDistanceM > Math.max(15');
    expect(trail).toContain('if(!routeIsLoop)');
  });
});
