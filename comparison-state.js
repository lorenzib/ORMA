(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsComparisonState = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'dolopaws-comparison-v1';
  const MAX_TRAILS = 3;
  const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;

  function normalizeIds(values, availableIds){
    const allowed = availableIds ? new Set(availableIds) : null;
    const unique = [];
    for(const value of Array.isArray(values) ? values : []){
      const id = String(value || '').trim();
      if(!ID_PATTERN.test(id) || unique.includes(id) || (allowed && !allowed.has(id))) continue;
      unique.push(id);
      if(unique.length === MAX_TRAILS) break;
    }
    return unique;
  }

  function parseIds(value, availableIds){
    return normalizeIds(String(value || '').split(','), availableIds);
  }

  function load(storage, availableIds){
    if(!storage || typeof storage.getItem !== 'function') return [];
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
      if(!parsed || parsed.version !== VERSION) return [];
      return normalizeIds(parsed.ids, availableIds);
    } catch(e){
      return [];
    }
  }

  function save(storage, ids){
    const normalized = normalizeIds(ids);
    if(!storage || typeof storage.setItem !== 'function') return normalized;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        version:VERSION,
        ids:normalized,
        updatedAt:new Date().toISOString(),
      }));
    } catch(e){}
    return normalized;
  }

  function toggle(ids, trailId){
    const normalized = normalizeIds(ids);
    const id = String(trailId || '');
    if(normalized.includes(id)) return normalized.filter(value => value !== id);
    if(!ID_PATTERN.test(id)) return normalized;
    if(normalized.length >= MAX_TRAILS) return normalized;
    return normalized.concat(id);
  }

  function compareHref(ids, context){
    const params = new URLSearchParams();
    const normalized = normalizeIds(ids);
    if(normalized.length) params.set('ids', normalized.join(','));
    if(context && ['medium','rufus','bella','milo','custom'].includes(context.dog)){
      if(context.dog !== 'medium') params.set('dog', context.dog);
    }
    if(context && typeof context.from === 'string' && /^browse-trails\.html(?:\?[^#]*)?(?:#.*)?$/.test(context.from)){
      params.set('from', context.from);
    }
    const query = params.toString();
    return 'compare.html' + (query ? '?' + query : '');
  }

  return Object.freeze({
    VERSION, STORAGE_KEY, MAX_TRAILS, normalizeIds, parseIds, load, save, toggle, compareHref,
  });
});
