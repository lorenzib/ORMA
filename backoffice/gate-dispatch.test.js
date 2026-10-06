'use strict';

const fs=require('fs');
const path=require('path');
const {planGateDispatches,RESOLUTION_ATTEMPT_LIMIT}=require('./workflows/dispatch-unanswered-gates');
const {dispatchUnansweredGates,ingestDossierReviews}=require('./workflows/run-live-backoffice-worker');
const {routeGuidanceBlockingReasons}=require('./workflows/compile-verified-dossier');

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

  test('blockers that name no single agent are a decision, not a dispatch',()=>{
    const {orchestration,reviewQueue}=parkedGate({blockingReasons:['not-closed-loop']});
    const plan=planGateDispatches(orchestration,reviewQueue,{});
    expect(plan.dispatches).toEqual([]);
    expect(held(plan)).toEqual(['blockers-do-not-name-one-agent']);
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

// The whole value of this pass is that it runs before the apply step: a gate
// dispatched after it would wait for the next cron, three hours later.
test('the worker dispatches before it applies decisions',()=>{
  const worker=fs.readFileSync(path.join(__dirname,'workflows/run-live-backoffice-worker.js'),'utf8');
  const dispatch=worker.indexOf('await dispatchUnansweredGates(store');
  const ingest=worker.indexOf('await ingestDossierReviews(store)');
  expect(dispatch).toBeGreaterThan(-1);
  expect(ingest).toBeGreaterThan(dispatch);
});
