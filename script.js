

function safetyLabel(level){
  if(level === 'low-risk') return t('safety.low');
  if(level === 'moderate') return t('safety.moderate');
  return t('safety.caution');
}
function trailSafetyLabel(trail){
  const base = safetyLabel(trail.safetyLevel);
  return window.DoloPawsTrailTrust ? window.DoloPawsTrailTrust.riskLabel(trail, base) : base;
}
function safetyClass(level){
  if(level === 'low-risk') return 'safety-low';
  if(level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}
function productBadge(type, label){
  if(window.DoloPawsIcons) return window.DoloPawsIcons.badgeHtml(type, label);
  return `<span class="dp-badge dp-badge--${type}"><span>${label}</span></span>`;
}
function productIcon(icon, size = 14){
  return window.DoloPawsIcons ? window.DoloPawsIcons.renderIconSvg(icon, { mode:'inline', color:'currentColor', size }) : '';
}
function trailCardVisual(trail, options = {}){
  if(window.DoloPawsTrailVisual) return window.DoloPawsTrailVisual.render(trail, options);
  const className = options.className || 'photo';
  const data = options.dataTrailId ? ` data-trail-id="${options.dataTrailId}"` : '';
  const fallback = trail.imageIcon ? `<img src="${trail.imageIcon}" alt="${trail.name}" loading="lazy">` : (pathThumbnailSvg(trail.path) || '');
  return `<div class="${className}"${data}>${fallback}</div>`;
}

// ============================================================
// GUEST TEASER — generic default profile, illustrative blurred scores
// ============================================================
function renderTeaser(){
  const grid = document.getElementById('teaserGrid');
  if(!grid || typeof trails === 'undefined') return;

  const generic = { terrain:'1', distance:'10', heatSensitive:false };
  const picks = ['lago-braies', 'alpe-siusi', 'santa-maddalena']
    .map(id => trails.find(t => t.id === id))
    .filter(Boolean);

  grid.innerHTML = picks.map(t => `
    <div class="teaser-card">
      ${trailCardVisual(t, { className:'photo' })}
      <div class="row">
        <div class="name">${t.name}</div>
        <div class="match">${scoreTrail(t, generic)}%<span class="match-note">${window.t('teaser.example')}</span></div>
      </div>
      <div class="meta">${t.ref ? window.t('card.trailRef', {ref: t.ref}) + ' · ' : ''}${t.area} · ${t.distance} km</div>
    </div>
  `).join('');
}

function goToProfileCreation(){
  const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
  if(user){
    window.location.href = 'account.html?next=%2F';
  } else if(window.DoloPawsWizard){
    // Guests build the dog profile FIRST (no account needed); the
    // signup ask comes only after they've seen their dog's matches.
    window.DoloPawsWizard.open();
  } else if(window.DoloPawsAuthUI){
    window.DoloPawsAuthUI.openSignup();
  }
}

renderTeaser();
const createProfileBtn = document.getElementById('createProfileBtn');
if(createProfileBtn) createProfileBtn.addEventListener('click', goToProfileCreation);

// Deep link from trail pages: index.html?profile=1 opens the wizard for
// guests (trail pages don't carry the wizard markup themselves).
if(new URLSearchParams(location.search).get('profile') === '1'){
  window.addEventListener('load', () => {
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(!user && window.DoloPawsWizard) window.DoloPawsWizard.open();
  });
}
const unlockBtn = document.getElementById('unlockBtn');
// The teaser button previews the catalog (30 trails visible, details
// locked behind login) instead of jumping straight to signup.
if(unlockBtn) unlockBtn.addEventListener('click', () => { window.location.href = 'browse-trails.html'; });

// ============================================================
// RETURNING VISITOR — real profile, real scoring, real favorites,
// genuine "new since last visit" detection (not a decorative badge).
// ============================================================
const NEW_MATCH_THRESHOLD = 70; // trails scoring at/above this count as "a match" for new-match tracking
let adjustOverride = null; // session-only override, never saved to the profile
let showFullList = false;  // homepage: top matches first, full catalog on demand
const TOP_MATCHES = 6;
let currentFavorites = {};
let homeActionStatusTimer = null;

function showHomeActionStatus(message){
  let status = document.getElementById('homeActionStatus');
  if(!status){
    status = document.createElement('div');
    status.id = 'homeActionStatus';
    status.className = 'dw-toast';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.body.appendChild(status);
  }
  if(homeActionStatusTimer) clearTimeout(homeActionStatusTimer);
  status.textContent = message;
  status.hidden = false;
  status.className = 'dw-toast dw-toast--in';
  homeActionStatusTimer = setTimeout(() => {
    status.hidden = true;
    status.className = 'dw-toast';
  }, 4200);
}

(function showAccountDeletionReceipt(){
  try{
    const url = new URL(window.location.href);
    if(url.searchParams.get('accountDeleted') !== '1') return;
    const device = url.searchParams.get('device');
    const translate = (key, fallback) => window.t ? window.t(key) : fallback;
    const message = device === 'removed'
      ? translate('account.delete.receipt.removed', 'Account deleted. Private server data and ORMA data on this device were removed. Community and moderation records may be retained for safety or legal obligations.')
      : device === 'maps-retained'
        ? translate('account.delete.receipt.mapsRetained', 'Account deleted. Private server data was removed. Downloaded public maps remain on this device; community and moderation records may also be retained.')
        : translate('account.delete.receipt.cleanupIncomplete', 'Account deleted, but device cleanup did not finish. Clear ORMA site data in your browser settings before sharing this device.');
    showHomeActionStatus(message);
    url.searchParams.delete('accountDeleted');
    url.searchParams.delete('device');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
  }catch(error){ /* deletion already completed; receipt failure must not break home */ }
})();

let guestMapInstance = null;
let showingSavedOnly = false;
let activeArea = 'all';

// Pagination for the trail list — 15 cards per page. The map always shows
// ALL trails matching the current filters; only the card list paginates.
const TRAILS_PER_PAGE = 15;
let currentPage = 1;
let lastFilterKey = '';            // legacy, kept for safety
let activeRegion = (() => {
  try {
    const requested = new URLSearchParams(window.location.search).get('region');
    return requested === 'savoy' ? 'savoy' : 'dolomites';
  } catch(e) { return 'dolomites'; }
})();
let activeValley = 'all';
let sortKey = 'match';             // 'match' | 'distance' | 'effort' — Companion sort control
let selectedTrailId = null;        // map pin / card selection (Companion layout)

// Logged-in shell (map + list app layout) — header search + filter panel state.
// These sit on top of the region/valley filters above.
let liQuery = '';                  // header search box
// Filter semantics follow the design's chip options (AppShell FilterBar):
// dist 'any'|'u5'|'5to10'|'10p' · risk 'any'|'low-risk'|'moderate'|'caution'
// · terrain 'any'|'soft'|'mixed'|'rocky' · shade 'any'|'40'|'60'.
let liFilters = { dist: 'any', risk: 'any', terrain: 'any', shade: 'any', minMatch: 0, water: false };
let liShellWired = false;          // header/menus are wired once per page load
let liDevView = false;             // ?view=returning preview without an account

function filterTrailsForReturningView(list){
  let displayList = showingSavedOnly ? list.filter(x => currentFavorites[x.id]) : list;
  displayList = displayList.filter(x => x.region === activeRegion);
  if(activeValley !== 'all') displayList = displayList.filter(x => x.valley === activeValley);

  // Logged-in shell: header search + filter-panel refinements. All of these
  // read real trail fields; items arrive already scored (t.score).
  const q = liQuery.trim().toLowerCase();
  if(q) displayList = displayList.filter(x =>
    String(x.name || '').toLowerCase().includes(q) ||
    String(x.area || '').toLowerCase().includes(q) ||
    String(x.valley || '').toLowerCase().includes(q));
  if(liFilters.dist === 'u5') displayList = displayList.filter(x => x.distance < 5);
  else if(liFilters.dist === '5to10') displayList = displayList.filter(x => x.distance >= 5 && x.distance <= 10);
  else if(liFilters.dist === '10p') displayList = displayList.filter(x => x.distance > 10);
  if(liFilters.risk !== 'any') displayList = displayList.filter(x => x.safetyLevel === liFilters.risk);
  if(liFilters.terrain === 'soft') displayList = displayList.filter(x => Number(x.terrainRank) <= 0);
  else if(liFilters.terrain === 'mixed') displayList = displayList.filter(x => Number(x.terrainRank) <= 1);
  else if(liFilters.terrain === 'rocky') displayList = displayList.filter(x => Number(x.terrainRank) <= 2);
  if(liFilters.shade === '40') displayList = displayList.filter(x => (x.shadeCoverage || 0) >= 40);
  else if(liFilters.shade === '60') displayList = displayList.filter(x => (x.shadeCoverage || 0) >= 60);
  if(liFilters.minMatch > 0) displayList = displayList.filter(x => x.score >= liFilters.minMatch);
  if(liFilters.water) displayList = displayList.filter(x => Array.isArray(x.waterSources) && x.waterSources.length > 0);

  // Sort is applied last so it always reflects the current filtered set.
  // 'match' just keeps the incoming order — the list is already sorted by
  // score desc before filtering, in renderReturningHomepage().
  if(sortKey === 'distance') displayList = displayList.slice().sort((a, b) => a.distance - b.distance);
  else if(sortKey === 'effort') displayList = displayList.slice().sort((a, b) => a.elevation - b.elevation);
  else if(sortKey === 'today'){
    // "Coolest" — lowest heat load first, from the trail's real heat fields
    // (heatRisk tier, then shade). Stable sort keeps match order within ties.
    const hr = { low: 0, moderate: 1, high: 2 };
    displayList = displayList.slice().sort((a, b) =>
      ((hr[a.heatRisk] ?? 1) - (hr[b.heatRisk] ?? 1)) || ((b.shadeCoverage || 0) - (a.shadeCoverage || 0)));
  }

  return displayList;
}

// Short, honest "why this fits" line for a trail card. The canonical
// recommendation supplies the reasons so every surface explains the same score.
function matchReason(t, overrides){
  const isImported = t.curated === false;
  try{
    const recommendation = recommendTrail(t, overrides);
    const reasons = recommendation.positiveReasons.slice(0, 2);
    if(reasons.length < 2) reasons.push(...recommendation.cautions.slice(0, 2 - reasons.length));
    if(reasons.length) return reasons.map(reason => reason.message).join(' ');
  }catch(error){
    console.warn('Could not build the canonical match explanation.', error);
  }
  return isImported ? 'Estimated from mapped route data' : 'Recommendation details are unavailable';
}

function createMapOverlayControls(map, containerId, allLiftMarkers){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';
  const icons = window.DoloPawsIcons;

  // UI: one compact "Layers" button that expands into a chip panel —
  // replaces the old stack of full-width buttons that covered a third of
  // the map on mobile.
  // Marked routes default ON — the waymarked network is how walkable
  // ground stays visible; the Layers panel un-ticks it for a clean map.
  const overlayStates = { routes: true, lifts: false, fountains: false, huts: false, barsCafes: false, terrain: false };
  const layersBtn = document.createElement('button');
  layersBtn.type = 'button';
  layersBtn.textContent = t('map.layers');
  layersBtn.className = 'map-btn';
  layersBtn.style.left = '10px';
  layersBtn.setAttribute('aria-expanded', 'false');
  container.appendChild(layersBtn);

  const panel = document.createElement('div');
  panel.className = 'map-panel';
  panel.id = `${containerId}LayersPanel`;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', t('map.layers'));
  layersBtn.setAttribute('aria-controls', panel.id);
  container.appendChild(panel);

  const mapShell = container.closest('.li-map');
  function setLayersOpen(open){
    panel.style.display = open ? 'flex' : 'none';
    layersBtn.textContent = open ? t('map.closeLayers') : t('map.layers');
    layersBtn.setAttribute('aria-expanded', String(open));
    if(mapShell) mapShell.classList.toggle('map-layers-open', open);
  }

  layersBtn.addEventListener('click', () => {
    setLayersOpen(panel.style.display !== 'flex');
  });
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && panel.style.display === 'flex'){
      setLayersOpen(false);
      layersBtn.focus();
    }
  });

  function chipStyle(el, on){
    el.className = 'map-chip' + (on ? ' on' : '');
  }

  const LAYER_SETS = {
    routes:   ['waymarked-hiking-layer'],
    lifts:    ['trailmap-gondolas-line', 'trailmap-gondolas-labels'],
    fountains:['water-sources-layer-lowzoom', 'water-sources-layer', 'water-sources-cluster', 'water-sources-cluster-count'],
    huts:     ['mountain-huts-layer-lowzoom', 'mountain-huts-layer', 'mountain-huts-cluster', 'mountain-huts-cluster-count'],
    barsCafes:['bars-cafes-layer-lowzoom', 'bars-cafes-layer', 'bars-cafes-cluster', 'bars-cafes-cluster-count'],
  };

  function applyVisibility(key){
    const visibility = overlayStates[key] ? 'visible' : 'none';
    LAYER_SETS[key].forEach(id => {
      if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
    });
    if(key === 'lifts' && allLiftMarkers){
      allLiftMarkers.forEach(el => { el.style.visibility = overlayStates.lifts ? 'visible' : 'hidden'; });
    }
  }

  function mkChip(label, key){
    const chip = document.createElement('button');
    chip.type = 'button';
    const iconKey = key === 'fountains' ? 'water'
      : key === 'huts' ? 'hut'
      : key === 'barsCafes' ? 'food'
      : key;
    chip.innerHTML = icons ? icons.chipHtml(iconKey, label) : label;
    chipStyle(chip, overlayStates[key]);
    chip.addEventListener('click', () => {
      overlayStates[key] = !overlayStates[key];
      applyVisibility(key);
      chipStyle(chip, overlayStates[key]);
      renderMapLegend();
    });
    panel.appendChild(chip);
    return chip;
  }

  mkChip(t('chips.routes'), 'routes');
  mkChip(t('chips.lifts'), 'lifts');
  mkChip(t('chips.fountains'), 'fountains');
  mkChip(t('chips.huts'), 'huts');
  mkChip(t('chips.food'), 'barsCafes');

  // Map · Satellite · 3D live together in one visible switch on the map
  // (same group as the trail page), not buried inside the Layers panel.
  let flat3DCamera = null;
  function set3D(on){
    overlayStates.terrain = on;
    if(on){
      const currentZoom = map.getZoom();
      flat3DCamera = { center: map.getCenter(), zoom: currentZoom, bearing: map.getBearing() };
      map.setTerrain({ source: 'terrain-dem-3d', exaggeration: 1.3 });
      if(!map.getLayer('hillshade-layer')){
        map.addLayer({
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'terrain-dem',
          paint: { 'hillshade-exaggeration': 0.3 },
        }, map.getLayer('trail-paths-line') ? 'trail-paths-line' : undefined);
      }
      map.easeTo({ pitch: 38, zoom: Math.min(currentZoom, 12.25), duration: 500 });
    } else {
      map.setTerrain(null);
      if(map.getLayer('hillshade-layer')) map.removeLayer('hillshade-layer');
      map.easeTo({ pitch: 0, ...(flat3DCamera || {}), duration: 500 });
    }
  }
  function ensureSatelliteLayer(){
    if(map.getLayer('satellite-layer')) return true;
    if(!map.isStyleLoaded()) return false;
    map.addSource('satellite', {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri',
    });
    const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol');
    map.addLayer({
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      layout: { visibility: 'none' },
      paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 100 },
    }, firstSymbol && firstSymbol.id);
    return true;
  }
  (function buildLayerSwitch(){
    const host = map.getContainer();
    if(!host || host.querySelector('.td-layer-switch')) return;
    const wrap = document.createElement('div');
    wrap.className = 'td-layer-switch td-layer-switch--home';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Map style');
    wrap.innerHTML =
      '<button type="button" data-maplayer="map" class="on" aria-pressed="true">Map</button>' +
      '<button type="button" data-maplayer="satellite" aria-pressed="false">Satellite</button>' +
      '<button type="button" data-map3d aria-pressed="false">3D</button>';
    host.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
      const threeD = e.target.closest('[data-map3d]');
      if(threeD){
        const on = !threeD.classList.contains('on');
        set3D(on);
        threeD.classList.toggle('on', on);
        threeD.setAttribute('aria-pressed', String(on));
        return;
      }
      const base = e.target.closest('[data-maplayer]');
      if(!base || !ensureSatelliteLayer()) return;
      const sat = base.getAttribute('data-maplayer') === 'satellite';
      map.setLayoutProperty('satellite-layer', 'visibility', sat ? 'visible' : 'none');
      // The vector style's building fills sit above the raster and would
      // paint every roof grey on top of the photo imagery — hide them
      // while satellite is on.
      map.getStyle().layers.forEach(layer => {
        if(layer['source-layer'] === 'building' || /building/i.test(layer.id)){
          try { map.setLayoutProperty(layer.id, 'visibility', sat ? 'none' : 'visible'); } catch(err){}
        }
      });
      wrap.querySelectorAll('[data-maplayer]').forEach(b => {
        const on = b === base;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    });
  })();

  // UI: dynamic legend — only describes what is actually visible on the
  // map right now, instead of a fixed list of every possible layer.
  function renderMapLegend(){
    const legend = document.getElementById('trailMapLegend');
    if(!legend) return;
    const line = (color, label) => `<span><span style="width:14px;height:3px;background:${color};display:inline-block;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>${label}</span>`;
    const dash = (color, label) => `<span><span style="width:14px;height:0;border-top:2px dashed ${color};display:inline-block;margin-right:4px;vertical-align:middle;"></span>${label}</span>`;
    const category = (iconKey, color, label) => icons
      ? icons.legendItemHtml(iconKey, label, { color })
      : `<span><span style="width:9px;height:9px;background:${color};display:inline-block;border-radius:50%;margin-right:4px;vertical-align:middle;border:1px solid #fff;"></span>${label}</span>`;
    let html = line('#2C5C34', t('legend.low')) + line('#8A5A16', t('legend.moderate')) + line('#9C3A25', t('legend.caution'));
    if(overlayStates.lifts) html += line('#4E90A8', t('legend.liftConfirmed')) + dash('#5A5548', t('legend.liftUnknown'));
    if(overlayStates.fountains) html += category('water', '#4E90A8', t('legend.water'));
    if(overlayStates.huts) html += category('hut', '#8A5A16', t('legend.hut'));
    if(overlayStates.barsCafes) html += category('food', '#C4652F', t('legend.food'));
    legend.innerHTML = html;
  }
  renderMapLegend();
  return Object.freeze({ sync:applyVisibility });
}

