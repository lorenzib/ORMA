'use strict';

const {
  ARTIFACT_DATA_ENCODING,
  encodeArtifactData,
  decodeArtifactData,
  COLLECTIONS,
  FirestoreBackofficeStore,
} = require('./services/firestore-backoffice-store');

describe('Firestore backoffice artifact encoding', () => {
  const dossierWithTrailCoordinates = {
    candidateId:'osm-16322228',
    specialistOutputs:[{
      agentId:'cartographer',
      result:{geometry:{type:'LineString',coordinates:[[5.97,45.55],[5.98,45.56]]}},
    }],
  };

  test('serializes nested trail-coordinate arrays into a Firestore-safe string', () => {
    const encoded = encodeArtifactData(dossierWithTrailCoordinates);

    expect(encoded.dataEncoding).toBe(ARTIFACT_DATA_ENCODING);
    expect(typeof encoded.data).toBe('string');
    expect(decodeArtifactData(encoded)).toEqual(dossierWithTrailCoordinates);
  });

  test('continues to read artifacts written before JSON encoding was introduced', () => {
    expect(decodeArtifactData({data:dossierWithTrailCoordinates})).toEqual(dossierWithTrailCoordinates);
    expect(decodeArtifactData(null)).toBeNull();
  });

  test('rejects values that cannot be represented in JSON', () => {
    expect(() => encodeArtifactData(undefined)).toThrow('must be JSON-serializable');
  });

  test('memoizes repeated artifact and review reads during one worker pass and invalidates after writes',async()=>{
    let artifactReads=0;let reviewReads=0;
    const db={settings:jest.fn(),collection:name=>({
      doc:()=>({
        get:async()=>{artifactReads+=1;return {exists:true,data:()=>encodeArtifactData({value:'current'})};},
        set:async()=>{},update:async()=>{},
      }),
      where:()=>({get:async()=>{reviewReads+=1;return {docs:[{id:'review-1',data:()=>({status:'queued'})}]};}}),
    })};
    const store=new FirestoreBackofficeStore({db});
    expect(await store.getArtifact('trail-orchestration')).toEqual({value:'current'});
    expect(await store.getArtifact('trail-orchestration')).toEqual({value:'current'});
    expect(artifactReads).toBe(1);
    await store.setArtifact('trail-orchestration',{value:'updated'});
    expect(await store.getArtifact('trail-orchestration')).toEqual({value:'updated'});
    expect(artifactReads).toBe(1);
    expect(await store.listHazardReviews('queued')).toHaveLength(1);
    expect(await store.listHazardReviews('queued')).toHaveLength(1);
    expect(reviewReads).toBe(1);
    await store.markHazardReview('review-1','processed');
    await store.listHazardReviews('queued');
    expect(reviewReads).toBe(2);
    expect(COLLECTIONS.hazardReviews).toBe('backofficeHazardReviews');
  });
});

// The worker submits a decision and applies it in the same pass, deliberately:
// "a gate dispatched after it would wait for the next cron, three hours later."
// dispatchUnansweredGates lists the queued decisions first, to avoid dispatching
// over one already waiting, which populates the review query cache -- so if
// submitting does not invalidate that cache, the apply step a few lines later
// reads the pre-submit list and the decision sits until the next pass. Both
// submit paths invalidated a prefix that never matched the cache key, so a live
// dispatch produced `"dossierReviews": []` in the same run that wrote it.
describe('a decision submitted in a pass is visible to that pass',()=>{
  function storeWithQueue(collectionName){
    let reviewReads=0;const added=[];
    const db={settings:jest.fn(),collection:name=>({
      doc:()=>({get:async()=>({exists:false,data:()=>null}),set:async()=>{},update:async()=>{}}),
      add:async doc=>{const id=`decision-${added.length+1}`;added.push({id,...doc});return {id};},
      where:()=>({get:async()=>{
        reviewReads+=1;
        return {docs:added.filter(doc=>doc.status==='queued').map(doc=>({id:doc.id,data:()=>doc}))};
      }}),
    })};
    return {store:new FirestoreBackofficeStore({db}),reads:()=>reviewReads,collectionName};
  }

  test('a dispatched dossier revision is applied in the same pass that wrote it',async()=>{
    const {store,reads}=storeWithQueue(COLLECTIONS.dossierReviews);
    // What dispatchUnansweredGates does first: nothing is waiting yet.
    expect(await store.listDossierReviews('queued')).toEqual([]);
    const written=await store.submitDossierReview({reviewId:'review-a',candidateId:'cand-a',
      action:'request-revision',targetAgent:'terrainPoi',note:'ORMA automation',
      submittedBy:'orma-gate-dispatch-v1'});
    expect(written.status).toBe('queued');
    // What ingestDossierReviews does next, a few lines later in the same pass.
    const queued=await store.listDossierReviews('queued');
    expect(queued).toHaveLength(1);
    expect(queued[0]).toEqual(expect.objectContaining({reviewId:'review-a',action:'request-revision',
      targetAgent:'terrainPoi',status:'queued'}));
    // Re-read, so the fix is an invalidation and not a disabled cache.
    expect(await store.listDossierReviews('queued')).toHaveLength(1);
    expect(reads()).toBe(2);
  });

  test('a submitted route review is visible to the same pass too',async()=>{
    const {store}=storeWithQueue(COLLECTIONS.routeReviews);
    expect(await store.listRouteReviews('queued')).toEqual([]);
    await store.submitRouteReview({candidateId:'cand-a',action:'choose',proposalIds:['p1']});
    expect(await store.listRouteReviews('queued')).toHaveLength(1);
  });
});

