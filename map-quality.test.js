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
        expect(html).toContain('trail-app.bundle.js?v=20261016-1');
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

  test('draws elevation contours from the DEM, lazily and guarded', () => {
    const style = read('map-style.js');
    const runtime = read('map-runtime.js');
    const trail = read('trail.js');

    // Contours are generated client-side by maplibre-contour from the terrarium
    // DEM -- no contour tile server, no API key. The plugin is loaded lazily
    // and the styling is a no-op when it is absent, never an error.
    expect(runtime).toContain('function loadContour()');
    expect(runtime).toContain('maplibre-contour@');
    expect(style).toContain('function addContours(map, options)');
    expect(style).toContain("encoding: 'terrarium'");
    expect(style).toContain('contourProtocolUrl(');
    // Labels must use Noto -- openfreemap serves no Open Sans.
    expect(style).toContain("'text-font': FONT_REGULAR");
    // The trail detail map wires it in, guarded so a load failure leaves the
    // base map untouched.
    expect(trail).toContain('DoloPawsMapRuntime.loadContour()');
    expect(trail).toContain('ORMAMapStyle.addContours(map)');
  });

  test('the selected route highlights the marked path from underneath', () => {
    const style = read('map-style.js');
    // A solid line ON TOP buries Waymarked's own route line and its numbered
    // shields, which is why we used to reprint the numbers ourselves. The
    // route goes below the raster as a translucent corridor instead.
    expect(style).toContain("'line-opacity': 0.55");
    expect(style).toContain('widthRamp(10, 16, 23, 33, scale)');
    expect(style).toContain('widthRamp(7, 12, 18, 26, scale)');
    // Default insertion point: under the Waymarked raster where a map still
    // draws it, between our dashed routes and their numbers where it draws
    // our own network.
    expect(style).toContain('const fallbackBefore = walkLineBeforeId(map);');
    expect(style).toMatch(/function walkLineBeforeId\(map\) \{\s*if \(map && map.getLayer\(HIKING_REF_LAYER\)\) return HIKING_REF_LAYER;\s*if \(map && map.getLayer\(WAYMARKED_LAYER\)\) return WAYMARKED_LAYER;/);
    // The opaque-on-top treatment stays available for maps with no raster.
    expect(style).toContain("config.mode === 'overlay'");

    const trail = read('trail.js');
    expect(trail).toContain('beforeId: window.ORMAMapStyle.walkLineBeforeId(map),');
    // Direction arrows stay above the raster but below place names.
    expect(trail).toMatch(/id: 'single-trail-direction-arrows'[\s\S]*?\}, firstLabelId\);/);

    // Route planner draws its draft under the route numbers too, you cannot
    // trace a path whose numbers you have painted over.
    expect(read('route-planner.js')).toContain("const under = window.ORMAMapStyle ? window.ORMAMapStyle.walkLineBeforeId(map) : (label && label.id);");
    // Collection routes sit below the route numbers on the live inline map.
    expect(read('collections-page.js')).toContain('const beneath = style ? style.walkLineBeforeId(map) : undefined;');
    expect(read('collections-page.js')).toContain('beneath);');
  });

  test('no map reprints route numbers that the hiking network already draws', () => {
    // Every map draws the hiking network with its own route numbers, so no
    // highlight reprints them as shields.
    expect(read('trail.js')).not.toContain('addShieldLayer');
    const homepage = read('script.js');
    expect(homepage).not.toContain("id:'trail-selected-route-number'");
    expect(homepage).not.toContain("'trail-selected-route-refs'");
    // The catalogue rails sit under the numbers as well, so no ORMA map
    // reprints a route number anywhere.
    expect(homepage).not.toContain("id:'trail-paths-route-number'");
    expect(homepage).not.toContain('addShieldLayer');
    expect(read('collections-page.js')).toContain('style.addHikingRoutes(map, {');
  });

  test('green/amber/red means dog match on every map, and nothing else', () => {
    // Three near-identical green/amber/red palettes used to coexist: the match
    // tiers, trail.js safetyColor() and collections difficultyColour(). Two of
    // them encoded the trail's intrinsic risk while looking exactly like a
    // match tier, so a guest and a signed-in owner read the same coloured line
    // as answering different questions.
    const style = read('map-style.js');
    expect(style).toContain("MATCH_COLOURS = Object.freeze({ good: '#4A7856', fair: '#C98A2E', poor: '#9C3A25' })");
    expect(style).toContain('function matchColour(score)');
    expect(style).toContain('function matchColourExpression(property)');
    // An unknown fit must not read as a good or bad one.
    expect(style).toContain("MATCH_UNKNOWN = '#6B7A6E'");

    // The rival palettes are gone.
    expect(read('trail.js')).not.toContain('function safetyColor(');
    expect(read('collections-page.js')).not.toContain('difficultyColour(');

    // Every map route colour now comes from the one definition.
    ['script.js', 'trail.js', 'collections-page.js'].forEach(file => {
      expect(read(file)).toMatch(/ORMAMapStyle\.matchColour(Expression)?\(/);
    });
    // No map re-inlines the thresholds.
    ['script.js', 'trail.js', 'collections-page.js'].forEach(file => {
      expect(read(file)).not.toContain("65, '#C98A2E', 85, '#4A7856'");
    });

    // Guests are scored against one shared profile rather than falling back to
    // a different meaning. The site already tells them it is a medium dog.
    expect(read('scoring.js')).toContain('GUEST_SUBJECT');
    expect(read('script.js')).toContain('scoring.GUEST_SUBJECT');
    expect(read('trail.js')).toContain('scoring.GUEST_SUBJECT');
    expect(read('collections-page.js')).toContain('scoring.GUEST_SUBJECT');
    // The collection page needs the engine loaded to score at all.
    expect(read('collections.html')).toContain('scoring.js');
  });

  test('the collection map colours by the signed-in dog, not a generic one', () => {
    // Scoring every visitor against the guest profile would leave this map
    // answering "does this suit a generic dog" while every other ORMA surface
    // answers "does this suit yours", the same defect the palette clean-up
    // set out to remove, one layer down.
    const page = read('collections-page.js');
    expect(page).toContain('matchSubject || scoring.GUEST_SUBJECT');
    expect(page).toContain('auth.getDogProfile()');
    expect(page).toContain('effectiveOverrides(profile, null)');
    // Auth resolves after first paint, so an already-drawn map must restyle.
    expect(page).toContain('repaintOnSubjectChange');
    expect(page).toContain('const repaintMatchColours');
    expect(page).toContain("window.addEventListener('dolopaws-auth-changed', resolveMatchSubject)");
    // Both the corridors and the start markers carry the colour.
    expect(page).toContain("source.setData({");
    expect(page).toContain("element.style.setProperty('--route-colour', matchColour(trail))");
    // A destroyed map must not be reachable from a later profile change.
    expect(page).toMatch(/activeMap = null;[\s\S]*?repaintOnSubjectChange\.clear\(\);/);
    // The page needs auth loaded to resolve a profile at all.
    expect(read('collections.html')).toContain('firebase-init.js');
  });

  test('no homepage guest map: the container was deleted in July 2026', () => {
    // #guestPreviewMap left index.html in 784afd0b (2026-07-17) and was never
    // replaced, so initGuestMap() returned on its first line and ~160 lines of
    // map setup could not run. It was still being maintained, the cartography
    // work restyled layers in there that nothing renders, so it is deleted.
    // A signed-out visitor sees no map on the homepage at all.
    // Comments explaining the removal legitimately name these symbols, so
    // check the code with line comments stripped.
    const code = read('script.js').split('\n')
      .filter(line => !line.trim().startsWith('//')).join('\n');
    ['guestPreviewMap', 'guestMapInstance', 'initGuestMap', 'scheduleGuestMap',
      'guest-trail-paths', 'guest-gondolas'].forEach(symbol => {
      expect({ symbol, inCode: code.includes(symbol) }).toEqual({ symbol, inCode: false });
    });
    // If a guest map is ever wanted again it needs a container first.
    expect(read('index.html')).not.toContain('guestPreviewMap');
  });

  test('the guest scoring profile has exactly one definition', () => {
    // Four copies of { terrain:'1', distance:'10', heatSensitive:false } were
    // scattered through script.js, the same duplication that produced three
    // rival colour palettes.
    const script = read('script.js');
    expect(script).toContain('function guestOverrides()');
    expect(script).toContain('scoring.GUEST_SUBJECT');
    // script.js is also evaluated without the scoring stack, so the accessor
    // tolerates a missing engine rather than taking the homepage down.
    expect(script).toMatch(/return \(scoring && scoring\.GUEST_SUBJECT\) \|\|/);
    expect(read('scoring.js')).toContain("GUEST_SUBJECT = Object.freeze({ terrain:'1', distance:'10', heatSensitive:false })");
  });

  test('the browse map shows the path network, the collection map waits for zoom', () => {
    // This was the other way round, on the reasoning that AllTrails shows no
    // path network at browse zooms and the lines bury the ORMA routes you are
    // choosing between. Reversed deliberately on 2026-10-14 after seeing it on
    // the real map: the lines give the valley its shape, and a reader who
    // wants them should not have to know the Layers panel exists.
    //
    // The chip default stands. What changed on 2026-10-16 is WHEN: at region
    // zoom the network is a mesh of lines and route shields over the six walks
    // a reader is choosing between, so it now draws from zoom 12.5 up, where
    // the shape it gives a valley is the shape of a walk.
    const homepage = read('script.js');
    expect(homepage).toContain('const overlayStates = { routes: true, lifts: false');
    expect(homepage).toContain('visible: true, minzoom: BROWSE_NETWORK_MIN_ZOOM');
    expect(homepage).toContain('const BROWSE_NETWORK_MIN_ZOOM = 12.5');
    // Still one tap to turn off: the Layers chip drives the layer either way.
    expect(homepage).toContain('routes:   window.ORMAMapStyle.HIKING_LAYER_IDS,');

    // The collection map opens at a fixed zoom 9 and has no layers control, so
    // zoom is the affordance there instead of a chip.
    const collections = read('collections-page.js');
    expect(collections).toContain('const NETWORK_MIN_ZOOM = 13.5');
    expect(collections).toContain('minzoom: NETWORK_MIN_ZOOM');

    // The trail detail map keeps the network on and unthrottled. Its opening
    // fitBounds lands anywhere from z10.7 to z17 across the catalogue, so a
    // zoom threshold there would show the network on some trails and not
    // others with no explanation, worse than either choice.
    const trail = read('trail.js');
    expect(trail).toMatch(/ORMAMapStyle\.addHikingRoutes\(map, \{\s*beforeId: firstLabelId,/);
    expect(trail).not.toContain('minzoom: NETWORK_MIN_ZOOM');
  });

  test('the base style is drained of colour, not just of labels', () => {
    // openfreemap liberty is a street map: 24 road layers in #e9ac77 casing,
    // #fea fill and #fc8 motorway, saturated greens, and water at
    // rgb(158,189,255). None of that is what a reader is choosing between on a
    // dog-walking map, and all of it competed with the two things that are:
    // the marked network and the match-coloured rails.
    const style = read('map-style.js');
    expect(style).toContain('function calmBasemap(map)');
    // Roads keep their widths and lose their hue, so the hierarchy survives.
    expect(style).toContain("casing: { colour: '#CFC8BE'");
    expect(style).toContain("through: { colour: '#FFFFFF'");
    expect(style).toContain("'road_motorway_casing'");
    // Woods, parks and water keep a real but soft hue. Draining them to the
    // background was tried and rejected on a render: the map became a grey
    // relief sheet with no valleys, settlements or water, which reads worse
    // than the loud version.
    expect(style).toContain("{ id: 'landcover_wood', colour: '#C6D6B8'");
    expect(style).toContain("{ id: 'water', colour: '#AFC9DD'");
    // Quietening the labels brings the drained colours with it, so the five
    // surfaces that call it cannot drift apart.
    expect(style).toMatch(/function quietBasemap[\s\S]*?calmBasemap\(map\);/);
  });

  test('only a numbered match gets a corridor on the browse map', () => {
    // Every catalogue trail used to get an 8px white casing, a 5px grey line
    // and a 14px white halo at zoom 10, whatever its rank, with the colour on
    // top dropped to 0.12 for the rest -- so an unmatched walk was a wide
    // white smear with nothing inside it.
    const homepage = read('script.js');
    expect(homepage).toContain('function rankWidth(top, other)');
    expect(homepage).toContain('rankWidth([8, 14, 20, 26], [2.5, 4, 5.5, 6.5])');
    expect(homepage).toContain('rankWidth([5, 10, 15, 20], [1.2, 1.8, 2.4, 3])');
    // The zoom ramp has to stay at the top of the paint property. An
    // `interpolate` on ["zoom"] nested inside a `case` is not evaluated per
    // zoom: it silently cost the matched trails their corridor at trail zoom
    // when this was first written, and only a render caught it.
    expect(homepage).toMatch(/function rankWidth[\s\S]*?'interpolate', \['linear'\], \['zoom'\]/);
    expect(homepage).not.toMatch(/'line-width': \['case', TOP_MATCH_TEST, \['interpolate'/);
  });

  test('the relief fades at browse zoom, in both copies', () => {
    // #468 set a flat 0.45 so the map would not read as flat. On a drained
    // base that strength is the loudest thing left at region zoom and it greys
    // out the roads and villages under it. Ramped, not weakened: it reaches
    // the same 0.45 by zoom 13, where the detail maps open.
    const ramp = "'interpolate', ['linear'], ['zoom'], 8, 0.16, 11, 0.3, 13, 0.45";
    expect(read('script.js')).toContain(ramp);
    // addBaseHillshade is duplicated in trail.js and script.js; the two have
    // to say the same thing.
    expect(read('trail.js')).toContain(ramp);
    ['script.js', 'trail.js'].forEach(file => {
      expect(read(file)).not.toContain("'hillshade-exaggeration': 0.45");
    });
  });

  test('every map draws the shared hiking-network treatment', () => {
    ['trail.js', 'script.js', 'collections-page.js'].forEach(file => {
      const source = read(file);
      expect(source).toContain('ORMAMapStyle');
      expect(source).not.toContain("'raster-saturation': -0.90");
      expect(source).not.toContain("'raster-saturation': -1");
    });
    expect(read('route-planner.js')).toContain('ORMAMapStyle.quietBasemap(map)');
    expect(read('walk-page.js')).toContain('style.quietBasemap(map)');
    // Our own routes everywhere; only map-style.js knows Waymarked's address,
    // for the fallback.
    ['trail.js', 'script.js', 'collections-page.js', 'route-planner.js', 'walk-page.js'].forEach(file => {
      expect(read(file)).toContain('addHikingRoutes(');
      expect(read(file)).not.toContain('tile.waymarkedtrails.org');
      expect(read(file)).not.toContain('addWaymarkedHiking(');
    });
    // collection.html is a redirect stub and loads no scripts at all.
    ['index.html', 'collections.html', 'route-planner.html', 'walk.html']
      .forEach(file => expect(read(file)).toContain('map-style.js'));
    expect(read('scripts/build-trail-page-bundle.js')).toContain("'map-style.js'");
  });
});
