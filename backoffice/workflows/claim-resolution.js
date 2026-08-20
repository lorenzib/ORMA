'use strict';

const {
  MAX_AUTOMATED_ATTEMPTS,
  RETRY_DELAYS_HOURS,
  assertNextStrategy,
  resolutionStatus,
}=require('../contracts/resolution-policy-v1');

const RESOLVABLE_FINDINGS=new Set(['unresolved','conflicted']);
const STRATEGIES=Object.freeze([
  {
    id:'primary-authority-scope-check',
    label:'Primary authority scope check',
    instruction:'Search current first-party park, municipality, land-manager, transport-operator or regulator material and prove that it applies to the exact route and claim.',
  },
  {
    id:'geospatial-source-triangulation',
    label:'Geospatial source triangulation',
    instruction:'Cross-check the exact route against source objects, official geoportals, mapped infrastructure and topographic datasets; distinguish mapped presence from operational fact.',
  },
  {
    id:'local-institution-cross-check',
    label:'Local institution cross-check',
    instruction:'Search route-specific refuge, lift, destination, tourism-board and local institutional material, then reconcile it with the primary sources already collected.',
  },
  {
    id:'counter-evidence-and-freshness-review',
    label:'Counter-evidence and freshness review',
    instruction:'Actively seek current counter-evidence, seasonal notices, superseding rules and date conflicts; explain which source wins and why without averaging incompatible claims.',
  },
  {
    id:'direct-verification-escalation-check',
    label:'Direct verification escalation check',
    instruction:'Run one final targeted search for an authoritative answer. If none exists, identify the exact authority contact, field observation or measurement needed and keep the claim unresolved.',
  },
]);

function keyFor(agentId,claimId){return `${agentId}:${claimId}`;}
function dateValue(value){const date=new Date(value);return Number.isNaN(date.valueOf())?new Date(0):date;}

function strategyFor(entry){
  const completed=(entry.attempts||[]).filter(attempt=>attempt.status==='completed');
  const strategy=STRATEGIES[completed.length];
  const policy=assertNextStrategy(completed,strategy?.id||'automated-strategies-exhausted');
  return {...strategy,...policy};
}

function notBeforeFor(at,attemptNumber){
  const delayHours=RETRY_DELAYS_HOURS[attemptNumber-1];
  return new Date(dateValue(at).getTime()+delayHours*60*60*1000).toISOString();
}

function resolutionCandidates(outputs){
  const candidates=[];
  for(const output of outputs||[]){
    for(const claim of output.result?.claims||[]){
      if(!RESOLVABLE_FINDINGS.has(claim.finding))continue;
      candidates.push({agentId:output.agentId,claimId:claim.id,category:claim.category,
        finding:claim.finding,outputRef:`firestore:trail-specialist-output-${output.jobId}`});
    }
  }
  return candidates;
}

function ensureResolutionEntries(trail,candidates){
  trail.claimResolution=trail.claimResolution||{};
  for(const candidate of candidates){
    const key=keyFor(candidate.agentId,candidate.claimId);
    if(trail.claimResolution[key])continue;
    trail.claimResolution[key]={key,agentId:candidate.agentId,claimId:candidate.claimId,category:candidate.category,
      originalFinding:candidate.finding,state:'researchable',latestOutputRef:candidate.outputRef,attempts:[]};
  }
  return trail.claimResolution;
}

function pendingAttempt(entry,jobs){
  return (entry.attempts||[]).find(attempt=>attempt.status==='queued'
    && jobs.some(job=>job.id===attempt.jobId&&['queued','running'].includes(job.status)));
}

function completedAttempts(entry){return (entry.attempts||[]).filter(attempt=>attempt.status==='completed');}

function resolutionStateFor(claim,entry){
  if(claim?.finding==='supported-proposal')return 'supported';
  if(claim?.finding==='counter-evidence')return 'contradicted';
  return resolutionStatus(completedAttempts(entry),'unresolved');
}

