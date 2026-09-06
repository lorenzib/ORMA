(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsPostHikeOutcomes = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  const STORAGE_KEY = 'dolopaws-post-hike-outcomes-v1';
  const SCHEMA_VERSION = 2;
  const RESPONSES = Object.freeze([
    'appropriate',
    'appropriate_with_unexpected_cautions',
    'not_appropriate',
    'did_not_complete',
    'prefer_not_to_answer',
  ]);
  const WATER_STATES = Object.freeze([
    'accurate',
    'less_than_listed',
    'more_than_listed',
    'not_checked',
  ]);
  const HAZARDS = Object.freeze([
    'surface',
    'exposure',
    'livestock',
    'heat',
    'access',
    'water',
  ]);
  // Community observations. Each is optional and stored as null when the owner
  // does not answer, matching waterAccuracy above: an unanswered question is a
  // gap in the evidence, never a claim that the pleasant answer applies.
  //
  // These are the signals that populate the trail attributes SCORE-03 reads.
  // livestockEncountered feeds livestockPresence, crowding feeds crowding, and
  // offLeadObserved and missingRestriction inform access, which is why they are
  // asked as bounded observations rather than free text.
  const OFF_LEAD = Object.freeze([
    'all_on_lead',
    'some_off_lead',
    'mostly_off_lead',
  ]);
  const LIVESTOCK_ENCOUNTER = Object.freeze([
    'none',
    'seen_at_distance',
    'close_encounter',
  ]);
  const CROWDING = Object.freeze(['quiet', 'moderate', 'busy']);
  const DOG_ENJOYMENT = Object.freeze(['loved_it', 'fine', 'struggled']);
  const REACTIVE_DOG_FIT = Object.freeze(['yes', 'with_care', 'no']);
  const OBSERVATIONS = Object.freeze({
    offLeadObserved: OFF_LEAD,
    livestockEncountered: LIVESTOCK_ENCOUNTER,
    crowding: CROWDING,
    dogEnjoyment: DOG_ENJOYMENT,
    reactiveDogFit: REACTIVE_DOG_FIT,
  });
  const OBSERVATION_KEYS = Object.freeze(Object.keys(OBSERVATIONS));
  const SYNC_STATES = Object.freeze(['pending', 'synced']);
  const ID_PATTERN = /^[A-Za-z0-9:._-]{1,160}$/;
  const TRAIL_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

  function finite(value){
    return typeof value === 'number' && Number.isFinite(value);
  }

  function targetStorage(storage){
    if(storage) return storage;
    try{ return root.localStorage; }catch(error){ return null; }
  }

  function emptyStore(){
    return { schemaVersion:SCHEMA_VERSION, records:[] };
  }

  function validRecord(record){
    return !!record &&
      record.schemaVersion === SCHEMA_VERSION &&
      typeof record.outcomeId === 'string' && ID_PATTERN.test(record.outcomeId) &&
      typeof record.completionId === 'string' && ID_PATTERN.test(record.completionId) &&
      typeof record.ownerId === 'string' && ID_PATTERN.test(record.ownerId) &&
      typeof record.trailId === 'string' && TRAIL_PATTERN.test(record.trailId) &&
      RESPONSES.includes(record.response) &&
      (record.waterAccuracy === null || WATER_STATES.includes(record.waterAccuracy)) &&
      Array.isArray(record.hazards) && record.hazards.length <= HAZARDS.length &&
      record.hazards.every(value => HAZARDS.includes(value)) &&
      new Set(record.hazards).size === record.hazards.length &&
      OBSERVATION_KEYS.every(key =>
        record[key] === null || OBSERVATIONS[key].includes(record[key])) &&
      (record.missingRestriction === null || typeof record.missingRestriction === 'boolean') &&
      typeof record.recordedHikePresent === 'boolean' &&
      typeof record.offlinePackageUsed === 'boolean' &&
      finite(record.createdAt) && record.createdAt > 0 &&
      SYNC_STATES.includes(record.syncStatus) &&
      (record.syncedAt === null || (finite(record.syncedAt) && record.syncedAt >= record.createdAt)) &&
      (record.lastError === null || record.lastError === 'sync-failed');
  }

  function load(storage){
    const target = targetStorage(storage);
    if(!target || typeof target.getItem !== 'function'){
      return { status:'unavailable', store:null };
    }
    let raw;
    try{ raw = target.getItem(STORAGE_KEY); }
    catch(error){ return { status:'unavailable', store:null }; }
    if(raw === null) return { status:'ready', store:emptyStore() };
    let value;
    try{ value = JSON.parse(raw); }
    catch(error){ return { status:'corrupt', store:null }; }
    if(value && value.schemaVersion === 1 && Array.isArray(value.records)){
      // Schema 1 predates the community observations. Those check-ins are still
      // valid evidence for what they did record, so they are migrated with the
      // new questions left unanswered rather than discarded.
      value = {
        schemaVersion:SCHEMA_VERSION,
        records:value.records.map(record => ({
          ...record,
          schemaVersion:SCHEMA_VERSION,
          ...Object.fromEntries(OBSERVATION_KEYS.map(key => [key, null])),
          missingRestriction:null,
        })),
      };
    }
    if(!value || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.records)){
      return {
        status:value && value.schemaVersion !== SCHEMA_VERSION ? 'incompatible' : 'corrupt',
        store:null,
      };
    }
    if(!value.records.every(validRecord)) return { status:'corrupt', store:null };
    return { status:'ready', store:value };
  }

  function write(store, storage){
    const target = targetStorage(storage);
    if(!target || typeof target.setItem !== 'function'){
      return { ok:false, error:'storage-unavailable' };
    }
    try{
      target.setItem(STORAGE_KEY, JSON.stringify(store));
      return { ok:true };
    }catch(error){
      return { ok:false, error:'storage-write-failed' };
    }
  }

  // An unrecognised answer is dropped rather than coerced, so a stale client
  // cannot write a value the aggregation would later misread.
  function observations(input){
    const out = {};
    for(const key of OBSERVATION_KEYS){
      const value = input && input[key];
      out[key] = OBSERVATIONS[key].includes(value) ? value : null;
    }
    return out;
  }

  function createRecord(completion, input, ownerId, now){
    if(!completion || typeof completion.completionId !== 'string' ||
       !ID_PATTERN.test(completion.completionId) ||
       typeof completion.trailId !== 'string' || !TRAIL_PATTERN.test(completion.trailId) ||
       typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId) ||
       (completion.ownerId && completion.ownerId !== ownerId) ||
       !input || !RESPONSES.includes(input.response)){
      return null;
    }
    const hazards = Array.isArray(input.hazards)
      ? [...new Set(input.hazards.filter(value => HAZARDS.includes(value)))]
      : [];
    const waterAccuracy = WATER_STATES.includes(input.waterAccuracy)
      ? input.waterAccuracy
      : null;
    const record = {
      schemaVersion:SCHEMA_VERSION,
      outcomeId:`outcome:${completion.completionId}`,
      completionId:completion.completionId,
      ownerId,
      trailId:completion.trailId,
      response:input.response,
      waterAccuracy,
      hazards,
      ...observations(input),
      missingRestriction:typeof input.missingRestriction === 'boolean'
        ? input.missingRestriction
        : null,
      recordedHikePresent:true,
      offlinePackageUsed:!!input.offlinePackageUsed,
      createdAt:finite(now) ? now : Date.now(),
      syncStatus:'pending',
      syncedAt:null,
      lastError:null,
    };
    return validRecord(record) ? record : null;
  }

  function save(completion, input, ownerId, storage, now){
    const record = createRecord(completion, input, ownerId, now);
    if(!record) return { ok:false, error:'invalid-outcome', record:null };
    const loaded = load(storage);
    if(loaded.status !== 'ready'){
      return { ok:false, error:`${loaded.status}-store`, record:null };
    }
    const existing = loaded.store.records.find(item =>
      item.outcomeId === record.outcomeId
    );
    if(existing) return { ok:true, created:false, record:existing };
    const result = write({
      ...loaded.store,
      records:[record, ...loaded.store.records],
    }, storage);
    return result.ok
      ? { ok:true, created:true, record }
      : { ...result, record:null };
  }

  function pending(ownerId, storage){
    const loaded = load(storage);
    if(loaded.status !== 'ready') return [];
    return loaded.store.records.filter(record =>
      record.ownerId === ownerId && record.syncStatus === 'pending'
    );
  }

  function replaceRecord(next, storage){
    const loaded = load(storage);
    if(loaded.status !== 'ready') return { ok:false, error:`${loaded.status}-store` };
    const index = loaded.store.records.findIndex(record => record.outcomeId === next.outcomeId);
    if(index < 0 || !validRecord(next)) return { ok:false, error:'outcome-not-found' };
    const records = loaded.store.records.slice();
    records[index] = next;
    return write({ ...loaded.store, records }, storage);
  }

  async function syncPending(ownerId, sender, storage, now){
    if(typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId) ||
       typeof sender !== 'function'){
      return { ok:false, error:'sync-unavailable', synced:0, pending:pending(ownerId, storage).length };
    }
    let synced = 0;
    const queue = pending(ownerId, storage);
    for(const record of queue){
      let accepted = false;
      try{ accepted = await sender(record); }catch(error){}
      if(!accepted){
        replaceRecord({ ...record, lastError:'sync-failed' }, storage);
        return {
          ok:false,
          error:'sync-failed',
          synced,
          pending:pending(ownerId, storage).length,
        };
      }
      const result = replaceRecord({
        ...record,
        syncStatus:'synced',
        syncedAt:finite(now) ? now : Date.now(),
        lastError:null,
      }, storage);
      if(!result.ok){
        return { ok:false, error:result.error, synced, pending:pending(ownerId, storage).length };
      }
      synced += 1;
    }
    return { ok:true, synced, pending:pending(ownerId, storage).length };
  }

  async function syncBrowser(){
    const user = root.DoloPawsAuth && root.DoloPawsAuth.currentUser;
    const sender = root.DoloPawsPrivateOutcomes &&
      root.DoloPawsPrivateOutcomes.saveOutcome;
    if(!(user && sender)) return { ok:false, error:'sync-unavailable', synced:0 };
    const result = await syncPending(user.uid, sender);
    if(typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function'){
      root.dispatchEvent(new root.CustomEvent('dolopaws-outcome-sync', {
        detail:result,
      }));
    }
    return result;
  }

  if(root && root.document){
    root.addEventListener('online', syncBrowser);
    root.addEventListener('dolopaws-auth-changed', event => {
      if(event && event.detail && event.detail.user) syncBrowser();
    });
    root.addEventListener('dolopaws-auth-ready', syncBrowser);
  }

  return Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    RESPONSES,
    OBSERVATIONS,
    OBSERVATION_KEYS,
    WATER_STATES,
    HAZARDS,
    validRecord,
    load,
    save,
    pending,
    syncPending,
    syncBrowser,
  });
});
