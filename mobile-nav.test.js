const fs = require('fs');
const path = require('path');

const mobileNav = fs.readFileSync(path.join(__dirname, 'mobile-nav.js'), 'utf8');

describe('shared navigation hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">DoloPaws</a><div class="links"><a href="browse-trails.html">Trails</a></div></nav>';
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

  test('keeps one notification bell outside the menu after auth refresh', async () => {
    // Use a fresh window so event listeners installed by earlier test runs
    // cannot manufacture duplicate renders that a real page never has.
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">DoloPaws</a><div class="links"></div></nav>';
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
  });
});
