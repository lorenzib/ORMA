// The iPhone app's bottom tab bar: Explore, Saved, Record and You.
// scripts/build-app.js adds this script to every app page; the website never
// loads it. A native app is moved around by its tabs, so the four places
// someone returns to sit under their thumb on every screen instead of behind
// the header's menu. The drawings are the website's own icons (icon-system.js).
(function(){
  if(window.__ormaAppTabbar) return;
  window.__ormaAppTabbar = true;

  // Recording is a full-screen task with its own controls along the bottom,
  // so the tab bar steps aside there.
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if(file === 'walk.html') return;

  const stroke = (paths) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" '
    + 'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  const paw = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">'
    + '<ellipse cx="12" cy="15" rx="3.7" ry="3.1"/><ellipse cx="7.4" cy="10.6" rx="1.4" ry="1.9"/>'
    + '<ellipse cx="10.7" cy="8.7" rx="1.4" ry="1.9"/><ellipse cx="13.9" cy="8.7" rx="1.4" ry="1.9"/>'
    + '<ellipse cx="17" cy="10.6" rx="1.4" ry="1.9"/></svg>';

  const label = (key, fallback) => {
    const text = typeof window.t === 'function' ? window.t(key) : '';
    return text && text !== key ? text : fallback;
  };

  const SAVED = ['saved.html', 'my-trails.html'];
  const YOU = ['account.html', 'settings.html', 'notifications.html', 'journal.html', 'onboarding.html'];
  const active = SAVED.includes(file) ? 'saved' : YOU.includes(file) ? 'you' : 'explore';

  const tabs = [
    { key:'explore', href:'/index.html', text:label('appTabs.explore', 'Explore'),
      icon:stroke('<path d="m5 6 4-2 6 2 4-2v14l-4 2-6-2-4 2z"/><path d="M9 4v14"/><path d="M15 6v14"/>') },
    { key:'saved', href:'/saved.html', text:label('appTabs.saved', 'Saved'),
      icon:stroke('<path d="M12 19.6 4.9 12.5a4.2 4.2 0 0 1 6-6l1.1 1.1 1.1-1.1a4.2 4.2 0 0 1 6 6z"/>') },
    { key:'record', href:'/walk.html', text:label('appTabs.record', 'Record'), icon:'<span class="app-tab-record" aria-hidden="true"></span>' },
    { key:'you', href:'/account.html', text:label('appTabs.you', 'You'), icon:paw },
  ];

  function mount(){
    if(document.querySelector('.app-tabbar')) return;
    const nav = document.createElement('nav');
    nav.className = 'app-tabbar';
    nav.setAttribute('aria-label', label('appTabs.label', 'Main'));
    tabs.forEach((tab) => {
      const link = document.createElement('a');
      link.className = 'app-tab app-tab--' + tab.key;
      link.href = tab.href;
      if(tab.key === active) link.setAttribute('aria-current', 'page');
      link.innerHTML = '<span class="app-tab-icon">' + tab.icon + '</span>';
      const text = document.createElement('span');
      text.className = 'app-tab-text';
      text.textContent = tab.text;
      link.appendChild(text);
      nav.appendChild(link);
    });
    document.body.appendChild(nav);
    document.body.classList.add('app-tabs');
  }

  // The trail page's breadcrumb is a round back arrow in the app, so it goes
  // back to where you came from (the map, Saved) rather than to the trail list.
  document.addEventListener('click', (event) => {
    const back = event.target.closest && event.target.closest('#tdBreadcrumb');
    if(!back || history.length < 2) return;
    let fromHere = false;
    try { fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch(_) {}
    if(!fromHere) return;
    event.preventDefault();
    history.back();
  });

  if(document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
