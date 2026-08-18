(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  root.DoloPawsDiscoveryState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const ALLOWED = Object.freeze({
    region: ['dolomites', 'savoy'],
    risk: ['low-risk', 'moderate', 'caution'],
    distance: ['3', '5', '6', '10', '20', 'u5', '5to10', '10p'],
    collection: ['shady', 'water', 'meadow', 'gentle'],
    dog: ['medium', 'rufus', 'bella', 'milo', 'custom'],
    difficulty: ['Easy', 'Moderate', 'Hard'],
    terrain: ['soft', 'mixed', 'rocky'],
    heat: ['shade-reviewed', 'shade-40', 'shade-60', 'low-reviewed'],
    exposure: ['none-reviewed'],
    access: ['allowed-reviewed', 'leash-ok-reviewed'],
    verification: ['route-audited', 'field-verified'],
    minMatch: ['60', '75', '85'],
  });

  function text(value, maxLength){
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  }

  function allowed(name, value){
    const clean = text(value, 40);
    return ALLOWED[name].includes(clean) ? clean : '';
  }

  function read(source, key){
    if(source && typeof source.get === 'function') return source.get(key);
    return source ? source[key] : null;
  }

  function normalize(source){
    return {
      search: text(read(source, 'search'), 120),
      region: allowed('region', read(source, 'region')),
      risk: allowed('risk', read(source, 'risk')),
      distance: allowed('distance', String(read(source, 'distance') || '')),
      water: read(source, 'water') === '1' || read(source, 'water') === true,
      collection: allowed('collection', read(source, 'collection')),
      dog: allowed('dog', read(source, 'dog')) || 'medium',
      difficulty: allowed('difficulty', read(source, 'difficulty')),
      terrain: allowed('terrain', read(source, 'terrain')),
      heat: allowed('heat', read(source, 'heat')),
      exposure: allowed('exposure', read(source, 'exposure')),
      access: allowed('access', read(source, 'access')),
      verification: allowed('verification', read(source, 'verification')),
      shade: read(source, 'shade') === '1' || read(source, 'shade') === true,
      minMatch: allowed('minMatch', String(read(source, 'minMatch') || '')),
      page: Math.max(1, Number.parseInt(read(source, 'page'), 10) || 1),
    };
  }

  function toParams(source){
    const state = normalize(source);
    const params = new URLSearchParams();
    if(state.search) params.set('search', state.search);
    if(state.region) params.set('region', state.region);
    if(state.risk) params.set('risk', state.risk);
    if(state.distance) params.set('distance', state.distance);
    if(state.water) params.set('water', '1');
    if(state.collection) params.set('collection', state.collection);
    if(state.dog !== 'medium') params.set('dog', state.dog);
    if(state.difficulty) params.set('difficulty', state.difficulty);
    if(state.terrain) params.set('terrain', state.terrain);
    if(state.heat) params.set('heat', state.heat);
    if(state.exposure) params.set('exposure', state.exposure);
    if(state.access) params.set('access', state.access);
    if(state.verification) params.set('verification', state.verification);
    if(state.shade) params.set('shade', '1');
    if(state.minMatch) params.set('minMatch', state.minMatch);
    if(state.page > 1) params.set('page', String(state.page));
    return params;
  }

  function browseHref(source, hash){
    const query = toParams(source).toString();
    return 'browse-trails.html' + (query ? '?' + query : '') + (hash || '');
  }

  function trailHref(trailId, source){
    const browse = browseHref(source);
    return 'trail.html?id=' + encodeURIComponent(trailId) + '&from=' + encodeURIComponent(browse);
  }

  function hasFilters(source){
    const state = normalize(source);
    return Boolean(state.search || state.region || state.risk || state.distance ||
      state.water || state.collection || state.difficulty || state.terrain ||
      state.heat || state.exposure || state.access || state.verification ||
      state.shade || state.minMatch);
  }

  return Object.freeze({ normalize, toParams, browseHref, trailHref, hasFilters });
});
