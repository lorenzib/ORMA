(function(){
  'use strict';

  // Record-anywhere walk page. The engine (walk-recorder.js) owns the
  // maths; this file owns geolocation, the map trace, the draft snapshot
  // and the hand-off into the journal.

  var recorder = window.DoloPawsWalkRecorder.createRecorder();
  var uid = null;
  var watchId = null;
  var tickTimer = null;
  var draftTimer = null;
  var wakeLock = null;
  var map = null;
  var mapReady = false;
  var lastCenter = null;
  var latestFix = null;
  var bootedUid = null;

  var els = {
    time: document.getElementById('wrTime'),
    dist: document.getElementById('wrDist'),
    gps: document.getElementById('wrGps'),
    dog: document.getElementById('wrDog'),
    start: document.getElementById('wrStart'),
    pause: document.getElementById('wrPause'),
    finish: document.getElementById('wrFinish'),
    discard: document.getElementById('wrDiscard'),
    gate: document.getElementById('wrGate'),
  };

  function draftKey(){ return 'dolopaws-walk-draft-' + uid; }
  function journalKey(){ return 'dolopaws-journal-' + uid; }

  function fmtTime(ms){
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = (h ? String(m).padStart(2, '0') : m);
    return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
  }

  function paint(){
    els.time.textContent = fmtTime(recorder.elapsedMs(Date.now()));
    els.dist.textContent = (recorder.distanceM / 1000).toFixed(2);
  }

  function setButtons(){
    var s = recorder.status;
    els.start.hidden = s !== 'idle' && s !== 'paused';
    els.start.textContent = s === 'paused' ? 'Resume' : 'Start walk';
    els.pause.hidden = s !== 'recording';
    els.finish.hidden = s === 'idle';
    els.discard.hidden = s === 'idle';
  }

  // ---- Map trace -----------------------------------------------------
  function initMap(center, fallback){
    if(map || typeof maplibregl === 'undefined') return;
    map = new maplibregl.Map({
      container: 'wrMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom: fallback ? 9 : 15.5,
      attributionControl: { compact: true },
    });
    map.on('load', function(){
      // Same walkable-network detail as every other DoloPaws map: marked
      // hiking routes plus subtle relief, under the recording trace.
      var firstLabel = map.getStyle().layers.find(function(l){ return l.type === 'symbol'; });
      map.addSource('waymarked-hiking', {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
      });
      map.addLayer({ id: 'waymarked-hiking-layer', type: 'raster', source: 'waymarked-hiking',
        paint: { 'raster-opacity': 0.4 } }, firstLabel ? firstLabel.id : undefined);
      map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256, encoding: 'terrarium', maxzoom: 15,
      });
      map.addLayer({ id: 'base-hillshade', type: 'hillshade', source: 'terrain-dem',
        paint: { 'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#5A5548', 'hillshade-method': 'igor' } },
        'waymarked-hiking-layer');
      map.addSource('walk', { type: 'geojson', data: routeGeo() });
      map.addLayer({ id: 'walk-line', type: 'line', source: 'walk',
        paint: { 'line-color': '#C4652F', 'line-width': 4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addSource('walk-position', { type: 'geojson', data: positionGeo(latestFix) });
      map.addLayer({ id: 'walk-position-accuracy', type: 'fill', source: 'walk-position',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#3E7A91', 'fill-opacity': 0.16 } }, 'walk-line');
      map.addLayer({ id: 'walk-position-dot', type: 'circle', source: 'walk-position',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 9, 'circle-color': '#3E7A91', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      mapReady = true;
      installMapControls();
      updatePositionSource();
    });
  }

  function routeGeo(){
    return { type: 'Feature', geometry: {
      type: 'LineString',
      coordinates: recorder.summary(Date.now()).route.map(function(p){ return [p[1], p[0]]; }),
    } };
  }

  function positionGeo(fix){
    if(!fix) return { type:'FeatureCollection', features:[] };
    var accuracy = Math.max(5, Math.min(Number(fix.accuracy) || 5, 500));
    var latStep = accuracy / 111320;
    var lngStep = accuracy / (111320 * Math.max(0.2, Math.cos(fix.lat * Math.PI / 180)));
    var ring = [];
    for(var i = 0; i <= 48; i++){
      var angle = (i / 48) * Math.PI * 2;
      ring.push([fix.lng + Math.cos(angle) * lngStep, fix.lat + Math.sin(angle) * latStep]);
    }
    return { type:'FeatureCollection', features:[
      { type:'Feature', properties:{ accuracy:accuracy }, geometry:{ type:'Polygon', coordinates:[ring] } },
      { type:'Feature', properties:{ accuracy:accuracy }, geometry:{ type:'Point', coordinates:[fix.lng, fix.lat] } },
    ] };
  }

  function updatePositionSource(){
    if(!mapReady) return;
    var source = map.getSource('walk-position');
    if(source) source.setData(positionGeo(latestFix));
  }

  function installMapControls(){
    var host = map && map.getContainer();
    if(!host || host.querySelector('.wr-style-switch')) return;

    var layersButton = document.createElement('button');
    layersButton.type = 'button';
    layersButton.className = 'map-btn wr-layers-btn';
    layersButton.textContent = 'Layers';
    layersButton.setAttribute('aria-expanded', 'false');
    host.appendChild(layersButton);

    var panel = document.createElement('div');
    panel.className = 'map-panel wr-map-panel';
    panel.hidden = true;
    host.appendChild(panel);

    function layerChip(label, layerIds, initiallyOn){
      var on = initiallyOn;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'map-chip' + (on ? ' on' : '');
      chip.textContent = label;
      chip.setAttribute('aria-pressed', String(on));
      chip.addEventListener('click', function(){
        on = !on;
        layerIds.forEach(function(id){ if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); });
        chip.classList.toggle('on', on);
        chip.setAttribute('aria-pressed', String(on));
      });
      panel.appendChild(chip);
    }
    layerChip('Marked hiking routes', ['waymarked-hiking-layer'], true);
    layerChip('Relief shading', ['base-hillshade'], true);

    layersButton.addEventListener('click', function(){
      panel.hidden = !panel.hidden;
      layersButton.textContent = panel.hidden ? 'Layers' : 'Close layers';
      layersButton.setAttribute('aria-expanded', String(!panel.hidden));
    });

    function ensureSatellite(){
      if(map.getLayer('satellite-layer')) return true;
      if(!map.isStyleLoaded()) return false;
      map.addSource('satellite', {
        type:'raster',
        tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize:256,
        maxzoom:19,
        attribution:'Imagery © Esri',
      });
      map.addLayer({ id:'satellite-layer', type:'raster', source:'satellite', layout:{ visibility:'none' } },
        map.getLayer('waymarked-hiking-layer') ? 'waymarked-hiking-layer' : undefined);
      return true;
    }

    var styleSwitch = document.createElement('div');
    styleSwitch.className = 'td-layer-switch wr-style-switch';
    styleSwitch.setAttribute('role', 'group');
    styleSwitch.setAttribute('aria-label', 'Map style');
    styleSwitch.innerHTML = '<button type="button" class="on" data-wr-base="map" aria-pressed="true">Map</button>' +
      '<button type="button" data-wr-base="satellite" aria-pressed="false">Satellite</button>' +
      '<button type="button" data-wr-3d aria-pressed="false">3D</button>';
    host.appendChild(styleSwitch);
    styleSwitch.addEventListener('click', function(event){
      var terrainButton = event.target.closest('[data-wr-3d]');
      if(terrainButton){
        var terrainOn = !terrainButton.classList.contains('on');
        map.setTerrain(terrainOn ? { source:'terrain-dem', exaggeration:1.3 } : null);
        map.easeTo({ pitch:terrainOn ? 38 : 0, duration:500 });
        terrainButton.classList.toggle('on', terrainOn);
        terrainButton.setAttribute('aria-pressed', String(terrainOn));
        return;
      }
      var baseButton = event.target.closest('[data-wr-base]');
      if(!baseButton || !ensureSatellite()) return;
      var satelliteOn = baseButton.getAttribute('data-wr-base') === 'satellite';
      map.setLayoutProperty('satellite-layer', 'visibility', satelliteOn ? 'visible' : 'none');
      styleSwitch.querySelectorAll('[data-wr-base]').forEach(function(button){
        var selected = button === baseButton;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    });

    var locateButton = document.createElement('button');
    locateButton.type = 'button';
    locateButton.className = 'wr-locate';
    locateButton.setAttribute('aria-label', 'Centre map on my position');
    locateButton.textContent = '◎';
    locateButton.addEventListener('click', function(){
      if(latestFix && map) map.easeTo({ center:[latestFix.lng, latestFix.lat], zoom:Math.max(map.getZoom(), 15), duration:500 });
      else requestCurrentPosition();
    });
    host.appendChild(locateButton);
  }

  function traceUpdate(fix){
    latestFix = fix;
    if(!map){ initMap(fix, false); return; }
    updatePositionSource();
    if(mapReady){
      var src = map.getSource('walk');
      if(src) src.setData(routeGeo());
    }
    if(!lastCenter || window.DoloPawsWalkRecorder.haversineM(lastCenter, fix) > 25){
      lastCenter = { lat: fix.lat, lng: fix.lng };
      map.easeTo({ center: [fix.lng, fix.lat], duration: 500 });
    }
  }

  // ---- Geolocation ---------------------------------------------------
  function requestCurrentPosition(){
    if(!navigator.geolocation){
      els.gps.textContent = 'Location is not available in this browser';
      initMap({ lat:46.54, lng:11.80 }, true);
      return;
    }
    els.gps.textContent = 'Finding your position…';
    navigator.geolocation.getCurrentPosition(function(pos){
      var fix = { lat:pos.coords.latitude, lng:pos.coords.longitude, accuracy:pos.coords.accuracy, timestamp:pos.timestamp };
      els.gps.textContent = 'GPS ±' + Math.round(pos.coords.accuracy) + ' m';
      traceUpdate(fix);
    }, function(){
      els.gps.textContent = 'Location unavailable — tap ◎ after allowing access';
      initMap({ lat:46.54, lng:11.80 }, true);
    }, { enableHighAccuracy:true, maximumAge:5000, timeout:12000 });
  }

  function startWatch(){
    if(watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(function(pos){
      var fix = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, timestamp: pos.timestamp,
      };
      var result = recorder.addFix(fix);
      els.gps.textContent = result.accepted || result.reason === 'jitter'
        ? 'GPS ±' + Math.round(pos.coords.accuracy) + ' m'
        : 'GPS signal is weak — walk on, it will catch up';
      traceUpdate(fix);
      paint();
    }, function(){
      els.gps.textContent = 'Location unavailable — check permissions';
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
  }

  function stopWatch(){
    if(watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  function requestWakeLock(){
    if(!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function(lock){ wakeLock = lock; }).catch(function(){});
  }
  function releaseWakeLock(){ if(wakeLock){ wakeLock.release().catch(function(){}); wakeLock = null; } }

  // ---- Draft (crash recovery) ---------------------------------------
  function saveDraft(){
    try {
      var snap = recorder.snapshot();
      snap.savedAt = Date.now();
      localStorage.setItem(draftKey(), JSON.stringify(snap));
    } catch(e){}
  }
  function clearDraft(){ try { localStorage.removeItem(draftKey()); } catch(e){} }

  function tryRestoreDraft(){
    var snap = null;
    try { snap = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch(e){}
    if(!snap || !Array.isArray(snap.points) || !snap.points.length) return;
    if(!window.confirm('An unfinished walk was found. Continue it?')){ clearDraft(); return; }
    recorder.restore(snap, Date.now());
    var last = snap.points[snap.points.length - 1];
    if(last) initMap(last);
    paint();
    setButtons();
  }

  // ---- Journal hand-off ----------------------------------------------
  function saveToJournal(){
    var summary = recorder.finish(Date.now());
    var entry = window.DoloPawsWalkRecorder.buildJournalEntry(summary, { now: Date.now() });
    try {
      var entries = [];
      try { entries = JSON.parse(localStorage.getItem(journalKey())) || []; } catch(e){}
      entries.unshift(entry);
      entries.sort(function(a, b){ return new Date(b.date) - new Date(a.date); });
      localStorage.setItem(journalKey(), JSON.stringify(entries));
    } catch(e){}
    clearDraft();
    window.location.href = 'journal.html?recorded=1';
  }

  // ---- Controls ------------------------------------------------------
  els.start.addEventListener('click', function(){
    if(!uid){ els.gate.hidden = false; return; }
    if(recorder.status === 'idle') recorder.start(Date.now());
    else recorder.resume(Date.now());
    startWatch();
    requestWakeLock();
    if(!tickTimer) tickTimer = setInterval(paint, 1000);
    if(!draftTimer) draftTimer = setInterval(saveDraft, 10000);
    setButtons();
  });

  els.pause.addEventListener('click', function(){
    recorder.pause(Date.now());
    stopWatch();
    saveDraft();
    setButtons();
    paint();
  });

  els.finish.addEventListener('click', function(){
    if(recorder.distanceM < 50 && !window.confirm('Barely any distance was recorded. Save anyway?')) return;
    stopWatch();
    releaseWakeLock();
    saveToJournal();
  });

  els.discard.addEventListener('click', function(){
    if(!window.confirm('Discard this walk? It will not be saved.')) return;
    stopWatch();
    releaseWakeLock();
    clearDraft();
    window.location.href = 'index.html';
  });

  // Re-acquire the wake lock when the tab comes back.
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible' && recorder.status === 'recording') requestWakeLock();
  });
  window.addEventListener('beforeunload', function(){
    if(recorder.status === 'recording' || recorder.status === 'paused') saveDraft();
  });

  // ---- Boot: needs an account so the walk lands in the right journal --
  function cachedMember(){
    try {
      var summary = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null');
      return summary && typeof summary === 'object' ? summary : null;
    } catch(e){ return null; }
  }

  function enterMember(memberUid, summary){
    if(!memberUid) return false;
    els.gate.hidden = true;
    uid = memberUid;
    if(summary && summary.name) els.dog.textContent = 'Walking with ' + summary.name;
    if(bootedUid === memberUid) return true;
    bootedUid = memberUid;
    tryRestoreDraft();
    // Prime the map and the live-position dot even before Start.
    requestCurrentPosition();
    return true;
  }

  function boot(){
    var authApi = window.DoloPawsAuth;
    var user = authApi && authApi.currentUser;
    var summary = cachedMember();
    if(user){ enterMember(user.uid, summary); return; }
    // The walk journal is local-first. A cached UID from a previously
    // confirmed session lets recording open immediately (and offline), while
    // Firebase restores in the background. Logout removes this summary.
    if(summary && summary.uid && !(authApi && authApi.authResolved)){
      enterMember(summary.uid, summary);
      return;
    }
    uid = null;
    bootedUid = null;
    els.gate.hidden = false;
  }

  // onChange is firebase-init's own registry — it fires for every auth
  // state including session restore. The DOM 'dolopaws-auth-changed' event
  // only exists on pages that load auth-ui.js, which this page does not.
  function watchAuth(){
    var summary = cachedMember();
    if(summary && summary.uid) enterMember(summary.uid, summary);
    if(window.DoloPawsAuth && typeof window.DoloPawsAuth.onChange === 'function'){
      window.DoloPawsAuth.onChange(function(){ boot(); });
    } else {
      boot();
    }
  }
  if(window.DoloPawsAuthReady) watchAuth();
  else window.addEventListener('dolopaws-auth-ready', watchAuth, { once: true });
  window.addEventListener('dolopaws-auth-changed', boot);
  setButtons();
})();
