'use strict';

/**
 * Why a queued job is not being picked up.
 *
 * On 2026-10-06 the pipeline held 116 queued jobs, 0 running, 0 blocked, and
 * the worker reported "no agent work to pick up" on every pass. Every report
 * agreed and none of them helped: the funnel counts a queued job as work owed,
 * so the trail is "not stalled"; pipeline-health counts it under "working"; the
 * worker says only that it attempted nothing. A job can be queued and still be
 * unclaimable, and nothing said so.
 *
 * `claimJob` refuses a job whose `notBefore` is in the future, and the worker
 * takes the oldest N queued jobs per pass — so a few permanently unclaimable
 * jobs at the head of the queue starve every job behind them. This measures
 * exactly that: of the jobs a lane could run, how many can be claimed now, and
 * for the rest, what is holding them and until when.
 *
 * The head has to be the worker's head, not the queue's. The worker filters by
 * job type before it takes its batch, so a job in a lane it does not run is not
 * in front of anything. Reading that wrong reports a dead lane as the cause of
 * a stall it has nothing to do with — which is exactly what this tool did on
 * its first run.
 */

const CLAIMABLE='claimable-now';
const WAITING='waiting-for-its-schedule';
const RETIRED_LANE='lane-has-no-processor';
const UNKNOWN_TRAIL='no-catalogue-trail';

function timeValue(value){
  if(!value)return null;
  if(typeof value.toDate==='function')return value.toDate().getTime();
  if(value.seconds)return Number(value.seconds)*1000;
  const parsed=new Date(value).getTime();
  return Number.isNaN(parsed)?null:parsed;
}

function minutes(ms){return Math.round(ms/60000);}

/** Why this job cannot be claimed right now, or null if it can. */
function holdOn(job,{nowMs,processableJobTypes,trailIds}){
  if(!processableJobTypes.includes(job.jobType))return {reason:RETIRED_LANE};
  const notBefore=timeValue(job.notBefore);
  if(notBefore&&notBefore>nowMs)return {reason:WAITING,until:new Date(notBefore).toISOString(),
    inMinutes:minutes(notBefore-nowMs)};
  if(job.candidateId&&trailIds.size&&!trailIds.has(job.candidateId))return {reason:UNKNOWN_TRAIL};
  return null;
}

/**
 * @param jobs every queued job.
 * @param options.processableJobTypes the lanes the worker still runs.
 * @param options.trailIds catalogue ids a specialist job can be run against.
 * @param options.headCount how many the worker takes per pass — the starvation
 *   question is about the head of the queue, not the queue as a whole.
 */
function summariseJobQueue(jobs=[],options={}){
  const nowMs=options.nowMs??Date.now();
  const processableJobTypes=options.processableJobTypes||[];
  const trailIds=options.trailIds instanceof Set?options.trailIds:new Set(options.trailIds||[]);
  const headCount=Number(options.headCount||10);
  const queued=jobs.filter(job=>job.status==='queued');
  // The worker reads them oldest first, so that is the order that decides what
  // runs and what never gets looked at.
  const ordered=[...queued].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const described=ordered.map(job=>{
    const hold=holdOn(job,{nowMs,processableJobTypes,trailIds});
    return {id:job.id,jobType:job.jobType||'(unknown)',candidateId:job.candidateId||null,
      createdAt:job.createdAt||null,status:hold?hold.reason:CLAIMABLE,...(hold||{})};
  });
  const byReason=new Map();
  for(const job of described)byReason.set(job.status,(byReason.get(job.status)||0)+1);
  // What the worker would actually pick up. It filters twice before taking its
  // batch -- to the lanes it runs, and to the jobs that are due -- so neither a
  // retired lane nor a job scheduled for tomorrow sits in front of anything.
  //
  // The schedule half of that was #615, and this model was not updated with it:
  // for a day it reported STARVED, "the pass will report no agent work to pick
  // up however long the queue is", against a worker that had just been changed
  // to skip exactly those jobs. 85 claimable jobs were reported as unreachable
  // behind ten scheduled ones the worker never looks at.
  const inReach=described.filter(job=>job.status!==RETIRED_LANE&&job.status!==WAITING);
  const head=inReach.slice(0,headCount);
  const waiting=described.filter(job=>job.status===WAITING&&job.inMinutes!=null);
  return {
    generatedAt:new Date(nowMs).toISOString(),
    queued:queued.length,
    claimableNow:described.filter(job=>job.status===CLAIMABLE).length,
    byReason:[...byReason.entries()].sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count})),
    // The head is what the worker actually tries. If none of it can be claimed,
    // the pass does nothing however long the queue behind it is.
    head:{count:head.length,claimable:head.filter(job=>job.status===CLAIMABLE).length,jobs:head},
    // Not in anyone's way since #615, but still the answer to "when does this
    // move", so it keeps its own list rather than disappearing with the head.
    scheduled:described.filter(job=>job.status===WAITING)
      .sort((a,b)=>(a.inMinutes??0)-(b.inMinutes??0)).slice(0,10),
    // Queued, and in no lane this worker runs. Not in anyone's way, and not
    // work either — it will sit there until someone retires it.
    outsideEveryLane:described.filter(job=>job.status===RETIRED_LANE).length,
    starved:head.length>0&&head.every(job=>job.status!==CLAIMABLE)&&inReach.some(job=>job.status===CLAIMABLE),
    soonestClaimable:waiting.length?Math.min(...waiting.map(job=>job.inMinutes)):null,
    latestSchedule:waiting.length?Math.max(...waiting.map(job=>job.inMinutes)):null,
  };
}

module.exports={CLAIMABLE,WAITING,RETIRED_LANE,UNKNOWN_TRAIL,summariseJobQueue};
