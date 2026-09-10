(function(global){
  const PENDING_AUTH_ACTION_KEY = 'dolopaws-pending-auth-action';
  const GUEST_TRAIL_CONTEXT_KEY = 'dolopaws-guest-trail-context';

  function getStorage(storageName){
    try{
      return global[storageName] || null;
    }catch(err){
      return null;
    }
  }

  function readJson(storageName, key){
    const storage = getStorage(storageName);
    if(!storage) return null;
    try{
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(err){
      return null;
    }
  }

  function writeJson(storageName, key, value){
    const storage = getStorage(storageName);
    if(!storage) return false;
    try{
      storage.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      return false;
    }
  }

  function removeItem(storageName, key){
    const storage = getStorage(storageName);
    if(!storage) return;
    try{
      storage.removeItem(key);
    }catch(err){}
  }

  function rememberPendingAuthAction(action){
    writeJson('sessionStorage', PENDING_AUTH_ACTION_KEY, action);
  }

  function consumePendingAuthAction(){
    const action = readJson('sessionStorage', PENDING_AUTH_ACTION_KEY);
    removeItem('sessionStorage', PENDING_AUTH_ACTION_KEY);
    return action;
  }

  function rememberGuestTrailContext(context){
    writeJson('localStorage', GUEST_TRAIL_CONTEXT_KEY, context);
  }

  function loadGuestTrailContext(){
    return readJson('localStorage', GUEST_TRAIL_CONTEXT_KEY);
  }

  const api = {
    rememberPendingAuthAction,
    consumePendingAuthAction,
    rememberGuestTrailContext,
    loadGuestTrailContext,
  };

  global.DoloPawsGuestSession = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
