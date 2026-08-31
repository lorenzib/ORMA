(function (root) {
  'use strict';

  const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  const FNOVI_URL = 'https://www.struttureveterinarie.it/?q=ricercastruttureavanzata';
  const SEARCH_RADIUS_M = 30000;
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 8000;

  function haversineKm(a, b) {
    const radians = Math.PI / 180;
    const dLat = (b.lat - a.lat) * radians;
    const dLng = (b.lng - a.lng) * radians;
    const lat1 = a.lat * radians;
    const lat2 = b.lat * radians;
    const value = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(value));
  }

  function buildQuery(point) {
    return `[out:json][timeout:8];nwr["amenity"="veterinary"](around:${SEARCH_RADIUS_M},${point.lat},${point.lng});out center 50;`;
  }

  function safeWebsite(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function formatAddress(tags) {
    const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
    const locality = [tags['addr:postcode'], tags['addr:city'] || tags['addr:place']].filter(Boolean).join(' ');
    return [street, locality].filter(Boolean).join(', ');
  }

  function normalizeResults(elements, origin) {
    return (Array.isArray(elements) ? elements : []).map(element => {
      const lat = element.lat != null ? Number(element.lat) : Number(element.center && element.center.lat);
      const lng = element.lon != null ? Number(element.lon) : Number(element.center && element.center.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const tags = element.tags || {};
      const type = ['node', 'way', 'relation'].includes(element.type) ? element.type : '';
      const id = Number(element.id);
      return {
        id: type && Number.isFinite(id) ? `${type}/${id}` : '',
        name: String(tags.name || '').trim() || 'Mapped veterinary facility',
        address: formatAddress(tags),
        website: safeWebsite(tags.website || tags['contact:website']),
        lat,
        lng,
        distanceKm: haversineKm(origin, { lat, lng }),
      };
    }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
  }

  function cacheKey(point) {
    return `orma-veterinary-v1-${point.lat.toFixed(3)}-${point.lng.toFixed(3)}`;
  }

  function readCache(storage, point, now) {
    if (!storage) return null;
    try {
      const value = JSON.parse(storage.getItem(cacheKey(point)) || 'null');
      return value && Array.isArray(value.results) && now - value.retrievedAt < CACHE_TTL_MS
        ? value.results
        : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(storage, point, results, now) {
    if (!storage) return;
    try {
      storage.setItem(cacheKey(point), JSON.stringify({ retrievedAt: now, results }));
    } catch (error) { /* Storage may be unavailable in private mode. */ }
  }

  async function queryMirror(endpoint, query, fetchImpl) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller ? controller.signal : undefined,
      });
      if (!response.ok) throw new Error(`overpass-${response.status}`);
      return response.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchFacilities(point, options) {
    const settings = options || {};
    const fetchImpl = settings.fetchImpl || root.fetch;
    const storage = settings.storage === undefined ? root.localStorage : settings.storage;
    const now = settings.now || Date.now();
    const cached = readCache(storage, point, now);
    if (cached) return cached;
    if (typeof fetchImpl !== 'function') throw new Error('fetch-unavailable');

    let lastError;
    for (const endpoint of OVERPASS_MIRRORS) {
      try {
        const data = await queryMirror(endpoint, buildQuery(point), fetchImpl);
        const results = normalizeResults(data && data.elements, point);
        writeCache(storage, point, results, now);
        return results;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('overpass-unavailable');
  }

  function trailStart(trail) {
    if (trail && trail.startPoint && Number.isFinite(trail.startPoint.lat) && Number.isFinite(trail.startPoint.lng)) {
      return { lat: trail.startPoint.lat, lng: trail.startPoint.lng };
    }
    if (trail && Array.isArray(trail.path) && Array.isArray(trail.path[0])) {
      const lat = Number(trail.path[0][0]);
      const lng = Number(trail.path[0][1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    if (trail && Number.isFinite(trail.lat) && Number.isFinite(trail.lng)) {
      return { lat: trail.lat, lng: trail.lng };
    }
    return null;
  }

  function formatDistance(distanceKm) {
    if (distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 100) * 10)} m straight-line`;
    return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km straight-line`;
  }

  function appendExternalLink(parent, label, href, className) {
    const link = document.createElement('a');
    link.className = className || '';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    parent.appendChild(link);
  }

  function renderResults(list, status, results) {
    list.replaceChildren();
    if (!results.length) {
      status.textContent = 'No mapped facilities are available here right now.';
      return;
    }
    status.textContent = 'OpenStreetMap listings may be incomplete. Confirm availability before travelling.';
    results.forEach(result => {
      const item = document.createElement('li');
      item.className = 'vet-care-result';
      const title = document.createElement('strong');
      title.textContent = result.name;
      const meta = document.createElement('span');
      meta.className = 'vet-care-meta';
      meta.textContent = [formatDistance(result.distanceKm), result.address].filter(Boolean).join(' · ');
      item.append(title, meta);
      const links = document.createElement('span');
      links.className = 'vet-care-result-links';
      if (result.website) appendExternalLink(links, 'Facility website ↗', result.website);
      if (result.id) appendExternalLink(links, 'View on OpenStreetMap ↗', `https://www.openstreetmap.org/${result.id}`);
      if (links.childElementCount) item.appendChild(links);
      list.appendChild(item);
    });
  }

  function init(trail, options) {
    const button = document.getElementById('vetCareButton');
    const dialog = document.getElementById('vetCareDialog');
    const close = document.getElementById('vetCareClose');
    const list = document.getElementById('vetCareResults');
    const status = document.getElementById('vetCareStatus');
    const point = trailStart(trail);
    if (!button || !dialog || !close || !list || !status || !point) return;

    let loaded = false;
    function closeDialog() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    }
    close.addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closeDialog();
    });
    button.addEventListener('click', async () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      button.setAttribute('aria-expanded', 'true');
      close.focus();
      if (loaded) return;
      loaded = true;
      status.textContent = 'Finding mapped veterinary facilities near the trail start…';
      try {
        renderResults(list, status, await fetchFacilities(point, options));
      } catch (error) {
        status.textContent = 'No mapped facilities are available here right now.';
        list.replaceChildren();
      }
    });
  }

  const api = {
    FNOVI_URL,
    SEARCH_RADIUS_M,
    buildQuery,
    fetchFacilities,
    formatAddress,
    formatDistance,
    haversineKm,
    init,
    normalizeResults,
    safeWebsite,
    trailStart,
  };
  root.ORMA_VeterinaryCare = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
