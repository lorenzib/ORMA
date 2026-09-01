const fs = require('fs');
const path = require('path');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');

function source(file){
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function reviewedTrail(){
  return {
    id:'reviewed-loop',
    name:'Reviewed Loop',
    area:'Carezza',
    valley:'Val d’Ega',
    region:'dolomites',
    distance:4,
    elevation:100,
    hours:1,
    terrainRank:0,
    shadeCoverage:60,
    heatRisk:'low',
    exposure:false,
    safetyLevel:'low-risk',
    waterSources:[{ km:1, label:'Reviewed fountain' }],
    surfaceHazards:[],
    path:[[46.4, 11.5], [46.41, 11.51]],
    verified:{
      categories:['route','water','heat','exposure','surfaceHazards','access'],
      date:'2026-07-20',
    },
    graduation:{
      status:'verified',
      required:['route','water','heat','exposure','surfaceHazards','access'],
      completed:['route','water','heat','exposure','surfaceHazards','access'],
    },
    desc:'Dogs are allowed on this route.',
    tips:'Dogs may stay on lead.',
  };
}

function setup(url, trailOverrides = {}){
  const html = source('browse-trails.html');
  const inline = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))
    .map(match => match[1]).filter(body => body.includes('function renderPage'))[0];
  const dom = new JSDOM(html, { url, runScripts:'outside-only' });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = function(){};
  window.t = (key, params) => {
    if(key === 'page.of') return `${params.a}/${params.b}`;
    const labels = {
      'legend.low':'Low-risk terrain',
      'legend.moderate':'Moderate terrain',
      'legend.caution':'Caution terrain',
    };
    if(labels[key]) return labels[key];
    return key;
  };
  window.trails = [{ ...reviewedTrail(), ...trailOverrides }];
  [
    'trust/evidence-v1.js',
    'scoring/recommendation-adapters-v1.js',
    'discovery-state.js',
    'discovery-filters.js',
    'comparison-state.js',
    'area-dropdown.js',
  ].forEach(file => window.eval(source(file)));
  window.eval(inline);
  window.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

