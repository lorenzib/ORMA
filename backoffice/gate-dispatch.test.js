'use strict';

const fs=require('fs');
const path=require('path');
const {planGateDispatches,RESOLUTION_ATTEMPT_LIMIT}=require('./workflows/dispatch-unanswered-gates');
const {dispatchUnansweredGates,ingestDossierReviews}=require('./workflows/run-live-backoffice-worker');
const {routeGuidanceBlockingReasons,dossierBlockingReasons}=require('./workflows/compile-verified-dossier');
const {agentFromBlockers,blockerCountsByAgent}=require('./revision-target');

const at='2026-10-06T08:00:00.000Z';

// The blockers come from the producer. A hand-typed copy of this string passes
// against wording nothing emits, which is exactly how the route-guidance gate
// went eleven days looking fine.
const ROUTE_GUIDANCE=routeGuidanceBlockingReasons([]);

function parkedGate(overrides={}){
  const blockingReasons=overrides.blockingReasons||ROUTE_GUIDANCE;
  const orchestration={contractVersion:'1.0.0',generatedAt:at,trails:[{
    candidateId:'cand-a',trailId:'trail-a',trailName:'Trail A',
    state:overrides.trailState||'dossier-human-gate',stage:'complete-evidence-dossier',
    gate:{id:'dossier-approval',status:'awaiting-human',openedAt:at},
    blockers:blockingReasons,attempts:{},resolutionAttempts:overrides.resolutionAttempts||{},jobIds:[],
  }],summary:{}};
  const reviewQueue={contractVersion:'1.0.0',updatedAt:at,items:[{
    reviewId:'review-a',candidateId:'cand-a',trailId:'trail-a',trailName:'Trail A',
    gateType:overrides.gateType||'dossier-approval',state:'awaiting-human',openedAt:at,
    approvalAllowed:false,blockingReasons,
    specialistOutputs:[{agentId:'logistics',result:{recommendation:'needs-resolution',claims:[]}}],
  }]};
  return {orchestration,reviewQueue};
}

function fakeStore({orchestration,reviewQueue}){
  const artifacts={'trail-orchestration':orchestration,'dossier-review-queue':reviewQueue};
  const reviews=[];const jobs=[];const marks=[];let serial=0;
  return {
    artifacts,reviews,jobs,marks,
    getArtifact:async id=>artifacts[id]||null,
    setArtifact:async(id,value)=>{artifacts[id]=value;},
    listDossierReviews:async(status='queued')=>reviews.filter(review=>review.status===status),
    markDossierReview:async(id,status,fields={})=>{
      const review=reviews.find(entry=>entry.id===id);if(review)review.status=status;
      marks.push({id,status,...fields});
    },
    submitDossierReview:async input=>{
      const id=`decision-${++serial}`;
      reviews.push({...input,id,status:'queued',submittedAt:at});
      return {ok:true,reviewId:id,status:'queued'};
    },
    putJob:async job=>{jobs.push(job);},
    putJobIfAbsent:async job=>{jobs.push(job);return true;},
  };
}

