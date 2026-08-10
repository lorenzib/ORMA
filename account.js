/**
 * account.js — tabbed edit-profile screen (Dog / Human / Vet / Settings).
 *
 * The whole dog profile lives in one Firestore object (users/{uid} → dog),
 * loaded once into `state` and written back on Save. New design fields
 * (size, neuter, coat, sens, vet, owner) ride along in the same object;
 * the fields the trail scorer reads (breed, fitness, dob, ageBand,
 * weightBand, conditions, healthNotes — see SCORING.md) are kept filled,
 * with sens heat/joints mirrored into conditions so scoring keeps working.
 */
(function(){
  const $ = id => document.getElementById(id);

  const subline = $('accountSubline');
  const loggedOutState = $('loggedOutState');
  const loggedInState = $('loggedInState');

  // ---------- Return target ----------
  const requestedNext = new URLSearchParams(window.location.search).get('next');
  const accountParams = new URLSearchParams(window.location.search);
  const addMode = accountParams.get('mode') === 'add';
  const requestedDogId = accountParams.get('dog');
  function safeReturnTarget(value){
    if(!value || /^(?:[a-z]+:|\/\/|\/)/i.test(value)) return '';
    return /^[a-z0-9][a-z0-9._/-]*\.html(?:\?[^#]*)?(?:#.*)?$/i.test(value) ? value : '';
  }
  const returnTarget = safeReturnTarget(requestedNext);
  const backHref = returnTarget || 'index.html';
  $('backLink').href = backHref;
  $('backLink').textContent = returnTarget ? '← Back' : '← Back to trails';
  const mobileBackLink = $('mobileBackLink');
  if(mobileBackLink) mobileBackLink.href = backHref;

  const accountLoginLink = $('accountLoginLink');
  if(accountLoginLink){
    const accountReturn = 'account.html' + (returnTarget ? '?next=' + encodeURIComponent(returnTarget) : '');
    accountLoginLink.href = 'index.html?login=1&next=' + encodeURIComponent(accountReturn);
  }

  function tKey(key, fallback){
    if(!window.t) return fallback;
    const s = window.t(key);
    return s === key ? fallback : s;
  }

  // ---------- Profile state ----------
  // `base` is the profile exactly as loaded, so saving preserves fields this
  // screen doesn't edit (fitness, legacy ageBand, …). `state` is what the
  // form shows.
  let base = {};
  let dogProfiles = [];
  let activeDogId = null;
  let designValues = null;
  const state = {
    name:'', breed:'', dob:'', weight:20, size:'Large',
    neuter:'Unknown', coat:'Short', sens:[], photo:null,
    vetName:'', vetPhone:'', chip:'', insurer:'', policy:'', medical:'',
    ownerName:'', ownerPhone:'', ownerEmail:'', emName:'', emPhone:'',
  };

  function accountHref(params){
    const next = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => { if(value) next.set(key, value); });
    if(returnTarget) next.set('next', returnTarget);
    const query = next.toString();
    return 'account.html' + (query ? '?' + query : '');
  }

  function renderDogSwitcher(){
    const list = $('profileDogList');
    if(!list) return;
    list.innerHTML = '';
    dogProfiles.forEach(dog => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'profile-dogchoice' + (!addMode && dog.id === activeDogId ? ' on' : '');
      button.setAttribute('aria-pressed', String(!addMode && dog.id === activeDogId));
      const avatar = document.createElement('span');
      avatar.className = 'profile-dogchoice__avatar';
      if(typeof dog.photo === 'string' && dog.photo.startsWith('data:image/')) avatar.style.backgroundImage = `url(${dog.photo})`;
      else avatar.textContent = (dog.name || 'D').charAt(0).toUpperCase();
      const name = document.createElement('span');
      name.textContent = dog.name || 'Your dog';
      button.append(avatar, name);
      button.addEventListener('click', async () => {
        if(!window.DoloPawsAuth || dog.id === activeDogId && !addMode) return;
        button.disabled = true;
        const ok = await window.DoloPawsAuth.selectDogProfile(dog.id);
        if(ok) window.location.assign(accountHref({ dog:dog.id }));
        else button.disabled = false;
      });
      list.appendChild(button);
    });
    if(addMode){
      const adding = document.createElement('span');
      adding.className = 'profile-dogchoice on';
      adding.textContent = 'New dog';
      list.appendChild(adding);
    }
    const add = $('profileAddDog');
    if(add){
      add.disabled = addMode || dogProfiles.length >= 5;
      add.textContent = dogProfiles.length >= 5 ? 'Maximum 5 dogs' : addMode ? 'Adding a new dog' : '+ Add another dog';
      add.onclick = () => window.location.assign(accountHref({ mode:'add' }));
    }
    const canRemoveDog = !addMode && dogProfiles.length > 1;
    const removeBlock = $('removeDogBlock');
    const profileRemove = $('profileRemoveDog');
    if(removeBlock) removeBlock.hidden = !canRemoveDog;
    if(profileRemove) profileRemove.hidden = !canRemoveDog;
  }

  // ---------- Tabs ----------
  const railBtns = Array.from(document.querySelectorAll('.railbtn'));
  function pickTab(id){
    railBtns.forEach(b => {
      const selected = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
    ['dog','human','health','account'].forEach(t => { $('tab-' + t).hidden = t !== id; });
    syncSettingsToc(id === 'account');
  }
  railBtns.forEach((b, index) => {
    b.addEventListener('click', () => pickTab(b.dataset.tab));
    b.addEventListener('keydown', event => {
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if(event.key === 'Home') next = 0;
      else if(event.key === 'End') next = railBtns.length - 1;
      else if(event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + railBtns.length) % railBtns.length;
      else next = (index + 1) % railBtns.length;
      pickTab(railBtns[next].dataset.tab);
      railBtns[next].focus();
    });
  });

  // ---------- Settings table of contents ----------
  // Desktop: sticky sub-links in the rail that scroll-jump to a subsection
  // and highlight the one in view. Phones: a "Jump to" dropdown at the top
  // of the panel instead (the pill row read badly at that width).
  const settingsToc = document.getElementById('settingsToc');
  const tocLinks = settingsToc ? Array.from(settingsToc.querySelectorAll('a[data-sec]')) : [];
  const acctJump = document.getElementById('acctJump');
  const acctJumpBtn = document.getElementById('acctJumpBtn');
  const acctJumpMenu = document.getElementById('acctJumpMenu');
  const acctJumpLabel = document.getElementById('acctJumpLabel');

  function setActiveSec(id){
    tocLinks.forEach(a => a.classList.toggle('on', a.dataset.sec === id));
    if(acctJumpMenu){
      Array.from(acctJumpMenu.children).forEach(b => b.classList.toggle('on', b.dataset.sec === id));
    }
    const link = tocLinks.find(a => a.dataset.sec === id);
    if(acctJumpLabel && link) acctJumpLabel.textContent = link.textContent;
  }
  function jumpToSec(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.scrollIntoView({ behavior:'smooth', block:'start' });
    setActiveSec(id);
    setJumpOpen(false);
  }
  function setJumpOpen(open){
    if(!acctJumpMenu) return;
    acctJumpMenu.hidden = !open;
    if(acctJumpBtn) acctJumpBtn.setAttribute('aria-expanded', String(open));
  }
  function syncSettingsToc(on){
    if(settingsToc) settingsToc.hidden = !on;
    if(acctJump) acctJump.hidden = !on;
    if(!on) setJumpOpen(false);
  }
  tocLinks.forEach(a => a.addEventListener('click', e => { e.preventDefault(); jumpToSec(a.dataset.sec); }));
  if(acctJumpMenu){
    tocLinks.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.sec = a.dataset.sec;
      b.textContent = a.textContent;
      b.addEventListener('click', () => jumpToSec(a.dataset.sec));
      acctJumpMenu.appendChild(b);
    });
  }
  if(acctJumpBtn) acctJumpBtn.addEventListener('click', e => { e.stopPropagation(); setJumpOpen(acctJumpMenu.hidden); });
  document.addEventListener('click', e => { if(acctJump && !acctJump.contains(e.target)) setJumpOpen(false); });
  // Highlight the section currently in view while the Settings tab is open.
  window.addEventListener('scroll', () => {
    const tab = document.getElementById('tab-account');
    if(!tab || tab.hidden || !tocLinks.length) return;
    let current = tocLinks[0].dataset.sec;
    tocLinks.forEach(a => {
      const el = document.getElementById(a.dataset.sec);
      if(el && el.getBoundingClientRect().top <= 220) current = a.dataset.sec;
    });
    setActiveSec(current);
  }, { passive:true });

  // ---------- Simple two-way field bindings ----------
  const FIELD_BINDINGS = [
    ['dogName','name'], ['dogDob','dob'],
    ['vetName','vetName'], ['vetPhone','vetPhone'], ['dogChip','chip'],
    ['insurer','insurer'], ['policy','policy'], ['medicalNotes','medical'],
    ['ownerName','ownerName'], ['ownerEmail','ownerEmail'], ['ownerPhone','ownerPhone'],
    ['emName','emName'], ['emPhone','emPhone'],
  ];
  FIELD_BINDINGS.forEach(([id, key]) => {
    $(id).addEventListener('input', e => { state[key] = e.target.value; renderDerived(); });
  });
  $('dogDob').max = new Date().toISOString().slice(0, 10);

  // ---------- Option groups ----------
  const SIZES = [
    ['Small','Under 10 kg'], ['Medium','10–25 kg'],
    ['Large','25–40 kg'], ['Extra large','Over 40 kg'],
  ];
  const NEUTER = ['Neutered','Not neutered','Unknown'];
  const COATS = ['Short','Medium','Long','Double','Curly','Hairless'];
  const SENS = [
    { id:'heat', icon:'☀️', label:'Heat-sensitive', sub:'Struggles in warm weather' },
    { id:'paws', icon:'🐾', label:'Sensitive paws', sub:'Avoid rocky or hot ground' },
    { id:'reactive', icon:'🦴', label:'Reactive to dogs', sub:'Prefers quieter trails' },
    { id:'joints', icon:'🦳', label:'Senior / joints', sub:'Gentler climbs and distance' },
    { id:'water', icon:'💧', label:'Loves water', sub:'Prioritize lakes & streams' },
  ];

  function renderOptions(){
    $('sizeGrid').innerHTML = '';
    SIZES.forEach(([label, sub]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'optbtn' + (state.size === label ? ' on' : '');
      b.innerHTML = '<div class="t"></div><div class="s"></div>';
      b.querySelector('.t').textContent = label;
      b.querySelector('.s').textContent = sub;
      b.addEventListener('click', () => { state.size = label; renderOptions(); });
      $('sizeGrid').appendChild(b);
    });
    $('neuterRow').innerHTML = '';
    NEUTER.forEach(label => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'segbtn' + (state.neuter === label ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => { state.neuter = label; renderOptions(); });
      $('neuterRow').appendChild(b);
    });
    $('coatRow').innerHTML = '';
    COATS.forEach(label => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chipbtn' + (state.coat === label ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => { state.coat = label; renderOptions(); });
      $('coatRow').appendChild(b);
    });
    $('sensGrid').innerHTML = '';
    SENS.forEach(o => {
      const on = state.sens.includes(o.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sensbtn' + (on ? ' on' : '');
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = '<span class="ico"></span><div style="flex:1;"><div style="font-size:13px;font-weight:800;color:var(--ink);" class="t"></div><div style="font-size:11px;color:#8A9689;margin-top:1px;" class="s"></div></div><span class="chk"></span>';
      b.querySelector('.ico').textContent = o.icon;
      b.querySelector('.t').textContent = o.label;
      b.querySelector('.s').textContent = o.sub;
      b.querySelector('.chk').textContent = on ? '✓' : '';
      b.addEventListener('click', () => {
        state.sens = on ? state.sens.filter(x => x !== o.id) : state.sens.concat(o.id);
        renderOptions();
      });
      $('sensGrid').appendChild(b);
    });
  }

  // ---------- Weight slider ----------
  $('dogWeight').addEventListener('input', e => { state.weight = +e.target.value; renderDerived(); });

  // ---------- Breed autocomplete ----------
  const breedInput = $('dogBreed');
  const breedList = $('breedList');
  function allBreeds(){ return (typeof DOG_BREEDS !== 'undefined') ? DOG_BREEDS : []; }
  function renderBreedList(){
    const ALL = allBreeds();
    $('breedHint').textContent = 'Search ' + ALL.length + ' breeds — or type your own';
    const q = state.breed.trim().toLowerCase();
    const exact = ALL.some(b => b.toLowerCase() === q);
    let matches = [];
    if(q.length >= 1 && !exact){
      const starts = ALL.filter(b => b.toLowerCase().startsWith(q));
      const contains = ALL.filter(b => !b.toLowerCase().startsWith(q) && b.toLowerCase().includes(q));
      matches = starts.concat(contains).slice(0, 8);
    }
    breedList.innerHTML = '';
    matches.forEach(name => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:9px 12px;border-radius:8px;font-size:14px;color:var(--ink);cursor:pointer;';
      d.textContent = name;
      d.addEventListener('mouseenter', () => d.style.background = '#F0EDE1');
      d.addEventListener('mouseleave', () => d.style.background = '');
      // mousedown fires before the input's blur, so the pick isn't lost
      d.addEventListener('mousedown', () => {
        state.breed = name;
        breedInput.value = name;
        breedList.hidden = true;
        renderDerived();
      });
      breedList.appendChild(d);
    });
    breedList.hidden = matches.length === 0 || document.activeElement !== breedInput;
  }
  breedInput.addEventListener('input', e => { state.breed = e.target.value; renderBreedList(); renderDerived(); });
  breedInput.addEventListener('focus', renderBreedList);
  breedInput.addEventListener('blur', () => { window.setTimeout(() => { breedList.hidden = true; }, 120); });

  // ---------- Derived text: headings, age, weight, emergency card ----------
  function ageMonthsFrom(dob){
    if(!dob) return null;
    const b = new Date(dob), n = new Date();
    if(isNaN(b)) return null;
    let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
    if(n.getDate() < b.getDate()) m--;
    return Math.max(0, m);
  }
  function joinBits(bits, empty){ const s = bits.filter(Boolean).join(' · '); return s || empty; }

  function renderDerived(){
    const nm = state.name.trim();
    const displayName = nm || 'Your dog';
    $('dogDisplayName').textContent = displayName;
    document.querySelectorAll('.removeDogName').forEach(el => { el.textContent = nm || 'this dog'; });

    const m = ageMonthsFrom(state.dob);
    $('ageHint').textContent = m == null ? 'Add a birthday to estimate age'
      : m < 12 ? m + ' month' + (m === 1 ? '' : 's') + ' old'
      : Math.floor(m / 12) + ' year' + (Math.floor(m / 12) === 1 ? '' : 's') + ' old';
    $('weightLabel').textContent = state.weight + ' kg';

    // Photo circle + card avatar: photo wins, else the name's initial.
    const initial = (nm || 'D').charAt(0).toUpperCase();
    [$('dogPhotoBtn'), $('cardPhoto')].forEach(el => {
      el.style.backgroundImage = state.photo ? 'url(' + state.photo + ')' : 'none';
      el.textContent = state.photo ? '' : initial;
    });

    // Emergency card preview
    $('cardName').textContent = displayName;
    $('cardBreed').textContent = state.breed.trim() || '—';
    $('cardChip').textContent = state.chip.trim() || 'Not recorded';
    $('cardMedical').textContent = state.medical.trim() || 'None noted';
    $('cardVet').textContent = joinBits([state.vetName.trim(), state.vetPhone.trim()], 'Not recorded');
    $('cardOwner').textContent = joinBits([state.ownerName.trim(), state.ownerPhone.trim(), state.ownerEmail.trim()], '—');
    $('cardEmergency').textContent = joinBits([state.emName.trim(), state.emPhone.trim()], 'Not set');

    // A dog profile can be saved with dog information alone, matching the
    // homepage wizard. Human and emergency-contact details are optional and
    // must never silently block the visible profile editor.
    $('ownerName').style.borderColor = '';
    $('ownerEmail').style.borderColor = '';
    const missingDog = nm.length === 0;
    const disabled = missingDog;
    document.querySelectorAll('.saveBtn').forEach(b => { b.disabled = disabled; });
    const profileSave = $('profileSave');
    if(profileSave) profileSave.disabled = disabled;
    document.querySelectorAll('.saveHint').forEach(h => {
      h.hidden = !disabled;
      h.textContent = "Add your dog's name first.";
    });
  }

  // ---------- Photo upload (downscaled thumbnail, synced to the account) ----
  // Same approach as before this redesign: shrink to ~300 px JPEG in the
  // browser so it fits comfortably in the user's Firestore doc, cache it in
  // localStorage per uid for instant paint.
  const LEGACY_PHOTO_KEY = 'dolopaws-dog-photo';
  const PHOTO_INPUT_MAX_BYTES = 8 * 1024 * 1024;
  const PHOTO_MAX_PX = 300;
  const dogPhotoInput = $('dogPhotoInput');
  const dogPhotoStatus = $('dogPhotoStatus');

  function photoCacheKey(){
    const u = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    const dogKey = addMode ? 'new' : (activeDogId || 'new');
    return u ? 'dolopaws-dog-photo-' + u.uid + '-' + dogKey : null;
  }
  function photoStatus(text, ok){
    dogPhotoStatus.hidden = false;
    dogPhotoStatus.style.color = ok ? '#2C5C34' : '#9C3A25';
    dogPhotoStatus.textContent = text;
  }
  function downscalePhoto(file){
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  $('dogPhotoBtn').addEventListener('click', () => dogPhotoInput.click());
  dogPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(!file.type.startsWith('image/')){
      photoStatus(tKey('account.photo.typeError', 'Please select an image file.'), false);
      dogPhotoInput.value = '';
      return;
    }
    if(file.size > PHOTO_INPUT_MAX_BYTES){
      photoStatus(tKey('account.photo.sizeError', 'Photo must be smaller than 8 MB.'), false);
      dogPhotoInput.value = '';
      return;
    }
    dogPhotoStatus.hidden = true;
    downscalePhoto(file).then((dataUrl) => {
      state.photo = dataUrl;
      renderDerived();
      const key = photoCacheKey();
      try { if(key) localStorage.setItem(key, dataUrl); } catch (err) { /* cache only */ }
      if(!addMode && window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
        window.DoloPawsAuth.setDogProfile({ photo: dataUrl }).then((ok) => {
          photoStatus(ok
            ? tKey('account.photo.synced', 'Photo saved to your account — it will show on any device you log in from.')
            : tKey('account.photo.localOnly', "Photo saved on this device — couldn't reach your account just now."), ok);
        });
      }
    }).catch(() => {
      photoStatus(tKey('account.photo.typeError', 'Please select an image file.'), false);
      dogPhotoInput.value = '';
    });
  });

  // ---------- Save / cancel / remove ----------
  const saveStatus = $('saveStatus');

  function weightBandFromKg(kg){
    if(kg == null) return null;
    if(kg < 5) return 'u5';
    if(kg < 10) return '5-10';
    if(kg < 15) return '10-15';
    if(kg < 20) return '15-20';
    if(kg < 30) return '20-30';
    if(kg < 40) return '30-40';
    if(kg < 55) return '40-55';
    return '55plus';
  }

  function buildProfile(){
    const m = ageMonthsFrom(state.dob);
    // Scoring reads `conditions`; the design's sensitivities cover heat and
    // joints, so mirror those two in and keep any other declared conditions
    // (back, cardiac, …) a user saved before this redesign.
    const sourceConditions = designValues && Array.isArray(designValues.conditions)
      ? designValues.conditions : (Array.isArray(base.conditions) ? base.conditions : []);
    const kept = sourceConditions.filter(c => c !== 'heat' && c !== 'joints');
    const conditions = designValues
      ? sourceConditions
      : kept.concat(state.sens.includes('heat') ? ['heat'] : [])
        .concat(state.sens.includes('joints') ? ['joints'] : []);
    return Object.assign({}, base, {
      name: state.name.trim(),
      breed: state.breed.trim(),
      fitness: designValues && designValues.fitness || base.fitness || 'moderate',
      dob: state.dob || null,
      ageBand: state.dob ? null : (designValues && designValues.ageBand || base.ageBand || null),
      weight: state.weight,
      weightBand: designValues && designValues.weightBand || weightBandFromKg(state.weight),
      size: state.size,
      neuter: state.neuter,
      coat: state.coat,
      sens: state.sens,
      photo: state.photo || null,
      conditions: conditions,
      healthNotes: state.medical.trim(),
      vet: { name: state.vetName.trim(), phone: state.vetPhone.trim(), chip: state.chip.trim(), insurer: state.insurer.trim(), policy: state.policy.trim() },
      owner: { name: state.ownerName.trim(), phone: state.ownerPhone.trim(), email: state.ownerEmail.trim(), emName: state.emName.trim(), emPhone: state.emPhone.trim() },
      // Legacy mirrors so any cached older script keeps working.
      age: m == null ? null : Math.round((m / 12) * 10) / 10,
      jointIssues: conditions.includes('joints'),
      heatIssues: conditions.includes('heat'),
    });
  }

  window.addEventListener('dolopaws-profile-design-values', event => {
    designValues = event.detail || null;
  });

  document.querySelectorAll('.saveBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!window.DoloPawsAuth || btn.disabled) return;
      const label = btn.textContent; // "Save changes", or "Save" on the phone app bar
      btn.textContent = 'Saving…';
      const ok = addMode
        ? await window.DoloPawsAuth.addDogProfile(buildProfile())
        : await window.DoloPawsAuth.setDogProfile(buildProfile());
      btn.textContent = label;
      saveStatus.hidden = false;
      saveStatus.style.color = ok ? '#2C5C34' : '#9C3A25';
      window.dispatchEvent(new CustomEvent('dolopaws-account-save-result', {
        detail:{ ok, addMode }
      }));
      if(ok && returnTarget){
        saveStatus.textContent = 'Saved. Returning you to where you were…';
        window.setTimeout(() => window.location.assign(returnTarget), 500);
      } else if(ok && addMode){
        saveStatus.textContent = 'Dog added. Opening the new profile…';
        window.setTimeout(() => window.location.assign(accountHref({})), 400);
      } else if(ok){
        saveStatus.innerHTML = 'Saved. <a href="index.html" style="font-weight:700;">View your personalised trails →</a>';
        base = buildProfile();
      } else {
        saveStatus.textContent = 'Something went wrong — please try again.';
      }
    });
  });

  document.querySelectorAll('.cancelBtn').forEach(btn => {
    btn.addEventListener('click', () => window.location.assign(backHref));
  });

  $('removeDogBtn').addEventListener('click', async () => {
    const nm = state.name.trim() || 'this dog';
    if(!window.confirm('Remove ' + nm + "? This permanently deletes the profile and all its data — photo, health, vet and emergency details.")) return;
    if(!window.DoloPawsAuth) return;
    const ok = await window.DoloPawsAuth.removeDogProfile(base.id || activeDogId);
    const key = photoCacheKey();
    try {
      if(key) localStorage.removeItem(key);
      localStorage.removeItem(LEGACY_PHOTO_KEY);
    } catch(e){}
    if(ok){
      window.location.assign(accountHref({}));
    } else {
      saveStatus.hidden = false;
      saveStatus.style.color = '#9C3A25';
      saveStatus.textContent = 'Something went wrong — please try again.';
    }
  });

  // ---------- Share card ----------
  $('shareCardBtn').addEventListener('click', async () => {
    const nm = state.name.trim() || 'This dog';
    const text = nm + ' — DoloPaws emergency card'
      + '\nBreed: ' + (state.breed.trim() || '—')
      + '\nMicrochip: ' + (state.chip.trim() || '—')
      + '\nMedical: ' + (state.medical.trim() || 'None')
      + '\nOwner: ' + [state.ownerName.trim() || '—', state.ownerPhone.trim(), state.ownerEmail.trim()].filter(Boolean).join(' ')
      + '\nEmergency: ' + [state.emName.trim() || '—', state.emPhone.trim()].filter(Boolean).join(' ')
      + '\nVet: ' + [state.vetName.trim() || '—', state.vetPhone.trim()].filter(Boolean).join(' ');
    const status = $('shareStatus');
    try {
      if(navigator.share){
        await navigator.share({ title: nm + ' — emergency card', text: text });
      } else if(navigator.clipboard){
        await navigator.clipboard.writeText(text);
        status.hidden = false;
        status.textContent = 'Copied to clipboard.';
        window.setTimeout(() => { status.hidden = true; }, 2500);
      }
    } catch(e){ /* user dismissed the share sheet */ }
  });

  // ---------- Settings: notifications (device-level preferences) ----------
  const NOTIF_KEY = 'dolopaws-notif-prefs';
  const NOTIF_OPTIONS = [
    ['hazards', 'Hazard alerts', 'New hazards flagged on trails you follow', true],
    ['weather', 'Heat & weather warnings', 'When conditions turn risky for your dog', true],
    ['recs', 'Trail recommendations', 'Fresh walks matched to your dog', true],
    ['community', 'Community replies', 'Replies to your reviews and reports', false],
    ['news', 'Product news', 'Occasional updates and tips by email', false],
  ];
  function loadNotifPrefs(){
    const defaults = {};
    NOTIF_OPTIONS.forEach(([id,,,on]) => { defaults[id] = on; });
    try {
      const saved = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
      return Object.assign(defaults, saved);
    } catch(e){ return defaults; }
  }
  let notifPrefs = loadNotifPrefs();
  function renderNotifs(){
    const list = $('notifList');
    list.innerHTML = '';
    NOTIF_OPTIONS.forEach(([id, label, sub]) => {
      const on = !!notifPrefs[id];
      const row = document.createElement('button');
      row.type = 'button';
      row.setAttribute('role', 'switch');
      row.setAttribute('aria-checked', String(on));
      row.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:11px 0;border:none;border-bottom:1px solid #F2EFE5;background:none;cursor:pointer;font-family:\'Inter\',sans-serif;';
      row.innerHTML = '<div style="flex:1;"><div style="font-size:13.5px;font-weight:700;color:var(--ink);" class="t"></div><div style="font-size:11.5px;color:#8A9689;margin-top:1px;" class="s"></div></div><span class="toggle-track' + (on ? ' on' : '') + '"><span class="knob"></span></span>';
      row.querySelector('.t').textContent = label;
      row.querySelector('.s').textContent = sub;
      row.addEventListener('click', () => {
        notifPrefs[id] = !on;
        try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifPrefs)); } catch(e){}
        renderNotifs();
      });
      list.appendChild(row);
    });
  }
  renderNotifs();

  // ---------- Settings: language ----------
  const langSelect = $('langSelect');
  if(window.DoloPawsI18n) langSelect.value = window.DoloPawsI18n.lang === 'it' ? 'it' : 'en';
  langSelect.addEventListener('change', () => {
    if(window.DoloPawsI18n && langSelect.value !== window.DoloPawsI18n.lang){
      window.DoloPawsI18n.setLang(langSelect.value); // saves + reloads the page
    }
  });

  // ---------- Settings: login email ----------
  const acctEmailInput = $('acctEmailInput');
  const acctEmailBtn = $('acctEmailBtn');
  const acctEmailHint = $('acctEmailHint');
  const contributionStatus = $('contributionEligibilityStatus');
  const contributionBadge = $('contributionEligibilityBadge');
  const contributionAction = $('contributionEligibilityAction');
  let savedEmail = '';

  function paintContributionEligibility(result){
    if(!contributionStatus || !contributionBadge || !contributionAction) return;
    contributionStatus.textContent = result.message;
    contributionAction.hidden = true;
    contributionAction.disabled = false;
    if(result.state === 'eligible'){
      contributionBadge.textContent = 'Verified';
      contributionBadge.style.background = '#DCEBDD';
      contributionBadge.style.color = '#2C5C34';
      return;
    }
    contributionBadge.textContent = result.state === 'unavailable' ? 'Unavailable' : 'Action needed';
    contributionBadge.style.background = '#F5E4C6';
    contributionBadge.style.color = '#8A5A16';
    if(result.action === 'verify-email'){
      contributionAction.textContent = 'Resend verification email';
      contributionAction.dataset.action = 'verify-email';
      contributionAction.hidden = false;
    } else if(result.action === 'retry'){
      contributionAction.textContent = 'Try again';
      contributionAction.dataset.action = 'retry';
      contributionAction.hidden = false;
    }
  }

  async function refreshContributionEligibility(){
    if(!window.DoloPawsAuth || !window.DoloPawsAuth.getContributionEligibility) return;
    contributionStatus.textContent = 'Checking whether this account can contribute…';
    contributionAction.hidden = true;
    const result = await window.DoloPawsAuth.getContributionEligibility();
    paintContributionEligibility(result);
  }

  contributionAction.addEventListener('click', async () => {
    contributionAction.disabled = true;
    if(contributionAction.dataset.action === 'verify-email'){
      const result = await window.DoloPawsAuth.sendContributionVerificationEmail();
      contributionStatus.textContent = result.message;
      contributionAction.disabled = false;
      return;
    }
    await refreshContributionEligibility();
  });
  function refreshEmailBtn(){
    const changed = acctEmailInput.value.trim() && acctEmailInput.value.trim() !== savedEmail;
    acctEmailBtn.disabled = !changed;
    acctEmailBtn.style.background = changed ? 'var(--accent)' : '#C6D0CB';
  }
  acctEmailInput.addEventListener('input', refreshEmailBtn);
  acctEmailBtn.addEventListener('click', async () => {
    const next = acctEmailInput.value.trim();
    if(!next || next === savedEmail || !window.DoloPawsAuth || !window.DoloPawsAuth.updateEmail) return;
    acctEmailBtn.textContent = 'Sending…';
    const result = await window.DoloPawsAuth.updateEmail(next);
    acctEmailBtn.textContent = 'Update';
    acctEmailHint.style.color = result.ok ? '#2C5C34' : '#9C3A25';
    acctEmailHint.textContent = result.ok
      ? 'Confirmation link sent to ' + next + ' — the change applies once you click it.'
      : result.message;
  });

  // ---------- Settings: password reset ----------
  const sendResetBtn = $('sendResetBtn');
  const resetStatus = $('resetStatus');
  sendResetBtn.addEventListener('click', async () => {
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(!user || !user.email) return;
    sendResetBtn.disabled = true;
    sendResetBtn.textContent = 'Sending…';
    const result = await window.DoloPawsAuth.resetPassword(user.email);
    sendResetBtn.disabled = false;
    sendResetBtn.textContent = 'Send password reset link';
    resetStatus.hidden = false;
    resetStatus.style.color = result.ok ? '#2C5C34' : '#9C3A25';
    resetStatus.textContent = result.ok
      ? 'Reset link sent to ' + user.email + ' — check your inbox.'
      : result.message;
  });

  // ---------- Settings: log out ----------
  const logoutOverlay = $('logoutOverlay');
  const logoutDataMessage = $('logoutDataMessage');
  const logoutStatus = $('logoutStatus');
  const keepLocalLogoutBtn = $('keepLocalLogoutBtn');
  const removeLocalLogoutBtn = $('removeLocalLogoutBtn');

  function setLogoutOpen(open){
    if(!logoutOverlay) return;
    logoutOverlay.hidden = !open;
    if(open){
      const active = window.DoloPawsLocalData && window.DoloPawsLocalData.activeHike();
      logoutDataMessage.textContent = active
        ? `An unfinished ${active.trailId || 'trail'} hike is stored on this device. Keeping local data locks it to this account; removing local data permanently discards it and all downloaded maps.`
        : 'Keeping local data preserves downloaded maps and locks private hike records to this account. Removing local data clears all DoloPaws downloads and private browser records.';
      logoutStatus.hidden = true;
      keepLocalLogoutBtn.focus();
    }
  }

  async function finishLogout(removePackages){
    if(!window.DoloPawsAuth) return;
    keepLocalLogoutBtn.disabled = true;
    removeLocalLogoutBtn.disabled = true;
    logoutStatus.hidden = false;
    logoutStatus.textContent = removePackages
      ? 'Removing DoloPaws data from this device…'
      : 'Logging out and retaining downloads…';
    try{
      if(removePackages && window.DoloPawsLocalData){
        await window.DoloPawsLocalData.cleanup({ removePackages:true });
      }
      await window.DoloPawsAuth.logOut();
      window.location.href = 'index.html';
    }catch(error){
      logoutStatus.textContent = 'Logout could not be completed. Please try again.';
      keepLocalLogoutBtn.disabled = false;
      removeLocalLogoutBtn.disabled = false;
    }
  }

  $('logOutBtn').addEventListener('click', () => setLogoutOpen(true));
  $('closeLogoutBtn').addEventListener('click', () => setLogoutOpen(false));
  keepLocalLogoutBtn.addEventListener('click', () => finishLogout(false));
  removeLocalLogoutBtn.addEventListener('click', () => finishLogout(true));
  logoutOverlay.addEventListener('click', event => {
    if(event.target === logoutOverlay) setLogoutOpen(false);
  });
  if(new URLSearchParams(window.location.search).get('logout') === '1'){
    setLogoutOpen(true);
  }

  // ---------- Cancel-account modal ----------
  const cancelOverlay = $('cancelOverlay');
  const confirmDeleteText = $('confirmDeleteText');
  const confirmDeleteBtn = $('confirmDeleteBtn');
  const deletePassword = $('deletePassword');
  const deleteStatus = $('deleteStatus');

  function openCancelModal(){
    confirmDeleteText.value = '';
    deletePassword.value = '';
    deleteStatus.hidden = true;
    const removeLocalChoice = document.querySelector('input[name="deleteLocalData"][value="remove"]');
    if(removeLocalChoice) removeLocalChoice.checked = true;
    refreshDeleteBtn();
    cancelOverlay.hidden = false;
    confirmDeleteText.focus();
  }
  function closeCancelModal(){ cancelOverlay.hidden = true; }
  function refreshDeleteBtn(){
    const ready = confirmDeleteText.value.trim().toUpperCase() === 'DELETE';
    confirmDeleteBtn.disabled = !ready;
    confirmDeleteBtn.style.background = ready ? '#9C3A25' : '#D9B7AD';
  }
  $('openCancelBtn').addEventListener('click', openCancelModal);
  $('closeCancelBtn').addEventListener('click', closeCancelModal);
  cancelOverlay.addEventListener('click', e => { if(e.target === cancelOverlay) closeCancelModal(); });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(!cancelOverlay.hidden) closeCancelModal();
    if(logoutOverlay && !logoutOverlay.hidden) setLogoutOpen(false);
  });
  confirmDeleteText.addEventListener('input', refreshDeleteBtn);

  confirmDeleteBtn.addEventListener('click', async () => {
    if(confirmDeleteBtn.disabled || !window.DoloPawsAuth) return;
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting…';
    const result = await window.DoloPawsAuth.deleteAccount(deletePassword.value);
    confirmDeleteBtn.textContent = 'Delete my account';
    refreshDeleteBtn();
    if(result.ok){
      const choice = document.querySelector('input[name="deleteLocalData"]:checked');
      const removePackages = !choice || choice.value === 'remove';
      let deviceState = removePackages ? 'removed' : 'maps-retained';
      try{
        if(window.DoloPawsLocalData){
          await window.DoloPawsLocalData.cleanup({ removePackages });
        }
      }catch(error){
        deviceState = 'cleanup-incomplete';
      }
      window.location.href = 'index.html?accountDeleted=1&device=' + encodeURIComponent(deviceState);
    } else {
      deleteStatus.hidden = false;
      deleteStatus.textContent = result.message;
    }
  });

  // ---------- Load profile once signed in ----------
  function providerLabel(user){
    const pid = user.providerData[0] && user.providerData[0].providerId;
    if(pid === 'google.com') return 'Google';
    if(pid === 'password') return 'Email & password';
    return 'Unknown';
  }

  function kgFromProfile(p){
    if(typeof p.weight === 'number') return Math.min(60, Math.max(2, Math.round(p.weight)));
    const MID = { 'u5':4, '5-10':7.5, '10-15':12.5, '15-20':17.5, '20-30':25, '30-40':35, '40-55':47.5, '55plus':60 };
    if(p.weightBand && MID[p.weightBand] != null) return Math.round(MID[p.weightBand]);
    return null;
  }
  function sizeFromKg(kg){
    if(kg == null) return 'Large';
    return kg < 10 ? 'Small' : kg <= 25 ? 'Medium' : kg <= 40 ? 'Large' : 'Extra large';
  }

  function waitForAuth(cb){
    if(window.DoloPawsAuth){ cb(); return; }
    window.addEventListener('dolopaws-auth-ready', cb, { once: true });
  }

  waitForAuth(() => {
    window.DoloPawsAuth.onChange(async (user) => {
      if(!user){
        subline.textContent = "You're not logged in.";
        subline.removeAttribute('aria-busy');
        loggedOutState.hidden = false;
        loggedInState.hidden = true;
        document.body.classList.remove('ep-app');
        return;
      }

      subline.hidden = true;
      subline.removeAttribute('aria-busy');
      loggedOutState.hidden = true;
      loggedInState.hidden = false;
      // Phone layout swaps the site chrome for the app bar + footer.
      document.body.classList.add('ep-app');

      // settings.html's "Delete account" deep-links here (#cancel) so the
      // destructive flow stays in one tested place.
      if(window.location.hash === '#cancel'){
        pickTab('account');
        const openCancel = $('openCancelBtn');
        if(openCancel) setTimeout(() => openCancel.click(), 0);
      }

      // Settings header
      savedEmail = user.email || '';
      $('acctEmailLabel').textContent = user.email || '(no email on file)';
      $('acctProvider').textContent = providerLabel(user);
      $('acctAvatar').textContent = ((user.displayName || user.email || '?').charAt(0)).toUpperCase();
      acctEmailInput.value = savedEmail;
      refreshEmailBtn();
      const isGoogle = providerLabel(user) === 'Google';
      $('emailChangeBox').hidden = isGoogle;
      $('googleEmailNote').hidden = !isGoogle;
      $('passwordSection').hidden = isGoogle;
      $('deletePasswordField').hidden = isGoogle;
      $('deleteGoogleNote').hidden = !isGoogle;
      refreshContributionEligibility();
      const profilesState = await window.DoloPawsAuth.getDogProfiles();
      dogProfiles = profilesState.dogs;
      activeDogId = profilesState.activeDogId;
      if(requestedDogId && dogProfiles.some(dog => dog.id === requestedDogId) && requestedDogId !== activeDogId){
        const switched = await window.DoloPawsAuth.selectDogProfile(requestedDogId);
        if(switched) activeDogId = requestedDogId;
      }
      const activeProfile = dogProfiles.find(dog => dog.id === activeDogId) || {};
      // Add mode uses the same editor, with a blank dog and the current
      // owner's contact details carried across for convenience.
      const profile = addMode ? { owner:activeProfile.owner || {} } : activeProfile;
      base = profile;
      renderDogSwitcher();
      if(addMode){
        const title = document.querySelector('#profileDesign > h1');
        if(title) title.textContent = 'Add another dog';
        const kicker = document.querySelector('#profileDesign > .profile-kicker');
        if(kicker) kicker.textContent = 'New dog profile';
        const removeBlock = $('removeDogBlock');
        if(removeBlock) removeBlock.hidden = true;
      }

      // Photo: the account copy wins; migrate a pre-sync device-only photo up.
      const pKey = 'dolopaws-dog-photo-' + user.uid + '-'
        + (addMode ? 'new' : (activeDogId || 'new'));
      const isImage = v => typeof v === 'string' && v.startsWith('data:image/');
      if(!addMode && isImage(profile.photo)){
        state.photo = profile.photo;
        try { localStorage.setItem(pKey, profile.photo); } catch(e){}
      } else {
        let local = null;
        try {
          local = localStorage.getItem(pKey)
            || (dogProfiles.length <= 1 ? localStorage.getItem(LEGACY_PHOTO_KEY) : null);
        } catch(e){}
        if(!addMode && local && isImage(local)){
          state.photo = local;
          window.DoloPawsAuth.setDogProfile({ photo: local }).then((ok) => {
            if(ok){ try { localStorage.setItem(pKey, local); localStorage.removeItem(LEGACY_PHOTO_KEY); } catch(e){} }
          });
        } else {
          state.photo = null;
        }
      }

      state.name = profile.name || '';
      state.breed = profile.breed || '';
      state.dob = profile.dob || '';
      const kg = kgFromProfile(profile);
      state.weight = kg == null ? 20 : kg;
      state.size = profile.size || sizeFromKg(kg);
      state.neuter = profile.neuter || 'Unknown';
      state.coat = profile.coat || 'Short';
      const conds = Array.isArray(profile.conditions)
        ? profile.conditions
        : [profile.jointIssues && 'joints', profile.heatIssues && 'heat'].filter(Boolean);
      state.sens = Array.isArray(profile.sens)
        ? profile.sens
        : ['heat', 'joints'].filter(c => conds.includes(c));
      state.medical = profile.healthNotes || (profile.vet && profile.vet.medical) || '';

      const vet = profile.vet || {};
      state.vetName = vet.name || '';
      state.vetPhone = vet.phone || '';
      state.chip = vet.chip || '';
      state.insurer = vet.insurer || '';
      state.policy = vet.policy || '';

      // Owner details prefill from the login when the profile has none yet.
      const owner = profile.owner || {};
      state.ownerName = owner.name || user.displayName || '';
      state.ownerPhone = owner.phone || '';
      state.ownerEmail = owner.email || user.email || '';
      state.emName = owner.emName || '';
      state.emPhone = owner.emPhone || '';

      // Push state into the form fields
      FIELD_BINDINGS.forEach(([id, key]) => { $(id).value = state[key]; });
      $('dogWeight').value = state.weight;
      renderOptions();
      renderBreedList();
      breedInput.value = state.breed;
      renderDerived();
      window.dispatchEvent(new CustomEvent('dolopaws-account-profile-loaded', { detail:{ profile } }));
    });
  });

  // First paint (before auth resolves) so the panel never looks broken.
  renderOptions();
  renderDerived();
})();
