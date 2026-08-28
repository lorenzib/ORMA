/**
 * basemap-poi-click.js
 * Makes the base map's own POI icons (drawn by the OpenFreeMap "liberty"
 * style) clickable, Google Maps-style. ORMA' own layers already have
 * click handlers — this handler detects those and stays out of their way.
 *
 * Popup tiers:
 *   1. Generic: name + human-readable type (from the vector tile's
 *      class/subclass properties), plus elevation for peaks.
 *   2. Enriched from local data: if the same place exists in ORMA' own
 *      POI data (huts-bars-all-regions.geojson, registered via
 *      registerPoiFeatures), the popup shows opening hours, phone, website,
 *      dogs-welcome instantly.
 *   2b. Enriched live from OSM: when there's no local match, a small
 *      Overpass query (40 m around the icon, sent from the visitor's own
 *      browser) fetches the place's full OSM tags — website, phone, hours,
 *      cuisine, dog policy, Wikipedia — and the open popup updates in
 *      place. Fails silently (e.g. offline), leaving the Tier-1 popup.
 *   3. Escape hatch: every popup ends with a "more info" OpenStreetMap
 *      link, so no click ever dead-ends.
 *
 * Usage: makeBasemapPoisClickable(map) inside each map's 'load' handler.
 * Include this file in index.html and trail.html BEFORE script.js / trail.js.
 */

// Every ORMA layer that already has its own click handler.
// Layers that don't exist on a given map are filtered out at click time.
const DOLOPAWS_INTERACTIVE_LAYERS = [
  'water-sources-layer', 'water-sources-cluster',
  'mountain-huts-layer', 'mountain-huts-cluster',
  'bars-cafes-layer', 'bars-cafes-cluster',
  'guest-gondolas-line', 'trailmap-gondolas-line',
  'dog-routes-line',
];

// Base-style source layers whose features should be clickable. 'place'
// (town/village name labels) is deliberately excluded — popping up on every
// pan-click near a label would make the map feel broken, not richer.
const POI_SOURCE_LAYERS = ['poi', 'mountain_peak', 'poi_transit'];

// Historic monuments and sites are intentionally outside ORMA's trail-
// planning map scope. The dedicated nearby-places layer omits them too;
// ignore any equivalent symbol that still comes from the base style.
const HISTORIC_POI_TYPES = new Set([
  'historic', 'memorial', 'monument', 'wayside_cross', 'wayside_shrine',
  'ruins', 'archaeological_site',
]);

function isHistoricPoi(props){
  if (!props) return false;
  if (props.historic) return true;
  return [props.class, props.subclass].some(value => HISTORIC_POI_TYPES.has(value));
}

// subclass (raw OSM value) → label. Falls back to prettified text for
// anything not listed, so unknown types still get a sensible popup.
const POI_LABELS = {
  restaurant: '🍽️ Restaurant', fast_food: '🍔 Fast food', cafe: '☕ Café',
  bar: '🍺 Bar', pub: '🍻 Pub', biergarten: '🍺 Beer garden',
  ice_cream: '🍦 Ice cream', bakery: '🥐 Bakery',
  alpine_hut: '🏔️ Mountain hut (rifugio)', wilderness_hut: '🛖 Bivouac',
  shelter: '⛺ Shelter', viewpoint: '👀 Viewpoint', attraction: '⭐ Attraction',
  hotel: '🏨 Hotel', guest_house: '🏡 Guest house', camp_site: '🏕️ Campsite',
  parking: '🅿️ Parking', bus_stop: '🚌 Bus stop', bus_station: '🚌 Bus station',
  station: '🚉 Station', drinking_water: '🚰 Drinking water',
  spring: '💧 Spring', peak: '⛰️ Peak', supermarket: '🛒 Supermarket',
  pharmacy: '💊 Pharmacy', hospital: '🏥 Hospital', bank: '🏦 Bank',
  museum: '🏛️ Museum', castle: '🏰 Castle', church: '⛪ Church',
  chapel: '⛪ Chapel', information: 'ℹ️ Information',
};