describe('a gate nobody can answer is asked of the agent that can',()=>{
  // The seam, start to end: a trail parked at the dossier gate with blockers
  // only Logistics can supply comes out of one worker pass as a queued
  // Logistics job. Every module in between had its own passing tests while this
  // never happened, because none of them started at a parked gate.
  test('a parked gate becomes a queued logistics job in the same pass',async()=>{
    const store=fakeStore(parkedGate());
    const dispatched=await dispatchUnansweredGates(store,{});
    expect(dispatched).toEqual([expect.objectContaining({reviewId:'review-a',targetAgent:'logistics',status:'dispatched'})]);

    const applied=await ingestDossierReviews(store);
    expect(applied).toEqual([expect.objectContaining({status:'processed'})]);

    const job=store.jobs.find(entry=>entry.agentId==='logistics');
    expect(job).toBeDefined();
    expect(job.jobType).toBe('trail-verification-specialist');
    expect(job.candidateId).toBe('cand-a');
    expect(job.resolutionAttempt).toBe(1);

    // And the trail actually left the gate, rather than holding a queued
    // decision nobody applied.
    const trail=store.artifacts['trail-orchestration'].trails[0];
    expect(trail.state).toBe('evidence-research');
    expect(trail.stage).toBe('logistics-revision');
    expect(trail.pendingRevisionJobId).toBe(job.id);
    expect(store.artifacts['dossier-review-queue'].items[0].state).toBe('processed');
  });

  test('the instruction says it came from automation and what is outstanding',async()=>{
    const store=fakeStore(parkedGate());
    await dispatchUnansweredGates(store,{});
    await ingestDossierReviews(store);
    const job=store.jobs.find(entry=>entry.agentId==='logistics');
    expect(job.instruction).toContain('ORMA automation');
    expect(job.instruction).toContain(ROUTE_GUIDANCE[0]);
    // Re-running without the current contract returns the same dossier: the
    // seven stale gates held logistics output captured before the
    // route-guidance claims existed.
    expect(job.instruction).toContain('current output contract');
  });

  test('it only ever requests a revision — approval and rejection stay hers',async()=>{
    const store=fakeStore(parkedGate());
    await dispatchUnansweredGates(store,{});
    expect(store.reviews).toHaveLength(1);
    expect(store.reviews.map(review=>review.action)).toEqual(['request-revision']);
    expect(store.reviews[0].submittedBy).toBe('orma-gate-dispatch-v1');
    expect(store.reviews[0].acceptedBlockers).toBeUndefined();
  });

  test('the repository variable stops it without a code change',async()=>{
    const store=fakeStore(parkedGate());
    expect(await dispatchUnansweredGates(store,{gateDispatchEnabled:false})).toEqual([]);
    expect(store.reviews).toEqual([]);
  });
});

describe('what it deliberately leaves standing',()=>{
  const held=plan=>plan.held.map(entry=>entry.reason);

  test('blockers that name no agent at all are a decision, not a dispatch',()=>{
    const {orchestration,reviewQueue}=parkedGate({blockingReasons:['not-closed-loop']});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.dispatches).toEqual([]);
    expect(held(plan)).toEqual(['blockers-name-no-agent']);
  });

  // apply-dossier-review stops queueing at the sixth attempt and marks the
  // trail blocked instead. That is a fair end for a person who chose to keep
  // trying and a bad one for automation, so at the limit the gate stays visible.
  test('it holds at the resolution-attempt limit rather than blocking the trail',()=>{
    const {orchestration,reviewQueue}=parkedGate({resolutionAttempts:{logistics:RESOLUTION_ATTEMPT_LIMIT}});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.dispatches).toEqual([]);
    expect(held(plan)).toEqual(['resolution-attempts-exhausted']);
  });

  test('a decision already waiting to be applied is never dispatched over',()=>{
    const {orchestration,reviewQueue}=parkedGate();
    const plan=planGateDispatches(orchestration,reviewQueue,{queuedReviewIds:['review-a']});
    expect(plan.dispatches).toEqual([]);
    expect(held(plan)).toEqual(['decision-already-queued']);
  });

  test('an agent-failure gate is left to its own recovery',()=>{
    const {orchestration,reviewQueue}=parkedGate({gateType:'agent-failure'});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.dispatches).toEqual([]);
    expect(held(plan)).toEqual(['gate-type-has-its-own-recovery']);
  });

  test('a queue item whose trail has already moved on is stale',()=>{
    const {orchestration,reviewQueue}=parkedGate({trailState:'evidence-research'});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.dispatches).toEqual([]);
    expect(held(plan)).toEqual(['trail-no-longer-at-a-gate']);
  });

  // Each dispatch costs a model call, and between 2026-09-12 and 2026-09-17 the
  // account had no credits while ~390 attempts were refused. A backlog drains
  // over passes instead of arriving at the provider all at once.
  test('a backlog is bounded per pass and the rest is reported as deferred',()=>{
    const {orchestration,reviewQueue}=parkedGate();
    const many={
      orchestration:{...orchestration,trails:[0,1,2,3,4].map(index=>({...orchestration.trails[0],candidateId:`cand-${index}`}))},
      reviewQueue:{...reviewQueue,items:[0,1,2,3,4].map(index=>({...reviewQueue.items[0],reviewId:`review-${index}`,candidateId:`cand-${index}`}))},
    };
    const plan=planGateDispatches(many.orchestration,many.reviewQueue,{limit:2});
    expect(plan.dispatches).toHaveLength(2);
    expect(plan.deferred).toBe(3);
  });
});

