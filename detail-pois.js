/**
 * detail-pois.js — real nearby POIs on the trail detail map.
 *
 * The homepage map loads the full OSM POI datasets (huts, bars & cafés,
 * drinking water); the trail detail map used to show only the few
 * hand-curated markers stored on the trail itself — so places visible on
 * the homepage "disappeared" when opening a trail. This file loads the
 * same two GeoJSON files, filters them to the trail's surroundings
 * (~2 km beyond the route's bounding box), and shows them by default —
 * on a single-trail page, "what's nearby" shouldn't hide behind a toggle.
 *
 * Also registers the filtered features with basemap-poi-click.js, so
 * clicking the base map's own icons gets the enriched popup here too.
 *
 * Usage: initDetailPois(map, trail) inside trail.js's map 'load' handler.
 * Include in trail.html BEFORE trail.js.
 */

function initDetailPois(map, trail){
  if (!trail || typeof trail.lat !== 'number' || typeof trail.lng !== 'number') return;
  const icons = window.DoloPawsIcons;
  const iconMinZoom = icons ? icons.ICON_MIN_ZOOM : 12;
  const trailRegion = trail.region || (window.DoloPawsRegionalData
    && window.DoloPawsRegionalData.regionForTrail(trail.id)) || 'dolomites';
  const regionalPoiUrl = kind => window.DoloPawsRegionalData
    ? window.DoloPawsRegionalData.poiUrl(trailRegion, kind)
    : (kind === 'water' ? './water-sources-all-regions.geojson' : './huts-bars-all-regions.geojson');

  // Bounding box of the route (or trailhead) plus ~2 km padding.
  let minLat = trail.lat, maxLat = trail.lat, minLng = trail.lng, maxLng = trail.lng;
  (trail.path || []).forEach(p => {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  });
  const PAD = 0.02;
  minLat -= PAD; maxLat += PAD; minLng -= PAD; maxLng += PAD;

  const inBox = f => {
    const g = f.geometry;
    if (!g || g.type !== 'Point') return false;
    const [lng, lat] = g.coordinates;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  };

  const esc = (typeof trEsc === 'function') ? trEsc
    : s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Every popup states IN WORDS what the place is — an icon plus an
  // elevation is a riddle, not information.
  function tt(key, fallback){
    if(!window.t) return fallback;
    const v = window.t(key);
    return v === key ? fallback : v;
  }
  function poiPopupHtml(props){
    // Place type: icon-system SVG (same visual language as the page chrome)
    // plus a plain-text label — no emoji.
    let typeLabel = tt('poi.place', 'Point of interest'), iconKey = null;
    if (props.tourism === 'alpine_hut') { typeLabel = tt('legend.hut', 'Mountain hut'); iconKey = 'hut'; }
    else if (props.tourism === 'wilderness_hut') { typeLabel = tt('poi.wildhut', 'Wilderness hut'); iconKey = 'hut'; }
    else if (props.amenity === 'shelter') { typeLabel = tt('poi.shelter', 'Shelter'); iconKey = 'hut'; }
    else if (props.amenity === 'bar') { typeLabel = 'Bar'; iconKey = 'food'; }
    else if (props.amenity === 'pub') { typeLabel = 'Pub'; iconKey = 'food'; }
    else if (props.amenity === 'cafe') { typeLabel = 'Café'; iconKey = 'food'; }
    else if (props.amenity === 'restaurant') { typeLabel = tt('poi.restaurant', 'Restaurant'); iconKey = 'food'; }
    else if (props.amenity === 'fast_food') { typeLabel = tt('poi.fastfood', 'Snack bar'); iconKey = 'food'; }
    else if (props.amenity === 'drinking_water' || props.amenity === 'water_point') { typeLabel = tt('legend.water', 'Drinking water'); iconKey = 'water'; }
    else if (props.natural === 'spring') { typeLabel = tt('poi.spring', 'Spring'); iconKey = 'water'; }
    else if (props.amenity === 'fountain') { typeLabel = tt('poi.fountain', 'Fountain'); iconKey = 'water'; }
    else if (props.amenity === 'toilets') { typeLabel = tt('poi.toilets', 'Public toilets'); iconKey = 'toilets'; }
    else if (props.man_made === 'water_tap') { typeLabel = tt('poi.tap', 'Water tap'); iconKey = 'water'; }
    else if (props.tourism === 'viewpoint') { typeLabel = tt('poi.viewpoint', 'Viewpoint'); iconKey = 'camera'; }
    else if (props.tourism === 'picnic_site' || props.leisure === 'picnic_table' || props.amenity === 'bbq') { typeLabel = tt('poi.picnic', 'Picnic spot'); iconKey = 'picnic'; }
    else if (props.tourism === 'museum') { typeLabel = tt('poi.museum', 'Museum'); iconKey = 'sight'; }
    else if (props.tourism === 'artwork') { typeLabel = tt('poi.artwork', 'Artwork'); iconKey = 'sight'; }
    else if (props.tourism === 'attraction') { typeLabel = tt('poi.attraction', 'Attraction'); iconKey = 'sight'; }
    else if (props.tourism === 'information') { typeLabel = tt('poi.info', 'Visitor information'); iconKey = 'information'; }
    else if (props.historic) { typeLabel = tt('poi.historic', 'Historic site'); iconKey = 'sight'; }
    const typeIcon = (iconKey && icons && icons.renderIconSvg)
      ? `<span style="display:inline-block;vertical-align:-2px;margin-right:3px;">${icons.renderIconSvg(iconKey, { mode: 'inline', color: 'currentColor', size: 13 })}</span>`
      : '';
    let html = `<div class="dp-poi-popup"><span class="dp-poi-type">${typeIcon}${esc(typeLabel)}</span>`;
    if (props.name) html += `<strong class="dp-poi-name">${esc(props.name)}</strong>`;
    if (props.ele) html += `<span>${esc(props.ele)} m elevation</span>`;
    if (props.opening_hours) html += `<span>Hours: ${esc(props.opening_hours)}</span>`;
    const phone = props.phone || props['contact:phone'];
    if (phone) html += `<span>Phone: ${esc(phone)}</span>`;
    const site = props.website || props['contact:website'];
    if (site && /^https?:\/\//.test(site)) html += `<a href="${esc(site)}" target="_blank" rel="noopener">Website</a>`;
    if (props.dog === 'yes') html += `<span class="dp-poi-dog">Dogs welcome</span>`;
    else if (props.dog === 'leashed') html += `<span class="dp-poi-dog">Dogs on leash</span>`;
    else if (props.dog === 'no') html += `<span class="dp-poi-dog">No dogs</span>`;
    if (props.outdoor_seating && props.outdoor_seating !== 'no') html += `<span>Outdoor seating</span>`;
    return html + '</div>';
  }

  function addPoiLayerSet(sourceId, features, group){
    if (!features.length || map.getSource(sourceId)) return;
    const circleColor = icons ? icons.getPoiCircleColorExpression(group) : '#5A5548';
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });
    map.addLayer({
      id: sourceId + '-layer-lowzoom',
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      maxzoom: iconMinZoom,
      layout: { visibility: 'visible' },
      paint: {
        'circle-radius': 5.5,
        'circle-color': circleColor,
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: sourceId + '-layer',
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      minzoom: iconMinZoom,
      layout: {
        visibility: 'visible',
        'icon-image': icons ? icons.getPoiMapIconExpression(group) : '',
        'icon-size': 1,
        'icon-padding': 4,
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 1.25],
        'text-max-width': 12,
        'text-optional': true,
      },
      paint: {
        'text-color': '#243128',
        'text-halo-color': 'rgba(255,255,255,.96)',
        'text-halo-width': 2,
      },
    });
    [sourceId + '-layer', sourceId + '-layer-lowzoom'].forEach((layerId) => {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    });
    [sourceId + '-layer', sourceId + '-layer-lowzoom'].forEach((layerId) => map.on('click', layerId, (e) => {
      const f = e.features[0];
      new maplibregl.Popup({ offset: 10, maxWidth: '220px' })
        .setLngLat(f.geometry.coordinates)
        .setHTML(poiPopupHtml(f.properties))
        .addTo(map);
    }));
  }

  // Features already drawn by the huts/bars/water layers, so the corridor
  // amenities file (which overlaps them) only contributes NEW places.
  const drawnIds = new Set();
  const noteDrawn = features => features.forEach(f => {
    const id = f.properties && f.properties['@id'];
    if (id) drawnIds.add(id);
  });

  // Huts + food & drink (same file the homepage uses; browser-cached)
  const hutsBarsLoad = fetch(regionalPoiUrl('huts-bars'))
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      const near = (data.features || []).filter(inBox);
      if (!near.length) return;
      noteDrawn(near);
      const isHut = p => p && (p.tourism === 'alpine_hut' || p.tourism === 'wilderness_hut' || p.amenity === 'shelter');
      const huts = near.filter(f => isHut(f.properties));
      const bars = near.filter(f => !isHut(f.properties));
      addPoiLayerSet('detail-huts', huts, 'huts');
      addPoiLayerSet('detail-bars', bars, 'food');
      // Feed the base-map click enrichment on this page too.
      if (typeof registerPoiFeatures === 'function') registerPoiFeatures(near);
      if (typeof window.onDetailPoisReady === 'function'){
        try { window.onDetailPoisReady(near); } catch (e) {}
      }
    })
    .catch(() => { /* nearby POIs are a bonus — never break the page */ });

  // Drinking water
  const waterLoad = fetch(regionalPoiUrl('water'))
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      const near = (data.features || []).filter(inBox);
      noteDrawn(near);
      if (typeof window.onDetailWaterReady === 'function'){
        try { window.onDetailWaterReady(near); } catch (e) {}
      }
      addPoiLayerSet('detail-water', near, 'water');
    })
    .catch(() => {});

  // Viewpoints, picnic spots, selected sights and toilets from the trail-corridor
  // amenity sweep (data/trail-amenities/). Waits for the two layers above so
  // anything they already drew is skipped rather than doubled.
  const PLACE_KINDS = ['viewpoint', 'picnic', 'sight', 'toilets', 'information'];
  Promise.allSettled([hutsBarsLoad, waterLoad])
    .then(() => fetch('data/trail-amenities/' + trailRegion + '-amenities.geojson'))
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      const near = (data.features || []).filter(f =>
        inBox(f) &&
        PLACE_KINDS.includes(f.properties && f.properties.kind) &&
        !(f.properties && f.properties.kind === 'sight' && f.properties.historic) &&
        !drawnIds.has(f.properties['@id']));
      if (!near.length) return;
      addPoiLayerSet('detail-places', near, 'places');
      if (typeof registerPoiFeatures === 'function') registerPoiFeatures(near);
      if (typeof window.onDetailPlacesReady === 'function'){
        try { window.onDetailPlacesReady(near); } catch (e) {}
      }
    })
    .catch(() => {});
}
