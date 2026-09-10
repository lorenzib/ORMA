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
    expect(html).toMatch(/\.browse-primary-controls \.browse-search-group\{grid-column:1\/-1;grid-row:1;width:100%;min-width:0;\}/);
    expect(html).toMatch(/\.browse-primary-controls \.browse-search-shell\{[^}]*grid-column:1\/-1;[^}]*grid-row:1;[^}]*width:100%;[^}]*min-width:0;/);
    expect(html).toMatch(/\.browse-area-controls\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/);
    expect(html).toMatch(/\.browse-geo-group--valley\{grid-column:auto;/);
    expect(html).toMatch(/\.browse-refinement-controls\{grid-column:1\/-1;grid-row:3;display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\);/);
    expect(html).toMatch(/\.browse-quick-filters\{display:contents;\}/);
    expect(html).toMatch(/#browseQuickShade\{grid-column:1\/span 3;grid-row:2;\}/);
    expect(html).toMatch(/#browseWater\{grid-column:4\/span 3;grid-row:2;\}/);
    expect(html).toMatch(/#browseMultiDay\{grid-column:1\/span 3;grid-row:3;\}/);
    expect(html).toMatch(/\.browse-saved-only\{grid-column:4\/span 3;grid-row:3;[^}]*width:100%;/);
    expect(html).toMatch(/#browseFiltersMenu\{[^}]*position:fixed;[^}]*bottom:max\(8px,env\(safe-area-inset-bottom\)\);[^}]*overflow-y:auto;/);
  });

  test('optically aligns the Water control with Saved', () => {
    const html = source('browse-trails.html');

    expect(html).toContain("height:40px;min-height:40px;box-sizing:border-box;padding:0 13px");
    expect(html).toContain('#browseWater .dp-icon-svg{transform:translateY(1px);}');
    expect(html).toContain('#browseWater>span:last-child,.browse-saved-only>span:nth-child(2){display:inline-flex;align-items:center;min-height:21px;line-height:1;}');
    expect(html).toContain('data-dp-icon="water" data-dp-icon-size="22"');
  });

  test('uses the same labelled white pill treatment for browse area controls', () => {
    const html = source('browse-trails.html');
    const dropdown = source('area-dropdown.js');

    expect(html).toContain('data-control-kicker="Country"');
    expect(html).toContain('data-control-kicker="Region"');
    expect(html).toContain('data-control-kicker="Valley"');
    expect(html.match(/data-kicker-until-selected/g)).toHaveLength(3);
    expect(html).toContain('id="browseQuickShade" aria-pressed="false"><span data-dp-icon="shade" data-dp-icon-size="26"');
    expect(html).toContain('.area-select-trigger__kicker');
    expect(dropdown).toContain("const controlKicker = select.dataset.controlKicker;");
  });

  test('reserves readable geography widths in the browse toolbar', () => {
    const html = source('browse-trails.html');

    expect(html).toContain('.browse-geo-group,.browse-geo-group--valley{display:block;flex:1 1 0;width:auto;min-width:0;}');
    expect(html).toContain('max-width:360px;min-width:0;');
    expect(html).toContain('@media(min-width:761px) and (max-width:1040px)');
    expect(html).toContain('grid-template-columns:repeat(3,minmax(0,1fr));');
    expect(html).toContain('.browse-geo-group .area-select-trigger--kicker-until-selected:not(.area-select-trigger--has-selection) .area-select-trigger__label{display:none;}');
  });

  test('uses intentional filter rows instead of squeezing controls together', () => {
    const html = source('browse-trails.html');

    expect(html).toContain('@media(min-width:1041px)');
    expect(html).toMatch(/@media\(min-width:1041px\)[\s\S]*?\.browse-primary-controls \.browse-tools\{[^}]*display:grid;[^}]*grid-template-columns:minmax\(340px,1\.15fr\) minmax\(0,2\.85fr\);[^}]*grid-template-rows:auto auto;/);
    expect(html).toContain('.browse-area-controls{grid-column:2;grid-row:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));}');
    expect(html).toContain('.browse-refinement-controls{grid-column:1/-1;grid-row:2;display:flex;flex-wrap:wrap;justify-content:flex-start;}');
    expect(html).toContain('.browse-saved-only{width:max-content;min-width:0;}');
  });

  test('matches the shared title scale and homepage workspace proportions', () => {
    const html = source('browse-trails.html');

    expect(html).not.toMatch(/\.browse-design-head h1\{/);
    expect(html).toContain('grid-template-columns:minmax(0,1.05fr) minmax(480px,.95fr);');
    expect(html).toContain('height:clamp(520px,58vh,720px);min-height:520px;');
    expect(html).toMatch(/@media\(max-width:1040px\)[\s\S]*?\.browse-view-toggle\{display:grid;/);
    expect(html).toMatch(/@media\(max-width:1040px\)[\s\S]*?\.browse-explorer\{display:block;height:auto;min-height:0;/);
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
