const fs = require('fs');
const path = require('path');
const guide = require('./alpine-plants-guide.js');
const data = require('./data/alpine-plants.json');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('Alpine plants guide', () => {
  test('imports all 33 stable plant records without claiming approval', () => {
    expect(data.plants).toHaveLength(33);
    expect(new Set(data.plants.map(plant => plant.id)).size).toBe(33);
    expect(data.meta.editorialStatus).toBe('draft');
    expect(data.plants.every(plant => plant.reviewStatus === 'veterinary_review_required')).toBe(true);
    expect(data.plants.filter(plant => plant.safety === 'dangerous')).toHaveLength(17);
  });

  test('search is case- and diacritic-insensitive across names and aliases', () => {
    const yarrow = data.plants.find(plant => plant.id === 'common-yarrow');
    expect(guide.matches(yarrow, { query:'ACHILLÉA', safety:'', season:'', habitat:'' })).toBe(true);
    expect(guide.matches(yarrow, { query:'not-a-plant', safety:'', season:'', habitat:'' })).toBe(false);
    const monkshood = data.plants.find(plant => plant.id === 'monkshood');
    expect(guide.matches(monkshood, { query:'violet helmet', safety:'', season:'', habitat:'' })).toBe(true);
    const yew = data.plants.find(plant => plant.id === 'european-yew');
    expect(guide.matches(yew, { query:'red fruit', safety:'', season:'', habitat:'' })).toBe(true);
    const nettle = data.plants.find(plant => plant.id === 'stinging-nettle');
    expect(guide.matches(nettle, { query:'ortica', safety:'', season:'', habitat:'' })).toBe(true);
  });

  test('filter categories combine with AND and habitat facets preserve source copy', () => {
    const monkshood = data.plants.find(plant => plant.id === 'monkshood');
    const state = { query:'monk', safety:'dangerous', season:'summer', habitat:'meadow' };
    expect(guide.matches(monkshood, state)).toBe(true);
    expect(guide.matches(monkshood, { ...state, safety:'safe' })).toBe(false);
    expect(monkshood.habitats.length).toBeGreaterThan(0);
  });

  test('cards lead with concise avoid and monitor guidance', () => {
    const card = guide.plantCard(data.plants.find(plant => plant.id === 'european-yew'));
    expect(card).toContain('Dangerous');
    expect(card).toContain('<b>Avoid:</b>');
    expect(card).toContain('<b>Monitor for:</b>');
    expect(card).toContain('class="apg-card-label apg-card-label--dangerous"');
    expect(card).toContain('class="apg-photo-expand"');
    expect(card).toContain('aria-label="Expand European yew photograph"');
    expect(card).toContain('data-plant-image="../images/editorial/alpine-plants/european-yew.jpg"');
    expect(card).not.toContain('<details id="plant-detail-');
    expect(card).not.toContain('class="apg-card-status');
    expect(card).not.toContain('View larger photo');
    expect(card).not.toContain('Suspected ingestion');
    expect(card).not.toContain('Look for:');
    expect(card).not.toContain('See identification, symptoms and what to do');
    expect(card).not.toContain('stinging-nettle.jpg');
    expect(card).toContain('european-yew.jpg');
    expect(card).toContain('CC BY-SA 2.0');
    expect(card).toContain('commons.wikimedia.org');
    expect(card).toContain('class="apg-photo-credit"');
    expect(card).toContain('aria-label="Show photo credit"');
    expect(card).toContain('title="Photo credit">C</summary>');
    expect(card).not.toContain('Veterinary review required');
    expect(card).not.toContain('Where you may meet it');
    expect(card).not.toContain('class="apg-detail-copy"');
    expect(card).not.toContain('class="apg-chips"');
    expect(guide.floweringMonths([6, 7, 8])).toBe('June, July, August');
  });

  test('every plant has a local, licensed and attributed reference photograph', () => {
    const pictured = data.plants.filter(plant => plant.image && plant.image.src);
    const pending = data.plants.filter(plant => !plant.image || !plant.image.src);
    expect(pictured).toHaveLength(33);
    expect(pending).toHaveLength(0);
    pictured.forEach(plant => {
      expect(plant.image.src).toMatch(/^\.\.\/images\/editorial\/alpine-plants\//);
      expect(fs.existsSync(path.join(__dirname, 'guides', plant.image.src))).toBe(true);
      expect(plant.image.alt.length).toBeGreaterThan(15);
      expect(plant.image.credit).toBeTruthy();
      expect(plant.image.license).toMatch(/^(CC|Public domain)/);
      expect(() => new URL(plant.image.sourceUrl)).not.toThrow();
    });
    expect(read('alpine-plants-guide.js')).not.toContain('View safety notes');
  });

  test('page puts emergency guidance before filters and results', () => {
    const html = read('guides/alpine-plants-for-dogs.html');
    expect(html.indexOf('id="plant-emergency"')).toBeLessThan(html.indexOf('id="plantFindHeading"'));
    expect(html.indexOf('id="plantFindHeading"')).toBeLessThan(html.indexOf('id="plantResults"'));
    expect(html).not.toContain('Editorial review draft');
    expect(html).toContain('class="apg-hero safety-photo-header section-page-head content-canvas"');
    expect(html).toContain('images/editorial/safety-library/flowers-plants-dogs.jpg');
    expect(html).not.toContain('apg-hero-mosaic');
    expect(html).not.toContain('apg-emergency-mark');
    expect(html).toContain('class="area-select-shell"');
    expect(html).toContain('area-dropdown.js');
    expect(html).toContain('Do not induce vomiting');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('numberOfItems":33');
    expect(html).toContain('Last reviewed: 26 August 2026');
    expect(html).toContain('<h3>About the cards and photographs</h3>');
    expect(html).toContain('not an identification guarantee');
    expect(html).toContain('All card photographs are reusable Commons references');
    expect(html).not.toContain('Verified image pending');
    expect(html).not.toContain('Suspected ingestion');
    expect(html).not.toContain('See identification, symptoms and what to do');
    expect(html).not.toContain('What did it look like?');
    expect(html).not.toContain('Open the wider ORMA emergency guide');
  });

  test('every record retains evidence and safe never means edible', () => {
    expect(data.plants.every(plant => plant.evidence.length > 0)).toBe(true);
    expect(guide.PRESENTATION.safe.meaning).toMatch(/does not mean edible/i);
    data.plants.flatMap(plant => plant.evidence).forEach(source => {
      expect(() => new URL(source.url)).not.toThrow();
    });
  });

  test('new source-backed records carry a dated source check', () => {
    const newRecords = data.plants.filter(plant => plant.lastReviewed === '2026-08-26');
    expect(newRecords).toHaveLength(14);
    expect(newRecords.every(plant => plant.evidence.every(source => source.accessed === '2026-08-26'))).toBe(true);
  });

  test('cards open photographs in a dismissible modal lightbox', () => {
    const css = read('alpine-plants-guide.css');
    const script = read('alpine-plants-guide.js');
    expect(css).toContain('.apg-card{position:relative;display:grid;grid-template-columns:118px minmax(0,1fr)');
    expect(css).toContain('.apg-photo-expand{position:absolute');
    expect(css).toContain('.apg-lightbox::backdrop');
    expect(css).toContain('.apg-lightbox__image{display:block;max-width:calc(92vw - 20px)');
    expect(script).toContain("document.createElement('dialog')");
    expect(script).toContain('lightbox.showModal()');
    expect(script).toContain("!event.target.closest('.apg-lightbox__image, .apg-lightbox__close')");
    expect(script).toContain("lightbox.querySelector('.apg-lightbox__close').addEventListener('click', closeLightbox)");
    expect(css).not.toContain('.apg-detail');
    expect(css).toContain('.apg-card-label--dangerous');
    expect(css).not.toContain('.apg-card-status{');
  });
});
