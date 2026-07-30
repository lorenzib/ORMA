(function(){
  'use strict';

  const SUPPORTED_TRAIL = 'lago-carezza';
  const MANIFEST_URL = `packages/${SUPPORTED_TRAIL}/manifest.json`;
  let watchId = null;
  let activeSession = null;
  let routeCoordinates = [];
  let offRouteStreak = 0;
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
    positionDot: document.getElementById('positionDot'),
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
    const response = await fetch(new URL(resource.url, new URL(MANIFEST_URL, window.location.href)));
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
      return 'Vetted by DoloPaws.';
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
    let bestIndex = 0;
    let nearestM = Infinity;
    const cumulative = [0];
    for(let index = 0; index < routeCoordinates.length; index++){
      const [routeLng, routeLat] = routeCoordinates[index];
      const distance = metersBetween(lat, lng, routeLat, routeLng);
      if(distance < nearestM){
        nearestM = distance;
        bestIndex = index;
      }
      if(index > 0){
        const [previousLng, previousLat] = routeCoordinates[index - 1];
        cumulative.push(cumulative[index - 1] +
          metersBetween(previousLat, previousLng, routeLat, routeLng));
      }
    }
    return {
      pathIndex: bestIndex,
      km: cumulative[bestIndex] / 1000,
      nearestM,
    };
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
    offRouteStreak = 0;
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
      const assessment = progress && window.DoloPawsGpsPolicy
        ? window.DoloPawsGpsPolicy.assessFix({
          timestamp: fixTimestamp,
          now: Date.now(),
          accuracyM: position.coords.accuracy,
          routeDistanceM: progress.nearestM,
          previousOffRouteStreak: offRouteStreak,
        })
        : null;
      offRouteStreak = assessment ? assessment.nextOffRouteStreak : 0;
      if(assessment && assessment.usableForProgress) lastValidFixAt = fixTimestamp;
      if(activeSession && activeSession.state === 'active' &&
         assessment && assessment.usableForProgress && progress.nearestM <= 2000){
          keepSessionResult(window.DoloPawsHikeSession.updateProgress(activeSession, {
            km: Math.max(
              activeSession.lastProgress && activeSession.lastProgress.km || 0,
              progress.km
            ),
            pathIndex: progress.pathIndex,
            accuracyM: position.coords.accuracy,
            recordedAt: fixTimestamp,
          }));
      }
      if(assessment && assessment.offRouteState === 'confirmed'){
        elements.routeWarning.textContent =
          `You appear to be off route · about ${Math.round(progress.nearestM)} m away. ` +
          'Check the marked path and your surroundings.';
        elements.routeWarning.hidden = false;
      }else{
        elements.routeWarning.hidden = true;
      }
      const reliability = !assessment
        ? 'Route distance unavailable.'
        : assessment.freshness === 'stale'
          ? 'GPS fix is stale; waiting for a newer position.'
          : !assessment.reliableForWarning
            ? 'GPS is weak; off-route warnings are paused.'
            : '';
      elements.locationState.textContent = assessment
        ? `GPS ±${Math.round(position.coords.accuracy)} m · ${
          Math.round(progress.nearestM)
        } m from route · last valid fix ${
          lastValidFixAt ? new Date(lastValidFixAt).toLocaleTimeString() : 'none yet'
        }${reliability ? ` · ${reliability}` : ''}`
        : onMap
          ? 'GPS position found; route distance unavailable.'
          : 'Your GPS position is outside this downloaded map.';
    }, error => {
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = 'Try GPS again';
      watchId = null;
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
        ? 'Location permission was denied. Enable it for DoloPaws in browser settings.'
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
    if(trailId !== SUPPORTED_TRAIL){
      showFailure('No downloaded beta package is configured for this trail.');
      return;
    }

    try{
      const manifestResponse = await fetch(MANIFEST_URL);
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
      if(!resources.map || !resources.route || !resources.safety) throw new Error('Required map, route, or safety data is missing.');

      const safety = await resources.safety.json();
      const route = await resources.route.json();
      routeCoordinates = route.features && route.features[0] &&
        route.features[0].geometry && route.features[0].geometry.coordinates || [];
      elements.trailName.textContent = manifest.name;
      const requiredCount = manifest.resources.filter(resource => resource.required !== false).length;
      elements.packageState.textContent = `Checksum-verified ${requiredCount} required stored resources · ${formatBytes(manifest.packageBytes)}`;
      elements.offlineMap.src = URL.createObjectURL(await resources.map.blob());
      if(manifest.image && manifest.image.width && manifest.image.height){
        elements.mapFrame.style.aspectRatio = `${manifest.image.width} / ${manifest.image.height}`;
      }

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
      configureRecovery(trailId, manifest.bounds);

      elements.mapSection.hidden = false;
      elements.factsSection.hidden = false;
      elements.sourceSection.hidden = false;
    }catch(error){
      showFailure(error.message || 'A required package resource is unavailable.');
    }
  }

  window.DoloPawsOfflineApp = { positionPercent, routeProgress };
  init();
})();
