const fs = require('fs');
const path = require('path');
const vm = require('vm');

function tForTests(key, params = {}){
  if(key === 'areas.allValleys') return 'All valleys';
  if(key === 'region.savoy') return 'Savoy';
  if(key === 'region.theDolomites') return 'the Dolomites';
  if(key === 'region.dolomites') return 'Dolomites';
  if(key === 'home.bubble') return 'Where are we heading today?';
  if(key === 'home.pickArea') return `Pick a valley below, trails are ranked for ${params.name || 'your dog'}.`;
  if(key === 'home.pickAreaNoName') return 'Pick a valley below, trails are ranked for your dog.';
  if(key === 'home.nTrails') return `${params.n} ${params.n === 1 ? 'trail' : 'trails'}`;
  if(key === 'home.nSaved') return `${params.n} saved trails`;
  if(key === 'home.nSaved1') return '1 saved trail';
  if(key === 'home.savedTrails') return 'Saved trails';
  if(key === 'home.allTrailsBtn') return '← All trails';
  if(key === 'home.editProfile') return 'Edit profile';
  if(key === 'home.noSaved') return 'No saved trails';
  if(key === 'home.noSavedValley') return `No saved trails in ${params.label}`;
  if(key === 'home.noTrailsValley') return `No trails in ${params.label}`;
  if(key === 'safety.low') return 'Low';
  if(key === 'safety.moderate') return 'Moderate';
  if(key === 'safety.caution') return 'Caution';
  if(key === 'page.of') return `${params.a}/${params.b}`;
  if(key === 'page.prev') return 'Prev';
  if(key === 'page.next') return 'Next';
  if(key === 'home.fitLine') return '';
  if(key === 'card.trailRef') return '';
  if(key === 'card.details') return 'Details';
  if(key === 'card.locate') return 'Locate';
  if(key === 'card.save') return 'Save';
  if(key === 'card.saved') return 'Saved';
  if(key === 'card.matchWord') return 'match';
  if(key === 'card.estimated') return 'estimated';
  if(key === 'badge.verified') return 'VERIFIED';
  if(key === 'badge.imported') return 'IMPORTED';
  if(key === 'badge.new') return 'NEW';
  return key;
}

function loadHomepageContext(testTrails){
  document.body.innerHTML = `
    <section id="liLocationGate"><span id="liLocationDogName"></span><p id="liLocationStatus"></p>
      <button id="liUseLocationBtn"><span>Use my location</span></button>
      <button id="liChooseAreaBtn"></button>
      <form id="liAreaPicker">
        <input id="liAreaSearch" list="liAreaSuggestions"><datalist id="liAreaSuggestions"></datalist>
        <select id="liAreaCountry"><option value="">Choose country</option></select>
        <select id="liAreaRegion"><option value="">Choose region</option></select>
        <select id="liAreaSelect"><option value="">Choose valley</option></select>
        <input id="liWalkDate" type="date"><button id="liAreaSubmit" type="submit"></button>
      </form>
    </section>
    <div id="liToolbar"><span id="liLocationSummary"><strong id="liLocationSummaryLabel"></strong><button id="liChangeLocationBtn"></button></span>
      <input id="liRecommendationDate" type="date"><button id="liAdjustRecommendationBtn"></button>
      <strong id="liTodayTitle"></strong><span id="liTodayDetail"></span><div id="liToday" hidden></div>
    </div>
    <div class="li-body"></div>
    <div class="li-search"><input id="liSearch"><div id="liSearchSuggest" hidden></div></div>
    <div id="liChips"></div>
    <div class="li-new-wrap"><button id="liNewBtn"></button>
      <div id="liNewMenu" hidden>
        <a class="li-plan-route" href="route-planner.html">Draft a loop</a>
        <a class="li-record" id="liRecordBtn" href="walk.html">Record a walk</a>
      </div></div>
    <button id="liFiltersBtn"></button><div id="liFiltersMenu" hidden></div>
    <button id="liAccountBtn"></button><div id="liAccountMenu" hidden></div>
    <button id="liViewAll" class="active"></button>
    <button id="liViewSaved"><span id="liSavedOnlyCount"></span></button>
    <span id="liDogCtxName"></span>
    <span id="liDogCtxBreedSep" hidden></span>
    <a id="liDogCtxBreed" href="guides/breed-group-caveats.html" hidden></a>
    <strong id="liToolbarGreeting"></strong>
    <span id="liToolbarDogContext"></span>
    <span id="liAccountName"></span>
    <span id="liAccountAvatar"></span>
    <span id="liGreetAvatar"></span>
    <span id="liDogCtxAvatar"></span>
    <div id="liDogList"></div>
    <div id="liGreetDogList"></div>
    <a id="liManageLink"></a>
    <a id="liGreetManageLink"></a>
    <h1 id="returningHeading"></h1>
    <span id="companionKicker"></span><div id="companionListTitle"></div>
    <p id="returningSubline"></p>
    <div id="returningTrailList"></div>
    <button id="savedTrailsBtn"></button>
    <button id="adjustToggle"></button>
    <div id="adjustPanel"></div>
    <button id="adjustCloseBtn"></button>
  `;

  const context = {
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Promise,
    module: {},
    exports: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    navigator: { userAgent: 'jest' },
    location: { search: '' },
    document,
    fetch: jest.fn(),
    trails: testTrails,
    t: tForTests,
    scoreTrail: () => 80,
    recommendTrail: jest.fn(() => ({
      scoringVersion: '1.5.0',
      score: 80,
      category: 'possible-with-cautions',
      confidence: 'low',
      positiveReasons: [],
      cautions: [],
    })),
    effectiveOverrides: () => ({ terrain: '1', distance: '10', heatSensitive: false }),
    pathThumbnailSvg: () => '',
    matchColor: () => '#2E4034',
    SAFETY_DOT: { 'low-risk': '#4a7', moderate: '#d9a441', caution: '#d16a6a' },
    maplibregl: {
      LngLatBounds: function LngLatBounds(){ this.extend = () => this; },
      Popup: function Popup(){ return { setHTML(){ return this; } }; },
      Marker: function Marker(){ return { setLngLat(){ return this; }, setPopup(){ return this; }, addTo(){ return this; }, getElement(){ return { style: {}, addEventListener: () => {} }; }, togglePopup: () => {} }; },
    },
    window: null,
    globalThis: null,
    addEventListener: () => {},
  };
  context.window = context;
  context.globalThis = context;
  context.window.location = context.location;
  context.window.addEventListener = () => {};

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'regions-config.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8'), context);
  // Existing filter tests exercise catalogue refinements in isolation. The
  // real product never creates this synthetic context; it prevents these
  // unit tests from accidentally depending on a particular mountain area.
  vm.runInContext('liLocationContext = { kind:"catalogue" };', context);
  return context;
}

