(function(root, factory){
  const library = factory();
  if(typeof module === 'object' && module.exports) module.exports = library;
  if(root && root.document) root.DoloPawsMetrics = library.createBrowser(root);
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'dolopaws-metrics-v1';
  const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_QUEUE = 200;
  const CONSENT = new Set(['unset', 'granted', 'denied']);
  const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/;
  const TRAIL_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;
  const PROHIBITED_KEY = /(?:name|email|photo|image|caption|content|text|search|query|latitude|longitude|coordinate|position|location|gpsHistory|trace|medical|health|token|password)/i;

  const CONTRACT = Object.freeze({
    discovery_search:{
      states:['started', 'results_viewed', 'no_results', 'filters_changed'],
      properties:{
        region:'slug',
        resultCount:'count',
        profilePresent:'boolean',
        activeFilterCount:'count',
      },
    },
    dog_profile:{
      states:['started', 'completed', 'updated', 'abandoned'],
      properties:{
        completenessBand:'slug',
        relevantFactorsKnown:'boolean',
      },
    },
    trail_decision:{
      states:['opened', 'explanation_viewed', 'unknowns_viewed', 'compared', 'selected'],
      properties:{
        trailId:'trailId',
        matchCategory:'slug',
        verificationStatus:'slug',
        warningCount:'count',
        unknownCount:'count',
        profilePresent:'boolean',
      },
    },
    trail_saved:{
      states:['attempted', 'completed', 'failed', 'removed'],
      properties:{
        trailId:'trailId',
        authenticationState:'slug',
        failureCategory:'slug',
        authenticationHandoff:'boolean',
      },
    },
    offline_package:{
      states:['started', 'ready', 'failed', 'airplane_test_passed', 'update_available', 'updated', 'removed'],
      properties:{
        trailId:'trailId',
        packageSizeBand:'slug',
        durationBand:'slug',
        failureCategory:'slug',
        storageBand:'slug',
        packageVersion:'version',
        browserFamily:'slug',
      },
    },
    hike_session:{
      states:['started', 'gps_acquired', 'restored', 'paused', 'off_route_warning', 'completed', 'abandoned'],
      properties:{
        trailId:'trailId',
        connectivity:'slug',
        packagePresent:'boolean',
        gpsAccuracyBand:'slug',
        durationBand:'slug',
        distanceCompletionBand:'slug',
      },
    },
    community_contribution:{
      states:['started', 'queued_offline', 'submitted', 'pending_moderation', 'published', 'failed'],
      properties:{
        contributionType:'slug',
        trailId:'trailId',
        contributorCategory:'slug',
        recordedHikePresent:'boolean',
        moderationState:'slug',
      },
    },
    post_hike_outcome:{
      states:[
        'appropriate',
        'appropriate_with_unexpected_cautions',
        'not_appropriate',
        'did_not_complete',
        'prefer_not_to_answer',
      ],
      properties:{
        trailId:'trailId',
        matchCategory:'slug',
        primaryMismatchCategory:'slug',
        offlinePackageUsed:'boolean',
        recordedHikePresent:'boolean',
        conditionsDiffered:'boolean',
      },
    },
  });

  function memoryStorage(){
    const values = new Map();
    return {
      getItem:key => values.has(key) ? values.get(key) : null,
      setItem:(key, value) => values.set(key, String(value)),
      removeItem:key => values.delete(key),
    };
  }

  function defaultState(){
    return {
      version:VERSION,
      consent:'unset',
      consentUpdatedAt:null,
      consentGeneration:0,
      clientId:null,
      events:[],
    };
  }

  function coarseHour(now){
    const date = new Date(now);
    if(Number.isNaN(date.getTime())) return null;
    date.setUTCMinutes(0, 0, 0);
    return date.toISOString();
  }

  function randomId(cryptoObject){
    if(cryptoObject && typeof cryptoObject.randomUUID === 'function'){
      return cryptoObject.randomUUID();
    }
    const random = Math.random().toString(36).slice(2);
    return `dp-${Date.now().toString(36)}-${random}`;
  }

  function validProperty(type, value){
    if(type === 'boolean') return typeof value === 'boolean';
    if(type === 'count') return Number.isInteger(value) && value >= 0 && value <= 9999;
    if(type === 'trailId') return typeof value === 'string' && TRAIL_ID.test(value);
    if(type === 'slug') return typeof value === 'string' && SLUG.test(value);
    if(type === 'version'){
      return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,49}$/i.test(value);
    }
    return false;
  }

  function validate(family, state, properties){
    const definition = CONTRACT[family];
    if(!definition) return { ok:false, reason:'unknown-family' };
    if(!definition.states.includes(state)) return { ok:false, reason:'unknown-state' };
    if(!properties || typeof properties !== 'object' || Array.isArray(properties)){
      return { ok:false, reason:'invalid-properties' };
    }
    const clean = {};
    for(const [key, value] of Object.entries(properties)){
      if(PROHIBITED_KEY.test(key)) return { ok:false, reason:'prohibited-property' };
      const type = definition.properties[key];
      if(!type) return { ok:false, reason:'unknown-property' };
      if(!validProperty(type, value)) return { ok:false, reason:'invalid-property-value' };
      clean[key] = value;
    }
    return { ok:true, properties:clean };
  }

  function create(options){
    options = options || {};
    const storage = options.storage || memoryStorage();
    const cryptoObject = options.crypto || null;
    const clock = typeof options.now === 'function' ? options.now : Date.now;
    const isOnline = typeof options.isOnline === 'function' ? options.isOnline : () => true;
    let transport = typeof options.transport === 'function' ? options.transport : null;
    let flushing = null;

    function read(){
      try{
        const value = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
        if(!value || value.version !== VERSION || !CONSENT.has(value.consent) ||
           !Array.isArray(value.events)){
          return defaultState();
        }
        return value;
      }catch(error){
        return defaultState();
      }
    }

    function write(value){
      try{
        storage.setItem(STORAGE_KEY, JSON.stringify(value));
        return true;
      }catch(error){
        return false;
      }
    }

    function prune(value, now){
      value.events = value.events.filter(record =>
        record && record.event && typeof record.event.id === 'string' &&
        Number.isFinite(record.queuedAt) && now - record.queuedAt <= RETENTION_MS
      ).slice(-MAX_QUEUE);
      return value;
    }

    function consent(){
      return read().consent;
    }

    function setConsent(next){
      if(!CONSENT.has(next)) return { ok:false, reason:'invalid-consent' };
      const now = clock();
      const value = prune(read(), now);
      value.consent = next;
      value.consentUpdatedAt = coarseHour(now);
      value.consentGeneration = Number.isInteger(value.consentGeneration)
        ? value.consentGeneration + 1
        : 1;
      if(next !== 'granted'){
        value.events = [];
        value.clientId = null;
      }else if(!value.clientId){
        value.clientId = randomId(cryptoObject);
      }
      return write(value)
        ? { ok:true, consent:next }
        : { ok:false, reason:'storage-unavailable' };
    }

    function record(family, state, properties){
      const checked = validate(family, state, properties || {});
      if(!checked.ok) return checked;
      const now = clock();
      const value = prune(read(), now);
      if(value.consent !== 'granted'){
        return { ok:false, reason:'consent-required' };
      }
      if(!value.clientId) value.clientId = randomId(cryptoObject);
      const event = {
        schemaVersion:VERSION,
        id:randomId(cryptoObject),
        clientId:value.clientId,
        family,
        state,
        properties:checked.properties,
        occurredHour:coarseHour(now),
      };
      value.events.push({
        event,
        queuedAt:now,
        attempts:0,
        lastAttemptAt:null,
      });
      prune(value, now);
      if(!write(value)) return { ok:false, reason:'storage-unavailable' };
      return { ok:true, event };
    }

    function queued(){
      const value = prune(read(), clock());
      write(value);
      return value.events.map(record => record.event);
    }

    async function performFlush(){
      if(!transport) return { ok:false, reason:'transport-unavailable', sent:0 };
      if(!isOnline()) return { ok:false, reason:'offline', sent:0 };
      let value = prune(read(), clock());
      if(value.consent !== 'granted') return { ok:false, reason:'consent-required', sent:0 };
      let sent = 0;
      while(value.events.length && isOnline()){
        const record = value.events[0];
        let accepted = false;
        try{
          const result = await transport(record.event);
          accepted = result === true || !!(result && result.ok);
        }catch(error){}
        if(!accepted){
          record.attempts += 1;
          record.lastAttemptAt = clock();
          write(value);
          return { ok:false, reason:'send-failed', sent };
        }
        value.events.shift();
        sent += 1;
        if(!write(value)) return { ok:false, reason:'storage-unavailable', sent };
      }
      return { ok:true, sent };
    }

    function flush(){
      if(flushing) return flushing;
      flushing = performFlush().finally(() => { flushing = null; });
      return flushing;
    }

    function setTransport(next){
      transport = typeof next === 'function' ? next : null;
      return !!transport;
    }

    function inspect(){
      const value = prune(read(), clock());
      return {
        consent:value.consent,
        consentUpdatedAt:value.consentUpdatedAt,
        consentGeneration:Number.isInteger(value.consentGeneration)
          ? value.consentGeneration
          : 0,
        queueLength:value.events.length,
        hasClientId:!!value.clientId,
      };
    }

    return {
      CONTRACT,
      consent,
      setConsent,
      validate,
      record,
      queued,
      flush,
      setTransport,
      inspect,
    };
  }

  function createBrowser(win){
    let storage;
    try{ storage = win.localStorage; }catch(error){ storage = memoryStorage(); }
    const api = create({
      storage,
      crypto:win.crypto,
      isOnline:() => win.navigator.onLine !== false,
    });
    win.addEventListener('online', () => api.flush());
    return api;
  }

  return {
    VERSION,
    STORAGE_KEY,
    RETENTION_MS,
    MAX_QUEUE,
    CONTRACT,
    coarseHour,
    validate,
    create,
    createBrowser,
    memoryStorage,
  };
});
