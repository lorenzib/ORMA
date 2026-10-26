'use strict';

const path=require('path');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {compileVerifiedDossier,routeGuidanceByClaim,VERIFICATION_ROUTE_CLAIMS}
  =require('./workflows/compile-verified-dossier');
const {buildVerifiedEditorialHandoff}=require('./workflows/verified-editorial-handoff');
const {buildPublicationStaging,routeNumberGuidance}=require('./workflows/build-publication-staging');
const {materializeApprovedPublications}=require('./workflows/materialize-approved-publications');
const {applyVerifiedTrailOverrides}=require('../scripts/verified-trail-overrides');
const {loadProductionTrails}=require('../scripts/load-production-trails');

const AT='2026-10-18T10:00:00Z';
const ROOT=path.resolve(__dirname,'..');

/**
 * A walk whose directions ORMA established for nothing, all the way to the page.
 *
 * Everything here is derived from the producers -- the cartographer's own survey
 * shape, the real catalogue record, the real approval key -- because a fixture
 * typed by hand passes against a field nothing emits.
 */
function fastLaneTrail(){
  const record=loadProductionTrails(ROOT).find(trail=>trail.id==='osm-11839597');
  if(!record)throw new Error('osm-11839597 left the catalogue; pick another free-survey trail');
  return {candidateId:record.id,trailId:record.id,trailName:record.name,...record};
}

