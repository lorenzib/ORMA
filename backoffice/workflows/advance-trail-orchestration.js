'use strict';

const {specialistJob}=require('./apply-dossier-review');
const {summarize}=require('./build-live-orchestration');
const {routeGuidanceBlockingReasons}=require('./compile-verified-dossier');
const {
  MAX_AUTOMATED_ATTEMPTS,resolutionCandidates,ensureResolutionEntries,pendingAttempt,
  completedAttempts,reconcileCompletedAttempt,addQueuedAttempt,
}=require('./claim-resolution');

const BASE_AGENTS=Object.freeze(['logistics','regulatoryRanger','terrainPoi']);

function timeValue(value){if(!value)return 0;if(typeof value.toMillis==='function')return value.toMillis();if(Number.isFinite(value.seconds))return value.seconds*1000;return new Date(value).valueOf()||0;}

function latest(jobs,candidateId,agentId,status='completed'){
  return jobs.filter(job=>job.candidateId===candidateId&&job.agentId===agentId&&job.status===status)
    .sort((a,b)=>timeValue(b.completedAt||b.createdAt)-timeValue(a.completedAt||a.createdAt))[0]||null;
}

function dossierBlockingReasons(outputs){
  const reasons=routeGuidanceBlockingReasons(outputs);
  for(const output of outputs){
    const result=output.result||{};
    if(result.recommendation&&result.recommendation!=='advance') reasons.push(`${output.agentId}: recommendation is ${result.recommendation}`);
    for(const question of result.openQuestions||[]) reasons.push(`${output.agentId}: open question — ${question}`);
    for(const claim of result.claims||[]){
      if(['conflicted','unresolved','counter-evidence'].includes(claim.finding)) reasons.push(`${output.agentId}/${claim.id}: ${claim.finding}`);
      if(claim.resolution?.state==='source-exhausted') reasons.push(`${output.agentId}/${claim.id}: five automated resolution strategies exhausted`);
      for(const blocker of claim.blockers||[]) reasons.push(`${output.agentId}/${claim.id}: ${blocker}`);
    }
  }
  return [...new Set(reasons)];
}

function resolutionLedger(trail){return Object.values(trail.claimResolution||{});}

function queueProvenanceAudit(trail,jobs,queued,at){
  const base=BASE_AGENTS.map(agent=>latest(jobs,trail.candidateId,agent));
  if(base.some(job=>!job))return false;
  const attempt=(trail.attempts.evidenceLibrarian||0)+1;trail.attempts.evidenceLibrarian=attempt;
  const job=specialistJob(trail,{agentId:'evidenceLibrarian',action:'audit-specialist-evidence',claimIds:['provenance']},attempt,at);
  job.inputRefs=base.map(item=>`firestore:trail-specialist-output-${item.id}`);
  queued.push(job);trail.jobIds.push(job.id);trail.state='provenance-audit';trail.stage='source-provenance-audit';trail.updatedAt=at;
  return true;
}

function queueClaimResolution(trail,entry,jobs,queued,at){
  const executionAttempt=(trail.attempts[entry.agentId]||0)+1;trail.attempts[entry.agentId]=executionAttempt;
  const job=specialistJob(trail,{agentId:entry.agentId,action:'resolve-unresolved-claim',claimIds:[entry.claimId]},executionAttempt,at);
  const attempt=addQueuedAttempt(entry,job,at);
  job.jobType='trail-claim-resolution';job.resolutionAttempt=attempt.attemptNumber;
  job.maximumResolutionAttempts=MAX_AUTOMATED_ATTEMPTS;job.resolutionKey=entry.key;
  job.resolutionStrategy=attempt.strategy;job.resolutionStrategyLabel=attempt.strategyLabel;
  job.resolutionInstruction=attempt.instruction;job.notBefore=attempt.notBefore;
  job.inputRefs=[...new Set([...(job.inputRefs||[]),entry.latestOutputRef].filter(Boolean))];
  queued.push(job);trail.jobIds.push(job.id);return job;
}

async function reconcileResolutionAttempts(store,trail,jobs,at){
  let changed=false;
  for(const entry of resolutionLedger(trail)){
    for(const attempt of entry.attempts||[]){
      if(attempt.status!=='queued')continue;
      const job=jobs.find(item=>item.id===attempt.jobId&&item.status==='completed');if(!job)continue;
      const result=await store.getArtifact(`trail-specialist-output-${job.id}`);if(!result)continue;
      if(reconcileCompletedAttempt(entry,job,result,at))changed=true;
    }
  }
  return changed;
}

