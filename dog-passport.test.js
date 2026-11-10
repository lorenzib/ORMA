const fs = require('fs');
const path = require('path');
const passport = require('./dog-passport.js');
const store = require('./journal-store.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

const TRAILS = [
  { id: 'carezza', name: 'Lago di Carezza Loop', valley: 'Val di Fassa', elevation: 120, rifugi: [],
    path: [[46.41, 11.57], [46.412, 11.575], [46.409, 11.578], [46.41, 11.57]] },
  { id: 'fuciade', name: 'Rifugio Fuciade', valley: 'Val di Fassa', elevation: 300, rifugi: [{ name: 'Fuciade' }],
    path: [[46.4, 11.8], [46.41, 11.82]], distance: 7.5 },
  { id: 'seceda', name: 'Seceda ridge', valley: 'Val Gardena', elevation: 500, rifugi: [], path: [] },
  { id: 'other', name: 'Somewhere', valley: 'Val di Fassa', elevation: 10, rifugi: [], distance: 3.2 },
];

function walk(id, trailId, date, extra){
  return Object.assign({ id, trailId, trail: trailId, date, dist: '4.0', proof: 'gps' }, extra);
}

describe('SOCIAL-05 dog passport', () => {
  test('only walks the GPS proved earn a stamp', () => {
    const p = passport.buildPassport([
      walk('a', 'carezza', '2026-10-12'),
      walk('b', 'seceda', '2026-10-13', { proof: undefined }),
      walk('c', 'fuciade', '2026-10-14', { proof: 'checkin' }),
      { id: 'd', trail: 'Logged by hand', date: '2026-10-15', dist: '9' },
    ], TRAILS);
    expect(p.stamps.map(s => s.trailId)).toEqual(['carezza']);
    expect(p.totals).toEqual({ walks: 1, stamps: 1, valleys: 1, km: 4, climb: 120 });
  });

  test('walking a trail again adds to its stamp instead of a new one', () => {
    const p = passport.buildPassport([
      walk('b', 'carezza', '2026-11-01'),
      walk('a', 'carezza', '2026-10-12'),
      walk('c', 'fuciade', '2026-10-20'),
    ], TRAILS);
    expect(p.stamps).toHaveLength(2);
    expect(p.stamps[0].dates).toEqual(['2026-10-12', '2026-11-01']);
    expect(p.totals.walks).toBe(3);
    expect(p.totals.climb).toBe(540);
  });

  test('valley visas count against the whole catalogue, in the order the dog entered them', () => {
    const p = passport.buildPassport([walk('b', 'seceda', '2026-10-13'), walk('a', 'carezza', '2026-10-12')], TRAILS);
    expect(p.valleys.map(v => [v.name, v.done, v.total, v.firstDate])).toEqual([
      ['Val di Fassa', 1, 3, '2026-10-12'],
      ['Val Gardena', 1, 1, '2026-10-13'],
    ]);
    expect(p.since).toBe('2026-10-12');
  });

  test('a valley lists what is walked first, then the rest shortest first', () => {
    const p = passport.buildPassport([walk('a', 'carezza', '2026-10-12')], TRAILS);
    const fassa = p.valleys.find(v => v.name === 'Val di Fassa');
    expect(fassa.trails.map(tr => [tr.id, tr.walked])).toEqual([
      ['carezza', true], ['other', false], ['fuciade', false],
    ]);
    expect(fassa.trails[0].lastDate).toBe('2026-10-12');
  });

  test('milestones: first walk, a lake, a hut, 10 walks, 100 km', () => {
    const p = passport.buildPassport([walk('a', 'carezza', '2026-10-12'), walk('b', 'fuciade', '2026-10-13')], TRAILS);
    const byId = Object.fromEntries(p.milestones.map(m => [m.id, m]));
    expect(byId.first.done).toBe(true);
    expect(byId.lakes).toMatchObject({ have: 1, done: true });
    expect(byId.huts).toMatchObject({ have: 1, done: true });
    expect(byId.walks).toMatchObject({ have: 2, target: 10, done: false });
    expect(byId.km).toMatchObject({ have: 8, target: 100, done: false });
  });

  test('a walk on a trail no longer in the catalogue still stamps, by name', () => {
    const p = passport.buildPassport([walk('a', 'gone', '2026-10-12', { trail: 'Lac Vert', region: 'Aravis' })], TRAILS);
    expect(p.stamps[0]).toMatchObject({ name: 'Lac Vert', valley: 'Aravis', lake: true, path: [] });
    expect(p.valleys).toEqual([]);
  });

  test('lakes are read from the trail name in Italian, French and German', () => {
    ['Lago di Braies', 'Laghi di Fusine', 'Lac Blanc', 'Lacs du Chardonnet', 'Pragser Wildsee', 'Rundweg Montiggler Seen']
      .forEach(name => expect(passport.isLake({ name })).toBe(true));
    ['Seeweg circuit', 'Seceda ridge', 'Col Raiser'].forEach(name => expect(passport.isLake({ name })).toBe(false));
  });

  test('the stamp outline keeps the route inside its box', () => {
    const d = passport.outlinePath(TRAILS[0].path, 44);
    expect(d.startsWith('M')).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
    nums.forEach(n => { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(44); });
    expect(passport.outlinePath([], 44)).toBe('');
    const long = Array.from({ length: 500 }, (_, i) => [46 + i / 1000, 11 + Math.sin(i / 20) / 100]);
    expect(passport.outlinePath(long, 44).split('L').length).toBeLessThanOrEqual(62);
  });

  test('the passport renders names safely and says how to earn a stamp', () => {
    const t = (key, vars) => key + (vars ? JSON.stringify(vars) : '');
    const empty = passport.renderPassport(passport.buildPassport([], TRAILS), { t, dogName: 'Bruno' });
    expect(empty).toContain('journal.passport.titleFor{&quot;name&quot;:&quot;Bruno&quot;}');
    expect(empty).not.toContain('jp-sum');
    expect(empty).toContain('journal.passport.empty');
    expect(empty).toContain('href="browse-trails.html"');
    const html = passport.renderPassport(passport.buildPassport([
      walk('a', 'gone', '2026-10-12', { trail: '<img src=x onerror=alert(1)>' }),
    ], TRAILS), { t });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('journal.passport.empty');
    const order = passport.renderPassport(passport.buildPassport([
      walk('a', 'carezza', '2026-10-01'), walk('b', 'fuciade', '2026-10-05'), walk('c', 'carezza', '2026-10-09'),
    ], TRAILS), { t });
    expect(order.indexOf('Lago di Carezza')).toBeLessThan(order.indexOf('Rifugio Fuciade'));
    expect(order).toContain('journal.passport.toGo{&quot;n&quot;:&quot;88&quot;}');
  });
});

describe('SOCIAL-05 passport front page and valley list', () => {
  const t = (key, vars) => key + (vars ? JSON.stringify(vars) : '');
  const many = Array.from({ length: 14 }, (_, i) => ({
    id: 'g' + i, name: 'Gardena walk ' + i, valley: 'Val Gardena', distance: 14 - i, path: [],
  }));

  test('the ID page shows the dog, its breed and its first stamp, and only a real image as the photo', () => {
    const p = passport.buildPassport([walk('a', 'carezza', '2026-10-12')], TRAILS);
    const html = passport.renderPassport(p, { t, dogName: 'Luna', dogBreed: 'Border collie', dogPhoto: 'data:image/jpeg;base64,AAAA' });
    expect(html).toContain('class="jp-id"');
    expect(html).toContain('<img class="jp-photo" src="data:image/jpeg;base64,AAAA"');
    expect(html).toContain('<dd>Border collie</dd>');
    expect(html).toContain('journal.passport.idSince');
    const evil = passport.renderPassport(p, { t, dogName: 'Luna', dogPhoto: 'javascript:alert(1)' });
    expect(evil).not.toContain('<img');
    expect(evil).toContain('jp-photo-empty');
    expect(evil).not.toContain('journal.passport.idBreed');
  });

  test('visas are buttons, closed until one is opened', () => {
    const p = passport.buildPassport([walk('a', 'carezza', '2026-10-12')], TRAILS);
    const closed = passport.renderPassport(p, { t });
    expect(closed).toContain('data-valley="Val di Fassa" aria-expanded="false"');
    expect(closed).not.toContain('jp-valley"');
    const open = passport.renderPassport(p, { t, openValley: 'Val di Fassa' });
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('class="jp-slot is-walked"');
    expect(open.match(/class="jp-slot"/g)).toHaveLength(2);
  });

  test('a big valley shows eight blanks and folds the rest away', () => {
    const p = passport.buildPassport([walk('a', 'g0', '2026-10-12')], many);
    const html = passport.renderPassport(p, { t, openValley: 'Val Gardena' });
    expect(html).toContain('journal.passport.showRest{&quot;n&quot;:&quot;5&quot;}');
    expect(html.match(/class="jp-slot"/g)).toHaveLength(13);
    expect(html.indexOf('Gardena walk 13')).toBeLessThan(html.indexOf('Gardena walk 1<'));
    const done = passport.buildPassport(many.map((tr, i) => walk('w' + i, tr.id, '2026-10-' + String(10 + i))), many);
    expect(passport.renderPassport(done, { t, openValley: 'Val Gardena' })).toContain('journal.passport.allDone');
  });

  test('the journal opens a valley when its visa is tapped', () => {
    const page = read('journal.html');
    expect(page).toContain("ev.target.closest('.jp-visa')");
    expect(page).toContain('openValley: passportValley,');
    expect(page).toContain('dogBreed = p.breed');
  });
});

describe('SOCIAL-05 the proof reaches the journal', () => {
  test('hike mode marks a GPS-proven walk, and only that one', () => {
    const hike = read('hike-mode.js');
    expect(hike).toContain("...(proof && proof.proof === 'gps' ? { proof: 'gps' } : {}),");
  });

  test('the journal keeps the mark when it syncs to the account', () => {
    const entry = { id: 'w1', date: '2026-10-12', trail: 'Carezza', trailId: 'carezza', proof: 'gps' };
    const remote = store.toRemote(entry, { now: 1 });
    expect(remote.proof).toBe('gps');
    expect(store.fromRemote(remote).proof).toBe('gps');
    expect('proof' in store.toRemote({ id: 'w2', proof: 'claimed' }, { now: 1 })).toBe(false);
    expect(store.fromRemote(store.toRemote({ id: 'w3' }, { now: 1 })).proof).toBeNull();
  });

  test('the journal page loads the passport and draws it with the walks', () => {
    const page = read('journal.html');
    expect(page).toContain('<section class="jp" id="jnPassport"');
    expect(page.indexOf('dog-passport.js')).toBeGreaterThan(-1);
    expect(page).toContain('function renderAll(){ renderStats(); renderPassport(); renderTimeline(); }');
  });

  test('every passport label exists in English and Italian', () => {
    const i18n = read('i18n.js');
    const keys = new Set([...read('dog-passport.js').matchAll(/'(journal\.passport\.[\w.]+)'/g)].map(m => m[1]));
    ['first', 'walks', 'km'].forEach(id => { keys.delete('journal.passport.mile.'); keys.add('journal.passport.mile.' + id); });
    expect(keys.size).toBeGreaterThan(15);
    keys.forEach(key => expect(i18n.split(`'${key}':`).length - 1).toBe(2));
  });
});
