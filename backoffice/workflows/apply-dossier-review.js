'use strict';

const { createAgentJob }=require('../contracts/agent-job-v1');
const { summarize }=require('./build-live-orchestration');
const {fitReviewQueue}=require('./review-queue-compaction');
const {compileVerifiedDossier,verificationRecord,unacceptedBlockers,waivableBlocker}=require('./compile-verified-dossier');
const {retirementFields}=require('./retire-blocked-jobs');

const BASE_SPECIALISTS=Object.freeze([
  // Route guidance is logistics' work too, and the output contract has demanded
  // it since 2026-09-04. Asking only for parking while throwing the result away
  // for lacking directions is why both trails at the dossier gate carry a
  // parking-only dossier: the agent answered the question it was given.
  {agentId:'logistics',action:'verify-access-and-route-guidance',
    claimIds:['parking','road-access','pedestrian-connection',
      'recommended-start','route-number-status','route-number-sequence','route-number-switches']},
  // The Ranger already establishes route-level dog rules from published
  // sources. Rifugio and lift policies are the same work at entity
  // granularity, so they belong to the same specialist and the same human
  // gate rather than to a separate manual exercise.
  {agentId:'regulatoryRanger',action:'verify-dog-and-seasonal-rules',
    claimIds:['dog-access','leash-rules','seasonal-restrictions','rifugio-dog-policy','lift-dog-policy']},
  {agentId:'terrainPoi',action:'verify-terrain-water-heat-and-livestock',claimIds:[
    'elevation','shade','surface','water','mountain-huts','food-drink','other-places','exposure','livestock','animals',
  ]},
]);

function specialistJob(trail,spec,attempt,at){
  const job=createAgentJob({id:`trail-verification-${trail.trailId}-${spec.agentId}-${attempt}-${at.replace(/[:.]/g,'-')}`,
    agentId:spec.agentId,action:spec.action,candidateId:trail.candidateId,claimIds:spec.claimIds,
    inputRefs:[`production-trails/${trail.trailId}`,trail.latestOutputRef].filter(Boolean),
    requestedBy:'trail-orchestrator-v1'}, {at});
  return {...job,jobType:'trail-verification-specialist',attempt,publicMutationAllowed:false};
}

