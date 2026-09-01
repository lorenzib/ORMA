(function(global){
  'use strict';

  const VERSION = '5.24.0';
  const SCRIPT_URL = `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.js`;
  const STYLE_URL = `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.css`;
  let runtimePromise = null;

  function loadStyle(){
    const existing = document.querySelector('link[data-dolopaws-maplibre]');
    if(existing) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = STYLE_URL;
      link.dataset.dolopawsMaplibre = VERSION;
      link.onload = resolve;
      link.onerror = () => reject(new Error('Map styles could not be loaded.'));
      document.head.appendChild(link);
    });
  }

  function loadScript(){
    if(global.maplibregl) return Promise.resolve(global.maplibregl);
    const existing = document.querySelector('script[data-dolopaws-maplibre]');
    if(existing){
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(global.maplibregl), { once:true });
        existing.addEventListener('error', () => reject(new Error('Map tools could not be loaded.')), { once:true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.dataset.dolopawsMaplibre = VERSION;
      script.onload = () => resolve(global.maplibregl);
      script.onerror = () => reject(new Error('Map tools could not be loaded.'));
      document.head.appendChild(script);
    });
  }

  function load(){
    if(global.maplibregl) return Promise.resolve(global.maplibregl);
    if(!runtimePromise){
      runtimePromise = Promise.all([loadStyle(), loadScript()]).then(([, maplibre]) => maplibre);
    }
    return runtimePromise;
  }

  function whenVisible(target, initialise, options){
    if(!target || typeof initialise !== 'function') return Promise.resolve(null);
    const opts = options || {};
    let observer = null;
    let started = false;
    let startPromise = null;
    const triggers = (opts.triggers || []).filter(Boolean);

    const cleanup = () => {
      if(observer) observer.disconnect();
      triggers.forEach(trigger => {
        trigger.removeEventListener('pointerenter', start);
        trigger.removeEventListener('focus', start);
        trigger.removeEventListener('touchstart', start);
      });
    };
    const start = () => {
      if(started) return startPromise;
      started = true;
      cleanup();
      target.dataset.mapState = 'loading';
      startPromise = load()
        .then(() => initialise())
        .then(result => {
          target.dataset.mapState = 'ready';
          return result;
        })
        .catch(error => {
          target.dataset.mapState = 'error';
          target.setAttribute('aria-label', 'Map unavailable. Trail details remain available below.');
          console.error('ORMA map failed to initialise:', error);
          return null;
        });
      return startPromise;
    };

    triggers.forEach(trigger => {
      trigger.addEventListener('pointerenter', start, { passive:true });
      trigger.addEventListener('focus', start, { passive:true });
      trigger.addEventListener('touchstart', start, { passive:true });
    });

    if('IntersectionObserver' in global){
      observer = new IntersectionObserver(entries => {
        if(entries.some(entry => entry.isIntersecting)) start();
      }, { rootMargin: opts.rootMargin || '320px 0px' });
      observer.observe(target);
    } else {
      start();
    }
    return { start, get promise(){ return startPromise; } };
  }

  function onIdle(callback, timeout){
    if(typeof global.requestIdleCallback === 'function'){
      return global.requestIdleCallback(callback, { timeout: timeout || 4000 });
    }
    return global.setTimeout(callback, 900);
  }

  // Shared rendering profile for every ORMA map. MapLibre already renders at
  // the device pixel ratio; antialiasing improves diagonal route lines and 3D
  // terrain edges without requesting a second, heavier basemap.
  function mapOptions(options){
    return Object.assign({
      antialias: true,
      fadeDuration: 120,
      maxZoom: 20,
      maxPitch: 70,
    }, options || {});
  }

  function setPaint(map, layerId, property, value){
    if(!map.getLayer(layerId)) return;
    try { map.setPaintProperty(layerId, property, value); } catch(error){}
  }

  function setLayout(map, layerId, property, value){
    if(!map.getLayer(layerId)) return;
    try { map.setLayoutProperty(layerId, property, value); } catch(error){}
  }

  // Refine the public Liberty style for hiking. The source remains
  // OpenFreeMap/OpenStreetMap; this only improves hierarchy and legibility.
  function enhance(map){
    if(!map || !map.getStyle || !map.getStyle()) return;

    const pathWidth = ['interpolate', ['linear'], ['zoom'], 10, .65, 12, 1.05, 14, 1.9, 16, 3.4, 18, 5.8];
    const pathCasingWidth = ['interpolate', ['linear'], ['zoom'], 10, 1.35, 12, 1.9, 14, 3.1, 16, 5.1, 18, 8.1];
    ['road_path_pedestrian', 'bridge_path_pedestrian', 'tunnel_path_pedestrian'].forEach(id => {
      setPaint(map, id, 'line-width', pathWidth);
      setPaint(map, id, 'line-opacity', .92);
    });
    ['bridge_path_pedestrian_casing'].forEach(id => {
      setPaint(map, id, 'line-width', pathCasingWidth);
    });
    setPaint(map, 'road_service_track', 'line-opacity', .9);
    setPaint(map, 'road_service_track_casing', 'line-opacity', .72);

    const labelLayers = ['highway-name-path', 'highway-name-minor', 'highway-name-major',
      'waterway_line_label', 'water_name_point_label', 'water_name_line_label',
      'label_other', 'label_village', 'label_town', 'label_city'];
    labelLayers.forEach(id => {
      setPaint(map, id, 'text-halo-color', 'rgba(255,255,252,.96)');
      setPaint(map, id, 'text-halo-width', 1.35);
      setPaint(map, id, 'text-halo-blur', .25);
    });
    setLayout(map, 'highway-name-path', 'text-size', ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 12, 18, 14]);
    setLayout(map, 'highway-name-minor', 'text-size', ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 12.5, 18, 15]);

    // Reveal useful nearby amenities progressively rather than flooding a
    // regional view. Collision detection remains enabled.
    [['poi_r1', 12], ['poi_transit', 12.5], ['poi_r7', 13], ['poi_r20', 14]].forEach(([id, minzoom]) => {
      if(!map.getLayer(id)) return;
      try { map.setLayerZoomRange(id, minzoom, 24); } catch(error){}
      setPaint(map, id, 'text-halo-color', 'rgba(255,255,252,.98)');
      setPaint(map, id, 'text-halo-width', 1.5);
      setLayout(map, id, 'text-size', ['interpolate', ['linear'], ['zoom'], minzoom, 10, 16, 12, 19, 14]);
    });

    ['waymarked-hiking-layer', 'collection-waymarked-hiking-layer', 'planner-waymarked-hiking-layer', 'satellite-layer'].forEach(id => {
      setPaint(map, id, 'raster-resampling', 'linear');
      setPaint(map, id, 'raster-fade-duration', 100);
    });
  }

  global.DoloPawsMapRuntime = { load, whenVisible, onIdle, mapOptions, enhance, VERSION };
})(window);
