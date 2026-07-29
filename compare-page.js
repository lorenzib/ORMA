(function(){
  'use strict';

  const stateApi = window.DoloPawsComparisonState;
  const model = window.DoloPawsComparisonModel;
  const params = new URLSearchParams(window.location.search);
  const availableIds = (typeof trails !== 'undefined' ? trails : []).map(trail => trail.id);
  let selectedIds = stateApi.parseIds(params.get('ids'), availableIds);
  if(!selectedIds.length) selectedIds = stateApi.load(localStorage, availableIds);
  selectedIds = stateApi.save(localStorage, selectedIds);
  let activeProfile = guestProfile(params.get('dog'));

  const ROWS = [
    ['match','Dog match'],
    ['reasons','Reasons & cautions'],
    ['distance','Distance'],
    ['elevation','Elevation'],
    ['duration','Expected time'],
    ['terrain','Terrain'],
    ['exposure','Exposure'],
    ['shade','Shade'],
    ['heat','Heat'],
    ['water','Water'],
    ['hazards','Surface hazards'],
    ['restrictions','Dog restrictions'],
    ['verification','Verification'],
  ];

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
    })[char]);
  }

  function guestProfile(dog){
    const profiles = {
      medium:{ name:'Medium dog', fitness:'moderate', conditions:[], weightBand:'15-20' },
      rufus:{ name:'Rufus', fitness:'moderate', conditions:['heat'], weightBand:'30-40' },
      bella:{ name:'Bella', fitness:'low', conditions:[], weightBand:'5-10' },
      milo:{ name:'Milo', fitness:'high', conditions:[], weightBand:'15-20' },
    };
    if(dog === 'custom'){
      try {
        return JSON.parse(localStorage.getItem('dolopaws-pending-dog-profile')) || profiles.medium;
      } catch(e){ return profiles.medium; }
    }
    return profiles[dog] || profiles.medium;
  }

  function safeReturn(value){
    return typeof value === 'string' && /^browse-trails\.html(?:\?[^#]*)?(?:#.*)?$/.test(value)
      ? value : 'browse-trails.html';
  }

  function currentHref(){
    return stateApi.compareHref(selectedIds, {
      dog:params.get('dog') || 'medium',
      from:safeReturn(params.get('from')),
    });
  }

  function syncUrl(){
    window.history.replaceState(null, '', currentHref());
  }

  function cellHtml(cell){
    return `<div class="compare-cell compare-cell--${esc(cell.kind)}">` +
      `<span>${esc(cell.text)}</span>` +
      (cell.detail ? `<small>${esc(cell.detail)}</small>` : '') +
      '</div>';
  }

  function render(){
    const root = document.getElementById('compareRoot');
    const back = document.getElementById('compareBack');
    const notice = document.getElementById('compareNotice');
    const context = document.getElementById('compareContext');
    const returnTarget = safeReturn(params.get('from'));
    back.href = returnTarget;
    context.textContent = activeProfile && activeProfile.name
      ? `Compared for ${activeProfile.name}`
      : 'Unpersonalized comparison';

    const selected = selectedIds
      .map(id => trails.find(trail => trail.id === id))
      .filter(Boolean);
    if(!selected.length){
      notice.hidden = true;
      root.innerHTML = '<div class="compare-empty"><h2>No trails selected</h2>' +
        '<p>Choose two or three trails from Browse to compare them here.</p>' +
        `<a href="${esc(returnTarget)}">Choose trails</a></div>`;
      return;
    }

    notice.hidden = selected.length >= 2;
    if(selected.length < 2){
      notice.innerHTML = `Add one more trail for a useful comparison. <a href="${esc(returnTarget)}">Return to Browse</a>.`;
    }

    const subject = typeof effectiveOverrides === 'function'
      ? effectiveOverrides(activeProfile || guestProfile('medium'), null)
      : activeProfile || {};
    const entries = selected.map(trail => model.build(trail, {
      subject,
      recommendation:recommendTrail(trail, subject),
      normalizeTrail:window.DoloPawsRecommendationAdaptersV1.normalizeTrail,
    }));
    const compareReturn = currentHref();
    let html = `<div class="compare-scroll" role="region" aria-label="Trail comparison table" tabindex="0">` +
      `<div class="compare-table" style="--compare-count:${entries.length}">` +
      '<div class="compare-label" aria-hidden="true">Trail</div>';
    html += entries.map(entry =>
      `<div class="compare-cell compare-head"><div class="compare-area">${esc(entry.area)}</div>` +
      `<h2>${esc(entry.name)}</h2><div class="compare-actions">` +
      `<a class="compare-open" href="trail.html?id=${encodeURIComponent(entry.id)}&from=${encodeURIComponent(compareReturn)}">Open trail →</a>` +
      `<button type="button" class="compare-remove" data-remove-id="${esc(entry.id)}">Remove</button>` +
      '</div></div>'
    ).join('');
    ROWS.forEach(([key, label]) => {
      html += `<div class="compare-label">${esc(label)}</div>`;
      html += entries.map(entry => cellHtml(entry.cells[key])).join('');
    });
    root.innerHTML = html + '</div></div>';
    root.querySelectorAll('[data-remove-id]').forEach(button => {
      button.addEventListener('click', () => {
        selectedIds = stateApi.toggle(selectedIds, button.dataset.removeId);
        stateApi.save(localStorage, selectedIds);
        syncUrl();
        render();
      });
    });
  }

  async function useAccountProfile(){
    if(!window.DoloPawsAuth || !window.DoloPawsAuth.currentUser) return;
    try {
      const profile = await window.DoloPawsAuth.getDogProfile();
      if(profile){
        activeProfile = profile;
        render();
      }
    } catch(e){}
  }

  syncUrl();
  render();
  if(window.DoloPawsAuthReady) useAccountProfile();
  else window.addEventListener('dolopaws-auth-ready', useAccountProfile, { once:true });
})();
