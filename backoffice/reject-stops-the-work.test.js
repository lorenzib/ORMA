'use strict';

// giro-del-bulacia was rejected at the dossier gate holding five queued jobs.
// Nothing cancelled them, and the worker has no guard that skips a job for a
// dead trail, so they would have been claimed and run: agent calls and
// Firestore writes spent on a trail nobody will publish, out of the budget
// that is currently the thing capping the pipeline.

const {applyDossierReview,cancelJobsForRejectedTrail,cancelOrphanedRejectedJobs,
  REJECTED_TRAIL_REASON}=require('./workflows/apply-dossier-review');

const trail=(over={})=>({candidateId:'c1',trailId:'t1',trailName:'A trail',state:'dossier-human-gate',
  stage:'complete-evidence-dossier',attempts:{},jobIds:['j1','j2','j3'],blockers:[],
  sourceTrail:{},gate:{status:'awaiting-human'},...over});
const review=(over={})=>({reviewId:'r1',candidateId:'c1',trailId:'t1',gateType:'dossier-approval',
  state:'awaiting-human',approvalAllowed:false,blockingReasons:[],specialistOutputs:[],
  allowedActions:['approve','request-revision','reject'],...over});
const setup=(over={})=>({orchestration:{trails:[trail(over.trail||{})],generatedAt:'x'},
  reviewQueue:{items:[review(over.review||{})]}});

const store=(jobs)=>{
  const completed=[];
  return {completed,
    getJobsByIds:async ids=>jobs.filter(job=>ids.includes(job.id)),
    completeSystemJob:async (id,fields)=>{completed.push({id,...fields});}};
};

describe('rejecting a trail stops the work queued against it',()=>{
  test('the decision names every job the trail owns',()=>{
    const {orchestration,reviewQueue}=setup();
    const result=applyDossierReview(orchestration,reviewQueue,
      {reviewId:'r1',action:'reject'},{at:'2026-10-07T12:00:00.000Z'});
    expect(result.orchestration.trails[0].state).toBe('rejected');
    expect(result.cancelJobIds).toEqual(['j1','j2','j3']);
  });

  test('and only the queued ones are actually stopped',async()=>{
    const s=store([
      {id:'j1',status:'queued'},
      {id:'j2',status:'running'},
      {id:'j3',status:'completed'},
    ]);
    const stopped=await cancelJobsForRejectedTrail(s,['j1','j2','j3'],'2026-10-07T12:00:00.000Z');
    expect(stopped).toEqual(['j1']);
    expect(s.completed).toEqual([{id:'j1',retiredReason:REJECTED_TRAIL_REASON,
      retiredAt:'2026-10-07T12:00:00.000Z',retiredFrom:'queued'}]);
  });

  // A job mid-flight is left to finish: abandoning it half-done would lose the
  // output it is about to write and leave the claim dangling.
  test('a running job is left alone',async()=>{
    const s=store([{id:'j1',status:'running'}]);
    expect(await cancelJobsForRejectedTrail(s,['j1'],'2026-10-07T12:00:00.000Z')).toEqual([]);
    expect(s.completed).toEqual([]);
  });

  test('the reason survives on the job, so the stop is not silent',async()=>{
    const s=store([{id:'j1',status:'queued'}]);
    await cancelJobsForRejectedTrail(s,['j1'],'2026-10-07T12:00:00.000Z');
    expect(s.completed[0].retiredReason).toMatch(/rejected at the dossier gate/);
  });
});

describe('every other decision leaves the queue alone',()=>{
  test('approving a geometry gate queues work and cancels none',()=>{
    const {orchestration,reviewQueue}=setup({
      trail:{state:'geometry-human-gate'},
      review:{gateType:'geometry-approval',approvalAllowed:true},
    });
    const result=applyDossierReview(orchestration,reviewQueue,
      {reviewId:'r1',action:'approve'},{at:'2026-10-07T12:00:00.000Z'});
    expect(result.cancelJobIds).toEqual([]);
    expect(result.jobs.length).toBeGreaterThan(0);
  });

  // Revision is the opposite of rejection: it exists to send work back.
  test('requesting a revision cancels nothing',()=>{
    const {orchestration,reviewQueue}=setup();
    const result=applyDossierReview(orchestration,reviewQueue,
      {reviewId:'r1',action:'request-revision',targetAgent:'logistics',note:'Find the start.'},
      {at:'2026-10-07T12:00:00.000Z'});
    expect(result.cancelJobIds).toEqual([]);
  });

  test('a trail with no jobs rejects without touching the store',async()=>{
    const {orchestration,reviewQueue}=setup({trail:{jobIds:[]}});
    const result=applyDossierReview(orchestration,reviewQueue,
      {reviewId:'r1',action:'reject'},{at:'2026-10-07T12:00:00.000Z'});
    expect(result.cancelJobIds).toEqual([]);
    const s=store([]);
    expect(await cancelJobsForRejectedTrail(s,result.cancelJobIds,'x')).toEqual([]);
  });
});

// Fixing only the transition would leave the already-orphaned jobs where they
// are, and miss any future route to `rejected` that does not run through
// applyDossierReview. The invariant is enforced every pass instead.
describe('a rejected trail owns no queued work, on any pass',()=>{
  const store=(jobs)=>{
    const completed=[];
    return {completed,
      getJobsByIds:async ids=>jobs.filter(job=>ids.includes(job.id)),
      completeSystemJob:async (id,fields)=>{completed.push({id,...fields});}};
  };
  const orch=trails=>({trails});

  test('jobs orphaned by an earlier rejection are stopped',async()=>{
    const s=store([{id:'j1',status:'queued'},{id:'j2',status:'queued'}]);
    const stopped=await cancelOrphanedRejectedJobs(s,
      orch([{candidateId:'giro',state:'rejected',jobIds:['j1','j2']}]),'2026-10-07T12:00:00.000Z');
    expect(stopped).toEqual(['j1','j2']);
  });

  test('a trail still in the pipeline keeps its work',async()=>{
    const s=store([{id:'j1',status:'queued'}]);
    expect(await cancelOrphanedRejectedJobs(s,
      orch([{candidateId:'live',state:'evidence-research',jobIds:['j1']}]),'x')).toEqual([]);
    expect(s.completed).toEqual([]);
  });

  test('and a pass with nothing rejected reads no jobs at all',async()=>{
    let read=false;
    const s={getJobsByIds:async()=>{read=true;return [];},completeSystemJob:async()=>{}};
    expect(await cancelOrphanedRejectedJobs(s,orch([{state:'red-team',jobIds:[]}]),'x')).toEqual([]);
    expect(read).toBe(false);
  });

  test('a missing orchestration is not an error',async()=>{
    const s=store([]);
    expect(await cancelOrphanedRejectedJobs(s,null,'x')).toEqual([]);
  });
});
