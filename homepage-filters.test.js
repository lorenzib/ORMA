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
  if(key === 'filter.all') return 'All';
  if(key === 'filter.verified') return 'Verified';
  if(key === 'filter.imported') return 'Imported';
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
    <div id="areaFilterRow"></div>
    <button id="liRegionBtn"></button>
    <span id="liRegionLabel"></span>
    <div id="liRegionMenu"></div>
    <h1 id="returningHeading"></h1>
    <p id="returningSubline"></p>
    <span id="returningCount"></span>
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

  test('renders valley pills for the active region without province chips', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "all";', context);
    vm.runInContext('renderAreaFilters(null);', context);

    const row = document.getElementById('areaFilterRow');
    expect(row.innerHTML).toContain('data-valley="all"');
    expect(row.innerHTML).toContain('Maurienne');
    expect(row.innerHTML).toContain('Tarentaise – Vanoise');
    expect(row.innerHTML).not.toContain('data-province');
    expect(row.innerHTML).not.toContain('province-pills');
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

  test('clicking a valley pill updates activeValley', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "all"; renderAreaFilters(null);', context);

    const mauriennePill = document.querySelector('[data-valley="Maurienne"]');
    expect(mauriennePill).not.toBeNull();
    mauriennePill.click();

    expect(vm.runInContext('activeValley', context)).toBe('Maurienne');
  });

  test('result count reflects region filter', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "all"; activeProvenance = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('3 scored · 0 saved');
  });

  test('result count reflects valley filter', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "Maurienne"; activeProvenance = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('1 scored · 0 saved');
  });

  test('provenance filter shows only verified trails', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "all"; activeProvenance = "verified"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('2 scored · 0 saved');
  });

  test('provenance filter shows only imported trails', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeValley = "all"; activeProvenance = "imported"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('1 scored · 0 saved');
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
    expect(html).toContain('id="liRegionWrap"');
    expect(html).toContain('id="liSearchSuggest"');
    expect(html).not.toContain('id="liFiltersWrap" class="li-menuwrap li-mobile-only"');
    expect(css).toMatch(/\.li-greetbar\{\s*display:none;/);
    expect(css).toMatch(/\.li-chiprow\{display:none;/);
  });

  test('keeps returning-home search on the map instead of navigating away', () => {
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    expect(script).toContain('renderLiSearchSuggestions(currentProfileForAdjust)');
    expect(script).toContain('focusMapOnTrail(trail.id, matches)');
    expect(script).not.toContain("search.addEventListener('focus', () => {\n      window.location.href = 'search.html");
  });

  test('keeps Record walk as a map action and defaults mobile results to the low snap', () => {
    const mapStart = html.indexOf('<div class="li-map" id="trailMapWrap">');
    const record = html.indexOf('id="liRecordBtn"');
    const mapEnd = html.indexOf('<aside class="li-list"', mapStart);
    expect(record).toBeGreaterThan(mapStart);
    expect(record).toBeLessThan(mapEnd);
    expect(mobileJs).toContain('var sheetPct = SNAPS[1];');
    expect(mobileJs).toContain('var lastOpenPct = SNAPS[1];');
    expect(mobileCss).toContain('height:26dvh');
  });
});