async function advanceTrailOrchestration(store,options={}){
  const at=options.at||new Date().toISOString(); const state=await store.getArtifact('trail-orchestration');
  if(!state)return {advanced:[],queued:[]};
  const jobs=await store.listJobs(['queued','running','completed','ready-for-review','blocked','approved','rejected','revision-requested']);
  const reviewQueue=await store.getArtifact('dossier-review-queue')||{contractVersion:'1.0.0',items:[],publicMutationAllowed:false};
  const next=JSON.parse(JSON.stringify(state)); const nextQueue=JSON.parse(JSON.stringify(reviewQueue)); const queued=[]; const advanced=[];
  for(const trail of next.trails){
    const latestTrailJobs=new Map();for(const job of jobs.filter(item=>trail.jobIds.includes(item.id))){
      const current=latestTrailJobs.get(job.agentId);if(!current||timeValue(job.createdAt)>timeValue(current.createdAt))latestTrailJobs.set(job.agentId,job);
    }
    const failed=[...latestTrailJobs.values()].filter(job=>job.status==='blocked')
      .sort((a,b)=>timeValue(b.createdAt)-timeValue(a.createdAt))[0];
    if(failed&&!trail.state.endsWith('human-gate')){
      trail.state=failed.agentId==='cartographer'?'geometry-human-gate':'dossier-human-gate';trail.stage='agent-execution-failure';
      trail.blockers=[`agent-job-blocked:${failed.agentId}`,failed.lastError||'Agent execution failed after system retries'];
      trail.gate={id:'agent-failure',status:'awaiting-human',openedAt:at};trail.updatedAt=at;
      nextQueue.items.push({reviewId:`agent-failure-${trail.candidateId}-${failed.id}`,candidateId:trail.candidateId,trailId:trail.trailId,trailName:trail.trailName,
        gateType:'agent-failure',state:'awaiting-human',openedAt:at,approvalAllowed:false,blockingReasons:trail.blockers,sourceTrail:trail.sourceTrail,
        claimResolution:resolutionLedger(trail),
        specialistOutputs:[{agentId:failed.agentId,jobId:failed.id,result:{summary:failed.lastError||'Agent execution failed',recommendation:'block',claims:[],openQuestions:[]}}],
        allowedActions:['request-revision','reject'],publicMutationAllowed:false});advanced.push(trail.trailId);continue;
    }
    if(trail.pendingRevisionJobId){
      const revision=jobs.find(job=>job.id===trail.pendingRevisionJobId&&job.status==='completed');
      if(!revision)continue;
      delete trail.pendingRevisionJobId;
    }
    if(trail.state==='geometry-audit'){
      const job=latest(jobs,trail.candidateId,'cartographer'); if(!job)continue;
      const result=await store.getArtifact(`trail-specialist-output-${job.id}`); if(!result)continue;
      trail.state='geometry-human-gate';trail.stage='route-identity-and-geometry';trail.currentJobId=job.id;trail.latestOutputRef=`firestore:trail-specialist-output-${job.id}`;
      trail.blockers=result.blockers||[];trail.gate={id:'geometry-approval',status:'awaiting-human',openedAt:at};trail.updatedAt=at;
      nextQueue.items.push({reviewId:`geometry-approval-${trail.candidateId}-${job.id}`,candidateId:trail.candidateId,trailId:trail.trailId,trailName:trail.trailName,
        gateType:'geometry-approval',state:'awaiting-human',openedAt:at,approvalAllowed:result.reviewState==='ready-for-human-review'&&!(result.blockers||[]).length,
        blockingReasons:result.blockers||[],sourceTrail:trail.sourceTrail,specialistOutputs:[{agentId:'cartographer',jobId:job.id,result}],
        allowedActions:['approve','request-revision','reject'],publicMutationAllowed:false}); advanced.push(trail.trailId); continue;
    }
    if(trail.state==='evidence-research'){
      const base=BASE_AGENTS.map(agent=>latest(jobs,trail.candidateId,agent));
      if(base.some(job=>!job))continue;
      const outputs=[];for(const job of base){const result=await store.getArtifact(`trail-specialist-output-${job.id}`);if(result)outputs.push({agentId:job.agentId,jobId:job.id,result});}
      const candidates=resolutionCandidates(outputs);
      if(candidates.length){
        const entries=ensureResolutionEntries(trail,candidates);
        for(const entry of Object.values(entries))if(entry.state==='researchable'&&!pendingAttempt(entry,jobs))queueClaimResolution(trail,entry,jobs,queued,at);
        trail.state='evidence-resolution';trail.stage='autonomous-claim-resolution';trail.updatedAt=at;advanced.push(trail.trailId);continue;
      }
      if(queueProvenanceAudit(trail,jobs,queued,at))advanced.push(trail.trailId);
      continue;
    }
    if(trail.state==='evidence-resolution'){
      const changed=await reconcileResolutionAttempts(store,trail,jobs,at);let scheduled=false;
      for(const entry of resolutionLedger(trail)){
        if(entry.state!=='researchable'||pendingAttempt(entry,jobs))continue;
        if(completedAttempts(entry).length>=MAX_AUTOMATED_ATTEMPTS){entry.state='source-exhausted';entry.updatedAt=at;continue;}
        queueClaimResolution(trail,entry,jobs,queued,at);scheduled=true;
      }
      const pending=resolutionLedger(trail).some(entry=>pendingAttempt(entry,[...jobs,...queued]));
      if(scheduled||pending){if(changed||scheduled)advanced.push(trail.trailId);continue;}
      if(queueProvenanceAudit(trail,jobs,queued,at))advanced.push(trail.trailId);
      continue;
    }
    if(trail.state==='provenance-audit'){
      const librarian=latest(jobs,trail.candidateId,'evidenceLibrarian');if(!librarian)continue;
      const attempt=(trail.attempts.redTeam||0)+1;trail.attempts.redTeam=attempt;
      const job=specialistJob(trail,{agentId:'redTeam',action:'challenge-complete-dossier',claimIds:[]},attempt,at);
      job.inputRefs=trail.jobIds.map(id=>`firestore:trail-specialist-output-${id}`);queued.push(job);trail.jobIds.push(job.id);trail.state='red-team';trail.stage='counter-evidence-review';trail.updatedAt=at;advanced.push(trail.trailId);continue;
    }
    if(trail.state==='red-team'){
      const red=latest(jobs,trail.candidateId,'redTeam');if(!red)continue;
      const completed=jobs.filter(job=>job.candidateId===trail.candidateId&&job.status==='completed');const latestByAgent=new Map();
      for(const job of completed){const current=latestByAgent.get(job.agentId);if(!current||timeValue(job.completedAt||job.createdAt)>timeValue(current.completedAt||current.createdAt))latestByAgent.set(job.agentId,job);}
      const specialistOutputs=[];for(const job of latestByAgent.values()){const result=await store.getArtifact(`trail-specialist-output-${job.id}`);if(result)specialistOutputs.push({agentId:job.agentId,jobId:job.id,result});}
      const blockingReasons=dossierBlockingReasons(specialistOutputs);
      trail.state='dossier-human-gate';trail.stage='complete-evidence-dossier';trail.currentJobId=red.id;trail.gate={id:'dossier-approval',status:'awaiting-human',openedAt:at};trail.updatedAt=at;
      nextQueue.items.push({reviewId:`dossier-approval-${trail.candidateId}-${red.id}`,candidateId:trail.candidateId,trailId:trail.trailId,trailName:trail.trailName,
        gateType:'dossier-approval',state:'awaiting-human',openedAt:at,approvalAllowed:!blockingReasons.length,blockingReasons,sourceTrail:trail.sourceTrail,specialistOutputs,
        claimResolution:resolutionLedger(trail),
        allowedActions:['approve','request-revision','reject'],publicMutationAllowed:false});advanced.push(trail.trailId);
    }
  }
  for(const job of queued)await store.putJob(job);
  if(advanced.length){next.generatedAt=at;next.summary=summarize(next.trails);nextQueue.updatedAt=at;nextQueue.summary={awaitingHuman:nextQueue.items.filter(item=>item.state==='awaiting-human').length,
    approvalAllowed:nextQueue.items.filter(item=>item.state==='awaiting-human'&&item.approvalAllowed).length,blocked:nextQueue.items.filter(item=>item.state==='awaiting-human'&&!item.approvalAllowed).length};
    await Promise.all([store.setArtifact('trail-orchestration',next),store.setArtifact('dossier-review-queue',nextQueue)]);}
  return {advanced,queued:queued.map(job=>job.id)};
}

module.exports={timeValue,latest,dossierBlockingReasons,advanceTrailOrchestration};
