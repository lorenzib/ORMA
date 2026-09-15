const fs = require('fs');
const path = require('path');
const vm = require('vm');

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

/**
 * Signing in from the dog wizard showed one dog, or none, on an account that
 * has several — until the page was refreshed by hand.
 *
 * firebase-init.js starts syncProfileSummary() and then tells its listeners
 * the user changed without waiting for it, so the homepage's first render
 * reads a dolopaws-profile-summary that is still the guest's. The list of dogs
 * comes from that cache, so it rendered empty.
 */
function loadFromScript(names, storage){
  const start = script.indexOf(`function ${names[0]}(`);
  const end = script.indexOf(`function ${names[names.length - 1]}(`);
  const slice = script.slice(start, script.indexOf('\n}', end) + 2);
  const context = {
    localStorage:{
      getItem:key => (key in storage ? storage[key] : null),
      setItem:(key, value) => { storage[key] = String(value); },
    },
    document:{ getElementById:() => null },
    JSON,
  };
  vm.createContext(context);
  vm.runInContext(`${slice}\nthis.__exports = { ${names.join(', ')} };`, context);
  return context.__exports;
}

describe('the dog list after signing in', () => {
  test('the active dog is resolved from the cache the sign-in writes late', () => {
    const storage = {};
    const { liResolveActiveProfile } = loadFromScript(['liResolveActiveProfile', 'renderLiDogLists'], storage);

    // Before the cache lands there is nothing to name: this is the state the
    // auth-changed handler runs in, and what it used to render from.
    expect(liResolveActiveProfile(null)).toBeNull();

    storage['dolopaws-profile-summary'] = JSON.stringify({
      uid:'u1', hasProfile:true, activeDogId:'dog-2',
      dogs:[{ id:'dog-1', name:'Rufus' }, { id:'dog-2', name:'Juno' }],
    });
    // Once it does, the same call names the dog the account actually selected.
    expect(liResolveActiveProfile(null).name).toBe('Juno');
  });

  test('a dog already resolved is not replaced by the cache', () => {
    const storage = { 'dolopaws-profile-summary':JSON.stringify({
      uid:'u1', hasProfile:true, activeDogId:'dog-2',
      dogs:[{ id:'dog-2', name:'Juno' }],
    }) };
    const { liResolveActiveProfile } = loadFromScript(['liResolveActiveProfile', 'renderLiDogLists'], storage);
    // A profile fetched straight from Firestore is at least as fresh as the
    // cache, so re-rendering on the cache event must not overwrite it.
    expect(liResolveActiveProfile({ id:'dog-9', name:'Bella' }).name).toBe('Bella');
  });

  test('the homepage re-renders when the dog cache arrives', () => {
    // The header already did this; the homepage not doing it was the bug.
    const listener = script.slice(script.indexOf("window.addEventListener('dolopaws-profile-summary-changed'"));
    expect(listener).toBeTruthy();
    expect(listener).toContain("document.body.dataset.homepageView !== 'returning'");
    expect(listener).toContain('liResolveActiveProfile(currentProfileForAdjust)');
    expect(listener).toContain('renderReturningHomepage(profile)');
  });

  test('the cache is still written before listeners are told, not after', () => {
    // If firebase-init ever awaits syncProfileSummary the race disappears and
    // this handler becomes redundant rather than wrong — but it does not today,
    // and the comment above the handler explains why.
    const client = fs.readFileSync(path.join(__dirname, 'firebase-init.js'), 'utf8');
    const callback = client.slice(client.indexOf('onAuthStateChanged(auth, (user) =>'));
    expect(callback).toMatch(/syncProfileSummary\(user\);\s*\n\s*changeListeners\.forEach/);
  });
});
