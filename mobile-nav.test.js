const fs = require('fs');
const path = require('path');

const mobileNav = fs.readFileSync(path.join(__dirname, 'mobile-nav.js'), 'utf8');

describe('shared navigation hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">ORMA</a><div class="links"><a href="browse-trails.html">Trails</a></div></nav>';
    window.eval(mobileNav);
  });

  test('adds an accessible mobile menu control', () => {
    const toggle = document.querySelector('.mobile-nav-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-controls')).toBe('primaryNavigation');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Open menu');
    expect(toggle.getAttribute('data-i18n-aria-label')).toBe('mobile.openMenu');
  });

  test('adds a skip link that focuses the main content', () => {
    const main = document.createElement('main');
    main.id = 'testMain';
    document.body.appendChild(main);
    const skip = document.querySelector('.dp-skip-link');
    skip.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true }));
    expect(skip.getAttribute('href')).toBe('#testMain');
    expect(document.activeElement).toBe(main);
  });

  test('protects dynamically inserted new-tab links', async () => {
    const link = document.createElement('a');
    link.target = '_blank';
    link.href = 'https://example.com';
    document.body.appendChild(link);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(link.rel.split(/\s+/)).toContain('noopener');
  });

  test('removes the retired pre-footer promotion, including late insertions', async () => {
    const banner = document.createElement('section');
    banner.className = 'hp-prefooter';
    document.body.appendChild(banner);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.querySelector('.hp-prefooter')).toBeNull();
  });

  test('publishes the measured sticky-navigation offset for the guest bar', () => {
    expect(document.documentElement.style.getPropertyValue('--topnav-sticky-offset')).toMatch(/px$/);
  });

  test('adds the Alpine plants guide beside the existing dog guides', () => {
    const footer = document.createElement('div');
    footer.className = 'hp-footer-links';
    footer.innerHTML = '<a href="guides/breed-group-caveats.html">Breed group caveats</a>';
    document.body.appendChild(footer);
    window.eval(mobileNav);
    const link = footer.querySelector('a[href="guides/alpine-plants-for-dogs.html"]');
    expect(link && link.textContent).toBe('Alpine plants guide');
    expect(link.getAttribute('data-i18n')).toBe('mobile.alpinePlants');
  });

  test('shows the shared profile banner below the header for guests', () => {
    const nav = document.querySelector('.topnav');
    const banner = document.querySelector('.dog-profile-banner');

    expect(banner).not.toBeNull();
    expect(nav.nextElementSibling).toBe(banner);
    expect(banner.hidden).toBe(false);
    expect(banner.querySelector('.dog-profile-banner__kicker').textContent)
      .toBe('Personalised trail matching');
    expect(banner.querySelector('h2').textContent).toBe('Add your dog');
    expect(banner.querySelector('.dog-profile-banner__copy > p:last-child').textContent)
      .toBe('Add your dog for personalised matches. Create a free account only when you choose to save.');
    expect(banner.querySelector('a').getAttribute('href')).toBe('/?wizard=1');
  });

  test('invites a guest to save the named device profile instead of adding the dog again', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.localStorage.setItem('dolopaws-pending-dog-profile', JSON.stringify({ name:'Eddie' }));
    const openSignup = jest.fn();
    isolated.DoloPawsAuthUI = { openSignup };
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">ORMA</a><div class="links"><button id="accountBtn">Log in</button></div></nav>';
    isolated.eval(mobileNav);

    const banner = isolated.document.querySelector('.dog-profile-banner');
    const action = banner.querySelector('.dog-profile-banner__action');
    expect(banner.hidden).toBe(false);
    expect(banner.querySelector('h2').textContent).toBe('Save Eddie’s profile');
    expect(banner.querySelector('.dog-profile-banner__copy > p:last-child').textContent)
      .toBe('Eddie’s matches are ready on this device. Create a free account to keep the profile.');
    expect(action.textContent).toBe('Save Eddie’s profile');
    expect(action.dataset.action).toBe('save-pending-dog');

    action.click();
    expect(openSignup).toHaveBeenCalledWith({ next:'blank' });
  });

  test('does not duplicate pages that provide an inline dog-profile experience', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">ORMA</a></nav><section data-inline-dog-profile></section>';
    isolated.eval(mobileNav);
    expect(isolated.document.querySelector('.dog-profile-banner')).toBeNull();
  });

  test('allows health guides to suppress the generic dog-profile banner', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">ORMA</a></nav><main data-hide-dog-profile-banner></main>';
    isolated.eval(mobileNav);
    expect(isolated.document.querySelector('.dog-profile-banner')).toBeNull();
  });

  test('shows the shared profile banner first on public flows without the standard header', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.document.body.innerHTML = `
      <main>Contribution flow</main>
      <footer><a href="../browse-trails.html">Browse all Trails</a></footer>`;
    isolated.eval(mobileNav);

    const banner = isolated.document.querySelector('.dog-profile-banner');
    expect(isolated.document.body.firstElementChild).toBe(banner);
    expect(banner.hidden).toBe(false);
    expect(banner.querySelector('a').getAttribute('href')).toBe('/?wizard=1');
  });

  test('shows the banner for a signed-in account without dog details', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      uid:'user-1', hasProfile:false, dogs:[],
    }));
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">ORMA</a><div class="links"></div></nav>';
    isolated.eval(mobileNav);

    expect(isolated.document.querySelector('.dog-profile-banner').hidden).toBe(false);
  });

  test('does not duplicate the homepage guest banner but appears there for a signed-in account without a dog', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.document.body.innerHTML = `
      <nav class="topnav"><a class="brand" href="index.html">ORMA</a><div class="links"></div></nav>
      <div class="hp-guestbar hp-guestbar--homepage">Existing guest prompt</div>`;
    isolated.eval(mobileNav);
    const banner = isolated.document.querySelector('.dog-profile-banner');

    expect(banner.hidden).toBe(true);
    isolated.localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      uid:'user-1', hasProfile:false, dogs:[],
    }));
    isolated.dispatchEvent(new isolated.CustomEvent('dolopaws-auth-changed', {
      detail:{ user:{ uid:'user-1' } },
    }));
    expect(banner.hidden).toBe(false);
  });

  test('hides the banner once a dog profile exists and reacts to profile changes', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      uid:'user-1', hasProfile:true, dogs:[{ id:'dog-1', name:'Eddie' }],
    }));
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">ORMA</a><div class="links"></div></nav>';
    isolated.eval(mobileNav);
    const banner = isolated.document.querySelector('.dog-profile-banner');

    expect(banner.hidden).toBe(true);
    isolated.dispatchEvent(new isolated.CustomEvent('dolopaws-profile-summary-changed', {
      detail:{ summary:{ uid:'user-1', hasProfile:false, dogs:[] } },
    }));
    expect(banner.hidden).toBe(false);
    isolated.dispatchEvent(new isolated.CustomEvent('dolopaws-dog-profile-saved', {
      detail:{ profile:{ id:'dog-1', name:'Eddie' } },
    }));
    expect(banner.hidden).toBe(true);
  });

  test('uses the correct dog-wizard path from nested guide and trail pages', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="../index.html">ORMA</a><div class="links"></div></nav>';
    isolated.eval(mobileNav);

    expect(isolated.document.querySelector('.dog-profile-banner a').getAttribute('href'))
      .toBe('/?wizard=1');
  });

  test('every standard public page with the shared header loads this banner bundle', () => {
    const directories = [__dirname, path.join(__dirname, 'guides'), path.join(__dirname, 'trails')];
    const pages = directories.flatMap(directory => fs.readdirSync(directory)
      .filter(name => name.endsWith('.html'))
      .map(name => path.join(directory, name)))
      .filter(file => fs.readFileSync(file, 'utf8').includes('class="topnav"'));

    expect(pages.length).toBeGreaterThan(150);
    pages.forEach(file => {
      expect(fs.readFileSync(file, 'utf8')).toMatch(
        /src="(?:\.\.\/|\/)?mobile-nav\.js\?v=(?:20260823-[12]|20260831-1)"/
      );
    });
  });

  test('turns the shared footer into the focused CTA and compact navigation', () => {
    const footer = document.createElement('footer');
    footer.className = 'site-footer hp-footer';
    footer.innerHTML = `
      <div class="hp-footer-grid">
        <div><p class="hp-footer-blurb">ORMA</p><div class="hp-footer-get"><div class="hp-footer-h">Get the app</div><div class="hp-footer-apps"><a href="about.html"><img src="app-store-badge.svg" alt="Download on the App Store"></a><a href="about.html"><img src="google-play-badge.svg" alt="Get it on Google Play"></a></div><p class="hp-footer-appnote">Coming soon</p></div></div>
        <div><div class="hp-footer-h">Trails</div><div class="hp-footer-links"><a href="../browse-trails.html">Browse</a></div></div>
        <div><div class="hp-footer-h">Caring for your dog</div><div class="hp-footer-links"></div></div>
        <div><div class="hp-footer-h">Your walks</div><div class="hp-footer-links"></div></div>
        <div><div class="hp-footer-h">Company</div><div class="hp-footer-links"><a href="../privacy.html">Privacy</a><a href="../terms.html">Terms</a></div></div>
      </div>
      <div class="hp-footer-connect"><div class="hp-footer-social-row"><a href="#instagram">Instagram</a></div><a class="hp-footer-newsletter" href="../about.html">Newsletter</a></div>
      <div class="hp-footer-base"><span>© ORMA</span></div>`;
    document.body.appendChild(footer);
    window.eval(mobileNav);

    expect([...footer.querySelectorAll('.hp-footer-grid > div > .hp-footer-h')].map(item => item.textContent))
      .toEqual(['Explore','Dog care','Your walks','ORMA']);
    expect(footer.querySelector('.hp-footer-appnote').textContent).toBe('iPhone and Android apps coming soon.');
    expect(footer.querySelectorAll('.hp-footer-apps a')).toHaveLength(2);
    expect([...footer.querySelectorAll('.hp-footer-apps a')].every(link =>
      link.dataset.comingSoon === 'true' &&
      link.getAttribute('aria-disabled') === 'true' &&
      !link.hasAttribute('href')
    )).toBe(true);
    expect(footer.querySelector('.hp-footer-grid > div:last-child .hp-footer-newsletter')).not.toBeNull();
    expect([...footer.querySelectorAll('.hp-footer-legal a')].map(link => link.textContent)).toEqual(['Privacy','Terms']);
    expect(footer.querySelector('.hp-footer-base > .hp-footer-social-row')).not.toBeNull();
    expect(footer.querySelector('.hp-footer-connect')).toBeNull();
  });

  test('keeps one dog-profile prompt below the personalised homepage header', () => {
    document.body.innerHTML += `
      <div id="returningCustomerHomepage">
        <header class="li-top"></header>
        <div class="li-toolbar"></div>
      </div>
      <footer class="site-footer hp-footer">
        <div class="hp-footer-grid">
          <div></div>
          <div><div class="hp-footer-links"><a href="browse-trails.html">Browse</a></div></div>
        </div>
        <div class="hp-footer-base"><span>© ORMA</span></div>
      </footer>`;
    window.eval(mobileNav);

    const banner = document.querySelector('.dog-profile-banner');
    expect(banner).not.toBeNull();
    expect(document.querySelector('#returningCustomerHomepage .li-top').nextElementSibling).toBe(banner);
    expect(document.querySelectorAll('.dog-profile-banner')).toHaveLength(1);
  });

  test('includes the dog-profile promotion in the safety library', () => {
    document.body.className = 'safety-library-page';
    const footer = document.createElement('footer');
    footer.className = 'site-footer hp-footer';
    footer.innerHTML = `
      <div class="hp-footer-grid">
        <div></div>
        <div><div class="hp-footer-links"><a href="browse-trails.html">Browse</a></div></div>
      </div>
      <div class="hp-footer-base"><span>© ORMA</span></div>`;
    document.body.appendChild(footer);
    window.eval(mobileNav);

    expect(document.querySelector('.dog-profile-banner')).not.toBeNull();
    expect(document.querySelector('.dog-profile-banner').hidden).toBe(false);
    expect(footer.dataset.focusedFooter).toBe('true');
  });

  test('keeps one notification bell outside the menu after auth refresh', async () => {
    // Use a fresh window so event listeners installed by earlier test runs
    // cannot manufacture duplicate renders that a real page never has.
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">ORMA</a><div class="links"></div></nav>';
    isolated.localStorage.setItem('dolopaws-profile-summary', JSON.stringify({ name:'Eddie', dogs:[] }));
    isolated.matchMedia = jest.fn().mockReturnValue({
      matches:true,
      addEventListener:jest.fn(),
    });
    isolated.eval(mobileNav);
    isolated.dispatchEvent(new isolated.CustomEvent('dolopaws-auth-changed', { detail:{ user:{ uid:'user-1' } } }));
    await new Promise(resolve => setTimeout(resolve, 0));

    const nav = isolated.document.querySelector('.topnav');
    const bell = nav.querySelector(':scope > .nav-bellwrap');
    expect(bell).not.toBeNull();
    expect(nav.querySelectorAll('.nav-bellwrap')).toHaveLength(1);
    expect(nav.querySelector('.links .nav-bellwrap')).toBeNull();
    expect(bell.nextElementSibling).toBe(nav.querySelector('.mobile-nav-toggle'));
    expect(bell.querySelector('button').getAttribute('data-i18n-aria-label')).toBe('mobile.notifications');
    isolated.dispatchEvent(new isolated.CustomEvent('dolopaws-notifications-changed', {
      detail:{ unread:3 }
    }));
    expect(bell.querySelector('.nav-bell-badge').textContent).toBe('3');
    isolated.dispatchEvent(new isolated.CustomEvent('dolopaws-notifications-changed', {
      detail:{ unread:0 }
    }));
    expect(bell.querySelector('.nav-bell-badge')).toBeNull();
  });
});
