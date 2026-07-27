(function(){
  'use strict';

  const SUPPORTED_TRAIL = 'lago-carezza';
  const MANIFEST_URL = `packages/${SUPPORTED_TRAIL}/manifest.json`;
  let watchId = null;

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

  function startLocation(bounds){
    if(!('geolocation' in navigator)){
      elements.locationState.textContent = 'GPS is not supported in this browser.';
      return;
    }
    if(watchId !== null){
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      elements.positionDot.hidden = true;
      elements.locationButton.textContent = 'Show my position';
      elements.locationState.textContent = 'GPS stopped.';
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
      elements.locationState.textContent = onMap
        ? `GPS accuracy ±${Math.round(position.coords.accuracy)} m · last fix ${new Date(position.timestamp).toLocaleTimeString()}`
        : `Your GPS position is outside this downloaded map · accuracy ±${Math.round(position.coords.accuracy)} m`;
    }, error => {
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = 'Try GPS again';
      watchId = null;
      elements.locationState.textContent = error.code === 1
        ? 'Location permission was denied. Enable it for DoloPaws in browser settings.'
        : 'A GPS fix is currently unavailable. The stored route remains visible.';
    }, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
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
        const response = await verifiedResource(resource);
        resources[resource.role] = response;
      }
      if(!resources.map || !resources.route || !resources.safety) throw new Error('Required map, route, or safety data is missing.');

      const safety = await resources.safety.json();
      elements.trailName.textContent = manifest.name;
      elements.packageState.textContent = `Verified ${manifest.resources.length} stored resources · ${formatBytes(manifest.packageBytes)}`;
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
      elements.verificationNotice.textContent = manifest.verificationStatus === 'field-review-required'
        ? 'This package is technically verified but its route and safety content still require a dated field review.'
        : 'This package has passed the declared content review.';
      elements.packageMeta.textContent = `Package ${manifest.version} · generated ${manifest.generatedAt.slice(0, 10)} · ${manifest.attribution}`;
      elements.licenceLink.href = manifest.licenceUrl;
      elements.locationButton.addEventListener('click', () => startLocation(manifest.bounds));

      elements.mapSection.hidden = false;
      elements.factsSection.hidden = false;
      elements.sourceSection.hidden = false;
    }catch(error){
      showFailure(error.message || 'A required package resource is unavailable.');
    }
  }

  window.DoloPawsOfflineApp = { positionPercent };
  init();
})();
