const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('shared map quality profile', () => {
  test('uses antialiasing and hiking-specific vector refinements', () => {
    const runtime = read('map-runtime.js');
    expect(runtime).toContain('antialias: true');
    expect(runtime).toContain("'road_path_pedestrian'");
    expect(runtime).toContain("'highway-name-path'");
    expect(runtime).toContain("['poi_r1', 12]");
    expect(runtime).toContain("'raster-resampling', 'linear'");
  });

  test('applies the profile to the primary map experiences', () => {
    ['script.js', 'trail.js', 'walk-page.js'].forEach(file => {
      const source = read(file);
      expect(source).toContain('DoloPawsMapRuntime.mapOptions');
      expect(source).toContain('DoloPawsMapRuntime.enhance');
    });
  });

  test('loads the shared runtime before each primary page map', () => {
    const pages = [
      ['index.html', 'script.js'],
      ['trail.html', 'trail.js'],
      ['walk.html', 'walk-page.js'],
    ];
    pages.forEach(([page, mapScript]) => {
      const html = read(page);
      if(page === 'trail.html'){
        expect(html).toContain('trail-app.bundle.js?v=20260905-1');
        expect(html).not.toContain('<script src="map-runtime.js');
        return;
      }
      expect(html).toContain('map-runtime.js?v=20260826-1');
      expect(html.indexOf('map-runtime.js?v=20260826-1'))
        .toBeLessThan(html.indexOf(`src="${mapScript}`));
    });
  });

  test('uses the full-width trail card without a duplicate map popup', () => {
    const homepage = read('index.html');
    const script = read('script.js');
    expect(homepage).toContain('id="mapCallout"');
    expect(homepage).toContain('id="mapCalloutOpen"');
    expect(homepage).toContain('<a class="map-callout-thumb" id="mapCalloutThumb" href="#"></a>');
    expect(script).toContain('showMapCallout(t)');
    expect(script).toContain('thumb.href = trailUrl');
    expect(script).toContain("thumb.setAttribute('aria-label', `Open ${t.name} trail details`)");
    expect(script).not.toContain('showTrailMapPopup');
    expect(script).not.toContain("className: 'trail-map-popup'");
  });

  test('renders legible, collision-aware route-number shields', () => {
    const refs = read('trail-route-refs.js');
    expect(refs).toContain("canvas.width = 104");
    // openfreemap serves Noto only: asking for Open Sans 404s every glyph
    // range and MapLibre silently falls back to blurry local rasterisation.
    expect(refs).toContain("'text-font':['Noto Sans Bold']");
    expect(refs).not.toContain("'text-font':['Open Sans Bold'");
    // A route number is wayfinding detail, not overview context.
    expect(refs).toContain('minzoom:12');
    expect(refs).toContain("'symbol-spacing':['interpolate', ['linear'], ['zoom'], 12, 220");
    expect(refs).toContain("'text-size':['interpolate', ['linear'], ['zoom'], 12, 11.5");
    // Collision on: overlapping shields were the clutter.
    expect(refs).toContain("'icon-allow-overlap':false");
    expect(refs).toContain("'text-allow-overlap':false");
  });

  test('draws the Waymarked Trails network in its own colours', () => {
    const style = read('map-style.js');
    expect(style).toContain('tile.waymarkedtrails.org/hiking');
    // The old treatment desaturated by -0.90 and pushed contrast, which
    // turned their route lines and numbered shields into grey smudges.
    expect(style).toContain("'raster-saturation': 0");
    expect(style).toContain("'raster-contrast': 0");
    expect(style).not.toContain("'raster-saturation': -");
    expect(style).toContain('14, 0.88');
    // Inserted below the first label layer so place names stay on top.
    expect(style).toContain('function firstLabelLayerId(map)');
    expect(style).toContain('function quietBasemap(map)');
  });

  test('the selected route highlights the marked path from underneath', () => {
    const style = read('map-style.js');
    // A solid line ON TOP buries Waymarked's own route line and its numbered
    // shields — which is why we used to reprint the numbers ourselves. The
    // route goes below the raster as a translucent corridor instead.
    expect(style).toContain("'line-opacity': 0.55");
    expect(style).toContain('widthRamp(10, 16, 23, 33, scale)');
    expect(style).toContain('widthRamp(7, 12, 18, 26, scale)');
    // Default insertion point is the waymarked layer when one is present.
    expect(style).toContain("map.getLayer(WAYMARKED_LAYER) ? WAYMARKED_LAYER : firstLabelLayerId(map)");
    // The opaque-on-top treatment stays available for maps with no raster.
    expect(style).toContain("config.mode === 'overlay'");

    const trail = read('trail.js');
    expect(trail).toContain('beforeId: window.ORMAMapStyle.WAYMARKED_LAYER,');
    // Direction arrows stay above the raster but below place names.
    expect(trail).toMatch(/id: 'single-trail-direction-arrows'[\s\S]*?\}, firstLabelId\);/);

    // Route planner draws its draft under the network too — you cannot trace
    // a path you have painted over.
    expect(read('route-planner.js')).toContain("? 'planner-waymarked-hiking-layer' : (label && label.id)");
    // Collection routes sit below their raster on the live inline map.
    expect(read('collections-page.js')).toContain('beneath);');
  });

  test('no map reprints route numbers that Waymarked already draws', () => {
    // Shields survive only where an ORMA rail deliberately masks the raster:
    // the homepage catalogue lines. Every single-route highlight relies on
    // Waymarked's own numbers showing through.
    expect(read('trail.js')).not.toContain('addShieldLayer');
    const homepage = read('script.js');
    expect(homepage).not.toContain("id:'trail-selected-route-number'");
    expect(homepage).not.toContain("'trail-selected-route-refs'");
    // The catalogue rails now contour the raster as well, so no ORMA map
    // reprints a route number anywhere.
    expect(homepage).not.toContain("id:'trail-paths-route-number'");
    expect(homepage).not.toContain('addShieldLayer');
    expect(read('collections-page.js')).toContain('style.addWaymarkedHiking(map');
  });

  test('browse maps start quiet, the navigating map does not', () => {
    // AllTrails shows no path network at browse zooms at all. Ours has to
    // appear eventually — Dolomites walkers follow the numbers on signposts —
    // but not while you are still deciding which valley to drive to.
    const homepage = read('script.js');
    expect(homepage).toContain('const overlayStates = { routes: false, lifts: false');
    expect(homepage).toContain('visible: false });');
    // Nothing is removed without a way back: the Layers chip drives the layer.
    expect(homepage).toContain("routes:   ['waymarked-hiking-layer']");

    // The collection map opens at a fixed zoom 9 and has no layers control, so
    // zoom is the affordance there instead of a chip.
    const collections = read('collections-page.js');
    expect(collections).toContain('const NETWORK_MIN_ZOOM = 13.5');
    expect(collections).toContain('minzoom: NETWORK_MIN_ZOOM');

    // The trail detail map keeps the network on and unthrottled. Its opening
    // fitBounds lands anywhere from z10.7 to z17 across the catalogue, so a
    // zoom threshold there would show the network on some trails and not
    // others with no explanation — worse than either choice.
    const trail = read('trail.js');
    expect(trail).toContain('ORMAMapStyle.addWaymarkedHiking(map, { beforeId: firstLabelId })');
    expect(trail).not.toContain('minzoom: NETWORK_MIN_ZOOM');
  });

  test('every map draws the shared Waymarked treatment', () => {
    ['trail.js', 'script.js', 'collections-page.js'].forEach(file => {
      const source = read(file);
      expect(source).toContain('ORMAMapStyle');
      expect(source).not.toContain("'raster-saturation': -0.90");
      expect(source).not.toContain("'raster-saturation': -1");
    });
    expect(read('route-planner.js')).toContain('ORMAMapStyle.quietBasemap(map)');
    // collection.html is a redirect stub and loads no scripts at all.
    ['index.html', 'collections.html', 'route-planner.html', 'walk.html']
      .forEach(file => expect(read(file)).toContain('map-style.js'));
    expect(read('scripts/build-trail-page-bundle.js')).toContain("'map-style.js'");
  });
});
