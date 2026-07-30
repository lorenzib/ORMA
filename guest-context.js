(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsGuestContext = api;
  if(root && root.document) api.initBrowser(root);
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'dolopaws-pending-context-v1';
  const LEGACY_PROFILE_KEY = 'dolopaws-pending-dog-profile';
  const LEGACY_DRAFT_KEY = 'dolopaws-dog-draft';
  const MAX_AGE_MS = 30 * 60 * 1000;
  const ACTIONS = new Set(['save','download','review','photo','report','export-gpx']);
  const RETURN_PATTERN = /^(?:index|browse-trails|trail|compare|downloads|saved|account)\.html(?:\?[^#]*)?(?:#.*)?$/i;
  const TRAIL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,79}$/;
  const DISCOVERY_KEYS = [
    'search','region','risk','distance','water','collection','difficulty',
    'terrain','heat','exposure','access','verification','minMatch','dog','page',
  ];

  function json(storage, key){
    try { return JSON.parse(storage.getItem(key) || 'null'); }
    catch(error){ return null; }
  }

  function safeReturnTarget(value){
    const target = String(value || '');
    return RETURN_PATTERN.test(target) && !/^(?:[a-z]+:|\/\/|\/)/i.test(target)
      ? target : '';
  }

  function safeTrailId(value){
    const id = String(value || '');
    return TRAIL_ID_PATTERN.test(id) ? id : null;
  }

  function sanitizeDiscovery(value){
    const input = value && typeof value === 'object' ? value : {};
    const result = {};
    DISCOVERY_KEYS.forEach(key => {
      const raw = input[key];
      if(typeof raw === 'boolean') result[key] = raw;
      else if((typeof raw === 'string' || typeof raw === 'number') && String(raw).length <= 100){
        result[key] = raw;
      }
    });
    return result;
  }

  function sanitizeProfile(value){
    if(!value || typeof value !== 'object') return null;
    const clean = {
      name:String(value.name || '').trim().slice(0, 80),
      breed:String(value.breed || '').trim().slice(0, 100),
      fitness:['low','moderate','high'].includes(value.fitness) ? value.fitness : 'moderate',
      dob:/^\d{4}-\d{2}-\d{2}$/.test(String(value.dob || '')) ? value.dob : null,
      ageBand:String(value.ageBand || '').slice(0, 20) || null,
      weightBand:String(value.weightBand || '').slice(0, 20) || null,
      conditions:Array.isArray(value.conditions)
        ? value.conditions.map(item => String(item).slice(0, 40)).slice(0, 12)
        : [],
      healthNotes:String(value.healthNotes || '').slice(0, 500),
      jointIssues:!!value.jointIssues,
      heatIssues:!!value.heatIssues,
    };
    return clean.name ? clean : null;
  }

  function validRecord(value, now){
    if(!value || value.version !== VERSION || !Number.isFinite(value.createdAt)) return false;
    if((now || Date.now()) - value.createdAt > MAX_AGE_MS || value.createdAt > (now || Date.now()) + 60000){
      return false;
    }
    if(value.action !== null && !ACTIONS.has(value.action)) return false;
    if(value.returnTarget && !safeReturnTarget(value.returnTarget)) return false;
    if(value.trailId && !safeTrailId(value.trailId)) return false;
    if(value.dogDraft && !sanitizeProfile(value.dogDraft.profile)) return false;
    return true;
  }

  function load(storage, now){
    if(!storage || typeof storage.getItem !== 'function') return null;
    const value = json(storage, STORAGE_KEY);
    if(validRecord(value, now)) return value;
    try { storage.removeItem(STORAGE_KEY); } catch(error){}
    return null;
  }

  function save(storage, record){
    if(!storage || typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(record));
      return true;
    } catch(error){
      return false;
    }
  }

  function capture(storage, input, now){
    now = now || Date.now();
    input = input || {};
    const current = load(storage, now);
    const action = input.action === null || input.action === undefined
      ? current && current.action || null
      : ACTIONS.has(input.action) ? input.action : null;
    const record = {
      version:VERSION,
      createdAt:current ? current.createdAt : now,
      action,
      trailId:safeTrailId(input.trailId) || current && current.trailId || null,
      returnTarget:safeReturnTarget(input.returnTarget) || current && current.returnTarget || '',
      discovery:Object.keys(sanitizeDiscovery(input.discovery)).length
        ? sanitizeDiscovery(input.discovery)
        : current && current.discovery || {},
      dogDraft:input.dogDraft || current && current.dogDraft || null,
    };
    if(record.dogDraft){
      const profile = sanitizeProfile(record.dogDraft.profile);
      if(!profile) record.dogDraft = null;
      else record.dogDraft = {
        profile,
        updatedAt:Number(record.dogDraft.updatedAt) || now,
      };
    }
    return save(storage, record) ? record : null;
  }

  function consumeAction(storage, action, trailId, now){
    const record = load(storage, now);
    if(!record || record.action !== action) return null;
    if(record.trailId && record.trailId !== trailId) return null;
    const consumed = { action:record.action, trailId:record.trailId, returnTarget:record.returnTarget };
    record.action = null;
    if(record.dogDraft) save(storage, record);
    else {
      try { storage.removeItem(STORAGE_KEY); } catch(error){}
    }
    return consumed;
  }

  function clearDogDraft(storage, options, now){
    const record = load(storage, now);
    if(record){
      record.dogDraft = null;
      if(record.action) save(storage, record);
      else {
        try { storage.removeItem(STORAGE_KEY); } catch(error){}
      }
    }
    try {
      storage.removeItem(LEGACY_PROFILE_KEY);
      if(options && options.removeLocalDraft) storage.removeItem(LEGACY_DRAFT_KEY);
    } catch(error){}
  }

  function adoptLegacyDogDraft(storage, now){
    now = now || Date.now();
    const profile = sanitizeProfile(json(storage, LEGACY_PROFILE_KEY));
    const draft = json(storage, LEGACY_DRAFT_KEY);
    const updatedAt = draft && Number(draft.ts);
    if(!profile || !Number.isFinite(updatedAt) || now - updatedAt > MAX_AGE_MS || updatedAt > now + 60000){
      try { storage.removeItem(LEGACY_PROFILE_KEY); } catch(error){}
      return load(storage, now);
    }
    const record = capture(storage, {
      dogDraft:{ profile, updatedAt },
    }, now);
    if(record){
      try { storage.removeItem(LEGACY_PROFILE_KEY); } catch(error){}
    }
    return record;
  }

  function migrationState(record, existingProfile){
    if(!(record && record.dogDraft)) return { kind:'none' };
    if(existingProfile && (existingProfile.name || existingProfile.breed || existingProfile.photo)){
      return {
        kind:'conflict',
        draft:record.dogDraft.profile,
        existing:existingProfile,
      };
    }
    return { kind:'ready', draft:record.dogDraft.profile, existing:null };
  }

  function discoveryFromTarget(target){
    const safe = safeReturnTarget(target);
    if(!safe || !safe.startsWith('browse-trails.html')) return {};
    const query = safe.split('?')[1] || '';
    const params = new URLSearchParams(query.split('#')[0]);
    return sanitizeDiscovery(Object.fromEntries(params.entries()));
  }

  function browserContext(win, action, trailId){
    const params = new URLSearchParams(win.location.search);
    const current = win.location.pathname.split('/').pop() + win.location.search + win.location.hash;
    const requested = safeReturnTarget(params.get('next'));
    const from = safeReturnTarget(params.get('from'));
    const returnTarget = requested || safeReturnTarget(current);
    return {
      action:action || null,
      trailId:safeTrailId(trailId || params.get('id')),
      returnTarget,
      discovery:discoveryFromTarget(from || returnTarget),
    };
  }

  function initBrowser(win){
    const storage = win.localStorage;
    function captureCurrent(action, trailId){
      return capture(storage, browserContext(win, action, trailId));
    }

    win.document.addEventListener('click', event => {
      const account = event.target.closest && event.target.closest('#accountBtn');
      if(account && !(win.DoloPawsAuth && win.DoloPawsAuth.currentUser)) captureCurrent(null);
    }, true);

    function promptElement(){
      let prompt = win.document.getElementById('guestMigrationPrompt');
      if(prompt) return prompt;
      prompt = win.document.createElement('aside');
      prompt.id = 'guestMigrationPrompt';
      prompt.className = 'guest-migration-prompt';
      prompt.setAttribute('role', 'dialog');
      prompt.setAttribute('aria-labelledby', 'guestMigrationTitle');
      prompt.innerHTML =
        '<div><strong id="guestMigrationTitle"></strong><p id="guestMigrationCopy"></p>' +
        '<p id="guestMigrationStatus" role="status" aria-live="polite"></p></div>' +
        '<div class="guest-migration-actions"></div>';
      const style = win.document.createElement('style');
      style.textContent =
        '.guest-migration-prompt{position:fixed;right:18px;bottom:18px;z-index:120;width:min(430px,calc(100% - 28px));display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 18px;border:1px solid #d8d8cd;border-radius:15px;background:#fff;color:#2e4034;box-shadow:0 18px 48px rgba(23,40,29,.28);font-family:Inter,sans-serif}' +
        '.guest-migration-prompt strong{font-size:14px}.guest-migration-prompt p{margin:4px 0 0;color:#68746a;font-size:12px;line-height:1.45}.guest-migration-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.guest-migration-actions button{min-height:39px;padding:8px 11px;border:1px solid #cfd2ca;border-radius:9px;background:#fff;color:#2e4034;font:800 11.5px Inter,sans-serif;cursor:pointer}.guest-migration-actions button[data-migrate]{background:#2e4034;color:#fff}@media(max-width:560px){.guest-migration-prompt{right:14px;bottom:76px;display:block}.guest-migration-actions{margin-top:12px;justify-content:flex-start}}';
      win.document.head.appendChild(style);
      win.document.body.appendChild(prompt);
      return prompt;
    }

    async function showMigration(user){
      if(!user || !win.DoloPawsAuth) return;
      const record = load(storage);
      if(!(record && record.dogDraft)) return;
      let existing = null;
      try { existing = await win.DoloPawsAuth.getDogProfile(); } catch(error){}
      const state = migrationState(load(storage), existing);
      if(state.kind === 'none') return;
      const prompt = promptElement();
      const title = prompt.querySelector('#guestMigrationTitle');
      const copy = prompt.querySelector('#guestMigrationCopy');
      const status = prompt.querySelector('#guestMigrationStatus');
      const actions = prompt.querySelector('.guest-migration-actions');
      const draftName = state.draft.name || 'your dog';
      status.textContent = '';
      if(state.kind === 'conflict'){
        title.textContent = 'Your account profile was kept';
        copy.textContent = `${draftName} remains a device draft. It was not copied over ${
          state.existing.name || 'the newer account profile'
        }.`;
        actions.innerHTML = '<button type="button" data-keep-account>Discard device draft</button>' +
          '<button type="button" data-keep-device>Keep on this device</button>';
      }else{
        title.textContent = `Save ${draftName} to your account?`;
        copy.textContent = 'Nothing is copied until you choose Save. We will check the account again first.';
        actions.innerHTML = '<button type="button" data-migrate>Save dog profile</button>' +
          '<button type="button" data-keep-device>Keep on this device</button>';
      }
      const keepDevice = actions.querySelector('[data-keep-device]');
      keepDevice.addEventListener('click', () => {
        clearDogDraft(storage, { removeLocalDraft:false });
        prompt.remove();
      });
      const discard = actions.querySelector('[data-keep-account]');
      if(discard) discard.addEventListener('click', () => {
        clearDogDraft(storage, { removeLocalDraft:true });
        prompt.remove();
      });
      const migrate = actions.querySelector('[data-migrate]');
      if(migrate) migrate.addEventListener('click', async () => {
        migrate.disabled = true;
        status.textContent = 'Checking your account…';
        const latest = await win.DoloPawsAuth.getDogProfile();
        if(latest && (latest.name || latest.breed || latest.photo)){
          status.textContent = 'An account profile now exists, so the device draft was not copied.';
          migrate.remove();
          return;
        }
        const ok = await win.DoloPawsAuth.setDogProfile(state.draft);
        if(!ok){
          status.textContent = 'The profile could not be saved. Your device draft is unchanged.';
          migrate.disabled = false;
          return;
        }
        clearDogDraft(storage, { removeLocalDraft:true });
        status.textContent = `${draftName} was saved to your account.`;
        win.dispatchEvent(new CustomEvent('dolopaws-dog-profile-saved', {
          detail:{ profile:state.draft },
        }));
        setTimeout(() => prompt.remove(), 2200);
      });
    }

    function authChanged(event){
      adoptLegacyDogDraft(storage);
      const user = event && event.detail && event.detail.user;
      if(user) showMigration(user);
    }
    win.addEventListener('dolopaws-auth-changed', authChanged);

    win.DoloPawsGuestContext.captureCurrent = captureCurrent;
  }

  return {
    VERSION,
    STORAGE_KEY,
    MAX_AGE_MS,
    ACTIONS,
    safeReturnTarget,
    sanitizeDiscovery,
    sanitizeProfile,
    load,
    capture,
    consumeAction,
    clearDogDraft,
    adoptLegacyDogDraft,
    migrationState,
    discoveryFromTarget,
    browserContext,
    initBrowser,
  };
});
