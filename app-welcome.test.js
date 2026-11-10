'use strict';

const fs = require('fs');
const path = require('path');
const { collectAppFiles, APP_WELCOME_TAG } = require('./scripts/build-app');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('app-welcome.js');

const DOG_KEY = 'dolopaws-pending-dog-profile';
const SEEN_KEY = 'orma-app-welcomed';

function setup({ user = null } = {}){
  document.body.className = '';
  document.body.innerHTML = '<button id="accountBtn"></button>';
  delete window.__ormaAppWelcome;
  window.DoloPawsAuth = { currentUser: user };
  new Function(source)();
  return document.querySelector('.app-welcome');
}
const click = selector => document.querySelector(selector).click();
function typeName(value){
  const input = document.querySelector('#appWelcomeName');
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

beforeEach(() => {
  window.localStorage.clear();
  // jsdom cannot reload a page and says so; the reload is checked on the phone.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

describe('the app first launch', () => {
  test('says what ORMA does and offers the three ways in', () => {
    const screen = setup();
    expect(screen.getAttribute('role')).toBe('dialog');
    expect(document.body.classList.contains('app-welcome-open')).toBe(true);
    expect(screen.querySelector('.app-welcome-title').textContent).toBe('Find walks your dog will love');
    expect(screen.querySelectorAll('.app-welcome-ticks li')).toHaveLength(3);
    const buttons = [...screen.querySelectorAll('[data-go]')].map(node => node.textContent);
    expect(buttons).toEqual(['Add your dog · 1 minute', 'Look around first', 'Log in']);
  });

  test('look around first closes it for good', () => {
    setup();
    click('[data-go="look"]');
    expect(document.querySelector('.app-welcome')).toBeNull();
    expect(document.body.classList.contains('app-welcome-open')).toBe(false);
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('1');
    expect(setup()).toBeNull();
  });

  test('log in closes it and opens the login', () => {
    setup();
    const login = jest.fn();
    document.getElementById('accountBtn').addEventListener('click', login);
    click('[data-go="login"]');
    expect(login).toHaveBeenCalled();
    expect(document.querySelector('.app-welcome')).toBeNull();
  });

  test('add your dog keeps name and size on the phone, as the homepage setup does', () => {
    setup();
    click('[data-go="dog"]');
    const save = document.querySelector('[data-go="save"]');
    expect(save.disabled).toBe(true);
    typeName('  Bella ');
    expect(save.disabled).toBe(false);
    expect(save.textContent).toBe('Show Bella’s trails');
    click('[data-size="large"]');
    expect(document.querySelector('[data-size="large"]').getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('[data-size="medium"]').getAttribute('aria-checked')).toBe('false');
    save.click();
    expect(JSON.parse(window.localStorage.getItem(DOG_KEY))).toEqual({
      name:'Bella', breed:'', fitness:'moderate', dob:null, ageBand:null,
      weightBand:'30-40', conditions:[], healthNotes:'', jointIssues:false,
      heatIssues:false, behaviour:{},
    });
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('1');
  });

  test('the keyboard Go key saves the dog', () => {
    setup();
    click('[data-go="dog"]');
    typeName('Rex');
    document.querySelector('#appWelcomeName').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter' }));
    expect(JSON.parse(window.localStorage.getItem(DOG_KEY)).name).toBe('Rex');
  });

  test('the Go key with no name does nothing', () => {
    setup();
    click('[data-go="dog"]');
    document.querySelector('#appWelcomeName').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter' }));
    expect(window.localStorage.getItem(DOG_KEY)).toBeNull();
    expect(document.querySelector('.app-welcome')).not.toBeNull();
  });

  test('back returns to the first screen', () => {
    setup();
    click('[data-go="dog"]');
    click('[data-go="back"]');
    expect(document.querySelector('[data-go="look"]')).not.toBeNull();
  });

  test('never shows for someone with a dog here or signed in', () => {
    window.localStorage.setItem(DOG_KEY, '{"name":"Rex"}');
    expect(setup()).toBeNull();
    window.localStorage.clear();
    expect(setup({ user:{ uid:'u' } })).toBeNull();
  });

  test('closes when someone signs in while it is open', () => {
    expect(setup()).not.toBeNull();
    window.DoloPawsAuth.currentUser = { uid:'u' };
    window.dispatchEvent(new Event('dolopaws-auth-changed'));
    expect(document.querySelector('.app-welcome')).toBeNull();
  });
});

describe('the first launch is wired into the app only', () => {
  test('ships on the app index.html, never on the website', () => {
    expect(APP_WELCOME_TAG).toBe('<script src="/app-welcome.js" defer></script>');
    expect(collectAppFiles().files.has('app-welcome.js')).toBe(true);
    expect(read('scripts/build-app.js')).toContain("${r === 'index.html' ? `${APP_WELCOME_TAG}\\n` : ''}");
    expect(read('_config.yml')).toMatch(/^\s+- app-welcome\.js$/m);
    expect(read('index.html')).not.toContain('app-welcome.js');
  });

  test('sits above the tab bar', () => {
    const shell = read('app-shell.css');
    const layer = Number(shell.match(/\.app-welcome\{[^}]*z-index:(\d+)/)[1]);
    const tabbar = Number(shell.match(/\.app-tabbar\{[^}]*z-index:(\d+)/)[1]);
    expect(layer).toBeGreaterThan(tabbar);
  });
});