/**
 * getJobsByIds was the pass's largest read and the only one with no cache.
 * advanceTrailOrchestration asks for every job each trail has ever had, twice
 * per pass, and `trail.jobIds` is append-only — so the cost grew with every job
 * ever created. The first metered drain (run 37609185393) put a pass at 2,304
 * reads to do ten jobs of work, stopping on the read budget rather than on an
 * empty queue.
 *
 * A cache of job documents is only safe if a write can never leave a stale copy
 * behind, so these tests are about eviction far more than about the hit.
 */
describe('job documents are read once per pass unless they change', () => {
  function jobStore(seed = {}) {
    const docs = new Map(Object.entries(seed));
    let reads = 0;
    const docRef = id => ({
      id,
      get: async () => { reads += 1; return snapshotOf(id); },
      set: async () => {}, update: async () => {},
    });
    const snapshotOf = id => ({
      id, exists: docs.has(id), ref: docRef(id), data: () => docs.get(id),
    });
    const db = {
      settings: jest.fn(),
      collection: () => ({ doc: docRef, where: () => ({ get: async () => ({ docs: [] }) }) }),
      getAll: async (...refs) => { reads += refs.length; return refs.map(ref => snapshotOf(ref.id)); },
      batch: () => ({ update: () => {}, commit: async () => {} }),
      runTransaction: async fn => fn({
        get: async ref => { reads += 1; return snapshotOf(ref.id); },
        set: () => {}, update: () => {},
      }),
    };
    return { store: new FirestoreBackofficeStore({ db }), reads: () => reads, docs };
  }

  const seed = {
    'job-1': { status: 'completed', agentId: 'cartographer', createdAt: '2026-10-01T00:00:00.000Z' },
    'job-2': { status: 'queued', agentId: 'logistics', createdAt: '2026-10-02T00:00:00.000Z' },
  };

  test('the second walk over the same ids costs nothing', async () => {
    const { store, reads } = jobStore(seed);

    expect(await store.getJobsByIds(['job-1', 'job-2'])).toHaveLength(2);
    expect(reads()).toBe(2);

    // What the worker does: advanceTrailOrchestration, then again after the
    // specialist batch, over very nearly the same id list.
    expect(await store.getJobsByIds(['job-1', 'job-2'])).toHaveLength(2);
    expect(reads()).toBe(2);
  });

  test('only the ids it has not seen are fetched', async () => {
    const { store, reads, docs } = jobStore(seed);
    await store.getJobsByIds(['job-1']);
    expect(reads()).toBe(1);

    docs.set('job-3', { status: 'queued', agentId: 'redTeam', createdAt: '2026-10-03T00:00:00.000Z' });
    const jobs = await store.getJobsByIds(['job-1', 'job-2', 'job-3']);
    expect(reads()).toBe(3);
    expect(jobs.map(job => job.id)).toEqual(['job-1', 'job-2', 'job-3']);
  });

  test('a missing id is not remembered as missing, so it can be created later', async () => {
    const { store, reads, docs } = jobStore(seed);
    expect(await store.getJobsByIds(['job-absent'])).toEqual([]);
    expect(reads()).toBe(1);

    docs.set('job-absent', { status: 'queued', agentId: 'logistics', createdAt: '2026-10-04T00:00:00.000Z' });
    expect(await store.getJobsByIds(['job-absent'])).toHaveLength(1);
    expect(reads()).toBe(2);
  });

  // The whole safety argument: each of these writes a job, and each must leave
  // the cache unable to answer for it.
  const writes = [
    ['putJob', store => store.putJob({ id: 'job-1', status: 'queued' })],
    ['putJobIfAbsent', store => store.putJobIfAbsent({ id: 'job-1', status: 'queued' })],
    ['claimJob', store => store.claimJob('job-1', 'worker-a')],
    ['completeJob', store => store.completeJob('job-1')],
    ['completeSystemJob', store => store.completeSystemJob('job-1')],
    ['markJobReviewed', store => store.markJobReviewed('job-1', 'approve', '2026-10-07T00:00:00.000Z')],
    ['failJob', store => store.failJob('job-1', new Error('nope'))],
    ['requeueBlockedJobsMatching', store => store.requeueBlockedJobsMatching(['job-1'])],
  ];

  // Asserted on the cache directly rather than by counting reads: putJobIfAbsent
  // and claimJob read the document inside their transaction, so a read-count
  // assertion passes for them even with eviction removed.
  test.each(writes)('%s leaves no cached copy of the job it wrote', async (_name, write) => {
    const { store, reads } = jobStore(seed);
    await store.getJobsByIds(['job-1']);
    expect(store.jobCache.has('job-1')).toBe(true);

    await write(store);

    expect(store.jobCache.has('job-1')).toBe(false);
    const before = reads();
    await store.getJobsByIds(['job-1']);
    expect(reads()).toBe(before + 1);
  });

  // A new write path that invalidates the queries directly would drop the
  // status cache and silently keep a stale document. There is one eviction
  // path, and this is what keeps it that way.
  test('nothing in the store invalidates the job queries except forgetJobs', () => {
    const source = require('fs')
      .readFileSync(require('path').join(__dirname, 'services/firestore-backoffice-store.js'), 'utf8');
    const direct = source.split('\n')
      .filter(line => line.includes("invalidate('jobs:')") && !line.includes('forgetJobs'));
    expect(direct).toHaveLength(1);
    expect(source).toMatch(/forgetJobs\(ids = \[\]\)\{\n\s*this\.invalidate\('jobs:'\);/);
  });
});

/**
 * The drain builds a fresh store per pass, because the store memoises artifacts
 * and queue reads and a pass must see what the previous one wrote. That left the
 * job cache cold on every pass: measured on drain run 37783864537,
 * `job-get-by-id` was 7,632 of 10,284 reads — 74% of the whole run — because
 * every pass re-read every job each trail had ever had.
 *
 * A completed job is finished: the orchestration only uses one to find the
 * newest per agent and read its output ref. Those can cross passes. Nothing in
 * flight can, because a requeue or retire run outside this process could move it.
 */
describe('a shared job cache keeps finished jobs and nothing else', () => {
  function sharedStore(seed, jobCache) {
    const docs = new Map(Object.entries(seed));
    let reads = 0;
    const docRef = id => ({ id, get: async () => { reads += 1; return snap(id); },
      set: async () => {}, update: async () => {} });
    const snap = id => ({ id, exists: docs.has(id), ref: docRef(id), data: () => docs.get(id) });
    const db = {
      settings: jest.fn(),
      collection: () => ({ doc: docRef, where: () => ({ get: async () => ({ docs: [] }) }) }),
      getAll: async (...refs) => { reads += refs.length; return refs.map(ref => snap(ref.id)); },
      batch: () => ({ update: () => {}, commit: async () => {} }),
      runTransaction: async fn => fn({ get: async ref => { reads += 1; return snap(ref.id); },
        set: () => {}, update: () => {} }),
    };
    return { store: new FirestoreBackofficeStore({ db, jobCache }), reads: () => reads, docs };
  }

  const seed = {
    'done-1': { status: 'completed', agentId: 'logistics', createdAt: '2026-10-01T00:00:00.000Z' },
    'done-2': { status: 'completed', agentId: 'terrainPoi', createdAt: '2026-10-02T00:00:00.000Z' },
    'live-1': { status: 'queued', agentId: 'redTeam', createdAt: '2026-10-03T00:00:00.000Z' },
  };
  const ids = ['done-1', 'done-2', 'live-1'];

  test('a later pass pays only for the jobs still in flight', async () => {
    const shared = new Map();

    const first = sharedStore(seed, shared);
    expect(await first.store.getJobsByIds(ids)).toHaveLength(3);
    expect(first.reads()).toBe(3);

    // What the drain does next: a brand new store, same shared cache.
    const second = sharedStore(seed, shared);
    expect(await second.store.getJobsByIds(ids)).toHaveLength(3);
    // The two finished jobs came from the cache; only the queued one was read.
    expect(second.reads()).toBe(1);
  });

  test('a queued job is never served from a previous pass', async () => {
    const shared = new Map();
    const first = sharedStore(seed, shared);
    await first.store.getJobsByIds(ids);

    expect(shared.has('done-1')).toBe(true);
    expect(shared.has('live-1')).toBe(false);

    // Something outside this process requeued it between passes.
    const second = sharedStore({ ...seed,
      'live-1': { status: 'blocked', agentId: 'redTeam', createdAt: '2026-10-03T00:00:00.000Z' } }, shared);
    const jobs = await second.store.getJobsByIds(['live-1']);
    expect(jobs[0].status).toBe('blocked');
  });

  test('a store with its own cache still keeps everything, as before', async () => {
    const own = sharedStore(seed);
    await own.store.getJobsByIds(ids);
    const before = own.reads();
    await own.store.getJobsByIds(ids);

    expect(own.store.sharedJobCache).toBe(false);
    // Unchanged from #661: within one store, the second walk is free.
    expect(own.reads()).toBe(before);
  });

  test('our own write still evicts, shared cache or not', async () => {
    const shared = new Map();
    const { store } = sharedStore(seed, shared);
    await store.getJobsByIds(['done-1']);
    expect(shared.has('done-1')).toBe(true);

    await store.putJob({ id: 'done-1', status: 'queued' });
    expect(shared.has('done-1')).toBe(false);
  });
})