function escapeLiftPopupText(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g,
    char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function publicLiftNote(note){
  return escapeLiftPopupText(String(note || '')
    .replace(/Operating season not recorded\s*[—-]\s*check directly with the operator before planning around it\.\s*/gi, '')
    .replace(/Station order \(from\/to\) reflects raw OSM way direction, NOT independently verified against elevation\s*-\s*treat the endpoint labels as unconfirmed for this batch\.\s*/gi, '')
    .trim());
}

function renderGondolas(map, sourceId, options){
  if(typeof gondolas === 'undefined' || !gondolas.length) return null;
  const visible = !!(options && options.visible);
  const features = gondolas.map(g => ({
    type: 'Feature',
    properties: { name: g.name, note: g.note, status: g.status },
    geometry: { type: 'LineString', coordinates: [[g.from.lng, g.from.lat], [g.to.lng, g.to.lat]] },
  }));
  map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });

  map.addLayer({
    id: sourceId + '-line',
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: visible ? 'visible' : 'none' },
    paint: {
      'line-color': [
        'match', ['get', 'status'],
        'summer', '#4E90A8',
        'no-summer', '#9C3A25',
        '#5A5548',
      ],
      'line-width': 1.5,
      'line-opacity': 0.9,
      'line-dasharray': ['match', ['get', 'status'], 'summer', ['literal', [1, 0]], ['literal', [2, 1]]],
    },
  });

  map.addLayer({
    id: sourceId + '-labels',
    type: 'symbol',
    source: sourceId,
    layout: {
      visibility: visible ? 'visible' : 'none',
      'symbol-placement': 'line',
      'symbol-spacing': 250,
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-rotation-alignment': 'map',
      'text-keep-upright': true,
    },
    paint: {
      'text-color': [
        'match', ['get', 'status'],
        'summer', '#2E4034',
        'no-summer', '#7a2818',
        '#4a4638',
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  });

  map.on('click', sourceId + '-line', (e) => {
    const p = e.features[0].properties;
    const note = publicLiftNote(p.note);
    new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat)
      .setHTML(`<b>${escapeLiftPopupText(p.name)}</b>${note ? '<br>' + note : ''}`).addTo(map);
  });
  map.on('mouseenter', sourceId + '-line', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', sourceId + '-line', () => map.getCanvas().style.cursor = '');

  const allLiftMarkers = [];
  gondolas.forEach(g => {
    const popupNote = publicLiftNote(g.note);
    [g.from, g.to].forEach(station => {
      const el = window.DoloPawsIcons
        ? window.DoloPawsIcons.createMarkerElement('lifts', { color: '#4E90A8' })
        : Object.assign(document.createElement('div'), { className: 'dp-marker', textContent: '🚡' });
      el.style.visibility = visible ? 'visible' : 'hidden';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(
          `<b>${escapeLiftPopupText(g.name)}</b>${popupNote ? '<br>' + popupNote : ''}`))
        .addTo(map);
      allLiftMarkers.push(el);
    });
  });
  
  return allLiftMarkers;
}


