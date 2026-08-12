const fs = require('fs');
const path = require('path');

const authScript = fs.readFileSync(path.join(__dirname, 'auth-ui.js'), 'utf8');

function mountAuth(){
  document.body.innerHTML = `
    <button id="accountBtn">Log in</button>
    <div id="authModal" hidden role="dialog" aria-modal="true" aria-labelledby="authTitle">
      <div class="modal">
        <button id="authClose" aria-label="Close">Close</button>
        <h2 id="authTitle">Log in</h2>
        <p id="authHint"></p>
        <div id="authError" role="alert" hidden></div>
        <form id="authForm">
          <input id="authEmail" type="email">
          <input id="authPassword" type="password">
          <button id="forgotPasswordBtn" type="button">Forgot</button>
          <button id="authSubmit" type="submit">Log in</button>
        </form>
        <button id="googleBtn" type="button">Google</button>
        <span id="authToggleText"></span><button id="authToggleBtn" type="button">Sign up</button>
      </div>
    </div>`;
  window.t = key => key === 'nav.login' ? 'Log in' : key;
  window.DoloPawsAuthReady = true;
  window.DoloPawsAuth = {
    currentUser: null,
    onChange: jest.fn(),
    resetPassword: jest.fn(),
    signIn: jest.fn(),
    signUp: jest.fn(),
    signInGoogle: jest.fn(),
  };
  window.eval(authScript);
}

describe('authentication modal accessibility', () => {
  test('moves focus into the dialog and returns it on Escape', async () => {
    mountAuth();
    const opener = document.getElementById('accountBtn');
    opener.focus();
    opener.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.getElementById('authModal').hidden).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('authEmail'));
    expect(document.body.classList.contains('auth-modal-open')).toBe(true);

    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    expect(document.getElementById('authModal').hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
    expect(document.body.classList.contains('auth-modal-open')).toBe(false);
  });

  test('wraps keyboard focus within the open dialog', async () => {
    mountAuth();
    document.getElementById('accountBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const close = document.getElementById('authClose');
    const toggle = document.getElementById('authToggleBtn');

    toggle.focus();
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', bubbles:true, cancelable:true }));
    expect(document.activeElement).toBe(close);

    close.focus();
    close.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', shiftKey:true, bubbles:true, cancelable:true }));
    expect(document.activeElement).toBe(toggle);
  });

  test('validation, progress and Firebase failures use translation keys', () => {
    expect(authScript).toContain("window.t('auth.error.passwordMismatch')");
    expect(authScript).toContain("window.t('auth.error.termsRequired')");
    expect(authScript).toContain("window.t('auth.loggingIn')");
    expect(authScript).toContain("window.t('auth.signingUp')");
    expect(authScript).toContain("'auth.error.' + code");
    expect(authScript).toContain("window.t('auth.error.generic')");
  });
});
