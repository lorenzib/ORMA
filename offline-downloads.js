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

  function translate(translateFn, key, fallback, vars){
    if(typeof translateFn === 'function'){
      const translated = translateFn(key, vars);
      if(translated && translated !== key) return translated;
    }
    let output = fallback;
    for(const name of Object.keys(vars || {})){
      output = output.split(`{${name}}`).join(vars[name]);
    }
    return output;
  }

  function packageCard(record, signedIn, translateFn){
    const offline = window.DoloPawsOffline;
    const tr = (key, fallback, vars) => translate(translateFn, key, fallback, vars);
    const states = {
      ready: ['ready', tr('downloads.state.ready', 'Ready offline')],
      stale: ['stale', tr('downloads.state.stale', 'Content review stale')],
      incomplete: ['incomplete', record.usable
        ? tr('downloads.state.interruptedUpdate', 'Interrupted update')
        : tr('downloads.state.interruptedDownload', 'Interrupted download')],
      'update-available': ['update', tr('downloads.state.updateAvailable', 'Update available')],
      failed: ['failed', tr('downloads.state.failed', 'Verification failed')],
    };
    const state = states[record.state] || states.failed;
    const updateLabel = record.state === 'failed'
      ? tr('downloads.action.repair', 'Repair download')
      : record.state === 'incomplete'
        ? (record.usable
          ? tr('downloads.action.restartUpdate', 'Restart update')
          : tr('downloads.action.restartDownload', 'Restart download'))
        : tr('downloads.action.update', 'Update');
    const updateButton = ['update-available', 'incomplete', 'failed'].includes(record.state)
      ? `<button type="button" class="od-btn od-btn--primary" data-action="update">${
        signedIn
          ? updateLabel
          : record.state === 'failed'
            ? tr('downloads.action.loginRepair', 'Log in to repair')
            : record.state === 'incomplete'
              ? tr('downloads.action.loginRestart', 'Log in to restart')
              : tr('downloads.action.loginUpdate', 'Log in to update')
      }</button>`
      : '';
    const openButton = record.usable
      ? `<a class="od-btn od-btn--primary" href="${escapeHtml(record.offlineUrl)}">${escapeHtml(tr('downloads.action.openMap', 'Open map'))}</a>`
      : '';
    const selfTestButton = record.usable
      ? `<button type="button" class="od-btn" data-action="self-test">${escapeHtml(tr('downloads.action.test', 'Test offline'))}</button>`
      : '';
    const removeButton = record.hasLocalData
      ? `<button type="button" class="od-btn od-btn--danger" data-action="request-remove">${escapeHtml(tr('downloads.action.remove', 'Remove'))}</button>`
      : '';
    const verificationLabel = record.verificationStatus === 'field-review-required'
      ? tr('downloads.review.pending', 'Beta field review pending')
      : ['verified', 'vetted', 'dolopaws-vetted', 'field-checked']
        .includes(record.verificationStatus)
        ? tr('downloads.review.vetted', 'Vetted by ORMA')
        : tr('downloads.review.unavailable', 'Review status unavailable');
    const betaVersion = String(record.version || '').match(/beta\.(\d+)$/i);
    const versionLabel = typeof translateFn === 'function'
      ? betaVersion
        ? tr('downloads.version.beta', 'Beta package {version}', { version:betaVersion[1] })
        : record.version
          ? tr('downloads.version.package', 'Package {version}', { version:record.version })
          : tr('downloads.version.unavailable', 'Package revision unavailable')
      : offline.formatPackageVersion(record.version);
    const ownershipLabel = typeof translateFn === 'function'
      ? tr(`downloads.owner.${record.ownership}`, 'Download owner not recorded')
      : offline.ownershipLabel(record.ownership);
    const sizeLabel = Number.isFinite(record.packageBytes)
      ? offline.formatBytes(record.packageBytes)
      : tr('downloads.sizeUnavailable', 'Size unavailable');
    return `
      <article class="od-card" data-trail-id="${escapeHtml(record.trailId)}">
        <div>
          <div class="od-kicker">${escapeHtml(tr('downloads.card.kicker', 'Offline trail map'))}</div>
          <h2 class="serif">${escapeHtml(record.name || record.trailId)}</h2>
          <div class="od-meta">
            <span>${escapeHtml(sizeLabel)}</span>
            <span>${escapeHtml(tr('downloads.downloaded', 'Downloaded {date}', { date:offline.formatInstalledDate(record.installedAt) }))}</span>
            <span>${escapeHtml(versionLabel)}</span>
            <span>${escapeHtml(verificationLabel)}</span>
          </div>
          <p class="od-owner">${escapeHtml(ownershipLabel)}</p>
          <span class="od-state" data-state="${state[0]}">${state[1]}</span>
          ${record.stateMessage ? `<p class="od-owner">${escapeHtml(record.stateMessage)}</p>` : ''}
        </div>
        <div class="od-actions">
          ${openButton}
          <a class="od-btn" href="${escapeHtml(record.trailUrl)}">${escapeHtml(tr('downloads.action.details', 'Trail details'))}</a>
          ${selfTestButton}
          ${updateButton}
          ${removeButton}
        </div>
        <p class="od-card-status" role="status" aria-live="polite" hidden></p>
        <div class="od-remove-confirm" hidden>
          <span>${escapeHtml(tr('downloads.remove.confirm', 'Remove this offline map from this device?'))}</span>
          <button type="button" class="od-btn" data-action="cancel-remove">${escapeHtml(tr('downloads.remove.keep', 'Keep map'))}</button>
          <button type="button" class="od-btn od-btn--danger" data-action="confirm-remove">${escapeHtml(tr('downloads.remove.remove', 'Remove map'))}</button>
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
    const tr = (key, fallback, vars) => translate(window.t, key, fallback, vars);

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
      list.innerHTML = records.map(record => packageCard(record, signedIn, window.t)).join('');
      empty.hidden = records.length > 0;
      summary.hidden = records.length === 0;
      if(records.length){
        const bytes = records.reduce((total, record) =>
          total + (Number.isFinite(record.packageBytes) ? record.packageBytes : 0), 0);
        summary.textContent = tr(
          records.length === 1 ? 'downloads.summary.one' : 'downloads.summary.many',
          records.length === 1
            ? '{count} trail · {size} stored'
            : '{count} trails · {size} stored',
          { count:records.length, size:window.DoloPawsOffline.formatBytes(bytes) }
        );
      }
    }

    async function refresh(){
      loading.hidden = false;
      error.hidden = true;
      empty.hidden = true;
      try{
        records = await window.DoloPawsOffline.listPackageStates(currentUser());
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
      cardStatus(card, tr('downloads.update.preparing', 'Preparing a verified update…'));
      try{
        const manifest = await window.DoloPawsOffline.installPackage(
          trailId,
          (current, total, resource) => {
            cardStatus(
              card,
              tr('downloads.update.progress', 'Downloading {current} of {total}: {resource}', {
                current, total, resource:resource.label || resource.url,
              })
            );
          },
          currentUser()
        );
        cardStatus(
          card,
          tr('downloads.update.verified', 'Update verified: {count} required resources.', { count:manifest.resources.length }),
          'ready'
        );
        await refresh();
      }catch(updateError){
        button.disabled = false;
        cardStatus(
          card,
          `${updateError.message || tr('downloads.update.failed', 'The update could not be downloaded.')} ` +
          tr('downloads.update.preserved', 'Your existing package remains ready offline.'),
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
      }else if(action.dataset.action === 'self-test'){
        action.disabled = true;
        cardStatus(card, tr('downloads.test.preparing', 'Testing required resources from this device…'));
        const result = await window.DoloPawsOffline.verifyInstalledPackage(
          trailId,
          (current, total, resource) => {
            cardStatus(
              card,
              tr('downloads.test.progress', 'Testing {current} of {total}: {resource}', {
                current, total, resource:resource.label || resource.url,
              })
            );
          }
        );
        action.disabled = false;
        if(result.usable){
          if(window.DoloPawsMetricFunnel){
            window.DoloPawsMetricFunnel.recordOnce(
              'airplane-test', trailId, 'offline_package', 'airplane_test_passed', { trailId }
            );
          }
          cardStatus(
            card,
            tr('downloads.test.passed', 'Offline self-test passed: {count} required resources were checksum-verified locally.', { count:result.requiredChecked }) + ` ${
              result.state === 'stale'
                ? tr('downloads.test.stale', 'The map works, but its content review is stale.')
                : tr('downloads.test.airplane', 'You can switch to airplane mode and open the map.')
            }`,
            result.state
          );
        }else{
          cardStatus(
            card,
            `${result.message || tr('downloads.test.failed', 'The self-test failed.')} ${tr('downloads.test.notReady', 'This package is not ready offline.')}`,
            'error'
          );
          await refresh();
        }
      }else if(action.dataset.action === 'request-remove'){
        actions.hidden = true;
        confirmation.hidden = false;
      }else if(action.dataset.action === 'cancel-remove'){
        confirmation.hidden = true;
        actions.hidden = false;
      }else if(action.dataset.action === 'confirm-remove'){
        action.disabled = true;
        action.textContent = tr('downloads.remove.removing', 'Removing…');
        try{
          await window.DoloPawsOffline.removePackage(trailId);
          await refresh();
        }catch(removeError){
          action.disabled = false;
          action.textContent = tr('downloads.remove.remove', 'Remove map');
          confirmation.hidden = true;
          actions.hidden = false;
          cardStatus(card, tr('downloads.remove.failed', 'This offline map could not be removed. Try again.'), 'error');
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
