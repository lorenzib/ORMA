const fs = require('fs');
const path = require('path');
require('./walk-proof.js');
const gpx = require('./gpx-walk.js');
const store = require('./journal-store.js');
const passport = require('./dog-passport.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

// A 3 km trail running east, a point every 100 m, and a second trail nearby.
const KM_LNG = 1 / (111.32 * Math.cos(46.5 * Math.PI / 180));
const line = (lat, lng0, km) => Array.from({ length: km * 10 + 1 }, (_, i) => [lat, lng0 + i * 0.1 * KM_LNG]);
const TRAILS = [
  { id: 'ridge', name: 'Ridge walk', valley: 'Val Gardena', path: line(46.5, 11.7, 3), distance: 3 },
  { id: 'spur', name: 'Short spur', valley: 'Val Gardena', path: line(46.5, 11.7, 1), distance: 1 },
  { id: 'far', name: 'Far away', valley: 'Val di Fassa', path: line(46.4, 11.8, 2), distance: 2 },
];
const START = Date.parse('2026-11-01T09:00:00Z');
const NOW = Date.parse('2026-11-10T12:00:00Z');

// A recorded track along `points`, a fix every 20 m at `kmh`.
function track(points, kmh, options){
  const opts = options || {};
  const fixes = [];
  for(let i = 1; i < points.length; i++){
    for(let s = 0; s < 5; s++){
      const f = s / 5;
      fixes.push([points[i - 1][0] + (points[i][0] - points[i - 1][0]) * f + 0.00005,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * f]);
    }
  }
  fixes.push(points[points.length - 1]);
  const msPerFix = (0.02 / kmh) * 3600000;
  const start = opts.start || START;
  const pts = fixes.map(([lat, lon], i) => opts.noTimes
    ? `<trkpt lat="${lat}" lon="${lon}"><ele>1500</ele></trkpt>`
    : `<trkpt lat="${lat}" lon="${lon}"><ele>1500</ele><time>${new Date(start + i * msPerFix).toISOString()}</time></trkpt>`);
  return `<?xml version="1.0"?><gpx version="1.1" creator="Watch"><trk><name>Morning walk</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
}

describe('SOCIAL-06 a walk from a GPX file', () => {
  test('a recorded walk of most of a trail is matched to it and earns a stamp', () => {
    const r = gpx.assessGpx(track(TRAILS[0].path, 4), TRAILS, { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: true, reason: 'proven' });
    expect(r.trail.id).toBe('ridge');
    expect(r.share).toBeGreaterThan(0.95);
    expect(r.km).toBeCloseTo(3, 0);
    expect(r.minutes).toBeGreaterThanOrEqual(44);
    expect(r.minutes).toBeLessThanOrEqual(46);
    const entry = gpx.buildEntry(r, { id: 'w1', now: NOW });
    expect(entry).toMatchObject({ trailId: 'ridge', trail: 'Ridge walk', region: 'Val Gardena', proof: 'gpx',
      recorded: false, date: new Date(START).toISOString(), dist: '3.0' });
    expect(entry.segments[0].length).toBeGreaterThan(10);
  });

  test('the whole long trail beats the short spur it contains', () => {
    const r = gpx.assessGpx(track(TRAILS[0].path, 4), TRAILS, { now: NOW });
    expect(r.trail.id).toBe('ridge');
    const spurOnly = gpx.assessGpx(track(TRAILS[1].path, 4), TRAILS, { now: NOW });
    expect(spurOnly.trail.id).toBe('spur');
    expect(spurOnly.proven).toBe(true);
  });

  test('half a trail is matched but earns no stamp', () => {
    const r = gpx.assessGpx(track(TRAILS[0].path.slice(0, 16), 4), [TRAILS[0]], { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: false, reason: 'too-little-of-the-route' });
    expect(r.share).toBeGreaterThan(0.4);
    expect(r.share).toBeLessThan(0.75);
    expect('proof' in gpx.buildEntry(r, { id: 'w2', now: NOW })).toBe(false);
  });

  test('a ride at cycling pace is not a walk', () => {
    const r = gpx.assessGpx(track(TRAILS[0].path, 25), TRAILS, { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: false, reason: 'too-fast' });
  });

  test('a planned route has no times, so it is refused', () => {
    expect(gpx.assessGpx(track(TRAILS[0].path, 4, { noTimes: true }), TRAILS, { now: NOW }))
      .toMatchObject({ ok: false, reason: 'no-times' });
  });

  test('somewhere no ORMA trail goes can be kept, without a trail and without a stamp', () => {
    const r = gpx.assessGpx(track(line(45.9, 10.1, 3), 4), TRAILS, { now: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'no-trail', proven: false });
    const entry = gpx.buildEntry(r, { id: 'w3', now: NOW });
    expect(entry).toMatchObject({ trailId: null, trail: 'Morning walk' });
    expect('proof' in entry).toBe(false);
  });

  test('not a GPX file, too short, or in the future', () => {
    expect(gpx.assessGpx('hello', TRAILS, { now: NOW }).reason).toBe('not-gpx');
    expect(gpx.assessGpx('<gpx></gpx>', TRAILS, { now: NOW }).reason).toBe('not-gpx');
    expect(gpx.assessGpx(track(TRAILS[0].path.slice(0, 2), 4), TRAILS, { now: NOW }).reason).toBe('too-few-points');
    expect(gpx.assessGpx(track(TRAILS[0].path, 4, { start: NOW + 86400000 }), TRAILS, { now: NOW }).reason)
      .toBe('in-the-future');
  });

  test('reads single quotes, lon before lat, and route points are ignored', () => {
    const parsed = gpx.parseGpx(`<gpx><rte><rtept lat="1" lon="1"/></rte><trk><trkseg>
      <trkpt lon='11.7' lat='46.5'><time>2026-11-01T09:00:00Z</time></trkpt>
    </trkseg></trk></gpx>`);
    expect(parsed.points).toEqual([{ lat: 46.5, lng: 11.7, t: Date.parse('2026-11-01T09:00:00Z') }]);
  });

  test('the same walk is not added twice', () => {
    const r = gpx.assessGpx(track(TRAILS[0].path, 4), TRAILS, { now: NOW });
    expect(gpx.isDuplicate(r, [{ trailId: 'ridge', date: new Date(START + 10 * 60000).toISOString() }])).toBe(true);
    expect(gpx.isDuplicate(r, [{ trailId: 'ridge', date: new Date(START + 3 * 3600000).toISOString() }])).toBe(false);
    expect(gpx.isDuplicate(r, [{ trailId: 'spur', date: new Date(START).toISOString() }])).toBe(false);
  });
});

describe('a there-and-back is walked twice over the same ground', () => {
  const proof = require('./walk-proof.js');
  const vm = require('vm');
  const KM_LAT = 1 / 110.54;
  const back = points => points.slice(0, -1).reverse();
  // 2 km out east and the same 2 km home: the line overlaps itself.
  const OUT = line(46.6, 11.7, 2);
  const THERE_AND_BACK = { id: 'there-and-back', name: 'To the hut and back', routeShape: 'out-and-back',
    path: OUT.concat(back(OUT)), distance: 4 };
  // A 1 km square, walked round once.
  const SQUARE = (() => {
    const [lat, lng] = [46.7, 11.7];
    const side = () => Array.from({ length: 10 }, (_, i) => i / 10);
    return [].concat(
      side().map(f => [lat, lng + f * KM_LNG]),
      side().map(f => [lat + f * KM_LAT, lng + KM_LNG]),
      side().map(f => [lat + KM_LAT, lng + (1 - f) * KM_LNG]),
      side().map(f => [lat + (1 - f) * KM_LAT, lng]),
      [[lat, lng]]);
  })();
  const LOOP = { id: 'square', name: 'Square loop', routeShape: 'loop', path: SQUARE, distance: 4 };
  // A 3 km stem out to the square, round it, and back down the stem.
  const STEM = line(46.7, 11.7 - 3 * KM_LNG, 3);
  const LOLLIPOP = { id: 'lollipop', name: 'Stem and loop', routeShape: 'lollipop',
    path: STEM.concat(SQUARE.slice(1), back(STEM)), distance: 10 };

  // The same walk judged the old way: every fix on the nearest point of the line.
  function nearestOnlyShare(points, trail){
    const ln = gpx.prepareLine(trail.path);
    let coverage = proof.createCoverage(ln.lengthM);
    // track() puts a fix every 20 m, so thinning (8 m) keeps every one.
    gpx.parseGpx(track(points, 4)).points.forEach(p => {
      coverage = proof.markFix(coverage, gpx.project(ln, p.lat, p.lng));
    });
    return proof.share(coverage);
  }

  test('walked all the way out and all the way home, it earns a pawprint', () => {
    const r = gpx.assessGpx(track(THERE_AND_BACK.path, 4), [THERE_AND_BACK], { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: true, reason: 'proven' });
    expect(r.share).toBeGreaterThan(0.95);
    // The nearest point of the line put the whole way home on the way out.
    expect(nearestOnlyShare(THERE_AND_BACK.path, THERE_AND_BACK)).toBeLessThan(0.55);
  });

  test('walked only halfway out and back again, it does not', () => {
    const halfway = OUT.slice(0, 11);
    const r = gpx.assessGpx(track(halfway.concat(back(halfway)), 4), [THERE_AND_BACK], { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: false, reason: 'too-little-of-the-route' });
    expect(r.share).toBeLessThan(0.6);
  });

  test('walked out only, it does not', () => {
    const r = gpx.assessGpx(track(OUT, 4), [THERE_AND_BACK], { now: NOW });
    expect(r.proven).toBe(false);
    expect(r.share).toBeLessThan(0.55);
  });

  test('a lollipop walked up the stem, round and down again earns a pawprint', () => {
    const r = gpx.assessGpx(track(LOLLIPOP.path, 4), [LOLLIPOP], { now: NOW });
    expect(r.proven).toBe(true);
    expect(r.share).toBeGreaterThan(0.95);
    expect(nearestOnlyShare(LOLLIPOP.path, LOLLIPOP)).toBeLessThan(0.75);
  });

  // Only the stretch at the start and finish, which share one spot, can differ.
  test('a loop is judged as before, apart from the 50 m where it starts and ends', () => {
    const oneStretch = proof.BIN_M / gpx.prepareLine(SQUARE).lengthM + 1e-6;
    const whole = gpx.assessGpx(track(SQUARE, 4), [LOOP], { now: NOW });
    expect(whole.proven).toBe(true);
    // The finish is the start, so the old way put the last fixes at the start.
    expect(whole.share).toBe(1);
    expect(nearestOnlyShare(SQUARE, LOOP)).toBeGreaterThan(0.95);
    const part = SQUARE.slice(0, 25);
    const some = gpx.assessGpx(track(part, 4), [LOOP], { now: NOW });
    expect(some.proven).toBe(false);
    expect(Math.abs(some.share - nearestOnlyShare(part, LOOP))).toBeLessThanOrEqual(oneStretch);
  });

  test('Castello di Botestagno walked along its own line at 4 km/h is proven', () => {
    const sandbox = { window: { trails: [], gondolas: [] } };
    vm.runInNewContext(read('data/regions/dolomites-trails.js'), sandbox);
    const trail = sandbox.window.trails.find(t => t.id === 'cortina-castello-di-botestagno');
    expect(trail.routeShape).toBe('out-and-back');
    const r = gpx.assessGpx(track(trail.path, 4), [trail], { now: NOW });
    expect(r).toMatchObject({ ok: true, proven: true, reason: 'proven' });
    expect(nearestOnlyShare(trail.path, trail)).toBeLessThan(0.6);
  });
});

describe('SOCIAL-06 the gpx mark reaches the account and the passport', () => {
  test('the journal keeps gps and gpx marks and drops anything else', () => {
    const r = gpx.assessGpx(track(TRAILS[0].path, 4), TRAILS, { now: NOW });
    const entry = gpx.buildEntry(r, { id: 'w1770000000000-aa11bb', now: NOW });
    const remote = store.toRemote(entry, { now: NOW });
    expect(remote.proof).toBe('gpx');
    expect(remote.track.split(';').length).toBeGreaterThan(10);
    expect(store.fromRemote(remote).proof).toBe('gpx');
    expect('proof' in store.toRemote({ id: 'x', proof: 'claimed' }, { now: NOW })).toBe(false);
  });

  test('a gpx walk stamps the passport', () => {
    const p = passport.buildPassport([{ id: 'a', trailId: 'ridge', trail: 'Ridge walk', date: '2026-11-01', dist: '3', proof: 'gpx' }], TRAILS);
    expect(p.stamps.map(s => s.trailId)).toEqual(['ridge']);
  });

  test('the database accepts gps or gpx and nothing else; the public tally stays gps only', () => {
    const rules = read('firestore.rules');
    expect(rules).toContain("(!('proof' in data) || data.proof in ['gps', 'gpx'])");
    expect(rules).toContain("request.resource.data.proof in ['gps']");
  });

  test('the journal offers the file and loads what it needs', () => {
    const page = read('journal.html');
    expect(page).toContain('id="jnGpxInput" accept=".gpx,.fit,.tcx');
    expect(page.indexOf('walk-proof.js')).toBeLessThan(page.indexOf('gpx-walk.js'));
    expect(page).toContain('gpx.assessFile(bytes, allTrails(), { now: Date.now() })');
    expect(page).toContain('gpx.isDuplicate(result, state.entries)');
  });

  test('every GPX label exists in English and Italian', () => {
    const i18n = read('i18n.js');
    const keys = new Set([...read('journal.html').matchAll(/'(journal\.gpx\.\w+)'/g), ...read('journal.html').matchAll(/"(journal\.gpx\.\w+)"/g)].map(m => m[1]));
    expect(keys.size).toBeGreaterThan(12);
    keys.forEach(key => expect(i18n.split(`'${key}':`).length - 1).toBe(2));
  });
});
