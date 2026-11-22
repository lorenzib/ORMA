// The explore map's shared pieces: the base look (relief, labels, the quiet
// basemap), the Layers panel with Map / Satellite / 3D, the lift, fountain and
// hut overlays, and the place pop-ups. The homepage (script.js) and the Trails
// page (browse-map.js) draw the same map from these, so a change here shows on
// both (owner, 20 November 2026: one map, always open, on both pages).
//
// Classic script, loaded before script.js and browse-map.js: its functions are
// page globals, as they were when they lived in script.js.

// Wording through i18n.js, numbers as the reader writes them, product icons.
function emTx(text, vars){
  const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
  if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
  return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
}
function emNum(value){ const i18n = typeof window!=='undefined' && window.DoloPawsI18n; return i18n && typeof i18n.num==='function' ? i18n.num(value) : value; }
function emIcon(icon, size = 14){
  return window.DoloPawsIcons ? window.DoloPawsIcons.renderIconSvg(icon, { mode:'inline', color:'currentColor', size }) : '';
}
// The region whose fountains and huts the overlays load: the homepage's
// chosen region, or 'all' on a page that has none.
function emRegion(){
  // eslint-disable-next-line no-undef
  return typeof activeRegion !== 'undefined' && activeRegion ? activeRegion : 'all';
}

// The relief was a flat 0.45 (#468), set so the map would not read as flat.
// At region zoom that strength is the loudest thing on a calm base and it
// greys out the roads, woods and villages beneath it. Ramped rather than
// weakened: faint while choosing a valley, unchanged from zoom 13 up, which
// is where every trail-detail map opens.
const BASE_HILLSHADE_EXAGGERATION = [
  'interpolate', ['linear'], ['zoom'], 8, 0.16, 11, 0.3, 13, 0.45,
];