describe('returning homepage region + valley filters', () => {
  const sampleTrails = [
    { id: 'mau', name: 'Maurienne Trail', region: 'savoy', valley: 'Maurienne', area: 'Modane', lat: 45.2, lng: 6.6, curated: true, distance: 6, elevation: 300, hours: 3, terrainType: 'Mixed', safetyLevel: 'low-risk' },
    { id: 'tar', name: 'Tarentaise Trail', region: 'savoy', valley: 'Tarentaise – Vanoise', area: 'Tignes', lat: 45.46, lng: 6.9, curated: true, distance: 9, elevation: 500, hours: 4, terrainType: 'Mixed', safetyLevel: 'moderate' },
    { id: 'cha', name: 'Chamonix Trail', region: 'savoy', valley: 'Chamonix – Mont Blanc', area: 'Chamonix', lat: 45.92, lng: 6.86, curated: false, distance: 7, elevation: 450, hours: 3.2, terrainType: 'Mixed', safetyLevel: 'moderate' },
    { id: 'vag', name: 'Val Gardena Trail', region: 'dolomites', valley: 'Val Gardena', area: 'Ortisei', lat: 46.57, lng: 11.67, curated: true, distance: 6, elevation: 320, hours: 3, terrainType: 'Mixed', safetyLevel: 'low-risk' },
    { id: 'pri', name: 'Primiero Trail', region: 'dolomites', valley: 'Primiero – Pale', area: 'San Martino', lat: 46.26, lng: 11.80, curated: true, distance: 7, elevation: 400, hours: 3.5, terrainType: 'Rocky', safetyLevel: 'moderate' },
  ];

  test('does not expose source review status as a user filter', () => {
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    expect(script).not.toContain('activeProvenance');
    expect(script).not.toContain('data-prov');
    expect(html).not.toContain('id="areaFilterRow"');
    expect(html).not.toContain('Under review');
  });

  test('the search box narrows the ranked list by trail name', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "all"; activeRegion = "all"; activeValley = "all"; liQuery = "chamonix";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
    expect(document.querySelector('#returningTrailList .li-row-name').textContent).toBe('Chamonix Trail');
  });

  test('typing a region or country name filters the list like the old dropdown', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "all"; activeRegion = "all"; activeValley = "all"; liQuery = "savoy";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    // The three Savoy trails match on their region label alone.
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(3);
    vm.runInContext('liQuery = "italy";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(2);
  });

  test('the Saved view tab reflects and filters saved trails', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('currentFavorites = { vag: true }; showingSavedOnly = true; activeRegion = "all"; renderLiSavedControl();', context);
    expect(document.getElementById('liViewSaved').getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('liViewAll').getAttribute('aria-selected')).toBe('false');
    expect(document.getElementById('liSavedOnlyCount').textContent).toBe('1');
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
  });

  test('the map viewport ("Search this area") narrows the list to its bounds', async () => {
    const context = loadHomepageContext(sampleTrails);
    // A bounds box around the Dolomites sample only; contains() is the real test.
    vm.runInContext(`activeCountry = "all"; activeRegion = "all"; activeValley = "all";
      liMapBounds = { contains: ([lng, lat]) => lat > 46 && lng > 11 };`, context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(2);
  });

  test('hides multi-day itineraries by default and reveals them with the Duration filter', async () => {
    const withLongRoute = sampleTrails.concat([
      { id: 'alpago', name: 'Sentiero Alpago Natura', region: 'dolomites', valley: 'Val Gardena', area: 'Alpago', lat: 46.15, lng: 12.35, curated: false, distance: 71.2, elevation: 3200, hours: 22, terrainType: 'Rocky', safetyLevel: 'moderate' },
    ]);
    const context = loadHomepageContext(withLongRoute);
    vm.runInContext('activeCountry = "all"; activeRegion = "all"; activeValley = "all"; liQuery = "";', context);
    // Default day-hike view: the 71 km route is out, the five day hikes remain.
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(5);
    expect(document.body.textContent).not.toContain('Sentiero Alpago Natura');
    // Switching Duration to multi-day shows only the long itinerary.
    vm.runInContext('liFilters.duration = "multi";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
    expect(document.querySelector('#returningTrailList .li-row-name').textContent).toBe('Sentiero Alpago Natura');
  });

  test('the Duration chip counts as active only when set to multi-day', () => {
    const context = loadHomepageContext(sampleTrails);
    expect(vm.runInContext('liFilters.duration', context)).toBe('day');
    const baseCount = vm.runInContext('liActiveFilterCount()', context);
    vm.runInContext('liFilters.duration = "multi";', context);
    expect(vm.runInContext('liActiveFilterCount()', context)).toBe(baseCount + 1);
  });

  test('turns the active dog into useful greeting and ranking context', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('renderLiToolbarContext({ name: "Eddie", breed: "Podenco Andaluz" });', context);
    expect(document.getElementById('liDogCtxName').textContent).toBe('Eddie');
    expect(document.getElementById('liDogCtxBreed').textContent).toBe('Podenco Andaluz');
    expect(document.getElementById('liDogCtxBreed').hidden).toBe(false);
    expect(document.getElementById('liDogCtxBreed').getAttribute('href')).toBe('guides/breed-group-caveats.html');
    expect(document.getElementById('liToolbarGreeting').textContent).toBe('Where are we going today, Eddie?');
    expect(document.getElementById('liToolbarDogContext').textContent).toBe('Trails ranked for Eddie’s needs and your current choices.');
    expect(document.getElementById('liToolbarDogContext').textContent).not.toContain('Podenco Andaluz');
  });

  test('keeps the cached active dog when a profile read transiently returns null', async () => {
    const context = loadHomepageContext(sampleTrails);
    context.localStorage.getItem = key => key === 'dolopaws-profile-summary'
      ? JSON.stringify({ hasProfile:true, activeDogId:'teo', name:'Teo', dogs:[{ id:'teo', name:'Teo', breed:'Mutt', fitness:'moderate' }] })
      : null;
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('liAccountName').textContent).toBe('Teo');
    expect(document.getElementById('liDogCtxName').textContent).toBe('Teo');
    expect(document.querySelector('.li-match-lbl').textContent).toBe('Match for Teo');
    expect(document.querySelector('.li-match').getAttribute('title').length).toBeGreaterThan(10);
    expect(document.querySelector('.li-match-reason')).toBeNull();
  });

  test('opens the active dog editor from the dog row and both manage links', () => {
    const context = loadHomepageContext(sampleTrails);
    context.localStorage.getItem = key => key === 'dolopaws-profile-summary'
      ? JSON.stringify({ hasProfile:true, activeDogId:'teo', dogs:[{ id:'teo', name:'Teo', breed:'Mutt', fitness:'moderate' }] })
      : null;
    vm.runInContext('renderLiHeader({ id:"teo", name:"Teo", breed:"Mutt", fitness:"moderate" });', context);

    expect(document.getElementById('liManageLink').getAttribute('href')).toBe('account.html?dog=teo&next=%2F');
    expect(document.getElementById('liGreetManageLink').getAttribute('href')).toBe('account.html?dog=teo&next=%2F');
    document.querySelector('#liDogList .nav-dogmenu-row').click();
    expect(context.location.href).toBe('account.html?dog=teo&next=%2F');
  });

  test('a ?region deep link still scopes the list to that region', async () => {
    const context = loadHomepageContext(sampleTrails);
    // The dropdown is gone, but the underlying region state (set from a deep
    // link) still filters, so /?region=savoy opens on the Savoy trails.
    vm.runInContext('activeCountry = "FR"; activeRegion = "savoy"; activeValley = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(3);
  });

  test('an explicit catalogue test scope returns the full loaded catalogue', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "all"; activeRegion = "all"; activeValley = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(5);
  });

  test('does not score or show global recommendations before geography is explicit', async () => {
    const context = loadHomepageContext(sampleTrails);
    context.recommendTrail.mockClear();
    vm.runInContext('liLocationContext = null;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);

    expect(document.getElementById('liLocationGate').hidden).toBe(false);
    expect(document.getElementById('liToolbar').hidden).toBe(true);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(0);
    expect(context.recommendTrail).not.toHaveBeenCalled();
  });

  test('current location limits recommendations to trails within 25 km', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = { kind:"current", lat:46.57, lng:11.67, radiusKm:25 }; activeCountry="all"; activeRegion="all"; activeValley="all";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);

    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Your location · within 25 km');
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
    expect(document.querySelector('#returningTrailList .li-row-name').textContent).toBe('Val Gardena Trail');
  });

  test('a manually chosen valley becomes the geographic recommendation scope', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = { kind:"area", region:"savoy", valley:"Maurienne", label:"Maurienne" }; activeCountry="FR"; activeRegion="savoy"; activeValley="Maurienne";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);

    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Maurienne');
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
    expect(document.querySelector('#returningTrailList .li-row-name').textContent).toBe('Maurienne Trail');
  });

  test('shows Alta Pusteria without the Tre Cime qualifier in homepage location copy', async () => {
    const altaPusteriaTrail = {
      ...sampleTrails[0],
      id:'alta-pusteria',
      name:'Alta Pusteria Trail',
      valley:'Alta Pusteria – Tre Cime',
    };
    const context = loadHomepageContext([altaPusteriaTrail]);
    vm.runInContext('liPopulateAreaPicker(); liLocationContext = { kind:"area", country:"IT", region:"dolomites", valley:"Alta Pusteria – Tre Cime", label:"Alta Pusteria – Tre Cime" }; activeCountry="IT"; activeRegion="dolomites"; activeValley="Alta Pusteria – Tre Cime";', context);
    await vm.runInContext('renderReturningHomepage({ name:"Teo" });', context);

    const areaLabels = [...document.querySelectorAll('#liAreaSuggestions option')].map(option => option.value);
    expect(areaLabels).toContain('Alta Pusteria');
    expect(areaLabels).not.toContain('Alta Pusteria – Tre Cime');
    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Alta Pusteria');
    expect(document.getElementById('returningHeading').textContent).toMatch(/^Best walk for Teo in Alta Pusteria /);
    expect(document.getElementById('returningHeading').textContent).not.toContain('Tre Cime');
  });

  test('searching for a destination sets a complete recommendation scope', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = null; liRenderLocationContext(null); initLoggedInShell();', context);
    const search = document.getElementById('liAreaSearch');
    search.value = 'Savoy';
    search.dispatchEvent(new Event('input', { bubbles:true }));
    expect(document.getElementById('liAreaSubmit').disabled).toBe(false);

    document.getElementById('liAreaPicker').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    await Promise.resolve();
    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Savoy');
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(3);
  });

  test('leads with three explained top picks and names alternatives after them', async () => {
    // Five in-scope trails so the top three picks and the "Other good fits"
    // alternatives both render.
    const dolomitesFive = Array.from({ length: 5 }, (_, i) => ({
      id: `dol${i}`, name: `Dolomite Trail ${i}`, region: 'dolomites', valley: 'Val Gardena',
      area: 'Ortisei', lat: 46.57 + i / 100, lng: 11.67, curated: true, distance: 6,
      elevation: 320, hours: 3, terrainType: 'Mixed', safetyLevel: 'low-risk',
    }));
    const context = loadHomepageContext(dolomitesFive);
    context.recommendTrail.mockImplementation(() => ({
      scoringVersion:'1.5.0', score:86, category:'recommended', confidence:'high',
      positiveReasons:[{ message:'The distance suits Teo’s normal range.' }],
      cautions:[{ message:'Bring water for the exposed middle section.' }],
      hardStops:[], unknowns:[],
    }));
    vm.runInContext('liLocationContext = { kind:"area", country:"IT", region:"dolomites", valley:"all", label:"Dolomites" };', context);
    await vm.runInContext('renderReturningHomepage({ name:"Teo" });', context);

    expect(document.getElementById('returningHeading').textContent).toMatch(/^Best walk for Teo in Dolomites /);
    // The first three cards are co-equal, fully explained answer cards.
    const rows = document.querySelectorAll('#returningTrailList .li-row');
    expect([...rows].slice(0, 3).every(row => row.classList.contains('li-row--answer'))).toBe(true);
    expect(document.querySelectorAll('#returningTrailList .li-row--answer')).toHaveLength(3);
    expect(document.querySelectorAll('.li-answer-explanation')).toHaveLength(3);
    expect(document.querySelector('.li-answer-explanation').textContent).toContain('Why it fits Teo');
    expect(document.querySelector('.li-answer-explanation').textContent).toContain('What to know today');
    // The alternatives heading follows the three picks, before the fourth card.
    expect(document.querySelector('.li-alternatives-heading').textContent).toContain('Other good fits');
    expect(rows[3].classList.contains('li-row--answer')).toBe(false);
  });

  test('a future date is reflected in the recommendation instead of being labelled today', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = { kind:"area", country:"FR", region:"savoy", valley:"all", label:"Savoy" }; liSetWalkDate(liDateOffsetIso(1));', context);
    await vm.runInContext('renderReturningHomepage({ name:"Teo" });', context);

    expect(document.getElementById('returningHeading').textContent).toMatch(/^Best walk for Teo in Savoy /);
    expect(document.getElementById('returningHeading').textContent).not.toContain(' today');
    expect(document.getElementById('liRecommendationDate').value).toBe(vm.runInContext('liDateOffsetIso(1)', context));
  });

  test('requests browser location only after a click and opens the area fallback when denied', () => {
    const context = loadHomepageContext(sampleTrails);
    const getCurrentPosition = jest.fn();
    context.navigator.geolocation = { getCurrentPosition };
    vm.runInContext('liLocationContext = null; initLoggedInShell();', context);

    expect(getCurrentPosition).not.toHaveBeenCalled();
    document.getElementById('liUseLocationBtn').click();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    const onError = getCurrentPosition.mock.calls[0][1];
    onError({ code:1 });
    expect(document.getElementById('liLocationStatus').textContent).toContain('Location access is off');
    expect(document.getElementById('liAreaPicker').hidden).toBe(false);
    expect(document.getElementById('liChooseAreaBtn').getAttribute('aria-expanded')).toBe('true');
  });

});