function reconcileCompletedAttempt(entry,job,result,at){
  const attempt=(entry.attempts||[]).find(item=>item.jobId===job.id);
  if(!attempt||attempt.status==='completed')return false;
  const claim=(result?.claims||[]).find(item=>item.id===entry.claimId);
  if(!claim)throw new Error(`Resolution result ${job.id} omitted claim ${entry.claimId}`);
  attempt.status='completed';
  attempt.completedAt=job.completedAt||at;
  attempt.finding=claim.finding;
  attempt.confidence=claim.confidence;
  attempt.sourceCount=(claim.sources||[]).length;
  attempt.blockers=claim.blockers||[];
  entry.latestFinding=claim.finding;
  entry.latestOutputRef=`firestore:trail-specialist-output-${job.id}`;
  entry.state=resolutionStateFor(claim,entry);
  entry.updatedAt=at;
  return true;
}

function addQueuedAttempt(entry,job,at){
  const strategy=strategyFor(entry);
  const notBefore=notBeforeFor(at,strategy.attemptNumber);
  const attempt={attemptNumber:strategy.attemptNumber,strategy:strategy.id,strategyLabel:strategy.label,
    instruction:strategy.instruction,status:'queued',jobId:job.id,scheduledAt:at,notBefore};
  entry.attempts=[...(entry.attempts||[]),attempt];
  entry.state='researchable';entry.updatedAt=at;
  return attempt;
}

function annotateResolvedClaim(claim,job,at){
  const attempts=Array.from({length:job.resolutionAttempt},(_,index)=>({strategy:STRATEGIES[index].id}));
  const state=claim.finding==='supported-proposal'?'supported'
    :claim.finding==='counter-evidence'?'contradicted'
      :resolutionStatus(attempts,'unresolved');
  const blockers=[...(claim.blockers||[])];
  if(state==='source-exhausted'&&!blockers.includes('Five materially different automated research strategies were exhausted.')){
    blockers.push('Five materially different automated research strategies were exhausted.');
  }
  return {...claim,blockers,resolution:{state,attemptNumber:job.resolutionAttempt,
    maximumAttempts:MAX_AUTOMATED_ATTEMPTS,strategy:job.resolutionStrategy,
    strategyLabel:job.resolutionStrategyLabel,completedAt:at}};
}

function mergeClaimResolutionResult(previous,next,job,at){
  if(!job.resolutionAttempt)return next;
  const targets=new Set(job.claimIds||[]);
  for(const claimId of targets){
    if(!(next.claims||[]).some(claim=>claim.id===claimId))throw new Error(`Resolution attempt omitted targeted claim ${claimId}`);
  }
  const replacements=new Map((next.claims||[]).filter(claim=>targets.has(claim.id))
    .map(claim=>[claim.id,annotateResolvedClaim(claim,job,at)]));
  const claims=[];
  for(const claim of previous?.claims||[]){claims.push(replacements.get(claim.id)||claim);replacements.delete(claim.id);}
  claims.push(...replacements.values());
  const states=claims.map(claim=>claim.resolution?.state);
  const recommendation=states.includes('source-exhausted')||states.includes('contradicted')?'block'
    :claims.some(claim=>RESOLVABLE_FINDINGS.has(claim.finding))?'needs-resolution':next.recommendation;
  return {...previous,...next,claims,recommendation,resolutionAttempt:{claimIds:[...targets],
    attemptNumber:job.resolutionAttempt,maximumAttempts:MAX_AUTOMATED_ATTEMPTS,
    strategy:job.resolutionStrategy,strategyLabel:job.resolutionStrategyLabel,completedAt:at}};
}

module.exports={MAX_AUTOMATED_ATTEMPTS,RESOLVABLE_FINDINGS,STRATEGIES,keyFor,strategyFor,notBeforeFor,
  resolutionCandidates,ensureResolutionEntries,pendingAttempt,completedAttempts,resolutionStateFor,
  reconcileCompletedAttempt,addQueuedAttempt,annotateResolvedClaim,mergeClaimResolutionResult};
