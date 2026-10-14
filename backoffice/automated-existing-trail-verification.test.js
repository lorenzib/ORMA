'use strict';

const {OPTIONAL_UNKNOWN_REASON,gateDecision,automateEditorialReviews,automatePublicationReviews}=require('./workflows/automate-existing-trail-verification');
const {buildVerifiedEditorialHandoff}=require('./workflows/verified-editorial-handoff');
const {dossierBlockingReasons}=require('./workflows/compile-verified-dossier');
const {MAX_WAIVABLE_ATTEMPTS,ceilingFor}=require('./workflows/claim-resolution');
const {ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier');

// Directions the gate accepts: a supported proposal with an authority behind an
// https source, which is what supportedLogisticsClaim actually requires. Built
// from the producer's own claim list so a fifth direction appears here too.
const sourcedDirections=()=>({agentId:'logistics',result:{recommendation:'advance',openQuestions:[],
  claims:ROUTE_GUIDANCE_CLAIM_IDS.map(id=>({id,category:'access',finding:'supported-proposal',
    proposedValue:'Follow the waymarked route.',confidence:0.9,rationale:'Official page.',
    sources:[{label:'Operator',url:'https://example.test/route',authority:'Route operator',accessedAt:'2026-10-13'}],
    blockers:[]}))}});
const {buildPublicationStaging,existingImageFields,verifiedPoiFields}=require('./workflows/build-publication-staging');

const at='2026-10-07T10:00:00.000Z';

function orchestration(over={}){return {trails:[{candidateId:'trail-a',trailId:'trail-a',trailName:'Trail A',
  state:'dossier-human-gate',resolutionAttempts:{},...over}]};}
function review(over={}){return {reviewId:'review-a',candidateId:'trail-a',trailId:'trail-a',trailName:'Trail A',
  gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:true,specialistOutputs:[],blockingReasons:[],...over};}

describe('existing catalogue evidence policy',()=>{
  test('approves a clean gate without a person',()=>{
    const item=review({gateType:'geometry-approval'});const queue={items:[item]};
    expect(gateDecision(item,queue,orchestration({state:'geometry-human-gate'}),new Set()))
      .toEqual({action:'approve',acceptedBlockers:[]});
  });

  test('accepts exhausted optional unknowns without promoting them to facts',()=>{
    const item=review({approvalAllowed:false,blockingReasons:['terrainPoi/water: five automated resolution strategies exhausted']});
    const trail=orchestration({resolutionAttempts:{terrainPoi:5}});
    const decision=gateDecision(item,{items:[item]},trail,new Set());
    expect(decision.action).toBe('approve');
    expect(decision.acceptedBlockers).toEqual([{blocker:item.blockingReasons[0],reason:OPTIONAL_UNKNOWN_REASON}]);
  });

  // The fixtures above hand-type "five automated resolution strategies
  // exhausted". Since optional detail stopped at three, the producer writes
  // "3 ...", and a test that types the old sentence passes against a string
  // nothing emits. This one builds the reason with the producer, so it moves
  // when the producer moves.
  test('a trail whose only work left is exhausted optional detail is approved',()=>{
    const exhaustedClaim={id:'water',category:'water',finding:'unresolved',proposedValue:'Unknown.',
      sources:[],blockers:[],resolution:{state:'source-exhausted',maximumAttempts:ceilingFor('water')}};
    // Le Belvédère's shape: directions sourced, one optional detail given up on.
    const reasons=dossierBlockingReasons([sourcedDirections(),{agentId:'terrainPoi',
      result:{recommendation:'advance',openQuestions:[],claims:[exhaustedClaim]}}]);
    expect(reasons).toHaveLength(1);
    // What the producer actually says, with the ladder optional detail now has.
    expect(reasons).toContain(`terrainPoi/water: ${MAX_WAIVABLE_ATTEMPTS} automated resolution strategies exhausted`);
    expect(reasons.join(' ')).not.toMatch(/five automated/i);

    const item=review({approvalAllowed:false,blockingReasons:reasons});
    const decision=gateDecision(item,{items:[item]},orchestration({resolutionAttempts:{terrainPoi:MAX_WAIVABLE_ATTEMPTS}}),new Set());
    expect(decision.action).toBe('approve');
    expect(decision.acceptedBlockers.map(entry=>entry.blocker)).toEqual(reasons);
  });

  test('optional detail is retired two attempts sooner than a direction',()=>{
    expect(ceilingFor('water')).toBe(MAX_WAIVABLE_ATTEMPTS);
    expect(ceilingFor('route-number-switches')).toBeGreaterThan(MAX_WAIVABLE_ATTEMPTS);
  });

  test('sends a researchable claim back to its specialist in the same pass',()=>{
    const item=review({approvalAllowed:false,blockingReasons:['terrainPoi/water: unresolved']});
    const decision=gateDecision(item,{items:[item]},orchestration(),new Set());
    expect(decision).toEqual(expect.objectContaining({action:'request-revision',targetAgent:'terrainPoi'}));
  });

  test('withholds verification when critical route guidance is exhausted',()=>{
    const blocker='logistics/route-number-sequence: sourced, reader-usable route guidance is required';
    const item=review({approvalAllowed:false,blockingReasons:[blocker]});
    const decision=gateDecision(item,{items:[item]},orchestration({resolutionAttempts:{logistics:5}}),new Set());
    expect(decision).toEqual(expect.objectContaining({action:'reject'}));
  });

  test.each(['implausibly-short','missing-member-geometry','composite-relations-changed','unmeasurable-offset'])
  ('never accepts critical geometry failure %s as an optional unknown',(blocker)=>{
    const item=review({gateType:'geometry-approval',approvalAllowed:false,blockingReasons:[blocker],
      specialistOutputs:[{agentId:'cartographer',result:{blockers:[blocker]}}]});
    const decision=gateDecision(item,{items:[item]},orchestration({state:'geometry-human-gate',resolutionAttempts:{cartographer:5}}),new Set());
    expect(decision).toEqual(expect.objectContaining({action:'reject',acceptedBlockers:[]}));
  });
});

describe('existing asset and publication policy',()=>{
  const source={id:'s1',label:'Authority',url:'https://example.test/trail',authority:'Authority',accessedAt:at};
  const claims=['recommended-start','route-number-status','route-number-sequence','route-number-switches']
    .map(id=>({id:`logistics-${id}`,label:id,state:'supported',proposedValue:`Supported ${id}`,sourceIds:['s1']}));
  const dossier={contractVersion:'1.0.0',candidateId:'trail-a',trailId:'trail-a',trailName:'Trail A',reviewState:'accepted',
    sources:[source],claims:[{id:'route-identity',label:'Route',state:'supported',proposedValue:'Trail A',sourceIds:['s1']},...claims],
    routeGeometry:{type:'LineString',coordinates:[[11,46],[11.01,46.01]]},
    ormaVerification:{status:'verified',verifiedAt:at,verifiedBy:'orma-existing-trail-verifier-v1',conditions:[]}};
  const trail={id:'trail-a',area:'Area',distance:2,elevation:50,hours:'1',paid:false,terrainType:'Path',terrainRank:1,
    shadeCoverage:30,heatRisk:'moderate',safetyLevel:'moderate',exposure:false,waterSources:[],startPoint:{lat:46,lng:11,label:'Start'},
    imageIcon:'images/trails/a.jpg',heroImage:'images/trails/a.jpg',imageAlt:'Trail A',imageCreditText:'Photo by ORMA',
    imageCredit:'Photo by ORMA',imageCreator:'ORMA',imageLicence:'ORMA-owned',imageLicenceUrl:null,imageSourcePage:null,imageSourceType:'moderator-upload'};

  test('preserves the existing licensed image and queues copy only',()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,{verifiedAt:at},null,{at,preserveExistingAssets:true});
    expect(handoff.item.assetPolicy).toBe('preserve-existing');
    expect(handoff.jobs.map(job=>job.agentId)).toEqual(['copywriter']);
    expect(existingImageFields(trail)).toEqual(expect.objectContaining({heroImage:'images/trails/a.jpg',imageAlt:'Trail A'}));
  });

  test('publishes only located supported POIs and clears an exhausted old claim',()=>{
    const item={lockedFacts:[
      {claimId:'water',humanAcceptedFinding:'supported-proposal',entityName:'Trailhead fountain',location:{lat:46,lng:11,km:0}},
      {claimId:'food-drink',humanAcceptedFinding:'supported-proposal',entityName:'Rifugio Example',location:{lat:46.01,lng:11.01,km:1.2}},
    ],acceptedUnknowns:[{blocker:'terrainPoi/animals: five automated resolution strategies exhausted'}]};
    expect(verifiedPoiFields(item)).toEqual({
      waterSources:[{label:'Trailhead fountain',lat:46,lng:11,km:0}],
      rifugi:[{name:'Rifugio Example',lat:46.01,lng:11.01,km:1.2}],livestockPresence:'unknown',
    });
    expect(verifiedPoiFields({lockedFacts:[],acceptedUnknowns:[{blocker:'terrainPoi/water: exhausted'},{blocker:'terrainPoi/mountain-huts: exhausted'}]}))
      .toEqual({waterSources:[],rifugi:[]});
  });

  test('automates locked-copy and ready publication decisions',async()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,{verifiedAt:at},null,{at,preserveExistingAssets:true});
    const copyJobId='verified-trail-a-copy';
    const execution={outputs:[{jobId:copyJobId,candidateId:'trail-a',agentId:'copywriter',status:'ready-for-review',result:{
      title:'Trail A',changes:[{section:'About the trail',after:'About.'},{section:'Why it suits dogs',after:'Dogs.'},{section:'Important practical notes',after:'Notes.'}]}}]};
    const writes=[];
    const store={getArtifact:async id=>({
      'verified-trail-editorial-queue':handoff.queue,'verified-trail-editorial-execution':execution,
      'content-review-queue':{submissions:[]},'publication-requests':{requests:[]},
    })[id]||null,listReviews:async()=>[],listPublicationReviews:async()=>[],
    submitContentReview:async input=>{writes.push(input);return {reviewId:'content-1'};},
    submitPublicationReview:async input=>{writes.push(input);return {reviewId:'publication-1'};}};
    expect(await automateEditorialReviews(store)).toEqual([expect.objectContaining({jobId:copyJobId,status:'queued'})]);

    const staging=buildPublicationStaging(handoff.queue,execution,{submissions:[{decisions:[{jobId:copyJobId,action:'approve'}]}]},
      {at,productionTrails:[trail]});
    expect(staging.items[0]).toEqual(expect.objectContaining({state:'ready-for-publication-preview',assetPolicy:'preserve-existing'}));
    store.getArtifact=async id=>id==='publication-staging'?staging:id==='publication-requests'?{requests:[]}:null;
    expect(await automatePublicationReviews(store)).toEqual([expect.objectContaining({candidateId:'trail-a',status:'queued'})]);
    expect(writes.map(input=>input.submittedBy)).toEqual(['orma-existing-trail-verifier-v1','orma-existing-trail-verifier-v1']);
  });

  test('does not auto-approve editorial or publication outside the supplied public-site scope',async()=>{
    const handoff=buildVerifiedEditorialHandoff(dossier,{verifiedAt:at},null,{at,preserveExistingAssets:true});
    const copyJobId='verified-trail-a-copy';
    const execution={outputs:[{jobId:copyJobId,candidateId:'trail-a',agentId:'copywriter',status:'ready-for-review',result:{
      title:'Trail A',changes:[{section:'About the trail',after:'About.'},{section:'Why it suits dogs',after:'Dogs.'},{section:'Important practical notes',after:'Notes.'}]}}]};
    const writes=[];
    const store={getArtifact:async id=>({
      'verified-trail-editorial-queue':handoff.queue,'verified-trail-editorial-execution':execution,
      'content-review-queue':{submissions:[]},'publication-requests':{requests:[]},
    })[id]||null,listReviews:async()=>[],listPublicationReviews:async()=>[],
    setArtifact:async()=>{},submitContentReview:async input=>{writes.push(input);},
    submitPublicationReview:async input=>{writes.push(input);}};
    expect(await automateEditorialReviews(store,{productionTrails:[]})).toEqual([]);

    const staging=buildPublicationStaging(handoff.queue,execution,{submissions:[{decisions:[{jobId:copyJobId,action:'approve'}]}]},
      {at,productionTrails:[trail]});
    store.getArtifact=async id=>id==='publication-staging'?staging:id==='publication-requests'?{requests:[]}:null;
    expect(await automatePublicationReviews(store,{productionTrails:[]})).toEqual([]);
    expect(writes).toEqual([]);
  });
});
