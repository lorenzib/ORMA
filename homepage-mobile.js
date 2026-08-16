/* Mobile app layout for the logged-in homepage (≤700px) — ported from the
   Claude Design prototype "ORMA Homepage (Logged in) - Mobile.dc.html".

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
  // (design prototype: 0.26 / 0.46 / 0.84). 0 is the fully-hidden state:
  // only the grab handle stays visible so the map gets the whole screen.
  var SNAPS = [0, 0.26, 0.46, 0.84];
  var sheetPct = SNAPS[1];
  var lastOpenPct = SNAPS[1];
  var active = false;

  function listEl(){ return returning.querySelector('.li-list'); }

  function ensureUi(){
    var list = listEl();
    if(list && !list.querySelector('.mhome-grab')){
      var grab = document.createElement('div');
      grab.className = 'mhome-grab';
      grab.setAttribute('role', 'button');
      grab.setAttribute('tabindex', '0');
      grab.setAttribute('aria-label', 'Hide or show the trail list');
      grab.innerHTML = '<span></span>';
      list.insertBefore(grab, list.firstChild);
      wireDrag(grab);
    }
    // No app tab bar: ORMA stays a mobile website. Saved / Journal /
    // Profile are reached through the account menu in the toolbar, same
    // navigation model as every other page.
  }

  function measure(){
    // Standard site header on top, then the search toolbar; the map and the
    // sheet run from below both to the true bottom edge of the viewport.
    // The dark app header and greeting bar stay desktop-only.
    var nav = document.querySelector('.topnav');
    var navH = nav ? nav.offsetHeight : 0;
    var top = returning.querySelector('.li-toolbar');
    document.body.style.setProperty('--mhome-nav', navH + 'px');
    if(top) document.body.style.setProperty('--mhome-top', (navH + top.offsetHeight) + 'px');
    document.body.style.setProperty('--mhome-tabs', '0px');
  }

  // The bell and the account pill stay in the dark app header (desktop
  // only). On phones the standard topnav is visible and already carries
  // both in its menu — duplicating them in the search toolbar was noise.
  function placeAccountWrap(){
    var actions = returning.querySelector('.li-top-actions');
    var bell = document.getElementById('liBellWrap');
    var wrap = document.getElementById('liAccountWrap');
    if(actions && bell && bell.parentElement !== actions) actions.appendChild(bell);
    if(actions && wrap && wrap.parentElement !== actions) actions.appendChild(wrap);
  }

  function availH(){
    var top = parseFloat(getComputedStyle(document.body).getPropertyValue('--mhome-top')) || 62;
    return Math.max(120, window.innerHeight - top);
  }

  // Height of the always-visible sliver when the sheet is fully hidden:
  // the grab handle plus a little padding, never the sheet header.
  function handleH(){
    var grab = returning.querySelector('.mhome-grab');
    return (grab ? grab.offsetHeight : 18) + 12;
  }

  function setSheet(pct){
    sheetPct = pct;
    if(pct > 0) lastOpenPct = pct;
    var list = listEl();
    if(!list || !active) return;
    var h = Math.round(Math.max(handleH(), availH() * pct));
    // The sheet sits on the real bottom edge now, so the home-indicator
    // inset rides on top of the snap height.
    list.style.height = 'calc(' + h + 'px + env(safe-area-inset-bottom))';
    list.classList.toggle('mhome-sheet-hidden', pct === 0);
    // Anything that rides above the sheet (map attribution) follows it.
    document.body.style.setProperty('--mhome-sheet', h + 'px');
  }

  function toggleSheet(){
    setSheet(sheetPct === 0 ? lastOpenPct : 0);
  }

  // "See on map" on a trail card: drop the sheet to its low snap so the
  // focused route is actually visible.
  window.addEventListener('dolopaws-map-focus', function(){
    if(active && sheetPct > SNAPS[1]) setSheet(SNAPS[1]);
  });

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
      var moved = false;
      list.classList.add('mhome-dragging');
      try{ grab.setPointerCapture(e.pointerId); }catch(_){ }
      function move(ev){
        if(Math.abs(ev.clientY - startY) > 6) moved = true;
        lastH = Math.max(handleH(), Math.min(A * 0.9, startH + (startY - ev.clientY)));
        list.style.height = lastH + 'px';
      }
      function up(){
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        list.classList.remove('mhome-dragging');
        // A tap (no real drag) toggles hidden <-> last open height.
        if(!moved){ toggleSheet(); return; }
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
    grab.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleSheet(); }
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