describe('a gate several agents are blocking is asked one agent at a time',()=>{
  // The blockers come from the producer, not from a hand-typed copy. This is
  // the shape every real gate has: dossierBlockingReasons emits
  // `${agentId}/${claimId}: ${finding}` plus `${agentId}: recommendation is …`
  // per specialist, and five specialists research a mountain trail.
  // Route guidance has to be SATISFIED for this to be the live shape. The live
  // gates have a sourced recommended start -- #608 established that the four
  // route claims were not what was holding them -- and without one
  // dossierBlockingReasons prepends a logistics/recommended-start blocker,
  // which agentFromBlockers answers on its own. So the dossier carries a
  // supported recommended start, and what remains is genuinely several agents'
  // research. (This caught a hand-built fixture that was not the real shape.)
  const SOURCED=[{url:'https://comune.example/start',authority:'Comune di Example',label:'Official route guide'}];
  const cleanLogistics={agentId:'logistics',result:{recommendation:'advance',openQuestions:[],claims:[
    {id:'recommended-start',category:'logistics',finding:'supported-proposal',
     proposedValue:'Start at the lakeside car park.',sources:SOURCED,blockers:[]}]}};
  const outputs=(...rest)=>[cleanLogistics,...rest];
  const multiAgent=()=>dossierBlockingReasons(outputs(
    {agentId:'terrainPoi',result:{recommendation:'block',claims:[
      {id:'shade',finding:'conflicted'},{id:'livestock',finding:'unresolved'},{id:'surface',finding:'conflicted'}]}},
    {agentId:'evidenceLibrarian',result:{recommendation:'block',claims:[
      {id:'provenance',finding:'conflicted'}]}},
    {agentId:'regulatoryRanger',result:{recommendation:'needs-resolution',claims:[
      {id:'dog-access',finding:'unresolved'}]}},
  ));

  test('the live queue shape dispatches, where requiring one agent dispatched nothing',()=>{
    const blockingReasons=multiAgent();
    // Four agents named at once -- the condition that held every gate on 6 Oct.
    expect([...blockerCountsByAgent(blockingReasons).keys()].length).toBeGreaterThan(1);
    expect(agentFromBlockers(blockingReasons)).toBeNull();

    const {orchestration,reviewQueue}=parkedGate({blockingReasons});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.held).toEqual([]);
    // Heaviest load first: terrainPoi carries 4 of the blockers, the others 2.
    expect(plan.dispatches).toEqual([expect.objectContaining({targetAgent:'terrainPoi'})]);
  });

  test('the agent is asked for its own findings and told who holds the rest',()=>{
    const blockingReasons=multiAgent();
    const {orchestration,reviewQueue}=parkedGate({blockingReasons});
    const [dispatch]=planGateDispatches(orchestration,reviewQueue,{}).dispatches;

    // Not asked to answer for work that is not its own.
    expect(dispatch.agentBlockingReasons.every(reason=>reason.startsWith('terrainPoi'))).toBe(true);
    expect(dispatch.note).not.toContain('evidenceLibrarian/provenance');
    // And not left to assume the gate clears when it is done.
    expect(dispatch.note).toContain('evidenceLibrarian');
    expect(dispatch.note).toContain('regulatoryRanger');
    expect(dispatch.outstandingAgents).toEqual(expect.arrayContaining(['terrainPoi','evidenceLibrarian','regulatoryRanger']));
  });

  // osm-16363583 (Le Marais) sat at the dossier gate with a 76 m-open OSM trace
  // the operator's official GPX would replace, flagged by evidenceLibrarian and
  // redTeam. terrainPoi carried more blockers, so the dispatch asked terrainPoi
  // to research shade and livestock against a line that was going to change.
  // Settling the geometry is the cartographer's job regardless of who raised
  // it, and it comes first.
  test('a geometry conflict is the cartographer’s, ahead of a heavier terrain load',()=>{
    const blockingReasons=dossierBlockingReasons(outputs(
      {agentId:'terrainPoi',result:{recommendation:'block',claims:[
        {id:'shade',finding:'conflicted'},{id:'livestock',finding:'unresolved'},
        {id:'surface',finding:'conflicted'},{id:'water',finding:'unresolved'}]}},
      {agentId:'evidenceLibrarian',result:{recommendation:'block',claims:[
        {id:'provenance-geometry-and-distance',finding:'conflicted'}]}},
      {agentId:'redTeam',result:{recommendation:'block',claims:[
        {id:'rt3-osm-line-not-closed-as-rendered',finding:'counter-evidence'}]}},
    ));
    const {orchestration,reviewQueue}=parkedGate({blockingReasons});
    const [dispatch]=planGateDispatches(orchestration,reviewQueue,{}).dispatches;
    expect(dispatch.targetAgent).toBe('cartographer');
    // Scoped to the geometry blockers that routed it here, not terrainPoi's load.
    expect(dispatch.agentBlockingReasons.length).toBeGreaterThan(0);
    expect(dispatch.agentBlockingReasons.every(reason=>/geometry|gpx|osm-line|not-closed/.test(reason))).toBe(true);
    expect(dispatch.note).toContain('provenance-geometry-and-distance');
    expect(dispatch.note).not.toContain('terrainPoi/shade');
    // Still told who holds the rest, so it does not assume the gate clears.
    expect(dispatch.note).toContain('terrainPoi');
  });

  test('the gate converges: once one agent is answered the next is asked',()=>{
    // terrainPoi came back clean; the remaining blockers are the others'.
    const remaining=dossierBlockingReasons(outputs(
      {agentId:'evidenceLibrarian',result:{recommendation:'block',claims:[
        {id:'provenance',finding:'conflicted'},{id:'provenance-waymark',finding:'counter-evidence'}]}},
      {agentId:'regulatoryRanger',result:{recommendation:'needs-resolution',claims:[
        {id:'dog-access',finding:'unresolved'}]}},
    ));
    const {orchestration,reviewQueue}=parkedGate({blockingReasons:remaining});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.dispatches).toEqual([expect.objectContaining({targetAgent:'evidenceLibrarian'})]);
  });

  test('route guidance still outranks a heavier load elsewhere',()=>{
    // Only Logistics can supply route guidance, and it is the one unwaivable
    // blocker, so it is asked even when another agent carries more findings.
    // No clean logistics output here, so the producer itself supplies the
    // route-guidance blocker alongside a heavier terrain load.
    const blockingReasons=dossierBlockingReasons([
      {agentId:'terrainPoi',result:{recommendation:'block',claims:[
        {id:'shade',finding:'conflicted'},{id:'livestock',finding:'unresolved'},
        {id:'surface',finding:'conflicted'},{id:'water',finding:'unresolved'}]}},
    ]);
    expect(blockingReasons).toEqual(expect.arrayContaining(ROUTE_GUIDANCE));
    const {orchestration,reviewQueue}=parkedGate({blockingReasons});
    const [dispatch]=planGateDispatches(orchestration,reviewQueue,{}).dispatches;
    expect(dispatch.targetAgent).toBe('logistics');
  });

  test('a per-agent attempt limit still holds the gate',()=>{
    const blockingReasons=multiAgent();
    const {orchestration,reviewQueue}=parkedGate({blockingReasons,resolutionAttempts:{terrainPoi:RESOLUTION_ATTEMPT_LIMIT}});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.dispatches).toEqual([]);
    expect(plan.held.map(entry=>entry.reason)).toEqual(['resolution-attempts-exhausted']);
  });
});

// The whole value of this pass is that it runs before the apply step: a gate
// dispatched after it would wait for the next cron, three hours later.
test('the worker dispatches before it applies decisions',()=>{
  const worker=fs.readFileSync(path.join(__dirname,'workflows/run-live-backoffice-worker.js'),'utf8');
  const dispatch=worker.indexOf('await dispatchUnansweredGates(store');
  const ingest=worker.indexOf('await ingestDossierReviews(store)');
  expect(dispatch).toBeGreaterThan(-1);
  expect(ingest).toBeGreaterThan(dispatch);
});
