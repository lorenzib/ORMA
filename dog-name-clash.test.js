const fs = require('fs');
const path = require('path');
const vm = require('vm');

const authUi = fs.readFileSync(path.join(__dirname, 'auth-ui.js'), 'utf8');

/**
 * A guest builds a dog, then logs into an account that already has dogs.
 * samePendingDog needs name, breed, age band and weight band to agree, so the
 * near miss — the same animal with the breed typed differently, or a weight
 * left blank this time — used to append silently and leave two entries for one
 * dog. Only the person knows which it is.
 */
function load(){
  const start = authUi.indexOf('function sameDogName(');
  const end = authUi.indexOf('async function persistPendingDog(');
  const context = { window:{}, JSON };
  vm.createContext(context);
  vm.runInContext(`${authUi.slice(start, end)}\nthis.__exports = { sameDogName, mergeIntoExisting };`, context);
  return context.__exports;
}

describe('a guest dog meeting an account that has dogs', () => {
  test('a shared name is recognised however it was typed', () => {
    const { sameDogName } = load();
    expect(sameDogName({ name:'Juno' }, { name:'  juno ' })).toBe(true);
    expect(sameDogName({ name:'Juno' }, { name:'Rufus' })).toBe(false);
    // An unnamed dog is not "the same name" as another unnamed one.
    expect(sameDogName({ name:'' }, { name:'' })).toBe(false);
    expect(sameDogName(null, { name:'Juno' })).toBe(false);
  });

  test('merging fills gaps and never clears an answer', () => {
    // A blank in the wizard means "not said", never "delete what the account
    // already knows" — the wizard's own promise is that leaving a field empty
    // makes ORMA quiet about it, not that it erases anything.
    const { mergeIntoExisting } = load();
    const merged = mergeIntoExisting(
      { id:'dog-1', name:'Juno', breed:'Labrador Retriever', ageBand:'adult',
        weightBand:'20-30', fitness:'high', conditions:['arthritis'],
        behaviour:{ livestockComfort:'confident' } },
      { name:'Juno', breed:'Labrador', ageBand:'', weightBand:'',
        conditions:[], behaviour:{ heatTolerance:'low' } },
    );
    expect(merged.breed).toBe('Labrador');              // answered again, so it wins
    expect(merged.ageBand).toBe('adult');               // blank must not clear it
    expect(merged.weightBand).toBe('20-30');
    expect(merged.fitness).toBe('high');                // not asked, so untouched
    expect(merged.conditions).toEqual(['arthritis']);   // empty array is not an answer
    expect(merged.behaviour).toEqual({ livestockComfort:'confident', heatTolerance:'low' });
    // The identity of the dog being updated is never taken from the guest copy.
    expect(merged.id).toBe('dog-1');
  });

  test('an exact repeat is still settled without asking', () => {
    const persist = authUi.slice(authUi.indexOf('async function persistPendingDog('));
    expect(persist).toMatch(/if\(dogs\.some\(dog => samePendingDog\(dog, pending\)\)\) return true;/);
    // The question is only asked when a name collides.
    expect(persist).toContain('const clash = dogs.find(dog => sameDogName(dog, pending));');
    expect(persist).toContain('await askAboutDogNameClash(pending, clash)');
  });

  test('each answer does what it says', () => {
    const persist = authUi.slice(authUi.indexOf('async function persistPendingDog('));
    expect(persist).toMatch(/if\(choice === 'keep'\) return true;/);
    expect(persist).toContain("setDogProfile(mergeIntoExisting(clash, pending), clash.id)");
    // Anything else, including a dialog that could not be drawn, adds — which
    // is what this code did before it asked.
    expect(persist).toMatch(/return await window\.DoloPawsAuth\.addDogProfile\(pending\);\s*\}/);
  });

  test('a first dog on an empty account is never questioned', () => {
    const persist = authUi.slice(authUi.indexOf('async function persistPendingDog('));
    const firstDog = persist.indexOf('if(!dogs.length');
    const asks = persist.indexOf('askAboutDogNameClash');
    expect(firstDog).toBeGreaterThan(-1);
    expect(firstDog).toBeLessThan(asks);
  });

  test('a sign-in is never lost to a dialog that cannot be drawn', () => {
    const dialog = authUi.slice(authUi.indexOf('function askAboutDogNameClash('),
      authUi.indexOf('function sameDogName('));
    expect(dialog).toContain("if(!body) return Promise.resolve('add');");
    // It resolves; it never rejects, so finishAuth cannot throw on this path.
    expect(dialog).not.toContain('reject(');
  });

  test('the panel restores the dialog it borrowed', () => {
    // It hides the login form in place rather than adding markup to two files,
    // so it has to put everything back whichever button is pressed.
    const dialog = authUi.slice(authUi.indexOf('function askAboutDogNameClash('),
      authUi.indexOf('function sameDogName('));
    expect(dialog).toContain('const restore = () =>');
    expect(dialog).toMatch(/restore\(\);\s*\n\s*resolve\(choice\);/);
  });

  test('every word of it is translated', () => {
    const i18n = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    ['title', 'lede', 'update', 'add', 'keep'].forEach(key => {
      // Once for English, once for Italian.
      expect(i18n.split(`'auth.dogClash.${key}'`).length - 1).toBe(2);
    });
  });

  test('the dialog says what it is asking, not "Log in"', () => {
    // The hero sits outside the body the panel borrows, so it kept the login
    // heading above a question about a dog.
    const dialog = authUi.slice(authUi.indexOf('function askAboutDogNameClash('),
      authUi.indexOf('function sameDogName('));
    expect(dialog).toContain("auth.dogClash.heroTitle");
    // And puts the login wording back, whichever button is pressed.
    expect(dialog).toContain('if(title && heroTitle !== null) title.textContent = heroTitle;');
    expect(dialog).toContain('if(hint && heroHint !== null) hint.textContent = heroHint;');
  });
});
