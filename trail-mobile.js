/* Mobile app layout for the logged-in trail detail (≤700px), ported from
   the Claude Design prototype "ORMA Trail Detail (Logged in) - Mobile".

   Same pattern as homepage-mobile.js: purely additive chrome on top of the
   desktop .td2 layout. Injects a compact top bar (back · brand · dog
   avatar) and a scroll progress bar. The complete set of
   real trail actions stays in the hero, so mobile has the same capabilities
   as desktop without mirrored handlers. All visual re-layout lives in
   trail-mobile.css under
   body.mtrail-active. Activates only for signed-in visitors (the same
   dolopaws-profile-summary signal trail-detail-ui.js already uses); guests
   keep the plain responsive page. */
(function(){
  'use strict';

  var page = document.querySelector('.td2');
  if(!page) return;

  var mq = window.matchMedia('(max-width:700px)');
  var active = false;
  var weather = document.querySelector('.td2-hero-weather');
  var weatherHome = weather && weather.parentElement;
  var weatherNext = weather && weather.nextSibling;
  var about = document.getElementById('td2AboutCard');
  var aboutHome = about && about.parentElement;
  var aboutNext = about && about.nextSibling;
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

  function placeAboutAfterRecommendation(){
    var recommendation = document.getElementById('recommendationDecision');
    if(!about || !aboutHome || !recommendation || !recommendation.parentElement) return;
    if(about.previousElementSibling !== recommendation){
      recommendation.insertAdjacentElement('afterend', about);
    }
  }

  function restoreAbout(){
    if(!about || !aboutHome || about.parentElement === aboutHome) return;
    if(aboutNext && aboutNext.parentElement === aboutHome) aboutHome.insertBefore(about, aboutNext);
    else aboutHome.appendChild(about);
  }

  function initMobileDisclosures(){
    document.querySelectorAll('.td2-mobile-card-toggle').forEach(function(button){
      if(button.dataset.mobileDisclosureReady === 'true') return;
      button.dataset.mobileDisclosureReady = 'true';
      button.addEventListener('click', function(){
        var card = button.closest('.td2-mobile-collapsible');
        if(!card) return;
        var collapsed = card.classList.toggle('is-mobile-collapsed');
        button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        var action = button.querySelector('.td2-mobile-toggle-action');
        if(action) action.innerHTML = (collapsed ? 'Show <span aria-hidden="true">⌄</span>' : 'Hide <span aria-hidden="true">⌃</span>');
      });
    });
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
  }

  function measure(){
    var top = document.getElementById('mtrailTop');
    if(top) document.body.style.setProperty('--mtrail-top', top.offsetHeight + 'px');
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
    placeAboutAfterRecommendation();
    document.body.classList.add('mtrail-active');
    measure();
    setTimeout(function(){ if(active){ measure(); onScroll(); } }, 120);
  }

  function deactivate(){
    if(!active) return;
    active = false;
    restoreAbout();
    document.body.classList.remove('mtrail-active');
    document.body.style.removeProperty('--mtrail-top');
  }

  function update(){
    initMobileDisclosures();
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
