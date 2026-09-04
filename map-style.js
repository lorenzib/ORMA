/**
 * map-style.js — one shared cartographic treatment for every ORMA map.
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
 * Everything here is idempotent — calling twice on the same map is a no-op.
 */
(function (global) {
  'use strict';

  // Waymarked Trails' public hiking layer. Same OSM data as our vector base,
  // but with the route-relation rendering (numbered routes, waymark colours)
  // that a general-purpose basemap does not draw.
  const WAYMARKED_TILES = 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png';
  const WAYMARKED_ATTRIBUTION = '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org';
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
   * stretching — their shields are designed to be read.
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
   * second shield layer. Inverting the stack — a white casing, then a
   * translucent match-colour corridor, with the raster on top — leaves the
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
    // Default to sitting under the hiking network when it is present, so the
    // route highlights the marked path instead of covering it.
    const fallbackBefore = map.getLayer(WAYMARKED_LAYER) ? WAYMARKED_LAYER : firstLabelLayerId(map);
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

  global.ORMAMapStyle = {
    WAYMARKED_SOURCE,
    WAYMARKED_LAYER,
    WAYMARKED_TILES,
    WAYMARKED_ATTRIBUTION,
    FONT_BOLD,
    FONT_REGULAR,
    firstLabelLayerId,
    addWaymarkedHiking,
    setWaymarkedVisible,
    quietBasemap,
    routeLinePaint,
    addRouteLine,
  };
  // Historic name kept so nothing has to change in one commit.
  global.DoloPawsMapStyle = global.ORMAMapStyle;
})(typeof window !== 'undefined' ? window : globalThis);
