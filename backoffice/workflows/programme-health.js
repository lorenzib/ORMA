'use strict';

/**
 * One artifact per programme, carrying the five things a lane has to be able to
 * answer about itself: throughput, evidence gaps, retries, cost and freshness.
 *
 * Why it exists. On 2026-10-08 the biggest single thing stopping ORMA Verified
 * was that `logistics/route-number-switches` blocked eleven trails and had come
 * back empty on all eleven -- a question with no answer to find rather than hard
 * research. Nothing in the backoffice said so. Finding it meant dispatching a
 * report, saving the run log and parsing 124 claim records out of it by hand.
 * The dashboard showed "needs you: 0" and was telling the truth.
 *
 * Every number here is read from state the worker already holds, so this costs
 * no extra Firestore reads. It is written as one document, which is the only
 * shape a free-tier desk can afford to poll (see pipeline-health, #325).
 */

const {buildFunnel}=require('./verification-funnel');
const {UNWAIVABLE_BLOCKER_IDS}=require('./compile-verified-dossier');
const {MAX_AUTOMATED_ATTEMPTS,STRATEGIES}=require('./claim-resolution');

const CONTRACT_VERSION='1.0.0';
const PROGRAMME='catalogue-verification';
// What the free tier allows in a day. The cost column is only meaningful as a
// share of the ceiling that actually stops the pipeline.
const DAILY_FREE_READS=50_000;
const DAILY_FREE_WRITES=20_000;
// A gap on one of these can never be waived at the gate, so it holds the trail
// until an agent supplies it. A gap on anything else is a judgement a moderator
// can make. Counting them together is what hid the switches problem.
const UNWAIVABLE_CLAIM_KEYS=new Set(UNWAIVABLE_BLOCKER_IDS.filter(id=>id.includes('/')));

const OPEN_STATES=new Set(['researchable','source-exhausted','contact-required','field-check-required']);

function dayValue(value,nowMs){
  if(!value)return null;
  const at=typeof value?.toMillis==='function'?value.toMillis()
    :Number.isFinite(value?.seconds)?value.seconds*1000:new Date(value).valueOf();
  return Number.isFinite(at)?Math.max(0,Math.floor((nowMs-at)/86_400_000)):null;
}

function ledgerEntries(orchestration){
  const out=[];
  for(const trail of orchestration?.trails||[]){
    for(const entry of Object.values(trail.claimResolution||{})){
      out.push({trail,entry});
    }
  }
  return out;
}

function completedAttempts(entry){
  return (entry.attempts||[]).filter(attempt=>attempt.status==='completed');
}

/**
 * Claims still owed, grouped by the claim they are about and ranked by how many
 * trails they hold. `unwaivable` is the column that matters: it separates work
 * only an agent can finish from a judgement a person could make today.
 */
function evidenceGaps(entries,nowMs){
  const byClaim=new Map();
  for(const {trail,entry} of entries){
    const key=`${entry.agentId}/${entry.claimId}`;
    if(!byClaim.has(key))byClaim.set(key,{claim:key,agentId:entry.agentId,claimId:entry.claimId,
      unwaivable:UNWAIVABLE_CLAIM_KEYS.has(key),open:0,resolved:0,
      states:{},firstFindings:{},trails:[],oldestDays:null});
    const row=byClaim.get(key);
    row.states[entry.state]=(row.states[entry.state]||0)+1;
    const first=entry.originalFinding||'unknown';
    row.firstFindings[first]=(row.firstFindings[first]||0)+1;
    if(OPEN_STATES.has(entry.state)){
      row.open+=1;
      if(row.trails.length<10)row.trails.push(trail.candidateId);
      const age=dayValue(entry.updatedAt||trail.updatedAt,nowMs);
      if(age!==null&&(row.oldestDays===null||age>row.oldestDays))row.oldestDays=age;
    }else row.resolved+=1;
  }
  const rows=[...byClaim.values()]
    // Open first, then the unwaivable ones, then by how many trails they hold:
    // a waivable gap on thirty trails is still less urgent than an unwaivable
    // one on three, because nobody can clear the second by deciding.
    .sort((a,b)=>Number(b.unwaivable)-Number(a.unwaivable)||b.open-a.open||a.claim.localeCompare(b.claim));
  const open=rows.reduce((total,row)=>total+row.open,0);
  return {
    open,
    unwaivableOpen:rows.filter(row=>row.unwaivable).reduce((total,row)=>total+row.open,0),
    waivableOpen:rows.filter(row=>!row.unwaivable).reduce((total,row)=>total+row.open,0),
    byClaim:rows.filter(row=>row.open>0),
  };
}

