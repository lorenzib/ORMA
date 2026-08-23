/* Mobile app layout for the logged-in trail detail (≤700px) — ported from
   the Claude Design prototype "ORMA Trail Detail (Logged in) - Mobile".

   Same pattern as homepage-mobile.js: purely additive chrome on top of the
   desktop .td2 layout. Injects a compact top bar (back · brand · dog
   avatar), a scroll progress bar, a sticky Save/Start action bar and the
   bottom tab nav, then MOVES the page's real #detailSaveBtn/#heroStartHike
   into the action bar — handlers and state travel with the nodes, so no
   mirroring is needed. All visual re-layout lives in trail-mobile.css under
   body.mtrail-active. Activates only for signed-in visitors (the same
   dolopaws-profile-summary signal trail-detail-ui.js already uses); guests
   keep the plain responsive page. */
(function(){
  'use strict';

  var page = document.querySelector('.td2');
  if(!page) return;

  var mq = window.matchMedia('(max-width:700px)');
  var active = false;
  var actionsHome = null; // where the real buttons live on desktop
  var weather = document.querySelector('.td2-hero-weather');
  var weatherHome = weather && weather.parentElement;
  var weatherNext = weather && weather.nextSibling;
  var offlinePanel = document.getElementById('offlinePackagePanel');
  var offlineHome = offlinePanel && offlinePanel.parentElement;
  var offlineNext = offlinePanel && offlinePanel.nextSibling;

  function placeWeather(){
    var slot = document.getElementById('mobileWeatherSlot');
    if(!weather || !weatherHome || !slot) return;
    if(mq.matches && weather.parentElement !== slot) slot.appendChild(weather);
    if(!mq.matches && weather.parentElement !== weatherHome){
      weatherHome.insertBefore(weather, weatherNext);
    }
  }

  function placeDownloadAction(){
    var row = document.querySelector('.td2-actrow');
    if(!offlinePanel || !offlineHome || !row) return;
    if(mq.matches && offlinePanel.parentElement !== row){
      row.insertBefore(offlinePanel, row.firstChild);
    }
    if(!mq.matches && offlinePanel.parentElement !== offlineHome){
      offlineHome.insertBefore(offlinePanel, offlineNext);
    }
  }

  function profileSummary(){
    try { return JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null'); }
    catch(e){ return null; }
  }
  function signedIn(){
    if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser) return true;
    // Same dev-preview contract as the homepage (?view=returning).
    try { if(new URLSearchParams(window.location.search).get('view') === 'returning') return true; } catch(e){}
    var s = profileSummary();
    return !!(s && s.hasProfile);
  }

  function dogAvatarHtml(){
    var s = profileSummary();
    var active = s && Array.isArray(s.dogs)
      ? (s.dogs.find(function(dog){ return dog.id === s.activeDogId; }) || s.dogs[0])
      : null;
    var name = active && active.name ? String(active.name) : (s && s.name ? String(s.name) : '');
    var photo = active && typeof active.photo === 'string' && active.photo.indexOf('data:image/') === 0
      ? active.photo : null;
    if(photo) return '<span class="av" style="background-image:url(' + photo + ')" aria-hidden="true"></span>';
    return '<span class="av" aria-hidden="true">' + (name ? name.charAt(0).toUpperCase() : '🐾') + '</span>';
  }

  function ensureUi(){
    if(!document.getElementById('mtrailTop')){
      var top = document.createElement('div');
      top.className = 'mtrail-top';
      top.id = 'mtrailTop';
      top.innerHTML =
        '<a class="back" href="browse-trails.html">← <span>Trails</span></a>' +
        '<a class="brand" href="/"><img src="logo.svg" alt="">ORMA</a>' +
        '<a class="avlink" href="account.html" aria-label="Your account">' + dogAvatarHtml() + '</a>' +
        '<div class="mtrail-progress" aria-hidden="true"><span id="mtrailProgress"></span></div>';
      document.body.insertBefore(top, document.body.firstChild);
    }
    if(!document.getElementById('mtrailActions')){
      var bar = document.createElement('div');
      bar.className = 'mtrail-actions';
      bar.id = 'mtrailActions';
      document.body.appendChild(bar);
    }
    if(!document.getElementById('mtrailTabs')){
      var nav = document.createElement('nav');
      nav.className = 'mtrail-tabs';
      nav.id = 'mtrailTabs';
      nav.setAttribute('aria-label', 'Primary');
      nav.innerHTML =
        '<a href="/" class="on" aria-current="page">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>' +
          '<span>Map</span></a>' +
        '<a href="saved.html">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
          '<span>Saved</span></a>' +
        '<a href="journal.html">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
          '<span>Journal</span></a>' +
        '<a href="account.html">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>' +
          '<span>Profile</span></a>';
      document.body.appendChild(nav);
    }
  }

  // Move the hero's real Save / Start-the-hike buttons into the sticky bar
  // (and back). Their listeners, labels and .saved/.recording state are
  // owned by trail.js / trail-detail-ui.js and travel with the elements.
  function adoptButtons(){
    var bar = document.getElementById('mtrailActions');
    var save = document.getElementById('detailSaveBtn');
    var hike = document.getElementById('heroStartHike');
    if(!bar || !save) return;
    if(!actionsHome) actionsHome = save.parentElement;
    bar.appendChild(save);
    if(hike) bar.appendChild(hike);
  }
  function returnButtons(){
    if(!actionsHome) return;
    var save = document.getElementById('detailSaveBtn');
    var hike = document.getElementById('heroStartHike');
    if(save) actionsHome.appendChild(save);
    if(hike) actionsHome.appendChild(hike);
  }

  function measure(){
    var top = document.getElementById('mtrailTop');
    var bar = document.getElementById('mtrailActions');
    var tabs = document.getElementById('mtrailTabs');
    if(top) document.body.style.setProperty('--mtrail-top', top.offsetHeight + 'px');
    if(bar) document.body.style.setProperty('--mtrail-actions', bar.offsetHeight + 'px');
    if(tabs) document.body.style.setProperty('--mtrail-tabs', tabs.offsetHeight + 'px');
  }

  function onScroll(){
    if(!active) return;
    var fill = document.getElementById('mtrailProgress');
    if(!fill) return;
    var doc = document.documentElement;
    var max = (doc.scrollHeight - window.innerHeight) || 1;
    var pct = Math.max(0, Math.min(1, (window.scrollY || doc.scrollTop || 0) / max));
    fill.style.width = (pct * 100).toFixed(1) + '%';
  }

  function activate(){
    if(active) return;
    active = true;
    ensureUi();
    adoptButtons();
    document.body.classList.add('mtrail-active');
    measure();
    setTimeout(function(){ if(active){ measure(); onScroll(); } }, 120);
  }

  function deactivate(){
    if(!active) return;
    active = false;
    returnButtons();
    document.body.classList.remove('mtrail-active');
    document.body.style.removeProperty('--mtrail-top');
    document.body.style.removeProperty('--mtrail-actions');
    document.body.style.removeProperty('--mtrail-tabs');
  }

  function update(){
    placeWeather();
    placeDownloadAction();
    if(mq.matches && signedIn()) activate();
    else deactivate();
  }

  if(mq.addEventListener) mq.addEventListener('change', update);
  else if(mq.addListener) mq.addListener(update);
  window.addEventListener('dolopaws-auth-changed', function(){ setTimeout(update, 0); });
  window.addEventListener('resize', function(){ update(); if(active) measure(); });
  window.addEventListener('scroll', onScroll, { passive: true });

  update();
})();
