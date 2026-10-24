'use strict';

const {
  MAX_AUTOMATED_ATTEMPTS,
  MAX_WAIVABLE_ATTEMPTS,
  RETRY_DELAYS_HOURS,
  attemptCeiling,
  assertNextStrategy,
  resolutionStatus,
}=require('../contracts/resolution-policy-v1');
const {ROUTE_GUIDANCE_CLAIM_IDS}=require('./compile-verified-dossier');
const {OFFICIAL_FIGURE_CLAIM_IDS,COMMUNE_CLAIM_PREFIX,COMMUNE_DOG_RULE_PREFIX,PROTECTED_AREAS_CLAIM}=require('./research-methods');

/**
 * How many attempts this claim gets: the full ladder for the directions a walk
 * cannot be verified without, three for everything else.
 *
 * Read from ROUTE_GUIDANCE_CLAIM_IDS rather than a list repeated here, so a
 * fifth route claim keeps its full ladder without a second edit.
 */
function ceilingFor(claimId){
  return attemptCeiling({unwaivable:ROUTE_GUIDANCE_CLAIM_IDS.includes(String(claimId))});
}

// The sentence both the dossier and the gate policy recognise. It carries no
// number, because the number is now two different numbers and the last time a
// count was written into prose that other code matched on, a reworded producer
// left the consumer silently matching nothing (#472). The count travels beside
// it, in `resolution.maximumAttempts`.
const EXHAUSTED_PHRASE='automated resolution strategies exhausted';

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
  const policy=assertNextStrategy(completed,strategy?.id||'automated-strategies-exhausted',
    {unwaivable:ROUTE_GUIDANCE_CLAIM_IDS.includes(String(entry.claimId))});
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

// What the record says when the map was read along the walk and the category
// is not there. It is the same sentence shape an exhausted ladder writes, so
// every consumer that already recognises an exhausted claim recognises this.
const NOTHING_MAPPED='The mapped features along this walk were measured and none of this kind is on it; automated research strategies were exhausted.';

/**
 * The claims to research, and the ones there is no point researching.
 *
 * An optional claim gets three materially different web searches. Measured
 * across the catalogue on 14 October 2026, 111 of 225 such claims spent that
 * ladder and came back having found nothing -- roughly half the money spent on
 * optional detail bought the word "unknown".
 *
 * Some of those were never answerable. ORMA already measures the mapped water,
 * huts and bars along each walk from its own line, and a walk with no mapped
 * water on it is a walk the web is unlikely to find a fountain on. Paying three
 * searches to confirm that is three searches for nothing.
 *
 * So a category the map was read for and found nothing of is recorded settled
 * here, before any job is queued -- `queueClaimResolution` only ever queues a
 * `researchable` entry. The reader is told what was done: the map was measured
 * and the category is not on this walk, which is a better answer than silence
 * and the same answer the ladder would have reached three calls later.
 *
 * Only where the map was actually read. `categoriesTheMapFoundNothingFor`
 * returns nothing for a walk with no line or a run with no mapped features,
 * because not looking is not a finding.
 */
