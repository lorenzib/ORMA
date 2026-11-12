'use strict';

const fs = require('fs');
const path = require('path');
require('./walk-proof.js');
const gpx = require('./gpx-walk.js');
const health = require('./app-health.js');
const { collectAppFiles, APP_HEALTH_TAG } = require('./scripts/build-app');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

// A 3 km trail running east from 46.5, 11.7, and a route walked along it.
const KM_LNG = 1 / (111.32 * Math.cos(46.5 * Math.PI / 180));
const TRAIL = { id: 'ridge', name: 'Ridge walk', valley: 'Val Gardena',
  path: Array.from({ length: 31 }, (_, i) => [46.5, 11.7 + i * 0.1 * KM_LNG]) };
const START = Date.parse('2026-11-08T08:30:00Z');
const NOW = Date.parse('2026-11-10T12:00:00Z');
const route = kmh => Array.from({ length: 151 }, (_, i) => ({
  lat: 46.50005, lng: 11.7 + i * 0.02 * KM_LNG, t: START + i * (0.02 / kmh) * 3600000,
}));
const WALKS = [
  { id: 'A', start: START, end: START + 45 * 60000, metres: 3020, kind: 'hiking', source: 'Apple Watch' },
  { id: 'B', start: START - 86400000, end: START - 86400000 + 30 * 60000, metres: 0, kind: 'walking', source: 'iPhone' },
  { id: 'bad', start: START, end: START - 1 },
];

describe('SOCIAL-06 a walk from Apple Health: the list', () => {
  test('newest first, with distance, time and source; broken records left out', () => {
    const rows = health.walkRows(WALKS, [], { lang: 'en' });
    expect(rows.map(r => r.id)).toEqual(['A', 'B']);
    expect(rows[0]).toMatchObject({ kind: 'Hike', km: '3 km', time: '45 min', source: 'Apple Watch', inJournal: false });
    expect(rows[1]).toMatchObject({ kind: 'Walk', km: '', time: '30 min' });
  });

  test('a walk already in the journal is marked', () => {
    const rows = health.walkRows(WALKS, [{ date: new Date(START + 10 * 60000).toISOString() }]);
    expect(rows.find(r => r.id === 'A').inJournal).toBe(true);
    expect(rows.find(r => r.id === 'B').inJournal).toBe(false);
  });

  test('an empty list says where to allow reading, and names are escaped', () => {
    expect(health.listHtml([])).toContain('Sharing, Apps, ORMA');
    const html = health.listHtml(health.walkRows([{ ...WALKS[0], source: '<b>Watch</b>' }], []));
    expect(html).toContain('&lt;b&gt;Watch&lt;/b&gt;');
    expect(html).toContain('data-id="A"');
  });

  test('the plugin is only looked for inside the iPhone app', () => {
    delete window.Capacitor;
    expect(health.plugin()).toBeNull();
    window.Capacitor = { getPlatform: () => 'web', registerPlugin: () => ({}) };
    expect(health.plugin()).toBeNull();
    const fake = {};
    window.Capacitor = { getPlatform: () => 'ios', registerPlugin: name => (name === 'HealthWalks' ? fake : null) };
    expect(health.plugin()).toBe(fake);
    // Inside the app the pages carry no Capacitor library: only the native bridge.
    const sent = [];
    window.Capacitor = { getPlatform: () => 'ios', nativePromise: (p, m, o) => { sent.push([p, m, o]); return Promise.resolve({ ok: 1 }); } };
    const bridged = health.plugin();
    bridged.getRoute({ id: 'A' });
    bridged.isAvailable();
    expect(sent).toEqual([['HealthWalks', 'getRoute', { id: 'A' }], ['HealthWalks', 'isAvailable', {}]]);
    delete window.Capacitor;
  });
});

