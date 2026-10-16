const store = require('./journal-store.js');
const recorder = require('./walk-recorder.js');

// The fixtures here are built by the code that produces the real thing: a
// recorded walk comes out of the recorder, never out of a hand-typed literal
// that nothing emits.
const fix = (lat, lng, t, accuracy = 10) => ({ lat, lng, accuracy, timestamp: t });
const T0 = 1770000000000;

function recordedWalk({ gap = false } = {}){
  const r = recorder.createRecorder();
  r.start(T0);
  for(let i = 0; i < 12; i++) r.addFix(fix(46.5 + i * 0.0002, 11.6 + i * 0.0001, T0 + i * 2000));
  if(gap){
    r.addFix(fix(46.52, 11.62, T0 + 13 * 60e3));
    for(let i = 1; i < 6; i++) r.addFix(fix(46.52 + i * 0.0002, 11.62, T0 + 13 * 60e3 + i * 2000));
  }
  const summary = r.finish(T0 + 20 * 60e3);
  return recorder.buildJournalEntry(summary, { now: T0 + 20 * 60e3, id: store.newId(T0) });
}

describe('JOURNAL-02 account journal store', () => {
  test('a track survives the round trip to the account and back', () => {
    const entry = recordedWalk({ gap: true });
    const remote = store.toRemote(entry, { now: T0 });
    // Firestore cannot nest arrays, so the track travels as one string.
    expect(typeof remote.track).toBe('string');
    expect(store.fromRemote(remote).segments).toEqual(entry.segments);
    expect(store.fromRemote(remote).route).toEqual(entry.route);
    expect(store.fromRemote(remote).gaps).toBe(entry.gaps);
  });

  test('the break between stretches comes back as a break', () => {
    const entry = recordedWalk({ gap: true });
    expect(entry.segments.length).toBe(2);
    const revived = store.fromRemote(store.toRemote(entry, { now: T0 }));
    expect(revived.segments.length).toBe(2);
    expect(revived.segments[0]).toEqual(entry.segments[0]);
  });

  test('an entry written before stretches existed still reads as one stretch', () => {
    const legacy = { id:'w1', date:new Date(T0).toISOString(), route:[[46.5, 11.6], [46.51, 11.61]] };
    expect(store.entrySegments(legacy)).toEqual([legacy.route]);
    expect(store.fromRemote(store.toRemote(legacy, { now: T0 })).route).toEqual(legacy.route);
  });

  test('the remote shape carries only the fields the Firestore rule allows', () => {
    const remote = store.toRemote(recordedWalk(), { now: T0 });
    expect(Object.keys(remote).sort()).toEqual([
      'cond', 'date', 'dist', 'dur', 'entryId', 'gaps', 'note', 'photo',
      'photos', 'rating', 'recorded', 'region', 'schemaVersion', 'shareToTrail',
      'tale', 'track', 'trail', 'trailId', 'updatedAt',
    ]);
    expect(remote.schemaVersion).toBe(1);
  });

  test('a track too long for the account is cut on a point boundary', () => {
    const long = [[]];
    for(let i = 0; i < 20000; i++) long[0].push([46.5 + i * 0.00001, 11.6]);
    const encoded = store.encodeTrack(long);
    expect(encoded.length).toBeLessThanOrEqual(store.MAX_TRACK_CHARS);
    // Every surviving point still decodes; no half-written coordinate.
    const decoded = store.decodeTrack(encoded);
    expect(decoded[0].length).toBeGreaterThan(1000);
    decoded[0].forEach(point => {
      expect(Number.isFinite(point[0])).toBe(true);
      expect(Number.isFinite(point[1])).toBe(true);
    });
  });

  test('an oversized photo is left on the device rather than refused by the rule', () => {
    const entry = recordedWalk();
    entry.photo = 'data:image/jpeg;base64,' + 'A'.repeat(store.MAX_PHOTO_CHARS);
    expect(store.toRemote(entry, { now: T0 }).photo).toBeNull();
    entry.photo = 'data:image/jpeg;base64,AAAA';
    expect(store.toRemote(entry, { now: T0 }).photo).toBe(entry.photo);
  });

  test('merging two devices keeps every walk and the newer edit of a shared one', () => {
    const here = { id:'w1', date:new Date(T0).toISOString(), note:'edited here', updatedAt:T0 + 500 };
    const there = { id:'w1', date:new Date(T0).toISOString(), note:'older', updatedAt:T0 };
    const onlyThere = { id:'w2', date:new Date(T0 - 86400000).toISOString(), updatedAt:T0 };
    const merged = store.mergeEntries([here], [there, onlyThere]);
    expect(merged.map(entry => entry.id)).toEqual(['w1', 'w2']);
    expect(merged[0].note).toBe('edited here');
  });

  test('an entry the account has not seen, or has an older copy of, is pushed', () => {
    const local = [
      { id:'w1', date:new Date(T0).toISOString(), updatedAt:T0 + 500 },
      { id:'w2', date:new Date(T0).toISOString(), updatedAt:T0 },
      { id:'w3', date:new Date(T0).toISOString(), updatedAt:T0 },
    ];
    const remote = [
      { id:'w1', date:new Date(T0).toISOString(), updatedAt:T0 },
      { id:'w2', date:new Date(T0).toISOString(), updatedAt:T0 },
    ];
    expect(store.entriesToPush(local, remote).map(entry => entry.id)).toEqual(['w1', 'w3']);
    // Once pushed, nothing is sent twice.
    expect(store.entriesToPush(local, local)).toEqual([]);
  });

  test('an entry with no updatedAt falls back to its own date, not to zero', () => {
    const entry = { id:'w1', date:new Date(T0).toISOString() };
    expect(store.entryTimestamp(entry)).toBe(T0);
    expect(store.entriesToPush([entry], [{ id:'w1', date:entry.date }])).toEqual([]);
  });

  test('two walks saved in the same millisecond get different ids', () => {
    const ids = new Set();
    for(let i = 0; i < 200; i++) ids.add(store.newId(T0));
    expect(ids.size).toBe(200);
    // Every id is usable as a Firestore document id.
    ids.forEach(id => expect(id).toMatch(/^[A-Za-z0-9._:-]{1,120}$/));
  });
});
