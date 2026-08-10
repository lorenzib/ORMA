const rec = require('./walk-recorder.js');

// ~111m north of the origin per 0.001 lat at this latitude.
const fix = (lat, lng, t, accuracy = 10) => ({ lat, lng, accuracy, timestamp: t });

describe('record-anywhere walk engine', () => {
  const T0 = 1770000000000;

  test('accumulates distance from accepted fixes and formats a journal entry', () => {
    const r = rec.createRecorder();
    r.start(T0);
    r.addFix(fix(46.5000, 11.6000, T0));
    r.addFix(fix(46.5010, 11.6000, T0 + 60e3));
    r.addFix(fix(46.5020, 11.6000, T0 + 120e3));
    const summary = r.finish(T0 + 25 * 60e3);
    expect(summary.distanceM).toBeGreaterThan(200);
    expect(summary.distanceM).toBeLessThan(240);
    expect(summary.durationMs).toBe(25 * 60e3);
    const entry = rec.buildJournalEntry(summary, { now: T0 + 25 * 60e3 });
    expect(entry.dist).toBe('0.2');
    expect(entry.dur).toBe('25');
    expect(entry.trail).toBe('Recorded walk');
    expect(entry.trailId).toBeNull();
    expect(entry.recorded).toBe(true);
    expect(entry.route.length).toBeGreaterThanOrEqual(2);
    expect(entry.date).toBe(new Date(T0).toISOString());
  });

  test('rejects fuzzy fixes, GPS teleports, and standing-still jitter', () => {
    const r = rec.createRecorder();
    r.start(T0);
    r.addFix(fix(46.5, 11.6, T0));
    expect(r.addFix(fix(46.6, 11.6, T0 + 1000, 300)).reason).toBe('accuracy');
    expect(r.addFix(fix(46.6, 11.6, T0 + 1000)).reason).toBe('jump');
    expect(r.addFix(fix(46.500001, 11.6, T0 + 2000)).reason).toBe('jitter');
    expect(r.distanceM).toBe(0);
    expect(r.pointCount).toBe(1);
  });

  test('pause stops the clock and never bridges the gap with distance', () => {
    const r = rec.createRecorder();
    r.start(T0);
    r.addFix(fix(46.5, 11.6, T0));
    r.pause(T0 + 10 * 60e3);
    // Half an hour passes; the dog owner drives elsewhere and resumes.
    r.resume(T0 + 40 * 60e3);
    r.addFix(fix(46.6, 11.7, T0 + 40 * 60e3));
    r.addFix(fix(46.601, 11.7, T0 + 41 * 60e3));
    const summary = r.finish(T0 + 50 * 60e3);
    // 10 minutes before pause + 10 after resume.
    expect(summary.durationMs).toBe(20 * 60e3);
    // Only the post-resume 111m counts; the 15km drive does not.
    expect(summary.distanceM).toBeLessThan(200);
  });

  test('simplifyPath keeps endpoints and drops sub-gap points', () => {
    const dense = [];
    for(let i = 0; i <= 100; i++) dense.push({ lat: 46.5 + i * 0.00002, lng: 11.6 });
    const simple = rec.simplifyPath(dense, 15);
    expect(simple.length).toBeLessThan(dense.length / 4);
    expect(simple[0]).toEqual(dense[0]);
    expect(simple[simple.length - 1]).toEqual(dense[dense.length - 1]);
  });

  test('snapshot and restore recover a crashed walk as paused', () => {
    const r = rec.createRecorder();
    r.start(T0);
    r.addFix(fix(46.5, 11.6, T0));
    r.addFix(fix(46.501, 11.6, T0 + 60e3));
    const snap = r.snapshot();
    snap.savedAt = T0 + 2 * 60e3;

    const revived = rec.createRecorder();
    expect(revived.restore(snap, T0 + 60 * 60e3)).toBe(true);
    expect(revived.status).toBe('paused');
    expect(revived.distanceM).toBeGreaterThan(90);
    // Clock credits time up to the last snapshot, not the crash gap.
    expect(revived.elapsedMs(T0 + 60 * 60e3)).toBe(2 * 60e3);
    revived.resume(T0 + 60 * 60e3);
    expect(revived.status).toBe('recording');
  });
});
