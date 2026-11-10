// The iPhone app's first launch. Shown once, over Explore and its tab bar:
// one screen that says what ORMA does, then "Add your dog" or "Look around
// first", with Log in for people who already have an account. "Add your dog"
// asks only name and size and keeps the dog on the phone the same way the
// homepage's dog setup does (dolopaws-pending-dog-profile, the same shape as
// homepage-search.js buildCustomProfile), so Explore scores every trail for
// it and a later login moves it to the account. Energy, heat and chairlifts
// keep that setup's defaults: medium energy, not heat-sensitive, and routes
// that need an open chairlift left out until the owner says otherwise. They
// can all be set later in You.
// scripts/build-app.js adds this script to the app's index.html only; the
// website never loads it. The look is in app-shell.css under .app-welcome.
(function(){
  if(window.__ormaAppWelcome) return;
  window.__ormaAppWelcome = true;

  const SEEN_KEY = 'orma-app-welcomed';
  const DOG_KEY = 'dolopaws-pending-dog-profile';
  const PHOTO = 'images/lago-di-carezza.webp';
  // As homepage-search.js: the weight band each size is scored as.
  const SIZES = [
    { v:'small', key:'hp.wizard.size.small', text:'Small', band:'5-10' },
    { v:'medium', key:'hp.wizard.size.medium', text:'Medium', band:'15-20' },
    { v:'large', key:'hp.wizard.size.large', text:'Large', band:'30-40' },
  ];

  function tx(text, vars){
    const i18n = window.DoloPawsI18n;
    if(i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }
  const label = (key, fallback) => {
    const value = typeof window.t === 'function' ? window.t(key) : '';
    return value && value !== key ? value : fallback;
  };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[ch]));
  function stored(key){
    try { return window.localStorage.getItem(key); } catch(error){ return null; }
  }
  function store(key, value){
    try { window.localStorage.setItem(key, value); return true; } catch(error){ return false; }
  }

  // Once per phone, and never for someone who already has a dog here or is
  // signed in.
  if(stored(SEEN_KEY) || stored(DOG_KEY)) return;

  let root = null;
  let size = 'medium';

  function close(){
    store(SEEN_KEY, '1');
    document.body.classList.remove('app-welcome-open');
    if(root) root.remove();
    root = null;
  }

  function first(){
    root.className = 'app-welcome';
    root.innerHTML = `<div class="app-welcome-photo" style="background-image:url('${PHOTO}')">` +
        '<span class="app-welcome-brand"><img src="logo.svg?v=5" alt="">ORMA</span></div>' +
      '<div class="app-welcome-body">' +
        `<h1 class="app-welcome-title" tabindex="-1">${esc(tx('Find walks your dog will love'))}</h1>` +
        '<ul class="app-welcome-ticks">' +
          `<li>${esc(tx('Every trail scored for your dog'))}</li>` +
          `<li>${esc(tx('Today’s heat, snow and lifts checked'))}</li>` +
          `<li>${esc(tx('Water, shade and hazards on the way'))}</li>` +
        '</ul>' +
        `<button type="button" class="app-welcome-btn is-main" data-go="dog">${esc(tx('Add your dog · 1 minute'))}</button>` +
        `<button type="button" class="app-welcome-btn" data-go="look">${esc(tx('Look around first'))}</button>` +
        `<p class="app-welcome-small">${esc(tx('Already have an account?'))} <button type="button" class="app-welcome-link" data-go="login">${esc(label('nav.login', 'Log in'))}</button></p>` +
      '</div>';
    root.querySelector('.app-welcome-title').focus();
  }

  function dogButtonText(name){
    return name ? tx('Show {name}’s trails', { name }) : tx('Show their trails');
  }

  function dog(){
    root.className = 'app-welcome is-light';
    root.innerHTML = '<div class="app-welcome-form">' +
        `<button type="button" class="app-welcome-back" data-go="back">${esc(label('hp.wizard.back', '← Back'))}</button>` +
        `<h1 class="app-welcome-title" tabindex="-1">${esc(tx('Tell us about your dog'))}</h1>` +
        `<p class="app-welcome-lead">${esc(tx('Two answers and every trail is scored for them.'))}</p>` +
        `<label class="app-welcome-q" for="appWelcomeName">${esc(tx('Name'))}</label>` +
        `<input class="app-welcome-input" id="appWelcomeName" type="text" maxlength="40" autocomplete="off" autocapitalize="words" enterkeyhint="go" placeholder="${esc(tx('e.g. Bella'))}">` +
        `<p class="app-welcome-q" id="appWelcomeSizeQ">${esc(tx('Size'))}</p>` +
        '<div class="app-welcome-chips" role="radiogroup" aria-labelledby="appWelcomeSizeQ">' +
          SIZES.map(option => `<button type="button" role="radio" class="app-welcome-chip${option.v === size ? ' is-on' : ''}" data-size="${option.v}" aria-checked="${option.v === size}">${esc(label(option.key, option.text))}</button>`).join('') +
        '</div>' +
      '</div>' +
      '<div class="app-welcome-foot">' +
        `<button type="button" class="app-welcome-btn is-main" data-go="save" disabled>${esc(dogButtonText(''))}</button>` +
        `<p class="app-welcome-small">${esc(tx('Energy, paws, heat and chairlifts can be set later in You.'))}</p>` +
      '</div>';
    const input = root.querySelector('#appWelcomeName');
    const save = root.querySelector('[data-go="save"]');
    input.addEventListener('input', () => {
      const name = input.value.trim();
      save.disabled = !name;
      save.textContent = dogButtonText(name);
    });
    // The keyboard covers the button, so its Go key saves too.
    input.addEventListener('keydown', event => {
      if(event.key === 'Enter'){ event.preventDefault(); saveDog(); }
    });
    root.querySelector('.app-welcome-title').focus();
  }

  function saveDog(){
    const input = root.querySelector('#appWelcomeName');
    const name = input ? input.value.trim().slice(0, 40) : '';
    if(!name) return;
    const band = (SIZES.find(option => option.v === size) || SIZES[1]).band;
    // The same shape as homepage-search.js buildCustomProfile with its
    // defaults, so every guest screen and the login handoff read it as is.
    const profile = {
      name,
      breed: '',
      fitness: 'moderate',
      dob: null, ageBand: null,
      weightBand: band,
      conditions: [],
      healthNotes: '',
      jointIssues: false,
      heatIssues: false,
      behaviour: {},
    };
    store(DOG_KEY, JSON.stringify(profile));
    close();
    // Explore reads the dog when it loads.
    window.location.reload();
  }

  function onClick(event){
    const chip = event.target.closest('[data-size]');
    if(chip){
      size = chip.dataset.size;
      root.querySelectorAll('[data-size]').forEach(button => {
        const on = button === chip;
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-checked', String(on));
      });
      return;
    }
    const go = event.target.closest('[data-go]');
    if(!go) return;
    const action = go.dataset.go;
    if(action === 'dog') dog();
    else if(action === 'back') first();
    else if(action === 'save') saveDog();
    else if(action === 'look') close();
    else if(action === 'login'){
      close();
      const account = document.getElementById('accountBtn');
      if(account) account.click();
    }
  }

  function start(){
    if(root) return;
    root = document.createElement('div');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', tx('Welcome to ORMA'));
    root.addEventListener('click', onClick);
    document.body.appendChild(root);
    document.body.classList.add('app-welcome-open');
    first();
    // Someone who signs in (or was already) has no need of it.
    const signedIn = () => {
      if(root && window.DoloPawsAuth && window.DoloPawsAuth.currentUser) close();
    };
    window.addEventListener('dolopaws-auth-ready', signedIn);
    window.addEventListener('dolopaws-auth-changed', signedIn);
    signedIn();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
