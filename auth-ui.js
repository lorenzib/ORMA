(function(){
  let mode = 'login'; // 'login' | 'signup'

  // Pages used to carry (or skip) their own copy of the login dialog, so
  // "Log in" bounced everyone to the homepage. The dialog now lives here:
  // if the page didn't ship one, inject the redesigned modal so login
  // opens in place everywhere auth-ui.js runs. The hero photo is loaded
  // lazily on first open (see openModal) to keep page weight unchanged.
  if(!document.getElementById('authModal') && document.body){
    const host = document.createElement('div');
    host.innerHTML =
      '<div id="authModal" class="modal-overlay auth-modal-redesign" hidden role="dialog" aria-modal="true" aria-labelledby="authTitle">' +
        '<div class="modal">' +
          '<div class="auth-hero">' +
            '<img data-authsrc="images/lago-di-braies.webp" alt="" class="auth-hero-img">' +
            '<div class="auth-hero-shade"></div>' +
            '<button id="authClose" class="modal-close" aria-label="Close">&times;</button>' +
            '<div class="auth-hero-copy">' +
              '<span class="auth-hero-brand"><img src="logo.svg" alt="">DoloPaws</span>' +
              '<h2 id="authTitle" data-i18n="nav.login">Welcome back</h2>' +
              '<p class="hint" id="authHint" data-i18n="auth.hint">Save trails so they follow you across every device.</p>' +
            '</div>' +
          '</div>' +
          '<div class="auth-body">' +
            '<div id="authError" class="auth-error" role="alert" aria-live="polite" hidden></div>' +
            '<button id="googleBtn" class="google-btn">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>' +
              '<span data-i18n="auth.google">Continue with Google</span>' +
            '</button>' +
            '<div class="auth-divider"><span data-i18n="auth.or">or with email</span></div>' +
            '<form id="authForm">' +
              '<label class="field-label"><span data-i18n="auth.email">Email</span>' +
                '<input type="email" id="authEmail" required autocomplete="email">' +
              '</label>' +
              '<label class="field-label"><span data-i18n="auth.password">Password</span>' +
                '<input type="password" id="authPassword" required autocomplete="current-password" minlength="6">' +
              '</label>' +
              '<button type="button" id="forgotPasswordBtn" class="forgot-link" data-i18n="auth.forgot">Forgot password?</button>' +
              '<button type="submit" class="auth-submit" id="authSubmit" data-i18n="nav.login">Log in</button>' +
            '</form>' +
            '<button id="authGuestBtn" type="button" class="auth-guest-link" data-i18n="auth.guest">Keep browsing as a guest &rarr;</button>' +
            '<p class="auth-toggle">' +
              '<span id="authToggleText" data-i18n="auth.noAccount">Don\'t have an account?</span>' +
              '<button id="authToggleBtn" type="button" data-i18n="auth.signup">Sign up</button>' +
            '</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host.firstElementChild);
  }

  const modal = document.getElementById('authModal');
  const accountBtn = document.getElementById('accountBtn');
  const closeBtn = document.getElementById('authClose');
  const title = document.getElementById('authTitle');
  const hint = document.getElementById('authHint');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const submitBtn = document.getElementById('authSubmit');
  const errorBox = document.getElementById('authError');
  const googleBtn = document.getElementById('googleBtn');
  const toggleText = document.getElementById('authToggleText');
  const toggleBtn = document.getElementById('authToggleBtn');
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  const requestedNext = new URLSearchParams(window.location.search).get('next');
  let returnFocus = null;
  const focusableSelector = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function safeReturnTarget(value){
    if(!value || /^(?:[a-z]+:|\/\/|\/)/i.test(value)) return '';
    return /^[a-z0-9][a-z0-9._/-]*\.html(?:\?[^#]*)?(?:#.*)?$/i.test(value) ? value : '';
  }

  function finishAuth(){
    closeModal();
    const target = safeReturnTarget(requestedNext);
    if(target) window.location.replace(target);
  }

  function openModal(){
    if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
      window.location.href = 'account.html';
      return;
    }
    if(!modal) return; // defensive: injection above guarantees one normally
    // Injected dialogs defer the hero photo until someone actually opens
    // the modal, so pages don't pay for an image they may never show.
    const heroImg = modal.querySelector('.auth-hero-img');
    if(heroImg && !heroImg.getAttribute('src') && heroImg.dataset.authsrc){
      heroImg.src = heroImg.dataset.authsrc;
    }
    errorBox.hidden = true;
    form.reset();
    returnFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : accountBtn;
    modal.hidden = false;
    document.body.classList.add('auth-modal-open');
    setTimeout(() => emailInput.focus(), 0);
  }
  function closeModal(){
    if(!modal) return;
    modal.hidden = true;
    document.body.classList.remove('auth-modal-open');
    if(returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  function setMode(newMode){
    mode = newMode;
    if(!modal) return;
    errorBox.hidden = true;
    if(mode === 'login'){
      title.textContent = window.t('nav.login');
      submitBtn.textContent = window.t('nav.login');
      toggleText.textContent = window.t('auth.noAccount');
      toggleBtn.textContent = window.t('auth.signup');
      passwordInput.autocomplete = 'current-password';
    } else {
      title.textContent = window.t('auth.createTitle');
      submitBtn.textContent = window.t('auth.signup');
      toggleText.textContent = window.t('auth.haveAccount');
      toggleBtn.textContent = window.t('nav.login');
      passwordInput.autocomplete = 'new-password';
    }
  }

  if(accountBtn) accountBtn.addEventListener('click', openModal);

  // Everything below only exists on pages that include the auth modal
  // (index, browse). Wiring it unguarded crashed this whole script on the
  // other pages, which froze the account button on its static text and
  // silently disabled every login gate that relies on DoloPawsAuthUI.
  if(modal){

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
  modal.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      e.preventDefault();
      closeModal();
      return;
    }
    if(e.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll(focusableSelector)).filter(el => !el.hidden);
    if(!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  toggleBtn.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

  // "Keep browsing as a guest" — just dismiss the modal, no account needed.
  const guestBtn = document.getElementById('authGuestBtn');
  if(guestBtn) guestBtn.addEventListener('click', closeModal);

  forgotBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const email = emailInput.value.trim();
    if(!email){
      errorBox.textContent = window.t('auth.forgotFirst');
      errorBox.hidden = false;
      return;
    }
    const result = await window.DoloPawsAuth.resetPassword(email);
    errorBox.hidden = false;
    if(result.ok){
      errorBox.style.background = '#DCEBDD';
      errorBox.style.color = '#2C5C34';
      errorBox.textContent = `Password reset link sent to ${email} — check your inbox.`;
    } else {
      errorBox.style.background = '';
      errorBox.style.color = '';
      errorBox.textContent = result.message;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!window.DoloPawsAuth) return;
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'login' ? 'Logging in…' : 'Signing up…';
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const result = mode === 'login'
      ? await window.DoloPawsAuth.signIn(email, password)
      : await window.DoloPawsAuth.signUp(email, password);
    submitBtn.disabled = false;
    setMode(mode);
    if(result.ok){
      finishAuth();
    } else {
      errorBox.textContent = result.message;
      errorBox.hidden = false;
    }
  });

  googleBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const result = await window.DoloPawsAuth.signInGoogle();
    if(result.ok){
      finishAuth();
    } else {
      errorBox.textContent = result.message;
      errorBox.hidden = false;
    }
  });

  // Arriving from a modal-less page that asked for login? Open it now.
  if(new URLSearchParams(window.location.search).get('login') === '1'){
    const openRequestedLogin = () => {
      if(!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser)) openModal();
    };
    if(window.DoloPawsAuthReady) openRequestedLogin();
    else window.addEventListener('dolopaws-auth-ready', openRequestedLogin, { once: true });
  }

  } // end if(modal)

  // Expose a way for other scripts (e.g. the homepage teaser CTA) to open
  // the modal already in signup mode.
  window.DoloPawsAuthUI = {
    openSignup(){ setMode('signup'); openModal(); },
    openLogin(){ setMode('login'); openModal(); },
  };

  function waitForAuth(cb){
    if(window.DoloPawsAuth){ cb(); return; }
    window.addEventListener('dolopaws-auth-ready', cb, { once: true });
  }

  waitForAuth(() => {
    window.DoloPawsAuth.onChange((user) => {
      if(accountBtn){
        accountBtn.textContent = user ? window.t('nav.account') : window.t('nav.login');
      }
      window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail: { user } }));
    });
  });
})();
