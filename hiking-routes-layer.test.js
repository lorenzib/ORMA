'use strict';

/**
 * The hiking network drawn from our own tiles (map-style.js), which replaced
 * Waymarked's coloured raster on the trail page on 26 Oct 2026: dashed grey
 * routes, every number from trail zoom, the walk's own numbers beside the
 * walk where it follows them, and Waymarked back if our tiles fail.
 */

require('./map-style');

const style = window.ORMAMapStyle;

// A map that records what is added, in order, with the calls these layers use.
function fakeMap(options){
  const config = options || {};
  const layers = [{ id: 'roads', type: 'line' }, { id: 'place-labels', type: 'symbol' }];
  const sources = new Map();
  const handlers = new Map();
  return {
    layers,
    sources,
    getStyle: () => ({ layers }),
    getLayer: id => layers.find(layer => layer.id === id),
    addLayer(layer, before){
      const at = before ? layers.findIndex(item => item.id === before) : -1;
      if(at >= 0) layers.splice(at, 0, layer); else layers.push(layer);
    },
    removeLayer(id){ layers.splice(layers.findIndex(layer => layer.id === id), 1); },
    getSource: id => sources.get(id),
    addSource(id, source){ sources.set(id, { ...source, setData(data){ this.data = data; } }); },
    removeSource(id){ sources.delete(id); },
    setLayoutProperty(id, name, value){ this.getLayer(id).layout = { ...this.getLayer(id).layout, [name]: value }; },
    getLayoutProperty(id, name){ return (this.getLayer(id).layout || {})[name]; },
    setFilter(id, filter){ this.getLayer(id).filter = filter; },
    getZoom: () => config.zoom || 14,
    querySourceFeatures: () => config.routes || [],
    on(event, handler){ handlers.set(event, [...(handlers.get(event) || []), handler]); },
    off(event, handler){ handlers.set(event, (handlers.get(event) || []).filter(item => item !== handler)); },
    fire(event, payload){ (handlers.get(event) || []).forEach(handler => handler(payload)); },
  };
}

const ids = map => map.layers.map(layer => layer.id);

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
});

// ~111 m per 0.001 degree of latitude; a walk heading north up route 7 for
// ~550 m, then off it, crossing route 9 on the way.
const north = (lat, lng = 11.1) => [lng, lat];
const WALK = [46.600, 46.601, 46.602, 46.603, 46.604, 46.605, 46.606, 46.607, 46.608].map(lat => north(lat))
  .concat([[11.102, 46.608], [11.104, 46.608], [11.106, 46.608]]);
const ROUTE_7 = { properties: { id: 7, ref: '7', rank: 4 }, geometry: { type: 'LineString', coordinates: [north(46.598), north(46.6082)] } };
const ROUTE_9 = { properties: { id: 9, ref: '9', rank: 4 }, geometry: { type: 'LineString', coordinates: [[11.095, 46.603], [11.105, 46.603]] } };
const UNNUMBERED = { properties: { id: 5, ref: '', rank: 5 }, geometry: { type: 'LineString', coordinates: [north(46.598), north(46.609)] } };

describe('the walk\'s own numbers follow only the stretch it shares', () => {
  test('a route the walk follows is labelled along the shared stretch only', () => {
    const { ids: used, features } = style.walkRouteStretches(WALK, [ROUTE_7, ROUTE_9, UNNUMBERED]);
    expect(used).toEqual([7]);
    expect(features).toHaveLength(1);
    const line = features[0].geometry.coordinates;
    expect(line[0]).toEqual(north(46.600));
    // Stops where the walk turns east off route 7.
    expect(line.every(([lng]) => lng < 11.101)).toBe(true);
    expect(features[0].properties).toEqual({ id: 7, ref: '7' });
  });

  test('crossing a route is not following it', () => {
    const { ids: used } = style.walkRouteStretches(WALK, [ROUTE_9]);
    expect(used).toEqual([]);
  });

  test('a route arriving as several tile pieces still counts as one', () => {
    const pieces = [
      { ...ROUTE_7, geometry: { type: 'LineString', coordinates: [north(46.598), north(46.604)] } },
      { ...ROUTE_7, geometry: { type: 'LineString', coordinates: [north(46.604), north(46.6082)] } },
    ];
    const { ids: used, features } = style.walkRouteStretches(WALK, pieces);
    expect(used).toEqual([7]);
    expect(features).toHaveLength(1);
  });
});

