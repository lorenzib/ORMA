describe('HIKE-04 durable hike completions', () => {
  let completions;
  let session;

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsHikeCompletions;
    require('./hike-completions.js');
    completions = window.DoloPawsHikeCompletions;
    localStorage.clear();
    session = {
      schemaVersion: 1,
      sessionId: 'session-1',
      ownerId: 'user-1',
      trailId: 'lago-carezza',
      packageId: 'dolopaws-trail:lago-carezza',
      startedAt: 1_000,
      updatedAt: 1_000,
      state: 'completion-pending',
      lastProgress: null,
    };
  });

  test('persists the complete minimum outcome before follow-up', () => {
    const result = completions.save(session, {
      completedAt: 61_000,
      distanceKm: 1.3,
    });

    expect(result).toMatchObject({
      ok: true,
      created: true,
      record: {
        schemaVersion: 1,
        completionId: 'completion:session-1',
        sessionId: 'session-1',
        ownerId: 'user-1',
        trailId: 'lago-carezza',
        packageId: 'dolopaws-trail:lago-carezza',
        startedAt: 1_000,
        completedAt: 61_000,
        durationSeconds: 60,
        distanceKm: 1.3,
        status: 'completed',
        followUpStatus: 'pending',
        syncStatus: 'pending',
      },
    });
  });

  test('repeated completion is idempotent and does not change the first outcome', () => {
    const first = completions.save(session, {
      completedAt: 61_000,
      distanceKm: 1.3,
    });
    const repeated = completions.save(session, {
      completedAt: 90_000,
      distanceKm: 1.4,
    });

    expect(first.created).toBe(true);
    expect(repeated.created).toBe(false);
    expect(repeated.record.completedAt).toBe(61_000);
    expect(completions.load().store.records).toHaveLength(1);
  });

  test('offline outcomes remain queued for later synchronization', () => {
    completions.save(session, { completedAt: 61_000, distanceKm: 1.3 });
    expect(completions.pending()).toEqual([
      expect.objectContaining({
        completionId: 'completion:session-1',
        syncStatus: 'pending',
      }),
    ]);
  });

  test('journal and discard follow-up states retain the durable completion', () => {
    const saved = completions.save(session, {
      completedAt: 61_000,
      distanceKm: 1.3,
    });
    const journal = completions.markFollowUp(
      saved.record.completionId,
      'journal-saved'
    );
    const discarded = completions.markFollowUp(
      saved.record.completionId,
      'discarded'
    );

    expect(journal.record.followUpStatus).toBe('journal-saved');
    expect(discarded.record.followUpStatus).toBe('discarded');
    expect(completions.load().store.records).toHaveLength(1);
  });

  test.each([
    ['corrupt', '{'],
    ['incompatible', JSON.stringify({ schemaVersion: 99, records: [] })],
  ])('does not overwrite a %s completion store', (status, value) => {
    localStorage.setItem(completions.STORAGE_KEY, value);
    expect(completions.load().status).toBe(status);
    expect(completions.save(session, {
      completedAt: 61_000,
      distanceKm: 1.3,
    })).toMatchObject({ ok: false, error: `${status}-store` });
    expect(localStorage.getItem(completions.STORAGE_KEY)).toBe(value);
  });

  test('storage failures are returned without throwing', () => {
    const blocked = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => { throw new Error('blocked'); }),
    };
    expect(completions.save(session, {
      completedAt: 61_000,
      distanceKm: 1.3,
    }, blocked)).toMatchObject({
      ok: false,
      error: 'storage-write-failed',
      record: null,
    });
  });

  test('online completion is saved before the active session is cleared or navigation begins', () => {
    const fs = require('fs');
    const path = require('path');
    const page = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const hikeMode = fs.readFileSync(path.join(__dirname, 'hike-mode.js'), 'utf8');
    const finishStart = hikeMode.indexOf('function persistCompletionAndShow');
    const finishEnd = hikeMode.indexOf('function finishHike', finishStart);
    const finishFlow = hikeMode.slice(finishStart, finishEnd);

    expect(page.indexOf('hike-completions.js')).toBeGreaterThan(-1);
    expect(page.indexOf('hike-completions.js')).toBeLessThan(page.indexOf('hike-mode.js'));
    expect(finishFlow.indexOf('DoloPawsHikeCompletions.save')).toBeGreaterThan(-1);
    expect(finishFlow.indexOf('DoloPawsHikeCompletions.save'))
      .toBeLessThan(finishFlow.indexOf('clearDurableSession()'));
    expect(hikeMode).toContain('completion.completionId');
    expect(hikeMode).toContain("'journal-saved'");
  });
});
