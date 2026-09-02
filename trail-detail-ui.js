/**
 * trail-detail-ui.js — small UI glue for the redesigned (single-scroll,
 * Strava-style) trail detail page. Self-contained: it only reads state the
 * other modules already own and reflects it into the new markup. No data
 * layer of its own. Runs only on pages that use the `.td2` layout.
 *
 * Responsibilities:
 *   1. Hero "Start the hike" button proxies hike-mode.js's map button, and a
 *      live recording banner mirrors the hike state.
 *   2. "Active now" pill on the hazards card follows #trailFlagsList content.
 *   3. Relevant section headings are personalised with the active dog's name.
 */
(function () {
  'use strict';
  if (!document.querySelector('.td2')) return;

  // ---- 1. Hero Start-the-hike proxy + live banner -------------------------
  const heroBtn = document.getElementById('heroStartHike');
  const liveBanner = document.getElementById('td2LiveBanner');
  const mapBox = document.getElementById('trailMapBox');
  const mobileHikeSlot = document.getElementById('mobileMapHikeSlot');
  const hikeHome = heroBtn && heroBtn.parentElement;
  const hikeNext = heroBtn && heroBtn.nextSibling;
  const mobileQuery = window.matchMedia('(max-width:700px)');

  function placeHikeAction() {
    if (!heroBtn || !hikeHome || !mobileHikeSlot) return;
    if (mobileQuery.matches && heroBtn.parentElement !== mobileHikeSlot) {
      mobileHikeSlot.appendChild(heroBtn);
    } else if (!mobileQuery.matches && heroBtn.parentElement !== hikeHome) {
      hikeHome.insertBefore(heroBtn, hikeNext);
    }
  }
  if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', placeHikeAction);
  else if (mobileQuery.addListener) mobileQuery.addListener(placeHikeAction);
  placeHikeAction();

  function recording() {
    return !!(mapBox && mapBox.classList.contains('hike-status-visible'));
  }

  // Live progress mirrored from hike-mode (elapsed clock + km walked), shown
  // in the banner and in the hero End button ("End · 12:34", per prototype).
  let hikeStartedAt = null;
  let elapsedTimer = null;
  function fmtElapsed() {
    if (!hikeStartedAt) return '0:00';
    const s = Math.max(0, Math.floor((Date.now() - hikeStartedAt) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
             : m + ':' + String(s % 60).padStart(2, '0');
  }
  function tickElapsed() {
    const el = document.getElementById('tdLiveElapsed');
    if (el) el.textContent = fmtElapsed();
    if (heroBtn && heroBtn.classList.contains('recording')) {
      const t = heroBtn.querySelector('.hike-elapsed');
      if (t) t.textContent = fmtElapsed();
    }
  }
  window.addEventListener('dolopaws-hike-progress', function (e) {
    hikeStartedAt = (e.detail && e.detail.startedAt) || hikeStartedAt;
    const dist = document.getElementById('tdLiveDist');
    if (dist && e.detail && typeof e.detail.km === 'number') dist.textContent = e.detail.km.toFixed(1) + ' km';
    if (!elapsedTimer) elapsedTimer = setInterval(tickElapsed, 1000);
    tickElapsed();
  });

  function syncHike() {
    const mapBtn = document.getElementById('mapStartHikeBtn');
    const rec = recording();
    if (heroBtn) {
      const nextHidden = !mapBtn;
      if (heroBtn.hidden !== nextHidden) heroBtn.hidden = nextHidden;
      heroBtn.classList.toggle('recording', rec);
      // On mobile this button lives inside mapBox, whose MutationObserver
      // calls syncHike. Replacing identical markup on every callback creates
      // a self-triggering mutation loop that locks the page. Only rewrite the
      // button when its actual state changes.
      const nextState = rec ? 'recording' : 'idle';
      if (heroBtn.dataset.hikeUiState !== nextState) {
        heroBtn.dataset.hikeUiState = nextState;
        heroBtn.innerHTML = rec
          ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> End · <span class="hike-elapsed">' + fmtElapsed() + '</span>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> Start the hike';
      }
    }
    if (liveBanner) liveBanner.hidden = !rec;
    if (!rec && elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; hikeStartedAt = null; }
  }
  if (heroBtn) {
    heroBtn.addEventListener('click', function () {
      const mapBtn = document.getElementById('mapStartHikeBtn');
      if (mapBtn) mapBtn.click();
    });
  }
  if (mapBox) {
    // hike-mode.js injects #mapStartHikeBtn and toggles .hike-status-visible.
    new MutationObserver(syncHike).observe(mapBox, {
      attributes: true, attributeFilter: ['class'], childList: true, subtree: true,
    });
  }
  // Poll briefly until hike-mode has injected its button, then let the
  // observer take over.
  let tries = 0;
  const iv = setInterval(function () {
    syncHike();
    if (document.getElementById('mapStartHikeBtn') || ++tries > 40) clearInterval(iv);
  }, 250);
  syncHike();

  // ---- 2. "Active now" hazard pill + section counts ----------------------
  const flags = document.getElementById('trailFlagsList');
  const hazardCard = document.getElementById('td2Hazards');
  const photos = document.getElementById('trailPhotosList');
  const reviews = document.getElementById('trailReviewsList');

  // Count real items in a list (children that aren't the empty-state block).
  function itemCount(list) {
    if (!list) return 0;
    if (list.querySelector('.empty-state')) return 0;
    return list.children.length;
  }
  function setCount(id, n) {
    const el = document.getElementById(id);
    if (el) el.textContent = n > 0 ? ' · ' + n : '';
  }
  function syncHazards() {
    if (!flags) return;
    const n = itemCount(flags);
    if (hazardCard) hazardCard.classList.toggle('has-active', n > 0);
    setCount('td2HazardCount', n);
  }
  function syncCounts() {
    const pc = itemCount(photos);
    setCount('td2PhotoCount', pc);
    const rc = itemCount(reviews);
    setCount('td2ReviewCount', rc);
    const photoCard = document.getElementById('td2PhotosCard');
    const reviewCard = document.getElementById('td2ReviewsCard');
    if (photoCard) photoCard.classList.toggle('is-empty', pc === 0);
    if (reviewCard) reviewCard.classList.toggle('is-empty', rc === 0);
    // Average rating from the rendered review ratings (aria-label "X out of 5").
    const avgEl = document.getElementById('td2ReviewAvg');
    if (avgEl && reviews) {
      const rated = [].map.call(reviews.querySelectorAll('.community-review__rating[aria-label]'), function (r) {
        const m = (r.getAttribute('aria-label') || '').match(/([\d.]+)\s*out of\s*5/i);
        return m ? parseFloat(m[1]) : null;
      }).filter(function (v) { return v != null; });
      if (rated.length) {
        const avg = rated.reduce(function (a, b) { return a + b; }, 0) / rated.length;
        avgEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:none;"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 18l-5.9 3.1 1.3-6.6L2.5 9.4l6.6-.8z"/></svg> ' + avg.toFixed(1);
        avgEl.hidden = false;
      } else { avgEl.hidden = true; }
    }
  }
  if (flags) { new MutationObserver(syncHazards).observe(flags, { childList: true, subtree: true }); syncHazards(); }
  if (photos) { new MutationObserver(syncCounts).observe(photos, { childList: true, subtree: true }); }
  if (reviews) { new MutationObserver(syncCounts).observe(reviews, { childList: true, subtree: true }); }
  syncCounts();

  // ---- 3. Personalise section headers with the dog's name ----------------
  // (The sidebar dog card with its own match % is gone — the hero already
  // shows "N% match for <dog>", so repeating it below was redundant.)
  function syncDog() {
    let name = '';
    try {
      const s = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null');
      if (s && s.hasProfile) name = s.name || '';
    } catch (e) { /* private mode — no summary */ }

    const safetyDog = document.getElementById('td2SafetyDog');
    if (safetyDog) safetyDog.textContent = name ? ' · ' + name : '';
    const nearbyTitle = document.getElementById('nearbyTitle');
    if (nearbyTitle && name) nearbyTitle.textContent = 'Nearby trails, ranked for ' + name;
    const liveTitle = document.getElementById('tdLiveTitle');
    if (liveTitle && name) liveTitle.textContent = 'Recording ' + name + '’s walk';
  }
  window.addEventListener('dolopaws-auth-changed', syncDog);
  syncDog();
})();
