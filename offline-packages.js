(function(){
  'use strict';

  const PACKAGES = {
    'lago-carezza': {
      manifestUrl: '/offline/packages/lago-carezza/manifest.json',
    },
  };
  const CACHE_PREFIX = 'dolopaws-trail-';
  const METADATA_PREFIX = 'dolopaws-offline:';
  const OWNER_SALT_KEY = 'dolopaws-offline-owner-salt';

  function bytesToHex(buffer){
    return Array.from(new Uint8Array(buffer))
      .map(value => value.toString(16).padStart(2, '0'))
      .join('');
  }

  async function sha256(buffer){
    if(!(window.crypto && window.crypto.subtle)){
      throw new Error('This browser cannot verify offline packages.');
    }
    return bytesToHex(await window.crypto.subtle.digest('SHA-256', buffer));
  }

  function deviceOwnerSalt(){
    let salt = localStorage.getItem(OWNER_SALT_KEY);
    if(salt) return salt;
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    salt = bytesToHex(bytes);
    localStorage.setItem(OWNER_SALT_KEY, salt);
    return salt;
  }

  async function ownerMarkerFor(user){
    if(!(user && user.uid)) throw new Error('Log in to download this offline map.');
    if(!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues)){
      throw new Error('This browser cannot create private offline ownership metadata.');
    }
    const input = new TextEncoder().encode(
      `dolopaws-owner-v1:${deviceOwnerSalt()}:${user.uid}`
    );
    return `v1:${await sha256(input)}`;
  }

  function metadataKey(trailId){
    return `${METADATA_PREFIX}${trailId}`;
  }

  function readPackageMetadata(trailId){
    try{
      const value = JSON.parse(localStorage.getItem(metadataKey(trailId)) || 'null');
      return value && typeof value === 'object' ? value : null;
    }catch(error){
      return null;
    }
  }

  function formatInstalledDate(value){
    const date = new Date(value);
    if(!value || Number.isNaN(date.getTime())) return 'date unavailable';
    try{
      return new Intl.DateTimeFormat(
        document.documentElement.lang || 'en-GB',
        { dateStyle: 'medium' }
      ).format(date);
    }catch(error){
      return date.toISOString().slice(0, 10);
    }
  }

  async function ownershipState(metadata, user){
    if(!(metadata && metadata.ownerMarker)) return 'legacy-owner-unknown';
    if(!(user && user.uid)) return 'signed-out-owner-retained';
    return metadata.ownerMarker === await ownerMarkerFor(user)
      ? 'current-account'
      : 'another-account';
  }

  function ownershipLabel(state){
    const labels = {
      'current-account': 'downloaded by this account',
      'another-account': 'downloaded by another account on this device',
      'signed-out-owner-retained': 'downloaded account retained on this device',
      'legacy-owner-unknown': 'download owner not recorded',
    };
    return labels[state] || labels['legacy-owner-unknown'];
  }

  function resourceUrl(resource, manifestUrl){
    return new URL(resource.url, new URL(manifestUrl, window.location.href)).href;
  }

  function cacheName(manifest){
    return `${CACHE_PREFIX}${manifest.trailId}-${manifest.version}`;
  }

  function validateManifest(manifest, expectedTrailId){
    if(!manifest || manifest.schemaVersion !== 1) throw new Error('Unsupported package format.');
    if(manifest.trailId !== expectedTrailId) throw new Error('Package trail does not match this page.');
    if(!manifest.version || !Array.isArray(manifest.resources) || !manifest.resources.length){
      throw new Error('Package manifest is incomplete.');
    }
    for(const resource of manifest.resources){
      if(!resource.url || !resource.sha256 || !Number.isFinite(resource.bytes)){
        throw new Error('A required package resource is invalid.');
      }
    }
    return manifest;
  }

  async function fetchVerifiedResource(resource, manifestUrl){
    const url = resourceUrl(resource, manifestUrl);
    const response = await fetch(url, { cache: 'no-store' });
    if(!response.ok) throw new Error(`Could not download ${resource.label || resource.url}.`);
    const buffer = await response.arrayBuffer();
    if(buffer.byteLength !== resource.bytes){
      throw new Error(`${resource.label || resource.url} has an unexpected size.`);
    }
    if(await sha256(buffer) !== resource.sha256){
      throw new Error(`${resource.label || resource.url} failed verification.`);
    }
    return {
      url,
      response: new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Length': String(buffer.byteLength),
          'X-DoloPaws-Verified': 'sha256',
        },
      }),
    };
  }

  async function removeOlderVersions(trailId, keepName){
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(`${CACHE_PREFIX}${trailId}-`) && name !== keepName)
      .map(name => caches.delete(name)));
  }

  async function installPackage(trailId, onProgress, ownerUser){
    if(!('caches' in window)) throw new Error('Offline storage is not supported in this browser.');
    const config = PACKAGES[trailId];
    if(!config) throw new Error('No offline package is available for this trail.');
    const ownerMarker = await ownerMarkerFor(ownerUser);

    if('serviceWorker' in navigator){
      await navigator.serviceWorker.register('/offline/offline-sw.js', { scope: '/offline/' });
    }else{
      throw new Error('Offline reopening is not supported in this browser.');
    }

    const manifestResponse = await fetch(config.manifestUrl, { cache: 'no-store' });
    if(!manifestResponse.ok) throw new Error('The package manifest could not be downloaded.');
    const manifest = validateManifest(await manifestResponse.clone().json(), trailId);
    const name = cacheName(manifest);
    const temporaryName = `${name}-installing`;
    await caches.delete(temporaryName);
    const temporary = await caches.open(temporaryName);

    try{
      for(let index = 0; index < manifest.resources.length; index += 1){
        const resource = manifest.resources[index];
        if(onProgress) onProgress(index + 1, manifest.resources.length, resource);
        const verified = await fetchVerifiedResource(resource, config.manifestUrl);
        await temporary.put(verified.url, verified.response);
      }
      await temporary.put(
        new URL(config.manifestUrl, window.location.href).href,
        manifestResponse
      );

      await caches.delete(name);
      const destination = await caches.open(name);
      const requests = await temporary.keys();
      for(const request of requests){
        const response = await temporary.match(request);
        await destination.put(request, response);
      }
      await caches.delete(temporaryName);
      await removeOlderVersions(trailId, name);
      localStorage.setItem(metadataKey(trailId), JSON.stringify({
        cacheName: name,
        version: manifest.version,
        installedAt: new Date().toISOString(),
        packageBytes: manifest.packageBytes,
        verificationStatus: manifest.verificationStatus,
        ownerMarker,
      }));
      return manifest;
    }catch(error){
      await caches.delete(temporaryName);
      throw error;
    }
  }

  async function installedPackageRecord(trailId){
    if(!('caches' in window)) return null;
    const config = PACKAGES[trailId];
    if(!config) return null;
    const names = await caches.keys();
    const candidates = names.filter(name => name.startsWith(`${CACHE_PREFIX}${trailId}-`) && !name.endsWith('-installing'));
    for(const name of candidates){
      const cache = await caches.open(name);
      const manifestResponse = await cache.match(new URL(config.manifestUrl, window.location.href).href);
      if(!manifestResponse) continue;
      try{
        const manifest = validateManifest(await manifestResponse.json(), trailId);
        const complete = (await Promise.all(manifest.resources.map(resource =>
          cache.match(resourceUrl(resource, config.manifestUrl))
        ))).every(Boolean);
        if(complete){
          return {
            manifest,
            metadata: readPackageMetadata(trailId),
          };
        }
      }catch(error){ /* inspect the next cache */ }
    }
    return null;
  }

  async function installedPackage(trailId){
    const record = await installedPackageRecord(trailId);
    return record ? record.manifest : null;
  }

  async function availablePackage(trailId){
    const config = PACKAGES[trailId];
    if(!config) return null;
    const response = await fetch(config.manifestUrl, { cache: 'no-store' });
    if(!response.ok) return null;
    return validateManifest(await response.json(), trailId);
  }

  async function removePackage(trailId){
    if(!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(`${CACHE_PREFIX}${trailId}-`))
      .map(name => caches.delete(name)));
    localStorage.removeItem(metadataKey(trailId));
  }

  async function listInstalledPackages(user){
    const records = [];
    for(const trailId of Object.keys(PACKAGES)){
      const record = await installedPackageRecord(trailId);
      if(!record) continue;
      let available = null;
      try{ available = await availablePackage(trailId); }catch(error){ /* offline is expected */ }
      records.push({
        trailId,
        version: record.manifest.version,
        packageBytes: record.manifest.packageBytes,
        installedAt: record.metadata && record.metadata.installedAt || null,
        verificationStatus: record.manifest.verificationStatus,
        ownership: await ownershipState(record.metadata, user),
        updateAvailable: !!(
          available && available.version !== record.manifest.version
        ),
      });
    }
    return records;
  }

  function formatBytes(bytes){
    if(!Number.isFinite(bytes)) return '';
    if(bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function initPanel(){
    const panel = document.getElementById('offlinePackagePanel');
    const downloadButton = document.getElementById('offlineDownloadBtn');
    const openButton = document.getElementById('offlineOpenBtn');
    const removeButton = document.getElementById('offlineRemoveBtn');
    const status = document.getElementById('offlinePackageStatus');
    if(!panel || !downloadButton || !openButton || !removeButton || !status) return;

    const trailId = new URLSearchParams(window.location.search).get('id');
    if(!PACKAGES[trailId]) return;
    panel.hidden = false;

    function setStatus(message, state){
      status.textContent = message;
      status.dataset.state = state || '';
    }

    function signedIn(){
      return !!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser);
    }

    async function refresh(){
      const record = await installedPackageRecord(trailId);
      const manifest = record && record.manifest;
      const metadata = record && record.metadata;
      let available = null;
      try{ available = await availablePackage(trailId); }catch(error){ /* offline is expected */ }
      const updateAvailable = !!(manifest && available && manifest.version !== available.version);
      openButton.hidden = !manifest;
      removeButton.hidden = !manifest;
      downloadButton.hidden = !!manifest && !updateAvailable;
      if(updateAvailable){
        downloadButton.textContent = signedIn() ? 'Update offline map' : 'Log in to update';
        setStatus(
          `Map update ${available.version} is available. Your existing package remains usable offline.`,
          ''
        );
      }else if(manifest){
        const ownership = await ownershipState(
          metadata,
          window.DoloPawsAuth && window.DoloPawsAuth.currentUser
        );
        setStatus(
          `Ready offline · ${formatBytes(manifest.packageBytes)} · downloaded ${
            formatInstalledDate(metadata && metadata.installedAt)
          } · ${ownershipLabel(ownership)} · beta verification data`,
          'ready'
        );
      }else if(signedIn()){
        setStatus('Download the beta package, then test it in airplane mode.');
        downloadButton.textContent = 'Download test package';
      }else{
        setStatus('Log in to download. An installed package will remain available if your session expires.');
        downloadButton.textContent = 'Log in to download';
      }
    }

    async function download(){
      if(!signedIn()){
        if(window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('download');
        else if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openLogin();
        return;
      }
      downloadButton.disabled = true;
      try{
        const manifest = await installPackage(
          trailId,
          (current, total, resource) => {
            setStatus(`Downloading ${current} of ${total}: ${resource.label || resource.url}`);
          },
          window.DoloPawsAuth.currentUser
        );
        setStatus(`Verified ${manifest.resources.length} required resources.`, 'ready');
      }catch(error){
        setStatus(error.message || 'The package could not be downloaded.', 'error');
      }finally{
        downloadButton.disabled = false;
        await refresh();
      }
    }

    downloadButton.addEventListener('click', download);
    removeButton.addEventListener('click', async () => {
      removeButton.disabled = true;
      setStatus('Removing this trail from this device…');
      await removePackage(trailId);
      removeButton.disabled = false;
      await refresh();
    });

    function authChanged(){
      refresh();
      if(signedIn() && window.DoloPawsTrailAction && window.DoloPawsTrailAction.consume('download')){
        download();
      }
    }
    if(window.DoloPawsAuth) window.DoloPawsAuth.onChange(authChanged);
    else window.addEventListener('dolopaws-auth-ready', () => window.DoloPawsAuth.onChange(authChanged), { once: true });
    refresh();
  }

  window.DoloPawsOffline = {
    installPackage,
    installedPackage,
    installedPackageRecord,
    listInstalledPackages,
    availablePackage,
    removePackage,
    ownerMarkerFor,
    ownershipState,
    ownershipLabel,
    readPackageMetadata,
    formatInstalledDate,
    validateManifest,
    formatBytes,
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel);
  else initPanel();
})();
