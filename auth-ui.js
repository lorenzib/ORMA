(function(){
  let mode = 'login'; // 'login' | 'signup' | 'reset'

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
              '<span class="auth-hero-brand"><img src="logo.svg" alt="">ORMA</span>' +
              '<h2 id="authTitle" data-i18n="nav.login">Log in</h2>' +
              '<p class="hint" id="authHint" data-i18n="auth.hint">Save trails to your account so they follow you across devices.</p>' +
            '</div>' +
          '</div>' +
          '<div class="auth-body">' +
            '<button type="button" id="authBackToLogin" class="auth-back-link" hidden>&larr; Back to log in</button>' +
            '<div id="authResetDone" class="auth-reset-done" aria-live="polite" hidden></div>' +
            '<div id="authError" class="auth-error" role="alert" aria-live="polite" hidden></div>' +
            '<form id="authForm">' +
              '<label class="field-label auth-signup-field" id="authNameLabel" hidden><span>Your name</span>' +
                '<input type="text" id="authName" autocomplete="name" placeholder="Marta Bianchi">' +
              '</label>' +
              '<label class="field-label"><span data-i18n="auth.email">Email</span>' +
                '<input type="email" id="authEmail" required autocomplete="email" placeholder="you@example.com">' +
              '</label>' +
              '<label class="field-label"><span data-i18n="auth.password">Password</span>' +
                '<input type="password" id="authPassword" required autocomplete="current-password" minlength="6">' +
                '<small id="authPasswordHint" class="auth-field-hint" hidden>At least 8 characters.</small>' +
              '</label>' +
              '<label class="field-label auth-signup-field" id="authConfirmLabel" hidden><span>Confirm password</span>' +
                '<input type="password" id="authConfirmPassword" autocomplete="new-password">' +
              '</label>' +
              '<button type="button" id="forgotPasswordBtn" class="forgot-link" data-i18n="auth.forgot">Forgot password?</button>' +
              '<label class="auth-terms" id="authTermsLabel" hidden><input type="checkbox" id="authTerms"> <span>I agree to the <a href="terms.html">terms</a> and <a href="privacy.html">privacy policy</a>.</span></label>' +
              '<button type="submit" class="auth-submit" id="authSubmit" data-i18n="nav.login">Log in</button>' +
            '</form>' +
            '<div class="auth-divider"><span>or</span></div>' +
            '<button id="googleBtn" class="google-btn"><span data-i18n="auth.google">Continue with Google</span></button>' +
            '<button id="appleBtn" class="apple-btn" hidden><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-2-.9-3.2-.9-1.7 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.4 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-1-2.4-3.9zM14.2 5.3c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z"/></svg><span data-i18n="auth.apple">Continue with Apple</span></button>' +
            '<p class="auth-toggle">' +
              '<span id="authToggleText" data-i18n="auth.noAccount">Don\'t have an account?</span>' +
              '<button id="authToggleBtn" type="button" data-i18n="auth.signup">Sign up</button>' +
            '</p>' +
            '<button id="authGuestBtn" type="button" class="auth-guest-link" data-i18n="auth.guest">Keep browsing as a guest &rarr;</button>' +
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
  const nameInput = document.getElementById('authName');
  const nameLabel = document.getElementById('authNameLabel');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const passwordHint = document.getElementById('authPasswordHint');
  const confirmInput = document.getElementById('authConfirmPassword');
  const confirmLabel = document.getElementById('authConfirmLabel');
  const termsInput = document.getElementById('authTerms');
  const termsLabel = document.getElementById('authTermsLabel');
  const submitBtn = document.getElementById('authSubmit');
  const errorBox = document.getElementById('authError');
  const googleBtn = document.getElementById('googleBtn');
  const googleLabel = googleBtn && (googleBtn.querySelector('span') || googleBtn);
  const toggleText = document.getElementById('authToggleText');
  const toggleBtn = document.getElementById('authToggleBtn');
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  const backToLoginBtn = document.getElementById('authBackToLogin');
  const resetDoneBox = document.getElementById('authResetDone');
  const passwordLabel = passwordInput && passwordInput.closest('label');
  const dividerEl = modal && modal.querySelector('.auth-divider');
  const toggleRow = modal && modal.querySelector('.auth-toggle');
  const guestLink = document.getElementById('authGuestBtn');
  const requestedNext = new URLSearchParams(window.location.search).get('next');
  let activeReturnTarget = safeReturnTarget(requestedNext);
  let returnFocus = null;
  const focusableSelector = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function resultMessage(result){
    const code = result && result.code ? String(result.code).replace(/^auth\//, '').replace(/-/g, '_') : '';
    if(code){
      const key = 'auth.error.' + code;
      const translated = window.t(key);
      if(translated !== key) return translated;
    }
    return result && result.message ? result.message : window.t('auth.error.generic');
  }

  function safeReturnTarget(value){
    if(value === '/') return '/';
    if(!value || /^(?:[a-z]+:|\/\/|\/)/i.test(value)) return '';
    return /^[a-z0-9][a-z0-9._/-]*\.html(?:\?[^#]*)?(?:#.*)?$/i.test(value) ? value : '';
  }

  function samePendingDog(left, right){
    if(!(left && right)) return false;
    return String(left.name || '').trim().toLowerCase() === String(right.name || '').trim().toLowerCase()
      && String(left.breed || '').trim().toLowerCase() === String(right.breed || '').trim().toLowerCase()
      && String(left.ageBand || '') === String(right.ageBand || '')
      && String(left.weightBand || '') === String(right.weightBand || '');
  }

  /**
   * The name clash, put to the person who can settle it.
   *
   * Built into the auth modal that is already open rather than added to its
   * markup: that markup exists twice, injected here and inline in index.html,
   * and a panel only this path ever shows does not need to live in both.
   *
   * Resolves to 'update', 'add' or 'keep'. Never rejects: a sign-in must not
   * fail because a dialog could not be drawn, so every unexpected path
   * resolves to 'add', which is what the code did before it asked.
   */
  function askAboutDogNameClash(pending, existing){
    const body = modal && modal.querySelector('.auth-body');
    if(!body) return Promise.resolve('add');
    return new Promise(resolve => {
      const hidden = [];
      [...body.children].forEach(child => {
        if(child.hidden) return;
        child.hidden = true;
        hidden.push(child);
      });
      // The hero sits outside the body, so leaving it alone left the dialog
      // headed "Log in" while it asked about a dog. It is already signed in by
      // this point; the header should say what is being asked.
      const heroTitle = title && title.textContent;
      const heroHint = hint && hint.textContent;
      if(title) title.textContent = window.t ? window.t('auth.dogClash.heroTitle') : 'One last thing';
      if(hint) hint.textContent = window.t ? window.t('auth.dogClash.heroHint') : 'You are signed in. This is about the dog you just described.';
      const restore = () => {
        hidden.forEach(child => { child.hidden = false; });
        if(title && heroTitle !== null) title.textContent = heroTitle;
        if(hint && heroHint !== null) hint.textContent = heroHint;
        panel.remove();
      };
      const name = String(pending.name || '').trim();
      const describe = dog => [dog.breed, dog.ageBand, dog.weightBand]
        .map(value => String(value || '').trim()).filter(Boolean).join(' · ') || 'no other details';

      const panel = document.createElement('div');
      panel.className = 'auth-dogclash';
      panel.setAttribute('role', 'group');
      panel.innerHTML =
        '<h3 class="auth-dogclash-title"></h3>' +
        '<p class="auth-dogclash-lede"></p>' +
        '<div class="auth-dogclash-compare">' +
          '<div><small>On your account</small><span class="auth-dogclash-existing"></span></div>' +
          '<div><small>Just added here</small><span class="auth-dogclash-pending"></span></div>' +
        '</div>' +
        '<button type="button" class="auth-submit" data-clash="update"></button>' +
        '<button type="button" class="auth-dogclash-secondary" data-clash="add"></button>' +
        '<button type="button" class="auth-dogclash-secondary" data-clash="keep"></button>';
      panel.querySelector('.auth-dogclash-title').textContent =
        window.t ? window.t('auth.dogClash.title', { name }) : `You already have a dog called ${name}`;
      panel.querySelector('.auth-dogclash-lede').textContent = window.t
        ? window.t('auth.dogClash.lede')
        : 'Is this the same dog, or another one? Nothing is saved until you choose.';
      panel.querySelector('.auth-dogclash-existing').textContent = describe(existing);
      panel.querySelector('.auth-dogclash-pending').textContent = describe(pending);
      const label = (key, fallback) => (window.t && window.t(key) !== key) ? window.t(key) : fallback;
      panel.querySelector('[data-clash="update"]').textContent =
        label('auth.dogClash.update', 'Same dog — update what I have');
      panel.querySelector('[data-clash="add"]').textContent =
        label('auth.dogClash.add', 'Another dog — add it as well');
      panel.querySelector('[data-clash="keep"]').textContent =
        label('auth.dogClash.keep', 'Discard what I just entered');

      panel.addEventListener('click', event => {
        const choice = event.target && event.target.getAttribute('data-clash');
        if(!choice) return;
        restore();
        resolve(choice);
      });
      body.appendChild(panel);
      const first = panel.querySelector('[data-clash="update"]');
      if(first) first.focus();
    });
  }

  function sameDogName(left, right){
    if(!(left && right)) return false;
    const name = dog => String(dog.name || '').trim().toLowerCase();
    return !!name(left) && name(left) === name(right);
  }

  /**
   * Only the fields the guest actually answered. A blank in the wizard means
   * "not said", never "clear what the account already knows", so merging must
   * not let an unanswered step erase an answered one.
   */
  function mergeIntoExisting(existing, pending){
    const merged = { ...existing };
    Object.keys(pending || {}).forEach(key => {
      const value = pending[key];
      if(value === undefined || value === null) return;
      if(typeof value === 'string' && !value.trim()) return;
      if(Array.isArray(value) && !value.length) return;
      if(key === 'behaviour' && value && typeof value === 'object'){
        merged.behaviour = { ...(existing.behaviour || {}), ...value };
        return;
      }
      merged[key] = value;
    });
    merged.id = existing.id;
    return merged;
  }

  async function persistPendingDog(pending){
    if(!(pending && pending.name && window.DoloPawsAuth)) return true;
    const state = typeof window.DoloPawsAuth.getDogProfiles === 'function'
      ? await window.DoloPawsAuth.getDogProfiles() : null;
    const dogs = state && Array.isArray(state.dogs) ? state.dogs : [];
    // A completed write followed by a retried handoff must not duplicate the
    // same dog. Nothing to decide here: it is the same dog, described the same.
    if(dogs.some(dog => samePendingDog(dog, pending))) return true;
    // First dog on the account.
    if(!dogs.length || typeof window.DoloPawsAuth.addDogProfile !== 'function'){
      return await window.DoloPawsAuth.setDogProfile(pending);
    }
    // A dog of the same name already on the account is genuinely ambiguous:
    // the same dog described differently -- a breed typed one way in the
    // wizard and another on the account, a weight left blank this time -- or a
    // second dog that happens to share a name. samePendingDog needs all four
    // fields to agree, so the near miss used to append silently and leave two
    // entries for one animal. Only the person knows which it is, so ask.
    const clash = dogs.find(dog => sameDogName(dog, pending));
    if(clash){
      const choice = await askAboutDogNameClash(pending, clash);
      if(choice === 'keep') return true;
      if(choice === 'update'){
        return await window.DoloPawsAuth.setDogProfile(mergeIntoExisting(clash, pending), clash.id);
      }
    }
    return await window.DoloPawsAuth.addDogProfile(pending);
  }

  async function finishAuth(){
    // A guest may build a dog profile before creating an account. Persist it
    // before leaving the page so the promised cross-device profile is not
    // dependent on a later auth-state listener winning a navigation race.
    try {
      const pendingRaw = localStorage.getItem('dolopaws-pending-dog-profile');
      if(pendingRaw && window.DoloPawsAuth){
        const pending = JSON.parse(pendingRaw);
        const saved = await persistPendingDog(pending);
        if(!saved) throw new Error('Dog profile handoff was not saved.');
        localStorage.removeItem('dolopaws-pending-dog-profile');
        localStorage.removeItem('dolopaws-dog-draft');
      }
    } catch(err){
      // Keep the local profile in place if syncing fails. The account page
      // retries the handoff; never discard the name on an unsuccessful write.
      console.error('Dog profile handoff could not be saved:', err);
    }
    closeModal();
    const target = safeReturnTarget(activeReturnTarget);
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
    setMode(mode);
    returnFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : accountBtn;
    modal.hidden = false;
    document.body.classList.add('auth-modal-open');
    setTimeout(() => emailInput.focus(), 0);
  }
  function closeModal(){
    if(!modal) return;
    if(mode !== 'login') setMode('login'); // reopen always starts at login
    modal.hidden = true;
    document.body.classList.remove('auth-modal-open');
    if(returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  function setMode(newMode){
    mode = newMode;
    if(!modal) return;
    errorBox.hidden = true;
    const isReset = mode === 'reset';
    // Reset mode strips the dialog down to a single email field: no Google
    // button, no password, no signup toggle, just "send reset link" and a
    // way back to login (matches the LoginScreen design reference).
    if(googleBtn) googleBtn.hidden = isReset;
    if(dividerEl) dividerEl.hidden = isReset;
    if(passwordLabel) passwordLabel.hidden = isReset;
    passwordInput.required = !isReset;
    passwordInput.minLength = mode === 'signup' ? 8 : 6;
    if(nameLabel) nameLabel.hidden = mode !== 'signup';
    if(nameInput) nameInput.required = mode === 'signup';
    if(confirmLabel) confirmLabel.hidden = mode !== 'signup';
    if(confirmInput){
      confirmInput.required = mode === 'signup';
      confirmInput.value = '';
    }
    if(passwordHint) passwordHint.hidden = mode !== 'signup';
    if(termsLabel) termsLabel.hidden = mode !== 'signup';
    if(termsInput) termsInput.required = mode === 'signup';
    forgotBtn.hidden = isReset || mode === 'signup';
    if(toggleRow) toggleRow.hidden = isReset;
    if(backToLoginBtn) backToLoginBtn.hidden = !isReset;
    if(resetDoneBox && !isReset) resetDoneBox.hidden = true;
    form.hidden = false;
    // "Keep browsing as a guest" belongs to the login view only.
    if(guestLink) guestLink.hidden = mode !== 'login';
    if(mode === 'login'){
      title.textContent = window.t('nav.login');
      if(hint) hint.textContent = window.t('auth.hint');
      submitBtn.textContent = window.t('nav.login');
      toggleText.textContent = window.t('auth.noAccount');
      toggleBtn.textContent = window.t('auth.signup');
      if(googleLabel) googleLabel.textContent = window.t('auth.google');
      passwordInput.autocomplete = 'current-password';
    } else if(mode === 'signup'){
      title.textContent = window.t('auth.createTitle');
      if(hint) hint.textContent = window.t('auth.signupHint');
      submitBtn.textContent = window.t('auth.signup');
      toggleText.textContent = window.t('auth.haveAccount');
      toggleBtn.textContent = window.t('nav.login');
      if(googleLabel) googleLabel.textContent = window.t('auth.googleSignup');
      passwordInput.autocomplete = 'new-password';
    } else {
      title.textContent = window.t('auth.resetTitle');
      if(hint) hint.textContent = window.t('auth.resetHint');
      submitBtn.textContent = window.t('auth.sendReset');
      if(backToLoginBtn) backToLoginBtn.textContent = window.t('auth.backToLogin');
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

  // "Keep browsing as a guest", just dismiss the modal, no account needed.
  const guestBtn = document.getElementById('authGuestBtn');
  if(guestBtn) guestBtn.addEventListener('click', closeModal);

  // "Forgot password?" now opens a dedicated reset view (email only) instead
  // of firing straight from the login form.
  forgotBtn.addEventListener('click', () => setMode('reset'));
  if(backToLoginBtn) backToLoginBtn.addEventListener('click', () => {
    setMode('login');
    setTimeout(() => emailInput.focus(), 0);
  });

  async function sendResetLink(){
    if(!window.DoloPawsAuth) return;
    const email = emailInput.value.trim();
    if(!email){
      errorBox.textContent = window.t('auth.forgotFirst');
      errorBox.hidden = false;
      return;
    }
    submitBtn.disabled = true;
    const result = await window.DoloPawsAuth.resetPassword(email);
    submitBtn.disabled = false;
    if(result.ok || result.code === 'auth/user-not-found' || /no account found/i.test(result.message || '')){
      // Deliberately non-enumerating: an unknown address gets the same
      // answer as a known one, so the form can't be used to probe accounts.
      if(resetDoneBox){
        resetDoneBox.innerHTML = window.t('auth.resetSent', {email: `<b>${email.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</b>`});
        resetDoneBox.hidden = false;
        form.hidden = true;
      }
    } else {
      errorBox.textContent = resultMessage(result);
      errorBox.hidden = false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!window.DoloPawsAuth) return;
    if(mode === 'reset'){
      sendResetLink();
      return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if(mode === 'signup' && confirmInput && password !== confirmInput.value){
      errorBox.textContent = window.t('auth.error.passwordMismatch');
      errorBox.hidden = false;
      return;
    }
    if(mode === 'signup' && termsInput && !termsInput.checked){
      errorBox.textContent = window.t('auth.error.termsRequired');
      errorBox.hidden = false;
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'login' ? window.t('auth.loggingIn') : window.t('auth.signingUp');
    const result = mode === 'login'
      ? await window.DoloPawsAuth.signIn(email, password)
      : await window.DoloPawsAuth.signUp(email, password, nameInput ? nameInput.value.trim() : '');
    submitBtn.disabled = false;
    setMode(mode);
    if(result.ok){
      await finishAuth();
    } else {
      errorBox.textContent = resultMessage(result);
      errorBox.hidden = false;
    }
  });

  googleBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const result = await window.DoloPawsAuth.signInGoogle();
    if(result.ok){
      await finishAuth();
    } else {
      errorBox.textContent = resultMessage(result);
      errorBox.hidden = false;
    }
  });

  // Apple sign-in: same flow as Google; the button only appears once the
  // provider is configured (DoloPawsAuth.appleSignInReady).
  const appleBtn = document.getElementById('appleBtn');
  function syncAppleBtn(){
    if(appleBtn && window.DoloPawsAuth && window.DoloPawsAuth.appleSignInReady) appleBtn.hidden = false;
  }
  syncAppleBtn();
  window.addEventListener('dolopaws-auth-ready', syncAppleBtn, { once: true });
  if(appleBtn) appleBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const result = await window.DoloPawsAuth.signInApple();
    if(result.ok){
      await finishAuth();
    } else {
      errorBox.textContent = resultMessage(result);
      errorBox.hidden = false;
    }
  });

  // Arriving from a modal-less page that asked for login? Open it now.
  // (`?view=login` is the design-handoff spelling; `?login=1` predates it.)
  const arrivalParams = new URLSearchParams(window.location.search);
  if(arrivalParams.get('login') === '1' || arrivalParams.get('view') === 'login'){
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
    openSignup(options){
      if(options && options.next) activeReturnTarget = safeReturnTarget(options.next);
      setMode('signup');
      openModal();
    },
    openLogin(options){
      if(options && options.next) activeReturnTarget = safeReturnTarget(options.next);
      setMode('login');
      openModal();
    },
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
