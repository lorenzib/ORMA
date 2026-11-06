(function(root){
  'use strict';

  // SOCIAL-01 one-tap "We walked this". A GPS hike finished in hike mode was
  // the only way a walk reached the anonymous trailWalks tally, and in eight
  // weeks none did (23 starts, 0 completions). A tap on the trail page writes
  // the same anonymous event -- server time plus the dog's coarse FCI group --
  // so the tally can fill without anyone recording a track.
  //
  // One walk per trail per day per browser. This only stops a double tap or a
  // tap after a recorded hike from counting twice; the aggregate that reads
  // the tally must still treat the counts as unverified.

  const STORAGE_KEY = 'orma-walked-this-v1';
  const KEEP_DAYS = 30;

  function safeStorage(storage){
    if(storage) return storage;
    try {
      return root.localStorage;
    } catch (error) {
      return null;
    }
  }

  // The walker's own calendar day, not UTC: a walk at 00:30 in the Dolomites
  // belongs to that morning.
  function dayKey(now){
    const date = new Date(now);
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function read(storage){
    const store = safeStorage(storage);
    if(!store) return {};
    try {
      const value = JSON.parse(store.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      return {};
    }
  }

  function walkedToday(trailId, options){
    const opts = options || {};
    return read(opts.storage)[String(trailId)] === dayKey(opts.now == null ? Date.now() : opts.now);
  }

  function markWalked(trailId, options){
    const opts = options || {};
    const store = safeStorage(opts.storage);
    if(!store) return false;
    const now = opts.now == null ? Date.now() : opts.now;
    const oldest = dayKey(now - KEEP_DAYS * 86400000);
    const kept = {};
    for(const [id, day] of Object.entries(read(store))){
      if(typeof day === 'string' && day >= oldest) kept[id] = day;
    }
    kept[String(trailId)] = dayKey(now);
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(kept));
      return true;
    } catch (error) {
      return false;
    }
  }

  // The active dog's coarse FCI group, the only thing the tally keeps about a
  // dog. Shared with hike mode so a tap and a recorded hike tag alike.
  function activeDogGroup(storage){
    const store = safeStorage(storage);
    try {
      const raw = JSON.parse((store && store.getItem('dolopaws-profile-summary')) || 'null');
      const active = raw && Array.isArray(raw.dogs)
        ? raw.dogs.find(dog => dog.id === raw.activeDogId) || raw.dogs[0]
        : null;
      const breed = (active && active.breed) || (raw && raw.breed) || '';
      return typeof root.breedGroupId === 'function' ? root.breedGroupId(breed) : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  // Resolves to 'recorded', 'already' (counted today), 'unavailable' (the
  // community service never loaded) or 'failed' (the write was refused or the
  // walker is offline). Only 'recorded' marks the day, so a failed tap can be
  // tried again.
  async function record(trailId, group, options){
    const opts = options || {};
    if(!trailId) return 'failed';
    if(walkedToday(trailId, opts)) return 'already';
    const community = opts.community;
    if(!community || typeof community.recordTrailWalk !== 'function') return 'unavailable';
    let ok = false;
    try {
      ok = await community.recordTrailWalk(trailId, group || 'unknown');
    } catch (error) {
      ok = false;
    }
    if(!ok) return 'failed';
    markWalked(trailId, opts);
    return 'recorded';
  }

  const api = { STORAGE_KEY, dayKey, walkedToday, markWalked, activeDogGroup, record };
  root.DoloPawsWalkedThis = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
