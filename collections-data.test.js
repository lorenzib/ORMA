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
    expect(page).toContain('data-control-kicker="Country"');
    expect(page).toContain('data-control-kicker="Region"');
    expect(page).toContain('data-control-kicker="Valley"');
    expect((page.match(/data-kicker-until-selected/g) || [])).toHaveLength(3);
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
    expect(fs.readFileSync(path.join(__dirname, 'area-dropdown.js'), 'utf8')).toContain("select.value !== 'all'");
    expect(fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8')).toContain('.area-select-trigger--kicker-until-selected.area-select-trigger--has-selection .area-select-trigger__kicker{display:none;}');
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

  test('the old detail URL redirects instead of shipping a dead page', () => {
    const page = fs.readFileSync(path.join(__dirname, 'collection.html'), 'utf8');
    expect(page).toContain("window.location.replace(id ? 'collections.html?collection='");
    // The redirect runs synchronously in <head>, so anything after it could
    // never execute. Nothing may be re-added here without also un-redirecting.
    expect(page).not.toContain('<script src=');
    // Without JavaScript the redirect never fires; a real link must remain.
    expect(page).toContain('href="collections.html"');
  });
});

// A cover photograph is somebody's work, and a licence that asks for
// attribution asks for it wherever the work appears. The collections page
// rendered covers as a bare CSS background with no credit anywhere, while two
// of them were CC BY-SA: Mangatome's Lac Vert and Anthony Levrot's Marais des
// Chassettes. The credit is now derived from the trail that owns the image,
// so this guards the link that makes that possible.
describe('every collection cover can be credited', () => {
  const { loadProductionTrails } = require('./scripts/load-production-trails');
  const catalogue = loadProductionTrails(__dirname);

  // No exceptions left. Lake loops used images/lago-di-braies.webp, which no
  // trail owns and has no recorded rights; it now uses Lago di Carezza, an
  // ORMA original owned by a trail in the same collection.
  const UNRESOLVED = new Set();

  const creditOf = cover => {
    const owner = catalogue.find(trail => trail.imageIcon === cover || trail.heroImage === cover);
    if(!owner) return null;
    // Mirrors coverCredit() in collections-page.js, so a trail that would
    // render a blank line here cannot pass by carrying fields the page's own
    // condition rejects.
    if(owner.imageSourcePage && owner.imageCreator && owner.imageLicence){
      return `${owner.imageCreator} · ${owner.imageLicence}`;
    }
    const credit = owner.imageCredit;
    return (typeof credit === 'string' ? credit : credit && credit.text) || null;
  };

  test('lake loops leads with an ORMA original from its own trails', () => {
    const lakeLoops = collections.all().find(item => item.id === 'lake-loops');
    expect(lakeLoops.coverImage).toBe('images/lago-di-carezza.webp');
    expect(lakeLoops.trailIds).toContain('lago-carezza');
    expect(creditOf(lakeLoops.coverImage)).toBe('ORMA original');
  });

  test.each(collections.all().map(item => [item.id, item]))(
    '%s names whoever took its cover', (id, item) => {
      if(UNRESOLVED.has(item.coverImage)){
        expect(creditOf(item.coverImage)).toBeNull();
        return;
      }
      expect(creditOf(item.coverImage)).toBeTruthy();
    });

  test('no cover points at an image the catalogue has stopped using', () => {
    // A collection names its own image path, so replacing a trail's cover
    // leaves the collection on the old file -- which is how savoy-hot-day went
    // on showing a photograph the trail page had already dropped.
    const orphans = collections.all()
      .filter(item => !UNRESOLVED.has(item.coverImage))
      .filter(item => !catalogue.some(trail =>
        trail.imageIcon === item.coverImage || trail.heroImage === item.coverImage))
      .map(item => `${item.id} -> ${item.coverImage}`);
    expect(orphans).toEqual([]);
  });
});