function createMapOverlayControls(map, containerId, allLiftMarkers){
  const container = document.getElementById(containerId);
  if(!container) return;
  // The panel sits inside the map box; a box already placed by the page
  // (absolute, filling its pane) keeps its own position.
  if(getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const icons = window.DoloPawsIcons;

  // UI: one compact "Layers" button that expands into a chip panel, // replaces the old stack of full-width buttons that covered a third of
  // the map on mobile.
  // Marked routes default ON. They were off, on the reasoning that a browse
  // map is for choosing a walk rather than following one and the full network
  // buries the ORMA routes you are picking between. Reversed deliberately:
  // seen on the real map the lines give the valley its shape, and a reader
  // who wants them should not have to know the Layers panel exists to find
  // them. The panel still turns them off in one tap.
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
    // Our own routes, or Waymarked's raster where the page fell back to it.
    routes:   window.ORMAMapStyle.HIKING_LAYER_IDS,
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

  function loadOverlayData(key){
    if(key === 'fountains') return initializeWaterSources(map);
    if(key === 'huts' || key === 'barsCafes') return initializeHutsBars(map);
    return Promise.resolve();
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
    chip.addEventListener('click', async () => {
      overlayStates[key] = !overlayStates[key];
      chipStyle(chip, overlayStates[key]);
      renderMapLegend();
      if(!overlayStates[key]){
        applyVisibility(key);
        return;
      }
      chip.disabled = true;
      chip.setAttribute('aria-busy', 'true');
      try{
        await loadOverlayData(key);
        applyVisibility(key);
      }catch(error){
        overlayStates[key] = false;
        chipStyle(chip, false);
        renderMapLegend();
      }finally{
        chip.disabled = false;
        chip.removeAttribute('aria-busy');
      }
    });
    panel.appendChild(chip);
    return chip;
  }

  mkChip(t('chips.routes'), 'routes');
  mkChip(t('chips.lifts'), 'lifts');
  mkChip(t('chips.fountains'), 'fountains');
  mkChip(t('chips.huts'), 'huts');
  mkChip(t('chips.food'), 'barsCafes');

  // No veterinary chip here. The layer was backed by whatever OSM happened to
  // have mapped within a wide radius, which on this catalogue is too thin to
  // put in front of someone deciding where to walk a dog: an empty map reads
  // as "no vet nearby" rather than "nobody has mapped one", and that is the
  // wrong thing to tell an owner. Removed 2026-10-14 for that reason, not as
  // a layout change -- veterinary-care.js and the trail page's own chip are
  // untouched.

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
        }, window.ORMAMapStyle.networkLayerId(map));
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
    // Not isStyleLoaded(): that also waits for every tile and every data
    // update, so on a busy map it can stay false and Satellite never shows.
    // Adding a layer only needs the style itself, and throws until it is in.
    try {
      if(!map.getSource('satellite')) map.addSource('satellite', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © Esri',
      });
    } catch(err){ return false; }
    // Below our hiking routes: the first symbol layer is now their numbers,
    // which sit above the walk, so the photo would cover the walk itself.
    const belowRoutes = window.ORMAMapStyle.networkLayerId(map);
    try {
      map.addLayer({
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'none' },
        paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 100 },
      }, belowRoutes);
    } catch(err){ return false; }
    return true;
  }
  (function buildLayerSwitch(){
    const host = map.getContainer();
    if(!host || host.querySelector('.td-layer-switch')) return;
    // The app opens all three from its Terrain button (app-explore.js); a
    // phone browser has room for 3D only.
    const terrainOnly = !document.documentElement.classList.contains('orma-app')
      && window.matchMedia && window.matchMedia('(max-width:700px)').matches;
    const wrap = document.createElement('div');
    wrap.className = 'td-layer-switch td-layer-switch--home' + (terrainOnly ? ' td-layer-switch--terrain-only' : '');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', terrainOnly ? emTx('Terrain') : emTx('Map style'));
    wrap.innerHTML = terrainOnly
      ? '<button type="button" data-map3d aria-pressed="false">' + emTx('Terrain') + '</button>'
      : '<button type="button" data-maplayer="map" class="on" aria-pressed="true">' + emTx('Map') + '</button>' +
        '<button type="button" data-maplayer="satellite" aria-pressed="false">' + emTx('Satellite') + '</button>' +
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
      if(!base) return;
      // Before the style is in, switch once it arrives.
      if(!ensureSatelliteLayer()){
        map.once('styledata', () => { if(ensureSatelliteLayer()) showBase(base); });
        return;
      }
      showBase(base);
    });
    function showBase(base){
      const sat = base.getAttribute('data-maplayer') === 'satellite';
      map.setLayoutProperty('satellite-layer', 'visibility', sat ? 'visible' : 'none');
      // The vector style's building fills sit above the raster and would
      // paint every roof grey on top of the photo imagery, hide them
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
    }
  })();

  // UI: dynamic legend, only describes what is actually visible on the
  // map right now, instead of a fixed list of every possible layer.
  function renderMapLegend(){
    const legend = document.getElementById('trailMapLegend');
    if(!legend) return;
    const line = (color, label) => `<span><span style="width:14px;height:3px;background:${color};display:inline-block;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>${label}</span>`;
    const category = (iconKey, color, label) => icons
      ? icons.legendItemHtml(iconKey, label, { color })
      : `<span><span style="width:9px;height:9px;background:${color};display:inline-block;border-radius:50%;margin-right:4px;vertical-align:middle;border:1px solid #fff;"></span>${label}</span>`;
    let html = line('#2C5C34', t('legend.low')) + line('#8A5A16', t('legend.moderate')) + line('#9C3A25', t('legend.caution'));
    if(overlayStates.lifts) html += line('#4E90A8', t('legend.liftConfirmed')) + line('#5A5548', t('legend.liftUnknown'));
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

function collapseMapAttribution(container){
  if(!container) return;
  const attribution = container.querySelector('.maplibregl-ctrl-attrib');
  if(!attribution) return;
  attribution.classList.add('maplibregl-compact');
  attribution.classList.remove('maplibregl-compact-show');
  const toggle = attribution.querySelector('.maplibregl-ctrl-attrib-button');
  if(toggle) toggle.setAttribute('aria-expanded', 'false');
}

// Increases label density by telling every text/icon layer in the base
// style to render even when it would otherwise overlap a neighbor. By
// default, vector styles hide crowded labels for cleanliness, this trades
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
    // rules, forcing those all visible at once made town centers like
    // Canazei unreadably dense.
    if(sl !== 'place' && sl !== 'mountain_peak') return;
    try {
      map.setLayerZoomRange(layer.id, 0, 24);
      map.setLayoutProperty(layer.id, 'text-optional', true);
      // NOTE: deliberately NOT setting text-allow-overlap/icon-allow-overlap
      // anymore, that disabled collision detection entirely and was the
      // root cause of the overcrowded map. MapLibre's collision logic now
      // prunes overlapping labels automatically at every zoom.
    } catch(e) { /* some layers may not support one of these props, skip silently */ }
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
    } catch(e) { /* layer may not exist in this style version, skip silently */ }
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
        }, window.ORMAMapStyle.networkLayerId(map));
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
      // Strengthened so the relief actually reads in flat mode: the old 0.25
      // was so faint the map looked flat beside AllTrails/Strava. A cool
      // shadow and warm highlight model the ridges like a shaded-relief map
      // without shouting over the calm base.
      'hillshade-exaggeration': BASE_HILLSHADE_EXAGGERATION,
      'hillshade-shadow-color': '#4A5347',
      'hillshade-highlight-color': '#FBF7EC',
      'hillshade-method': 'igor',
    },
  }, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
}

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
const waterSourcesLoads = new WeakMap();

