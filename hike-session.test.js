describe('HIKE-01 durable active-hike session', () => {
  let sessionStore;

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsHikeSession;
    require('./hike-session.js');
    sessionStore = window.DoloPawsHikeSession;
    localStorage.clear();
  });

  test('persists the minimum versioned session without GPS history', () => {
    const created = sessionStore.create({
      trailId: 'lago-carezza',
      packageId: 'dolopaws-trail:lago-carezza',
      ownerId: 'user-1',
      startedAt: 1_000,
    });

    expect(created.ok).toBe(true);
    expect(sessionStore.load()).toEqual({
      status: 'ready',
      session: expect.objectContaining({
        schemaVersion: 1,
        trailId: 'lago-carezza',
        packageId: 'dolopaws-trail:lago-carezza',
        ownerId: 'user-1',
        startedAt: 1_000,
        updatedAt: 1_000,
        state: 'active',
        lastProgress: null,
      }),
    });
    expect(localStorage.getItem(sessionStore.STORAGE_KEY)).not.toContain('latitude');
    expect(localStorage.getItem(sessionStore.STORAGE_KEY)).not.toContain('longitude');
    expect(localStorage.getItem(sessionStore.STORAGE_KEY)).not.toContain('history');
  });

  test('replaces only the latest valid progress snapshot', () => {
    let result = sessionStore.create({
      trailId: 'lago-carezza',
      packageId: 'dolopaws-trail:lago-carezza',
      startedAt: 1_000,
    });
    result = sessionStore.updateProgress(result.session, {
      km: 0.2,
      pathIndex: 4,
      accuracyM: 18,
      recordedAt: 2_000,
    });
    result = sessionStore.updateProgress(result.session, {
      km: 0.4,
      pathIndex: 8,
      accuracyM: 22,
      recordedAt: 3_000,
    });

    expect(result.ok).toBe(true);
    expect(sessionStore.load().session.lastProgress).toEqual({
      km: 0.4,
      pathIndex: 8,
      accuracyM: 22,
      recordedAt: 3_000,
    });
  });

  test.each([
    ['invalid JSON', '{', 'corrupt'],
    ['wrong schema', JSON.stringify({ schemaVersion: 99 }), 'incompatible'],
    ['invalid record', JSON.stringify({ schemaVersion: 1 }), 'corrupt'],
  ])('fails safely for %s', (_label, value, status) => {
    localStorage.setItem(sessionStore.STORAGE_KEY, value);
    expect(sessionStore.load()).toEqual({ status, session: null });
  });

  test('storage exceptions do not escape into hike mode', () => {
    const blocked = {
      getItem: jest.fn(() => { throw new Error('blocked'); }),
      setItem: jest.fn(() => { throw new Error('blocked'); }),
      removeItem: jest.fn(() => { throw new Error('blocked'); }),
    };

    expect(sessionStore.create({
      trailId: 'lago-carezza',
      packageId: 'dolopaws-trail:lago-carezza',
      startedAt: 1_000,
    }, blocked)).toMatchObject({ ok: false, error: 'storage-write-failed' });
    expect(sessionStore.load(blocked)).toEqual({ status: 'unavailable', session: null });
    expect(sessionStore.clear(blocked)).toEqual({
      ok: false,
      error: 'storage-write-failed',
    });
  });

  test('persists paused and completion-pending states', () => {
    const created = sessionStore.create({
      trailId: 'lago-carezza',
      packageId: 'dolopaws-trail:lago-carezza',
      startedAt: 1_000,
    });
    const paused = sessionStore.setState(created.session, 'paused', 2_000);
    const completed = sessionStore.setState(paused.session, 'completion-pending', 3_000);

    expect(paused.session.state).toBe('paused');
    expect(completed.session.state).toBe('completion-pending');
    expect(sessionStore.load().session.state).toBe('completion-pending');
  });

  test('loads the session contract before hike mode and wires lifecycle writes', () => {
    const fs = require('fs');
    const path = require('path');
    const page = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const hikeMode = fs.readFileSync(path.join(__dirname, 'hike-mode.js'), 'utf8');

    expect(page.indexOf('hike-session.js')).toBeGreaterThan(-1);
    expect(page.indexOf('hike-session.js')).toBeLessThan(page.indexOf('hike-mode.js'));
    expect(hikeMode).toContain('DoloPawsHikeSession.create');
    expect(hikeMode).toContain('DoloPawsHikeSession.updateProgress');
    expect(hikeMode).toContain("'completion-pending'");
    expect(hikeMode).toContain('if(saved) clearDurableSession()');
  });
});
