(function(root, factory){
  const library = factory();
  if(typeof module === 'object' && module.exports) module.exports = library;
  if(root && root.document){
    let storage;
    try{ storage = root.sessionStorage; }catch(error){}
    root.DoloPawsMetricFunnel = library.create({
      metrics:root.DoloPawsMetrics,
      storage,
    });
  }
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const STORAGE_PREFIX = 'dolopaws-funnel-v1:';
  const SAFE_KEY_PART = /^[a-z0-9][a-z0-9_-]{0,79}$/;

  function memoryStorage(){
    const values = new Map();
    return {
      getItem:key => values.has(key) ? values.get(key) : null,
      setItem:(key, value) => values.set(key, String(value)),
      removeItem:key => values.delete(key),
    };
  }

  function create(options){
    options = options || {};
    const metrics = options.metrics || null;
    const storage = options.storage || memoryStorage();

    function guardKey(stage, scope){
      const safeStage = String(stage || '');
      const safeScope = String(scope || 'journey');
      if(!SAFE_KEY_PART.test(safeStage) || !SAFE_KEY_PART.test(safeScope)) return null;
      return STORAGE_PREFIX + safeStage + ':' + safeScope;
    }

    function recorded(stage, scope){
      const key = guardKey(stage, scope);
      if(!key) return false;
      const inspection = metrics && typeof metrics.inspect === 'function'
        ? metrics.inspect()
        : null;
      const generation = inspection && Number.isInteger(inspection.consentGeneration)
        ? String(inspection.consentGeneration)
        : '1';
      try{ return storage.getItem(key) === generation; }catch(error){ return false; }
    }

    function recordOnce(stage, scope, family, state, properties){
      const key = guardKey(stage, scope);
      if(!key) return { ok:false, reason:'invalid-funnel-key' };
      if(recorded(stage, scope)) return { ok:true, duplicate:true };
      if(!metrics || typeof metrics.record !== 'function'){
        return { ok:false, reason:'metrics-unavailable' };
      }
      const result = metrics.record(family, state, properties || {});
      if(result && result.ok){
        const inspection = typeof metrics.inspect === 'function' ? metrics.inspect() : null;
        const generation = inspection && Number.isInteger(inspection.consentGeneration)
          ? String(inspection.consentGeneration)
          : '1';
        try{ storage.setItem(key, generation); }catch(error){}
      }
      return result;
    }

    return {
      recordOnce,
      recorded,
      countBand,
      packageSizeBand,
      durationBand,
      failureCategory,
    };
  }

  function countBand(value){
    const count = Number(value);
    if(!Number.isFinite(count) || count <= 0) return 'none';
    if(count <= 5) return 'one_to_five';
    if(count <= 20) return 'six_to_twenty';
    return 'over_twenty';
  }

  function packageSizeBand(bytes){
    const size = Number(bytes);
    if(!Number.isFinite(size) || size < 0) return 'unknown';
    if(size < 1024 * 1024) return 'under_1_mb';
    if(size < 10 * 1024 * 1024) return 'one_to_ten_mb';
    if(size < 50 * 1024 * 1024) return 'ten_to_fifty_mb';
    return 'over_fifty_mb';
  }

  function durationBand(milliseconds){
    const duration = Number(milliseconds);
    if(!Number.isFinite(duration) || duration < 0) return 'unknown';
    if(duration < 30 * 1000) return 'under_30_seconds';
    if(duration < 2 * 60 * 1000) return 'thirty_seconds_to_two_minutes';
    return 'over_two_minutes';
  }

  function failureCategory(error){
    const value = error
      ? [error.code, error.name, error.message].filter(Boolean).join(' ').toLowerCase()
      : '';
    if(/auth|permission|login|sign/.test(value)) return 'authentication';
    if(/quota|storage|space|indexeddb/.test(value)) return 'storage';
    if(/checksum|integrity|verify|manifest/.test(value)) return 'verification';
    if(/network|fetch|offline|timeout/.test(value)) return 'network';
    if(/support|browser|service.?worker/.test(value)) return 'unsupported';
    return 'unknown';
  }

  return {
    STORAGE_PREFIX,
    create,
    memoryStorage,
    countBand,
    packageSizeBand,
    durationBand,
    failureCategory,
  };
});