function initGuestMap(){
  if(guestMapInstance || typeof maplibregl === 'undefined' || typeof trails === 'undefined') return;
  const el = document.getElementById('guestPreviewMap');
  if(!el) return;

  const guestMapOptions = {
    container: 'guestPreviewMap',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [12.05, 46.55],
    zoom: 8,
    scrollZoom: false,
  };
  guestMapInstance = new maplibregl.Map(window.DoloPawsMapRuntime
    ? window.DoloPawsMapRuntime.mapOptions(guestMapOptions) : guestMapOptions);

  guestMapInstance.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
    fitBoundsOptions: { maxZoom: 15.5 },
  }), 'top-right');

  // Teaser pill: how much is waiting behind the profile gate.
  const guestMapEl = document.getElementById('guestPreviewMap');
  if (guestMapEl && typeof trails !== 'undefined'){
    guestMapEl.style.position = guestMapEl.style.position || 'relative';
    const pill = document.createElement('div');
    pill.textContent = t('guest.trailCount', {n: trails.length});
    pill.style.cssText = 'position:absolute;top:10px;left:10px;z-index:5;background:var(--ink);color:#fff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;';
    guestMapEl.appendChild(pill);

    // France announcement as a sticker slapped on the map's corner:
    // slightly rotated, bordered, with the beret-dog icon.
    const sticker = document.createElement('div');
    sticker.style.cssText = 'position:absolute;top:58px;right:14px;z-index:5;background:#fff;border:2px solid var(--ink);border-radius:14px;padding:10px 14px;max-width:210px;transform:rotate(4deg);box-shadow:0 4px 12px rgba(0,0,0,.18);display:flex;align-items:center;gap:9px;pointer-events:none;';
    sticker.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:none;"><circle cx="12" cy="14" r="6" stroke="var(--ink)" stroke-width="1.8"/><path d="M8 10.5L6.5 6l4.5 2.5z" fill="var(--ink)"/><path d="M6.5 9.5c1-2.5 3-3.8 5.5-3.8s4.5 1.3 5.5 3.8" fill="var(--accent-light)"/><circle cx="12" cy="5" r="1" fill="var(--accent-light)"/><circle cx="15.8" cy="15.2" r="1.3" fill="var(--accent-light)"/></svg>'
      + '<span style="font-size:12px;font-weight:700;color:var(--ink);line-height:1.35;">' + t('guest.franceBanner') + '</span>';
    guestMapEl.appendChild(sticker);

  }

  guestMapInstance.on('load', async () => {
    if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.enhance(guestMapInstance);
    addTerrainSource(guestMapInstance);
    // Guests get the same walkable-network view: marked routes + relief.
    const guestFirstLabel = guestMapInstance.getStyle().layers.find(l => l.type === 'symbol');
    guestMapInstance.addSource('waymarked-hiking', {
      type: 'raster',
      tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
    });
    guestMapInstance.addLayer({
      id: 'waymarked-hiking-layer',
      type: 'raster',
      source: 'waymarked-hiking',
      paint: {
        'raster-opacity': [
          'interpolate', ['linear'], ['zoom'],
          7, 0.64,
          10, 0.72,
          12, 0.86,
          14, 1,
        ],
        'raster-saturation': -0.68,
        'raster-contrast': 0.18,
        'raster-resampling': 'linear',
      },
    }, guestFirstLabel ? guestFirstLabel.id : undefined);
    addBaseHillshade(guestMapInstance, 'waymarked-hiking-layer');
    increaseLabelDensity(guestMapInstance);
    preventTransitPoiDuplication(guestMapInstance);
    addTerrainToggle(guestMapInstance, 'guestPreviewMap', 1.3, 0);
    if(window.DoloPawsIcons) await window.DoloPawsIcons.registerMapImages(guestMapInstance);
    // Lifts are useful planning context, but they should not dominate the
    // first map view. Keep them opt-in on the public preview too.
    const guestLiftMarkers = renderGondolas(guestMapInstance, 'guest-gondolas', { visible: false });
    const guestLiftToggle = document.createElement('button');
    guestLiftToggle.type = 'button';
    guestLiftToggle.className = 'map-btn guest-lifts-toggle';
    guestLiftToggle.textContent = t('chips.lifts');
    guestLiftToggle.setAttribute('aria-pressed', 'false');
    guestLiftToggle.style.left = '10px';
    guestLiftToggle.addEventListener('click', () => {
      const showing = guestLiftToggle.getAttribute('aria-pressed') !== 'true';
      guestLiftToggle.setAttribute('aria-pressed', showing ? 'true' : 'false');
      guestLiftToggle.classList.toggle('on', showing);
      ['guest-gondolas-line', 'guest-gondolas-labels'].forEach(id => {
        if(guestMapInstance.getLayer(id)) guestMapInstance.setLayoutProperty(id, 'visibility', showing ? 'visible' : 'none');
      });
      guestLiftMarkers.forEach(el => { el.style.visibility = showing ? 'visible' : 'hidden'; });
    });
    if(guestMapEl) guestMapEl.appendChild(guestLiftToggle);
    if (typeof makeBasemapPoisClickable === 'function') makeBasemapPoisClickable(guestMapInstance);
    // Real route lines for any trail that has one — same data the logged-in map uses.
    const pathFeatures = trails
      .filter(t => Array.isArray(t.path) && t.path.length > 1)
      .map(t => ({
        type: 'Feature',
        properties: { name: t.name, safetyLevel: t.safetyLevel },
        geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
      }));
    guestMapInstance.addSource('guest-trail-paths', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: pathFeatures },
    });
    guestMapInstance.addLayer({
      id: 'guest-trail-paths-casing',
      type: 'line',
      source: 'guest-trail-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#203B2A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 10, 7, 13, 9],
        'line-opacity': 0.96,
      },
    }, 'waymarked-hiking-layer');
    guestMapInstance.addLayer({
      id: 'guest-trail-paths-line',
      type: 'line',
      source: 'guest-trail-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'match', ['get', 'safetyLevel'],
          'low-risk', '#2C5C34',
          'moderate', '#8A5A16',
          'caution', '#9C3A25',
          '#2E4034',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 10, 4.5, 13, 5.5],
      },
    }, 'waymarked-hiking-layer');
    // The catalogue needs a visual language of its own. A light halo and
    // teal line sits *above* marked routes but below place labels. Its white
    // edge keeps official trail shields readable where paths coincide, while the
    // colour says this is an ORMA-mapped route rather than another waymark.
    guestMapInstance.addLayer({
      id: 'guest-trail-paths-orma-halo',
      type: 'line',
      source: 'guest-trail-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFDF7',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 4.5, 10, 7, 13, 8.5],
        'line-opacity': 0.94,
      },
    }, guestFirstLabel ? guestFirstLabel.id : undefined);
    guestMapInstance.addLayer({
      id: 'guest-trail-paths-orma-line',
      type: 'line',
      source: 'guest-trail-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#3E7A91',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 10, 3.5, 13, 4.5],
        'line-opacity': 1,
      },
    }, guestFirstLabel ? guestFirstLabel.id : undefined);

    const bounds = new maplibregl.LngLatBounds();
    trails.forEach(t => {
      if(typeof t.lat !== 'number' || typeof t.lng !== 'number') return;
      let markerLat = t.lat, markerLng = t.lng;
      if(t.startPoint){
        markerLat = t.startPoint.lat; markerLng = t.startPoint.lng;
      } else if(Array.isArray(t.path) && t.path.length > 0){
        [markerLat, markerLng] = t.path[0];
      }
      const trailNumber = t.ref ? window.t('card.trailRef', {ref: t.ref}) + '<br>' : '';
      // Guests get name + area only — trail pages stay behind a profile.
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<b>${t.name}</b><br>${trailNumber}${t.area}<br><span style="display:inline-block;margin-top:6px;font-size:11.5px;color:var(--ink-soft);">${window.t('guest.lockedPopup')}</span>`
      );
      new maplibregl.Marker({ element: makeTrailDot() }).setLngLat([markerLng, markerLat]).setPopup(popup).addTo(guestMapInstance);
      bounds.extend([markerLng, markerLat]);
    });
    guestMapInstance.fitBounds(bounds, { padding: 40, maxZoom: 10 });
  });
}

let guestMapSchedule = null;
function scheduleGuestMap(){
  if(guestMapInstance || guestMapSchedule) return;
  const target = document.getElementById('guestPreviewMap');
  if(!target) return;
  if(window.DoloPawsMapRuntime){
    guestMapSchedule = window.DoloPawsMapRuntime.whenVisible(target, initGuestMap, { rootMargin:'360px 0px' });
  } else {
    initGuestMap();
  }
}


let trailMapInstance = null;
let currentMapTrails = [];

let trailMapLoaded = false;
let pendingPathList = null;
let pendingMarkerList = null;

function collapseMapAttribution(container){
  if(!container) return;
  const attribution = container.querySelector('.maplibregl-ctrl-attrib');
  if(!attribution) return;
  attribution.classList.add('maplibregl-compact');
  attribution.classList.remove('maplibregl-compact-show');
  const toggle = attribution.querySelector('.maplibregl-ctrl-attrib-button');
  if(toggle) toggle.setAttribute('aria-expanded', 'false');
}

function initTrailMap(){
  if(trailMapInstance || typeof maplibregl === 'undefined') return;
  const el = document.getElementById('trailMap');
  if(!el) return;
  // Note: MapLibre uses [lng, lat] order — the opposite of Leaflet's [lat, lng].
  // Scroll zoom is fine here: in the logged-in shell the map is a fixed
  // pane (the document doesn't scroll), so the wheel can't hijack scrolling.
  const trailMapOptions = {
    container: 'trailMap',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [12.05, 46.55],
    zoom: 9,
    scrollZoom: true,
    // Collapsed ⓘ attribution (tap to expand) — the full-width credit line
    // collided with the phone layout's bottom-centre Record pill.
    attributionControl: { compact: true },
  };
  trailMapInstance = new maplibregl.Map(window.DoloPawsMapRuntime
    ? window.DoloPawsMapRuntime.mapOptions(trailMapOptions) : trailMapOptions);
  trailMapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  trailMapInstance.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
    fitBoundsOptions: { maxZoom: 15.5 },
  }), 'top-right');
  // MapLibre can briefly render the full credit strip while its style loads.
  // Start behind the compact ⓘ control; visitors can still open it on demand.
  collapseMapAttribution(el);

  // App-style fullscreen keeps every control anchored to its original
  // corner and works on iOS, where the browser Fullscreen API is limited.
  const mapWrap = document.getElementById('trailMapWrap');
  const expandButton = document.getElementById('homeMapExpandBtn');
  const setMapFullscreen = on => {
    if(!mapWrap) return;
    mapWrap.classList.toggle('map-fs', on);
    document.body.classList.toggle('map-fs-open', on);
    if(expandButton){
      expandButton.setAttribute('aria-expanded', String(on));
      expandButton.setAttribute('aria-label', on ? 'Close map' : 'Expand map');
      expandButton.innerHTML = on
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> <span>Close map</span>'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> <span>Expand map</span>';
    }
    setTimeout(() => trailMapInstance.resize(), 60);
  };
  if(expandButton){
    expandButton.addEventListener('click', () => setMapFullscreen(!mapWrap.classList.contains('map-fs')));
  }
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && mapWrap && mapWrap.classList.contains('map-fs')) setMapFullscreen(false);
  });
  window.DoloPawsBrowseMapFS = {
    enter:() => setMapFullscreen(true),
    exit:() => setMapFullscreen(false),
  };

  trailMapInstance.on('load', async () => {
    if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.enhance(trailMapInstance);
    collapseMapAttribution(el);
    addTerrainSource(trailMapInstance);
    increaseLabelDensity(trailMapInstance);
    preventTransitPoiDuplication(trailMapInstance);
    if(window.DoloPawsIcons) await window.DoloPawsIcons.registerMapImages(trailMapInstance);
    
    // Secondary lift markers are filled after the route catalogue is usable.
    // The shared array lets an already-rendered layer control manage markers
    // that join later without rebuilding the controls.
    const allLiftMarkers = [];
    
    // Waymarked Trails hiking overlay — shows route numbers, waymarking, and trail network detail
    const firstLabelLayer = trailMapInstance.getStyle().layers.find(l => l.type === 'symbol');
    trailMapInstance.addSource('waymarked-hiking', {
      type: 'raster',
      tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
    });
    trailMapInstance.addLayer({
      id: 'waymarked-hiking-layer',
      type: 'raster',
      source: 'waymarked-hiking',
      layout: { visibility: 'visible' },
      paint: {
        'raster-opacity': [
          'interpolate', ['linear'], ['zoom'],
          7, 0.64,
          10, 0.72,
          12, 0.86,
          14, 1,
        ],
        'raster-saturation': -0.68,
        'raster-contrast': 0.18,
        'raster-resampling': 'linear',
      },
    }, firstLabelLayer ? firstLabelLayer.id : undefined);
    addBaseHillshade(trailMapInstance, 'waymarked-hiking-layer');
    
    trailMapInstance.addSource('trail-paths', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    trailMapInstance.addLayer({
      id: 'trail-paths-casing',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#203B2A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 10, 8, 13, 10],
        'line-opacity': 0.96,
      },
    }, 'waymarked-hiking-layer');
    trailMapInstance.addLayer({
      id: 'trail-paths-line',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'step', ['coalesce', ['get', 'score'], 0],
          '#9C3A25', 65, '#C98A2E', 85, '#4A7856',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 10, 5, 13, 6],
      },
    }, 'waymarked-hiking-layer');
    // ORMA-mapped routes are deliberately distinct from the public marked
    // network: a teal, white-edged line is reserved for our catalogue.
    // Place labels remain above it, and the high-contrast edge protects route-number
    // shields where a recommended route follows an official marked trail.
    trailMapInstance.addLayer({
      id: 'trail-paths-orma-halo',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFDF7',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 4.5, 10, 7.5, 13, 9],
        'line-opacity': 0.94,
      },
    }, firstLabelLayer ? firstLabelLayer.id : undefined);
    trailMapInstance.addLayer({
      id: 'trail-paths-orma-line',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#3E7A91',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 10, 4, 13, 5],
        'line-opacity': 1,
      },
    }, firstLabelLayer ? firstLabelLayer.id : undefined);
    // Wide, near-invisible twin of the route line so a fingertip (or a
    // slightly-off cursor) still hits the trail — 3px is too thin a target.
    trailMapInstance.addLayer({
      id: 'trail-paths-hit',
      type: 'line',
      source: 'trail-paths',
      minzoom: 10,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0.01 },
    }, 'waymarked-hiking-layer');

    // Cluster trailheads at wider zooms so the map communicates density
    // without becoming a field of indistinguishable dots.
    trailMapInstance.addSource('trail-points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 48,
    });
    trailMapInstance.addLayer({
      id: 'trail-clusters',
      type: 'circle',
      source: 'trail-points',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2E4034',
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 24, 30, 28],
        'circle-stroke-width': 3.5,
        'circle-stroke-color': '#ffffff',
      },
    });
    trailMapInstance.addLayer({
      id: 'trail-cluster-count',
      type: 'symbol',
      source: 'trail-points',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 14,
      },
      paint: {
        'text-color': '#fff',
        'text-halo-color': 'rgba(0,0,0,.28)',
        'text-halo-width': 1,
      },
    });
    // Pin colour = match tier for THIS dog (mirrors the on-map legend and
    // the % badges in the list); a red ring marks saved trails.
    trailMapInstance.addLayer({
      id: 'trail-unclustered',
      type: 'circle',
      source: 'trail-points',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'step', ['coalesce', ['get', 'score'], 0],
          '#9C3A25', 65, '#C98A2E', 85, '#4A7856',
        ],
        'circle-radius': 7,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': [
          'case', ['==', ['coalesce', ['get', 'saved'], 0], 1], '#9C3A25', '#fff',
        ],
      },
    });
    trailMapInstance.addLayer({
      id: 'trail-selected-point',
      type: 'circle',
      source: 'trail-points',
      filter: ['==', ['get', 'id'], '__none__'],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 12,
        'circle-stroke-width': 4,
        'circle-stroke-color': '#fff',
      },
    });

    trailMapInstance.on('click', 'trail-clusters', async (e) => {
      const feature = e.features && e.features[0];
      if(!feature) return;
      const source = trailMapInstance.getSource('trail-points');
      try {
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        trailMapInstance.easeTo({ center: feature.geometry.coordinates, zoom });
      } catch(err) { /* cluster may have changed during a filter update */ }
    });
    trailMapInstance.on('click', 'trail-unclustered', (e) => {
      const feature = e.features && e.features[0];
      if(!feature) return;
      const selected = currentMapTrails.find(t => t.id === feature.properties.id);
      if(selected){
        selectTrail(selected);
        jumpToCard(selected.id);
      }
    });
    // The route line itself is a click target too — no need to hunt for
    // the trailhead dot. Clicking anywhere on a trail opens the single,
    // full-width ORMA trail card below the map.
    trailMapInstance.on('click', 'trail-paths-hit', (e) => {
      const feature = e.features && e.features[0];
      if(!feature) return;
      const selected = currentMapTrails.find(t => t.id === feature.properties.id);
      if(selected){
        selectTrail(selected);
        jumpToCard(selected.id);
      }
    });
    ['trail-clusters','trail-unclustered','trail-paths-hit'].forEach(layerId => {
      trailMapInstance.on('mouseenter', layerId, () => { trailMapInstance.getCanvas().style.cursor = 'pointer'; });
      trailMapInstance.on('mouseleave', layerId, () => { trailMapInstance.getCanvas().style.cursor = ''; });
    });

    // Create overlay toggle controls
    const overlayControls = createMapOverlayControls(trailMapInstance, 'trailMap', allLiftMarkers);
    
    // Keep the trail catalogue interactive first. Regional water, dog-route,
    // hut and bar datasets are secondary and join after the map becomes idle.
    const loadSecondaryMapData = () => {
      const liftMarkers = renderGondolas(trailMapInstance, 'trailmap-gondolas') || [];
      liftMarkers.forEach(marker => allLiftMarkers.push(marker));
      if(overlayControls) overlayControls.sync('lifts');
      initializeWaterSources(trailMapInstance);
      if (typeof initializeDogRoutes === 'function') initializeDogRoutes(trailMapInstance, activeRegion);
      initializeHutsBars(trailMapInstance);
    };
    if(window.DoloPawsMapRuntime) window.DoloPawsMapRuntime.onIdle(loadSecondaryMapData, 5000);
    else setTimeout(loadSecondaryMapData, 900);
    
    if (typeof makeBasemapPoisClickable === 'function') makeBasemapPoisClickable(trailMapInstance);

    trailMapLoaded = true;
    if(pendingPathList) updatePathLayer(pendingPathList);
    if(pendingMarkerList) updateMapMarkers(pendingMarkerList);
  });
}

let trailMapSchedule = null;
function scheduleTrailMap(){
  if(trailMapInstance || trailMapSchedule) return;
  const target = document.getElementById('trailMap');
  if(!target) return;
  if(window.DoloPawsMapRuntime){
    trailMapSchedule = window.DoloPawsMapRuntime.whenVisible(target, initTrailMap, {
      rootMargin:'360px 0px',
      triggers:[document.getElementById('homeMapExpandBtn')],
    });
    const expand = document.getElementById('homeMapExpandBtn');
    if(expand){
      expand.addEventListener('click', async event => {
        if(trailMapInstance || !trailMapSchedule || !trailMapSchedule.start) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        await trailMapSchedule.start();
        if(trailMapInstance) expand.click();
      }, { capture:true });
    }
  } else {
    initTrailMap();
  }
}

function pathThumbnailSvg(path){
  if(!Array.isArray(path) || path.length < 2) return null;
  const lats = path.map(p => p[0]), lngs = path.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 120, H = 90, pad = 10;
  const spanLat = (maxLat - minLat) || 0.0001;
  const spanLng = (maxLng - minLng) || 0.0001;
  const scale = Math.min((W - pad*2) / spanLng, (H - pad*2) / spanLat);
  const points = path.map(([lat, lng]) => {
    const x = pad + (lng - minLng) * scale + (W - pad*2 - spanLng*scale) / 2;
    const y = pad + (maxLat - lat) * scale + (H - pad*2 - spanLat*scale) / 2; // flip Y (lat increases upward)
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <rect width="${W}" height="${H}" fill="var(--sage-dim)"/>
    <polyline points="${points}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

// Increases label density by telling every text/icon layer in the base
// style to render even when it would otherwise overlap a neighbor. By
// default, vector styles hide crowded labels for cleanliness — this trades
// some visual tidiness for more names actually being visible, which is
// what was being asked for here. Works on any style without needing to
// know its specific internal layer names, since it targets every layer of
// type 'symbol' generically rather than hardcoded IDs.
function increaseLabelDensity(map){
  const layers = map.getStyle().layers || [];
  layers.forEach(layer => {
    if(layer.type !== 'symbol') return;
    const sl = layer['source-layer'];
    // Only boost PLACE names (towns, villages, hamlets) and mountain peaks:
    // clearing their minzoom makes them appear even when zoomed far out,
    // which is the effect that was actually wanted. Everything else (POI
    // icons, road names, house numbers) keeps the style's own collision
    // rules — forcing those all visible at once made town centers like
    // Canazei unreadably dense.
    if(sl !== 'place' && sl !== 'mountain_peak') return;
    try {
      map.setLayerZoomRange(layer.id, 0, 24);
      map.setLayoutProperty(layer.id, 'text-optional', true);
      // NOTE: deliberately NOT setting text-allow-overlap/icon-allow-overlap
      // anymore — that disabled collision detection entirely and was the
      // root cause of the overcrowded map. MapLibre's collision logic now
      // prunes overlapping labels automatically at every zoom.
    } catch(e) { /* some layers may not support one of these props — skip silently */ }
  });
}

// The "liberty" base style has two independent layers that can both match
// the same transit POI (bus/rail/airport stops):
//   poi_transit (blue, #2e5a80) - filters by class in [airport, bus, rail]
//   poi_r1 / poi_r7 / poi_r20 (grey, #666) - filter by rank only, with no
//     class exclusion, so a bus stop that also carries a rank value gets
//     rendered a SECOND time by whichever of these matches its rank range.
// Normally MapLibre's collision detection would hide one of the two
// duplicates; increaseLabelDensity() disables that (text-allow-overlap),
// so both now render permanently, stacked. Real fix: explicitly exclude
// transit classes from the generic rank-based layers, since poi_transit
// already owns those - only one layer renders each site after this.
function preventTransitPoiDuplication(map){
  const genericPoiLayers = ['poi_r1', 'poi_r7', 'poi_r20'];
  genericPoiLayers.forEach(layerId => {
    const layer = map.getStyle().layers.find(l => l.id === layerId);
    if(!layer || !layer.filter) return;
    try {
      const excludeTransit = ['!', ['match', ['get', 'class'], ['airport', 'bus', 'rail'], true, false]];
      map.setFilter(layerId, ['all', layer.filter, excludeTransit]);
    } catch(e) { /* layer may not exist in this style version — skip silently */ }
  });
}

function addTerrainToggle(map, containerId, exaggeration, defaultPitch){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '3D';
  btn.className = 'map-btn';
  btn.style.left = '88px';
  container.appendChild(btn);

  let is3D = false; // clean, flat, label-first map by default
  btn.addEventListener('click', () => {
    if(!is3D){
      map.setTerrain({ source: 'terrain-dem', exaggeration });
      if(!map.getLayer('hillshade-layer')){
        map.addLayer({
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'terrain-dem',
          paint: { 'hillshade-exaggeration': 0.3 },
        }, map.getLayer('trail-paths-line') ? 'trail-paths-line' : undefined);
      }
      map.easeTo({ pitch: defaultPitch || 0, duration: 500 });
      btn.textContent = '2D';
    } else {
      map.setTerrain(null);
      if(map.getLayer('hillshade-layer')) map.removeLayer('hillshade-layer');
      map.easeTo({ pitch: 0, duration: 500 });
      btn.textContent = '3D';
    }
    is3D = !is3D;
  });
}

function addTerrainSource(map){
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15,
  });
  map.addSource('terrain-dem-3d', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15,
  });
}

// Always-on subtle relief, AllTrails-style: terrain reads at a glance even
// in flat mode. The 3D toggle's own stronger hillshade layers on top of it.
function addBaseHillshade(map, beforeId){
  if(map.getLayer('base-hillshade') || !map.getSource('terrain-dem')) return;
  map.addLayer({
    id: 'base-hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: {
      'hillshade-exaggeration': 0.25,
      'hillshade-shadow-color': '#5A5548',
      'hillshade-method': 'igor',
    },
  }, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
}

// Compact dot marker for trails — replaces MapLibre's default teardrop
// pin, which turns into a wall of signposts with 100+ trails on screen.
function makeTrailDot(){
  const el = document.createElement('div');
  el.className = 'dp-marker-dot';
  return el;
}

// Companion selection: syncs the map pin, the floating callout, and the
// card border/shadow for one trail at a time. Reused by pin clicks,
// "Locate on map", and clicking a card thumbnail.
function selectTrail(t){
  selectedTrailId = t.id;
  setSelectedTrailPoint(t.id);
  document.querySelectorAll('#returningTrailList .tc-selected').forEach(c => c.classList.remove('tc-selected'));
  const card = document.getElementById(`trail-card-${t.id}`);
  if(card) card.classList.add('tc-selected');
  if(typeof showMapCallout === 'function') showMapCallout(t);
}

function setSelectedTrailPoint(id){
  if(!trailMapLoaded || !trailMapInstance || !trailMapInstance.getLayer('trail-selected-point')) return;
  trailMapInstance.setFilter('trail-selected-point', ['==', ['get', 'id'], id || '__none__']);
}

function jumpToCard(trailId){
  const card = document.getElementById(`trail-card-${trailId}`);
  if(!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('highlighted');
  setTimeout(() => card.classList.remove('highlighted'), 2000);
}

function updatePathLayer(list){
  if(!trailMapLoaded){
    pendingPathList = list;
    return;
  }
  const features = list
    .filter(t => Array.isArray(t.path) && t.path.length > 1)
    .map(t => ({
      type: 'Feature',
      properties: {
        id: t.id, name: t.name, safetyLevel: t.safetyLevel,
        score: typeof t.score === 'number' ? t.score : 0,
      },
      geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
    }));
  trailMapInstance.getSource('trail-paths').setData({ type: 'FeatureCollection', features });
  
  // NOTE: The 'water-sources' source is managed exclusively by initializeWaterSources(),
  // which loads the full OSM dataset (Trentino, Veneto, Savoy) from
  // water-sources-all-regions.geojson. Do NOT overwrite it here — the old code that
  // replaced its data with per-trail points was wiping out all the fountain markers.
}

function updateMapMarkers(list){
  if(!trailMapInstance) return;
  updatePathLayer(list);
  currentMapTrails = list.slice();
  if(!trailMapLoaded || !trailMapInstance.getSource('trail-points')){
    pendingMarkerList = list.slice();
    return;
  }

  const features = list.map(t => {
    if(typeof t.lat !== 'number' || typeof t.lng !== 'number') return null;
    // Prefer the verified trailhead over an approximate area coordinate.
    let markerLat = t.lat, markerLng = t.lng;
    if(t.startPoint){
      markerLat = t.startPoint.lat; markerLng = t.startPoint.lng;
    } else if(Array.isArray(t.path) && t.path.length > 0){
      [markerLat, markerLng] = t.path[0];
    }
    return {
      type: 'Feature',
      properties: {
        id: t.id, name: t.name, safetyLevel: t.safetyLevel,
        score: typeof t.score === 'number' ? t.score : 0,
        saved: currentFavorites[t.id] ? 1 : 0,
      },
      geometry: { type: 'Point', coordinates: [markerLng, markerLat] },
    };
  }).filter(Boolean);
  trailMapInstance.getSource('trail-points').setData({ type: 'FeatureCollection', features });
  setSelectedTrailPoint(selectedTrailId);
  pendingMarkerList = null;

  // Fit the view to whatever's currently visible, so filtering the list
  // also re-frames the map instead of leaving it zoomed to the wrong area.
  const validList = list.filter(t => typeof t.lat === 'number' && typeof t.lng === 'number');
  if(validList.length > 0){
    const bounds = new maplibregl.LngLatBounds();
    validList.forEach(t => {
      if(Array.isArray(t.path) && t.path.length > 1){
        t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
      } else {
        bounds.extend([t.lng, t.lat]);
      }
    });
    trailMapInstance.fitBounds(bounds, { padding: 40, maxZoom: 12 });
  }
}

const companionPanelToggle = document.getElementById('companionPanelToggle');
const companionPanelClose = document.getElementById('companionPanelClose');
const companionPanelBackdrop = document.getElementById('companionPanelBackdrop');
const companionSidebar = document.getElementById('companionSidebar');

function companionPanelIsMobile(){
  return window.matchMedia('(max-width: 900px)').matches;
}

function setCompanionPanelOpen(open, returnFocus){
  const next = !!open && companionPanelIsMobile();
  document.body.classList.toggle('companion-mobile-panel-open', next);
  if(companionPanelToggle) companionPanelToggle.setAttribute('aria-expanded', String(next));
  if(companionSidebar) companionSidebar.setAttribute('aria-hidden', String(companionPanelIsMobile() && !next));
  if(next && companionPanelClose) companionPanelClose.focus();
  if(!next && returnFocus && companionPanelToggle) companionPanelToggle.focus();
}

if(companionPanelToggle){
  companionPanelToggle.addEventListener('click', () => setCompanionPanelOpen(true));
}
if(companionPanelClose){
  companionPanelClose.addEventListener('click', () => setCompanionPanelOpen(false, true));
}
if(companionPanelBackdrop){
  companionPanelBackdrop.addEventListener('click', () => setCompanionPanelOpen(false, true));
}
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && document.body.classList.contains('companion-mobile-panel-open')){
    setCompanionPanelOpen(false, true);
  }
});
window.addEventListener('resize', () => setCompanionPanelOpen(false));
setCompanionPanelOpen(false);

async function activateReturningRegion(region, profile){
  if(region === activeRegion) return true;
  try {
    if(window.DoloPawsRegionalData) await window.DoloPawsRegionalData.loadRegion(region);
    activeRegion = region;
    activeValley = 'all';
    selectedTrailId = null;
    hideMapCallout();
    if(trailMapInstance) await updateRegionalMapData(trailMapInstance, region);
    renderReturningHomepage(profile);
    return true;
  } catch(e) {
    showHomeActionStatus('That area could not be loaded. Check your connection and try again.');
    return false;
  }
}

// Country is intentionally separate from Region: people often know the
// country before they know the local mountain area. Selecting one loads its
// current region now, while the model remains ready for more regions later.
function renderLiCountryControl(profile){
  const label = document.getElementById('liCountryLabel');
  const menu = document.getElementById('liCountryMenu');
  if(!label || !menu || typeof trails === 'undefined') return;
  const configs = window.DoloPawsRegions && window.DoloPawsRegions.REGIONS
    ? window.DoloPawsRegions.REGIONS
    : {
        dolomites: { country: 'Italy', countryCode: 'IT' },
        savoy: { country: 'France', countryCode: 'FR' }
      };
  const activeCountry = window.DoloPawsRegions && window.DoloPawsRegions.countryForRegion
    ? window.DoloPawsRegions.countryForRegion(activeRegion)
    : (activeRegion === 'savoy' ? 'FR' : 'IT');
  const entries = Object.entries(configs);
  const activeConfig = entries.find(([, config]) => config.countryCode === activeCountry);
  label.textContent = activeConfig ? activeConfig[1].country : 'Country';
  menu.innerHTML = '<div class="li-menu-kick">Country</div>';
  entries.forEach(([region, config]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'li-menu-item li-region-option' + (config.countryCode === activeCountry ? ' on' : '');
    button.dataset.country = config.countryCode;
    button.dataset.region = region;
    button.setAttribute('aria-pressed', String(config.countryCode === activeCountry));
    const count = window.DoloPawsRegionalData
      ? window.DoloPawsRegionalData.trailCount(region)
      : trails.filter(trail => trail.region === region).length;
    button.innerHTML = `<span>${config.country}</span><small>${count} trails</small>`;
    button.addEventListener('click', async () => {
      if(region === activeRegion){ liCloseMenus(); return; }
      button.disabled = true;
      const changed = await activateReturningRegion(region, profile);
      button.disabled = false;
      if(changed) liCloseMenus();
    });
    menu.appendChild(button);
  });
}

function renderLiSavedControl(){
  const button = document.getElementById('liSavedOnlyBtn');
  if(!button) return;
  const count = Object.keys(currentFavorites || {}).length;
  button.setAttribute('aria-pressed', String(showingSavedOnly));
  button.classList.toggle('on', showingSavedOnly);
  button.setAttribute('aria-label', showingSavedOnly ? 'Show all trails' : `Show saved trails only (${count})`);
  const countEl = document.getElementById('liSavedOnlyCount');
  if(countEl) countEl.textContent = String(count);
}

// The region is a first-order map choice, not an advanced refinement. Keep it
// visible beside search and leave the Filters panel for the more detailed
// source, valley, distance, terrain, shade, match and water controls.
function renderLiRegionControl(profile){
  const label = document.getElementById('liRegionLabel');
  const menu = document.getElementById('liRegionMenu');
  if(!label || !menu || typeof trails === 'undefined') return;
  label.textContent = activeRegion === 'savoy' ? 'Savoy' : 'Dolomites';
  menu.innerHTML = '<div class="li-menu-kick">Region</div>';
  [['dolomites', 'Dolomites'], ['savoy', 'Savoy / French Alps']].forEach(([region, name]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'li-menu-item li-region-option' + (region === activeRegion ? ' on' : '');
    button.setAttribute('aria-pressed', String(region === activeRegion));
    const count = window.DoloPawsRegionalData
      ? window.DoloPawsRegionalData.trailCount(region)
      : trails.filter(trail => trail.region === region).length;
    button.innerHTML = `<span>${name}</span><small>${count} trails</small>`;
    button.addEventListener('click', async () => {
      if(region === activeRegion){ liCloseMenus(); return; }
      button.disabled = true;
      const changed = await activateReturningRegion(region, profile);
      button.disabled = false;
      if(changed) liCloseMenus();
    });
    menu.appendChild(button);
  });
}

// Valley is the third visible geographic level. Its options are rebuilt from
// the active region, so changing country or region cannot leave a stale valley
// selected.
function renderLiValleyControl(profile){
  const label = document.getElementById('liValleyLabel');
  const menu = document.getElementById('liValleyMenu');
  if(!label || !menu || typeof trails === 'undefined') return;
  if(window.DoloPawsRegions) window.DoloPawsRegions.assign(trails);
  const valleys = window.DoloPawsRegions
    ? window.DoloPawsRegions.valleysFor(trails, activeRegion)
    : [];
  if(activeValley !== 'all' && !valleys.some(([valley]) => valley === activeValley)) activeValley = 'all';
  label.textContent = activeValley === 'all' ? 'All valleys' : activeValley;
  menu.innerHTML = '<div class="li-menu-kick">Valley</div>';
  const regionCount = trails.filter(trail => trail.region === activeRegion).length;
  [['all', 'All valleys', regionCount], ...valleys.map(([valley, count]) => [valley, valley, count])]
    .forEach(([value, name, count]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'li-menu-item li-region-option' + (value === activeValley ? ' on' : '');
      button.dataset.valley = value;
      button.setAttribute('aria-pressed', String(value === activeValley));
      button.innerHTML = `<span>${name}</span><small>${count} trails</small>`;
      button.addEventListener('click', () => {
        activeValley = value;
        liCloseMenus();
        renderReturningHomepage(profile);
      });
      menu.appendChild(button);
    });
}

// Companion sidebar — dog profile card. Avatar, breed/age line, and up to
// three trait chips reused straight from breedInsights() titles (so the
// wording is always identical to the homepage insight card and the
// per-trail "why this works" copy — one source of truth, three surfaces).
function renderDogProfileCard(profile){
  const nameEl = document.getElementById('companionDogName');
  const metaEl = document.getElementById('companionDogMeta');
  const chipsEl = document.getElementById('companionDogChips');
  const avatarEl = document.getElementById('companionDogAvatar');
  if(!nameEl || !metaEl || !chipsEl || !avatarEl) return;

  const name = (profile && profile.name) ? profile.name : 'Your dog';
  nameEl.textContent = name;
  const mobileLabel = document.getElementById('companionMobileDogLabel');
  if(mobileLabel) mobileLabel.textContent = profile && profile.name ? `${profile.name}'s profile` : 'dog profile';

  const breed = profile && profile.breed;
  const hasBreedName = breed && !NON_BREED_LABELS.has(breed);
  const age = profile ? dogAgeYears(profile) : null;
  const ageLabel = age != null ? (age < 1 ? 'under 1 yr' : Math.round(age) + ' yrs') : null;
  metaEl.textContent = [hasBreedName ? breed : null, ageLabel].filter(Boolean).join(' · ') || (profile ? 'Profile saved' : 'No profile yet');

  // Physical identity only (size/weight, coat, life stage) — the WHY behind
  // each trait (cold at rest, thin skin, etc.) is the breed-insight card's
  // job just below. Repeating those same titles up here read as duplicated
  // content once both cards were on screen together, so this card now
  // sticks to a quick-glance ID, not the reasoning.
  const kg = profile ? dogWeightKg(profile) : null;
  const sizeLabel = kg == null ? null : kg < 10 ? 'Small' : kg <= 25 ? 'Medium' : kg <= 45 ? 'Large' : 'Giant';
  const tr = (typeof breedTraits === 'function' && breed) ? breedTraits(breed) : {};
  const chips = [];
  if(sizeLabel) chips.push(kg ? `${sizeLabel} · ${Math.round(kg)} kg` : sizeLabel);
  if(tr.thickCoat) chips.push('Heavy double coat');
  else if(tr.brachy) chips.push('Flat-faced');
  const fitness = profile && profile.fitness;
  if(fitness) chips.push(fitness.charAt(0).toUpperCase() + fitness.slice(1) + ' fitness');
  if(age != null && age < 1) chips.push('Puppy');
  else if(age != null && age >= 8) chips.push('Senior');
  chipsEl.innerHTML = chips.slice(0, 3).map(c => `<span class="companion-chip">${c}</span>`).join('');

  const photo = profile && profile.photo;
  avatarEl.innerHTML = (typeof photo === 'string' && photo.startsWith('data:image/'))
    ? `<img src="${photo}" alt="${name}">`
    : (window.DoloPawsIcons ? window.DoloPawsIcons.renderIconSvg('dog', { mode:'inline', color:'currentColor', size:24 }) : '');

  // Greeting-avatar switcher panel mirrors the same identity.
  const greetName = document.getElementById('liGreetRowName');
  if(greetName) greetName.textContent = name;
  const greetMeta = document.getElementById('liGreetRowMeta');
  if(greetMeta) greetMeta.textContent = metaEl.textContent;
  liFillAvatar(document.getElementById('liGreetRowAvatar'), profile);
}

// Companion sidebar — conditions / readiness card. ORMA has no live
// weather feed, so rather than inventing a temperature this reflects the
// dog's REAL heat-sensitivity (breed traits + declared health conditions,
// the same flag effectiveOverrides() already uses to penalise the score)
// and points at the real adjust-for-today tool instead of a fake forecast.
function renderConditionsCard(profile){
  const card = document.getElementById('companionConditionsCard');
  const labelEl = document.getElementById('companionConditionsLabel');
  const barsEl = document.getElementById('companionHeatBars');
  const readingEl = document.getElementById('companionHeatReading');
  const noteEl = document.getElementById('companionConditionsNote');
  if(!card) return;

  // The "Adjust for today" button lives inside this card, so the card
  // itself must stay visible even with no saved profile yet — otherwise
  // a logged-in user without a dog profile would have no way to reach it.
  if(!profile){
    labelEl.textContent = 'HEAT READINESS';
    barsEl.innerHTML = [0,1,2].map(() => '<span class="bar"></span>').join('');
    readingEl.textContent = '';
    noteEl.innerHTML = `Add your dog's details to see their real heat tolerance here. Meanwhile, trails below use an average-dog default.`;
    card.hidden = false;
    return;
  }

  const overrides = effectiveOverrides(profile, null);
  const sensitive = !!overrides.heatSensitive;
  const level = sensitive ? 2 : 1; // segments lit out of 3
  const name = profile.name || 'your dog';

  labelEl.textContent = sensitive ? 'HEAT-SENSITIVE DOG' : 'HEAT READINESS';
  barsEl.innerHTML = [0,1,2].map(i => `<span class="bar${i < level ? ' on' : ''}"></span>`).join('');
  readingEl.textContent = sensitive ? 'Higher risk' : 'Typical';
  noteEl.innerHTML = sensitive
    ? `${name}'s breed or health profile runs hotter on exposed climbs, so shaded and low routes are ranked higher below. <strong>Start early on warm days.</strong>`
    : `Match scores already account for ${name}'s heat tolerance. Use "Adjust for today" if today's weather changes what's sensible.`;
  card.hidden = false;
}

// Personalised breed-insight card on the logged-in homepage. Reads documented
// physical traits via breedInsights() (breeds-data.js) and shows only lines
// that apply. Unknown/mixed breeds → card stays hidden (health profile does the
// work instead). Physical traits only, never temperament.
// Breed labels that carry no classifiable breed information — coarse
// size buckets or a genuine unknown. The card still renders for these,
// just headed by the dog's name instead of a breed name (profileInsights
// still supplies weight/age/condition-derived lines for them).
const NON_BREED_LABELS = new Set([
  'Mixed breed — small (under 10 kg)', 'Mixed breed — medium (10–25 kg)',
  'Mixed breed — large (over 25 kg)', 'Rescue / unknown mix',
]);

function renderBreedInsight(profile){
  const card = document.getElementById('breedInsightCard');
  if(!card || typeof profileInsights !== 'function') return;
  const kicker = document.getElementById('breedInsightKicker');
  const grid = document.getElementById('breedInsightGrid');
  const note = document.getElementById('breedInsightNote');
  const cta = document.getElementById('breedInsightCta');

  const breed = profile && profile.breed;
  const lines = profileInsights(profile);
  if(!lines.length){ card.hidden = true; return; }

  const ICONS = {
    paw:'<circle cx="8" cy="8.2" r="1.6" fill="#5DCAA5"/><circle cx="12" cy="6.6" r="1.6" fill="#5DCAA5"/><circle cx="16" cy="8.2" r="1.6" fill="#5DCAA5"/><path d="M8.4 16.5c0-2.4 1.5-4.2 3.6-4.2s3.6 1.8 3.6 4.2c0 1.4-1.1 2.5-2.5 2.5-.7 0-1.1-.3-1.7-.7-.5.4-1 .7-1.7.7-1.3 0-2.3-1.1-2.3-2.5Z" fill="#1D9E75"/>',
    shade:'<path d="M12 5v14M7 19h10M6 12c0-3 2.7-6 6-6s6 3 6 6Z" fill="none" stroke="#4A7856" stroke-width="1.8"/><path d="m7 12-3 3M17 12l3 3" fill="none" stroke="#4A7856" stroke-width="1.8"/>',
    heat:'<circle cx="12" cy="12" r="4" fill="#D6A038"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="#D6A038" stroke-width="1.8" stroke-linecap="round"/>',
    mountain:'<path d="m4 18 6-10 3 5 2-3 5 8Z" fill="none" stroke="#BA7517" stroke-width="1.8" stroke-linejoin="round"/>',
    loop:'<path d="M18 8a7 7 0 1 0 1 7M18 4v4h-4" fill="none" stroke="#3E7A91" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    crowd:'<circle cx="6.3" cy="4.6" r="2.1" fill="none" stroke="#8B6F47" stroke-width="1.7"/><path d="M7.8 6.6c3.4 2 7.6 3.6 8.6 8.2" fill="none" stroke="#8B6F47" stroke-width="1.7" stroke-linecap="round"/><circle cx="17.3" cy="17.3" r="2.4" fill="none" stroke="#8B6F47" stroke-width="1.7"/>',
    cold:'<path d="M12 3v18M12 3l-2.2 2.2M12 3l2.2 2.2M12 21l-2.2-2.2M12 21l2.2-2.2M4 8l16 8M4 8l2.8.6M4 8l1-2.7M20 16l-2.8-.6M20 16l-1 2.7M4 16l16-8M4 16l2.8-.6M4 16l1 2.7M20 8l-2.8.6M20 8l-1-2.7" fill="none" stroke="#4C87C6" stroke-width="1.4" stroke-linecap="round"/>',
    water:'<path d="M12 4c2.8 3.4 4.5 6 4.5 8.4a4.5 4.5 0 1 1-9 0C7.5 10 9.2 7.4 12 4Z" fill="#378ADD"/>'
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const name = (profile && profile.name) ? profile.name : 'your dog';
  const hasBreedName = breed && !NON_BREED_LABELS.has(breed);
  if(kicker) kicker.textContent = hasBreedName
    ? 'What the mountains ask of a ' + breed
    : 'What matters for ' + name + '\u2019s hikes';
  // 3 columns reads best; if only 1-2 lines the grid still balances.
  grid.style.gridTemplateColumns = 'repeat(' + Math.min(3, Math.max(1, lines.length)) + ', 1fr)';
  grid.innerHTML = lines.slice(0, 6).map(function(l){
    return '<div class="breed-insight-signal"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      (ICONS[l.icon] || ICONS.paw) + '</svg><span><b>' + esc(l.title) +
      '</b><small>' + esc(l.sub) + '</small></span></div>';
  }).join('');

  if(note) note.textContent = 'Baked into every match score for ' + name + '.';
  if(cta) cta.textContent = 'See trails picked for ' + name + ' \u2192';
  card.hidden = false;
}

// ============================================================
// LOGGED-IN SHELL — header search, filter panel, account menu and
// on-map conditions card for the map-first homepage layout.
// ============================================================

function liActiveFilterCount(){
  return [
    liFilters.dist !== 'any',
    liFilters.risk !== 'any',
    liFilters.terrain !== 'any',
    liFilters.shade !== 'any',
    liFilters.minMatch > 0,
    liFilters.water,
    showingSavedOnly,
    activeValley !== 'all',
  ].filter(Boolean).length;
}

function liResetAllFilters(){
  liQuery = '';
  liFilters = { dist: 'any', risk: 'any', terrain: 'any', shade: 'any', minMatch: 0, water: false };
  showingSavedOnly = false;
  activeValley = 'all';
  const search = document.getElementById('liSearch');
  if(search) search.value = '';
  renderReturningHomepage(currentProfileForAdjust);
}

function liCloseMenus(){
  ['liFiltersMenu', 'liCountryMenu', 'liRegionMenu', 'liValleyMenu', 'liAccountMenu', 'liGreetSwitchMenu', 'liBellMenu'].forEach(id => {
    const menu = document.getElementById(id);
    if(menu) menu.hidden = true;
  });
  ['liFiltersBtn', 'liCountryBtn', 'liRegionBtn', 'liValleyBtn', 'liAccountBtn', 'liGreetSwitchBtn', 'liBellBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.setAttribute('aria-expanded', 'false');
  });
}

// Dog photo resolution shared by the account pill and the conditions card:
// account profile first, then the per-uid cache, then the legacy device key.
function liDogPhoto(profile){
  const isImage = v => typeof v === 'string' && v.startsWith('data:image/');
  const uid = window.DoloPawsAuth && window.DoloPawsAuth.currentUser && window.DoloPawsAuth.currentUser.uid;
  const candidates = [profile && profile.photo];
  try {
    if(uid && profile && profile.id) candidates.push(localStorage.getItem('dolopaws-dog-photo-' + uid + '-' + profile.id));
    if(!profile || !profile.id){
      if(uid) candidates.push(localStorage.getItem('dolopaws-dog-photo-' + uid));
      candidates.push(localStorage.getItem('dolopaws-dog-photo'));
    }
  } catch(e){}
  return candidates.find(isImage) || null;
}

function liFillAvatar(el, profile){
  if(!el) return;
  const photo = liDogPhoto(profile);
  const name = (profile && profile.name) ? profile.name.trim() : '';
  if(photo){
    el.style.backgroundImage = `url(${photo})`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = 'none';
    el.textContent = name ? name.charAt(0).toUpperCase() : '🐾';
  }
}

// Profile reads and the cached summary are refreshed independently. If a
// network read briefly returns null, keep painting the active cached dog
// instead of flashing the signed-in fallback between completed renders.
function liResolveActiveProfile(profile){
  if(profile && profile.name) return profile;
  let summary = null;
  try { summary = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null'); } catch(e){}
  if(!(summary && summary.hasProfile !== false)) return profile;
  const dogs = Array.isArray(summary.dogs) ? summary.dogs : [];
  const active = dogs.find(dog => dog && dog.id === summary.activeDogId) || dogs[0];
  if(active && active.name) return active;
  return summary.name ? summary : profile;
}

function renderLiDogLists(profile){
  let summary = null;
  try { summary = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null'); } catch(e){}
  const dogs = summary && Array.isArray(summary.dogs) && summary.dogs.length
    ? summary.dogs : profile ? [profile] : [];
  const activeId = summary && summary.activeDogId || (profile && profile.id);
  ['liDogList','liGreetDogList'].forEach(id => {
    const list = document.getElementById(id);
    if(!list) return;
    list.innerHTML = '';
    dogs.forEach(dog => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'nav-dogmenu-row' + (dog.id === activeId ? ' on' : '');
      row.setAttribute('aria-pressed', String(dog.id === activeId));
      const avatar = document.createElement('span');
      avatar.className = 'li-avatar';
      liFillAvatar(avatar, dog);
      const copy = document.createElement('span');
      copy.style.cssText = 'flex:1;min-width:0;';
      const name = document.createElement('b');
      name.textContent = dog.name || 'Your dog';
      const meta = document.createElement('small');
      meta.textContent = [dog.breed, dog.fitness ? dog.fitness + ' fitness' : null].filter(Boolean).join(' · ');
      copy.append(name, meta);
      row.append(avatar, copy);
      row.addEventListener('click', async () => {
        if(dog.id === activeId || !window.DoloPawsAuth || !window.DoloPawsAuth.selectDogProfile) return;
        row.disabled = true;
        const ok = await window.DoloPawsAuth.selectDogProfile(dog.id);
        if(ok) window.location.reload();
        else row.disabled = false;
      });
      list.appendChild(row);
    });
  });
  const moderator = document.getElementById('liModeratorLink');
  if(moderator) moderator.hidden = !(summary && summary.moderator === true);
}

// Dog pill + switcher panel labels. Called on every render so a wizard
// save or photo upload is reflected immediately.
function renderLiHeader(profile){
  const nameEl = document.getElementById('liAccountName');
  // The pill carries the dog itself (design TopNav dog pill), not the human.
  if(nameEl) nameEl.textContent = (profile && profile.name) ? profile.name : 'Your dog';
  renderLiToolbarContext(profile);
  liFillAvatar(document.getElementById('liAccountAvatar'), profile);
  // Phone greeting row carries the dog's face next to the greeting.
  liFillAvatar(document.getElementById('liGreetAvatar'), profile);
  liFillAvatar(document.getElementById('liDogCtxAvatar'), profile);
  renderLiDogLists(profile);
  const manage = document.getElementById('liManageLink');
  if(manage) manage.textContent = (profile && profile.name)
    ? 'Manage dog profiles →'
    : "Set up your dog's profile";
  const matchLabel = document.getElementById('liMatchSecLabel');
  if(matchLabel) matchLabel.textContent = (profile && profile.name)
    ? `Minimum match for ${profile.name}`
    : 'Minimum match';
}

function renderLiToolbarContext(profile){
  const dogName = (profile && profile.name) ? profile.name : 'Your dog';
  const breed = profile && profile.breed ? profile.breed : '';
  // Desktop trail context is static; dog switching lives in the main nav.
  const ctxName = document.getElementById('liDogCtxName');
  if(ctxName) ctxName.textContent = dogName;
  const ctxBreed = document.getElementById('liDogCtxBreed');
  const ctxBreedSep = document.getElementById('liDogCtxBreedSep');
  const hasBreedName = breed && !NON_BREED_LABELS.has(breed);
  if(ctxBreed){
    ctxBreed.textContent = breed;
    ctxBreed.hidden = !hasBreedName;
    ctxBreed.title = hasBreedName ? `Read hiking caveats for ${breed}` : '';
  }
  if(ctxBreedSep) ctxBreedSep.hidden = !hasBreedName;
  const toolbarContext = document.getElementById('liToolbarDogContext');
  if(!toolbarContext) return;
  toolbarContext.replaceChildren(document.createTextNode(dogName));
  if(breed){
    toolbarContext.appendChild(document.createTextNode(' · '));
    if(hasBreedName){
      const breedLink = document.createElement('a');
      breedLink.className = 'li-toolbar-breed';
      breedLink.href = 'guides/breed-group-caveats.html';
      breedLink.textContent = breed;
      breedLink.title = `Read hiking caveats for ${breed}`;
      toolbarContext.appendChild(breedLink);
    } else {
      toolbarContext.appendChild(document.createTextNode(breed));
    }
  }
}

// Filter panel — segmented options + toggle rows. Rebuilt on every render
// so the active states always mirror the real filter state.
function renderLiControls(){
  const seg = (elId, opts, cur, pick) => {
    const el = document.getElementById(elId);
    if(!el) return;
    el.innerHTML = '';
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'li-segbtn' + (o.v === cur ? ' on' : '');
      b.textContent = o.label;
      b.addEventListener('click', () => { pick(o.v); renderReturningHomepage(currentProfileForAdjust); });
      el.appendChild(b);
    });
  };

  seg('liDistSeg', [
    { label: 'Any', v: 'any' }, { label: 'Under 5 km', v: 'u5' }, { label: '5–10 km', v: '5to10' }, { label: '10 km+', v: '10p' },
  ], liFilters.dist, v => { liFilters.dist = v; });
  seg('liRiskSeg', [
    { label: 'Any', v: 'any' }, { label: 'Low risk', v: 'low-risk' }, { label: 'Moderate', v: 'moderate' }, { label: 'Caution', v: 'caution' },
  ], liFilters.risk, v => { liFilters.risk = v; });
  seg('liTerrainSeg', [
    { label: 'Any', v: 'any' }, { label: 'Gentle only', v: 'soft' }, { label: 'Up to mixed', v: 'mixed' }, { label: 'Rocky is okay', v: 'rocky' },
  ], liFilters.terrain, v => { liFilters.terrain = v; });
  seg('liMatchSeg', [
    { label: 'Any', v: 0 }, { label: '60%+', v: 60 }, { label: '75%+', v: 75 }, { label: '85%+', v: 85 },
  ], liFilters.minMatch, v => { liFilters.minMatch = v; });

  const n = liActiveFilterCount();
  const badge = document.getElementById('liFiltersBadge');
  if(badge) badge.textContent = n > 0 ? `(${n})` : '';
  const filtBtn = document.getElementById('liFiltersBtn');
  if(filtBtn) filtBtn.classList.toggle('on', n > 0);

  const quickStates = [
    ['liQuickShade', liFilters.shade === '60'],
    ['liQuickWater', liFilters.water],
  ];
  quickStates.forEach(([id, on]) => {
    const button = document.getElementById(id);
    if(button) button.setAttribute('aria-pressed', String(on));
  });

  renderLiChips();
}

