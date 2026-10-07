'use strict';

// Run worker passes back to back until the verification queue is empty or a
// budget runs out.
//
// The hosted worker runs ten specialist jobs every three hours: eighty a day.
// On 2026-10-07 the queue held 99 jobs with 48 trails in the pipeline and more
// jobs are created as each trail advances, so at that cadence the existing
// catalogue takes months to clear -- and the pipeline needs no human at any
// gate any more (#617, #634, #639), it only needs passes.
//
// Passes are what the Firestore free tier rations. The quota ran out at 20:58
// UTC on 2026-10-06 and killed every pass until the next reset, so this loop
// does not run "until done": it runs until the queue is idle, the clock budget
// is spent, or the read/write budget the caller set is spent -- and it meters
// the spend per pass so the next budget is a measurement, not a guess.

const {summariseWorkAttempted}=require('./worker-productivity');

const DEFAULT_BUDGETS=Object.freeze({
  maxMinutes:240,
  // Leaves most of a 50,000-read day for the three-hourly crons and the desk.
  readBudget:20000,
  writeBudget:8000,
  // Two consecutive passes that claimed nothing: nothing claimable is left.
  idlePassesToStop:2,
  maxPasses:200,
});

const QUOTA_PATTERN=/RESOURCE_EXHAUSTED|Quota exceeded/i;

/** Did Firestore refuse for quota anywhere in this pass's result or error? */
function quotaExhausted(value){
  if(value==null)return false;
  if(value instanceof Error)return QUOTA_PATTERN.test(`${value.message} ${value.code||''}`);
  try{return QUOTA_PATTERN.test(JSON.stringify(value));}
  catch(error){return QUOTA_PATTERN.test(String(value));}
}

function budgetsFrom(options={}){
  const pick=(key)=>{const value=Number(options[key]);return Number.isFinite(value)&&value>0?value:DEFAULT_BUDGETS[key];};
  return {maxMinutes:pick('maxMinutes'),readBudget:pick('readBudget'),writeBudget:pick('writeBudget'),
    idlePassesToStop:pick('idlePassesToStop'),maxPasses:pick('maxPasses')};
}

/** Why the loop stopped before running another pass, or null to continue. */
function stopBeforePass(state,budgets,usage,elapsedMs){
  if(state.passes.length>=budgets.maxPasses)return 'pass-limit';
  if(elapsedMs>=budgets.maxMinutes*60_000)return 'time-budget';
  if(usage.reads>=budgets.readBudget)return 'read-budget';
  if(usage.writes>=budgets.writeBudget)return 'write-budget';
  return null;
}

function averages(passes){
  const done=passes.filter(pass=>!pass.error);
  if(!done.length)return null;
  const sum=(key)=>done.reduce((total,pass)=>total+(pass[key]||0),0);
  const jobs=sum('succeeded');
  return {passes:done.length,readsPerPass:Math.round(sum('reads')/done.length),writesPerPass:Math.round(sum('writes')/done.length),
    jobsPerPass:Number((jobs/done.length).toFixed(1)),readsPerJob:jobs?Math.round(sum('reads')/jobs):null,
    writesPerJob:jobs?Math.round(sum('writes')/jobs):null,minutesPerPass:Number((sum('durationMs')/done.length/60_000).toFixed(1))};
}

/**
 * @param options.runPass  async (passIndex) => worker result. Must build its
 *   own store around `options.usage` so the meter sees every pass.
 * @param options.usage    a FirestoreUsageMeter shared by every pass.
 */
async function drainVerificationQueue(options={}){
  const {runPass,usage}=options;
  if(typeof runPass!=='function')throw new TypeError('drainVerificationQueue needs a runPass function');
  if(!usage||typeof usage.since!=='function')throw new TypeError('drainVerificationQueue needs a usage meter');
  const now=options.now||(()=>Date.now());
  const log=options.log||(()=>{});
  const budgets=budgetsFrom(options);
  const startedAtMs=now();
  const state={passes:[],stoppedBecause:null,idlePasses:0};
  for(;;){
    const reason=stopBeforePass(state,budgets,usage.snapshot(),now()-startedAtMs);
    if(reason){state.stoppedBecause=reason;break;}
    const before=usage.snapshot();const passStartedMs=now();const index=state.passes.length+1;
    let result=null,error=null;
    try{result=await runPass(index);}catch(caught){error=caught;}
    const spent=usage.since(before);
    const work=error?null:summariseWorkAttempted(result);
    const pass={index,startedAt:new Date(passStartedMs).toISOString(),durationMs:Math.max(0,now()-passStartedMs),
      reads:spent.reads,writes:spent.writes,
      ...(work?{attempted:work.attempted,succeeded:work.succeeded,failed:work.failed,providerParked:work.providerParked,
        outcome:work.attempted?(work.succeeded>0?'productive':'unproductive'):'idle'}:{}),
      ...(error?{error:String(error.message||error).slice(0,500)}:{})};
    state.passes.push(pass);
    log(pass);
    if(error){state.stoppedBecause=quotaExhausted(error)?'firestore-quota':'pass-error';break;}
    if(quotaExhausted(result)){state.stoppedBecause='firestore-quota';break;}
    if(work.providerParked){state.stoppedBecause='provider-parked';break;}
    if(work.attempted===0){
      state.idlePasses+=1;
      if(state.idlePasses>=budgets.idlePassesToStop){state.stoppedBecause='queue-idle';break;}
    }else state.idlePasses=0;
  }
  const totals=usage.snapshot();
  const sum=(key)=>state.passes.reduce((total,pass)=>total+(pass[key]||0),0);
  return {contractVersion:'1.0.0',startedAt:new Date(startedAtMs).toISOString(),completedAt:new Date(now()).toISOString(),
    durationMs:now()-startedAtMs,budgets,stoppedBecause:state.stoppedBecause,
    totals:{passes:state.passes.length,reads:totals.reads,writes:totals.writes,
      attempted:sum('attempted'),succeeded:sum('succeeded'),failed:sum('failed')},
    averages:averages(state.passes),passes:state.passes};
}

// A stop the budget was designed to produce is not a failure of the drain.
const CLEAN_STOPS=Object.freeze(['queue-idle','time-budget','read-budget','write-budget','pass-limit']);

module.exports={DEFAULT_BUDGETS,CLEAN_STOPS,quotaExhausted,budgetsFrom,stopBeforePass,drainVerificationQueue};
