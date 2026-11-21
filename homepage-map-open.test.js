const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { evaluateInto } = require('./test-support/page-runtime');

// The homepage opens on the map and the full ranked list, with no button in
// front of them (owner, 20 November 2026: one map, always open, on the
// homepage and the Trails page). These run script.js the way
// homepage-filters.test.js does, with the vocabularies index.html loads before
// it, and a scoring stub whose answer each trail carries.

function tForTests(key, params = {}){
  if(key === 'safety.low') return 'Low risk';
  if(key === 'safety.moderate') return 'Moderate risk';
  if(key === 'safety.caution') return 'Higher risk';
  if(key === 'home.noTrailsValley') return `No trails in ${params.label}`;
  if(key === 'home.noSaved') return 'No saved trails';
  return key;
}

function storageFrom(map){
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
  };
}

function loadHomepage(testTrails, session = new Map()){
  document.body.innerHTML = `
    <div id="returningCustomerHomepage">
      <div id="liToolbar">
        <span id="liLocationSummary"><small id="liLocationSummaryKick"></small><strong id="liLocationSummaryLabel"></strong></span>
        <div id="liLocationNudge" hidden><strong id="liLocationNudgeTitle"></strong><small id="liLocationNudgeDetail"></small><button id="liLocationNudgeBtn"></button><button id="liLocationNudgeDismiss"></button></div>
        <input id="liRecommendationDate" type="date">
        <strong id="liToolbarGreeting"></strong>
        <div class="li-search"><input id="liSearch"><div id="liSearchSuggest" hidden></div></div>
        <button id="liFiltersBtn"></button><div id="liFiltersMenu" hidden></div>
      </div>
      <div class="li-body" id="liMapList" hidden>
        <div class="li-map" id="trailMapWrap"><div id="trailMap"></div>
          <button id="liSearchThisArea" type="button" hidden>Search this area</button>
        </div>
        <aside class="li-list">
          <h2 id="companionListTitle"></h2><span id="companionListCount"></span>
          <button id="liShowAllTrails" type="button" hidden>Show all trails</button>
          <div id="returningTrailList"></div>
        </aside>
      </div>
    </div>
    <div id="liChips"></div>
    <h1 id="returningHeading"></h1>
    <div class="li-new-wrap"><button id="liNewBtn"></button>
      <div id="liNewMenu" hidden><a class="li-plan-route" href="route-planner.html">Draw a route</a></div></div>
    <button id="liAccountBtn"></button><div id="liAccountMenu" hidden><div id="liRecentList"></div></div>
    <button id="liSortBtn" aria-expanded="false"><span id="liSortValue">Best fit</span></button>
    <div id="liSortMenu" hidden><button data-li-sort="match" aria-checked="true">Best fit</button></div>
    <button id="liReasonsToggle" aria-pressed="false"><span class="li-reasons-word">Hide reasons</span></button>
    <button id="liViewSaved" aria-pressed="false"><span id="liSavedOnlyCount"></span></button>
    <span id="liDogCtxName"></span><span id="liDogCtxBreedSep" hidden></span><a id="liDogCtxBreed" hidden></a>
    <span id="liToolbarDogContext"></span><span id="liAccountName"></span><span id="liAccountAvatar"></span>
    <span id="liGreetAvatar"></span><span id="liDogCtxAvatar"></span>
    <div id="liDogList"></div><div id="liGreetDogList"></div><a id="liManageLink"></a><a id="liGreetManageLink"></a>
  `;

  const context = {
    console, setTimeout, clearTimeout, URLSearchParams, Promise,
    module: {}, exports: {},
    localStorage: storageFrom(new Map()),
    sessionStorage: storageFrom(session),
    navigator: { userAgent: 'jest' },
    location: { search: '', pathname: '/' },
    document,
    fetch: jest.fn(),
    trails: testTrails,
    t: tForTests,
    // Each trail carries the engine's answer for it.
    recommendTrail: jest.fn(trail => ({
      scoringVersion: 'test',
      score: trail.score,
      category: trail.category || 'possible-with-cautions',
      confidence: 'high',
      positiveReasons: [],
      cautions: trail.cautions || [],
      unknowns: trail.unknowns || [],
      hardStops: [],
      factors: [],
    })),
    effectiveOverrides: () => ({ terrain: '1', distance: '10', heatSensitive: false }),
    pathThumbnailSvg: () => '',
    requestAnimationFrame: fn => fn(),
    window: null,
    globalThis: null,
    addEventListener: () => {},
    dispatchEvent: () => {},
  };
  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'regions-config.js'), 'utf8'), context);
  evaluateInto(source => vm.runInContext(source, context), 'index.html', [
    'trust/evidence-v1.js', 'match-verdict.js', 'recommendation-decision.js', 'trail-season-words.js',
  ]);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8'), context);
  vm.runInContext('liLocationContext = { kind:"catalogue" }; activeCountry = "all"; activeRegion = "all"; activeValley = "all"; initLoggedInShell();', context);
  return context;
}

function trail(id, score, extra = {}){
  return {
    id, name: `${id} walk`, region: 'dolomites', valley: 'Val Gardena', area: 'Ortisei',
    lat: 46.57, lng: 11.67, curated: true, distance: 6, elevation: 300, hours: 2.5,
    shadeCoverage: 45, terrainType: 'Mixed', safetyLevel: 'low-risk', score,
    category: 'strong-option', ...extra,
  };
}

const render = context => vm.runInContext('renderReturningHomepage(null, { skipNewMatchSync:true })', context);

describe('the homepage map and list are always open', () => {
  test('the map and the full list show on load, with no button in front of them', async () => {
    const context = loadHomepage([trail('a', 95), trail('b', 92), trail('c', 90), trail('d', 88)]);
    await render(context);
    expect(document.getElementById('liMapList').hidden).toBe(false);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(4);
    expect(document.getElementById('companionListTitle').textContent).toBe('4 trails');
  });

  test('the page has no picks band, no "See all" button and no way back to picks', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    expect(html).not.toContain('liTodaysPicks');
    expect(html).not.toContain('liSeeAllWalks');
    expect(html).not.toContain('liBackToPicks');
    const source = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    expect(source).not.toContain('liMapRevealed');
    expect(source).not.toContain('orma-home-map-revealed-v1');
  });

  test('the map never reads its own framing as the reader moving it', () => {
    const source = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    const moveend = source.slice(source.indexOf("trailMapInstance.on('moveend', event => {\n      const signature"));
    // The first moveend, when the map finishes loading, is compared with
    // where the map started, not with nothing, so it is not read as a pan.
    expect(source).toContain('let lastMapView = liMapViewSignature(trailMapInstance);');
    expect(source).not.toContain("let lastMapView = '';");
    // The page's own framing is tagged, so a late fit is never read as a pan.
    expect(moveend.slice(0, 900)).toContain('if(event && event.liAutoFrame){ lastMapView = signature; return; }');
    expect(source).toContain("trailMapInstance.fitBounds(bounds, { padding: 40, maxZoom: 12 }, { liAutoFrame:true });");
  });
});
