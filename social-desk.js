(function(){
  'use strict';
  const KIT_URL = 'backoffice-data/social-launch-kit.json';

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function statusLabel(status){
    return String(status || '').replaceAll('-', ' ');
  }

  function renderProfiles(profiles){
    return profiles.map(profile => `<article class="bo-stream-card">
      <span class="bo-stream-type">${escapeHtml(profile.priority)}</span>
      <h3>${escapeHtml(profile.channel)}</h3>
      <p><strong>@${escapeHtml(profile.preferredHandle)}</strong> · ${escapeHtml(profile.displayName)}</p>
      <p>${escapeHtml(profile.bio)}</p>
      <small>${escapeHtml(statusLabel(profile.status))}</small>
    </article>`).join('');
  }

  function renderChecklist(items){
    return items.map(item => `<li><span class="bo-life-status">${escapeHtml(item.status)}</span> <strong>${escapeHtml(item.label)}</strong><small>Owner: ${escapeHtml(item.owner)}</small></li>`).join('');
  }

  function renderCalendar(items){
    return items.map(item => `<article class="bo-stream-card${item.status.startsWith('blocked') ? ' is-inactive' : ''}">
      <span class="bo-stream-type">Week ${escapeHtml(item.week)} · ${escapeHtml(item.slot)} · ${escapeHtml(item.format)}</span>
      <h3>${escapeHtml(item.topic)}</h3>
      <p>${escapeHtml(item.lane)} · Source: ${escapeHtml(item.source)}</p>
      <strong>${escapeHtml(statusLabel(item.status))}</strong>
    </article>`).join('');
  }

  async function init(){
    const response = await fetch(KIT_URL, { cache: 'no-store' });
    if(!response.ok) throw new Error(`Could not load social launch kit (${response.status})`);
    const kit = await response.json();
    document.querySelector('[data-social-status]').textContent = `Status: ${statusLabel(kit.approval.launchStatus)}. Public posting remains disabled.`;
    document.querySelector('[data-social-profiles]').innerHTML = renderProfiles(kit.profiles);
    document.querySelector('[data-social-checklist]').innerHTML = renderChecklist(kit.launchChecklist);
    document.querySelector('[data-social-calendar]').innerHTML = renderCalendar(kit.pilotCalendar);
  }

  init().catch(error => {
    document.querySelector('[data-social-status]').textContent = error.message;
  });
})();
