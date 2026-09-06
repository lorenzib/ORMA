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

describe('OUT-02 structured community observations', () => {
  const answered = {
    response:'appropriate',
    offLeadObserved:'some_off_lead',
    livestockEncountered:'seen_at_distance',
    crowding:'busy',
    dogEnjoyment:'loved_it',
    reactiveDogFit:'with_care',
    missingRestriction:true,
  };

  test('captures every observation the completion screen asks for', () => {
    const result = outcomes.save(completion, answered, 'user-1', storage(), NOW);

    expect(result.ok).toBe(true);
    expect(result.record).toEqual(expect.objectContaining({
      schemaVersion:2,
      offLeadObserved:'some_off_lead',
      livestockEncountered:'seen_at_distance',
      crowding:'busy',
      dogEnjoyment:'loved_it',
      reactiveDogFit:'with_care',
      missingRestriction:true,
    }));
  });

  test('an unanswered question is stored as null, never as the easy answer', () => {
    const result = outcomes.save(completion, { response:'appropriate' }, 'user-1', storage(), NOW);

    for(const key of outcomes.OBSERVATION_KEYS){
      expect(result.record[key]).toBeNull();
    }
    expect(result.record.missingRestriction).toBeNull();
  });

  test('an unrecognised answer is dropped rather than coerced', () => {
    const result = outcomes.save(completion, {
      response:'appropriate',
      crowding:'heaving',
      livestockEncountered:'',
      missingRestriction:'yes',
    }, 'user-1', storage(), NOW);

    expect(result.record.crowding).toBeNull();
    expect(result.record.livestockEncountered).toBeNull();
    expect(result.record.missingRestriction).toBeNull();
  });

  test('the downloaded package keeps working without the new questions', () => {
    // offline/offline-app.js sends only the schema-1 field set. Its records
    // must stay valid rather than being rejected, so the offline package does
    // not have to be republished for this change.
    const result = outcomes.save(completion, {
      response:'appropriate', waterAccuracy:'accurate', hazards:['water'], offlinePackageUsed:true,
    }, 'user-1', storage(), NOW);

    expect(result.ok).toBe(true);
    expect(result.record.schemaVersion).toBe(2);
    expect(result.record.offlinePackageUsed).toBe(true);
  });

  test('schema 1 check-ins are migrated, not discarded', () => {
    const store = storage();
    store.setItem('dolopaws-post-hike-outcomes-v1', JSON.stringify({
      schemaVersion:1,
      records:[{
        schemaVersion:1, outcomeId:'outcome:old', completionId:'old', ownerId:'user-1',
        trailId:'lago-carezza', response:'appropriate', waterAccuracy:null, hazards:[],
        recordedHikePresent:true, offlinePackageUsed:false, createdAt:1,
        syncStatus:'pending', syncedAt:null, lastError:null,
      }],
    }));

    const result = outcomes.save(completion, answered, 'user-1', store, NOW);
    const kept = outcomes.pending('user-1', store);

    expect(result.ok).toBe(true);
    // The old check-in survives with the new questions simply unanswered.
    expect(kept).toHaveLength(2);
    expect(kept.find(record => record.outcomeId === 'outcome:old').crowding).toBeNull();
  });

  test('the Firestore rule accepts exactly the fields the client writes', () => {
    const rules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');

    expect(rules).toContain('data.schemaVersion == 2');
    for(const key of [...outcomes.OBSERVATION_KEYS, 'missingRestriction']){
      expect(rules).toContain(`'${key}'`);
    }
  });
});

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
