'use strict';

const fs = require('fs');
const path = require('path');
const { collectAppFiles, APP_WALK_DONE_TAG } = require('./scripts/build-app');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('app-walk-done.js');

// The real stores and route drawing, so the screen is tested against what
// hike mode and the journal actually write and read.
require('./hike-completions.js');
const outcomes = require('./post-hike-outcomes.js');
require('./walk-card.js');

const UID = 'user1';

function seedCompletion(){
  const result = window.DoloPawsHikeCompletions.save({
    schemaVersion: 1, sessionId: 'session-abc123', trailId: 'lago-di-braies',
    packageId: 'pkg-1', ownerId: UID, startedAt: Date.now() - 3600000,
  }, { completedAt: Date.now(), distanceKm: 3.6 });
  return result.record;
}

function setup({ entry, completion = null, user = true, dog = 'Bella' } = {}){
  document.body.className = '';
  document.body.innerHTML = '<div class="jn-overlay" id="jnAfterOverlay" hidden><button id="jnAfterClose"></button></div>';
  document.getElementById('jnAfterClose').addEventListener('click', () => {
    document.getElementById('jnAfterOverlay').hidden = true;
  });
  window.localStorage.setItem(`dolopaws-journal-${UID}`, JSON.stringify([entry]));
  window.localStorage.setItem('dolopaws-profile-summary', JSON.stringify({ name: dog }));
  const search = `?saved=${entry.id}` + (completion ? `&completion=${completion.completionId}` : '');
  window.history.replaceState(null, '', `/journal.html${search}`);
  delete window.__ormaAppWalkDone;
  window.DoloPawsAuth = { currentUser: user ? { uid: UID } : null };
  new Function(source)();
  return document.querySelector('.app-walk-done');
}

const recorded = {
  id: 'w1', date: '2026-11-10T09:04:00.000Z', trailId: null, trail: 'Recorded walk',
  dist: '3.6', dur: '72', recorded: true,
  segments: [[[46.69, 12.08], [46.70, 12.09], [46.71, 12.08], [46.69, 12.08]]],
};
const onTrail = {
  id: 'w2', date: '2026-11-10T09:04:00.000Z', trailId: 'lago-di-braies',
  trail: 'Lago di Braies loop', dist: '3.6', dur: '72', proof: 'gps',
};

beforeEach(() => {
  window.localStorage.clear();
  delete window.trails;
  window.DoloPawsPostHikeOutcomes = { ...outcomes, syncBrowser: jest.fn(() => Promise.resolve({ ok: true })) };
});

