const { providerOutage } = require('./backoffice/services/provider-outage');

// 65 of 88 blocked jobs carry "OpenAI request failed (429): You have no credits
// remaining". provider-outage.js says an outage tells us nothing about the job
// and must not spend its failure budget, but that guard only protects jobs
// failing from now on. 'blocked' is terminal and putJobIfAbsent will not
// recreate an existing job, so work retired by a past outage stays retired.

describe('the outage rule, applied to jobs it was written too late to save', () => {
  test('the errors that stranded the queue are recognised as outages', () => {
    expect(providerOutage(new Error('OpenAI request failed (429): You have no credits remaining. Add credits'))).toBe(true);
    expect(providerOutage('8 RESOURCE_EXHAUSTED: Quota exceeded.')).toBe(true);
    expect(providerOutage('OpenAI request failed (429): Rate limit reached for gpt-5.6-luna')).toBe(true);
  });

  // The other 23 blocked jobs are blocked for reasons of their own and must stay
  // that way. Requeuing them would relaunch work that already decided it cannot
  // proceed.
  test('a job blocked on its own merits is not an outage', () => {
    expect(providerOutage('route-source-identity-unresolved')).toBe(false);
    expect(providerOutage('The uploaded photo must complete visual preview review before publication approval')).toBe(false);
    expect(providerOutage('Approved text was not found: Heat and coats summary')).toBe(false);
    expect(providerOutage('Could not start the revision agent: spawn codex ENOENT')).toBe(false);
    expect(providerOutage('Unexpected workspace changes prevent editorial publication')).toBe(false);
  });

  test('an empty or missing error is never treated as an outage', () => {
    expect(providerOutage(undefined)).toBe(false);
    expect(providerOutage('')).toBe(false);
    expect(providerOutage(null)).toBe(false);
  });
});

// The store method is exercised against a fake Firestore rather than the
// emulator, because what matters here is which documents it selects and what it
// writes to them.
describe('requeueOutageBlockedJobs', () => {
  const { FirestoreBackofficeStore } = require('./backoffice/services/firestore-backoffice-store');

  function fakeDb(docs){
    const updates = [];
    const batch = { update:(ref, data) => updates.push({ id:ref.id, data }), commit: async () => {} };
    return {
      updates,
      db:{
        batch: () => batch,
        collection: () => ({
          where: () => ({ limit: () => ({ get: async () => ({
            docs: docs.map(d => ({ id:d.id, ref:{ id:d.id }, data: () => d })),
          }) }) }),
        }),
      },
    };
  }

  function storeWith(docs){
    const fake = fakeDb(docs);
    const store = Object.create(FirestoreBackofficeStore.prototype);
    store.db = fake.db;
    store.queryCache = new Map();
    store.artifactCache = new Map();
    return { store, updates: fake.updates };
  }

  test('releases outage-blocked jobs and leaves the rest blocked', async () => {
    const { store, updates } = storeWith([
      { id:'outage-1', status:'blocked', lastError:'OpenAI request failed (429): You have no credits remaining' },
      { id:'own-fault', status:'blocked', lastError:'route-source-identity-unresolved' },
      { id:'outage-2', status:'blocked', lastError:'8 RESOURCE_EXHAUSTED: Quota exceeded.' },
    ]);
    const released = await store.requeueOutageBlockedJobs({ now:new Date('2026-09-07T12:00:00Z') });
    expect(released.sort()).toEqual(['outage-1', 'outage-2']);
    expect(updates.map(u => u.id).sort()).toEqual(['outage-1', 'outage-2']);
  });

  test('a released job gets a fresh budget and keeps its error', async () => {
    const { store, updates } = storeWith([
      { id:'outage-1', status:'blocked', systemFailures:3, lastError:'no credits remaining' },
    ]);
    await store.requeueOutageBlockedJobs({ now:new Date('2026-09-07T12:00:00Z') });
    expect(updates[0].data.status).toBe('queued');
    // The failures were the provider's, not the job's.
    expect(updates[0].data.systemFailures).toBe(0);
    // lastError survives: it is the only record of why the job stalled.
    expect(updates[0].data.lastError).toBeUndefined();
  });

  test('the release is bounded so a backlog drains instead of arriving at once', async () => {
    const many = Array.from({ length:30 }, (_, i) =>
      ({ id:`outage-${i}`, status:'blocked', lastError:'no credits remaining' }));
    const { store } = storeWith(many);
    expect(await store.requeueOutageBlockedJobs({ limit:4 })).toHaveLength(4);
    const { store: unbounded } = storeWith(many);
    expect(await unbounded.requeueOutageBlockedJobs({})).toHaveLength(10);
  });

  test('nothing to release writes nothing', async () => {
    const { store, updates } = storeWith([
      { id:'own-fault', status:'blocked', lastError:'route-source-identity-unresolved' },
    ]);
    expect(await store.requeueOutageBlockedJobs({})).toEqual([]);
    expect(updates).toEqual([]);
  });
});
