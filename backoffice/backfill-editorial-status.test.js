'use strict';

// Replaying decisions that were recorded but never applied to their output.
//
// The claim this file has to make checkable is that the backfill decides
// nothing: a status moves only where a processed submission already decided it,
// it is idempotent, and it refuses rather than writing an artifact the worker's
// own validator would reject.

const {planEditorialStatusBackfill,decidedOutcomes}=require('./workflows/backfill-editorial-status');
const {main}=require('./cli/backfill-editorial-status');

const output=(jobId,agentId='copywriter',status='ready-for-review')=>
  ({jobId,agentId,candidateId:jobId.replace(/-(copy|visual)$/,''),status,result:{title:'A walk',changes:[]}});

const execution=(outputs)=>({contractVersion:'1.0.0',generatedAt:'2026-08-20T00:00:00Z',mode:'draft-only',
  stage:'verified-trail-editorial-review',executionOrigin:'live-orma-verified-handoff',
  sourceQueue:'firestore:verified-trail-editorial-queue',
  publicMutationAllowed:false,publicationAuthorized:false,outputs,
  summary:{trails:1,readyForReview:outputs.length,blocked:0,publicationReady:0}});

const submission=(submissionId,decisions,extra={})=>({submissionId,status:'processed',
  submittedAt:'2026-08-21T00:00:00Z',decisions,
  outcomes:decisions.map(decision=>({jobId:decision.jobId,action:decision.action,
    status:decision.action==='approve'?'editorial-approved':'revision-queued'})),...extra});

// The live shape: the copy and visual jobs of the three published trails, all
// approved in August and all still reading ready-for-review on 7 October.
const LIVE_JOBS=['verified-osm-relation-1484751','verified-osm-relation-6678431','verified-osm-way-25736154']
  .flatMap(prefix=>[`${prefix}-copy`,`${prefix}-visual`]);

function liveState(){
  const outputs=LIVE_JOBS.map(jobId=>output(jobId,jobId.endsWith('-visual')?'visualDirector':'copywriter'));
  const reviewQueue={submissions:LIVE_JOBS.map((jobId,index)=>submission(`sub-${index}`,
    [{jobId,action:'approve'}],
    {outcomes:[{jobId,action:'approve',
      status:jobId.endsWith('-visual')?'asset-and-licensing-approved':'editorial-approved'}]}))};
  return {execution:execution(outputs),reviewQueue};
}