function poiLabel(props){
  const key = props.subclass || props.class || '';
  if (POI_LABELS[key]) return POI_LABELS[key];
  if (!key) return '📍 Place';
  const pretty = String(key).replace(/_/g, ' ');
  return '📍 ' + pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

// OSM data can contain anything — never inject it into popups as raw HTML.
function escHtml(s){
  return String(s).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Turns a set of OSM tags (from local GeoJSON or a live Overpass result)
// into popup detail lines. Shared by Tier 2 and Tier 2b so both render
// identically.
function buildDetailLines(tags){
  if (!tags) return '';
  let html = '';
  if (tags.opening_hours) html += `<br>🕐 ${escHtml(tags.opening_hours)}`;
  const phone = tags.phone || tags['contact:phone'];
  if (phone) html += `<br>📞 <a href="tel:${escHtml(String(phone).replace(/\s/g,''))}">${escHtml(phone)}</a>`;
  const site = tags.website || tags['contact:website'] || tags.url;
  if (site && /^https?:\/\//.test(site))
    html += `<br>🔗 <a href="${escHtml(site)}" target="_blank" rel="noopener">Website</a>`;
  if (tags.cuisine)
    html += `<br>🍴 ${escHtml(String(tags.cuisine).split(';').join(', ').replace(/_/g,' '))}`;
  if (tags.dog === 'yes') html += `<br>🐕 Dogs welcome`;
  else if (tags.dog === 'leashed') html += `<br>🦮 Dogs on leash`;
  else if (tags.dog === 'no') html += `<br>🚫 No dogs`;
  // e.g. "it:Lago di Braies" → link to Italian Wikipedia article
  if (tags.wikipedia && /^[a-z]{2,3}:./.test(tags.wikipedia)){
    const [lang, ...title] = tags.wikipedia.split(':');
    html += `<br>📖 <a href="https://${escHtml(lang)}.wikipedia.org/wiki/${encodeURIComponent(title.join(':'))}" target="_blank" rel="noopener">Wikipedia</a>`;
  }
  return html;
}

function makeBasemapPoisClickable(map){
  map.on('click', (e) => {
    // 1) If the click landed on a ORMA layer, its own handler owns it —
    //    without this bail-out, users would get two stacked popups.
    const ownLayers = DOLOPAWS_INTERACTIVE_LAYERS.filter(id => map.getLayer(id));
    if (ownLayers.length &&
        map.queryRenderedFeatures(e.point, { layers: ownLayers }).length) return;

    // 2) Query with a small tolerance box — bare-point hits miss small
    //    icons about half the time, especially on mobile.
    const box = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
    const hits = map.queryRenderedFeatures(box);

    // 3) Keep only named symbol features from POI-ish source layers.
    const poi = hits.find(f =>
      f.layer && f.layer.type === 'symbol' &&
      POI_SOURCE_LAYERS.includes(f.sourceLayer) &&
      !isHistoricPoi(f.properties) &&
      (f.properties.name || f.properties['name:en'] || f.properties['name:it'])
    );
    if (!poi) return;

    const p = poi.properties;
    const name = p.name || p['name:en'] || p['name:it'];
    const coords = poi.geometry && poi.geometry.type === 'Point'
      ? poi.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
    const lng = coords[0], lat = coords[1];

    let baseHtml = `<b>${escHtml(name)}</b><br>${poiLabel(p)}`;
    if (p.ele) baseHtml += `<br>⛰️ ${escHtml(p.ele)} m`;

    // No per-POI source link: an osm.org object page is a mappers' database
    // view, not visitor information — and the map corner already carries the
    // OpenStreetMap attribution. Real details (website, phone, hours) render
    // above when the data has them.
    const footer = '';

    const popup = new maplibregl.Popup({ offset: 10, closeOnClick: true, maxWidth: '260px' })
      .setLngLat(e.lngLat).addTo(map);

    // Tier 2: instant enrichment from ORMA' own loaded POI data.
    const localMatch = findOwnPoiMatch(name, lng, lat);
    if (localMatch) {
      popup.setHTML(baseHtml + buildDetailLines(localMatch) + footer);
      return;
    }

    // Tier 2b: live lookup of the full OSM tags for this place. Show the
    // basic popup immediately with a quiet loading hint, then update the
    // popup in place when (if) details arrive.
    popup.setHTML(baseHtml
      + `<div style="margin-top:4px;font-size:11px;color:#8b8578;font-style:italic;">looking up details…</div>`
      + footer);

    fetchOsmDetails(name, lng, lat).then(tags => {
      if (!popup.isOpen()) return; // user already closed it — don't reopen
      const details = buildDetailLines(tags);
      popup.setHTML(baseHtml + details + footer);
    });
  });

  // Pointer cursor over base-map POIs — throttled via requestAnimationFrame
  // so panning stays smooth (queryRenderedFeatures on every raw mousemove
  // event stutters on low-end phones).
  let rafPending = false;
  map.on('mousemove', (e) => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const hits = map.queryRenderedFeatures(
        [[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]]);
      const overPoi = hits.some(f => f.layer && f.layer.type === 'symbol' &&
        POI_SOURCE_LAYERS.includes(f.sourceLayer) &&
        !isHistoricPoi(f.properties) && f.properties.name);
      // Only touch the cursor when a ORMA layer hasn't already set it.
      if (overPoi) {
        map.getCanvas().style.cursor = 'pointer';
      } else if (map.getCanvas().style.cursor === 'pointer' &&
                 !hits.some(f => f.layer && DOLOPAWS_INTERACTIVE_LAYERS.includes(f.layer.id))) {
        map.getCanvas().style.cursor = '';
      }
    });
  });
}