describe('Browse filter UI', () => {
  test('explains a zero result and safely widens distance', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?distance=3&terrain=soft');

    expect(window.document.querySelector('.empty-state__title').textContent)
      .toBe('No trails match this combination');
    expect(window.document.querySelector('.browse-empty__filters').textContent)
      .toContain('Up to 3 km');

    const widen = Array.from(window.document.querySelectorAll('[data-safe-recovery]'))
      .find(button => button.textContent.includes('Widen distance to 5 km'));
    expect(widen).toBeTruthy();
    widen.click();

    expect(window.location.search).toContain('distance=5');
    expect(window.document.getElementById('browseResultCount').textContent)
      .toContain('1 trail found');
    expect(window.document.querySelector('.simple-card')).not.toBeNull();
  });

  test('dog-safety controls restore from canonical URL state', () => {
    const window = setup(
      'https://www.app-orma.com/browse-trails.html?water=1&heat=shade-reviewed&exposure=none-reviewed&access=allowed-reviewed'
    );

    expect(window.document.getElementById('browseWater').getAttribute('aria-pressed')).toBe('true');
    expect(window.document.getElementById('browseHeat').value).toBe('shade-reviewed');
    expect(window.document.getElementById('browseExposure').value).toBe('none-reviewed');
    expect(window.document.getElementById('browseAccess').value).toBe('allowed-reviewed');
    expect(window.document.querySelector('.simple-card')).not.toBeNull();
  });

  test('exposes valley, high shade, water and saved beside search', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?region=dolomites');
    const tools = window.document.getElementById('browseTools');
    const filters = window.document.getElementById('browseFiltersMenu');

    expect(tools.querySelector('#browseValleySelect')).not.toBeNull();
    expect(tools.querySelector('#browseQuickShade')).not.toBeNull();
    expect(tools.querySelector('#browseWater')).not.toBeNull();
    expect(tools.querySelector('#browseSavedOnly')).not.toBeNull();
    expect(filters.querySelector('#brWaterToggle')).toBeNull();

    window.document.getElementById('browseQuickShade').click();
    expect(window.location.search).toContain('heat=shade-60');
    expect(window.document.getElementById('browseQuickShade').getAttribute('aria-pressed')).toBe('true');

    window.document.getElementById('browseWater').click();
    expect(window.location.search).toContain('water=1');
    expect(window.document.getElementById('browseWater').getAttribute('aria-pressed')).toBe('true');
  });

  test('retires source-review filtering and strips its legacy URL state', () => {
    const window = setup(
      'https://www.app-orma.com/browse-trails.html?verification=route-audited'
    );

    expect(window.document.getElementById('browseVerification')).toBeNull();
    expect(window.location.search).not.toContain('verification=');
    expect(window.document.querySelector('.simple-card')).not.toBeNull();
  });

  test('country, region and valley are visible, linked geographic controls', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?country=italy&region=dolomites&valley=Val%20d%E2%80%99Ega');

    expect(window.document.getElementById('browseCountrySelect').textContent).toContain('Italy');
    expect(window.document.getElementById('browseRegionSelect').textContent).toContain('Dolomites');
    expect(window.document.getElementById('browseValleySelect').textContent).toContain('Val d’Ega');
    expect(window.document.getElementById('browseCountrySelect').value).toBe('italy');
    expect(window.document.getElementById('browseRegionSelect').value).toBe('dolomites');
    expect(window.document.getElementById('browseValleySelect').value).toBe('Val d’Ega');
    expect(window.location.search).toContain('country=italy');

    const countryTrigger = window.document.querySelector('#browseCountrySelect + .area-select-trigger');
    countryTrigger.click();
    expect(countryTrigger.getAttribute('aria-expanded')).toBe('true');
    window.document.querySelector('#browseCountrySelectMenu [data-value="france"]').click();
    expect(countryTrigger.textContent).toContain('France');
    expect(window.document.getElementById('browseRegionSelect').textContent).toContain('Savoy');
    expect(window.document.getElementById('browseRegionSelect').textContent).not.toContain('Dolomites');
    expect(window.document.getElementById('browseValleySelect').value).toBe('all');
    expect(window.document.getElementById('browseValleySelect').textContent).not.toContain('Val d’Ega');
  });

  test('mobile-ready cards use explicit terrain language and aligned rows', () => {
    const html = source('browse-trails.html');
    const i18n = source('i18n.js');

    expect(i18n).toContain("'legend.low': 'Low-risk terrain'");
    expect(i18n).toContain("'legend.moderate': 'Moderate terrain'");
    expect(i18n).toContain("'legend.caution': 'Caution terrain'");

    [
      ['low-risk', 'Low-risk terrain'],
      ['moderate', 'Moderate terrain'],
      ['caution', 'Caution terrain'],
    ].forEach(([safetyLevel, label]) => {
      const window = setup('https://www.app-orma.com/browse-trails.html?region=dolomites', { safetyLevel });
      const card = window.document.querySelector('.simple-card');
      expect(card.querySelector('.simple-card__facts').textContent).toContain(label);
      expect(card.textContent).not.toContain('Trail rating');
      expect(card.querySelector('.simple-card__score')).not.toBeNull();
      expect(card.querySelector('.simple-card__match-actions')).not.toBeNull();
    });
    expect(html).not.toContain('terrainRatingLabel');
  });

  test('mobile discovery controls wrap inside the phone canvas', () => {
    const html = source('browse-trails.html');

    expect(html).toMatch(/@media\(max-width:760px\)[\s\S]*?\.browse-primary-controls \.browse-tools\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\);/);
    expect(html).toMatch(/\.browse-primary-controls \.browse-search-shell\{[^}]*grid-column:1\/-1;[^}]*grid-row:1;[^}]*width:100%;[^}]*min-width:0;/);
    expect(html).toMatch(/\.browse-area-controls\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
    expect(html).toMatch(/\.browse-geo-group--valley\{grid-column:1\/-1;/);
    expect(html).toMatch(/\.browse-quick-filters\{grid-column:1\/span 4;grid-row:4;[^}]*width:100%;/);
    expect(html).toMatch(/\.browse-saved-only\{grid-column:5\/span 2;grid-row:4;[^}]*width:100%;/);
    expect(html).toMatch(/#browseFiltersMenu\{[^}]*position:fixed;[^}]*bottom:max\(8px,env\(safe-area-inset-bottom\)\);[^}]*overflow-y:auto;/);
  });

  test('uses the same labelled white pill treatment for browse area controls', () => {
    const html = source('browse-trails.html');
    const dropdown = source('area-dropdown.js');

    expect(html).toContain('data-control-kicker="Country"');
    expect(html).toContain('data-control-kicker="Region"');
    expect(html).toContain('data-control-kicker="Valley"');
    expect(html).toContain('.area-select-trigger__kicker');
    expect(dropdown).toContain("const controlKicker = select.dataset.controlKicker;");
  });

  test('reserves the same readable geography widths as the logged-in map toolbar', () => {
    const html = source('browse-trails.html');
    const editorialCss = source('homepage-editorial.css');

    expect(html).toContain('.browse-geo-group{display:block;flex:0 0 196px;width:196px;');
    expect(html).toContain('.browse-geo-group--valley{flex-basis:178px;width:178px;}');
    expect(html).toContain('max-width:360px;min-width:180px;');
    expect(editorialCss).toContain('grid-template-columns:minmax(210px,2fr)');
    expect(html).toContain('@media(min-width:761px) and (max-width:1100px)');
    expect(html).toContain('grid-template-columns:minmax(260px,360px) 196px 196px 178px;');
    expect(html).toContain('.browse-geo-group .area-select-trigger__kicker{display:none;}');
  });

  test('stretches the complete filter row across wide screens', () => {
    const html = source('browse-trails.html');

    expect(html).toContain('@media(min-width:1101px)');
    expect(html).toMatch(/@media\(min-width:1101px\)[\s\S]*?\.browse-primary-controls \.browse-tools\{[^}]*display:grid;[^}]*grid-template-columns:[^}]*minmax\(0,\.75fr\);/);
    expect(html).toMatch(/@media\(min-width:1101px\)[\s\S]*?\.browse-area-controls,\.browse-quick-filters\{display:contents;\}/);
    expect(html).toContain('#browseFiltersWrap{grid-column:5;grid-row:1;width:100%;}');
    expect(html).toContain('.browse-saved-only{grid-column:8;grid-row:1;width:100%;min-width:0;}');
  });

  test('selecting a trail opens the persistent comparison tray', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?region=dolomites');
    const compare = window.document.querySelector('[data-compare-id="reviewed-loop"]');

    compare.click();

    const tray = window.document.getElementById('compareTray');
    expect(window.document.querySelector('[data-compare-id="reviewed-loop"]').getAttribute('aria-pressed'))
      .toBe('true');
    expect(tray.hidden).toBe(false);
    expect(tray.textContent).toContain('1 of 3 selected');
    expect(tray.querySelector('.compare-tray__go').getAttribute('aria-disabled')).toBe('true');
    expect(JSON.parse(window.localStorage.getItem('dolopaws-comparison-v1')).ids)
      .toEqual(['reviewed-loop']);
  });
});
