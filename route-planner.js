(function(){
  'use strict';

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
  const closeButton = document.getElementById('plannerClose');
  const saveButton = document.getElementById('plannerSave');
  const savedLink = document.getElementById('plannerSavedLink');
  const layersButton = document.getElementById('plannerLayers');
  const layersPanel = document.getElementById('plannerLayersPanel');
  const markedRoutesButton = document.getElementById('plannerMarkedRoutes');
  const poiButtons = Array.from(document.querySelectorAll('[data-planner-poi]'));
  const MIN_LOOP_POINTS = 3;
  const MAX_POINTS = 8;
  const MAX_ROUTE_DISTANCE_M = 30000;
  const graphCache = new Map();
  const poiDataCache = new Map();
  let points = [];
  let markers = [];
  let preview = null;
  let selectedCoverage = null;
  let busy = false;
  let calculationVersion = 0;
  let editingId = null;

  const baseOptions = {
    container:mapElement,
    style:'https://tiles.openfreemap.org/styles/liberty',
    center:[11.85, 46.55],
    zoom:8.4,
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
    if(!Number.isFinite(metres)) return '—';
    return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
  }

  function markerElement(index){
    const element = document.createElement('span');
    element.className = `planner-marker${index === 0 ? ' planner-marker--start' : ''}`;
    element.textContent = index === 0 ? 'S' : String(index + 1);
    element.setAttribute('aria-hidden', 'true');
    return element;
  }

  function drawMarkers(){
    markers.forEach(marker => marker.remove());
    markers = points.map((point, index) => new maplibregl.Marker({ element:markerElement(index) })
      .setLngLat([point.lng, point.lat]).addTo(map));
  }

  function emptyGeoJson(){ return { type:'FeatureCollection', features:[] }; }

  function firstLabelLayer(){
    const style = map.getStyle();
    return style && Array.isArray(style.layers) ? style.layers.find(layer => layer.type === 'symbol') : null;
  }

  function drawPath(path){
    const data = path && path.length > 1 ? {
      type:'Feature', properties:{ draft:true },
      geometry:{ type:'LineString', coordinates:path.map(point => [point.lng, point.lat]) },
    } : emptyGeoJson();
    if(!map.isStyleLoaded()){
      map.once('load', () => drawPath(path));
      return;
    }
    const source = map.getSource('draft-route');
    if(source){ source.setData(data); return; }
    const label = firstLabelLayer();
    map.addSource('draft-route', { type:'geojson', data });
    map.addLayer({ id:'draft-route-case', type:'line', source:'draft-route', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#fff','line-width':10,'line-opacity':.94} }, label && label.id);
    map.addLayer({ id:'draft-route-line', type:'line', source:'draft-route', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#2E684F','line-width':6,'line-opacity':.98} }, label && label.id);
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
    map.addSource('planner-waymarked-hiking', {
      type:'raster',
      tiles:['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
      tileSize:256,
      attribution:'© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
    });
    map.addLayer({
      id:'planner-waymarked-hiking-layer',
      type:'raster',
      source:'planner-waymarked-hiking',
      layout:{ visibility:'visible' },
      paint:{
        'raster-opacity':['interpolate',['linear'],['zoom'],7,.48,10,.66,12,.84,14,1],
        'raster-saturation':0,
        'raster-contrast':0,
        'raster-resampling':'linear',
      },
    }, label && label.id);
    addOrmaTrailContext();
  }

  function addOrmaTrailContext(){
    const trails = Array.isArray(window.trails) ? window.trails : [];
    const features = trails.filter(trail => Array.isArray(trail.path) && trail.path.length > 1).map(trail => ({
      type:'Feature',
      properties:{ id:trail.id, name:trail.name },
      geometry:{ type:'LineString', coordinates:trail.path.map(point => [Number(point[1]), Number(point[0])]) },
    }));
    if(!features.length || map.getSource('planner-orma-trails')) return;
    map.addSource('planner-orma-trails', { type:'geojson', data:{ type:'FeatureCollection', features } });
    const beforeId = map.getLayer('planner-waymarked-hiking-layer') ? 'planner-waymarked-hiking-layer' : (firstLabelLayer() || {}).id;
    map.addLayer({
      id:'planner-orma-trails-halo',
      type:'line',
      source:'planner-orma-trails',
      minzoom:7,
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{
        'line-color':'#FFFDF7',
        'line-width':['interpolate',['linear'],['zoom'],7,5,10,8,13,10],
        'line-opacity':.92,
      },
    }, beforeId);
    map.addLayer({
      id:'planner-orma-trails-line',
      type:'line',
      source:'planner-orma-trails',
      minzoom:7,
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{
        'line-color':'#3E7A91',
        'line-width':['interpolate',['linear'],['zoom'],7,2,10,4.5,13,6],
        'line-opacity':.94,
      },
    }, beforeId);
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
    switcher.setAttribute('aria-label', 'Map style');
    switcher.innerHTML = '<button type="button" data-maplayer="map" class="on" aria-pressed="true">Map</button>' +
      '<button type="button" data-maplayer="satellite" aria-pressed="false">Satellite</button>' +
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
    distance.textContent = preview ? formatDistance(preview.distanceM) : '—';
    pointCount.textContent = `${points.length} / ${MAX_POINTS}`;
    undoButton.disabled = busy || !points.length;
    resetButton.disabled = busy || !points.length;
    closeButton.disabled = busy || points.length < MIN_LOOP_POINTS || !preview || preview.closed;
    saveButton.disabled = busy || !preview || !preview.closed;
    pointList.replaceChildren();
    points.forEach((point, index) => {
      const item = document.createElement('li');
      item.textContent = index === 0 ? 'Start' : `Point ${index + 1}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${index === 0 ? 'start' : `point ${index + 1}`}`);
      remove.disabled = busy;
      remove.addEventListener('click', () => {
        points.splice(index, 1);
        preview = null;
        selectedCoverage = points[0] ? coverageFor(points[0]) : null;
        drawMarkers();
        drawPath([]);
        recalculate(false);
      });
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
    if(error && error.code === 'network') return 'The live walking network is unavailable and the local fallback could not connect those points. Try again shortly.';
    return 'No mapped walking route connects those points. Undo the last point and choose a nearby path.';
  }

  async function recalculate(closeRequested){
    const version = ++calculationVersion;
    if(points.length < 2){
      preview = null;
      busy = false;
      status.textContent = points.length ? 'Choose another must-pass point.' : 'Tap the map to choose your start.';
      drawPath([]);
      render();
      return;
    }
    busy = true;
    status.textContent = closeRequested ? 'Closing the draft on mapped walking paths…' : 'Connecting your selected points…';
    render();

    let result = null;
    let routeFailure = null;
    try{
      result = await walkingRouter.route(points, {
        closeLoop:closeRequested,
        maxDistanceM:MAX_ROUTE_DISTANCE_M,
        timeoutMs:20000,
      });
    }catch(error){
      routeFailure = error;
      result = await localFallback(closeRequested);
    }
    if(version !== calculationVersion) return;
    busy = false;
    preview = result;
    drawPath(result ? result.path : []);
    status.textContent = result
      ? (result.closed
        ? 'Draft ready. Check signs, access and current conditions before using it.'
        : points.length < MIN_LOOP_POINTS
          ? 'Preview ready. Add another must-pass point.'
          : points.length < MAX_POINTS
            ? 'Preview ready. Close the loop now or add another must-pass point.'
            : 'Eight points selected. Close the loop when the shape looks right.')
      : failureMessage(routeFailure);
    render();
  }

  function reset(){
    calculationVersion += 1;
    points = [];
    preview = null;
    selectedCoverage = null;
    editingId = null;
    busy = false;
    drawMarkers();
    drawPath([]);
    status.textContent = 'Tap the map to choose your start.';
    render();
  }

  function restore(record){
    editingId = record.id;
    points = record.points.map(point => ({ ...point }));
    const match = entries().find(([id, entry]) => id === record.coverageId || entry.graphUrl === record.graphUrl);
    selectedCoverage = match ? { id:match[0], ...match[1] } : coverageFor(points[0]);
    preview = {
      distanceM:record.distanceM,
      path:record.path.map(point => ({ lat:point[0], lng:point[1] })),
      closed:true,
      source:record.source,
    };
    drawMarkers();
    drawPath(preview.path);
    const bounds = new maplibregl.LngLatBounds();
    preview.path.forEach(point => bounds.extend([point.lng, point.lat]));
    map.fitBounds(bounds, { padding:70, maxZoom:15 });
    status.textContent = 'Saved draft reopened. Check signs, access and current conditions before using it.';
    render();
  }

  map.on('click', event => {
    if(busy || (preview && preview.closed) || points.length >= MAX_POINTS) return;
    const point = { lat:event.lngLat.lat, lng:event.lngLat.lng };
    if(!points.length) selectedCoverage = coverageFor(point);
    points.push(point);
    drawMarkers();
    recalculate(false);
  });

  undoButton.addEventListener('click', () => {
    if(preview && preview.closed){ preview = null; recalculate(false); return; }
    points.pop();
    selectedCoverage = points[0] ? coverageFor(points[0]) : null;
    drawMarkers();
    recalculate(false);
  });
  resetButton.addEventListener('click', reset);
  closeButton.addEventListener('click', () => recalculate(true));
  saveButton.addEventListener('click', () => {
    if(!preview || !preview.closed) return;
    const now = new Date().toISOString();
    const record = drafts.save({
      id:editingId || `loop-${Date.now()}`,
      name:`Draft loop · ${formatDistance(preview.distanceM)}`,
      createdAt:now,
      updatedAt:now,
      graphUrl:selectedCoverage ? selectedCoverage.graphUrl : '',
      coverageId:selectedCoverage ? selectedCoverage.id : '',
      source:preview.source,
      distanceM:preview.distanceM,
      points,
      path:preview.path.map(point => [point.lat, point.lng]),
    });
    if(record){
      editingId = record.id;
      status.textContent = 'Draft saved on this device. You can reopen it from Saved → My routes.';
      savedLink.hidden = false;
    }else status.textContent = 'This browser could not save the draft.';
  });

  layersButton.addEventListener('click', () => {
    const open = layersPanel.hidden;
    layersPanel.hidden = !open;
    layersButton.setAttribute('aria-expanded', String(open));
    layersButton.textContent = open ? 'Close layers' : 'Layers';
  });
  markedRoutesButton.addEventListener('click', () => {
    const enabled = markedRoutesButton.getAttribute('aria-pressed') !== 'true';
    markedRoutesButton.setAttribute('aria-pressed', String(enabled));
    if(map.getLayer('planner-waymarked-hiking-layer')){
      map.setLayoutProperty('planner-waymarked-hiking-layer', 'visibility', enabled ? 'visible' : 'none');
    }
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
        status.textContent = 'That map layer could not be loaded. Your draft route is unchanged.';
      }finally{
        button.disabled = false;
      }
    });
  });
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && !layersPanel.hidden){
      layersPanel.hidden = true;
      layersButton.textContent = 'Layers';
      layersButton.setAttribute('aria-expanded', 'false');
      layersButton.focus();
    }
  });

  map.on('load', () => {
    addPlannerMapContext();
    buildMapStyleSwitch();
    collapseAttribution();
    map.getCanvas().style.cursor = 'crosshair';
    const id = new URLSearchParams(location.search).get('route');
    const record = id ? drafts.find(id) : null;
    if(record) restore(record);
    else render();
  });
})();
