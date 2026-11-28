/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

// Labels that scripts write after the page loads: they must come out in
// Italian too, not only the ones i18n.js swaps in the page itself.
function run(file){
  // eslint-disable-next-line no-new-func
  new Function(fs.readFileSync(path.join(__dirname, file), 'utf8')).call(window);
}

function italian(){
  const it = { 'a11y.collections.countryFilter': 'Filtra le raccolte per paese', 'browse.geo.country': 'Paese' };
  window.DoloPawsI18n = { lang:'it', t:key => it[key] || key, phrase:text => text };
}

afterEach(() => { delete window.DoloPawsI18n; delete window.OrmaAreaDropdown; document.body.innerHTML = ''; });

describe('labels written by scripts', () => {
  test('a dropdown built before i18n.js runs still takes the Italian label', () => {
    italian();
    // The page still carries its English label: i18n.js has not run yet.
    document.body.innerHTML = '<span class="area-select-shell"><select id="countrySelect" aria-label="Filter collections by country" data-i18n-aria-label="a11y.collections.countryFilter"><option value="">All</option></select></span>';
    run('area-dropdown.js');
    const api = window.OrmaAreaDropdown;
    const select = document.getElementById('countrySelect');
    api.enhance(select);
    expect(document.querySelector('.area-select-trigger').getAttribute('aria-label')).toBe('Filtra le raccolte per paese');
    expect(document.querySelector('.area-select-menu').getAttribute('aria-label')).toBe('Filtra le raccolte per paese');
  });

  test('maps get Italian built-in labels only for Italian readers', () => {
    italian();
    run('map-runtime.js');
    const runtime = window.DoloPawsMapRuntime;
    expect(runtime.mapOptions({}).locale['Map.Title']).toBe('Mappa');
    expect(runtime.mapOptions({}).locale['NavigationControl.ZoomIn']).toBe('Ingrandisci');
    window.DoloPawsI18n.lang = 'en';
    expect(runtime.mapOptions({}).locale).toBeUndefined();
  });

  test('the recommendation card labels its actions through i18n', () => {
    const source = fs.readFileSync(path.join(__dirname, 'trail-recommendation.js'), 'utf8');
    expect(source).not.toMatch(/aria-label="Trail actions"/);
    expect(source).toMatch(/tr\('page\.index\.trailActions'/);
  });
});