function applyDossierReview(orchestration,reviewQueue,decision,options={}){
  const at=options.at||new Date().toISOString();
  if(!['approve','request-revision','reject'].includes(decision.action)) throw new Error('Invalid dossier review action');
  const review=(reviewQueue.items||[]).find(item=>item.reviewId===decision.reviewId&&item.state==='awaiting-human');
  if(!review) throw new Error('Dossier review item is no longer awaiting a decision');
  // Approval no longer means "nothing to ask", which never happened. It means
  // every blocker has been addressed: cleared by the agents, or accepted by the
  // moderator with a reason that is kept with the verification.
  if(decision.action==='approve'){
    const standing=unacceptedBlockers(review,decision.acceptedBlockers);
    if(standing.length){
      const unwaivable=standing.filter(reason=>!waivableBlocker(reason));
      throw new Error(unwaivable.length
        ? `Critical route or geometry evidence cannot be accepted, only supplied: ${unwaivable.join('; ')}`
        : `This dossier has blockers that were not addressed: ${standing.join('; ')}`);
    }
  }
  if(decision.action==='request-revision'&&!String(decision.note||'').trim()) throw new Error('A precise revision instruction is required');
  const trail=orchestration.trails.find(item=>item.candidateId===review.candidateId);
  if(!trail) throw new Error('Orchestration trail was not found');
  const next=JSON.parse(JSON.stringify(orchestration)); const nextTrail=next.trails.find(item=>item.candidateId===trail.candidateId);
  const jobs=[];const cancelJobIds=[];let verifiedDossier=null;let verifiedRecord=null;
  if(decision.action==='reject'){
    nextTrail.state='rejected'; nextTrail.gate={...nextTrail.gate,status:'rejected',reviewedAt:at};
    // A rejected trail is finished, and work queued against it is not. Nothing
    // used to stop those jobs: giro-del-bulacia was rejected holding five, and
    // the worker has no guard that skips a job for a dead trail, so they would
    // have been claimed and run -- agent calls and Firestore writes spent on a
    // trail nobody will publish, out of a budget that is the thing capping the
    // pipeline.
    //
    // The ids only; whether each is still queued is the caller's to read, and a
    // job already running is left to finish rather than abandoned half-done.
    cancelJobIds.push(...(nextTrail.jobIds||[]));
  }else if(decision.action==='approve'&&review.gateType==='geometry-approval'){
    nextTrail.state='evidence-research'; nextTrail.stage='parallel-evidence-research';
    nextTrail.gate={...nextTrail.gate,status:'approved',reviewedAt:at};
    for(const spec of BASE_SPECIALISTS){const attempt=(nextTrail.attempts[spec.agentId]||0)+1;nextTrail.attempts[spec.agentId]=attempt;const job=specialistJob(nextTrail,spec,attempt,at);jobs.push(job);nextTrail.jobIds.push(job.id);}
  }else if(decision.action==='approve'){
    nextTrail.state='ready-for-editorial'; nextTrail.stage='verified-dossier-approved';
    nextTrail.gate={...nextTrail.gate,status:'approved',reviewedAt:at};
    nextTrail.verificationStatus='orma-verified';nextTrail.verifiedAt=at;
    verifiedDossier=compileVerifiedDossier(review,nextTrail,{at,acceptedBlockers:decision.acceptedBlockers,
      verifiedBy:decision.submittedBy||decision.reviewedBy||'human-moderator'});
    verifiedRecord=verificationRecord(verifiedDossier);
  }else{
    const agentId=decision.targetAgent||'cartographer';
    nextTrail.resolutionAttempts=nextTrail.resolutionAttempts||{};
    const resolutionAttempt=(nextTrail.resolutionAttempts[agentId]||0)+1;
    nextTrail.resolutionAttempts[agentId]=resolutionAttempt;
    if(resolutionAttempt>5){nextTrail.state='blocked';nextTrail.blockers=[...(nextTrail.blockers||[]),'automated-resolution-attempts-exhausted'];}
    else{
      const attempt=(nextTrail.attempts[agentId]||0)+1;
      nextTrail.attempts[agentId]=attempt; nextTrail.state=agentId==='cartographer'?'geometry-audit':'evidence-research';
      nextTrail.stage=`${agentId}-revision`; const spec=agentId==='cartographer'
        ?{agentId,action:'revise-route-audit',claimIds:['route-identity','route-geometry']}
        :{agentId,action:'resolve-human-review-note',claimIds:[]};
      const job=specialistJob(nextTrail,spec,attempt,at);job.instruction=String(decision.note).trim().slice(0,1500);job.resolutionAttempt=resolutionAttempt;
      jobs.push(job);nextTrail.jobIds.push(job.id);nextTrail.pendingRevisionJobId=job.id;
      nextTrail.gate={...nextTrail.gate,status:'revision-requested',reviewedAt:at};
    }
  }
  nextTrail.updatedAt=at; next.generatedAt=at; next.summary=summarize(next.trails);
  // compileVerifiedDossier above read the full review, so the evidence has
  // already done its work by the time the decided item gives it up.
  const nextQueue=fitReviewQueue({...reviewQueue,updatedAt:at,items:reviewQueue.items.map(item=>item.reviewId===review.reviewId
    ?{...item,state:'processed',decision:{...decision,reviewedAt:at},publicMutationAllowed:false}:item)});
  return {orchestration:next,reviewQueue:nextQueue,jobs,cancelJobIds,verifiedDossier,verifiedRecord};
}

const REJECTED_TRAIL_REASON='the trail was rejected at the dossier gate';

/** Stop the jobs a rejected trail still owns. Queued only: a running job finishes. */
async function cancelJobsForRejectedTrail(store,cancelJobIds,at){
  if(!cancelJobIds||!cancelJobIds.length)return [];
  const jobs=await store.getJobsByIds(cancelJobIds);
  const stopped=[];
  for(const job of jobs){
    if(!job||job.status!=='queued')continue;
    await store.completeSystemJob(job.id,retirementFields(REJECTED_TRAIL_REASON,at,'queued'));
    stopped.push(job.id);
  }
  return stopped;
}

/**
 * The same invariant, enforced continuously rather than only at the moment of
 * rejection: a rejected trail owns no queued work.
 *
 * Fixing the transition alone would leave the jobs already orphaned by earlier
 * rejections exactly where they are -- five of them, on a trail rejected before
 * this existed -- and would miss any future route to `rejected` that does not
 * run through applyDossierReview. Reading an artifact the pass already has
 * costs nothing when there is nothing to stop.
 */
async function cancelOrphanedRejectedJobs(store,orchestration,at){
  const rejected=(orchestration?.trails||[]).filter(trail=>trail.state==='rejected');
  const ids=rejected.flatMap(trail=>trail.jobIds||[]);
  if(!ids.length)return [];
  return cancelJobsForRejectedTrail(store,ids,at);
}

module.exports={BASE_SPECIALISTS,REJECTED_TRAIL_REASON,specialistJob,applyDossierReview,
  cancelJobsForRejectedTrail,cancelOrphanedRejectedJobs};