function initializeWaterSources(map) {
  // The map can already have this source/layer from initTrailMap().
  // Re-adding the same IDs throws and interrupts map-load setup.
  const hasSource = !!map.getSource('water-sources');
  if(hasSource) return Promise.resolve(map.getSource('water-sources'));
  if(waterSourcesLoads.has(map)) return waterSourcesLoads.get(map);
  if(!hasSource){
    const waterAsset = window.DoloPawsRegionalData
      ? window.DoloPawsRegionalData.poiUrl(emRegion(), 'water')
      : './water-sources-all-regions.geojson';
    const load = fetch(waterAsset)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to load GeoJSON`);
        }
        return response.json();
      })
      .then(geojsonData => {
        console.log(`✅ Loaded ${geojsonData.features?.length || 0} water sources for ${emRegion()}`);
        
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
        return map.getSource('water-sources');
      })
      .catch(error => {
        console.error('❌ Error loading water sources GeoJSON:', error.message);
        waterSourcesLoads.delete(map);
        throw error;
      });
    waterSourcesLoads.set(map, load);
    return load;
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
        'text-font': ['Noto Sans Bold'],
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
    let waterType = emTx('Water Source');
    if (props.amenity === 'drinking_water') waterType = '🚰 ' + emTx('Drinking Fountain');
    else if (props.amenity === 'fountain') waterType = '⛲ ' + emTx('Fountain');
    else if (props.natural === 'spring') waterType = '💧 ' + emTx('Natural Spring');
    else if (props.man_made === 'water_tap') waterType = '🚪 ' + emTx('Water Tap');
    else if (props.amenity === 'water_point') waterType = '💦 ' + emTx('Water Point');

    // Build popup content
    let content = `<b>${waterType}</b>`;
    
    const pointLabel = props.name || props.label;
    const pointDistance = props.km !== undefined ? `Km ${emNum(props.km)}` : '';
    if (pointLabel && pointDistance) {
      content += `<br>${pointLabel} <small>(${pointDistance})</small>`;
    } else if (pointLabel) {
      content += `<br>${pointLabel}`;
    } else if (pointDistance) {
      content += `<br><small>${pointDistance}</small>`;
    }
    
    if (props.check_date) {
      content += `<br><small>✓ ${emTx('Last verified: {date}', { date:props.check_date })}</small>`;
    }
    
    if (props.seasonal === 'yes') {
      content += `<br><small class="dp-inline-status">${emIcon('warning', 13)}<span>${emTx('Seasonal water source')}</span></small>`;
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
 * (Trentino, Veneto, Savoy), same pattern as water sources.
 * ============================================================
 */
const hutsBarsLoads = new WeakMap();

function initializeHutsBars(map) {
  if(map.getSource('mountain-huts') && map.getSource('bars-cafes')) return Promise.resolve();
  if(hutsBarsLoads.has(map)) return hutsBarsLoads.get(map);

  const hutsBarsAsset = window.DoloPawsRegionalData
    ? window.DoloPawsRegionalData.poiUrl(emRegion(), 'huts-bars')
    : './huts-bars-all-regions.geojson';
  const load = fetch(hutsBarsAsset)
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

      console.log(`✅ Loaded ${huts.length} mountain huts and ${bars.length} bars/cafés for ${emRegion()}`);

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
      return { huts, bars };
    })
    .catch(error => {
      console.error('❌ Error loading huts/bars GeoJSON:', error.message);
      hutsBarsLoads.delete(map);
      throw error;
    });
  hutsBarsLoads.set(map, load);
  return load;
}

async function updateRegionalMapData(map, regionSelection) {
  if(!map || !window.DoloPawsRegionalData) return;
  const regional = window.DoloPawsRegionalData;
  const regions = (Array.isArray(regionSelection) ? regionSelection : [regionSelection]).filter(Boolean);
  const waterSource = map.getSource('water-sources');
  const hutsSource = map.getSource('mountain-huts');
  const barsSource = map.getSource('bars-cafes');
  const routesSource = map.getSource('dog-routes');
  const jobs = [];

  const fetchGeoJson = async url => {
    if(!url) throw new Error('Regional map data unavailable');
    const response = await fetch(url);
    if(!response.ok) throw new Error('Regional map data unavailable');
    return response.json();
  };
  const fetchCombinedGeoJson = async kind => {
    const collections = await Promise.all(regions.map(region => fetchGeoJson(regional.poiUrl(region, kind))));
    return {
      type: 'FeatureCollection',
      features: collections.flatMap(collection => Array.isArray(collection.features) ? collection.features : [])
    };
  };

  // Only refresh datasets that the visitor has already asked the map to
  // create. Hidden, unopened layers must stay off the network on a region
  // switch as well as during the initial mobile load.
  if(waterSource){
    jobs.push(fetchCombinedGeoJson('water').then(waterData => {
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
      waterSource.setData({ type: 'FeatureCollection', features: pointFeatures });
    }));
  }

  if(hutsSource && barsSource){
    jobs.push(fetchCombinedGeoJson('huts-bars').then(hutsBarsData => {
      const amenities = (hutsBarsData.features || []).filter(feature => feature.geometry && feature.geometry.type === 'Point');
      const isHut = properties => properties && (
        properties.tourism === 'alpine_hut' || properties.tourism === 'wilderness_hut' || properties.amenity === 'shelter'
      );
      const huts = amenities.filter(feature => isHut(feature.properties));
      const bars = amenities.filter(feature => !isHut(feature.properties));
      hutsSource.setData({ type: 'FeatureCollection', features: huts });
      barsSource.setData({ type: 'FeatureCollection', features: bars });
      window._dolopawsHuts = huts;
      window._dolopawsBars = bars;
      if(typeof registerPoiFeatures === 'function') registerPoiFeatures(amenities);
    }));
  }

  if(routesSource){
    jobs.push(fetchCombinedGeoJson('dog-routes').then(dogRoutesData => {
      routesSource.setData(dogRoutesData);
    }));
  }

  await Promise.all(jobs);
}

function placeDogPolicyLabel(policy) {
  return {
    welcome: emTx('Dogs welcome'),
    leashed: emTx('Dogs welcome on a lead'),
    'not-allowed': emTx('Dogs not allowed'),
  }[policy] || emTx('Dog policy recorded');
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
      <button type="button" class="place-dog-close" aria-label="${emTx('Close')}">&times;</button>
      <div class="place-dog-kick">${emTx('ORMA place verification')}</div>
      <h2 id="placeDogDialogTitle">${emTx('Are dogs welcome here?')}</h2>
      <p class="place-dog-place" data-place-name></p>
      <form>
        <fieldset>
          <legend>${emTx('Dog policy')}</legend>
          <label><input type="radio" name="policy" value="welcome" required> ${emTx('Dogs welcome')}</label>
          <label><input type="radio" name="policy" value="leashed"> ${emTx('Dogs welcome on a lead')}</label>
          <label><input type="radio" name="policy" value="not-allowed"> ${emTx('Dogs not allowed')}</label>
        </fieldset>
        <label class="place-dog-field">${emTx('How do you know?')}
          <select name="evidence" required>
            <option value="">${emTx('Choose evidence')}</option>
            <option value="visited">${emTx('I visited with my dog')}</option>
            <option value="staff-confirmed">${emTx('Staff confirmed the policy')}</option>
            <option value="posted-sign">${emTx('I saw a posted sign')}</option>
          </select>
        </label>
        <label class="place-dog-field">${emTx('Note')} <span>${emTx('(optional)')}</span>
          <textarea name="note" maxlength="300" rows="3" placeholder="${emTx('For example: terrace only, water bowl available, or seasonal restriction')}"></textarea>
        </label>
        <p class="place-dog-help">${emTx('Submissions are reviewed by ORMA before a verified badge appears.')}</p>
        <div class="place-dog-result" role="status" aria-live="polite"></div>
        <button type="submit" class="place-dog-submit">${emTx('Submit for ORMA review')}</button>
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
  submit.textContent = emTx('Submit for ORMA review');
  overlay.querySelector('[data-place-name]').textContent = place.name || emTx('Unnamed place');
  overlay.hidden = false;
  overlay.querySelector('input[name="policy"]').focus();

  form.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(form);
    const api = window.DoloPawsCommunity;
    if(!(api && api.submitPlaceDogFriendliness)){
      result.textContent = emTx('Verification is still loading. Please try again.');
      result.classList.add('error');
      return;
    }
    submit.disabled = true;
    submit.textContent = emTx('Sending…');
    const response = await api.submitPlaceDogFriendliness(
      place,
      data.get('policy'),
      data.get('evidence'),
      data.get('note')
    );
    result.textContent = response.message || (response.ok ? emTx('Report submitted.') : emTx('Could not submit this report.'));
    result.classList.toggle('success', !!response.ok);
    result.classList.toggle('error', !response.ok);
    if(response.ok){
      submit.textContent = emTx('Submitted');
      if(typeof onSubmitted === 'function') onSubmitted();
      return;
    }
    submit.disabled = false;
    submit.textContent = emTx('Try again');
    if(response.action === 'login'){
      const login = document.createElement('button');
      login.type = 'button';
      login.className = 'place-dog-login';
      login.textContent = emTx('Log in');
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
    ? `<span class="orma-verified-badge">${emIcon('dog')} ${emTx('Verified by ORMA')}</span><span class="orma-verified-policy">${placeDogPolicyLabel(verified.policy)}</span><button type="button" class="orma-place-verify-btn">${emTx('Report a change')}</button>`
    : `<span class="orma-place-prompt">${emTx('Know if dogs are welcome here?')}</span><button type="button" class="orma-place-verify-btn">${emTx('Help ORMA verify')}</button>`;
  host.querySelector('.orma-place-verify-btn').addEventListener('click', () => {
    openPlaceDogVerification(place, () => {
      host.innerHTML = '<span class="orma-place-pending">' + emTx('Thanks, pending ORMA review') + '</span>';
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
        'text-font': ['Noto Sans Bold'],
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

    let placeType = emTx('Place');
    if (props.tourism === 'alpine_hut') placeType = `${emIcon('hut')} ${emTx('Mountain Hut (Rifugio)')}`;
    else if (props.tourism === 'wilderness_hut') placeType = '🛖 ' + emTx('Wilderness Hut / Bivouac');
    else if (props.amenity === 'shelter') placeType = '⛺ ' + emTx('Shelter');
    else if (props.amenity === 'bar') placeType = '🍺 Bar';
    else if (props.amenity === 'pub') placeType = '🍻 Pub';
    else if (props.amenity === 'cafe') placeType = '☕ Café';
    else if (props.amenity === 'restaurant') placeType = `${emIcon('food')} ${emTx('Restaurant')}`;
    else if (props.amenity === 'fast_food') placeType = '🍔 ' + emTx('Fast food');
    else if (props.amenity === 'ice_cream') placeType = '🍦 ' + emTx('Ice cream');
    else if (props.amenity === 'biergarten') placeType = '🍺 ' + emTx('Beer garden');

    let content = `<b>${placeType}</b>`;
    if (props.name) content += `<br><b>${props.name}</b>`;
    if (props.ele) content += `<br><span class="dp-inline-status">${emIcon('mountain')}<span>${emTx('{m} m elevation', { m:props.ele })}</span></span>`;
    if (props.cuisine) content += `<br>🍴 ${String(props.cuisine).split(';').join(', ').replace(/_/g, ' ')}`;
    if (props.opening_hours) content += `<br>🕐 ${props.opening_hours}`;
    if (props.phone || props['contact:phone']) content += `<br>📞 ${props.phone || props['contact:phone']}`;
    if (props.website || props['contact:website']) {
      const url = props.website || props['contact:website'];
      content += `<br>🔗 <a href="${url}" target="_blank" rel="noopener">${emTx('Website')}</a>`;
    }
    if (props.dog === 'yes') content += `<br><span class="dp-inline-status">${emIcon('dog')}<span>${emTx('Dogs welcome')}</span></span>`;
    else if (props.dog === 'leashed') content += `<br>🦮 ${emTx('Dogs on a lead')}`;
    else if (props.dog === 'no') content += `<br>🚫 ${emTx('No dogs')}`;
    if (props.outdoor_seating && props.outdoor_seating !== 'no') content += `<br>🪑 ${emTx('Outdoor seating')}`;
    const coordinates = feature.geometry.coordinates.slice(0, 2);
    const place = {
      id: String(props['@id'] || `${props.amenity || props.tourism || 'place'}-${coordinates.map(value => Number(value).toFixed(5)).join('-')}`),
      name: String(props.name || 'Unnamed place'),
      type: String(props.amenity || props.tourism || 'place'),
      coordinates,
    };
    content += '<div class="orma-place-verification" data-orma-place-verification><span class="orma-place-prompt">' + emTx('Checking ORMA verification…') + '</span></div>';

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
// THE EXPLORE MAP
// ============================================================
// One map for the homepage and the Trails page: the same base, controls and
// trail drawing. Each page keeps its own list and decides which walks stand
// out and what colour a walk is; the layer ids are the same on both.
(function(global){
  // The marked network is drawn from here up, faint until zoom 13 (map-style.js)
  // and with its numbers only from 12. Owner, 20 Nov 2026: the homepage map
  // should read like the trail page, so the network shows a little earlier.
  const BROWSE_NETWORK_MIN_ZOOM = 11.5;
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

  function mapOptions(options){
    const settings = Object.assign({
      style:STYLE,
      center:[12.05, 46.55],
      zoom:9,
      scrollZoom:true,
      // Collapsed ⓘ attribution: the full credit line collided with the
      // phone layout's Record pill.
      attributionControl: { compact: true },
    }, options || {});
    return global.DoloPawsMapRuntime ? global.DoloPawsMapRuntime.mapOptions(settings) : settings;
  }

  // Zoom, locate, "Draw a route here" and "Expand map".
  function addChrome(map, options){
    const settings = options || {};
    const el = map.getContainer();
    map.addControl(new global.maplibregl.NavigationControl({ showCompass:false }), 'top-right');
    map.addControl(new global.maplibregl.GeolocateControl({
      positionOptions:{ enableHighAccuracy:true },
      trackUserLocation:true,
      showUserHeading:true,
      fitBoundsOptions:{ maxZoom:15.5 },
    }), 'top-right');
    collapseMapAttribution(el);

    // "Draw a route here" opens the planner on the area on screen. The link
    // follows the map, so one opened in a new tab gets the same place.
    const drawLinks = (settings.drawLinks || []).filter(Boolean);
    const syncDrawLinks = () => {
      if(!drawLinks.length) return;
      const centre = map.getCenter();
      const view = `lat=${centre.lat.toFixed(5)}&lng=${centre.lng.toFixed(5)}&z=${map.getZoom().toFixed(2)}`;
      drawLinks.forEach(link => { link.href = `route-planner.html?${view}`; });
      // The app plans from the Record tab, which opens the planner here too.
      try{ sessionStorage.setItem('orma-explore-map-view', view); }catch(error){}
    };
    map.on('load', syncDrawLinks);
    map.on('moveend', syncDrawLinks);

    // App-style fullscreen keeps every control in its corner and works on
    // iOS, where the browser Fullscreen API is limited.
    const mapWrap = settings.wrap;
    const expandButton = settings.expandButton;
    const setFullscreen = on => {
      if(!mapWrap) return;
      mapWrap.classList.toggle('map-fs', on);
      document.body.classList.toggle('map-fs-open', on);
      if(expandButton){
        expandButton.setAttribute('aria-expanded', String(on));
        expandButton.setAttribute('aria-label', on ? emTx('Close map') : emTx('Expand map'));
        expandButton.innerHTML = on
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> <span>' + emTx('Close map') + '</span>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> <span>' + emTx('Expand map') + '</span>';
      }
      setTimeout(() => map.resize(), 60);
    };
    if(expandButton && mapWrap){
      expandButton.addEventListener('click', () => setFullscreen(!mapWrap.classList.contains('map-fs')));
    }
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && mapWrap && mapWrap.classList.contains('map-fs')) setFullscreen(false);
    });
    return { setFullscreen, syncDrawLinks };
  }

  // The base: relief, denser labels, a calm basemap and the grey marked
  // network from valley zoom. Returns where the trail layers go.
  async function setupBase(map){
    if(global.DoloPawsMapRuntime) global.DoloPawsMapRuntime.enhance(map);
    collapseMapAttribution(map.getContainer());
    addTerrainSource(map);
    increaseLabelDensity(map);
    preventTransitPoiDuplication(map);
    if(global.DoloPawsIcons) await global.DoloPawsIcons.registerMapImages(map);
    const style = global.ORMAMapStyle;
    const firstLabelLayerId = style.firstLabelLayerId(map);
    style.quietBasemap(map);
    // `minzoom` is the density lever, not opacity: at region zoom the full
    // network and its route shields are a mesh over the walks being chosen
    // between. The Layers chip still turns the network off.
    style.addHikingRoutes(map, {
      beforeId: firstLabelLayerId, visible: true, minzoom: BROWSE_NETWORK_MIN_ZOOM,
    });
    addBaseHillshade(map, style.networkLayerId(map));
    // Contour lines, as on the trail page: under the network, from zoom 11.
    if(global.DoloPawsMapRuntime && global.DoloPawsMapRuntime.loadContour){
      global.DoloPawsMapRuntime.loadContour()
        .then(() => style.addContours(map))
        .catch(() => {});
    }
    return {
      firstLabelLayerId,
      // Rails go over the marked routes and under their numbers.
      railsBeforeId:style.walkLineBeforeId(map),
      corridorBeforeId:style.walkCorridorBeforeId(map),
    };
  }

  // Every walk as a line from region zoom (`trail-paths`, one LineString per
  // walk with id, score, rank, out and whatever the colour reads), a dot at
  // each start (`trail-points`), and the chosen walk drawn like the trail
  // page (`trail-selected-route`, `trail-selected-access`).
  //
  //   colour         the colour of a walk that stands out (an expression)
  //   otherColour    the colour of the rest (default grey)
  //   lineEmphasis   which lines stand out (a boolean expression)
  //   pinEmphasis    which dots are large, and numbered when rankLabels is on
  //   pinOtherColour, pinRadius, pinOpacity   the other dots
  function addTrailLayers(map, beforeIds, options){
    const settings = options || {};
    const catalogueMatchColour = settings.colour;
    const otherColour = settings.otherColour || '#9AA19C';
    const lineEmphasis = settings.lineEmphasis || false;
    const pinEmphasis = settings.pinEmphasis || false;
    const outOfSeason = ['==', ['coalesce', ['get', 'out'], 0], 1];

    /**
     * One line width for a walk that stands out and another for the rest,
     * across the zoom ramp.
     *
     * The zoom interpolation has to stay at the TOP of the paint property. An
     * `interpolate` on `["zoom"]` nested inside a `case` is not evaluated per
     * zoom, so the emphasis test goes inside each stop, never the other way round.
     */
    function rankWidth(top, other) {
      return ['interpolate', ['linear'], ['zoom'],
        7, ['case', lineEmphasis, top[0], other[0]],
        10, ['case', lineEmphasis, top[1], other[1]],
        13, ['case', lineEmphasis, top[2], other[2]],
        16, ['case', lineEmphasis, top[3], other[3]],
      ];
    }

    // Rails and the chosen walk go over the marked routes and under their
    // numbers (under the raster, if the page has fallen back to it).
    const railsBeforeId = beforeIds.railsBeforeId;
    map.addSource('trail-paths', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'trail-paths-casing',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#F8F6F0',
        'line-width': rankWidth([3, 4.5, 5.5, 7], [1.2, 2, 3, 4]),
        'line-opacity': ['case', outOfSeason, 0.3, 0.9],
      },
    }, railsBeforeId);
    map.addLayer({
      id: 'trail-paths-line',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#858D88',
        'line-width': rankWidth([1.5, 2, 2.5, 3.5], [0.6, 1, 1.6, 2]),
        'line-opacity': ['case', outOfSeason, 0.3, 1],
      },
    }, railsBeforeId);
    // A white casing under each walk's own colour, beneath the route numbers
    // so the numbers read on top of each rail.
    map.addLayer({
      id: 'trail-paths-orma-halo',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': rankWidth([3, 4.5, 5.5, 7], [1.5, 2.5, 3.5, 4.5]),
        'line-opacity': ['case', outOfSeason, 0.3, lineEmphasis, 0.9, 0.5],
      },
    }, railsBeforeId);
    map.addLayer({
      id: 'trail-paths-orma-line',
      type: 'line',
      source: 'trail-paths',
      minzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['case', lineEmphasis, catalogueMatchColour, otherColour],
        'line-width': rankWidth([1.5, 2, 2.5, 3.5], [0.8, 1.2, 1.6, 2]),
        // Owner, 19 Nov: the 15-20 px translucent bands read as blobs. A walk
        // that stands out is a thin solid line on a white edge, the same as
        // the chosen walk and the trail page; the rest stay faint hairlines.
        'line-opacity': ['case', outOfSeason, 0.3, lineEmphasis, 1, 0.5],
      },
    }, railsBeforeId);
    // The chosen walk: a thin line in its colour on a white edge, over the
    // contours and the marked routes, as on the trail page. The routes it
    // follows are numbered beside it (setSelected), so no shields here.
    map.addSource('trail-selected-route', {
      type:'geojson', data:{ type:'FeatureCollection', features:[] },
    });
    const corridorBeforeId = beforeIds.corridorBeforeId;
    map.addLayer({
      id:'trail-selected-route-casing', type:'line', source:'trail-selected-route',
      layout:{ 'line-join':'round', 'line-cap':'round', visibility:'none' },
      paint:{
        'line-color':'#FFFFFF', 'line-opacity':0.95,
        'line-width':['interpolate',['linear'],['zoom'],8,4,12,5.5,14,7,17,9],
      },
    }, corridorBeforeId);
    map.addLayer({
      id:'trail-selected-route-line', type:'line', source:'trail-selected-route',
      layout:{ 'line-join':'round', 'line-cap':'round', visibility:'none' },
      paint:{
        'line-color':['coalesce',['get','routeColor'],'#4A7856'],
        'line-width':['interpolate',['linear'],['zoom'],8,2,12,2.75,14,3.75,17,5], 'line-opacity':1,
      },
    }, corridorBeforeId);
    // The chosen walk's walk-in from its start flag (trail.accessPath): thin
    // solid grey under the walk, as on the trail page (map-style.js).
    map.addSource('trail-selected-access', {
      type:'geojson', data:{ type:'FeatureCollection', features:[] },
    });
    global.ORMAMapStyle.addAccessLine(map, {
      id:'trail-selected-access-line', source:'trail-selected-access',
      beforeId:'trail-selected-route-casing',
    });
    map.addLayer({
      id:'trail-selected-route-arrows', type:'symbol', source:'trail-selected-route',
      layout:{
        visibility:'none', 'symbol-placement':'line', 'symbol-spacing':80,
        'text-field':'➤', 'text-size':18, 'text-rotation-alignment':'map',
        'text-keep-upright':false, 'text-allow-overlap':true, 'text-ignore-placement':true,
      },
      paint:{
        'text-color':'#ffffff',
        'text-halo-color':['coalesce',['get','routeColor'],'#4A7856'],
        'text-halo-width':2,
      },
    }, beforeIds.firstLabelLayerId);
    // Wide, near-invisible twin of the route line so a fingertip (or a
    // slightly-off cursor) still hits the trail, 3px is too thin a target.
    map.addLayer({
      id: 'trail-paths-hit',
      type: 'line',
      source: 'trail-paths',
      minzoom: 10,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0.01 },
    }, railsBeforeId);

    // A dot at each start. The walks that stand out are large (and numbered
    // where the page numbers its list); a red ring marks a saved walk.
    map.addSource('trail-points', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'trail-unclustered',
      type: 'circle',
      source: 'trail-points',
      // Walks in season draw on top of those out of season this month.
      layout: { 'circle-sort-key': ['-', 1, ['coalesce', ['get', 'out'], 0]] },
      paint: {
        'circle-color': ['case', pinEmphasis, catalogueMatchColour, settings.pinOtherColour || otherColour],
        // Small: the walks' lines lead, as on the trail page, and the pins
        // mark where each one starts.
        'circle-radius': ['case', pinEmphasis, 8, settings.pinRadius || 3],
        'circle-opacity': [
          'case',
          ['==', ['coalesce', ['get', 'out'], 0], 1], 0.3,
          pinEmphasis, 1, settings.pinOpacity || 0.42,
        ],
        'circle-stroke-opacity': ['case', outOfSeason, 0.3, 1],
        'circle-stroke-width': ['case', pinEmphasis, 2, 1],
        'circle-stroke-color': [
          'case', ['==', ['coalesce', ['get', 'saved'], 0], 1], '#9C3A25', '#fff',
        ],
      },
    });
    if(settings.rankLabels){
      map.addLayer({
        id: 'trail-rank-labels',
        type: 'symbol',
        source: 'trail-points',
        filter: pinEmphasis,
        layout: {
          'text-field': ['to-string', ['get', 'rank']],
          'text-font': global.ORMAMapStyle.FONT_BOLD,
          'text-size': 9.5,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(46,64,52,.45)',
          'text-halo-width': 0.7,
          'text-opacity': ['case', outOfSeason, 0.3, 1],
        },
      });
    }
    map.addLayer({
      id: 'trail-selected-point',
      type: 'circle',
      source: 'trail-points',
      filter: ['==', ['get', 'id'], '__none__'],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 12,
        'circle-stroke-width': 3.5,
        'circle-stroke-color': '#fff',
      },
    });
    return { clickLayers:['trail-unclustered', 'trail-paths-hit'] };
  }

  // The chosen walk drawn like the trail page: its own line in routeColor,
  // the walk-in in grey under it, arrows on a one-way walk, the marked route
  // it follows brought forward, and its dot ringed. Null clears it.
  function setSelected(map, trail, options){
    const settings = options || {};
    if(!map || !map.getSource('trail-selected-route')) return;
    const id = trail ? String(trail.id) : '';
    if(map.getLayer('trail-selected-point')) map.setFilter('trail-selected-point', ['==', ['get', 'id'], id || '__none__']);
    const route = trail && Array.isArray(trail.path) && trail.path.length > 1 ? trail.path : [];
    const visible = route.length > 1;
    const routeColor = settings.routeColor || '#4A7856';
    const toLngLat = path => path.map(([lat, lng]) => [Number(lng), Number(lat)]);
    map.getSource('trail-selected-route').setData({
      type:'FeatureCollection',
      features:visible ? [{ type:'Feature', properties:{ id, routeColor }, geometry:{ type:'LineString', coordinates:toLngLat(route) } }] : [],
    });
    // The chosen walk leaves the stack of every walk while it is drawn on its
    // own, or its rail would sit under the clean line and fight it.
    ['trail-paths-casing','trail-paths-line','trail-paths-orma-halo','trail-paths-orma-line'].forEach(layerId => {
      if(map.getLayer(layerId)) map.setFilter(layerId, visible ? ['!=', ['get','id'], id] : null);
    });
    ['trail-selected-route-casing','trail-selected-route-line'].forEach(layerId => {
      if(map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    });
    const access = visible && trail.accessPath && Array.isArray(trail.accessPath.path) && trail.accessPath.path.length > 1
      ? trail.accessPath.path : null;
    if(map.getSource('trail-selected-access')){
      map.getSource('trail-selected-access').setData({
        type:'FeatureCollection',
        features:access ? [{ type:'Feature', properties:{ id, routeColor }, geometry:{ type:'LineString', coordinates:toLngLat(access) } }] : [],
      });
    }
    global.ORMAMapStyle.setHikingWalk(map, visible ? toLngLat(route) : null);
    const first = route[0];
    const last = route[route.length - 1];
    const isLoop = visible && metresBetween(first, last) <= 75;
    if(map.getLayer('trail-selected-route-arrows')){
      map.setLayoutProperty('trail-selected-route-arrows', 'visibility', visible && !isLoop ? 'visible' : 'none');
    }
    if(visible && settings.fit !== false){
      const bounds = new global.maplibregl.LngLatBounds();
      toLngLat(route.concat(access || [])).forEach(point => bounds.extend(point));
      map.fitBounds(bounds, { padding:global.innerWidth < 720 ? 44 : 64, maxZoom:17, duration:420 });
    }
  }

  function metresBetween(first, second){
    if(!Array.isArray(first) || !Array.isArray(second)) return Infinity;
    const [lat1, lng1, lat2, lng2] = [first[0], first[1], second[0], second[1]].map(Number);
    if(![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
    const radians = Math.PI / 180;
    const h = Math.sin((lat2 - lat1) * radians / 2) ** 2 +
      Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin((lng2 - lng1) * radians / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(h));
  }

  // The Layers panel (Map / Satellite / 3D, the network, lifts, fountains,
  // huts and food), then lifts and dog routes once the map is idle: water and
  // hut data are megabytes and load only when their chip is turned on.
  function addOverlays(map, containerId, options){
    const settings = options || {};
    const allLiftMarkers = [];
    const overlayControls = createMapOverlayControls(map, containerId, allLiftMarkers);
    const loadSecondaryMapData = () => {
      const liftMarkers = renderGondolas(map, 'trailmap-gondolas') || [];
      liftMarkers.forEach(marker => allLiftMarkers.push(marker));
      if(overlayControls) overlayControls.sync('lifts');
      if(typeof initializeDogRoutes === 'function') initializeDogRoutes(map, settings.region || emRegion());
    };
    if(global.DoloPawsMapRuntime) global.DoloPawsMapRuntime.onIdle(loadSecondaryMapData, 5000);
    else setTimeout(loadSecondaryMapData, 900);
    if(typeof makeBasemapPoisClickable === 'function') makeBasemapPoisClickable(map);
    return overlayControls;
  }

  global.ORMAExploreMap = Object.freeze({
    NETWORK_MIN_ZOOM:BROWSE_NETWORK_MIN_ZOOM, mapOptions, addChrome, setupBase, addTrailLayers, setSelected, addOverlays,
  });
})(typeof window !== 'undefined' ? window : globalThis);
