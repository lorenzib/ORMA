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

  // P0-1: the breakdown sits directly under the Match %, headed in the dog's
  // name, and lists every factor the score was computed from in descending
  // order of impact. Each row carries both the points and the reason, so no
  // factor ever reads as a bare label or a bare number.
  function breakdown(view, tr){
    if(!view.breakdown.length) return '';
    const rows = view.breakdown.map(factor => {
      const points = factor.impact === 0
        ? tr('recommendation.breakdown.noCost', 'no cost')
        : `${factor.impact > 0 ? '+' : '\u2212'}${Math.abs(factor.impact)}`;
      const tone = factor.impact < 0 ? 'cost' : 'clear';
      return `<li><span class="recommendation-factor-impact is-${tone}">${esc(points)}</span>` +
        `<span class="recommendation-factor-reason">${esc(factor.message)}</span></li>`;
    }).join('');
    const note = view.breakdownNote
      ? `<p class="recommendation-breakdown-note">${esc(view.breakdownNote)}</p>`
      : '';
    return `<section class="recommendation-breakdown">` +
      `<h3>${esc(tr('recommendation.breakdown.title', 'Why this score for {name}', { name:view.breakdownFor }))}</h3>` +
      `<ol class="recommendation-factors">${rows}</ol>${note}</section>`;
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
    const id = new URLSearchParams(window.location.search).get('id');
    return typeof trails !== 'undefined' ? trails.find(trail => trail.id === id) : null;
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
    const recommendation = recommendTrail(trail, subjectFor(profile));
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
    // Dog-side gaps are the one thing the reader can fix right now — the
    // card face turns them into a profile CTA instead of a caveat.
    const gapCta = !view.dogName
      ? `<p class="recommendation-gaps"><a href="onboarding.html">${esc(tr('recommendation.gap.addDog', 'Add your dog to sharpen this score →'))}</a></p>`
      : view.dogGapFields.length
        ? `<p class="recommendation-gaps"><a href="account.html">${esc(tr('recommendation.gap.fields', 'Add {name}’s {fields} to sharpen this score →', {
            name:view.dogName,
            fields:friendlyList(view.dogGapFields),
          }))}</a></p>`
        : '';

    root.className = `recommendation-decision recommendation-decision--${view.tone}`;
    root.dataset.scoringVersion = view.scoringVersion;
    root.dataset.recommendationCategory = recommendation.category || '';
    root.dataset.recommendationConfidence = view.confidence;
    root.innerHTML =
      '<div class="recommendation-head">' +
        '<div>' +
          `<div class="recommendation-kicker">${esc(view.contextLabel)}</div>` +
          `<h2>${esc(view.conclusion)} ${score} ${chip}</h2>` +
          gapCta +
        '</div>' +
      '</div>' +
      // A heading over a line explaining that there is nothing to say is the
      // opposite of crisp. A section with nothing behind it is dropped; what
      // ORMA has not established stays in the unknowns disclosure below.
      breakdown(view, tr) +
      sections([
        [tr('recommendation.reasons.title', 'Why it may fit'), view.reasons],
        [tr('recommendation.cautions.title', 'Cautions'), view.cautions],
      ]) +
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
    renderDecision(trail, profile);
  }

  renderCurrent();
  if(!window.DoloPawsAuthReady){
    window.addEventListener('dolopaws-auth-ready', renderCurrent, { once:true });
  }
  window.addEventListener('dolopaws-auth-changed', renderCurrent);
})();
