(function(){
  'use strict';

  function trailIdentity(){
    const queryId = new URLSearchParams(location.search).get('id');
    const cta = document.querySelector('a[href*="trail.html?id="]');
    const linked = cta ? new URL(cta.href, location.href).searchParams.get('id') : null;
    const slug = location.pathname.split('/').pop().replace(/\.html$/, '');
    return { id:queryId || linked, slug };
  }

  function severityRank(value){ return { extreme:3, severe:2, moderate:1 }[value] || 0; }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[character]);
  }

  function installStyles(){
    if(document.getElementById('ormaHazardStyles')) return;
    const style = document.createElement('style');
    style.id = 'ormaHazardStyles';
    style.textContent = `
      .orma-hazard-stack{display:grid;gap:10px;margin:14px 0 22px}
      .map-hazard-report-btn{position:absolute;right:14px;bottom:14px;z-index:9;display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:9px 14px;border:1px solid rgba(156,58,37,.22);border-radius:11px;background:rgba(255,255,255,.96);color:#8f3827;box-shadow:0 6px 18px rgba(35,53,40,.2);font:800 12px/1.2 Inter,sans-serif;cursor:pointer}
      .map-hazard-report-btn:hover{border-color:#9c3a25;background:#fff}
      .map-hazard-report-btn[aria-busy="true"]{cursor:wait;opacity:.72}
      .orma-hazard-report{position:absolute;top:58px;right:14px;z-index:18;width:min(370px,calc(100% - 28px));max-height:calc(100% - 74px);overflow:auto;padding:16px;border:1px solid rgba(46,64,52,.16);border-radius:15px;background:rgba(255,255,255,.98);box-shadow:0 16px 42px rgba(23,42,28,.28);color:#2e4034;backdrop-filter:blur(10px)}
      .orma-hazard-report[hidden]{display:none}
      .orma-hazard-report__head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
      .orma-hazard-report__head strong{font:700 18px/1.15 'Bricolage Grotesque',sans-serif}
      .orma-hazard-report__close{width:32px;height:32px;border:0;border-radius:50%;background:#f2efe5;color:#2e4034;font:700 18px/1 Inter,sans-serif;cursor:pointer}
      .orma-hazard-report__intro{margin:0 0 12px;color:#66766b;font-size:12px;line-height:1.45}
      .orma-hazard-report__step{display:block;margin:12px 0 7px;color:#3e7a91;font-size:10px;font-weight:850;letter-spacing:.1em;text-transform:uppercase}
      .orma-hazard-report__place{display:grid;gap:8px;padding:11px;border:1px solid #e4e0d3;border-radius:12px;background:#faf8f1}
      .orma-hazard-report__place-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .orma-hazard-report__place button{padding:8px 11px;border:1px solid #c9bfae;border-radius:9px;background:#fff;color:#2e4034;font:750 11.5px Inter,sans-serif;cursor:pointer}
      .orma-hazard-report__place button.is-placing{border-color:#b9582e;background:#fff2e6;color:#8a3f1f}
      .orma-hazard-report__skip{border:0!important;background:transparent!important;color:#66766b!important;text-decoration:underline}
      .orma-hazard-report__where{margin:0;font-size:11.5px;line-height:1.45;color:#66766b}
      .orma-hazard-report__where.is-off{color:#8a2f24;font-weight:650}
      .orma-hazard-report form{display:grid;gap:9px;margin-top:2px}
      .orma-hazard-report form[hidden]{display:none}
      .orma-hazard-report label{display:grid;gap:4px;font-size:11.5px;font-weight:750;color:#2e4034}
      .orma-hazard-report select,.orma-hazard-report textarea,.orma-hazard-report input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid #cfc6b7;border-radius:9px;background:#fff;color:#2e4034;font:inherit;font-size:12.5px}
      .orma-hazard-report textarea{min-height:68px;resize:vertical}
      .orma-hazard-report__note{margin:0;color:#66766b;font-size:10.5px;line-height:1.45}
      .orma-hazard-report__submit{min-height:40px;border:0;border-radius:10px;background:#2e4034;color:#fff;font:800 12px Inter,sans-serif;cursor:pointer}
      .orma-hazard-report__submit:disabled{cursor:wait;opacity:.68}
      .orma-hazard-report__status{margin:0;font-size:11.5px;line-height:1.45}
      .orma-hazard-report__status.is-error{color:#8a2f24}
      .orma-hazard-pin,.orma-reported-hazard-pin{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;border:2px solid #fff;background:#b9582e;color:#fff;box-shadow:0 3px 9px rgba(0,0,0,.34);cursor:grab}
      .orma-reported-hazard-pin{width:26px;height:26px;cursor:pointer}
      .orma-hazard-pending,.orma-reported-hazard{display:flex;gap:11px;align-items:flex-start;padding:12px 13px;border:1px solid #ede9dd;border-radius:12px;background:#faf8f1}
      .orma-hazard-pending__icon,.orma-reported-hazard__icon{flex:none;width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:#f5e4c6;color:#8a5a16}
      .orma-hazard-pending strong,.orma-reported-hazard strong{display:block;margin-bottom:3px;color:#2e4034;font-size:12.5px}
      .orma-hazard-pending p,.orma-reported-hazard p{margin:0;color:#66766b;font-size:11.5px;line-height:1.45}
      .orma-hazard-pending small,.orma-reported-hazard small{display:block;margin-top:4px;color:#8a9689;font-size:10.5px;line-height:1.4}
      .orma-reported-hazard.is-unverified{border-style:dashed}
      .orma-reported-hazard__where{display:block;margin:2px 0 4px;color:#8a3f1f;font-size:11px;font-weight:750}
      .orma-hazard{padding:15px 17px;border:1px solid #d6934d;border-left:6px solid #b9582e;border-radius:10px;background:#fff6e8;color:#352a22}
      .orma-hazard.is-extreme{border-left-color:#91352d;background:#fff0ed}
      .orma-hazard strong{display:block;margin-bottom:6px;font-size:15px}
      .orma-hazard p{margin:0 0 8px;font-size:13px;line-height:1.5}
      .orma-hazard small{display:block;color:#6b625a;font-size:11px;line-height:1.4}
      .orma-hazard a,.orma-reported-hazard a{color:inherit;font-weight:800}
      @media(max-width:700px){
        .map-hazard-report-btn{right:12px;bottom:60px;min-height:38px;padding:8px 11px}
        .trail-map-box.hike-status-visible .map-hazard-report-btn{bottom:60px}
        .orma-hazard-report{position:absolute;top:auto;right:8px;bottom:8px;left:8px;width:auto;max-height:68%;padding:14px;border-radius:16px}
        .trail-map-box.map-fs .map-hazard-report-btn{right:max(12px,env(safe-area-inset-right));bottom:calc(max(12px,env(safe-area-inset-bottom)) + 48px)}
      }`;
    document.head.appendChild(style);
  }

  const HAZARD_KINDS = [
    ['closure','Trail or path closed'],
    ['route-damage','Damaged path, bridge or crossing'],
    ['livestock','Livestock or guardian dogs'],
    ['water','Water crossing or missing water'],
    ['snow-or-ice','Snow or ice'],
    ['rockfall','Rockfall or landslide'],
    ['other','Something else'],
  ];

  let reportController = null;
  let pendingOpen = false;
  let reportedHazards = [];
  let reportedMarkers = [];
  let trailSummary = null;

  function mapContext(){
    const context = window.DoloPawsTrailMapContext;
    return context && context.map && context.trail && Array.isArray(context.trail.path)
      ? context : null;
  }

  function requestMap(){
    if(typeof window.DoloPawsStartTrailMap === 'function'){
      window.DoloPawsStartTrailMap();
      return;
    }
    const loadButton = document.getElementById('mobileMapLoadBtn');
    if(loadButton && typeof loadButton.click === 'function') loadButton.click();
  }

  function showPendingReport(location){
    const mount = document.getElementById('trailHazardsPending');
    if(!mount) return;
    const where = location && window.OrmaHazardLocation
      ? window.OrmaHazardLocation.describeLocation(location) : '';
    mount.innerHTML = `<article class="orma-hazard-pending" data-hazard-pending>
      <span class="orma-hazard-pending__icon" aria-hidden="true">✓</span>
      <div><strong>Your report is being checked</strong>
      <p>${where ? `${escapeHtml(where)}. ` : ''}ORMA is checking it against independent sources now.</p>
      <small>Only you can see this pending status. Other walkers see the hazard only after vetting.</small></div>
    </article>`;
    window.dispatchEvent(new CustomEvent('orma-hazards-changed'));
    const section = document.getElementById('td2Hazards');
    if(section && section.scrollIntoView) section.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  function createReportController(context, trail, mapButton){
    const locator = window.OrmaHazardLocation;
    const map = context.map;
    const path = context.trail.path;
    if(!locator || !map || !Array.isArray(path) || path.length < 2) return null;

    let panel = null;
    let marker = null;
    let placed = null;
    let placing = false;

    function removeMarker(){
      if(marker) marker.remove();
      marker = null;
      placed = null;
    }

    function setPlacing(on){
      placing = on;
      if(!panel) return;
      const button = panel.querySelector('[data-hazard-place]');
      if(button){
        button.classList.toggle('is-placing', on);
        button.textContent = on ? 'Tap the trail line now' : (placed ? 'Move the pin' : 'Place on map');
      }
      const canvas = map.getCanvas && map.getCanvas();
      if(canvas) canvas.style.cursor = on ? 'crosshair' : '';
    }

    function armMapTap(){
      if(!placing || !map.once) return;
      map.once('click', event => {
        if(!placing) return;
        place(event.lngLat);
      });
    }

    function revealForm(){
      if(!panel) return;
      panel.querySelector('form').hidden = false;
      panel.querySelector('[data-hazard-detail-step]').hidden = false;
    }

    function place(coordinate){
      const located = locator.locateOnRoute(coordinate, path);
      if(!located || !panel) return;
      const where = panel.querySelector('[data-hazard-where]');
      if(!located.onRoute){
        placed = null;
        where.classList.add('is-off');
        where.textContent = `That point is about ${located.offRouteM} m from this trail. Tap the trail line instead.`;
        setPlacing(true);
        armMapTap();
        return;
      }
      placed = located;
      where.classList.remove('is-off');
      where.textContent = `${locator.describeLocation(located)}. Drag the pin to fine-tune it.`;
      const point = [located.lng, located.lat];
      if(marker) marker.setLngLat(point);
      else {
        const element = document.createElement('div');
        element.className = 'orma-hazard-pin';
        element.innerHTML = '<span aria-hidden="true">!</span>';
        marker = new maplibregl.Marker({ element, draggable:true }).setLngLat(point).addTo(map);
        marker.on('dragend', () => place(marker.getLngLat()));
      }
      setPlacing(false);
      revealForm();
    }

    function skipLocation(){
      removeMarker();
      setPlacing(false);
      const where = panel.querySelector('[data-hazard-where]');
      where.classList.remove('is-off');
      where.textContent = 'No map position will be attached. You can still describe where it was below.';
      revealForm();
    }

    function close(){
      setPlacing(false);
      removeMarker();
      if(panel) panel.remove();
      panel = null;
      if(mapButton) mapButton.hidden = false;
    }

    function open(){
      if(panel){ panel.hidden = false; setPlacing(true); armMapTap(); return; }
      const mapBox = document.getElementById('trailMapBox');
      if(!mapBox) return;
      panel = document.createElement('section');
      panel.className = 'orma-hazard-report';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-labelledby', 'ormaHazardReportTitle');
      panel.innerHTML = `
        <div class="orma-hazard-report__head"><strong id="ormaHazardReportTitle">Report a hazard</strong><button type="button" class="orma-hazard-report__close" data-hazard-close aria-label="Close hazard report">×</button></div>
        <p class="orma-hazard-report__intro">Show the next walker where conditions changed. Your report is checked before anyone else sees it.</p>
        <span class="orma-hazard-report__step">1 · Mark where you saw it</span>
        <div class="orma-hazard-report__place">
          <p class="orma-hazard-report__where" data-hazard-where>Tap the trail line on the map. The pin will snap to the route.</p>
          <div class="orma-hazard-report__place-actions"><button type="button" data-hazard-place>Tap the trail line now</button><button type="button" class="orma-hazard-report__skip" data-hazard-skip>Skip location</button></div>
        </div>
        <span class="orma-hazard-report__step" data-hazard-detail-step hidden>2 · Tell us what changed</span>
        <form hidden>
          <label>What did you see?<select data-hazard-kind>${HAZARD_KINDS.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
          <label>Describe it<textarea data-hazard-text minlength="10" maxlength="600" required placeholder="What makes this a problem for the next dog and owner?"></textarea></label>
          <label>When did you see it?<input data-hazard-date type="date"></label>
          <p class="orma-hazard-report__note">ORMA checks this against official sources. Credible reports may appear clearly labelled as unconfirmed when no independent notice exists.</p>
          <button type="submit" class="orma-hazard-report__submit">Send report</button>
          <p class="orma-hazard-report__status" data-hazard-status role="status"></p>
        </form>`;
      mapBox.appendChild(panel);
      if(mapButton) mapButton.hidden = true;
      const observedOn = panel.querySelector('[data-hazard-date]');
      observedOn.max = new Date().toISOString().slice(0, 10);
      observedOn.value = observedOn.max;
      panel.querySelector('[data-hazard-close]').addEventListener('click', close);
      panel.querySelector('[data-hazard-place]').addEventListener('click', () => {
        setPlacing(!placing);
        if(placing) armMapTap();
      });
      panel.querySelector('[data-hazard-skip]').addEventListener('click', skipLocation);
      panel.querySelector('form').addEventListener('submit', async event => {
        event.preventDefault();
        const community = window.DoloPawsCommunity;
        const submit = panel.querySelector('.orma-hazard-report__submit');
        const status = panel.querySelector('[data-hazard-status]');
        const text = panel.querySelector('[data-hazard-text]').value.trim();
        if(text.length < 10){
          status.classList.add('is-error');
          status.textContent = 'Describe what you saw in a sentence or two.';
          return;
        }
        if(!community || typeof community.reportTrailHazard !== 'function'){
          status.classList.add('is-error');
          status.textContent = 'Account services are still loading. Please try again.';
          return;
        }
        submit.disabled = true;
        status.classList.remove('is-error');
        status.textContent = 'Sending your report…';
        try {
          const submittedLocation = placed && placed.onRoute ? placed : null;
          const result = await community.reportTrailHazard(
            { id:trail.id, name:trail.name, area:trail.area },
            panel.querySelector('[data-hazard-kind]').value,
            text,
            observedOn.value,
            submittedLocation,
          );
          if(result && result.ok){
            close();
            showPendingReport(submittedLocation);
            return;
          }
          status.classList.add('is-error');
          status.textContent = result && result.message ? result.message : 'Could not send your report, please try again.';
        } catch(error){
          status.classList.add('is-error');
          status.textContent = 'Could not send your report, please try again.';
        }
        submit.disabled = false;
      });
      setPlacing(true);
      armMapTap();
    }

    return { open, close };
  }

  function ensureReporter(){
    installStyles();
    const button = document.getElementById('addReportBtn');
    if(button && !button.dataset.ormaHazardBound){
      button.dataset.ormaHazardBound = 'true';
      button.addEventListener('click', () => reporterApi.open());
    }
    const context = mapContext();
    if(!context || !button) return;
    if(!reportController){
      reportController = createReportController(context, context.trail || trailSummary, button);
    }
    button.removeAttribute('aria-busy');
    if(pendingOpen && reportController){
      pendingOpen = false;
      reportController.open();
    }
  }

  const reporterApi = {
    open(){
      if(window.DoloPawsAuth && !window.DoloPawsAuth.currentUser){
        if(window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('report');
        return;
      }
      ensureReporter();
      if(reportController){ reportController.open(); return; }
      pendingOpen = true;
      const button = document.getElementById('addReportBtn');
      if(button) button.setAttribute('aria-busy', 'true');
      requestMap();
    },
    close(){ if(reportController) reportController.close(); },
  };
  window.OrmaHazardReporter = reporterApi;

  function hazardCard(item, reported){
    const spoken = window.OrmaHazardLocation && window.OrmaHazardLocation.describeLocation(item.at);
    const verification = item.verificationState === 'reported-unverified'
      ? 'Reported by a hiker · not yet confirmed'
      : 'Confirmed by ORMA';
    if(reported){
      return `<article class="orma-reported-hazard${item.verificationState === 'reported-unverified' ? ' is-unverified' : ''}" data-hazard-item>
        <span class="orma-reported-hazard__icon" aria-hidden="true">!</span>
        <div><strong>${escapeHtml(item.title)}</strong>${spoken ? `<span class="orma-reported-hazard__where">${escapeHtml(spoken)}</span>` : ''}
        <p>${escapeHtml(item.message)}</p><small>${escapeHtml(verification)}${item.expiresAt ? ` · expires ${new Date(item.expiresAt).toLocaleDateString()}` : ''}</small></div>
      </article>`;
    }
    const card = document.createElement('article');
    card.className = `orma-hazard is-${item.severity}`;
    const title = document.createElement('strong');
    title.textContent = item.title;
    card.append(title);
    if(spoken){
      const at = document.createElement('b');
      at.className = 'orma-hazard__where';
      at.textContent = spoken;
      card.append(at);
    }
    const copy = document.createElement('p');
    copy.textContent = item.message;
    const detail = document.createElement('small');
    if(item.sourceUrl){
      const source = document.createElement('a');
      source.href = item.sourceUrl;
      source.target = '_blank';
      source.rel = 'noopener';
      source.textContent = `Check ${item.sourceLabel} ↗`;
      detail.append(source);
    } else detail.append(document.createTextNode(item.sourceLabel || 'Official warning'));
    if(item.expiresAt) detail.append(document.createTextNode(` · source expiry ${new Date(item.expiresAt).toLocaleString()}`));
    card.append(copy, detail);
    return card;
  }

  function renderReportedMarkers(){
    reportedMarkers.forEach(marker => marker.remove());
    reportedMarkers = [];
    const context = mapContext();
    if(!context || typeof maplibregl === 'undefined') return;
    reportedHazards.filter(item => item.at && Number.isFinite(Number(item.at.lat)) && Number.isFinite(Number(item.at.lng)))
      .forEach(item => {
        const element = document.createElement('div');
        element.className = 'orma-reported-hazard-pin';
        element.innerHTML = '<span aria-hidden="true">!</span>';
        const marker = new maplibregl.Marker({ element })
          .setLngLat([Number(item.at.lng), Number(item.at.lat)])
          .setPopup(new maplibregl.Popup({ offset:16 }).setHTML(`<b>${escapeHtml(item.title)}</b><br><small>${escapeHtml(item.verificationState === 'reported-unverified' ? 'Hiker report · unconfirmed' : 'Confirmed by ORMA')}</small>`))
          .addTo(context.map);
        reportedMarkers.push(marker);
      });
  }

  function renderReportedHazards(){
    const mount = document.getElementById('trailPublishedHazards');
    if(mount) mount.innerHTML = reportedHazards.map(item => hazardCard(item, true)).join('');
    renderReportedMarkers();
    window.dispatchEvent(new CustomEvent('orma-hazards-changed'));
  }

  function renderOfficialHazards(hazards){
    if(!hazards.length) return;
    const stack = document.createElement('section');
    stack.className = 'orma-hazard-stack';
    stack.setAttribute('aria-label', 'Current area warnings');
    hazards.forEach(item => stack.append(hazardCard(item, false)));
    const anchor = document.getElementById('ormaHazardMount') || document.querySelector('.sp-badges') || document.querySelector('main h1') || document.querySelector('main');
    if(anchor && anchor.parentNode) anchor.insertAdjacentElement('afterend', stack);
    else if(document.body) document.body.prepend(stack);
  }

  async function load(){
    const identity = trailIdentity();
    if(!identity.id && !identity.slug) return;
    const heading = document.querySelector('main h1');
    trailSummary = {
      id:identity.id || identity.slug,
      name:heading ? heading.textContent.trim() : identity.slug,
      area:(document.querySelector('[data-trail-area]') || {}).textContent || '',
    };
    installStyles();
    ensureReporter();
    window.addEventListener('dolopaws-trail-map-ready', () => {
      ensureReporter();
      renderReportedMarkers();
    });
    window.addEventListener('dolopaws-auth-ready', ensureReporter, { once:true });

    const prefix = location.pathname.includes('/trails/') ? '../' : '';
    const response = await fetch(`${prefix}data/dynamic-hazards.json`, { cache:'no-store' });
    if(!response.ok) return;
    const data = await response.json();
    const hazards = (data.hazards || [])
      .filter(item => (item.trailIds || []).includes(identity.id) || (item.trailSlugs || []).includes(identity.slug))
      .sort((a,b) => severityRank(b.severity) - severityRank(a.severity));
    reportedHazards = hazards.filter(item => item.origin === 'community');
    renderReportedHazards();
    renderOfficialHazards(hazards.filter(item => item.origin !== 'community'));
  }

  load().catch(() => {});
})();
