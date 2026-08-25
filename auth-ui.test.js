const fs = require('fs');
const path = require('path');

const authScript = fs.readFileSync(path.join(__dirname, 'auth-ui.js'), 'utf8');

function mountAuth(overrides = {}){
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
    getDogProfiles: jest.fn(async () => ({ dogs:[], activeDogId:null })),
    setDogProfile: jest.fn(async () => true),
    addDogProfile: jest.fn(async () => true),
    ...overrides,
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

  test('persists a guest dog before clearing the handoff after login', async () => {
    const pending = { name:'Moka', breed:'Podenco', ageBand:'adult', weightBand:'10-15' };
    localStorage.setItem('dolopaws-pending-dog-profile', JSON.stringify(pending));
    mountAuth({ signIn:jest.fn(async () => ({ ok:true })) });

    document.getElementById('authEmail').value = 'person@example.com';
    document.getElementById('authPassword').value = 'password';
    document.getElementById('authForm').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(window.DoloPawsAuth.setDogProfile).toHaveBeenCalledWith(pending);
    expect(localStorage.getItem('dolopaws-pending-dog-profile')).toBeNull();
  });

  test('retains the guest dog when the account write fails', async () => {
    const pending = { name:'Moka', breed:'Podenco', ageBand:'adult', weightBand:'10-15' };
    localStorage.setItem('dolopaws-pending-dog-profile', JSON.stringify(pending));
    mountAuth({
      signIn:jest.fn(async () => ({ ok:true })),
      setDogProfile:jest.fn(async () => false),
    });

    document.getElementById('authEmail').value = 'person@example.com';
    document.getElementById('authPassword').value = 'password';
    document.getElementById('authForm').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(JSON.parse(localStorage.getItem('dolopaws-pending-dog-profile'))).toEqual(pending);
  });

  test('adds a handoff dog without overwriting an existing dog', async () => {
    const pending = { name:'Moka', breed:'Podenco', ageBand:'adult', weightBand:'10-15' };
    const existing = { id:'luna-1', name:'Luna', breed:'Labrador', ageBand:'adult', weightBand:'20-30' };
    localStorage.setItem('dolopaws-pending-dog-profile', JSON.stringify(pending));
    mountAuth({
      signIn:jest.fn(async () => ({ ok:true })),
      getDogProfiles:jest.fn(async () => ({ dogs:[existing], activeDogId:existing.id })),
    });

    document.getElementById('authEmail').value = 'person@example.com';
    document.getElementById('authPassword').value = 'password';
    document.getElementById('authForm').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(window.DoloPawsAuth.addDogProfile).toHaveBeenCalledWith(pending);
    expect(window.DoloPawsAuth.setDogProfile).not.toHaveBeenCalled();
  });
});
