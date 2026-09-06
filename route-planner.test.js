const fs = require('fs');
const path = require('path');

const root = __dirname;
const plannerHtml = fs.readFileSync(path.join(root, 'route-planner.html'), 'utf8');
const plannerSource = fs.readFileSync(path.join(root, 'route-planner.js'), 'utf8');
const routingSource = fs.readFileSync(path.join(root, 'route-planner-routing.js'), 'utf8');
const plannerRouting = require('./route-planner-routing.js');
const detailHtml = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, 'trail.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const savedHtml = fs.readFileSync(path.join(root, 'saved.html'), 'utf8');

describe('standalone draft route planner', () => {
  test('is entered from Explore and absent from trail detail', () => {
    // "Draft a loop" now lives inside the "+ New" create menu in the toolbar.
    expect(homeHtml).toContain('href="route-planner.html">Draft a loop');
    expect(homeHtml).toContain('li-plan-route');
    expect(homeHtml.indexOf('li-plan-route')).toBeLessThan(homeHtml.indexOf('class="li-body"'));
    expect(detailHtml).not.toContain('id="mapLoopComposerBtn"');
    expect(detailHtml).not.toContain('id="mapLoopComposerPanel"');
    expect(detailSource).not.toContain('    initLoopComposer(map, t);');
  });

  test('uses geographic coverage only for the bundled fallback graph', () => {
    expect(plannerSource).toContain('function coverageFor(point)');
    expect(plannerSource).toContain('contains(entry, point)');
    expect(plannerSource).toContain('walkingRouter.route(points');
    expect(plannerSource).not.toContain('coverage.trails[t.id]');
  });

  test('offers loop, point-to-point and out-and-back shapes up to twenty-five points', () => {
    expect(plannerHtml).toContain('id="plannerFinish"');
    expect(plannerHtml).toContain('id="plannerSave"');
    expect(plannerHtml).toContain('data-planner-shape="loop"');
    expect(plannerHtml).toContain('data-planner-shape="point-to-point"');
    expect(plannerHtml).toContain('data-planner-shape="out-and-back"');
    expect(plannerSource).toContain('const MIN_LOOP_POINTS = 3');
    expect(plannerSource).toContain('const MAX_POINTS = 25');
    // A loop still needs three points; the open shapes only need two.
    expect(plannerSource).toContain('minPoints:MIN_LOOP_POINTS');
    expect(plannerSource).toContain("'point-to-point': {");
    expect(plannerSource).toContain("'out-and-back': {");
    expect(plannerSource).toContain('points.length < config.minPoints');
    expect(plannerHtml).toContain('0 / 25');
    expect(plannerSource).toContain('!preview || !finished');
    expect(plannerSource).toContain('localRouter.routeLoop(points, graph, options)');
  });

  test('waypoints can be dragged and inserted into an existing leg', () => {
    expect(plannerSource).toContain('draggable:true');
    expect(plannerSource).toContain("marker.on('dragend'");
    expect(plannerSource).toContain('function insertPointNearest(candidate)');
    expect(plannerSource).toContain("layers:['draft-route-line']");
    expect(plannerSource).toContain('insertPointNearest(point)');
  });

  test('reports live ascent alongside distance', () => {
    expect(plannerHtml).toContain('id="plannerAscent"');
    expect(plannerHtml).toContain('Ascent');
    expect(plannerSource).toContain('preview.ascentM');
    expect(routingSource).toContain("properties['filtered ascend']");
  });

  test('uses the same hiking map context and controls as the homepage map', () => {
    expect(plannerHtml).toContain('map-runtime.js');
    expect(plannerHtml).toContain('id="plannerMarkedRoutes"');
    expect(plannerSource).toContain('DoloPawsMapRuntime.mapOptions');
    expect(plannerSource).toContain('DoloPawsMapRuntime.enhance(map)');
    expect(plannerSource).toContain('new maplibregl.GeolocateControl');
    expect(plannerSource).toContain('tile.waymarkedtrails.org/hiking');
    expect(plannerSource).toContain("'raster-opacity':['interpolate',['linear'],['zoom'],7,.48,10,.66,12,.84,14,1]");
    expect(plannerSource).toContain("'raster-saturation':0");
    expect(plannerSource).toContain("id:'planner-orma-trails-line'");
    expect(plannerHtml).toContain('data-planner-poi="water"');
    expect(plannerHtml).toContain('data-planner-poi="huts"');
    expect(plannerHtml).toContain('data-planner-poi="food"');
    expect(plannerSource).toContain('collapseAttribution()');
    expect(plannerSource).toContain("data-maplayer=\"satellite\"");
  });

  test('states the safety limitations and exposes saved drafts', () => {
    expect(plannerHtml).toContain('This is not an ORMA-verified trail.');
    expect(plannerHtml).toContain('does not confirm legal access');
    expect(savedHtml).toContain('id="my-routes"');
    expect(savedHtml).toContain('route-planner.html?route=');
  });
});

