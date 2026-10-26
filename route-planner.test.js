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
    // Named for what it does -- loops, one-way and out and back -- marked new
    // and experimental, in the menu under Record a walk.
    expect(homeHtml).toContain('href="route-planner.html"><span class="li-menu-title">Draw your own route <span class="li-menu-badge">New</span></span><small>Loop, one-way or out and back · experimental</small>');
    expect(homeHtml).not.toContain('Draft a loop');
    expect(homeHtml).toContain('li-plan-route');
    expect(homeHtml.indexOf('li-plan-route')).toBeLessThan(homeHtml.indexOf('class="li-body"'));
    expect(detailHtml).not.toContain('id="mapLoopComposerBtn"');
    expect(detailHtml).not.toContain('id="mapLoopComposerPanel"');
    expect(detailSource).not.toContain('    initLoopComposer(map, t);');
  });

  test('the homepage map opens the planner on the area on screen', () => {
    // A link, not a click handler, so a new tab gets the same place; its
    // address follows the map.
    expect(homeHtml).toContain('<a id="homeMapDrawBtn" class="li-map-draw" href="route-planner.html">');
    expect(homeHtml.indexOf('id="homeMapDrawBtn"')).toBeGreaterThan(homeHtml.indexOf('id="trailMapWrap"'));
    const homeSource = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    expect(homeSource).toContain("trailMapInstance.on('moveend', syncDrawLink);");
    expect(homeSource).toContain('route-planner.html?lat=${centre.lat.toFixed(5)}&lng=${centre.lng.toFixed(5)}&z=${trailMapInstance.getZoom().toFixed(2)}');
  });

  test('starts at the view it is given, and ignores one it cannot use', () => {
    const body = plannerSource.match(/  function requestedView\(\)\{[\s\S]*?\n  \}\n/)[0];
    const view = search => new Function('location', `${body}; return requestedView();`)({ search });
    expect(view('?lat=46.69900&lng=12.08530&z=13.50')).toEqual({ center:[12.0853, 46.699], zoom:13.5 });
    expect(view('?lat=46.7&lng=12.1')).toEqual({ center:[12.1, 46.7], zoom:12 });
    expect(view('?lat=46.7&lng=12.1&z=30').zoom).toBe(16);
    expect(view('')).toBeNull();
    expect(view('?lat=&lng=12')).toBeNull();
    expect(view('?lat=95&lng=12')).toBeNull();
    expect(view('?route=abc')).toBeNull();
    expect(plannerSource).toContain('...requestedView(),');
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
      append(...kids){ this.children.push(...kids); }, appendChild(kid){ this.children.push(kid); },
      replaceChildren(){ this.children = []; }, remove(){}, focus(){},
      querySelector:() => null,
      querySelectorAll:() => [],
      click(){
        const event = { target:this, stopPropagation(){}, preventDefault(){} };
        (this.listeners.click || []).forEach(handler => handler(event));
      },
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
    const popup = { open:false, content:null };
    const docHandlers = {};
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
        Popup:function(){
          const instance = {
            setLngLat(){ return instance; },
            setDOMContent(content){ popup.content = content; return instance; },
            addTo(){ popup.open = true; return instance; },
            remove(){ popup.open = false; popup.content = null; return instance; },
          };
          return instance;
        },
        Marker:function(options){
          const marker = {
            listeners:{},
            getElement:() => (options && options.element) || element(),
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
        addEventListener(type, handler){ (docHandlers[type] = docHandlers[type] || []).push(handler); },
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
    return { context, map, markers, elements, getElementById, shapeButtons, popup, docHandlers };
  }

  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  const okRoute = points => ({
    path:points.map(point => ({ lat:point.lat, lng:point.lng })),
    distanceM:1200, ascentM:88, closed:false, shape:'point-to-point',
    source:'openstreetmap-brouter',
  });

  // Three points, then the third one clicked: its menu opens.
  async function threePointsAndSelectLast(planner){
    const click = planner.map.handlers.click[0];
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    click({ lngLat:{ lat:46.52, lng:11.62 }, point:{ x:2, y:2 } });
    await flush();
    click({ lngLat:{ lat:46.54, lng:11.64 }, point:{ x:3, y:3 } });
    await flush();
    planner.markers.at(-1).getElement().click();
    return click;
  }
  const button = (planner, text) => planner.popup.content.children.find(kid => kid.textContent === text);
  const lastSent = planner => planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.at(-1)[0].map(point => point.lat);

  test('clicking a dot opens its menu, and Remove takes that dot out', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    await threePointsAndSelectLast(planner);
    expect(planner.popup.open).toBe(true);
    expect(planner.popup.content.children[0].textContent).toBe('Point 3');
    button(planner, 'Remove').click();
    await flush();
    expect(planner.popup.open).toBe(false);
    expect(lastSent(planner)).toEqual([46.50, 46.52]);
  });

  test('Delete removes the selected dot, and a key while typing does not', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    await threePointsAndSelectLast(planner);
    const keydown = planner.docHandlers.keydown[0];
    keydown({ key:'Backspace', target:{ tagName:'INPUT' }, preventDefault(){} });
    expect(planner.popup.open).toBe(true);
    keydown({ key:'Delete', target:{ tagName:'BODY' }, preventDefault(){} });
    await flush();
    expect(lastSent(planner)).toEqual([46.50, 46.52]);
  });

  test('with a menu open, a click on the map closes it and adds nothing', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    const click = await threePointsAndSelectLast(planner);
    const calls = planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.length;
    click({ lngLat:{ lat:46.60, lng:11.70 }, point:{ x:9, y:9 } });
    await flush();
    expect(planner.popup.open).toBe(false);
    expect(planner.context.DoloPawsRoutePlannerRouting.route.mock.calls.length).toBe(calls);
  });

  test('a dot just dragged is not selected by the click that ends the drag', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    const click = planner.map.handlers.click[0];
    click({ lngLat:{ lat:46.50, lng:11.60 }, point:{ x:1, y:1 } });
    await flush();
    const marker = planner.markers.at(-1);
    marker.listeners.dragstart();
    marker.getElement().click();
    expect(planner.popup.open).toBe(false);
  });

  test('on a loop, Make start puts that dot first and keeps the order around', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    // Loop is the default shape.
    await threePointsAndSelectLast(planner);
    button(planner, 'Make start').click();
    await flush();
    expect(lastSent(planner).slice(0, 3)).toEqual([46.54, 46.50, 46.52]);
  });

  test('Make start is offered only on a loop', async () => {
    const planner = loadPlanner({ routeResult:okRoute, onLine:false });
    planner.shapeButtons.find(b => b.dataset.plannerShape === 'point-to-point').click();
    await threePointsAndSelectLast(planner);
    expect(button(planner, 'Make start')).toBeUndefined();
    expect(planner.popup.content.children[0].textContent).toBe('Finish');
  });

  // The planner routes from anywhere, so the moment the start is chosen is
  // when it says to begin somewhere you can reach.
  test('asks for a start that is easy to reach, and can show where those are', () => {
    const advice = 'Tap the map to choose your start. Pick somewhere you can reach easily: a car park, bus stop, village or lift station.';
    expect(plannerHtml).toContain(`aria-live="polite">${advice}</p>`);
    expect(plannerSource).toContain(`const START_ADVICE = '${advice}';`);
    expect(plannerSource).not.toContain("'Tap the map to choose your start.'");
    // From the base map's own points, so it needs no data file and works in
    // every region: car parks, bus stops, stations and lift stations.
    expect(plannerHtml).toContain('data-planner-poi="access" aria-pressed="false">Parking &amp; bus stops</button>');
    expect(plannerSource).toContain("const ACCESS_CLASSES = ['parking', 'bus', 'rail', 'railway', 'aerialway'];");
    expect(plannerSource).toContain("'source-layer':'poi'");
    expect(plannerSource).toContain("['!=', ['get', 'subclass'], 'bicycle_parking']");
    expect(plannerSource).toContain("if(kind === 'access'){ ensureAccessLayers(); return; }");
  });

  test('the map says how to draw, and says tap on a touch screen', () => {
    expect(plannerHtml).toContain('<p id="plannerGuide" class="planner-guide">');
    expect(plannerHtml).toContain('<span><span data-verb>Click</span> the map to add a point</span>');
    expect(plannerHtml).toContain('<span>Drag a dot to move it</span>');
    expect(plannerHtml).toContain('<span><span data-verb>Click</span> a dot to remove it</span>');
    expect(plannerSource).toContain("window.matchMedia('(pointer: coarse)').matches");
    // Spacing, not dots, between the phrases: a separator dot was stranded at
    // the start of the second line whenever the guide wrapped.
    expect(plannerHtml).not.toMatch(/\.planner-guide>span\+span::before\{content:'·'/);
    expect(plannerHtml).toContain('display:flex;gap:4px 22px;flex-wrap:wrap;');
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
