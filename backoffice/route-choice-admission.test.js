'use strict';

const fs=require('fs');
const {admitChosenRoutes}=require('./workflows/admit-chosen-routes');
const {admitRouteChoices,promoteOwedLines}=require('./workflows/run-live-backoffice-worker');
const {routeProposals}=require('./cli/seed-live-state');
const {withTrailIds}=require('./cli/seed-live-state');
const {validateTrailOrchestration}=require('./contracts/trail-orchestration-v1');

// A route choice could be applied and still leave its trail outside the
// pipeline: the four route-choice candidates were in no orchestration, so
// "continue with the evidence gates" was an instruction nobody acted on.

const AT='2026-10-05T09:00:00.000Z';
const QUESTIONS=JSON.parse(fs.readFileSync('backoffice-data/route-review.json','utf8'));
const TRE_CIME='osm-relation-1484751';
const TRAIL='tre-cime';

function chosen(overrides={}){
  const item=QUESTIONS.items.find(candidate=>candidate.candidateId===TRE_CIME);
  return {items:[{...JSON.parse(JSON.stringify(item)),reviewState:'route-choice-approved',
    selectedProposalId:'tre-cime-classic-101-105',...overrides}]};
}
function fleet(trails=[]){
  return {contractVersion:'1.0.0',publicMutationAllowed:false,trails,summary:{}};
}
function working(trailId){
  return {trailId,candidateId:trailId,trailName:trailId,state:'evidence-research',stage:'parallel-evidence-research',
    attempts:{},resolutionAttempts:{},jobIds:[],blockers:[],publicMutationAllowed:false};
}
const catalogue=new Map([[TRAIL,{id:TRAIL,name:'Tre Cime di Lavaredo classic circuit'}]]);

describe('a chosen route enters the fleet', () => {
  test('the trail is admitted past the geometry gate, with the three specialists queued',()=>{
    const result=admitChosenRoutes(fleet(),chosen(),{at:AT,trailById:catalogue});
    expect(result.admitted).toEqual([expect.objectContaining({candidateId:TRE_CIME,trailId:TRAIL})]);
    const trail=result.orchestration.trails[0];
    // The human chose the line, so the geometry gate is answered, not pending.
    expect(trail).toEqual(expect.objectContaining({trailId:TRAIL,state:'evidence-research',
      stage:'parallel-evidence-research'}));
    expect(trail.gate).toEqual(expect.objectContaining({id:'geometry-approval',status:'approved',
      decidedBy:'route-choice',proposalId:'tre-cime-classic-101-105'}));
    expect(result.jobs.map(job=>job.agentId)).toEqual(['logistics','regulatoryRanger','terrainPoi']);
    expect(validateTrailOrchestration(result.orchestration)).toEqual([]);
  });

  test('the specialists research the line the editor kept',()=>{
    const result=admitChosenRoutes(fleet(),chosen(),{at:AT,trailById:catalogue});
    for(const job of result.jobs){
      expect(job.candidateId).toBe(TRAIL);
      expect(job.inputRefs).toContain(`firestore:route-proposal-${TRAIL}`);
    }
  });

  test('both identities are kept, so the trail can be traced back to its question',()=>{
    const result=admitChosenRoutes(fleet(),chosen(),{at:AT,trailById:catalogue});
    expect(result.orchestration.trails[0].sourceTrail).toEqual(expect.objectContaining({
      origin:'route-choice',externalRelationId:TRE_CIME}));
    expect(result.routeReview.items[0]).toEqual(expect.objectContaining({orchestrationTrailId:TRAIL,
      orchestrationAdmittedAt:AT}));
  });

  test('an admitted trail is not admitted twice',()=>{
    const once=admitChosenRoutes(fleet(),chosen(),{at:AT,trailById:catalogue});
    const twice=admitChosenRoutes(once.orchestration,once.routeReview,{at:AT,trailById:catalogue});
    expect(twice.changed).toBe(false);
    expect(twice.jobs).toEqual([]);
    expect(twice.orchestration.trails).toHaveLength(1);
  });

  test('a question still waiting on a person is left alone',()=>{
    const result=admitChosenRoutes(fleet(),{items:QUESTIONS.items},{at:AT,trailById:catalogue});
    expect(result.changed).toBe(false);
    expect(result.admitted).toEqual([]);
  });
});

