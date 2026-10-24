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

  test('keeps valley in Area, shade and water in Filters, and Saved in the row', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?region=dolomites');
    const tools = window.document.getElementById('browseTools');
    const filters = window.document.getElementById('browseFiltersMenu');

    expect(window.document.getElementById('browseAreaPanel').querySelector('#browseValleySelect')).not.toBeNull();
    expect(filters.querySelector('#browseQuickShade')).not.toBeNull();
    expect(filters.querySelector('#browseWater')).not.toBeNull();
    expect(tools.querySelector(':scope > #browseSavedOnly')).not.toBeNull();
    expect(filters.querySelector('#brWaterToggle')).toBeNull();

    window.document.getElementById('browseQuickShade').click();
    expect(window.location.search).toContain('heat=shade-60');
    expect(window.document.getElementById('browseQuickShade').getAttribute('aria-pressed')).toBe('true');

    window.document.getElementById('browseWater').click();
    expect(window.location.search).toContain('water=1');
    expect(window.document.getElementById('browseWater').getAttribute('aria-pressed')).toBe('true');
  });

  test('shows each active filter as a chip that takes it off', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?water=1&heat=shade-60');
    const chips = () => Array.from(window.document.querySelectorAll('#browseActiveChips [data-remove-filter]'))
      .map(chip => chip.dataset.removeFilter);

    expect(window.document.getElementById('browseActiveChips').hidden).toBe(false);
    expect(chips().sort()).toEqual(['heat', 'water']);
    // Shade and water live inside Filters now, so they count on its button.
    expect(window.document.getElementById('browseFiltersCount').textContent).toBe(' (2)');

    window.document.querySelector('[data-remove-filter="water"]').click();
    expect(window.location.search).not.toContain('water=');
    expect(window.location.search).toContain('heat=shade-60');
    expect(chips()).toEqual(['heat']);
    expect(window.document.getElementById('browseWater').getAttribute('aria-pressed')).toBe('false');
    expect(window.document.getElementById('browseFiltersCount').textContent).toBe(' (1)');
  });

  test('the place is named on the Area button, not repeated as a chip', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?country=italy&region=dolomites&valley=Val%20d%E2%80%99Ega');

    expect(window.document.getElementById('browseAreaLabel').textContent).toBe('Dolomites › Val d’Ega');
    expect(window.document.querySelector('#browseActiveChips [data-remove-filter="valley"]')).toBeNull();

    const button = window.document.getElementById('browseAreaBtn');
    button.click();
    expect(window.document.getElementById('browseAreaPanel').hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    window.document.body.click();
    expect(window.document.getElementById('browseAreaPanel').hidden).toBe(true);
  });

  test('a card leads with View trail; Compare is a tick box', () => {
    const window = setup('https://www.app-orma.com/browse-trails.html?region=dolomites');
    const card = window.document.querySelector('.simple-card');
    const open = card.querySelector('.browse-card-open');

    expect(open.textContent.trim()).toBe('View trail →');
    expect(open.getAttribute('href')).toMatch(/^trail\.html\?id=reviewed-loop&from=/);
    const compare = card.querySelector('.browse-card-compare');
    expect(compare.textContent.trim()).toBe('Compare');
    compare.click();
    expect(window.document.querySelector('.browse-card-compare').getAttribute('aria-pressed')).toBe('true');
    // Ticked, it keeps its name; the tick says it is chosen.
    expect(window.document.querySelector('.browse-card-compare').textContent.trim()).toBe('Compare');
    expect(source('browse-trails.html')).not.toContain('.browse-card-open{display:none;}');
  });

  test('each trail rating links to its explanation', () => {
    [
      ['low-risk', 'rating-low-risk', 'Low-risk terrain'],
      ['moderate', 'rating-moderate', 'Moderate terrain'],
      ['caution', 'rating-caution', 'Caution terrain'],
    ].forEach(([safetyLevel, anchor, label]) => {
      const window = setup('https://www.app-orma.com/browse-trails.html?region=dolomites', { safetyLevel });
      const link = window.document.querySelector('.simple-card__facts .browse-rating-link');
      expect(link.getAttribute('href')).toBe(`how-scoring-works.html#${anchor}`);
      expect(link.getAttribute('aria-label')).toBe(`${label}: what this rating means`);
      expect(link.textContent).toContain(label);
    });

    // The scoring page answers each of those anchors in both languages.
    const scoring = source('how-scoring-works.html');
    expect(scoring).toContain("var RATINGS = { 'rating-low-risk':'low', 'rating-moderate':'moderate', 'rating-caution':'caution' };");
    ['low', 'moderate', 'caution'].forEach(level => {
      expect(scoring.match(new RegExp(`sc-score-option--${level}"`, 'g'))).toHaveLength(2);
    });
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
      expect(card.querySelector('.simple-card__facts .simple-card__match-reason')).toBeNull();
      expect(card.querySelector('.simple-card__match .simple-card__match-reason')).not.toBeNull();
      expect(card.querySelector('.simple-card__score').firstElementChild.tagName).toBe('SMALL');
    });
    expect(html).not.toContain('terrainRatingLabel');
  });

  test('mobile discovery controls wrap inside the phone canvas', () => {
    const html = source('browse-trails.html');

    // Search on its own line, then Area, Filters and Saved sharing the next:
    // Area takes what is left, Saved keeps its heart and count, Filters drops
    // its caret.
    expect(html).toMatch(/@media\(max-width:760px\)\{\s*#browseTools\{flex-wrap:wrap;\}/);
    expect(html).toContain('#browseTools>.browse-area-wrap{flex:1 1 0;min-width:0;}');
    expect(html).toContain('#browseTools>.browse-saved-only [data-i18n="browse.quick.saved"]{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}');
    expect(html).toContain('#browseTools #browseFiltersBtn .li-caret{display:none;}');
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

  test('country, region and valley open inside one Area control', () => {
    const html = source('browse-trails.html');
    const panel = html.slice(html.indexOf('id="browseAreaPanel"'), html.indexOf('id="browseFiltersWrap"'));

    ['browseCountrySelect', 'browseRegionSelect', 'browseValleySelect'].forEach(id => {
      expect(panel).toContain(`id="${id}"`);
    });
    expect(html).toContain('<button type="button" id="browseAreaBtn" class="browse-area-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="browseAreaPanel">');
    // The heading above each picker names it, so the picker shows its value.
    expect(html).toContain('#browseAreaPanel .area-select-trigger__kicker{display:none;}');
    expect(html).toContain('#browseAreaPanel .browse-geo-label{position:static;');
  });

  test('keeps one row of controls instead of three equal rows', () => {
    const html = source('browse-trails.html');

    // The old per-width grids are gone; the row is the same everywhere.
    expect(html).not.toContain('browse-refinement-controls');
    expect(html).not.toContain('@media(min-width:1041px)');
    expect(html).toContain('#browseTools>.browse-search-group{flex:1 1 320px;min-width:0;}');
    // Shade, water, chairlift and multi-day sit inside Filters, first.
    const menu = html.slice(html.indexOf('id="browseFiltersMenu"'), html.indexOf('id="browseFiltersApply"'));
    expect(menu.indexOf('data-i18n="browse.filters.quick"')).toBeLessThan(menu.indexOf('id="brDistSeg"'));
    ['browseQuickShade', 'browseWater', 'browseChairlifts', 'browseMultiDay'].forEach(id => {
      expect(menu).toContain(`id="${id}"`);
    });
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
