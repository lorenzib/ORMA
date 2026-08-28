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

  test('landing page exposes search, visible area filters and theme buttons with Browse-style cards', () => {
    const page = fs.readFileSync(path.join(__dirname, 'collections.html'), 'utf8');
    const controller = fs.readFileSync(path.join(__dirname, 'collections-page.js'), 'utf8');
    expect(page).toContain('id="collectionSearch"');
    expect(page).toContain('id="collectionCountrySelect"');
    expect(page).toContain('id="collectionRegionSelect"');
    expect(page).toContain('id="collectionValleySelect"');
    expect(page).not.toContain('id="collectionThemesButton"');
    expect(page).toContain('data-collection-theme="gentle"');
    expect(page).toContain('data-dp-icon="gentle"');
    expect(page).toContain('data-dp-icon="summer"');
    expect(page).toContain('data-dp-icon="scenic"');
    expect(page).toContain('icon-system.js');
    expect(page).not.toContain('Dog essentials');
    expect(page).toContain('area-dropdown.js');
    expect(controller).toContain('THEME_MATCHERS');
    expect(controller).toContain('collectionInValley');
    expect(controller).toContain('class="simple-card collection-list-card${isOpen');
    expect(controller).toContain('class="collection-list-card__summary"');
    expect(controller).toContain('${esc(collection.subtitle)}');
    expect(controller).not.toContain('waterSpecific(collection.chips[0])');
    expect(controller).toContain('data-collection-expand');
    expect(controller).toContain('data-collection-map-open');
    expect(controller).toContain("expandedCollectionView = 'map'");
    expect(controller).toContain('expandedCollectionId');
    expect(controller).toContain('class="collection-inline-trail"');
    expect(controller).toContain('data-difficulty="${difficulty}"');
    expect(controller).toContain("'low-risk':'Low-risk terrain'");
    expect(page).toContain('map-runtime.js');
    expect(controller).toContain('collection-inline-map');
    expect(controller).toContain('collection-map-trail-card');
    expect(controller).toContain("map.on('click', 'collection-inline-routes-hit'");
    expect(controller).toContain('new maplibregl.AttributionControl({ compact:true })');
    expect(controller).toContain("classList.remove('maplibregl-compact-show')");
    expect(controller).toContain("searchParams.set('collection'");
    expect(controller).not.toContain('Full collection &amp; map');
    expect(controller).toContain('trail.html?id=');
  });

  test('detail page supports photos and route-outline placeholders', () => {
    const detail = fs.readFileSync(path.join(__dirname, 'collection-detail.js'), 'utf8');
    expect(detail).toContain('DoloPawsTrailVisual');
    expect(detail).toContain('visual.render(trail');
    expect(detail).toContain('trail.html?id=');
    expect(detail).toContain('collectionTrailMap');
    expect(detail).toContain("map.addSource('collection-routes'");
    expect(detail).toContain("map.addSource('collection-waymarked-hiking'");
    expect(detail).toContain("paint:{ 'raster-opacity':1, 'raster-resampling':'linear' }");
    expect(detail).toContain("}, 'collection-waymarked-hiking-layer');");
    expect(detail).toContain("addPoiLayers(map, 'rifugi'");
    expect(detail).toContain("addPoiLayers(map, 'water'");
    expect(detail).toContain("addPoiLayers(map, 'food'");
    expect(detail).toContain('data-collection-layer="rifugi" aria-pressed="false"');
    expect(detail).toContain('data-collection-layer="water" aria-pressed="false"');
    expect(detail).toContain('data-collection-layer="food" aria-pressed="false"');
    expect(detail).toContain('class="collection-trail-card__toggle" aria-expanded="false"');
    expect(detail).toContain('class="collection-trail-card__details" id="${detailsId}" hidden');
    expect(detail).toContain('data-collection-match-inline="${esc(trail.id)}"');
    expect(detail).toContain('data-collection-match-score="${esc(trail.id)}"');
    expect(detail).toContain('APPROX. MATCH FOR A MEDIUM DOG');
    expect(detail).toContain('window.DoloPawsAuth.getDogProfile()');
    expect(detail).not.toContain('<span class="simple-card__tier">${esc(safety)}</span>');
    const page = fs.readFileSync(path.join(__dirname, 'collection.html'), 'utf8');
    expect(page).toContain("window.location.replace(id ? 'collections.html?collection='");
    expect(page).toContain('map-runtime.js');
    expect(page.indexOf('scoring.js')).toBeLessThan(page.indexOf('collection-detail.js'));
  });
});
