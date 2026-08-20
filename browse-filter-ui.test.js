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

  test('reviewed dog-safety controls restore from canonical URL state', () => {
    const window = setup(
      'https://www.app-orma.com/browse-trails.html?water=1&heat=shade-reviewed&exposure=none-reviewed&access=allowed-reviewed&verification=route-audited'
    );

    expect(window.document.getElementById('browseWater').getAttribute('aria-pressed')).toBe('true');
    expect(window.document.getElementById('browseHeat').value).toBe('shade-reviewed');
    expect(window.document.getElementById('browseExposure').value).toBe('none-reviewed');
    expect(window.document.getElementById('browseAccess').value).toBe('allowed-reviewed');
    expect(window.document.getElementById('browseVerification').value).toBe('route-audited');
    expect(window.document.querySelector('.simple-card')).not.toBeNull();
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