describe('map-first returning homepage layout contract', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  const mobileCss = fs.readFileSync(path.join(__dirname, 'homepage-mobile.css'), 'utf8');
  const mobileJs = fs.readFileSync(path.join(__dirname, 'homepage-mobile.js'), 'utf8');

  test('integrates the greeting and one filters control into the compact toolbar', () => {
    expect(html).toContain('class="li-toolbar-greet"');
    expect(html).toContain('id="liToolbarDogContext"');
    expect(html).toContain('id="liFiltersWrap"');
    // The three geography dropdowns are replaced by the unified search box and
    // the map. Saved moves from the toolbar to a view tab beside Sort.
    expect(html).toContain('id="liNewBtn"');
    expect(html).toContain('id="liViewSaved"');
    expect(html).not.toContain('id="liCountryWrap"');
    expect(html).not.toContain('id="liRegionWrap"');
    expect(html).not.toContain('id="liValleyWrap"');
    expect(html).not.toContain('id="liSavedOnlyBtn"');
    expect(html).not.toContain('id="liShadeSeg"');
    expect(html).not.toContain('id="hpShadeSeg"');
    expect(html).toContain('id="liCollapseTrailsBtn"');
    expect(html).not.toContain('id="liShowTrailsBtn"');
    expect(html).not.toContain('id="liCollapseMapBtn"');
    expect(html).toContain('Tailored to');
    expect(html).toContain('id="liDogCtxBreed"');
    expect(html).not.toContain('id="liDogCtxBtn"');
    expect(html).not.toContain('Live GPS &amp; safety');
    expect(html).toContain('id="liSearchSuggest"');
    expect(html).not.toContain('id="liFiltersWrap" class="li-menuwrap li-mobile-only"');
    expect(css).toMatch(/\.li-greetbar\{\s*display:none;/);
    expect(css).toMatch(/\.li-chiprow\{display:none;/);
  });

  test('opens returning-home search results through the dynamic trail detail route', () => {
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    expect(script).toContain('renderLiSearchSuggestions(currentProfileForAdjust)');
    expect(script).toContain('window.location.href = `trail.html?id=${encodeURIComponent(trail.id)}&from=${encodeURIComponent(window.location.pathname + window.location.search)}`');
    expect(script).not.toContain('focusMapOnTrail(trail.id, matches)');
    expect(script).not.toContain("search.addEventListener('focus', () => {\n      window.location.href = 'search.html");
  });

  test('keeps the public network neutral and uses match score for ORMA routes and markers', () => {
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    const routeLayerStart = script.indexOf("id: 'trail-paths-line'");
    const routeLayerEnd = script.indexOf("id: 'trail-paths-hit'", routeLayerStart);
    const routeLayer = script.slice(routeLayerStart, routeLayerEnd);
    const markerLayerStart = script.indexOf("id: 'trail-unclustered'");
    const markerLayer = script.slice(markerLayerStart);
    expect(routeLayer).toContain("'line-color': '#858D88'");
    expect(routeLayer).toContain("matchColourExpression('score')");
    expect(routeLayer).not.toContain("['get', 'safetyLevel']");
    expect(markerLayer).toContain("matchColourExpression('score')");
    expect(script).toContain('Where are we going today, ${profile.name}?');
    expect(script).toContain('Trails ranked for ${profile.name}\\u2019s needs');
    expect(script).not.toContain('trails scored`');
  });

  test('keeps Record walk in the discovery toolbar and defaults mobile results to the low snap', () => {
    const toolbarStart = html.indexOf('<div class="li-toolbar" id="liToolbar">');
    const record = html.indexOf('id="liRecordBtn"');
    const toolbarEnd = html.indexOf('<!-- ================= BODY:', toolbarStart);
    expect(record).toBeGreaterThan(toolbarStart);
    expect(record).toBeLessThan(toolbarEnd);
    expect(html.indexOf('class="li-plan-route"')).toBeLessThan(record);
    expect(html).not.toContain('id="liRecordFab"');
    expect(html).not.toContain('class="li-pane-toggle"');
    expect(html).not.toContain('<details class="li-legend">');
    expect(html).not.toContain('Map key');
    // The sheet opens at the middle snap. It used to open at the lowest, which
    // gives the list ~50px while the card at the top of it -- the whole point
    // of the page -- is over 400px tall, so the recommendation arrived as a
    // sliver. The map still has most of the screen and both neighbouring
    // snaps are one drag away.
    expect(mobileJs).toContain('var SHEET_INITIAL = SNAPS[2];');
    expect(mobileJs).toContain('var sheetPct = SHEET_INITIAL;');
    expect(mobileJs).toContain('var lastOpenPct = SHEET_INITIAL;');
    // The CSS height is what renders before the script measures one, so a
    // mismatch here is a visible jump on load.
    expect(mobileCss).toContain('height:35dvh');
    expect(mobileCss).not.toContain('26dvh');
  });

  test('uses a deliberate mobile filter row and compact map controls', () => {
    expect(html).toContain('<div class="li-mobile-actions" aria-label="Trail actions">');
    expect(mobileCss).toContain('body.mhome-active .li-toolbar-greet-copy{display:none;}');
    // The location pill and the date share a row while both fit and take a
    // line each below that. At 320px they used to fill the row exactly,
    // leaving the area name 58px -- and an area is not guessable from its
    // first six letters.
    expect(mobileCss).toContain('body.mhome-active .li-location-summary{flex:1 1 190px;');
    expect(mobileCss).toContain('body.mhome-active .li-toolbar-greet{flex-wrap:wrap;');
    expect(mobileCss).toContain('body.mhome-active .li-today{grid-column:1/-1;grid-row:2;');
    expect(mobileCss).toContain('body.mhome-active .li-search{grid-column:1/5;grid-row:3;');
    expect(mobileCss).toContain('body.mhome-active .li-mobile-actions{display:contents;}');
    // Row 2 is the optional conditions band. Search/create and quick filters
    // get their own rows so neither can collapse when conditions arrive.
    expect(mobileCss).toContain('body.mhome-active .li-new-wrap{grid-column:5/7;grid-row:3;');
    expect(mobileCss).toContain('body.mhome-active .li-quick-filters{grid-column:1/5;grid-row:4;');
    expect(mobileCss).toContain('body.mhome-active #liFiltersWrap{grid-column:5/7;grid-row:4;');
    // The three geography dropdowns are gone from the markup entirely.
    expect(html).not.toContain('geo-filter-control');
    expect(html).not.toContain('id="liValleyWrap"');
    expect(mobileCss).toContain('body.mhome-active .li-saved-count{display:grid;');
    expect(mobileCss).toContain('.li-map.map-layers-open{z-index:47;}');
    expect(mobileCss).toContain('#trailMap .map-btn{height:32px;padding:0 11px;font-size:11.5px;');
    expect(mobileCss).toContain('#trailMap .td-layer-switch{top:auto;right:auto;left:12px;bottom:calc(var(--mhome-sheet,35dvh) + env(safe-area-inset-bottom) + 12px);}');
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    expect(script).toContain("mapShell.classList.toggle('map-layers-open', open)");
    expect(script).toContain("layersBtn.setAttribute('aria-expanded', String(open))");
    expect(script).toContain("window.matchMedia('(max-width:700px)').matches");
    expect(script).toContain("'<button type=\"button\" data-map3d aria-pressed=\"false\">Terrain</button>'");
  });

  test('groups card actions on the left and gives the dog match a larger right panel', () => {
    expect(css).toMatch(/@media \(min-width:641px\)[\s\S]*?\.li-row\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:66px minmax\(0,1fr\) minmax\(144px,168px\) 34px;/);
    expect(css).toMatch(/\.li-match\{[\s\S]*?grid-column:3;[\s\S]*?grid-row:1\/3;/);
    expect(css).not.toContain('.li-match-reason');
    expect(css).toMatch(/\.li-heart\{grid-column:4;grid-row:1\/3;align-self:center;\}/);
    expect(css).toMatch(/\.li-row-bar\{[\s\S]*?grid-column:1\/3;[\s\S]*?grid-row:2;/);
    // Phones get their own grid rather than the desktop fallback. As one flex
    // line the fixed furniture -- thumbnail, match column, heart -- took 175px
    // before any text, so at 320px the trail name had 59px and every row read
    // "Lago di Braies ...". The name takes the free column and the match drops
    // to its own line.
    const phone = css.slice(css.indexOf('@media (max-width:640px){\n  .li-row{'));
    expect(phone).toMatch(/\.li-row\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:56px minmax\(0,1fr\) 34px;/);
    expect(phone).toMatch(/\.li-row-body\{grid-column:2;grid-row:1;\}/);
    expect(phone).toMatch(/\.li-match\{[\s\S]*?grid-column:1\/-1;[\s\S]*?grid-row:2;/);
    // The desktop heading reserves 142px beside it for a summary that wraps
    // underneath on a phone; unreserved, it was taking 142 of 320 pixels.
    expect(phone).toMatch(/\.li-list-title-row\{padding-right:0;\}/);
  });

  test('labels the main-map fountain layer as Water', () => {
    const translations = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    expect(translations).toContain("'chips.fountains': 'Water'");
    expect(translations).toContain("'chips.fountains': 'Acqua'");
    expect(script).toContain("mkChip(t('chips.fountains'), 'fountains')");
  });

  test('offers OSM veterinary clinics with the shared medical-cross icon', () => {
    const translations = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    expect(html).toContain('veterinary-care.js?v=20260901-1');
    expect(translations).toContain("'chips.veterinary': 'Veterinary clinics'");
    expect(script).toContain("icons.chipHtml('veterinary', label)");
    expect(script).toContain('care.loadMapLayer(map, veterinaryOrigin)');
  });

  test('keeps route shields above a stronger ORMA highlight and only clusters five or more trails', () => {
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    const trailScript = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    expect(script).toMatch(/id: 'trail-paths-line'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).toMatch(/id: 'trail-paths-casing'[\s\S]*?minzoom: 7[\s\S]*?'line-width': \['interpolate'[\s\S]*?10, 8[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    // Halo is a white casing beneath the raster now, not a cream halo above it.
    expect(script).toMatch(/id: 'trail-paths-orma-halo'[\s\S]*?'line-color': '#FFFFFF'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-opacity': 0\.55[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).not.toContain("id: 'trail-paths-match-outline'");
    // The guest map is coloured by match score against the medium-dog profile,
    // not by the trail's safety level, green/amber/red has one meaning now.
    expect(script).not.toContain("trailMapInstance.moveLayer('waymarked-hiking-layer', firstLabelLayer.id)");
    // The selected route is now a zoom-scaled cased pair from map-style.js.
    expect(trailScript).toContain('ORMAMapStyle.addRouteLine(map, {');
    expect(trailScript).toMatch(/id: 'other-trails-line'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    // Both homepage maps now share one Waymarked treatment instead of two
    // hand-tuned desaturation blocks that greyed the network into mush.
    expect(script).toContain('ORMAMapStyle.addWaymarkedHiking(trailMapInstance');
    expect(script).not.toContain("'raster-saturation': -1");
    expect(script).not.toContain("'raster-contrast': 0.20");
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-width': \['interpolate'[\s\S]*?13, 15, 16, 20/);
    expect(script).not.toContain("id: 'trail-paths-mapped-line'");
    expect(script).not.toContain("id: 'trail-clusters'");
    expect(script).not.toContain("id: 'trail-cluster-count'");
    expect(script).not.toContain('clusterMinPoints');
    expect(script).not.toContain('getClusterExpansionZoom(feature.properties.cluster_id)');
    expect(trailScript).toContain('ORMAMapStyle.addWaymarkedHiking(map');
    expect(trailScript).not.toContain("'raster-saturation': -0.90");
    expect(trailScript).not.toContain("'raster-contrast': 0.38");
    const mapStyle = fs.readFileSync(path.join(__dirname, 'map-style.js'), 'utf8');
    expect(mapStyle).toContain("'raster-resampling': 'linear'");
    expect(mapStyle).toContain("'raster-saturation': 0");
    expect(mapStyle).toContain('14, 0.88');
  });
});

// Every trail that carries a shade figure is unreviewed for the heat category:
// 23 hold a value and none is curated. SCORING.md already rules on that case, so
// the card follows it rather than inventing a second standard -- a caution is
// stated in words, reassurance is not stated at all.
describe('shade labels only speak where the evidence rule allows', () => {
  const context = () => loadHomepageContext([]);

  test('low shade becomes a caution in words', () => {
    const ctx = context();
    expect(ctx.liShadeLabel(5)).toBe('little shade');
    expect(ctx.liShadeLabel(19)).toBe('little shade');
    expect(ctx.liShadeLabel(20)).toBe('limited shade');
    expect(ctx.liShadeLabel(35)).toBe('limited shade');
  });

  test('substantial shade is never promised on an unreviewed route', () => {
    const ctx = context();
    // 70% is the engine's "substantial shade" positive. Saying so on a route
    // nobody reviewed reads as a promise, so the measurement stands alone.
    expect(ctx.liShadeLabel(70)).toBe('70% shade');
    expect(ctx.liShadeLabel(70)).not.toContain('shaded');
  });

  test('the bands are the engine’s own, so card and score agree', () => {
    const ctx = context();
    // trail.shade.very-low < 20, trail.shade.low < 40, trail.shade.good >= 60.
    expect(ctx.liShadeLabel(19)).not.toBe(ctx.liShadeLabel(20));
    expect(ctx.liShadeLabel(39)).not.toBe(ctx.liShadeLabel(40));
  });

  test('an unknown shade figure says nothing at all', () => {
    const ctx = context();
    expect(ctx.liShadeLabel(undefined)).toBeNull();
    expect(ctx.liShadeLabel(null)).toBeNull();
    expect(ctx.liRowMeta({ distance:5, elevation:200, hours:'2' })).not.toContain('shade');
  });

  test('the row carries the label alongside the measured facts', () => {
    const ctx = context();
    expect(ctx.liRowMeta({ distance:7.5, elevation:150, hours:'2', shadeCoverage:10 }))
      .toBe('7.5 km · 150 m climb · 2 h · little shade');
  });
});

// Exposure under the same rule as shade, and it is SCORING.md's own example:
// "no exposed section is recorded" reads as a safety claim when it only means
// nobody looked. Three trails carry exposure true and none is curated, but it
// is the heaviest caution the engine has, so those three should say it.
describe('exposure is named when present and never denied when absent', () => {
  const context = () => loadHomepageContext([]);

  test('an exposed route says so', () => {
    expect(context().liExposureLabel(true)).toBe('exposed');
  });

  test('an unexposed route makes no claim about it', () => {
    const ctx = context();
    // trail.exposure.none-known is a positive, and the route is unreviewed.
    expect(ctx.liExposureLabel(false)).toBeNull();
    expect(ctx.liRowMeta({ distance:4, exposure:false })).not.toContain('expos');
  });

  test('unknown exposure says nothing rather than none', () => {
    const ctx = context();
    expect(ctx.liExposureLabel(undefined)).toBeNull();
    expect(ctx.liExposureLabel(null)).toBeNull();
  });

  test('the gravest caution reads first when a row carries both', () => {
    expect(context().liRowMeta({ distance:3.95, elevation:10, hours:'1', exposure:true, shadeCoverage:10 }))
      .toBe('3.95 km · 10 m climb · 1 h · exposed · little shade');
  });
});