describe('what holds an admission back is named, and tried again', () => {
  test('a full fleet holds the trail rather than spending credits it has not got',()=>{
    const full=fleet(Array.from({length:15},(_,index)=>working(`busy-${index}`)));
    const result=admitChosenRoutes(full,chosen(),{at:AT,trailById:catalogue});
    expect(result.changed).toBe(false);
    expect(result.held).toEqual([{candidateId:TRE_CIME,reason:'verification-capacity-reached'}]);
    // Nothing is recorded on the item, so the next pass tries again.
    expect(result.routeReview.items[0].orchestrationAdmittedAt).toBeUndefined();
  });

  test('a trail parked at a gate does not hold a slot',()=>{
    const parked=fleet(Array.from({length:15},(_,index)=>({...working(`parked-${index}`),state:'dossier-human-gate'})));
    const result=admitChosenRoutes(parked,chosen(),{at:AT,trailById:catalogue});
    expect(result.admitted).toHaveLength(1);
  });

  test('a question naming no catalogue trail is held, not guessed at',()=>{
    const result=admitChosenRoutes(fleet(),chosen({trailId:undefined}),{at:AT,trailById:catalogue});
    expect(result.held).toEqual([{candidateId:TRE_CIME,reason:'no-catalogue-trail-named'}]);
  });

  test('a trail the catalogue does not have is held',()=>{
    const result=admitChosenRoutes(fleet(),chosen({trailId:'not-in-the-catalogue'}),{at:AT,trailById:catalogue});
    expect(result.held).toEqual([{candidateId:TRE_CIME,reason:'trail-not-in-catalogue'}]);
  });

  test('a trail already in verification is recorded, not added a second time',()=>{
    const result=admitChosenRoutes(fleet([working(TRAIL)]),chosen(),{at:AT,trailById:catalogue});
    expect(result.orchestration.trails).toHaveLength(1);
    expect(result.admitted).toEqual([expect.objectContaining({trailId:TRAIL,alreadyInFleet:true})]);
    expect(result.routeReview.items[0].orchestrationAdmittedAt).toBe(AT);
  });
});

describe('the worker admits on every pass', () => {
  function store(artifacts){
    const jobs=[];
    return {jobs,artifacts,getArtifact:async id=>artifacts[id]??null,
      setArtifact:async(id,value)=>{artifacts[id]=value;},putJobIfAbsent:async job=>{jobs.push(job);return true;}};
  }

  test('a chosen route is admitted and its jobs queued',async()=>{
    const artifacts={'route-review':chosen(),'trail-orchestration':fleet()};
    const target=store(artifacts);
    const outcomes=await admitRouteChoices(target,{at:AT,productionTrails:[{id:TRAIL,name:'Tre Cime'}]});
    expect(outcomes).toEqual([expect.objectContaining({candidateId:TRE_CIME,trailId:TRAIL,status:'admitted'})]);
    expect(target.jobs).toHaveLength(3);
    expect(artifacts['trail-orchestration'].trails[0].trailId).toBe(TRAIL);
    expect(artifacts['route-review'].items[0].orchestrationAdmittedAt).toBe(AT);
  });

  test('nothing to admit writes nothing',async()=>{
    const artifacts={'route-review':{items:QUESTIONS.items},'trail-orchestration':fleet()};
    const target=store(artifacts);
    expect(await admitRouteChoices(target,{at:AT,productionTrails:[]})).toEqual([]);
    expect(target.jobs).toEqual([]);
    expect(artifacts['trail-orchestration'].trails).toEqual([]);
  });

  test('an admission that cannot be written fails the run instead of disappearing',async()=>{
    const artifacts={'route-review':chosen(),'trail-orchestration':fleet()};
    const target=store(artifacts);
    target.setArtifact=async()=>{throw new Error('artifact write refused');};
    const outcomes=await admitRouteChoices(target,{at:AT,productionTrails:[{id:TRAIL,name:'Tre Cime'}]});
    expect(outcomes).toEqual([expect.objectContaining({status:'blocked',error:'artifact write refused'})]);
  });

  test('a store with no route questions is not an error',async()=>{
    expect(await admitRouteChoices(store({}),{at:AT})).toEqual([]);
  });
});

