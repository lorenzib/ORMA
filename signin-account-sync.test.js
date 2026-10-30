const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

/**
 * Signing in on a phone showed the account's saved walk but not its two dogs,
 * and a refresh brought back the walk and still not the dogs.
 *
 * The saved walk is read straight from Firestore. The dogs, on every header
 * and the homepage lists, come from the cached dolopaws-profile-summary. That
 * cache arrives after the "signed in" signal, and:
 *   - the shared header (dog pill and Switch dog menu) drew once on that
 *     signal and never again, so it stayed on "Your dog";
 *   - signing in from a page that sends you on navigated away before the
 *     cache was written, cancelling it;
 *   - a full localStorage (common on phones) refused the write, so even a
 *     refresh painted the guest's empty copy.
 */

const TWO_DOGS = {
  uid:'u1', hasProfile:true, activeDogId:'dog-2', name:'Juno', saved:1,
  dogs:[
    { id:'dog-1', name:'Rufus', breed:'Beagle', fitness:'moderate', photo:'data:image/jpeg;base64,' + 'A'.repeat(4000) },
    { id:'dog-2', name:'Juno', breed:'Collie', fitness:'high', photo:'data:image/jpeg;base64,' + 'B'.repeat(4000) },
  ],
};

describe('the shared header after signing in', () => {
  let liveSummary;

  function bootHeader(){
    document.body.innerHTML = '<nav class="topnav"><div class="links"><a id="accountBtn" href="#">Log in</a></div></nav>';
    localStorage.clear();
    liveSummary = null;
    window.DoloPawsAuth = {
      currentUser:null,
      get profileSummary(){ return liveSummary; },
    };
    // mobile-nav.js is a classic script; run it the way the page does.
    window.eval(source('mobile-nav.js'));
  }

  function dogRows(){
    return Array.from(document.querySelectorAll('.nav-dogmenu-row b')).map(el => el.textContent);
  }

  test('draws every dog once the account summary arrives, without a refresh', () => {
    bootHeader();
    // Signed in: the header renders before the account's dogs are known.
    window.DoloPawsAuth.currentUser = { uid:'u1' };
    window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail:{ user:window.DoloPawsAuth.currentUser } }));
    expect(dogRows()).toEqual(['Your dog']);

    // firebase-init.js finishes reading the account and announces it.
    liveSummary = TWO_DOGS;
    window.dispatchEvent(new CustomEvent('dolopaws-profile-summary-changed', { detail:{ summary:TWO_DOGS } }));
    expect(dogRows()).toEqual(['Rufus', 'Juno']);
    expect(document.querySelector('.nav-user-name').textContent).toBe('Juno');
    expect(document.querySelector('.nav-dogmenu-count').textContent).toBe('1');
  });

  test('uses the in-memory summary when localStorage holds the guest copy', () => {
    bootHeader();
    localStorage.setItem('dolopaws-profile-summary', JSON.stringify({ hasProfile:false, dogs:[] }));
    liveSummary = TWO_DOGS;
    window.DoloPawsAuth.currentUser = { uid:'u1' };
    window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail:{ user:window.DoloPawsAuth.currentUser } }));
    expect(dogRows()).toEqual(['Rufus', 'Juno']);
  });

  test('a summary event after signing out does not draw a member header', () => {
    bootHeader();
    window.dispatchEvent(new CustomEvent('dolopaws-profile-summary-changed', { detail:{ summary:TWO_DOGS } }));
    expect(dogRows()).toEqual([]);
  });
});

