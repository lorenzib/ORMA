(function(global){
  const VALID_VIEWS = new Set(['new', 'returning']);

  /**
   * Returns the ?view= dev-override value if present and valid, otherwise null.
   * This param is intended for development/testing only. In production the
   * homepage view is driven by auth state (see resolveView).
   */
  function getDevOverrideView(search){
    const params = new URLSearchParams(typeof search === 'string' ? search : global.location.search);
    const view = params.get('view');
    return VALID_VIEWS.has(view) ? view : null;
  }

  /**
   * Resolves the homepage view to display.
   *
   * Priority:
   *   1. ?view= URL param, dev override (for testing without an account).
   *   2. DoloPawsAuth.currentUser, logged in → 'returning', logged out → 'new'.
   *   3. Safe fallback: 'new' when auth is unavailable or state is unknown.
   */
  function resolveView(win){
    const currentWindow = win || global;

    const devView = getDevOverrideView(
      currentWindow.location ? currentWindow.location.search : ''
    );
    if(devView) return devView;

    const auth = currentWindow.DoloPawsAuth;
    if(auth && auth.currentUser){
      return 'returning';
    }
    return 'new';
  }

  function applyHomepageView(win){
    const currentWindow = win || global;
    const doc = currentWindow.document;
    if(!doc) return null;

    const view = resolveView(currentWindow);
    const defaultHero = doc.getElementById('defaultHomepageHero');
    const newHomepage = doc.getElementById('newCustomerHomepage');
    const returningHomepage = doc.getElementById('returningCustomerHomepage');
    const accountBtn = doc.getElementById('accountBtn');
    const returningName = doc.getElementById('returningHeroName');
    const finder = doc.getElementById('finder');
    const trailMap = doc.getElementById('trailMap');
    const results = doc.getElementById('results');

    if(doc.body){
      doc.body.dataset.homepageView = view;
    }

    // The legacy defaultHomepageHero is superseded by the split-hero; keep it hidden.
    if(defaultHero) defaultHero.hidden = true;
    if(newHomepage) newHomepage.hidden = view !== 'new';
    if(returningHomepage) returningHomepage.hidden = view !== 'returning';
    if(finder) finder.hidden = view !== 'returning';
    if(trailMap) trailMap.hidden = false;
    // Results are always shown; script.js limits the visible trail count for guests.
    if(results) results.hidden = false;

    if(accountBtn){
      accountBtn.textContent = view === 'returning' ? 'My account' : 'Log in';
    }

    // Personalise the returning hero with the signed-in user's display name.
    if(returningName && view === 'returning'){
      const name = currentWindow.DoloPawsAuth?.currentUser?.displayName;
      returningName.textContent = name || 'you';
    }

    return view;
  }

  const api = {
    getDevOverrideView,
    resolveView,
    applyHomepageView,
    // Legacy alias retained for any existing callers.
    getHomepageView: getDevOverrideView,
  };

  global.DoloPawsHomepageView = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }

  if(global.document){
    applyHomepageView(global);
    global.addEventListener('dolopaws-auth-changed', function(){
      applyHomepageView(global);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
