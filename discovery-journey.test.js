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
    expect(browse).toContain('id="browseVerification"');
    expect(browse).toContain('Reviewed water point');
    expect(browse).toContain('diagnoseZero(trails, currentFilterState(), filterOptions())');
  });

  test('Collections is a curated landing page that hands results to Browse', () => {
    const collections = source('collections.html');

    expect(collections).toContain('class="collections-grid"');
    expect(collections).toContain('browse-trails.html?collection=');
    expect(collections).not.toContain('clGrid');
    expect(collections).not.toContain('scoreTrail');
  });

  test('development previews are excluded from the production build', () => {
    const config = source('_config.yml');

    expect(config).toContain('DoloPaws Homepage - Split Hero.html');
    expect(config).toContain('dolopaws-combined-preview.html');
    expect(config).toMatch(/- experiments\s*$/m);
  });
});
