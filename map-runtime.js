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

  global.DoloPawsMapRuntime = { load, whenVisible, onIdle, VERSION };
})(window);