// ---- Inline filter chips (design FilterBar): Any area · Distance ·
// Terrain · Shade · Water. Desktop-width control; phones keep the
// condensed Filters panel. Each chip is a popover listing its options;
// an active (non-default) chip shows its value with the accent tint. ----
let liOpenChipKey = null;
let liChipsOutsideWired = false;
function renderLiChips(){
  const wrap = document.getElementById('liChips');
  if(!wrap || typeof trails === 'undefined') return;

  const valleys = window.DoloPawsRegions
    ? window.DoloPawsRegions.valleysFor(trails, activeRegion)
    : [];
  const otherRegion = activeRegion === 'dolomites' ? 'savoy' : 'dolomites';
  const otherLabel = otherRegion === 'savoy' ? 'Savoy / French Alps' : 'Dolomites';
  const areaOptions = [
    { label: 'Any area', pick(){ activeValley = 'all'; } },
    ...valleys.map(([v, n]) => ({ label: `${v} (${n})`, value: v, pick(){ activeValley = v; } })),
    { label: otherLabel + ' →', async pick(){
      if(window.DoloPawsRegionalData) await window.DoloPawsRegionalData.loadRegion(otherRegion);
      activeRegion = otherRegion;
      if(trailMapInstance) await updateRegionalMapData(trailMapInstance, otherRegion);
      activeValley = 'all';
    } },
  ];

  const DIST_OPTS = [['any','Any'], ['u5','Under 5 km'], ['5to10','5–10 km'], ['10p','10 km+']];
  const TERRAIN_OPTS = [['any','Any'], ['soft','Gentle only'], ['mixed','Up to mixed'], ['rocky','Rocky is okay']];
  const SHADE_OPTS = [['any','Any'], ['40','Over 40%'], ['60','Over 60%']];
  const label = (opts, v) => (opts.find(([k]) => k === v) || opts[0])[1];

  const chips = [
    { key: 'area', title: 'Area',
      display: activeValley !== 'all' ? activeValley : 'Any area',
      on: activeValley !== 'all',
      options: areaOptions.map(o => ({ label: o.label, selected: o.value ? o.value === activeValley : activeValley === 'all' && !o.label.endsWith('→'), pick: o.pick })) },
    { key: 'dist', title: 'Distance',
      display: liFilters.dist === 'any' ? 'Distance' : label(DIST_OPTS, liFilters.dist),
      on: liFilters.dist !== 'any',
      options: DIST_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.dist === k, pick(){ liFilters.dist = k; } })) },
    { key: 'terrain', title: 'Terrain',
      display: liFilters.terrain === 'any' ? 'Terrain' : label(TERRAIN_OPTS, liFilters.terrain),
      on: liFilters.terrain !== 'any',
      options: TERRAIN_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.terrain === k, pick(){ liFilters.terrain = k; } })) },
    { key: 'shade', title: 'Shade',
      display: liFilters.shade === 'any' ? 'Shade' : label(SHADE_OPTS, liFilters.shade) + ' shade',
      on: liFilters.shade !== 'any',
      options: SHADE_OPTS.map(([k, l]) => ({ label: l, selected: liFilters.shade === k, pick(){ liFilters.shade = k; } })) },
    { key: 'water', title: 'Water',
      display: liFilters.water ? 'Water on route' : 'Water',
      on: liFilters.water,
      options: [
        { label: 'Any', selected: !liFilters.water, pick(){ liFilters.water = false; } },
        { label: 'Water on route', selected: liFilters.water, pick(){ liFilters.water = true; } },
      ] },
  ];

  wrap.innerHTML = '';
  chips.forEach(chip => {
    const holder = document.createElement('div');
    holder.className = 'li-menuwrap li-chipwrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'li-chip' + (chip.on ? ' on' : '');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', String(liOpenChipKey === chip.key));
    btn.innerHTML = `${chip.display} <span class="li-caret" aria-hidden="true">▾</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      liOpenChipKey = liOpenChipKey === chip.key ? null : chip.key;
      renderLiChips();
    });
    holder.appendChild(btn);

    if(liOpenChipKey === chip.key){
      const menu = document.createElement('div');
      menu.className = 'li-menu li-chipmenu';
      const kick = document.createElement('div');
      kick.className = 'li-menu-kick';
      kick.textContent = chip.title;
      menu.appendChild(kick);
      chip.options.forEach(o => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'li-menu-item' + (o.selected ? ' li-chip-selected' : '');
        item.textContent = o.label;
        item.addEventListener('click', async () => {
          item.disabled = true;
          try {
            await o.pick();
            liOpenChipKey = null;
            renderReturningHomepage(currentProfileForAdjust);
          } catch(e) {
            showHomeActionStatus('That region could not be loaded. Check your connection and try again.');
          } finally {
            item.disabled = false;
          }
        });
        menu.appendChild(item);
      });
      holder.appendChild(menu);
    }
    wrap.appendChild(holder);
  });

  if(!liChipsOutsideWired){
    liChipsOutsideWired = true;
    document.addEventListener('click', (e) => {
      if(liOpenChipKey && !e.target.closest('.li-chipwrap')){
        liOpenChipKey = null;
        renderLiChips();
      }
    });
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape' && liOpenChipKey){
        liOpenChipKey = null;
        renderLiChips();
      }
    });
  }
}

// Conditions card on the map — real profile-derived readings only (heat
// tolerance and paw/terrain tolerance from the same overrides the scorer
// uses, plus today's great-match count). No invented weather.
function renderLiConditionsCard(profile, displayList){
  const card = document.getElementById('liConditionsCard');
  if(!card) return;
  if(!profile){ card.hidden = true; return; }

  const overrides = effectiveOverrides(profile, null);
  const name = profile.name || 'Your dog';
  // Desktop card: "{dog}'s conditions". The phone pill shows just the
  // dog's name — the greeting lives above the search bar there, and
  // "Eddie's conditions" read oddly as a map title. Both spans render;
  // CSS picks one per layout, so re-renders stay safe.
  const condTitle = document.getElementById('liCondTitle');
  condTitle.innerHTML = '<span class="li-cond-t-desk"></span><span class="li-cond-t-mobile"></span>';
  condTitle.querySelector('.li-cond-t-desk').textContent = `${name}'s conditions`;
  condTitle.querySelector('.li-cond-t-mobile').textContent = name;
  document.getElementById('liCondSub').textContent =
    (activeRegion === 'savoy' ? t('region.savoy') : t('region.theDolomites')) + ' · today';
  liFillAvatar(document.getElementById('liCondAvatar'), profile);

  const great = (displayList || []).filter(x => x.score >= 85).length;
  const tiles = [
    overrides.heatSensitive
      ? { v: 'Watch', c: '#8A5A16', l: 'Heat' }
      : { v: 'Good', c: '#2C5C34', l: 'Heat' },
    overrides.terrain === '0'
      ? { v: 'Tender', c: '#8A5A16', l: 'Paws' }
      : { v: 'Good', c: '#2C5C34', l: 'Paws' },
    { v: String(great), c: '#2E4034', l: great === 1 ? 'Great fit' : 'Great fits' },
  ];
  document.getElementById('liCondTiles').innerHTML = tiles.map(ti =>
    `<div class="li-cond-tile"><b style="color:${ti.c};">${ti.v}</b><small>${ti.l}</small></div>`).join('');
  card.hidden = false;
}

