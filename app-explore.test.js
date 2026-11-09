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

  test('Layers and Terrain end up side by side, even when the map adds them late', async () => {
    document.body.innerHTML = '<div id="trailMap"></div>';
    run();
    const map = document.getElementById('trailMap');
    const layers = document.createElement('button');
    layers.className = 'map-btn';
    layers.textContent = 'Layers';
    const panel = document.createElement('div');
    panel.className = 'map-panel';
    map.append(layers, panel);
    const terrain = document.createElement('div');
    terrain.className = 'td-layer-switch td-layer-switch--home td-layer-switch--terrain-only';
    map.appendChild(terrain);
    await Promise.resolve();
    const tools = map.querySelector(':scope > .app-map-tools');
    expect(tools).not.toBeNull();
    expect([...tools.children]).toEqual([layers, terrain]);
    // The Layers panel stays where script.js put it.
    expect(panel.parentElement).toBe(map);
  });

  test('ships in the app on index.html only, and Draw a route leaves the map', () => {
    expect(APP_EXPLORE_TAG).toBe('<script src="/app-explore.js" defer></script>');
    expect(collectAppFiles().files.has('app-explore.js')).toBe(true);
    expect(read('scripts/build-app.js')).toContain("${r === 'index.html' ? `${APP_EXPLORE_TAG}\\n` : ''}");
    expect(read('_config.yml')).toMatch(/^\s+- app-explore\.js$/m);
    expect(read('index.html')).not.toContain('app-explore.js');
    const shell = read('app-shell.css');
    expect(shell).toContain('html.orma-app #homeMapDrawBtn{display:none !important;}');
    expect(shell).toContain('html.orma-app .li-map.map-layers-open .li-search-area{display:none;}');
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

  test('trail rating and minimum match are hidden, never left switched on', () => {
    expect(body).toContain("['liRiskSeg', 'liMatchSeg'].forEach");
    expect(body).not.toMatch(/liFilters\.(risk|minMatch)\s*=/);
  });
});

describe('Record is also where a route is planned', () => {
  test('Plan a route sits beside Start walk in the app, only before a walk begins', () => {
    const walk = read('walk.html');
    expect(walk).toContain('<a class="wr-btn wr-btn--ghost wr-plan" id="wrPlan" href="route-planner.html"');
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
