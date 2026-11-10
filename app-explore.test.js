'use strict';

const fs = require('fs');
const path = require('path');
const { collectAppFiles, APP_EXPLORE_TAG } = require('./scripts/build-app');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

describe('the app Explore map', () => {
  const source = read('app-explore.js');
  function run(){
    delete window.__ormaAppExplore;
    new Function(source)();
  }

  function mapWithControlsAddedLate(){
    document.body.innerHTML = '<div id="trailMap"></div>';
    run();
    const map = document.getElementById('trailMap');
    const layers = document.createElement('button');
    layers.className = 'map-btn';
    layers.setAttribute('aria-expanded', 'false');
    // script.js's own toggle, which flips aria-expanded.
    layers.addEventListener('click', () => {
      layers.setAttribute('aria-expanded', String(layers.getAttribute('aria-expanded') !== 'true'));
    });
    const panel = document.createElement('div');
    panel.className = 'map-panel';
    map.append(layers, panel);
    const styles = document.createElement('div');
    styles.className = 'td-layer-switch td-layer-switch--home';
    styles.innerHTML = '<button data-maplayer="map">Map</button><button data-maplayer="satellite">Satellite</button><button data-map3d>3D</button>';
    map.appendChild(styles);
    return { map, layers, panel, styles };
  }

  test('Layers and a Terrain button sit side by side, even when the map adds its controls late', async () => {
    const { map, layers, panel, styles } = mapWithControlsAddedLate();
    await Promise.resolve();
    const tools = map.querySelector(':scope > .app-map-tools');
    expect(tools).not.toBeNull();
    const [first, terrain] = tools.children;
    expect(first).toBe(layers);
    expect(terrain.textContent).toBe('Terrain');
    // The Layers panel and the style switch stay where script.js put them.
    expect(panel.parentElement).toBe(map);
    expect(styles.parentElement).toBe(map);
    expect(styles.classList.contains('app-terrain-panel')).toBe(true);
  });

  test('Terrain opens Map, Satellite and 3D, and only one panel is open at a time', async () => {
    const { map, layers, styles } = mapWithControlsAddedLate();
    await Promise.resolve();
    const terrain = map.querySelector('.app-terrain-btn');
    terrain.click();
    expect(styles.classList.contains('is-open')).toBe(true);
    expect(terrain.getAttribute('aria-expanded')).toBe('true');
    layers.click();
    expect(layers.getAttribute('aria-expanded')).toBe('true');
    expect(styles.classList.contains('is-open')).toBe(false);
    terrain.click();
    expect(layers.getAttribute('aria-expanded')).toBe('false');
    expect(styles.classList.contains('is-open')).toBe(true);
    // Choosing a style closes the panel.
    styles.querySelector('[data-maplayer="satellite"]').click();
    expect(styles.classList.contains('is-open')).toBe(false);
  });

  test('ships in the app on index.html only, and Draw a route leaves the map', () => {
    expect(APP_EXPLORE_TAG).toBe('<script src="/app-explore.js" defer></script>');
    expect(collectAppFiles().files.has('app-explore.js')).toBe(true);
    expect(read('scripts/build-app.js')).toContain("${r === 'index.html' ? `${APP_EXPLORE_TAG}\\n` : ''}");
    expect(read('_config.yml')).toMatch(/^\s+- app-explore\.js$/m);
    expect(read('index.html')).not.toContain('app-explore.js');
    const shell = read('app-shell.css');
    expect(shell).toContain('html.orma-app #homeMapDrawBtn{display:none !important;}');
    // Layers leaves the trail list in place, and "Back to <area>" is gone.
    expect(shell).toContain('html.orma-app body.mhome-active .li-map.map-layers-open{z-index:1;}');
    expect(shell).toContain('html.orma-app #liSearchThisArea{display:none !important;}');
  });
});

describe('the app Explore filters ask three questions', () => {
  const script = read('script.js');
  const body = script.slice(script.indexOf('function renderLiAppFilterQuestions'), script.indexOf('function renderLiControls'));

  test('only the app takes the three-question branch', () => {
    expect(script).toMatch(/if\(document\.documentElement\.classList\.contains\('orma-app'\)\)\{\s*renderLiAppFilterQuestions\(\);\s*\} else \{/);
  });

  test('how long, ground for paws and must have use the existing filter values', () => {
    ['How long?', 'Ground for paws', 'Must have', 'What kind of walk?'].forEach(label => expect(body).toContain(`tx('${label}')`));
    ["v: 'u5'", "v: '5to10'", "v: '10p'", "v: 'soft'", "v: 'mixed'", "v: 'any'"].forEach(value => expect(body).toContain(value));
    // A second tap on the chosen length goes back to any length.
    expect(body).toContain("liFilters.dist = v; }, 'any');");
  });

  test('the filter badge counts only what you chose, not where the map is looking', () => {
    expect(script).toContain("- (document.documentElement.classList.contains('orma-app') && liViewIsTheFilter() ? 1 : 0);");
  });

  test('the app gets Map, Satellite and 3D, not the phone browser\'s 3D only', () => {
    expect(script).toContain("const terrainOnly = !document.documentElement.classList.contains('orma-app')");
  });

  test('Satellite does not wait for every tile, which on a busy map never happens', () => {
    const satellite = script.slice(script.indexOf('function ensureSatelliteLayer'), script.indexOf('(function buildLayerSwitch'));
    expect(satellite).not.toContain('map.isStyleLoaded(');
    expect(satellite).toContain('} catch(err){ return false; }');
    expect(script).toContain("map.once('styledata', () => { if(ensureSatelliteLayer()) showBase(base); });");
  });

  test('trail rating and minimum match are hidden, never left switched on', () => {
    expect(body).toContain("['liRiskSeg', 'liMatchSeg'].forEach");
    expect(body).not.toMatch(/liFilters\.(risk|minMatch)\s*=/);
  });
});

describe('Record is also where a route is planned', () => {
  test('Draw a route sits beside Start walk in the app, only before a walk begins', () => {
    const walk = read('walk.html');
    expect(walk).toContain('<a class="wr-btn wr-btn--ghost wr-plan" id="wrPlan" href="route-planner.html" data-i18n="page.walk.drawRoute">Draw a route</a>');
    expect(walk).toContain('.wr-plan{display:none;}');
    expect(read('app-shell.css')).toContain('html.orma-app .wr-plan:not([hidden]){display:flex;');
    expect(read('walk-page.js')).toContain("if(els.plan) els.plan.hidden = s !== 'idle';");
  });

  test('the planner opens where Explore was looking', () => {
    expect(read('script.js')).toContain("sessionStorage.setItem('orma-explore-map-view', view)");
    expect(read('walk-page.js')).toContain("sessionStorage.getItem('orma-explore-map-view')");
  });

  test('the Record tab is lit on the recorder and the planner', () => {
    const tabbar = read('app-tabbar.js');
    expect(tabbar).toContain("const RECORD = ['walk.html', 'route-planner.html'];");
    expect(read('app-shell.css')).toContain('.app-tab--record[aria-current="page"] .app-tab-icon{background:#3E7A91;}');
  });
});
