const fs = require('fs');
const path = require('path');
const vm = require('vm');

const collections = require('./collections-data');

function loadTrails(){
  const context = {};
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  ['trails-data.js','osm-trails-data.js','osm-trails-savoy-data.js','trail-audits.js','regions-config.js'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename:file });
  });
  vm.runInContext('DoloPawsRegions.assign(trails)', context);
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
      expect(['IT','FR']).toContain(item.countryCode);
      expect(['dolomites','savoy']).toContain(item.region);
      expect(item.tripLength).toBeTruthy();
      expect(item.trailIds.length).toBeGreaterThan(0);
    });
  });

  test('every listed trail exists and counts are derived from the catalogue', () => {
    collections.all().forEach(item => {
      const selected = collections.trailsFor(item, trails);
      expect(selected.map(trail => trail.id)).toEqual(item.trailIds);
      expect(new Set(item.trailIds).size).toBe(item.trailIds.length);
      expect(new Set(selected.map(trail => trail.region))).toEqual(new Set([item.region]));
    });
  });

  test('landing page exposes separate country and region filters with Browse-style cards', () => {
    const page = fs.readFileSync(path.join(__dirname, 'collections.html'), 'utf8');
    const controller = fs.readFileSync(path.join(__dirname, 'collections-page.js'), 'utf8');
    expect(page).toContain('id="collectionCountrySelect"');
    expect(page).toContain('id="collectionRegionSelect"');
    expect(page).toContain('area-dropdown.js');
    expect(controller).toContain('class="simple-card collection-list-card"');
    expect(controller).toContain("waterSpecific(collection.chips[0])");
  });

  test('detail page supports photos and route-outline placeholders', () => {
    const detail = fs.readFileSync(path.join(__dirname, 'collection-detail.js'), 'utf8');
    expect(detail).toContain('DoloPawsTrailVisual');
    expect(detail).toContain('visual.render(trail');
    expect(detail).toContain('trail.html?id=');
    expect(detail).toContain('collectionTrailMap');
    expect(detail).toContain("map.addSource('collection-routes'");
    expect(detail).toContain("map.addSource('collection-waymarked-hiking'");
    expect(detail).toContain("addPoiLayers(map, 'rifugi'");
    expect(detail).toContain("addPoiLayers(map, 'water'");
    expect(detail).toContain("addPoiLayers(map, 'food'");
    expect(detail).toContain('data-collection-layer="rifugi" aria-pressed="false"');
    expect(detail).toContain('data-collection-layer="water" aria-pressed="false"');
    expect(detail).toContain('data-collection-layer="food" aria-pressed="false"');
    expect(detail).toContain('class="collection-trail-card__toggle" aria-expanded="false"');
    expect(detail).toContain('class="collection-trail-card__details" id="${detailsId}" hidden');
    expect(detail).not.toContain('<span class="simple-card__tier">${esc(safety)}</span>');
    const page = fs.readFileSync(path.join(__dirname, 'collection.html'), 'utf8');
    expect(page).toContain('map-runtime.js');
  });
});
