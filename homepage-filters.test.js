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
    <div class="li-menuwrap"><button id="liExploreBtn"></button>
      <div id="liExploreMenu" hidden>
        <button id="liExploreNearMe"></button><button id="liExploreAll"></button>
        <div id="liExploreRecent"></div>
      </div></div>
    <div id="liToolbar"><span id="liLocationSummary"><small id="liLocationSummaryKick"></small><strong id="liLocationSummaryLabel"></strong><button id="liChangeLocationBtn"></button><button id="liShowAllBtn" hidden></button></span>
      <div id="liLocationNudge" hidden><strong id="liLocationNudgeTitle"></strong><small id="liLocationNudgeDetail"></small><button id="liLocationNudgeBtn"></button><button id="liLocationNudgeDismiss"></button></div>
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
    <button id="liSearchThisArea" type="button" class="li-search-area" hidden>Search this area</button>
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
      scoringVersion: '1.6.0',
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

  // The map is a geography, not a filter layered on one. Panning to another
  // valley and pressing "Search this area" shows what is there; it used to show
  // the intersection with whatever area had been typed, which is usually empty.
  const mapArea = (west, south, east, north) =>
    `liSetLocationContext({ kind:"map", bounds:{ west:${west}, south:${south}, east:${east}, north:${north} } });`;

  test('a map area shows what is in view', async () => {
    const context = loadHomepageContext(sampleTrails);
    // A box over the Dolomites samples only.
    vm.runInContext(mapArea(11, 46, 12, 47), context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(2);
  });

  // The regression this replaces: Val Gardena typed, map panned to Savoy.
  test('a map area replaces a typed area instead of intersecting it', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext(`liSetLocationContext({ kind:"area", country:"IT", region:"dolomites",
      valley:"Val Gardena", label:"Val Gardena" });`, context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
    // Now frame Savoy. Intersecting would give nothing; replacing gives Savoy.
    vm.runInContext(mapArea(6, 45, 7, 46), context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(3);
    expect(vm.runInContext('activeValley', context)).toBe('all');
    expect(vm.runInContext('activeRegion', context)).toBe('all');
  });

  test('it is called a map area, not the area it replaced', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext(`liSetLocationContext({ kind:"area", country:"IT", region:"dolomites",
      valley:"Val Gardena", label:"Val Gardena" });`, context);
    vm.runInContext(mapArea(6, 45, 7, 46), context);
    expect(vm.runInContext('liLocationContextLabel()', context)).toBe('Map area');
    expect(vm.runInContext('liRecommendationLocationPhrase()', context)).toBe('in the map area');
  });

  // A map area is where you are looking, not where you walk: remembering it
  // would greet the owner with a viewport next visit, and erase the stored area.
  test('a map area is not remembered, and does not erase the area it replaced', async () => {
    const context = loadHomepageContext(sampleTrails);
    // The shared harness stubs storage to a no-op, so this test brings a real
    // one: whether a map area quietly erases the stored area is the whole point.
    const store = new Map();
    context.localStorage = {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: key => { store.delete(key); },
    };
    vm.runInContext(`liSetLocationContext({ kind:"area", country:"IT", region:"dolomites",
      valley:"Val Gardena", label:"Val Gardena" });`, context);
    const stored = vm.runInContext('localStorage.getItem(LI_AREA_STORAGE_KEY)', context);
    expect(stored).toContain('Val Gardena');
    vm.runInContext(mapArea(6, 45, 7, 46), context);
    // Still the typed area, untouched, so a reload comes back to it.
    expect(vm.runInContext('localStorage.getItem(LI_AREA_STORAGE_KEY)', context)).toBe(stored);
  });

  // A map area is applied by a click handler that lives inside the map setup,
  // so these seed the button exactly as that handler leaves it and then take a
  // door out. The bug they pin: the doors nulled the bounds but not the button,
  // so it sat over the new location still offering to clear a map area, and
  // pressing it framed a new one instead.
  const pinMapArea = context => {
    vm.runInContext(`liContextBeforeMapArea = liLocationContext;`, context);
    vm.runInContext(mapArea(6, 45, 7, 46), context);
    const button = document.getElementById('liSearchThisArea');
    button.hidden = false;
    button.classList.add('is-clear');
    button.textContent = 'Clear map area';
  };
  const areaButtonState = () => {
    const button = document.getElementById('liSearchThisArea');
    return button.hidden ? 'hidden' : button.textContent + (button.classList.contains('is-clear') ? ' [clear]' : '');
  };
  const inValGardena = `liSetLocationContext({ kind:"area", country:"IT", region:"dolomites",
    valley:"Val Gardena", label:"Val Gardena" });`;

  test('choosing a place after a map area takes the clear button with it', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext(inValGardena, context);
    pinMapArea(context);
    expect(areaButtonState()).toBe('Clear map area [clear]');
    // The door #438 opened: a place typed into the search.
    vm.runInContext(`liSetLocationContext({ kind:"area", country:"IT", region:"dolomites",
      valley:"Val di Fassa", label:"Val di Fassa" });`, context);
    expect(vm.runInContext('liLocationContextLabel()', context)).toBe('Val di Fassa');
    expect(areaButtonState()).toBe('hidden');
    expect(vm.runInContext('liContextBeforeMapArea', context)).toBeNull();
  });

  test('"Show all" after a map area takes the clear button with it', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext(inValGardena, context);
    pinMapArea(context);
    vm.runInContext('liSetLocationContext(liDefaultLocationContext());', context);
    expect(areaButtonState()).toBe('hidden');
    expect(vm.runInContext('liContextBeforeMapArea', context)).toBeNull();
  });

  // The map area counts as a filter, so "Reset filters" clears it. It is also
  // the location, so clearing it has to hand the location back -- otherwise the
  // heading still reads "Map area" with nothing framed, and the button that
  // offered the way out is gone.
  test('resetting the filters hands back the area the map area replaced', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext(inValGardena, context);
    pinMapArea(context);
    expect(vm.runInContext('liLocationContextLabel()', context)).toBe('Map area');
    vm.runInContext('liResetAllFilters();', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(vm.runInContext('liLocationContextLabel()', context)).toBe('Val Gardena');
    expect(vm.runInContext('liMapBounds', context)).toBeNull();
    expect(areaButtonState()).toBe('hidden');
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
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
    expect(document.querySelector('.li-match-lbl').textContent).toBe('For Teo');
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

  test('with nothing chosen the whole catalogue is ranked, with no gate in front of it', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography();', context);
    await vm.runInContext('renderReturningHomepage(null);', context);

    expect(document.getElementById('liToolbar').hidden).toBe(false);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(5);
    expect(document.getElementById('liLocationSummaryKick').textContent).toBe('Showing');
    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('All ORMA trails');
    expect(document.getElementById('liShowAllBtn').hidden).toBe(true);
    // The whole catalogue is the absence of a choice, so it is never remembered.
    expect(context.localStorage.getItem('orma-home-selected-area-v1')).toBeNull();
  });

  test('a typed place is offered before trails and becomes where the list looks', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography(); initLoggedInShell();', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    const search = document.getElementById('liSearch');
    search.value = 'Maur';
    vm.runInContext('liEnsureAreaChoices(); renderLiSearchSuggestions(null);', context);
    const place = document.querySelector('#liSearchSuggest .li-search-place');
    expect(place).not.toBeNull();
    expect(place.textContent).toContain('Maurienne');
    expect(place.textContent).toContain('Place');
    place.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Maurienne');
    expect(document.getElementById('liLocationSummaryKick').textContent).toBe('Looking in');
    expect(document.getElementById('liShowAllBtn').hidden).toBe(false);
    expect(search.value).toBe('');

    // "Change" opens the search, which the editorial toolbar keeps folded away.
    document.getElementById('liChangeLocationBtn').click();
    expect(document.getElementById('liToolbar').classList.contains('li-refine-open')).toBe(true);
    expect(document.getElementById('liAdjustRecommendationBtn').getAttribute('aria-expanded')).toBe('true');
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
    vm.runInContext('liEnsureAreaChoices(); liLocationContext = { kind:"area", country:"IT", region:"dolomites", valley:"Alta Pusteria – Tre Cime", label:"Alta Pusteria – Tre Cime" }; activeCountry="IT"; activeRegion="dolomites"; activeValley="Alta Pusteria – Tre Cime";', context);
    await vm.runInContext('renderReturningHomepage({ name:"Teo" });', context);

    const areaLabels = vm.runInContext('liAreaChoices.map(choice => choice.label)', context);
    expect(areaLabels).toContain('Alta Pusteria');
    expect(areaLabels).not.toContain('Alta Pusteria – Tre Cime');
    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Alta Pusteria');
    expect(document.getElementById('returningHeading').textContent).toMatch(/^Best walk for Teo in Alta Pusteria /);
    expect(document.getElementById('returningHeading').textContent).not.toContain('Tre Cime');
  });

  test('searching for a destination sets a complete recommendation scope', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography(); initLoggedInShell();', context);
    const search = document.getElementById('liSearch');
    search.value = 'Savoy';
    vm.runInContext('liEnsureAreaChoices(); renderLiSearchSuggestions(null);', context);
    const place = [...document.querySelectorAll('#liSearchSuggest .li-search-place')].find(option => option.textContent.includes('Savoy'));
    expect(place).not.toBeUndefined();
    place.click();
    await Promise.resolve();
    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Savoy');
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(3);
  });

  test('leads with three explained top picks and keeps alternatives compact', async () => {
    // Five in-scope trails so the three top picks and compact alternatives
    // both render.
    const dolomitesFive = Array.from({ length: 5 }, (_, i) => ({
      id: `dol${i}`, name: `Dolomite Trail ${i}`, region: 'dolomites', valley: 'Val Gardena',
      area: 'Ortisei', lat: 46.57 + i / 100, lng: 11.67, curated: true, distance: 6,
      elevation: 320, hours: 3, terrainType: 'Mixed', safetyLevel: 'low-risk',
    }));
    const context = loadHomepageContext(dolomitesFive);
    context.recommendTrail.mockImplementation(() => ({
      scoringVersion:'1.6.0', score:86, category:'recommended', confidence:'high',
      positiveReasons:[{ message:'The distance suits Teo’s normal range.' }],
      cautions:[{ message:'Bring water for the exposed middle section.' }],
      hardStops:[], unknowns:[],
    }));
    vm.runInContext('liLocationContext = { kind:"area", country:"IT", region:"dolomites", valley:"all", label:"Dolomites" };', context);
    await vm.runInContext('renderReturningHomepage({ name:"Teo" });', context);

    expect(document.getElementById('returningHeading').textContent).toMatch(/^Best walk for Teo in Dolomites /);
    const rows = document.querySelectorAll('#returningTrailList .li-row');
    // The first three are co-equal, fully explained answer cards.
    expect([...rows].slice(0, 3).every(row => row.classList.contains('li-row--answer'))).toBe(true);
    expect(document.querySelectorAll('#returningTrailList .li-row--answer')).toHaveLength(3);
    expect(document.querySelectorAll('.li-answer-explanation')).toHaveLength(3);
    expect(document.querySelector('.li-answer-explanation').textContent).toContain('Why it fits Teo');
    expect(document.querySelector('.li-answer-explanation').textContent).toContain('What to know today');
    expect(document.querySelector('.li-answer-open').textContent).toBe('View trail details');
    expect(document.querySelector('.li-answer-map').textContent).toBe('Show on map');
    // The alternatives heading follows the three picks, before the fourth card.
    expect(document.querySelector('.li-alternatives-heading').textContent).toContain('Other options for Teo');
    expect(rows[3].classList.contains('li-row--answer')).toBe(false);
    expect([...rows].map(row => row.dataset.rank)).toEqual(['1', '2', '3', '4', '5']);
    expect(document.querySelector('.li-match b').textContent).toBe('Strong option');
    // Confidence left the verdict column for the evidence line, and "High
    // confidence" is not said beside "ORMA route-audited" because it is the
    // same statement twice. A caveat still appears; an agreement does not.
    expect(document.querySelector('.li-match-confidence')).toBeNull();
    const trust = document.querySelector('.li-row-trust').textContent;
    expect(trust).toContain('ORMA route-audited');
    expect(trust).not.toContain('High confidence');
    expect(document.querySelector('.li-row--answer').textContent).not.toContain('86%');
  });

  test('a future date is reflected in the recommendation instead of being labelled today', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('liLocationContext = { kind:"area", country:"FR", region:"savoy", valley:"all", label:"Savoy" }; liSetWalkDate(liDateOffsetIso(1));', context);
    await vm.runInContext('renderReturningHomepage({ name:"Teo" });', context);

    expect(document.getElementById('returningHeading').textContent).toMatch(/^Best walk for Teo in Savoy /);
    expect(document.getElementById('returningHeading').textContent).not.toContain(' today');
    expect(document.getElementById('liRecommendationDate').value).toBe(vm.runInContext('liDateOffsetIso(1)', context));
  });

  test('offers location in place, asks only on tap, and explains a refusal without blocking the list', async () => {
    const context = loadHomepageContext(sampleTrails);
    const getCurrentPosition = jest.fn();
    context.navigator.geolocation = { getCurrentPosition };
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography(); initLoggedInShell();', context);
    await new Promise(resolve => setTimeout(resolve, 0));
    await vm.runInContext('renderReturningHomepage(null);', context);

    // No permissions API here (Safari): the offer shows, nothing is requested.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    const nudge = document.getElementById('liLocationNudge');
    expect(nudge.hidden).toBe(false);
    expect(document.getElementById('liLocationNudgeTitle').textContent).toBe('See trails near you');
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(5);

    document.getElementById('liLocationNudgeBtn').click();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const onError = getCurrentPosition.mock.calls[0][1];
    onError({ code:1 });
    expect(nudge.hidden).toBe(false);
    expect(document.getElementById('liLocationNudgeTitle').textContent).toContain('Location is off');
    expect(document.getElementById('liLocationNudgeBtn').hidden).toBe(true);
    expect(document.getElementById('liToolbar').hidden).toBe(false);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(5);

    // A granted position narrows the list and retires the offer.
    document.getElementById('liExploreNearMe').click();
    const onSuccess = getCurrentPosition.mock.calls[1][0];
    onSuccess({ coords:{ latitude:46.57, longitude:11.67 } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.getElementById('liLocationSummaryLabel').textContent).toBe('Your location · within 25 km');
    expect(nudge.hidden).toBe(true);
  });

  test('dismissing the location offer sticks past the tab closing', async () => {
    // Closing it is an answer, not a mood. A session-scoped dismissal asked
    // again every time ORMA was opened, which is how an offer becomes nagging.
    const context = loadHomepageContext(sampleTrails);
    const store = new Map();
    context.localStorage = {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: key => { store.delete(key); },
    };
    const sessionWrites = [];
    context.sessionStorage = {
      getItem: () => null,
      setItem: (key, value) => { sessionWrites.push(key); },
      removeItem: () => {},
    };
    context.navigator.geolocation = { getCurrentPosition: jest.fn() };
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography(); initLoggedInShell();', context);
    await new Promise(resolve => setTimeout(resolve, 0));
    await vm.runInContext('renderReturningHomepage(null);', context);

    const nudge = document.getElementById('liLocationNudge');
    expect(nudge.hidden).toBe(false);
    document.getElementById('liLocationNudgeDismiss').click();
    expect(nudge.hidden).toBe(true);

    // Written where it outlives the tab, and nowhere that does not.
    const key = vm.runInContext('LI_LOCATION_NUDGE_DISMISSED_KEY', context);
    expect(store.get(key)).toBe('1');
    expect(sessionWrites).not.toContain(key);

    // A fresh visit with the same durable store leaves it dismissed.
    expect(vm.runInContext('liLocationNudgeDismissed()', context)).toBe(true);
  });

  test('asking for Near me on purpose undoes a past dismissal', async () => {
    // The way back for anyone who changes their mind, and the reason a
    // permanent dismissal is not a dead end.
    const context = loadHomepageContext(sampleTrails);
    const store = new Map();
    context.localStorage = {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: key => { store.delete(key); },
    };
    context.navigator.geolocation = { getCurrentPosition: jest.fn() };
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography(); initLoggedInShell();', context);
    await new Promise(resolve => setTimeout(resolve, 0));
    await vm.runInContext('renderReturningHomepage(null);', context);

    document.getElementById('liLocationNudgeDismiss').click();
    const key = vm.runInContext('LI_LOCATION_NUDGE_DISMISSED_KEY', context);
    expect(store.get(key)).toBe('1');

    document.getElementById('liExploreNearMe').click();
    expect(store.has(key)).toBe(false);
  });

  test('a permission already granted is used quietly, unless a place was chosen', async () => {
    const context = loadHomepageContext(sampleTrails);
    const getCurrentPosition = jest.fn();
    context.navigator.geolocation = { getCurrentPosition };
    context.navigator.permissions = { query: jest.fn(() => Promise.resolve({ state:'granted' })) };
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography(); initLoggedInShell();', context);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    const saved = loadHomepageContext(sampleTrails);
    const getSavedPosition = jest.fn();
    saved.navigator.geolocation = { getCurrentPosition:getSavedPosition };
    saved.navigator.permissions = { query: jest.fn(() => Promise.resolve({ state:'granted' })) };
    vm.runInContext('liLocationContext = { kind:"area", country:"FR", region:"savoy", valley:"all", label:"Savoy" }; initLoggedInShell();', saved);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getSavedPosition).not.toHaveBeenCalled();
  });

  test('a Near me tap carried over from another page asks for the position once', async () => {
    const context = loadHomepageContext(sampleTrails);
    const getCurrentPosition = jest.fn();
    context.navigator.geolocation = { getCurrentPosition };
    context.location.href = 'https://app-orma.com/?near=1&view=returning';
    context.location.search = '?near=1&view=returning';
    const replaceState = jest.fn();
    context.window.history = { state:null, replaceState };
    vm.runInContext('liLocationContext = liLoadLocationContext(); liApplyLocationGeography(); initLoggedInShell();', context);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    // Read once: the address loses the intent, and keeps everything else.
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?view=returning');
  });

  test('the Explore menu lists the last trails opened, newest first', () => {
    const context = loadHomepageContext(sampleTrails);
    const recent = JSON.stringify([
      { id:'vag', name:'Val Gardena Trail', area:'Val Gardena', at:2 },
      { id:'mau', name:'Maurienne Trail', area:'Maurienne', at:1 },
    ]);
    context.localStorage.getItem = key => (key === 'orma-recent-trails-v1' ? recent : null);
    vm.runInContext('liRenderRecentTrails();', context);
    const links = Array.from(document.querySelectorAll('#liExploreRecent a'));
    expect(links.map(link => link.textContent)).toEqual(['Val Gardena TrailVal Gardena', 'Maurienne TrailMaurienne']);
    expect(links[0].getAttribute('href')).toBe('trail.html?id=vag');
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
    expect(markerLayer).toContain("id: 'trail-rank-labels'");
    expect(markerLayer).toContain("'text-field': ['to-string', ['get', 'rank']]");
    expect(markerLayer).toContain("'text-font': window.ORMAMapStyle.FONT_BOLD");
    expect(markerLayer).toContain("'#9AA19C'");
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
    expect(html).toContain('class="li-rank-map-key" aria-label="Map key"');
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
    // The location offer is a band across the phone toolbar, not a column.
    expect(mobileCss).toContain('body.mhome-active .li-location-nudge{grid-column:1/-1;grid-row:5;');
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
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-opacity': \[[\s\S]*?0\.5, 0\.12[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
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
