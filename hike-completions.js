(function(root){
  'use strict';

  const STORAGE_KEY = 'dolopaws-hike-completions-v1';
  const SCHEMA_VERSION = 1;
  const FOLLOW_UP_STATES = Object.freeze(['pending', 'journal-saved', 'discarded']);

  function finiteNumber(value){
    return typeof value === 'number' && Number.isFinite(value);
  }

  function safeStorage(storage){
    if(storage) return storage;
    try {
      return root.localStorage;
    } catch (error) {
      return null;
    }
  }

  function emptyStore(){
    return { schemaVersion: SCHEMA_VERSION, records: [] };
  }

  function validRecord(record){
    return !!record &&
      record.schemaVersion === SCHEMA_VERSION &&
      typeof record.completionId === 'string' && !!record.completionId &&
      typeof record.sessionId === 'string' && !!record.sessionId &&
      typeof record.trailId === 'string' && !!record.trailId &&
      typeof record.packageId === 'string' && !!record.packageId &&
      (record.ownerId === null || (typeof record.ownerId === 'string' && !!record.ownerId)) &&
      finiteNumber(record.startedAt) && record.startedAt > 0 &&
      finiteNumber(record.completedAt) && record.completedAt >= record.startedAt &&
      finiteNumber(record.durationSeconds) && record.durationSeconds >= 1 &&
      finiteNumber(record.distanceKm) && record.distanceKm >= 0 &&
      record.status === 'completed' &&
      FOLLOW_UP_STATES.includes(record.followUpStatus) &&
      record.syncStatus === 'pending';
  }

  function load(storage){
    const target = safeStorage(storage);
    if(!target || typeof target.getItem !== 'function'){
      return { status: 'unavailable', store: null };
    }
    let raw;
    try {
      raw = target.getItem(STORAGE_KEY);
    } catch (error) {
      return { status: 'unavailable', store: null };
    }
    if(raw === null) return { status: 'ready', store: emptyStore() };
    let store;
    try {
      store = JSON.parse(raw);
    } catch (error) {
      return { status: 'corrupt', store: null };
    }
    if(!store || store.schemaVersion !== SCHEMA_VERSION || !Array.isArray(store.records)){
      return {
        status: store && store.schemaVersion !== SCHEMA_VERSION
          ? 'incompatible'
          : 'corrupt',
        store: null,
      };
    }
    if(!store.records.every(validRecord)) return { status: 'corrupt', store: null };
    return { status: 'ready', store };
  }

  function write(store, storage){
    const target = safeStorage(storage);
    if(!target || typeof target.setItem !== 'function'){
      return { ok: false, error: 'storage-unavailable' };
    }
    try {
      target.setItem(STORAGE_KEY, JSON.stringify(store));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'storage-write-failed' };
    }
  }

  function completionFrom(session, input){
    if(!session || session.schemaVersion !== 1 ||
       typeof session.sessionId !== 'string' || !session.sessionId ||
       typeof session.trailId !== 'string' || !session.trailId ||
       typeof session.packageId !== 'string' || !session.packageId ||
       !finiteNumber(session.startedAt) || session.startedAt <= 0){
      return null;
    }
    const completedAt = finiteNumber(input && input.completedAt)
      ? input.completedAt
      : Date.now();
    const distanceKm = finiteNumber(input && input.distanceKm)
      ? Math.max(0, input.distanceKm)
      : 0;
    if(completedAt < session.startedAt) return null;
    return {
      schemaVersion: SCHEMA_VERSION,
      completionId: `completion:${session.sessionId}`,
      sessionId: session.sessionId,
      ownerId: session.ownerId || null,
      trailId: session.trailId,
      packageId: session.packageId,
      startedAt: session.startedAt,
      completedAt,
      durationSeconds: Math.max(1, Math.round((completedAt - session.startedAt) / 1000)),
      distanceKm,
      status: 'completed',
      followUpStatus: 'pending',
      syncStatus: 'pending',
    };
  }

  function save(session, input, storage){
    const record = completionFrom(session, input);
    if(!record || !validRecord(record)){
      return { ok: false, error: 'invalid-completion', record: null };
    }
    const loaded = load(storage);
    if(loaded.status !== 'ready'){
      return { ok: false, error: `${loaded.status}-store`, record: null };
    }
    const existing = loaded.store.records.find(
      item => item.completionId === record.completionId
    );
    if(existing) return { ok: true, created: false, record: existing };
    const store = {
      ...loaded.store,
      records: [record, ...loaded.store.records],
    };
    const result = write(store, storage);
    return result.ok
      ? { ok: true, created: true, record }
      : { ...result, record: null };
  }

  function markFollowUp(completionId, followUpStatus, storage){
    if(typeof completionId !== 'string' || !completionId ||
       !FOLLOW_UP_STATES.includes(followUpStatus)){
      return { ok: false, error: 'invalid-follow-up', record: null };
    }
    const loaded = load(storage);
    if(loaded.status !== 'ready'){
      return { ok: false, error: `${loaded.status}-store`, record: null };
    }
    const index = loaded.store.records.findIndex(
      item => item.completionId === completionId
    );
    if(index < 0) return { ok: false, error: 'completion-not-found', record: null };
    const record = {
      ...loaded.store.records[index],
      followUpStatus,
    };
    const records = loaded.store.records.slice();
    records[index] = record;
    const result = write({ ...loaded.store, records }, storage);
    return result.ok
      ? { ok: true, record }
      : { ...result, record: null };
  }

  function pending(storage){
    const loaded = load(storage);
    if(loaded.status !== 'ready') return [];
    return loaded.store.records.filter(record => record.syncStatus === 'pending');
  }

  root.DoloPawsHikeCompletions = Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    FOLLOW_UP_STATES,
    load,
    save,
    markFollowUp,
    pending,
  });
})(typeof window !== 'undefined' ? window : globalThis);