function survey(trail){
  return {routeGuidance:singleRelationGuidance({tags:{ref:'20'}}),
    relation:{tags:{ref:'20',name:trail.trailName}},
    source:{url:'https://www.openstreetmap.org/relation/11839597',externalId:'relation/11839597',
      endpoint:'https://api.openstreetmap.org/x',relationVersion:3,
      relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
    geometry:{type:'LineString',coordinates:trail.path.map(point=>[point[1],point[0]])},
    assessment:{issues:[],pointCount:trail.path.length,distanceKm:trail.distance}};
}

function walkTheLane(overrides={contractVersion:'1.0.0',trails:[]}){
  const trail=fastLaneTrail();
  const result=survey(trail);
  const review={reviewId:'r',approvalAllowed:true,blockingReasons:[],
    specialistOutputs:[{agentId:'cartographer',jobId:'c1',result}]};
  const dossier=compileVerifiedDossier(review,trail,{at:AT,trail});
  const handoff=buildVerifiedEditorialHandoff(dossier,
    {candidateId:trail.candidateId,trailName:trail.trailName,verifiedAt:AT,conditions:[]},
    null,{at:AT,preserveExistingAssets:true});
  const copyJobId=`verified-${trail.candidateId}-copy`;
  const execution={outputs:[{jobId:copyJobId,candidateId:trail.candidateId,agentId:'editorialCopywriter',
    result:{title:trail.trailName,changes:[
      {section:'About the trail',after:'A gentle promenade above the village.'},
      {section:'Why it suits dogs',after:'Wide, shaded and away from traffic.'},
      {section:'Important practical notes',after:'No water on the route; carry your own.'}]}}]};
  const reviewQueue={submissions:[{submissionId:'s1',decisions:[
    {jobId:copyJobId,action:'approve',gateId:'editorial-evidence-policy',decidedBy:'benedetta'}]}]};
  const staging=buildPublicationStaging(handoff.queue,execution,reviewQueue,
    {at:AT,productionTrails:[{...trail,id:trail.trailId}]});
  const requests={requests:[{id:'pub-1',candidateId:trail.candidateId,
    status:'approved-for-pr-creation',approvedBy:'benedetta',approvedAt:AT}]};
  const materialized=materializeApprovedPublications({requests,staging,
    routesByCandidate:{[trail.candidateId]:{geometry:result.geometry}},
    overrides,operationalFacts:{trails:[]},at:AT});
  return {trail,dossier,handoff,staging,materialized};
}

describe('a dossier records the answer it used',()=>{
  const {dossier}=walkTheLane();

  test('each of the four directions is recorded under the rung that established it',()=>{
    const ids=dossier.claims.map(claim=>claim.id);
    expect(ids).toContain('orma-recommended-start');
    expect(ids).toContain('map-route-number-sequence');
    // Never under an agent that did not answer it.
    expect(ids.filter(id=>id.startsWith('logistics-'))).toEqual([]);
  });

  test('the lookup finds all four whatever answered them',()=>{
    const found=routeGuidanceByClaim(dossier.claims);
    expect([...found.keys()].sort()).toEqual([...VERIFICATION_ROUTE_CLAIMS].sort());
    for(const claimId of VERIFICATION_ROUTE_CLAIMS){
      expect(found.get(claimId).claimId).toBe(claimId);
    }
  });

  test("an agent's own answer wins over a rung's",()=>{
    const found=routeGuidanceByClaim([
      {id:'orma-recommended-start',claimId:'recommended-start'},
      {id:'logistics-recommended-start',claimId:'recommended-start',agentId:'logistics'},
      {id:'route-geometry'},
    ]);
    expect(found.get('recommended-start').agentId).toBe('logistics');
    expect(found.has('route-geometry')).toBe(false);
  });
});

describe('a reviewed walk reaches the page',()=>{
  const {staging,materialized,handoff}=walkTheLane();
  const item=staging.items[0];

  test('nothing holds it: the copy is approved and the record supplies its fields',()=>{
    expect({state:item.state,approvals:item.missingApprovals,blockers:item.publicationMappingBlockers})
      .toEqual({state:'ready-for-publication-preview',approvals:[],blockers:[]});
  });

  test('the directions it publishes say which rung answered each one',()=>{
    // Read off the fields being published, not recomputed beside them.
    const guidance=item.proposedWebsiteFields.routeNumberGuidance;
    expect(guidance).toEqual(routeNumberGuidance(handoff.queue.items[0]));
    expect(guidance.establishedBy).toEqual({start:'orma-record',status:'orma-record',
      sequence:'route-relations',switches:'route-relations'});
    expect(guidance.sources.some(source=>/^https:\/\//.test(source.url))).toBe(true);
  });

  test('it publishes as reviewed, and says what it is short of',()=>{
    const entry=materialized.overrides.trails[0];
    expect(entry.verificationScope).toBe('routeReviewed');
    expect(entry.fields.ormaVerified).toBe(false);
    expect(entry.fields.graduation.status).toBe('in-progress');
    expect(entry.fields.graduation.completed)
      .toEqual(['photo','route','routeNumbers','mapPoints','elevation']);
    // No safety category is claimed, so every caveat on the page stands.
    expect(entry.fields.verified.categories).toEqual([]);
  });

  test('the override contract takes it',()=>{
    const applied=applyVerifiedTrailOverrides([{id:'osm-11839597',name:'EN20'}],materialized.overrides);
    expect(applied[0].name).toBe('Fenn Promenade');
    expect(applied[0].curated).toBe(true);
    expect(applied[0].ormaVerified).toBe(false);
  });

  test('a publication may not take away a seal the trail already carries',()=>{
    const {trail,staging:fresh}=walkTheLane();
    const requests={requests:[{id:'pub-2',candidateId:trail.candidateId,
      status:'approved-for-pr-creation',approvedBy:'benedetta',approvedAt:AT}]};
    expect(()=>materializeApprovedPublications({requests,staging:fresh,
      routesByCandidate:{[trail.candidateId]:{geometry:{coordinates:trail.path.map(p=>[p[1],p[0]])}}},
      overrides:{contractVersion:'1.0.0',trails:[{id:trail.trailId,approvalId:'older',
        fields:{ormaVerified:true}}]},operationalFacts:{trails:[]},at:AT}))
      .toThrow(/would remove the ORMA Verified seal/);
  });
});

describe('a publication keeps what a person established on the entry it replaces',()=>{
  // Roda de Armentara, 26 October 2026: a hand-checked `routeRefs` entry was
  // replaced wholesale and its numbered section would have left the page.
  const segments=[{ref:'15A',path:[[46.5,11.8],[46.51,11.81]],
    source:{url:'https://api.openstreetmap.org/api/0.6/relation/9511973/full',checkedAt:'2026-09-01'}}];
  const prior=id=>({contractVersion:'1.0.0',trails:[{id,verificationScope:'routeRefs',reviewedAt:'2026-09-01',
    fields:{routeRefSegments:segments}}]});

  test('a field the publication does not supply is kept',()=>{
    const id=fastLaneTrail().trailId;
    const {materialized}=walkTheLane(prior(id));
    const entry=materialized.overrides.trails.find(item=>item.id===id);
    expect(materialized.overrides.trails.filter(item=>item.id===id)).toHaveLength(1);
    expect(entry.verificationScope).toBe('routeReviewed');
    expect(entry.fields.routeRefSegments).toEqual(segments);
    // And the record the site reads still has it.
    const applied=applyVerifiedTrailOverrides([{id,name:'x'}],materialized.overrides).find(item=>item.id===id);
    expect(applied.routeRefSegments).toEqual(segments);
  });

  test('a field the publication does supply is the publication’s to set',()=>{
    const id=fastLaneTrail().trailId;
    const old={contractVersion:'1.0.0',trails:[{id,verificationScope:'routeRefs',reviewedAt:'2026-09-01',
      fields:{routeRefSegments:segments,routeNumberGuidance:{start:'an old start'}}}]};
    const {materialized}=walkTheLane(old);
    const entry=materialized.overrides.trails.find(item=>item.id===id);
    expect(entry.fields.routeNumberGuidance.start).not.toBe('an old start');
  });
});
