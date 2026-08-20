'use strict';

const { validateTrailOrchestration } = require('../contracts/trail-orchestration-v1');

function summarize(trails){
  const states={}; for(const trail of trails) states[trail.state]=(states[trail.state]||0)+1;
  return { trails:trails.length, states, awaitingHuman:trails.filter(trail=>trail.state.endsWith('human-gate')).length,
    running:trails.filter(trail=>['geometry-audit','evidence-research','evidence-resolution','provenance-audit','red-team'].includes(trail.state)).length };
}

function seedOrchestrationFromCatalogue(campaign,execution,outputsByCandidate,options={}){
  const at=options.at||new Date().toISOString();
  const items=new Map((campaign.items||[]).map(item=>[item.trailId,item]));
  const trails=(execution.jobs||[]).map(job=>{
    const item=items.get(job.candidateId)||{}; const output=outputsByCandidate[job.candidateId];
    return { trailId:job.candidateId, candidateId:job.candidateId, trailName:item.name||job.candidateId,
      state:'geometry-human-gate', stage:'route-identity-and-geometry', priorityScore:item.priorityScore||0,
      sourceTrail:{origin:item.origin||null,externalRelationId:item.externalRelationId||null,baselineBlockers:item.baselineBlockers||[]},
      attempts:{cartographer:1}, resolutionAttempts:{}, jobIds:[job.id], currentJobId:job.id,
      gate:{id:'geometry-approval',status:'awaiting-human',openedAt:job.completedAt||at},
      latestOutputRef:(job.outputRefs||[])[0]||null,
      blockers:output?.blockers||job.blockers||[], publicMutationAllowed:false, updatedAt:at };
  });
  const artifact={contractVersion:'1.0.0',generatedAt:at,campaignGeneratedAt:campaign.generatedAt,
    publicMutationAllowed:false,trails,summary:summarize(trails)};
  const errors=validateTrailOrchestration(artifact); if(errors.length) throw new Error(errors.join('; '));
  return artifact;
}

function buildDossierReviewQueue(orchestration,outputsByCandidate,options={}){
  const at=options.at||new Date().toISOString();
  const items=orchestration.trails.filter(trail=>trail.state.endsWith('human-gate')).map(trail=>{
    const output=outputsByCandidate[trail.candidateId]||null;
    return { reviewId:`${trail.gate.id}-${trail.candidateId}`,candidateId:trail.candidateId,trailId:trail.trailId,
      trailName:trail.trailName,gateType:trail.gate.id,state:'awaiting-human',openedAt:trail.gate.openedAt,
      approvalAllowed:trail.gate.id==='geometry-approval' ? output?.reviewState==='ready-for-human-review' && !(output.blockers||[]).length : true,
      blockingReasons:output?.blockers||trail.blockers||[],sourceTrail:trail.sourceTrail,
      specialistOutputs:output?[{agentId:output.agentId||'cartographer',jobId:trail.currentJobId,result:output}]:[],
      allowedActions:['approve','request-revision','reject'],publicMutationAllowed:false };
  });
  return {contractVersion:'1.0.0',generatedAt:at,publicMutationAllowed:false,items,
    summary:{awaitingHuman:items.length,approvalAllowed:items.filter(item=>item.approvalAllowed).length,blocked:items.filter(item=>!item.approvalAllowed).length}};
}

module.exports={summarize,seedOrchestrationFromCatalogue,buildDossierReviewQueue};
