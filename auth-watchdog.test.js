const fs = require('fs');
const path = require('path');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, 'auth-watchdog.js'), 'utf8');

function page(body){
  const dom = new JSDOM(`<!doctype html><body><header>ORMA</header>${body}<h1>Saved trails</h1></body>`, { runScripts:'outside-only' });
  dom.window.eval(source);
  return dom.window;
}

describe('a page that waits for sign-in does not wait forever', () => {
  test('after the wait it hides the loading placeholder and says why, with a retry', () => {
    const win = page('<div id="savedLoading" data-auth-loading role="status">Loading…</div>');
    expect(win.DoloPawsAuthWatchdog.giveUp(win.document)).toBe(true);
    expect(win.document.getElementById('savedLoading').hidden).toBe(true);
    const box = win.document.querySelector('.auth-unavailable');
    expect(box.getAttribute('role')).toBe('alert');
    expect(box.textContent).toContain('We can’t reach ORMA’s sign-in right now');
    expect(box.querySelector('button').textContent).toBe('Try again');
    expect(box.nextElementSibling.tagName).toBe('H1');
    expect(win.DoloPawsAuthUnavailable).toBe(true);
  });

  test('it says nothing once sign-in has loaded', () => {
    const win = page('<div data-auth-loading>Loading…</div>');
    win.DoloPawsAuthReady = true;
    expect(win.DoloPawsAuthWatchdog.giveUp(win.document)).toBe(false);
    expect(win.document.querySelector('.auth-unavailable')).toBeNull();
  });

  test('sign-in loading late removes the notice', () => {
    const win = page('');
    win.DoloPawsAuthWatchdog.giveUp(win.document);
    win.dispatchEvent(new win.CustomEvent('dolopaws-auth-ready'));
    expect(win.document.querySelector('.auth-unavailable')).toBeNull();
  });

  test('the four signed-in pages load it, and the notice is in Italian too', () => {
    for(const file of ['account.html', 'saved.html', 'settings.html', 'journal.html']){
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).toMatch(/<script src="auth-watchdog\.js\?v=[^"]+"><\/script>/);
    }
    const i18n = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    expect(i18n).toContain("'auth.unavailable': 'Non riusciamo a raggiungere");
  });
});
