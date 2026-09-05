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

// Every job an orchestrated trail can reference is recorded on the trail itself, so
// the advance pass never needs a collection-wide scan. Falls back to the old status
// query for stores that predate id-based fetching (the local file store and tests).
function orchestrationJobIds(state){
  const ids=[];
  for(const trail of state?.trails||[]){
    ids.push(...(trail.jobIds||[]));
    if(trail.pendingRevisionJobId)ids.push(trail.pendingRevisionJobId);
    for(const entry of Object.values(trail.claimResolution||{})){
      for(const attempt of entry.attempts||[])if(attempt.jobId)ids.push(attempt.jobId);
    }
  }
  return [...new Set(ids)];
}

async function orchestrationJobs(store,state){
  if(typeof store.getJobsByIds!=='function'){
    return store.listJobs(['queued','running','completed','ready-for-review','blocked','approved','rejected','revision-requested']);
  }
  return store.getJobsByIds(orchestrationJobIds(state));
}


const GATE_STATES=Object.freeze({'geometry-human-gate':'geometry-approval','dossier-human-gate':'dossier-approval'});
// A review item embeds the full specialist evidence, and Firestore caps a document
// at 1 MiB. Restoring every stranded trail at once overflowed it and failed the
// whole worker pass, so restoration fills the remaining room and stops.
const REVIEW_QUEUE_SAFE_BYTES=800000;
const RESOLVED_REVIEWS_KEPT=25;

// Resolved review items were never removed, so the queue grew without bound until
// it filled its 1 MiB document and left no room for the trails still waiting. The
// durable receipt of a decision lives in backofficeDossierReviews, not here; this
// queue only needs the open work plus recent context.
function pruneResolvedReviews(queue,keep=RESOLVED_REVIEWS_KEPT){
  const items=queue.items||[];
  const open=items.filter(item=>item.state==='awaiting-human');
  const resolved=items.filter(item=>item.state!=='awaiting-human')
    .sort((a,b)=>String(a.openedAt||'').localeCompare(String(b.openedAt||'')));
  const dropped=Math.max(0,resolved.length-keep);
  return {items:[...resolved.slice(dropped),...open],dropped};
}

// A review item is written once, at the moment a trail enters a gate. No branch
// below matches a trail that is already parked at one, so if the item is ever
// consumed, superseded or lost, the trail waits forever: the orchestration says
// "awaiting a decision" while the desk shows nothing to decide. This rebuilds the
// missing item from the trail's own record so a parked trail is always visible.
async function restoreMissingGateReviews(store,state,queue,at,jobs=[]){
  // Reclaim room before deciding what fits: a queue full of decided history would
  // otherwise leave none for the trails still waiting.
  const pruned=pruneResolvedReviews(queue);
  queue.items=pruned.items;
  const live=new Set((queue.items||[]).filter(item=>item.state==='awaiting-human')
    .map(item=>String(item.trailId||item.candidateId)));
  const restored=[];
  for(const trail of state.trails||[]){
    if(!String(trail.state||'').endsWith('-human-gate'))continue;
    if(live.has(String(trail.trailId))||live.has(String(trail.candidateId)))continue;
    const gateType=trail.gate?.id||GATE_STATES[trail.state]||'dossier-approval';
    const jobId=trail.currentJobId||null;
    // A dossier is judged on the whole specialist set, not just the last job, so
    // gather the same latest-per-agent outputs the original gate used. Restoring
    // from one output alone would invent route-guidance blockers that are not real.
    const latestByAgent=new Map();
    for(const job of jobs.filter(item=>item.candidateId===trail.candidateId&&item.status==='completed')){
      const current=latestByAgent.get(job.agentId);
      if(!current||timeValue(job.completedAt||job.createdAt)>timeValue(current.completedAt||current.createdAt))latestByAgent.set(job.agentId,job);
    }
    let outputs=[];
    for(const job of latestByAgent.values()){
      const result=await store.getArtifact(`trail-specialist-output-${job.id}`);
      if(result)outputs.push({agentId:job.agentId,jobId:job.id,result});
    }
    if(!outputs.length&&jobId){
      const result=await store.getArtifact(`trail-specialist-output-${jobId}`);
      if(result)outputs=[{agentId:result.agentId||(gateType==='geometry-approval'?'cartographer':'redTeam'),jobId,result}];
    }
    const geometry=outputs.find(item=>item.agentId==='cartographer')||outputs[0];
    // Never restore a trail as approvable unless the same checks that gate a fresh
    // one still pass. When the evidence cannot be re-read, it needs a human.
    const blockingReasons=outputs.length
      ?(gateType==='geometry-approval'?(geometry?.result?.blockers||[]):dossierBlockingReasons(outputs))
      :(trail.blockers||[]);
    const approvalAllowed=gateType==='agent-failure'?false
      :outputs.length?(gateType==='geometry-approval'
        ?geometry?.result?.reviewState==='ready-for-human-review'&&!blockingReasons.length
        :!blockingReasons.length)
      :false;
    const item={
      reviewId:`${gateType}-${trail.candidateId}-${jobId||'restored'}`,candidateId:trail.candidateId,
      trailId:trail.trailId,trailName:trail.trailName,gateType,state:'awaiting-human',openedAt:trail.gate?.openedAt||at,
      approvalAllowed,blockingReasons,sourceTrail:trail.sourceTrail,specialistOutputs:outputs,
      claimResolution:resolutionLedger(trail),restoredAt:at,
      allowedActions:gateType==='agent-failure'?['request-revision','reject']:['approve','request-revision','reject'],
      publicMutationAllowed:false};
    const next=[...(queue.items||[]),item];
    if(Buffer.byteLength(JSON.stringify({...queue,items:next}),'utf8')>REVIEW_QUEUE_SAFE_BYTES)break;
    queue.items=next;
    restored.push(trail.trailId);
  }
  return restored;
}

async function advanceTrailOrchestration(store,options={}){
  const at=options.at||new Date().toISOString(); const state=await store.getArtifact('trail-orchestration');
  if(!state)return {advanced:[],queued:[]};
  const jobs=await orchestrationJobs(store,state);
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
  const restored=await restoreMissingGateReviews(store,next,nextQueue,at,jobs);
  // Persist whenever anything moved or was repaired. Gating the write on advanced
  // alone discarded queue repairs on any pass where no trail changed state.
  if(advanced.length||restored.length){next.generatedAt=at;next.summary=summarize(next.trails);nextQueue.updatedAt=at;nextQueue.summary={awaitingHuman:nextQueue.items.filter(item=>item.state==='awaiting-human').length,
    approvalAllowed:nextQueue.items.filter(item=>item.state==='awaiting-human'&&item.approvalAllowed).length,blocked:nextQueue.items.filter(item=>item.state==='awaiting-human'&&!item.approvalAllowed).length};
    await Promise.all([store.setArtifact('trail-orchestration',next),store.setArtifact('dossier-review-queue',nextQueue)]);}
  return {advanced,restored,queued:queued.map(job=>job.id)};
}

module.exports={GATE_STATES,REVIEW_QUEUE_SAFE_BYTES,RESOLVED_REVIEWS_KEPT,pruneResolvedReviews,restoreMissingGateReviews,orchestrationJobIds,orchestrationJobs,timeValue,latest,dossierBlockingReasons,advanceTrailOrchestration};
