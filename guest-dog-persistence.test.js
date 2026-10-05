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

  test('the guest bar and mission block carry Italian copy', () => {
    const dictionary = read('i18n.js');
    for(const key of ['hp.guest.kicker','hp.guest.medium.title','hp.guest.medium.sub','hp.guest.addDog','hp.guest.custom.title','hp.guest.custom.cta','hp.guest.preview.title','browse.guest.title','browse.guest.sub','hp.mission.kick','hp.mission.title','hp.mission.copy','hp.mission.quote','hp.mission.cite']){
      expect((dictionary.match(new RegExp(`'${key.replace(/\./g,'\\.')}':`, 'g')) || []).length).toBe(2);
    }
    expect(dictionary).toContain("'hp.mission.title': 'Il percorso deve adattarsi al cane, mai il contrario.'");
    expect(controller).toContain("t('hp.guest.custom.title', 'Scores are personalised for {name}.', custom)");
    expect(controller).toContain("t('hp.mission.title', 'The route must adapt to the dog, never the other way around.')");
    expect(read('index.html')).toContain('<span class="hp-guestbar-kicker" data-i18n="hp.guest.kicker">Guest mode</span>');
    expect(read('browse-trails.html')).toContain('<b data-i18n="browse.guest.title">Guest mode · Scores use a medium-dog profile.</b>');
  });

  test('the search card, filter panel and suggestions carry Italian copy', () => {
    const dictionary = read('i18n.js');
    for(const key of ['hp.search.ph','hp.search.go','hp.search.previewAs','hp.popular.label','hp.preset.medium.name','hp.filters.button','hp.filters.title','hp.filters.minMatchFor','hp.filters.showCount','hp.filters.dayHikes','hp.filters.rocky','hp.count.one','hp.count.many','hp.sug.topFor','hp.sug.seeAll','hp.results.matching','hp.results.rankedFor','hp.results.empty']){
      expect((dictionary.match(new RegExp(`'${key.replace(/\./g,'\\.')}':`, 'g')) || []).length).toBe(2);
    }
    expect(dictionary).toContain("'hp.preset.medium.name': 'Cane di taglia media'");
    expect(dictionary).toContain("'hp.sug.topFor': 'Migliori abbinamenti per {name}'");
    const html = read('index.html');
    expect(html).toContain('data-i18n-ph="hp.search.ph"');
    expect(html).toContain('<span id="hpDogLabel" data-i18n="hp.preset.medium.name">Medium dog</span>');
    expect(html).toContain('<span data-i18n="hp.filters.button">Filter trails</span>');
    expect(html).toContain('id="hpSearchBtn" data-i18n="hp.search.go">Search →</button>');
    expect(html).toContain('<span class="hp-popular-label" data-i18n="hp.popular.label">Popular:</span>');
    // The trail-shadowed renderers use the `tr` alias, never a bare `t(` that would resolve to the trail.
    expect(controller).toContain('var tr = t;');
    expect(controller).toContain("tr('hp.sug.topFor', 'Top matches for {name}', { name: esc(m.name) })");
    expect(controller).toContain("'low-risk': { label: tr('hp.difficulty.lowRisk', 'Low-risk'), dot: '#2C5C34' }");
  });

  test('the Browse page carries Italian copy for its controls, cards, tray and empty states', () => {
    const dictionary = read('i18n.js');
    const browse = read('browse-trails.html');
    for(const key of ['browse.search.ph','browse.search.go','browse.geo.country','browse.geo.allCountries','browse.filters.button','browse.filters.showCount','browse.quick.shade','browse.saved.onlySaved','browse.view.list','browse.map.searchArea','browse.results.ofTotal','browse.compare.count','browse.compare.go','browse.card.forDog','browse.card.waterMany','browse.empty.title','browse.empty.remove','browse.coll.shady.title']){
      expect((dictionary.match(new RegExp(`'${key.replace(/\./g,'\\.')}':`, 'g')) || []).length).toBe(2);
    }
    expect(dictionary).toContain("'browse.empty.title': 'Nessun sentiero corrisponde a questa combinazione'");
    expect(browse).toContain('data-i18n-ph="browse.search.ph"');
    expect(browse).toContain('<span data-i18n="browse.filters.button">Filter trails</span>');
    expect(browse).toContain('data-browse-view="list" aria-pressed="true" data-i18n="browse.view.list">List</button>');
    expect(browse).toContain("bt('browse.compare.count', '{n} of 3 selected', { n: selected.length })");
    expect(browse).toContain("bt('browse.results.ofTotal', '{n} of {total} trails', { n: pool.length, total: trails.length })");
    expect(browse).toContain("bt('browse.card.forDog', 'For {name}', { name: dog.name })");
    // Segment options reuse the homepage vocabulary keys so both panels say the same thing.
    expect(browse).toContain("{ label:bt('hp.filters.rocky', 'Rocky is okay'), v:'rocky' }");
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
    expect(html).toContain('homepage-search.js?v=20261002-1');
    expect(html).toContain('guest-context.js?v=20260917-2');
    expect(read('browse-trails.html')).toContain('guest-context.js?v=20260917-2');
  });
});
