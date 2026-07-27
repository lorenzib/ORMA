(function(){
  'use strict';

  const PACKAGE_ID = 'carezza-fixture';
  const PACKAGE_VERSION = 1;
  const PACKAGE_CACHE = `dolopaws-offline-poc-package-v${PACKAGE_VERSION}-${PACKAGE_ID}`;
  const MANIFEST_URL = './packages/carezza-fixture/manifest.json';

  const elements = {
    status: document.getElementById('packageStatus'),
    badge: document.getElementById('stateBadge'),
    network: document.getElementById('networkBadge'),
    download: document.getElementById('downloadBtn'),
    verify: document.getElementById('verifyBtn'),
    remove: document.getElementById('removeBtn'),
    mapImage: document.getElementById('mapImage'),
    route: document.getElementById('routeLine'),
    dot: document.getElementById('positionDot'),
    hint: document.getElementById('mapHint'),
    gps: document.getElementById('gpsBtn'),
    simulate: document.getElementById('simulateBtn'),
    gpsStatus: document.getElementById('gpsStatus'),
    facts: document.getElementById('factsList'),
    use: document.getElementById('storageUse'),
    quota: document.getElementById('storageQuota'),
    persistent: document.getElementById('storagePersistent'),
    packageSize: document.getElementById('packageSize'),
  };

  let manifest = null;
  let route = null;
  let simulationIndex = 0;
  let watchId = null;

  function absoluteUrl(relative){
    return new URL(relative, window.location.href).href;
  }

  function formatBytes(bytes){
    if(!Number.isFinite(bytes)) return 'Unknown';
    if(bytes < 1024) return `${bytes} B`;
    if(bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function setState(state, message){
    elements.badge.textContent = state;
    elements.badge.className = 'badge';
    if(state === 'Ready offline') elements.badge.classList.add('ready');
    if(state === 'Incomplete' || state === 'Failed') elements.badge.classList.add('failed');
    elements.status.textContent = message;
  }

  function setBusy(busy){
    elements.download.disabled = busy;
    elements.verify.disabled = busy;
    elements.remove.disabled = busy;
  }

  async function updateStorage(){
    if(!navigator.storage){
      elements.use.textContent = 'Storage API unavailable';
      elements.quota.textContent = 'Storage API unavailable';
      elements.persistent.textContent = 'Unavailable';
      return;
    }
    try{
      const estimate = await navigator.storage.estimate();
      elements.use.textContent = formatBytes(estimate.usage);
      elements.quota.textContent = formatBytes(estimate.quota);
      elements.persistent.textContent = navigator.storage.persisted
        ? ((await navigator.storage.persisted()) ? 'Yes' : 'No')
        : 'Unsupported';
    }catch(error){
      elements.use.textContent = 'Estimate failed';
      elements.quota.textContent = 'Estimate failed';
    }
  }

  function updateNetwork(){
    const online = navigator.onLine;
    elements.network.textContent = online
      ? 'Browser reports online'
      : 'Browser reports offline';
    elements.network.className = online ? 'network' : 'network offline';
  }

  async function registerWorker(){
    if(!('serviceWorker' in navigator)){
      setState('Failed', 'This browser does not support service workers.');
      return false;
    }
    try{
      await navigator.serviceWorker.register('./poc-sw.js', { scope: './' });
      await navigator.serviceWorker.ready;
      return true;
    }catch(error){
      setState('Failed', `Service worker registration failed: ${error.message}`);
      return false;
    }
  }

  async function fetchManifest(){
    const response = await fetch(MANIFEST_URL);
    if(!response.ok) throw new Error(`Manifest request returned ${response.status}`);
    const value = await response.json();
    if(value.id !== PACKAGE_ID || value.version !== PACKAGE_VERSION){
      throw new Error('Unexpected package identity or version');
    }
    if(!Array.isArray(value.required) || !value.required.length){
      throw new Error('Package manifest has no required resources');
    }
    return value;
  }

  async function downloadPackage(){
    setBusy(true);
    setState('Downloading', 'Downloading and measuring required resources…');
    let totalBytes = 0;
    try{
      const nextManifest = await fetchManifest();
      const cache = await caches.open(PACKAGE_CACHE);
      const resources = [MANIFEST_URL, ...nextManifest.required];
      for(let index = 0; index < resources.length; index += 1){
        const url = absoluteUrl(resources[index]);
        setState('Downloading', `Downloading required resource ${index + 1} of ${resources.length}…`);
        const response = await fetch(url, { cache: 'no-store' });
        if(!response.ok) throw new Error(`${resources[index]} returned ${response.status}`);
        const body = await response.arrayBuffer();
        totalBytes += body.byteLength;
        await cache.put(url, new Response(body, {
          status: 200,
          headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' },
        }));
      }
      elements.packageSize.textContent = formatBytes(totalBytes);
      localStorage.setItem(`${PACKAGE_CACHE}-bytes`, String(totalBytes));
      const result = await verifyPackage();
      if(!result.ok) throw new Error(result.reason);
    }catch(error){
      setState('Failed', `Download failed: ${error.message}`);
    }finally{
      setBusy(false);
      updateStorage();
    }
  }

  async function verifyPackage(){
    setBusy(true);
    try{
      const cache = await caches.open(PACKAGE_CACHE);
      const cachedManifestResponse = await cache.match(absoluteUrl(MANIFEST_URL));
      if(!cachedManifestResponse){
        setState('Not downloaded', 'No verified package is stored on this device.');
        return { ok: false, reason: 'Manifest is missing' };
      }
      const cachedManifest = await cachedManifestResponse.json();
      if(cachedManifest.id !== PACKAGE_ID || cachedManifest.version !== PACKAGE_VERSION){
        setState('Incomplete', 'The stored package has an incompatible identity or version.');
        return { ok: false, reason: 'Manifest identity is invalid' };
      }
      for(const resource of cachedManifest.required){
        const response = await cache.match(absoluteUrl(resource));
        if(!response){
          setState('Incomplete', `Required resource is missing: ${resource}`);
          return { ok: false, reason: `${resource} is missing` };
        }
        const bytes = await response.clone().arrayBuffer();
        if(!bytes.byteLength){
          setState('Incomplete', `Required resource is empty: ${resource}`);
          return { ok: false, reason: `${resource} is empty` };
        }
      }
      manifest = cachedManifest;
      setState('Ready offline', `Verified ${cachedManifest.required.length} required resources.`);
      const storedBytes = Number(localStorage.getItem(`${PACKAGE_CACHE}-bytes`));
      if(Number.isFinite(storedBytes) && storedBytes > 0){
        elements.packageSize.textContent = formatBytes(storedBytes);
      }
      await renderPackage();
      return { ok: true };
    }catch(error){
      setState('Failed', `Verification failed: ${error.message}`);
      return { ok: false, reason: error.message };
    }finally{
      setBusy(false);
    }
  }

  async function removePackage(){
    setBusy(true);
    try{
      await caches.delete(PACKAGE_CACHE);
      localStorage.removeItem(`${PACKAGE_CACHE}-bytes`);
      manifest = null;
      route = null;
      elements.mapImage.removeAttribute('href');
      elements.route.setAttribute('points', '');
      elements.dot.hidden = true;
      elements.facts.innerHTML = '<p>No downloaded safety information yet.</p>';
      elements.packageSize.textContent = 'Not downloaded';
      elements.hint.textContent = 'Download the fixture to make it available offline.';
      setState('Not downloaded', 'The test package was removed from this device.');
    }finally{
      setBusy(false);
      updateStorage();
    }
  }

  function projectPoint(coordinates){
    const bounds = manifest.bounds;
    const lng = coordinates[0];
    const lat = coordinates[1];
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * 1000;
    const y = (1 - ((lat - bounds.south) / (bounds.north - bounds.south))) * 700;
    return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(700, y))];
  }

  async function renderPackage(){
    elements.mapImage.setAttribute('href', absoluteUrl(manifest.mapImage));
    const routeResponse = await fetch(absoluteUrl(manifest.route));
    route = await routeResponse.json();
    const points = route.features[0].geometry.coordinates.map(projectPoint);
    elements.route.setAttribute('points', points.map(point => point.join(',')).join(' '));
    elements.hint.textContent = 'The map, route, and facts below came from the verified local package.';

    const safetyResponse = await fetch(absoluteUrl(manifest.safety));
    const safety = await safetyResponse.json();
    elements.facts.innerHTML = safety.items.map(item => `
      <div class="fact ${item.level === 'warning' ? 'warning' : ''}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </div>`).join('');
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
  }

  function paintPosition(lng, lat, label){
    if(!manifest) return;
    const point = projectPoint([lng, lat]);
    elements.dot.setAttribute('cx', point[0]);
    elements.dot.setAttribute('cy', point[1]);
    elements.dot.hidden = false;
    elements.gpsStatus.textContent = label;
  }

  function simulatePosition(){
    if(!route){
      elements.gpsStatus.textContent = 'Download and verify the package first.';
      return;
    }
    const coordinates = route.features[0].geometry.coordinates;
    const coordinate = coordinates[simulationIndex % coordinates.length];
    simulationIndex += 1;
    paintPosition(coordinate[0], coordinate[1], `Simulated route position ${simulationIndex} of ${coordinates.length}.`);
  }

  function useGps(){
    if(!manifest){
      elements.gpsStatus.textContent = 'Download and verify the package first.';
      return;
    }
    if(!navigator.geolocation){
      elements.gpsStatus.textContent = 'Geolocation is unavailable in this browser.';
      return;
    }
    if(watchId !== null){
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      elements.gps.textContent = 'Use device GPS';
      elements.gpsStatus.textContent = 'GPS tracking stopped.';
      return;
    }
    elements.gpsStatus.textContent = 'Waiting for a GPS position…';
    watchId = navigator.geolocation.watchPosition(position => {
      const { longitude, latitude, accuracy } = position.coords;
      paintPosition(longitude, latitude, `GPS accuracy: approximately ${Math.round(accuracy)} m.`);
    }, error => {
      elements.gpsStatus.textContent = `GPS error: ${error.message}`;
    }, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });
    elements.gps.textContent = 'Stop device GPS';
  }

  async function init(){
    updateNetwork();
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    elements.download.addEventListener('click', downloadPackage);
    elements.verify.addEventListener('click', verifyPackage);
    elements.remove.addEventListener('click', removePackage);
    elements.simulate.addEventListener('click', simulatePosition);
    elements.gps.addEventListener('click', useGps);

    await updateStorage();
    const workerReady = await registerWorker();
    if(workerReady) await verifyPackage();
  }

  init();
})();
