const rec = require('./walk-recorder.js');

// ~111m north of the origin per 0.001 lat at this latitude.
const fix = (lat, lng, t, accuracy = 10) => ({ lat, lng, accuracy, timestamp: t });

describe('record-anywhere walk engine', () => {
  const T0 = 1770000000000;

  // A watch with enableHighAccuracy reports every second or two; these use the
  // same cadence so a test never asserts on a stream no phone produces.
  const walkOf = (recorder, steps, startAt = T0, stepMs = 2000) => {
    for(let i = 0; i < steps; i++){
      recorder.addFix(fix(46.5 + i * 0.0001, 11.6, startAt + i * stepMs));
    }
  };

  test('accumulates distance from accepted fixes and formats a journal entry', () => {
    const r = rec.createRecorder();
    r.start(T0);
    r.addFix(fix(46.5000, 11.6000, T0));
    r.addFix(fix(46.5010, 11.6000, T0 + 20e3));
    r.addFix(fix(46.5020, 11.6000, T0 + 40e3));
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
    // An unbroken walk is one stretch, and the flat route is still that stretch.
    expect(summary.segments).toEqual([summary.route]);
    expect(summary.gaps).toBe(0);
    expect(entry.segments).toEqual([entry.route]);
    expect(entry.gaps).toBe(0);
    expect(entry.date).toBe(new Date(T0).toISOString());
  });

  // The fault a real walk showed on 16 October 2026: the phone went into a
  // pocket, the browser froze the page, and the one fix delivered on the way
  // home was joined to the start by a straight line that was then reported as
  // 1.3 km walked.
  test('a phone that goes quiet breaks the walk instead of drawing across it', () => {
    const r = rec.createRecorder();
    r.start(T0);
    walkOf(r, 10);                                   // a real, tracked stretch
    const before = r.distanceM;
    const result = r.addFix(fix(46.5105, 11.6085, T0 + 13 * 60e3));
    expect(result).toEqual({ accepted: true, gap: true });
    // The kilometre between the two fixes was never observed, so it is not
    // counted and not drawn.
    expect(r.distanceM).toBe(before);
    const summary = r.finish(T0 + 14 * 60e3);
    expect(summary.segments.length).toBe(2);
    expect(summary.gaps).toBe(1);
    expect(summary.segments[1]).toEqual([[46.5105, 11.6085]]);
    expect(rec.buildJournalEntry(summary, { now: T0 }).gaps).toBe(1);
  });

  test('an ordinary pause in the stream is not a break', () => {
    const r = rec.createRecorder();
    r.start(T0);
    r.addFix(fix(46.5, 11.6, T0));
    // One timed-out fix retried: 20 s of silence, well inside the threshold.
    r.addFix(fix(46.5010, 11.6, T0 + 20e3));
    const summary = r.finish(T0 + 60e3);
    expect(summary.segments.length).toBe(1);
    expect(summary.gaps).toBe(0);
    expect(summary.distanceM).toBeGreaterThan(100);
  });

  test('a pause is a break in the drawing, not only in the total', () => {
    const r = rec.createRecorder();
    r.start(T0);
    walkOf(r, 5);
    r.pause(T0 + 10 * 60e3);
    r.resume(T0 + 40 * 60e3);
    walkOf(r, 5, T0 + 40 * 60e3);
    const summary = r.finish(T0 + 50 * 60e3);
    expect(summary.segments.length).toBe(2);
    // The flat route is every tracked point, in order, for readers that
    // predate stretches.
    expect(summary.route.length).toBe(
      summary.segments[0].length + summary.segments[1].length
    );
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
    r.addFix(fix(46.601, 11.7, T0 + 40 * 60e3 + 30e3));
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
    r.addFix(fix(46.501, 11.6, T0 + 30e3));
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

  test('a draft written before stretches existed is restored as one stretch', () => {
    const legacy = {
      status:'recording',
      points:[{ lat:46.5, lng:11.6, t:T0 }, { lat:46.501, lng:11.6, t:T0 + 30e3 }],
      distanceM:111, startedAt:T0, segmentStartedAt:T0, elapsedBeforeMs:0,
      savedAt:T0 + 60e3,
    };
    const revived = rec.createRecorder();
    expect(revived.restore(legacy, T0 + 60 * 60e3)).toBe(true);
    expect(revived.pointCount).toBe(2);
    expect(revived.summary(T0 + 60 * 60e3).segments.length).toBe(1);
  });

  test('a restored walk does not join the crash gap to what follows', () => {
    const r = rec.createRecorder();
    r.start(T0);
    walkOf(r, 4);
    const snap = r.snapshot();
    snap.savedAt = T0 + 10e3;
    const revived = rec.createRecorder();
    revived.restore(snap, T0 + 60 * 60e3);
    revived.resume(T0 + 60 * 60e3);
    revived.addFix(fix(46.7, 11.9, T0 + 60 * 60e3));
    const summary = revived.summary(T0 + 60 * 60e3);
    expect(summary.segments.length).toBe(2);
  });
});
