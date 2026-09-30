const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('guest dog persistence and the quick wizard chairlift question', () => {
  const controller = read('homepage-search.js');

  test('the quick wizard picks the device dog back up on load', () => {
    expect(controller).toContain("localStorage.getItem('dolopaws-pending-dog-profile')");
    expect(controller).toMatch(/restoreDeviceDog\(\);\s*renderAll\(\);/);
    expect(controller).toContain("state.dog = 'custom';");
  });

  test('a small dog is asked about open chairlifts and the answer is stored on the profile', () => {
    expect(controller).toContain("function asksChairlift(w) { return w.size === 'small'; }");
    expect(controller).toContain("{ label: t('hp.wizard.chairlift.never', 'Not for us, or never tried'), v: 'never' }");
    expect(controller).toContain("{ label: t('hp.wizard.chairlift.ok', 'Yes, held on my lap with harness and leash'), v: 'ok' }");
    expect(controller).toContain("optBtns(chairliftOpts(), w.chairlift, 'chairlift', true)");
    expect(controller).toContain("behaviour.chairlift = w.chairlift;");
    expect(controller).toContain('behaviour: behaviour,');
  });

  test('the chairlift chip and wizard question carry Italian copy', () => {
    const dictionary = read('i18n.js');
    const browse = read('browse-trails.html');
    for(const key of ['browse.chairlifts.label','browse.chairlifts.title','hp.wizard.chairlift.question','hp.wizard.chairlift.note','hp.wizard.chairlift.never','hp.wizard.chairlift.ok','hp.wizard.chairlift.summary']){
      expect((dictionary.match(new RegExp(`'${key.replace(/\./g,'\\.')}':`, 'g')) || []).length).toBe(2);
    }
    expect(dictionary).toContain("'browse.chairlifts.label': 'Includi percorsi con seggiovia'");
    expect(dictionary).toContain("'hp.wizard.chairlift.question': 'Sta tranquillo in braccio a te su una seggiovia aperta?'");
    expect(browse).toContain('data-i18n-title="browse.chairlifts.title"');
    expect(browse).toContain('<span data-i18n="browse.chairlifts.label">Include chairlift routes</span>');
  });

  test('the whole quick wizard carries Italian copy', () => {
    const dictionary = read('i18n.js');
    for(const key of ['hp.wizard.title','hp.wizard.step','hp.wizard.next','hp.wizard.seeTrails','hp.wizard.name','hp.wizard.size','hp.wizard.energy','hp.wizard.terrain','hp.wizard.heat','hp.wizard.summary','hp.wizard.done.title','hp.wizard.done.lead','hp.wizard.done.save','hp.wizard.done.note']){
      expect((dictionary.match(new RegExp(`'${key.replace(/\./g,'\\.')}':`, 'g')) || []).length).toBe(2);
    }
    expect(dictionary).toContain("'hp.wizard.title': 'Parlaci del tuo cane'");
    expect(dictionary).toContain("'hp.wizard.done.title': 'Il profilo di {name} è pronto'");
    // No English literal is written straight into the wizard markup any more.
    expect(controller).not.toMatch(/'<div class="hp-wiz-q">[A-Z]/);
    expect(controller).toContain("optBtns(sizeOpts(), w.size, 'size', false)");
    expect(controller).toContain("optBtns(heatOpts(), w.heat, 'heat', true)");
  });

  test('a declared small dog sees chairlift-assisted routes on the guest homepage', () => {
    expect(controller).toContain('adapters.chairliftSafe(activeProfile())');
    expect(controller).toContain('filters.matches(t, fstate, options)');
  });

  test('Browse scores for the device dog unless the URL names a dog', () => {
    const browse = read('browse-trails.html');
    expect(browse).toContain("dogValue = urlParams.has('dog') ? (canonical.dog || 'medium') : (deviceDogProfile() ? 'custom' : 'medium');");
    expect(browse).toContain("if(dogValue === 'custom') dogProfile = deviceDogProfile() || dogProfile;");
  });

  test('Compare defaults to the device dog unless the URL names a dog', () => {
    const compare = read('compare-page.js');
    expect(compare).toContain("const dogParam = params.get('dog') || (deviceDogProfile() ? 'custom' : 'medium');");
    expect(compare).toContain("if(dog === 'custom') return deviceDogProfile() || profiles.medium;");
    expect(compare).toContain('dog:dogParam,');
    expect(read('compare.html')).toContain('compare-page.js?v=20260917-1');
  });

  test('the collections map colours for the device dog when nobody is signed in', () => {
    const page = read('collections-page.js');
    expect(page).toMatch(/if\(!auth \|\| !auth\.currentUser[^\n]*\)\{\s*const device = deviceDogProfile\(\);\s*if\(device\) applyMatchSubject\(subjectFor\(device\)\);/);
    expect(page).toContain('matchSubject || scoring.GUEST_SUBJECT');
    expect(read('collections.html')).toContain('collections-page.js?v=20260918-1');
  });

  test('the homepage ships the new controller and guest-context versions', () => {
    const html = read('index.html');
    expect(html).toContain('homepage-search.js?v=20260930-2');
    expect(html).toContain('guest-context.js?v=20260917-2');
    expect(read('browse-trails.html')).toContain('guest-context.js?v=20260917-2');
  });
});
