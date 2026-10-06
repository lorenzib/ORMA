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
