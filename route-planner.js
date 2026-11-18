(function(){
  'use strict';
  // A walk's name as the reader sees it (i18n.js); search also keeps the English one.
  function trailDisplayName(trail){ var i18n = typeof window !== 'undefined' && window.DoloPawsI18n; return i18n && typeof i18n.trailName === 'function' ? i18n.trailName(trail) : String((trail && trail.name) || ''); }

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }
  // A number as the reader writes it (6,7 km in Italian); English is unchanged.
  function num(value){ const i18n = typeof window!=='undefined' && window.DoloPawsI18n; return i18n && typeof i18n.num==='function' ? i18n.num(value) : value; }

  const coverage = window.DoloPawsTrailRoutingCoverage || { trails:{} };
  const localRouter = window.DoloPawsFootpathRouter;
  const walkingRouter = window.DoloPawsRoutePlannerRouting;
  const drafts = window.DoloPawsRouteDrafts;
  const mapElement = document.getElementById('routePlannerMap');
  if(!walkingRouter || !drafts || !mapElement || typeof maplibregl === 'undefined') return;

  const status = document.getElementById('plannerStatus');
  const distance = document.getElementById('plannerDistance');
  const pointCount = document.getElementById('plannerPointCount');
  const pointList = document.getElementById('plannerPointList');
  const undoButton = document.getElementById('plannerUndo');
  const resetButton = document.getElementById('plannerReset');
  const saveButton = document.getElementById('plannerSave');
  const savedLink = document.getElementById('plannerSavedLink');
  const layersButton = document.getElementById('plannerLayers');
  const layersPanel = document.getElementById('plannerLayersPanel');
  const markedRoutesButton = document.getElementById('plannerMarkedRoutes');
  const poiButtons = Array.from(document.querySelectorAll('[data-planner-poi]'));
  const shapeButtons = Array.from(document.querySelectorAll('[data-planner-shape]'));
  const ascent = document.getElementById('plannerAscent');
  const finishButton = document.getElementById('plannerFinish');
  // "Adjust this walk": the planner opened from one of ORMA's walks
  // (route-adjust.js has the rules).
  const adjust = window.ORMARouteAdjust;
  const adjustBox = document.getElementById('plannerAdjust');
  const adjustShare = document.getElementById('plannerAdjustShare');
  const adjustScore = document.getElementById('plannerAdjustScore');
  const plannerTitle = document.getElementById('plannerTitle');
  const MIN_LOOP_POINTS = 3;
  const MAX_POINTS = 25;
  const MAX_ROUTE_DISTANCE_M = 30000;

  // Three shapes, matching how walks are actually planned. The router has
  // always been able to do all three, only the UI insisted on a closed loop.
  //   loop          finish where you started
  //   point-to-point  A to B, one way
  //   out-and-back  walk out, return along the same line
  // `label` stays English: it names a draft saved on the device. The finish
  // label and hint are read when shown, so they follow the page's language.
  const SHAPES = {
    loop: {
      label:'Loop',
      minPoints:MIN_LOOP_POINTS,
      get finishLabel(){ return tx('Close loop'); },
      get hint(){ return tx('Loop: ORMA connects your points and returns to the start.'); },
    },
    'point-to-point': {
      label:'Point to point',
      minPoints:2,
      get finishLabel(){ return tx('Finish route'); },
      get hint(){ return tx('Point to point: a one-way route from your first point to your last.'); },
    },
    'out-and-back': {
      label:'Out & back',
      minPoints:2,
      get finishLabel(){ return tx('Finish route'); },
      get hint(){ return tx('Out & back: ORMA walks your line out, then returns along the same paths.'); },
    },
  };

  const graphCache = new Map();
  const poiDataCache = new Map();
  let shape = 'loop';
  let points = [];
  let markers = [];
  let preview = null;
  let selectedCoverage = null;
  let busy = false;
  // The point the reader clicked, whose small menu is open; -1 for none.
  let selectedIndex = -1;
  let draggedSinceClick = false;
  let calculationVersion = 0;
  let editingId = null;
  let finished = false;
  // The ORMA walk being adjusted, and how the current line compares with it.
  let basedOn = null;
  let comparison = null;
  // Whom the adjusted walk is scored for (the guest's medium dog until the
  // reader's own dog is known).
  let dogProfile = null;
  // The reader asked for a finished route, and still wants one if that
  // attempt failed: the next move of a point finishes it again, rather than
  // leaving a closed loop open because one drag landed off the paths.
  let finishWanted = false;

  function shapeConfig(){ return SHAPES[shape] || SHAPES.loop; }
  function minPoints(){ return shapeConfig().minPoints; }
  function wantsLoop(){ return shape === 'loop'; }

  // Opened from another map ("Draw a route here" on the homepage), the
  // planner starts where the reader was looking: ?lat=&lng=&z=. Anything
  // missing or out of range falls back to the Dolomites overview.
  function requestedView(){
    const params = new URLSearchParams(location.search);
    // Number('') is 0, so a blank value has to count as missing, not as the
    // equator.
    const read = name => {
      const raw = (params.get(name) || '').trim();
      return raw ? Number(raw) : NaN;
    };
    const lat = read('lat');
    const lng = read('lng');
    if(!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) return null;
    const zoom = read('z');
    return { center:[lng, lat], zoom:Number.isFinite(zoom) ? Math.min(16, Math.max(5, zoom)) : 12 };
  }

  const baseOptions = {
    container:mapElement,
    style:'https://tiles.openfreemap.org/styles/liberty',
    center:[11.85, 46.55],
    zoom:8.4,
    ...requestedView(),
    attributionControl:{ compact:true },
  };
  const map = new maplibregl.Map(window.DoloPawsMapRuntime
    ? window.DoloPawsMapRuntime.mapOptions(baseOptions) : baseOptions);
  map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({
    positionOptions:{ enableHighAccuracy:true },
    trackUserLocation:true,
    showUserHeading:true,
    fitBoundsOptions:{ maxZoom:15.5 },
  }), 'top-right');

  function collapseAttribution(){
    const attribution = mapElement.querySelector('.maplibregl-ctrl-attrib');
    if(!attribution) return;
    attribution.classList.add('maplibregl-compact');
    attribution.classList.remove('maplibregl-compact-show');
    const toggle = attribution.querySelector('.maplibregl-ctrl-attrib-button');
    if(toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  collapseAttribution();

  function entries(){
    return Object.entries(coverage.trails || {}).filter(([, entry]) => entry && entry.bounds && entry.graphUrl);
  }

  function contains(entry, point){
    const bounds = entry.bounds;
    return point.lat >= bounds.south && point.lat <= bounds.north &&
      point.lng >= bounds.west && point.lng <= bounds.east;
  }

  function area(entry){
    return Math.abs((entry.bounds.north - entry.bounds.south) * (entry.bounds.east - entry.bounds.west));
  }

  // Coverage selects the best bundled fallback graph only. It no longer
  // decides whether a point is routable: the old broad bounding boxes could
  // accept points far beyond the graph and then fail after the user finished.
  function coverageFor(point){
    const candidates = entries().filter(([, entry]) => contains(entry, point));
    candidates.sort((first, second) => area(first[1]) - area(second[1]));
    return candidates[0] ? { id:candidates[0][0], ...candidates[0][1] } : null;
  }

  function loadGraph(entry){
    if(!entry || !localRouter) return Promise.resolve(null);
    if(!graphCache.has(entry.graphUrl)){
      graphCache.set(entry.graphUrl, fetch(entry.graphUrl, { credentials:'same-origin' })
        .then(response => response.ok ? response.json() : null)
        .then(graph => localRouter.validateGraph(graph) ? graph : null)
        .catch(() => null));
    }
    return graphCache.get(entry.graphUrl);
  }

  function formatDistance(metres){
    if(!Number.isFinite(metres)) return ', ';
    return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
  }

  function markerElement(index, total){
    const element = document.createElement('span');
    const isStart = index === 0;
    const isEnd = !wantsLoop() && total > 1 && index === total - 1;
    // An adjusted walk starts with a point every 400 m or so; numbered, they
    // covered the walk in counters. Its middle points are small plain dots,
    // still dragged and tapped the same way.
    const dot = Boolean(basedOn) && !isStart && !isEnd;
    element.className = `planner-marker${isStart ? ' planner-marker--start' : ''}${isEnd ? ' planner-marker--end' : ''}${dot ? ' planner-marker--dot' : ''}${index === selectedIndex ? ' is-selected' : ''}`;
    element.textContent = isStart ? 'S' : isEnd ? 'F' : dot ? '' : String(index + 1);
    element.title = tx('Click to remove · drag to move');
    element.setAttribute('aria-hidden', 'true');
    return element;
  }

  // Waypoints are draggable: nudging a point beats deleting it and starting
  // the leg again, and it is how every other route drawer behaves.
  function drawMarkers(){
    markers.forEach(marker => marker.remove());
    markers = points.map((point, index) => {
      const marker = new maplibregl.Marker({
        element:markerElement(index, points.length),
        draggable:true,
      }).setLngLat([point.lng, point.lat]).addTo(map);
      // A click selects the point and opens its menu. A drag ends in a click
      // too, so a drag that just finished is not taken as one.
      marker.getElement().addEventListener('click', event => {
        event.stopPropagation();
        if(draggedSinceClick){ draggedSinceClick = false; return; }
        if(busy) return;
        if(selectedIndex === index) clearSelection();
        else selectPoint(index);
      });
      marker.on('dragstart', () => {
        draggedSinceClick = true;
        clearSelection();
      });
      marker.on('dragend', () => {
        if(busy){ marker.setLngLat([points[index].lng, points[index].lat]); return; }
        const moved = marker.getLngLat();
        points[index] = { lat:moved.lat, lng:moved.lng };
        if(index === 0) selectedCoverage = coverageFor(points[0]);
        // Moving a point of a finished route keeps it finished: the loop
        // stays closed and the way back stays walked, as before the drag.
        const keepFinished = finished || finishWanted;
        preview = null;
        recalculate(keepFinished);
      });
      return marker;
    });
  }

  // A clicked point's menu: what it is, Remove, and -- on a loop, where any
  // point can be where you set off -- Make start. Delete or Backspace removes
  // the selected point too; Escape or a click on the map closes the menu.
  const pointPopup = new maplibregl.Popup({
    anchor:'bottom', offset:24, closeButton:false, closeOnClick:false, className:'planner-point-popup',
  });

  function pointLabel(index){
    const isEnd = !wantsLoop() && points.length > 1 && index === points.length - 1;
    return index === 0 ? tx('Start') : isEnd ? tx('Finish') : tx('Point {number}', { number:index + 1 });
  }

  function selectPoint(index){
    selectedIndex = index;
    markers.forEach((marker, at) => marker.getElement().classList.toggle('is-selected', at === index));
    const menu = document.createElement('div');
    menu.className = 'planner-point-menu';
    const label = document.createElement('span');
    label.className = 'planner-point-menu-label';
    label.textContent = pointLabel(index);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'planner-point-menu-remove';
    remove.textContent = tx('Remove');
    remove.addEventListener('click', () => removePoint(index));
    menu.append(label, remove);
    if(wantsLoop() && index > 0){
      const makeStart = document.createElement('button');
      makeStart.type = 'button';
      makeStart.textContent = tx('Make start');
      makeStart.addEventListener('click', () => makeStartAt(index));
      menu.append(makeStart);
    }
    pointPopup.setLngLat([points[index].lng, points[index].lat]).setDOMContent(menu).addTo(map);
    remove.focus();
  }

  function clearSelection(){
    if(selectedIndex < 0) return;
    selectedIndex = -1;
    pointPopup.remove();
    markers.forEach(marker => marker.getElement().classList.remove('is-selected'));
  }

  // Shared by the map menu, the key and the list beside the map. Removing a
  // point from a finished route keeps it finished while enough points are
  // left for its shape: that is how a corner is cut from a walk.
  function removePoint(index){
    if(busy || index < 0 || index >= points.length) return;
    clearSelection();
    const keepFinished = (finished || finishWanted) && points.length - 1 >= minPoints();
    points.splice(index, 1);
    finished = false;
    preview = null;
    selectedCoverage = points[0] ? coverageFor(points[0]) : null;
    drawMarkers();
    drawPath([]);
    recalculate(keepFinished);
  }

  // A loop has no fixed start, so any point can become it; the order around
  // the loop is kept.
  function makeStartAt(index){
    if(busy || !wantsLoop() || index <= 0 || index >= points.length) return;
    clearSelection();
    points = points.slice(index).concat(points.slice(0, index));
    finished = false;
    preview = null;
    selectedCoverage = coverageFor(points[0]);
    drawMarkers();
    recalculate(false);
  }

  // Clicking the drawn line inserts a point into that leg, so you can bend a
  // leg around a hazard without discarding everything after it.
  //
  // The click must land *between* two waypoints, not past either end: the
  // rendered path can pass close to a click that actually continues beyond
  // the final waypoint, and folding that into the middle silently reorders
  // the walk. Projections at the extremes are rejected and appended instead.
  const INSERT_EDGE_MARGIN = 0.03;   // fraction of a leg treated as its ends
  const INSERT_MAX_OFFSET_M = 400;   // how far off a leg a click may still be

  function insertPointNearest(candidate){
    if(points.length < 2) return false;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for(let index = 0; index < points.length - 1; index += 1){
      const leg = projectOntoSegment(candidate, points[index], points[index + 1]);
      if(leg.t <= INSERT_EDGE_MARGIN || leg.t >= 1 - INSERT_EDGE_MARGIN) continue;
      if(leg.distanceM < bestDistance){ bestDistance = leg.distanceM; bestIndex = index + 1; }
    }
    if(bestIndex < 0 || bestDistance > INSERT_MAX_OFFSET_M) return false;
    points.splice(bestIndex, 0, candidate);
    return true;
  }

  function metresBetween(first, second){
    const rad = value => value * Math.PI / 180;
    const dLat = rad(second.lat - first.lat);
    const dLng = rad(second.lng - first.lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(first.lat)) * Math.cos(rad(second.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Planar approximation, fine at the scale of one walking leg. Returns the
  // perpendicular offset in metres plus the unclamped projection factor, so
  // callers can tell "beside this leg" from "past the end of it".
  function projectOntoSegment(point, start, end){
    const scale = Math.cos(start.lat * Math.PI / 180);
    const px = (point.lng - start.lng) * scale;
    const py = point.lat - start.lat;
    const ex = (end.lng - start.lng) * scale;
    const ey = end.lat - start.lat;
    const lengthSq = ex * ex + ey * ey;
    const t = lengthSq ? (px * ex + py * ey) / lengthSq : 0;
    const clamped = Math.max(0, Math.min(1, t));
    const dx = px - ex * clamped;
    const dy = py - ey * clamped;
    return { t, distanceM:Math.sqrt(dx * dx + dy * dy) * 111320 };
  }

  function emptyGeoJson(){ return { type:'FeatureCollection', features:[] }; }

  function firstLabelLayer(){
    const style = map.getStyle();
    return style && Array.isArray(style.layers) ? style.layers.find(layer => layer.type === 'symbol') : null;
  }

  let latestPath = [];
  function drawPath(path){
    latestPath = path;
    const data = path && path.length > 1 ? {
      type:'Feature', properties:{ draft:true },
      geometry:{ type:'LineString', coordinates:path.map(point => [point.lng, point.lat]) },
    } : emptyGeoJson();
    const source = map.getSource('draft-route');
    if(source){ source.setData(data); return; }
    // The map reports itself not ready while any of its sources is still
    // loading, and 'load' has fired by then, so waiting for it never ended:
    // a reopened draft's line was never drawn. Draw once the map settles.
    if(!map.isStyleLoaded()){
      map.once('idle', () => drawPath(latestPath));
      return;
    }
    const label = firstLabelLayer();
    // The draft goes over the dashed routes but under their numbers: while
    // you are drawing, the numbers of the paths you are snapping to have to
    // stay visible, or you are tracing blind.
    const under = window.ORMAMapStyle ? window.ORMAMapStyle.walkLineBeforeId(map) : (label && label.id);
    map.addSource('draft-route', { type:'geojson', data });
    // A thin line on a white edge, as the walk is drawn on its trail page,
    // so the paths under it stay readable.
    map.addLayer({ id:'draft-route-case', type:'line', source:'draft-route', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],8,4,12,5.5,14,7,17,9],'line-opacity':.95} }, under);
    map.addLayer({ id:'draft-route-line', type:'line', source:'draft-route', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#2E684F','line-width':['interpolate',['linear'],['zoom'],8,2,12,2.75,14,3.75,17,5],'line-opacity':1} }, under);
  }

  function addPlannerMapContext(){
    if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.enhance(map);
    if(!map.getSource('planner-terrain')){
      map.addSource('planner-terrain', {
        type:'raster-dem',
        tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize:256,
        encoding:'terrarium',
        maxzoom:15,
      });
    }
    if(!map.getSource('planner-terrain-3d')){
      map.addSource('planner-terrain-3d', {
        type:'raster-dem',
        tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize:256,
        encoding:'terrarium',
        maxzoom:15,
      });
    }
    const label = firstLabelLayer();
    map.addLayer({
      id:'planner-base-hillshade',
      type:'hillshade',
      source:'planner-terrain',
      paint:{
        'hillshade-exaggeration':.25,
        'hillshade-shadow-color':'#5A5548',
        'hillshade-method':'igor',
      },
    }, label && label.id);
    // Shops, ATMs and road shields compete with the very paths you are
    // tracing along. Turn them down; keep peaks, huts, water, place names.
    if(window.ORMAMapStyle) window.ORMAMapStyle.quietBasemap(map);
    // The marked hiking network you snap to: dashed grey routes with their
    // numbers, drawn by us from OSM route data like every other ORMA map
    // (Waymarked's raster if our tiles cannot load).
    if(window.ORMAMapStyle){
      window.ORMAMapStyle.addHikingRoutes(map, {
        beforeId: label && label.id,
        visible: !markedRoutesButton || markedRoutesButton.getAttribute('aria-pressed') !== 'false',
      });
    }
    addOrmaTrailContext();
  }

  function addOrmaTrailContext(){
    const trails = Array.isArray(window.trails) ? window.trails : [];
    const features = trails.filter(trail => Array.isArray(trail.path) && trail.path.length > 1).map(trail => ({
      type:'Feature',
      properties:{ id:trail.id, name:trailDisplayName(trail) },
      geometry:{ type:'LineString', coordinates:trail.path.map(point => [Number(point[1]), Number(point[0])]) },
    }));
    if(!features.length || map.getSource('planner-orma-trails')) return;
    map.addSource('planner-orma-trails', { type:'geojson', data:{ type:'FeatureCollection', features } });
    const beforeId = window.ORMAMapStyle ? window.ORMAMapStyle.walkLineBeforeId(map) : (firstLabelLayer() || {}).id;
    map.addLayer({
      id:'planner-orma-trails-halo',
      type:'line',
      source:'planner-orma-trails',
      minzoom:7,
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{
        'line-color':'#FFFDF7',
        'line-width':['interpolate',['linear'],['zoom'],7,2,10,3,13,4.5],
        'line-opacity':.7,
      },
    }, beforeId);
    map.addLayer({
      id:'planner-orma-trails-line',
      type:'line',
      source:'planner-orma-trails',
      minzoom:7,
      layout:{ 'line-join':'round', 'line-cap':'round' },
      // ORMA's walks in grey, like the marked network: the route being drawn
      // is the only coloured line on the map.
      paint:{
        'line-color':'#7D847C',
        'line-width':['interpolate',['linear'],['zoom'],7,1,10,1.6,13,2.4],
        'line-opacity':.85,
      },
    }, beforeId);
  }

  // The planner will route from anywhere, including a hillside with no road
  // to it. Said when the start is chosen, not in the small print: begin where
  // you can actually arrive.
  const startAdvice = () => tx('Tap the map to choose your start. Pick somewhere you can reach easily: a car park, bus stop, village or lift station.');

  // Car parks, bus stops, stations and lift stations, from the base map's own
  // points of interest, so this layer needs no data file and works in every
  // region the map covers.
  const ACCESS_CLASSES = ['parking', 'bus', 'rail', 'railway', 'aerialway'];
  const ACCESS_LABEL = ['match', ['get', 'class'],
    'parking', 'P', 'bus', tx('Bus'), 'rail', tx('Train'), 'railway', tx('Train'), 'aerialway', tx('Lift'), ''];

  function vectorSourceId(){
    const sources = map.getStyle().sources || {};
    return Object.keys(sources).find(id => sources[id].type === 'vector') || 'openmaptiles';
  }

  function ensureAccessLayers(){
    if(map.getLayer('planner-poi-access-points')) return;
    const source = vectorSourceId();
    const filter = ['all',
      ['in', ['get', 'class'], ['literal', ACCESS_CLASSES]],
      ['!=', ['get', 'subclass'], 'bicycle_parking'],
      ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false]];
    const beforeId = firstLabelLayer();
    map.addLayer({
      id:'planner-poi-access-points', type:'circle', source, 'source-layer':'poi', minzoom:12, filter,
      layout:{ visibility:'none' },
      paint:{
        'circle-color':['match', ['get', 'class'], 'parking', '#2F5D8A', '#5B4A8A'],
        'circle-radius':['interpolate', ['linear'], ['zoom'], 12, 6, 15, 9],
        'circle-stroke-color':'#fff', 'circle-stroke-width':2, 'circle-opacity':.95,
      },
    }, beforeId && beforeId.id);
    map.addLayer({
      id:'planner-poi-access-labels', type:'symbol', source, 'source-layer':'poi', minzoom:12, filter,
      layout:{
        visibility:'none',
        'text-field':['step', ['zoom'], ACCESS_LABEL, 15,
          ['case', ['has', 'name'], ['concat', ACCESS_LABEL, ' · ', ['get', 'name']], ACCESS_LABEL]],
        'text-font':window.ORMAMapStyle && window.ORMAMapStyle.FONT_BOLD ? window.ORMAMapStyle.FONT_BOLD : ['Noto Sans Bold'],
        'text-size':['step', ['zoom'], 9, 15, 11],
        'text-offset':['step', ['zoom'], ['literal', [0, 0]], 15, ['literal', [0, 1.4]]],
        'text-anchor':['step', ['zoom'], 'center', 15, 'top'],
        'text-allow-overlap':['step', ['zoom'], true, 15, false],
        'text-max-width':12,
      },
      paint:{
        'text-color':['step', ['zoom'], '#ffffff', 15, '#2E4034'],
        'text-halo-color':['step', ['zoom'], 'rgba(0,0,0,0)', 15, 'rgba(255,255,252,.96)'],
        'text-halo-width':1.3,
      },
    });
  }

  function loadPoiData(kind){
    const dataKind = kind === 'water' ? 'water' : 'huts-bars';
    if(!poiDataCache.has(dataKind)){
      const file = dataKind === 'water'
        ? 'data/regions/dolomites-water.geojson'
        : 'data/regions/dolomites-huts-bars.geojson';
      poiDataCache.set(dataKind, fetch(file, { credentials:'same-origin' })
        .then(response => {
          if(!response.ok) throw new Error(`Could not load ${dataKind}.`);
          return response.json();
        }));
    }
    return poiDataCache.get(dataKind);
  }

  function poiFilter(kind){
    if(kind === 'huts') return ['any',
      ['in',['get','tourism'],['literal',['alpine_hut','wilderness_hut']]],
      ['==',['get','amenity'],'shelter']];
    if(kind === 'food') return ['in',['get','amenity'],['literal',['restaurant','cafe','bar','pub','fast_food','biergarten']]];
    return undefined;
  }

  async function ensurePoiLayers(kind){
    if(kind === 'access'){ ensureAccessLayers(); return; }
    const sourceId = kind === 'water' ? 'planner-poi-water' : 'planner-poi-huts-bars';
    if(!map.getSource(sourceId)) map.addSource(sourceId, { type:'geojson', data:await loadPoiData(kind) });
    const pointLayer = `planner-poi-${kind}-points`;
    const labelLayer = `planner-poi-${kind}-labels`;
    if(map.getLayer(pointLayer)) return;
    const colors = { water:'#3E7A91', huts:'#C98A2E', food:'#9C3A25' };
    const filter = poiFilter(kind);
    const beforeId = firstLabelLayer();
    const pointLayerDefinition = {
      id:pointLayer,
      type:'circle',
      source:sourceId,
      minzoom:kind === 'food' ? 11 : 9,
      layout:{ visibility:'none' },
      paint:{
        'circle-color':colors[kind],
        'circle-radius':['interpolate',['linear'],['zoom'],9,3,13,5,16,7],
        'circle-stroke-color':'#fff',
        'circle-stroke-width':2,
        'circle-opacity':.94,
      },
    };
    if(filter) pointLayerDefinition.filter = filter;
    map.addLayer(pointLayerDefinition, beforeId && beforeId.id);
    if(kind !== 'water'){
      map.addLayer({
        id:labelLayer,
        type:'symbol',
        source:sourceId,
        minzoom:13,
        filter,
        layout:{
          visibility:'none',
          'text-field':['coalesce',['get','name'],''],
          'text-size':11,
          'text-offset':[0,1.2],
          'text-anchor':'top',
          'text-max-width':12,
        },
        paint:{ 'text-color':'#2E4034', 'text-halo-color':'rgba(255,255,252,.96)', 'text-halo-width':1.3 },
      });
    }
  }

  function setPoiVisibility(kind, visible){
    [`planner-poi-${kind}-points`, `planner-poi-${kind}-labels`].forEach(id => {
      if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }

  function ensureSatelliteLayer(){
    if(map.getLayer('planner-satellite-layer')) return true;
    if(!map.isStyleLoaded()) return false;
    map.addSource('planner-satellite', {
      type:'raster',
      tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize:256,
      maxzoom:19,
      attribution:'Imagery © Esri',
    });
    const beforeId = map.getLayer('planner-base-hillshade') ? 'planner-base-hillshade' : (firstLabelLayer() || {}).id;
    map.addLayer({
      id:'planner-satellite-layer',
      type:'raster',
      source:'planner-satellite',
      layout:{ visibility:'none' },
      paint:{ 'raster-resampling':'linear', 'raster-fade-duration':100 },
    }, beforeId);
    return true;
  }

  function buildMapStyleSwitch(){
    if(mapElement.querySelector('.td-layer-switch')) return;
    const switcher = document.createElement('div');
    switcher.className = 'td-layer-switch';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', tx('Map style'));
    switcher.innerHTML = `<button type="button" data-maplayer="map" class="on" aria-pressed="true">${tx('Map')}</button>` +
      `<button type="button" data-maplayer="satellite" aria-pressed="false">${tx('Satellite')}</button>` +
      '<button type="button" data-map3d aria-pressed="false">3D</button>';
    mapElement.appendChild(switcher);
    let flatCamera = null;
    switcher.addEventListener('click', event => {
      const terrainButton = event.target.closest('[data-map3d]');
      if(terrainButton){
        const enabled = terrainButton.getAttribute('aria-pressed') !== 'true';
        if(enabled){
          flatCamera = { center:map.getCenter(), zoom:map.getZoom(), bearing:map.getBearing() };
          map.setTerrain({ source:'planner-terrain-3d', exaggeration:1.3 });
          map.easeTo({ pitch:38, zoom:Math.min(map.getZoom(), 12.25), duration:500 });
        }else{
          map.setTerrain(null);
          map.easeTo({ pitch:0, ...(flatCamera || {}), duration:500 });
        }
        terrainButton.classList.toggle('on', enabled);
        terrainButton.setAttribute('aria-pressed', String(enabled));
        return;
      }
      const baseButton = event.target.closest('[data-maplayer]');
      if(!baseButton || !ensureSatelliteLayer()) return;
      const satellite = baseButton.dataset.maplayer === 'satellite';
      map.setLayoutProperty('planner-satellite-layer', 'visibility', satellite ? 'visible' : 'none');
      map.getStyle().layers.forEach(layer => {
        if(layer['source-layer'] === 'building' || /building/i.test(layer.id)){
          try{ map.setLayoutProperty(layer.id, 'visibility', satellite ? 'none' : 'visible'); }catch(error){}
        }
      });
      switcher.querySelectorAll('[data-maplayer]').forEach(button => {
        const selected = button === baseButton;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    });
  }

  function render(){
    const config = shapeConfig();
    distance.textContent = preview ? num(formatDistance(preview.distanceM)) : ', ';
    if(ascent){
      ascent.textContent = preview && Number.isFinite(preview.ascentM)
        ? `${num(Math.round(preview.ascentM))} m` : ', ';
    }
    pointCount.textContent = `${points.length} / ${MAX_POINTS}`;
    shapeButtons.forEach(button => {
      const on = button.dataset.plannerShape === shape;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
      button.disabled = busy;
    });
    undoButton.disabled = busy || !points.length;
    resetButton.disabled = busy || !points.length;
    if(finishButton){
      finishButton.textContent = config.finishLabel;
      finishButton.disabled = busy || points.length < config.minPoints || finished;
    }
    saveButton.disabled = busy || !preview || !finished;
    pointList.replaceChildren();
    points.forEach((point, index) => {
      const item = document.createElement('li');
      const isEnd = !wantsLoop() && points.length > 1 && index === points.length - 1;
      item.textContent = index === 0 ? tx('Start') : isEnd ? tx('Finish') : tx('Point {number}', { number:index + 1 });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', index === 0 ? tx('Remove start') : tx('Remove point {number}', { number:index + 1 }));
      remove.disabled = busy;
      remove.addEventListener('click', () => removePoint(index));
      item.append(remove);
      pointList.append(item);
    });
  }

  async function localFallback(closeRequested){
    selectedCoverage = selectedCoverage || coverageFor(points[0]);
    const graph = await loadGraph(selectedCoverage);
    if(!graph || !localRouter) return null;
    const options = {
      maxPoints:MAX_POINTS,
      maxLegDistanceM:8000,
      maxTotalDistanceM:MAX_ROUTE_DISTANCE_M,
      maxSnapDistanceM:120,
      maxTargetSnapDistanceM:120,
    };
    const result = closeRequested
      ? localRouter.routeLoop(points, graph, options)
      : localRouter.routeThroughPoints(points, graph, options);
    if(result) result.source = 'openstreetmap-local-graph';
    return result;
  }

  function failureMessage(error){
    if(error && error.code === 'too-long') return error.message;
    if(error && error.code === 'network') return tx('The live walking network is unavailable and the local fallback could not connect those points. Try again shortly.');
    return tx('No mapped walking route connects those points. Undo the last point and choose a nearby path.');
  }

  async function recalculate(finishRequested){
    const version = ++calculationVersion;
    const config = shapeConfig();
    finishWanted = Boolean(finishRequested);
    if(points.length < 2){
      preview = null;
      finished = false;
      busy = false;
      status.textContent = points.length ? config.hint : startAdvice();
      drawPath([]);
      render();
      return;
    }
    busy = true;
    status.textContent = finishRequested ? tx('Finishing the draft on mapped walking paths…') : tx('Connecting your selected points…');
    render();
    updateAdjust();

    const closeLoop = finishRequested && wantsLoop();
    const outAndBack = finishRequested && shape === 'out-and-back';
    let result = null;
    let routeFailure = null;
    try{
      result = await walkingRouter.route(points, {
        closeLoop,
        outAndBack,
        maxDistanceM:MAX_ROUTE_DISTANCE_M,
        timeoutMs:20000,
      });
    }catch(error){
      routeFailure = error;
      result = await localFallback(closeLoop);
    }
    if(version !== calculationVersion) return;
    busy = false;
    preview = result;
    finished = Boolean(result) && finishRequested;
    drawPath(result ? result.path : []);
    status.textContent = result
      ? (finished
        ? tx('Draft ready. Check signs, access and current conditions before using it.')
        : points.length < config.minPoints
          ? `${config.hint} ${tx('Add another point.')}`
          : points.length < MAX_POINTS
            ? tx('Preview ready. Drag a point to adjust it, click the line to insert one, or press {finish}.', { finish:config.finishLabel.toLowerCase() })
            : tx('{count} points selected, press {finish} when the shape looks right.', { count:MAX_POINTS, finish:config.finishLabel.toLowerCase() }))
      : failureMessage(routeFailure);
    render();
    updateAdjust();
  }

  function reset(){
    calculationVersion += 1;
    points = [];
    preview = null;
    finished = false;
    selectedCoverage = null;
    editingId = null;
    busy = false;
    // Start again is a blank page, not the walk it was opened from.
    if(basedOn) setTitle(tx('Draw a route'));
    basedOn = null;
    comparison = null;
    updateAdjust();
    drawMarkers();
    drawPath([]);
    status.textContent = startAdvice();
    render();
  }

  function restore(record){
    editingId = record.id;
    points = record.points.map(point => ({ ...point }));
    const match = entries().find(([id, entry]) => id === record.coverageId || entry.graphUrl === record.graphUrl);
    selectedCoverage = match ? { id:match[0], ...match[1] } : coverageFor(points[0]);
    shape = SHAPES[record.shape] ? record.shape : 'loop';
    finished = true;
    preview = {
      distanceM:record.distanceM,
      ascentM:Number.isFinite(record.ascentM) ? record.ascentM : null,
      path:record.path.map(point => ({ lat:point[0], lng:point[1] })),
      closed:shape !== 'point-to-point',
      shape,
      heights:Array.isArray(record.heights) ? record.heights : null,
      source:record.source,
    };
    drawMarkers();
    drawPath(preview.path);
    const bounds = new maplibregl.LngLatBounds();
    preview.path.forEach(point => bounds.extend([point.lng, point.lat]));
    map.fitBounds(bounds, { padding:70, maxZoom:15 });
    status.textContent = tx('Saved draft reopened. Check signs, access and current conditions before using it.');
    render();
    if(record.basedOn) findTrail(record.basedOn.id).then(trail => {
      if(!trail || editingId !== record.id) return;
      basedOn = trail;
      drawMarkers();
      updateAdjust();
    });
  }

  map.on('click', event => {
    // With a point's menu open, a click on the map just closes it.
    if(selectedIndex >= 0){ clearSelection(); return; }
    if(busy || points.length >= MAX_POINTS) return;
    const point = { lat:event.lngLat.lat, lng:event.lngLat.lng };
    // A finished route can still be bent: a click on its line adds a point
    // there and the route stays finished. Anywhere else, nothing happens.
    if(finished){
      const onLine = map.getLayer('draft-route-line')
        && map.queryRenderedFeatures(event.point, { layers:['draft-route-line'] }).length > 0;
      if(onLine && insertPointNearest(point)){
        drawMarkers();
        recalculate(true);
      }
      return;
    }
    if(!points.length){
      selectedCoverage = coverageFor(point);
      points.push(point);
    }else{
      // Clicking on (or very near) the drawn line inserts a point into that
      // leg; clicking anywhere else extends the route from the last point.
      const onLine = map.getLayer('draft-route-line')
        && map.queryRenderedFeatures(event.point, { layers:['draft-route-line'] }).length > 0;
      if(!(onLine && insertPointNearest(point))) points.push(point);
    }
    drawMarkers();
    recalculate(false);
  });
  map.on('mousemove', event => {
    if(busy || points.length < 2) return;
    const onLine = map.getLayer('draft-route-line')
      && map.queryRenderedFeatures(event.point, { layers:['draft-route-line'] }).length > 0;
    map.getCanvas().style.cursor = onLine ? 'copy' : 'crosshair';
  });

  undoButton.addEventListener('click', () => {
    clearSelection();
    // Undo on a finished route reopens it for editing before it removes a
    // point, otherwise finishing costs you the last leg you just placed.
    if(finished){ finished = false; recalculate(false); return; }
    points.pop();
    selectedCoverage = points[0] ? coverageFor(points[0]) : null;
    drawMarkers();
    recalculate(false);
  });
  resetButton.addEventListener('click', reset);
  if(finishButton) finishButton.addEventListener('click', () => recalculate(true));
  shapeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const next = button.dataset.plannerShape;
      if(busy || !SHAPES[next] || next === shape) return;
      shape = next;
      finished = false;
      preview = null;
      drawMarkers();
      recalculate(false);
    });
  });
  saveButton.addEventListener('click', () => {
    if(!preview || !finished) return;
    const now = new Date().toISOString();
    const record = drafts.save({
      id:editingId || `${shape}-${Date.now()}`,
      name:basedOn
        ? `${tx('Your version of {name}', { name:trailDisplayName(basedOn) })} · ${formatDistance(preview.distanceM)}`
        : `Draft ${shapeConfig().label.toLowerCase()} · ${formatDistance(preview.distanceM)}`,
      basedOn:basedOn ? { id:basedOn.id, name:basedOn.name } : null,
      onLineShare:comparison ? Math.round(comparison.share * 100) / 100 : null,
      heights:Array.isArray(preview.heights) ? preview.heights : null,
      createdAt:now,
      updatedAt:now,
      graphUrl:selectedCoverage ? selectedCoverage.graphUrl : '',
      coverageId:selectedCoverage ? selectedCoverage.id : '',
      source:preview.source,
      shape,
      distanceM:preview.distanceM,
      ascentM:Number.isFinite(preview.ascentM) ? preview.ascentM : null,
      points,
      path:preview.path.map(point => [point.lat, point.lng]),
    });
    if(record){
      editingId = record.id;
      status.textContent = tx('Draft saved on this device. You can reopen it from Saved → My routes.');
      savedLink.hidden = false;
    }else status.textContent = tx('This browser could not save the draft.');
  });

  layersButton.addEventListener('click', () => {
    const open = layersPanel.hidden;
    layersPanel.hidden = !open;
    layersButton.setAttribute('aria-expanded', String(open));
    layersButton.textContent = open ? tx('Close layers') : tx('Layers');
  });
  markedRoutesButton.addEventListener('click', () => {
    const enabled = markedRoutesButton.getAttribute('aria-pressed') !== 'true';
    markedRoutesButton.setAttribute('aria-pressed', String(enabled));
    if(window.ORMAMapStyle) window.ORMAMapStyle.setHikingRoutesVisible(map, enabled);
  });
  poiButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const kind = button.dataset.plannerPoi;
      const enabled = button.getAttribute('aria-pressed') !== 'true';
      button.disabled = true;
      try{
        await ensurePoiLayers(kind);
        button.setAttribute('aria-pressed', String(enabled));
        setPoiVisibility(kind, enabled);
      }catch(error){
        status.textContent = tx('That map layer could not be loaded. Your draft route is unchanged.');
      }finally{
        button.disabled = false;
      }
    });
  });
  document.addEventListener('keydown', event => {
    const typing = event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if(selectedIndex >= 0 && !typing && (event.key === 'Delete' || event.key === 'Backspace')){
      event.preventDefault();
      removePoint(selectedIndex);
      return;
    }
    if(event.key === 'Escape' && selectedIndex >= 0){
      clearSelection();
      return;
    }
    if(event.key === 'Escape' && !layersPanel.hidden){
      layersPanel.hidden = true;
      layersButton.textContent = tx('Layers');
      layersButton.setAttribute('aria-expanded', 'false');
      layersButton.focus();
    }
  });

  // The guide says "tap" to a finger and "click" to a mouse.
  const guide = document.getElementById('plannerGuide');
  if(guide){
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    guide.querySelectorAll('[data-verb]').forEach(verb => { verb.textContent = touch ? tx('Tap') : tx('Click'); });
  }

  // ---- Adjust this walk -------------------------------------------------

  // A walk from any region: the page loads one region up front, the walk's own
  // region is fetched when it is another.
  function findTrail(value){
    const regional = window.DoloPawsRegionalData;
    const id = regional && regional.resolveTrailId ? regional.resolveTrailId(value) : value;
    const lookup = () => (Array.isArray(window.trails) ? window.trails : []).find(trail => trail && trail.id === id) || null;
    const found = lookup();
    if(found || !regional) return Promise.resolve(found);
    const region = regional.regionForTrail(id);
    if(!region) return Promise.resolve(null);
    return regional.loadRegion(region).then(lookup, () => null);
  }

  function startFromTrail(trail){
    const seeded = adjust.seed(trail);
    if(!seeded){
      status.textContent = tx('That walk has no line to start from. Tap the map to draw your own route.');
      return;
    }
    basedOn = trail;
    editingId = null;
    shape = seeded.shape;
    points = seeded.points;
    selectedCoverage = coverageFor(points[0]);
    const bounds = new maplibregl.LngLatBounds();
    seeded.line.forEach(point => bounds.extend([point.lng, point.lat]));
    // Room at the top for the guide over the map, which sits lower and
    // wraps to two lines on a phone.
    const phone = window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
    map.fitBounds(bounds, { padding:{ top:phone ? 125 : 90, bottom:phone ? 60 : 50, left:40, right:phone ? 60 : 50 }, maxZoom:15, duration:0 });
    // Back goes to the walk it came from, not to Explore.
    const back = document.querySelector('.planner-back');
    const regional = window.DoloPawsRegionalData;
    if(back){
      back.removeAttribute('data-i18n');
      back.href = regional && regional.trailHref ? regional.trailHref(trail) : `trail.html?id=${encodeURIComponent(regional && regional.slugFor ? regional.slugFor(trail) : trail.id)}`;
      back.textContent = tx('← Back to the walk');
    }
    saveButton.removeAttribute('data-i18n');
    saveButton.textContent = tx('Save my version');
    const intro = document.querySelector('.planner-intro');
    if(intro){ intro.removeAttribute('data-i18n'); intro.textContent = tx('This is the walk as ORMA checked it. Drag a point to move it, tap the line to add one, or remove one to cut a corner. Then save your version.'); }
    drawMarkers();
    recalculate(true);
  }

  // The map says it is not ready while it is still drawing the new route
  // line, so the stretches are drawn once it settles; only the latest count.
  let offLineToDraw = [];
  let offLineWaiting = false;
  function drawOffLine(lines){
    offLineToDraw = lines || [];
    const source = map.getSource('adjust-off-line');
    const data = () => ({ type:'FeatureCollection', features:offLineToDraw.map(line => ({
      type:'Feature', properties:{},
      geometry:{ type:'LineString', coordinates:line.map(point => [point[1], point[0]]) },
    })) });
    if(source){ source.setData(data()); return; }
    if(!offLineToDraw.length) return;
    if(!map.getLayer('draft-route-line') || !map.isStyleLoaded()){
      if(!offLineWaiting){
        offLineWaiting = true;
        map.once('idle', () => { offLineWaiting = false; drawOffLine(offLineToDraw); });
      }
      return;
    }
    map.addSource('adjust-off-line', { type:'geojson', data:data() });
    // Over the draft, in the hazard orange, dashed: the stretches nobody checked.
    map.addLayer({ id:'adjust-off-line', type:'line', source:'adjust-off-line',
      layout:{ 'line-cap':'round', 'line-join':'round' },
      paint:{ 'line-color':'#C98A2E', 'line-width':['interpolate',['linear'],['zoom'],8,2,12,2.75,14,3.75,17,5], 'line-dasharray':[2, 1.4] },
    });
  }

  function loadDog(){
    const device = () => {
      try {
        const profile = JSON.parse(localStorage.getItem('dolopaws-pending-dog-profile') || 'null');
        return profile && typeof profile.name === 'string' && profile.name.trim() ? profile : null;
      } catch(error){ return null; }
    };
    const resolve = () => {
      const auth = window.DoloPawsAuth;
      if(auth && auth.currentUser && typeof auth.getDogProfile === 'function'){
        auth.getDogProfile().then(profile => {
          if(profile){ dogProfile = profile; updateAdjust(); }
        }).catch(() => {});
        return;
      }
      const profile = device();
      if(profile){ dogProfile = profile; updateAdjust(); }
    };
    resolve();
    if(typeof window.addEventListener === 'function'){
      window.addEventListener('dolopaws-auth-ready', resolve);
      window.addEventListener('dolopaws-auth-changed', resolve);
    }
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  // The score for the adjusted walk, from the engine, or why there is none.
  function scoreHtml(walkName){
    if(!finished) return `<p class="planner-adjust-note">${esc(tx('Finish the route to see how it suits your dog.'))}</p>`;
    const record = adjust.scoringRecord(basedOn, { ...preview, shape }, comparison);
    if(!record){
      return `<p class="planner-adjust-note">${esc(tx('Not scored: less than half of this route follows {walk}, so its facts no longer describe it.', { walk:walkName }))}</p>`;
    }
    // eslint-disable-next-line no-undef
    if(typeof recommendTrail !== 'function') return '';
    // eslint-disable-next-line no-undef
    const subject = dogProfile && typeof effectiveOverrides === 'function' ? effectiveOverrides(dogProfile, null)
      : ((window.DoloPawsScoring && window.DoloPawsScoring.GUEST_SUBJECT) || {});
    const conditions = window.ORMAScoringConditions ? window.ORMAScoringConditions.forTrail(basedOn) : undefined;
    // eslint-disable-next-line no-undef
    const rec = recommendTrail(record, subject, conditions);
    const declared = rec.category === 'recommended' ? 'strong-option' : rec.category;
    const verdict = window.OrmaMatchVerdict
      ? window.OrmaMatchVerdict.verdictFor({ score:rec.score, category:declared })
      : { label:'', color:'inherit' };
    const guest = typeof window.t === 'function' ? window.t('recommendation.subject.guest') : '';
    const name = (dogProfile && String(dogProfile.name || '').trim())
      || (guest && guest !== 'recommendation.subject.guest' ? guest : tx('a medium dog'));
    const decision = window.DoloPawsRecommendationDecision;
    const reason = (rec.hardStops || [])[0] || (rec.cautions || [])[0];
    const reasonText = reason
      ? String(decision ? decision.translatedMessage(reason, window.t, { name }) : reason.message).split('{name}').join(name)
      : '';
    return `<p class="planner-adjust-fit"><span>${esc(tx('For {name}', { name }))}</span>` +
        `<strong style="color:${esc(verdict.color)}">${esc(num(rec.score))} · ${esc(verdict.label)}</strong></p>` +
      (reasonText ? `<p class="planner-adjust-reason">${esc(reasonText)}</p>` : '') +
      `<p class="planner-adjust-note">${esc(tx('Distance and climb are measured on your line. Heat, surfaces and dog rules come from {walk} and were not checked on the new parts.', { walk:walkName }))}` +
      // The trail page knows today's forecast and this page does not, so its
      // number can differ by the day's weather; said rather than left to look
      // like a disagreement.
      (conditions ? '' : ` ${esc(tx('Today’s weather is not included.'))}`) + '</p>';
  }

  // The title is translated from its data-i18n key when the page's language
  // is applied, which would put "Draw a route" back over the walk's name.
  function setTitle(text){
    if(!plannerTitle) return;
    plannerTitle.removeAttribute('data-i18n');
    plannerTitle.textContent = text;
  }

  function updateAdjust(){
    if(!adjustBox) return;
    if(!basedOn || !adjust){
      adjustBox.hidden = true;
      drawOffLine([]);
      return;
    }
    const walkName = trailDisplayName(basedOn);
    setTitle(tx('Adjust {walk}', { walk:walkName }));
    adjustBox.hidden = false;
    comparison = preview && preview.path ? adjust.compare(preview.path, basedOn.path) : null;
    drawOffLine(comparison ? comparison.offLines : []);
    const percent = comparison ? Math.round(comparison.share * 100) : null;
    adjustShare.innerHTML = percent === null ? (busy ? esc(tx('Working out the route…')) : '')
      : `<strong>${esc(num(percent))}%</strong> ${esc(tx('on the checked line of {walk}', { walk:walkName }))}` +
        (comparison.offLines.length ? `<span class="planner-adjust-key">${esc(tx('Orange dashes: not checked by ORMA. Look for signs and local dog rules there.'))}</span>` : '');
    adjustScore.innerHTML = preview ? scoreHtml(walkName) : '';
  }

  // Opened from a walk: say so at once, before the map has loaded.
  const startParams = new URLSearchParams(location.search);
  const trailRequest = !startParams.get('route') && startParams.get('trail') && adjust
    ? findTrail(startParams.get('trail')) : null;
  if(trailRequest){
    status.textContent = tx('Loading the walk…');
    trailRequest.then(trail => {
      if(trail && !basedOn) setTitle(tx('Adjust {walk}', { walk:trailDisplayName(trail) }));
    });
  }
  loadDog();

  map.on('load', () => {
    addPlannerMapContext();
    buildMapStyleSwitch();
    collapseAttribution();
    map.getCanvas().style.cursor = 'crosshair';
    const id = startParams.get('route');
    const record = id ? drafts.find(id) : null;
    if(record) restore(record);
    else if(trailRequest){
      render();
      trailRequest.then(trail => {
        if(trail) startFromTrail(trail);
        else status.textContent = tx('That walk could not be found. Tap the map to draw your own route.');
      });
    }else render();
  });
})();
