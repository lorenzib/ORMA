// The iPhone app's You tab: one calm screen with your dog, this month's
// walking, your latest walks, offline maps and settings. scripts/build-app.js
// adds this script to the app's account.html only; the website never loads it.
// The hub shows on account.html opened plainly (the You tab). Any query or
// hash (Edit, add a dog, log out, #cancel) is the full account page as before,
// so every existing flow keeps working. Everything here is read from what the
// phone already stores; the look is in app-shell.css under .app-you.
(function(){
  if(window.__ormaAppYou) return;
  window.__ormaAppYou = true;
  if(window.location.search || window.location.hash) return;

  const label = (key, fallback, vars) => {
    const text = typeof window.t === 'function' ? window.t(key, vars) : '';
    const value = text && text !== key ? text : fallback;
    return vars ? value.replace(/\{(\w+)\}/g, (match, name) => vars[name] != null ? vars[name] : match) : value;
  };

  const SVG = 'http://www.w3.org/2000/svg';
  function icon(paths, size){
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', size || 18);
    svg.setAttribute('height', size || 18);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths;
    return svg;
  }
  const PAW = '<ellipse cx="12" cy="15" rx="3.7" ry="3.1" fill="currentColor"/><ellipse cx="7.4" cy="10.6" rx="1.4" ry="1.9" fill="currentColor"/><ellipse cx="10.7" cy="8.7" rx="1.4" ry="1.9" fill="currentColor"/><ellipse cx="13.9" cy="8.7" rx="1.4" ry="1.9" fill="currentColor"/><ellipse cx="17" cy="10.6" rx="1.4" ry="1.9" fill="currentColor"/>';
  const LINE = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  const GEAR = `<g ${LINE}><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></g>`;
  const DOWNLOAD = `<g ${LINE}><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/></g>`;
  const CHECK = `<g ${LINE}><circle cx="12" cy="12" r="7"/><path d="m8.7 12.2 2.1 2.1 4.6-5"/></g>`;
  const CHEVRON = `<path ${LINE} d="M9 5l7 7-7 7"/>`;
  const ROUTE = `<g ${LINE}><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></g>`;

  function el(tag, className, text){
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = text;
    return node;
  }

  function readJson(key){
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; }
  }

  // The same sources the header and the walk screen read: firebase-init's
  // live summary first, then the copy it last stored.
  function summary(){
    const live = window.DoloPawsAuth && window.DoloPawsAuth.profileSummary;
    if(live !== undefined) return live && typeof live === 'object' ? live : null;
    const stored = readJson('dolopaws-profile-summary');
    return stored && typeof stored === 'object' ? stored : null;
  }

  function currentUid(){
    const auth = window.DoloPawsAuth;
    if(auth && auth.currentUser) return auth.currentUser.uid;
    if(auth && auth.authResolved) return null;
    const cached = summary();
    return cached && cached.uid || null;
  }

  function activeDog(info){
    if(info && Array.isArray(info.dogs) && info.dogs.length){
      return info.dogs.find(dog => dog.id === info.activeDogId) || info.dogs[0];
    }
    if(info && info.name) return { name:info.name, breed:info.breed };
    const pending = readJson('dolopaws-pending-dog-profile');
    const name = pending && typeof pending.name === 'string' ? pending.name.trim().slice(0, 40) : '';
    return name ? { name, pending:true } : null;
  }

  function walks(uid){
    if(!uid) return [];
    const entries = readJson(`dolopaws-journal-${uid}`);
    return Array.isArray(entries)
      ? entries.filter(entry => entry && entry.date && !Number.isNaN(new Date(entry.date).getTime()))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      : [];
  }

  const km = entry => { const value = parseFloat(entry.dist); return Number.isFinite(value) ? value : 0; };
  const minutes = entry => { const value = parseInt(entry.dur, 10); return Number.isFinite(value) ? value : 0; };
  const duration = total => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  const lang = () => document.documentElement.lang || undefined;

  function dayLabel(date){
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const day = new Date(date); day.setHours(0, 0, 0, 0);
    const diff = Math.round((start - day) / 86400000);
    if(diff === 0) return label('appYou.today', 'Today');
    if(diff === 1) return label('appYou.yesterday', 'Yesterday');
    return new Date(date).toLocaleDateString(lang(), { day:'numeric', month:'short' });
  }

  function header(){
    const bar = el('header', 'app-you-head');
    bar.appendChild(el('h1', 'app-you-title', label('appTabs.you', 'You')));
    const gear = el('a', 'app-you-gear');
    gear.href = '/settings.html';
    gear.setAttribute('aria-label', label('appYou.settings', 'Settings'));
    gear.appendChild(icon(GEAR, 19));
    bar.appendChild(gear);
    return bar;
  }

  function dogCard(dog, uid){
    const card = el('div', 'app-you-dog');
    const avatar = el('span', 'app-you-avatar');
    if(dog && typeof dog.photo === 'string' && dog.photo.startsWith('data:image/')){
      const img = el('img');
      img.src = dog.photo;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.appendChild(icon(PAW, 34));
    }
    card.appendChild(avatar);
    const words = el('div', 'app-you-dogtext');
    const action = el('a', 'app-you-edit');
    if(dog){
      words.appendChild(el('div', 'app-you-dogname', dog.name || label('appYou.yourDog', 'Your dog')));
      words.appendChild(el('div', 'app-you-dogline', dog.pending
        ? label('appYou.pendingDog', 'Sign in to keep this profile')
        : (dog.breed ? `${dog.breed} · ` : '') + label('appYou.scored', 'every trail scored for {name}', { name:dog.name || label('appYou.yourDog', 'your dog') })));
      action.textContent = label('appYou.edit', 'Edit');
      action.href = uid ? '/account.html?next=account.html' : '/onboarding.html';
    } else {
      words.appendChild(el('div', 'app-you-dogname', label('appYou.addDogTitle', 'Add your dog')));
      words.appendChild(el('div', 'app-you-dogline', label('appYou.addDogLine', 'ORMA scores every trail for your dog')));
      action.textContent = label('appYou.add', 'Add');
      action.href = uid ? '/account.html?mode=add&next=account.html' : '/onboarding.html';
    }
    card.appendChild(words);
    card.appendChild(action);
    return card;
  }

  function month(list){
    const now = new Date();
    const mine = list.filter(entry => {
      const date = new Date(entry.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const section = el('section', 'app-you-section');
    section.appendChild(el('h2', 'app-you-h', label('appYou.thisMonth', 'This month')));
    const tiles = el('div', 'app-you-tiles');
    const distance = mine.reduce((sum, entry) => sum + km(entry), 0);
    [
      [label('appYou.walks', 'Walks'), String(mine.length)],
      [label('appYou.distance', 'Distance'), `${distance ? distance.toFixed(1) : '0'} km`],
      [label('appYou.time', 'Time'), duration(mine.reduce((sum, entry) => sum + minutes(entry), 0))],
    ].forEach(([name, value]) => {
      const tile = el('div', 'app-you-tile');
      tile.appendChild(el('div', 'app-you-tile-k', name));
      tile.appendChild(el('div', 'app-you-tile-v', value));
      tiles.appendChild(tile);
    });
    section.appendChild(tiles);
    return section;
  }

  function recent(list, uid){
    const section = el('section', 'app-you-section');
    const head = el('div', 'app-you-hrow');
    head.appendChild(el('h2', 'app-you-h', label('appYou.yourWalks', 'Your walks')));
    if(list.length){
      const all = el('a', 'app-you-all', label('appYou.all', 'All'));
      all.href = '/journal.html';
      head.appendChild(all);
    }
    section.appendChild(head);
    if(!list.length){
      section.appendChild(el('p', 'app-you-empty', uid
        ? label('appYou.noWalks', 'No walks yet. Tap Record to start one.')
        : label('appYou.signInWalks', 'Sign in to keep a record of your walks.')));
      return section;
    }
    list.slice(0, 3).forEach(entry => {
      const row = el('a', 'app-you-walk');
      const regional = window.DoloPawsRegionalData;
      row.href = entry.trailId
        ? `/trail.html?id=${encodeURIComponent(regional && regional.slugFor ? regional.slugFor(entry.trailId) : entry.trailId)}`
        : '/journal.html';
      const mark = el('span', 'app-you-walkicon');
      mark.appendChild(icon(ROUTE, 22));
      row.appendChild(mark);
      const words = el('div', 'app-you-walktext');
      words.appendChild(el('div', 'app-you-walkname', entry.trail || label('appYou.walk', 'Walk')));
      const facts = [dayLabel(entry.date)];
      if(km(entry)) facts.push(`${km(entry).toFixed(1)} km`);
      if(minutes(entry)) facts.push(duration(minutes(entry)));
      words.appendChild(el('div', 'app-you-walkline', facts.join(' · ')));
      row.appendChild(words);
      section.appendChild(row);
    });
    return section;
  }

  function links(uid){
    const box = el('nav', 'app-you-links');
    box.setAttribute('aria-label', label('appTabs.you', 'You'));
    const offline = el('a', 'app-you-link');
    offline.href = '/downloads.html';
    offline.appendChild(icon(DOWNLOAD));
    offline.appendChild(el('span', 'app-you-linktext', label('appYou.offline', 'Offline maps')));
    const count = el('span', 'app-you-linkmeta');
    count.dataset.offlineCount = '';
    offline.appendChild(count);
    offline.appendChild(icon(CHEVRON, 16));
    box.appendChild(offline);

    const account = el('a', 'app-you-link');
    if(uid){
      account.href = '/settings.html';
      account.appendChild(icon(GEAR));
      account.appendChild(el('span', 'app-you-linktext', label('appYou.settings', 'Settings')));
      account.appendChild(icon(CHEVRON, 16));
    } else {
      account.href = '/?login=1&next=account.html';
      account.appendChild(icon(CHECK));
      account.appendChild(el('span', 'app-you-linktext', label('appYou.keepWalks', 'Keep walks on all your devices')));
      account.appendChild(el('span', 'app-you-signin', label('nav.login', 'Sign in')));
    }
    box.appendChild(account);
    return box;
  }

  // Only trails whose map is fully on the phone count.
  async function countOffline(hub){
    const target = hub.querySelector('[data-offline-count]');
    const offline = window.DoloPawsOffline;
    if(!target || !offline || typeof offline.listInstalledPackages !== 'function') return;
    try {
      const auth = window.DoloPawsAuth;
      const packages = await offline.listInstalledPackages(auth && auth.currentUser || null);
      if(!hub.isConnected) return;
      target.textContent = packages.length === 1
        ? label('appYou.oneTrail', '1 trail')
        : label('appYou.trails', '{count} trails', { count:packages.length });
    } catch(e){ /* the row still opens the downloads page */ }
  }

  let hub = null;
  function render(){
    const uid = currentUid();
    const list = walks(uid);
    const next = el('main', 'app-you');
    next.appendChild(header());
    const body = el('div', 'app-you-body');
    body.appendChild(dogCard(activeDog(summary()), uid));
    // A guest has no journal, so a row of zeros would say nothing.
    if(uid) body.appendChild(month(list));
    body.appendChild(recent(list, uid));
    body.appendChild(links(uid));
    next.appendChild(body);
    if(hub) hub.replaceWith(next);
    else document.body.insertBefore(next, document.body.firstChild);
    hub = next;
    document.body.classList.add('app-you-hub');
    countOffline(next);
  }

  function start(){
    render();
    const watch = () => {
      if(window.DoloPawsAuth && typeof window.DoloPawsAuth.onChange === 'function') window.DoloPawsAuth.onChange(render);
    };
    if(window.DoloPawsAuthReady) watch();
    else window.addEventListener('dolopaws-auth-ready', watch, { once:true });
    window.addEventListener('dolopaws-auth-changed', render);
    // Coming back from Edit or Settings shows what changed there.
    window.addEventListener('pageshow', event => { if(event.persisted) render(); });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
