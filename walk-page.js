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
  function initMap(center){
    if(map || typeof maplibregl === 'undefined') return;
    map = new maplibregl.Map({
      container: 'wrMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom: 15.5,
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
      mapReady = true;
    });
  }

  function routeGeo(){
    return { type: 'Feature', geometry: {
      type: 'LineString',
      coordinates: recorder.summary(Date.now()).route.map(function(p){ return [p[1], p[0]]; }),
    } };
  }

  function traceUpdate(fix){
    if(!map){ initMap(fix); return; }
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
  function boot(){
    var user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(!user){ els.gate.hidden = false; return; }
    els.gate.hidden = true;
    uid = user.uid;
    try {
      var summary = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null');
      if(summary && summary.name) els.dog.textContent = 'Walking with ' + summary.name;
    } catch(e){}
    tryRestoreDraft();
    // Prime the map on the current position even before Start.
    if(navigator.geolocation) navigator.geolocation.getCurrentPosition(function(pos){
      els.gps.textContent = 'GPS ±' + Math.round(pos.coords.accuracy) + ' m';
      initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, function(){
      els.gps.textContent = 'Location unavailable — check permissions';
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  if(window.DoloPawsAuthReady) boot();
  else window.addEventListener('dolopaws-auth-ready', boot, { once: true });
  window.addEventListener('dolopaws-auth-changed', boot);
  setButtons();
})();
