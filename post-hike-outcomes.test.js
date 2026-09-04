const outcomes = require('./post-hike-outcomes');
const fs = require('fs');
const path = require('path');

function storage(){
  const data = new Map();
  return {
    getItem:key => data.has(key) ? data.get(key) : null,
    setItem:(key, value) => data.set(key, String(value)),
    removeItem:key => data.delete(key),
  };
}

const completion = {
  completionId:'completion:session-1',
  ownerId:'user-1',
  trailId:'lago-carezza',
};
const NOW = Date.UTC(2026, 6, 30, 10, 0, 0);

describe('OUT-01 private post-hike outcomes', () => {
  test.each(outcomes.RESPONSES)('accepts structured response %s', response => {
    const store = storage();
    const result = outcomes.save(completion, {
      response,
      waterAccuracy:'accurate',
      hazards:['surface', 'heat'],
      offlinePackageUsed:true,
    }, 'user-1', store, NOW);
    expect(result).toMatchObject({
      ok:true,
      created:true,
      record:{
        response,
        waterAccuracy:'accurate',
        hazards:['surface', 'heat'],
        recordedHikePresent:true,
        offlinePackageUsed:true,
        syncStatus:'pending',
      },
    });
  });

  test('requires an owner and will not cross an existing completion owner', () => {
    const store = storage();
    expect(outcomes.save(completion, { response:'appropriate' }, null, store, NOW))
      .toMatchObject({ ok:false, error:'invalid-outcome' });
    expect(outcomes.save(completion, { response:'appropriate' }, 'other-user', store, NOW))
      .toMatchObject({ ok:false, error:'invalid-outcome' });
  });

  test('filters unsupported optional follow-ups without accepting free text', () => {
    const store = storage();
    const result = outcomes.save(completion, {
      response:'appropriate_with_unexpected_cautions',
      waterAccuracy:'invented',
      hazards:['livestock', 'free-text hazard', 'livestock'],
      note:'must never be stored',
    }, 'user-1', store, NOW);
    expect(result.record.waterAccuracy).toBeNull();
    expect(result.record.hazards).toEqual(['livestock']);
    expect(result.record).not.toHaveProperty('note');
  });

  test('is idempotent per durable completion', () => {
    const store = storage();
    const first = outcomes.save(completion, {
      response:'appropriate',
    }, 'user-1', store, NOW);
    const repeated = outcomes.save(completion, {
      response:'not_appropriate',
    }, 'user-1', store, NOW + 1000);
    expect(first.created).toBe(true);
    expect(repeated.created).toBe(false);
    expect(repeated.record.response).toBe('appropriate');
    expect(outcomes.load(store).store.records).toHaveLength(1);
  });

  test('queues offline with a visible pending state and syncs once', async () => {
    const store = storage();
    outcomes.save(completion, {
      response:'appropriate',
      offlinePackageUsed:true,
    }, 'user-1', store, NOW);
    expect(outcomes.pending('user-1', store)).toEqual([
      expect.objectContaining({ syncStatus:'pending' }),
    ]);
    const sent = [];
    expect(await outcomes.syncPending(
      'user-1',
      async record => {
        sent.push(record.outcomeId);
        return true;
      },
      store,
      NOW + 2000
    )).toEqual({ ok:true, synced:1, pending:0 });
    expect(sent).toEqual(['outcome:completion:session-1']);
    expect(await outcomes.syncPending(
      'user-1',
      async record => sent.push(record.outcomeId),
      store,
      NOW + 3000
    )).toEqual({ ok:true, synced:0, pending:0 });
  });

  test('failed synchronization stays queued for the same owner', async () => {
    const store = storage();
    outcomes.save(completion, {
      response:'did_not_complete',
    }, 'user-1', store, NOW);
    const result = await outcomes.syncPending(
      'user-1',
      async () => false,
      store,
      NOW + 1000
    );
    expect(result).toEqual({
      ok:false,
      error:'sync-failed',
      synced:0,
      pending:1,
    });
    expect(outcomes.pending('other-user', store)).toEqual([]);
    expect(outcomes.pending('user-1', store)[0].lastError).toBe('sync-failed');
  });

  test.each([
    ['corrupt', '{'],
    ['incompatible', JSON.stringify({ schemaVersion:99, records:[] })],
  ])('does not overwrite a %s store', (status, raw) => {
    const store = storage();
    store.setItem(outcomes.STORAGE_KEY, raw);
    expect(outcomes.load(store).status).toBe(status);
    expect(outcomes.save(completion, {
      response:'appropriate',
    }, 'user-1', store, NOW)).toMatchObject({
      ok:false,
      error:`${status}-store`,
    });
    expect(store.getItem(outcomes.STORAGE_KEY)).toBe(raw);
  });

  test('loads the outcome API before the online completion UI', () => {
    const { expectBundledBefore, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');
    expectTrailBundleLoaded();
    expectBundledBefore('post-hike-outcomes.js', 'hike-mode.js');
  });
});
