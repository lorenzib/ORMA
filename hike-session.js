(function(root){
  'use strict';

  const STORAGE_KEY = 'dolopaws-active-hike-v1';
  const SCHEMA_VERSION = 1;
  const STATES = Object.freeze(['active', 'paused', 'completion-pending']);

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

  function sessionId(){
    try {
      if(root.crypto && typeof root.crypto.randomUUID === 'function'){
        return root.crypto.randomUUID();
      }
    } catch (error) {}
    return `hike-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function validateProgress(progress){
    if(!progress || typeof progress !== 'object' || Array.isArray(progress)) return false;
    if(!finiteNumber(progress.km) || progress.km < 0) return false;
    if(!Number.isInteger(progress.pathIndex) || progress.pathIndex < 0) return false;
    if(!finiteNumber(progress.accuracyM) || progress.accuracyM < 0) return false;
    if(!finiteNumber(progress.recordedAt) || progress.recordedAt <= 0) return false;
    return true;
  }

  function validationStatus(value){
    if(!value || typeof value !== 'object' || Array.isArray(value)) return 'corrupt';
    if(value.schemaVersion !== SCHEMA_VERSION) return 'incompatible';
    if(typeof value.sessionId !== 'string' || !value.sessionId) return 'corrupt';
    if(typeof value.trailId !== 'string' || !value.trailId) return 'corrupt';
    if(typeof value.packageId !== 'string' || !value.packageId) return 'corrupt';
    if(value.ownerId !== null && (typeof value.ownerId !== 'string' || !value.ownerId)){
      return 'corrupt';
    }
    if(!finiteNumber(value.startedAt) || value.startedAt <= 0) return 'corrupt';
    if(!finiteNumber(value.updatedAt) || value.updatedAt < value.startedAt) return 'corrupt';
    if(!STATES.includes(value.state)) return 'corrupt';
    if(value.lastProgress !== null && !validateProgress(value.lastProgress)) return 'corrupt';
    return 'ready';
  }

  function write(session, storage){
    const target = safeStorage(storage);
    if(!target || typeof target.setItem !== 'function'){
      return { ok: false, error: 'storage-unavailable', session };
    }
    try {
      target.setItem(STORAGE_KEY, JSON.stringify(session));
      return { ok: true, session };
    } catch (error) {
      return { ok: false, error: 'storage-write-failed', session };
    }
  }

  function load(storage){
    const target = safeStorage(storage);
    if(!target || typeof target.getItem !== 'function'){
      return { status: 'unavailable', session: null };
    }
    let raw;
    try {
      raw = target.getItem(STORAGE_KEY);
    } catch (error) {
      return { status: 'unavailable', session: null };
    }
    if(raw === null) return { status: 'empty', session: null };
    let session;
    try {
      session = JSON.parse(raw);
    } catch (error) {
      return { status: 'corrupt', session: null };
    }
    const status = validationStatus(session);
    return { status, session: status === 'ready' ? session : null };
  }

  function create(input, storage){
    const startedAt = finiteNumber(input && input.startedAt)
      ? input.startedAt
      : Date.now();
    const session = {
      schemaVersion: SCHEMA_VERSION,
      sessionId: sessionId(),
      trailId: String(input && input.trailId || ''),
      packageId: String(input && input.packageId || ''),
      ownerId: input && typeof input.ownerId === 'string' && input.ownerId
        ? input.ownerId
        : null,
      startedAt,
      updatedAt: startedAt,
      state: 'active',
      lastProgress: null,
    };
    if(validationStatus(session) !== 'ready'){
      return { ok: false, error: 'invalid-session', session: null };
    }
    return write(session, storage);
  }

  function updateProgress(session, progress, storage){
    if(validationStatus(session) !== 'ready' || !validateProgress(progress)){
      return { ok: false, error: 'invalid-session-update', session };
    }
    const recordedAt = Math.max(progress.recordedAt, session.startedAt);
    const next = {
      ...session,
      state: 'active',
      updatedAt: Math.max(recordedAt, session.updatedAt),
      lastProgress: {
        km: progress.km,
        pathIndex: progress.pathIndex,
        accuracyM: progress.accuracyM,
        recordedAt,
      },
    };
    return write(next, storage);
  }

  function setState(session, state, at, storage){
    if(validationStatus(session) !== 'ready' || !STATES.includes(state)){
      return { ok: false, error: 'invalid-session-update', session };
    }
    const next = {
      ...session,
      state,
      updatedAt: Math.max(finiteNumber(at) ? at : Date.now(), session.updatedAt),
    };
    return write(next, storage);
  }

  function clear(storage){
    const target = safeStorage(storage);
    if(!target || typeof target.removeItem !== 'function'){
      return { ok: false, error: 'storage-unavailable' };
    }
    try {
      target.removeItem(STORAGE_KEY);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'storage-write-failed' };
    }
  }

  root.DoloPawsHikeSession = Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    STATES,
    validationStatus,
    create,
    load,
    updateProgress,
    setState,
    clear,
  });
})(typeof window !== 'undefined' ? window : globalThis);