// One-time event wiring for the shell chrome (menus, search, logout…).
// Bell badge from the derived feed (saved-trail advisories, audits, profile
// events) minus the durable read list. The notification centre resolves all
// items it displays, so a refresh cannot recreate their badge. Runs at shell
// init and again once favorites have loaded, since advisories depend on them.
function liReadList(){
  try {
    const read = JSON.parse(localStorage.getItem('dolopaws-notif-seen') || '[]');
    const list = Array.isArray(read) ? read : [];
    // One-time migration for people who opened the old centre: a glance meant
    // the bell was resolved, so preserve that intent in the unified state.
    const legacy = JSON.parse(localStorage.getItem('dolopaws-notif-glanced') || '[]');
    if(Array.isArray(legacy)) legacy.forEach(id => { if(!list.includes(id)) list.push(id); });
    localStorage.setItem('dolopaws-notif-seen', JSON.stringify(list));
    localStorage.removeItem('dolopaws-notif-glanced');
    return list;
  } catch(e){}
  return [];
}
function refreshLiBellBadge(){
  const dot = document.getElementById('liBellDot');
  let bellUnread = 0;
  try {
    if(window.DoloPawsNotifFeed && typeof trails !== 'undefined'){
      const feed = window.DoloPawsNotifFeed.build({
        trails, favorites: currentFavorites || {}, now: Date.now()
      });
      const read = window.DoloPawsNotifFeed.migrateReadIds(feed, liReadList());
      localStorage.setItem('dolopaws-notif-seen', JSON.stringify(read));
      bellUnread = window.DoloPawsNotifFeed.badgeCount(feed, read);
      localStorage.setItem('dolopaws-notif-unread', String(bellUnread));
      window.dispatchEvent(new CustomEvent('dolopaws-notifications-changed', {
        detail:{ unread:bellUnread }
      }));
    }
  } catch(e){}
  if(dot) dot.hidden = bellUnread === 0;
  refreshLiBellBadgeLive();
}

// Second pass with the Firestore content (hazard flags on saved trails,
// operator notices) once per page view — the sync pass above painted the
// derived-only count immediately.
let liBellLiveFetchKey = null;
let liBellLiveRequest = 0;
function refreshLiBellBadgeLive(){
  const auth = window.DoloPawsAuth;
  const community = window.DoloPawsCommunity;
  if(!auth || !auth.currentUser || !community || !window.DoloPawsNotifFeed) return;
  if(typeof community.getActiveFlagsForTrails !== 'function') return;
  const favoriteIds = Object.keys(currentFavorites || {}).sort();
  const fetchKey = favoriteIds.join('|');
  if(fetchKey === liBellLiveFetchKey) return;
  liBellLiveFetchKey = fetchKey;
  const requestId = ++liBellLiveRequest;
  Promise.all([
    community.getActiveFlagsForTrails(favoriteIds).catch(() => []),
    community.getSiteNotices().catch(() => []),
    typeof community.getNotifSeen === 'function' ? community.getNotifSeen().catch(() => []) : Promise.resolve([]),
  ]).then(([hazardFlags, siteNotices, remoteRead]) => {
    if(requestId !== liBellLiveRequest) return;
    const read = liReadList();
    if(Array.isArray(remoteRead)) remoteRead.forEach(id => { if(!read.includes(id)) read.push(id); });
    try { localStorage.setItem('dolopaws-notif-seen', JSON.stringify(read)); } catch(e){}
    const feed = window.DoloPawsNotifFeed.build({
      trails: typeof trails !== 'undefined' ? trails : [],
      favorites: currentFavorites || {},
      hazardFlags, siteNotices, now: Date.now()
    });
    const migratedRead = window.DoloPawsNotifFeed.migrateReadIds(feed, read);
    try { localStorage.setItem('dolopaws-notif-seen', JSON.stringify(migratedRead)); } catch(e){}
    const unread = window.DoloPawsNotifFeed.badgeCount(feed, migratedRead);
    try { localStorage.setItem('dolopaws-notif-unread', String(unread)); } catch(e){}
    const dot = document.getElementById('liBellDot');
    if(dot) dot.hidden = unread === 0;
    window.dispatchEvent(new CustomEvent('dolopaws-notifications-changed', { detail:{ unread } }));
  });
}

window.addEventListener('dolopaws-notifications-changed', (event) => {
  const unread = Number(event.detail && event.detail.unread) || 0;
  const dot = document.getElementById('liBellDot');
  if(dot) dot.hidden = unread === 0;
});

function initLoggedInShell(){
  if(liShellWired) return;
  const filtersBtn = document.getElementById('liFiltersBtn');
  if(!filtersBtn) return;
  liShellWired = true;

  const wireMenu = (btn, menu) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      liCloseMenus();
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
    menu.addEventListener('click', e => e.stopPropagation());
  };
  wireMenu(filtersBtn, document.getElementById('liFiltersMenu'));
  wireMenu(document.getElementById('liCountryBtn'), document.getElementById('liCountryMenu'));
  wireMenu(document.getElementById('liRegionBtn'), document.getElementById('liRegionMenu'));
  wireMenu(document.getElementById('liValleyBtn'), document.getElementById('liValleyMenu'));
  wireMenu(document.getElementById('liAccountBtn'), document.getElementById('liAccountMenu'));

  const savedOnlyBtn = document.getElementById('liSavedOnlyBtn');
  if(savedOnlyBtn) savedOnlyBtn.addEventListener('click', () => {
    showingSavedOnly = !showingSavedOnly;
    renderReturningHomepage(currentProfileForAdjust);
  });

  const wireQuickFilter = (id, toggle) => {
    const button = document.getElementById(id);
    if(button) button.addEventListener('click', () => {
      toggle();
      renderReturningHomepage(currentProfileForAdjust);
    });
  };
  wireQuickFilter('liQuickShade', () => { liFilters.shade = liFilters.shade === '60' ? 'any' : '60'; });
  wireQuickFilter('liQuickWater', () => { liFilters.water = !liFilters.water; });

  const paneBody = document.querySelector('#returningCustomerHomepage .li-body');
  const paneButtons = Array.from(document.querySelectorAll('[data-li-pane]'));
  const setPane = (pane) => {
    if(!paneBody) return;
    paneBody.dataset.pane = pane;
    paneButtons.forEach(btn => {
      const selected = btn.dataset.liPane === pane;
      btn.classList.toggle('on', selected);
      btn.setAttribute('aria-pressed', String(selected));
    });
    if(pane === 'map' && trailMapInstance){
      requestAnimationFrame(() => trailMapInstance.resize());
    }
  };
  paneButtons.forEach(btn => btn.addEventListener('click', () => setPane(btn.dataset.liPane)));
  setPane((paneBody && paneBody.dataset.pane) || 'list');

  // Greeting avatar = the same Switch dog panel, anchored under the avatar.
  const greetBtn = document.getElementById('liGreetSwitchBtn');
  const greetMenu = document.getElementById('liGreetSwitchMenu');
  if(greetBtn && greetMenu) wireMenu(greetBtn, greetMenu);
  const greetAdd = document.getElementById('liGreetAddDogBtn');
  if(greetAdd) greetAdd.addEventListener('click', () => {
    const addBtn = document.getElementById('liAddDogBtn');
    liCloseMenus();
    if(addBtn) addBtn.click();
  });

  // Keep discovery map-first: the same top-right control collapses and
  // restores the ranked-results panel, so it never moves between states.
  const collapseBtn = document.getElementById('liCollapseTrailsBtn');
  const liBody = document.querySelector('#returningCustomerHomepage .li-body');
  const setTrailsCollapsed = (collapsed) => {
    if(!liBody) return;
    liBody.classList.toggle('list-collapsed', collapsed);
    if(collapseBtn){
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      collapseBtn.setAttribute('aria-label', collapsed ? 'Expand ranked trails panel' : 'Collapse ranked trails panel');
      collapseBtn.textContent = collapsed ? '☰ Expand trails' : '▤ Collapse trails';
    }
    if(trailMapInstance) requestAnimationFrame(() => trailMapInstance.resize());
  };
  if(collapseBtn) collapseBtn.addEventListener('click', () => {
    setTrailsCollapsed(!liBody.classList.contains('list-collapsed'));
  });

  // Notification bell opens the full notification centre from the design.
  const bellBtn = document.getElementById('liBellBtn');
  const bellMenu = document.getElementById('liBellMenu');
  if(bellBtn && bellMenu){
    refreshLiBellBadge();
    bellMenu.hidden = true;
    bellBtn.setAttribute('aria-haspopup', 'false');
    bellBtn.addEventListener('click', () => { window.location.href = 'notifications.html'; });
  }

  document.addEventListener('click', liCloseMenus);
  document.addEventListener('click', (event) => {
    if(!event.target.closest('.li-search')) hideLiSearchSuggestions();
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') liCloseMenus(); });
  document.addEventListener('keydown', (e) => {
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      const search = document.getElementById('liSearch');
      if(search) search.focus();
    }
  });

  const search = document.getElementById('liSearch');
  const suggestions = document.getElementById('liSearchSuggest');
  if(search){
    search.addEventListener('input', () => {
      renderLiSearchSuggestions(currentProfileForAdjust);
    });
    search.addEventListener('focus', () => renderLiSearchSuggestions(currentProfileForAdjust));
    search.addEventListener('keydown', (event) => {
      if(!suggestions || suggestions.hidden) return;
      const options = Array.from(suggestions.querySelectorAll('[role="option"]'));
      if(!options.length) return;
      let active = options.findIndex(option => option.classList.contains('active'));
      if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
        event.preventDefault();
        active = event.key === 'ArrowDown'
          ? (active + 1) % options.length
          : (active <= 0 ? options.length - 1 : active - 1);
        options.forEach((option, index) => option.classList.toggle('active', index === active));
        options[active].scrollIntoView({ block:'nearest' });
      } else if(event.key === 'Enter'){
        event.preventDefault();
        (options[active >= 0 ? active : 0]).click();
      } else if(event.key === 'Escape'){
        hideLiSearchSuggestions();
      }
    });
  }

  const reset = document.getElementById('liFiltersReset');
  if(reset) reset.addEventListener('click', liResetAllFilters);
  const apply = document.getElementById('liFiltersApply');
  if(apply) apply.addEventListener('click', liCloseMenus);

  const addDog = document.getElementById('liAddDogBtn');
  if(addDog) addDog.addEventListener('click', () => {
    liCloseMenus();
    if(window.DoloPawsWizard && typeof window.DoloPawsWizard.open === 'function') window.DoloPawsWizard.open();
  });

  const logoutBtn = document.getElementById('liLogoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', async () => {
    liCloseMenus();
    if(liDevView){ window.location.href = '/'; return; }
    window.location.href = 'account.html?logout=1';
  });
}

