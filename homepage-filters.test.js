const fs = require('fs');
const path = require('path');
const vm = require('vm');

function tForTests(key, params = {}){
  if(key === 'areas.allValleys') return 'All valleys';
  if(key === 'region.savoy') return 'Savoy';
  if(key === 'region.theDolomites') return 'the Dolomites';
  if(key === 'region.dolomites') return 'Dolomites';
  if(key === 'home.bubble') return 'Where are we heading today?';
  if(key === 'home.pickArea') return `Pick a valley below — trails are ranked for ${params.name || 'your dog'}.`;
  if(key === 'home.pickAreaNoName') return 'Pick a valley below — trails are ranked for your dog.';
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
    <div id="liRegionWrap"><button id="liRegionBtn"></button>
    <span id="liRegionLabel"></span></div>
    <div id="liRegionMenu"></div>
    <div id="liCountryWrap"><button id="liCountryBtn"></button>
    <span id="liCountryLabel"></span></div>
    <div id="liCountryMenu"></div>
    <div id="liValleyWrap"><button id="liValleyBtn"></button>
    <span id="liValleyLabel"></span></div>
    <div id="liValleyMenu"></div>
    <button id="liSavedOnlyBtn"><span id="liSavedOnlyCount"></span></button>
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
    navigator: { userAgent: 'jest' },
    location: { search: '' },
    document,
    fetch: jest.fn(),
    trails: testTrails,
    t: tForTests,
    scoreTrail: () => 80,
    recommendTrail: () => ({
      scoringVersion: '1.5.0',
      score: 80,
      category: 'possible-with-cautions',
      confidence: 'low',
      positiveReasons: [],
      cautions: [],
    }),
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

  test('renders country choices from regional metadata', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "IT"; activeRegion = "dolomites"; renderLiCountryControl(null);', context);

    const all = document.querySelector('[data-country="all"]');
    const italy = document.querySelector('[data-country="IT"]');
    const france = document.querySelector('[data-country="FR"]');
    expect(all).not.toBeNull();
    expect(italy).not.toBeNull();
    expect(france).not.toBeNull();
    expect(italy.textContent).toContain('Italy');
    expect(france.textContent).toContain('France');
    expect(italy.getAttribute('aria-pressed')).toBe('true');
  });

  test('country choice selects that country, resets region and valley', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "IT"; activeRegion = "dolomites"; activeValley = "Val Gardena"; renderLiCountryControl(null);', context);

    document.querySelector('[data-country="FR"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(vm.runInContext('activeCountry', context)).toBe('FR');
    expect(vm.runInContext('activeRegion', context)).toBe('all');
    expect(vm.runInContext('activeValley', context)).toBe('all');
  });

  test('All country and region return to the same neutral UI as All valleys', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "all"; activeRegion = "all"; activeValley = "all"; renderLiCountryControl(null); renderLiRegionControl(null); renderLiValleyControl(null);', context);

    expect(document.getElementById('liCountryLabel').textContent).toBe('All countries');
    expect(document.getElementById('liRegionLabel').textContent).toBe('All regions');
    expect(document.getElementById('liValleyLabel').textContent).toBe('All valleys');
    expect(document.getElementById('liCountryWrap').classList.contains('li-has-selection')).toBe(false);
    expect(document.getElementById('liRegionWrap').classList.contains('li-has-selection')).toBe(false);
    expect(document.getElementById('liValleyWrap').classList.contains('li-has-selection')).toBe(false);
  });

  test('saved-only toolbar control reflects and filters saved trails', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('currentFavorites = { vag: true }; showingSavedOnly = true; activeRegion = "dolomites"; renderLiSavedControl();', context);
    expect(document.getElementById('liSavedOnlyBtn').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('liSavedOnlyCount').textContent).toBe('1');
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
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

  test('switching the separate region control resets the valley', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "all"; activeRegion = "savoy"; activeValley = "Maurienne"; renderLiRegionControl(null);', context);

    const dolomitesTab = Array.from(document.querySelectorAll('.li-region-option'))
      .find(button => button.textContent.includes('Dolomites'));
    expect(dolomitesTab).not.toBeNull();
    dolomitesTab.click();
    await Promise.resolve();

    expect(vm.runInContext('activeRegion', context)).toBe('dolomites');
    expect(vm.runInContext('activeCountry', context)).toBe('IT');
    expect(vm.runInContext('activeValley', context)).toBe('all');
  });

  test('the visible valley dropdown follows the active region and updates activeValley', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "FR"; activeRegion = "savoy"; activeValley = "all"; renderLiValleyControl(null);', context);

    const maurienneOption = document.querySelector('[data-valley="Maurienne"]');
    expect(document.getElementById('liValleyLabel').textContent).toBe('All valleys');
    expect(document.getElementById('liValleyWrap').classList.contains('li-has-selection')).toBe(false);
    expect(maurienneOption).not.toBeNull();
    maurienneOption.click();

    expect(vm.runInContext('activeValley', context)).toBe('Maurienne');
    expect(document.getElementById('liValleyLabel').textContent).toBe('Maurienne');
    expect(document.getElementById('liValleyWrap').classList.contains('li-has-selection')).toBe(true);
  });

  test('result list reflects region filter', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "FR"; activeRegion = "savoy"; activeValley = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(3);
  });

  test('result list reflects valley filter', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "FR"; activeRegion = "savoy"; activeValley = "Maurienne"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
  });

  test('All countries returns the full loaded catalogue', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeCountry = "all"; activeRegion = "all"; activeValley = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(5);
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
    expect(html).toContain('id="liCountryWrap"');
    expect(html).toContain('id="liSavedOnlyBtn"');
    expect(html).toContain('id="liRegionWrap"');
    expect(html).toContain('id="liValleyWrap"');
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
    expect(mobileJs).toContain('var sheetPct = SNAPS[1];');
    expect(mobileJs).toContain('var lastOpenPct = SNAPS[1];');
    expect(mobileCss).toContain('height:26dvh');
  });

  test('uses a deliberate mobile filter row and compact map controls', () => {
    expect(html).toContain('<div class="li-mobile-actions" aria-label="Trail actions">');
    expect(mobileCss).toContain('body.mhome-active .li-toolbar-greet-copy{display:flex;min-width:0;flex-direction:column;');
    expect(mobileCss).toContain('body.mhome-active .li-search{grid-column:1/5;grid-row:2;');
    expect(mobileCss).toContain('body.mhome-active .li-mobile-actions{display:contents;}');
    expect(mobileCss).toContain('body.mhome-active .li-quick-filters{display:none;}');
    expect(mobileCss).toContain('body.mhome-active #liFiltersWrap,');
    expect(mobileCss).toContain('body.mhome-active .li-saved-only{grid-column:5/7;grid-row:2;');
    expect(mobileCss).toContain('body.mhome-active .li-plan-route{grid-column:1/4;grid-row:4;display:inline-flex;');
    expect(mobileCss).toContain('body.mhome-active .li-record{grid-column:4/7;grid-row:4;display:inline-flex!important;');
    expect(mobileCss).toContain('body.mhome-active .li-menuwrap.li-mobile-default-label .li-geo-copy .li-control-kicker{display:inline;}');
    expect(mobileCss).toContain('body.mhome-active #liValleyWrap.li-mobile-default-label #liValleyLabel{display:none;}');
    expect(html).toContain('class="li-menuwrap li-country-wrap li-mobile-default-label geo-filter-control"');
    expect(html).toContain('class="li-menuwrap li-region-wrap li-mobile-default-label geo-filter-control"');
    expect(html).toContain('class="li-menuwrap li-valley-wrap li-mobile-default-label geo-filter-control"');
    expect(mobileCss).toContain('body.mhome-active .li-saved-count{display:grid;');
    expect(mobileCss).toContain('.li-map.map-layers-open{z-index:47;}');
    expect(mobileCss).toContain('#trailMap .map-btn{height:32px;padding:0 11px;font-size:11.5px;');
    expect(mobileCss).toContain('#trailMap .td-layer-switch{top:auto;right:auto;left:12px;bottom:calc(var(--mhome-sheet,26dvh) + env(safe-area-inset-bottom) + 12px);}');
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
    expect(css).toMatch(/@media \(max-width:640px\)[\s\S]*?\.li-row\{display:flex;\}/);
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
    expect(script).toMatch(/id: 'guest-trail-paths-line'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).toMatch(/id: 'trail-paths-casing'[\s\S]*?minzoom: 7[\s\S]*?'line-width': \['interpolate'[\s\S]*?10, 8[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).toMatch(/id: 'guest-trail-paths-casing'[\s\S]*?'line-width': \['interpolate'[\s\S]*?10, 7[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    // Halo is a white casing beneath the raster now, not a cream halo above it.
    expect(script).toMatch(/id: 'trail-paths-orma-halo'[\s\S]*?'line-color': '#FFFFFF'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-opacity': 0\.55[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).not.toContain("id: 'trail-paths-match-outline'");
    // The guest map is coloured by match score against the medium-dog profile,
    // not by the trail's safety level — green/amber/red has one meaning now.
    expect(script).toMatch(/id: 'guest-trail-paths-orma-line'[\s\S]*?matchColourExpression\('score'\)[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script).toContain('properties: { name: t.name, score: guestMatchScore(t) }');
    expect(script).toContain("guestMapInstance.moveLayer('waymarked-hiking-layer', guestFirstLabel.id)");
    expect(script).not.toContain("trailMapInstance.moveLayer('waymarked-hiking-layer', firstLabelLayer.id)");
    // The selected route is now a zoom-scaled cased pair from map-style.js.
    expect(trailScript).toContain('ORMAMapStyle.addRouteLine(map, {');
    expect(trailScript).toMatch(/id: 'other-trails-line'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    // Both homepage maps now share one Waymarked treatment instead of two
    // hand-tuned desaturation blocks that greyed the network into mush.
    expect(script).toContain('ORMAMapStyle.addWaymarkedHiking(guestMapInstance');
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
