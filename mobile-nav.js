(function(){
  function secureBlankLinks(root){
    const links = [];
    if(root && root.matches && root.matches('a[target="_blank"]')) links.push(root);
    if(root && root.querySelectorAll) links.push(...root.querySelectorAll('a[target="_blank"]'));
    links.forEach(link => {
      const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      link.setAttribute('rel', Array.from(rel).join(' '));
    });
  }

  secureBlankLinks(document);
  if(document.body && typeof MutationObserver !== 'undefined'){
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(secureBlankLinks)))
      .observe(document.body, { childList:true, subtree:true });
  }

  // ================= AUTH-AWARE HEADER =================
  // Every page ships the logged-out header statically (dark bar with a
  // "Log in" pill). When the cached auth summary written by firebase-init.js
  // says someone is signed in, the link row is rebuilt into the member
  // header — same dark bar, same links (Browse all Trails · Collections ·
  // Safety guide · Settings), with the bell and the dog pill in place of
  // the login pill (2026-07 design revamp). The static trail/guide pages
  // carry no Firebase by design, so the localStorage summary is the only
  // signal there; pages with live auth re-render on `dolopaws-auth-changed`.
  const navEl = document.querySelector('.topnav');
  const linksEl = navEl && navEl.querySelector('.links');

  // What's-new feed behind the bell. Ids are stable; a visitor's seen ids
  // live in localStorage so the badge only counts genuinely new entries.
  const NAV_UPDATES = [
    { id: 'collections-2026-07', title: 'Trail collections are here',
      body: 'Shady loops, lakeside walks and gentle strolls — grouped and ready.',
      href: 'browse-trails.html#collections' },
    { id: 'savoy-2026-07', title: 'Savoy valleys are live',
      body: 'Maurienne walks join the Dolomites, every route scored for paws.',
      href: 'browse-trails.html?region=savoy' },
  ];
  const SEEN_KEY = 'dolopaws-nav-seen-updates';

  function seenUpdates(){
    try {
      const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch(e){ return []; }
  }

  function authSummary(){
    try {
      const raw = localStorage.getItem('dolopaws-profile-summary');
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch(e){ return null; }
  }

  function dogPhoto(){
    try {
      const v = localStorage.getItem('dolopaws-dog-photo');
      return (typeof v === 'string' && v.startsWith('data:image/')) ? v : null;
    } catch(e){ return null; }
  }

  if(navEl && linksEl){
    const brand = navEl.querySelector('.brand');
    const brandHref = (brand && brand.getAttribute('href')) || 'index.html';
    // Root-absolute brand href (the 404 page — served at any URL depth)
    // makes every rebuilt link root-absolute too.
    const prefix = brandHref.startsWith('/') ? '/' : (brandHref.startsWith('../') ? '../' : '');
    const parts = window.location.pathname.split('/').filter(Boolean);
    const pageFile = (parts[parts.length - 1] || 'index.html').toLowerCase().endsWith('.html')
      ? (parts[parts.length - 1] || 'index.html') : 'index.html';
    // Path relative to the site root, used for post-login return targets.
    const pagePath = prefix ? (parts[parts.length - 2] + '/' + pageFile) : pageFile;

    // The login control (button on modal pages, anchor on static pages) is
    // reused across renders so the listener auth-ui.js binds survives.
    const loginEl = linksEl.querySelector('#accountBtn, a.account-btn');

    function navItem(label, href, active, i18nKey){
      const a = document.createElement('a');
      a.href = prefix + href;
      a.textContent = label;
      if(active) a.classList.add('active');
      if(i18nKey) a.setAttribute('data-i18n', i18nKey);
      return a;
    }

    function activeKey(){
      const f = pageFile.toLowerCase();
      if(prefix && pagePath.startsWith('trails/')) return 'trails';
      if(prefix && pagePath.startsWith('guides/')) return 'safety';
      if(
        f === 'browse-trails.html' ||
        f === 'compare.html' ||
        f === 'trail.html' ||
        f === 'saved.html' ||
        f === 'downloads.html'
      ) return 'trails';
      if(f === 'journal.html') return 'journal';
      if(f === 'collections.html') return 'collections';
      if(f === 'safety-guide.html') return 'safety';
      if(f === 'settings.html') return 'settings';
      if(f === 'about.html') return 'about';
      return '';
    }

    function bellSvg(){
      return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
    }

    function buildBell(){
      const wrap = document.createElement('div');
      wrap.className = 'nav-bellwrap';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-bell';
      btn.setAttribute('aria-label', 'Notifications');
      btn.innerHTML = bellSvg();
      const seen = seenUpdates();
      const unseen = NAV_UPDATES.filter(u => !seen.includes(u.id)).length;
      if(unseen > 0){
        const badge = document.createElement('span');
        badge.className = 'nav-bell-badge';
        badge.textContent = String(unseen);
        btn.appendChild(badge);
      }
      wrap.appendChild(btn);
      btn.addEventListener('click', () => { window.location.href = prefix + 'notifications.html'; });
      return wrap;
    }

    function dogAvatarEl(name, size){
      const avatar = document.createElement('span');
      avatar.className = 'nav-user-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const photo = dogPhoto();
      if(photo) avatar.style.backgroundImage = 'url(' + photo + ')';
      else avatar.textContent = name ? name.charAt(0).toUpperCase() : '🐾';
      if(size){ avatar.style.width = avatar.style.height = size + 'px'; avatar.style.lineHeight = size + 'px'; }
      return avatar;
    }

    // Dog pill — the shared switcher pattern (map, journal, safety guide,
    // collections and the profile page all use this same control): avatar +
    // name opens a "Switch dog" panel with the dog list and a manage link.
    // The account today holds one dog; the panel lists it (selected) and the
    // add/manage routes, and picks up more dogs if the summary ever carries
    // a `dogs` array.
    function buildAccountPill(name){
      const wrap = document.createElement('div');
      wrap.className = 'nav-userwrap';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-user';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.appendChild(dogAvatarEl(name));
      const label = document.createElement('span');
      label.className = 'nav-user-name';
      label.textContent = name || 'My account';
      btn.appendChild(label);
      const caret = document.createElement('span');
      caret.className = 'nav-user-caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '▾';
      btn.appendChild(caret);

      const menu = document.createElement('div');
      menu.className = 'nav-dogmenu';
      menu.hidden = true;
      const kick = document.createElement('div');
      kick.className = 'nav-dogmenu-kick';
      kick.textContent = 'Switch dog';
      menu.appendChild(kick);

      const summary = authSummary() || {};
      const dogs = Array.isArray(summary.dogs) && summary.dogs.length
        ? summary.dogs
        : [{ name: name || summary.name || 'Your dog', meta: summary.meta || summary.breed || '' }];
      const activeName = name || (dogs[0] && dogs[0].name);
      dogs.forEach(d => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'nav-dogmenu-row' + (d.name === activeName ? ' on' : '');
        row.appendChild(dogAvatarEl(d.name, 32));
        const txt = document.createElement('span');
        txt.style.cssText = 'flex:1;min-width:0;';
        const nm = document.createElement('b');
        nm.textContent = d.name;
        txt.appendChild(nm);
        if(d.meta){
          const meta = document.createElement('small');
          meta.textContent = d.meta;
          txt.appendChild(meta);
        }
        row.appendChild(txt);
        row.addEventListener('click', () => setOpen(false));
        menu.appendChild(row);
      });

      const addLink = document.createElement('a');
      addLink.className = 'nav-dogmenu-manage';
      addLink.href = prefix + 'account.html?next=' + encodeURIComponent(pagePath);
      addLink.textContent = '＋ Add another dog';
      menu.appendChild(addLink);
      const manage = document.createElement('a');
      manage.className = 'nav-dogmenu-manage';
      manage.href = prefix + 'account.html?next=' + encodeURIComponent(pagePath);
      manage.textContent = 'Manage dog profiles →';
      menu.appendChild(manage);

      wrap.appendChild(btn);
      wrap.appendChild(menu);
      function setOpen(open){
        menu.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
      }
      btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
      document.addEventListener('click', (e) => { if(!wrap.contains(e.target)) setOpen(false); });
      document.addEventListener('keydown', (e) => { if(e.key === 'Escape') setOpen(false); });
      return wrap;
    }

    function renderHeader(loggedIn, dogName){
      navEl.classList.toggle('nav-authed', !!loggedIn);
      const key = activeKey();
      // Other scripts append their own widgets into .links (i18n.js adds
      // the language toggle on DOMContentLoaded). Rebuilding must not eat
      // them, so anything that isn't ours is kept and re-appended last.
      const extras = Array.from(linksEl.children).filter(el =>
        el !== loginEl && !el.matches('a, #accountBtn, .nav-bellwrap, .nav-userwrap'));
      linksEl.innerHTML = '';
      // Both states share the same link row now; only the right-hand
      // controls change (login pill vs bell + dog pill).
      linksEl.appendChild(navItem('Browse all Trails', 'browse-trails.html', key === 'trails'));
      linksEl.appendChild(navItem('Collections', 'collections.html', key === 'collections'));
      linksEl.appendChild(navItem('Safety guide', 'safety-guide.html', key === 'safety'));
      linksEl.appendChild(navItem('Settings', 'settings.html', key === 'settings', 'nav.settings'));
      if(loggedIn){
        linksEl.appendChild(buildBell());
        linksEl.appendChild(buildAccountPill(dogName));
      } else {
        if(loginEl){
          linksEl.appendChild(loginEl);
        } else if(pageFile.toLowerCase() !== 'account.html'){
          const login = document.createElement('a');
          login.className = 'account-btn';
          login.href = prefix + 'index.html?view=login&next=' + encodeURIComponent(pagePath);
          login.textContent = 'Log in';
          login.setAttribute('data-i18n', 'nav.login');
          linksEl.appendChild(login);
        }
      }
      extras.forEach(el => linksEl.appendChild(el));
    }

    const summary = authSummary();
    renderHeader(!!summary, summary && summary.name ? String(summary.name) : '');

    // Pages with live Firebase re-render once real auth state resolves.
    window.addEventListener('dolopaws-auth-changed', (e) => {
      const user = e.detail && e.detail.user;
      const s = authSummary();
      renderHeader(!!user, (s && s.name) ? String(s.name) : '');
    });
    window.addEventListener('dolopaws-dog-profile-saved', (e) => {
      const p = e.detail && e.detail.profile;
      if(p && p.name && window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
        renderHeader(true, String(p.name));
      }
    });
  }

  // ================= MOBILE MENU TOGGLE =================
  const nav = navEl;
  const links = linksEl;
  if(!nav || !links || nav.querySelector('.mobile-nav-toggle')) return;

  if(!links.id) links.id = 'primaryNavigation';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mobile-nav-toggle';
  toggle.setAttribute('aria-controls', links.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  nav.insertBefore(toggle, links);

  function setOpen(open){
    nav.classList.toggle('mobile-nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', function(e){
    e.stopPropagation();
    setOpen(!nav.classList.contains('mobile-nav-open'));
  });

  links.addEventListener('click', function(e){
    if(e.target.closest('a, #accountBtn')) setOpen(false);
  });

  document.addEventListener('click', function(e){
    if(!nav.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && nav.classList.contains('mobile-nav-open')){
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener('resize', function(){
    if(window.innerWidth > 700) setOpen(false);
  });
})();