describe('live walking-route client', () => {
  test('closes the waypoint list and reads a BRouter GeoJSON route', async () => {
    const fetchMock = jest.fn(async url => ({
      ok:true,
      json:async () => ({
        type:'FeatureCollection',
        features:[{
          type:'Feature',
          properties:{ 'track-length':'1840' },
          geometry:{ type:'LineString', coordinates:[[11.55,46.56],[11.57,46.57],[11.55,46.56]] },
        }],
      }),
    }));
    const result = await plannerRouting.route([
      { lng:11.55, lat:46.56 },
      { lng:11.57, lat:46.57 },
      { lng:11.56, lat:46.58 },
    ], { closeLoop:true, fetch:fetchMock, maxDistanceM:30000 });
    const requested = new URL(fetchMock.mock.calls[0][0]);
    expect(requested.searchParams.get('profile')).toBe('hiking-mountain');
    expect(requested.searchParams.get('profile:SAC_scale_limit')).toBe('2');
    expect(requested.searchParams.get('profile:SAC_scale_preferred')).toBe('1');
    expect(requested.searchParams.get('format')).toBe('geojson');
    expect(requested.searchParams.get('lonlats').split('|')).toHaveLength(4);
    expect(result).toMatchObject({ distanceM:1840, closed:true, source:'openstreetmap-brouter' });
    expect(result.path).toHaveLength(3);
  });

  test('sends the return leg for an out-and-back so distance and climb are real', async () => {
    const fetchMock = jest.fn(async () => ({
      ok:true,
      json:async () => ({
        features:[{
          properties:{ 'track-length':'4200', 'filtered ascend':'260' },
          geometry:{ type:'LineString', coordinates:[[11.55,46.56],[11.57,46.57],[11.55,46.56]] },
        }],
      }),
    }));
    const result = await plannerRouting.route([
      { lng:11.55, lat:46.56 },
      { lng:11.57, lat:46.57 },
      { lng:11.59, lat:46.58 },
    ], { outAndBack:true, fetch:fetchMock, maxDistanceM:30000 });
    const lonlats = new URL(fetchMock.mock.calls[0][0]).searchParams.get('lonlats').split('|');
    // Out (3 points) plus the way home (2 more), so the router prices the
    // whole walk rather than half of it.
    expect(lonlats).toEqual([
      '11.55,46.56', '11.57,46.57', '11.59,46.58', '11.57,46.57', '11.55,46.56',
    ]);
    expect(result).toMatchObject({ distanceM:4200, ascentM:260, closed:true, shape:'out-and-back' });
  });

  test('reports ascent and shape for a one-way route', async () => {
    const fetchMock = jest.fn(async () => ({
      ok:true,
      json:async () => ({
        features:[{
          properties:{ 'track-length':'2000', 'plain-ascend':'95' },
          geometry:{ type:'LineString', coordinates:[[11.55,46.56],[11.57,46.57]] },
        }],
      }),
    }));
    const result = await plannerRouting.route([
      { lng:11.55, lat:46.56 },
      { lng:11.57, lat:46.57 },
    ], { fetch:fetchMock, maxDistanceM:30000 });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('lonlats').split('|')).toHaveLength(2);
    expect(result).toMatchObject({ ascentM:95, closed:false, shape:'point-to-point' });
  });

  test('rejects routes above the planner limit', async () => {
    const fetchMock = jest.fn(async () => ({
      ok:true,
      json:async () => ({
        features:[{
          properties:{ 'track-length':'31000' },
          geometry:{ type:'LineString', coordinates:[[11.55,46.56],[11.75,46.76]] },
        }],
      }),
    }));
    await expect(plannerRouting.route([
      { lng:11.55, lat:46.56 },
      { lng:11.75, lat:46.76 },
    ], { fetch:fetchMock, maxDistanceM:30000 })).rejects.toMatchObject({ code:'too-long' });
  });
});