describe('the stored question learns which trail it is about', () => {
  test('the seed names the trail without touching anything already recorded',()=>{
    const stored={items:[{candidateId:TRE_CIME,reviewState:'route-choice-approved',
      decision:{action:'approve-route',note:'keep the classic'}}]};
    const {artifact,added}=withTrailIds(stored,QUESTIONS);
    expect(added).toEqual([`${TRE_CIME} -> ${TRAIL}`]);
    expect(artifact.items[0]).toEqual(expect.objectContaining({trailId:TRAIL,
      decision:{action:'approve-route',note:'keep the classic'}}));
  });

  test('a question that already names its trail is left exactly as stored',()=>{
    const stored={items:[{candidateId:TRE_CIME,trailId:'named-by-hand'}]};
    const {artifact,added}=withTrailIds(stored,QUESTIONS);
    expect(added).toEqual([]);
    expect(artifact).toBe(stored);
  });
});

describe('the line a recorded choice is still owed', () => {
  // Both production choices were applied before their geometry was seeded, so
  // nothing was promoted — and applying happens once. Without this repair the
  // trail enters verification pointing at a route artifact nobody ever wrote.
  const CLASSIC='tre-cime-classic-101-105';
  const feature=proposalId=>JSON.parse(fs.readFileSync(
    routeProposals(QUESTIONS).find(candidate=>candidate.id===proposalId).geometryRef,'utf8'));

  function store(artifacts){
    const writes=[];
    return {writes,artifacts,getArtifact:async id=>artifacts[id]??null,
      setArtifact:async(id,value,meta)=>{artifacts[id]=value;writes.push({id,meta});}};
  }

  test('is written on a later pass, under the catalogue trail',async()=>{
    const artifacts={[`route-proposal-geometry-${CLASSIC}`]:feature(CLASSIC)};
    const target=store(artifacts);
    const promoted=await promoteOwedLines(target,chosen(),AT);
    expect(promoted).toEqual([expect.objectContaining({candidateId:TRE_CIME,trailId:TRAIL,
      status:'promoted',proposalId:CLASSIC})]);
    expect(artifacts[`route-proposal-${TRAIL}`].properties.proposalId).toBe(CLASSIC);
    expect(target.writes[0].meta).toEqual(expect.objectContaining({proposalId:CLASSIC,promotedAt:AT}));
  });

  test('is not rewritten once it is there',async()=>{
    const artifacts={[`route-proposal-${TRAIL}`]:feature(CLASSIC),
      [`route-proposal-geometry-${CLASSIC}`]:feature(CLASSIC)};
    const target=store(artifacts);
    expect(await promoteOwedLines(target,chosen(),AT)).toEqual([]);
    expect(target.writes).toEqual([]);
  });

  test('a line that is not seeded yet is waited for, quietly',async()=>{
    const target=store({});
    expect(await promoteOwedLines(target,chosen(),AT)).toEqual([]);
    expect(target.writes).toEqual([]);
  });

  test('a line that disagrees with its own proposal id is refused, and said out loud',async()=>{
    const artifacts={[`route-proposal-geometry-${CLASSIC}`]:feature('tre-cime-monte-paterno-101-104-105')};
    const target=store(artifacts);
    expect(await promoteOwedLines(target,chosen(),AT)).toEqual([expect.objectContaining({
      status:'promotion-refused',geometry:'rejected-proposal-mismatch',
      foundProposalId:'tre-cime-monte-paterno-101-104-105'})]);
    expect(artifacts[`route-proposal-${TRAIL}`]).toBeUndefined();
  });

  test('a question still waiting on a person is owed nothing',async()=>{
    const target=store({});
    expect(await promoteOwedLines(target,{items:QUESTIONS.items},AT)).toEqual([]);
  });

  test('the worker promotes even when the fleet is too full to admit',async()=>{
    // The two are independent: the line belongs to the decision, the slot to
    // the budget.
    const full=fleet(Array.from({length:15},(_,index)=>working(`busy-${index}`)));
    const artifacts={'route-review':chosen(),'trail-orchestration':full,
      [`route-proposal-geometry-${CLASSIC}`]:feature(CLASSIC)};
    const target={artifacts,getArtifact:async id=>artifacts[id]??null,
      setArtifact:async(id,value)=>{artifacts[id]=value;},putJobIfAbsent:async()=>true};
    const outcomes=await admitRouteChoices(target,{at:AT,productionTrails:[{id:TRAIL,name:'Tre Cime'}]});
    expect(outcomes).toEqual([
      expect.objectContaining({status:'promoted',trailId:TRAIL}),
      expect.objectContaining({status:'held',reason:'verification-capacity-reached'}),
    ]);
    expect(artifacts[`route-proposal-${TRAIL}`].properties.proposalId).toBe(CLASSIC);
  });
});
