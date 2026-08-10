const fs = require('fs');
const path = require('path');
const guide = require('./alpine-plants-guide.js');
const data = require('./data/alpine-plants.json');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('Alpine plants guide', () => {
  test('imports all 13 stable plant records without claiming approval', () => {
    expect(data.plants).toHaveLength(13);
    expect(new Set(data.plants.map(plant => plant.id)).size).toBe(13);
    expect(data.meta.editorialStatus).toBe('draft');
    expect(data.plants.every(plant => plant.reviewStatus === 'veterinary_review_required')).toBe(true);
  });

  test('search is case- and diacritic-insensitive across names and aliases', () => {
    const yarrow = data.plants.find(plant => plant.id === 'common-yarrow');
    expect(guide.matches(yarrow, { query:'ACHILLÉA', safety:'', season:'', habitat:'' })).toBe(true);
    expect(guide.matches(yarrow, { query:'not-a-plant', safety:'', season:'', habitat:'' })).toBe(false);
  });

  test('filter categories combine with AND and habitat facets preserve source copy', () => {
    const monkshood = data.plants.find(plant => plant.id === 'monkshood');
    const state = { query:'monk', safety:'dangerous', season:'summer', habitat:'meadow' };
    expect(guide.matches(monkshood, state)).toBe(true);
    expect(guide.matches(monkshood, { ...state, safety:'safe' })).toBe(false);
    expect(monkshood.habitats.length).toBeGreaterThan(0);
  });

  test('dangerous cards expose immediate action and do not invent an image', () => {
    const card = guide.plantCard(data.plants.find(plant => plant.id === 'european-yew'));
    expect(card).toContain('Dangerous if eaten');
    expect(card).toContain('Suspected ingestion?');
    expect(card).toContain('Verified image pending');
    expect(card).toContain('Veterinary review required');
    expect(guide.floweringMonths([6, 7, 8])).toBe('June, July, August');
  });

  test('page puts emergency guidance before filters and results', () => {
    const html = read('guides/alpine-plants-for-dogs.html');
    expect(html.indexOf('id="plant-emergency"')).toBeLessThan(html.indexOf('id="plantFindHeading"'));
    expect(html.indexOf('id="plantFindHeading"')).toBeLessThan(html.indexOf('id="plantResults"'));
    expect(html).toContain('Editorial review draft');
    expect(html).toContain('Do not induce vomiting');
    expect(html).toContain('aria-live="polite"');
  });

  test('every record retains evidence and safe never means edible', () => {
    expect(data.plants.every(plant => plant.evidence.length > 0)).toBe(true);
    expect(guide.PRESENTATION.safe.meaning).toMatch(/does not mean edible/i);
    data.plants.flatMap(plant => plant.evidence).forEach(source => {
      expect(() => new URL(source.url)).not.toThrow();
    });
  });
});
