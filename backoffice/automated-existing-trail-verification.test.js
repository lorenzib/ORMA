'use strict';

const {OPTIONAL_UNKNOWN_REASON,gateDecision,automateEditorialReviews,automatePublicationReviews}=require('./workflows/automate-existing-trail-verification');
const {buildVerifiedEditorialHandoff}=require('./workflows/verified-editorial-handoff');
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
