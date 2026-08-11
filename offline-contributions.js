(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsOfflineContributions = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  const STORAGE_KEY = 'dolopaws-offline-contributions-v1';
  const SCHEMA_VERSION = 1;
  const MAX_RECORDS = 20;
  const MAX_SERIALIZED_CHARS = 3800000;
  const TYPES = Object.freeze(['review', 'hazard', 'photo']);
  const ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
  const TRAIL_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;

  function storageOrDefault(storage){
    return storage || (root && root.localStorage);
  }

  function empty(){ return { version:SCHEMA_VERSION, records:[] }; }

  function safeId(value){
    const id = String(value || '');
    return ID_PATTERN.test(id) ? id : null;
  }

  function newId(type, now, random){
    const stamp = Math.max(0, Number(now) || Date.now()).toString(36);
    const suffix = Math.floor((Number(random) || Math.random()) * 0xFFFFFF)
      .toString(36).padStart(5, '0');
    return `${type}-${stamp}-${suffix}`;
  }

  function sanitize(type, input){
    input = input && typeof input === 'object' ? input : {};
    const trailId = TRAIL_PATTERN.test(String(input.trailId || '')) ? String(input.trailId) : null;
    if(!trailId) return null;
    if(type === 'review'){
      const rating = Math.round(Number(input.rating));
      if(rating < 1 || rating > 5) return null;
      return {
        trailId,
        rating,
        text:String(input.text || '').slice(0, 1000),
        hikedOn:typeof input.hikedOn === 'string' ? input.hikedOn.slice(0, 10) : null,
      };
    }
    if(type === 'hazard'){
      const allowed = ['guard-dogs-livestock', 'dangerous-terrain', 'not-dog-friendly', 'water-dry', 'lift-refused-dog', 'other'];
      if(!allowed.includes(input.type)) return null;
      const km = input.km === null || input.km === undefined ? null : Number(input.km);
      if(km !== null && (!Number.isFinite(km) || km < 0 || km > 100)) return null;
      return { trailId, type:input.type, km, text:String(input.text || '').slice(0, 300) };
    }
    if(type === 'photo'){
      const image = String(input.image || '');
      if(!/^data:image\/(?:jpeg|jpg|png|webp);base64,/.test(image) || image.length > 700000) return null;
      return { trailId, image, caption:String(input.caption || '').slice(0, 240) };
    }
    return null;
  }

  function validRecord(record){
    return !!record && record.version === SCHEMA_VERSION
      && TYPES.includes(record.type)
      && safeId(record.id) && safeId(record.ownerId)
      && Number.isFinite(record.createdAt)
      && record.status === 'queued'
      && !!sanitize(record.type, record.payload);
  }

  function load(storage){
    storage = storageOrDefault(storage);
    if(!storage || typeof storage.getItem !== 'function') return empty();
    try{
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if(!parsed || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.records)) return empty();
      return { version:SCHEMA_VERSION, records:parsed.records.filter(validRecord).slice(-MAX_RECORDS) };
    }catch(error){ return empty(); }
  }

  function write(store, storage){
    storage = storageOrDefault(storage);
    if(!storage || typeof storage.setItem !== 'function') return { ok:false, error:'storage-unavailable' };
    const serialized = JSON.stringify(store);
    if(serialized.length > MAX_SERIALIZED_CHARS) return { ok:false, error:'queue-full' };
    try{
      storage.setItem(STORAGE_KEY, serialized);
      return { ok:true };
    }catch(error){ return { ok:false, error:'storage-failed' }; }
  }

  function enqueue(type, payload, ownerId, options){
    options = options || {};
    const clean = sanitize(type, payload);
    ownerId = safeId(ownerId);
    if(!clean || !ownerId) return { ok:false, error:'invalid-contribution' };
    const id = safeId(options.id) || newId(type, options.now, options.random);
    const store = load(options.storage);
    const existing = store.records.find(record => record.id === id && record.ownerId === ownerId);
    if(existing) return { ok:true, queued:true, created:false, record:existing };
    if(store.records.length >= MAX_RECORDS) return { ok:false, error:'queue-full' };
    const record = {
      version:SCHEMA_VERSION,
      id,
      ownerId,
      type,
      payload:clean,
      createdAt:Number(options.now) || Date.now(),
      status:'queued',
      attempts:0,
    };
    const next = { ...store, records:[...store.records, record] };
    const result = write(next, options.storage);
    return result.ok ? { ok:true, queued:true, created:true, record } : result;
  }

  function pending(ownerId, storage){
    ownerId = safeId(ownerId);
    return ownerId ? load(storage).records.filter(record => record.ownerId === ownerId) : [];
  }

  function remove(id, ownerId, storage){
    const store = load(storage);
    const records = store.records.filter(record => !(record.id === id && record.ownerId === ownerId));
    return write({ ...store, records }, storage);
  }

  async function syncPending(ownerId, senders, storage){
    const queue = pending(ownerId, storage);
    let synced = 0;
    for(const record of queue){
      const sender = senders && senders[record.type];
      if(typeof sender !== 'function') return { ok:false, error:'sender-unavailable', synced, pending:queue.length - synced };
      let result;
      try{ result = await sender(record.payload, record.id); }
      catch(error){ result = { ok:false }; }
      if(!(result && result.ok)){
        return { ok:false, error:'sync-failed', synced, pending:pending(ownerId, storage).length };
      }
      const removed = remove(record.id, ownerId, storage);
      if(!removed.ok) return { ok:false, error:removed.error, synced, pending:pending(ownerId, storage).length };
      synced += 1;
    }
    return { ok:true, synced, pending:pending(ownerId, storage).length };
  }

  async function syncBrowser(){
    const auth = root && root.DoloPawsAuth;
    const community = root && root.DoloPawsCommunity;
    const user = auth && auth.currentUser;
    if(!(user && community)) return { ok:false, error:'sync-unavailable', synced:0 };
    const result = await syncPending(user.uid, {
      review:(payload, id) => community.setReview(payload.trailId, payload.rating, payload.text, payload.hikedOn, { queueId:id, skipOfflineQueue:true }),
      hazard:(payload, id) => community.addFlag(payload.trailId, payload.type, payload.km, payload.text, { queueId:id, skipOfflineQueue:true }),
      photo:(payload, id) => community.addTrailPhoto(payload.trailId, payload.image, payload.caption, { queueId:id, skipOfflineQueue:true }),
    });
    if(root && typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function'){
      root.dispatchEvent(new root.CustomEvent('dolopaws-contribution-sync', { detail:result }));
    }
    return result;
  }

  if(root && root.document){
    root.addEventListener('online', syncBrowser);
    root.addEventListener('dolopaws-auth-ready', syncBrowser);
    root.addEventListener('dolopaws-auth-changed', event => {
      if(event && event.detail && event.detail.user) syncBrowser();
    });
  }

  return Object.freeze({
    STORAGE_KEY, SCHEMA_VERSION, MAX_RECORDS, MAX_SERIALIZED_CHARS, TYPES,
    sanitize, validRecord, load, enqueue, pending, remove, syncPending, syncBrowser,
  });
});