describe('caching the account summary on a full phone', () => {
  function loadCache(quotaChars){
    const client = source('firebase-init.js');
    const slice = client.slice(client.indexOf('let liveProfileSummary;'), client.indexOf('onAuthStateChanged(auth'));
    const stored = {};
    const events = [];
    const context = {
      localStorage:{
        setItem(key, value){
          if(String(value).length > quotaChars) throw new Error('QuotaExceededError');
          stored[key] = String(value);
        },
        removeItem(key){ delete stored[key]; },
      },
      window:{ dispatchEvent:event => events.push(event) },
      CustomEvent:function(type, init){ this.type = type; this.detail = init.detail; },
      Promise, JSON,
    };
    vm.createContext(context);
    vm.runInContext(`${slice}\nthis.__exports = { cacheProfileSummary, live:() => liveProfileSummary };`, context);
    return { ...context.__exports, stored, events };
  }

  test('keeps the dogs without their photos when the full copy does not fit', () => {
    const cache = loadCache(2000);
    cache.cacheProfileSummary(TWO_DOGS);
    const saved = JSON.parse(cache.stored['dolopaws-profile-summary']);
    expect(saved.dogs.map(dog => dog.name)).toEqual(['Rufus', 'Juno']);
    expect(saved.dogs.every(dog => dog.photo === null)).toBe(true);
    // The page itself still has the photos, in memory and on the event.
    expect(cache.live().dogs[0].photo).toMatch(/^data:image/);
    expect(cache.events[0].detail.summary.dogs).toHaveLength(2);
  });

  test('never leaves the guest copy behind when nothing fits', () => {
    const cache = loadCache(10);
    cache.stored['dolopaws-profile-summary'] = '{"hasProfile":false,"dogs":[]}';
    cache.cacheProfileSummary(TWO_DOGS);
    expect(cache.stored['dolopaws-profile-summary']).toBeUndefined();
    expect(cache.live().dogs).toHaveLength(2);
    expect(cache.events).toHaveLength(1);
  });
});

describe('leaving the sign-in page', () => {
  test('waits for the account summary before navigating, with a time limit', () => {
    const authUi = source('auth-ui.js');
    const finish = authUi.slice(authUi.indexOf('async function finishAuth('), authUi.indexOf('function openModal('));
    expect(finish.indexOf('profileSummaryReady()')).toBeGreaterThan(-1);
    expect(finish.indexOf('profileSummaryReady()')).toBeLessThan(finish.indexOf('window.location.replace(target)'));
    const client = source('firebase-init.js');
    const ready = client.slice(client.indexOf('profileSummaryReady(timeoutMs'));
    expect(ready).toMatch(/Promise\.race\(\[settled, timeout\]\)/);
  });
});

describe('a guest dog never lands over the account dogs', () => {
  test('sign-in keeps the guest dog on the device when the account cannot be read', async () => {
    const authUi = source('auth-ui.js');
    const start = authUi.indexOf('function samePendingDog(');
    const persistStart = authUi.indexOf('async function persistPendingDog(');
    const persistEnd = authUi.indexOf('async function finishAuth(');
    const writes = [];
    const context = {
      window:{ DoloPawsAuth:{
        getDogProfiles:async () => ({ dogs:[], activeDogId:null, loadError:true }),
        setDogProfile:async dog => { writes.push(dog); return true; },
        addDogProfile:async dog => { writes.push(dog); return true; },
      } },
      JSON,
    };
    vm.createContext(context);
    vm.runInContext(
      `${authUi.slice(start, authUi.indexOf('/**', start))}\n${authUi.slice(persistStart, persistEnd)}\nthis.__persist = persistPendingDog;`,
      context
    );
    await expect(context.__persist({ name:'Bella' })).resolves.toBe(false);
    expect(writes).toEqual([]);
  });

  test('the save-to-account prompt is not offered when the account cannot be read', async () => {
    jest.resetModules();
    document.body.innerHTML = '';
    localStorage.clear();
    const writes = [];
    window.DoloPawsAuth = {
      currentUser:{ uid:'u1' },
      getDogProfiles:async () => ({ dogs:[], activeDogId:null, loadError:true }),
      getDogProfile:async () => null,
      setDogProfile:async dog => { writes.push(dog); return true; },
    };
    localStorage.setItem('dolopaws-pending-dog-profile', JSON.stringify({ name:'Bella', fitness:'moderate' }));
    require('./guest-context.js');
    window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail:{ user:window.DoloPawsAuth.currentUser } }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.getElementById('guestMigrationPrompt')).toBeNull();
    expect(writes).toEqual([]);
  });

  test('the homepage handoff only writes the guest dog to an account it read as empty', () => {
    const home = source('script.js');
    const handoff = home.slice(home.indexOf("const pendingRaw = localStorage.getItem('dolopaws-pending-dog-profile');"));
    const block = handoff.slice(0, handoff.indexOf('} catch(err){ /* never block login on handoff */ }'));
    expect(block).toContain('state && !state.loadError');
    expect(block).toContain('!state.dogs.length');
    expect(block).not.toContain('getDogProfile()');
  });
});
