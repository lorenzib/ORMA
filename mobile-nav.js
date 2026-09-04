(function(){
  const navigationScript=document.currentScript;
  if(!window.ORMADeviceHandoff&&navigationScript&&navigationScript.src&&!document.querySelector('script[data-orma-device-handoff]')){
    const handoffScript=document.createElement('script');
    handoffScript.src=new URL('device-handoff.js?v=20260901-1',navigationScript.src).href;
    handoffScript.defer=true;
    handoffScript.dataset.ormaDeviceHandoff='true';
    document.head.appendChild(handoffScript);
  }
  const pathName=window.location.pathname;
  if(/\/trails\/[^/]+\.html$/.test(pathName)||/\/trail\.html$/.test(pathName)){
    const hazardScript=document.createElement('script');
    hazardScript.src=pathName.includes('/trails/')?'../trail-hazards.js?v=20260819-1':'trail-hazards.js?v=20260819-1';
    hazardScript.defer=true;document.head.appendChild(hazardScript);
  }
  function installSkipLink(){
    if(!document.body || document.querySelector('.dp-skip-link')) return;
    const link = document.createElement('a');
    link.className = 'dp-skip-link';
    link.href = '#mainContent';
    link.textContent = 'Skip to main content';
    link.setAttribute('data-i18n', 'mobile.skip');
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

  // Retire the former full-width pre-footer promotion everywhere. Older
  // cached builds inserted this block at runtime, so remove it defensively
  // as well as no longer creating it in the current navigation shell.
  function removeLegacyPrefooter(root){
    if(!root) return;
    if(root.matches && root.matches('.hp-prefooter')) root.remove();
    if(root.querySelectorAll){
      root.querySelectorAll('.hp-prefooter').forEach(element => element.remove());
    }
  }

  removeLegacyPrefooter(document);

  function installAlpinePlantsFooterLink(){
    document.querySelectorAll('.hp-footer-links').forEach(group => {
      const breedLink = Array.from(group.querySelectorAll('a[href]'))
        .find(link => /guides\/breed-group-caveats\.html$|breed-group-caveats\.html$/.test(link.getAttribute('href') || ''));
      if(!breedLink || group.querySelector('a[href$="alpine-plants-for-dogs.html"]')) return;
      const link = document.createElement('a');
      link.href = (breedLink.getAttribute('href') || '').replace('breed-group-caveats.html', 'alpine-plants-for-dogs.html');
      link.textContent = 'Alpine plants guide';
      link.setAttribute('data-i18n', 'mobile.alpinePlants');
      group.appendChild(link);
    });
  }

  installAlpinePlantsFooterLink();

  function hasDogProfile(summary){
    if(!summary || typeof summary !== 'object') return false;
    if(summary.hasProfile === true) return true;
    return Array.isArray(summary.dogs) && summary.dogs.length > 0;
  }

  function pendingDogProfile(){
    try {
      const profile = JSON.parse(localStorage.getItem('dolopaws-pending-dog-profile') || 'null');
      const name = profile && typeof profile.name === 'string' ? profile.name.trim().slice(0, 40) : '';
      return name ? { name } : null;
    } catch(error){ return null; }
  }

  function currentReturnTarget(){
    const path = window.location.pathname.replace(/^\/+/, '');
    const page = !path || path === 'index.html' ? '/' : path;
    return page === '/' ? page : page + window.location.search + window.location.hash;
  }

  function addDogAccountHref(){
    return '/account.html?mode=add&next=' + encodeURIComponent(currentReturnTarget());
  }

  function installDogProfileBanner(){
    const topnav = document.querySelector('.topnav');
    const personalisedHomepageHeader = document.querySelector('#returningCustomerHomepage .li-top');
    const existingBanner = document.querySelector('.dog-profile-banner');
    if(existingBanner){
      if(personalisedHomepageHeader && personalisedHomepageHeader.nextElementSibling !== existingBanner){
        personalisedHomepageHeader.parentNode.insertBefore(existingBanner, personalisedHomepageHeader.nextSibling);
      }
      return existingBanner;
    }
    if(document.querySelector('[data-inline-dog-profile],[data-hide-dog-profile-banner]')) return null;
    const homepageGuestBanner = document.querySelector('.hp-guestbar--homepage');

    const banner = document.createElement('section');
    banner.className = 'dog-profile-banner';
    banner.hidden = true;
    banner.setAttribute('aria-labelledby', 'dogProfileBannerTitle');

    const inner = document.createElement('div');
    inner.className = 'dog-profile-banner__inner';
    const copyBlock = document.createElement('div');
    copyBlock.className = 'dog-profile-banner__copy';
    const kicker = document.createElement('p');
    kicker.className = 'dog-profile-banner__kicker';
    kicker.textContent = 'Personalised trail matching';
    const title = document.createElement('h2');
    title.id = 'dogProfileBannerTitle';
    title.textContent = 'Add your dog';
    const description = document.createElement('p');
    description.textContent = 'Add your dog for personalised matches. Create a free account only when you choose to save.';
    copyBlock.append(kicker, title, description);

    const profile = document.createElement('a');
    profile.className = 'dog-profile-banner__action hp-dog-profile-cta';
    profile.href = '/?wizard=1';
    profile.textContent = 'Add your dog';
    profile.addEventListener('click', event => {
      if(profile.dataset.action !== 'save-pending-dog') return;
      event.preventDefault();
      const next = window.location.pathname.split('/').pop() + window.location.search + window.location.hash;
      if(window.DoloPawsAuthUI && typeof window.DoloPawsAuthUI.openSignup === 'function'){
        window.DoloPawsAuthUI.openSignup({ next });
        return;
      }
      const account = document.getElementById('accountBtn');
      if(account) account.click();
    });
    inner.append(copyBlock, profile);
    banner.appendChild(inner);
    if(personalisedHomepageHeader) personalisedHomepageHeader.parentNode.insertBefore(banner, personalisedHomepageHeader.nextSibling);
    else if(topnav) topnav.parentNode.insertBefore(banner, topnav.nextSibling);
    else document.body.insertBefore(banner, document.body.firstChild);

    function sync(summary, signedIn){
      const current = arguments.length ? summary : authSummary();
      const member = arguments.length > 1 ? signedIn : !!current;
      const pending = member ? null : pendingDogProfile();
      if(pending){
        const saveLabel = `Save ${pending.name}’s profile`;
        title.textContent = saveLabel;
        description.textContent = `${pending.name}’s matches are ready on this device. Create a free account to keep the profile.`;
        profile.textContent = saveLabel;
        profile.href = '#save-dog-profile';
        profile.dataset.action = 'save-pending-dog';
      }else{
        title.textContent = 'Add your dog';
        description.textContent = 'Add your dog for personalised matches. Create a free account only when you choose to save.';
        profile.textContent = 'Add your dog';
        profile.href = member ? addDogAccountHref() : '/?wizard=1';
        delete profile.dataset.action;
      }
      // The guest homepage already ships the exact prompt and its button
      // opens the in-place wizard. Keep this shared copy ready but hidden
      // until that same page becomes a signed-in/no-dog experience.
      banner.hidden = hasDogProfile(current) || (!!homepageGuestBanner && !member);
    }
    sync();
    window.addEventListener('dolopaws-auth-changed', event => {
      const user = event.detail && event.detail.user;
      sync(user ? authSummary() : null, !!user);
    });
    window.addEventListener('dolopaws-profile-summary-changed', event => {
      const summary = event.detail && event.detail.summary;
      sync(summary, !!summary);
    });
    window.addEventListener('dolopaws-dog-profile-saved', () => {
      sync({ hasProfile:true });
    });
    window.addEventListener('storage', event => {
      if(event.key === 'dolopaws-profile-summary'){
        const summary = authSummary();
        sync(summary, !!summary);
      }
    });
    return banner;
  }

  installDogProfileBanner();

  function installFocusedFooter(){
    document.querySelectorAll('footer.hp-footer').forEach(footer => {
      if(footer.dataset.focusedFooter === 'true') return;
      footer.dataset.focusedFooter = 'true';

      const groups = footer.querySelectorAll('.hp-footer-grid > div');
      const groupTitles = ['','Explore','Dog care','Your walks','ORMA'];
      groups.forEach((group, index) => {
        const heading = group.querySelector(':scope > .hp-footer-h');
        if(heading && groupTitles[index]) heading.textContent = groupTitles[index];
      });

      const appNote = footer.querySelector('.hp-footer-appnote');
      if(appNote) appNote.textContent = 'iPhone and Android apps coming soon.';

      // Keep the familiar store affordances visible before launch without
      // implying that a real listing exists. Once an actual store URL replaces
      // the temporary About link, the button becomes a normal link automatically.
      footer.querySelectorAll('.hp-footer-apps a').forEach(link => {
        const href = link.getAttribute('href') || '';
        if(!href.endsWith('about.html')) return;
        link.dataset.comingSoon = 'true';
        link.setAttribute('role', 'link');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('title', 'Coming soon');
        link.setAttribute('tabindex', '-1');
        link.removeAttribute('href');
      });

      const companyLinks = groups[4]?.querySelector('.hp-footer-links');
      const newsletter = footer.querySelector('.hp-footer-newsletter');
      if(companyLinks && newsletter && !companyLinks.querySelector('.hp-footer-newsletter')){
        companyLinks.appendChild(newsletter);
      }

      const base = footer.querySelector('.hp-footer-base');
      const socialRow = footer.querySelector('.hp-footer-social-row');
      if(base){
        const copyright = base.querySelector('span');
        const legal = document.createElement('div');
        legal.className = 'hp-footer-legal';
        if(copyright) legal.appendChild(copyright);
        if(companyLinks){
          ['privacy.html','terms.html'].forEach(destination => {
            const link = Array.from(companyLinks.querySelectorAll('a[href]'))
              .find(item => (item.getAttribute('href') || '').endsWith(destination));
            if(link) legal.appendChild(link);
          });
        }
        base.replaceChildren();
        if(socialRow){
          socialRow.setAttribute('aria-label', 'ORMA social channels');
          base.appendChild(socialRow);
        }
        base.appendChild(legal);
      }
      footer.querySelector('.hp-footer-connect')?.remove();
    });
  }

  installFocusedFooter();

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
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      removeLegacyPrefooter(node);
      secureBlankLinks(node);
    })))
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

  // The guest context bar follows the sticky navigation. Its offset is
  // measured rather than hard-coded so it remains correct when the header
  // wraps on tablets or changes height after authentication.
  function syncStickyNavOffset(){
    if(!navEl) return;
    const height = Math.ceil(navEl.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--topnav-sticky-offset', height + 'px');
  }

  syncStickyNavOffset();
  window.addEventListener('resize', syncStickyNavOffset);
  if(navEl && typeof ResizeObserver !== 'undefined'){
    new ResizeObserver(syncStickyNavOffset).observe(navEl);
  }

  function copy(key, fallback, vars){
    let value = typeof window.t === 'function' ? window.t(key, vars) : fallback;
    if(value === key) value = fallback;
    Object.keys(vars || {}).forEach(name => { value = String(value).split('{' + name + '}').join(vars[name]); });
    return value;
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
    const brandHref = (brand && brand.getAttribute('href')) || '/';
    // Root-absolute brand href (the 404 page — served at any URL depth)
    // makes every rebuilt link root-absolute too.
    const prefix = brandHref.startsWith('/') ? '/' : (brandHref.startsWith('../') ? '../' : '');
    const parts = window.location.pathname.split('/').filter(Boolean);
    const pageFile = (parts[parts.length - 1] || 'index.html').toLowerCase().endsWith('.html')
      ? (parts[parts.length - 1] || 'index.html') : 'index.html';
    // Path relative to the site root, used for post-login return targets.
    const pagePath = parts.length > 1 ? parts.slice(-2).join('/') : pageFile;

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
      btn.setAttribute('aria-label', copy('mobile.notifications', 'Notifications'));
      btn.setAttribute('data-i18n-aria-label', 'mobile.notifications');
      btn.innerHTML = bellSvg();
      // Badge from the derived-feed count cached by notifications.js and the
      // logged-in homepage. No cache yet (first visit since the feed
      // shipped) means no badge — never a made-up number.
      let unseen = 0;
      try {
        const cached = parseInt(localStorage.getItem('dolopaws-notif-unread'), 10);
        if(!isNaN(cached)) unseen = cached;
      } catch(e){}
      function renderBadge(count){
        let badge = btn.querySelector('.nav-bell-badge');
        if(count > 0){
          if(!badge){
            badge = document.createElement('span');
            badge.className = 'nav-bell-badge';
            btn.appendChild(badge);
          }
          badge.textContent = String(count);
        } else if(badge){
          badge.remove();
        }
      }
      renderBadge(unseen);
      window.addEventListener('dolopaws-notifications-changed', event => {
        renderBadge(Number(event.detail && event.detail.unread) || 0);
      });
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
      label.textContent = name || copy('nav.account', 'My account');
      if(!name) label.setAttribute('data-i18n', 'nav.account');
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
      kick.textContent = copy('mobile.switchDog', 'Switch dog');
      kick.setAttribute('data-i18n', 'mobile.switchDog');
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
          // Dismiss the dog panel immediately. A slow profile sync must never
          // leave an open navigation layer sitting above the rest of the site.
          setOpen(false);
          row.disabled = true;
          if(window.DoloPawsAuth && typeof window.DoloPawsAuth.selectDogProfile === 'function'){
            try {
              const ok = await window.DoloPawsAuth.selectDogProfile(d.id);
              if(ok) window.location.reload();
              else row.disabled = false;
            } catch(error){
              row.disabled = false;
            }
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

      // Signed-in additions stay in the account profile experience. Guests
      // alone use the homepage wizard, where no remote write happens yet.
      const addLink = document.createElement('a');
      addLink.className = 'nav-dogmenu-manage';
      addLink.href = prefix + 'account.html?mode=add&next=' + encodeURIComponent(pagePath);
      addLink.textContent = copy('mobile.addDog', '＋ Add another dog');
      addLink.setAttribute('data-i18n', 'mobile.addDog');
      menu.appendChild(addLink);
      const manage = document.createElement('a');
      manage.className = 'nav-dogmenu-manage';
      manage.href = prefix + 'account.html?'
        + (activeId ? 'dog=' + encodeURIComponent(activeId) + '&' : '')
        + 'next=' + encodeURIComponent(pagePath);
      manage.textContent = copy('mobile.manageDogs', 'Manage dog profiles →');
      manage.setAttribute('data-i18n', 'mobile.manageDogs');
      menu.appendChild(manage);

      function menuDiv(){
        const div = document.createElement('div');
        div.className = 'nav-dogmenu-div';
        div.setAttribute('role', 'separator');
        return div;
      }
      function menuItem(html, href, i18nKey){
        const a = document.createElement('a');
        a.className = 'nav-dogmenu-item';
        a.href = prefix + href;
        a.innerHTML = html;
        if(i18nKey) a.setAttribute('data-i18n', i18nKey);
        return a;
      }
      menu.appendChild(menuDiv());
      const savedLabel = activeName && activeName !== 'Your dog'
        ? copy('mobile.savedFor', 'Saved for {name}', { name:activeName.replace(/[&<>"]/g, '') })
        : copy('mobile.savedTrails', 'Saved trails');
      const savedItem = menuItem(
        '<span class="nav-dogmenu-heart" aria-hidden="true">♥</span>' + savedLabel +
        (Number.isFinite(summary.saved) ? '<span class="nav-dogmenu-count">' + summary.saved + '</span>' : ''),
        'saved.html');
      menu.appendChild(menuItem(copy('mobile.downloads', 'Downloaded trails'), 'downloads.html', 'mobile.downloads'));
      menu.appendChild(menuItem(copy('mobile.settings', 'Account settings'), 'settings.html', 'mobile.settings'));
      menu.appendChild(menuDiv());
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.className = 'nav-dogmenu-item nav-dogmenu-logout';
      logout.textContent = copy('mobile.logout', 'Log out');
      logout.setAttribute('data-i18n', 'mobile.logout');
      logout.addEventListener('click', async () => {
        setOpen(false);
        if(window.DoloPawsAuth && typeof window.DoloPawsAuth.logOut === 'function'){
          await window.DoloPawsAuth.logOut();
          window.location.href = '/';
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

    // On phones the bell must be seen without opening anything: it moves
    // out of the collapsed menu and sits in the header bar, left of the
    // hamburger. Desktop keeps it inline in the links row.
    const bellMq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width:700px)')
      : { matches: false };
    let activeBell = null;
    function placeBell(wrap){
      wrap = wrap || activeBell;
      if(!wrap) return;
      const toggle = navEl.querySelector('.mobile-nav-toggle');
      if(bellMq.matches && toggle){
        if(wrap.parentElement !== navEl || wrap.nextElementSibling !== toggle){
          navEl.insertBefore(wrap, toggle);
        }
      } else if(wrap.parentElement !== linksEl){
        linksEl.appendChild(wrap);
      }
    }
    if(bellMq.addEventListener) bellMq.addEventListener('change', () => placeBell());

    function renderHeader(loggedIn, dogName){
      navEl.classList.toggle('nav-authed', !!loggedIn);
      const key = activeKey();
      // A mobile bell lives directly under .topnav, outside .links. Remove
      // that previous render before rebuilding so an auth refresh cannot
      // leave one bell outside and create a second one inside the menu.
      navEl.querySelectorAll(':scope > .nav-bellwrap').forEach(element => element.remove());
      activeBell = null;
      // Other scripts append their own widgets into .links (i18n.js adds
      // the language toggle on DOMContentLoaded). Rebuilding must not eat
      // them, so anything that isn't ours is kept and re-appended last.
      const extras = Array.from(linksEl.children).filter(el =>
        el !== loginEl && !el.matches('a, #accountBtn, .nav-bellwrap, .nav-userwrap'));
      linksEl.innerHTML = '';
      // Both states share the same link row now; only the right-hand
      // controls change (login pill vs bell + dog pill).
      linksEl.appendChild(navItem('Browse all Trails', 'browse-trails.html', key === 'trails', 'saved.nav.browse'));
      linksEl.appendChild(navItem('Collections', 'collections.html', key === 'collections', 'saved.nav.collections'));
      linksEl.appendChild(navItem('Safety library', 'safety-guide.html', key === 'safety', 'saved.nav.safety'));
      linksEl.appendChild(navItem('My walk journal', 'journal.html', key === 'journal', 'saved.nav.journal'));
      if(loggedIn){
        activeBell = buildBell();
        linksEl.appendChild(activeBell);
        linksEl.appendChild(buildAccountPill(dogName));
        // The hamburger toggle is built later in this same script run;
        // the deferred second call catches it.
        placeBell(activeBell);
        setTimeout(() => placeBell(activeBell), 0);
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
          const script = loadScript('i18n.js?v=20260812-5')
            .then(() => loadScript('auth-ui.js?v=20260812-1'));
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
              console.warn('ORMA lazy login failed:', err);
              window.location.href = '/?view=login&next=' + encodeURIComponent(pagePath);
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
      }
    });
    window.addEventListener('dolopaws-i18n-ready', () => {
      const current = authSummary();
      renderHeader(!!current, current && current.name ? String(current.name) : '');
    }, { once:true });
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
  toggle.setAttribute('data-i18n-aria-label', 'mobile.openMenu');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  nav.insertBefore(toggle, links);

  function setOpen(open){
    nav.classList.toggle('mobile-nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    const key = open ? 'mobile.closeMenu' : 'mobile.openMenu';
    toggle.setAttribute('data-i18n-aria-label', key);
    toggle.setAttribute('aria-label', copy(key, open ? 'Close menu' : 'Open menu'));
  }

  toggle.addEventListener('click', function(e){
    e.stopPropagation();
    setOpen(!nav.classList.contains('mobile-nav-open'));
  });

  links.addEventListener('click', function(e){
    if(e.target.closest('a, #accountBtn, .nav-dogmenu-row, .nav-dogmenu-item')) setOpen(false);
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
