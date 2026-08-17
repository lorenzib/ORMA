/**
 * scripts/fetch-huts-bars.js
 * Fetches ALL food, drink and hut POIs for both ORMA regions
 * (Dolomites + Savoy) from the Overpass API and writes
 * huts-bars-all-regions.geojson at the repo root.
 *
 * This replaces the ad-hoc fetch that produced the original file — which
 * covered bars, cafés, pubs and huts but never included restaurants.
 *
 * Build-time tool only: runs locally (node scripts/fetch-huts-bars.js)
 * or via .github/workflows/update-pois.yml. Never shipped to the site.
 */
const fs = require('fs');

const REGIONS = {
  dolomites: { south: 45.60, west: 10.30, north: 47.10, east: 13.10 },
  savoy:     { south: 44.80, west: 5.50,  north: 46.45, east: 7.30  },
};

// Everything a hiker with a dog might stop at. nwr = nodes + ways +
// relations (restaurants mapped as building outlines are ways — a
// node-only query silently misses them). "out center tags" collapses
// ways/relations to one representative point.
const SELECTOR = `
  nwr["amenity"~"^(restaurant|bar|pub|cafe|fast_food|ice_cream|biergarten)$"](BBOX);
  nwr["tourism"~"^(alpine_hut|wilderness_hut)$"](BBOX);
  nwr["amenity"="shelter"]["shelter_type"!="public_transport"](BBOX);
`;

// Keep only the properties the site uses — dropping addr:* etc. roughly
// halves the file size, which matters now that restaurants are included.
const KEEP_TAGS = [
  'name', 'amenity', 'tourism', 'shelter_type', 'ele', 'cuisine',
  'opening_hours', 'phone', 'contact:phone', 'website', 'contact:website',
  'dog', 'outdoor_seating', 'wheelchair', 'check_date', 'seasonal',
];

// Same Overpass etiquette as the routes pipeline: real User-Agent,
// exponential backoff, mirror fallback for 429/5xx from shared IPs.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function overpass(query, attempt = 0){
  const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ORMA/1.0 (https://www.app-orma.com; POI refresh pipeline)',
    },
    body: 'data=' + encodeURIComponent(query),
  });
  if (res.status === 429 || res.status === 502 || res.status === 504) {
    if (attempt >= 5) throw new Error(`Overpass gave ${res.status} after ${attempt + 1} tries`);
    const wait = Math.pow(2, attempt) * 5000;
    console.log(`  ${res.status} from ${endpoint} — retrying in ${wait / 1000}s...`);
    await new Promise(r => setTimeout(r, wait));
    return overpass(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

function toFeatures(osm){
  return (osm.elements || [])
    .map(el => {
      const lon = el.lon !== undefined ? el.lon : (el.center && el.center.lon);
      const lat = el.lat !== undefined ? el.lat : (el.center && el.center.lat);
      if (lon === undefined || lat === undefined || !el.tags) return null;
      const props = { '@id': `${el.type}/${el.id}` };
      for (const k of KEEP_TAGS) if (el.tags[k]) props[k] = el.tags[k];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [
          Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] },
        properties: props,
      };
    })
    .filter(Boolean);
}

(async () => {
  const all = [];
  const seen = new Set();
  for (const [name, b] of Object.entries(REGIONS)){
    const bbox = `${b.south},${b.west},${b.north},${b.east}`;
    const query = `[out:json][timeout:180];(${SELECTOR.replace(/\(BBOX\)/g, `(${bbox})`)});out center tags;`;
    console.log(`Fetching ${name} (${bbox})...`);
    const data = await overpass(query);
    const feats = toFeatures(data);
    let added = 0;
    for (const f of feats){
      if (seen.has(f.properties['@id'])) continue; // guard against bbox overlap
      seen.add(f.properties['@id']);
      all.push(f); added++;
    }
    console.log(`  ✅ ${added} features from ${name}`);
    await new Promise(r => setTimeout(r, 10000)); // be polite between regions
  }

  // Sanity guard: never overwrite a good file with a broken/partial fetch.
  // The existing file has 11,355 features; with restaurants added the total
  // should be well above this floor.
  if (all.length < 8000) throw new Error(
    `Only ${all.length} features fetched — refusing to overwrite existing file.`);

  const counts = {};
  for (const f of all){
    const k = f.properties.tourism || f.properties.amenity || 'other';
    counts[k] = (counts[k] || 0) + 1;
  }
  console.log('Breakdown:', counts);
  console.log('With dog tag:', all.filter(f => f.properties.dog).length,
              '· with outdoor_seating:', all.filter(f => f.properties.outdoor_seating).length);

  fs.writeFileSync('huts-bars-all-regions.geojson',
    JSON.stringify({ type: 'FeatureCollection', features: all }));
  console.log(`✅ Wrote huts-bars-all-regions.geojson (${all.length} features)`);
})();