// ---------------------------------------------------------------------------
// Behavioural cover for the drawing interactions themselves. The map is
// stubbed: what matters is which point list a click produces, not what
// MapLibre paints.
// ---------------------------------------------------------------------------
describe('drawing interactions', () => {
  const vm = require('vm');

  function element(){
    const el = {
      style:{}, className:'', textContent:'', innerHTML:'', hidden:false, disabled:false,
      dataset:{}, children:[],
      listeners:{},
      classList:{ toggle(){}, add(){}, remove(){}, contains:() => false },
      addEventListener(type, handler){ (this.listeners[type] = this.listeners[type] || []).push(handler); },
      removeEventListener(){},
      setAttribute(name, value){ this.dataset[name] = value; },
      getAttribute(name){ return this.dataset[name] === undefined ? null : this.dataset[name]; },
      append(){}, appendChild(){}, replaceChildren(){}, remove(){}, focus(){},
      querySelector:() => null,
      querySelectorAll:() => [],
      click(){ (this.listeners.click || []).forEach(handler => handler({ target:this })); },
    };
    return el;
  }

  // Load route-planner.js against stubs and hand back the map's event handlers.
  function loadPlanner({ routeResult, onLine = false } = {}){
    const elements = new Map();
    const getElementById = id => {
      if(!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    };
    const mapHandlers = {};
    const markers = [];
    const map = {
      handlers:mapHandlers,
      addControl(){}, addSource(){}, addLayer(){}, setLayoutProperty(){},
      getSource:() => ({ setData(){} }),
      getLayer:id => id === 'draft-route-line',
      getStyle:() => ({ layers:[{ id:'label_city', type:'symbol' }] }),
      isStyleLoaded:() => true,
      once(){}, resize(){}, easeTo(){}, setTerrain(){}, fitBounds(){},
      getCanvas:() => ({ style:{} }),
      queryRenderedFeatures:() => (onLine ? [{ id:1 }] : []),
      on(type, handler){ (mapHandlers[type] = mapHandlers[type] || []).push(handler); },
    };
    const shapeButtons = ['loop', 'point-to-point', 'out-and-back'].map(name => {
      const button = element();
      button.dataset.plannerShape = name;
      return button;
    });
    const context = {
      console, setTimeout, clearTimeout, Promise, URL, URLSearchParams, Math, Number, Date, JSON,
      fetch:jest.fn(),
      location:{ search:'' },
      maplibregl:{
        Map:function(){ return map; },
        NavigationControl:function(){}, GeolocateControl:function(){},
        LngLatBounds:function(){ return { extend(){}, isEmpty:() => true }; },
        Marker:function(){
          const marker = {
            listeners:{},
            setLngLat(){ return marker; },
            addTo(){ markers.push(marker); return marker; },
            remove(){},
            getLngLat:() => marker.moved,
            on(type, handler){ marker.listeners[type] = handler; },
          };
          return marker;
        },
      },
      document:{
        getElementById,
        querySelector:() => null,
        querySelectorAll:selector => (selector === '[data-planner-shape]' ? shapeButtons : []),
        createElement:() => element(),
        addEventListener(){},
      },
      window:null, globalThis:null,
    };
    context.window = context;
    context.globalThis = context;
    context.DoloPawsRouteDrafts = { save:jest.fn(record => record), find:() => null };
    context.DoloPawsRoutePlannerRouting = {
      route:jest.fn(async points => routeResult(points)),
    };
    context.DoloPawsTrailRoutingCoverage = { trails:{} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'route-planner.js'), 'utf8'), context);
    return { context, map, markers, elements, getElementById, shapeButtons };
  }

  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  const okRoute = points => ({
    path:points.map(point => ({ lat:point.lat, lng:point.lng })),
    distanceM:1200, ascentM:88, closed:false, shape:'point-to-point',
    source:'openstreetmap-brouter',
  });

  test('a click away from the line appends a point to the end', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    const click = planner.map.handlers.click[0];
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    click({ lngLat:{ lat:46.52, lng:11.62 }, point:{ x:2, y:2 } });
    await flush();
    click({ lngLat:{ lat:46.54, lng:11.64 }, point:{ x:3, y:3 } });
    await flush();
    const sent = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[0];
    expect(sent.map(point => point.lat)).toEqual([46.50, 46.52, 46.54]);
  });

  test('a click on the drawn line inserts into the nearest leg instead', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:true });
    const click = planner.map.handlers.click[0];
    // First click always starts the route; there is no line to hit yet.
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    click({ lngLat:{ lat:46.60, lng:11.60 }, point:{ x:2, y:2 } });
    await flush();
    click({ lngLat:{ lat:46.70, lng:11.60 }, point:{ x:3, y:3 } });
    await flush();
    // This one sits between the first two, so it belongs at index 1, // not appended after the far end.
    click({ lngLat:{ lat:46.55, lng:11.60 }, point:{ x:4, y:4 } });
    await flush();
    const sent = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[0];
    expect(sent.map(point => point.lat)).toEqual([46.50, 46.55, 46.60, 46.70]);
  });

  test('a click past the last waypoint extends the route, never reorders it', async () => {
    // The rendered path can pass close to a click that actually continues
    // beyond the final waypoint. Folding that into the middle would silently
    // reorder the walk, so projections at a leg's ends are appended instead.
    const planner = loadPlanner({ routeResult:okRoute, onLine:true });
    const click = planner.map.handlers.click[0];
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    click({ lngLat:{ lat:46.60, lng:11.60 }, point:{ x:2, y:2 } });
    await flush();
    click({ lngLat:{ lat:46.70, lng:11.60 }, point:{ x:3, y:3 } });
    await flush();
    const sent = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[0];
    expect(sent.map(point => point.lat)).toEqual([46.50, 46.60, 46.70]);
  });

  test('a click well off the line is a new point, not an insert', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:true });
    const click = planner.map.handlers.click[0];
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    click({ lngLat:{ lat:46.60, lng:11.60 }, point:{ x:2, y:2 } });
    await flush();
    // Mid-leg by latitude but ~7 km east of it.
    click({ lngLat:{ lat:46.55, lng:11.69 }, point:{ x:3, y:3 } });
    await flush();
    const sent = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[0];
    expect(sent.map(point => point.lng)).toEqual([11.60, 11.60, 11.69]);
  });

  test('dragging a waypoint moves it in place and recalculates', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    const click = planner.map.handlers.click[0];
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    click({ lngLat:{ lat:46.60, lng:11.60 }, point:{ x:2, y:2 } });
    await flush();
    const first = planner.markers[planner.markers.length - 2];
    first.moved = { lat:46.51, lng:11.61 };
    first.listeners.dragend();
    await flush();
    const sent = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[0];
    expect(sent.map(point => point.lat)).toEqual([46.51, 46.60]);
  });

  test('the shape choice drives what the router is asked for', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    const click = planner.map.handlers.click[0];
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    click({ lngLat:{ lat:46.60, lng:11.60 }, point:{ x:2, y:2 } });
    await flush();

    planner.shapeButtons.find(button => button.dataset.plannerShape === 'out-and-back').click();
    await flush();
    planner.getElementById('plannerFinish').click();
    await flush();
    let options = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[1];
    expect(options).toMatchObject({ outAndBack:true, closeLoop:false });

    planner.shapeButtons.find(button => button.dataset.plannerShape === 'loop').click();
    await flush();
    planner.getElementById('plannerFinish').click();
    await flush();
    options = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[1];
    expect(options).toMatchObject({ closeLoop:true, outAndBack:false });
  });
});
