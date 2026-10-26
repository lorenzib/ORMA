/**
 * map-style.js, one shared cartographic treatment for every ORMA map.
 *
 * Before this file each map (trail detail, homepage, route planner,
 * collection) added the Waymarked Trails raster with its own hand-tuned
 * paint block, and the trail detail map desaturated it by -0.90 with a
 * contrast bump. That turned Waymarked's red route lines and their
 * red/white route-number shields into grey smudges: legible as "something
 * is there", illegible as "which path is this".
 *
 * The hiking network IS the product on a dog-walking map, so it is now
 * drawn in its own colours, and everything that used to compete with it
 * (basemap POI icons, road shields, dense amenity pins) is quietened
 * instead. The reference is AllTrails: a calm base, one unmistakable route
 * line, and the marked path network readable underneath it.
 *
 * Everything here is idempotent, calling twice on the same map is a no-op.
 */
(function (global) {
  'use strict';

  // Waymarked Trails' public hiking layer. Same OSM data as our vector base,
  // but with the route-relation rendering (numbered routes, waymark colours)
  // that a general-purpose basemap does not draw.
  const WAYMARKED_TILES = 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png';
  const WAYMARKED_ATTRIBUTION = '© Sarah Hoffmann (CC-BY-SA), waymarkedtrails.org';
  const WAYMARKED_SOURCE = 'waymarked-hiking';
  const WAYMARKED_LAYER = 'waymarked-hiking-layer';

  // The tile server serves Noto only. Asking for "Open Sans Bold" 404s every
  // glyph range and MapLibre silently falls back to locally-rasterised
  // glyphs, which is what made the route-number shields look like clip-art.
  const FONT_BOLD = ['Noto Sans Bold'];
  const FONT_REGULAR = ['Noto Sans Regular'];

  // Basemap symbol layers that add noise without helping a walker: shop and
  // service icons, road shields, aerodrome clutter. Hidden rather than
  // deleted so a caller can put them back.
  const NOISY_BASE_LAYER_PATTERN = /^(poi|place_|airport|highway-name|road_shield|highway-shield|ferry|water_name-line)/i;
  const KEEP_BASE_LAYER_PATTERN = /(peak|mountain|alpine|hut|shelter|water|spring|park|forest|place_label_city|place_label_town|place_label_village)/i;

  function isStyleReady(map) {
    try {
      return !!(map && typeof map.getStyle === 'function' && map.getStyle() && map.getStyle().layers);
    } catch (error) {
      return false;
    }
  }

  /**
   * The id of the first symbol (text/icon) layer in the base style.
   *
   * Anything inserted with no target position stacks on top of EVERYTHING,
   * including every place name. Inserting before this id keeps an overlay
   * above roads and fills but below all labels, so names stay readable in
   * flat and 3D alike.
   */
  function firstLabelLayerId(map) {
    if (!isStyleReady(map)) return undefined;
    const layer = map.getStyle().layers.find(item => item.type === 'symbol');
    return layer ? layer.id : undefined;
  }

  /**
   * Add the Waymarked Trails hiking network in its own colours.
   *
   * The opacity ramp is the only concession to legibility: at region zoom the
   * network is context and sits back; from trail zoom up it is the subject
   * and reads at nearly full strength. No desaturation, no contrast
   * stretching, their shields are designed to be read.
   */
  function addWaymarkedHiking(map, options) {
    const config = options || {};
    if (!map || map.getLayer(WAYMARKED_LAYER)) return WAYMARKED_LAYER;
    if (!map.getSource(WAYMARKED_SOURCE)) {
      map.addSource(WAYMARKED_SOURCE, {
        type: 'raster',
        tiles: [WAYMARKED_TILES],
        tileSize: 256,
        maxzoom: 18,
        attribution: WAYMARKED_ATTRIBUTION,
      });
    }
    const beforeId = config.beforeId !== undefined ? config.beforeId : firstLabelLayerId(map);
    map.addLayer({
      id: WAYMARKED_LAYER,
      type: 'raster',
      source: WAYMARKED_SOURCE,
      // `minzoom` holds the network back until it is navigational rather than
      // decorative. AllTrails draws no path network at browse zooms at all;
      // ours has to appear eventually because Dolomites walkers follow the
      // numbers on the signposts, but it does not have to be there while you
      // are still choosing a valley.
      ...(Number.isFinite(config.minzoom) ? { minzoom: config.minzoom } : {}),
      layout: { visibility: config.visible === false ? 'none' : 'visible' },
      paint: {
        // Quiet at overview zooms, near-solid once a single valley fills the
        // screen. The old ramp topped out at 0.92 but paired it with a -0.90
        // saturation kill, which is what made the shields unreadable.
        'raster-opacity': [
          'interpolate', ['linear'], ['zoom'],
          7, 0.22,
          10, 0.38,
          12, 0.62,
          14, 0.88,
          16, 0.95,
        ],
        // Native colours. Waymarked's palette is already a muted
        // cartographic one; it does not need our correction.
        'raster-saturation': 0,
        'raster-contrast': 0,
        'raster-resampling': 'linear',
        'raster-fade-duration': 120,
      },
    }, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
    return WAYMARKED_LAYER;
  }

  function setWaymarkedVisible(map, visible) {
    if (!map || !map.getLayer(WAYMARKED_LAYER)) return;
    map.setLayoutProperty(WAYMARKED_LAYER, 'visibility', visible ? 'visible' : 'none');
  }

  // ── Our own hiking network ──────────────────────────────────────────────
  // Waymarked's raster is a finished picture in their colours -- purple,
  // yellow, orange and red lines, red and blue shields -- and on a trail page
  // it put four colours around the one line that matters, the walk. These
  // layers draw the same OSM route relations ourselves (built weekly by
  // scripts/build-hiking-route-tiles.sh, published under data/hiking-routes/):
  // every route a thin dashed grey line with its number, so the walk is the
  // only coloured line on the map. Approved on renders, 26 Oct 2026.
  //
  // Waymarked stays as the fallback: if the tiles are missing or fail to
  // load, the raster is put back in their place.
  const HIKING_SOURCE = 'orma-hiking-routes';
  const HIKING_LINE_LAYER = 'orma-hiking-routes-line';
  const HIKING_REF_LAYER = 'orma-hiking-routes-ref';
  const HIKING_WALK_SOURCE = 'orma-hiking-walk-refs';
  const HIKING_WALK_REF_LAYER = 'orma-hiking-routes-ref-walk';
  const HIKING_TILES_PATH = '/data/hiking-routes/{z}/{x}/{y}.pbf';
  const HIKING_METADATA_PATH = '/data/hiking-routes/metadata.json';
  // Both regions' padded extents (REGIONS in build-hiking-routes.js), so the
  // map does not ask for tiles across the rest of Europe.
  const HIKING_BOUNDS = [5.65, 45.06, 12.66, 47.03];
  const HIKING_LINE_COLOUR = '#5F665F';
  const HIKING_REF_COLOUR = '#4D554E';
  const HIKING_WALK_REF_COLOUR = '#2E4034';
  // How close (metres) the walk must run to a route to be walking on it.
  const WALK_ROUTE_TOLERANCE_M = 25;
  // Shorter shared stretches are crossings, not the walk following a route.
  const WALK_ROUTE_MIN_STRETCH_M = 120;

  function hikingTilesUrl() {
    const origin = global.location && global.location.origin;
    // A file:// page has no origin to serve tiles from.
    if (!origin || origin === 'null') return null;
    return origin + HIKING_TILES_PATH;
  }

  function metresBetween(a, b) {
    const lat = (a[1] + b[1]) / 2 * Math.PI / 180;
    const dx = (b[0] - a[0]) * 111320 * Math.cos(lat);
    const dy = (b[1] - a[1]) * 110570;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Metres from point p to segment a-b, on a local flat projection.
  function metresToSegment(p, a, b) {
    const kx = 111320 * Math.cos(p[1] * Math.PI / 180);
    const ky = 110570;
    const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
    const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq)) : 0;
    const x = ax + t * dx, y = ay + t * dy;
    return Math.sqrt(x * x + y * y);
  }

  function featureLines(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'LineString') return [geometry.coordinates];
    if (geometry.type === 'MultiLineString') return geometry.coordinates;
    return [];
  }

  /**
   * The stretches of the walk that run on a numbered route, one line per
   * route per stretch, so the walk's own numbers are set along the part it
   * shares with each route and nowhere else.
   *
   * `walk` is [[lng, lat], ...]; `routes` are GeoJSON features with `id` and
   * `ref` properties, e.g. from querySourceFeatures (one route can arrive as
   * many tile pieces). Returns the ids of the routes the walk uses and the
   * label lines.
   */
  function walkRouteStretches(walk, routes, options) {
    const config = options || {};
    const tolerance = config.tolerance || WALK_ROUTE_TOLERANCE_M;
    const minStretch = config.minStretch || WALK_ROUTE_MIN_STRETCH_M;
    // Segments are filed under every grid cell their box touches, padded by
    // more than the tolerance (~40 m), so a walk vertex finds every segment
    // near it by looking in its own cell alone.
    const cell = 0.002;
    const pad = 0.0005;
    const index = value => Math.floor(value / cell);
    const grid = new Map();
    const refs = new Map();
    (routes || []).forEach(feature => {
      const props = feature.properties || {};
      const id = Number(props.id);
      if (!props.ref || !Number.isFinite(id)) return;
      refs.set(id, props.ref);
      featureLines(feature.geometry).forEach(line => {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1], b = line[i];
          for (let x = index(Math.min(a[0], b[0]) - pad); x <= index(Math.max(a[0], b[0]) + pad); x++) {
            for (let y = index(Math.min(a[1], b[1]) - pad); y <= index(Math.max(a[1], b[1]) + pad); y++) {
              const k = `${x},${y}`;
              if (!grid.has(k)) grid.set(k, []);
              grid.get(k).push({ id, a, b });
            }
          }
        }
      });
    });
    const key = point => `${index(point[0])},${index(point[1])}`;
    // Which routes each walk vertex sits on.
    const onRoutes = (walk || []).map(point => {
      const ids = new Set();
      (grid.get(key(point)) || []).forEach(segment => {
        if (!ids.has(segment.id) && metresToSegment(point, segment.a, segment.b) <= tolerance) ids.add(segment.id);
      });
      return ids;
    });
    const used = new Set();
    const features = [];
    refs.forEach((ref, id) => {
      let run = [];
      const close = () => {
        let length = 0;
        for (let i = 1; i < run.length; i++) length += metresBetween(run[i - 1], run[i]);
        if (run.length >= 2 && length >= minStretch) {
          used.add(id);
          features.push({ type: 'Feature', properties: { id, ref }, geometry: { type: 'LineString', coordinates: run } });
        }
        run = [];
      };
      onRoutes.forEach((ids, index) => {
        if (ids.has(id)) run.push(walk[index]);
        else close();
      });
      close();
    });
    return { ids: [...used], features };
  }

  function hikingLayersPresent(map) {
    return !!(map && map.getLayer(HIKING_LINE_LAYER));
  }

  /** Swap our layers for Waymarked's raster, keeping their place and visibility. */
  function fallBackToWaymarked(map) {
    if (!hikingLayersPresent(map)) return;
    const visible = map.getLayoutProperty(HIKING_LINE_LAYER, 'visibility') !== 'none';
    addWaymarkedHiking(map, { beforeId: HIKING_REF_LAYER, visible });
    [HIKING_WALK_REF_LAYER, HIKING_REF_LAYER, HIKING_LINE_LAYER].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    [HIKING_WALK_SOURCE, HIKING_SOURCE].forEach(id => {
      if (map.getSource(id)) map.removeSource(id);
    });
  }

  /**
   * Draw the hiking network from our own tiles: dashed grey lines, every
   * route's number from trail zoom (12) up, ranked international first when
   * they crowd. Pass `walk` ([[lng, lat], ...]) on a single-walk map and the
   * routes the walk follows get bigger, darker numbers beside the walk, only
   * along the stretch it shares with them.
   *
   * Falls back to Waymarked's raster when the tiles cannot be served.
   */
  function addHikingRoutes(map, options) {
    const config = options || {};
    if (!map || hikingLayersPresent(map)) return HIKING_LINE_LAYER;
    const tiles = hikingTilesUrl();
    if (!tiles) return addWaymarkedHiking(map, config);
    const beforeId = config.beforeId !== undefined ? config.beforeId : firstLabelLayerId(map);
    const target = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
    const visibility = config.visible === false ? 'none' : 'visible';
    map.addSource(HIKING_SOURCE, {
      type: 'vector', tiles: [tiles], minzoom: 10, maxzoom: 14, bounds: HIKING_BOUNDS,
    });
    map.addSource(HIKING_WALK_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: HIKING_LINE_LAYER, type: 'line', source: HIKING_SOURCE, 'source-layer': 'routes',
      layout: { visibility, 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': HIKING_LINE_COLOUR,
        'line-opacity': 0.75,
        // Dashed so a route never reads as a contour line.
        'line-dasharray': [2, 1.6],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 13, 1.4, 16, 2.4],
      },
    }, target);
    map.addLayer({
      id: HIKING_REF_LAYER, type: 'symbol', source: HIKING_SOURCE, 'source-layer': 'routes',
      minzoom: 12,
      filter: ['!=', ['get', 'ref'], ''],
      layout: {
        visibility,
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        // International before national, regional, then local.
        'symbol-sort-key': ['get', 'rank'],
        'text-field': ['get', 'ref'],
        'text-font': FONT_BOLD,
        'text-size': 11,
        'text-padding': 6,
        'text-rotation-alignment': 'viewport',
        'text-keep-upright': true,
      },
      paint: { 'text-color': HIKING_REF_COLOUR, 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 },
    }, target);
    // Above the grey numbers, so the walk's own win where they collide.
    map.addLayer({
      id: HIKING_WALK_REF_LAYER, type: 'symbol', source: HIKING_WALK_SOURCE,
      minzoom: 12,
      layout: {
        visibility,
        'symbol-placement': 'line',
        // Wide enough that a loop on one route is not numbered at every bend.
        'symbol-spacing': 320,
        'text-field': ['get', 'ref'],
        'text-font': FONT_BOLD,
        'text-size': 13,
        // Beside the walk line, never under it.
        'text-offset': [0, -1.6],
        'text-rotation-alignment': 'viewport',
        'text-keep-upright': true,
      },
      paint: { 'text-color': HIKING_WALK_REF_COLOUR, 'text-halo-color': '#FFFFFF', 'text-halo-width': 2.6 },
    }, target);

    // A failed tile (not a 404, which is only an empty patch of map) or a
    // site deployed without the tiles puts Waymarked back.
    const onError = event => {
      if (!event || event.sourceId !== HIKING_SOURCE) return;
      const status = event.error && event.error.status;
      if (status === 404) return;
      map.off('error', onError);
      fallBackToWaymarked(map);
    };
    map.on('error', onError);
    if (typeof global.fetch === 'function') {
      global.fetch(global.location.origin + HIKING_METADATA_PATH, { method: 'HEAD' })
        .then(response => { if (!response.ok) fallBackToWaymarked(map); })
        .catch(() => { /* offline: Waymarked could not load either */ });
    }

    const walk = Array.isArray(config.walk) ? config.walk : null;
    if (walk && walk.length > 1) {
      // Route pieces arrive tile by tile, and a closer zoom has the exact
      // lines, so measure again each time a closer zoom has loaded.
      let measuredZoom = -1;
      const measure = () => {
        if (!map.getSource(HIKING_SOURCE)) { map.off('idle', measure); return; }
        const zoom = Math.min(14, Math.floor(map.getZoom()));
        if (zoom <= measuredZoom) return;
        const routes = map.querySourceFeatures(HIKING_SOURCE, { sourceLayer: 'routes' });
        if (!routes.length) return;
        measuredZoom = zoom;
        const { ids, features } = walkRouteStretches(walk, routes);
        map.getSource(HIKING_WALK_SOURCE).setData({ type: 'FeatureCollection', features });
        // The walk's routes are numbered beside the walk instead.
        map.setFilter(HIKING_REF_LAYER, ['all',
          ['!=', ['get', 'ref'], ''],
          ['!', ['in', ['get', 'id'], ['literal', ids]]],
        ]);
      };
      map.on('idle', measure);
    }
    return HIKING_LINE_LAYER;
  }

  /** Show or hide the hiking network, ours or the Waymarked fallback. */
  function setHikingRoutesVisible(map, visible) {
    if (!map) return;
    const visibility = visible ? 'visible' : 'none';
    [HIKING_LINE_LAYER, HIKING_REF_LAYER, HIKING_WALK_REF_LAYER].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
    });
    setWaymarkedVisible(map, visible);
  }

  /** The bottom of the hiking network: relief and neighbours go below this. */
  function networkLayerId(map) {
    if (map && map.getLayer(HIKING_LINE_LAYER)) return HIKING_LINE_LAYER;
    if (map && map.getLayer(WAYMARKED_LAYER)) return WAYMARKED_LAYER;
    return firstLabelLayerId(map);
  }

  /**
   * Where a walk's own line goes: above our dashed routes but below their
   * numbers, or under Waymarked's raster as before.
   */
  function walkLineBeforeId(map) {
    if (map && map.getLayer(HIKING_REF_LAYER)) return HIKING_REF_LAYER;
    if (map && map.getLayer(WAYMARKED_LAYER)) return WAYMARKED_LAYER;
    return firstLabelLayerId(map);
  }

  /**
   * Turn down the base style so the hiking network can be the loudest thing
   * on the map. Shops, ATMs, road shields and aerodromes are not why anyone
   * opens a dog-walking map; peaks, huts, water and settlement names are.
   */
  function quietBasemap(map) {
    if (!isStyleReady(map)) return;
    map.getStyle().layers.forEach(layer => {
      if (layer.type !== 'symbol') return;
      if (!NOISY_BASE_LAYER_PATTERN.test(layer.id)) return;
      if (KEEP_BASE_LAYER_PATTERN.test(layer.id)) return;
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      } catch (error) { /* style variant without this layer */ }
    });
    // One treatment for every ORMA map: a caller that quietens the labels gets
    // the drained colours too, so the five surfaces cannot drift apart.
    calmBasemap(map);
  }

  /**
   * Take the colour out of the base style's roads, landcover and water.
   *
   * `quietBasemap` hides noisy *labels*. This is the other half: the free
   * openfreemap `liberty` style is a general street map, and it paints 24 road
   * layers in `#e9ac77` casing, `#fea` fill and `#fc8` motorway, woods and
   * grass in saturated greens, and water at `rgb(158,189,255)`. On a street
   * map that colour is the information. On a dog-walking map nothing a reader
   * is deciding between is a motorway, so all of it competes with the two
   * things that do carry meaning here: the marked hiking network and the
   * match-coloured rails.
   *
   * The roads are not removed, they are drained: every class becomes white
   * with a grey casing, so the hierarchy is carried by width alone. Draining
   * them further -- to the background colour -- was tried and rejected on a
   * render: the map turned into a grey relief sheet with no settlements, no
   * valleys and no water, which is less legible than the loud version. Woods,
   * water and parks keep a real (soft) hue for the same reason.
   *
   * AllTrails reads calmer over this same ground because its base is grey,
   * white and one sage green, with the road hierarchy carried by width rather
   * than hue. These replacements do the same thing to liberty: same layers,
   * same widths, the hue drained out.
   *
   * Idempotent, and every write is guarded -- a style variant that lacks a
   * layer, or renames one, simply keeps its own colour.
   */
  const CALM_BASE_COLOURS = Object.freeze({
    // Roads. The casings go to a warm grey, the fills to near-white, so the
    // hierarchy survives as width and the orange/yellow ladder disappears.
    casing: { colour: '#CFC8BE', layers: [
      'road_motorway_casing', 'road_motorway_link_casing', 'road_trunk_primary_casing',
      'road_secondary_tertiary_casing', 'road_link_casing',
      'tunnel_motorway_casing', 'tunnel_motorway_link_casing', 'tunnel_trunk_primary_casing',
      'tunnel_secondary_tertiary_casing', 'tunnel_link_casing',
      'bridge_motorway_casing', 'bridge_motorway_link_casing', 'bridge_trunk_primary_casing',
      'bridge_secondary_tertiary_casing', 'bridge_link_casing',
    ] },
    minorCasing: { colour: '#DBD5CC', layers: [
      'road_minor_casing', 'road_service_track_casing', 'tunnel_street_casing',
      'tunnel_service_track_casing', 'bridge_street_casing', 'bridge_service_track_casing',
      'bridge_path_pedestrian_casing',
    ] },
    major: { colour: '#FDFBF7', layers: [
      'road_motorway', 'road_motorway_link', 'tunnel_motorway', 'tunnel_motorway_link',
      'bridge_motorway', 'bridge_motorway_link',
    ] },
    through: { colour: '#FFFFFF', layers: [
      'road_trunk_primary', 'road_secondary_tertiary', 'road_link',
      'tunnel_trunk_primary', 'tunnel_secondary_tertiary', 'tunnel_link',
      'bridge_trunk_primary', 'bridge_secondary_tertiary', 'bridge_link',
    ] },
    rail: { colour: '#CDC7BF', layers: [
      'road_major_rail', 'road_major_rail_hatching', 'road_transit_rail',
      'road_transit_rail_hatching', 'tunnel_major_rail', 'tunnel_major_rail_hatching',
      'tunnel_transit_rail', 'tunnel_transit_rail_hatching', 'bridge_major_rail',
      'bridge_major_rail_hatching', 'bridge_transit_rail', 'bridge_transit_rail_hatching',
    ] },
    waterway: { colour: '#A8C4DA', layers: [
      'waterway_river', 'waterway_other', 'waterway_tunnel',
    ] },
  });

  // Fills, which need the opacity pulled down as well as the hue: a wood at
  // 0.7 alpha over a hillshade is what makes the valleys read as solid green.
  const CALM_BASE_FILLS = Object.freeze([
    { id: 'landcover_wood', colour: '#C6D6B8', opacity: 0.72 },
    { id: 'landcover_grass', colour: '#D3E0C4', opacity: 0.7 },
    { id: 'park', colour: '#CFDEBE', opacity: 0.7 },
    { id: 'landuse_pitch', colour: '#E6E8DD', opacity: 0.5 },
    { id: 'landuse_track', colour: '#E6E8DD', opacity: 0.5 },
    { id: 'landuse_cemetery', colour: '#E6E8DD', opacity: 0.5 },
    { id: 'landuse_hospital', colour: '#EFE7E7', opacity: 0.5 },
    { id: 'landuse_school', colour: '#EBEAE0', opacity: 0.5 },
    { id: 'water', colour: '#AFC9DD', opacity: 1 },
    { id: 'landcover_ice', colour: '#E8EFEF', opacity: 0.9 },
  ]);

  function setPaint(map, id, property, value) {
    if (!map.getLayer(id)) return;
    try {
      map.setPaintProperty(id, property, value);
    } catch (error) { /* style variant paints this layer differently */ }
  }

  function calmBasemap(map) {
    if (!isStyleReady(map)) return;
    Object.keys(CALM_BASE_COLOURS).forEach(group => {
      const { colour, layers } = CALM_BASE_COLOURS[group];
      layers.forEach(id => setPaint(map, id, 'line-color', colour));
    });
    CALM_BASE_FILLS.forEach(({ id, colour, opacity }) => {
      setPaint(map, id, 'fill-color', colour);
      setPaint(map, id, 'fill-opacity', opacity);
    });
    // The residential tint is a zoom expression in liberty, and a flat grey
    // reads better under a hillshade than its warm beige does.
    setPaint(map, 'landuse_residential', 'fill-color', '#EDE9E2');
    setPaint(map, 'landuse_residential', 'fill-opacity', 0.6);
    setPaint(map, 'park_outline', 'line-color', 'rgba(220, 228, 208, 0.8)');
  }

  // ── Match colour ────────────────────────────────────────────────────────
  // Green / amber / red on an ORMA map means one thing and one thing only:
  // how well this walk suits the dog. It never means how hard the trail is.
  //
  // Three near-identical green/amber/red palettes used to exist, the match
  // tiers, trail.js's safetyColor() and collections' difficultyColour(), and
  // two of them encoded the trail's intrinsic risk while looking exactly like
  // a match tier. A guest on a trail page got one meaning, a signed-in owner
  // another, from the same coloured line.
  const MATCH_COLOURS = Object.freeze({ good: '#4A7856', fair: '#C98A2E', poor: '#9C3A25' });
  // These are the scoring engine's own boundaries, and they have to stay its
  // own: a trail scoring 62 was called "Possible with cautions" in words and
  // coloured red on the map, and colour is what a reader takes in first.
  // match-verdict.js holds the same two numbers for the wording, and
  // match-colour-agrees.test.js fails if the three ever drift apart.
  const MATCH_GOOD = 85;
  const MATCH_FAIR = 60;
  // Shown when no score could be produced at all. Deliberately not a tier
  // colour: an unknown fit must not read as a good or bad one.
  const MATCH_UNKNOWN = '#6B7A6E';

  function matchColour(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return MATCH_UNKNOWN;
    if (value >= MATCH_GOOD) return MATCH_COLOURS.good;
    return value >= MATCH_FAIR ? MATCH_COLOURS.fair : MATCH_COLOURS.poor;
  }

  /** The same tiers as a data-driven expression, for layers styled per feature. */
  function matchColourExpression(property) {
    return [
      'step', ['coalesce', ['get', property || 'score'], -1],
      MATCH_UNKNOWN,
      0, MATCH_COLOURS.poor,
      MATCH_FAIR, MATCH_COLOURS.fair,
      MATCH_GOOD, MATCH_COLOURS.good,
    ];
  }

  function widthRamp(a, b, c, d, scale) {
    const factor = scale || 1;
    return [
      'interpolate', ['linear'], ['zoom'],
      8, a * factor,
      12, b * factor,
      14, c * factor,
      17, d * factor,
    ];
  }

  /**
   * The selected route, drawn as a highlight *underneath* the hiking network
   * rather than a line painted over it.
   *
   * A solid match-colour line on top buries the very thing a walker follows:
   * Waymarked's own route line and its numbered shields end up hidden under
   * our paint, which is why we used to reprint the numbers ourselves in a
   * second shield layer. Inverting the stack, a white casing, then a
   * translucent match-colour corridor, with the raster on top, leaves the
   * marked route and its real numbers legible down the middle of the
   * highlight, and the corridor still reads as "this is your route" at a
   * glance. Pass `beforeId` as the waymarked layer id to get this ordering.
   *
   * `mode: 'overlay'` keeps the old opaque-line-on-top treatment, for maps
   * with no hiking raster to sit beneath.
   */
  function routeLinePaint(color, options) {
    const config = options || {};
    const scale = config.scale || 1;
    if (config.mode === 'overlay') {
      return {
        casing: {
          'line-color': config.casingColor || '#FFFDF7',
          'line-opacity': 0.95,
          'line-width': widthRamp(5, 9, 13, 19, scale),
        },
        line: {
          'line-color': color,
          'line-opacity': 1,
          'line-width': widthRamp(2.5, 5.5, 8.5, 13, scale),
        },
      };
    }
    return {
      casing: {
        'line-color': config.casingColor || '#FFFFFF',
        'line-opacity': 0.9,
        'line-width': widthRamp(10, 16, 23, 33, scale),
      },
      // Translucent on purpose: the marked route draws through it, and the
      // terrain underneath still reads.
      line: {
        'line-color': color,
        'line-opacity': 0.55,
        'line-width': widthRamp(7, 12, 18, 26, scale),
      },
    };
  }

  /**
   * Add a cased route line as a pair of layers. Returns the two layer ids so
   * callers can toggle or query them.
   */
  function addRouteLine(map, options) {
    const config = options || {};
    const source = config.source;
    const id = config.id;
    if (!map || !source || !id || map.getLayer(id)) return null;
    const paint = routeLinePaint(config.color || '#2E4034', config);
    // Default to sitting under Waymarked's raster, so the route highlights the
    // marked path instead of covering it; with our own network, between the
    // dashed routes and their numbers.
    const fallbackBefore = walkLineBeforeId(map);
    const beforeId = config.beforeId !== undefined ? config.beforeId : fallbackBefore;
    const target = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
    const layout = { 'line-join': 'round', 'line-cap': 'round' };
    map.addLayer({
      id: id + '-casing', type: 'line', source, layout, paint: paint.casing,
    }, target);
    map.addLayer({
      id, type: 'line', source, layout, paint: paint.line,
    }, target);
    return { casing: id + '-casing', line: id };
  }

  // ── Contour lines ─────────────────────────────────────────────────────
  // The elevation detail a general street basemap (openfreemap Liberty) does
  // not carry and a paid outdoors style (Mapbox/AllTrails) does. Generated
  // client-side by maplibre-contour from the same AWS Terrarium DEM the
  // hillshade reads -- free, no contour tile server, no API key. The caller
  // must have loaded the plugin first (DoloPawsMapRuntime.loadContour); if the
  // `mlcontour` global is absent this is a no-op, never an error.
  const CONTOUR_DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const CONTOUR_SOURCE = 'orma-contours';
  const CONTOUR_LINE_LAYER = 'contour-lines';
  const CONTOUR_LABEL_LAYER = 'contour-labels';
  // One DemSource for every map: setupMaplibre registers a protocol on the
  // maplibre-gl global once, and each map reuses the same contour tiles.
  let contourDem = null;

  function addContours(map, options) {
    const config = options || {};
    const mlcontour = global.mlcontour;
    const maplibre = global.maplibregl;
    if (!map || !mlcontour || !maplibre) return null;
    if (map.getLayer(CONTOUR_LINE_LAYER)) return CONTOUR_LINE_LAYER;
    try {
      if (!contourDem) {
        contourDem = new mlcontour.DemSource({
          url: CONTOUR_DEM_URL, encoding: 'terrarium', maxzoom: 15, worker: true,
        });
        contourDem.setupMaplibre(maplibre);
      }
      if (!map.getSource(CONTOUR_SOURCE)) {
        map.addSource(CONTOUR_SOURCE, {
          type: 'vector',
          maxzoom: 15,
          attribution: 'Elevation © AWS Terrain Tiles',
          tiles: [contourDem.contourProtocolUrl({
            // metres: [minor interval, index interval]. Tighter as you zoom in,
            // so a regional view is not a scribble and a trailhead view has
            // real relief.
            thresholds: { 11: [200, 1000], 12: [100, 500], 13: [100, 500], 14: [50, 200], 15: [20, 100] },
            elevationKey: 'ele', levelKey: 'level', contourLayer: 'contours', overzoom: 1,
          })],
        });
      }
      const minzoom = Number.isFinite(config.minzoom) ? config.minzoom : 11;
      // Lines sit UNDER the marked network. The waymarked raster is mostly
      // transparent, so contours read everywhere except directly beneath a
      // trail line -- which is the right order, the path draws over the relief.
      const belowNetwork = networkLayerId(map);
      map.addLayer({
        id: CONTOUR_LINE_LAYER, type: 'line', source: CONTOUR_SOURCE, 'source-layer': 'contours',
        minzoom,
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': 'rgba(122,104,82,0.5)',
          'line-width': ['match', ['get', 'level'], 1, 1.2, 0.55],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.35, 13, 0.7, 15, 0.85],
        },
      }, belowNetwork && map.getLayer(belowNetwork) ? belowNetwork : undefined);
      // Index-contour elevation labels, above the raster but below place names.
      // Noto only -- openfreemap serves no Open Sans (see FONT_REGULAR).
      const belowLabels = firstLabelLayerId(map);
      map.addLayer({
        id: CONTOUR_LABEL_LAYER, type: 'symbol', source: CONTOUR_SOURCE, 'source-layer': 'contours',
        minzoom: minzoom + 1,
        filter: ['>', ['get', 'level'], 0],
        layout: {
          'symbol-placement': 'line', 'text-size': 10.5, 'text-max-angle': 25,
          'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'],
          'text-font': FONT_REGULAR,
        },
        paint: {
          'text-color': 'rgba(92,78,58,0.9)',
          'text-halo-color': 'rgba(255,253,247,0.85)',
          'text-halo-width': 1.3,
        },
      }, belowLabels && map.getLayer(belowLabels) ? belowLabels : undefined);
      return CONTOUR_LINE_LAYER;
    } catch (error) {
      // Contours are an enhancement; never let them break the base map.
      if (typeof console !== 'undefined' && console.warn) console.warn('ORMA contours skipped:', error && error.message);
      return null;
    }
  }

  function setContoursVisible(map, visible) {
    [CONTOUR_LINE_LAYER, CONTOUR_LABEL_LAYER].forEach(id => {
      if (map && map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }

  global.ORMAMapStyle = {
    WAYMARKED_SOURCE,
    WAYMARKED_LAYER,
    WAYMARKED_TILES,
    WAYMARKED_ATTRIBUTION,
    FONT_BOLD,
    FONT_REGULAR,
    firstLabelLayerId,
    MATCH_COLOURS,
    MATCH_GOOD,
    MATCH_FAIR,
    matchColour,
    matchColourExpression,
    addWaymarkedHiking,
    setWaymarkedVisible,
    HIKING_SOURCE,
    HIKING_LINE_LAYER,
    HIKING_REF_LAYER,
    HIKING_WALK_REF_LAYER,
    addHikingRoutes,
    setHikingRoutesVisible,
    walkRouteStretches,
    networkLayerId,
    walkLineBeforeId,
    quietBasemap,
    calmBasemap,
    routeLinePaint,
    addRouteLine,
    addContours,
    setContoursVisible,
    CONTOUR_SOURCE,
    CONTOUR_LINE_LAYER,
    CONTOUR_LABEL_LAYER,
  };
  // Historic name kept so nothing has to change in one commit.
  global.DoloPawsMapStyle = global.ORMAMapStyle;
})(typeof window !== 'undefined' ? window : globalThis);
