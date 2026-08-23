(function(){
  'use strict';
  const api = window.DoloPawsCollections;
  const visual = window.DoloPawsTrailVisual;
  const icons = window.DoloPawsIcons;
  const shell = document.getElementById('collectionDetail');
  if(!api || !visual || !shell || typeof trails === 'undefined') return;

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const id = new URLSearchParams(window.location.search).get('id');
  const collection = api.get(id);
  if(!collection){
    document.title = 'Collection not found | ORMA';
    shell.innerHTML = '<section class="collection-not-found"><h1>Collection not found</h1><p>This collection may have moved or is not available yet.</p><a class="collection-cta" href="collections.html">View all collections</a></section>';
    return;
  }

  const selected = api.trailsFor(collection, trails);
  document.title = `${collection.title} | ORMA collections`;
  const description = document.querySelector('meta[name="description"]');
  if(description) description.content = collection.description;

  function safetyLabel(value){
    return {'low-risk':'Low-risk terrain','moderate':'Moderate terrain','caution':'Caution terrain'}[value] || 'Check details';
  }
  const routeColours = ['#365B43','#C4872F','#557F96','#8A6754','#6D7F3F','#7C668F','#B35F4B','#477B70'];
  function card(trail, index){
    const visualHtml = visual.render(trail, { className:'photo' });
    const facts = [
      Number.isFinite(trail.distance) ? `${trail.distance} km` : null,
      Number.isFinite(trail.elevation) ? `${trail.elevation} m climb` : null,
      trail.hours ? `${trail.hours} h` : null,
    ].filter(Boolean).join(' · ');
    const href = `trail.html?id=${encodeURIComponent(trail.id)}`;
    const safety = safetyLabel(trail.safetyLevel);
    const detailsId = `collection-trail-details-${index + 1}`;
    return `<article class="simple-card collection-trail-card">
      <div class="collection-trail-card__summary">
        <span class="collection-trail-index" style="--route-colour:${routeColours[index % routeColours.length]}" aria-label="Trail ${index + 1}">${index + 1}</span>
        ${visualHtml}
        <div class="collection-trail-card__summary-copy">
          <div class="name">${esc(trail.name)}</div>
          <div class="collection-trail-card__summary-meta">Show trail details</div>
        </div>
        <span class="collection-trail-card__chevron" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg></span>
        <button type="button" class="collection-trail-card__toggle" aria-expanded="false" aria-controls="${detailsId}" data-trail-name="${esc(trail.name)}" aria-label="Show trail details for ${esc(trail.name)}"></button>
      </div>
      <div class="collection-trail-card__details" id="${detailsId}" hidden>
        <div class="simple-card__meta">${esc(facts)}${trail.area ? ` · ${esc(trail.area)}` : ''}</div>
        <div class="simple-card__facts">
          ${icons ? icons.badgeHtml(trail.safetyLevel, safety) : `<span class="simple-card__reason">${esc(safety)}</span>`}
          <span class="simple-card__reason">${esc(trail.valley || collection.regionLabel)}</span>
        </div>
        <div class="simple-card__match">
          <div class="simple-card__score"><strong>${Number.isFinite(trail.distance) ? esc(trail.distance) : '—'}<span>${Number.isFinite(trail.distance) ? ' km' : ''}</span></strong><small>TRAIL IN COLLECTION</small></div>
          <div class="simple-card__match-actions"><a class="collection-list-card__open" href="${href}">View trail →</a></div>
        </div>
      </div>
    </article>`;
  }

  function usablePath(trail){
    return Array.isArray(trail.path) && trail.path.length > 1
      && trail.path.every(point => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
  }
  function startCoordinates(trail){
    if(trail.startPoint && Number.isFinite(Number(trail.startPoint.lat)) && Number.isFinite(Number(trail.startPoint.lng))){
      return [Number(trail.startPoint.lng), Number(trail.startPoint.lat)];
    }
    if(usablePath(trail)) return [Number(trail.path[0][1]), Number(trail.path[0][0])];
    if(Number.isFinite(Number(trail.lng)) && Number.isFinite(Number(trail.lat))) return [Number(trail.lng), Number(trail.lat)];
    return null;
  }
  function routeBounds(maplibre, trail){
    const bounds = new maplibre.LngLatBounds();
    if(usablePath(trail)) trail.path.forEach(([lat, lng]) => bounds.extend([Number(lng), Number(lat)]));
    else {
      const start = startCoordinates(trail);
      if(start) bounds.extend(start);
    }
    return bounds;
  }
  function mapLegend(){
    return selected.map((trail, index) => `<button type="button" class="collection-map-legend__item" data-collection-map-trail="${esc(trail.id)}">
      <span class="collection-map-legend__number" style="--route-colour:${routeColours[index % routeColours.length]}">${index + 1}</span>
      <span><b>${esc(trail.name)}</b><small>${Number.isFinite(trail.distance) ? `${esc(trail.distance)} km` : 'Distance unavailable'}${trail.area ? ` · ${esc(trail.area)}` : ''}</small></span>
    </button>`).join('');
  }
  function trailCorridors(){
    return selected.map(trail => {
      const points = usablePath(trail)
        ? trail.path
        : (startCoordinates(trail) ? [[startCoordinates(trail)[1], startCoordinates(trail)[0]]] : []);
      if(!points.length) return null;
      const lats = points.map(point => Number(point[0]));
      const lngs = points.map(point => Number(point[1]));
      // A collection is a multi-day planning surface, so include useful
      // amenities roughly 3–4 km beyond each route rather than limiting the
      // map to the tighter single-trail corridor.
      const pad = .035;
      return {
        minLat:Math.min(...lats) - pad,
        maxLat:Math.max(...lats) + pad,
        minLng:Math.min(...lngs) - pad,
        maxLng:Math.max(...lngs) + pad,
      };
    }).filter(Boolean);
  }
  const collectionCorridors = trailCorridors();
  function pointNearCollection(feature){
    if(!feature || !feature.geometry || feature.geometry.type !== 'Point') return false;
    const [lng, lat] = feature.geometry.coordinates || [];
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && collectionCorridors.some(box =>
      lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng);
  }
  function curatedPois(kind){
    if(kind === 'food') return [];
    const property = kind === 'water' ? 'waterSources' : 'rifugi';
    const seen = new Set();
    return selected.flatMap(trail => (trail[property] || []).map(point => {
      if(!Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) return null;
      const key = `${Number(point.lat).toFixed(5)}:${Number(point.lng).toFixed(5)}:${kind}`;
      if(seen.has(key)) return null;
      seen.add(key);
      return {
        type:'Feature',
        geometry:{ type:'Point', coordinates:[Number(point.lng), Number(point.lat)] },
        properties:{
          poiType:kind,
          displayName:point.name || point.label || (kind === 'water' ? 'Water point' : 'Rifugio'),
          amenity:kind === 'water' ? 'drinking_water' : '',
          tourism:kind === 'rifugi' ? 'alpine_hut' : '',
          curated:true,
        },
      };
    }).filter(Boolean));
  }
  function normalisePois(kind, osmFeatures){
    const features = curatedPois(kind);
    const seen = new Set(features.map(feature => `${feature.geometry.coordinates[1].toFixed(5)}:${feature.geometry.coordinates[0].toFixed(5)}:${kind}`));
    (osmFeatures || []).filter(pointNearCollection).forEach(feature => {
      const props = feature.properties || {};
      if(kind === 'rifugi' && !(
        props.tourism === 'alpine_hut' || props.tourism === 'wilderness_hut' || props.amenity === 'shelter'
      )) return;
      if(kind === 'food' && !['restaurant','cafe','bar','pub','fast_food','biergarten','ice_cream'].includes(props.amenity)) return;
      const [lng, lat] = feature.geometry.coordinates;
      const key = `${Number(lat).toFixed(5)}:${Number(lng).toFixed(5)}:${kind}`;
      if(seen.has(key)) return;
      seen.add(key);
      features.push({
        type:'Feature',
        geometry:{ type:'Point', coordinates:[Number(lng), Number(lat)] },
        properties:{
          poiType:kind,
          displayName:props.name || (kind === 'water' ? 'Mapped water point' : 'Mapped mountain shelter'),
          elevation:props.ele || '',
          openingHours:props.opening_hours || '',
          phone:props.phone || props['contact:phone'] || '',
          website:props.website || props['contact:website'] || '',
          dog:props.dog || '',
          outdoorSeating:props.outdoor_seating || '',
          amenity:props.amenity || '',
          tourism:props.tourism || '',
          natural:props.natural || '',
          man_made:props.man_made || '',
          curated:false,
        },
      });
    });
    return features;
  }
  function poiPopupHtml(properties){
    const type = properties.poiType === 'water'
      ? 'Water point'
      : (properties.poiType === 'food' ? 'Food and drink' : 'Rifugio or shelter');
    const dogText = properties.dog === 'yes' ? 'Dogs welcome' : (properties.dog === 'leashed' ? 'Dogs on leash' : (properties.dog === 'no' ? 'No dogs' : ''));
    return `<span class="collection-map-popup__type">${esc(type)}</span><b>${esc(properties.displayName || type)}</b>${properties.elevation ? `<br>${esc(properties.elevation)} m elevation` : ''}${properties.openingHours ? `<br>Hours: ${esc(properties.openingHours)}` : ''}${properties.phone ? `<br>Phone: ${esc(properties.phone)}` : ''}${dogText ? `<br>${esc(dogText)}` : ''}${properties.outdoorSeating && properties.outdoorSeating !== 'no' ? '<br>Outdoor seating' : ''}${properties.website && /^https?:\/\//.test(properties.website) ? `<br><a href="${esc(properties.website)}" target="_blank" rel="noopener">Website ↗</a>` : ''}`;
  }
  function addPoiLayers(map, kind, features){
    if(!features.length) return [];
    const sourceId = `collection-${kind}`;
    const iconGroup = kind === 'water' ? 'water' : (kind === 'food' ? 'food' : 'huts');
    const iconMinZoom = icons ? icons.ICON_MIN_ZOOM : 12;
    const colour = kind === 'water' ? '#4F8FA8' : (kind === 'food' ? '#9C4A36' : '#AD7437');
    map.addSource(sourceId, { type:'geojson', data:{ type:'FeatureCollection', features }, cluster:true, clusterRadius:42 });
    const layerIds = [`${sourceId}-cluster`,`${sourceId}-cluster-count`,`${sourceId}-points-lowzoom`,`${sourceId}-points`,`${sourceId}-labels`];
    map.addLayer({ id:layerIds[0], type:'circle', source:sourceId, filter:['has','point_count'], paint:{ 'circle-radius':['step',['get','point_count'],16,5,19,12,23], 'circle-color':colour, 'circle-opacity':.92, 'circle-stroke-width':2, 'circle-stroke-color':'#fff' } });
    const clusterPrefix = kind === 'water' ? 'W ' : (kind === 'food' ? 'F ' : 'R ');
    map.addLayer({ id:layerIds[1], type:'symbol', source:sourceId, filter:['has','point_count'], layout:{ 'text-field':['concat',clusterPrefix,['get','point_count_abbreviated']], 'text-size':9.5, 'text-letter-spacing':.03 }, paint:{ 'text-color':'#fff' } });
    map.addLayer({ id:layerIds[2], type:'circle', source:sourceId, filter:['!',['has','point_count']], maxzoom:iconMinZoom, paint:{ 'circle-radius':7, 'circle-color':icons ? icons.getPoiCircleColorExpression(iconGroup) : colour, 'circle-stroke-width':2.5, 'circle-stroke-color':'#fff' } });
    map.addLayer({ id:layerIds[3], type:'symbol', source:sourceId, filter:['!',['has','point_count']], minzoom:iconMinZoom, layout:{ 'icon-image':icons ? icons.getPoiMapIconExpression(iconGroup) : '', 'icon-size':1 } });
    map.addLayer({ id:layerIds[4], type:'symbol', source:sourceId, filter:['!',['has','point_count']], minzoom:iconMinZoom, layout:{ 'text-field':['get','displayName'], 'text-size':10.5, 'text-offset':[0,1.65], 'text-anchor':'top', 'text-max-width':13 }, paint:{ 'text-color':'#34463A', 'text-halo-color':'rgba(255,255,252,.96)', 'text-halo-width':1.5 } });
    [layerIds[0], layerIds[2], layerIds[3]].forEach(layerId => {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    });
    [layerIds[2], layerIds[3]].forEach(layerId => map.on('click', layerId, event => {
      const feature = event.features && event.features[0];
      if(!feature) return;
      new maplibregl.Popup({ offset:12, maxWidth:'250px' }).setLngLat(feature.geometry.coordinates).setHTML(poiPopupHtml(feature.properties)).addTo(map);
    }));
    map.on('click', layerIds[0], event => {
      const feature = event.features && event.features[0];
      if(!feature) return;
      map.getSource(sourceId).getClusterExpansionZoom(feature.properties.cluster_id)
        .then(zoom => map.easeTo({ center:feature.geometry.coordinates, zoom }))
        .catch(() => {});
    });
    return layerIds;
  }
  function fetchGeoJson(url){
    if(!url) return Promise.resolve([]);
    return fetch(url).then(response => response.ok ? response.json() : null)
      .then(data => data && Array.isArray(data.features) ? data.features : [])
      .catch(() => []);
  }
  function showLayerCount(group, count){
    const counter = document.querySelector(`[data-collection-layer-count="${group}"]`);
    if(counter) counter.textContent = String(count);
  }

  shell.innerHTML = `<section class="collection-detail-hero" style="--collection-cover:url('${esc(collection.coverImage)}')">
      <div class="collection-detail-hero__overlay content-canvas">
        <a class="collection-detail-back" href="collections.html">← All collections</a>
        <div class="collection-detail-kick">${esc(collection.country)} · ${esc(collection.regionLabel)} · ${esc(collection.tripLength)}</div>
        <h1>${esc(collection.title)}</h1>
        <p>${esc(collection.subtitle)}</p>
      </div>
    </section>
    <section class="collection-detail-content content-canvas">
      <div class="collection-detail-intro"><p>${esc(collection.description)}</p>
        <div class="collection-chips">${collection.chips.map(chip => `<span>${esc(chip)}</span>`).join('')}</div>
      </div>
      <section class="collection-map-section" aria-labelledby="collectionMapHeading">
        <div class="collection-map-section__head"><div><span>Collection overview</span><h2 id="collectionMapHeading">See the trails together</h2><p>Use the map to understand where each walk sits, then select a route to focus it.</p></div></div>
        <div class="collection-map-layout">
          <div class="collection-map-canvas-wrap">
            <div class="collection-map-layer-controls" aria-label="Map layers">
              <button type="button" data-collection-layer="hiking" aria-pressed="true"><i class="collection-layer-dot collection-layer-dot--hiking"></i>Marked routes</button>
              <button type="button" data-collection-layer="rifugi" aria-pressed="false"><i class="collection-layer-dot collection-layer-dot--rifugi"></i>Rifugi <em data-collection-layer-count="rifugi"></em></button>
              <button type="button" data-collection-layer="water" aria-pressed="false"><i class="collection-layer-dot collection-layer-dot--water"></i>Water <em data-collection-layer-count="water"></em></button>
              <button type="button" data-collection-layer="food" aria-pressed="false"><i class="collection-layer-dot collection-layer-dot--food"></i>Food &amp; drink <em data-collection-layer-count="food"></em></button>
            </div>
            <div id="collectionTrailMap" class="collection-trail-map" aria-label="Map showing routes, rifugi and water points in ${esc(collection.title)}"><div class="collection-map-loading">Loading trail map…</div></div>
          </div>
          <div class="collection-map-legend" aria-label="Trails on the map">${mapLegend()}</div>
        </div>
      </section>
      <div class="collection-detail-heading"><h2>Trails in this collection</h2><span>${selected.length} shown</span></div>
      <div class="collection-detail-grid">${selected.map(card).join('')}</div>
    </section>`;

  shell.querySelectorAll('.collection-trail-card__toggle').forEach(button => {
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      const details = document.getElementById(button.getAttribute('aria-controls'));
      const cardNode = button.closest('.collection-trail-card');
      const hint = cardNode && cardNode.querySelector('.collection-trail-card__summary-meta');
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} trail details for ${button.dataset.trailName}`);
      if(details) details.hidden = !expanded;
      if(cardNode) cardNode.classList.toggle('is-open', expanded);
      if(hint) hint.textContent = expanded ? 'Hide trail details' : 'Show trail details';
    });
  });

  function initCollectionMap(){
    const mapEl = document.getElementById('collectionTrailMap');
    if(!mapEl || typeof maplibregl === 'undefined') return Promise.resolve(null);
    return new Promise(resolve => {
      const firstStart = selected.map(startCoordinates).find(Boolean) || [11.9, 46.55];
      const map = new maplibregl.Map({
        container: mapEl,
        style:'https://tiles.openfreemap.org/styles/liberty',
        center:firstStart,
        zoom:9,
        scrollZoom:false,
        attributionControl:{ compact:true },
      });
      window._ormaCollectionMap = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right');
      map.on('load', () => {
        const layerGroups = { hiking:['collection-waymarked-hiking-layer'], rifugi:[], water:[], food:[] };
        const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol');
        map.addSource('collection-waymarked-hiking', {
          type:'raster',
          tiles:['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
          tileSize:256,
          attribution:'© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
        });
        map.addLayer({
          id:'collection-waymarked-hiking-layer',
          type:'raster',
          source:'collection-waymarked-hiking',
          paint:{ 'raster-opacity':.38 },
        }, firstLabel ? firstLabel.id : undefined);

        function setLayerVisibility(group, visible){
          (layerGroups[group] || []).forEach(layerId => {
            if(map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
          });
        }
        document.querySelectorAll('[data-collection-layer]').forEach(button => {
          button.addEventListener('click', () => {
            const visible = button.getAttribute('aria-pressed') !== 'true';
            button.setAttribute('aria-pressed', String(visible));
            setLayerVisibility(button.dataset.collectionLayer, visible);
          });
        });

        const features = selected.filter(usablePath).map((trail, index) => ({
          type:'Feature',
          properties:{ id:trail.id, name:trail.name, colour:routeColours[index % routeColours.length] },
          geometry:{ type:'LineString', coordinates:trail.path.map(([lat, lng]) => [Number(lng), Number(lat)]) },
        }));
        map.addSource('collection-routes', { type:'geojson', data:{ type:'FeatureCollection', features } });
        map.addLayer({ id:'collection-routes-casing', type:'line', source:'collection-routes', layout:{ 'line-join':'round', 'line-cap':'round' }, paint:{ 'line-color':'#FFFFFF', 'line-width':7, 'line-opacity':.92 } });
        map.addLayer({ id:'collection-routes-line', type:'line', source:'collection-routes', layout:{ 'line-join':'round', 'line-cap':'round' }, paint:{ 'line-color':['get','colour'], 'line-width':4 } });

        const allBounds = new maplibregl.LngLatBounds();
        selected.forEach((trail, index) => {
          const start = startCoordinates(trail);
          const trailBounds = routeBounds(maplibregl, trail);
          if(!trailBounds.isEmpty()){
            allBounds.extend(trailBounds.getSouthWest());
            allBounds.extend(trailBounds.getNorthEast());
          }
          if(!start) return;
          const markerEl = document.createElement('button');
          markerEl.type = 'button';
          markerEl.className = 'collection-map-marker';
          markerEl.style.setProperty('--route-colour', routeColours[index % routeColours.length]);
          markerEl.textContent = index + 1;
          markerEl.setAttribute('aria-label', `${trail.name}, trail ${index + 1}`);
          new maplibregl.Marker({ element:markerEl })
            .setLngLat(start)
            .setPopup(new maplibregl.Popup({ offset:18, maxWidth:'260px' }).setHTML(`<b>${esc(trail.name)}</b><br>${Number.isFinite(trail.distance) ? `${esc(trail.distance)} km` : ''}${trail.area ? ` · ${esc(trail.area)}` : ''}<br><a href="trail.html?id=${encodeURIComponent(trail.id)}">View trail →</a>`))
            .addTo(map);
        });
        if(!allBounds.isEmpty()) map.fitBounds(allBounds, { padding:56, maxZoom:12 });
        document.querySelectorAll('[data-collection-map-trail]').forEach(button => {
          button.addEventListener('click', () => {
            const trail = selected.find(item => item.id === button.dataset.collectionMapTrail);
            if(!trail) return;
            const bounds = routeBounds(maplibregl, trail);
            if(!bounds.isEmpty()) map.fitBounds(bounds, { padding:72, maxZoom:14 });
          });
        });

        const regionalData = window.DoloPawsRegionalData;
        const hutsUrl = regionalData && regionalData.poiUrl(collection.region, 'huts-bars');
        const waterUrl = regionalData && regionalData.poiUrl(collection.region, 'water');
        const iconReady = icons && icons.registerMapImages ? icons.registerMapImages(map) : Promise.resolve();
        Promise.all([fetchGeoJson(hutsUrl), fetchGeoJson(waterUrl), iconReady]).then(([huts, water]) => {
          const rifugiFeatures = normalisePois('rifugi', huts);
          const waterFeatures = normalisePois('water', water);
          const foodFeatures = normalisePois('food', huts);
          layerGroups.rifugi = addPoiLayers(map, 'rifugi', rifugiFeatures);
          layerGroups.water = addPoiLayers(map, 'water', waterFeatures);
          layerGroups.food = addPoiLayers(map, 'food', foodFeatures);
          showLayerCount('rifugi', rifugiFeatures.length);
          showLayerCount('water', waterFeatures.length);
          showLayerCount('food', foodFeatures.length);
          document.querySelectorAll('[data-collection-layer]').forEach(button => {
            setLayerVisibility(button.dataset.collectionLayer, button.getAttribute('aria-pressed') === 'true');
          });
          resolve(map);
        }).catch(() => resolve(map));
      });
    });
  }

  const mapEl = document.getElementById('collectionTrailMap');
  if(mapEl && window.DoloPawsMapRuntime){
    window.DoloPawsMapRuntime.whenVisible(mapEl, initCollectionMap, { rootMargin:'420px 0px' });
  }
})();
