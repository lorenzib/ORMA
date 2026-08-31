function safetyLabel(level){
  if(level === 'low-risk') return t('safety.low');
  if(level === 'moderate') return t('safety.moderate');
  return t('safety.caution');
}
function trailSafetyLabel(trail){
  const base = safetyLabel(trail.safetyLevel);
  return window.DoloPawsTrailTrust ? window.DoloPawsTrailTrust.riskLabel(trail, base) : base;
}
function safetyColor(level){
  if(level === 'low-risk') return '#2C5C34';
  if(level === 'moderate') return '#8A5A16';
  return '#9C3A25';
}

function safetyClass(level){
  if(level === 'low-risk') return 'safety-low';
  if(level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}
function trailProductBadge(type, label){
  if(window.DoloPawsIcons) return window.DoloPawsIcons.badgeHtml(type, label);
  return `<span class="dp-badge dp-badge--${type}"><span>${label}</span></span>`;
}
function trailProductIcon(type, size = 16){
  return window.DoloPawsIcons ? window.DoloPawsIcons.renderIconSvg(type, { mode:'inline', color:'currentColor', size }) : '';
}
function withoutLeadingSymbol(label){
  return String(label || '').replace(/^[^\p{L}\p{N}]+/u, '');
}
function trustedWaterLabel(trail, label){
  return window.DoloPawsTrailTrust ? window.DoloPawsTrailTrust.waterPointLabel(trail, label) : label;
}
function trustedStartLabel(trail, label){
  return window.DoloPawsTrailTrust ? window.DoloPawsTrailTrust.startPointLabel(trail, label) : label;
}

function renderTrailDetailContent(t){
  const rifugi = Array.isArray(t.rifugi) ? t.rifugi : [];
  const water = Array.isArray(t.waterSources) ? t.waterSources : [];

  const rifugiHtml = rifugi.length > 0
    ? `<ul style="margin:0 0 14px;padding-left:18px;">${rifugi.map(r => `<li>Km ${r.km} — ${r.name}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 14px;">${window.t('trail.noRifugi')}</p>`;

  const waterHtml = water.length > 0
    ? `<ul style="margin:0 0 8px;padding-left:18px;">${water.map(w => `<li>Km ${w.km} — ${trustedWaterLabel(t, w.label)}</li>`).join('')}</ul>` +
      (t.curated === false ? '<p style="margin:0 0 14px;font-size:12px;color:var(--ink-soft);">Availability can change. Carry a backup supply.</p>' : '')
    : `<p style="margin:0 0 14px;">${window.t('trail.noWater')}</p>`;

  return `
    <div style="margin-bottom:14px;">
      <div class="dp-inline-status" style="font-weight:700;color:var(--ink);margin-bottom:4px;">${trailProductIcon('hut')}<span>${withoutLeadingSymbol(window.t('trail.rifugiHead'))}</span></div>
      ${rifugiHtml}
    </div>
    <div style="margin-bottom:14px;">
      <div class="dp-inline-status" style="font-weight:700;color:var(--ink);margin-bottom:4px;">${trailProductIcon('water')}<span>${withoutLeadingSymbol(window.t('trail.waterHead'))}</span></div>
      ${waterHtml}
    </div>
  `;
}

function distMeters(a, b){
  return Math.hypot(a[0]-b[0], a[1]-b[1]) * 111000;
}

function mapDistanceKm(a, b){
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const lat1 = a[0] * rad;
  const lat2 = b[0] * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function formatApproachDistance(distanceKm){
  if(!Number.isFinite(distanceKm)) return '';
  if(distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 1000 / 10) * 10)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

function initNearestTrailDirections(map, t){
  const button = document.getElementById('mapNearestDirectionsBtn');
  const panel = document.getElementById('mapNearestDirectionsPanel');
  const status = document.getElementById('mapNearestDirectionsStatus');
  const stepsWrap = document.getElementById('mapNearestDirectionsStepsWrap');
  const stepsList = document.getElementById('mapNearestDirectionsSteps');
  const routePointToggle = document.getElementById('routePointToggle');
  const mapBox = document.getElementById('trailMapBox');
  if(!button || !panel || !status || !Array.isArray(t.path) || !t.path.length ||
     !window.DoloPawsTrailAccess || !window.DoloPawsFootpathRouter) return;

  const defaultLabel = 'Find a walking route';
  const coverage = window.DoloPawsTrailRoutingCoverage;
  const coverageEntry = coverage && coverage.trails ? coverage.trails[t.id] : null;
  const coverageEntries = coverage && coverage.trails
    ? Object.values(coverage.trails).filter(entry => entry && entry.graphUrl && entry.bounds)
    : [];
  let activePlan = null;
  const graphPromises = new Map();
  let originMarker = null;
  let targetMarker = null;
  let pointPickMode = false;
  button.hidden = false;

  function setButtonLabel(label){
    const labelNode = button.querySelector('span');
    if(labelNode) labelNode.textContent = label;
  }

  function markerElement(type){
    const element = document.createElement('span');
    element.className = `map-access-marker map-access-marker--${type}`;
    element.setAttribute('aria-hidden', 'true');
    return element;
  }

  function setPanelMessage(message){
    panel.hidden = !message;
    status.textContent = message || '';
  }

  function clearSteps(){
    if(stepsWrap) stepsWrap.hidden = true;
    if(stepsList) stepsList.replaceChildren();
  }

  function renderSteps(instructions){
    clearSteps();
    if(!stepsWrap || !stepsList || !Array.isArray(instructions) || !instructions.length) return;
    instructions.slice(0, 12).forEach(step => {
      const item = document.createElement('li');
      const distance = step.distanceM > 0
        ? ` for ${formatApproachDistance(step.distanceM / 1000)}`
        : '';
      item.textContent = `${step.action}${distance}`;
      stepsList.appendChild(item);
    });
    stepsWrap.hidden = false;
  }

  function loadRoutingGraph(entry){
    const selectedEntry = entry || coverageEntry;
    if(!selectedEntry || !selectedEntry.graphUrl) return Promise.resolve(null);
    if(!graphPromises.has(selectedEntry.graphUrl)){
      graphPromises.set(selectedEntry.graphUrl, fetch(selectedEntry.graphUrl, { credentials:'same-origin' })
        .then(response => {
          if(!response.ok) throw new Error(`routing-graph-${response.status}`);
          return response.json();
        })
        .then(graph => window.DoloPawsFootpathRouter.validateGraph(graph) ? graph : null)
        .catch(() => null));
    }
    return graphPromises.get(selectedEntry.graphUrl);
  }

  function boundsContainPoint(bounds, point){
    return bounds && point &&
      point.lat >= bounds.south && point.lat <= bounds.north &&
      point.lng >= bounds.west && point.lng <= bounds.east;
  }

  function routingEntriesForPoint(point, origin){
    const candidates = coverageEntries
      .filter(entry => boundsContainPoint(entry.bounds, point) && boundsContainPoint(entry.bounds, origin))
      .sort((first, second) => {
        if(first === coverageEntry) return -1;
        if(second === coverageEntry) return 1;
        const firstArea = (first.bounds.north - first.bounds.south) * (first.bounds.east - first.bounds.west);
        const secondArea = (second.bounds.north - second.bounds.south) * (second.bounds.east - second.bounds.west);
        return firstArea - secondArea;
      });
    return candidates.filter((entry, index) =>
      candidates.findIndex(candidate => candidate.graphUrl === entry.graphUrl) === index);
  }

  function setPointPickMode(enabled){
    pointPickMode = enabled;
    if(routePointToggle){
      routePointToggle.classList.toggle('on', enabled);
      routePointToggle.setAttribute('aria-pressed', String(enabled));
      routePointToggle.textContent = enabled ? 'Tap a mapped route…' : 'Route to a mapped point';
    }
    if(mapBox) mapBox.classList.toggle('route-pick-mode', enabled);
  }

  function removeMappedRoute(){
    if(!map.isStyleLoaded() || !map.getSource('trail-access-route')) return;
    map.getSource('trail-access-route').setData({ type:'FeatureCollection', features:[] });
  }

  function drawMappedRoute(path){
    if(!map.isStyleLoaded() || !Array.isArray(path) || path.length < 2) return;
    const data = {
      type:'Feature',
      properties:{ mode:'mapped-footpath' },
      geometry:{ type:'LineString', coordinates:path.map(point => [point.lng, point.lat]) },
    };
    const source = map.getSource('trail-access-route');
    if(source){
      source.setData(data);
      return;
    }
    map.addSource('trail-access-route', { type:'geojson', data });
    map.addLayer({
      id:'trail-access-route-casing',
      type:'line',
      source:'trail-access-route',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#ffffff', 'line-width':8, 'line-opacity':0.92 },
    });
    map.addLayer({
      id:'trail-access-route-line',
      type:'line',
      source:'trail-access-route',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#3E7A91', 'line-width':5, 'line-opacity':0.96 },
    });
  }

  function showPlan(plan, mapped){
    if(originMarker) originMarker.remove();
    originMarker = new maplibregl.Marker({ element:markerElement('you') })
      .setLngLat([plan.origin.lng, plan.origin.lat])
      .addTo(map);
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([plan.origin.lng, plan.origin.lat]);
    if(mapped && Array.isArray(plan.path)){
      drawMappedRoute(plan.path);
      plan.path.forEach(point => bounds.extend([point.lng, point.lat]));
    } else {
      removeMappedRoute();
      bounds.extend([plan.target.lng, plan.target.lat]);
    }
    if(targetMarker) targetMarker.remove();
    if(plan.mode === 'mapped-point' || plan.mode === 'external-point'){
      targetMarker = new maplibregl.Marker({ element:markerElement('target') })
        .setLngLat([plan.target.lng, plan.target.lat])
        .addTo(map);
    }
    map.fitBounds(bounds, { padding:70, maxZoom:16, duration:700 });
  }

  async function routeToSelectedPoint(target){
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    clearSteps();
    setPanelMessage('Connecting your location to the selected mapped route…');
    try{
      const origin = await window.DoloPawsTrailAccess.currentPosition(navigator);
      if(Number.isFinite(origin.accuracyM) && origin.accuracyM > window.DoloPawsTrailAccess.MAX_GPS_ACCURACY_M){
        setPanelMessage(`Your location is only accurate to about ${Math.round(origin.accuracyM)} m. Move into a clearer area and try again.`);
        setButtonLabel('Try location again');
        return;
      }
      const entries = routingEntriesForPoint(target, origin);
      let plan = null;
      for(const entry of entries){
        const graph = await loadRoutingGraph(entry);
        plan = await window.DoloPawsTrailAccess.planMappedPoint(
          navigator,
          target,
          graph,
          window.DoloPawsFootpathRouter,
          navigator.userAgent,
          { origin, maxRouteDistanceM:5000, maxFallbackDistanceKm:5 }
        );
        if(plan.mode === 'mapped-point') break;
      }
      if(!plan){
        plan = await window.DoloPawsTrailAccess.planMappedPoint(
          navigator,
          target,
          null,
          window.DoloPawsFootpathRouter,
          navigator.userAgent,
          { origin, maxRouteDistanceM:5000, maxFallbackDistanceKm:5 }
        );
      }
      activePlan = plan;
      if(plan.mode === 'mapped-point'){
        showPlan(plan, true);
        renderSteps(plan.instructions);
        const targetSnap = plan.targetSnapDistanceM > 20
          ? ` The selected point was snapped ${formatApproachDistance(plan.targetSnapDistanceM / 1000)} to a connected path.`
          : '';
        setPanelMessage(`Mapped walking route · ${formatApproachDistance(plan.distanceKm)} to the selected route point.${targetSnap} Check local signs and temporary closures.`);
        setButtonLabel(defaultLabel);
        return;
      }
      if(plan.mode === 'external-point' && plan.allowed){
        showPlan(plan, false);
        setPanelMessage('This selected point is not connected to ORMA’s current walking graph. Your maps app can calculate the approach instead.');
        setButtonLabel('Open directions to selected point');
        return;
      }
      setPanelMessage('That point is outside ORMA’s current walking coverage. Choose a closer mapped route point.');
      setButtonLabel(defaultLabel);
    }catch(error){
      setPanelMessage('We could not calculate a route to that point. Check your location signal and try again.');
      setButtonLabel(defaultLabel);
    }finally{
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  if(routePointToggle){
    routePointToggle.addEventListener('click', event => {
      event.stopPropagation();
      const enabled = !pointPickMode;
      setPointPickMode(enabled);
      if(enabled){
        clearSteps();
        setPanelMessage('Tap the mapped trail or footpath you want to reach. ORMA will use connected walking paths where coverage is available.');
        const layersButton = document.getElementById('detailLayersBtn');
        if(layersButton && layersButton.getAttribute('aria-expanded') === 'true') layersButton.click();
      }
    });
    map.on('click', event => {
      if(!pointPickMode) return;
      setPointPickMode(false);
      routeToSelectedPoint({ lat:event.lngLat.lat, lng:event.lngLat.lng });
    });
  }

  button.addEventListener('click', async () => {
    if(activePlan && activePlan.url){
      window.open(activePlan.url, '_blank', 'noopener');
      return;
    }

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setButtonLabel('Finding a safe route…');
    clearSteps();
    setPanelMessage('Checking your location against mapped walking paths…');
    try{
      const graph = await loadRoutingGraph();
      const plan = await window.DoloPawsTrailAccess.planTrailEntry(
        navigator,
        t,
        graph,
        window.DoloPawsFootpathRouter,
        navigator.userAgent,
        { maxRouteDistanceM:5000, maxFallbackDistanceKm:5 }
      );
      if(plan.mode === 'unreliable-location'){
        setPanelMessage(`Your location is only accurate to about ${Math.round(plan.accuracyM)} m. Move into a clearer area and try again.`);
        setButtonLabel('Try location again');
        return;
      }
      if(plan.mode === 'mapped-footpath'){
        activePlan = plan;
        showPlan(plan, true);
        renderSteps(plan.instructions);
        const snapNote = plan.snapDistanceM > 20
          ? ` Your GPS is about ${formatApproachDistance(plan.snapDistanceM / 1000)} from the mapped path.`
          : '';
        setPanelMessage(`Mapped footpath route · ${formatApproachDistance(plan.distanceKm)} to the trail.${snapNote} Check local signs and temporary closures.`);
        setButtonLabel('Refresh walking route');
        return;
      }
      if(plan.mode === 'nearest-route'){
        activePlan = plan;
        showPlan(plan, false);
        const distanceM = plan.distanceKm * 1000;
        const overlapsFix = Number.isFinite(plan.accuracyM) && distanceM <= plan.accuracyM;
        setPanelMessage(overlapsFix
          ? 'Your location overlaps this trail. Open your maps app for the nearest mapped point, and check local signs before joining.'
          : `The nearest point on this trail is about ${formatApproachDistance(plan.distanceKm)} away. Your maps app will calculate the walk; check local signs and access before joining.`);
        setButtonLabel('Open directions to nearest trail point');
        return;
      }
      if(plan.mode === 'recommended-start' && plan.allowed){
        activePlan = plan;
        showPlan(plan, false);
        const startType = plan.targetKind === 'mapped-start' ? 'listed route start' : 'recommended start';
        setPanelMessage(`ORMA does not yet have a connected footpath network here. The ${startType} is about ${formatApproachDistance(plan.distanceKm)} away as the crow flies; your maps app will calculate the actual walk.`);
        setButtonLabel('Open directions to start');
        return;
      }
      if(plan.mode === 'recommended-start'){
        const startType = plan.targetKind === 'mapped-start' ? 'listed route start' : 'recommended start';
        setPanelMessage(`The ${startType} is about ${formatApproachDistance(plan.distanceKm)} away. Walking directions are available when you are within 5 km.`);
        setButtonLabel('Try location again');
        return;
      }
      setPanelMessage('ORMA cannot identify a reliable access point for this trail yet. Use the recommended starting-point information below the map.');
      setButtonLabel(defaultLabel);
    }catch(error){
      const denied = error && (error.code === 1 || error.message === 'geolocation-unavailable');
      setPanelMessage(denied
        ? 'Allow location access to find the nearest point on this trail.'
        : 'We could not get a reliable location. Check your signal and try again.');
      setButtonLabel(defaultLabel);
    }finally{
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
}

function sampledTrailPath(trail, maxPoints = 30){
  const path = Array.isArray(trail && trail.path) && trail.path.length
    ? trail.path
    : (trail && typeof trail.lat === 'number' && typeof trail.lng === 'number' ? [[trail.lat, trail.lng]] : []);
  if(path.length <= maxPoints) return path;
  const step = Math.ceil(path.length / maxPoints);
  const sampled = path.filter((_, index) => index % step === 0);
  if(sampled[sampled.length - 1] !== path[path.length - 1]) sampled.push(path[path.length - 1]);
  return sampled;
}

function nearbyTrailCandidates(currentTrail, allTrails, radiusKm = 25, limit = 5){
  const currentPath = sampledTrailPath(currentTrail);
  if(!currentPath.length) return [];
  return (allTrails || [])
    .filter(trail => trail && trail.id !== currentTrail.id && Array.isArray(trail.path) && trail.path.length > 1)
    .map(trail => {
      const candidatePath = sampledTrailPath(trail);
      let distanceKm = Infinity;
      let mapPoint = candidatePath[0];
      currentPath.forEach(currentPoint => candidatePath.forEach(candidatePoint => {
        const distance = mapDistanceKm(currentPoint, candidatePoint);
        if(distance < distanceKm){
          distanceKm = distance;
          mapPoint = candidatePoint;
        }
      }));
      return { trail, distanceKm, mapPoint };
    })
    .filter(item => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

// Finds the real point along an actual GPS path at a given fraction of its
// total length (0 = start, 1 = end). Used to place rifugi/water icons at
// their true position on the map, rather than guessing coordinates.
function pointAtFraction(path, fraction){
  const total = path.reduce((sum, p, i) => i === 0 ? 0 : sum + distMeters(path[i-1], p), 0);
  const target = total * Math.max(0, Math.min(1, fraction));
  let acc = 0;
  for(let i = 0; i < path.length - 1; i++){
    const seg = distMeters(path[i], path[i+1]);
    if(acc + seg >= target){
      const t = seg > 0 ? (target - acc) / seg : 0;
      return [
        path[i][0] + (path[i+1][0] - path[i][0]) * t,
        path[i][1] + (path[i+1][1] - path[i][1]) * t,
      ];
    }
    acc += seg;
  }
  return path[path.length - 1];
}

// Elevation profile chart with two-way hover sync: hovering the chart moves
// a cursor dot on the map; hovering near the route on the map highlights
// the matching point on the chart. Honest note on data granularity: this
// draws whatever is in t.elevationProfile — currently a sparse 5-6 point
// sample for hand-built trails, but it'll render just as correctly (and
// more smoothly) once a trail has real per-vertex elevation from the
// build-trail.mjs/build-route.mjs pipeline. The chart code doesn't care
// which source the numbers came from.
function setupElevationProfile(map, t){
  const panel = document.getElementById('tdElevationPanel');
  if(!Array.isArray(t.elevationProfile) || t.elevationProfile.length < 2 || !Array.isArray(t.path)){
    if(panel) panel.hidden = true;
    return;
  }

  const wrap = document.getElementById('elevationProfileWrap');
  const svg = document.getElementById('elevProf');
  const readout = document.getElementById('elevReadout');
  const liveReadout = document.getElementById('tdElevLive');
  const rangeReadout = document.getElementById('tdElevRange');
  wrap.hidden = false;

  const profile = t.elevationProfile; // [{km, elev}, ...]
  const totalKm = t.distance;
  const elevs = profile.map(p => p.elev);
  const eMin = Math.min(...elevs), eMax = Math.max(...elevs);
  if(rangeReadout) rangeReadout.textContent = `${Math.round(eMin)}–${Math.round(eMax)} m`;
  const startReadout = document.getElementById('tdElevStart');
  const highReadout = document.getElementById('tdElevHigh');
  const climbReadout = document.getElementById('tdElevClimb');
  const figures = document.getElementById('tdElevFigs');
  if(startReadout) startReadout.textContent = `${Math.round(profile[0].elev)} m`;
  if(highReadout) highReadout.textContent = `${Math.round(eMax)} m`;
  if(climbReadout) climbReadout.textContent = `${Math.round(Number(t.elevation) || 0)} m`;
  if(figures) figures.hidden = false;
  const VW = 1000, VH = 170, padL = 6, padR = 6, padT = 14, padB = 20;
  const x = km => padL + (km / totalKm) * (VW - padL - padR);
  const y = elev => padT + (1 - (elev - eMin) / ((eMax - eMin) || 1)) * (VH - padT - padB);

  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for(const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  let dLine = `M ${x(profile[0].km)} ${y(profile[0].elev)}`;
  profile.slice(1).forEach(p => { dLine += ` L ${x(p.km)} ${y(p.elev)}`; });
  const areaD = `${dLine} L ${x(profile[profile.length-1].km)} ${VH-padB} L ${x(profile[0].km)} ${VH-padB} Z`;
  svg.appendChild(mk('path', { d: areaD, fill: '#2E4034', opacity: '0.1' }));
  svg.appendChild(mk('path', { d: dLine, fill: 'none', stroke: '#2E4034', 'stroke-width': '2' }));

  [eMin, (eMin+eMax)/2, eMax].forEach(v => {
    svg.appendChild(mk('line', { x1: padL, x2: VW-padR, y1: y(v), y2: y(v), stroke: 'var(--paper-line)', 'stroke-width': '1' }));
    const label = mk('text', { x: padL+4, y: y(v)-3, 'font-size': '10', fill: 'var(--ink-soft)' });
    label.textContent = `${Math.round(v)} m`;
    svg.appendChild(label);
  });

  const cursorLine = mk('line', { y1: padT, y2: VH-padB, stroke: '#6FA8BE', 'stroke-width': '1.5', 'stroke-dasharray': '3 3', opacity: '0' });
  const cursorDot = mk('circle', { r: '4', fill: '#6FA8BE', stroke: '#fff', 'stroke-width': '1.5', opacity: '0' });
  svg.appendChild(cursorLine);
  svg.appendChild(cursorDot);

  // Map cursor marker
  map.addSource('elev-cursor', { type: 'geojson', data: { type: 'Point', coordinates: t.path[0].slice().reverse() } });
  map.addLayer({
    id: 'elev-cursor-layer', type: 'circle', source: 'elev-cursor',
    paint: { 'circle-radius': 6, 'circle-color': '#6FA8BE', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-opacity': 0 },
  });

  function highlightAtKm(km){
    cursorLine.setAttribute('x1', x(km)); cursorLine.setAttribute('x2', x(km)); cursorLine.setAttribute('opacity', '1');
    // interpolate elevation for a smooth readout even between sparse samples
    let elev = profile[0].elev;
    for(let i = 1; i < profile.length; i++){
      if(km <= profile[i].km){
        const span = profile[i].km - profile[i-1].km;
        const frac = span > 0 ? (km - profile[i-1].km) / span : 0;
        elev = profile[i-1].elev + (profile[i].elev - profile[i-1].elev) * frac;
        break;
      }
    }
    cursorDot.setAttribute('cx', x(km)); cursorDot.setAttribute('cy', y(elev)); cursorDot.setAttribute('opacity', '1');
    readout.textContent = `${km.toFixed(1)} km · ${Math.round(elev)} m`;
    if(liveReadout) liveReadout.textContent = `${km.toFixed(1)} km · ~${Math.round(elev)} m route elevation`;

    const [lat, lng] = pointAtFraction(t.path, totalKm > 0 ? km / totalKm : 0);
    const src = map.getSource('elev-cursor');
    if(src){ src.setData({ type: 'Point', coordinates: [lng, lat] }); map.setPaintProperty('elev-cursor-layer', 'circle-opacity', 1); }
  }

  // Let hike-mode.js drive the same cursor from live GPS position.
  window._dolopawsElevHighlight = highlightAtKm;

  svg.addEventListener('mousemove', (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = (ev.clientX - rect.left) / rect.width * VW;
    const km = Math.max(0, Math.min(totalKm, ((px - padL) / (VW - padL - padR)) * totalKm));
    highlightAtKm(km);
  });

  // Map -> chart: hovering near the route line highlights the matching point
  map.on('mousemove', (e) => {
    let bestKm = 0, bestDist = Infinity, acc = 0;
    for(let i = 0; i < t.path.length; i++){
      const d = distMeters([e.lngLat.lat, e.lngLat.lng], t.path[i]);
      if(d < bestDist){ bestDist = d; bestKm = (i / (t.path.length - 1)) * totalKm; }
    }
    if(bestDist < 80) highlightAtKm(bestKm); // only react when hovering near the actual route
  });
}

function makeIconEl(iconKey, bgColor){
  if(window.DoloPawsIcons) return window.DoloPawsIcons.createMarkerElement(iconKey, { color: bgColor });
  const fallback = document.createElement('div');
  fallback.className = 'dp-marker';
  fallback.style.background = bgColor;
  fallback.style.borderRadius = '50%';
  fallback.style.border = '2px solid #fff';
  fallback.textContent = '•';
  return fallback;
}

function addTerrainToggle(map, containerId, exaggeration, pitch3D, existingBtn){
  // With `existingBtn`, the toggle joins the Map · Satellite · 3D group.
  let btn = existingBtn || null;
  if(!btn){
    const container = document.getElementById(containerId);
    if(!container) return;
    container.style.position = container.style.position || 'relative';
    btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = window.t('trail.view3d');
    btn.className = 'map-btn map-btn--terrain';
    container.appendChild(btn);
  }

  let elevationVisible = false; // clean, flat, label-first map by default
  let flatCamera = null;
  btn.addEventListener('click', () => {
    if(!elevationVisible){
      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 12.25;
      flatCamera = {
        center: typeof map.getCenter === 'function' ? map.getCenter() : undefined,
        zoom: currentZoom,
        bearing: typeof map.getBearing === 'function' ? map.getBearing() : undefined,
      };
      map.setTerrain({ source: 'terrain-dem-3d', exaggeration });
      if(!map.getLayer('hillshade-layer')){
        const beforeLayer = map.getLayer('waymarked-hiking-layer')
          ? 'waymarked-hiking-layer'
          : (map.getStyle().layers.find(layer => layer.type === 'symbol') || {}).id;
        map.addLayer({
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'terrain-dem',
          paint: {
            'hillshade-method': 'igor',
            'hillshade-exaggeration': 0.22,
            'hillshade-shadow-color': '#81907f',
            'hillshade-highlight-color': '#fffdf6',
            'hillshade-accent-color': '#60705f',
          },
        }, beforeLayer); // keep hillshade below the trail overlay and labels
      }
      // At close trail-detail zooms the camera can sit below a 2,000–3,000 m
      // terrain surface, blanking the map. Pull back to a safe planning zoom.
      map.easeTo({ pitch: pitch3D, zoom: Math.min(currentZoom, 12.25), duration: 500 });
      if(existingBtn){ btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); }
      else btn.textContent = window.t('trail.viewFlat');
    } else {
      map.setTerrain(null);
      if(map.getLayer('hillshade-layer')) map.removeLayer('hillshade-layer');
      map.easeTo({
        pitch: 0,
        center: flatCamera && flatCamera.center,
        zoom: flatCamera && flatCamera.zoom,
        bearing: flatCamera && flatCamera.bearing,
        duration: 500,
      });
      if(existingBtn){ btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); }
      else btn.textContent = window.t('trail.view3d');
    }
    elevationVisible = !elevationVisible;
  });
}

function increaseLabelDensity(map){
  const layers = map.getStyle().layers || [];
  layers.forEach(layer => {
    if(layer.type !== 'symbol') return;
    const sl = layer['source-layer'];
    // Only boost PLACE names (towns, villages, hamlets) and mountain peaks:
    // clearing their minzoom makes them appear even when zoomed far out,
    // which is the effect that was actually wanted. Everything else (POI
    // icons, road names, house numbers) keeps the style's own collision
    // rules — forcing those all visible at once made town centers like
    // Canazei unreadably dense.
    if(sl !== 'place' && sl !== 'mountain_peak') return;
    try {
      map.setLayerZoomRange(layer.id, 0, 24);
      map.setLayoutProperty(layer.id, 'text-optional', true);
      // NOTE: deliberately NOT setting text-allow-overlap/icon-allow-overlap
      // anymore — that disabled collision detection entirely and was the
      // root cause of the overcrowded map. MapLibre's collision logic now
      // prunes overlapping labels automatically at every zoom.
    } catch(e) { /* some layers may not support one of these props — skip silently */ }
  });
}

function addTerrainSource(map){
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15,
  });
  // MapLibre renders more reliably when hillshade and 3D terrain do not
  // compete for the same raster-dem source.
  map.addSource('terrain-dem-3d', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15,
  });
}

// Always-on subtle relief, AllTrails-style: terrain reads at a glance even
// in flat mode. The 3D toggle's own stronger hillshade layers on top.
function addBaseHillshade(map, beforeId){
  if(map.getLayer('base-hillshade') || !map.getSource('terrain-dem')) return;
  map.addLayer({
    id: 'base-hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: {
      'hillshade-exaggeration': 0.25,
      'hillshade-shadow-color': '#5A5548',
      'hillshade-method': 'igor',
    },
  }, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
}

// Lifts on the trail detail map — ALL of them, same data as the homepage
// (the global `gondolas` array from trails-data.js). Lines and stations are
// GeoJSON layers rather than DOM markers, so rendering all ~700 lifts and
// ~1,400 stations costs nothing.
function escapeLiftPopupText(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g,
    char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function publicLiftNote(note){
  return escapeLiftPopupText(String(note || '')
    .replace(/Operating season not recorded\s*[—-]\s*check directly with the operator before planning around it\.\s*/gi, '')
    .replace(/Station order \(from\/to\) reflects raw OSM way direction, NOT independently verified against elevation\s*-\s*treat the endpoint labels as unconfirmed for this batch\.\s*/gi, '')
    .trim());
}

function renderAllLifts(map, options){
  if (typeof gondolas === 'undefined' || !Array.isArray(gondolas) || !gondolas.length) return;
  if (map.getSource('detail-gondolas')) return;
  const visibility = options && options.visible ? 'visible' : 'none';

  const lineFeatures = [], stationFeatures = [];
  gondolas.forEach(g => {
    if (!g.from || !g.to || typeof g.from.lat !== 'number' || typeof g.to.lat !== 'number') return;
    lineFeatures.push({
      type: 'Feature',
      properties: { name: g.name, note: g.note || '', status: g.status },
      geometry: { type: 'LineString', coordinates: [[g.from.lng, g.from.lat], [g.to.lng, g.to.lat]] },
    });
    [g.from, g.to].forEach(st => {
      stationFeatures.push({
        type: 'Feature',
        properties: { name: g.name, note: g.note || '' },
        geometry: { type: 'Point', coordinates: [st.lng, st.lat] },
      });
    });
  });

  map.addSource('detail-gondolas', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
  map.addLayer({
    id: 'detail-gondolas-line',
    type: 'line',
    source: 'detail-gondolas',
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility },
    paint: {
      'line-color': ['match', ['get', 'status'], 'summer', '#4E90A8', 'no-summer', '#9C3A25', '#5A5548'],
      'line-width': 1.5,
      'line-opacity': 0.9,
      'line-dasharray': ['match', ['get', 'status'], 'summer', ['literal', [1, 0]], ['literal', [2, 1]]],
    },
  });
  map.addSource('detail-gondola-stations', { type: 'geojson', data: { type: 'FeatureCollection', features: stationFeatures } });
  if(window.DoloPawsIcons){
    map.addLayer({
      id: 'detail-gondola-stations-layer',
      type: 'symbol',
      source: 'detail-gondola-stations',
      layout: {
        'icon-image': window.DoloPawsIcons.getMapImageName('lifts'),
        'icon-size': 1,
        visibility,
      },
    });
  } else {
    map.addLayer({
      id: 'detail-gondola-stations-layer',
      type: 'circle',
      source: 'detail-gondola-stations',
      layout: { visibility },
      paint: { 'circle-radius': 5, 'circle-color': '#4E90A8', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
    });
  }

  ['detail-gondolas-line', 'detail-gondola-stations-layer'].forEach(id => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    map.on('click', id, (e) => {
      const p = e.features[0].properties;
      const note = publicLiftNote(p.note);
      new maplibregl.Popup({ offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(`<b>🚡 ${escapeLiftPopupText(p.name)}</b>${note ? '<br>' + note : ''}`)
        .addTo(map);
    });
  });
}

// ============================================================
// IMPORTED CIRCUITS — start where you can actually park.
// OSM route relations have no official start point: the import stitches
// their segments into one line and begins wherever stitching happened to
// start, so a loop's km 0 can land mid-slope, far from any access.
// Before rendering, look up real amenity=parking spots around the route
// (Overpass, cached locally for 30 days) and rotate the loop so km 0
// sits at the path point nearest a parking area. Everything downstream —
// 🚩 flag, directions, arrows, weather anchor, hike mode — follows the
// rotated order automatically. Falls back silently to the imported order
// when no parking is close enough or the lookup fails or times out.
// ============================================================
const PARK_CACHE_TTL = 30 * 24 * 3600 * 1000;
const PARK_MAX_DIST_M = 350;      // parking must be this close to the route
const PARK_LOOKUP_WAIT_MS = 2800; // never block first paint longer than this

function isLoopPath(path){
  return Array.isArray(path) && path.length > 20 &&
    distMeters(path[0], path[path.length - 1]) < 250;
}

function fetchNearbyParking(path){
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  path.forEach(([lat, lng]) => {
    if(lat < minLat) minLat = lat;
    if(lat > maxLat) maxLat = lat;
    if(lng < minLng) minLng = lng;
    if(lng > maxLng) maxLng = lng;
  });
  const PAD = 0.008; // ~800 m beyond the route's bounding box
  const bbox = `${minLat - PAD},${minLng - PAD},${maxLat + PAD},${maxLng + PAD}`;
  const query = `[out:json][timeout:8];(node["amenity"="parking"](${bbox});way["amenity"="parking"](${bbox}););out center 60;`;
  const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const tryMirror = (i) => fetch(mirrors[i], {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
    .then(r => { if(!r.ok) throw new Error('overpass ' + r.status); return r.json(); })
    .catch(err => { if(i + 1 < mirrors.length) return tryMirror(i + 1); throw err; });
  return tryMirror(0).then(data => (data.elements || []).map(el => {
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lng = el.lon != null ? el.lon : (el.center && el.center.lon);
    return (lat == null || lng == null) ? null : { lat, lng, name: (el.tags && el.tags.name) || '' };
  }).filter(Boolean));
}

function nearestPathIndex(path, pt){
  let best = 0, bestD = Infinity;
  for(let i = 0; i < path.length; i++){
    const d = distMeters(path[i], [pt.lat, pt.lng]);
    if(d < bestD){ bestD = d; best = i; }
  }
  return { index: best, dist: bestD };
}

function applyLoopRotation(trail, rot){
  if(rot.index > 0){
    const path = trail.path;
    const closed = distMeters(path[0], path[path.length - 1]) < 30;
    const open = closed ? path.slice(0, -1) : path.slice();
    const rotated = open.slice(rot.index).concat(open.slice(0, rot.index));
    rotated.push(rotated[0].slice()); // close the loop at the new start
    trail.path = rotated;
  }
  trail.startPoint = {
    lat: trail.path[0][0],
    lng: trail.path[0][1],
    label: rot.name
      ? window.t('trail.startParkName', { name: rot.name })
      : window.t('trail.startParking'),
  };
  trail.lat = trail.path[0][0];
  trail.lng = trail.path[0][1];
}

function improveLoopStart(trail){
  if(!trail || trail.curated !== false || !isLoopPath(trail.path)) return Promise.resolve();
  const cacheKey = 'dolopaws-parkstart-' + trail.id;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if(cached && Date.now() - cached.at < PARK_CACHE_TTL){
      if(cached.rot) applyLoopRotation(trail, cached.rot);
      return Promise.resolve();
    }
  } catch (e) { /* unreadable cache — just refetch */ }

  const lookup = fetchNearbyParking(trail.path).then(parkings => {
    let best = null;
    parkings.forEach(p => {
      const near = nearestPathIndex(trail.path, p);
      if(near.dist <= PARK_MAX_DIST_M && (!best || near.dist < best.dist)){
        best = { index: near.index, dist: near.dist, name: p.name };
      }
    });
    const rot = best ? { index: best.index, name: best.name } : null;
    try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), rot })); } catch (e) {}
    return rot;
  }).catch(() => null);

  // Wait briefly; if Overpass is slow, render with the imported order now —
  // the lookup still finishes into the cache for the next visit.
  const timeout = new Promise(res => setTimeout(() => res('timeout'), PARK_LOOKUP_WAIT_MS));
  return Promise.race([lookup, timeout]).then(rot => {
    if(rot && rot !== 'timeout') applyLoopRotation(trail, rot);
  });
}


// ============================================================
// "FROM PARKING TO PAWS" — one named, km-ordered itinerary that
// replaces the separate directions/rifugi/water lists. Base steps
// (parking, start, decision points, finish) render immediately;
// named amenities from the OSM files arrive asynchronously via
// detail-pois.js callbacks and slot in by km.
// ============================================================
const itin = { trail: null, items: [], cumKm: null };

// Curated trail data stores labels in English; translate the known
// templates on the fly in Italian mode (same approach as imported descs).
function trLabel(label){
  if(!label || (window.DoloPawsI18n && window.DoloPawsI18n.lang) !== 'it') return label;
  const RULES = [
    [/^Start here — main parking area at (.+)$/, 'Parti qui — parcheggio principale a $1'],
    [/^Start here — main lake access & parking, by (.+)$/, 'Parti qui — accesso principale al lago e parcheggio, presso $1'],
    [/^Route start per OpenStreetMap — best parking\/access not yet verified$/, 'Inizio del percorso secondo OpenStreetMap — parcheggio/accesso migliore non ancora verificato'],
    [/^Lakeside fountain$/, 'Fontana in riva al lago'],
    [/^Trailhead fountain$/, 'Fontana alla partenza'],
    [/^Village fountain$/, 'Fontana del paese'],
    [/^Waterfall stream$/, 'Torrente della cascata'],
    [/^Stream crossing$/, 'Attraversamento del torrente'],
    [/^Drinking water \(OSM-verified location\)$/, 'Acqua potabile (posizione verificata su OSM)'],
    [/^Mountain\/upper station$/, 'Stazione a monte'],
    [/^Valley\/lower station$/, 'Stazione a valle'],
  ];
  for(const [re, out] of RULES){ if(re.test(label)) return label.replace(re, out); }
  return label;
}

function itinIcon(kind){
  const S = 'width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;"';
  if(kind === 'park') return `<svg ${S}><rect x="3" y="3" width="18" height="18" rx="5" fill="#378ADD"/><path d="M9 17V7h4a3.2 3.2 0 010 6.4H9" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if(kind === 'flag') return `<svg ${S}><path d="M7 21V4" stroke="#2E4034" stroke-width="2" stroke-linecap="round"/><path d="M7 5h10l-2.4 3.5L17 12H7z" fill="#E24B4A"/></svg>`;
  if(kind === 'food') return `<svg ${S}><path d="M5 9h11v6a4 4 0 01-4 4H9a4 4 0 01-4-4z" fill="#BA7517"/><path d="M16 10h1.6a2.2 2.2 0 010 4.4H16" fill="none" stroke="#BA7517" stroke-width="1.8"/><path d="M8.5 6.5c0-1 .8-1.4.8-2.3M12 6.5c0-1 .8-1.4.8-2.3" stroke="#BA7517" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`;
  if(kind === 'hut') return `<svg ${S}><path d="M4 11l8-7 8 7" fill="none" stroke="#8A5A16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9h12v-9" fill="#D6A038" stroke="#8A5A16" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 19v-5h4v5" fill="#8A5A16"/></svg>`;
  if(kind === 'water') return `<svg ${S}><path d="M12 3c3 3.6 4.8 6.3 4.8 8.8a4.8 4.8 0 11-9.6 0C7.2 9.3 9 6.6 12 3z" fill="#378ADD"/></svg>`;
  if(kind === 'switch') return `<svg ${S}><path d="M12 20v-8M12 12L6.5 6M12 12l5.5-6" fill="none" stroke="#7F77DD" stroke-width="2.2" stroke-linecap="round"/><circle cx="6.5" cy="6" r="1.7" fill="#7F77DD"/><circle cx="17.5" cy="6" r="1.7" fill="#AFA9EC"/></svg>`;
  if(kind === 'view') return `<svg ${S}><path d="M5 8h3l1.2-2h5.6L16 8h3v10H5z" fill="none" stroke="#28736B" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3" fill="none" stroke="#28736B" stroke-width="2"/></svg>`;
  if(kind === 'picnic') return `<svg ${S}><path d="M4 9.5h16M8 9.5 5.5 18M16 9.5l2.5 8.5M6.6 14.5h10.8" fill="none" stroke="#4E7256" stroke-width="2" stroke-linecap="round"/></svg>`;
  if(kind === 'sight') return `<svg ${S}><path d="M8 20V4.5" stroke="#5A5548" stroke-width="2" stroke-linecap="round"/><path d="M8 5.5h8.5l-2.1 3 2.1 3H8z" fill="#5A5548"/></svg>`;
  return `<svg ${S}><ellipse cx="12" cy="15.5" rx="4" ry="3.4" fill="#1D9E75"/><ellipse cx="7" cy="10.8" rx="1.5" ry="2" fill="#5DCAA5"/><ellipse cx="10.5" cy="8.6" rx="1.5" ry="2" fill="#5DCAA5"/><ellipse cx="14" cy="8.6" rx="1.5" ry="2" fill="#5DCAA5"/><ellipse cx="17.5" cy="10.8" rx="1.5" ry="2" fill="#5DCAA5"/></svg>`;
}

function itinCumKm(path){
  const cum = [0];
  for(let i = 1; i < path.length; i++) cum.push(cum[i-1] + distMeters(path[i-1], path[i]) / 1000);
  return cum;
}

function itinEsc(x){
  return String(x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function itinRender(){
  const box = document.getElementById('trailItinerary');
  if(!box || !itin.trail) return;
  const items = itin.items.slice().sort((a, b) => a.sort - b.sort);
  box.innerHTML = items.map(it =>
    `<div class="itin-row">${itinIcon(it.icon)}<span>${it.html}</span></div>`).join('');
}

function itinAdd(icon, sort, html){
  itin.items.push({ icon, sort, html });
}

function itinKmLabel(km){
  return `<b style="font-weight:700;">Km ${km % 1 === 0 ? km : km.toFixed(1)}</b>`;
}

function buildItinerary(t){
  itin.trail = t;
  itin.items = [];
  itin.cumKm = Array.isArray(t.path) && t.path.length > 1 ? itinCumKm(t.path) : null;
  const isLoop = Array.isArray(t.path) && t.path.length > 1
    && distMeters(t.path[0], t.path[t.path.length-1]) < 200;

  // 1. Parking / access — the named startPoint label plus a directions
  // link into whatever navigation app this device prefers: Apple Maps on
  // iOS/macOS, Google Maps elsewhere. Neutral label, destination pre-filled.
  const sp = t.startPoint || { lat: t.lat, lng: t.lng, label: '' };
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const mapsUrl = isApple
    ? `https://maps.apple.com/?daddr=${sp.lat},${sp.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${sp.lat},${sp.lng}`;
  const parkLabel = sp.label ? itinEsc(trLabel(trustedStartLabel(t, sp.label))) : window.t('trail.itinParkFallback');
  itinAdd('park', -2, `${parkLabel} · <a href="${mapsUrl}" target="_blank" rel="noopener">${window.t('trail.openMaps')}</a>`);

  // 2. The start flag.
  itinAdd('flag', -1, window.t('trail.itinStart'));

  // 3. Curated rifugi and water points (they carry real names + km).
  (Array.isArray(t.rifugi) ? t.rifugi : []).forEach(r => {
    if(r.km > 0) itinAdd('hut', r.km, `${itinKmLabel(r.km)} — ${itinEsc(r.name)}`);
  });
  (Array.isArray(t.waterSources) ? t.waterSources : []).forEach(w => {
    if(w.km > 0) itinAdd('water', w.km, `${itinKmLabel(w.km)} — ${itinEsc(trLabel(trustedWaterLabel(t, w.label)))}`);
  });

  // 4. Decision points — where the route switches numbered trails.
  (Array.isArray(t.decisionPoints) ? t.decisionPoints : []).forEach(d => {
    itinAdd('switch', d.km, `${itinKmLabel(d.km)} — ${itinEsc(d.instruction)}`);
  });

  // 5. Closing step.
  itinAdd('paw', 1e9, isLoop
    ? window.t('trail.itinLoopEnd', {d: t.distance})
    : window.t('trail.itinEnd', {d: t.distance}));

  itinRender();

  // 6. Named amenities from the OSM datasets, joined to their km on the
  // route (only places within ~120 m of the actual path).
  const MAX_OFF_M = 120;
  function kmOnPath(lat, lng){
    if(!itin.cumKm) return null;
    let best = -1, bestD = Infinity;
    for(let i = 0; i < t.path.length; i++){
      const d = distMeters(t.path[i], [lat, lng]);
      if(d < bestD){ bestD = d; best = i; }
    }
    return bestD <= MAX_OFF_M ? { km: itin.cumKm[best], off: bestD } : null;
  }
  const seen = new Set(itin.items.map(i => i.html.toLowerCase()));

  window.onDetailPoisReady = (features) => {
    let added = 0;
    (features || []).forEach(f => {
      if(added >= 4) return;
      const p = f.properties || {};
      if(!p.name) return;
      const [lng, lat] = f.geometry.coordinates;
      const hit = kmOnPath(lat, lng);
      if(!hit || hit.km <= 0.05) return;
      const nameKey = p.name.toLowerCase();
      if([...seen].some(h => h.includes(nameKey))) return;
      const isHut = p.tourism === 'alpine_hut' || p.tourism === 'wilderness_hut' || p.amenity === 'shelter';
      itinAdd(isHut ? 'hut' : 'food', hit.km, `${itinKmLabel(Math.round(hit.km*10)/10)} — ${itinEsc(p.name)}`);
      seen.add(nameKey);
      added++;
    });
    if(added) itinRender();
  };

  window.onDetailWaterReady = (features) => {
    // Only fill from OSM when the trail has no curated water list.
    if(Array.isArray(t.waterSources) && t.waterSources.length) return;
    let added = 0;
    (features || []).forEach(f => {
      if(added >= 2) return;
      const [lng, lat] = f.geometry.coordinates;
      const hit = kmOnPath(lat, lng);
      if(!hit || hit.km <= 0.05) return;
      const label = (f.properties && f.properties.name) ? f.properties.name : window.t('legend.water');
      itinAdd('water', hit.km, `${itinKmLabel(Math.round(hit.km*10)/10)} — ${itinEsc(label)}`);
      added++;
    });
    if(added) itinRender();
  };

  // Viewpoints, picnic spots and named sights from the trail-corridor
  // amenity sweep — a couple of each, placed at their km on the route.
  window.onDetailPlacesReady = (features) => {
    const plainT = (key, fb) => {
      if(!window.t) return fb;
      const v = window.t(key);
      return v === key ? fb : v;
    };
    const CAP = { viewpoint: 2, picnic: 2, sight: 2 };
    const added = { viewpoint: 0, picnic: 0, sight: 0 };
    let any = 0;
    (features || []).forEach(f => {
      const p = f.properties || {};
      const kind = p.kind;
      if(!(kind in CAP) || added[kind] >= CAP[kind]) return;
      if(kind === 'sight' && !p.name) return;   // unnamed crosses are noise
      const [lng, lat] = f.geometry.coordinates;
      const hit = kmOnPath(lat, lng);
      if(!hit || hit.km <= 0.05) return;
      const label = p.name
        || (kind === 'viewpoint' ? plainT('poi.viewpoint', 'Viewpoint') : plainT('poi.picnic', 'Picnic spot'));
      const nameKey = label.toLowerCase();
      if([...seen].some(h => h.includes(nameKey))) return;
      const icon = kind === 'viewpoint' ? 'view' : (kind === 'picnic' ? 'picnic' : 'sight');
      itinAdd(icon, hit.km, `${itinKmLabel(Math.round(hit.km*10)/10)} — ${itinEsc(label)}`);
      seen.add(nameKey);
      added[kind]++;
      any++;
    });
    if(any) itinRender();
  };
}

const params = new URLSearchParams(window.location.search);
const trailId = params.get('id');
const trailReturnTarget = params.get('from');
let pendingTrailAction = params.get('action');
let trailActionConsumed = false;

window.DoloPawsTrailAction = {
  request(action){
    const url = new URL(window.location.href);
    url.searchParams.set('action', action);
    window.history.replaceState(null, '', url.pathname.split('/').pop() + url.search + url.hash);
    pendingTrailAction = action;
    trailActionConsumed = false;
    if(window.DoloPawsGuestContext){
      window.DoloPawsGuestContext.captureCurrent(action, trailId);
    }
    if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openLogin();
  },
  consume(action){
    if(trailActionConsumed || pendingTrailAction !== action) return false;
    if(window.DoloPawsGuestContext){
      const context = window.DoloPawsGuestContext.consumeAction(
        window.localStorage,
        action,
        trailId
      );
      if(!context){
        trailActionConsumed = true;
        pendingTrailAction = null;
        const staleUrl = new URL(window.location.href);
        staleUrl.searchParams.delete('action');
        window.history.replaceState(
          null,
          '',
          staleUrl.pathname.split('/').pop() + staleUrl.search + staleUrl.hash
        );
        return false;
      }
    }
    trailActionConsumed = true;
    pendingTrailAction = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    window.history.replaceState(null, '', url.pathname.split('/').pop() + url.search + url.hash);
    return true;
  },
  get pending(){ return pendingTrailAction; },
};

function safeTrailReturn(value){
  if(!value || /^(?:[a-z]+:|\/\/|\/)/i.test(value)) return '';
  return /^(?:browse-trails|compare|saved|journal)\.html(?:\?[^#]*)?(?:#.*)?$/i.test(value) ? value : '';
}

let trailInitStarted = false;
function init(){
  if(trailInitStarted) return;
  trailInitStarted = true;
  if(window.DoloPawsRegions && typeof trails !== 'undefined') window.DoloPawsRegions.assign(trails);
  const trail = (typeof trails !== 'undefined') ? trails.find(x => x.id === trailId) : null;

  if(!trail){
    document.title = window.t('trail.notFound') + ' | ORMA';
    const wrap = document.querySelector('.td-wrap');
    if(wrap){
      wrap.innerHTML = `
        <div style="max-width:620px;margin:48px auto;text-align:center;">
          <h1>${window.t('trail.notFound')}</h1>
          <p style="margin:14px 0 24px;color:var(--ink-soft);">${window.t('trail.notFoundSub')}</p>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            <a class="auth-submit" href="browse-trails.html" style="display:inline-block;width:auto;padding:11px 22px;text-decoration:none;">Browse trails</a>
            <a class="fav-btn" href="/" style="display:inline-block;padding:11px 22px;text-decoration:none;">Go to homepage</a>
          </div>
        </div>`;
    }
    return;
  }

  // Imported circuits: settle the real-world start FIRST, so every consumer
  // below (map, flag, directions, weather, hike mode) sees the same km 0.
  improveLoopStart(trail).then(() => renderTrail(trail), () => renderTrail(trail));
}

function renderTrail(t){
  if(window.ORMA_VeterinaryCare) window.ORMA_VeterinaryCare.init(t);
  if(window.DoloPawsMetricFunnel){
    const profilePresent = (() => {
      try{ return !!JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null'); }
      catch(error){ return false; }
    })();
    const decisionProperties = {
      trailId:t.id,
      verificationStatus:t.curated === false ? 'estimated' : 'dolopaws_vetted',
      warningCount:Array.isArray(t.surfaceHazards) ? t.surfaceHazards.length : 0,
      profilePresent,
    };
    window.DoloPawsMetricFunnel.recordOnce(
      'trail-opened', t.id, 'trail_decision', 'opened', decisionProperties
    );
    window.DoloPawsMetricFunnel.recordOnce(
      'explanation-viewed', t.id, 'trail_decision', 'explanation_viewed', decisionProperties
    );
  }
  buildItinerary(t);
  const hasRoutePath = Array.isArray(t.path) && t.path.length > 1;
  const routeDataNotice = document.getElementById('routeDataNotice');
  if(routeDataNotice){
    routeDataNotice.hidden = hasRoutePath;
    routeDataNotice.textContent = window.t('trail.routeUnavailable');
  }
  const breadcrumb = document.getElementById('tdBreadcrumb');
  const returnTarget = safeTrailReturn(trailReturnTarget);
  if(breadcrumb && returnTarget){
    breadcrumb.href = returnTarget;
    breadcrumb.textContent = returnTarget.startsWith('saved.html') ? '← Back to saved trails'
      : returnTarget.startsWith('journal.html') ? '← Back to journal'
      : returnTarget.startsWith('compare.html') ? '← Back to comparison'
      : '← Back to trail results';
  }
  const logWalkBtn = document.getElementById('logWalkBtn');
  if(logWalkBtn){
    const journalReturn = encodeURIComponent(`trail.html?id=${encodeURIComponent(t.id)}`);
    logWalkBtn.href = `journal.html?trail=${encodeURIComponent(t.id)}&from=${journalReturn}`;
  }
  // Do not reserve an empty elevation panel for routes without profile data.
  const elevationCard = document.getElementById('tdElevationPanel');
  const hasElevationProfile = Array.isArray(t.elevationProfile) && t.elevationProfile.length > 1;
  if(elevationCard){
    elevationCard.hidden = !hasElevationProfile;
    const experienceGrid = elevationCard.closest('.trail-experience-grid');
    if(experienceGrid) experienceGrid.classList.toggle('trail-experience-grid--itinerary-only', !hasElevationProfile);
  }
  document.title = `${t.name} | ORMA`;
  document.getElementById('pageTitle').textContent = `${t.name} | ORMA`;
  document.getElementById('trailName').textContent = t.name;
  // Photo-backed hero (per prototype): trail photo under a dark gradient.
  // Trails without an image keep the flat dark hero.
  if(t.imageIcon){
    const heroPhoto = document.getElementById('tdHeroPhoto');
    const heroVeil = document.getElementById('tdHeroVeil');
    if(heroPhoto && heroVeil){
      const responsiveWidths = {
        'images/lago-di-braies.webp':[480,900],
        'images/lago-di-carezza.webp':[480,900],
        'images/boucle-du-marais-des-chassettes.webp':[480,960,1280],
        'images/circuit-beatrice-de-savoie.webp':[480,960,1280],
        'images/itineraire-decouverte-de-la-nature.webp':[480,960,1280],
      }[t.imageIcon];
      if(responsiveWidths){
        const stem = t.imageIcon.replace(/\.webp$/, '');
        heroPhoto.src = `${stem}.jpg`;
        heroPhoto.srcset = responsiveWidths.map((width, index) =>
          `${width === 900 ? t.imageIcon : `${stem}-${width}.webp`} ${width}w`
        ).join(', ');
        heroPhoto.sizes = '(max-width: 700px) 100vw, 1200px';
      } else {
        heroPhoto.src = t.imageIcon;
      }
      heroPhoto.alt = t.imageAlt || `${t.name} trail photograph`;
      heroPhoto.hidden = false;
      heroVeil.hidden = false;
      const creditEl = document.getElementById('tdHeroCredit');
      const credit = window.DoloPawsPhotoProvenance
        ? window.DoloPawsPhotoProvenance.heroCredit(t)
        : null;
      if(creditEl && credit){
        creditEl.replaceChildren();
        if(credit.url){
          const link=document.createElement('a');
          link.href=credit.url;link.target='_blank';link.rel='noopener nofollow';link.textContent=credit.label;
          creditEl.appendChild(link);
        }else creditEl.textContent=credit.label;
        creditEl.hidden=false;
      }
    }
  }
  document.getElementById('trailMeta').textContent =
    `${t.area} · ${t.distance} km · ${t.elevation} m gain · ${t.hours} h · ${t.terrainType}`;
  document.getElementById('trailBadges').innerHTML =
    trailProductBadge(t.safetyLevel, trailSafetyLabel(t)) +
    (t.paid ? trailProductBadge('neutral', window.t('card.paid')) : '');
  const rawDescription = trField(t, 'desc');
  const descriptionSentences = String(rawDescription).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [rawDescription];
  let conciseDescription = '';
  for (const sentence of descriptionSentences) {
    const candidate = `${conciseDescription}${conciseDescription ? ' ' : ''}${sentence.trim()}`;
    if (candidate.length > 330) break;
    conciseDescription = candidate;
    if (conciseDescription.length > 190) break;
  }
  if (!conciseDescription) conciseDescription = String(rawDescription).slice(0, 327).trimEnd() + (String(rawDescription).length > 327 ? '…' : '');
  document.getElementById('trailDesc').textContent = conciseDescription;
  document.getElementById('trailTips').textContent = t.tips ? window.t('trail.tip', {tip: trField(t, 'tips')}) : '';

  // Community v0: "N dogs hiked this trail this week" — anonymous counts
  // from hike-mode starts. Deliberately renders NOTHING at zero: an empty
  // trail should look quiet, not dead.
  function showWeeklyHikes(){
    if (!window.DoloPawsCommunity) return;
    window.DoloPawsCommunity.getWeeklyHikeCount(t.id).then(n => {
      if (!n || n < 1) return;
      const chip = document.getElementById('dogsChip');
      if (!chip) return;
      const weeklyLabel = n === 1 ? window.t('trail.dogsWeek1') : window.t('trail.dogsWeek', {n});
      chip.innerHTML = window.DoloPawsIcons
        ? window.DoloPawsIcons.renderIconSvg('dog', { mode:'inline', color:'currentColor', size:14 }) + `<span>${itinEsc(weeklyLabel)}</span>`
        : itinEsc(weeklyLabel);
      chip.classList.add('dp-inline-status');
      chip.hidden = false;
    });
  }
  if (window.DoloPawsCommunity) showWeeklyHikes();
  else window.addEventListener('dolopaws-auth-ready', showWeeklyHikes, { once: true });

  // Provenance banner: imported (OSM) vs verified (curated) trails.
  (function () {
    const descEl = document.getElementById('trailDesc');
    if (!descEl || document.getElementById('osmProvenance')) return;
    const box = document.createElement('div');
    box.id = 'osmProvenance';
    box.className = 'trail-provenance';
    const trust = window.DoloPawsTrailTrust;
    const provStyle = trust && trust.tierBadgeStyle ? trust.tierBadgeStyle(t) : (t.curated === false ? 'imported' : 'verified');
    const provenanceIcon = window.DoloPawsIcons
      ? window.DoloPawsIcons.renderIconSvg(provStyle, { mode:'inline', color:'currentColor', size:16 })
      : '';
    box.style.cssText = 'margin:10px 0 14px;padding:10px 14px;border-left:4px solid #2E4034;background:#eef3ef;border-radius:6px;font-size:13px;line-height:1.5;';
    box.innerHTML = provenanceIcon + '<strong>Trail planning information.</strong> Based on mapped route data and available ORMA sources. Conditions can change, so check locally before setting out.';
    descEl.parentNode.insertBefore(box, descEl);

    // Trail hazards — surfaceHazards used to feed only the match scoring;
    // surface them to the reader too, right under the provenance banner.
    const surfaceVerified = !trust || !trust.categoryVerified || trust.categoryVerified(t, 'surfaceHazards');
    if (surfaceVerified && Array.isArray(t.surfaceHazards) && t.surfaceHazards.length && !document.getElementById('trailHazards')) {
      const hz = document.createElement('div');
      hz.id = 'trailHazards';
      hz.style.cssText = 'margin:0 0 14px;padding:10px 14px;border-left:4px solid #9C3A25;background:#faeeea;border-radius:6px;font-size:13px;line-height:1.5;';
      const warningIcon = window.DoloPawsIcons ? window.DoloPawsIcons.renderIconSvg('warning', { mode:'inline', color:'currentColor', size:16 }) : '';
      hz.innerHTML = '<strong class="dp-inline-status">' + warningIcon + '<span>' + itinEsc(window.t('trail.hazardsTitle') || 'Trail hazards') + '</span></strong><ul style="margin:6px 0 0 18px;padding:0;">'
        + t.surfaceHazards.map(h => '<li>' + String(h).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</li>').join('')
        + '</ul>';
      descEl.parentNode.insertBefore(hz, descEl);
    }
  })();

  // Quick facts — ascent/descent, highest/lowest point.
  // Note: summing the sparse elevationProfile points (usually just 5-6
  // samples) systematically UNDERSTATES real ascent, since it misses the
  // smaller ups and downs between samples — confirmed by comparing against
  // Tre Cime's already-researched 430m gain figure, which came out much
  // higher than summing its profile points did. Using the existing
  // `elevation` field for ascent is more trustworthy, and since every trail
  // here is a loop (same start/end point), descent is the same figure —
  // net elevation change over a full loop is ~0 by definition.
  // Facts live inside the dark hero now — one place, no duplicates.
  (function(){
    const factsEl = document.getElementById('trailFacts');
    if(!factsEl) return;
    const facts = [
      [`${t.distance} km`, window.t('trail.fact.distance')],
      [`${t.elevation} m`, window.t('trail.fact.ascent')],
      [`${t.hours} h`, window.t('trail.fact.duration')],
    ].filter(([val]) => !/^null|^undefined/.test(val)); // hide facts the data honestly lacks
    if(Array.isArray(t.elevationProfile) && t.elevationProfile.length > 1){
      facts.splice(2, 0, [`${Math.max(...t.elevationProfile.map(p => p.elev))} m`, window.t('trail.fact.high')]);
    }
    // Difficulty cell — mirrors the homepage's derivation from real fields so
    // the hero stat strip matches the design's five-cell layout.
    (function(){
      const asc = Number(t.elevation) || 0;
      const rank = Number(t.terrainRank) || 0;
      const km = Number(t.distance) || 0;
      const diff = (asc >= 400 || (rank >= 2 && asc >= 250)) ? 'Hard'
        : (asc >= 180 || km >= 6 || rank >= 2) ? 'Moderate' : 'Easy';
      facts.push([diff, window.t('trail.fact.difficulty')]);
    })();
    // The design's stat strip leads with a Match cell ("94% · Match · Rufus").
    // It's rendered here so it lives inside the same strip; paintMatch()
    // below fills it with the real score, or an honest create-profile
    // invitation for guests.
    factsEl.innerHTML =
      '<span class="f match" id="statMatch" hidden><a class="td2-match-link" id="statMatchLink" href="how-scoring-works.html"><b id="statMatchVal"></b><span id="statMatchSub"></span></a></span>'
      + facts.map(([val, label]) =>
        `<span class="f"><b>${val}</b><span>${label}</span></span>`).join('');
    const statMatch = document.getElementById('statMatch');
    const statMatchLink = document.getElementById('statMatchLink');
    const statMatchVal = document.getElementById('statMatchVal');
    const statMatchSub = document.getElementById('statMatchSub');

    // Personal match — needs a logged-in profile. Guests see the facts
    // plus an honest invitation: the score exists, it just isn't theirs yet.
    function paintMatchTeaser(){
      const actions = document.querySelector('.td-actions');
      if(actions) actions.classList.add('guest-actions');
      if(statMatch){
        statMatchVal.textContent = '?';
        statMatchSub.textContent = window.t('trail.matchCellTeaser');
        statMatchLink.href = '/?profile=1';
        statMatchLink.setAttribute('aria-label', window.t('trail.matchCellTeaser'));
        statMatch.hidden = false;
      }
      // Legacy slot retained for the main personalised match summary.
      const el = document.getElementById('trailMatch');
      if(el){ el.innerHTML = `<a href="/?profile=1">${window.t('trail.matchTeaser')}</a>`; el.hidden = false; }
    }
    function paintMatch(){
      if(typeof recommendTrail !== 'function') return;
      if(!window.DoloPawsAuth || !window.DoloPawsAuth.currentUser){
        paintMatchTeaser();
        return;
      }
      window.DoloPawsAuth.getDogProfile().then(profile => {
        if(!profile){ paintMatchTeaser(); return; }
        const recommendation = recommendTrail(t, effectiveOverrides(profile, null));
        const n = recommendation.score;
        const actions = document.querySelector('.td-actions');
        if(actions) actions.classList.remove('guest-actions');
        const name = profile.name || window.t('trail.yourDog');
        if(statMatch){
          statMatchVal.innerHTML = (t.curated === false ? '≈' : '') + n + '<span class="pct">%</span>';
          statMatchSub.textContent = 'Match · ' + name;
          statMatchLink.href = 'how-scoring-works.html';
          statMatchLink.setAttribute('aria-label', `Learn how ORMA calculates the ${n}% trail match for ${name}`);
          statMatch.dataset.scoringVersion = recommendation.scoringVersion;
          statMatch.dataset.recommendationCategory = recommendation.category;
          statMatch.dataset.recommendationConfidence = recommendation.confidence;
          statMatch.hidden = false;
        }
        const el = document.getElementById('trailMatch');
        if(el){
          el.textContent = (t.curated === false ? '≈' : '') + n + '% ' +
            window.t('trail.matchFor', {name});
          el.dataset.scoringVersion = recommendation.scoringVersion;
          el.dataset.recommendationCategory = recommendation.category;
          el.dataset.recommendationConfidence = recommendation.confidence;
          el.hidden = false;
        }
      });
    }
    if(window.DoloPawsAuth) paintMatch();
    else window.addEventListener('dolopaws-auth-ready', paintMatch, { once: true });
    // Repaint when auth state resolves or changes, so a logged-in visitor
    // never keeps the guest teaser (and vice versa after logout).
    window.addEventListener('dolopaws-auth-changed', paintMatch);
  })();

  document.getElementById('trailDetailContent').innerHTML = renderTrailDetailContent(t);

  // "Good to know" — curated insights (history, geology, best practice)
  // with cited sources, for trails that have them in trails-data.js.
  if (Array.isArray(t.insights) && t.insights.length){
    const lang = (window.DoloPawsI18n && window.DoloPawsI18n.lang) || 'en';
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:20px;';
    box.innerHTML = `<h2 style="font-size:18px;margin-bottom:10px;">${window.t('trail.insightsTitle')}</h2>` +
      t.insights.map(i => `
        <div style="background:var(--card);border:1px solid var(--paper-line);border-radius:12px;padding:12px 16px;margin-bottom:10px;font-size:13.5px;color:var(--ink);line-height:1.55;">
          ${(lang === 'it' && i.it) ? i.it : i.en}
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:6px;">${window.t('trail.source')}: ${i.url ? `<a href="${i.url}" target="_blank" rel="noopener">${i.source}</a>` : i.source}</div>
        </div>`).join('');
    const gtk = document.getElementById('goodToKnowBox');
    if (gtk){
      box.style.cssText = '';
      box.querySelector('h2').remove(); // card already has the heading
      gtk.appendChild(box);
    } else {
      const detail = document.getElementById('trailDetailContent');
      if (detail) detail.appendChild(box);
    }
  } else {
    // No hand-researched notes yet — fill the card with honest facts
    // derived from the route data itself, clearly labelled as such.
    const gtk = document.getElementById('goodToKnowBox');
    if (gtk){
      const facts = [];
      if (Array.isArray(t.elevationProfile) && t.elevationProfile.length){
        facts.push(window.t('gtk.autoAltitude', {m: Math.max(...t.elevationProfile.map(p => p.elev))}));
      }
      if (t.terrainType) facts.push(window.t('gtk.autoTerrain', {surface: t.terrainType}));
      const isLoopG = Array.isArray(t.path) && t.path.length > 1
        && distMeters(t.path[0], t.path[t.path.length-1]) < 200;
      facts.push(isLoopG ? window.t('gtk.autoLoop', {d: t.distance}) : window.t('gtk.autoPointToPoint', {d: t.distance}));
      gtk.innerHTML = facts.map(f =>
        `<div style="border:1px solid var(--paper-line);border-radius:12px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:var(--ink);line-height:1.55;">${f}</div>`).join('')
        + `<p style="font-size:11px;color:var(--ink-soft);margin:6px 0 0;">${window.t('gtk.autoNote')}</p>`;
    }
  }

  // Build turn-by-turn directions for trails stitched from more than one
  // numbered route, or a simpler start-only note for single-path loops
  // (a lake loop doesn't need "switch trails" instructions, but it still
  // deserves a clear "start here" pointer).
  if(Array.isArray(t.path) && ((Array.isArray(t.decisionPoints) && t.decisionPoints.length > 0) || t.startPoint)){
    const totalKm = t.distance;
    const firstStep = t.startPoint
      ? window.t('trail.dirStart', {label: trLabel(trustedStartLabel(t, t.startPoint.label))})
      : window.t('trail.dirStartAt', {name: (t.rifugi || []).find(r => r.km === 0)?.name || t.area});
    const steps = [firstStep];

    if(Array.isArray(t.decisionPoints) && t.decisionPoints.length > 0){
      // Merge rifugi and decision points that share a km value into one step,
      // rather than listing "pass X" and "switch trails at X" separately when
      // they're literally the same spot.
      const byKm = new Map();
      (t.rifugi || []).filter(r => r.km > 0).forEach(r => {
        byKm.set(r.km, [...(byKm.get(r.km) || []), { text: window.t('trail.dirPass', {name: r.name}), name: r.name }]);
      });
      t.decisionPoints.forEach(d => {
        const existing = byKm.get(d.km) || [];
        const instructionText = d.instruction.charAt(0).toLowerCase() + d.instruction.slice(1);
        // If a rifugio at this exact km is already named inside the decision
        // instruction, drop the separate "pass X" so the name isn't repeated.
        const deduped = existing.filter(e => !instructionText.toLowerCase().includes(e.name.toLowerCase()));
        byKm.set(d.km, [...deduped, { text: instructionText }]);
      });
      const events = [...byKm.entries()].sort((a, b) => a[0] - b[0]);
      events.forEach(([km, items]) => steps.push(`Km ${km}: ${items.map(i => i.text).join(window.t('trail.dirThen'))}.`));
    }

    steps.push(window.t('trail.dirEnd', {n: totalKm}));

    document.getElementById('trailDirections').innerHTML = steps.map(s => `<li>${s}</li>`).join('');
    document.getElementById('directionsWrap').hidden = false;
  }

  // The detail map is expensive and sits below the trail summary. Load its
  // engine only as the map approaches the viewport (or a control is focused).
  const initDetailMap = () => {
  if(typeof maplibregl !== 'undefined' && typeof t.lat === 'number' && typeof t.lng === 'number'){
    const detailMapOptions = {
      container: 'trailDetailMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [t.lng, t.lat],
      zoom: 14,
      pitch: 0, // clean, flat, label-first by default — 3D is opt-in via the toggle
      attributionControl: { compact: true },
    };
    const map = new maplibregl.Map(window.DoloPawsMapRuntime
      ? window.DoloPawsMapRuntime.mapOptions(detailMapOptions) : detailMapOptions);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    window._dolopawsTrailMap = map; // debug/test handle
    initNearestTrailDirections(map, t);

    // Fullscreen map — manual ⤢ toggle, and automatic during hike mode.
    const mapBox = document.getElementById('trailMapBox');
    const expandBtn = document.getElementById('mapExpandBtn');
    const elevationPanel = document.getElementById('tdElevationPanel');
    const elevationHome = elevationPanel && elevationPanel.parentNode;
    function setMapFS(on){
      if(!mapBox) return;
      mapBox.classList.toggle('map-fs', on);
      document.body.classList.toggle('map-fs-open', on);
      if(elevationPanel && !elevationPanel.hidden){
        if(on) mapBox.appendChild(elevationPanel);
        else if(elevationHome) elevationHome.appendChild(elevationPanel);
      }
      if(expandBtn) expandBtn.innerHTML = on
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> <span>Close map</span>'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> <span>Expand map</span>';
      if(expandBtn) expandBtn.setAttribute('aria-label', on ? 'Close map' : 'Expand map');
      if(expandBtn) expandBtn.setAttribute('aria-expanded', String(on));
      setTimeout(() => map.resize(), 60);
    }
    window.DoloPawsMapFS = { enter: () => setMapFS(true), exit: () => setMapFS(false) };
    if(expandBtn) expandBtn.addEventListener('click', () => setMapFS(!mapBox.classList.contains('map-fs')));
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && mapBox && mapBox.classList.contains('map-fs')) setMapFS(false);
    });
    // Live blue-dot location control — tap to see yourself on the map,
    // with heading arrow and follow-me tracking (Google Maps-style).
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 15.5 },
    }), 'top-right');

    // ---- Terrain / Satellite layer switch --------------------------------
    // Bound outside the 'load' handler so the buttons respond as soon as the
    // style is parsed, even while tiles are still streaming in on a slow
    // connection. The imagery slots in below the basemap's text labels, so
    // the route line, POIs and place names stay readable on top of it.
    const layerSwitch = document.getElementById('tdLayerSwitch');
    if (layerSwitch){
      const ensureSatelliteLayer = () => {
        if (map.getLayer('satellite-layer')) return true;
        if (!map.isStyleLoaded()) return false;
        map.addSource('satellite', {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Imagery © Esri',
        });
        const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol');
        map.addLayer({
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite',
          layout: { visibility: 'none' },
          paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 100 },
        }, firstSymbol && firstSymbol.id);
        return true;
      };
      layerSwitch.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-maplayer]');
        if (!btn || !ensureSatelliteLayer()) return;
        const sat = btn.getAttribute('data-maplayer') === 'satellite';
        map.setLayoutProperty('satellite-layer', 'visibility', sat ? 'visible' : 'none');
        // The vector style's building fills sit above the raster and would
        // paint every roof grey over the photo imagery — hide them on
        // satellite.
        map.getStyle().layers.forEach(layer => {
          if(layer['source-layer'] === 'building' || /building/i.test(layer.id)){
            try { map.setLayoutProperty(layer.id, 'visibility', sat ? 'none' : 'visible'); } catch(err){}
          }
        });
        // Base buttons only — the 3D toggle keeps its own pressed state.
        layerSwitch.querySelectorAll('[data-maplayer]').forEach(b => {
          const on = b === btn;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    }

    map.on('load', async () => {
      if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.enhance(map);
      const attribution = document.querySelector('#trailDetailMap .maplibregl-ctrl-attrib');
      if(attribution){
        attribution.classList.add('maplibregl-compact');
        attribution.classList.remove('maplibregl-compact-show');
        const toggle = attribution.querySelector('.maplibregl-ctrl-attrib-button');
        if(toggle) toggle.setAttribute('aria-expanded', 'false');
      }
      let liftsVisible = false;        // Lifts are optional planning context
      // Keep the trail itself visually dominant on first load. Nearby
      // amenities remain available as explicit, independent layer choices.
      const poiStates = { fountains: false, huts: false, food: false, places: false };
      const amenityMarkers = [];       // { marker, group } for curated fallbacks
      if(window.DoloPawsIcons) await window.DoloPawsIcons.registerMapImages(map);
      addTerrainSource(map);
      increaseLabelDensity(map);
      addTerrainToggle(map, 'trailDetailMap', 1.5, 45,
        document.querySelector('#tdLayerSwitch [data-map3d]'));
      const loadSecondaryPois = () => {
        renderAllLifts(map, { visible: liftsVisible });
        if (typeof initDetailPois === 'function') initDetailPois(map, t);
      };
      if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.onIdle(loadSecondaryPois, 1400);
      else setTimeout(loadSecondaryPois, 900);

      // ---- Layers dropdown -------------------------------------------------
      // Match the main map: one compact control with independent route and
      // POI categories, instead of a tall stack of unrelated buttons.
      const layersBtn = document.getElementById('detailLayersBtn');
      const layersPanel = document.getElementById('detailLayersPanel');
      if(layersBtn && layersPanel){
        layersBtn.addEventListener('click', event => {
          event.stopPropagation();
          const open = layersPanel.style.display === 'flex';
          layersPanel.style.display = open ? 'none' : 'flex';
          layersBtn.textContent = open ? 'Layers' : 'Close ✕';
          layersBtn.setAttribute('aria-expanded', String(!open));
        });
        layersPanel.addEventListener('click', event => event.stopPropagation());
        document.addEventListener('click', () => {
          layersPanel.style.display = 'none';
          layersBtn.textContent = 'Layers';
          layersBtn.setAttribute('aria-expanded', 'false');
        });
      }

      const POI_SOURCES = {
        fountains: ['detail-water'],
        huts: ['detail-huts'],
        food: ['detail-bars'],
        places: ['detail-places'],
      };
      const POI_SUFFIXES = ['-layer', '-layer-lowzoom', '-cluster', '-cluster-count'];
      function applyPoiVisibility(group){
        const visible = poiStates[group];
        (POI_SOURCES[group] || []).forEach(source => POI_SUFFIXES.forEach(suffix => {
          const id = source + suffix;
          if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }));
        amenityMarkers.filter(item => item.group === group).forEach(item => {
          item.marker.getElement().style.display = visible ? '' : 'none';
        });
      }
      [
        ['fountains', 'fountainsToggle'],
        ['huts', 'hutsToggle'],
        ['food', 'foodToggle'],
        ['places', 'placesToggle'],
      ].forEach(([group, buttonId]) => {
        const button = document.getElementById(buttonId);
        if(!button) return;
        button.addEventListener('click', () => {
          poiStates[group] = !poiStates[group];
          button.classList.toggle('on', poiStates[group]);
          button.setAttribute('aria-pressed', String(poiStates[group]));
          applyPoiVisibility(group);
        });
      });
      // detail-pois.js adds its layers asynchronously (after a fetch), so
      // reapply whenever a POI source finishes loading.
      map.on('sourcedata', (e) => {
        if(!e.sourceId || !e.isSourceLoaded) return;
        Object.keys(POI_SOURCES).forEach(group => {
          if(POI_SOURCES[group].includes(e.sourceId)) applyPoiVisibility(group);
        });
      });

      // ---- Lifts toggle -------------------------------------------------
      // Lift lines and stations start hidden, then remain available as an
      // explicit planning layer. The state also applies if the deferred lift
      // data finishes loading after the customer has pressed the control.
      function applyLiftVisibility(){
        const visibility = liftsVisible ? 'visible' : 'none';
        ['detail-gondolas-line', 'detail-gondola-stations-layer'].forEach(id => {
          if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
        });
      }
      const liftsToggleBtn = document.getElementById('liftsToggle');
      if(liftsToggleBtn){
        liftsToggleBtn.addEventListener('click', () => {
          liftsVisible = !liftsVisible;
          liftsToggleBtn.classList.toggle('on', liftsVisible);
          liftsToggleBtn.setAttribute('aria-pressed', liftsVisible ? 'true' : 'false');
          applyLiftVisibility();
        });
      }


      // Waymarked Trails' own public hiking overlay — same underlying OSM
      // data as our base map, but with their dedicated trail-route styling
      // (numbered routes, waymarking) that a general basemap doesn't draw.
      //
      // IMPORTANT: adding a layer with no target position stacks it on top
      // of EVERYTHING in the base style, including all its text labels —
      // that's what was actually causing the "hard to read" problem, in
      // both 3D and flat mode. Finding the first text/label layer and
      // inserting before it keeps the overlay above roads/fills but below
      // every place name, so labels stay legible either way.
      const firstLabelLayer = map.getStyle().layers.find(l => l.type === 'symbol');
      map.addSource('waymarked-hiking', {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
      });
      map.addLayer({
        id: 'waymarked-hiking-layer',
        type: 'raster',
        source: 'waymarked-hiking',
        // VISIBLE by default: the waymark network is how walkable ground
        // around the route stays discoverable. "Marked routes" un-ticks it
        // for anyone who wants the clean basemap.
        layout: { visibility: 'visible' },
        // Keep the public network contextual rather than dominant. ORMA's
        // selected route is deliberately drawn beneath this raster: the
        // reduced opacity lets its wider casing remain visible, while the
        // Waymarked shield artwork (including route numbers) stays on top.
        paint: {
          'raster-opacity': [
            'interpolate', ['linear'], ['zoom'],
            9, 0.48,
            13, 0.58,
            16, 0.72,
          ],
          'raster-saturation': -0.45,
          'raster-contrast': -0.12,
          'raster-resampling': 'linear',
        },
      }, firstLabelLayer ? firstLabelLayer.id : undefined);
      if (typeof addBaseHillshade === 'function') addBaseHillshade(map, 'waymarked-hiking-layer');
      const routesToggleBtn = document.getElementById('routesToggle');
      if (routesToggleBtn){
        routesToggleBtn.classList.add('on');
        routesToggleBtn.setAttribute('aria-pressed', 'true');
        routesToggleBtn.addEventListener('click', () => {
          const showing = routesToggleBtn.classList.toggle('on');
          routesToggleBtn.setAttribute('aria-pressed', showing ? 'true' : 'false');
          if (map.getLayer('waymarked-hiking-layer')) {
            map.setLayoutProperty('waymarked-hiking-layer', 'visibility', showing ? 'visible' : 'none');
          }
        });
      }

      // ---- Other trails' routes — browse and switch without going back ----
      // Every other trail with a real GPS route renders as a secondary line;
      // clicking one pops up its name and a link straight to its page. Added
      // BEFORE the main route's layers so the current trail always draws on
      // top of its neighbours.
      const nearbyTrails = nearbyTrailCandidates(t, typeof trails !== 'undefined' ? trails : []);
      const otherTrails = nearbyTrails.map(item => item.trail);
      const nearbyToggleBtn = document.getElementById('nearbyToggle');
      if(nearbyToggleBtn){
        nearbyToggleBtn.hidden = nearbyTrails.length === 0;
        if(nearbyTrails.length){
          nearbyToggleBtn.textContent = `Nearby trails (${nearbyTrails.length})`;
        }
      }
      if(otherTrails.length){
        map.addSource('other-trails', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: otherTrails.map(x => ({
              type: 'Feature',
              properties: { id: x.id, name: x.name, safetyLevel: x.safetyLevel, distance: x.distance },
              geometry: { type: 'LineString', coordinates: x.path.map(([lat, lng]) => [lng, lat]) },
            })),
          },
        });
        map.addLayer({
          id: 'other-trails-line',
          type: 'line',
          source: 'other-trails',
          minzoom: 9,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': [
              'match', ['get', 'safetyLevel'],
              'low-risk', '#2C5C34',
              'moderate', '#8A5A16',
              'caution', '#9C3A25',
              '#2E4034',
            ],
            'line-width': 3.5,
            'line-opacity': 0.68,
            'line-dasharray': [1.5, 1.25],
          },
        }, 'waymarked-hiking-layer');
        // Wide invisible twin so the thin neighbour lines are easy to hit.
        map.addLayer({
          id: 'other-trails-hit',
          type: 'line',
          source: 'other-trails',
          minzoom: 9,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#000', 'line-width': 16, 'line-opacity': 0.01 },
        }, 'waymarked-hiking-layer');
        map.addSource('nearby-trail-points', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: nearbyTrails.map(item => ({
              type: 'Feature',
              properties: {
                id: item.trail.id,
                name: item.trail.name,
                safetyLevel: item.trail.safetyLevel,
                distance: item.trail.distance,
                awayKm: Math.round(item.distanceKm * 10) / 10,
              },
              geometry: { type: 'Point', coordinates: [item.mapPoint[1], item.mapPoint[0]] },
            })),
          },
        });
        map.addLayer({
          id: 'nearby-trail-points-circle',
          type: 'circle',
          source: 'nearby-trail-points',
          paint: {
            'circle-radius': 6,
            'circle-color': '#78AFC5',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        });
        map.addLayer({
          id: 'nearby-trail-points-label',
          type: 'symbol',
          source: 'nearby-trail-points',
          minzoom: 8,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-font': ['Noto Sans Regular'],
            'text-offset': [0, 1.25],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#243128',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        });
        const escName = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
        const openNearbyPopup = (e) => {
          // If this click also lands on the current trail's own route,
          // let the main route win — no neighbour popup on top of it.
          if(e.type === 'click' && e.features && e.features[0] && e.features[0].geometry.type === 'LineString' && map.getLayer('single-trail-path-line')){
            const onMain = map.queryRenderedFeatures(e.point, { layers: ['single-trail-path-line'] });
            if(onMain.length) return;
          }
          const f = e.features && e.features[0];
          if(!f) return;
          const p = f.properties;
          new maplibregl.Popup({ offset: 12, maxWidth: '260px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font:700 14px 'Bricolage Grotesque',sans-serif;color:#2E4034;">${escName(p.name)}</div>` +
              `<div style="font:600 11.5px 'Inter',sans-serif;color:#6B7A6E;margin-top:3px;">${escName(String(p.distance))} km trail${p.awayKm != null ? ` · ${escName(String(p.awayKm))} km away` : ''}</div>` +
              `<a href="trail.html?id=${encodeURIComponent(p.id)}" style="display:inline-block;margin-top:9px;font:700 12.5px 'Inter',sans-serif;color:#fff;background:#2E4034;padding:8px 14px;border-radius:9px;text-decoration:none;">Open this trail →</a>`
            )
            .addTo(map);
        };
        map.on('click', 'other-trails-hit', openNearbyPopup);
        map.on('click', 'nearby-trail-points-circle', openNearbyPopup);
        map.on('mouseenter', 'other-trails-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'other-trails-hit', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'nearby-trail-points-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'nearby-trail-points-circle', () => { map.getCanvas().style.cursor = ''; });

        if(nearbyToggleBtn){
          let showingNearbyOverview = false;
          nearbyToggleBtn.addEventListener('click', () => {
            showingNearbyOverview = !showingNearbyOverview;
            nearbyToggleBtn.classList.toggle('on', showingNearbyOverview);
            nearbyToggleBtn.setAttribute('aria-pressed', showingNearbyOverview ? 'true' : 'false');
            const bounds = new maplibregl.LngLatBounds();
            t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
            if(showingNearbyOverview){
              otherTrails.forEach(trail => trail.path.forEach(([lat, lng]) => bounds.extend([lng, lat])));
              nearbyToggleBtn.textContent = 'Focus this trail';
              map.fitBounds(bounds, { padding: 54, maxZoom: 13 });
            } else {
              nearbyToggleBtn.textContent = `Nearby trails (${nearbyTrails.length})`;
              map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
            }
          });
        }
      }

      if(Array.isArray(t.path) && t.path.length > 1){
        map.addSource('single-trail-path', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
          },
        });
        // Casing — a wider Pine line underneath the safety-colored route.
        // This is the detail that makes a route line read as intentional/
        // premium rather than a thin stroke — same visual trick Komoot uses.
        map.addLayer({
          id: 'single-trail-path-casing',
          type: 'line',
          source: 'single-trail-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2E4034', 'line-width': 9, 'line-opacity': 0.96 },
        }, 'waymarked-hiking-layer');
        map.addLayer({
          id: 'single-trail-path-line',
          type: 'line',
          source: 'single-trail-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': safetyColor(t.safetyLevel), 'line-width': 5 },
        }, 'waymarked-hiking-layer');

        // Closed loops are intentionally direction-neutral: hikers can join
        // anywhere and walk clockwise or anticlockwise. Keep arrows only for
        // routes whose start and end are genuinely different.
        const routeIsLoop = distMeters(t.path[0], t.path[t.path.length - 1]) <= 75;
        if(!routeIsLoop){
          map.addLayer({
            id: 'single-trail-direction-arrows',
            type: 'symbol',
            source: 'single-trail-path',
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': 70,
              'text-field': '➤',
              'text-size': 18,
              'text-rotation-alignment': 'map',
              'text-keep-upright': false,
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': safetyColor(t.safetyLevel),
              'text-halo-width': 2,
            },
          });
        }
        const bounds = new maplibregl.LngLatBounds();
        t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 17 });

        setupElevationProfile(map, t);

        // "Start hike" companion — live progress, off-route warning, wake lock.
        if (typeof initHikeMode === 'function') initHikeMode(map, t);

        // NOTE: curated rifugi/water emoji markers used to be placed here
        // from the trail's km data — removed: they duplicated the real OSM
        // amenity dots (detail-pois.js), showing two markers for the same
        // rifugio. The OSM dot layers are now the single amenity language
        // on every map; the curated km list still renders as text in the
        // "Trail details" column. Emoji markers remain only for things OSM
        // can't know: recommended start, decision points, community flags.

        // Decision points — where a hiker needs to switch from one numbered
        // route onto another. Always real, verified coordinates (these come
        // from actual confirmed junctions between two GPX tracks, never
        // interpolated) so no fallback branch is needed here.
        (t.decisionPoints || []).forEach(d => {
          new maplibregl.Marker({ element: makeIconEl('switch', '#D6A038'), offset: [14, -14] })
            .setLngLat([d.lng, d.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>Km ${d.km}</b><br>${d.instruction}`))
            .addTo(map);
        });

        // Only draw a trail-owned waypoint when it has verified GPS
        // coordinates. Interpolating from a rounded kilometre can put an icon
        // on the wrong bend or side of a loop. OSM-backed points already render
        // at their source coordinates through detail-pois.js, so do not draw a
        // duplicate marker on top of them here.
        if(Array.isArray(t.path) && t.path.length > 1){
          const addWaypoint = (waypoint, icon, label) => {
            if(!waypoint || waypoint.osmId || typeof waypoint.lat !== 'number' || typeof waypoint.lng !== 'number') return;
            const mk = new maplibregl.Marker({ element: makeIconEl(icon), offset: [0, -6] })
              .setLngLat([waypoint.lng, waypoint.lat])
              .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(`<b>${itinEsc(label)}</b>${typeof waypoint.km === 'number' ? `<br>Km ${waypoint.km}` : ''}`))
              .addTo(map);
            amenityMarkers.push({ marker: mk, group: icon === 'hut' ? 'huts' : 'fountains' });
            mk.getElement().style.display = poiStates[icon === 'hut' ? 'huts' : 'fountains'] ? '' : 'none';
          };
          (t.rifugi || []).forEach(r => addWaypoint(r, 'hut', trLabel(r.name)));
          (t.waterSources || []).forEach(w => {
            addWaypoint(w, 'water', trLabel(trustedWaterLabel(t, w.label)));
          });
        }

        // Recommended starting point — a loop can technically be walked
        // from anywhere on it, but a real, well-marked access/parking point
        // is worth calling out explicitly rather than leaving people to
        // guess where to begin.
        if(t.startPoint){
          new maplibregl.Marker({ element: makeIconEl('start', '#2E4034'), offset: [-14, -14] })
            .setLngLat([t.startPoint.lng, t.startPoint.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>${trLabel(trustedStartLabel(t, t.startPoint.label))}</b>`))
            .addTo(map);
        }
      } else {
        new maplibregl.Marker({ color: '#6FA8BE' }).setLngLat([t.lng, t.lat]).addTo(map);
      }

      if (typeof makeBasemapPoisClickable === 'function') makeBasemapPoisClickable(map);

      // Community dog-safety flags — list, map markers, report modal.
      if (typeof initTrailReports === 'function') initTrailReports(map, t);
    });
  }
  };
  const detailMapTarget = document.getElementById('trailMapBox') || document.getElementById('trailDetailMap');
  if(window.DoloPawsMapRuntime){
    const detailMapSchedule = window.DoloPawsMapRuntime.whenVisible(detailMapTarget, initDetailMap, {
      rootMargin:'360px 0px',
      triggers:[document.getElementById('mapExpandBtn')],
    });
    const expand = document.getElementById('mapExpandBtn');
    if(expand){
      expand.addEventListener('click', async event => {
        if(window._dolopawsTrailMap || !detailMapSchedule || !detailMapSchedule.start) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        await detailMapSchedule.start();
        if(window._dolopawsTrailMap) expand.click();
      }, { capture:true });
    }
  } else {
    initDetailMap();
  }

  // Save button — reflects and updates real account state, same pattern as the trail cards.
  const saveBtn = document.getElementById('detailSaveBtn');
  let saveStatusTimer = null;
  function showSaveStatus(message){
    let status = document.getElementById('detailSaveStatus');
    if(!status){
      status = document.createElement('div');
      status.id = 'detailSaveStatus';
      status.className = 'dw-toast';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.appendChild(status);
    }
    if(saveStatusTimer) clearTimeout(saveStatusTimer);
    status.textContent = message;
    status.hidden = false;
    status.className = 'dw-toast dw-toast--in';
    saveStatusTimer = setTimeout(() => {
      status.hidden = true;
      status.className = 'dw-toast';
    }, 4200);
  }
  function paintSaveBtn(isFav){
    const heart = isFav
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21S3.5 14.6 3.5 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.5 2.8C20.5 14.6 12 21 12 21z"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.4S4.2 14.5 4.2 9.2A4.3 4.3 0 0 1 12 6.6a4.3 4.3 0 0 1 7.8 2.6c0 5.3-7.8 11.2-7.8 11.2z"/></svg>';
    saveBtn.innerHTML = heart + (isFav ? ' Saved' : ' Save');
    saveBtn.classList.toggle('saved', isFav);
  }
  async function handleSaveAuth(user){
    if(!user || !window.DoloPawsAuth){
      saveBtn.onclick = () => {
        if(window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('save');
      };
      paintSaveBtn(false);
      return;
    }
    const favorites = await window.DoloPawsAuth.getFavorites();
    if(window.DoloPawsTrailAction && window.DoloPawsTrailAction.consume('save') && !favorites[t.id]){
      favorites[t.id] = true;
      const saved = await window.DoloPawsAuth.setFavorites(favorites);
      if(saved) showSaveStatus(window.t('save.added'));
      else {
        delete favorites[t.id];
        showSaveStatus(window.t('save.error'));
      }
    }
    paintSaveBtn(!!favorites[t.id]);
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      const current = await window.DoloPawsAuth.getFavorites();
      const wasSaved = !!current[t.id];
      if(wasSaved) delete current[t.id]; else current[t.id] = true;
      const saved = await window.DoloPawsAuth.setFavorites(current);
      if(saved){
        paintSaveBtn(!wasSaved);
        showSaveStatus(window.t(wasSaved ? 'save.removed' : 'save.added'));
      } else {
        paintSaveBtn(wasSaved);
        showSaveStatus(window.t('save.error'));
      }
      saveBtn.disabled = false;
    };
  }
  window.addEventListener('dolopaws-auth-changed', e => handleSaveAuth(e.detail.user));
  if(window.DoloPawsAuth) handleSaveAuth(window.DoloPawsAuth.currentUser);

  // GPX export is intentionally account-gated. The file contains the ordered
  // route and trailhead, but not the richer safety context shown on ORMA.
  const exportGpxBtn = document.getElementById('exportGpxBtn');
  if(exportGpxBtn){
    let exportStatusTimer = null;
    function showExportStatus(message){
      let status = document.getElementById('exportGpxStatus');
      if(!status){
        status = document.createElement('div');
        status.id = 'exportGpxStatus';
        status.className = 'dw-toast';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        document.body.appendChild(status);
      }
      if(exportStatusTimer) clearTimeout(exportStatusTimer);
      status.textContent = message;
      status.hidden = false;
      status.className = 'dw-toast dw-toast--in';
      exportStatusTimer = setTimeout(() => {
        status.hidden = true;
        status.className = 'dw-toast';
      }, 5200);
    }
    function runGpxExport(){
      if(!window.DoloPawsGpxExport){
        showExportStatus('GPX export could not load. Please refresh and try again.');
        return false;
      }
      try {
        window.DoloPawsGpxExport.download(t);
        showExportStatus('GPX downloaded. It contains the route only — check ORMA for safety context.');
        return true;
      } catch(error){
        showExportStatus(error && error.message
          ? error.message : 'This trail could not be exported.');
        return false;
      }
    }
    function handleExportAuth(user){
      exportGpxBtn.onclick = () => {
        if(!(user && window.DoloPawsAuth)){
          if(window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('export-gpx');
          return;
        }
        runGpxExport();
      };
      if(user && window.DoloPawsTrailAction
        && window.DoloPawsTrailAction.consume('export-gpx')){
        runGpxExport();
      }
    }
    window.addEventListener('dolopaws-auth-changed', event => handleExportAuth(event.detail.user));
    handleExportAuth(window.DoloPawsAuth && window.DoloPawsAuth.currentUser);
  }
}

// This file is deferred, so the trail DOM and synchronous regional payload
// are available even if authentication is still delaying DOMContentLoaded.
if(document.querySelector('.td2')){
  init();
} else if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
