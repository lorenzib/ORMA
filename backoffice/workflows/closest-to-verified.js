'use strict';

/**
 * Which trails are nearest to being verified, and what each one is waiting on.
 *
 * Every other report answers a stage-shaped question -- how many trails sit
 * where, how many gates are open, what a pass cost. None of them answers the
 * one actually asked after a month of this: which trail is closest, and what
 * stands between it and the seal.
 *
 * A trail is stopped by exactly two things, because everything else is waivable
 * and is accepted as unknown once research runs out: its line and its
 * directions. Sixteen unwaivable blockers describe a line that cannot be
 * trusted, four describe directions nobody published. This counts both per
 * trail and orders by how far the trail has actually come.
 */

const {UNWAIVABLE_BLOCKER_IDS,ROUTE_GUIDANCE_CLAIM_IDS,blockerId}=require('./compile-verified-dossier');

// The order a trail travels in. The index is the distance covered, which is the
// only honest way to say one trail is further than another.
const STAGES=Object.freeze(['geometry-audit','geometry-human-gate','evidence-research',
  'evidence-resolution','provenance-audit','red-team','dossier-human-gate','ready-for-editorial']);

const DIRECTION_BLOCKERS=new Set(UNWAIVABLE_BLOCKER_IDS.filter(id=>id.startsWith('logistics/')));

function stageIndex(state){
  const index=STAGES.indexOf(String(state));
  return index<0?-1:index;
}

/** Of a trail's standing blockers, which stop it and which only annotate it. */
function classifyBlockers(blockers){
  const standing=(blockers||[]).map(reason=>String(reason));
  const unwaivable=standing.filter(reason=>UNWAIVABLE_BLOCKER_IDS.includes(blockerId(reason)));
  return {
    total:standing.length,
    line:unwaivable.filter(reason=>!DIRECTION_BLOCKERS.has(blockerId(reason))).map(blockerId),
    directions:unwaivable.filter(reason=>DIRECTION_BLOCKERS.has(blockerId(reason))).map(blockerId),
    waivable:standing.length-unwaivable.length,
  };
}

/** How many of the four directions are settled, from the trail's own ledger. */
function directionsSettled(trail){
  const ledger=Object.values(trail?.claimResolution||{});
  const route=ledger.filter(entry=>ROUTE_GUIDANCE_CLAIM_IDS.includes(String(entry.claimId)));
  return {
    settled:route.filter(entry=>entry.state==='supported').length,
    exhausted:route.filter(entry=>entry.state==='source-exhausted'||entry.state==='contradicted').length,
    researching:route.filter(entry=>entry.state==='researchable').length,
    known:route.length,
  };
}

/**
 * Ordered by distance covered, then by how little stands in the way. A rejected
 * or blocked trail is reported with its reason rather than ranked, because it is
 * not on the way anywhere until something sends it back.
 */
function closestToVerified(orchestration,options={}){
  const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:15;
  const rows=(orchestration?.trails||[]).map(trail=>{
    const blockers=classifyBlockers(trail.blockers);
    return {
      trailId:trail.trailId||trail.candidateId,
      name:trail.trailName||trail.trailId||trail.candidateId,
      state:String(trail.state||'unknown'),
      stage:stageIndex(trail.state),
      blockers,
      directions:directionsSettled(trail),
      stopped:blockers.line.length+blockers.directions.length,
    };
  });
  const moving=rows.filter(row=>row.stage>=0)
    .sort((a,b)=>b.stage-a.stage||a.stopped-b.stopped||a.blockers.total-b.blockers.total);
  const parked=rows.filter(row=>row.stage<0);
  return {
    total:rows.length,
    moving:moving.length,
    parked:parked.length,
    stages:STAGES.map((state,index)=>({state,index,trails:rows.filter(row=>row.state===state).length})),
    nearest:moving.slice(0,limit),
    parkedBy:[...parked.reduce((counts,row)=>counts.set(row.state,(counts.get(row.state)||0)+1),new Map())]
      .map(([state,trails])=>({state,trails})).sort((a,b)=>b.trails-a.trails),
  };
}

module.exports={STAGES,DIRECTION_BLOCKERS,stageIndex,classifyBlockers,
  directionsSettled,closestToVerified};
