(function (root) {
  'use strict';

  const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  const SEARCH_RADIUS_M = 30000;
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 8000;
  const SOURCE_ID = 'detail-veterinary';
  const LAYER_IDS = [
    'detail-veterinary-points',
    'detail-veterinary-crosses',
    'detail-veterinary-labels',
  ];

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

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
  }

  function toFeature(result) {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [result.lng, result.lat] },
      properties: {
        name: result.name,
        address: result.address,
        website: result.website,
        distanceKm: result.distanceKm,
      },
    };
  }

  function popupHtml(properties) {
    const website = safeWebsite(properties.website);
    let html = '<div class="dp-poi-popup vet-map-popup">';
    html += '<span class="dp-poi-type">Veterinary clinic</span>';
    html += `<strong class="dp-poi-name">${escapeHtml(properties.name || 'Mapped veterinary facility')}</strong>`;
    const distanceKm = Number(properties.distanceKm);
    if (Number.isFinite(distanceKm)) html += `<span>${escapeHtml(formatDistance(distanceKm))}</span>`;
    if (properties.address) html += `<span>${escapeHtml(properties.address)}</span>`;
    html += '<span>Confirm availability before travelling.</span>';
    if (website) html += `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Facility website ↗</a>`;
    return html + '</div>';
  }

  function setVisible(map, visible) {
    LAYER_IDS.forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }

  function addLayers(map, results) {
    const data = { type: 'FeatureCollection', features: results.map(toFeature) };
    const existing = map.getSource(SOURCE_ID);
    if (existing) {
      if (typeof existing.setData === 'function') existing.setData(data);
      return;
    }
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data,
      attribution: 'Veterinary facility data © OpenStreetMap contributors',
    });
    map.addLayer({
      id: 'detail-veterinary-points',
      type: 'circle',
      source: SOURCE_ID,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 7, 13, 10],
        'circle-color': '#B44435',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: 'detail-veterinary-crosses',
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        visibility: 'none',
        'text-field': '+',
        'text-font': ['Noto Sans Regular'],
        'text-size': 16,
        'text-offset': [0, -0.05],
      },
      paint: { 'text-color': '#ffffff' },
    });
    map.addLayer({
      id: 'detail-veterinary-labels',
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 9,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.25],
        'text-max-width': 13,
        'text-optional': true,
      },
      paint: {
        'text-color': '#243128',
        'text-halo-color': 'rgba(255,255,255,.96)',
        'text-halo-width': 2,
      },
    });
    map.on('mouseenter', 'detail-veterinary-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'detail-veterinary-points', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'detail-veterinary-points', event => {
      const feature = event.features && event.features[0];
      if (!feature || !root.maplibregl) return;
      new root.maplibregl.Popup({ offset: 12, maxWidth: '240px' })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(popupHtml(feature.properties || {}))
        .addTo(map);
    });
  }

  async function loadMapLayer(map, trail, options) {
    const point = trailStart(trail);
    if (!map || !point) return [];
    const results = await fetchFacilities(point, options);
    addLayers(map, results);
    return results;
  }

  function focusFacilities(map, trail, results) {
    const point = trailStart(trail);
    if (!map || !point || !Array.isArray(results) || !results.length || typeof map.fitBounds !== 'function') return;
    const points = [point, ...results];
    const lngs = points.map(item => item.lng);
    const lats = points.map(item => item.lat);
    map.fitBounds([
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ], { padding: 64, maxZoom: 12.5, duration: 700 });
  }

  const api = {
    LAYER_IDS,
    SEARCH_RADIUS_M,
    SOURCE_ID,
    addLayers,
    buildQuery,
    escapeHtml,
    fetchFacilities,
    focusFacilities,
    formatAddress,
    formatDistance,
    haversineKm,
    loadMapLayer,
    normalizeResults,
    popupHtml,
    safeWebsite,
    setVisible,
    toFeature,
    trailStart,
  };
  root.ORMA_VeterinaryCare = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
