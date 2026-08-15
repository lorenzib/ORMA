(function(){
  'use strict';

  const PACKAGE_MANIFESTS = Object.freeze({
    'lago-carezza': 'packages/lago-carezza/manifest.json',
    'alpe-siusi': 'packages/alpe-siusi/manifest.json',
  });
  let manifestUrl = null;
  let watchId = null;
  let activeSession = null;
  let routeCoordinates = [];
  let footpathGraph = null;
  let routeTotalM = 0;
  let routeIsLoop = false;
  let elevationProfile = null;
  let distanceTracker = null;
  let latestFix = null;
  let manualRejoinActive = false;
  let activeBounds = null;
  let offRouteStreak = 0;
  let offRouteSince = null;
  let lastValidFixAt = null;
  let completedRecord = null;

  const elements = {
    trailName: document.getElementById('trailName'),
    packageState: document.getElementById('packageState'),
    mapSection: document.getElementById('mapSection'),
    factsSection: document.getElementById('factsSection'),
    sourceSection: document.getElementById('sourceSection'),
    failure: document.getElementById('failure'),
    failureMessage: document.getElementById('failureMessage'),
    offlineMap: document.getElementById('offlineMap'),
    mapFrame: document.getElementById('mapFrame'),
    locationButton: document.getElementById('locationButton'),
    locationState: document.getElementById('locationState'),
    rejoinButton: document.getElementById('offlineRejoinBtn'),
    positionDot: document.getElementById('positionDot'),
    rejoinDirection: document.getElementById('rejoinDirection'),
    rejoinDirectionLine: document.getElementById('rejoinDirectionLine'),
    rejoinTarget: document.getElementById('rejoinTarget'),
    routeWarning: document.getElementById('offlineRouteWarning'),
    hikeRecovery: document.getElementById('hikeRecovery'),
    hikeRecoveryTitle: document.getElementById('hikeRecoveryTitle'),
    hikeRecoveryMessage: document.getElementById('hikeRecoveryMessage'),
    hikeResumeButton: document.getElementById('hikeResumeBtn'),
    hikePauseButton: document.getElementById('hikePauseBtn'),
    hikeFinishButton: document.getElementById('hikeFinishBtn'),
    hikeDiscardButton: document.getElementById('hikeDiscardBtn'),
    offlineOutcome: document.getElementById('offlineOutcome'),
    offlineOutcomeResponses: document.getElementById('offlineOutcomeResponses'),
    offlineOutcomeWater: document.getElementById('offlineOutcomeWater'),
    offlineOutcomeHazards: document.getElementById('offlineOutcomeHazards'),
    offlineOutcomeSave: document.getElementById('offlineOutcomeSave'),
    offlineOutcomeStatus: document.getElementById('offlineOutcomeStatus'),
    facts: document.getElementById('facts'),
    cautions: document.getElementById('cautions'),
    emergency: document.getElementById('emergency'),
    verificationNotice: document.getElementById('verificationNotice'),
    packageMeta: document.getElementById('packageMeta'),
    licenceLink: document.getElementById('licenceLink'),
    networkState: document.getElementById('networkState'),
    elevation: document.getElementById('offlineElevation'),
    elevationArea: document.getElementById('offlineElevationArea'),
    elevationLine: document.getElementById('offlineElevationLine'),
    elevationCursor: document.getElementById('offlineElevationCursor'),
    elevationLive: document.getElementById('offlineElevationLive'),
    elevationStart: document.getElementById('offlineElevationStart'),
    elevationHigh: document.getElementById('offlineElevationHigh'),
    elevationClimb: document.getElementById('offlineElevationClimb'),
  };

  function bytesToHex(buffer){
    return Array.from(new Uint8Array(buffer))
      .map(value => value.toString(16).padStart(2, '0'))
      .join('');
  }

  async function sha256(buffer){
    if(!(window.crypto && window.crypto.subtle)) throw new Error('Package verification is unavailable.');
    return bytesToHex(await window.crypto.subtle.digest('SHA-256', buffer));
  }

  async function verifiedResource(resource){
    const response = await fetch(new URL(resource.url, new URL(manifestUrl, window.location.href)));
    if(!response.ok) throw new Error(`${resource.label || resource.url} is missing.`);
    const buffer = await response.arrayBuffer();
    if(buffer.byteLength !== resource.bytes) throw new Error(`${resource.label || resource.url} has changed size.`);
    if(await sha256(buffer) !== resource.sha256) throw new Error(`${resource.label || resource.url} failed verification.`);
    return new Response(buffer, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' } });
  }

  function formatBytes(bytes){
    return bytes < 1024 * 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function verificationLabel(status){
    if(status === 'field-review-required'){
      return 'Beta trail information. Check posted signs and local notices.';
    }
    if(['verified', 'vetted', 'dolopaws-vetted', 'field-checked'].includes(status)){
      return 'Vetted by ORMA.';
    }
    return 'Trail review status unavailable.';
  }

  function setNetworkState(){
    elements.networkState.textContent = navigator.onLine
      ? 'Browser reports online'
      : 'Browser reports offline';
  }

  function showFailure(message){
    elements.mapSection.hidden = true;
    elements.factsSection.hidden = true;
    elements.sourceSection.hidden = true;
    elements.failure.hidden = false;
    elements.packageState.textContent = 'Package verification failed.';
    elements.failureMessage.textContent = message;
  }

  function addFact(label, value){
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    elements.facts.append(term, detail);
  }

  function positionPercent(lat, lng, bounds){
    return {
      x: (lng - bounds.west) / (bounds.east - bounds.west) * 100,
      y: (bounds.north - lat) / (bounds.north - bounds.south) * 100,
    };
  }

  function metersBetween(aLat, aLng, bLat, bLng){
    const metresPerDegree = 111000;
    const dLat = (bLat - aLat) * metresPerDegree;
    const dLng = (bLng - aLng) * metresPerDegree *
      Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }

  function routeProgress(lat, lng){
    if(routeCoordinates.length < 2) return null;
    const route = routeCoordinates.map(([routeLng, routeLat]) => ({
      lat: routeLat,
      lng: routeLng,
    }));
    const rejoin = window.DoloPawsRouteRejoin &&
      window.DoloPawsRouteRejoin.guidance({ lat, lng }, route);
    if(!rejoin) return null;
    const cumulative = [0];
    for(let index = 1; index < routeCoordinates.length; index++){
      const [routeLng, routeLat] = routeCoordinates[index];
      const [previousLng, previousLat] = routeCoordinates[index - 1];
      cumulative.push(cumulative[index - 1] +
        metersBetween(previousLat, previousLng, routeLat, routeLng));
    }
    const segmentStart = routeCoordinates[rejoin.segmentIndex];
    const segmentEnd = routeCoordinates[rejoin.segmentIndex + 1];
    const segmentM = metersBetween(
      segmentStart[1], segmentStart[0], segmentEnd[1], segmentEnd[0]
    );
    return {
      pathIndex: rejoin.segmentFraction >= 0.5
        ? rejoin.segmentIndex + 1
        : rejoin.segmentIndex,
      km: (cumulative[rejoin.segmentIndex] + segmentM * rejoin.segmentFraction) / 1000,
      nearestM: rejoin.distanceM,
      rejoin,
    };
  }

  function elevationAtKm(profile, km){
    return window.DoloPawsOfflineElevation
      ? window.DoloPawsOfflineElevation.elevationAtKm(profile, km)
      : null;
  }

  function validElevationProfile(profile, trailId){
    return !!(window.DoloPawsOfflineElevation &&
      window.DoloPawsOfflineElevation.validProfile(profile, trailId));
  }

  function renderElevationProfile(profile){
    const points = profile.points;
    const geometry = window.DoloPawsOfflineElevation.chartGeometry(profile, 600, 150);
    elements.elevationLine.setAttribute('d', geometry.line);
    elements.elevationArea.setAttribute('d', geometry.area);
    elements.elevationStart.textContent = `${Math.round(points[0].elev)} m`;
    elements.elevationHigh.textContent = `${Math.round(geometry.high)} m`;
    elements.elevationClimb.textContent = `${Math.round(profile.ascentM)} m`;
    elements.elevation.hidden = false;
  }

  function updateElevationCursor(progress){
    if(!elevationProfile || !progress){
      elements.elevationCursor.hidden = true;
      if(elevationProfile) elements.elevationLive.textContent = 'Waiting for reliable GPS';
      return;
    }
    const km = Math.max(0, Math.min(progress.km, elevationProfile.distanceKm));
    const x = window.DoloPawsOfflineElevation.chartGeometry(
      elevationProfile, 600, 150
    ).xForKm(km);
    const elevation = elevationAtKm(elevationProfile, km);
    elements.elevationCursor.setAttribute('x1', x.toFixed(1));
    elements.elevationCursor.setAttribute('x2', x.toFixed(1));
    elements.elevationCursor.hidden = false;
    elements.elevationLive.textContent = `${km.toFixed(1)} km · ~${Math.round(elevation)} m route elevation`;
  }

  function hideRejoinGuidance(){
    elements.rejoinDirection.hidden = true;
    elements.rejoinTarget.hidden = true;
  }

  function mappedRejoinGuidance(){
    return latestFix && footpathGraph && window.DoloPawsFootpathRouter
      ? window.DoloPawsFootpathRouter.routeToTrail(
        { lat:latestFix.lat, lng:latestFix.lng },
        footpathGraph,
        {
          maxSnapDistanceM:Math.min(60, Math.max(25, latestFix.accuracy + 10)),
          maxRouteDistanceM:1500,
        }
      )
      : null;
  }

  function renderManualRejoin(){
    const guidance = mappedRejoinGuidance();
    elements.routeWarning.textContent = guidance
      ? `Rejoin trail: follow the blue mapped path for about ${Math.round(guidance.distanceM)} m. Check local signs and closures.`
      : 'No connected mapped footpath was found. Return to the last marked path or follow local signs.';
    elements.routeWarning.hidden = false;
    if(guidance && activeBounds) showRejoinGuidance(guidance, activeBounds);
    else hideRejoinGuidance();
  }

  function showRejoinGuidance(guidance, bounds){
    const target = positionPercent(
      guidance.target.lat,
      guidance.target.lng,
      bounds
    );
    elements.rejoinTarget.style.left = `${target.x}%`;
    elements.rejoinTarget.style.top = `${target.y}%`;
    elements.rejoinTarget.hidden = false;
    elements.rejoinDirectionLine.setAttribute('points', guidance.path.map(point => {
      const projected = positionPercent(point.lat, point.lng, bounds);
      return `${projected.x},${projected.y}`;
    }).join(' '));
    elements.rejoinDirection.hidden = false;
  }

  function keepSessionResult(result){
    if(result && result.session) activeSession = result.session;
    return !!(result && result.ok);
  }

  function stopLocation(message){
    if(watchId !== null){
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    elements.positionDot.hidden = true;
    elements.locationButton.textContent = 'Show my position';
    elements.locationButton.disabled = false;
    elements.routeWarning.hidden = true;
    elements.rejoinButton.hidden = true;
    manualRejoinActive = false;
    latestFix = null;
    hideRejoinGuidance();
    offRouteStreak = 0;
    offRouteSince = null;
    updateElevationCursor(null);
    if(message) elements.locationState.textContent = message;
  }

  function startLocation(bounds){
    if(!('geolocation' in navigator)){
      elements.locationState.textContent = 'GPS is not supported in this browser.';
      return;
    }
    if(watchId !== null){
      if(activeSession && activeSession.state === 'active') pauseRecoveredHike();
      else stopLocation('GPS stopped.');
      return;
    }
    elements.locationButton.disabled = true;
    activeBounds = bounds;
    elements.locationState.textContent = 'Waiting for a GPS fix…';
    watchId = navigator.geolocation.watchPosition(position => {
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = 'Stop GPS';
      const point = positionPercent(position.coords.latitude, position.coords.longitude, bounds);
      const onMap = point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100;
      elements.positionDot.hidden = !onMap;
      if(onMap){
        elements.positionDot.style.left = `${point.x}%`;
        elements.positionDot.style.top = `${point.y}%`;
      }
      const progress = routeProgress(position.coords.latitude, position.coords.longitude);
      const fixTimestamp = Number.isFinite(position.timestamp)
        ? position.timestamp
        : Date.now();
      latestFix = {
        lat:position.coords.latitude,
        lng:position.coords.longitude,
        accuracy:position.coords.accuracy,
      };
      const assessment = progress && window.DoloPawsGpsPolicy
        ? window.DoloPawsGpsPolicy.assessFix({
          timestamp: fixTimestamp,
          now: Date.now(),
          accuracyM: position.coords.accuracy,
          routeDistanceM: progress.nearestM,
          previousOffRouteStreak: offRouteStreak,
          previousOffRouteSince: offRouteSince,
        })
        : null;
      updateElevationCursor(assessment && assessment.usableForProgress &&
        !assessment.farFromRoute ? progress : null);
      offRouteStreak = assessment ? assessment.nextOffRouteStreak : 0;
      offRouteSince = assessment ? assessment.nextOffRouteSince : null;
      if(assessment && assessment.usableForProgress) lastValidFixAt = fixTimestamp;
      if(activeSession && activeSession.state === 'active' &&
         assessment && assessment.usableForProgress && progress.nearestM <= 2000){
          if(window.DoloPawsHikeDistance){
            distanceTracker = window.DoloPawsHikeDistance.update(
              distanceTracker || window.DoloPawsHikeDistance.create(
                activeSession.lastProgress && activeSession.lastProgress.km || 0
              ),
              {
                lat:position.coords.latitude,
                lng:position.coords.longitude,
                timestamp:fixTimestamp,
                accuracyM:position.coords.accuracy,
                routePositionM:progress.km * 1000,
                nearRoute:progress.nearestM <= 60,
                usable:true,
              },
              { totalRouteM:routeTotalM, loop:routeIsLoop }
            );
          }
          keepSessionResult(window.DoloPawsHikeSession.updateProgress(activeSession, {
            km:distanceTracker ? distanceTracker.distanceM / 1000 : 0,
            pathIndex: progress.pathIndex,
            accuracyM: position.coords.accuracy,
            recordedAt: fixTimestamp,
          }));
      }
      if(assessment && assessment.farFromRoute){
        elements.routeWarning.textContent =
          `You are about ${(progress.nearestM / 1000).toFixed(1)} km from this route. ` +
          'Rejoin guidance is unavailable this far away; use an official navigation source.';
        elements.routeWarning.hidden = false;
        elements.rejoinButton.hidden = true;
        manualRejoinActive = false;
        hideRejoinGuidance();
      }else{
        const rejoinAvailable = assessment && assessment.usableForProgress &&
          !!footpathGraph && progress.nearestM > Math.max(15, position.coords.accuracy * 0.5) &&
          progress.nearestM <= 1500;
        elements.rejoinButton.hidden = !rejoinAvailable;
        if(!rejoinAvailable) manualRejoinActive = false;
        if(manualRejoinActive){
          renderManualRejoin();
        }else if(assessment && assessment.offRouteState === 'confirmed'){
          elements.routeWarning.textContent =
            `You appear to be off route · about ${Math.round(progress.nearestM)} m away.`;
          elements.routeWarning.hidden = false;
          hideRejoinGuidance();
        }else{
          elements.routeWarning.hidden = true;
          hideRejoinGuidance();
        }
      }
      const reliability = !assessment
        ? 'Route distance unavailable.'
        : assessment.freshness === 'stale'
          ? 'GPS fix is stale; waiting for a newer position.'
          : !assessment.reliableForWarning
            ? 'GPS is weak; off-route warnings are paused.'
            : '';
      const lastFixText = lastValidFixAt
        ? new Date(lastValidFixAt).toLocaleTimeString()
        : 'none yet';
      const positionSummary = assessment
        ? assessment.farFromRoute
          ? `${(progress.nearestM / 1000).toFixed(1)} km from this route`
          : assessment.offRouteState === 'confirmed'
            ? `About ${Math.round(progress.nearestM)} m from the trail`
            : assessment.offRouteState === 'possible'
              ? 'Checking route position'
              : assessment.upperBoundM < window.DoloPawsGpsPolicy.THRESHOLDS.onRouteM
                ? 'On trail'
                : 'Position near trail'
        : '';
      elements.locationState.textContent = assessment
        ? `${activeSession && activeSession.lastProgress ? `Walked ${activeSession.lastProgress.km.toFixed(1)} km · ` : ''}${positionSummary} · GPS ±${Math.round(position.coords.accuracy)} m · ` +
          `last valid fix ${lastFixText}${reliability ? ` · ${reliability}` : ''}`
        : onMap
          ? 'GPS position found; route distance unavailable.'
          : 'Your GPS position is outside this downloaded map.';
    }, error => {
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = 'Try GPS again';
      watchId = null;
      hideRejoinGuidance();
      elements.rejoinButton.hidden = true;
      manualRejoinActive = false;
      if(activeSession && activeSession.state === 'active'){
        keepSessionResult(window.DoloPawsHikeSession.setState(
          activeSession,
          'paused',
          Date.now()
        ));
        elements.hikeRecoveryTitle.textContent = 'Hike paused';
        elements.hikeResumeButton.hidden = false;
        elements.hikePauseButton.hidden = true;
      }
      elements.locationState.textContent = error.code === 1
        ? 'Location permission was denied. Enable it for ORMA in browser settings.'
        : 'A GPS fix is currently unavailable. The stored route remains visible.';
    }, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
  }

  function recoveryMessage(session){
    const progress = session.lastProgress;
    const time = new Date(session.startedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Started ${time} · last saved progress ${
      progress ? `${progress.km.toFixed(1)} km` : 'at the trailhead'
    }.`;
  }

  function showRecoveryIssue(title, message){
    elements.hikeRecovery.hidden = false;
    elements.hikeRecoveryTitle.textContent = title;
    elements.hikeRecoveryMessage.textContent = message;
    elements.hikeResumeButton.hidden = true;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = true;
    elements.hikeDiscardButton.hidden = false;
  }

  function resumeRecoveredHike(bounds){
    if(!activeSession) return;
    keepSessionResult(window.DoloPawsHikeSession.setState(
      activeSession,
      'active',
      Date.now()
    ));
    elements.hikeRecoveryTitle.textContent = 'Hike resumed';
    elements.hikeRecoveryMessage.textContent =
      'GPS tracking is active. Your latest valid progress stays saved on this device.';
    elements.hikeResumeButton.hidden = true;
    elements.hikePauseButton.hidden = false;
    elements.hikeFinishButton.hidden = false;
    startLocation(bounds);
  }

  function pauseRecoveredHike(){
    if(activeSession){
      keepSessionResult(window.DoloPawsHikeSession.setState(
        activeSession,
        'paused',
        Date.now()
      ));
    }
    stopLocation('Hike paused. Your progress is saved on this device.');
    elements.hikeRecoveryTitle.textContent = 'Hike paused';
    elements.hikeRecoveryMessage.textContent = activeSession
      ? recoveryMessage(activeSession)
      : 'Your progress is saved on this device.';
    elements.hikeResumeButton.hidden = false;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = false;
  }

  function showOfflineOutcome(completion){
    completedRecord = completion;
    elements.offlineOutcome.hidden = false;
    elements.offlineOutcomeStatus.textContent = completion.ownerId
      ? 'Choose one response. It will be stored privately on this device.'
      : 'This completion has no account owner, so private feedback cannot be saved.';
    elements.offlineOutcomeSave.disabled = true;
  }

  function selectedOutcomeResponse(){
    const selected = elements.offlineOutcomeResponses.querySelector(
      'input[name="offlineOutcomeResponse"]:checked'
    );
    return selected ? selected.value : null;
  }

  async function saveOfflineOutcome(){
    if(!completedRecord || !completedRecord.ownerId ||
       !window.DoloPawsPostHikeOutcomes) return;
    const response = selectedOutcomeResponse();
    if(!response) return;
    const hazards = Array.from(
      elements.offlineOutcomeHazards.querySelectorAll('input:checked'),
      input => input.value
    );
    const result = window.DoloPawsPostHikeOutcomes.save(
      completedRecord,
      {
        response,
        waterAccuracy:elements.offlineOutcomeWater.value || null,
        hazards,
        offlinePackageUsed:true,
      },
      completedRecord.ownerId
    );
    if(!result.ok){
      elements.offlineOutcomeStatus.textContent =
        'Feedback could not be stored. Free some device storage and try again.';
      return;
    }
    elements.offlineOutcome.querySelectorAll('input, select, button')
      .forEach(control => { control.disabled = true; });
    elements.offlineOutcomeSave.textContent = 'Private feedback saved';
    elements.offlineOutcomeStatus.textContent =
      'Saved privately · pending sync until you reconnect.';
    if(navigator.onLine){
      const sync = await window.DoloPawsPostHikeOutcomes.syncBrowser();
      if(sync.ok && sync.pending === 0){
        elements.offlineOutcomeStatus.textContent = 'Saved privately · synced.';
      }
    }
  }

  function finishRecoveredHike(){
    if(!activeSession || !window.DoloPawsHikeCompletions) return;
    const completedAt = activeSession.state === 'completion-pending'
      ? activeSession.updatedAt
      : Date.now();
    keepSessionResult(window.DoloPawsHikeSession.setState(
      activeSession,
      'completion-pending',
      completedAt
    ));
    const result = window.DoloPawsHikeCompletions.save(activeSession, {
      completedAt,
      distanceKm: activeSession.lastProgress && activeSession.lastProgress.km || 0,
    });
    if(!result.ok){
      stopLocation('The completed hike could not be saved. Your active hike is still preserved.');
      elements.hikeRecoveryTitle.textContent = 'Completion not saved';
      elements.hikeRecoveryMessage.textContent =
        'Free some device storage and tap Finish hike again.';
      elements.hikeResumeButton.hidden = true;
      elements.hikePauseButton.hidden = true;
      elements.hikeFinishButton.hidden = false;
      return;
    }
    window.DoloPawsHikeSession.clear();
    activeSession = null;
    stopLocation('Hike completed and saved on this device.');
    elements.hikeRecoveryTitle.textContent = 'Hike completed';
    elements.hikeRecoveryMessage.textContent =
      'Your completion is stored offline and ready for a later journal or synchronization step.';
    elements.hikeResumeButton.hidden = true;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = true;
    elements.hikeDiscardButton.hidden = true;
    showOfflineOutcome(result.record);
  }

  function discardRecoveredHike(){
    stopLocation('GPS is off. The route and safety information remain available.');
    window.DoloPawsHikeSession.clear();
    activeSession = null;
    elements.hikeRecovery.hidden = true;
  }

  function configureRecovery(trailId, bounds){
    if(!window.DoloPawsHikeSession) return;
    elements.hikeResumeButton.addEventListener('click', () => resumeRecoveredHike(bounds));
    elements.hikePauseButton.addEventListener('click', pauseRecoveredHike);
    elements.hikeFinishButton.addEventListener('click', finishRecoveredHike);
    elements.hikeDiscardButton.addEventListener('click', discardRecoveredHike);
    elements.offlineOutcomeResponses.addEventListener('change', () => {
      elements.offlineOutcomeSave.disabled =
        !completedRecord || !completedRecord.ownerId || !selectedOutcomeResponse();
    });
    elements.offlineOutcomeSave.addEventListener('click', saveOfflineOutcome);
    const loaded = window.DoloPawsHikeSession.load();
    const ownerId = loaded.status === 'ready' ? loaded.session.ownerId : null;
    const recovery = window.DoloPawsHikeSession.recoveryState({
      trailId,
      ownerId,
      packageAvailable: true,
    });
    if(recovery.status === 'empty' || recovery.status === 'unavailable' ||
       recovery.status === 'other-trail' || recovery.status === 'owner-mismatch'){
      return;
    }
    if(recovery.status === 'expired'){
      showRecoveryIssue(
        'Old unfinished hike',
        'This saved hike is more than 36 hours old. Discard it before starting another hike.'
      );
      return;
    }
    if(recovery.status === 'corrupt' || recovery.status === 'incompatible'){
      showRecoveryIssue(
        'Hike cannot be restored',
        'The saved record is damaged or from an unsupported version. Discard it safely.'
      );
      return;
    }
    activeSession = recovery.session;
    lastValidFixAt = activeSession.lastProgress
      ? activeSession.lastProgress.recordedAt
      : null;
    elements.hikeRecovery.hidden = false;
    elements.hikeDiscardButton.hidden = false;
    if(activeSession.state === 'completion-pending'){
      elements.hikeRecoveryTitle.textContent = 'Hike finished';
      elements.hikeRecoveryMessage.textContent =
        'Save the completion on this device before opening a later journal step.';
      elements.hikeResumeButton.hidden = true;
      elements.hikePauseButton.hidden = true;
      elements.hikeFinishButton.hidden = false;
      return;
    }
    elements.hikeRecoveryTitle.textContent = 'Unfinished hike found';
    elements.hikeRecoveryMessage.textContent = recoveryMessage(activeSession);
    elements.hikeResumeButton.hidden = false;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = false;
  }

  async function init(){
    setNetworkState();
    window.addEventListener('online', setNetworkState);
    window.addEventListener('offline', setNetworkState);

    const trailId = new URLSearchParams(window.location.search).get('id');
    manifestUrl = PACKAGE_MANIFESTS[trailId];
    if(!manifestUrl){
      showFailure('No downloaded beta package is configured for this trail.');
      return;
    }

    try{
      const manifestResponse = await fetch(manifestUrl);
      if(!manifestResponse.ok) throw new Error('The package manifest is unavailable.');
      const manifest = await manifestResponse.json();
      if(manifest.trailId !== trailId || manifest.schemaVersion !== 1) throw new Error('The package manifest is invalid.');

      const resources = {};
      for(const resource of manifest.resources){
        try{
          const response = await verifiedResource(resource);
          resources[resource.role] = response;
        }catch(error){
          if(resource.required !== false) throw error;
        }
      }
      if(!resources.map || !resources.route || !resources.safety ||
         !resources['footpath-network'] || !resources['elevation-profile']){
        throw new Error('Required map, route, safety, elevation, or footpath routing data is missing.');
      }

      const safety = await resources.safety.json();
      const route = await resources.route.json();
      elevationProfile = await resources['elevation-profile'].json();
      if(!validElevationProfile(elevationProfile, trailId)){
        throw new Error('The stored elevation profile is invalid.');
      }
      footpathGraph = await resources['footpath-network'].json();
      if(!window.DoloPawsFootpathRouter ||
         !window.DoloPawsFootpathRouter.validateGraph(footpathGraph)){
        throw new Error('The stored footpath routing graph is invalid.');
      }
      routeCoordinates = route.features && route.features[0] &&
        route.features[0].geometry && route.features[0].geometry.coordinates || [];
      routeTotalM = routeCoordinates.slice(1).reduce((total, coordinate, index) =>
        total + metersBetween(
          routeCoordinates[index][1], routeCoordinates[index][0],
          coordinate[1], coordinate[0]
        ), 0);
      routeIsLoop = routeCoordinates.length > 2 && metersBetween(
        routeCoordinates[0][1], routeCoordinates[0][0],
        routeCoordinates[routeCoordinates.length - 1][1],
        routeCoordinates[routeCoordinates.length - 1][0]
      ) <= 75;
      elements.trailName.textContent = manifest.name;
      elements.offlineMap.alt = `Offline route map for ${manifest.name}`;
      const failureLink = document.getElementById('failureTrailLink');
      if(failureLink) failureLink.href = `../trail.html?id=${encodeURIComponent(trailId)}`;
      const requiredCount = manifest.resources.filter(resource => resource.required !== false).length;
      elements.packageState.textContent = `Checksum-verified ${requiredCount} required stored resources · ${formatBytes(manifest.packageBytes)}`;
      elements.offlineMap.src = URL.createObjectURL(await resources.map.blob());
      if(manifest.image && manifest.image.width && manifest.image.height){
        elements.mapFrame.style.aspectRatio = `${manifest.image.width} / ${manifest.image.height}`;
      }
      renderElevationProfile(elevationProfile);

      addFact('Route', safety.facts.routeType);
      addFact('Distance', `${safety.facts.distanceKm} km`);
      addFact('Ascent', `${safety.facts.ascentM} m`);
      addFact('Highest point', `${safety.facts.highestPointM} m`);
      addFact('Expected time', safety.facts.expectedDuration);
      addFact('Difficulty', safety.facts.difficulty);
      addFact('Shade', `${safety.facts.shadePercent}%`);
      safety.cautions.forEach(caution => {
        const item = document.createElement('li');
        item.textContent = caution;
        elements.cautions.appendChild(item);
      });
      elements.emergency.textContent = `${safety.emergency.number}. ${safety.emergency.note}`;
      elements.verificationNotice.textContent = verificationLabel(manifest.verificationStatus);
      elements.packageMeta.textContent = `Package ${manifest.version} · scoring ${manifest.scoringVersion || 'not recorded'} · generated ${manifest.generatedAt.slice(0, 10)} · ${manifest.attribution}`;
      elements.licenceLink.href = manifest.licenceUrl;
      elements.locationButton.addEventListener('click', () => startLocation(manifest.bounds));
      elements.rejoinButton.addEventListener('click', () => {
        manualRejoinActive = true;
        renderManualRejoin();
      });
      configureRecovery(trailId, manifest.bounds);

      elements.mapSection.hidden = false;
      elements.factsSection.hidden = false;
      elements.sourceSection.hidden = false;
    }catch(error){
      showFailure(error.message || 'A required package resource is unavailable.');
    }
  }

  window.DoloPawsOfflineApp = { positionPercent, routeProgress, elevationAtKm, validElevationProfile };
  init();
})();
