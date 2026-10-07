'use strict';

const {rehydrateReviewQueue,rehydrateItem,artifactIdFrom,withheld}=require('./workflows/rehydrate-review-detail');
const {summariseOutput}=require('./workflows/review-queue-compaction');
const {compileVerifiedDossier}=require('./workflows/compile-verified-dossier');

const sourced=[{url:'https://comune.example/start',authority:'Comune di Example',label:'Official guide'}];
const claim=id=>({id,category:'logistics',finding:'supported-proposal',
  proposedValue:`A real value for ${id}`,sources:sourced,blockers:[]});
const ROUTE_GUIDANCE=['recommended-start','route-number-status','route-number-sequence','route-number-switches'];
const cartographer={agentId:'cartographer',jobId:'jc',result:{
  geometry:{type:'LineString',coordinates:[[11.9,46.6],[11.91,46.61]]},
  relation:{tags:{name:'Example Trail'}},assessment:{pointCount:2,distanceKm:9.5},
  source:{externalId:'relation/1',endpoint:'https://overpass.example',relationVersion:'4',
    relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL',url:'https://osm.example/relation/1',authority:'OpenStreetMap'},
  routeConformance:{status:'conformant',offRouteKm:0,maxDeviationMetres:12}}};
const logistics={agentId:'logistics',jobId:'jl',
  result:{recommendation:'advance',openQuestions:[],claims:ROUTE_GUIDANCE.map(claim)}};
const trail={candidateId:'osm-1',trailId:'osm-1',trailName:'Example Trail'};
const item=outputs=>({reviewId:'r1',trailId:'osm-1',candidateId:'osm-1',gateType:'dossier-approval',
  state:'awaiting-human',approvalAllowed:true,specialistOutputs:outputs});
const queue=outputs=>({contractVersion:'1.0.0',items:[item(outputs)]});
// The store the worker hands in: artifacts by the id the pointer names.
const store=(artifacts={})=>({getArtifact:async id=>artifacts[id]||null});
const artifacts={'trail-specialist-output-jl':logistics.result,'trail-specialist-output-jc':cartographer.result};

describe('an approval reads the evidence compaction put out of reach',()=>{
  test('a summarised dossier cannot be approved, and after rehydration it can',async()=>{
    // The whole bug in two lines. Same dossier, same evidence.
    const summarised=item([cartographer,logistics].map(summariseOutput));
    expect(()=>compileVerifiedDossier(summarised,trail,{at:'2026-10-06T00:00:00Z'}))
      .toThrow(/requires sourced route guidance/);

    const restored=await rehydrateItem(store(artifacts),summarised);
    expect(()=>compileVerifiedDossier(restored,trail,{at:'2026-10-06T00:00:00Z'})).not.toThrow();
  });

  test('it follows the pointer the compaction left',()=>{
    expect(artifactIdFrom('firestore:trail-specialist-output-jl')).toBe('trail-specialist-output-jl');
    expect(artifactIdFrom('trail-specialist-output-jl')).toBeNull();
    expect(artifactIdFrom(undefined)).toBeNull();
  });

  test('an item that was never summarised is returned untouched',async()=>{
    // Identity, not a copy: nothing to do should cost nothing.
    const full=item([cartographer,logistics]);
    expect(withheld(logistics)).toBe(false);
    await expect(rehydrateItem(store(artifacts),full)).resolves.toBe(full);
  });

  test('a pointer naming an artifact that is gone leaves the summary alone',async()=>{
    // A refusal beats a verification resting on claims nobody could read back.
    const summarised=item([summariseOutput(logistics)]);
    const restored=await rehydrateItem(store({}),summarised);
    expect(restored.specialistOutputs[0].result.detailWithheld).toBe(true);
    expect(()=>compileVerifiedDossier(restored,trail,{at:'2026-10-06T00:00:00Z'}))
      .toThrow(/requires sourced route guidance/);
  });

  test('only the item being decided is restored',async()=>{
    // Restoring the whole queue rebuilds the megabyte compaction exists to avoid.
    const summarised=[cartographer,logistics].map(summariseOutput);
    const other={...item(summarised),reviewId:'r2'};
    const twoItems={contractVersion:'1.0.0',items:[item(summarised),other]};
    const next=await rehydrateReviewQueue(store(artifacts),twoItems,'r1');
    expect(next.items[0].specialistOutputs[1].result.detailWithheld).toBeUndefined();
    expect(next.items[1].specialistOutputs[1].result.detailWithheld).toBe(true);
  });

  test('a reviewId the queue does not hold changes nothing',async()=>{
    const q=queue([summariseOutput(logistics)]);
    await expect(rehydrateReviewQueue(store(artifacts),q,'missing')).resolves.toBe(q);
  });

  test('the restored output says where it came from',async()=>{
    const restored=await rehydrateItem(store(artifacts),item([summariseOutput(logistics)]));
    expect(restored.specialistOutputs[0].rehydratedFrom).toBe('firestore:trail-specialist-output-jl');
  });
});