function hideLiSearchSuggestions(){
  const search = document.getElementById('liSearch');
  const suggestions = document.getElementById('liSearchSuggest');
  if(suggestions){ suggestions.hidden = true; suggestions.innerHTML = ''; }
  if(search) search.setAttribute('aria-expanded', 'false');
}

function liEscapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[character]));
}

function renderLiSearchSuggestions(profile){
  const search = document.getElementById('liSearch');
  const suggestions = document.getElementById('liSearchSuggest');
  if(!search || !suggestions || typeof trails === 'undefined') return;
  const query = search.value.trim().toLowerCase();
  if(!query){ hideLiSearchSuggestions(); return; }
  const overrides = profile ? effectiveOverrides(profile, adjustOverride) : { terrain:'1', distance:'10', heatSensitive:false };
  const matches = trails
    .filter(trail => trail.region === activeRegion)
    .filter(trail => [trail.name, trail.area, trail.valley].some(value => String(value || '').toLowerCase().includes(query)))
    .map(trail => ({ ...trail, score:recommendTrail(trail, overrides).score }))
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .slice(0, 6);

  suggestions.innerHTML = '';
  if(!matches.length){
    suggestions.innerHTML = '<div class="li-search-empty">No routes found in this region.</div>';
  } else {
    matches.forEach((trail, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'li-search-option' + (index === 0 ? ' active' : '');
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === 0));
      const tier = liMatchTier(trail.score);
      option.innerHTML = `<span class="li-search-option-copy"><strong>${liEscapeHtml(trail.name)}</strong><small>${liEscapeHtml([trail.valley, `${trail.distance} km`].filter(Boolean).join(' · '))}</small></span><span class="li-search-option-match" style="color:${tier.color}">${trail.curated === false ? '≈' : ''}${trail.score}%</span>`;
      option.addEventListener('click', () => {
        search.value = trail.name;
        hideLiSearchSuggestions();
        // A search result is a destination, not just a map-focus control.
        // Always use the dynamic detail route so catalogue trails that do not
        // have a generated static HTML page (for example the Rasa/Odle route)
        // open exactly like trails selected from Browse all Trails.
        window.location.href = `trail.html?id=${encodeURIComponent(trail.id)}&from=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      });
      suggestions.appendChild(option);
    });
  }
  suggestions.hidden = false;
  search.setAttribute('aria-expanded', 'true');
}

function liRevealMapPane(){
  const body = document.querySelector('#returningCustomerHomepage .li-body');
  if(body) body.dataset.pane = 'map';
  document.querySelectorAll('[data-li-pane]').forEach(button => {
    const selected = button.dataset.liPane === 'map';
    button.classList.toggle('on', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if(trailMapInstance) requestAnimationFrame(() => trailMapInstance.resize());
}

// Match column shared by list rows and the map preview card. Tier steps
// mirror the map pins (85 great / 65 good) and the map legend's colours.
// Row meta per the design TrailRow: "7.5 km · 150 m climb · 2–2.5 h · 35% shade"
function liRowMeta(t){
  const parts = [`${t.distance} km`];
  if(Number.isFinite(t.elevation)) parts.push(`${t.elevation} m climb`);
  if(t.hours) parts.push(`${t.hours} h`);
  if(Number.isFinite(t.shadeCoverage)) parts.push(`${t.shadeCoverage}% shade`);
  return parts.join(' · ');
}

function liMatchTier(score){
  return score >= 85 ? { color: '#4A7856', label: 'Great match' }
    : score >= 65 ? { color: '#C98A2E', label: 'Good' }
    : { color: '#9C3A25', label: 'Check first' };
}
function liMatchColHtml(t){
  const tier = liMatchTier(t.score);
  const isEst = t.curated === false;
  return `<div class="li-match" aria-label="${t.score}% match${isEst ? ' (estimated)' : ''}">
      <b style="color:${tier.color};">${isEst ? '≈' : ''}${t.score}<span>%</span></b>
      <span class="li-match-lbl">Match for your dog</span>
      <span class="li-match-tier" style="background:${tier.color}1f;color:${tier.color};">${tier.label}</span>
    </div>`;
}

async function renderReturningHomepage(profile){
  profile = liResolveActiveProfile(profile);
  const heading = document.getElementById('returningHeading');
  const subline = document.getElementById('returningSubline');
  const toolbarSummary = document.getElementById('liToolbarSummary');
  const listEl = document.getElementById('returningTrailList');
  if(!heading || typeof trails === 'undefined') return;

  renderLiCountryControl(profile);
  renderLiRegionControl(profile);
  renderLiValleyControl(profile);
  renderLiSavedControl();
  renderDogProfileCard(profile);
  renderLiHeader(profile);
  refreshLiBellBadge();
  renderLiControls();

  const name = (profile && profile.name) ? profile.name : 'there';
  const overrides = profile ? effectiveOverrides(profile, adjustOverride) : { terrain:'1', distance:'10', heatSensitive:false };

  const kicker = document.getElementById('companionKicker');
  if(kicker) kicker.textContent = liActiveFilterCount() > 0
    ? 'Filtered · on the map'
    : (profile && profile.name ? `Ranked for ${profile.name}` : 'Ranked for your dog');

  const scored = trails.map(t => {
    const recommendation = recommendTrail(t, overrides);
    return {...t, score: recommendation.score, recommendation};
  }).sort((a,b) => b.score - a.score);
  if(listEl && window.DoloPawsScoring){
    listEl.dataset.scoringVersion = window.DoloPawsScoring.VERSION;
  }

  // Genuine new-match detection: compare today's strong matches against
  // what was stored on the account the last time they visited. This is
  // computed against the FULL list, regardless of which view is showing,
  // so a saved trail's NEW MATCH badge stays accurate either way.
  let newIds = new Set();
  if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
    const previous = await window.DoloPawsAuth.getLastMatches();
    const currentTopIds = scored.filter(t => t.score >= NEW_MATCH_THRESHOLD).map(t => t.id);
    if(Array.isArray(previous)){
      newIds = new Set(currentTopIds.filter(id => !previous.includes(id)));
    }
    // Store today's snapshot for next visit — after comparing, not before.
    await window.DoloPawsAuth.setLastMatches(currentTopIds);
  }

  // The cloud is Eddie speaking — one line, no counts, true for any area.
  // When the owner has set "Adjust for today", the dog voices those declared
  // conditions (never guessed weather); otherwise it asks the usual question.
  let bubbleLine = t('home.bubble');
  if(adjustOverride){
    if(adjustOverride.energy === 'low') bubbleLine = "I'm on low battery, keep it short and easy today.";
    else if(adjustOverride.distance === '5') bubbleLine = 'Something short and sweet today, please.';
    else if(adjustOverride.terrain === '0') bubbleLine = 'Easy underfoot today, my paws say so.';
    else if(adjustOverride.energy === 'high') bubbleLine = "I'm full of beans, let's go big today.";
  }
  // Plain heading, left-aligned, no speech-cloud quotes (2026-07 revamp).
  heading.textContent = bubbleLine;
  // The old copy ("Pick a province or valley below... Edit profile") duplicated
  // what the sidebar now already shows (filters + the dog card's edit link),
  // so this line is now just the one thing the sidebar can't say: whether
  // anything changed since last visit.
  const newsLine = newIds.size > 0
    ? (newIds.size === 1 ? t('home.newMatch1') : t('home.newMatches', {n: newIds.size}))
    : '';
  subline.innerHTML = newsLine || '';
  subline.hidden = !newsLine;

  renderBreedInsight(profile);

  const titleEl = document.getElementById('companionListTitle');
  if(titleEl) titleEl.textContent = showingSavedOnly ? 'Saved trails' : 'Top trails';

  let displayList = filterTrailsForReturningView(scored);

  renderLiConditionsCard(profile, displayList);

  // "Show N trails" — the apply button doubles as the live result count.
  const applyBtn = document.getElementById('liFiltersApply');
  if(applyBtn) applyBtn.textContent = `Show ${displayList.length} ${displayList.length === 1 ? 'trail' : 'trails'}`;

  const savedCount = Object.keys(currentFavorites || {}).length;
  if(toolbarSummary) toolbarSummary.textContent = `${displayList.length} trails · ${savedCount} saved`;

  updateMapMarkers(displayList);

  // Reset to page 1 whenever the filters change; clamp if the list shrank.
  const filterKey = `${activeRegion}|${activeValley}|${showingSavedOnly}|${liQuery}|${JSON.stringify(liFilters)}|${sortKey}`;
  if (filterKey !== lastFilterKey){ currentPage = 1; lastFilterKey = filterKey; }
  const collapsed = !showFullList && !showingSavedOnly && displayList.length > TOP_MATCHES + 2;
  const totalPages = collapsed ? 1 : Math.max(1, Math.ceil(displayList.length / TRAILS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageList = collapsed
    ? displayList.slice(0, TOP_MATCHES)
    : displayList.slice((currentPage - 1) * TRAILS_PER_PAGE, currentPage * TRAILS_PER_PAGE);
  if(savedTrailsBtn){
    const savedLabel = savedTrailsBtn.querySelector('.txt-label');
    if(savedLabel) savedLabel.textContent = showingSavedOnly
      ? t('home.allTrailsBtn')
      : (profile && profile.name) ? `Saved for ${profile.name}` : t('home.savedTrails');
    const savedCountEl = document.getElementById('companionSavedCount');
    if(savedCountEl) savedCountEl.textContent = Object.keys(currentFavorites).length;
    savedTrailsBtn.classList.toggle('active', showingSavedOnly);
  }

  if(displayList.length === 0){
    const label = activeValley !== 'all'
      ? activeValley
      : activeProvince !== 'all'
        ? provinceLabel(activeProvince)
        : (activeRegion === 'savoy' ? t('region.savoy') : t('region.theDolomites'));
    const msg = showingSavedOnly && activeValley !== 'all'
      ? t('home.noSavedValley', {label})
      : showingSavedOnly
        ? t('home.noSaved')
        : (liQuery.trim() || liActiveFilterCount() > 0)
          ? 'Try widening your filters.'
          : t('home.noTrailsValley', {label});
    listEl.innerHTML = `
      <div class="li-empty">
        <div class="li-empty-title">No trails match</div>
        <p>${msg}</p>
        <button type="button" id="liEmptyReset">Reset filters</button>
      </div>`;
    const emptyReset = document.getElementById('liEmptyReset');
    if(emptyReset) emptyReset.addEventListener('click', liResetAllFilters);
    return;
  }

  const adjustActive = !!adjustOverride;
  const fitCount = displayList.filter(x => x.score >= 60).length;
  const summaryBar = adjustActive
    ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px;background:var(--sage-dim);border-radius:12px;font-size:12.5px;font-weight:600;color:var(--ink);">${t('home.fitLine', {a: fitCount, b: displayList.length})}</div>`
    : '';

  listEl.innerHTML = summaryBar + pageList.map(t => {
    const isFav = !!currentFavorites[t.id];
    const isNew = newIds.has(t.id);
    const dim = adjustActive && t.score < 60;
    const thumb = trailCardVisual(t, { className:'li-thumb photo', dataTrailId:t.id, clickable:true });
    const selected = t.id === selectedTrailId;
    const newBadge = isNew ? productBadge('new', window.t('badge.new')) : '';
    const importedBadge = t.curated === false
      ? (window.DoloPawsIcons ? window.DoloPawsIcons.badgeHtml('imported', window.t('badge.importedS')) : `<span class="badge-pill badge-imported">${window.t('badge.importedS')}</span>`)
      : '';
    return `
    <div class="li-row${selected ? ' tc-selected' : ''}" id="trail-card-${t.id}" data-id="${t.id}"${dim ? ' style="opacity:.55;"' : ''}>
      ${thumb}
      <div class="li-row-body">
        <a href="trail.html?id=${t.id}" class="li-row-name">${t.name}</a>
        <div class="li-row-meta" title="${matchReason(t, overrides)}">${liRowMeta(t)}</div>
        ${newBadge || importedBadge ? `<div class="li-row-badges">${newBadge}${importedBadge}</div>` : ''}
        <div class="li-rating-row"><span class="li-rating-kick">Trail rating</span><span class="safety-badge ${safetyClass(t.safetyLevel)}">${trailSafetyLabel(t)}</span></div>
      </div>
      ${liMatchColHtml(t)}
      <button type="button" class="li-heart save-btn" data-id="${t.id}" aria-pressed="${isFav}" aria-label="${isFav ? 'Remove ' + t.name + ' from saved trails' : 'Save ' + t.name}">${isFav ? '♥' : '♡'}</button>
      <div class="li-row-bar">
        <button type="button" class="li-bar-act locate-btn" data-id="${t.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>See on map</button>
        ${directionsBarHtml(t)}
      </div>
    </div>`;
  }).join('');

  // Whole row opens the trail page — except clicks on the heart, links,
  // or the thumbnail (which locates the trail on the map instead).
  listEl.querySelectorAll('.li-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if(e.target.closest('a, button, .photo')) return;
      window.location.href = 'trail.html?id=' + row.dataset.id;
    });
  });

  listEl.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const wasSaved = !!currentFavorites[id];
      const nextFavorites = { ...currentFavorites };
      if(wasSaved) delete nextFavorites[id];
      else nextFavorites[id] = true;
      btn.disabled = true;
      const saved = window.DoloPawsAuth
        ? await window.DoloPawsAuth.setFavorites(nextFavorites)
        : false;
      if(saved){
        currentFavorites = nextFavorites;
        renderReturningHomepage(profile);
        showHomeActionStatus(window.t(wasSaved ? 'save.removed' : 'save.added'));
      } else {
        btn.disabled = false;
        showHomeActionStatus(window.t('save.error'));
      }
    });
  });

  listEl.querySelectorAll('.photo[data-trail-id]').forEach(el => {
    el.addEventListener('click', () => focusMapOnTrail(el.dataset.trailId, displayList));
  });

  listEl.querySelectorAll('.locate-btn').forEach(btn => {
    btn.addEventListener('click', () => focusMapOnTrail(btn.dataset.id, displayList));
  });

  // Apple-device chooser: Get directions opens a two-app menu.
  listEl.querySelectorAll('.li-dir-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.parentElement.querySelector('.li-dir-menu');
      const open = menu.hidden;
      listEl.querySelectorAll('.li-dir-menu').forEach(m => { m.hidden = true; });
      listEl.querySelectorAll('.li-dir-toggle').forEach(b => b.setAttribute('aria-expanded', 'false'));
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  if(!listEl.dataset.dirMenuDismiss){
    listEl.dataset.dirMenuDismiss = '1';
    document.addEventListener('click', () => {
      listEl.querySelectorAll('.li-dir-menu').forEach(m => { m.hidden = true; });
      listEl.querySelectorAll('.li-dir-toggle').forEach(b => b.setAttribute('aria-expanded', 'false'));
    });
  }

  // Top-matches ↔ full-catalog toggle
  if(collapsed){
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'page-btn';
    more.style.cssText = 'display:block;margin:18px auto 0;';
    more.textContent = t('home.showAll', {n: displayList.length});
    more.addEventListener('click', () => { showFullList = true; currentPage = 1; renderReturningHomepage(profile); });
    listEl.appendChild(more);
  } else if(showFullList && !showingSavedOnly && displayList.length > TOP_MATCHES + 2){
    const less = document.createElement('button');
    less.type = 'button';
    less.style.cssText = 'display:block;margin:16px auto 0;background:none;border:none;color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;';
    less.textContent = t('home.showTop');
    less.addEventListener('click', () => { showFullList = false; currentPage = 1; renderReturningHomepage(profile); listEl.scrollIntoView({behavior:'smooth', block:'start'}); });
    listEl.appendChild(less);
  }

  // Pagination controls
  if (!collapsed && totalPages > 1){
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:14px;margin-top:18px;';
    const mkBtn = (label, disabled, delta) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.disabled = disabled;
      b.className = 'page-btn';
      if (!disabled) b.addEventListener('click', () => {
        currentPage += delta;
        renderReturningHomepage(profile);
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return b;
    };
    nav.appendChild(mkBtn(t('page.prev'), currentPage === 1, -1));
    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = t('page.of', {a: currentPage, b: totalPages});
    nav.appendChild(info);
    nav.appendChild(mkBtn(t('page.next'), currentPage === totalPages, 1));
    listEl.appendChild(nav);
  }
}

// Destination-only handoff to a maps app. Apple devices get a two-option
// chooser (Apple Maps or Google Maps — many iPhone users prefer Google);
// everywhere else links straight to Google Maps, the only one of the two
// that exists there.
function trailheadCoords(t){
  return t.startPoint && Number.isFinite(t.startPoint.lat) && Number.isFinite(t.startPoint.lng)
    ? t.startPoint
    : (Number.isFinite(t.lat) && Number.isFinite(t.lng) ? { lat:t.lat, lng:t.lng } : null);
}

function directionsBarHtml(t){
  const sp = trailheadCoords(t);
  if(!sp) return '';
  const icon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>';
  const google = `https://www.google.com/maps/dir/?api=1&destination=${sp.lat},${sp.lng}&travelmode=driving`;
  if(!/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)){
    return `<a class="li-bar-act" href="${google}" target="_blank" rel="noopener">${icon}Get directions</a>`;
  }
  const apple = `https://maps.apple.com/?daddr=${sp.lat},${sp.lng}`;
  return `<div class="li-dir-wrap">
    <button type="button" class="li-bar-act li-dir-toggle" aria-haspopup="true" aria-expanded="false">${icon}Get directions</button>
    <div class="li-dir-menu" hidden>
      <a href="${apple}" target="_blank" rel="noopener">Apple Maps</a>
      <a href="${google}" target="_blank" rel="noopener">Google Maps</a>
    </div>
  </div>`;
}

