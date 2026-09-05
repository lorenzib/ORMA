const fs = require('fs');
const path = require('path');

function source(file){
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

describe('UX-01 canonical discovery integration', () => {
  test('the guest homepage delegates submitted discovery state to Browse', () => {
    const homepage = source('index.html');
    const controller = source('homepage-search.js');

    expect(homepage.indexOf('discovery-state.js')).toBeLessThan(homepage.indexOf('homepage-search.js'));
    expect(controller).toContain('DoloPawsDiscoveryState.browseHref');
    expect(controller).toContain('window.location.href = browseHref()');
  });

  test('Browse owns URL restoration and returns trail users to that exact state', () => {
    const browse = source('browse-trails.html');

    expect(browse).toContain('DoloPawsDiscoveryState.normalize(urlParams)');
    expect(browse).toContain('DoloPawsDiscoveryState.browseHref(state)');
    expect(browse).toContain('&from=${encodeURIComponent(browseStateTarget())}');
    expect(browse).toContain('id="browseTerrain"');
    expect(browse).toContain('id="browseHeat"');
    expect(browse).toContain('id="browseExposure"');
    expect(browse).toContain('id="browseAccess"');
    expect(browse).not.toContain('id="browseVerification"');
    expect(browse).toContain('Water point listed');
    expect(browse).toContain('diagnoseZero(trails, currentFilterState(), filterOptions())');
  });

  test('Collections opens dedicated editorial pages instead of Browse filters', () => {
    const collections = source('collections.html');
    const detail = source('collection.html');
    const homepage = source('homepage-search.js');
    const search = source('search-page.js');

    expect(collections).toContain('class="collections-grid"');
    expect(collections).toContain('collections-page.js');
    expect(collections).not.toContain('browse-trails.html?collection=');
    // collection.html is a redirect stub now — collections render inline on
    // collections.html, so the old detail shell and its script are gone.
    expect(detail).toContain("window.location.replace(id ? 'collections.html?collection='");
    expect(detail).not.toContain('<script src=');
    expect(homepage).toContain('catalogue.trailsFor(collection, trails)');
    expect(homepage).toContain('href="browse-trails.html">Browse more');
    expect(search).toContain('href="collections.html?collection=');
    expect(collections).not.toContain('clGrid');
    expect(collections).not.toContain('scoreTrail');
  });

  test('active experiments remain excluded and retired previews are absent', () => {
    const config = source('_config.yml');

    expect(config).toMatch(/- experiments\s*$/m);
    expect(fs.existsSync(path.join(__dirname, 'ORMA Homepage - Split Hero.html'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, 'dolopaws-combined-preview.html'))).toBe(false);
  });
});