describe('the app Walk finished screen', () => {
  test('a recorded walk: the line walked, three numbers, a photo, Done', () => {
    const screen = setup({ entry: recorded });
    expect(document.body.classList.contains('app-walk-done-open')).toBe(true);
    expect(screen.querySelector('.app-walk-done-title').textContent).toBe('Nice walk, Bella!');
    // Named by when it was: start and end time.
    expect(screen.querySelector('.app-walk-done-sub').textContent).toMatch(/^\S.*–.*\S$/);
    expect(screen.querySelector('.app-walk-done-map path').getAttribute('d')).toMatch(/^M[\d. L]+$/);
    const stats = [...screen.querySelectorAll('.app-walk-done-stats b')].map(node => node.textContent);
    expect(stats).toEqual(['1:12', '3.6 km', '20:00']);
    // No trail, so nothing to ask about it.
    expect(screen.querySelector('.app-walk-done-ask')).toBeNull();
    expect(screen.querySelector('[data-go="more"]')).toBeNull();
    expect(screen.querySelector('[data-go="photo"]')).not.toBeNull();
  });

  test('a trail walk names the trail and the GPS proof, and asks the question', () => {
    const completion = seedCompletion();
    const screen = setup({ entry: onTrail, completion });
    expect(screen.querySelector('.app-walk-done-sub').textContent).toBe('Lago di Braies loop · GPS confirms the route');
    // No line of its own until the trails arrive; then the trail's line.
    expect(screen.querySelector('.app-walk-done-map')).toBeNull();
    window.trails = [{ id: 'lago-di-braies', path: [[46.69, 12.08], [46.70, 12.09], [46.71, 12.08]] }];
    window.dispatchEvent(new Event('dolopaws-region-loaded'));
    expect(screen.querySelector('.app-walk-done-sub + .app-walk-done-map path')).not.toBeNull();
    expect(screen.querySelector('.app-walk-done-question').textContent).toBe('Did it suit Bella?');
    expect(screen.querySelectorAll('[data-answer]')).toHaveLength(3);
  });

  test('Done saves the private answer and the detail answers once', () => {
    const completion = seedCompletion();
    const screen = setup({ entry: onTrail, completion });
    screen.querySelector('[data-answer="appropriate_with_unexpected_cautions"]').click();
    screen.querySelector('[data-go="more"]').click();
    expect(screen.querySelectorAll('[data-answer]')).toHaveLength(5);
    screen.querySelector('[data-detail="crowding"]').value = 'busy';
    screen.querySelector('[data-hazard][value="livestock"]').checked = true;
    screen.querySelector('[data-go="done"]').click();
    const saved = outcomes.load().store.records;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      completionId: completion.completionId, trailId: 'lago-di-braies', ownerId: UID,
      response: 'appropriate_with_unexpected_cautions', crowding: 'busy', hazards: ['livestock'],
      waterAccuracy: null, missingRestriction: null,
    });
    expect(window.DoloPawsPostHikeOutcomes.syncBrowser).toHaveBeenCalled();
    expect(document.querySelector('.app-walk-done')).toBeNull();
  });

  test('no answer, nothing written', () => {
    const completion = seedCompletion();
    const screen = setup({ entry: onTrail, completion });
    screen.querySelector('[data-go="done"]').click();
    expect(outcomes.load().store.records).toHaveLength(0);
  });

  test('Add a photo uncovers the journal sheet; Done closes it', () => {
    let screen = setup({ entry: recorded });
    screen.querySelector('[data-go="photo"]').click();
    expect(document.querySelector('.app-walk-done')).toBeNull();
    expect(document.body.classList.contains('app-walk-done-open')).toBe(false);

    screen = setup({ entry: recorded });
    document.getElementById('jnAfterOverlay').hidden = false;
    screen.querySelector('[data-go="done"]').click();
    expect(document.getElementById('jnAfterOverlay').hidden).toBe(true);
  });

  test('Done also closes a journal sheet that opens a moment later', async () => {
    const screen = setup({ entry: recorded });
    screen.querySelector('[data-go="done"]').click();
    document.getElementById('jnAfterOverlay').hidden = false;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.getElementById('jnAfterOverlay').hidden).toBe(true);
  });

  test('takes the dog name from the account when the phone has none', async () => {
    const completion = seedCompletion();
    const screen = setup({ entry: onTrail, completion, dog: '' });
    expect(screen.querySelector('.app-walk-done-title').textContent).toBe('Nice walk!');
    expect(screen.querySelector('.app-walk-done-question').textContent).toBe('Did it suit your dog?');
    window.DoloPawsAuth.getDogProfile = () => Promise.resolve({ name: 'Rex' });
    delete window.__ormaAppWalkDone;
    document.body.innerHTML = '';
    new Function(source)();
    await new Promise(resolve => setTimeout(resolve, 0));
    const again = document.querySelector('.app-walk-done');
    expect(again.querySelector('.app-walk-done-title').textContent).toBe('Nice walk, Rex!');
    expect(again.querySelector('.app-walk-done-question').textContent).toBe('Did it suit Rex?');
    expect(again.querySelector('label[for="awd-dogEnjoyment"]').textContent).toContain('Did Rex enjoy it?');
  });

  test('waits for sign-in, and shows nothing without a saved walk', () => {
    expect(setup({ entry: recorded, user: false })).toBeNull();
    window.DoloPawsAuth.currentUser = { uid: UID };
    window.dispatchEvent(new Event('dolopaws-auth-ready'));
    expect(document.querySelector('.app-walk-done')).not.toBeNull();

    window.history.replaceState(null, '', '/journal.html');
    delete window.__ormaAppWalkDone;
    document.body.innerHTML = '';
    new Function(source)();
    expect(document.querySelector('.app-walk-done')).toBeNull();
  });
});

describe('Walk finished is wired into the app only', () => {
  test('ships on the app journal.html with the stores it needs, never on the website', () => {
    expect(APP_WALK_DONE_TAG).toContain('<script src="/app-walk-done.js" defer></script>');
    expect(APP_WALK_DONE_TAG).toContain('<script src="/hike-completions.js" defer></script>');
    expect(APP_WALK_DONE_TAG).toContain('<script src="/post-hike-outcomes.js" defer></script>');
    const files = collectAppFiles().files;
    ['app-walk-done.js', 'hike-completions.js', 'post-hike-outcomes.js'].forEach(file => expect(files.has(file)).toBe(true));
    expect(read('scripts/build-app.js')).toContain("${r === 'journal.html' ? `${APP_WALK_DONE_TAG}\\n` : ''}");
    expect(read('_config.yml')).toMatch(/^\s+- app-walk-done\.js$/m);
    expect(read('journal.html')).not.toContain('app-walk-done.js');
  });

  test('hike mode hands a saved walk to this screen in the app only', () => {
    const hike = read('hike-mode.js');
    expect(hike).toContain("if(savedEntryId && document.documentElement.classList.contains('orma-app')){");
    expect(hike).toContain('`journal.html?saved=${encodeURIComponent(savedEntryId)}&completion=${encodeURIComponent(completion.completionId)}`');
    expect(read('trail-app.bundle.js')).toContain("document.documentElement.classList.contains('orma-app')");
  });

  test('sits above the tab bar and hides the journal sheet until asked', () => {
    const shell = read('app-shell.css');
    const layer = Number(shell.match(/\.app-walk-done\{[^}]*z-index:(\d+)/)[1]);
    const tabbar = Number(shell.match(/\.app-tabbar\{[^}]*z-index:(\d+)/)[1]);
    expect(layer).toBeGreaterThan(tabbar);
    expect(shell).toContain('html.orma-app body.app-walk-done-open #jnAfterOverlay{display:none !important;}');
  });
});