// ---- Tier 2b: live OSM tag lookup via Overpass -----------------------------
// One tiny query per clicked landmark, sent from the visitor's own browser
// (so the rate-limit issues the build pipeline had with shared GitHub IPs
// don't apply). Results are cached for the session so re-clicking the same
// icon is free. Any failure — offline, timeout, 429 — resolves to null and
// the popup simply keeps its basic content.
const _osmDetailCache = new Map();

function fetchOsmDetails(name, lng, lat){
  const key = `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  if (_osmDetailCache.has(key)) return Promise.resolve(_osmDetailCache.get(key));

  const query = `[out:json][timeout:8];nwr(around:40,${lat.toFixed(6)},${lng.toFixed(6)})["name"];out tags center 12;`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 9000) : null;

  return fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal: controller ? controller.signal : undefined,
  })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (timer) clearTimeout(timer);
      if (!data || !Array.isArray(data.elements)) return null;
      const nameLc = String(name).toLowerCase();
      // Prefer an exact name match; fall back to partial (OSM name vs the
      // tile's possibly-localized label can differ slightly).
      const exact = data.elements.find(el => el.tags && el.tags.name &&
        el.tags.name.toLowerCase() === nameLc);
      const partial = data.elements.find(el => el.tags && el.tags.name &&
        (el.tags.name.toLowerCase().includes(nameLc) ||
         nameLc.includes(el.tags.name.toLowerCase())));
      const tags = (exact || partial) ? (exact || partial).tags : null;
      _osmDetailCache.set(key, tags);
      return tags;
    })
    .catch(() => { if (timer) clearTimeout(timer); return null; });
}

// ---- Tier 2 support: index of ORMA' own POI data ----------------------
// initializeHutsBars() (and optionally initializeWaterSources()) registers
// its loaded features here so base-map clicks can be enriched with the
// richer OSM tags ORMA already ships (hours, phone, website, dog=yes).
window._dolopawsPoiFeatures = window._dolopawsPoiFeatures || [];

function registerPoiFeatures(features){
  if (Array.isArray(features)) window._dolopawsPoiFeatures.push(...features);
}

function findOwnPoiMatch(name, lng, lat){
  const nameLc = String(name).toLowerCase();
  let best = null, bestDist = Infinity;
  for (const f of window._dolopawsPoiFeatures){
    if (!f.geometry || f.geometry.type !== 'Point') continue;
    const flng = f.geometry.coordinates[0], flat = f.geometry.coordinates[1];
    const dist = Math.hypot((flat - lat) * 111000,
                            (flng - lng) * 111000 * Math.cos(lat * Math.PI / 180));
    if (dist > 50) continue;                    // must be within ~50 m
    const fname = (f.properties && f.properties.name || '').toLowerCase();
    const nameOk = fname && (fname.includes(nameLc) || nameLc.includes(fname));
    if ((nameOk || dist < 15) && dist < bestDist){ best = f; bestDist = dist; }
  }
  return best ? best.properties : null;
}
