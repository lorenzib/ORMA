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

describe('trail page map legend', () => {
  test('map key lives outside the map as a collapsed disclosure', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;
    const legendKey = document.querySelector('.map-key--bar');

    expect(legendKey).not.toBeNull();
    expect(legendKey.hasAttribute('open')).toBe(false);
    // In flow below the map, never overlaying the route.
    expect(legendKey.closest('#trailMapBox')).toBeNull();
    expect(document.getElementById('legendChips')).not.toBeNull();
    // The what-this-trail-is-about chip is gone from the map corner.
    expect(document.getElementById('tdMapChip')).toBeNull();
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
    expect(document.querySelector('.td-safety-intro').textContent).toMatch(/Permanent trail conditions/i);

    expect(blueprint).toContain("['route', 'Route effort'");
    expect(blueprint).toContain('trust.heatAssessment(t)');
    expect((blueprint.match(/api\.open-meteo\.com/g) || [])).toHaveLength(1);
    expect(trail).not.toContain('api.open-meteo.com');
  });

  test('renderLegendChips populates trail legend entries', () => {
    const legendChips = { innerHTML: '' };
    const context = loadTrailScript({
      document: {
        readyState: 'loading',
        getElementById: (id) => (id === 'legendChips' ? legendChips : null),
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

    context.renderLegendChips({
      path: [[46.6, 12.1], [46.61, 12.11]],
      safetyLevel: 'moderate',
      decisionPoints: [{ km: 2.1, instruction: 'Keep left onto 104' }],
      rifugi: [],
      waterSources: [],
      lat: 46.6,
      lng: 12.1,
    });

    expect(legendChips.innerHTML).toContain('Start');
    expect(legendChips.innerHTML).toContain('Route · Moderate');
    expect(legendChips.innerHTML).toContain('Direction of travel');
    expect(legendChips.innerHTML).toContain('Trail switch');
    expect(legendChips.innerHTML).toContain('Mountain hut');
    expect(legendChips.innerHTML).toContain('Food stop');
    expect(legendChips.innerHTML).toContain('Water source');
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
      textContent: 'Elevation map',
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
      },
      setAttribute: (k, v) => { attrs[k] = v; },
      addEventListener: (type, fn) => { if(type === 'click') clickHandler = fn; },
    };
    const fakeMap = {
      setTerrain: () => {},
      getLayer: () => true,
      removeLayer: () => {},
      addLayer: () => {},
      easeTo: () => {},
    };

    context.addTerrainToggle(fakeMap, 'trailDetailMap', 1.5, 45, groupBtn);
    expect(typeof clickHandler).toBe('function');

    clickHandler();
    expect(classes.has('on')).toBe(true);
    expect(attrs['aria-pressed']).toBe('true');
    // Label must stay put — the pressed state carries the meaning.
    expect(groupBtn.textContent).toBe('Elevation map');

    clickHandler();
    expect(classes.has('on')).toBe(false);
    expect(attrs['aria-pressed']).toBe('false');
  });

  test('hike mode keeps live elevation visible and offers explicit relief choices', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const trail = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    const hikeMode = fs.readFileSync(path.join(__dirname, 'hike-mode.js'), 'utf8');
    document.body.innerHTML = html;

    expect(document.getElementById('tdElevationPanel')).not.toBeNull();
    expect(document.getElementById('tdElevLive')).not.toBeNull();
    expect(document.querySelector('[data-maplayer="terrain"]').textContent).toBe('Flat map');
    expect(document.querySelector('[data-map3d]').textContent).toBe('Elevation map');
    expect(trail).toContain('mapBox.appendChild(elevationPanel)');
    expect(trail).toContain('route elevation`');
    expect(trail).toContain("'hillshade-method': 'igor'");
    expect(trail).toContain("on ? 'Close map' : 'Expand map'");
    expect(hikeMode).toContain('rejoin.segmentFraction');
    expect(html.indexOf('hike-distance.js')).toBeLessThan(html.indexOf('hike-mode.js'));
    expect(hikeMode).toContain("window.t('hike.walked'");
    expect(hikeMode).not.toContain("window.t('hike.kmOf'");
    expect(hikeMode).toContain("rejoinBtn.id = 'mapHikeRejoinBtn'");
    expect(trail).toContain('if(!routeIsLoop)');
  });
});