function ensureResolutionEntries(trail,candidates,unmapped){
  trail.claimResolution=trail.claimResolution||{};
  const nothingThere=new Set(unmapped||[]);
  for(const candidate of candidates){
    const key=keyFor(candidate.agentId,candidate.claimId);
    if(trail.claimResolution[key])continue;
    const settled=nothingThere.has(String(candidate.claimId));
    trail.claimResolution[key]={key,agentId:candidate.agentId,claimId:candidate.claimId,category:candidate.category,
      originalFinding:candidate.finding,
      state:settled?'source-exhausted':'researchable',
      ...(settled?{settledBy:'mapped-features',note:NOTHING_MAPPED}:{}),
      latestOutputRef:candidate.outputRef,attempts:[]};
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
  // The count, not the sentences. Every completed attempt used to keep the
  // claim's whole blocker list -- long strings, copied onto every attempt of
  // every claim of every trail, and nothing ever read them back. They were
  // most of trail-orchestration by the time it reached 1020.6 KB of a 1023.9
  // KB ceiling and the worker began failing every write. The same shape as the
  // strategy label and instruction above: a constant duplicated hundreds of
  // times. What the record is for is how many things stood in the way, and
  // that is a number. The blockers themselves are on the claim.
  attempt.blockerCount=(claim.blockers||[]).length;
  entry.latestFinding=claim.finding;
  entry.latestOutputRef=`firestore:trail-specialist-output-${job.id}`;
  entry.state=resolutionStateFor(claim,entry);
  entry.updatedAt=at;
  return true;
}

/**
 * The label and the instruction belong to the strategy, and the strategies are
 * a frozen table in this file. Copying two of its columns onto every attempt,
 * of every claim, of every trail duplicated a constant hundreds of times: they
 * were 84% of trail-orchestration by the time it reached 287 KB. The id is
 * enough, and the table is where it always was.
 */
function strategyById(id){
  return STRATEGIES.find(strategy=>strategy.id===id)||null;
}

/** An attempt's wording, from the attempt if it predates the lookup, else the table. */
function attemptStrategyText(attempt){
  const strategy=strategyById(attempt&&attempt.strategy);
  return {
    label:(attempt&&attempt.strategyLabel)||(strategy&&strategy.label)||null,
    instruction:(attempt&&attempt.instruction)||(strategy&&strategy.instruction)||null,
  };
}

function addQueuedAttempt(entry,job,at){
  const strategy=strategyFor(entry);
  const notBefore=notBeforeFor(at,strategy.attemptNumber);
  const attempt={attemptNumber:strategy.attemptNumber,strategy:strategy.id,
    status:'queued',jobId:job.id,scheduledAt:at,notBefore};
  entry.attempts=[...(entry.attempts||[]),attempt];
  entry.state='researchable';entry.updatedAt=at;
  return attempt;
}

function annotateResolvedClaim(claim,job,at){
  const attempts=Array.from({length:job.resolutionAttempt},(_,index)=>({strategy:STRATEGIES[index].id}));
  const state=claim.finding==='supported-proposal'?'supported'
    :claim.finding==='counter-evidence'?'contradicted'
      :resolutionStatus(attempts,'unresolved',{unwaivable:ROUTE_GUIDANCE_CLAIM_IDS.includes(String(claim.id))});
  const ceiling=ceilingFor(claim.id);
  const exhausted=`${ceiling} materially different automated research strategies were exhausted.`;
  const blockers=(claim.blockers||[]).filter(blocker=>
    !/materially different automated research strategies were exhausted/i.test(String(blocker)));
  if(state==='source-exhausted')blockers.push(exhausted);
  return {...claim,blockers,resolution:{state,attemptNumber:job.resolutionAttempt,
    maximumAttempts:ceiling,strategy:job.resolutionStrategy,
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
  // A job can target several claims; the record states the longest ladder any
  // of them is entitled to, so it never understates what is still to come.
  const ceiling=Math.max(...[...targets].map(ceilingFor),MAX_WAIVABLE_ATTEMPTS);
  return {...previous,...next,claims,recommendation,resolutionAttempt:{claimIds:[...targets],
    attemptNumber:job.resolutionAttempt,maximumAttempts:ceiling,
    strategy:job.resolutionStrategy,strategyLabel:job.resolutionStrategyLabel,completedAt:at}};
}

/**
 * How many paid research calls one agent may spend on one trail's optional
 * detail, across all of its claims together.
 *
 * Each optional claim already stops at three attempts. That was a ceiling per
 * claim, and an agent owns ten: the terrain analyst was asked 23 times about
 * one trail in the 31 hours a credit top-up lasted (20-21 October 2026), and
 * 95 of the backoffice's 101 calls in that window were the fourth attempt or
 * later of an agent on the same trail. The operating standard asked for this
 * cap before paid research is switched back on.
 *
 * Three in all, per agent per trail. What decides the seal is outside it: the
 * route guidance, the official figures, the municipalities and their dog
 * rules, and the protected areas each keep their own ladder.
 */
const OPTIONAL_RESEARCH_CALLS_PER_AGENT=3;
const OVER_BUDGET_NOTE='The optional research budget for this agent on this trail is spent; automated resolution strategies exhausted; this remains unknown.';

/** Whether a claim decides the seal, so its research is never cut short by the optional budget. */
function decidesTheSeal(claimId){
  const id=String(claimId||'');
  return ROUTE_GUIDANCE_CLAIM_IDS.includes(id)||OFFICIAL_FIGURE_CLAIM_IDS.includes(id)
    ||id.startsWith(COMMUNE_CLAIM_PREFIX)||id.startsWith(COMMUNE_DOG_RULE_PREFIX)||id===PROTECTED_AREAS_CLAIM;
}

/** Paid optional-detail attempts this agent has had on this trail, queued or done. */
function optionalCallsSpent(ledger,agentId){
  return (ledger||[]).filter(entry=>entry.agentId===agentId&&!decidesTheSeal(entry.claimId))
    .reduce((sum,entry)=>sum+(entry.attempts||[]).length,0);
}

/**
 * Settle an optional claim the budget no longer covers, in the same words an
 * exhausted ladder uses, so every consumer reads it the same way. Returns
 * whether it settled it.
 */
function settleOverOptionalBudget(ledger,entry,at){
  if(decidesTheSeal(entry.claimId))return false;
  if(optionalCallsSpent(ledger,entry.agentId)<OPTIONAL_RESEARCH_CALLS_PER_AGENT)return false;
  entry.state='source-exhausted';entry.settledBy='optional-research-budget';
  entry.note=OVER_BUDGET_NOTE;entry.updatedAt=at;
  return true;
}

module.exports={OPTIONAL_RESEARCH_CALLS_PER_AGENT,OVER_BUDGET_NOTE,decidesTheSeal,optionalCallsSpent,settleOverOptionalBudget,NOTHING_MAPPED,MAX_AUTOMATED_ATTEMPTS,MAX_WAIVABLE_ATTEMPTS,EXHAUSTED_PHRASE,ceilingFor,RESOLVABLE_FINDINGS,STRATEGIES,strategyById,attemptStrategyText,keyFor,strategyFor,notBeforeFor,
  resolutionCandidates,ensureResolutionEntries,pendingAttempt,completedAttempts,resolutionStateFor,
  reconcileCompletedAttempt,addQueuedAttempt,annotateResolvedClaim,mergeClaimResolutionResult};
