(function(root){
  'use strict';

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[character]);
  }

  function coordinateFor(trail){
    if(!trail) return null;
    const start = trail.startPoint || {};
    const startLat = start.lat == null ? NaN : Number(start.lat);
    const startLng = start.lng == null ? NaN : Number(start.lng);
    const lat = Number.isFinite(startLat) ? startLat : (trail.lat == null ? NaN : Number(trail.lat));
    const lng = Number.isFinite(startLng) ? startLng : (trail.lng == null ? NaN : Number(trail.lng));
    if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if(lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lng, lat];
  }

  function withinBounds(trail, bounds){
    if(!bounds) return true;
    const coordinate = coordinateFor(trail);
    if(!coordinate) return false;
    const [lng, lat] = coordinate;
    const withinLng = bounds.west <= bounds.east
      ? lng >= bounds.west && lng <= bounds.east
      : lng >= bounds.west || lng <= bounds.east;
    return withinLng && lat >= bounds.south && lat <= bounds.north;
  }

  function trailFeature(trail){
    const coordinate = coordinateFor(trail);
    if(!coordinate) return null;
    return {
      type:'Feature',
      geometry:{ type:'Point', coordinates:coordinate },
      properties:{
        id:String(trail.id || ''),
        name:String(trail.name || 'Trail'),
        area:String(trail.area || trail.valley || ''),
        distance:Number(trail.distance) || 0,
        hours:Number(trail.hours) || 0,
        risk:String(trail.safetyLevel || 'moderate'),
      },
    };
  }

  function create(options){
    const settings = options || {};
    const container = document.getElementById(settings.containerId || 'browseMap');
    if(!container) return null;

    const searchAreaButton = document.getElementById(settings.searchAreaButtonId || 'browseSearchArea');
    const mapButtons = Array.from(document.querySelectorAll('[data-browse-map-style]'));
    let map = null;
    let loaded = false;
    let trails = [];
    let selectedId = '';
    let pendingFit = true;
    let ignoreNextMove = false;
    let popup = null;
    let terrainOn = false;

    function data(){
      return {
        type:'FeatureCollection',
        features:trails.map(trailFeature).filter(Boolean),
      };
    }

    function fitToTrails(){
      if(!loaded || !map || !trails.length || !root.maplibregl) return;
      const points = trails.map(coordinateFor).filter(Boolean);
      if(!points.length) return;
      if(points.length === 1){
        ignoreNextMove = true;
        map.flyTo({ center:points[0], zoom:12.5, duration:360 });
        return;
      }
      const bounds = new root.maplibregl.LngLatBounds();
      points.forEach(point => bounds.extend(point));
      ignoreNextMove = true;
      map.fitBounds(bounds, {
        padding:{ top:64, right:54, bottom:54, left:54 },
        maxZoom:12.5,
        duration:420,
      });
    }

    function routeFeature(trail){
      if(!trail || !Array.isArray(trail.path) || trail.path.length < 2){
        return { type:'FeatureCollection', features:[] };
      }
      const coordinates = trail.path.map(point => [Number(point[1]), Number(point[0])])
        .filter(point => point.every(Number.isFinite));
      return coordinates.length > 1 ? {
        type:'Feature',
        geometry:{ type:'LineString', coordinates },
        properties:{ id:String(trail.id || '') },
      } : { type:'FeatureCollection', features:[] };
    }

    function selectedTrail(){
      return trails.find(trail => String(trail.id) === String(selectedId));
    }

    function syncSelection(){
      if(!loaded || !map) return;
      ['browse-trails-selected-halo', 'browse-trails-selected'].forEach(layerId => {
        if(map.getLayer(layerId)) map.setFilter(layerId, ['==', ['get', 'id'], selectedId || '__none__']);
      });
      const routeSource = map.getSource('browse-selected-route');
      if(routeSource) routeSource.setData(routeFeature(selectedTrail()));
    }

    function showPopup(trail){
      if(!map || !root.maplibregl || !trail) return;
      const coordinate = coordinateFor(trail);
      if(!coordinate) return;
      if(popup) popup.remove();
      const metadata = [
        trail.area || trail.valley || '',
        trail.distance ? `${trail.distance} km` : '',
        trail.hours ? `${trail.hours} h` : '',
      ].filter(Boolean).join(' · ');
      popup = new root.maplibregl.Popup({ offset:18, closeButton:true, maxWidth:'250px' })
        .setLngLat(coordinate)
        .setHTML(`<div class="browse-map-popup"><strong>${escapeHtml(trail.name || 'Trail')}</strong>${metadata ? `<span>${escapeHtml(metadata)}</span>` : ''}<b>Dog suitability at a glance</b><a href="trail.html?id=${encodeURIComponent(trail.id)}">Open trail →</a></div>`)
        .addTo(map);
    }

    function select(id, selectOptions){
      selectedId = String(id || '');
      syncSelection();
      const trail = selectedTrail();
      if(!trail) return;
      const opts = selectOptions || {};
      if(opts.popup) showPopup(trail);
      if(opts.fly && map){
        const coordinate = coordinateFor(trail);
        if(coordinate){
          ignoreNextMove = true;
          map.easeTo({ center:coordinate, zoom:Math.max(map.getZoom(), 12), duration:320 });
        }
      }
    }

    function applyData(shouldFit){
      if(!loaded || !map) return;
      const source = map.getSource('browse-trails');
      if(source) source.setData(data());
      syncSelection();
      if(shouldFit) fitToTrails();
    }

    function addTerrain(){
      if(map.getSource('browse-terrain-dem')) return;
      map.addSource('browse-terrain-dem', {
        type:'raster-dem',
        tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize:256,
        encoding:'terrarium',
        maxzoom:15,
        attribution:'Elevation tiles © AWS Terrain Tiles',
      });
      const firstSymbol = (map.getStyle().layers || []).find(layer => layer.type === 'symbol');
      map.addLayer({
        id:'browse-terrain-hillshade',
        type:'hillshade',
        source:'browse-terrain-dem',
        layout:{ visibility:'none' },
        paint:{
          'hillshade-shadow-color':'#31483a',
          'hillshade-highlight-color':'#f8f3e5',
          'hillshade-accent-color':'#6f8d79',
          'hillshade-exaggeration':0.38,
        },
      }, firstSymbol && firstSymbol.id);
    }

    function setTerrain(on){
      if(!loaded || !map) return;
      terrainOn = !!on;
      addTerrain();
      if(map.getLayer('browse-terrain-hillshade')){
        map.setLayoutProperty('browse-terrain-hillshade', 'visibility', terrainOn ? 'visible' : 'none');
      }
      if(typeof map.setTerrain === 'function'){
        map.setTerrain(terrainOn ? { source:'browse-terrain-dem', exaggeration:1.12 } : null);
      }
      ignoreNextMove = true;
      map.easeTo({ pitch:terrainOn ? 38 : 0, duration:360 });
      mapButtons.forEach(button => {
        const pressed = (button.dataset.browseMapStyle === 'terrain') === terrainOn;
        button.classList.toggle('on', pressed);
        button.setAttribute('aria-pressed', String(pressed));
      });
    }

    function installLayers(){
      map.addSource('browse-trails', {
        type:'geojson', data:data(), cluster:true, clusterRadius:48, clusterMaxZoom:13,
      });
      map.addLayer({
        id:'browse-trail-clusters', type:'circle', source:'browse-trails', filter:['has', 'point_count'],
        paint:{
          'circle-color':'#f9f7ef', 'circle-radius':['step', ['get','point_count'], 19, 10, 23, 30, 27],
          'circle-stroke-color':'#3e7a91', 'circle-stroke-width':2,
        },
      });
      map.addLayer({
        id:'browse-trail-cluster-count', type:'symbol', source:'browse-trails', filter:['has', 'point_count'],
        layout:{ 'text-field':['get','point_count_abbreviated'], 'text-size':12 },
        paint:{ 'text-color':'#2e4034' },
      });
      map.addLayer({
        id:'browse-trails-unclustered', type:'circle', source:'browse-trails', filter:['!', ['has','point_count']],
        paint:{ 'circle-color':'#3e7a91', 'circle-radius':7, 'circle-stroke-color':'#fff', 'circle-stroke-width':2.5 },
      });
      map.addLayer({
        id:'browse-trails-selected-halo', type:'circle', source:'browse-trails',
        filter:['==', ['get','id'], '__none__'],
        paint:{ 'circle-color':'rgba(46,64,52,.18)', 'circle-radius':16 },
      });
      map.addLayer({
        id:'browse-trails-selected', type:'circle', source:'browse-trails',
        filter:['==', ['get','id'], '__none__'],
        paint:{ 'circle-color':'#2e4034', 'circle-radius':9, 'circle-stroke-color':'#fff', 'circle-stroke-width':3 },
      });
      map.addSource('browse-selected-route', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
      map.addLayer({
        id:'browse-selected-route-line', type:'line', source:'browse-selected-route',
        paint:{ 'line-color':'#2e4034', 'line-width':4, 'line-opacity':0.9 },
      });

      map.on('click', 'browse-trail-clusters', event => {
        const feature = event.features && event.features[0];
        if(!feature) return;
        const source = map.getSource('browse-trails');
        Promise.resolve(source.getClusterExpansionZoom(feature.properties.cluster_id)).then(zoom => {
          ignoreNextMove = true;
          map.easeTo({ center:feature.geometry.coordinates, zoom, duration:320 });
        });
      });
      map.on('click', 'browse-trails-unclustered', event => {
        const feature = event.features && event.features[0];
        if(!feature) return;
        const id = feature.properties.id;
        select(id, { popup:true });
        if(typeof settings.onSelect === 'function') settings.onSelect(id);
      });
      ['browse-trail-clusters', 'browse-trails-unclustered'].forEach(layerId => {
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      });
    }

    function initialise(){
      const mapOptions = {
        container:settings.containerId || 'browseMap',
        style:'https://tiles.openfreemap.org/styles/liberty',
        center:[11.3, 46.45],
        zoom:7.3,
        pitch:0,
        attributionControl:{ compact:true },
      };
      map = new root.maplibregl.Map(root.DoloPawsMapRuntime
        ? root.DoloPawsMapRuntime.mapOptions(mapOptions) : mapOptions);
      map.addControl(new root.maplibregl.NavigationControl({ showCompass:false }), 'top-right');
      map.addControl(new root.maplibregl.GeolocateControl({
        positionOptions:{ enableHighAccuracy:false },
        trackUserLocation:false,
        showUserHeading:false,
        fitBoundsOptions:{ maxZoom:12.5 },
      }), 'top-right');
      map.on('load', () => {
        loaded = true;
        if(root.DoloPawsMapRuntime) root.DoloPawsMapRuntime.enhance(map);
        installLayers();
        applyData(pendingFit);
        pendingFit = false;
        container.querySelectorAll('.browse-map-placeholder').forEach(element => element.remove());
      });
      map.on('moveend', () => {
        if(ignoreNextMove){ ignoreNextMove = false; return; }
        if(searchAreaButton) searchAreaButton.hidden = false;
        if(typeof settings.onMove === 'function') settings.onMove();
      });
      return map;
    }

    mapButtons.forEach(button => button.addEventListener('click', () => {
      setTerrain(button.dataset.browseMapStyle === 'terrain');
    }));

    const schedule = root.DoloPawsMapRuntime
      ? root.DoloPawsMapRuntime.whenVisible(container, initialise, { rootMargin:'520px 0px' })
      : null;

    return {
      update(nextTrails, updateOptions){
        trails = (Array.isArray(nextTrails) ? nextTrails : []).filter(coordinateFor);
        const shouldFit = !updateOptions || updateOptions.fit !== false;
        pendingFit = pendingFit || shouldFit;
        applyData(shouldFit);
      },
      select,
      showPopup(id){
        const trail = trails.find(item => String(item.id) === String(id));
        if(trail) showPopup(trail);
      },
      bounds(){
        if(!map) return null;
        const current = map.getBounds();
        return { west:current.getWest(), east:current.getEast(), south:current.getSouth(), north:current.getNorth() };
      },
      resize(){ if(map) map.resize(); else if(schedule && schedule.start) schedule.start(); },
      map(){ return map; },
    };
  }

  const api = { create, coordinateFor, withinBounds };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root) root.DoloPawsBrowseMap = api;
})(typeof window !== 'undefined' ? window : null);