function focusMapOnTrail(trailId, list){
  if(!trailMapInstance) return;
  const t = list.find(x => x.id === trailId);
  if(!t) return;
  selectTrail(t);
  // On the phone layout the sheet covers the map — let it duck down.
  window.dispatchEvent(new CustomEvent('dolopaws-map-focus'));
  document.getElementById('trailMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if(Array.isArray(t.path) && t.path.length > 1){
    const bounds = new maplibregl.LngLatBounds();
    t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
    trailMapInstance.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  } else if(typeof t.lat === 'number' && typeof t.lng === 'number'){
    trailMapInstance.flyTo({ center: [t.lng, t.lat], zoom: 13 });
  }
}

// Adjust-for-today panel wiring
const adjustToggle = document.getElementById('adjustToggle');
const adjustPanel = document.getElementById('adjustPanel');
const adjustCloseBtn = document.getElementById('adjustCloseBtn');
let currentProfileForAdjust = null;

// The Saved row opens the dedicated Saved screen (Companion structure).
const savedTrailsBtn = document.getElementById('savedTrailsBtn');
if(savedTrailsBtn){
  savedTrailsBtn.addEventListener('click', () => {
    window.location.href = 'saved.html';
  });
}

// Companion sort control — Best match / Shortest / Least climb
const companionSortGroup = document.getElementById('companionSortGroup');
if(companionSortGroup){
  companionSortGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sort]');
    if(!btn) return;
    sortKey = btn.dataset.sort;
    companionSortGroup.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    renderReturningHomepage(currentProfileForAdjust);
  });
}

// Map pin / card selection callout — clears via the × on the callout.
const mapCalloutClose = document.getElementById('mapCalloutClose');
if(mapCalloutClose){
  mapCalloutClose.addEventListener('click', () => {
    selectedTrailId = null;
    hideMapCallout();
    document.querySelectorAll('#returningTrailList .tc-selected').forEach(c => c.classList.remove('tc-selected'));
    setSelectedTrailPoint(null);
  });
}
function showMapCallout(t){
  const callout = document.getElementById('mapCallout');
  if(!callout) return;
  const thumb = document.getElementById('mapCalloutThumb');
  if(thumb) thumb.innerHTML = trailCardVisual(t, { className:'li-thumb photo' });
  const kickEl = document.getElementById('mapCalloutKick');
  if(kickEl) kickEl.textContent = [t.valley, t.area].filter(Boolean).join(' · ');
  const nameEl = document.getElementById('mapCalloutName');
  nameEl.textContent = t.name;
  nameEl.href = 'trail.html?id=' + encodeURIComponent(t.id);
  const metaEl = document.getElementById('mapCalloutMeta');
  if(metaEl) metaEl.textContent = liRowMeta(t);
  const ratingEl = document.getElementById('mapCalloutRating');
  if(ratingEl) ratingEl.innerHTML = `<span class="safety-badge ${safetyClass(t.safetyLevel)}">${trailSafetyLabel(t)}</span>`;
  const openEl = document.getElementById('mapCalloutOpen');
  if(openEl) openEl.href = 'trail.html?id=' + encodeURIComponent(t.id);
  // Directions is a destination-only handoff, same as the list rows: straight
  // to Google Maps, with a two-app chooser on Apple devices.
  const directionsEl = document.getElementById('mapCalloutDirections');
  const dirMenu = document.getElementById('mapCalloutDirMenu');
  if(directionsEl){
    const sp = trailheadCoords(t);
    const google = sp ? `https://www.google.com/maps/dir/?api=1&destination=${sp.lat},${sp.lng}&travelmode=driving` : '';
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    directionsEl.disabled = !sp;
    directionsEl.setAttribute('aria-expanded', 'false');
    if(dirMenu){
      dirMenu.hidden = true;
      const appleA = document.getElementById('mapCalloutDirApple');
      const googleA = document.getElementById('mapCalloutDirGoogle');
      if(appleA && sp) appleA.href = `https://maps.apple.com/?daddr=${sp.lat},${sp.lng}`;
      if(googleA && sp) googleA.href = google;
    }
    directionsEl.onclick = (e) => {
      if(!sp) return;
      if(!isApple || !dirMenu){
        window.open(google, '_blank', 'noopener');
        return;
      }
      e.stopPropagation();
      const open = dirMenu.hidden;
      dirMenu.hidden = !open;
      directionsEl.setAttribute('aria-expanded', String(open));
    };
    if(!document.body.dataset.calloutDirDismiss){
      document.body.dataset.calloutDirDismiss = '1';
      document.addEventListener('click', () => {
        const menu = document.getElementById('mapCalloutDirMenu');
        const btn = document.getElementById('mapCalloutDirections');
        if(menu) menu.hidden = true;
        if(btn) btn.setAttribute('aria-expanded', 'false');
      });
    }
  }
  const saveEl = document.getElementById('mapCalloutSave');
  if(saveEl){
    const paint = () => {
      const on = !!currentFavorites[t.id];
      saveEl.classList.toggle('saved', on);
      saveEl.textContent = on ? '♥ Saved' : '♡ Save';
      saveEl.setAttribute('aria-pressed', String(on));
    };
    paint();
    saveEl.onclick = async () => {
      const wasSaved = !!currentFavorites[t.id];
      const nextFavorites = { ...currentFavorites };
      if(wasSaved) delete nextFavorites[t.id];
      else nextFavorites[t.id] = true;
      saveEl.disabled = true;
      const saved = window.DoloPawsAuth ? await window.DoloPawsAuth.setFavorites(nextFavorites) : false;
      saveEl.disabled = false;
      if(saved){
        currentFavorites = nextFavorites;
        renderReturningHomepage(currentProfileForAdjust);
        paint();
        showHomeActionStatus(window.t(wasSaved ? 'save.removed' : 'save.added'));
      } else {
        showHomeActionStatus(window.t('save.error'));
      }
    };
  }
  const matchEl = document.getElementById('mapCalloutMatch');
  if(matchEl) matchEl.innerHTML = liMatchColHtml(t);
  callout.hidden = false;
}
function hideMapCallout(){
  const callout = document.getElementById('mapCallout');
  if(callout) callout.hidden = true;
}

if(adjustToggle){
  adjustToggle.addEventListener('click', () => {
    adjustPanel.hidden = false;
    adjustToggle.hidden = true;
    adjustToggle.setAttribute('aria-expanded', 'true');
    setCompanionPanelOpen(false);
    if(companionPanelIsMobile()) adjustPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
if(adjustCloseBtn){
  adjustCloseBtn.addEventListener('click', () => {
    adjustPanel.hidden = true;
    adjustToggle.hidden = false;
    adjustToggle.setAttribute('aria-expanded', 'false');
    adjustOverride = null;
    renderReturningHomepage(currentProfileForAdjust);
  });
}
document.querySelectorAll('.adj-pill-row').forEach(row => {
  row.addEventListener('click', (e) => {
    const pill = e.target.closest('.adj-pill');
    if(!pill) return;
    row.querySelectorAll('.adj-pill').forEach(p => {
      p.style.background = 'none';
      p.style.color = 'var(--ink)';
      p.style.borderColor = 'var(--paper-line)';
      p.classList.remove('active');
      p.setAttribute('aria-pressed', 'false');
    });
    pill.style.background = 'var(--ink)';
    pill.style.color = '#fff';
    pill.style.borderColor = 'var(--ink)';
    pill.classList.add('active');
    pill.setAttribute('aria-pressed', 'true');

    const group = row.dataset.group;
    if(!adjustOverride){
      const base = currentProfileForAdjust ? effectiveOverrides(currentProfileForAdjust, null) : { terrain:'1', distance:'10', heatSensitive:false };
      adjustOverride = {...base};
    }
    adjustOverride[group] = pill.dataset.value;
    renderReturningHomepage(currentProfileForAdjust);
  });
});
document.querySelectorAll('.adj-pill').forEach(p => {
  p.style.padding = '8px 14px';
  p.style.borderRadius = '14px';
  p.style.border = '1.5px solid var(--paper-line)';
  p.style.fontSize = '12px';
  p.style.fontWeight = '600';
  p.style.color = 'var(--ink)';
  p.style.cursor = 'pointer';
  p.style.fontFamily = "'Inter',sans-serif";
  p.style.background = 'none'; // pills are now real <button>s — kill the UA default
});

// ============================================================
// AUTH STATE — switch between guest and returning homepage
// ============================================================
// Wizard saves while logged in should refresh the homepage immediately.
window.addEventListener('dolopaws-dog-profile-saved', (e) => {
  if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser && e.detail && e.detail.profile){
    currentProfileForAdjust = e.detail.profile;
    adjustOverride = null;
    renderReturningHomepage(e.detail.profile);
  }
});

window.addEventListener('dolopaws-auth-changed', async (e) => {
  const user = e.detail.user;
  const devReturning = !!(e.detail && e.detail.devView === 'returning');
  const newHome = document.getElementById('newCustomerHomepage');
  const returningHome = document.getElementById('returningCustomerHomepage');
  const browseNavLink = document.getElementById('browseNavLink');
  if(browseNavLink){
    // Primary navigation must be predictable: "Trails" always opens the
    // complete browse experience, regardless of authentication state.
    browseNavLink.href = 'browse-trails.html';
    const navSpan = browseNavLink.querySelector('span');
    if(navSpan) navSpan.textContent = 'Trails';
  }
  if(!newHome || !returningHome) return;

  if((user && window.DoloPawsAuth) || devReturning){
    newHome.hidden = true;
    returningHome.hidden = false;
    document.documentElement.classList.remove('early-member');
    document.body.dataset.homepageView = 'returning';
    adjustOverride = null;
    scheduleTrailMap();
    // The map pane may have been hidden (or sized differently) when the map
    // was created — make sure MapLibre measures the now-visible container.
    if(trailMapInstance) requestAnimationFrame(() => trailMapInstance.resize());
    initLoggedInShell();

    let profile = null;
    if(user && window.DoloPawsAuth){
      // Guest-wizard handoff: if they built a dog profile before signing
      // up, persist it now — but never overwrite a profile that already
      // exists on the account (e.g. logging into an older account).
      try {
        const pendingRaw = localStorage.getItem('dolopaws-pending-dog-profile');
        if(pendingRaw){
          const pending = JSON.parse(pendingRaw);
          const existing = await window.DoloPawsAuth.getDogProfile();
          if(pending && pending.name && (!existing || !existing.name)){
            await window.DoloPawsAuth.setDogProfile(pending);
          }
          localStorage.removeItem('dolopaws-pending-dog-profile');
          localStorage.removeItem('dolopaws-dog-draft'); // guest draft now redundant
        }
      } catch(err){ /* never block login on handoff */ }

      profile = await window.DoloPawsAuth.getDogProfile();
      currentFavorites = await window.DoloPawsAuth.getFavorites();
    } else {
      // ?view=returning preview — use the guest wizard draft if one exists.
      try { profile = JSON.parse(localStorage.getItem('dolopaws-pending-dog-profile') || 'null'); } catch(err){ profile = null; }
      currentFavorites = {};
    }
    currentProfileForAdjust = profile;
    renderReturningHomepage(profile);

    // Show the dog photo bubble (with uploaded photo or fallback paw)
    const dogBubble = document.getElementById('dogPhotoBubble');
    const dogBubbleImg = document.getElementById('dogBubbleImg');
    if(dogBubble){
      try {
        // Resolve only the active dog's synced photo or dog-ID cache. A dog
        // without a photo must keep the paw fallback, never another dog's image.
        const photo = liDogPhoto(profile);
        if(photo && dogBubbleImg){
          const fallback = dogBubble.querySelector('.dog-bubble-fallback');
          dogBubbleImg.onerror = () => {
            dogBubbleImg.hidden = true;
            if(fallback) fallback.style.display = '';
          };
          dogBubbleImg.src = photo;
          dogBubbleImg.hidden = false;
          if(fallback) fallback.style.display = 'none';
        }
      } catch(e){}
      dogBubble.hidden = false;
    }
  } else {
    if(liDevView) return; // keep the ?view=returning preview when real auth resolves logged-out
    newHome.hidden = false;
    returningHome.hidden = true;
    // Stale member cache (signed out elsewhere): reveal the guest page.
    document.documentElement.classList.remove('early-member');
    document.body.dataset.homepageView = 'new';
    const dogBubble = document.getElementById('dogPhotoBubble');
    if(dogBubble) dogBubble.hidden = true;
    scheduleGuestMap();
  }
});
/**
 * Water Sources Integration for ORMA
 * Adds 12,921 drinking water sources from Overpass API (OpenStreetMap)
 * 
 * Add this code to your script.js or trail.js
 */

// ============================================================
// WATER SOURCES LAYER
// ============================================================

/**
 * Initialize water sources layer on the map
 * Call this after map is loaded
 */
function initializeWaterSources(map) {
  // The map can already have this source/layer from initTrailMap().
  // Re-adding the same IDs throws and interrupts map-load setup.
  const hasSource = !!map.getSource('water-sources');
  if(!hasSource){
    const waterAsset = window.DoloPawsRegionalData
      ? window.DoloPawsRegionalData.poiUrl(activeRegion, 'water')
      : './water-sources-all-regions.geojson';
    fetch(waterAsset)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to load GeoJSON`);
        }
        return response.json();
      })
      .then(geojsonData => {
        console.log(`✅ Loaded ${geojsonData.features?.length || 0} water sources for ${activeRegion}`);
        
        // Convert any Polygon features (OSM "way" fountains) to Point centroids,
        // since circle layers and clustering only render Point geometries.
        geojsonData.features = (geojsonData.features || []).map(f => {
          if (f.geometry && f.geometry.type === 'Polygon') {
            const ring = f.geometry.coordinates[0] || [];
            if (ring.length) {
              const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
              const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
              return { ...f, geometry: { type: 'Point', coordinates: [lng, lat] } };
            }
          }
          return f;
        }).filter(f => f.geometry && f.geometry.type === 'Point');

        map.addSource('water-sources', {
          type: 'geojson',
          data: geojsonData,
          cluster: true,
          clusterRadius: 50
        });
        
        console.log('✅ Water sources source added to map');
        
        // Add layers after source is ready
        addWaterSourcesLayers(map);
      })
      .catch(error => {
        console.error('❌ Error loading water sources GeoJSON:', error.message);
      });
    
    return; // Exit early since layers will be added in the fetch callback
  }
}

/**
 * Add all water sources layers to the map
 */
function addWaterSourcesLayers(map) {
  console.log('📍 Adding water sources layers...');
  const icons = window.DoloPawsIcons;
  const iconMinZoom = icons ? icons.ICON_MIN_ZOOM : 12;
  
  // Unclustered points layer
  if(!map.getLayer('water-sources-layer-lowzoom')){
    map.addLayer({
      id: 'water-sources-layer-lowzoom',
      type: 'circle',
      source: 'water-sources',
      filter: ['!', ['has', 'point_count']],
      maxzoom: iconMinZoom,
      layout: { visibility: 'none' },  // ← ADDED: Default hidden
      paint: {
        'circle-radius': 5,
        'circle-color': icons ? icons.getPoiCircleColorExpression('water') : '#5A5548',
        'circle-opacity': 0.75,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });
  }

  if(!map.getLayer('water-sources-layer')){
    map.addLayer({
      id: 'water-sources-layer',
      type: 'symbol',
      source: 'water-sources',
      filter: ['!', ['has', 'point_count']],
      minzoom: iconMinZoom,
      layout: {
        visibility: 'none',
        'icon-image': icons ? icons.getPoiMapIconExpression('water') : '',
        'icon-size': 1,
      }
    });
  }

  // Clustered points layer
  if(!map.getLayer('water-sources-cluster')){
    map.addLayer({
      id: 'water-sources-cluster',
      type: 'circle',
      source: 'water-sources',
      filter: ['has', 'point_count'],
      layout: { visibility: 'none' },  // ← ADDED: Default hidden
      paint: {
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          5, 25,
          10, 30
        ],
        'circle-color': '#4E90A8',
        'circle-opacity': 0.7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
  }

  // Cluster count labels
  if(!map.getLayer('water-sources-cluster-count')){
    map.addLayer({
      id: 'water-sources-cluster-count',
      type: 'symbol',
      source: 'water-sources',
      filter: ['has', 'point_count'],
      layout: {
        visibility: 'none',  // ← ADDED: Default hidden
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#fff'
      }
    });
  }

  // Interactive hover effect
  ['water-sources-layer', 'water-sources-layer-lowzoom'].forEach((layerId) => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });

  // Click to show popup - remove old handler first to prevent duplicates
  ['water-sources-layer', 'water-sources-layer-lowzoom'].forEach((layerId) => map.off('click', layerId));
  ['water-sources-layer', 'water-sources-layer-lowzoom'].forEach((layerId) => map.on('click', layerId, (e) => {
    const feature = e.features[0];
    const props = feature.properties;
    
    // Determine water type
    let waterType = 'Water Source';
    if (props.amenity === 'drinking_water') waterType = '🚰 Drinking Fountain';
    else if (props.amenity === 'fountain') waterType = '⛲ Fountain';
    else if (props.natural === 'spring') waterType = '💧 Natural Spring';
    else if (props.man_made === 'water_tap') waterType = '🚪 Water Tap';
    else if (props.amenity === 'water_point') waterType = '💦 Water Point';

    // Build popup content
    let content = `<b>${waterType}</b>`;
    
    const pointLabel = props.name || props.label;
    const pointDistance = props.km !== undefined ? `Km ${props.km}` : '';
    if (pointLabel && pointDistance) {
      content += `<br>${pointLabel} <small>(${pointDistance})</small>`;
    } else if (pointLabel) {
      content += `<br>${pointLabel}`;
    } else if (pointDistance) {
      content += `<br><small>${pointDistance}</small>`;
    }
    
    if (props.check_date) {
      content += `<br><small>✓ Last verified: ${props.check_date}</small>`;
    }
    
    if (props.seasonal === 'yes') {
      content += `<br><small class="dp-inline-status">${productIcon('warning', 13)}<span>Seasonal water source</span></small>`;
    }

    new maplibregl.Popup({ offset: 25 })
      .setLngLat(e.lngLat)
      .setHTML(content)
      .addTo(map);
  }));

  // Click cluster to zoom in - remove old handler first to prevent duplicates
  map.off('click', 'water-sources-cluster');
  map.on('click', 'water-sources-cluster', (e) => {
    const features = map.querySourceFeatures('water-sources', {
      filter: ['!=', ['get', 'point_count'], null]
    });

    const clusterId = e.features[0].properties.cluster_id;
    const source = map.getSource('water-sources');

    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({
        center: e.features[0].geometry.coordinates,
        zoom: zoom
      });
    }).catch(() => {});
  });
}

/**
 * Toggle water sources visibility
 */
function toggleWaterSources(map, show) {
  const layers = ['water-sources-layer-lowzoom', 'water-sources-layer', 'water-sources-cluster', 'water-sources-cluster-count'];
  layers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none');
    }
  });
}

/**
 * Filter water sources by type
 */
function filterWaterSources(map, type) {
  let filter;
  
  switch(type) {
    case 'fountains':
      filter = ['==', ['get', 'amenity'], 'drinking_water'];
      break;
    case 'springs':
      filter = ['==', ['get', 'natural'], 'spring'];
      break;
    case 'taps':
      filter = ['==', ['get', 'man_made'], 'water_tap'];
      break;
    case 'all':
    default:
      filter = ['!', ['has', 'point_count']];
      break;
  }
  
  map.setFilter('water-sources-layer', filter);
  if(map.getLayer('water-sources-layer-lowzoom')) map.setFilter('water-sources-layer-lowzoom', filter);
}

// ============================================================
// USAGE - Add to your map initialization
// ============================================================

// After map loads:
// initializeWaterSources(trailMapInstance);

// To toggle visibility:
// toggleWaterSources(trailMapInstance, true);

// To filter by type:
// filterWaterSources(trailMapInstance, 'fountains');

/**
 * ============================================================
 * Huts & Bars Integration for ORMA
 * Adds mountain huts, bars, cafés and pubs from OpenStreetMap
 * (Trentino, Veneto, Savoy) — same pattern as water sources.
 * ============================================================
 */
function initializeHutsBars(map) {
  if(map.getSource('mountain-huts') || map.getSource('bars-cafes')) return;

  const hutsBarsAsset = window.DoloPawsRegionalData
    ? window.DoloPawsRegionalData.poiUrl(activeRegion, 'huts-bars')
    : './huts-bars-all-regions.geojson';
  fetch(hutsBarsAsset)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load huts/bars GeoJSON`);
      }
      return response.json();
    })
    .then(geojsonData => {
      // Safety net: convert any Polygon/MultiPolygon features to Point centroids
      const features = (geojsonData.features || []).map(f => {
        const g = f.geometry;
        if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
          const ring = g.type === 'Polygon' ? (g.coordinates[0] || []) : ((g.coordinates[0] || [])[0] || []);
          if (ring.length) {
            const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
            const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
            return { ...f, geometry: { type: 'Point', coordinates: [lng, lat] } };
          }
        }
        return f;
      }).filter(f => f.geometry && f.geometry.type === 'Point');

      // Split into two datasets so each gets its OWN clustering:
      // mixing them in one clustered source would blend huts and bars
      // inside the same cluster bubbles.
      const isHut = p => p && (p.tourism === 'alpine_hut' || p.tourism === 'wilderness_hut' || p.amenity === 'shelter');
      const huts = features.filter(f => isHut(f.properties));
      const bars = features.filter(f => !isHut(f.properties));

      console.log(`✅ Loaded ${huts.length} mountain huts and ${bars.length} bars/cafés for ${activeRegion}`);

      // Register with basemap-poi-click.js so clicks on the base map's own
      // icons can be enriched with these richer OSM tags (Tier 2).
      if (typeof registerPoiFeatures === 'function') registerPoiFeatures([...huts, ...bars]);

      // Keep the split sets accessible for the dog-friendly filter toggle.
      window._dolopawsHuts = huts;
      window._dolopawsBars = bars;

      map.addSource('mountain-huts', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: huts },
        cluster: true,
        clusterRadius: 50
      });

      map.addSource('bars-cafes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: bars },
        cluster: true,
        clusterRadius: 65  // slightly larger: consolidates the dense town blobs
      });

      addHutsBarsLayers(map);
    })
    .catch(error => {
      console.error('❌ Error loading huts/bars GeoJSON:', error.message);
    });
}