describe('the network is drawn from our own tiles', () => {
  test('dashed grey lines, then the numbers ranked by network, then the walk\'s own', () => {
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels' });
    expect(map.getSource(style.HIKING_SOURCE).tiles).toEqual(['http://localhost/data/hiking-routes/{z}/{x}/{y}.pbf']);
    expect(ids(map)).toEqual(['roads', style.HIKING_LINE_LAYER, style.HIKING_REF_LAYER, style.HIKING_WALK_REF_LAYER, 'place-labels']);
    const line = map.getLayer(style.HIKING_LINE_LAYER);
    expect(line.paint['line-color']).toBe('#5F665F');
    expect(line.paint['line-dasharray']).toEqual([2, 1.6]);
    const refs = map.getLayer(style.HIKING_REF_LAYER);
    expect(refs.minzoom).toBe(12);
    expect(refs.layout['symbol-sort-key']).toEqual(['get', 'rank']);
    expect(refs.layout['text-font']).toEqual(['Noto Sans Bold']);
    expect(map.getLayer('waymarked-hiking-layer')).toBeUndefined();
  });

  test('the walk goes between the dashed routes and their numbers', () => {
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels' });
    expect(style.walkLineBeforeId(map)).toBe(style.HIKING_REF_LAYER);
    expect(style.networkLayerId(map)).toBe(style.HIKING_LINE_LAYER);
  });

  test('once the tiles load, the walk\'s routes move beside the walk', () => {
    const map = fakeMap({ routes: [ROUTE_7, ROUTE_9] });
    style.addHikingRoutes(map, { beforeId: 'place-labels', walk: WALK });
    map.fire('idle');
    expect(map.getSource('orma-hiking-walk-refs').data.features.map(f => f.properties.ref)).toEqual(['7']);
    expect(map.getLayer(style.HIKING_REF_LAYER).filter).toEqual(['all',
      ['!=', ['get', 'ref'], ''],
      ['!', ['in', ['get', 'id'], ['literal', [7]]]],
    ]);
  });

  test('the Layers chip hides and shows all of it', () => {
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels' });
    style.setHikingRoutesVisible(map, false);
    [style.HIKING_LINE_LAYER, style.HIKING_REF_LAYER, style.HIKING_WALK_REF_LAYER]
      .forEach(id => expect(map.getLayoutProperty(id, 'visibility')).toBe('none'));
  });
});

describe('browse maps', () => {
  test('a minzoom holds the whole network back, numbers no earlier than trail zoom', () => {
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels', minzoom: 13.5 });
    expect(map.getLayer(style.HIKING_LINE_LAYER).minzoom).toBe(13.5);
    expect(map.getLayer(style.HIKING_REF_LAYER).minzoom).toBe(13.5);
    expect(map.getLayer(style.HIKING_WALK_REF_LAYER).minzoom).toBe(13.5);
  });

  test('the fallback keeps the minzoom', () => {
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels', minzoom: 12.5 });
    map.fire('error', { sourceId: style.HIKING_SOURCE, error: { status: 500 } });
    expect(map.getLayer('waymarked-hiking-layer').minzoom).toBe(12.5);
  });

  test('a walk chosen later is numbered beside it, and clearing it puts every number back', () => {
    const map = fakeMap({ routes: [ROUTE_7, ROUTE_9] });
    style.addHikingRoutes(map, { beforeId: 'place-labels' });
    style.setHikingWalk(map, WALK);
    expect(map.getSource('orma-hiking-walk-refs').data.features.map(f => f.properties.ref)).toEqual(['7']);
    style.setHikingWalk(map, null);
    expect(map.getSource('orma-hiking-walk-refs').data.features).toEqual([]);
    expect(map.getLayer(style.HIKING_REF_LAYER).filter).toEqual(['!=', ['get', 'ref'], '']);
  });

  test('the Layers chip lists our layers and the fallback raster', () => {
    expect(style.HIKING_LAYER_IDS).toEqual([
      style.HIKING_LINE_LAYER, style.HIKING_REF_LAYER, style.HIKING_WALK_REF_LAYER, 'waymarked-hiking-layer',
    ]);
  });
});

describe('Waymarked comes back when our tiles cannot', () => {
  test('a failed tile puts the raster back in their place, keeping the chip\'s state', () => {
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels' });
    style.setHikingRoutesVisible(map, false);
    map.fire('error', { sourceId: style.HIKING_SOURCE, error: { status: 500 } });
    expect(ids(map)).toEqual(['roads', 'waymarked-hiking-layer', 'place-labels']);
    expect(map.getLayoutProperty('waymarked-hiking-layer', 'visibility')).toBe('none');
    expect(map.getSource(style.HIKING_SOURCE)).toBeUndefined();
  });

  test('a missing tile is an empty patch of map, not a failure', () => {
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels' });
    map.fire('error', { sourceId: style.HIKING_SOURCE, error: { status: 404 } });
    expect(map.getLayer(style.HIKING_LINE_LAYER)).toBeDefined();
  });

  test('a site deployed without the tiles falls back', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false }));
    const map = fakeMap();
    style.addHikingRoutes(map, { beforeId: 'place-labels' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(global.fetch).toHaveBeenCalledWith('http://localhost/data/hiking-routes/metadata.json', { method: 'HEAD' });
    expect(map.getLayer('waymarked-hiking-layer')).toBeDefined();
    expect(map.getLayer(style.HIKING_LINE_LAYER)).toBeUndefined();
  });
});

