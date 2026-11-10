'use strict';

const fs = require('fs');
const path = require('path');
const { collectAppFiles, APP_SAVED_TAG } = require('./scripts/build-app');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('app-saved.js');

// The real verdict words and season rule, so the screen is tested against
// what Explore says, not against a copy of it.
require('./match-verdict.js');
require('./trail-season-words.js');

const month = new Date().getMonth() + 1;
const otherMonths = Array.from({ length:12 }, (_, i) => i + 1).filter(m => m !== month);

const TRAILS = [
  { id:'braies', name:'Lago di Braies loop', distance:3.64, elevation:40, hours:1 },
  { id:'mahler', name:'Gustav Mahler path', distance:4.7, elevation:72, hours:2 },
  { id:'seceda', name:'Seceda ridge', distance:7.2, elevation:310, hours:3,
    season:{ recommended:{ months:otherMonths } } },
  { id:'steep', name:'Steep gully', distance:9, elevation:900, hours:4 },
  { id:'unsaved', name:'Not saved', distance:2, elevation:10, hours:1 },
];
const SCORES = {
  braies:{ score:92, category:'strong-option', cautions:[], unknowns:[] },
  mahler:{ score:70, category:'possible-with-cautions', cautions:[], unknowns:[] },
  seceda:{ score:80, category:'possible-with-cautions', cautions:[], unknowns:[] },
  steep:{ score:30, category:'not-recommended', cautions:[{ code:'x', message:'The 900 m climb is too much for {name}.' }], unknowns:[] },
};

function setup({ user = true, favs = { braies:true, mahler:true, seceda:true, steep:true }, setFavorites, search = '' } = {}){
  document.body.innerHTML = '<div class="topnav"></div><div class="wrap"></div><button id="accountBtn"></button>';
  window.history.replaceState(null, '', `/saved.html${search}`);
  delete window.__ormaAppSaved;
  window.trails = TRAILS;
  window.recommendTrail = trail => SCORES[trail.id];
  window.DoloPawsRouteDrafts = { read: () => [] };
  window.DoloPawsAuth = {
    currentUser: user ? { uid:'u' } : null,
    getFavorites: () => Promise.resolve(favs),
    getDogProfile: () => Promise.resolve({ name:'Bella' }),
    setFavorites: setFavorites || (() => Promise.resolve(true)),
  };
  new Function(source)();
  return document.querySelector('.app-saved');
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const names = (hub, selector) => [...hub.querySelectorAll(selector)].map(node => node.querySelector('.app-saved-name').textContent);

describe('the app Saved tab', () => {
  test('splits saved trails into good today and not today, with the reason', async () => {
    const hub = setup();
    await flush();
    expect(document.body.classList.contains('app-saved-hub')).toBe(true);
    const labels = [...hub.querySelectorAll('.app-saved-label')].map(node => node.textContent);
    expect(labels).toEqual(['Good today · 2', 'Not today · 2', 'My routes']);
    expect(names(hub, '.app-saved-card:not(.is-dim)')).toEqual(['Lago di Braies loop', 'Gustav Mahler path']);
    expect(names(hub, '.app-saved-card.is-dim')).toEqual(['Seceda ridge', 'Steep gully']);
    const verdicts = [...hub.querySelectorAll('.app-saved-verdict')].map(node => node.textContent);
    expect(verdicts).toEqual(['Strong option', 'Good with care']);
    const why = [...hub.querySelectorAll('.app-saved-why')].map(node => node.textContent);
    expect(why[0]).toMatch(/^Out of season\. Best time: /);
    // The reason names the dog, not "{name}".
    expect(why[1]).toBe('The 900 m climb is too much for Bella.');
    expect(hub.querySelector('.app-saved-count').textContent).toBe('4 trails');
    expect(hub.querySelector('.app-saved-sub').textContent).toBe('Ranked for Bella today');
    expect(hub.querySelector('.app-saved-meta').textContent).toBe('3.6 km · 40 m climb · 1 h');
    expect(hub.querySelector('.app-saved-link').getAttribute('href')).toBe('trail.html?id=braies&from=saved.html');
  });

  test('the heart removes a trail from saved', async () => {
    const setFavorites = jest.fn(() => Promise.resolve(true));
    const hub = setup({ setFavorites });
    await flush();
    hub.querySelector('[data-remove="braies"]').click();
    await flush();
    expect(setFavorites).toHaveBeenCalledWith({ mahler:true, seceda:true, steep:true });
    expect(names(hub, '.app-saved-card')).not.toContain('Lago di Braies loop');
  });

  test('a failed remove keeps the trail and says so', async () => {
    const hub = setup({ setFavorites: () => Promise.resolve(false) });
    await flush();
    hub.querySelector('[data-remove="braies"]').click();
    await flush();
    expect(names(hub, '.app-saved-card')).toContain('Lago di Braies loop');
    expect(hub.querySelector('.app-saved-status').textContent).toMatch(/Could not remove it/);
  });

  test('signed out asks to log in and still offers drawing a route', () => {
    const hub = setup({ user:false });
    expect(hub.querySelector('.app-saved-empty-title').textContent).toBe('Log in to see your saved trails');
    const route = hub.querySelector('.app-saved-route.is-empty');
    expect(route.getAttribute('href')).toBe('route-planner.html');
    expect(route.textContent).toContain('Draw a route');
  });

  test('nothing saved points back to Explore', async () => {
    const hub = setup({ favs:{} });
    await flush();
    expect(hub.querySelector('.app-saved-empty-title').textContent).toBe('Nothing saved yet');
    expect(hub.querySelector('.app-saved-empty a').getAttribute('href')).toBe('index.html');
  });

  test('a deep link opens the full page as before', () => {
    expect(setup({ search:'?x=1' })).toBeNull();
  });
});

describe('Saved is wired into the app only', () => {
  test('ships on the app saved.html, never on the website', () => {
    expect(APP_SAVED_TAG).toBe('<script src="/app-saved.js" defer></script>');
    expect(collectAppFiles().files.has('app-saved.js')).toBe(true);
    expect(read('scripts/build-app.js')).toContain("${r === 'saved.html' ? `${APP_SAVED_TAG}\\n` : ''}");
    expect(read('_config.yml')).toMatch(/^\s+- app-saved\.js$/m);
    expect(read('saved.html')).not.toContain('app-saved.js');
  });

  test('saved.html loads the verdict words and the season rule it needs', () => {
    const page = read('saved.html');
    expect(page).toContain('<script src="match-verdict.js');
    expect(page).toContain('<script src="trail-season-words.js');
  });

  test('the website page is hidden under the Saved screen', () => {
    const shell = read('app-shell.css');
    expect(shell).toContain('html.orma-app body.app-saved-hub .wrap,');
    expect(shell).toContain('html.orma-app body.app-saved-hub .dog-profile-banner,');
  });
});
