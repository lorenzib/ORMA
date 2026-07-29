(function(){
  'use strict';

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[char]);
  }

  function list(items, emptyText){
    if(!items.length) return `<p class="recommendation-empty">${esc(emptyText)}</p>`;
    return `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
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
    });
    const score = view.score === null ? '' : `<span class="recommendation-score">${view.score}%</span>`;
    const unknownSummary = view.unknowns.length || view.additionalUnknowns
      ? `${view.unknowns.length + view.additionalUnknowns} unknown item${
        view.unknowns.length + view.additionalUnknowns === 1 ? '' : 's'
      }`
      : 'No unknown items';

    root.className = `recommendation-decision recommendation-decision--${view.tone}`;
    root.dataset.scoringVersion = view.scoringVersion;
    root.dataset.recommendationCategory = recommendation.category || '';
    root.dataset.recommendationConfidence = view.confidence;
    root.innerHTML =
      '<div class="recommendation-head">' +
        '<div>' +
          `<div class="recommendation-kicker">${esc(view.contextLabel)}</div>` +
          `<h2>${esc(view.conclusion)} ${score}</h2>` +
          `<p>${esc(view.confidence)} confidence · canonical scoring ${esc(view.scoringVersion)}</p>` +
        '</div>' +
        '<a class="recommendation-evidence-link" href="#trailEvidence">Sources &amp; review status ↓</a>' +
      '</div>' +
      '<div class="recommendation-columns">' +
        '<section><h3>Why it may fit</h3>' +
          list(view.reasons, 'No positive reason is established yet.') + '</section>' +
        '<section><h3>Cautions</h3>' +
          list(view.cautions, 'No specific caution is identified; review unknowns before deciding.') + '</section>' +
      '</div>' +
      '<details class="recommendation-unknowns" open>' +
        `<summary>${esc(unknownSummary)}</summary>` +
        list(view.unknowns, 'No unknown item is currently reported.') +
        (view.additionalUnknowns
          ? `<p class="recommendation-more">Plus ${view.additionalUnknowns} more evidence gap${
            view.additionalUnknowns === 1 ? '' : 's'
          } in the full scoring record.</p>`
          : '') +
      '</details>' +
      '<div class="recommendation-actions" aria-label="Trail actions">' +
        '<button type="button" data-recommendation-save>Save trail</button>' +
        '<button type="button" data-recommendation-compare>Add to comparison</button>' +
        '<button type="button" data-recommendation-download disabled>Offline map unavailable</button>' +
      '</div>';
    root.hidden = false;

    const hero = document.getElementById('heroVerdict');
    if(hero) hero.textContent = view.heroSummary;
    wireActions(root, trail);
  }

  function wireActions(root, trail){
    const evidenceLink = root.querySelector('.recommendation-evidence-link');
    const evidence = document.getElementById('trailEvidence');
    if(evidenceLink && evidence){
      evidenceLink.addEventListener('click', () => { evidence.open = true; });
    }

    const save = root.querySelector('[data-recommendation-save]');
    const originalSave = document.getElementById('detailSaveBtn');
    const syncSave = () => {
      save.textContent = originalSave && originalSave.classList.contains('saved')
        ? 'Saved' : 'Save trail';
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
      compare.textContent = alreadySelected ? 'Open comparison' : 'Add to comparison';
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
      download.textContent = 'Download offline map';
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
