(function(){
  'use strict';

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function packageCard(record, signedIn){
    const offline = window.DoloPawsOffline;
    const state = record.incomplete
      ? ['incomplete', 'Interrupted update']
      : record.updateAvailable
        ? ['update', 'Update available']
        : ['ready', 'Ready offline'];
    const updateLabel = record.incomplete ? 'Restart update' : 'Update';
    const updateButton = (record.updateAvailable || record.incomplete)
      ? `<button type="button" class="od-btn od-btn--primary" data-action="update">${
        signedIn ? updateLabel : 'Log in to update'
      }</button>`
      : '';
    const verificationLabel = record.verificationStatus === 'field-review-required'
      ? 'Beta field review pending'
      : `Verification ${record.verificationStatus || 'not recorded'}`;
    return `
      <article class="od-card" data-trail-id="${escapeHtml(record.trailId)}">
        <div>
          <div class="od-kicker">Offline trail map</div>
          <h2 class="serif">${escapeHtml(record.name || record.trailId)}</h2>
          <div class="od-meta">
            <span>${escapeHtml(offline.formatBytes(record.packageBytes))}</span>
            <span>Downloaded ${escapeHtml(offline.formatInstalledDate(record.installedAt))}</span>
            <span>Version ${escapeHtml(record.version)}</span>
            <span>${escapeHtml(verificationLabel)}</span>
          </div>
          <p class="od-owner">${escapeHtml(offline.ownershipLabel(record.ownership))}</p>
          <span class="od-state" data-state="${state[0]}">${state[1]}</span>
        </div>
        <div class="od-actions">
          <a class="od-btn od-btn--primary" href="${escapeHtml(record.offlineUrl)}">Open map</a>
          <a class="od-btn" href="${escapeHtml(record.trailUrl)}">Trail details</a>
          ${updateButton}
          <button type="button" class="od-btn od-btn--danger" data-action="request-remove">Remove</button>
        </div>
        <p class="od-card-status" role="status" aria-live="polite" hidden></p>
        <div class="od-remove-confirm" hidden>
          <span>Remove this offline map from this device?</span>
          <button type="button" class="od-btn" data-action="cancel-remove">Keep map</button>
          <button type="button" class="od-btn od-btn--danger" data-action="confirm-remove">Remove map</button>
        </div>
      </article>`;
  }

  function init(){
    const list = document.getElementById('downloadsList');
    const loading = document.getElementById('downloadsLoading');
    const empty = document.getElementById('downloadsEmpty');
    const error = document.getElementById('downloadsError');
    const summary = document.getElementById('downloadsSummary');
    const signedOut = document.getElementById('downloadsSignedOut');
    const loginButton = document.getElementById('downloadsLoginBtn');
    const retryButton = document.getElementById('downloadsRetryBtn');
    if(!list || !loading || !empty || !error || !summary || !signedOut) return;

    let records = [];

    function currentUser(){
      return window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    }

    function requestLogin(){
      const accountButton = document.getElementById('accountBtn');
      if(accountButton) accountButton.click();
    }

    function cardStatus(card, message, state){
      const status = card && card.querySelector('.od-card-status');
      if(!status) return;
      status.textContent = message;
      status.dataset.state = state || '';
      status.hidden = false;
    }

    function paint(){
      const signedIn = !!currentUser();
      signedOut.hidden = signedIn;
      list.innerHTML = records.map(record => packageCard(record, signedIn)).join('');
      empty.hidden = records.length > 0;
      summary.hidden = records.length === 0;
      if(records.length){
        const bytes = records.reduce((total, record) =>
          total + (Number.isFinite(record.packageBytes) ? record.packageBytes : 0), 0);
        summary.textContent = `${records.length} ${
          records.length === 1 ? 'trail' : 'trails'
        } · ${window.DoloPawsOffline.formatBytes(bytes)} stored`;
      }
    }

    async function refresh(){
      loading.hidden = false;
      error.hidden = true;
      empty.hidden = true;
      try{
        records = await window.DoloPawsOffline.listInstalledPackages(currentUser());
        paint();
      }catch(refreshError){
        records = [];
        list.innerHTML = '';
        summary.hidden = true;
        signedOut.hidden = !!currentUser();
        error.hidden = false;
      }finally{
        loading.hidden = true;
      }
    }

    async function update(card, trailId, button){
      if(!currentUser()){
        requestLogin();
        return;
      }
      button.disabled = true;
      cardStatus(card, 'Preparing a verified update…');
      try{
        const manifest = await window.DoloPawsOffline.installPackage(
          trailId,
          (current, total, resource) => {
            cardStatus(
              card,
              `Downloading ${current} of ${total}: ${resource.label || resource.url}`
            );
          },
          currentUser()
        );
        cardStatus(
          card,
          `Update verified: ${manifest.resources.length} required resources.`,
          'ready'
        );
        await refresh();
      }catch(updateError){
        button.disabled = false;
        cardStatus(
          card,
          `${updateError.message || 'The update could not be downloaded.'} ` +
          'Your existing package remains ready offline.',
          'error'
        );
      }
    }

    list.addEventListener('click', async event => {
      const action = event.target.closest('[data-action]');
      if(!action) return;
      const card = action.closest('[data-trail-id]');
      if(!card) return;
      const trailId = card.dataset.trailId;
      const actions = card.querySelector('.od-actions');
      const confirmation = card.querySelector('.od-remove-confirm');

      if(action.dataset.action === 'update'){
        await update(card, trailId, action);
      }else if(action.dataset.action === 'request-remove'){
        actions.hidden = true;
        confirmation.hidden = false;
      }else if(action.dataset.action === 'cancel-remove'){
        confirmation.hidden = true;
        actions.hidden = false;
      }else if(action.dataset.action === 'confirm-remove'){
        action.disabled = true;
        action.textContent = 'Removing…';
        try{
          await window.DoloPawsOffline.removePackage(trailId);
          await refresh();
        }catch(removeError){
          action.disabled = false;
          action.textContent = 'Remove map';
          confirmation.hidden = true;
          actions.hidden = false;
          cardStatus(card, 'This offline map could not be removed. Try again.', 'error');
        }
      }
    });

    if(loginButton) loginButton.addEventListener('click', requestLogin);
    if(retryButton) retryButton.addEventListener('click', refresh);

    function authChanged(){
      refresh();
    }
    if(window.DoloPawsAuth) window.DoloPawsAuth.onChange(authChanged);
    else window.addEventListener(
      'dolopaws-auth-ready',
      () => window.DoloPawsAuth.onChange(authChanged),
      { once: true }
    );
    refresh();
  }

  window.DoloPawsOfflineDownloads = {
    escapeHtml,
    packageCard,
    init,
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
