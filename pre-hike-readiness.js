(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsReadiness = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const WEATHER_MAX_AGE_MS = 30 * 60 * 1000;
  const SELF_TEST_MAX_AGE_MS = 12 * 60 * 60 * 1000;

  function finite(value){
    return typeof value === 'number' && Number.isFinite(value);
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;',
    }[character]));
  }

  function item(id, level, title, detail, action){
    return { id, level, title, detail, action:action || null };
  }

  function interpolate(value, vars){
    let output = String(value == null ? '' : value);
    for(const key of Object.keys(vars || {})){
      output = output.split(`{${key}}`).join(vars[key]);
    }
    return output;
  }

  function translated(translate, key, fallback, vars){
    if(typeof translate === 'function'){
      const value = translate(key, vars);
      if(value && value !== key) return value;
    }
    return interpolate(fallback, vars);
  }

  function assess(input, now, translate){
    input = input || {};
    now = finite(now) ? now : Date.now();
    const tr = (key, fallback, vars) => translated(translate, key, fallback, vars);
    const items = [];
    const pkg = input.package || {};
    const packageUsable = !!pkg.usable;

    if(!pkg.supported){
      items.push(item(
        'package',
        'advisory',
        tr('readiness.package.unavailable.title', 'Offline map not available for this trail'),
        tr('readiness.package.unavailable.detail', 'Keep the trail page open and do not rely on mobile signal.'),
        null
      ));
    }else if(packageUsable){
      items.push(item(
        'package',
        'ready',
        tr('readiness.package.verified.title', 'Offline map verified on this device'),
        pkg.requiredChecked
          ? tr('readiness.package.verified.files', '{count} required files passed verification.', { count:pkg.requiredChecked })
          : tr('readiness.package.verified.detail', 'The stored package passed verification.'),
        'open-offline'
      ));
    }else{
      const broken = ['failed', 'incomplete'].includes(pkg.state);
      items.push(item(
        'package',
        input.online === false && broken ? 'blocker' : 'advisory',
        broken
          ? tr('readiness.package.repair.title', 'Offline map needs repair')
          : tr('readiness.package.missing.title', 'Offline map not downloaded'),
        broken
          ? tr('readiness.package.repair.detail', 'Do not rely on the stored package until it passes verification.')
          : tr('readiness.package.missing.detail', 'Download it before leaving coverage if you want the route offline.'),
        'download'
      ));
    }

    if(!packageUsable){
      items.push(item(
        'freshness',
        'advisory',
        tr('readiness.freshness.online.title', 'Current trail information must be checked online'),
        tr('readiness.freshness.online.detail', 'Recheck access, closures, weather, and local notices before leaving.')
      ));
    }else if(pkg.contentFreshness === 'stale'){
      items.push(item(
        'freshness',
        'advisory',
        tr('readiness.freshness.stale.title', 'Stored trail information needs an online recheck'),
        tr('readiness.freshness.stale.detail', 'The map remains usable, but current notices may have changed.')
      ));
    }else{
      items.push(item(
        'freshness',
        pkg.contentFreshness === 'current' ? 'ready' : 'advisory',
        pkg.contentFreshness === 'current'
          ? tr('readiness.freshness.current.title', 'Stored trail information is current')
          : tr('readiness.freshness.recheck.title', 'Recheck current notices before leaving'),
        pkg.contentFreshness === 'current'
          ? tr('readiness.freshness.current.detail', 'The package review window is current.')
          : tr('readiness.freshness.recheck.detail', 'The route is stored; live access and conditions still need a final check.')
      ));
    }

    const selfTest = input.selfTest || {};
    const selfTestFresh = packageUsable && selfTest.passed &&
      finite(selfTest.checkedAt) && now - selfTest.checkedAt <= SELF_TEST_MAX_AGE_MS;
    items.push(item(
      'self-test',
      selfTestFresh ? 'ready' : 'advisory',
      selfTestFresh
        ? tr('readiness.selfTest.passed.title', 'Offline self-test passed')
        : tr('readiness.selfTest.run.title', 'Run the airplane-mode self-test'),
      selfTestFresh
        ? tr('readiness.selfTest.passed.detail', 'Cached files were rechecked on this device.')
        : packageUsable
          ? tr('readiness.selfTest.run.detail', 'Verify cached files, then switch to airplane mode and open the offline map.')
          : tr('readiness.selfTest.unavailable.detail', 'The self-test becomes available after a verified package is installed.'),
      packageUsable ? 'self-test' : null
    ));

    const gps = input.gps || {};
    if(!gps.supported){
      items.push(item(
        'gps',
        'blocker',
        tr('readiness.gps.unavailable.title', 'GPS is unavailable'),
        tr('readiness.gps.unavailable.detail', 'This browser cannot provide a live position for hike mode.')
      ));
    }else if(gps.permission === 'denied'){
      items.push(item(
        'gps',
        'blocker',
        tr('readiness.gps.blocked.title', 'Location permission is blocked'),
        tr('readiness.gps.blocked.detail', 'Enable location for dolopaws.com in browser settings, then check again.'),
        'check-gps'
      ));
    }else if(gps.checking){
      items.push(item(
        'gps',
        'checking',
        tr('readiness.gps.checking.title', 'Checking GPS…'),
        tr('readiness.gps.checking.detail', 'Move into a clear outdoor area.')
      ));
    }else if(gps.fix && gps.fix.usableForProgress){
      items.push(item(
        'gps',
        'ready',
        tr('readiness.gps.usable.title', 'Usable GPS fix'),
        tr('readiness.gps.usable.detail', 'Accuracy is approximately ±{accuracy} m.', { accuracy:Math.round(gps.fix.accuracyM) }),
        'check-gps'
      ));
    }else{
      items.push(item(
        'gps',
        'blocker',
        gps.error || gps.fix
          ? tr('readiness.gps.unusable.title', 'GPS fix is not usable yet')
          : tr('readiness.gps.notChecked.title', 'GPS fix not checked'),
        gps.error || tr('readiness.gps.notChecked.detail', 'Check your position before starting hike mode.'),
        'check-gps'
      ));
    }

    const weather = input.weather || {};
    const weatherFresh = weather.status === 'ready' && finite(weather.capturedAt) &&
      now - weather.capturedAt <= WEATHER_MAX_AGE_MS;
    items.push(item(
      'weather',
      weatherFresh ? 'ready' : 'advisory',
      weatherFresh
        ? tr('readiness.weather.loaded.title', 'Weather snapshot loaded')
        : tr('readiness.weather.recheck.title', 'Weather needs a fresh check'),
      weatherFresh
        ? finite(weather.temperatureC)
          ? tr('readiness.weather.loaded.temperature', '{temperature}°C at the trailhead. Mountain conditions can still change quickly.', { temperature:Math.round(weather.temperatureC) })
          : tr('readiness.weather.loaded.detail', 'Mountain conditions can still change quickly.')
        : tr('readiness.weather.recheck.detail', 'Live weather is unavailable or older than 30 minutes; check another current source.')
    ));

    const trailhead = input.trailhead || {};
    items.push(item(
      'trailhead',
      trailhead.available ? 'ready' : 'advisory',
      trailhead.available
        ? tr('readiness.trailhead.available.title', 'Trailhead pin available')
        : tr('readiness.trailhead.unavailable.title', 'Trailhead pin unavailable'),
      trailhead.available
        ? trailhead.label || tr('readiness.trailhead.available.detail', 'Directions can be opened in your maps app.')
        : tr('readiness.trailhead.unavailable.detail', 'Confirm the starting point independently before setting out.'),
      trailhead.available ? 'directions' : null
    ));

    items.push(item(
      'emergency',
      'ready',
      tr('readiness.emergency.title', 'Emergency information available'),
      tr('readiness.emergency.detail', '112 works EU-wide. Save local contacts, tell someone your plan, and carry essential medication.'),
      'safety-guide'
    ));

    const counts = items.reduce((result, entry) => {
      result[entry.level] = (result[entry.level] || 0) + 1;
      return result;
    }, { ready:0, advisory:0, blocker:0, checking:0 });
    return {
      items,
      counts,
      canStart:counts.blocker === 0 && counts.checking === 0,
    };
  }

  function trailheadFor(trail){
    const start = trail && trail.startPoint || {};
    const lat = finite(start.lat) ? start.lat : trail && trail.lat;
    const lng = finite(start.lng) ? start.lng : trail && trail.lng;
    return {
      available:finite(lat) && finite(lng),
      lat,
      lng,
      label:start.label || trail && (trail.valley || trail.area) || '',
    };
  }

  function browserController(win){
    let modal = null;
    let state = null;
    let continuation = null;
    let currentTrail = null;
    let releaseDialogFocus = null;
    const selfTestsByTrail = new Map();
    const tr = (key, fallback, vars) => translated(win.t, key, fallback, vars);

    function ensureModal(){
      if(modal) return modal;
      modal = win.document.createElement('div');
      modal.id = 'preHikeReadiness';
      modal.className = 'pre-hike-readiness';
      modal.hidden = true;
      modal.innerHTML =
        '<div class="pre-hike-backdrop" data-readiness-action="close"></div>' +
        '<section class="pre-hike-sheet" role="dialog" aria-modal="true" aria-labelledby="preHikeTitle">' +
          `<button type="button" class="pre-hike-close" data-readiness-action="close" aria-label="${escapeHtml(tr('readiness.close', 'Close'))}">×</button>` +
          `<p class="pre-hike-kicker">${escapeHtml(tr('readiness.before', 'Before you leave'))}</p>` +
          `<h2 id="preHikeTitle">${escapeHtml(tr('readiness.title', 'Pre-hike readiness'))}</h2>` +
          '<p class="pre-hike-summary" id="preHikeSummary" role="status" aria-live="polite"></p>' +
          '<div class="pre-hike-list" id="preHikeList"></div>' +
          `<p class="pre-hike-boundary"><strong>${escapeHtml(tr('readiness.boundary.title', 'DoloPaws is a planning companion, not an emergency-navigation service.'))}</strong> ${escapeHtml(tr('readiness.boundary.detail', 'Offline maps and GPS do not replace waymarks, judgment, adequate equipment, or emergency preparation.'))}</p>` +
          '<div class="pre-hike-footer">' +
            `<button type="button" class="pre-hike-secondary" data-readiness-action="close">${escapeHtml(tr('readiness.notYet', 'Not yet'))}</button>` +
            `<button type="button" class="pre-hike-primary" data-readiness-action="continue">${escapeHtml(tr('readiness.start', 'Start hike'))}</button>` +
          '</div>' +
        '</section>';
      win.document.body.appendChild(modal);
      modal.addEventListener('click', handleAction);
      return modal;
    }

    function icon(level){
      return level === 'ready' ? '✓' : level === 'blocker' ? '!' :
        level === 'checking' ? '…' : 'i';
    }

    function render(){
      if(!modal || !state) return;
      const result = assess(state, undefined, win.t);
      const list = modal.querySelector('#preHikeList');
      list.innerHTML = result.items.map(entry =>
        `<article class="pre-hike-item pre-hike-item--${entry.level}">` +
          `<span class="pre-hike-icon" aria-hidden="true">${icon(entry.level)}</span>` +
          '<div class="pre-hike-item-copy">' +
            `<strong><span class="sr-only">${escapeHtml(entry.level)}: </span>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.detail)}</p>` +
          '</div>' +
          (entry.action
            ? `<button type="button" data-readiness-action="${entry.action}">${
              entry.action === 'check-gps' ? tr('readiness.action.gps', 'Check GPS') :
              entry.action === 'self-test' ? tr('readiness.action.selfTest', 'Run test') :
              entry.action === 'download' ? tr('readiness.action.download', 'Download') :
              entry.action === 'open-offline' ? tr('readiness.action.openMap', 'Open map') :
              entry.action === 'directions' ? tr('readiness.action.directions', 'Directions') :
              tr('readiness.action.guide', 'Open guide')
            }</button>`
            : '') +
        '</article>'
      ).join('');
      const summary = modal.querySelector('#preHikeSummary');
      summary.setAttribute('aria-busy', result.counts.checking ? 'true' : 'false');
      summary.textContent = result.canStart
        ? tr(
          result.counts.advisory === 1 ? 'readiness.summary.ready.one' : 'readiness.summary.ready.many',
          result.counts.advisory === 1
            ? '{ready} ready · {advisories} advisory to review'
            : '{ready} ready · {advisories} advisories to review',
          { ready:result.counts.ready, advisories:result.counts.advisory }
        )
        : tr(
          result.counts.blocker + result.counts.checking === 1
            ? 'readiness.summary.required.one'
            : 'readiness.summary.required.many',
          result.counts.blocker + result.counts.checking === 1
            ? '{count} check required before starting'
            : '{count} checks required before starting',
          { count:result.counts.blocker + result.counts.checking }
        );
      const proceed = modal.querySelector('[data-readiness-action="continue"]');
      proceed.disabled = !result.canStart;
      proceed.textContent = result.canStart
        ? tr('readiness.start', 'Start hike')
        : tr('readiness.completeChecks', 'Complete required checks');
    }

    async function inspectPackage(){
      const panel = win.document.getElementById('offlinePackagePanel');
      const supported = !!(panel && !panel.hidden);
      state.package = { supported, state:'not-downloaded', usable:false };
      if(supported && win.DoloPawsOffline && win.DoloPawsOffline.inspectPackage){
        try{
          state.package = Object.assign(
            { supported:true },
            await win.DoloPawsOffline.inspectPackage(currentTrail.id)
          );
        }catch(error){
          state.package = {
            supported:true,
            state:'failed',
            usable:false,
            message:error.message,
          };
        }
      }
      render();
    }

    async function permissionState(){
      if(!(win.navigator.permissions && win.navigator.permissions.query)) return;
      try{
        const result = await win.navigator.permissions.query({ name:'geolocation' });
        state.gps.permission = result.state;
        result.onchange = () => {
          state.gps.permission = result.state;
          if(result.state === 'denied') state.gps.fix = null;
          render();
        };
        render();
      }catch(error){}
    }

    function checkGps(){
      state.gps.checking = true;
      state.gps.error = '';
      render();
      win.navigator.geolocation.getCurrentPosition(position => {
        const policy = win.DoloPawsGpsPolicy;
        state.gps.checking = false;
        state.gps.permission = 'granted';
        state.gps.fix = policy
          ? policy.assessFix({
            now:Date.now(),
            timestamp:position.timestamp,
            accuracyM:position.coords.accuracy,
          })
          : {
            usableForProgress:finite(position.coords.accuracy) &&
              position.coords.accuracy <= 100,
            accuracyM:position.coords.accuracy,
          };
        render();
      }, error => {
        state.gps.checking = false;
        state.gps.fix = null;
        if(error.code === 1) state.gps.permission = 'denied';
        state.gps.error = error.code === 1
          ? tr('readiness.gps.error.denied', 'Location permission was denied.')
          : error.code === 3
            ? tr('readiness.gps.error.timeout', 'GPS timed out. Move into a clearer outdoor area and retry.')
            : tr('readiness.gps.error.unavailable', 'No GPS position is available. Move into a clearer area and retry.');
        render();
      }, {
        enableHighAccuracy:true,
        maximumAge:0,
        timeout:15000,
      });
    }

    async function runSelfTest(button){
      if(!(win.DoloPawsOffline && win.DoloPawsOffline.verifyInstalledPackage)) return;
      button.disabled = true;
      button.textContent = tr('readiness.testing', 'Testing…');
      const result = await win.DoloPawsOffline.verifyInstalledPackage(currentTrail.id);
      state.package = Object.assign({ supported:true }, result);
      state.selfTest = {
        passed:!!result.usable,
        checkedAt:Date.now(),
      };
      selfTestsByTrail.set(currentTrail.id, state.selfTest);
      render();
    }

    function close(){
      if(!modal) return;
      modal.hidden = true;
      win.document.documentElement.classList.remove('pre-hike-open');
      if(releaseDialogFocus){ releaseDialogFocus(); releaseDialogFocus = null; }
    }

    function handleAction(event){
      const button = event.target.closest('[data-readiness-action]');
      if(!button) return;
      const action = button.dataset.readinessAction;
      if(action === 'close') close();
      else if(action === 'check-gps') checkGps();
      else if(action === 'self-test') runSelfTest(button);
      else if(action === 'download'){
        close();
        const download = win.document.getElementById('offlineDownloadBtn');
        if(download) download.click();
      }else if(action === 'open-offline'){
        win.location.href = `offline/trail.html?id=${encodeURIComponent(currentTrail.id)}`;
      }else if(action === 'directions'){
        const target = state.trailhead;
        win.open(
          `https://maps.apple.com/?daddr=${target.lat},${target.lng}`,
          '_blank',
          'noopener'
        );
      }else if(action === 'safety-guide'){
        win.location.href = 'safety-guide.html#emergencyHeading';
      }else if(action === 'continue' && assess(state, undefined, win.t).canStart){
        const next = continuation;
        continuation = null;
        close();
        if(typeof next === 'function') next();
      }
    }

    async function open(trail, onContinue){
      currentTrail = trail;
      continuation = onContinue;
      const gpsSupported = !!(win.navigator && win.navigator.geolocation);
      state = {
        online:win.navigator.onLine !== false,
        package:{ supported:false, state:'not-downloaded', usable:false },
        selfTest:selfTestsByTrail.get(trail.id) || { passed:false, checkedAt:null },
        gps:{ supported:gpsSupported, permission:'prompt', fix:null, checking:false },
        weather:win.DoloPawsWeatherSnapshot || { status:'unavailable' },
        trailhead:trailheadFor(trail),
      };
      ensureModal().hidden = false;
      win.document.documentElement.classList.add('pre-hike-open');
      render();
      if(win.DoloPawsA11y){
        releaseDialogFocus = win.DoloPawsA11y.openDialog(
          modal.querySelector('.pre-hike-sheet'),
          { initialFocus:'.pre-hike-close', onEscape:close }
        );
      }else{
        const closeButton = modal.querySelector('.pre-hike-close');
        if(closeButton) closeButton.focus();
      }
      inspectPackage();
      permissionState();
    }

    win.addEventListener('dolopaws-weather-ready', event => {
      win.DoloPawsWeatherSnapshot = event.detail;
      if(state){
        state.weather = event.detail;
        render();
      }
    });

    return { open, close, assess:() => state ? assess(state, undefined, win.t) : null };
  }

  let controller = null;
  function open(trail, onContinue){
    if(typeof window === 'undefined') return;
    if(!controller) controller = browserController(window);
    controller.open(trail, onContinue);
  }

  return {
    WEATHER_MAX_AGE_MS,
    SELF_TEST_MAX_AGE_MS,
    assess,
    trailheadFor,
    browserController,
    open,
  };
});