describe('SOCIAL-06 a walk from Apple Health: judged like a file', () => {
  test('a route along most of a trail earns the stamp; a ride does not; no route says no GPS', () => {
    const walked = gpx.assessPoints(route(4), [TRAIL], { now: NOW });
    expect(walked).toMatchObject({ ok: true, proven: true, km: 3, minutes: 45 });
    expect(gpx.buildEntry(walked, { id: 'w1', now: NOW }).proof).toBe('gpx');
    expect(gpx.assessPoints(route(25), [TRAIL], { now: NOW }).reason).toBe('too-fast');
    expect(gpx.assessPoints([], [TRAIL], { now: NOW }).reason).toBe('no-gps');
    expect(gpx.assessPoints([{ lat: 'x' }, null], [TRAIL], { now: NOW }).reason).toBe('no-gps');
  });

  test('tapping a walk reads its route and hands the verdict to the journal', async () => {
    document.body.innerHTML = '<div class="jn-gpx-row"><button id="jnGpxBtn"></button></div>';
    const calls = [];
    const plugin = {
      isAvailable: async () => ({ available: true }),
      requestAccess: async () => { calls.push('access'); return { asked: true }; },
      listWalks: async opts => { calls.push(['list', opts]); return { walks: WALKS }; },
      getRoute: async ({ id }) => { calls.push(['route', id]); return { points: route(4) }; },
    };
    const shown = [];
    window.Capacitor = { getPlatform: () => 'ios', registerPlugin: () => plugin };
    window.DoloPawsGpxWalk = gpx;
    window.DoloPawsJournalImport = { trails: () => [TRAIL], entries: () => [], show: (r, s) => shown.push([r, s]) };
    const tick = () => new Promise(r => setTimeout(r, 0));

    health.wire();
    await tick();
    const btn = document.getElementById('appHealthBtn');
    expect(btn.textContent).toBe('Add from Apple Health');
    expect(document.querySelector('.jn-gpx-row').firstChild).toBe(btn);

    btn.click();
    await tick(); await tick();
    expect(calls.slice(0, 2)).toEqual(['access', ['list', { days: 90, limit: 40 }]]);
    const picks = document.querySelectorAll('.app-health-walk');
    expect(picks).toHaveLength(2);

    picks[0].click();
    await tick(); await tick();
    expect(calls).toContainEqual(['route', 'A']);
    expect(shown).toHaveLength(1);
    expect(shown[0][0]).toMatchObject({ proven: true, trail: TRAIL });
    expect(shown[0][1]).toMatchObject({ title: 'Walk from Apple Health', againLabel: 'Choose another walk' });
    expect(typeof shown[0][1].onAgain).toBe('function');
    expect(document.querySelector('.app-health').hidden).toBe(true);
    delete window.Capacitor;
  });

  test('no button when Health is not available on the device', async () => {
    document.body.innerHTML = '<div class="jn-gpx-row"></div>';
    window.Capacitor = { getPlatform: () => 'ios', registerPlugin: () => ({ isAvailable: async () => ({ available: false }) }) };
    health.wire();
    await new Promise(r => setTimeout(r, 0));
    expect(document.getElementById('appHealthBtn')).toBeNull();
    delete window.Capacitor;
  });
});

describe('SOCIAL-06 a walk from Apple Health: wiring', () => {
  test('the app ships the script on its journal page only', () => {
    expect(collectAppFiles().files.has('app-health.js')).toBe(true);
    const build = read('scripts/build-app.js');
    expect(APP_HEALTH_TAG).toBe('<script src="/app-health.js" defer></script>');
    expect(build).toContain("${r === 'journal.html' ? `${APP_HEALTH_TAG}\\n` : ''}");
    expect(read('journal.html')).not.toMatch(/<script[^>]+app-health\.js/); // the website never loads it
  });

  // The journal builds DoloPawsJournalImport in its DOMContentLoaded handler,
  // after this deferred script has run: wiring at once found nothing and the
  // button never appeared.
  test('the script waits for the journal before adding its button', () => {
    const script = read('app-health.js');
    expect(script).toContain("if(wired || !root.DoloPawsJournalImport) return;");
    expect(script).toContain("document.addEventListener('DOMContentLoaded', start);");
    expect(script).toContain("root.addEventListener('load', start);");
    const page = read('journal.html');
    expect(page.indexOf("document.addEventListener('DOMContentLoaded'")).toBeLessThan(page.indexOf('window.DoloPawsJournalImport = {'));
  });

  test('the journal hands its file window to the app', () => {
    const page = read('journal.html');
    expect(page).toContain('window.DoloPawsJournalImport = {');
    expect(page).toContain('if(gpxAgain){ gpxAgain(); return; }');
  });

  test('the native plugin only reads, and is registered on the app’s web view', () => {
    const swift = read('ios/App/App/HealthWalksPlugin.swift');
    expect(swift).toContain('public let jsName = "HealthWalks"');
    expect(swift).toContain('requestAuthorization(toShare: nil, read: readTypes)');
    expect(swift).not.toMatch(/\bstore\.save\b|toShare: \[/);
    expect(read('ios/App/App/AppViewController.swift')).toContain('bridge?.registerPluginInstance(HealthWalksPlugin())');
    expect(read('ios/App/App/SceneDelegate.swift')).toContain('window?.rootViewController = AppViewController()');
    expect(read('ios/App/App/Base.lproj/Main.storyboard')).toContain('customClass="AppViewController" customModule="App"');
  });

  test('the Xcode project builds both files and carries the Health entitlement and the reason shown to the walker', () => {
    const project = read('ios/App/App.xcodeproj/project.pbxproj');
    expect(project).toContain('HealthWalksPlugin.swift in Sources');
    expect(project).toContain('AppViewController.swift in Sources');
    expect(project.split('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;').length - 1).toBe(2);
    expect(read('ios/App/App/App.entitlements')).toContain('<key>com.apple.developer.healthkit</key>');
    const plist = read('ios/App/App/Info.plist');
    expect(plist).toContain('<key>NSHealthShareUsageDescription</key>');
    expect(plist).not.toContain('NSHealthUpdateUsageDescription');
  });

  test('every Apple Health label exists in English and Italian', () => {
    const i18n = read('i18n.js');
    const keys = new Set([...read('app-health.js').matchAll(/label\('(journal\.health\.\w+)'/g)].map(m => m[1]));
    expect(keys.size).toBe(12);
    keys.forEach(key => expect(i18n.split(`'${key}':`).length - 1).toBe(2));
  });
});
