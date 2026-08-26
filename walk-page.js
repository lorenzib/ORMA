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
  var overlayRegion = 'dolomites';
  var overlayPromises = {};
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
    var walkMapOptions = {
      container: 'wrMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom: fallback ? 9 : 15.5,
      attributionControl: { compact: true },
    };
    map = new maplibregl.Map(window.DoloPawsMapRuntime
      ? window.DoloPawsMapRuntime.mapOptions(walkMapOptions) : walkMapOptions);
    map.on('load', function(){
      if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.enhance(map);
      // Same walkable-network detail as every other ORMA map: marked
      // hiking routes plus subtle relief, under the recording trace.
      var firstLabel = map.getStyle().layers.find(function(l){ return l.type === 'symbol'; });
      map.addSource('waymarked-hiking', {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
      });
      map.addLayer({ id: 'waymarked-hiking-layer', type: 'raster', source: 'waymarked-hiking',
        paint: { 'raster-opacity': 0.54, 'raster-resampling': 'linear' } }, firstLabel ? firstLabel.id : undefined);
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

  function regionForFix(fix){
    // ORMA currently covers Savoy (west of 9°E) and the Dolomites.
    return fix && fix.lng < 9 ? 'savoy' : 'dolomites';
  }

  function regionAsset(key){
    var manifest = window.DoloPawsRegionManifest;
    var region = manifest && manifest.regions && manifest.regions[overlayRegion];
    return region && region[key];
  }

  function pointFeature(feature){
    var geometry = feature && feature.geometry;
    if(!geometry || geometry.type === 'Point') return feature;
    var ring = geometry.type === 'Polygon' ? (geometry.coordinates[0] || [])
      : geometry.type === 'MultiPolygon' ? ((geometry.coordinates[0] || [])[0] || []) : [];
    if(!ring.length) return null;
    var lng = ring.reduce(function(sum, point){ return sum + point[0]; }, 0) / ring.length;
    var lat = ring.reduce(function(sum, point){ return sum + point[1]; }, 0) / ring.length;
    return { type:'Feature', properties:feature.properties || {}, geometry:{ type:'Point', coordinates:[lng, lat] } };
  }

  function addPointOverlay(sourceId, prefix, features, color){
    if(map.getSource(sourceId)) return;
    map.addSource(sourceId, { type:'geojson', data:{ type:'FeatureCollection', features:features }, cluster:true, clusterRadius:50 });
    var before = map.getLayer('walk-line') ? 'walk-line' : undefined;
    map.addLayer({ id:prefix + '-points', type:'circle', source:sourceId,
      filter:['!', ['has', 'point_count']], layout:{ visibility:'none' },
      paint:{ 'circle-radius':6, 'circle-color':color, 'circle-opacity':0.9, 'circle-stroke-width':2, 'circle-stroke-color':'#fff' } }, before);
    map.addLayer({ id:prefix + '-clusters', type:'circle', source:sourceId,
      filter:['has', 'point_count'], layout:{ visibility:'none' },
      paint:{ 'circle-radius':['step', ['get', 'point_count'], 17, 5, 21, 15, 25], 'circle-color':color,
        'circle-opacity':0.82, 'circle-stroke-width':2, 'circle-stroke-color':'#fff' } }, before);
    map.addLayer({ id:prefix + '-cluster-count', type:'symbol', source:sourceId,
      filter:['has', 'point_count'], layout:{ visibility:'none', 'text-field':['get', 'point_count_abbreviated'], 'text-size':11 },
      paint:{ 'text-color':'#fff' } }, before);
    map.on('click', prefix + '-points', function(event){
      var feature = event.features && event.features[0];
      if(!feature) return;
      var properties = feature.properties || {};
      var label = properties.name || properties.label || properties.amenity || properties.tourism || 'Map point';
      new maplibregl.Popup({ offset:12 }).setLngLat(feature.geometry.coordinates).setText(String(label)).addTo(map);
    });
  }

  function ensureWater(){
    if(map.getSource('walk-water')) return Promise.resolve(['walk-water-points','walk-water-clusters','walk-water-cluster-count']);
    if(!overlayPromises.water){
      overlayPromises.water = fetch(regionAsset('water')).then(function(response){
        if(!response.ok) throw new Error('Water layer unavailable');
        return response.json();
      }).then(function(data){
        var points = (data.features || []).map(pointFeature).filter(Boolean);
        addPointOverlay('walk-water', 'walk-water', points, '#4E90A8');
        return ['walk-water-points','walk-water-clusters','walk-water-cluster-count'];
      });
    }
    return overlayPromises.water;
  }

  function ensureAmenities(){
    if(map.getSource('walk-huts') && map.getSource('walk-food')) return Promise.resolve(true);
    if(!overlayPromises.amenities){
      overlayPromises.amenities = fetch(regionAsset('hutsBars')).then(function(response){
        if(!response.ok) throw new Error('Amenity layers unavailable');
        return response.json();
      }).then(function(data){
        var points = (data.features || []).map(pointFeature).filter(Boolean);
        function isHut(feature){
          var p = feature.properties || {};
          return p.tourism === 'alpine_hut' || p.tourism === 'wilderness_hut' || p.amenity === 'shelter';
        }
        addPointOverlay('walk-huts', 'walk-huts', points.filter(isHut), '#8A5A16');
        addPointOverlay('walk-food', 'walk-food', points.filter(function(feature){ return !isHut(feature); }), '#C4652F');
        return true;
      });
    }
    return overlayPromises.amenities;
  }

  function ensureLifts(){
    if(map.getSource('walk-lifts')) return Promise.resolve(['walk-lifts-line','walk-lifts-labels']);
    if(!overlayPromises.lifts){
      overlayPromises.lifts = new Promise(function(resolve, reject){
        function build(){
          if(typeof gondolas === 'undefined') { reject(new Error('Lift layer unavailable')); return; }
          var lifts = gondolas.filter(function(lift){
            var savoy = lift.country === 'FR' || (lift.from && lift.from.lng < 9);
            return overlayRegion === 'savoy' ? savoy : !savoy;
          });
          var features = lifts.map(function(lift){ return { type:'Feature', properties:{ name:lift.name, status:lift.status },
            geometry:{ type:'LineString', coordinates:[[lift.from.lng,lift.from.lat],[lift.to.lng,lift.to.lat]] } }; });
          map.addSource('walk-lifts', { type:'geojson', data:{ type:'FeatureCollection', features:features } });
          var before = map.getLayer('walk-line') ? 'walk-line' : undefined;
          map.addLayer({ id:'walk-lifts-line', type:'line', source:'walk-lifts', layout:{ visibility:'none' },
            paint:{ 'line-color':'#4E90A8', 'line-width':2, 'line-dasharray':['match',['get','status'],'summer',['literal',[1,0]],['literal',[2,1]]] } }, before);
          map.addLayer({ id:'walk-lifts-labels', type:'symbol', source:'walk-lifts', layout:{ visibility:'none',
            'symbol-placement':'line', 'text-field':['get','name'], 'text-size':10 },
            paint:{ 'text-color':'#2E4034', 'text-halo-color':'#fff', 'text-halo-width':1.5 } }, before);
          resolve(['walk-lifts-line','walk-lifts-labels']);
        }
        if(typeof gondolas !== 'undefined'){ build(); return; }
        var script = document.createElement('script');
        script.src = 'trails-data.js?v=20260810';
        script.onload = build;
        script.onerror = function(){ reject(new Error('Lift layer unavailable')); };
        document.head.appendChild(script);
      });
    }
    return overlayPromises.lifts;
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

    function lazyLayerChip(label, loader){
      var on = false;
      var ids = [];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'map-chip';
      chip.textContent = label;
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', function(){
        if(on){
          on = false;
          ids.forEach(function(id){ if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
          chip.classList.remove('on');
          chip.setAttribute('aria-pressed', 'false');
          return;
        }
        chip.disabled = true;
        chip.textContent = 'Loading ' + label.toLowerCase() + '…';
        loader().then(function(layerIds){
          ids = layerIds;
          on = true;
          ids.forEach(function(id){ if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
          chip.classList.add('on');
          chip.setAttribute('aria-pressed', 'true');
          chip.textContent = label;
        }).catch(function(){
          chip.textContent = label + ' unavailable';
        }).finally(function(){ chip.disabled = false; });
      });
      panel.appendChild(chip);
    }
    lazyLayerChip('Lifts', ensureLifts);
    lazyLayerChip('Water', ensureWater);
    lazyLayerChip('Huts', function(){ return ensureAmenities().then(function(){
      return ['walk-huts-points','walk-huts-clusters','walk-huts-cluster-count'];
    }); });
    lazyLayerChip('Food', function(){ return ensureAmenities().then(function(){
      return ['walk-food-points','walk-food-clusters','walk-food-cluster-count'];
    }); });
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
      map.addLayer({ id:'satellite-layer', type:'raster', source:'satellite', layout:{ visibility:'none' },
        paint:{ 'raster-resampling':'linear', 'raster-fade-duration':100 } },
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
    overlayRegion = regionForFix(fix);
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
    window.location.href = '/';
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