describe('satellite and 3D stay under the walk', () => {
  // The first symbol layer is now our route numbers, which sit above the
  // walk, so imagery placed below it covered the walk and the routes.
  const fs = require('fs');
  const path = require('path');
  const source = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
  const insertedBefore = (text, id) => {
    const at = text.indexOf(`id: '${id}'`) >= 0 ? text.indexOf(`id: '${id}'`) : text.indexOf(`id:'${id}'`);
    expect(at).toBeGreaterThan(-1);
    return text.slice(at, text.indexOf(');', at));
  };

  test.each(['trail.js', 'script.js', 'walk-page.js'])('%s puts the satellite imagery below our routes', file => {
    expect(insertedBefore(source(file), 'satellite-layer')).toMatch(/networkLayerId\(map\)|belowRoutes/);
  });

  test.each(['trail.js', 'script.js'])('%s puts the 3D hillshade below our routes', file => {
    const text = source(file);
    let at = 0;
    let count = 0;
    while ((at = text.indexOf("id: 'hillshade-layer'", at)) >= 0) {
      const call = text.slice(at, text.indexOf(');', at));
      expect(call).toMatch(/networkLayerId\(map\)|beforeLayer/);
      at += 1;
      count += 1;
    }
    expect(count).toBeGreaterThan(0);
  });

  test('no map places imagery under the first symbol layer', () => {
    ['trail.js', 'script.js', 'walk-page.js'].forEach(file => {
      expect(source(file)).not.toMatch(/firstSymbol && firstSymbol\.id/);
    });
  });
});

describe('the walk lets the satellite path show through', () => {
  const fs = require('fs');
  const path = require('path');
  const paintMap = () => {
    const layers = {};
    return {
      layers,
      getLayer: id => layers[id],
      addLayer: layer => { layers[layer.id] = { ...layer, paint: { ...layer.paint } }; },
      setPaintProperty: (id, key, value) => { layers[id].paint[key] = value; },
    };
  };

  test('satellite fades the casing and corridor, and switching back restores them', () => {
    const map = paintMap();
    style.addRouteLine(map, { id: 'walk', source: 'walk', color: '#c80', beforeId: null });
    const before = { casing: map.layers['walk-casing'].paint['line-opacity'], line: map.layers.walk.paint['line-opacity'] };

    style.setLinesOnImagery(map, 'walk', true);
    expect(map.layers['walk-casing'].paint['line-opacity']).toBe(style.ROUTE_LINE_ON_IMAGERY.casing);
    expect(map.layers.walk.paint['line-opacity']).toBe(style.ROUTE_LINE_ON_IMAGERY.line);
    expect(style.ROUTE_LINE_ON_IMAGERY.casing).toBeLessThan(before.casing);
    expect(style.ROUTE_LINE_ON_IMAGERY.line).toBeLessThan(before.line);

    expect(map.layers['walk-casing'].paint['line-opacity']).toBe(0);

    style.setLinesOnImagery(map, 'walk', false);
    expect(map.layers['walk-casing'].paint['line-opacity']).toBe(before.casing);
    expect(map.layers.walk.paint['line-opacity']).toBe(before.line);
  });

  test('our grey routes fade on satellite too, and come back', () => {
    const map = paintMap();
    map.addLayer({ id: style.HIKING_LINE_LAYER, paint: { 'line-opacity': style.HIKING_LINE_OPACITY.map } });
    style.setLinesOnImagery(map, null, true);
    expect(map.layers[style.HIKING_LINE_LAYER].paint['line-opacity']).toBe(style.HIKING_LINE_OPACITY.imagery);
    expect(style.HIKING_LINE_OPACITY.imagery).toBeLessThan(style.HIKING_LINE_OPACITY.map);
    style.setLinesOnImagery(map, null, false);
    expect(map.layers[style.HIKING_LINE_LAYER].paint['line-opacity']).toBe(style.HIKING_LINE_OPACITY.map);
  });

  test('a walk that is not on the map yet is left alone', () => {
    expect(() => style.setLinesOnImagery(paintMap(), 'walk', true)).not.toThrow();
  });

  test('the trail page fades its walk when satellite turns on, and when the walk arrives on satellite', () => {
    const text = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    expect(text).toContain("setLinesOnImagery(map, 'single-trail-path-line', sat)");
    expect(text).toContain("setLinesOnImagery(map, 'single-trail-path-line', true)");
  });
});
