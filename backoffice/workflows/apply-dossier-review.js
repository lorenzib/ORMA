'use strict';

const { createAgentJob }=require('../contracts/agent-job-v1');
const { summarize }=require('./build-live-orchestration');
const {compileVerifiedDossier,verificationRecord}=require('./compile-verified-dossier');

const BASE_SPECIALISTS=Object.freeze([
  {agentId:'logistics',action:'verify-parking-and-access',claimIds:['parking','road-access','pedestrian-connection']},
  // The Ranger already establishes route-level dog rules from published
  // sources. Rifugio and lift policies are the same work at entity
  // granularity, so they belong to the same specialist and the same human
  // gate rather than to a separate manual exercise.
  {agentId:'regulatoryRanger',action:'verify-dog-and-seasonal-rules',
    claimIds:['dog-access','leash-rules','seasonal-restrictions','rifugio-dog-policy','lift-dog-policy']},
  {agentId:'terrainPoi',action:'verify-terrain-water-heat-and-livestock',claimIds:['elevation','shade','surface','water','exposure','livestock']},
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
  if(decision.action==='approve'&&!review.approvalAllowed) throw new Error('This dossier has blockers and cannot be approved');
  if(decision.action==='request-revision'&&!String(decision.note||'').trim()) throw new Error('A precise revision instruction is required');
  const trail=orchestration.trails.find(item=>item.candidateId===review.candidateId);
  if(!trail) throw new Error('Orchestration trail was not found');
  const next=JSON.parse(JSON.stringify(orchestration)); const nextTrail=next.trails.find(item=>item.candidateId===trail.candidateId);
  const jobs=[];let verifiedDossier=null;let verifiedRecord=null;
  if(decision.action==='reject'){
    nextTrail.state='rejected'; nextTrail.gate={...nextTrail.gate,status:'rejected',reviewedAt:at};
  }else if(decision.action==='approve'&&review.gateType==='geometry-approval'){
    nextTrail.state='evidence-research'; nextTrail.stage='parallel-evidence-research';
    nextTrail.gate={...nextTrail.gate,status:'approved',reviewedAt:at};
    for(const spec of BASE_SPECIALISTS){const attempt=(nextTrail.attempts[spec.agentId]||0)+1;nextTrail.attempts[spec.agentId]=attempt;const job=specialistJob(nextTrail,spec,attempt,at);jobs.push(job);nextTrail.jobIds.push(job.id);}
  }else if(decision.action==='approve'){
    nextTrail.state='ready-for-editorial'; nextTrail.stage='verified-dossier-approved';
    nextTrail.gate={...nextTrail.gate,status:'approved',reviewedAt:at};
    nextTrail.verificationStatus='orma-verified';nextTrail.verifiedAt=at;
    verifiedDossier=compileVerifiedDossier(review,nextTrail,{at,verifiedBy:decision.submittedBy||decision.reviewedBy||'human-moderator'});
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
  const nextQueue={...reviewQueue,updatedAt:at,items:reviewQueue.items.map(item=>item.reviewId===review.reviewId
    ?{...item,state:'processed',decision:{...decision,reviewedAt:at},publicMutationAllowed:false}:item)};
  return {orchestration:next,reviewQueue:nextQueue,jobs,verifiedDossier,verifiedRecord};
}

module.exports={BASE_SPECIALISTS,specialistJob,applyDossierReview};
