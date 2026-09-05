(function(){
  'use strict';

  // Zoom at which the marked hiking network stops being clutter and starts
  // being wayfinding. Shared with the trail detail map.
  const NETWORK_MIN_ZOOM = 13.5;
  const api = window.DoloPawsCollections;
  const grid = document.getElementById('collectionsGrid');
  if(!api || !grid || typeof trails === 'undefined') return;
  if(window.DoloPawsRegions) window.DoloPawsRegions.assign(trails);
  const countrySelect = document.getElementById('collectionCountrySelect');
  const regionSelect = document.getElementById('collectionRegionSelect');
  const valleySelect = document.getElementById('collectionValleySelect');
  const countryDropdown = window.OrmaAreaDropdown.enhance(countrySelect);
  const regionDropdown = window.OrmaAreaDropdown.enhance(regionSelect);
  const valleyDropdown = window.OrmaAreaDropdown.enhance(valleySelect);
  const resultCount = document.getElementById('collectionResultCount');
  const clear = document.getElementById('collectionFiltersClear');
  const search = document.getElementById('collectionSearch');
  const themeButtons = Array.from(document.querySelectorAll('[data-collection-theme]'));

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const trailHref = trail => `trail.html?id=${encodeURIComponent(trail.id)}&from=collections.html`;
  let country = 'all';
  let region = 'all';
  let valley = 'all';
  let query = '';
  const requestedCollectionId = new URLSearchParams(window.location.search).get('collection');
  let expandedCollectionId = api.get(requestedCollectionId) ? requestedCollectionId : null;
  let expandedCollectionView = new URLSearchParams(window.location.search).get('view') === 'map' ? 'map' : 'trails';
  let activeMap = null;
  let renderGeneration = 0;
  const themes = new Set();
  const difficultyLabel = value => ({
    'low-risk':'Low-risk terrain',
    moderate:'Moderate terrain',
    caution:'Caution terrain',
  })[value] || 'Difficulty not rated';
  // Route colour answers "how well does this walk suit the dog", never "how
  // hard is this trail", the same question, palette and thresholds as the
  // homepage and trail detail maps. This replaces a third near-identical
  // green/amber/red keyed on safetyLevel, which read as a match tier on a page
  // that showed no scores at all.
  //
  // Before anyone adds a dog we score against the medium-dog guest profile the
  // site already tells visitors about, rather than switching to a different
  // meaning when signed out.
  // Scored against the signed-in dog when there is one, and the medium-dog
  // guest profile otherwise. Colouring everyone by the guest profile would
  // leave this map answering "does this suit a generic dog" while every other
  // ORMA surface answers "does this suit yours", the same defect, one layer
  // down, that this palette clean-up existed to remove.
  let matchSubject = null;                    // null until a dog profile resolves
  const repaintOnSubjectChange = new Set();

  function trailMatchScore(trail){
    const scoring = window.DoloPawsScoring;
    if(!scoring || typeof scoring.scoreTrail !== 'function') return null;
    try{ return scoring.scoreTrail(trail, matchSubject || scoring.GUEST_SUBJECT); }
    catch(error){ return null; }
  }
  function matchColour(trail){
    return window.ORMAMapStyle
      ? window.ORMAMapStyle.matchColour(trailMatchScore(trail))
      : '#6B796F';
  }

  // Auth resolves after first paint, so a map drawn with the guest profile has
  // to recolour rather than stay wrong for the rest of the session.
  function resolveMatchSubject(){
    const auth = window.DoloPawsAuth;
    if(!auth || !auth.currentUser || typeof auth.getDogProfile !== 'function') return;
    auth.getDogProfile().then(profile => {
      if(!profile) return;
      const next = typeof effectiveOverrides === 'function'
        ? effectiveOverrides(profile, null) : profile;
      matchSubject = next;
      repaintOnSubjectChange.forEach(repaint => { try{ repaint(); }catch(error){} });
    }).catch(() => {});
  }
  resolveMatchSubject();
  window.addEventListener('dolopaws-auth-changed', resolveMatchSubject);

  const COUNTRIES = [
    { value:'all', label:'All countries' },
    { value:'IT', label:'Italy' },
    { value:'FR', label:'France' },
  ];
  const REGIONS = [
    { value:'all', label:'All regions', countryCode:'all' },
    { value:'dolomites', label:'Dolomites', countryCode:'IT' },
    { value:'savoy', label:'Savoy', countryCode:'FR' },
  ];

  const THEME_MATCHERS = {
    gentle: collection => /gentler|short|flat|modest|easier/i.test(`${collection.id} ${collection.title} ${collection.subtitle}`),
    summer: collection => /hot-day|warmer|shade|water|woodland/i.test(`${collection.id} ${collection.title} ${collection.subtitle} ${collection.chips.join(' ')}`),
    scenic: collection => /lake|lakeside|woodland|scenery|high-level/i.test(`${collection.id} ${collection.title} ${collection.subtitle} ${collection.chips.join(' ')}`),
  };
  const trailsFor = collection => api.trailsFor(collection, trails);
  const trailInArea = trail => (country === 'all' || (country === 'IT' ? trail.region === 'dolomites' : trail.region === 'savoy'))
    && (region === 'all' || trail.region === region);
  const collectionInValley = collection => valley === 'all'
    || trailsFor(collection).some(trail => trail.valley === valley);
  function matches(collection){
    const searchable = `${collection.title} ${collection.subtitle} ${collection.description} ${collection.regionLabel} ${collection.country} ${collection.chips.join(' ')}`.toLowerCase();
    return (country === 'all' || collection.countryCode === country)
      && (region === 'all' || collection.region === region)
      && collectionInValley(collection)
      && (!query || searchable.includes(query))
      && (!themes.size || Array.from(themes).some(theme => THEME_MATCHERS[theme](collection)));
  }
  function countForCountry(value){
    return api.all().filter(item => value === 'all' || item.countryCode === value).length;
  }
  function countForRegion(value){
    return api.all().filter(item => (country === 'all' || item.countryCode === country)
      && (value === 'all' || item.region === value)).length;
  }
  function option(item, count){
    const el = document.createElement('option');
    el.value = item.value;
    el.textContent = `${item.label} (${count})`;
    return el;
  }
  function compactAreaTrigger(select){
    const label = select && select.closest('.area-select-shell')?.querySelector('.area-select-trigger__label');
    const selected = select && select.options[select.selectedIndex];
    if(label && selected) label.textContent = selected.textContent.replace(/\s+\(\d+\)$/, '');
  }
  function valleyEntries(){
    const counts = new Map();
    trails.filter(trailInArea).forEach(trail => {
      if(!trail.valley) return;
      const collections = api.all().filter(collection => trailsFor(collection).some(item => item.id === trail.id));
      if(collections.length) counts.set(trail.valley, new Set([
        ...(counts.get(trail.valley) || []),
        ...collections.map(collection => collection.id),
      ]));
    });
    return [...counts.entries()]
      .map(([name, ids]) => [name, ids.size])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function renderAreaFilters(){
    countrySelect.replaceChildren(...COUNTRIES.map(item => option(item, countForCountry(item.value))));
    countrySelect.value = country;
    countryDropdown.refresh();
    compactAreaTrigger(countrySelect);
    const availableRegions = REGIONS.filter(item => item.value === 'all'
      || country === 'all' || item.countryCode === country);
    regionSelect.replaceChildren(...availableRegions.map(item => option(item, countForRegion(item.value))));
    regionSelect.value = region;
    regionDropdown.refresh();
    compactAreaTrigger(regionSelect);
    const valleys = valleyEntries();
    if(valley !== 'all' && !valleys.some(([name]) => name === valley)) valley = 'all';
    const areaCollectionCount = api.all().filter(collection => (country === 'all' || collection.countryCode === country)
      && (region === 'all' || collection.region === region)).length;
    valleySelect.replaceChildren(
      option({ value:'all', label:'All valleys' }, areaCollectionCount),
      ...valleys.map(([name, count]) => option({ value:name, label:name }, count)),
    );
    valleySelect.value = valley;
    valleyDropdown.refresh();
    compactAreaTrigger(valleySelect);
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
  function destroyActiveMap(){
    if(activeMap){
      activeMap.remove();
      activeMap = null;
      // Repaints close over the map that is going away.
      repaintOnSubjectChange.clear();
    }
  }
  function updateCollectionUrl(collectionId, mode = 'push', view = expandedCollectionView){
    const url = new URL(window.location.href);
    if(collectionId){
      url.searchParams.set('collection', collectionId);
      if(view === 'map') url.searchParams.set('view', 'map');
      else url.searchParams.delete('view');
    }else{
      url.searchParams.delete('collection');
      url.searchParams.delete('view');
    }
    window.history[mode === 'replace' ? 'replaceState' : 'pushState']({ collection:collectionId }, '', url);
  }
  // Focus emphasis has to keep the zoom ramp: setting a flat pixel width here
  // would snap the corridor back to a hairline the moment a trail is picked.
  const CORRIDOR_WIDTH = ['interpolate',['linear'],['zoom'],7,4.5,10,9,13,14,16,19];
  const CORRIDOR_WIDTH_FOCUS = ['interpolate',['linear'],['zoom'],7,6,10,12,13,18,16,24];
  const CORRIDOR_OPACITY = .62;
  function focusMapTrail(map, trailId){
    if(!map || !map.getLayer('collection-inline-routes-line')) return;
    map.setPaintProperty('collection-inline-routes-line', 'line-width',
      ['case',['==',['get','id'],trailId], CORRIDOR_WIDTH_FOCUS, CORRIDOR_WIDTH]);
    map.setPaintProperty('collection-inline-routes-line', 'line-opacity',
      ['case',['==',['get','id'],trailId], .78, .3]);
  }
  function clearMapTrailFocus(map){
    if(!map || !map.getLayer('collection-inline-routes-line')) return;
    map.setPaintProperty('collection-inline-routes-line', 'line-width', CORRIDOR_WIDTH);
    map.setPaintProperty('collection-inline-routes-line', 'line-opacity', CORRIDOR_OPACITY);
  }
  function mapTrailCardHtml(trail, index){
    const difficulty = ['low-risk','moderate','caution'].includes(trail.safetyLevel) ? trail.safetyLevel : 'unknown';
    const meta = [
      difficultyLabel(trail.safetyLevel),
      Number.isFinite(trail.distance) ? `${trail.distance} km` : null,
      trail.valley || trail.area || null,
    ].filter(Boolean).join(' · ');
    return `<a class="collection-map-trail-card" href="${trailHref(trail)}">
      <span class="collection-map-trail-card__index" data-difficulty="${difficulty}">${index + 1}</span>
      <span class="collection-map-trail-card__copy"><strong>${esc(trail.name)}</strong><small>${esc(meta)}</small></span>
      <span class="collection-map-trail-card__arrow" aria-hidden="true">→</span>
    </a>`;
  }
  function initCollectionMap(collection, collectionTrails, generation){
    const mapEl = document.getElementById(`collection-inline-map-${collection.id}`);
    if(!mapEl || !window.DoloPawsMapRuntime) return;
    window.DoloPawsMapRuntime.whenVisible(mapEl, () => {
      if(generation !== renderGeneration || !document.body.contains(mapEl) || typeof maplibregl === 'undefined') return null;
      const firstStart = collectionTrails.map(startCoordinates).find(Boolean) || [11.9,46.55];
      const map = new maplibregl.Map({
        container:mapEl,
        style:'https://tiles.openfreemap.org/styles/liberty',
        center:firstStart,
        zoom:9,
        scrollZoom:false,
        attributionControl:false,
      });
      activeMap = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact:true }), 'bottom-right');
      map.on('load', () => {
        if(generation !== renderGeneration) return;
        const attribution = mapEl.querySelector('.maplibregl-ctrl-attrib');
        if(attribution){
          attribution.classList.add('maplibregl-compact');
          attribution.classList.remove('maplibregl-compact-show');
          attribution.querySelector('button')?.setAttribute('aria-expanded', 'false');
        }
        const features = collectionTrails.filter(usablePath).map(trail => ({
          type:'Feature',
          properties:{ id:trail.id, name:trail.name, colour:matchColour(trail) },
          geometry:{ type:'LineString', coordinates:trail.path.map(([lat,lng]) => [Number(lng),Number(lat)]) },
        }));
        // Same cartography as every other ORMA map: the marked hiking network
        // in its own colours, a quietened base, and each collection route as a
        // cased corridor UNDERNEATH the raster so the marked path and its real
        // numbers read down the middle. This map previously had no hiking
        // network at all.
        const style = window.ORMAMapStyle;
        if(style) style.quietBasemap(map);
        const beneath = style ? style.addWaymarkedHiking(map, {
            beforeId: style.firstLabelLayerId(map),
            // This map opens at zoom 9 to frame a whole collection, and has no
            // layers control. Holding the network back until you zoom in keeps
            // the browse view calm without hiding anything behind a control
            // that does not exist here, zooming in is the affordance.
            minzoom: NETWORK_MIN_ZOOM,
          }) : undefined;
        const mapMarkerElements = [];
        map.addSource('collection-inline-routes', { type:'geojson', data:{ type:'FeatureCollection', features } });
        // If the dog profile lands after this map is drawn, restyle it in place
        // rather than leaving it coloured for a generic dog all session. Cleared
        // with the map in resetActiveMap().
        const repaintMatchColours = () => {
          const source = map.getSource('collection-inline-routes');
          if(source){
            source.setData({
              type:'FeatureCollection',
              features: features.map(feature => ({
                ...feature,
                properties:{ ...feature.properties, colour: matchColour(trailsByFeatureId.get(feature.properties.id)) },
              })),
            });
          }
          mapMarkerElements.forEach(({ element, trail }) => {
            element.style.setProperty('--route-colour', matchColour(trail));
          });
        };
        repaintOnSubjectChange.add(repaintMatchColours);
        map.addLayer({ id:'collection-inline-routes-hit', type:'line', source:'collection-inline-routes', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':'#000000','line-width':22,'line-opacity':0 } }, beneath);
        map.addLayer({ id:'collection-inline-routes-casing', type:'line', source:'collection-inline-routes', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':'#FFFFFF','line-opacity':.9,'line-width':['interpolate',['linear'],['zoom'],7,7,10,13,13,19,16,25] } }, beneath);
        // A touch more opaque than a single-route map: several coloured
        // corridors share this view and must stay distinguishable.
        map.addLayer({ id:'collection-inline-routes-line', type:'line', source:'collection-inline-routes', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':['get','colour'],'line-opacity':CORRIDOR_OPACITY,'line-width':CORRIDOR_WIDTH } }, beneath);
        const trailsById = new Map(collectionTrails.map((trail,index) => [trail.id,{ trail,index }]));
          const trailsByFeatureId = new Map(collectionTrails.map(trail => [trail.id, trail]));
        map.on('mouseenter', 'collection-inline-routes-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'collection-inline-routes-hit', () => { map.getCanvas().style.cursor = ''; });
        map.on('click', 'collection-inline-routes-hit', event => {
          const feature = event.features && event.features[0];
          const match = feature && trailsById.get(feature.properties.id);
          if(!match) return;
          focusMapTrail(map, match.trail.id);
          new maplibregl.Popup({ offset:12, maxWidth:'310px', className:'collection-map-trail-popup' })
            .setLngLat(event.lngLat)
            .setHTML(mapTrailCardHtml(match.trail, match.index))
            .addTo(map);
        });
        const allBounds = new maplibregl.LngLatBounds();
        collectionTrails.forEach((trail,index) => {
          const bounds = routeBounds(maplibregl, trail);
          if(!bounds.isEmpty()){
            allBounds.extend(bounds.getSouthWest());
            allBounds.extend(bounds.getNorthEast());
          }
          const start = startCoordinates(trail);
          if(!start) return;
          const marker = document.createElement('button');
          marker.type = 'button';
          marker.className = 'collection-map-marker';
          marker.style.setProperty('--route-colour', matchColour(trail));
          mapMarkerElements.push({ element:marker, trail });
          marker.textContent = index + 1;
          marker.setAttribute('aria-label', `${trail.name}, ${difficultyLabel(trail.safetyLevel)}`);
          marker.addEventListener('click', () => focusMapTrail(map, trail.id));
          new maplibregl.Marker({ element:marker })
            .setLngLat(start)
            .setPopup(new maplibregl.Popup({ offset:18, maxWidth:'310px', className:'collection-map-trail-popup' }).setHTML(mapTrailCardHtml(trail,index)))
            .addTo(map);
        });
        if(!allBounds.isEmpty()) map.fitBounds(allBounds, { padding:48, maxZoom:12 });
        document.querySelectorAll(`[data-collection-card="${collection.id}"] [data-inline-map-trail]`).forEach(link => {
          link.addEventListener('mouseenter', () => focusMapTrail(map, link.dataset.inlineMapTrail));
          link.addEventListener('focus', () => focusMapTrail(map, link.dataset.inlineMapTrail));
          link.addEventListener('mouseleave', () => clearMapTrailFocus(map));
          link.addEventListener('blur', () => clearMapTrailFocus(map));
        });
      });
      return map;
    }, { rootMargin:'260px 0px' });
  }
  function trailRow(trail, index){
    const difficulty = ['low-risk','moderate','caution'].includes(trail.safetyLevel) ? trail.safetyLevel : 'unknown';
    const meta = [
      difficultyLabel(trail.safetyLevel),
      Number.isFinite(trail.distance) ? `${trail.distance} km` : null,
      trail.valley || trail.area || null,
    ].filter(Boolean).join(' · ');
    return `<a class="collection-inline-trail" href="${trailHref(trail)}" data-inline-map-trail="${esc(trail.id)}">
      <span class="collection-inline-trail__index" data-difficulty="${difficulty}" aria-label="Trail ${index + 1}: ${esc(difficultyLabel(trail.safetyLevel))}">${index + 1}</span>
      <span class="collection-inline-trail__copy">
        <strong>${esc(trail.name)}</strong>
        ${meta ? `<small>${esc(meta)}</small>` : ''}
      </span>
      <span class="collection-inline-trail__arrow" aria-hidden="true">→</span>
    </a>`;
  }
  function card(collection){
    const collectionTrails = trailsFor(collection);
    const count = collectionTrails.length;
    const isOpen = expandedCollectionId === collection.id;
    const detailsId = `collection-inline-details-${collection.id}`;
    return `<article class="simple-card collection-list-card${isOpen ? ' is-open' : ''}" data-collection-card="${esc(collection.id)}">
      <div class="photo collection-list-card__photo" style="background-image:url('${esc(collection.coverImage)}')" aria-hidden="true"></div>
      <div class="simple-card__main">
        <div class="name">${esc(collection.title)}</div>
        <div class="simple-card__meta">${esc(collection.regionLabel)} · ${esc(collection.country)} · ${count} ${count === 1 ? 'trail' : 'trails'}</div>
      </div>
      <p class="collection-list-card__summary">${esc(collection.subtitle)}</p>
      <div class="simple-card__match collection-list-card__scope">
        <button type="button" class="collection-list-card__expand" data-collection-expand="${esc(collection.id)}" aria-expanded="${isOpen}" aria-controls="${detailsId}">
          <span>${isOpen && expandedCollectionView === 'trails' ? 'Hide trails' : 'Show trails'}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg>
        </button>
        <button type="button" class="collection-list-card__map-action" data-collection-map-open="${esc(collection.id)}" aria-expanded="${isOpen && expandedCollectionView === 'map'}" aria-controls="collection-inline-map-wrap-${esc(collection.id)}">
          <span>${isOpen && expandedCollectionView === 'map' ? 'Hide map' : 'Show map'}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.2 8 3l4 2 4.5-2.2v12L12 17l-4-2-4.5 2.2zM8 3v12M12 5v12"/></svg>
        </button>
      </div>
      <div class="collection-list-card__details" id="${detailsId}"${isOpen ? '' : ' hidden'}>
        ${isOpen ? `
        <div class="collection-list-card__details-head">
          <span>${expandedCollectionView === 'map' ? 'Select a numbered route or marker to preview its trail.' : 'Choose a trail to open its full details.'}</span>
        </div>
        <div class="collection-inline-workspace" data-collection-view="${expandedCollectionView}">
          ${expandedCollectionView === 'trails' ? `<div class="collection-inline-trails">${collectionTrails.map(trailRow).join('')}</div>` : ''}
          ${expandedCollectionView === 'map' ? `<div class="collection-inline-map-wrap is-visible" id="collection-inline-map-wrap-${esc(collection.id)}">
            <div id="collection-inline-map-${esc(collection.id)}" class="collection-trail-map collection-inline-map" aria-label="Map showing the trails in ${esc(collection.title)}"><div class="collection-map-loading">Loading collection map…</div></div>
            <div class="collection-inline-map-key" aria-label="Difficulty colours"><span><i data-difficulty="low-risk"></i>Low-risk</span><span><i data-difficulty="moderate"></i>Moderate</span><span><i data-difficulty="caution"></i>Caution</span></div>
          </div>` : ''}
        </div>
        ` : ''}
      </div>
    </article>`;
  }
  function render(){
    destroyActiveMap();
    renderGeneration += 1;
    const generation = renderGeneration;
    renderAreaFilters();
    const filtered = api.all().filter(matches);
    if(expandedCollectionId && !filtered.some(collection => collection.id === expandedCollectionId)){
      expandedCollectionId = null;
      updateCollectionUrl(null, 'replace');
    }
    grid.innerHTML = filtered.map(card).join('');
    resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'collection' : 'collections'}`;
    themeButtons.forEach(button => button.setAttribute('aria-pressed', String(themes.has(button.dataset.collectionTheme))));
    clear.hidden = country === 'all' && region === 'all' && valley === 'all' && !query && themes.size === 0;
    if(expandedCollectionId && expandedCollectionView === 'map'){
      const collection = api.get(expandedCollectionId);
      if(collection) initCollectionMap(collection, trailsFor(collection), generation);
    }
  }
  countrySelect.addEventListener('change', () => {
    country = countrySelect.value;
    const selectedRegion = REGIONS.find(item => item.value === region);
    if(selectedRegion && selectedRegion.countryCode !== 'all' && selectedRegion.countryCode !== country) region = 'all';
    valley = 'all';
    render();
  });
  regionSelect.addEventListener('change', () => {
    region = regionSelect.value;
    const selectedRegion = REGIONS.find(item => item.value === region);
    if(selectedRegion && selectedRegion.countryCode !== 'all') country = selectedRegion.countryCode;
    valley = 'all';
    render();
  });
  valleySelect.addEventListener('change', () => { valley = valleySelect.value; render(); });
  themeButtons.forEach(button => button.addEventListener('click', () => {
    const theme = button.dataset.collectionTheme;
    if(themes.has(theme)) themes.delete(theme); else themes.add(theme);
    render();
  }));
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-collection-expand]');
    if(button){
      const collectionId = button.dataset.collectionExpand;
      const shouldClose = expandedCollectionId === collectionId && expandedCollectionView === 'trails';
      expandedCollectionId = shouldClose ? null : collectionId;
      expandedCollectionView = 'trails';
      updateCollectionUrl(expandedCollectionId);
      render();
      return;
    }
    const mapButton = event.target.closest('[data-collection-map-open]');
    if(!mapButton) return;
    const collectionId = mapButton.dataset.collectionMapOpen;
    const shouldClose = expandedCollectionId === collectionId && expandedCollectionView === 'map';
    expandedCollectionId = shouldClose ? null : collectionId;
    expandedCollectionView = 'map';
    updateCollectionUrl(expandedCollectionId);
    render();
    if(expandedCollectionId) window.requestAnimationFrame(() => document.getElementById(mapButton.getAttribute('aria-controls'))?.scrollIntoView({ block:'nearest' }));
  });
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
    expandedCollectionId = api.get(collectionId) ? collectionId : null;
    expandedCollectionView = params.get('view') === 'map' ? 'map' : 'trails';
    render();
  });
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render(); });
  clear.addEventListener('click', () => {
    country = 'all'; region = 'all'; valley = 'all'; query = ''; themes.clear(); search.value = ''; render();
  });
  render();
  if(expandedCollectionId){
    window.requestAnimationFrame(() => document.querySelector(`[data-collection-card="${expandedCollectionId}"]`)?.scrollIntoView({ block:'start' }));
  }
})();
