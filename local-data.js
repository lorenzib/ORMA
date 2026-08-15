(function(root){
  'use strict';

  const PRIVATE_EXACT_KEYS = new Set([
    'dolopaws-active-hike-v1',
    'dolopaws-hike-completions-v1',
    'dolopaws-post-hike-outcomes-v1',
    'dolopaws-offline-contributions-v1',
    'dolopaws-profile-summary',
    'dolopaws-dog-photo',
    'dolopaws-notif-prefs',
    'dolopaws-notif-seen',
    'dolopaws-notif-glanced',
    'dolopaws-notif-unread',
    'dolopaws-notif-profile-event',
    'dolopaws-notifications-read',
    'dolopaws-pending-dog-profile',
    'dolopaws-dog-draft',
    'dolopaws-pending-context-v1',
    'dolopaws-guest-trail-context',
    'dolopaws-comparison-v1',
    'dolopaws-metrics-v1',
  ]);
  const PRIVATE_PREFIXES = Object.freeze([
    'dolopaws-dog-photo-',
    'dolopaws-design-reviews-',
    'dolopaws-design-reports',
    'dolopaws-funnel-v1:',
    'dolopaws-parkstart-',
    'dolopaws-journal-',
  ]);

  function storageKeys(storage){
    const keys = [];
    if(!storage) return keys;
    try{
      for(let index = 0; index < storage.length; index += 1){
        const key = storage.key(index);
        if(key) keys.push(key);
      }
    }catch(error){ /* inaccessible storage behaves as empty */ }
    return keys;
  }

  function isPrivateKey(key){
    return PRIVATE_EXACT_KEYS.has(key) ||
      PRIVATE_PREFIXES.some(prefix => key.startsWith(prefix));
  }

  function clearMatching(storage, predicate){
    let removed = 0;
    storageKeys(storage).forEach(key => {
      if(!predicate(key)) return;
      try{
        storage.removeItem(key);
        removed += 1;
      }catch(error){ /* continue clearing other ORMA records */ }
    });
    return removed;
  }

  function activeHike(){
    try{
      const value = JSON.parse(root.localStorage.getItem('dolopaws-active-hike-v1') || 'null');
      if(!value || !['active', 'paused', 'completion-pending'].includes(value.state)) return null;
      return {
        trailId:String(value.trailId || ''),
        state:value.state,
        updatedAt:Number(value.updatedAt) || null,
      };
    }catch(error){
      return null;
    }
  }

  async function cleanup(options){
    const removePackages = !!(options && options.removePackages);
    const removedLocal = clearMatching(
      root.localStorage,
      removePackages ? key => key.startsWith('dolopaws-') : isPrivateKey
    );
    const removedSession = clearMatching(
      root.sessionStorage,
      key => key.startsWith('dolopaws-')
    );
    if(removePackages){
      if(root.DoloPawsOffline && typeof root.DoloPawsOffline.removeAllPackages === 'function'){
        await root.DoloPawsOffline.removeAllPackages();
      }else{
        clearMatching(root.localStorage, key =>
          key.startsWith('dolopaws-offline:') || key === 'dolopaws-offline-owner-salt'
        );
      }
    }
    return { removePackages, removedLocal, removedSession };
  }

  root.DoloPawsLocalData = Object.freeze({
    activeHike,
    cleanup,
    isPrivateKey,
  });
})(typeof window !== 'undefined' ? window : globalThis);
