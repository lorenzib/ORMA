const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { evaluateInto } = require('./test-support/page-runtime');

// The homepage opens on "Today's picks": three walks from the ranked list, with
// the map and the full list one press away. These run script.js the way
// homepage-filters.test.js does, with the vocabularies index.html loads before
// it, and a scoring stub whose answer each trail carries.

function tForTests(key, params = {}){
  if(key === 'safety.low') return 'Low-risk terrain';
  if(key === 'safety.moderate') return 'Moderate terrain';
  if(key === 'safety.caution') return 'Caution terrain';
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
      <section class="li-picks" id="liTodaysPicks">
        <h2 id="liPicksTitle">Today’s picks</h2>
        <div class="li-picks-list" id="liPicksList"></div>
        <button type="button" id="liSeeAllWalks" aria-expanded="false" hidden></button>
      </section>
      <div class="li-body" id="liMapList" hidden>
        <div class="li-map" id="trailMapWrap"><div id="trailMap"></div>
          <button id="liSearchThisArea" type="button" hidden>Search this area</button>
        </div>
        <aside class="li-list">
          <button type="button" id="liBackToPicks">← Back to today’s picks</button>
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

// A season record whose only good month is not this one: "Out of season" now,
// whatever month the suite runs in.
const THIS_MONTH = new Date().getMonth() + 1;
const OUT_OF_SEASON = { recommended: { months: [THIS_MONTH === 7 ? 1 : 7] } };

const DOG_RULES_UNKNOWN = [{ code: 'trail.dog-access.unknown', message: 'The current dog-access rule is unknown.' }];

function trail(id, score, extra = {}){
  return {
    id, name: `${id} walk`, region: 'dolomites', valley: 'Val Gardena', area: 'Ortisei',
    lat: 46.57, lng: 11.67, curated: true, distance: 6, elevation: 300, hours: 2.5,
    shadeCoverage: 45, terrainType: 'Mixed', safetyLevel: 'low-risk', score,
    category: 'strong-option', ...extra,
  };
}

const render = context => vm.runInContext('renderReturningHomepage(null, { skipNewMatchSync:true })', context);
const pickIds = () => [...document.querySelectorAll('#liPicksList .li-pick')].map(card => card.dataset.id);

describe('Today\'s picks', () => {
  test('three picks render as cards that open the trail page', async () => {
    const context = loadHomepage([trail('a', 95), trail('b', 92), trail('c', 90), trail('d', 88), trail('e', 86)]);
    await render(context);
    const cards = document.querySelectorAll('#liPicksList .li-pick');
    expect(cards).toHaveLength(3);
    expect(pickIds()).toEqual(['a', 'b', 'c']);
    const first = cards[0];
    expect(first.getAttribute('href')).toMatch(/^trail\.html\?id=a/);
    expect(first.querySelector('.li-pick-name').textContent).toBe('a walk');
    // km · climb · time · shade, from the list's own row meta.
    const meta = first.querySelector('.li-pick-meta').textContent;
    expect(meta).toContain('6 km');
    expect(meta).toContain('300 m climb');
    expect(meta).toContain('45% shade');
    expect(first.querySelector('.li-pick-match').textContent).toBe('Strong option');
    expect(first.querySelector('.trail-visual, .li-pick-photo')).not.toBeNull();
  });

  test('an in-season walk with known dog rules on easier terrain beats higher-ranked caution and unknown-rules walks', async () => {
    const context = loadHomepage([
      trail('caution', 99, { safetyLevel: 'caution' }),
      trail('unknown', 98, { unknowns: DOG_RULES_UNKNOWN }),
      trail('winter', 97, { season: OUT_OF_SEASON }),
      trail('care-1', 80, { category: 'possible-with-cautions' }),
      trail('care-2', 75, { category: 'possible-with-cautions', safetyLevel: 'moderate' }),
      trail('strong-low', 70),
    ]);
    await render(context);
    // The one meeting all four comes first, then in-season / known rules /
    // not caution in ranked order. The three above them in the list do not
    // make it at all.
    expect(pickIds()).toEqual(['strong-low', 'care-1', 'care-2']);
    // The list itself is untouched: ranked order, with the walk out of season
    // moved to the end as it always is.
    expect([...document.querySelectorAll('#returningTrailList .li-row')].map(row => row.dataset.id))
      .toEqual(['caution', 'unknown', 'care-1', 'care-2', 'strong-low', 'winter']);
  });

  test('preferences apply in order: season, then dog rules, then terrain', async () => {
    const context = loadHomepage([
      trail('caution', 99, { safetyLevel: 'caution' }),
      trail('unknown', 98, { unknowns: DOG_RULES_UNKNOWN }),
      trail('winter', 97, { season: OUT_OF_SEASON }),
    ]);
    await render(context);
    expect(pickIds()).toEqual(['caution', 'unknown', 'winter']);
    // The engine's own out-of-season word counts as well as the tag's.
    const engine = loadHomepage([
      trail('engine-winter', 99, { cautions: [{ code: 'trail.season.outside' }] }),
      trail('fine', 50),
      trail('fine-2', 40),
      trail('fine-3', 30),
    ]);
    await render(engine);
    expect(pickIds()).toEqual(['fine', 'fine-2', 'fine-3']);
  });

  test('falls back to the ranked order when fewer than three qualify', async () => {
    const context = loadHomepage([
      trail('w1', 99, { season: OUT_OF_SEASON, safetyLevel: 'caution' }),
      trail('w2', 98, { season: OUT_OF_SEASON }),
      trail('w3', 97, { season: OUT_OF_SEASON, unknowns: DOG_RULES_UNKNOWN }),
      trail('w4', 96, { season: OUT_OF_SEASON }),
    ]);
    await render(context);
    expect(pickIds()).toEqual(['w1', 'w2', 'w3']);

    const one = loadHomepage([
      trail('w1', 99, { season: OUT_OF_SEASON }),
      trail('w2', 98, { season: OUT_OF_SEASON }),
      trail('ok', 60),
      trail('w3', 50, { season: OUT_OF_SEASON }),
    ]);
    await render(one);
    expect(pickIds()).toEqual(['ok', 'w1', 'w2']);

    // Fewer than three walks at all: as many as there are.
    const two = loadHomepage([trail('x', 90), trail('y', 80)]);
    await render(two);
    expect(pickIds()).toEqual(['x', 'y']);
  });

  test('never picks a low match: fewer cards, or a plain message', async () => {
    const context = loadHomepage([
      trail('low-top', 99, { category: 'not-recommended' }),
      trail('good', 80),
      trail('care', 70, { category: 'possible-with-cautions' }),
      trail('low-2', 60, { category: 'not-recommended' }),
    ]);
    await render(context);
    expect(pickIds()).toEqual(['good', 'care']);
    // The list still has all four, one press away.
    expect(document.getElementById('liSeeAllWalks').textContent).toBe('See all 4 walks on the map');

    const none = loadHomepage([
      trail('low-a', 50, { category: 'not-recommended' }),
      trail('low-b', 40, { category: 'not-recommended' }),
    ]);
    await render(none);
    expect(pickIds()).toEqual([]);
    expect(document.querySelector('#liPicksList .li-empty-title').textContent).toMatch(/^No good matches/);
    expect(document.getElementById('liSeeAllWalks').hidden).toBe(false);
  });

  test('the button counts the walks the list shows', async () => {
    const trails = [trail('a', 95), trail('b', 92), trail('c', 90), trail('d', 88), trail('e', 86, { name: 'Lago walk' })];
    const context = loadHomepage(trails);
    await render(context);
    const more = document.getElementById('liSeeAllWalks');
    expect(more.hidden).toBe(false);
    expect(more.textContent).toBe('See all 5 walks on the map');
    expect(document.getElementById('companionListTitle').textContent).toBe('5 trails');

    // Narrowed by the search box: the picks and the count follow the list.
    vm.runInContext('liQuery = "lago";', context);
    await render(context);
    expect(more.textContent).toBe('See 1 walk on the map');
    expect(pickIds()).toEqual(['e']);

    // Nothing at all: the list's own empty state, and no button.
    vm.runInContext('liQuery = "nowhere";', context);
    await render(context);
    expect(more.hidden).toBe(true);
    expect(document.querySelector('#liPicksList .li-empty .li-empty-title').textContent).toBe('No trails match');
    expect(document.getElementById('liPicksEmptyReset').textContent).toBe('Reset filters');
  });

  test('the map and list open behind the button, close again, and stay as left for the session', async () => {
    const session = new Map();
    const context = loadHomepage([trail('a', 95), trail('b', 92), trail('c', 90), trail('d', 88)], session);
    await render(context);
    const body = document.getElementById('liMapList');
    const picks = document.getElementById('liTodaysPicks');
    const more = document.getElementById('liSeeAllWalks');
    // Hidden by default.
    expect(body.hidden).toBe(true);
    expect(picks.hidden).toBe(false);
    expect(document.body.classList.contains('li-picks-mode')).toBe(true);

    more.click();
    expect(body.hidden).toBe(false);
    expect(picks.hidden).toBe(true);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(session.get('orma-home-map-revealed-v1')).toBe('1');
    // A render keeps it open: the list behaves as it always did.
    await render(context);
    expect(body.hidden).toBe(false);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(4);

    document.getElementById('liBackToPicks').click();
    expect(body.hidden).toBe(true);
    expect(picks.hidden).toBe(false);
    expect(session.has('orma-home-map-revealed-v1')).toBe(false);

    // Opened once, a reload in the same session opens on the map and list.
    session.set('orma-home-map-revealed-v1', '1');
    const reloaded = loadHomepage([trail('a', 95)], session);
    await render(reloaded);
    expect(document.getElementById('liMapList').hidden).toBe(false);
    expect(document.getElementById('liTodaysPicks').hidden).toBe(true);
  });

  test('storage that throws leaves the picks working', async () => {
    const throwing = { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); }, removeItem(){ throw new Error('blocked'); } };
    const context = loadHomepage([trail('a', 95), trail('b', 92), trail('c', 90)]);
    context.sessionStorage = throwing;
    expect(vm.runInContext('liLoadMapRevealed()', context)).toBe(false);
    expect(() => vm.runInContext('liSetMapRevealed(true)', context)).not.toThrow();
    expect(document.getElementById('liMapList').hidden).toBe(false);
  });

  test('going back to the picks leaves a map area, so the headline names the place again', async () => {
    const context = loadHomepage([trail('a', 95), trail('b', 92), trail('c', 90)]);
    vm.runInContext(`liSetLocationContext({ kind:"area", country:"IT", region:"dolomites",
      valley:"Val Gardena", label:"Val Gardena" });`, context);
    vm.runInContext('liSetMapRevealed(true);', context);
    context.__view = { getWest:() => 11.5, getSouth:() => 46.5, getEast:() => 11.8, getNorth:() => 46.7 };
    await vm.runInContext('liApplyMapViewport(__view);', context);
    expect(vm.runInContext('liLocationContext.kind', context)).toBe('map');

    vm.runInContext('liSetMapRevealed(false);', context);
    expect(vm.runInContext('liLocationContext.kind', context)).toBe('area');
    expect(vm.runInContext('liLocationContext.label', context)).toBe('Val Gardena');
    expect(document.getElementById('liToolbarGreeting').textContent).toContain('Val Gardena');
    expect(document.getElementById('liToolbarGreeting').textContent).not.toMatch(/map view/i);
  });

  test('a folded-away map never sets the place from its own movement', () => {
    const source = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    const moveend = source.slice(source.indexOf("trailMapInstance.on('moveend', event => {\n      const signature"));
    expect(moveend.slice(0, 900)).toContain('if(!liMapRevealed){ lastMapView = signature; return; }');
    // The first moveend, when the map finishes loading, is compared with
    // where the map started, not with nothing, so it is not read as a pan.
    expect(source).toContain('let lastMapView = liMapViewSignature(trailMapInstance);');
    expect(source).not.toContain("let lastMapView = '';");
    // The page's own framing is tagged, so a late fit is never read as a pan.
    expect(moveend.slice(0, 900)).toContain('if(event && event.liAutoFrame){ lastMapView = signature; return; }');
    expect(source).toContain("trailMapInstance.fitBounds(bounds, { padding: 40, maxZoom: 12 }, { liAutoFrame:true });");
    // And the phone layout does not start the map until it is asked for.
    const mobile = source.slice(source.indexOf('function startMobileTrailMap()'), source.indexOf('function pathThumbnailSvg('));
    expect(mobile).toContain('if(!liMapRevealed) return Promise.resolve(null);');
  });

  test('the new words are in Italian', () => {
    const phrases = fs.readFileSync(path.join(__dirname, 'i18n-phrases-it.js'), 'utf8');
    const dictionary = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    expect(phrases).toContain('"See all {n} walks on the map": "Vedi tutte le {n} passeggiate sulla mappa"');
    expect(phrases).toContain('"See 1 walk on the map": "Vedi 1 passeggiata sulla mappa"');
    expect(dictionary).toContain("'page.index.todaysPicks': 'Le scelte di oggi'");
    expect(dictionary).toContain("'page.index.backToTodaysPicks': '← Torna alle scelte di oggi'");
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    expect(html).toContain('data-i18n="page.index.todaysPicks">Today’s picks</h2>');
    expect(html).toContain('data-i18n="page.index.backToTodaysPicks">← Back to today’s picks</button>');
    // The map and list start folded away, after the picks.
    expect(html).toMatch(/<div class="li-body" id="liMapList" hidden>/);
    expect(html.indexOf('id="liTodaysPicks"')).toBeLessThan(html.indexOf('id="liMapList"'));
    expect(html.indexOf('id="liToolbar"')).toBeLessThan(html.indexOf('id="liTodaysPicks"'));
  });
});