async function updateRegionalMapData(map, region) {
  if(!map || !window.DoloPawsRegionalData) return;
  const regional = window.DoloPawsRegionalData;
  const urls = [
    regional.poiUrl(region, 'water'),
    regional.poiUrl(region, 'huts-bars'),
    regional.poiUrl(region, 'dog-routes'),
  ];
  if(urls.some(url => !url)) return;
  const responses = await Promise.all(urls.map(url => fetch(url)));
  if(responses.some(response => !response.ok)) throw new Error('Regional map data unavailable');
  const [waterData, hutsBarsData, dogRoutesData] = await Promise.all(responses.map(response => response.json()));

  const pointFeatures = (waterData.features || []).map(feature => {
    const geometry = feature.geometry;
    if(!geometry || geometry.type === 'Point') return feature;
    const ring = geometry.type === 'Polygon'
      ? (geometry.coordinates[0] || [])
      : geometry.type === 'MultiPolygon'
        ? ((geometry.coordinates[0] || [])[0] || [])
        : [];
    if(!ring.length) return null;
    const lng = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
    const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    return { ...feature, geometry: { type: 'Point', coordinates: [lng, lat] } };
  }).filter(Boolean);
  const waterSource = map.getSource('water-sources');
  if(waterSource) waterSource.setData({ type: 'FeatureCollection', features: pointFeatures });

  const amenities = (hutsBarsData.features || []).filter(feature => feature.geometry && feature.geometry.type === 'Point');
  const isHut = properties => properties && (
    properties.tourism === 'alpine_hut' || properties.tourism === 'wilderness_hut' || properties.amenity === 'shelter'
  );
  const huts = amenities.filter(feature => isHut(feature.properties));
  const bars = amenities.filter(feature => !isHut(feature.properties));
  const hutsSource = map.getSource('mountain-huts');
  const barsSource = map.getSource('bars-cafes');
  if(hutsSource) hutsSource.setData({ type: 'FeatureCollection', features: huts });
  if(barsSource) barsSource.setData({ type: 'FeatureCollection', features: bars });
  window._dolopawsHuts = huts;
  window._dolopawsBars = bars;
  if(typeof registerPoiFeatures === 'function') registerPoiFeatures(amenities);

  const routesSource = map.getSource('dog-routes');
  if(routesSource) routesSource.setData(dogRoutesData);
}

function placeDogPolicyLabel(policy) {
  return {
    welcome: 'Dogs welcome',
    leashed: 'Dogs welcome on leash',
    'not-allowed': 'Dogs not allowed',
  }[policy] || 'Dog policy recorded';
}

function ensurePlaceDogVerificationDialog() {
  let overlay = document.getElementById('placeDogVerificationOverlay');
  if(overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'placeDogVerificationOverlay';
  overlay.className = 'place-dog-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="place-dog-dialog" role="dialog" aria-modal="true" aria-labelledby="placeDogDialogTitle">
      <button type="button" class="place-dog-close" aria-label="Close">&times;</button>
      <div class="place-dog-kick">ORMA place verification</div>
      <h2 id="placeDogDialogTitle">Are dogs welcome here?</h2>
      <p class="place-dog-place" data-place-name></p>
      <form>
        <fieldset>
          <legend>Dog policy</legend>
          <label><input type="radio" name="policy" value="welcome" required> Dogs welcome</label>
          <label><input type="radio" name="policy" value="leashed"> Dogs welcome on leash</label>
          <label><input type="radio" name="policy" value="not-allowed"> Dogs not allowed</label>
        </fieldset>
        <label class="place-dog-field">How do you know?
          <select name="evidence" required>
            <option value="">Choose evidence</option>
            <option value="visited">I visited with my dog</option>
            <option value="staff-confirmed">Staff confirmed the policy</option>
            <option value="posted-sign">I saw a posted sign</option>
          </select>
        </label>
        <label class="place-dog-field">Note <span>(optional)</span>
          <textarea name="note" maxlength="300" rows="3" placeholder="For example: terrace only, water bowl available, or seasonal restriction"></textarea>
        </label>
        <p class="place-dog-help">Submissions are reviewed by ORMA before a verified badge appears.</p>
        <div class="place-dog-result" role="status" aria-live="polite"></div>
        <button type="submit" class="place-dog-submit">Submit for ORMA review</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => { overlay.hidden = true; };
  overlay.querySelector('.place-dog-close').addEventListener('click', close);
  overlay.addEventListener('click', event => { if(event.target === overlay) close(); });
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && !overlay.hidden) close();
  });
  return overlay;
}

function openPlaceDogVerification(place, onSubmitted) {
  const overlay = ensurePlaceDogVerificationDialog();
  const form = overlay.querySelector('form');
  const result = overlay.querySelector('.place-dog-result');
  const submit = overlay.querySelector('.place-dog-submit');
  form.reset();
  result.textContent = '';
  result.className = 'place-dog-result';
  submit.disabled = false;
  submit.textContent = 'Submit for ORMA review';
  overlay.querySelector('[data-place-name]').textContent = place.name || 'Unnamed place';
  overlay.hidden = false;
  overlay.querySelector('input[name="policy"]').focus();

  form.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(form);
    const api = window.DoloPawsCommunity;
    if(!(api && api.submitPlaceDogFriendliness)){
      result.textContent = 'Verification is still loading. Please try again.';
      result.classList.add('error');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Sending…';
    const response = await api.submitPlaceDogFriendliness(
      place,
      data.get('policy'),
      data.get('evidence'),
      data.get('note')
    );
    result.textContent = response.message || (response.ok ? 'Report submitted.' : 'Could not submit this report.');
    result.classList.toggle('success', !!response.ok);
    result.classList.toggle('error', !response.ok);
    if(response.ok){
      submit.textContent = 'Submitted';
      if(typeof onSubmitted === 'function') onSubmitted();
      return;
    }
    submit.disabled = false;
    submit.textContent = 'Try again';
    if(response.action === 'login'){
      const login = document.createElement('button');
      login.type = 'button';
      login.className = 'place-dog-login';
      login.textContent = 'Log in';
      login.addEventListener('click', () => {
        overlay.hidden = true;
        const account = document.getElementById('accountBtn');
        if(account) account.click();
      });
      result.append(' ', login);
    }
  };
}

async function hydratePlaceDogVerification(host, place) {
  if(!host) return;
  const api = window.DoloPawsCommunity;
  let verified = null;
  if(api && api.getVerifiedPlaceDogFriendliness){
    verified = await api.getVerifiedPlaceDogFriendliness(place.id);
  }
  if(!host.isConnected) return;
  host.innerHTML = verified
    ? `<span class="orma-verified-badge">${productIcon('dog')} ORMA verified</span><span class="orma-verified-policy">${placeDogPolicyLabel(verified.policy)}</span><button type="button" class="orma-place-verify-btn">Report a change</button>`
    : `<span class="orma-place-prompt">Know if dogs are welcome here?</span><button type="button" class="orma-place-verify-btn">Help ORMA verify</button>`;
  host.querySelector('.orma-place-verify-btn').addEventListener('click', () => {
    openPlaceDogVerification(place, () => {
      host.innerHTML = '<span class="orma-place-pending">Thanks — pending ORMA review</span>';
    });
  });
}

// Shared helper: adds the full POI layer set for one clustered source.
// `iconGroup` must be one of the shared icon registry groups ('water',
// 'huts', 'food') so the high-zoom symbol layer can reuse the same
// category SVGs and color mapping as the rest of the site.
function addPoiLayerSet(map, sourceId, prefix, circleColor, clusterColor, iconGroup) {
  const icons = window.DoloPawsIcons;
  const iconMinZoom = icons ? icons.ICON_MIN_ZOOM : 12;
  if(!map.getLayer(prefix + '-layer-lowzoom')){
    map.addLayer({
      id: prefix + '-layer-lowzoom',
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      maxzoom: iconMinZoom,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 5,
        'circle-color': circleColor,
        'circle-opacity': 0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });
  }

  if(!map.getLayer(prefix + '-layer')){
    map.addLayer({
      id: prefix + '-layer',
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      minzoom: iconMinZoom,
      layout: {
        visibility: 'none',
        'icon-image': icons ? icons.getPoiMapIconExpression(iconGroup) : '',
        'icon-size': 1,
      },
    });
  }

  if(!map.getLayer(prefix + '-cluster')){
    map.addLayer({
      id: prefix + '-cluster',
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 20, 5, 25, 10, 30],
        'circle-color': clusterColor,
        'circle-opacity': 0.7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
  }

  if(!map.getLayer(prefix + '-cluster-count')){
    map.addLayer({
      id: prefix + '-cluster-count',
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: { 'text-color': '#fff' }
    });
  }

  // Hover cursor
  [prefix + '-layer', prefix + '-layer-lowzoom'].forEach((layerId) => {
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  });

  // Popup on click
  [prefix + '-layer', prefix + '-layer-lowzoom'].forEach((layerId) => map.off('click', layerId));
  [prefix + '-layer', prefix + '-layer-lowzoom'].forEach((layerId) => map.on('click', layerId, (e) => {
    const feature = e.features[0];
    const props = feature.properties;

    let placeType = 'Place';
    if (props.tourism === 'alpine_hut') placeType = `${productIcon('hut')} Mountain Hut (Rifugio)`;
    else if (props.tourism === 'wilderness_hut') placeType = '🛖 Wilderness Hut / Bivouac';
    else if (props.amenity === 'shelter') placeType = '⛺ Shelter';
    else if (props.amenity === 'bar') placeType = '🍺 Bar';
    else if (props.amenity === 'pub') placeType = '🍻 Pub';
    else if (props.amenity === 'cafe') placeType = '☕ Café';
    else if (props.amenity === 'restaurant') placeType = `${productIcon('food')} Restaurant`;
    else if (props.amenity === 'fast_food') placeType = '🍔 Fast food';
    else if (props.amenity === 'ice_cream') placeType = '🍦 Ice cream';
    else if (props.amenity === 'biergarten') placeType = '🍺 Beer garden';

    let content = `<b>${placeType}</b>`;
    if (props.name) content += `<br><b>${props.name}</b>`;
    if (props.ele) content += `<br><span class="dp-inline-status">${productIcon('mountain')}<span>${props.ele} m elevation</span></span>`;
    if (props.cuisine) content += `<br>🍴 ${String(props.cuisine).split(';').join(', ').replace(/_/g, ' ')}`;
    if (props.opening_hours) content += `<br>🕐 ${props.opening_hours}`;
    if (props.phone || props['contact:phone']) content += `<br>📞 ${props.phone || props['contact:phone']}`;
    if (props.website || props['contact:website']) {
      const url = props.website || props['contact:website'];
      content += `<br>🔗 <a href="${url}" target="_blank" rel="noopener">Website</a>`;
    }
    if (props.dog === 'yes') content += `<br><span class="dp-inline-status">${productIcon('dog')}<span>Dogs welcome</span></span>`;
    else if (props.dog === 'leashed') content += `<br>🦮 Dogs on leash`;
    else if (props.dog === 'no') content += `<br>🚫 No dogs`;
    if (props.outdoor_seating && props.outdoor_seating !== 'no') content += `<br>🪑 Outdoor seating`;
    const coordinates = feature.geometry.coordinates.slice(0, 2);
    const place = {
      id: String(props['@id'] || `${props.amenity || props.tourism || 'place'}-${coordinates.map(value => Number(value).toFixed(5)).join('-')}`),
      name: String(props.name || 'Unnamed place'),
      type: String(props.amenity || props.tourism || 'place'),
      coordinates,
    };
    content += '<div class="orma-place-verification" data-orma-place-verification><span class="orma-place-prompt">Checking ORMA verification…</span></div>';

    const popup = new maplibregl.Popup({ offset: 10 })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(content)
      .addTo(map);
    const popupElement = popup.getElement();
    hydratePlaceDogVerification(
      popupElement && popupElement.querySelector('[data-orma-place-verification]'),
      place
    );
  }));

  // Zoom into cluster on click
  map.off('click', prefix + '-cluster');
  map.on('click', prefix + '-cluster', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [prefix + '-cluster'] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    const source = map.getSource(sourceId);
    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    }).catch(() => {});
  });
}

function addHutsBarsLayers(map) {
  console.log('📍 Adding mountain huts + bars/cafés layers...');

  // Mountain huts: color by hut type, brown clusters
  addPoiLayerSet(
    map,
    'mountain-huts',
    'mountain-huts',
    window.DoloPawsIcons ? window.DoloPawsIcons.getPoiCircleColorExpression('huts') : '#5A5548',
    '#8A5A16',
    'huts'
  );

  // Bars & cafés: color by amenity, red clusters
  addPoiLayerSet(
    map,
    'bars-cafes',
    'bars-cafes',
    window.DoloPawsIcons ? window.DoloPawsIcons.getPoiCircleColorExpression('food') : '#5A5548',
    '#9C3A25',
    'food'
  );

  console.log('✅ Huts + bars/cafés layers added');
}

/**
 * Toggle helpers
 */
function toggleMountainHuts(map, show) {
  ['mountain-huts-layer-lowzoom', 'mountain-huts-layer', 'mountain-huts-cluster', 'mountain-huts-cluster-count'].forEach(layerId => {
    if(map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none');
  });
}

function toggleBarsCafes(map, show) {
  ['bars-cafes-layer-lowzoom', 'bars-cafes-layer', 'bars-cafes-cluster', 'bars-cafes-cluster-count'].forEach(layerId => {
    if(map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none');
  });
}

// ============================================================
// LEGEND ENTRY
// ============================================================

/*
Add this to your legend:

<span>💧 Drinking water (12,921 sources)</span>

Optional color legend:
<span><span style="width:12px;height:12px;background:#4E90A8;display:inline-block;border-radius:50%;margin-right:4px;"></span>Fountain</span>
<span><span style="width:12px;height:12px;background:#228B22;display:inline-block;border-radius:50%;margin-right:4px;"></span>Spring</span>
<span><span style="width:12px;height:12px;background:#0077BE;display:inline-block;border-radius:50%;margin-right:4px;"></span>Water tap</span>
*/

// ============================================================
// DEV PREVIEW — index.html?view=returning shows the logged-in shell
// without an account (profile falls back to the guest wizard draft;
// cloud saves stay disabled). Mirrors the ?view= contract documented
// in homepage-view.js.
// ============================================================
(function(){
  try {
    const forced = new URLSearchParams(window.location.search).get('view');
    if(forced === 'returning'){
      liDevView = true;
      window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail: { user: null, devView: 'returning' } }));
    }
  } catch(e){ /* preview-only convenience — never break the real page */ }
})();
