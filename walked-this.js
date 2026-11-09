(function(root){
  'use strict';

  // SOCIAL-01 anonymous walk tally: a recorded hike that GPS proves
  // (walk-proof.js) writes one anonymous event -- server time plus the dog's
  // coarse FCI group -- to trailWalks. SOCIAL-04 removed the one-tap "We
  // walked this": proof comes from recording, so this keeps only the dog's
  // group, which hike mode tags the event with.

  function safeStorage(storage){
    if(storage) return storage;
    try {
      return root.localStorage;
    } catch (error) {
      return null;
    }
  }

  // The active dog's coarse FCI group, the only thing the tally keeps about a
  // dog.
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

  const api = { activeDogGroup };
  root.DoloPawsWalkedThis = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
