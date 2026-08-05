(function(){
  'use strict';

  const PACKAGES = {
    'lago-carezza': {
      name: 'Lago di Carezza Loop',
      manifestUrl: '/offline/packages/lago-carezza/manifest.json',
      trailUrl: '/trail.html?id=lago-carezza',
      offlineUrl: '/offline/trail.html?id=lago-carezza',
    },
    'alpe-siusi': {
      name: 'Alpe di Siusi Meadow Loop',
      manifestUrl: '/offline/packages/alpe-siusi/manifest.json',
      trailUrl: '/trail.html?id=alpe-siusi',
      offlineUrl: '/offline/trail.html?id=alpe-siusi',
    },
  };
  const CACHE_PREFIX = 'dolopaws-trail-';
  const METADATA_PREFIX = 'dolopaws-offline:';
  const OWNER_SALT_KEY = 'dolopaws-offline-owner-salt';
  const METADATA_DB_NAME = 'dolopaws-offline';
  const METADATA_DB_VERSION = 1;
  const METADATA_STORE = 'packages';
  const STORAGE_SAFETY_BYTES = 1024 * 1024;
  const PACKAGE_STATES = Object.freeze([
    'not-downloaded',
    'downloading',
    'ready',
    'stale',
    'incomplete',
    'update-available',
    'failed',
    'removed',
  ]);

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

  function readLegacyPackageMetadata(trailId){
    try{
      const value = JSON.parse(localStorage.getItem(metadataKey(trailId)) || 'null');
      return value && typeof value === 'object' ? value : null;
    }catch(error){
      return null;
    }
  }

  function openMetadataDatabase(){
    if(!window.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable.'));
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(METADATA_DB_NAME, METADATA_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if(!database.objectStoreNames.contains(METADATA_STORE)){
          database.createObjectStore(METADATA_STORE, { keyPath:'trailId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB could not be opened.'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked.'));
    });
  }

  async function metadataOperation(mode, operation){
    const database = await openMetadataDatabase();
    try{
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(METADATA_STORE, mode);
        const store = transaction.objectStore(METADATA_STORE);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Offline metadata operation failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('Offline metadata transaction was aborted.'));
      });
    }finally{
      database.close();
    }
  }

  async function readPackageMetadata(trailId){
    const legacy = readLegacyPackageMetadata(trailId);
    try{
      const stored = await metadataOperation('readonly', store => store.get(trailId));
      if(stored) return stored;
      if(!legacy) return null;
      const migrated = { ...legacy, trailId };
      await metadataOperation('readwrite', store => store.put(migrated));
      localStorage.removeItem(metadataKey(trailId));
      return migrated;
    }catch(error){
      return legacy;
    }
  }

  async function writePackageMetadata(trailId, metadata){
    const record = { ...metadata, trailId };
    try{
      await metadataOperation('readwrite', store => store.put(record));
      localStorage.removeItem(metadataKey(trailId));
    }catch(error){
      localStorage.setItem(metadataKey(trailId), JSON.stringify(metadata));
    }
    return record;
  }

  async function removePackageMetadata(trailId){
    try{
      await metadataOperation('readwrite', store => store.delete(trailId));
    }catch(error){ /* local cleanup still applies when IndexedDB is unavailable */ }
    localStorage.removeItem(metadataKey(trailId));
  }

  async function deleteMetadataDatabase(){
    if(!window.indexedDB) return false;
    return new Promise(resolve => {
      let request;
      try{ request = window.indexedDB.deleteDatabase(METADATA_DB_NAME); }
      catch(error){ resolve(false); return; }
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    });
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

  function resourceIsRequired(resource){
    return !resource || resource.required !== false;
  }

  function contentFreshnessState(manifest){
    const categories = manifest && manifest.evidence && manifest.evidence.categories;
    if(!categories || typeof categories !== 'object') return 'unknown';
    const states = Object.values(categories).map(category =>
      category && category.freshnessState || 'unknown'
    );
    if(states.includes('stale')) return 'stale';
    if(!states.length || states.includes('unknown')) return 'unknown';
    if(states.includes('aging')) return 'aging';
    return states.every(state => state === 'current') ? 'current' : 'unknown';
  }

  function validateManifest(manifest, expectedTrailId){
    if(!manifest || manifest.schemaVersion !== 1) throw new Error('Unsupported package format.');
    if(manifest.trailId !== expectedTrailId) throw new Error('Package trail does not match this page.');
    if(
      !manifest.version ||
      !Number.isFinite(manifest.packageBytes) ||
      manifest.packageBytes <= 0 ||
      !Array.isArray(manifest.resources) ||
      !manifest.resources.length
    ){
      throw new Error('Package manifest is incomplete.');
    }
    for(const resource of manifest.resources){
      if(!resource.url || !resource.sha256 || !Number.isFinite(resource.bytes)){
        throw new Error('A required package resource is invalid.');
      }
    }
    if(
      Number.isFinite(manifest.packageBudgetBytes) &&
      manifest.packageBytes > manifest.packageBudgetBytes
    ){
      throw new Error('This offline package exceeds its declared storage budget.');
    }
    return manifest;
  }

  function requiredStorageBytes(packageBytes){
    if(!Number.isFinite(packageBytes) || packageBytes <= 0) return STORAGE_SAFETY_BYTES;
    // Installation briefly holds the staging and committed copies together.
    return Math.ceil(packageBytes * 2) + STORAGE_SAFETY_BYTES;
  }

  async function storageCapacity(packageBytes){
    const requiredBytes = requiredStorageBytes(packageBytes);
    if(!(navigator.storage && typeof navigator.storage.estimate === 'function')){
      return { supported: false, enough: null, requiredBytes };
    }
    try{
      const estimate = await navigator.storage.estimate();
      if(!Number.isFinite(estimate.quota) || !Number.isFinite(estimate.usage)){
        return { supported: false, enough: null, requiredBytes };
      }
      const availableBytes = Math.max(0, estimate.quota - estimate.usage);
      return {
        supported: true,
        enough: availableBytes >= requiredBytes,
        requiredBytes,
        availableBytes,
      };
    }catch(error){
      return { supported: false, enough: null, requiredBytes };
    }
  }

  async function assertStorageCapacity(packageBytes){
    const capacity = await storageCapacity(packageBytes);
    if(capacity.enough !== false) return capacity;
    const error = new Error(
      `Not enough browser storage for this offline map. It needs about ${
        formatBytes(capacity.requiredBytes)
      } free, but this browser reports ${
        formatBytes(capacity.availableBytes)
      }. Remove a saved offline map or free device storage, then retry.`
    );
    error.name = 'DoloPawsStorageError';
    throw error;
  }

  function isQuotaError(error){
    return !!(
      error &&
      (
        error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.code === 1014
      )
    );
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

  async function verifyCachedResource(cache, resource, manifestUrl){
    const url = resourceUrl(resource, manifestUrl);
    const response = await cache.match(url);
    if(!response) throw new Error(`${resource.label || resource.url} is missing from this device.`);
    const buffer = await response.arrayBuffer();
    if(buffer.byteLength !== resource.bytes){
      throw new Error(`${resource.label || resource.url} has an unexpected stored size.`);
    }
    if(await sha256(buffer) !== resource.sha256){
      throw new Error(`${resource.label || resource.url} failed its stored checksum.`);
    }
    return { url, bytes: buffer.byteLength };
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
    await assertStorageCapacity(manifest.packageBytes);
    const name = cacheName(manifest);
    const temporaryName = `${name}-installing`;
    await caches.delete(temporaryName);
    const temporary = await caches.open(temporaryName);

    try{
      for(let index = 0; index < manifest.resources.length; index += 1){
        const resource = manifest.resources[index];
        if(onProgress) onProgress(index + 1, manifest.resources.length, resource);
        try{
          const verified = await fetchVerifiedResource(resource, config.manifestUrl);
          await temporary.put(verified.url, verified.response);
        }catch(error){
          if(resourceIsRequired(resource)) throw error;
          if(onProgress){
            onProgress(index + 1, manifest.resources.length, resource, 'optional-missing');
          }
        }
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
      await writePackageMetadata(trailId, {
        cacheName: name,
        version: manifest.version,
        installedAt: new Date().toISOString(),
        packageBytes: manifest.packageBytes,
        verificationStatus: manifest.verificationStatus,
        ownerMarker,
      });
      return manifest;
    }catch(error){
      await caches.delete(temporaryName);
      if(isQuotaError(error)){
        throw new Error(
          'Your browser ran out of storage while saving this offline map. ' +
          'Remove a saved offline map or free device storage, then retry.'
        );
      }
      throw error;
    }
  }

  async function inspectPackage(trailId, onProgress){
    if(!('caches' in window)){
      return {
        state: 'failed',
        usable: false,
        hasLocalData: false,
        message: 'Offline storage is not supported in this browser.',
      };
    }
    const config = PACKAGES[trailId];
    if(!config){
      return { state: 'not-downloaded', usable: false, hasLocalData: false };
    }
    const names = await caches.keys();
    const incomplete = names.some(name =>
      name.startsWith(`${CACHE_PREFIX}${trailId}-`) && name.endsWith('-installing')
    );
    const candidates = names.filter(name =>
      name.startsWith(`${CACHE_PREFIX}${trailId}-`) && !name.endsWith('-installing')
    );
    const metadata = await readPackageMetadata(trailId);
    if(metadata && metadata.cacheName && candidates.includes(metadata.cacheName)){
      candidates.sort((first, second) =>
        first === metadata.cacheName ? -1 : second === metadata.cacheName ? 1 : 0
      );
    }
    let failureMessage = null;
    for(const name of candidates){
      const cache = await caches.open(name);
      const manifestResponse = await cache.match(new URL(config.manifestUrl, window.location.href).href);
      if(!manifestResponse){
        failureMessage = 'The stored package manifest is missing.';
        continue;
      }
      try{
        const manifest = validateManifest(await manifestResponse.json(), trailId);
        const required = manifest.resources.filter(resourceIsRequired);
        for(let index = 0; index < required.length; index += 1){
          if(onProgress) onProgress(index + 1, required.length, required[index]);
          await verifyCachedResource(cache, required[index], config.manifestUrl);
        }
        const freshness = contentFreshnessState(manifest);
        return {
          state: incomplete ? 'incomplete' : freshness === 'stale' ? 'stale' : 'ready',
          usable: true,
          hasLocalData: true,
          manifest,
          metadata,
          cacheName: name,
          requiredChecked: required.length,
          contentFreshness: freshness,
          checkedAt: new Date().toISOString(),
          message: incomplete
            ? 'A previous update was interrupted; the existing verified package remains usable.'
            : null,
        };
      }catch(error){
        failureMessage = error.message || 'A stored package resource failed verification.';
      }
    }
    if(candidates.length){
      return {
        state: 'failed',
        usable: false,
        hasLocalData: true,
        metadata,
        message: failureMessage || 'The stored package failed verification.',
      };
    }
    if(incomplete){
      return {
        state: 'incomplete',
        usable: false,
        hasLocalData: true,
        metadata,
        message: 'A previous download was interrupted. No partial package is ready offline.',
      };
    }
    return { state: 'not-downloaded', usable: false, hasLocalData: false, metadata };
  }

  async function verifyInstalledPackage(trailId, onProgress){
    return inspectPackage(trailId, onProgress);
  }

  async function installedPackageRecord(trailId){
    const inspection = await inspectPackage(trailId);
    if(!inspection.usable) return null;
    return {
      manifest: inspection.manifest,
      metadata: inspection.metadata,
      state: inspection.state,
      checkedAt: inspection.checkedAt,
      requiredChecked: inspection.requiredChecked,
      contentFreshness: inspection.contentFreshness,
    };
  }

  async function installedPackage(trailId){
    const record = await installedPackageRecord(trailId);
    return record ? record.manifest : null;
  }

  async function incompleteInstallation(trailId){
    if(!('caches' in window)) return false;
    const names = await caches.keys();
    return names.some(name =>
      name.startsWith(`${CACHE_PREFIX}${trailId}-`) && name.endsWith('-installing')
    );
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
    await removePackageMetadata(trailId);
  }

  async function removeAllPackages(){
    if('caches' in window){
      const names = await caches.keys();
      await Promise.all(names
        .filter(name => name.startsWith(CACHE_PREFIX))
        .map(name => caches.delete(name)));
    }
    for(const trailId of Object.keys(PACKAGES)){
      await removePackageMetadata(trailId);
    }
    await deleteMetadataDatabase();
    try{
      const keys = [];
      for(let index = 0; index < localStorage.length; index += 1){
        const key = localStorage.key(index);
        if(key && key.startsWith(METADATA_PREFIX)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
      localStorage.removeItem(OWNER_SALT_KEY);
    }catch(error){ /* cache deletion remains the authoritative cleanup */ }
    return true;
  }

  async function listInstalledPackages(user){
    return (await listPackageStates(user)).filter(record => record.usable);
  }

  async function listPackageStates(user){
    const records = [];
    for(const trailId of Object.keys(PACKAGES)){
      const config = PACKAGES[trailId];
      const inspection = await inspectPackage(trailId);
      if(inspection.state === 'not-downloaded') continue;
      let available = null;
      try{ available = await availablePackage(trailId); }catch(error){ /* offline is expected */ }
      const manifest = inspection.manifest;
      const updateAvailable = !!(
        manifest && available && available.version !== manifest.version
      );
      records.push({
        trailId,
        name: config.name,
        trailUrl: config.trailUrl,
        offlineUrl: config.offlineUrl,
        version: manifest && manifest.version || null,
        packageBytes: manifest && manifest.packageBytes ||
          inspection.metadata && inspection.metadata.packageBytes || null,
        installedAt: inspection.metadata && inspection.metadata.installedAt || null,
        verificationStatus: manifest && manifest.verificationStatus ||
          inspection.metadata && inspection.metadata.verificationStatus || null,
        ownership: await ownershipState(inspection.metadata, user),
        state: ['ready', 'stale'].includes(inspection.state) && updateAvailable
          ? 'update-available'
          : inspection.state,
        stateMessage: inspection.message,
        usable: inspection.usable,
        hasLocalData: inspection.hasLocalData,
        updateAvailable,
        requiredChecked: inspection.requiredChecked || 0,
        contentFreshness: inspection.contentFreshness || 'unknown',
        checkedAt: inspection.checkedAt || null,
      });
    }
    return records;
  }

  function formatBytes(bytes){
    if(!Number.isFinite(bytes)) return '';
    if(bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatPackageVersion(version){
    const beta = String(version || '').match(/beta\.(\d+)$/i);
    if(beta) return `Beta package ${beta[1]}`;
    return version ? `Package ${version}` : 'Package revision unavailable';
  }

  function initPanel(){
    const panel = document.getElementById('offlinePackagePanel');
    const downloadButton = document.getElementById('offlineDownloadBtn');
    const openButton = document.getElementById('offlineOpenBtn');
    const testButton = document.getElementById('offlineTestBtn');
    const removeButton = document.getElementById('offlineRemoveBtn');
    const status = document.getElementById('offlinePackageStatus');
    if(!panel || !downloadButton || !openButton || !testButton || !removeButton || !status) return;

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

    async function refresh(options){
      const failureMessage = options && options.failureMessage;
      const removed = options && options.removed;
      const inspection = await inspectPackage(trailId);
      const manifest = inspection.usable ? inspection.manifest : null;
      const metadata = inspection.metadata;
      let available = null;
      try{ available = await availablePackage(trailId); }catch(error){ /* offline is expected */ }
      const updateAvailable = !!(manifest && available && manifest.version !== available.version);
      const ownership = manifest
        ? await ownershipState(
          metadata,
          window.DoloPawsAuth && window.DoloPawsAuth.currentUser
        )
        : null;
      openButton.hidden = !inspection.usable;
      testButton.hidden = !inspection.usable;
      removeButton.hidden = !inspection.hasLocalData;
      downloadButton.hidden = (
        inspection.state === 'ready' ||
        inspection.state === 'stale'
      ) && !updateAvailable && !failureMessage;
      if(failureMessage){
        downloadButton.textContent = signedIn()
          ? (manifest ? 'Retry update' : 'Retry download')
          : 'Log in to retry';
        setStatus(
          `${failureMessage} ${
            manifest
              ? 'Your existing package remains ready offline.'
              : 'No incomplete package has been marked ready.'
          }`,
          'failed'
        );
      }else if(removed){
        downloadButton.textContent = signedIn() ? 'Download again' : 'Log in to download';
        setStatus('Removed from this device. No offline package remains.', 'removed');
      }else if(inspection.state === 'failed'){
        downloadButton.textContent = signedIn() ? 'Repair download' : 'Log in to repair';
        setStatus(
          `${inspection.message || 'The stored package failed verification.'} ` +
          'It is not ready offline. Repair or remove it.',
          'failed'
        );
      }else if(inspection.state === 'incomplete'){
        downloadButton.textContent = signedIn()
          ? (manifest ? 'Restart update' : 'Restart download')
          : 'Log in to retry';
        setStatus(
          `A previous ${manifest ? 'update' : 'download'} was interrupted. ${
            manifest
              ? 'Your existing package remains ready offline.'
              : 'The partial package is not available offline.'
          } Restart to verify every required resource.`,
          'incomplete'
        );
      }else if(updateAvailable){
        downloadButton.textContent = signedIn() ? 'Update offline map' : 'Log in to update';
        setStatus(
          `Update available · current package ${
            formatBytes(manifest.packageBytes)
          } · downloaded ${formatInstalledDate(metadata && metadata.installedAt)} · ${
            ownershipLabel(ownership)
          }. Your existing package remains usable offline.`,
          'update-available'
        );
      }else if(inspection.state === 'stale'){
        setStatus(
          `Ready offline, but at least one content review is stale · ${
            formatBytes(manifest.packageBytes)
          } · downloaded ${formatInstalledDate(metadata && metadata.installedAt)} · ${
            ownershipLabel(ownership)
          }. Check current notices before hiking.`,
          'stale'
        );
      }else if(manifest){
        setStatus(
          `Ready offline · ${formatBytes(manifest.packageBytes)} · downloaded ${
            formatInstalledDate(metadata && metadata.installedAt)
          } · ${ownershipLabel(ownership)} · ${
            inspection.requiredChecked
          } required resources checked`,
          'ready'
        );
      }else if(signedIn()){
        setStatus(
          'Not downloaded on this device. Download it, then run the offline self-test.',
          'not-downloaded'
        );
        downloadButton.textContent = 'Download test package';
      }else{
        setStatus(
          'Not downloaded on this device. Log in to download; a completed package remains available if your session expires.',
          'not-downloaded'
        );
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
      setStatus('Preparing a verified offline download…', 'downloading');
      const downloadStartedAt = Date.now();
      if(window.DoloPawsMetricFunnel){
        window.DoloPawsMetricFunnel.recordOnce(
          'package-started', trailId, 'offline_package', 'started', { trailId }
        );
      }
      let failureMessage = null;
      try{
        const manifest = await installPackage(
          trailId,
          (current, total, resource) => {
            setStatus(`Downloading ${current} of ${total}: ${resource.label || resource.url}`);
          },
          window.DoloPawsAuth.currentUser
        );
        setStatus(
          `Verified ${
            manifest.resources.filter(resourceIsRequired).length
          } required resources.`,
          'ready'
        );
        if(window.DoloPawsMetricFunnel){
          window.DoloPawsMetricFunnel.recordOnce(
            'package-ready', trailId, 'offline_package', 'ready', {
              trailId,
              packageSizeBand:window.DoloPawsMetricFunnel.packageSizeBand
                ? window.DoloPawsMetricFunnel.packageSizeBand(manifest.packageBytes)
                : 'unknown',
              durationBand:window.DoloPawsMetricFunnel.durationBand
                ? window.DoloPawsMetricFunnel.durationBand(Date.now() - downloadStartedAt)
                : 'unknown',
              packageVersion:manifest.version,
            }
          );
        }
      }catch(error){
        failureMessage = error.message || 'The package could not be downloaded.';
        if(window.DoloPawsMetricFunnel){
          const category = window.DoloPawsMetricFunnel.failureCategory
            ? window.DoloPawsMetricFunnel.failureCategory(error)
            : 'unknown';
          window.DoloPawsMetricFunnel.recordOnce(
            `package-failed-${category}`, trailId, 'offline_package', 'failed', {
              trailId,
              failureCategory:category,
              durationBand:window.DoloPawsMetricFunnel.durationBand
                ? window.DoloPawsMetricFunnel.durationBand(Date.now() - downloadStartedAt)
                : 'unknown',
            }
          );
        }
      }finally{
        downloadButton.disabled = false;
        await refresh(failureMessage ? { failureMessage } : null);
      }
    }

    downloadButton.addEventListener('click', download);
    testButton.addEventListener('click', async () => {
      testButton.disabled = true;
      setStatus('Testing required resources from this device…', 'checking');
      const result = await verifyInstalledPackage(
        trailId,
        (current, total, resource) => {
          setStatus(
            `Testing ${current} of ${total}: ${resource.label || resource.url}`,
            'checking'
          );
        }
      );
      testButton.disabled = false;
      if(result.usable){
        if(window.DoloPawsMetricFunnel){
          window.DoloPawsMetricFunnel.recordOnce(
            'airplane-test', trailId, 'offline_package', 'airplane_test_passed', { trailId }
          );
        }
        setStatus(
          `Offline self-test passed: ${result.requiredChecked} required resources ` +
          `were checksum-verified from this device. ${
            result.state === 'stale'
              ? 'The stored map works, but content review is stale.'
              : 'You can now switch to airplane mode and open the map.'
          }`,
          result.state
        );
      }else{
        setStatus(
          `${result.message || 'The offline self-test failed.'} ` +
          'This package is not ready offline.',
          result.state === 'incomplete' ? 'incomplete' : 'failed'
        );
      }
    });
    removeButton.addEventListener('click', async () => {
      removeButton.disabled = true;
      setStatus('Removing this trail from this device…');
      await removePackage(trailId);
      removeButton.disabled = false;
      await refresh({ removed: true });
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
    inspectPackage,
    verifyInstalledPackage,
    incompleteInstallation,
    listInstalledPackages,
    listPackageStates,
    availablePackage,
    removePackage,
    removeAllPackages,
    ownerMarkerFor,
    ownershipState,
    ownershipLabel,
    readPackageMetadata,
    writePackageMetadata,
    removePackageMetadata,
    formatInstalledDate,
    validateManifest,
    formatBytes,
    formatPackageVersion,
    requiredStorageBytes,
    storageCapacity,
    assertStorageCapacity,
    isQuotaError,
    resourceIsRequired,
    contentFreshnessState,
    verifyCachedResource,
    PACKAGE_STATES,
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel);
  else initPanel();
})();
