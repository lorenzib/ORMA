/* Mobile app layout for the logged-in homepage (≤700px) — ported from the
   Claude Design prototype "DoloPaws Homepage (Logged in) - Mobile.dc.html".

   Purely additive on top of the desktop li-* shell: injects the bottom tab
   bar and the sheet grab handle, measures the top bar / tab bar heights into
   CSS variables, and drives the bottom-sheet drag with snap points. All
   visual re-layout lives in homepage-mobile.css under body.mhome-active.
   Search, filters, map, ranked list and the account menu keep their normal
   wiring — this module never re-renders content. */
(function(){
  'use strict';

  var returning = document.getElementById('returningCustomerHomepage');
  if(!returning) return;

  var mq = window.matchMedia('(max-width:700px)');
  // Sheet snap points as fractions of the space between top bar and tab bar
  // (design prototype: 0.26 / 0.46 / 0.84).
  var SNAPS = [0.26, 0.46, 0.84];
  var sheetPct = SNAPS[1];
  var active = false;

  function listEl(){ return returning.querySelector('.li-list'); }

  function ensureUi(){
    var list = listEl();
    if(list && !list.querySelector('.mhome-grab')){
      var grab = document.createElement('div');
      grab.className = 'mhome-grab';
      grab.setAttribute('aria-hidden', 'true');
      grab.innerHTML = '<span></span>';
      list.insertBefore(grab, list.firstChild);
      wireDrag(grab);
    }
    if(!document.getElementById('mhomeTabs')){
      var nav = document.createElement('nav');
      nav.className = 'mhome-tabs';
      nav.id = 'mhomeTabs';
      nav.setAttribute('aria-label', 'Primary');
      nav.innerHTML =
        '<a href="index.html" class="on" aria-current="page">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>' +
          '<span>Map</span></a>' +
        '<a href="saved.html">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
          '<span>Saved</span></a>' +
        '<a href="journal.html">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
          '<span>Journal</span></a>' +
        '<a href="account.html?next=index.html">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>' +
          '<span>Profile</span></a>';
      returning.appendChild(nav);
    }
  }

  function measure(){
    // The toolbar (search + filters + avatar) is the phone top bar; the dark
    // app header and greeting bar are hidden at this width.
    var top = returning.querySelector('.li-toolbar');
    var tabs = document.getElementById('mhomeTabs');
    if(top) document.body.style.setProperty('--mhome-top', top.offsetHeight + 'px');
    if(tabs) document.body.style.setProperty('--mhome-tabs', tabs.offsetHeight + 'px');
  }

  // The account pill lives in the dark header on desktop; on the phone
  // layout it joins the toolbar so it stays reachable.
  function placeAccountWrap(mobile){
    var wrap = document.getElementById('liAccountWrap');
    if(!wrap) return;
    if(mobile){
      var toolbar = document.getElementById('liToolbar');
      if(toolbar && wrap.parentElement !== toolbar) toolbar.appendChild(wrap);
    } else {
      var actions = returning.querySelector('.li-top-actions');
      if(actions && wrap.parentElement !== actions) actions.appendChild(wrap);
    }
  }

  function availH(){
    var top = parseFloat(getComputedStyle(document.body).getPropertyValue('--mhome-top')) || 62;
    var tabs = parseFloat(getComputedStyle(document.body).getPropertyValue('--mhome-tabs')) || 64;
    return Math.max(120, window.innerHeight - top - tabs);
  }

  function setSheet(pct){
    sheetPct = pct;
    var list = listEl();
    if(list && active) list.style.height = Math.round(availH() * pct) + 'px';
  }

  function wireDrag(grab){
    grab.addEventListener('pointerdown', function(e){
      if(!active) return;
      var list = listEl();
      if(!list) return;
      e.preventDefault();
      var startY = e.clientY;
      var startH = list.getBoundingClientRect().height;
      var A = availH();
      var lastH = startH;
      list.classList.add('mhome-dragging');
      try{ grab.setPointerCapture(e.pointerId); }catch(_){ }
      function move(ev){
        lastH = Math.max(A * 0.14, Math.min(A * 0.9, startH + (startY - ev.clientY)));
        list.style.height = lastH + 'px';
      }
      function up(){
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        list.classList.remove('mhome-dragging');
        // Snap from the tracked height, not a DOM measurement — if the whole
        // gesture lands in one frame the re-enabled transition would report
        // the pre-drag height and snap the sheet straight back.
        var cur = lastH / A;
        var best = SNAPS[0];
        for(var i = 0; i < SNAPS.length; i++){
          if(Math.abs(SNAPS[i] - cur) < Math.abs(best - cur)) best = SNAPS[i];
        }
        setSheet(best);
      }
      // Window-level listeners so the drag keeps tracking even where
      // setPointerCapture isn't honoured (the handle is small; fingers stray).
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  function activate(){
    if(active) return;
    active = true;
    ensureUi();
    placeAccountWrap(true);
    document.body.classList.add('mhome-active');
    window.scrollTo(0, 0);
    // classList.add applies synchronously, so measuring right away is safe;
    // the delayed pass catches font loading / safe-area settling.
    measure();
    setSheet(sheetPct);
    setTimeout(function(){
      if(!active) return;
      measure();
      setSheet(sheetPct);
    }, 120);
  }

  function deactivate(){
    if(!active) return;
    active = false;
    placeAccountWrap(false);
    document.body.classList.remove('mhome-active');
    document.body.style.removeProperty('--mhome-top');
    document.body.style.removeProperty('--mhome-tabs');
    var list = listEl();
    if(list) list.style.removeProperty('height');
  }

  function update(){
    if(mq.matches && !returning.hidden) activate();
    else deactivate();
  }

  if(mq.addEventListener) mq.addEventListener('change', update);
  else if(mq.addListener) mq.addListener(update);

  // script.js flips #returningCustomerHomepage.hidden synchronously inside
  // its own dolopaws-auth-changed handler, which runs before this one.
  window.addEventListener('dolopaws-auth-changed', function(){
    setTimeout(update, 0);
  });

  window.addEventListener('resize', function(){
    // Some environments never fire MediaQueryList 'change' on viewport
    // resize, so re-evaluate activation here as well.
    update();
    if(!active) return;
    measure();
    setSheet(sheetPct);
  });

  update();
})();