describe('what the backfill moves',()=>{
  test('the six live outputs each take the status their decision recorded',()=>{
    const {execution:current,reviewQueue}=liveState();
    const plan=planEditorialStatusBackfill(current,reviewQueue);
    expect(plan.moves).toHaveLength(6);
    expect(plan.next.summary.readyForReview).toBe(0);
    // Copy and visual are different decisions and must not be conflated.
    const byJob=new Map(plan.next.outputs.map(entry=>[entry.jobId,entry.status]));
    expect(byJob.get('verified-osm-relation-1484751-copy')).toBe('editorial-approved');
    expect(byJob.get('verified-osm-relation-1484751-visual')).toBe('asset-and-licensing-approved');
    expect(plan.errors).toEqual([]);
  });

  test('an output nobody decided on is left exactly as it is',()=>{
    const current=execution([output('a-copy'),output('b-copy')]);
    const plan=planEditorialStatusBackfill(current,{submissions:[submission('s1',[{jobId:'a-copy',action:'approve'}])]});
    expect(plan.moves.map(move=>move.jobId)).toEqual(['a-copy']);
    expect(plan.next.outputs[1].status).toBe('ready-for-review');
  });

  test('a decision that was never applied does not move its output',()=>{
    // A queued or blocked submission is a decision that has not been applied.
    // Backfilling it would apply it -- which is deciding, not replaying.
    const current=execution([output('a-copy'),output('b-copy')]);
    const plan=planEditorialStatusBackfill(current,{submissions:[
      submission('queued',[{jobId:'a-copy',action:'approve'}],{status:'queued'}),
      submission('blocked',[{jobId:'b-copy',action:'approve'}],{status:'blocked'}),
    ]});
    expect(plan.moves).toEqual([]);
    expect(plan.changed).toBe(false);
    expect(plan.decidedOutputs).toBe(0);
  });

  test('the last decision wins, as it does for staging',()=>{
    // Same rule as latestDecisions, which this reuses, so the backfill and the
    // staging builder cannot disagree about which decision is current.
    const current=execution([output('a-copy')]);
    const plan=planEditorialStatusBackfill(current,{submissions:[
      submission('first',[{jobId:'a-copy',action:'request-revision'}]),
      submission('second',[{jobId:'a-copy',action:'approve'}]),
    ]});
    expect(plan.moves[0]).toEqual(expect.objectContaining({to:'editorial-approved',submissionId:'second'}));
  });

  test('running it again moves nothing',()=>{
    const {execution:current,reviewQueue}=liveState();
    const once=planEditorialStatusBackfill(current,reviewQueue);
    const twice=planEditorialStatusBackfill(once.next,reviewQueue);
    expect(twice.moves).toEqual([]);
    expect(twice.changed).toBe(false);
    // And it still knows the outputs were decided, so "nothing to move" is
    // distinguishable from "nothing was decided".
    expect(twice.decidedOutputs).toBe(6);
  });

  test('a submission with no stored outcome is recomputed, and says so',()=>{
    const current=execution([output('a-copy')]);
    const plan=planEditorialStatusBackfill(current,
      {submissions:[{submissionId:'old',status:'processed',decisions:[{jobId:'a-copy',action:'approve'}]}]});
    expect(plan.moves[0]).toEqual(expect.objectContaining({to:'editorial-approved',source:'recomputed'}));
  });

  test('the stored outcome is preferred over a recomputed one',()=>{
    // It is what was actually recorded at the time. Recomputing could differ if
    // the rules moved since, and the historical decision is the truth here.
    const current=execution([output('a-copy')]);
    const outcomes=decidedOutcomes(current,{submissions:[submission('s1',[{jobId:'a-copy',action:'approve'}])]});
    expect(outcomes[0]).toEqual(expect.objectContaining({status:'editorial-approved'}));
    expect(outcomes[0].recomputed).toBeUndefined();
  });
});

describe('the CLI',()=>{
  function fakeStore(current,reviewQueue){
    const artifacts={'verified-trail-editorial-execution':current,'content-review-queue':reviewQueue};
    const writes=[];
    return {artifacts,writes,
      getArtifact:async id=>artifacts[id]??null,
      setArtifact:async(id,value,meta)=>{writes.push({id,meta});artifacts[id]=value;}};
  }

  test('writes nothing without --apply',async()=>{
    const {execution:current,reviewQueue}=liveState();
    const store=fakeStore(current,reviewQueue);
    const plan=await main({store,apply:false});
    expect(plan.moves).toHaveLength(6);
    expect(store.writes).toEqual([]);
    expect(store.artifacts['verified-trail-editorial-execution'].outputs[0].status).toBe('ready-for-review');
  });

  test('writes exactly the plan it printed with --apply',async()=>{
    const {execution:current,reviewQueue}=liveState();
    const store=fakeStore(current,reviewQueue);
    const plan=await main({store,apply:true});
    expect(store.writes).toEqual([{id:'verified-trail-editorial-execution',
      meta:{lastWorkerId:'editorial-status-backfill'}}]);
    expect(store.artifacts['verified-trail-editorial-execution']).toBe(plan.next);
    expect(plan.next.summary.readyForReview).toBe(0);
  });

  test('a missing execution artifact is not an error',async()=>{
    const store=fakeStore(null,{submissions:[]});
    expect((await main({store,apply:true})).moves).toEqual([]);
    expect(store.writes).toEqual([]);
  });
});
