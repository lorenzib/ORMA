(function(){
  'use strict';

  const coverage = window.DoloPawsTrailRoutingCoverage;
  const router = window.DoloPawsFootpathRouter;
  const drafts = window.DoloPawsRouteDrafts;
  const mapElement = document.getElementById('routePlannerMap');
  if(!coverage || !router || !drafts || !mapElement || typeof maplibregl === 'undefined') return;

  const status = document.getElementById('plannerStatus');
  const distance = document.getElementById('plannerDistance');
  const pointCount = document.getElementById('plannerPointCount');
  const pointList = document.getElementById('plannerPointList');
  const undoButton = document.getElementById('plannerUndo');
  const resetButton = document.getElementById('plannerReset');
  const closeButton = document.getElementById('plannerClose');
  const saveButton = document.getElementById('plannerSave');
  const locationButton = document.getElementById('plannerLocation');
  const savedLink = document.getElementById('plannerSavedLink');
  const MIN_LOOP_POINTS = 3;
  const MAX_POINTS = 8;
  const graphCache = new Map();
  let points = [];
  let markers = [];
  let preview = null;
  let selectedCoverage = null;
  let busy = false;
  let calculationVersion = 0;
  let editingId = null;

  const map = new maplibregl.Map({
    container:mapElement,
    style:'https://tiles.openfreemap.org/styles/liberty',
    center:[11.85, 46.55],
    zoom:8.4,
    attributionControl:{ compact:true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right');

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

  function coverageFor(point){
    const candidates = entries().filter(([, entry]) => contains(entry, point));
    candidates.sort((first, second) => area(first[1]) - area(second[1]));
    return candidates[0] ? { id:candidates[0][0], ...candidates[0][1] } : null;
  }

  function loadGraph(entry){
    if(!entry) return Promise.resolve(null);
    if(!graphCache.has(entry.graphUrl)){
      graphCache.set(entry.graphUrl, fetch(entry.graphUrl, { credentials:'same-origin' })
        .then(response => response.ok ? response.json() : null)
        .then(graph => router.validateGraph(graph) ? graph : null)
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
    map.addSource('draft-route', { type:'geojson', data });
    map.addLayer({ id:'draft-route-case', type:'line', source:'draft-route', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#fff','line-width':10,'line-opacity':.9} });
    map.addLayer({ id:'draft-route-line', type:'line', source:'draft-route', layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#2E684F','line-width':6,'line-opacity':.98} });
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
      remove.addEventListener('click', () => { points.splice(index, 1); preview = null; drawMarkers(); drawPath([]); recalculate(false); });
      item.append(remove);
      pointList.append(item);
    });
  }

  async function recalculate(closeRequested){
    const version = ++calculationVersion;
    if(points.length < 2){
      preview = null;
      status.textContent = points.length ? 'Choose another must-pass point inside the same supported area.' : 'Tap a supported area on the map to choose your start.';
      drawPath([]);
      render();
      return;
    }
    busy = true;
    status.textContent = closeRequested ? 'Closing the draft on mapped walking paths…' : 'Connecting your selected points…';
    render();
    const graph = await loadGraph(selectedCoverage);
    if(version !== calculationVersion) return;
    const options = { maxPoints:MAX_POINTS, maxLegDistanceM:5000, maxTotalDistanceM:10000, maxSnapDistanceM:90, maxTargetSnapDistanceM:90 };
    const result = graph ? (closeRequested ? router.routeLoop(points, graph, options) : router.routeThroughPoints(points, graph, options)) : null;
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
      : 'Those points could not be connected within the supported walking network. Undo and choose closer paths.';
    render();
  }

  function reset(){
    calculationVersion += 1;
    points = [];
    preview = null;
    selectedCoverage = null;
    editingId = null;
    drawMarkers();
    drawPath([]);
    status.textContent = 'Tap a supported area on the map to choose your start.';
    render();
  }

  function restore(record){
    editingId = record.id;
    points = record.points.map(point => ({ ...point }));
    selectedCoverage = entries().find(([id, entry]) => id === record.coverageId || entry.graphUrl === record.graphUrl);
    selectedCoverage = selectedCoverage ? { id:selectedCoverage[0], ...selectedCoverage[1] } : coverageFor(points[0]);
    preview = { distanceM:record.distanceM, path:record.path.map(point => ({ lat:point[0], lng:point[1] })), closed:true, source:record.source };
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
    const candidate = selectedCoverage && contains(selectedCoverage, point)
      ? selectedCoverage
      : coverageFor(point);
    if(!candidate){ status.textContent = 'Route drafting is not supported at this location yet.'; return; }
    if(selectedCoverage && !contains(selectedCoverage, point)){
      status.textContent = 'Keep all points inside the same supported planning area.';
      return;
    }
    selectedCoverage = selectedCoverage || candidate;
    points.push(point);
    drawMarkers();
    recalculate(false);
  });

  undoButton.addEventListener('click', () => {
    if(preview && preview.closed){ preview = null; recalculate(false); return; }
    points.pop(); drawMarkers(); recalculate(false);
  });
  resetButton.addEventListener('click', reset);
  closeButton.addEventListener('click', () => recalculate(true));
  saveButton.addEventListener('click', () => {
    if(!preview || !preview.closed || !selectedCoverage) return;
    const now = new Date().toISOString();
    const record = drafts.save({
      id:editingId || `loop-${Date.now()}`,
      name:`Draft loop · ${formatDistance(preview.distanceM)}`,
      createdAt:now,
      updatedAt:now,
      graphUrl:selectedCoverage.graphUrl,
      coverageId:selectedCoverage.id,
      source:preview.source,
      distanceM:preview.distanceM,
      points,
      path:preview.path.map(point => [point.lat, point.lng]),
    });
    if(record){ editingId = record.id; status.textContent = 'Draft saved on this device. You can reopen it from Saved → My routes.'; savedLink.hidden = false; }
    else status.textContent = 'This browser could not save the draft.';
  });
  locationButton.addEventListener('click', () => {
    if(!navigator.geolocation){ status.textContent = 'Location is unavailable in this browser.'; return; }
    locationButton.disabled = true;
    navigator.geolocation.getCurrentPosition(position => {
      locationButton.disabled = false;
      map.flyTo({ center:[position.coords.longitude, position.coords.latitude], zoom:14 });
    }, () => { locationButton.disabled = false; status.textContent = 'Location permission was not available. Move the map manually.'; }, { enableHighAccuracy:true, timeout:10000 });
  });

  map.on('load', () => {
    const id = new URLSearchParams(location.search).get('route');
    const record = id ? drafts.find(id) : null;
    if(record) restore(record);
    else render();
  });
})();
