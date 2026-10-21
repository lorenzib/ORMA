'use strict';

/**
 * Look again at a trail rejected under a rule that has since changed.
 *
 * `requeue-fixed-jobs` releases a blocked job whose cause was fixed. A rejected
 * trail had no equivalent, and rejection is terminal: the state is final, the
 * queued work is cancelled, and the stored assessment keeps the verdict that
 * produced it. So a contract change reaches every trail still moving and none
 * of the ones it would have saved.
 *
 * "Boucle du Taillefer" is the case this was written for. It was rejected for
 * not-closed-loop at 101 m against a flat 100 m threshold; #748 made the
 * tolerance scale with the line, which would have passed it at 134 m. The
 * change arrived a day late and could not reach it.
 *
 * Sending a trail back is not the same as approving it. It returns to the audit
 * that rejected it and is judged again from scratch by whatever the rules now
 * are -- which may reject it a second time, and should if it deserves it.
 */

const {blockersForAgent,blockerCountsByAgent}=require('../revision-target');

// Where a trail goes back to, by the agent that has to look again. A geometry
// fault is re-measured by the cartographer from the relation; everything else
// is evidence, and evidence-research is where the base agents run.
const RETURN_STATE=Object.freeze({
  cartographer:{state:'geometry-audit',stage:'route-identity-and-geometry',
    action:'audit-route-geometry'},
});
const EVIDENCE_RETURN=Object.freeze({state:'evidence-research',stage:'evidence-gathering',
  action:'research-trail-evidence'});

function rejectedTrails(orchestration){
  return (orchestration?.trails||[]).filter(trail=>String(trail.state)==='rejected');
}

/** Every reason a rejected trail carries, counted, so a pattern can be chosen. */
function rejectionReasons(orchestration){
  const counts=new Map();
  for(const trail of rejectedTrails(orchestration)){
    for(const blocker of trail.blockers||[]){
      const key=String(blocker).slice(0,110);
      counts.set(key,(counts.get(key)||0)+1);
    }
    if(!(trail.blockers||[]).length)counts.set('(no blocker recorded)',(counts.get('(no blocker recorded)')||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count}));
}

/** The agent that has to look again, from the blockers the trail was rejected on. */
function reviewerFor(blockers){
  const counts=blockerCountsByAgent(blockers||[]);
  if(counts.has('cartographer'))return 'cartographer';
  const [first]=[...counts.keys()];
  return first||'cartographer';
}

/**
 * Which rejected trails match, and what sending each one back would mean.
 *
 * The reason has to be named. There is no "reconsider everything rejected":
 * most of them were rejected correctly, and sending those back spends the model
 * budget to reach the same verdict.
 */
function planReconsideration(orchestration,options={}){
  const pattern=String(options.reason||'').trim();
  const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:10;
  const rejected=rejectedTrails(orchestration);
  // Or named one by one. A reason is how to send back a pattern; a name is how
  // to send back one trail somebody has looked at -- the trail board's "Look
  // at it again". Nine of the seventeen rejected on 21 October 2026 carried no
  // blocker at all, so no reason could ever have matched them.
  const named=new Set((options.trailIds||[]).map(id=>String(id).trim()).filter(Boolean));
  if(!pattern&&!named.size)return {rejected:rejected.length,reasons:rejectionReasons(orchestration),returning:[],held:0};
  const matcher=pattern?new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'):null;
  const matched=named.size
    ?rejected.filter(trail=>named.has(String(trail.candidateId))||named.has(String(trail.trailId)))
    :rejected.filter(trail=>(trail.blockers||[]).some(blocker=>matcher.test(String(blocker))));
  const returning=matched.slice(0,limit).map(trail=>{
    const agentId=reviewerFor(trail.blockers);
    const target=RETURN_STATE[agentId]||EVIDENCE_RETURN;
    return {trailId:trail.trailId,candidateId:trail.candidateId,trailName:trail.trailName||trail.trailId,
      agentId,state:target.state,stage:target.stage,action:target.action,
      matched:matcher?(trail.blockers||[]).filter(blocker=>matcher.test(String(blocker))).slice(0,4):['named'],
      otherBlockers:blockersForAgent(trail.blockers||[],agentId).length};
  });
  return {rejected:rejected.length,reasons:[],returning,held:matched.length-returning.length};
}

/**
 * The trail as it goes back: the rejection cleared, the gate gone, and the
 * attempt counter advanced so the new pass is a new attempt rather than a
 * replay of the one that failed.
 */
function returnedTrail(trail,entry,at){
  const attempts={...(trail.attempts||{})};
  attempts[entry.agentId]=Number(attempts[entry.agentId]||0)+1;
  return {...trail,state:entry.state,stage:entry.stage,attempts,
    gate:null,blockers:[],currentJobId:null,
    reconsideredAt:at,reconsideredFrom:'rejected',updatedAt:at};
}

module.exports={RETURN_STATE,EVIDENCE_RETURN,rejectedTrails,rejectionReasons,
  reviewerFor,planReconsideration,returnedTrail};
