(function(){
  'use strict';

  const state = document.getElementById('moderationState');
  const queue = document.getElementById('moderationQueue');
  let loading = false;
  let reloadRequested = false;

  function element(tag, className, text){
    const node = document.createElement(tag);
    if(className) node.className = className;
    if(text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function dateLabel(value){
    if(value && typeof value.toDate === 'function'){
      return value.toDate().toLocaleString();
    }
    return 'Timestamp unavailable';
  }

  function detailsFor(item){
    const content = item.content || {};
    const wrap = element('div', 'moderation-content');
    if(content.type) wrap.appendChild(element('p', '', `Hazard: ${content.type}`));
    if(content.km !== null && content.km !== undefined){
      wrap.appendChild(element('p', '', `Position: km ${content.km}`));
    }
    if(content.rating) wrap.appendChild(element('p', '', `Rating: ${content.rating}/5`));
    if(content.hikedOn) wrap.appendChild(element('p', '', `Hiked on: ${content.hikedOn}`));
    if(content.text) wrap.appendChild(element('p', '', content.text));
    if(content.image){
      const image = element('img', 'moderation-photo');
      image.src = content.image;
      image.alt = content.caption || 'Submitted trail photo';
      wrap.appendChild(image);
    }
    if(content.caption) wrap.appendChild(element('p', '', content.caption));
    if(item.type === 'flag'){
      wrap.appendChild(element(
        'p',
        '',
        `Hazard evidence: ${content.confirmationSource || 'community'} · ` +
        `${content.confirmations || 0} confirmed · ${content.disputes || 0} disputed`
      ));
      wrap.appendChild(element('p', '', `Expires: ${dateLabel(content.expiresAt)}`));
    }
    return wrap;
  }

  function action(status, label, confirmationSource){
    const button = element('button', '', label);
    button.type = 'button';
    button.dataset.status = status;
    if(confirmationSource) button.dataset.confirmationSource = confirmationSource;
    return button;
  }

  function actionsFor(item){
    if(item.type === 'flag' && item.status === 'pending') return [
      action('visible', 'Publish unconfirmed', 'community'),
      action('visible', 'Publish · DoloPaws reviewed', 'dolopaws-reviewed'),
      action('visible', 'Publish · official source', 'official'),
      action('hidden', 'Hide'),
      action('removed', 'Remove'),
    ];
    if(item.type === 'flag' && ['visible', 'reported'].includes(item.status)) return [
      action('visible', 'Keep active · unconfirmed', 'community'),
      action('visible', 'Keep active · DoloPaws reviewed', 'dolopaws-reviewed'),
      action('visible', 'Keep active · official source', 'official'),
      action('hidden', 'Hide'),
      action('removed', 'Remove'),
    ];
    if(item.status === 'pending') return [
      action('visible', 'Publish'), action('hidden', 'Hide'), action('removed', 'Remove'),
    ];
    if(item.status === 'reported') return [
      action('visible', 'Keep visible'), action('hidden', 'Hide'), action('removed', 'Remove'),
    ];
    if(item.status === 'visible') return [
      action('visible', 'Dismiss report'), action('hidden', 'Hide'), action('removed', 'Remove'),
    ];
    if(item.status === 'hidden') return [
      action('visible', 'Restore'), action('removed', 'Remove'),
    ];
    if(item.status === 'removed') return [action('visible', 'Restore')];
    return [];
  }

  function renderCard(item){
    const card = element('article', 'moderation-card');
    const meta = element('div', 'moderation-meta');
    meta.append(
      element('span', 'moderation-chip', item.type),
      element('span', 'moderation-chip', item.status),
      element('span', '', `Trail: ${item.trailId}`),
      element('span', '', `Author: ${item.authorUid}`),
      element('span', '', dateLabel(item.createdAt))
    );
    card.append(meta, detailsFor(item));
    if(item.reportReasons && item.reportReasons.length){
      const reports = element('div', 'moderation-reports');
      reports.appendChild(element('strong', '', 'Open report reasons'));
      const list = element('ul');
      item.reportReasons.forEach(reason => {
        const row = element(
          'li',
          '',
          `${reason.text} · reported ${dateLabel(reason.createdAt)}`
        );
        list.appendChild(row);
      });
      reports.appendChild(list);
      card.appendChild(reports);
    }
    const reasonLabel = element('label', 'moderation-reason');
    reasonLabel.appendChild(element('span', '', 'Internal decision note (optional)'));
    const reason = element('textarea');
    reason.maxLength = 300;
    reasonLabel.appendChild(reason);
    card.appendChild(reasonLabel);
    const actions = element('div', 'moderation-actions');
    actionsFor(item).forEach(button => {
      button.addEventListener('click', async () => {
        if(button.dataset.status === 'removed' &&
           !window.confirm('Remove this contribution from the community surface?')) return;
        actions.querySelectorAll('button').forEach(control => { control.disabled = true; });
        state.classList.remove('is-error');
        state.textContent = 'Saving moderation decision…';
        const result = await window.DoloPawsModeration.decide(
          item,
          button.dataset.status,
          reason.value.trim(),
          { confirmationSource: button.dataset.confirmationSource || null }
        );
        if(!result.ok){
          state.classList.add('is-error');
          state.textContent = 'The decision was not saved. Check access and try again.';
          actions.querySelectorAll('button').forEach(control => { control.disabled = false; });
          return;
        }
        await loadQueue();
      });
      actions.appendChild(button);
    });
    card.appendChild(actions);
    return card;
  }

  async function loadQueue(){
    if(loading){
      reloadRequested = true;
      return;
    }
    if(!window.DoloPawsModeration) return;
    loading = true;
    state.classList.remove('is-error');
    state.textContent = 'Loading private moderation queue…';
    const result = await window.DoloPawsModeration.getQueue();
    queue.replaceChildren();
    if(!result.ok){
      state.classList.add('is-error');
      state.textContent = result.error === 'moderator-required'
        ? 'Access denied. Sign in with an authorized moderator account.'
        : 'The moderation queue is currently unavailable.';
      loading = false;
      if(reloadRequested){
        reloadRequested = false;
        loadQueue();
      }
      return;
    }
    result.items.forEach(item => queue.appendChild(renderCard(item)));
    state.textContent = result.items.length
      ? `${result.items.length} contribution${result.items.length === 1 ? '' : 's'} in the queue.`
      : 'The moderation queue is clear.';
    showNoticeComposer();
    loading = false;
    if(reloadRequested){
      reloadRequested = false;
      loadQueue();
    }
  }

  // ---- Site notices: broadcast items for every visitor's notification
  // centre. The composer appears only once the queue has proven moderator
  // access (rules enforce the claim regardless).
  let composerWired = false;
  function showNoticeComposer(){
    const composer = document.getElementById('noticeComposer');
    if(!composer) return;
    composer.hidden = false;
    if(composerWired) { renderNoticeList(); return; }
    composerWired = true;
    const form = document.getElementById('noticeForm');
    const status = document.getElementById('noticeStatus');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submit = document.getElementById('noticeSubmit');
      submit.disabled = true;
      status.textContent = 'Posting…';
      const result = await window.DoloPawsAuth.addSiteNotice({
        title: document.getElementById('noticeTitle').value.trim(),
        body: document.getElementById('noticeBody').value.trim(),
        href: document.getElementById('noticeHref').value.trim() || null,
        type: document.getElementById('noticeType').value,
        expiresDays: parseFloat(document.getElementById('noticeExpiry').value) || undefined,
      });
      submit.disabled = false;
      status.textContent = result.ok ? 'Notice posted.' : (result.message || 'Posting failed.');
      if(result.ok){ form.reset(); renderNoticeList(); }
    });
    renderNoticeList();
  }

  async function renderNoticeList(){
    const list = document.getElementById('noticeList');
    if(!list || typeof window.DoloPawsAuth.getSiteNotices !== 'function') return;
    const notices = await window.DoloPawsAuth.getSiteNotices();
    list.replaceChildren();
    notices.forEach(notice => {
      const row = element('div', 'moderation-content');
      row.appendChild(element('p', '', `${notice.title} — ${notice.body}`));
      const meta = element('p', '', `${notice.type} · ${dateLabel(notice.createdAt)}`);
      meta.style.color = '#8A9689';
      row.appendChild(meta);
      const del = element('button', '', 'Delete notice');
      del.type = 'button';
      del.addEventListener('click', async () => {
        del.disabled = true;
        const ok = await window.DoloPawsAuth.deleteSiteNotice(notice.id);
        if(ok) renderNoticeList();
        else del.disabled = false;
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function boot(){
    if(!(window.DoloPawsAuth && window.DoloPawsModeration)) return;
    window.DoloPawsAuth.onChange(loadQueue);
  }

  if(window.DoloPawsAuthReady) boot();
  else window.addEventListener('dolopaws-auth-ready', boot, { once:true });
})();
