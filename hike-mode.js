/**
 * hike-mode.js — "Start hike" companion for the trail detail page.
 *
 * Turns the trail map into an on-trail companion: live position snapped to
 * the route, progress readout (km walked, next water / rifugio ahead),
 * off-route warning, and a screen wake lock so the phone doesn't sleep
 * mid-hike.
 *
 * Everything works from data already on the trail object (path, distance,
 * rifugi, waterSources) — no network calls, so the safety features keep
 * working even when the signal drops in a valley. Only the map tiles need
 * connectivity, and GPS itself is satellite-based and works offline.
 *
 * Usage: initHikeMode(map, trail) inside trail.js's map 'load' handler,
 * after the route path has been added. Include this file in trail.html
 * BEFORE trail.js.
 */

function initHikeMode(map, trail){
  if (!('geolocation' in navigator)) return; // no GPS — don't show the button
  if (!Array.isArray(trail.path) || trail.path.length < 2) return;

  const container = map.getContainer();
  container.style.position = container.style.position || 'relative';

  // ---- Precompute cumulative distance along the path (meters) -------------
  const M_PER_DEG = 111000;
  function metersBetween(aLat, aLng, bLat, bLng){
    const dLat = (bLat - aLat) * M_PER_DEG;
    const dLng = (bLng - aLng) * M_PER_DEG * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }
  const cum = [0];
  for (let i = 1; i < trail.path.length; i++){
    cum.push(cum[i - 1] + metersBetween(
      trail.path[i - 1][0], trail.path[i - 1][1],
      trail.path[i][0], trail.path[i][1]));
  }
  const totalMeters = cum[cum.length - 1] || 1;
  // Display distances against the trail's stated length so the readout
  // matches the rest of the page (GPS path length can differ slightly).
  const statedKm = trail.distance || totalMeters / 1000;

  // ---- UI elements ---------------------------------------------------------
  const startBtn = document.createElement('button');
  const hikeLabel = (key, fallback) => {
    const text = window.t ? window.t(key) : fallback;
    return String(text || fallback).replace(/^\s*🐾\s*/, '');
  };
  const hikeButtonHtml = label => `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:16px;height:16px;vertical-align:-3px;margin-right:6px;fill:currentColor;"><path d="M12 18.2c-2.4 0-4.2-1.5-4.2-3.6 0-1.4 1.1-2.5 2.5-2.5.7 0 1.2.3 1.7.7.5-.4 1-.7 1.7-.7 1.4 0 2.5 1.1 2.5 2.5 0 2.1-1.8 3.6-4.2 3.6Z"></path><circle cx="6.7" cy="10.4" r="1.7"></circle><circle cx="10.2" cy="8" r="1.7"></circle><circle cx="13.8" cy="8" r="1.7"></circle><circle cx="17.3" cy="10.4" r="1.7"></circle></svg>${label}`;
  startBtn.type = 'button';
  startBtn.id = 'mapStartHikeBtn';
  startBtn.innerHTML = hikeButtonHtml(hikeLabel('hike.start', 'Start hike'));
  startBtn.style.cssText = 'position:absolute;top:10px;left:10px;z-index:6;padding:9px 18px;border-radius:14px;background:var(--ink);color:#fff;border:none;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);';
  container.appendChild(startBtn);

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.textContent = hikeLabel('hike.pause', 'Pause');
  pauseBtn.hidden = true;
  pauseBtn.style.cssText = 'position:absolute;top:10px;left:132px;z-index:6;padding:9px 14px;border-radius:14px;background:#fff;color:var(--ink);border:1px solid rgba(46,64,52,.2);font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);';
  container.appendChild(pauseBtn);

  const panel = document.createElement('div');
  panel.id = 'mapHikeStatus';
  panel.style.cssText = 'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:6;max-width:92%;padding:10px 16px;border-radius:12px;background:rgba(46,64,52,.94);color:#fff;font-size:12.5px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.35);display:none;text-align:center;line-height:1.5;';
  container.appendChild(panel);

  const banner = document.createElement('div');
  banner.id = 'mapHikeOffRoute';
  banner.textContent = window.t ? window.t('hike.offRoute') : '⚠️ Off route';
  banner.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:7;padding:9px 16px;border-radius:12px;background:#9C3A25;color:#fff;font-size:12.5px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.35);display:none;white-space:nowrap;';
  container.appendChild(banner);

  // ---- State ---------------------------------------------------------------
  let active = false;
  let watchId = null;
  let lastTileError = 0;   // last failed tile/style fetch — signals the map may grey out
  let wakeLock = null;
  let lastIdx = 0;          // last snapped path index — used for monotonic bias
  let offRouteStreak = 0;   // consecutive fixes far from the route
  let firstFix = true;
  let hikeStartRecorded = false;
  let hikeStartedAt = null;
  let lastKnownKm = 0;      // furthest progress readout, for the completion stats
  let lastValidFixAt = null;
  let durableSession = null;
  let completionRetry = null;

  function keepSessionResult(result){
    if(result && result.session) durableSession = result.session;
    return !!(result && result.ok);
  }

  function beginDurableSession(){
    if(!window.DoloPawsHikeSession) return;
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    keepSessionResult(window.DoloPawsHikeSession.create({
      trailId: trail.id,
      packageId: trail.offlinePackageId || trail.packageId || `dolopaws-trail:${trail.id}`,
      ownerId: user && user.uid || null,
      startedAt: hikeStartedAt,
    }));
  }

  function persistProgress(km, pathIndex, accuracyM, recordedAt){
    if(!durableSession || !window.DoloPawsHikeSession) return;
    if(!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100) return;
    keepSessionResult(window.DoloPawsHikeSession.updateProgress(durableSession, {
      km,
      pathIndex,
      accuracyM,
      recordedAt,
    }));
  }

  function persistSessionState(state){
    if(!durableSession || !window.DoloPawsHikeSession) return;
    return keepSessionResult(window.DoloPawsHikeSession.setState(
      durableSession,
      state,
      Date.now()
    ));
  }

  function clearDurableSession(){
    if(window.DoloPawsHikeSession) window.DoloPawsHikeSession.clear();
    durableSession = null;
  }

  function setStartLabel(key, fallback){
    startBtn.innerHTML = hikeButtonHtml(hikeLabel(key, fallback));
  }

  // Pulsing "you are here" dot + live pill, shown only while recording. The
  // dot rides the snapped on-path position so it tracks the route like the
  // redesign prototype rather than jittering with raw GPS noise.
  const livePill = document.getElementById('tdLivePill');
  let liveMarker = null;
  function showLiveDot(){
    if (typeof maplibregl === 'undefined') return;
    if (!liveMarker){
      const dot = document.createElement('div');
      dot.className = 'hike-live-dot';
      liveMarker = new maplibregl.Marker({ element: dot });
    }
    liveMarker.setLngLat([trail.path[0][1], trail.path[0][0]]).addTo(map);
    if (livePill) livePill.hidden = false;
  }
  function moveLiveDot(lat, lng){ if (liveMarker) liveMarker.setLngLat([lng, lat]); }
  function hideLiveDot(){
    if (liveMarker){ liveMarker.remove(); }
    if (livePill) livePill.hidden = true;
  }

  // Map tile fetches fail silently when the connection drops mid-hike —
  // navigator.onLine often stays true on a weak mountain signal, so track
  // actual failed fetches too.
  map.on('error', (e) => {
    const msg = e && e.error && (e.error.message || String(e.error));
    if (msg && /fetch|network|failed|abort/i.test(msg)) lastTileError = Date.now();
  });

  function offlineNote(){
    const offline = !navigator.onLine || (Date.now() - lastTileError < 30000);
    return offline
      ? `<br><span style="font-weight:400;opacity:.85;">${window.t('hike.offline')}</span>`
      : '';
  }

  // ---- Wake lock: keep the screen on while hiking --------------------------
  async function acquireWakeLock(){
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* not supported or denied — hike mode still works */ }
  }
  document.addEventListener('visibilitychange', () => {
    // The lock is auto-released when the app backgrounds; re-acquire on return.
    if (active && document.visibilityState === 'visible') acquireWakeLock();
  });

  // ---- Snap a GPS fix to the nearest point on the route --------------------
  // Monotonic bias: when several path points are similarly close (common on
  // out-and-back or tightly-folded loops), prefer the one nearest to where
  // we last were — stops the readout jumping between overlapping segments.
  function snapToPath(lat, lng){
    let minDist = Infinity;
    const dists = new Array(trail.path.length);
    for (let i = 0; i < trail.path.length; i++){
      const d = metersBetween(lat, lng, trail.path[i][0], trail.path[i][1]);
      dists[i] = d;
      if (d < minDist) minDist = d;
    }
    let bestIdx = 0, bestIdxGap = Infinity;
    for (let i = 0; i < dists.length; i++){
      if (dists[i] <= minDist + 25){       // all near-ties within 25 m
        const gap = Math.abs(i - lastIdx);
        if (gap < bestIdxGap){ bestIdxGap = gap; bestIdx = i; }
      }
    }
    return { idx: bestIdx, dist: dists[bestIdx], minDist };
  }

  // ---- Next POI ahead (from km-tagged rifugi / water sources) --------------
  function nextAhead(list, currentKm, labelKey){
    let best = null;
    for (const item of (list || [])){
      if (typeof item.km !== 'number') continue;
      const ahead = item.km - currentKm;
      if (ahead > 0.05 && (!best || ahead < best.ahead)){
        best = { ahead, label: item[labelKey] };
      }
    }
    return best;
  }

  // ---- Per-fix update -------------------------------------------------------
  function onFix(pos){
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const snap = snapToPath(lat, lng);
    const fixTimestamp = Number.isFinite(pos.timestamp) ? pos.timestamp : Date.now();
    const assessment = window.DoloPawsGpsPolicy
      ? window.DoloPawsGpsPolicy.assessFix({
        timestamp: fixTimestamp,
        now: Date.now(),
        accuracyM: accuracy,
        routeDistanceM: snap.minDist,
        previousOffRouteStreak: offRouteStreak,
      })
      : {
        usableForProgress: false,
        reliableForWarning: false,
        offRouteState: 'none',
        nextOffRouteStreak: 0,
        farFromRoute: false,
        freshness: 'unavailable',
      };

    if(firstFix && assessment.usableForProgress){
      firstFix = false;
      recordConfirmedHikeStart();
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
    }

    if(assessment.usableForProgress) lastIdx = snap.idx;
    // Ride the snapped on-path point when near the route; otherwise show the
    // real fix so a lost hiker still sees where they actually are.
    if(assessment.reliableForWarning && snap.minDist <= 60){
      moveLiveDot(trail.path[snap.idx][0], trail.path[snap.idx][1]);
    }
    else moveLiveDot(lat, lng);
    const currentKm = (cum[snap.idx] / totalMeters) * statedKm;
    if(assessment.usableForProgress){
      lastKnownKm = Math.max(lastKnownKm, Math.min(currentKm, statedKm));
      lastValidFixAt = fixTimestamp;
      persistProgress(
        lastKnownKm,
        snap.idx,
        accuracy,
        fixTimestamp
      );
    }

    // Far from the trail entirely (driving there, wrong valley…)
    if(assessment.farFromRoute){
      panel.innerHTML = window.t('hike.far', {
        d: (snap.minDist / 1000).toFixed(1),
      }) + `<br><span style="font-weight:400;opacity:.85;">${
        window.t('hike.gpsLine', {
          accuracy: Math.round(accuracy),
          distance: Math.round(snap.minDist),
          time: new Date(lastValidFixAt || fixTimestamp).toLocaleTimeString(),
        })
      }</span>` + offlineNote();
      banner.style.display = 'none';
      offRouteStreak = assessment.nextOffRouteStreak;
      return;
    }

    offRouteStreak = assessment.nextOffRouteStreak;
    if(assessment.offRouteState === 'confirmed'){
      banner.textContent = window.t('hike.offRouteDistance', {
        distance: Math.round(snap.minDist),
      });
      banner.style.display = 'block';
    }else{
      banner.style.display = 'none';
    }

    // Progress readout
    const displayKm = assessment.usableForProgress ? currentKm : lastKnownKm;
    const parts = [window.t('hike.kmOf', {a: displayKm.toFixed(1), b: statedKm})];
    const water = nextAhead(trail.waterSources, displayKm, 'label');
    if (water) parts.push(window.t('hike.waterIn', {d: water.ahead.toFixed(1)}));
    const hut = nextAhead(trail.rifugi, displayKm, 'name');
    if (hut) parts.push(window.t('hike.hutIn', {name: hut.label, d: hut.ahead.toFixed(1)}));
    const decision = nextAhead(trail.decisionPoints, displayKm, 'instruction');
    if (decision && decision.ahead < 0.5) parts.push(window.t('hike.ahead', {what: decision.label}));
    const validFixLabel = lastValidFixAt
      ? new Date(lastValidFixAt).toLocaleTimeString()
      : '—';
    const reliabilityNote = assessment.freshness === 'stale'
      ? window.t('hike.gpsStale')
      : !assessment.reliableForWarning
        ? window.t('hike.gpsWeak')
        : '';
    panel.innerHTML = parts.join(' · ')
      + `<br><span style="font-weight:400;opacity:.85;">${window.t('hike.gpsLine', {
        accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : '—',
        distance: Math.round(snap.minDist),
        time: validFixLabel,
      })}${reliabilityNote ? `<br>${reliabilityNote}` : ''}</span>`
      + offlineNote();

    // Drive the elevation-profile cursor from live position, if the page has one.
    if (typeof window._dolopawsElevHighlight === 'function'){
      try { window._dolopawsElevHighlight(Math.min(displayKm, statedKm)); } catch (e) {}
    }

    // Let page chrome (the live recording banner) mirror our progress.
    window.dispatchEvent(new CustomEvent('dolopaws-hike-progress', {
      detail: { km: Math.min(displayKm, statedKm), startedAt: hikeStartedAt },
    }));
  }

  function onError(err){
    if(firstFix) clearDurableSession();
    else persistSessionState('paused');
    if (err.code === 1){ // PERMISSION_DENIED
      panel.innerHTML = window.t('hike.permission');
      stopHike(true);
      panel.style.display = 'block';
    } else if (err.code === 2){ // POSITION_UNAVAILABLE
      panel.innerHTML = window.t('hike.unavailable');
      stopHike(true);
      panel.style.display = 'block';
    } else if (err.code === 3){ // TIMEOUT
      panel.innerHTML = window.t('hike.timeout');
      stopHike(true);
      panel.style.display = 'block';
    } else {
      panel.innerHTML = window.t('hike.waiting');
    }
    if(durableSession) setStartLabel('hike.resume', 'Resume hike');
  }

  // ---- Start / stop ---------------------------------------------------------
  function recordConfirmedHikeStart(){
    if (hikeStartRecorded) return;
    hikeStartRecorded = true;
    // One anonymous count event per trail per device per day. A confirmed
    // GPS fix is required, so permission errors do not count as hikes.
    try {
      const guardKey = `dolopaws-hiked-${trail.id}-${new Date().toISOString().slice(0, 10)}`;
      if (!localStorage.getItem(guardKey) && window.DoloPawsCommunity) {
        window.DoloPawsCommunity.recordHikeStart(trail.id).then(ok => {
          if (ok) localStorage.setItem(guardKey, '1');
        });
      }
    } catch (e) { /* private browsing etc. — skip silently */ }
  }

  function startHike(){
    durableSession = null;
    active = true;
    firstFix = true;
    hikeStartRecorded = false;
    hikeStartedAt = Date.now();
    lastKnownKm = 0;
    lastValidFixAt = null;
    offRouteStreak = 0;
    beginDurableSession();
    // A hiker needs a navigation screen, not an article: go fullscreen.
    if (window.DoloPawsMapFS) window.DoloPawsMapFS.enter();
    setStartLabel('hike.end', 'End hike');
    startBtn.style.background = '#9C3A25';
    pauseBtn.hidden = false;
    window.dispatchEvent(new CustomEvent('dolopaws-hike-progress', {
      detail: { km: 0, startedAt: hikeStartedAt },
    }));
    panel.style.display = 'block';
    container.classList.add('hike-status-visible');
    panel.innerHTML = window.t('hike.getting');
    showLiveDot();
    acquireWakeLock();
    watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
  }

  function stopHike(keepPanel){
    active = false;
    if (window.DoloPawsMapFS) window.DoloPawsMapFS.exit();
    if (watchId !== null){ navigator.geolocation.clearWatch(watchId); watchId = null; }
    if (wakeLock){ try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    hideLiveDot();
    setStartLabel('hike.start', 'Start hike');
    startBtn.style.background = 'var(--ink)';
    pauseBtn.hidden = true;
    if (!keepPanel){
      panel.style.display = 'none';
      container.classList.remove('hike-status-visible');
    } else {
      container.classList.add('hike-status-visible');
    }
    banner.style.display = 'none';
  }

  function resumeHike(){
    if(!durableSession) return;
    active = true;
    const progress = durableSession.lastProgress;
    firstFix = !progress;
    hikeStartRecorded = !!progress;
    hikeStartedAt = durableSession.startedAt;
    lastKnownKm = progress ? progress.km : 0;
    lastIdx = progress ? progress.pathIndex : 0;
    lastValidFixAt = progress ? progress.recordedAt : null;
    offRouteStreak = 0;
    persistSessionState('active');
    if(window.DoloPawsMapFS) window.DoloPawsMapFS.enter();
    setStartLabel('hike.end', 'End hike');
    startBtn.style.background = '#9C3A25';
    startBtn.disabled = false;
    pauseBtn.hidden = false;
    panel.style.display = 'block';
    container.classList.add('hike-status-visible');
    panel.innerHTML = window.t('hike.getting');
    showLiveDot();
    acquireWakeLock();
    window.dispatchEvent(new CustomEvent('dolopaws-hike-progress', {
      detail: { km: lastKnownKm, startedAt: hikeStartedAt },
    }));
    watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
  }

  function pauseHike(){
    if(!active || !durableSession) return;
    persistSessionState('paused');
    stopHike(true);
    setStartLabel('hike.resume', 'Resume hike');
    panel.textContent = window.t('hike.paused');
  }

  function persistCompletionAndShow(completedAt){
    if(!durableSession || !window.DoloPawsHikeCompletions) return false;
    persistSessionState('completion-pending');
    const result = window.DoloPawsHikeCompletions.save(durableSession, {
      completedAt,
      distanceKm: lastKnownKm,
    });
    if(!result.ok){
      stopHike(true);
      completionRetry = () => persistCompletionAndShow(completedAt);
      startBtn.disabled = false;
      setStartLabel('hike.retryFinish', 'Save completed hike');
      panel.textContent = window.t('hike.completionSaveFailed');
      return false;
    }
    completionRetry = null;
    clearDurableSession();
    stopHike(false);
    showCompletionScreen(result.record);
    return true;
  }

  function finishHike(){
    const hadGpsFix = !firstFix;
    if(!hadGpsFix){
      clearDurableSession();
      stopHike(false);
      return;
    }
    persistCompletionAndShow(Date.now());
  }

  // ---- Completion screen: save / discard, photos, share-to-trail flag ------
  // Replaces the old "Hike ended — log this walk →" link with the design's
  // full-screen summary. Saving writes straight into the walk journal store
  // (same schema journal.html reads), carrying { photos, shareToTrail } —
  // the flag the trail page checks before surfacing a walk's photos.
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function fmtClock(sec){
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  function dogSummary(){
    let name = '';
    try {
      const raw = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null');
      if (raw && raw.name) name = String(raw.name);
    } catch (e) {}
    let photo = null;
    try {
      const v = localStorage.getItem('dolopaws-dog-photo');
      if (typeof v === 'string' && v.startsWith('data:image/')) photo = v;
    } catch (e) {}
    return { name, photo };
  }

  function showCompletionScreen(completion){
    const elapsedSeconds = completion.durationSeconds;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const dog = dogSummary();
    const dogName = dog.name || 'Your dog';
    const km = completion.distanceKm;
    const pace = km > 0.1 ? (elapsedMinutes / km).toFixed(1) + ' min/km' : '—';
    const SAFETY_LABEL = { 'low-risk': 'Low-risk', 'moderate': 'Moderate', 'caution': 'Caution' };
    const safetyClass = trail.safetyLevel === 'low-risk' ? 'safety-low'
      : trail.safetyLevel === 'caution' ? 'safety-caution' : 'safety-moderate';
    // The trail page already computed the personal match — reuse its figure.
    const scoreEl = document.querySelector('.personal-score b');
    const matchPct = scoreEl ? parseInt(scoreEl.textContent, 10) : NaN;

    const photos = [];       // { file, url }
    let cond = 'Comfortable';
    let shareOn = true;

    const overlay = document.createElement('div');
    overlay.className = 'hk-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'hkTitle');
    overlay.innerHTML = `
      <div class="hk-card">
        <div class="hk-avatar"${dog.photo ? ` style="background-image:url(${dog.photo});"` : ''}>${dog.photo ? '' : esc(dogName.charAt(0).toUpperCase() || '🐾')}</div>
        <h1 class="hk-title" id="hkTitle">${esc(window.t('hike.completedTitle', {name: dogName}))}</h1>
        <p class="hk-sub">${esc(trail.name)}</p>
        <div class="hk-stats">
          <div class="hk-stat"><b>${fmtClock(elapsedSeconds)}</b><span>${esc(window.t('hike.statTime'))}</span></div>
          <div class="hk-stat"><b>${km.toFixed(1)} km</b><span>${esc(window.t('hike.statDistance'))}</span></div>
          <div class="hk-stat"><b>${pace}</b><span>${esc(window.t('hike.statPace'))}</span></div>
        </div>
        <div class="hk-matchline">
          <span class="safety-badge ${safetyClass}">${esc(SAFETY_LABEL[trail.safetyLevel] || 'Moderate')}</span>
          ${Number.isFinite(matchPct) ? `<span class="pct">${esc(window.t('hike.matchFor', {pct: matchPct, name: dogName}))}</span>` : ''}
        </div>
        <div class="hk-block">
          <div class="hk-label">${esc(window.t('hike.feel'))}</div>
          <div class="hk-seg" id="hkCondSeg" role="radiogroup" aria-label="${esc(window.t('hike.feel'))}"></div>
        </div>
        <div class="hk-block">
          <div class="hk-label">${esc(window.t('hike.photos'))}</div>
          <div class="hk-photos" id="hkPhotos"></div>
          <div class="hk-share" id="hkShareRow" hidden>
            <span><b>${esc(window.t('hike.shareTitle'))}</b><small>${esc(window.t('hike.shareSub'))}</small></span>
            <button type="button" class="li-switch on" id="hkShareToggle" role="switch" aria-checked="true" aria-label="${esc(window.t('hike.shareTitle'))}"><span class="knob"></span></button>
          </div>
        </div>
        <div id="hkDiscardNote" class="hk-discard-note" hidden>
          <p>${esc(window.t('hike.discardConfirm'))}</p>
          <div class="row">
            <button type="button" class="hk-ghost" id="hkKeepBtn" style="flex:1;">${esc(window.t('hike.keep'))}</button>
            <button type="button" class="hk-danger" id="hkDiscardConfirmBtn">${esc(window.t('hike.discard'))}</button>
          </div>
        </div>
        <div class="hk-actions" id="hkActions">
          <button type="button" class="hk-ghost" id="hkDiscardBtn">${esc(window.t('hike.discard'))}</button>
          <button type="button" class="hk-save" id="hkSaveBtn">${esc(window.t('hike.saveJournal'))}</button>
        </div>
        <input type="file" accept="image/*" multiple id="hkPhotoInput" hidden>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const q = sel => overlay.querySelector(sel);

    function renderCond(){
      const seg = q('#hkCondSeg');
      seg.innerHTML = '';
      ['Comfortable', 'Warm', 'Hot'].forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = c;
        b.className = c === cond ? 'on' : '';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(c === cond));
        b.addEventListener('click', () => { cond = c; renderCond(); });
        seg.appendChild(b);
      });
    }

    function renderPhotos(){
      const grid = q('#hkPhotos');
      grid.innerHTML = '';
      photos.forEach((p, i) => {
        const cell = document.createElement('div');
        cell.className = 'hk-photo';
        cell.style.backgroundImage = `url(${p.url})`;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.setAttribute('aria-label', window.t('hike.removePhoto'));
        rm.addEventListener('click', () => {
          URL.revokeObjectURL(p.url);
          photos.splice(i, 1);
          renderPhotos();
        });
        cell.appendChild(rm);
        grid.appendChild(cell);
      });
      if (photos.length < 4){
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'hk-add';
        add.textContent = '+';
        add.setAttribute('aria-label', window.t('hike.addPhoto'));
        add.addEventListener('click', () => q('#hkPhotoInput').click());
        grid.appendChild(add);
      }
      q('#hkShareRow').hidden = photos.length === 0;
    }

    q('#hkPhotoInput').addEventListener('change', (e) => {
      Array.from(e.target.files || []).slice(0, 4 - photos.length).forEach(file => {
        if (!/^image\//.test(file.type)) return;
        photos.push({ file, url: URL.createObjectURL(file) });
      });
      e.target.value = '';
      renderPhotos();
    });

    const shareToggle = q('#hkShareToggle');
    shareToggle.addEventListener('click', () => {
      shareOn = !shareOn;
      shareToggle.classList.toggle('on', shareOn);
      shareToggle.setAttribute('aria-checked', String(shareOn));
    });

    function closeOverlay(){
      photos.forEach(p => URL.revokeObjectURL(p.url));
      overlay.remove();
      document.body.style.overflow = '';
    }

    q('#hkDiscardBtn').addEventListener('click', () => {
      q('#hkDiscardNote').hidden = false;
      q('#hkActions').hidden = true;
    });
    q('#hkKeepBtn').addEventListener('click', () => {
      q('#hkDiscardNote').hidden = true;
      q('#hkActions').hidden = false;
    });
    q('#hkDiscardConfirmBtn').addEventListener('click', () => {
      if(window.DoloPawsHikeCompletions){
        window.DoloPawsHikeCompletions.markFollowUp(
          completion.completionId,
          'discarded'
        );
      }
      closeOverlay();
    });

    q('#hkSaveBtn').addEventListener('click', () => {
      const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
      if (!user){
        // Guests fall back to the journal's pending-walk flow, which asks
        // them to log in first (photos can't follow it).
        const returnToTrail = `trail.html?id=${encodeURIComponent(trail.id)}`;
        window.location.href = `journal.html?trail=${encodeURIComponent(trail.id)}&duration=${elapsedMinutes}&completion=${encodeURIComponent(completion.completionId)}&from=${encodeURIComponent(returnToTrail)}`;
        return;
      }
      const entry = {
        id: 'w' + Date.now(),
        date: new Date().toISOString(),
        trailId: trail.id,
        trail: trail.name,
        region: trail.valley || trail.area || '',
        dist: km > 0.1 ? km.toFixed(1) : '',
        dur: String(elapsedMinutes),
        cond,
        rating: null,
        note: '',
        photos: photos.length,
        shareToTrail: photos.length > 0 && shareOn,
      };
      let saved = false;
      try {
        const key = `dolopaws-journal-${user.uid}`;
        const entries = JSON.parse(localStorage.getItem(key) || '[]');
        entries.unshift(entry);
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem(key, JSON.stringify(entries));
        saved = true;
      } catch (e) { /* storage full/blocked — still leave the page gracefully */ }
      if(saved && window.DoloPawsHikeCompletions){
        window.DoloPawsHikeCompletions.markFollowUp(
          completion.completionId,
          'journal-saved'
        );
      }
      closeOverlay();
      window.location.href = 'journal.html';
    });

    renderCond();
    renderPhotos();
    const firstBtn = q('#hkSaveBtn');
    if (firstBtn) firstBtn.focus();
  }

  function recoveryActions(includeResume, otherTrailId, showDownloads){
    const actions = document.createElement('span');
    actions.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-top:8px;flex-wrap:wrap;';
    if(includeResume){
      const resume = document.createElement('button');
      resume.type = 'button';
      resume.textContent = window.t('hike.resume');
      resume.addEventListener('click', resumeHike);
      actions.appendChild(resume);
    }
    if(otherTrailId){
      const open = document.createElement('a');
      open.href = `trail.html?id=${encodeURIComponent(otherTrailId)}`;
      open.textContent = window.t('hike.openTrail');
      open.style.cssText = 'color:#fff;padding:6px 8px;font-weight:800;';
      actions.appendChild(open);
    }
    if(showDownloads){
      const downloads = document.createElement('a');
      downloads.href = 'downloads.html';
      downloads.textContent = window.t('hike.openDownloads');
      downloads.style.cssText = 'color:#fff;padding:6px 8px;font-weight:800;';
      actions.appendChild(downloads);
    }
    const discard = document.createElement('button');
    discard.type = 'button';
    discard.textContent = window.t('hike.discard');
    discard.style.background = '#9C3A25';
    discard.addEventListener('click', () => {
      clearDurableSession();
      panel.style.display = 'none';
      container.classList.remove('hike-status-visible');
      startBtn.disabled = false;
      setStartLabel('hike.start', 'Start hike');
    });
    actions.appendChild(discard);
    panel.appendChild(actions);
  }

  async function checkForRecovery(){
    if(!window.DoloPawsHikeSession || active) return;
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    let packageAvailable = true;
    if(!navigator.onLine){
      packageAvailable = false;
      if(window.DoloPawsOffline && window.DoloPawsOffline.inspectPackage){
        try {
          const inspection = await window.DoloPawsOffline.inspectPackage(trail.id);
          packageAvailable = !!inspection.usable;
        } catch (error) {}
      }
    }
    const recovery = window.DoloPawsHikeSession.recoveryState({
      trailId: trail.id,
      ownerId: user && user.uid || null,
      packageAvailable,
    });
    if(recovery.status === 'empty' || recovery.status === 'unavailable' ||
       recovery.status === 'owner-mismatch'){
      if(recovery.status === 'owner-mismatch'){
        durableSession = null;
        panel.style.display = 'none';
        container.classList.remove('hike-status-visible');
        startBtn.disabled = false;
        setStartLabel('hike.start', 'Start hike');
      }
      return;
    }

    panel.style.display = 'block';
    container.classList.add('hike-status-visible');
    if(recovery.status === 'ready'){
      durableSession = recovery.session;
      if(durableSession.state === 'completion-pending'){
        completionRetry = () => persistCompletionAndShow(durableSession.updatedAt);
        startBtn.disabled = false;
        setStartLabel('hike.retryFinish', 'Save completed hike');
        panel.textContent = window.t('hike.completionPending');
        recoveryActions(false);
        return;
      }
      const progress = durableSession.lastProgress;
      panel.innerHTML = `<strong>${window.t('hike.restoreTitle')}</strong><br>${
        window.t('hike.restoreBody', {
          time: new Date(durableSession.startedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          km: progress ? progress.km.toFixed(1) : '0.0',
        })
      }`;
      setStartLabel('hike.resume', 'Resume hike');
      recoveryActions(true);
      return;
    }
    startBtn.disabled = true;
    if(recovery.status === 'other-trail'){
      panel.textContent = window.t('hike.otherTrail');
      recoveryActions(false, recovery.session && recovery.session.trailId);
    }else if(recovery.status === 'missing-package'){
      panel.textContent = window.t('hike.missingPackage');
      recoveryActions(false, null, true);
    }else{
      panel.textContent = recovery.status === 'expired'
        ? window.t('hike.expired')
        : window.t('hike.corrupt');
      recoveryActions(false);
    }
  }

  startBtn.addEventListener('click', () => {
    if(active) finishHike();
    else if(completionRetry) completionRetry();
    else if(durableSession) resumeHike();
    else startHike();
  });
  pauseBtn.addEventListener('click', pauseHike);

  if(window.DoloPawsAuth) checkForRecovery();
  else window.addEventListener('dolopaws-auth-ready', checkForRecovery, { once: true });
  window.addEventListener('dolopaws-auth-changed', checkForRecovery);

  // Deep link from the journal's "Track it live instead →": start recording
  // straight away (the browser still gates this behind its location prompt).
  if (new URLSearchParams(window.location.search).get('hike') === '1'){
    setTimeout(async () => {
      await checkForRecovery();
      const loaded = window.DoloPawsHikeSession && window.DoloPawsHikeSession.load();
      if(!active && !durableSession && (!loaded || loaded.status === 'empty')) startHike();
    }, 400);
  }
}
