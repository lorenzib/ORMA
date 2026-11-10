// The iPhone app's "Walk finished" screen. Both ways a walk ends land on the
// journal page with the walk already saved: the Record tab (walk-page.js)
// and a trail's hike mode (hike-mode.js, which in the app skips its own long
// sheet and adds the hike's completion id). This draws one short card over
// that page: the line walked, time, distance and pace, and for a trail walk
// the private "Did it suit {name}?" question, with the detail questions
// behind "More about the walk". "Add a photo" uncovers the journal's own
// photo and who-came-along sheet; Done closes both.
// scripts/build-app.js adds this script (with hike-completions.js and
// post-hike-outcomes.js, which it needs) to the app's journal.html only.
// The look is in app-shell.css under .app-walk-done.
(function(){
  if(window.__ormaAppWalkDone) return;
  window.__ormaAppWalkDone = true;

  // Read now: the journal takes ?saved off the address once it opens.
  const params = new URLSearchParams(window.location.search);
  const savedId = params.get('saved');
  const completionId = params.get('completion');
  if(!savedId) return;

  function tx(text, vars){
    const i18n = window.DoloPawsI18n;
    if(i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }
  const label = (key, fallback, vars) => {
    const value = typeof window.t === 'function' ? window.t(key, vars) : '';
    if(value && value !== key) return value;
    return vars ? String(fallback).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : fallback;
  };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[ch]));

  // The detail questions hike mode asks, with the same stored values
  // (post-hike-outcomes.js validates them) and the same wording.
  const DETAILS = [
    { key:'waterAccuracy', text:'Was the listed water information accurate?', options:[
      ['accurate', 'Yes, it was accurate'], ['less_than_listed', 'Less water than listed'],
      ['more_than_listed', 'More water than listed'], ['not_checked', 'I did not check'] ] },
    { key:'livestockEncountered', text:'Did you encounter livestock?', options:[
      ['none', 'No livestock at all'], ['seen_at_distance', 'Seen, but at a distance'],
      ['close_encounter', 'Passed close to them'] ] },
    { key:'offLeadObserved', text:'Were dogs off-lead on this route?', options:[
      ['all_on_lead', 'Everyone kept dogs on the lead'], ['some_off_lead', 'Some dogs were off-lead'],
      ['mostly_off_lead', 'Most dogs were off-lead'] ] },
    { key:'crowding', text:'How busy was it?', options:[
      ['quiet', 'Quiet, room to give space'], ['moderate', 'Steady foot traffic'],
      ['busy', 'Busy throughout'] ] },
    { key:'dogEnjoyment', text:'Did {name} enjoy it?', options:[
      ['loved_it', 'Loved it'], ['fine', 'Took it in their stride'], ['struggled', 'Struggled with it'] ] },
    { key:'reactiveDogFit', text:'Would you recommend it for a reactive dog?', options:[
      ['yes', 'Yes, there is room to pass'], ['with_care', 'Only with care'], ['no', 'No, too little space'] ] },
  ];
  const HAZARDS = [
    ['surface', 'Surface'], ['exposure', 'Exposure'], ['livestock', 'Livestock'],
    ['heat', 'Heat'], ['access', 'Access'], ['water', 'Water'],
  ];

  function dogName(){
    try {
      const raw = JSON.parse(window.localStorage.getItem('dolopaws-profile-summary') || 'null');
      const active = raw && Array.isArray(raw.dogs)
        ? raw.dogs.find(dog => dog.id === raw.activeDogId) || raw.dogs[0]
        : null;
      if(active && active.name) return String(active.name);
      if(raw && raw.name) return String(raw.name);
    } catch(error){}
    return '';
  }
  function findEntry(uid){
    try {
      const entries = JSON.parse(window.localStorage.getItem(`dolopaws-journal-${uid}`) || '[]');
      return entries.find(entry => entry && entry.id === savedId) || null;
    } catch(error){ return null; }
  }
  function findCompletion(uid){
    const store = window.DoloPawsHikeCompletions;
    if(!completionId || !store) return null;
    const loaded = store.load();
    const record = loaded && loaded.store
      ? loaded.store.records.find(item => item.completionId === completionId)
      : null;
    return record && (!record.ownerId || record.ownerId === uid) ? record : null;
  }

  function clock(minutes){
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}` : `${m} min`;
  }
  function pace(km, minutes){
    if(!(km > 0.1) || !(minutes > 0)) return '–';
    const seconds = Math.round(minutes * 60 / km);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  // A trail walk keeps no line of its own; it walked its trail's.
  function trailPath(entry){
    if(!entry.trailId || !Array.isArray(window.trails)) return null;
    const trail = window.trails.find(item => item && item.id === entry.trailId);
    return trail && Array.isArray(trail.path) && trail.path.length > 1 ? [trail.path] : null;
  }
  // The line walked, drawn to fit the box, as the journal's walk card does.
  function routeSvg(entry){
    const card = window.DoloPawsWalkCard;
    const segments = entry.segments || (entry.route ? [entry.route] : null) || trailPath(entry);
    if(!card || !segments) return '';
    const W = 320, H = 150;
    const parts = card.projectSegments(segments, W, H, 16);
    if(!parts.length) return '';
    const d = parts.map(part => 'M' + part.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')).join(' ');
    const start = parts[0][0];
    return `<div class="app-walk-done-map"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
      `<path d="${d}" fill="none" stroke="#2E4034" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${start[0].toFixed(1)}" cy="${start[1].toFixed(1)}" r="6" fill="#7FB3C8" stroke="#FFFFFF" stroke-width="2"/></svg></div>`;
  }

  let root = null;
  let shown = false;
  let response = '';
  let more = false;
  let answerSaved = false;
  let completion = null;
  let name = '';

  function answerButtons(){
    const answers = [
      ['appropriate', label('hike.suitYes', 'Yes')],
      ['appropriate_with_unexpected_cautions', label('hike.suitCare', 'With care')],
      ['not_appropriate', label('hike.suitNo', 'No')],
    ].concat(more ? [
      ['did_not_complete', tx('We turned back')],
      ['prefer_not_to_answer', tx('Prefer not to answer')],
    ] : []);
    return answers.map(([value, text]) => `<button type="button" role="radio" class="app-walk-done-answer${value === response ? ' is-on' : ''}" data-answer="${value}" aria-checked="${value === response}">${esc(text)}</button>`).join('');
  }

  function detailsHtml(){
    return DETAILS.map(question => `<label class="app-walk-done-q" for="awd-${question.key}">${esc(tx(question.text, { name: name || tx('your dog') }))} <span>${esc(tx('Optional'))}</span></label>` +
      `<select class="app-walk-done-select" id="awd-${question.key}" data-detail="${question.key}"><option value="">${esc(tx('Prefer not to answer'))}</option>` +
      question.options.map(([value, text]) => `<option value="${value}">${esc(tx(text))}</option>`).join('') + '</select>').join('') +
      `<label class="app-walk-done-check"><input type="checkbox" data-missing> ${esc(tx('A posted restriction was missing from ORMA'))}</label>` +
      `<fieldset class="app-walk-done-hazards"><legend>${esc(tx('Any material hazard we should account for?'))} <span>${esc(tx('Optional'))}</span></legend>` +
      HAZARDS.map(([value, text]) => `<label><input type="checkbox" value="${value}" data-hazard> ${esc(tx(text))}</label>`).join('') + '</fieldset>';
  }

  function titleText(){ return name ? tx('Nice walk, {name}!', { name }) : tx('Nice walk!'); }
  function questionText(){
    return name ? label('hike.suitQuestion', 'Did it suit {name}?', { name }) : label('hike.suitQuestionYourDog', 'Did it suit your dog?');
  }
  function timeRange(start, minutes){
    if(isNaN(start)) return '';
    const lang = document.documentElement.lang || undefined;
    const hm = date => date.toLocaleTimeString(lang, { hour:'2-digit', minute:'2-digit' });
    return minutes ? `${hm(start)}–${hm(new Date(start.getTime() + minutes * 60000))}` : hm(start);
  }
  // The dog's name from the account, when this phone's summary lacks it.
  function askAccountForName(){
    const auth = window.DoloPawsAuth;
    if(name || !auth || typeof auth.getDogProfile !== 'function') return;
    Promise.resolve(auth.getDogProfile()).then(profile => {
      if(!root || name || !profile || !profile.name) return;
      name = String(profile.name);
      root.querySelector('.app-walk-done-title').textContent = titleText();
      const question = root.querySelector('.app-walk-done-question');
      if(question) question.textContent = questionText();
      root.querySelectorAll('[data-detail="dogEnjoyment"]').forEach(select => {
        const tag = root.querySelector(`label[for="${select.id}"]`);
        if(tag && tag.firstChild) tag.firstChild.textContent = tx('Did {name} enjoy it?', { name }) + ' ';
      });
    }).catch(() => {});
  }

  function render(entry){
    const km = Number(entry.dist) || 0;
    const minutes = Number(entry.dur) || 0;
    const when = new Date(entry.date);
    const date = isNaN(when) ? '' : when.toLocaleDateString(document.documentElement.lang || undefined, { day:'numeric', month:'short' });
    // A trail walk is named by its trail; a recorded one by when it was.
    const sub = entry.trailId
      ? [entry.trail, entry.proof === 'gps' ? tx('GPS confirms the route') : ''].filter(Boolean).join(' · ')
      : (entry.trail && entry.trail !== 'Recorded walk' ? entry.trail : timeRange(when, minutes));
    root.innerHTML = '<div class="app-walk-done-body">' +
        `<p class="app-walk-done-kicker">${esc([tx('Walk saved'), date].filter(Boolean).join(' · '))}</p>` +
        `<h1 class="app-walk-done-title" id="appWalkDoneTitle" tabindex="-1">${esc(titleText())}</h1>` +
        `<p class="app-walk-done-sub">${esc(sub)}</p>` +
        routeSvg(entry) +
        '<div class="app-walk-done-stats">' +
          `<div><b>${esc(minutes ? clock(minutes) : '–')}</b><span>${esc(label('hike.statTime', 'Time'))}</span></div>` +
          `<div><b>${esc(km > 0 ? `${km.toFixed(1)} km` : '–')}</b><span>${esc(label('hike.statDistance', 'Distance'))}</span></div>` +
          `<div><b>${esc(pace(km, minutes))}</b><span>${esc(tx('Per km'))}</span></div>` +
        '</div>' +
        (completion ? '<div class="app-walk-done-ask">' +
          `<p class="app-walk-done-question" id="appWalkDoneQ">${esc(questionText())}</p>` +
          `<div class="app-walk-done-answers" role="radiogroup" aria-labelledby="appWalkDoneQ">${answerButtons()}</div>` +
          `<p class="app-walk-done-private">${esc(label('hike.suitPrivate', 'Private. It never becomes a public review.'))}</p>` +
          `<div class="app-walk-done-details" hidden>${detailsHtml()}</div>` +
        '</div>' : '') +
        `<button type="button" class="app-walk-done-photo" data-go="photo"><span aria-hidden="true">📷</span>${esc(tx('Add a photo'))}</button>` +
        '<p class="app-walk-done-status" role="status" aria-live="polite"></p>' +
      '</div>' +
      '<div class="app-walk-done-foot">' +
        (completion ? `<button type="button" class="app-walk-done-btn" data-go="more" aria-expanded="false">${esc(tx('More about the walk'))}</button>` : '') +
        `<button type="button" class="app-walk-done-btn is-main" data-go="done">${esc(label('hike.done', 'Done'))}</button>` +
      '</div>';
  }

  function setStatus(text){
    const status = root && root.querySelector('.app-walk-done-status');
    if(status) status.textContent = text;
  }

  // The private answer is written once, when the screen is left: an outcome
  // cannot be edited after it is saved. No answer, nothing written.
  function saveAnswer(){
    if(answerSaved || !completion || !response) return true;
    const outcomes = window.DoloPawsPostHikeOutcomes;
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(!outcomes || !user) return true;
    const input = { response, hazards: [], offlinePackageUsed: false };
    root.querySelectorAll('[data-detail]').forEach(select => { input[select.dataset.detail] = select.value || null; });
    const missing = root.querySelector('[data-missing]');
    input.missingRestriction = missing && missing.checked ? true : null;
    root.querySelectorAll('[data-hazard]:checked').forEach(box => input.hazards.push(box.value));
    const result = outcomes.save(completion, input, user.uid);
    if(!result.ok){
      setStatus(tx('The response could not be saved. Try again before closing this screen.'));
      return false;
    }
    answerSaved = true;
    outcomes.syncBrowser().catch(() => {});
    return true;
  }

  // The journal opens its own photo and who-came-along sheet for this walk
  // a moment after it loads; it stays hidden under this screen until asked.
  function closeJournalSheet(){
    const sheet = document.getElementById('jnAfterOverlay');
    const close = document.getElementById('jnAfterClose');
    if(!sheet || !close) return;
    if(!sheet.hidden){ close.click(); return; }
    const watch = new MutationObserver(() => {
      if(!sheet.hidden){ watch.disconnect(); close.click(); }
    });
    watch.observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
    setTimeout(() => watch.disconnect(), 3000);
  }

  function close(){
    document.body.classList.remove('app-walk-done-open');
    if(root) root.remove();
    root = null;
  }

  function onClick(event){
    const answer = event.target.closest('[data-answer]');
    if(answer){
      response = answer.dataset.answer;
      root.querySelectorAll('[data-answer]').forEach(button => {
        const on = button === answer;
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-checked', String(on));
      });
      return;
    }
    const go = event.target.closest('[data-go]');
    if(!go) return;
    const action = go.dataset.go;
    if(action === 'more'){
      more = !more;
      root.querySelector('.app-walk-done-details').hidden = !more;
      root.querySelector('.app-walk-done-answers').innerHTML = answerButtons();
      go.setAttribute('aria-expanded', String(more));
      go.textContent = more ? tx('Fewer questions') : tx('More about the walk');
    } else if(action === 'photo'){
      if(!saveAnswer()) return;
      // Uncover the journal's sheet: photos, and who came along.
      close();
    } else if(action === 'done'){
      if(!saveAnswer()) return;
      close();
      closeJournalSheet();
    }
  }

  function show(){
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(!user || shown) return;
    const entry = findEntry(user.uid);
    if(!entry) return;
    shown = true;
    completion = findCompletion(user.uid);
    name = dogName();
    root = document.createElement('div');
    root.className = 'app-walk-done';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'appWalkDoneTitle');
    root.addEventListener('click', onClick);
    render(entry);
    document.body.appendChild(root);
    document.body.classList.add('app-walk-done-open');
    root.querySelector('.app-walk-done-title').focus();
    askAccountForName();
    // The trails can arrive after this screen; draw the line when they do.
    if(entry.trailId && !root.querySelector('.app-walk-done-map')){
      const drawLate = () => {
        const map = root && !root.querySelector('.app-walk-done-map') ? routeSvg(entry) : '';
        if(!map) return;
        root.querySelector('.app-walk-done-sub').insertAdjacentHTML('afterend', map);
        window.removeEventListener('dolopaws-region-loaded', drawLate);
      };
      window.addEventListener('dolopaws-region-loaded', drawLate);
    }
  }

  window.addEventListener('dolopaws-auth-ready', show);
  window.addEventListener('dolopaws-auth-changed', show);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
