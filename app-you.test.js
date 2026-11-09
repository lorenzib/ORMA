'use strict';

const fs = require('fs');
const path = require('path');
const { collectAppFiles, APP_YOU_TAG } = require('./scripts/build-app');

const root = __dirname;
const source = fs.readFileSync(path.join(root, 'app-you.js'), 'utf8');

function run(url){
  window.history.replaceState(null, '', url || '/account.html');
  delete window.__ormaAppYou;
  delete window.DoloPawsAuth;
  document.body.innerHTML = '<div class="acct-wrap">account</div>';
  document.body.className = '';
  new Function(source)();
  return document.querySelector('.app-you');
}

function daysAgo(days){
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

beforeEach(() => localStorage.clear());

describe('the app You tab', () => {
  test('a guest is offered to add a dog and to sign in, with no empty month', () => {
    const hub = run();
    expect(hub).not.toBeNull();
    expect(document.body.classList.contains('app-you-hub')).toBe(true);
    expect(hub.querySelector('.app-you-dogname').textContent).toBe('Add your dog');
    expect(hub.querySelector('.app-you-edit').getAttribute('href')).toBe('/onboarding.html');
    expect(hub.querySelector('.app-you-tiles')).toBeNull();
    expect(hub.querySelector('.app-you-walk')).toBeNull();
    const signIn = [...hub.querySelectorAll('.app-you-link')].pop();
    expect(signIn.getAttribute('href')).toBe('/?login=1&next=account.html');
  });

  test('a member sees their dog, this month and the latest three walks', () => {
    localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      uid:'u1', activeDogId:'d2',
      dogs:[{ id:'d1', name:'Bea' }, { id:'d2', name:'Luna', breed:'Border Collie' }],
    }));
    localStorage.setItem('dolopaws-journal-u1', JSON.stringify([
      { id:'a', date:daysAgo(60), trail:'Old walk', dist:'9.0', dur:'200' },
      { id:'b', date:daysAgo(0), trailId:'lago-di-braies-seeweg-circuit', trail:'Lago di Braies', dist:'3.6', dur:'64' },
      { id:'c', date:daysAgo(0), trail:'Second', dist:'', dur:'' },
      { id:'d', date:daysAgo(0), trail:'Third', dist:'1.0', dur:'20' },
    ]));
    const hub = run();
    expect(hub.querySelector('.app-you-dogname').textContent).toBe('Luna');
    expect(hub.querySelector('.app-you-dogline').textContent).toContain('Border Collie');
    expect(hub.querySelector('.app-you-edit').getAttribute('href')).toBe('/account.html?next=account.html');
    const tiles = [...hub.querySelectorAll('.app-you-tile-v')].map(tile => tile.textContent);
    expect(tiles).toEqual(['3', '4.6 km', '1:24']);
    const walks = [...hub.querySelectorAll('.app-you-walk')];
    expect(walks).toHaveLength(3);
    expect(walks.map(walk => walk.querySelector('.app-you-walkname').textContent)).not.toContain('Old walk');
    const braies = walks.find(walk => walk.textContent.includes('Lago di Braies'));
    expect(braies.getAttribute('href')).toBe('/trail.html?id=lago-di-braies-seeweg-circuit');
    expect(braies.querySelector('.app-you-walkline').textContent).toBe('Today · 3.6 km · 1:04');
    expect(hub.querySelector('.app-you-all').getAttribute('href')).toBe('/journal.html');
    const last = [...hub.querySelectorAll('.app-you-link')].pop();
    expect(last.getAttribute('href')).toBe('/settings.html');
  });

  test('Edit, add a dog, log out and #cancel still open the full account page', () => {
    ['/account.html?next=account.html', '/account.html?mode=add', '/account.html?logout=1', '/account.html#cancel']
      .forEach(url => {
        expect(run(url)).toBeNull();
        expect(document.body.classList.contains('app-you-hub')).toBe(false);
      });
  });

  test('ships in the app on account.html only, never on the website', () => {
    const build = fs.readFileSync(path.join(root, 'scripts/build-app.js'), 'utf8');
    expect(APP_YOU_TAG).toBe('<script src="/app-you.js" defer></script>');
    expect(collectAppFiles().files.has('app-you.js')).toBe(true);
    expect(build).toContain("${r === 'account.html' ? `${APP_YOU_TAG}\\n` : ''}");
    expect(fs.readFileSync(path.join(root, '_config.yml'), 'utf8')).toMatch(/^\s+- app-you\.js$/m);
    expect(fs.readFileSync(path.join(root, 'account.html'), 'utf8')).not.toContain('app-you.js');
    const shell = fs.readFileSync(path.join(root, 'app-shell.css'), 'utf8');
    expect(shell).toContain('html.orma-app body.app-you-hub .acct-wrap');
  });
});
