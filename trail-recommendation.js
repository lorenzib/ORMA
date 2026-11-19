(function(){
  'use strict';

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[char]);
  }

  function tr(key, fallback, vars){
    if(typeof window.t === 'function'){
      const value = window.t(key, vars);
      if(value && value !== key) return value;
    }
    let output = fallback;
    for(const name of Object.keys(vars || {})){
      output = output.split(`{${name}}`).join(vars[name]);
    }
    return output;
  }

  function list(items, emptyText){
    if(!items.length) return `<p class="recommendation-empty">${esc(emptyText)}</p>`;
    return `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  // P0-1 still holds: every factor behind the score is listed, under the
  // points link. What shows is short: the reasons that lower the score, one
  // line each, then what fits as a row of chips. The long "not checked yet"
  // list is gone; the unknowns an owner acts on (dog rules) are reasons.
  function breakdown(view, tr){
    const reasons = view.shortReasons || [];
    const chips = view.fitChips || [];
    if(!view.breakdown.length && !reasons.length) return '';
    const title = view.score === null
      ? tr('recommendation.breakdown.titleNoScore', 'Why this score for {name}', { name:view.breakdownFor })
      : tr('recommendation.breakdown.title', 'Why {score}% for {name}', { score:view.score, name:view.breakdownFor });
    const reasonList = reasons.length
      ? `<ul class="recommendation-reasons">${reasons.map(reason =>
          `<li class="is-${esc(reason.tone)}">${esc(reason.text)}</li>`).join('')}</ul>`
      : '';
    const fits = chips.length
      ? `<div class="recommendation-fits"><strong>${esc(tr('recommendation.fits.title', 'Fits {name}', { name:view.breakdownFor }))}</strong>` +
        `<ul>${chips.map(chip => `<li>${esc(chip)}</li>`).join('')}</ul></div>`
      : '';
    const note = view.breakdownNote
      ? `<p class="recommendation-breakdown-note">${esc(view.breakdownNote)}</p>`
      : '';
    const pointRows = (view.factorRows || []).map(row =>
      `<li><span class="recommendation-points-topic">${esc(row.topic)}</span>` +
        `<span class="recommendation-points-value is-${esc(row.tone)}">${esc(row.points)}</span></li>`).join('');
    const howLink = `<a class="recommendation-how" href="${esc(tr('recommendation.breakdown.howHref', 'how-scoring-works.html#steepness'))}">${esc(tr('recommendation.breakdown.how', 'How ORMA scores a walk'))}</a>`;
    const points = pointRows
      ? `<details class="recommendation-points"><summary>${esc(tr('recommendation.breakdown.points', 'How the score adds up'))}</summary>` +
        `<ol>${pointRows}</ol>${howLink}</details>`
      : howLink;
    return `<section class="recommendation-breakdown">` +
      `<h3>${esc(title)}</h3>` + reasonList + fits + note + points + `</section>`;
  }

  function sections(entries){
    const rendered = entries
      .filter(([, items]) => items.length)
      .map(([title, items]) =>
        `<section><h3>${esc(title)}</h3>${list(items)}</section>`)
      .join('');
    return rendered ? `<div class="recommendation-columns">${rendered}</div>` : '';
  }

  function renderGuideLinks(recommendation){
    const root = document.getElementById('trailGuideLinks');
    const api = window.DoloPawsRecommendationGuides;
    if(!root || !api){ return; }
    const safetyRows = document.getElementById('dogSafetyRows');
    if(!safetyRows) return;
    safetyRows.querySelectorAll('[data-guide-id]').forEach(row => {
      const guide = api.GUIDES[row.dataset.guideId];
      if(!guide || row.querySelector('.safety-row-guide')) return;
      const copy = row.querySelector('.safety-row-copy') || row;
      copy.insertAdjacentHTML('beforeend',
        `<a class="safety-row-guide" href="${esc(guide.href)}">${esc(tr(`recommendation.guide.${guide.id}.label`, guide.label))} <span aria-hidden="true">→</span></a>`
      );
    });
    root.hidden = true;
    root.innerHTML = '';
  }

  function currentTrail(){
    const raw = new URLSearchParams(window.location.search).get('id');
    const id = (window.DoloPawsRegionalData && window.DoloPawsRegionalData.resolveTrailId ? window.DoloPawsRegionalData.resolveTrailId(raw) : (raw));
    return typeof trails !== 'undefined' ? trails.find(trail => trail.id === id) : null;
  }

  // P0-3: what the reader saw before they added their dog, so the change can
  // be shown rather than explained.
  let previousRender = null;
  let pendingCallout = null;

  function guestProfile(){
    try{
      const raw = window.localStorage.getItem('dolopaws-pending-dog-profile');
      const profile = raw ? JSON.parse(raw) : null;
      return profile && typeof profile === 'object' && profile.name ? profile : null;
    }catch(error){
      return null;
    }
  }

  function subjectFor(profile){
    if(!profile) return {};
    return typeof effectiveOverrides === 'function'
      ? effectiveOverrides(profile, null)
      : profile;
  }

  function renderDecision(trail, profile){
    const root = document.getElementById('recommendationDecision');
    const api = window.DoloPawsRecommendationDecision;
    if(!root || !api || typeof recommendTrail !== 'function') return;
    // The weather arrives after the first paint, so the card scores without it
    // and re-scores when it lands. Absent conditions stay 'not-provided'
    // rather than being guessed at.
    // Official area warnings arrive from trail-hazards.js on their own clock;
    // they ride alongside the weather so the engine can note them at no cost.
    const warnings = Array.isArray(window.OrmaAreaWarnings) ? window.OrmaAreaWarnings : [];
    const conditions = window.DoloPawsCurrentConditions || warnings.length
      ? { status:'not-provided', ...(window.DoloPawsCurrentConditions || {}), warnings }
      : undefined;
    // A walk that is not a loop is scored as the reader chose to see it: one
    // way, or there and back on the same paths (route-return.js).
    const routeReturn = window.ORMARouteReturn;
    const oneWay = !!(routeReturn && routeReturn.hasChoice && routeReturn.hasChoice(trail));
    const scored = oneWay ? routeReturn.forView(trail) : trail;
    const recommendation = recommendTrail(scored, subjectFor(profile), conditions);
    const routeNoteText = !oneWay ? ''
      : scored.returnLeg
        ? tr('recommendation.routeView.back', 'Scored for walking there and back: {km} km, about {climb} m up and the same down. The time is an estimate.', { km:scored.distance, climb:scored.elevation })
      : scored.oneWayOf
        ? tr('recommendation.routeView.leg', 'Scored for one way: {km} km and about {climb} m up. No one-way time is given, so plan how you will get back.', { km:scored.distance, climb:scored.elevation })
      : routeReturn.isThereAndBack(trail)
        ? tr('recommendation.routeView.roundTrip', 'Scored for there and back on the same path, as the source gives it.')
        : tr('recommendation.routeView.oneWay', 'Scored for one way. This walk ends away from its start, so plan how you will get back.');
    const routeNote = routeNoteText ? `<p class="recommendation-route-view">${esc(routeNoteText)}</p>` : '';
    const view = api.present(recommendation, {
      dogName:profile && profile.name,
      translate:window.t,
    });
    const score = view.score === null ? '' : `<span class="recommendation-score">${view.score}%</span>`;
    // Confidence rides next to the score as a calm data-completeness chip;
    // the audit trail (scoring version, trail-data gaps) lives in the
    // evidence disclosure, not on the card face.
    const chip = view.confidenceLabel
      ? `<span class="recommendation-confidence recommendation-confidence--${esc(view.confidence)}">${esc(view.confidenceLabel)}</span>`
      : '';
    // Dog-side gaps are the one thing the reader can fix right now, the
    // card face turns them into a profile CTA instead of a caveat.
    const canOpenWizard = !!(window.DoloPawsWizard && typeof window.DoloPawsWizard.open === 'function');
    const gapCta = !view.dogName
      ? (canOpenWizard
        ? `<p class="recommendation-gaps"><button type="button" class="recommendation-add-dog" data-add-dog>${esc(tr('recommendation.gap.addDog', 'Add your dog to sharpen this score →'))}</button></p>`
        : `<p class="recommendation-gaps"><a href="onboarding.html">${esc(tr('recommendation.gap.addDog', 'Add your dog to sharpen this score →'))}</a></p>`)
      : view.dogGapFields.length
        ? `<p class="recommendation-gaps"><a href="account.html">${esc(tr('recommendation.gap.fields', 'Add {name}’s {fields} to sharpen this score →', {
            name:view.dogName,
            fields:friendlyList(view.dogGapFields),
          }))}</a></p>`
        : '';

    const thisRender = { score:view.score, forName:view.breakdownFor };
    pendingCallout = api.firstRunCallout(previousRender, thisRender, window.t);
    previousRender = thisRender;

    root.className = `recommendation-decision recommendation-decision--${view.tone}`;
    root.dataset.scoringVersion = view.scoringVersion;
    root.dataset.recommendationCategory = recommendation.category || '';
    root.dataset.recommendationConfidence = view.confidence;
    root.innerHTML =
      '<div class="recommendation-head">' +
        '<div>' +
          `<div class="recommendation-kicker">${esc(view.contextLabel)}</div>` +
          `<h2>${esc(view.conclusion)} ${score} ${chip}</h2>` +
          routeNote +
          gapCta +
        '</div>' +
      '</div>' +
      // A heading over a line explaining that there is nothing to say is the
      // opposite of crisp. A section with nothing behind it is dropped; what
      // ORMA has not established stays in the unknowns disclosure below.
      breakdown(view, tr) +
      // The breakdown already carries every reason and caution with its
      // points; repeating them as two more lists doubled the card. The lists
      // only appear when an engine gives no breakdown to show instead.
      (view.breakdown.length ? '' : sections([
        [tr('recommendation.reasons.title', 'Why it may fit'), view.reasons],
        [tr('recommendation.cautions.title', 'Cautions'), view.cautions],
      ])) +
      '<div class="recommendation-actions" aria-label="Trail actions">' +
        `<button type="button" data-recommendation-save>${esc(tr('recommendation.action.save', 'Save trail'))}</button>` +
        `<button type="button" data-recommendation-compare>${esc(tr('recommendation.action.compare', 'Add to comparison'))}</button>` +
        `<button type="button" data-recommendation-download disabled>${esc(tr('recommendation.action.offlineUnavailable', 'Offline map unavailable'))}</button>` +
      '</div>';
    root.hidden = false;

    renderGuideLinks(recommendation);
    const hero = document.getElementById('heroVerdict');
    if(hero) hero.textContent = view.heroSummary;
    wireActions(root, trail);
  }

  function friendlyList(items){
    const labels = items.map(item => tr(
      `recommendation.profileField.${item}`,
      item
    ));
    if(labels.length <= 1) return labels.join('');
    return tr('recommendation.list.and', '{first} and {last}', {
      first:labels.slice(0, -1).join(', '),
      last:labels[labels.length - 1],
    });
  }

  function wireActions(root, trail){
    const save = root.querySelector('[data-recommendation-save]');
    const originalSave = document.getElementById('detailSaveBtn');
    const syncSave = () => {
      save.textContent = originalSave && originalSave.classList.contains('saved')
        ? tr('recommendation.action.saved', 'Saved')
        : tr('recommendation.action.save', 'Save trail');
      save.setAttribute('aria-pressed', String(!!(
        originalSave && originalSave.classList.contains('saved')
      )));
    };
    save.disabled = !originalSave;
    if(originalSave){
      syncSave();
      save.addEventListener('click', () => originalSave.click());
      new MutationObserver(syncSave).observe(originalSave, {
        attributes:true,
        childList:true,
        subtree:true,
      });
    }

    const compare = root.querySelector('[data-recommendation-compare]');
    const comparison = window.DoloPawsComparisonState;
    if(comparison){
      const available = trails.map(item => item.id);
      const selected = comparison.load(localStorage, available);
      const alreadySelected = selected.includes(trail.id);
      compare.textContent = alreadySelected
        ? tr('recommendation.action.openComparison', 'Open comparison')
        : tr('recommendation.action.compare', 'Add to comparison');
      compare.addEventListener('click', () => {
        let ids = comparison.load(localStorage, available);
        if(!ids.includes(trail.id)) ids = comparison.toggle(ids, trail.id);
        comparison.save(localStorage, ids);
        window.location.href = ids.length >= 2
          ? comparison.compareHref(ids)
          : 'browse-trails.html';
      });
    }else{
      compare.disabled = true;
    }

    const download = root.querySelector('[data-recommendation-download]');
    const originalDownload = document.getElementById('offlineDownloadBtn');
    const offlinePanel = document.getElementById('offlinePackagePanel');
    const enableDownload = () => {
      if(!offlinePanel || offlinePanel.hidden) return;
      download.disabled = false;
      download.textContent = tr('recommendation.action.download', 'Download offline map');
    };
    if(window.DoloPawsOffline && originalDownload){
      if(offlinePanel){
        enableDownload();
        new MutationObserver(enableDownload).observe(offlinePanel, { attributes:true });
      }
      window.DoloPawsOffline.availablePackage(trail.id).then(manifest => {
        if(!manifest) return;
        enableDownload();
      }).catch(() => {});
      download.addEventListener('click', () => {
        if(!download.disabled) originalDownload.click();
      });
    }
  }

  async function renderCurrent(){
    const trail = currentTrail();
    if(!trail) return;
    let profile = null;
    if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
      try { profile = await window.DoloPawsAuth.getDogProfile(); } catch(error){}
    }
    // No account yet is not the same as no dog. A guest who added one scores
    // against it here and on every other trail, until they choose to save.
    if(!profile) profile = guestProfile();
    renderDecision(trail, profile);
    const add = document.getElementById('recommendationDecision');
    const trigger = add && add.querySelector('[data-add-dog]');
    if(trigger){
      // Opened in place, and told to come back here rather than to a payoff
      // screen listing other trails.
      trigger.addEventListener('click', () => {
        window.DoloPawsWizard.open(null, { returnToPage:true });
      });
    }
    if(pendingCallout){
      // A visible change, once, so the reader sees the score move rather than
      // finding a different number where the old one was.
      add.classList.add('is-rescored');
      window.setTimeout(() => add.classList.remove('is-rescored'), 1400);
      pendingCallout = null;
    }
  }

  renderCurrent();
  if(!window.DoloPawsAuthReady){
    window.addEventListener('dolopaws-auth-ready', renderCurrent, { once:true });
  }
  window.addEventListener('dolopaws-auth-changed', renderCurrent);
  window.addEventListener('dolopaws-dog-profile-saved', renderCurrent);
  window.addEventListener('dolopaws-conditions-ready', renderCurrent);
  window.addEventListener('orma-area-warnings-ready', renderCurrent);
  window.addEventListener('orma-route-view-changed', renderCurrent);
})();
