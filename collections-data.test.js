const fs = require('fs');
const path = require('path');
const vm = require('vm');

const collections = require('./collections-data');

function loadTrails(){
  const context = {};
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  ['trails-data.js','osm-trails-data.js','osm-trails-savoy-data.js','trail-audits.js'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename:file });
  });
  return vm.runInContext('trails', context);
}

describe('editorial trail collections', () => {
  const trails = loadTrails();

  test('every collection has a stable unique URL id and content', () => {
    const all = collections.all();
    expect(new Set(all.map(item => item.id)).size).toBe(all.length);
    all.forEach(item => {
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.coverImage).toBeTruthy();
      expect(item.trailIds.length).toBeGreaterThan(0);
    });
  });

  test('every listed trail exists and counts are derived from the catalogue', () => {
    collections.all().forEach(item => {
      const selected = collections.trailsFor(item, trails);
      expect(selected.map(trail => trail.id)).toEqual(item.trailIds);
      expect(new Set(item.trailIds).size).toBe(item.trailIds.length);
    });
  });

  test('detail page supports photos and route-outline placeholders', () => {
    const detail = fs.readFileSync(path.join(__dirname, 'collection-detail.js'), 'utf8');
    expect(detail).toContain('DoloPawsTrailVisual');
    expect(detail).toContain('visual.render(trail');
    expect(detail).toContain('trail.html?id=');
  });
});