/**
 * How much re-research is being spent, and whether it pays.
 *
 * `resolvedAtAttempt` is the part worth watching: a strategy that has never
 * resolved anything is a fifth of the research budget bought nothing, and only
 * this tells you.
 */
function retries(entries){
  const byAttemptsSpent={};
  const resolvedAtAttempt={};
  let exhausted=0,neverRetried=0;
  for(const {entry} of entries){
    const spent=completedAttempts(entry).length;
    byAttemptsSpent[spent]=(byAttemptsSpent[spent]||0)+1;
    if(spent===0)neverRetried+=1;
    if(entry.state==='source-exhausted')exhausted+=1;
    if(entry.state==='supported'||entry.state==='contradicted'){
      const last=completedAttempts(entry).slice(-1)[0];
      const at=last?.attemptNumber??0;
      resolvedAtAttempt[at]=(resolvedAtAttempt[at]||0)+1;
    }
  }
  const strategyNeverPaid=STRATEGIES
    .map((strategy,index)=>({attempt:index+1,strategy:strategy.id,resolved:resolvedAtAttempt[index+1]||0}))
    .filter(row=>row.resolved===0);
  return {maximumAttempts:MAX_AUTOMATED_ATTEMPTS,claims:entries.length,neverRetried,exhausted,
    byAttemptsSpent,resolvedAtAttempt,strategyNeverPaid};
}

/** What the last pass cost, against the ceiling that actually stops the lane. */
function cost(usage={},jobsDone=0){
  const reads=Number(usage.reads)||0;
  const writes=Number(usage.writes)||0;
  return {reads,writes,jobsDone,
    readsPerJob:jobsDone?Math.round(reads/jobsDone):null,
    writesPerJob:jobsDone?Math.round(writes/jobsDone):null,
    dailyFreeReads:DAILY_FREE_READS,dailyFreeWrites:DAILY_FREE_WRITES,
    // How many more passes this size the day's free allowance would fund.
    passesLeftInFreeReads:reads?Math.floor(DAILY_FREE_READS/reads):null,
    bySource:usage.bySource||null};
}

function summariseProgrammeHealth({orchestration,jobs=[],reviewQueue,usage,jobsDone=0,nowMs=Date.now()}={}){
  // Read from the funnel's own fields rather than a copy of them: `stages` and
  // `totalTrails` are what it returns, and guessing otherwise is how a report
  // ends up confidently printing undefined.
  const funnel=buildFunnel({orchestration,jobs,reviewQueue,nowMs});
  const stages=funnel.stages||[];
  const stageTrails=state=>stages.find(row=>row.state===state)?.trails||0;
  const entries=ledgerEntries(orchestration);
  const stateAges=stages.map(row=>row.oldestDaysInState).filter(value=>value!==null);
  const claimAges=entries.map(({trail,entry})=>dayValue(entry.updatedAt||trail.updatedAt,nowMs))
    .filter(value=>value!==null);
  return {
    contractVersion:CONTRACT_VERSION,
    programme:PROGRAMME,
    generatedAt:new Date(nowMs).toISOString(),
    throughput:{
      inPipeline:funnel.totalTrails??(orchestration?.trails||[]).length,
      stages,
      // The two ends of the lane, stated even when they are 0 -- which is the
      // whole point: "ready for editorial: 0" is the programme's headline and no
      // existing tile showed it.
      readyForEditorial:stageTrails('ready-for-editorial'),
      inRedTeam:stageTrails('red-team'),
      awaitingHuman:funnel.dossierGate||null,
      terminal:(funnel.terminal||[]).map(trail=>({candidateId:trail.candidateId,
        state:trail.state,daysInState:trail.daysInState,blockers:trail.blockers})),
      stalled:funnel.stalled?.total??0,
    },
    evidenceGaps:evidenceGaps(entries,nowMs),
    retries:retries(entries),
    cost:cost(usage,jobsDone),
    freshness:{
      generatedAt:new Date(nowMs).toISOString(),
      oldestStateDays:stateAges.length?Math.max(...stateAges):null,
      oldestClaimDays:claimAges.length?Math.max(...claimAges):null,
      orchestrationUpdatedDays:dayValue(orchestration?.generatedAt,nowMs),
    },
  };
}

module.exports={CONTRACT_VERSION,PROGRAMME,DAILY_FREE_READS,DAILY_FREE_WRITES,
  UNWAIVABLE_CLAIM_KEYS,OPEN_STATES,evidenceGaps,retries,cost,summariseProgrammeHealth};
