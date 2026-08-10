(function(){
  function installSkipLink(){
    if(!document.body || document.querySelector('.dp-skip-link')) return;
    const link = document.createElement('a');
    link.className = 'dp-skip-link';
    link.href = '#mainContent';
    link.textContent = 'Skip to main content';
    const resolveTarget = () => {
      const candidates = Array.from(document.querySelectorAll('main, [data-main-content], #newCustomerHomepage, #returningCustomerHomepage'));
      const target = candidates.find(element => !element.hidden) || candidates[0];
      if(!target) return null;
      if(!target.id) target.id = 'mainContent';
      link.href = '#' + target.id;
      return target;
    };
    link.addEventListener('focus', resolveTarget);
    link.addEventListener('click', event => {
      const target = resolveTarget();
      if(!target) return;
      event.preventDefault();
      if(!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
      history.replaceState(null, '', link.href);
    });
    document.body.insertBefore(link, document.body.firstChild);
  }

  installSkipLink();

  function installAlpinePlantsFooterLink(){
    document.querySelectorAll('.hp-footer-links').forEach(group => {
      const breedLink = Array.from(group.querySelectorAll('a[href]'))
        .find(link => /guides\/breed-group-caveats\.html$|breed-group-caveats\.html$/.test(link.getAttribute('href') || ''));
      if(!breedLink || group.querySelector('a[href$="alpine-plants-for-dogs.html"]')) return;
      const link = document.createElement('a');
      link.href = (breedLink.getAttribute('href') || '').replace('breed-group-caveats.html', 'alpine-plants-for-dogs.html');
      link.textContent = 'Alpine plants guide';
      group.appendChild(link);
    });
  }

  installAlpinePlantsFooterLink();

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

  function authSummary(){
    try {
      const raw = localStorage.getItem('dolopaws-profile-summary');
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch(e){ return null; }
  }

  function dogPhoto(){
    // Modern summaries carry every dog's photo and active ID. Never fall
    // through to another dog's cache when the active dog has no photo.
    try {
      const summary = authSummary();
      if(summary && Array.isArray(summary.dogs)){
        const active = summary.dogs.find(dog => dog.id === summary.activeDogId)
          || summary.dogs[0] || null;
        const photo = active && active.photo;
        return typeof photo === 'string' && photo.startsWith('data:image/') ? photo : null;
      }
      // Legacy single-dog summaries did not carry an ID or embedded photo.
      const exact = localStorage.getItem('dolopaws-dog-photo');
      if(typeof exact === 'string' && exact.startsWith('data:image/')) return exact;
      for(let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i);
        if(key && key.startsWith('dolopaws-dog-photo')){
          const v = localStorage.getItem(key);
          if(typeof v === 'string' && v.startsWith('data:image/')) return v;
        }
      }
      return null;
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
      // Badge from the derived-feed count cached by notifications.js and the
      // logged-in homepage. No cache yet (first visit since the feed
      // shipped) means no badge — never a made-up number.
      let unseen = 0;
      try {
        const cached = parseInt(localStorage.getItem('dolopaws-notif-unread'), 10);
        if(!isNaN(cached)) unseen = cached;
      } catch(e){}
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

    function dogAvatarEl(name, size, suppliedPhoto){
      const avatar = document.createElement('span');
      avatar.className = 'nav-user-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const photo = suppliedPhoto || dogPhoto();
      if(photo) avatar.style.backgroundImage = 'url(' + photo + ')';
      else avatar.textContent = name ? name.charAt(0).toUpperCase() : '🐾';
      if(size){ avatar.style.width = avatar.style.height = size + 'px'; avatar.style.lineHeight = size + 'px'; }
      return avatar;
    }

    // Dog pill — the shared switcher pattern (map, journal, safety guide,
    // collections and the profile page all use this same control): avatar +
    // name opens a "Switch dog" panel with the dog list and a manage link.
    // The cached account summary carries every dog plus the active id, so the
    // same switcher works on Firebase-backed and static pages.
    function buildAccountPill(name){
      const wrap = document.createElement('div');
      wrap.className = 'nav-userwrap';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-user';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      const initialSummary = authSummary() || {};
      const initialDog = Array.isArray(initialSummary.dogs)
        ? initialSummary.dogs.find(dog => dog.id === initialSummary.activeDogId) : null;
      btn.appendChild(dogAvatarEl(name, null, initialDog && initialDog.photo));
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
      const summaryMeta = [summary.breed, summary.fitness ? summary.fitness + ' fitness' : null]
        .filter(Boolean).join(' · ');
      const dogs = Array.isArray(summary.dogs) && summary.dogs.length
        ? summary.dogs
        : [{ name: name || summary.name || 'Your dog', meta: summary.meta || summaryMeta }];
      const activeId = summary.activeDogId || (dogs[0] && dogs[0].id);
      const activeName = (dogs.find(dog => dog.id === activeId) || {}).name || name || (dogs[0] && dogs[0].name);
      dogs.forEach(d => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'nav-dogmenu-row' + (d.id === activeId ? ' on' : '');
        row.setAttribute('aria-pressed', String(d.id === activeId));
        row.appendChild(dogAvatarEl(d.name, 32, d.photo));
        const txt = document.createElement('span');
        txt.style.cssText = 'flex:1;min-width:0;';
        const nm = document.createElement('b');
        nm.textContent = d.name;
        txt.appendChild(nm);
        const dogMeta = d.meta || [d.breed, d.fitness ? d.fitness + ' fitness' : null].filter(Boolean).join(' · ');
        if(dogMeta){
          const meta = document.createElement('small');
          meta.textContent = dogMeta;
          txt.appendChild(meta);
        }
        row.appendChild(txt);
        row.addEventListener('click', async () => {
          if(d.id === activeId){ setOpen(false); return; }
          row.disabled = true;
          if(window.DoloPawsAuth && typeof window.DoloPawsAuth.selectDogProfile === 'function'){
            const ok = await window.DoloPawsAuth.selectDogProfile(d.id);
            if(ok) window.location.reload();
            else row.disabled = false;
            return;
          }
          // Static pages have no Firebase client. Keep the local choice so
          // their dog-specific copy switches immediately on reload.
          try {
            const next = { ...summary, activeDogId:d.id, name:d.name, breed:d.breed, fitness:d.fitness };
            localStorage.setItem('dolopaws-profile-summary', JSON.stringify(next));
          } catch(e){}
          window.location.reload();
        });
        menu.appendChild(row);
      });

      // "Add another dog" stays in the account profile experience. The
      // homepage may use its in-place wizard, which now appends as well.
      const addLink = document.createElement('a');
      addLink.className = 'nav-dogmenu-manage';
      addLink.href = prefix + 'account.html?mode=add&next=' + encodeURIComponent(pagePath);
      addLink.textContent = '＋ Add another dog';
      addLink.addEventListener('click', (e) => {
        if(window.DoloPawsWizard && typeof window.DoloPawsWizard.open === 'function'){
          e.preventDefault();
          setOpen(false);
          window.DoloPawsWizard.open();
        }
      });
      menu.appendChild(addLink);
      const manage = document.createElement('a');
      manage.className = 'nav-dogmenu-manage';
      manage.href = prefix + 'account.html?next=' + encodeURIComponent(pagePath);
      manage.textContent = 'Manage dog profiles →';
      menu.appendChild(manage);

      function menuDiv(){
        const div = document.createElement('div');
        div.className = 'nav-dogmenu-div';
        div.setAttribute('role', 'separator');
        return div;
      }
      function menuItem(html, href){
        const a = document.createElement('a');
        a.className = 'nav-dogmenu-item';
        a.href = prefix + href;
        a.innerHTML = html;
        return a;
      }
      menu.appendChild(menuDiv());
      const savedItem = menuItem(
        '<span class="nav-dogmenu-heart" aria-hidden="true">♥</span>Saved' +
        (activeName && activeName !== 'Your dog' ? ' for ' + activeName.replace(/[&<>"]/g, '') : ' trails') +
        (Number.isFinite(summary.saved) ? '<span class="nav-dogmenu-count">' + summary.saved + '</span>' : ''),
        'saved.html');
      menu.appendChild(savedItem);
      menu.appendChild(menuItem('Downloaded trails', 'downloads.html'));
      menu.appendChild(menuItem('Account settings', 'settings.html'));
      if(summary.moderator === true){
        menu.appendChild(menuItem('Moderator workspace', 'moderation.html'));
      }
      menu.appendChild(menuDiv());
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.className = 'nav-dogmenu-item nav-dogmenu-logout';
      logout.textContent = 'Log out';
      logout.addEventListener('click', async () => {
        setOpen(false);
        if(window.DoloPawsAuth && typeof window.DoloPawsAuth.logOut === 'function'){
          await window.DoloPawsAuth.logOut();
          window.location.href = prefix + 'index.html';
        } else {
          // Static pages carry no Firebase; settings has a live logout.
          window.location.href = prefix + 'settings.html';
        }
      });
      menu.appendChild(logout);

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
      linksEl.appendChild(navItem('My walk journal', 'journal.html', key === 'journal'));
      if(loggedIn){
        linksEl.appendChild(buildBell());
        linksEl.appendChild(buildAccountPill(dogName));
      } else {
        // Login must open IN PLACE everywhere (desktop and mobile): pages
        // without auth-ui — the static trail/guide pages, whose markup
        // ships a plain homepage-login anchor — load the auth stack on
        // demand instead of navigating away.
        let authLoading = null;
        function lazyOpenLogin(control){
          if(window.DoloPawsAuthUI){ window.DoloPawsAuthUI.openLogin(); return; }
          if(authLoading) return;
          if('disabled' in control) control.disabled = true;
          function loadScript(src){
            return new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = prefix + src;
              s.onload = resolve;
              s.onerror = reject;
              document.body.appendChild(s);
            });
          }
          // i18n first — auth-ui's modal copy calls window.t().
          const script = loadScript('i18n.js?v=20260729-1')
            .then(() => loadScript('auth-ui.js?v=20260730-4'));
          // import() inside a classic script resolves against THIS script's
          // URL (the site root), not the page — resolve explicitly against
          // the document so ../ prefixes on trail pages work.
          const firebaseUrl = new URL((prefix || './') + 'firebase-init.js', document.baseURI).href;
          authLoading = Promise.all([import(firebaseUrl), script])
            .then(() => {
              if('disabled' in control) control.disabled = false;
              if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openLogin();
            })
            .catch((err) => {
              // Offline or blocked: fall back to the homepage flow.
              console.warn('DoloPaws lazy login failed:', err);
              window.location.href = prefix + 'index.html?view=login&next=' + encodeURIComponent(pagePath);
            });
        }
        if(loginEl){
          linksEl.appendChild(loginEl);
          // Reused static anchors would still bounce — intercept them.
          if(loginEl.tagName === 'A' && !loginEl.dataset.lazyLogin){
            loginEl.dataset.lazyLogin = '1';
            loginEl.addEventListener('click', (e) => {
              e.preventDefault();
              lazyOpenLogin(loginEl);
            });
          }
        } else if(pageFile.toLowerCase() !== 'account.html'){
          const login = document.createElement('button');
          login.type = 'button';
          login.id = 'accountBtn';
          login.className = 'account-btn';
          login.textContent = 'Log in';
          login.setAttribute('data-i18n', 'nav.login');
          login.addEventListener('click', () => lazyOpenLogin(login));
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
        // Feed the notification centre: profile edits become an item there.
        try {
          localStorage.setItem('dolopaws-notif-profile-event',
            JSON.stringify({ ts: Date.now(), name: String(p.name).slice(0, 40) }));
        } catch(err){}
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
