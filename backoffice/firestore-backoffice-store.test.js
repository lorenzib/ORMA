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
