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
    <button id="liRegionBtn"></button>
    <span id="liRegionLabel"></span>
    <div id="liRegionMenu"></div>
    <button id="liCountryBtn"></button>
    <span id="liCountryLabel"></span>
    <div id="liCountryMenu"></div>
    <button id="liValleyBtn"></button>
    <span id="liValleyLabel"></span>
    <div id="liValleyMenu"></div>
    <button id="liSavedOnlyBtn"><span id="liSavedOnlyCount"></span></button>
    <span id="liDogCtxName"></span>
    <span id="liDogCtxBreedSep" hidden></span>
    <a id="liDogCtxBreed" href="guides/breed-group-caveats.html" hidden></a>
    <span id="liToolbarDogContext"></span>
    <span id="liAccountName"></span>
    <span id="liAccountAvatar"></span>
    <span id="liGreetAvatar"></span>
    <span id="liDogCtxAvatar"></span>
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
      scoringVersion: '1.1.0',
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
    vm.runInContext('activeRegion = "dolomites"; renderLiCountryControl(null);', context);

    const italy = document.querySelector('[data-country="IT"]');
    const france = document.querySelector('[data-country="FR"]');
    expect(italy).not.toBeNull();
    expect(france).not.toBeNull();
    expect(italy.textContent).toContain('Italy');
    expect(france.textContent).toContain('France');
    expect(italy.getAttribute('aria-pressed')).toBe('true');
  });

  test('country choice loads its region and resets an incompatible valley', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "dolomites"; activeValley = "Val Gardena"; renderLiCountryControl(null);', context);

    document.querySelector('[data-country="FR"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(vm.runInContext('activeRegion', context)).toBe('savoy');
    expect(vm.runInContext('activeValley', context)).toBe('all');
  });

  test('saved-only toolbar control reflects and filters saved trails', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('currentFavorites = { vag: true }; showingSavedOnly = true; activeRegion = "dolomites"; renderLiSavedControl();', context);
    expect(document.getElementById('liSavedOnlyBtn').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('liSavedOnlyCount').textContent).toBe('1');
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
  });

  test('renders a static tailored-to dog name with a linked breed', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('renderLiToolbarContext({ name: "Eddie", breed: "Podenco Andaluz" });', context);
    expect(document.getElementById('liDogCtxName').textContent).toBe('Eddie');
    expect(document.getElementById('liDogCtxBreed').textContent).toBe('Podenco Andaluz');
    expect(document.getElementById('liDogCtxBreed').hidden).toBe(false);
    expect(document.getElementById('liDogCtxBreed').getAttribute('href')).toBe('guides/breed-group-caveats.html');
    expect(document.getElementById('liToolbarDogContext').textContent).toContain('Eddie · Podenco Andaluz');
  });

  test('keeps the cached active dog when a profile read transiently returns null', async () => {
    const context = loadHomepageContext(sampleTrails);
    context.localStorage.getItem = key => key === 'dolopaws-profile-summary'
      ? JSON.stringify({ hasProfile:true, activeDogId:'teo', name:'Teo', dogs:[{ id:'teo', name:'Teo', breed:'Mutt', fitness:'moderate' }] })
      : null;
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('liAccountName').textContent).toBe('Teo');
    expect(document.getElementById('liDogCtxName').textContent).toBe('Teo');
  });

  test('switching the separate region control resets the valley', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "Maurienne"; renderLiRegionControl(null);', context);

    const dolomitesTab = Array.from(document.querySelectorAll('.li-region-option'))
      .find(button => button.textContent.includes('Dolomites'));
    expect(dolomitesTab).not.toBeNull();
    dolomitesTab.click();
    await Promise.resolve();

    expect(vm.runInContext('activeRegion', context)).toBe('dolomites');
    expect(vm.runInContext('activeValley', context)).toBe('all');
  });

  test('the visible valley dropdown follows the active region and updates activeValley', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "all"; renderLiValleyControl(null);', context);

    const maurienneOption = document.querySelector('[data-valley="Maurienne"]');
    expect(document.getElementById('liValleyLabel').textContent).toBe('All valleys');
    expect(maurienneOption).not.toBeNull();
    maurienneOption.click();

    expect(vm.runInContext('activeValley', context)).toBe('Maurienne');
    expect(document.getElementById('liValleyLabel').textContent).toBe('Maurienne');
  });

  test('result list reflects region filter', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(3);
  });

  test('result list reflects valley filter', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "Maurienne"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.querySelectorAll('#returningTrailList .li-row')).toHaveLength(1);
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
    expect(routeLayer).toContain("'step', ['coalesce', ['get', 'score'], 0]");
    expect(routeLayer).not.toContain("['get', 'safetyLevel']");
    expect(markerLayer).toContain("'step', ['coalesce', ['get', 'score'], 0]");
    expect(script).toContain("breedLink.href = 'guides/breed-group-caveats.html'");
    expect(script).not.toContain('trails scored`');
  });

  test('keeps Record walk in the discovery toolbar and defaults mobile results to the low snap', () => {
    const toolbarStart = html.indexOf('<div class="li-toolbar" id="liToolbar">');
    const record = html.indexOf('id="liRecordBtn"');
    const toolbarEnd = html.indexOf('<!-- ================= BODY:', toolbarStart);
    expect(record).toBeGreaterThan(toolbarStart);
    expect(record).toBeLessThan(toolbarEnd);
    expect(html).not.toContain('class="li-pane-toggle"');
    expect(html).not.toContain('<details class="li-legend">');
    expect(html).not.toContain('Map key');
    expect(mobileJs).toContain('var sheetPct = SNAPS[1];');
    expect(mobileJs).toContain('var lastOpenPct = SNAPS[1];');
    expect(mobileCss).toContain('height:26dvh');
  });

  test('keeps mobile filters compact and makes the layers panel independently scrollable', () => {
    expect(html).toContain('<div class="li-mobile-actions" aria-label="Trail actions">');
    expect(mobileCss).toContain('body.mhome-active .li-mobile-actions{grid-column:1/-1;grid-row:4;display:flex;');
    expect(mobileCss).toContain('body.mhome-active #liQuickShade{order:1;min-width:128px;}');
    expect(mobileCss).toContain('body.mhome-active #liQuickWater{order:2;min-width:96px;gap:4px;}');
    expect(mobileCss).toContain('body.mhome-active .li-saved-only{order:3;min-width:110px;}');
    expect(mobileCss).toContain('body.mhome-active .li-saved-count{display:grid;');
    expect(mobileCss).toContain('overscroll-behavior:contain');
    expect(mobileCss).toContain('.li-map.map-layers-open{z-index:47;}');
    expect(mobileCss).toContain('.li-map.map-fs .li-record-fab{bottom:calc(18px + env(safe-area-inset-bottom));}');
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    expect(script).toContain("mapShell.classList.toggle('map-layers-open', open)");
    expect(script).toContain("layersBtn.setAttribute('aria-expanded', String(open))");
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
    expect(script).toMatch(/id: 'trail-paths-orma-halo'[\s\S]*?'line-color': '#FFFDF7'[\s\S]*?firstLabelLayer \? firstLabelLayer\.id : undefined\);/);
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-color': \[[\s\S]*?'step'[\s\S]*?65, '#C98A2E', 85, '#4A7856'[\s\S]*?firstLabelLayer \? firstLabelLayer\.id : undefined\);/);
    expect(script).not.toContain("id: 'trail-paths-match-outline'");
    expect(script).toMatch(/id: 'guest-trail-paths-orma-line'[\s\S]*?'line-color': \[[\s\S]*?'low-risk', '#4A7856'[\s\S]*?'moderate', '#C98A2E'[\s\S]*?'caution', '#9C3A25'[\s\S]*?guestFirstLabel \? guestFirstLabel\.id : undefined\);/);
    expect(script).toContain("guestMapInstance.moveLayer('waymarked-hiking-layer', guestFirstLabel.id)");
    expect(script).toContain("trailMapInstance.moveLayer('waymarked-hiking-layer', firstLabelLayer.id)");
    expect(trailScript).toMatch(/id: 'single-trail-path-line'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(trailScript).toMatch(/id: 'other-trails-line'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
    expect(script.match(/7, 0\.10/g)).toHaveLength(2);
    expect(script.match(/10, 0\.14/g)).toHaveLength(2);
    expect(script.match(/12, 0\.19/g)).toHaveLength(2);
    expect(script.match(/14, 0\.24/g)).toHaveLength(2);
    expect(script.match(/'raster-saturation': -1/g)).toHaveLength(2);
    expect(script.match(/'raster-contrast': -0\.06/g)).toHaveLength(2);
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-width': \['interpolate'[\s\S]*?13, 7, 16, 9/);
    expect(script).toContain('clusterMinPoints: 5');
    expect(script.match(/filter: \['all', \['has', 'point_count'\], \['>=', \['get', 'point_count'\], 5\]\]/g)).toHaveLength(2);
    expect(script).toContain("'circle-color': '#DCE8DE'");
    expect(script).toContain("'text-size': 11");
    expect(trailScript).toContain("9, 0.52");
    expect(trailScript).toContain("12, 0.68");
    expect(trailScript).toContain("14, 0.90");
    expect(trailScript).toContain("15, 1");
    expect(trailScript).toContain("'raster-saturation': -0.40");
    expect(trailScript).toContain("'raster-contrast': 0.22");
  });
});
