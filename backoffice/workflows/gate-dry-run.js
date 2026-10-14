'use strict';

/**
 * What the dossier gate would say about a trail, asked now rather than waited
 * for.
 *
 * A trail reaches the gate after six stages, and until it arrives nothing says
 * what will happen when it does. Finding out meant pushing it -- five passes
 * and an afternoon for Tre Cime -- then reading the answer out of a worker log.
 * Every fault found that way cost a day: the gate's unreachable stop rule, the
 * validator checking one of three things, the four silent refusals before a
 * named trail could even enter.
 *
 * So this assembles exactly what advancement would assemble at the red-team
 * stage -- the latest completed output per agent -- and hands it to the real
 * functions. It does not restate a single rule. `dossierBlockingReasons`,
 * `supportedRouteGuidance` and `gateDecision` are the ones that run in
 * production, so a dry run that disagreed with the gate would be a bug in the
 * gate rather than a difference of opinion.
 *
 * Read-only, no model call. The cost is the outputs it reads.
 */

const {dossierBlockingReasons,routeGuidanceBlockingReasons,supportedRouteGuidance,
  waivableBlocker,blockerId,ROUTE_GUIDANCE_CLAIM_IDS}=require('./compile-verified-dossier');
const {gateDecision}=require('./automate-existing-trail-verification');

/** The outputs the gate would see: the newest completed job from each agent. */
function latestOutputsByAgent(jobs,candidateId,outputFor){
  const completed=(jobs||[]).filter(job=>job.candidateId===candidateId&&job.status==='completed');
  const newest=new Map();
  for(const job of completed){
    const held=newest.get(job.agentId);
    const at=job.completedAt||job.createdAt||'';
    if(!held||String(at)>String(held.completedAt||held.createdAt||''))newest.set(job.agentId,job);
  }
  return [...newest.values()]
    .map(job=>({agentId:job.agentId,jobId:job.id,result:outputFor(job.id)}))
    .filter(output=>output.result);
}

/**
 * Where each route claim's answer comes from, which is the question that has
 * taken longest to answer by hand. An authority the agent cited, the map the
 * line was built from, or nothing yet.
 */
function routeGuidanceSources(review){
  return ROUTE_GUIDANCE_CLAIM_IDS.map(claimId=>{
    const answer=supportedRouteGuidance(review,claimId);
    if(!answer)return {claimId,answered:false,from:null,authority:null};
    // supportedLogisticsClaim returns {agentId, claim}; the map returns a claim.
    const claim=answer.claim||answer;
    const source=(claim.sources||[])[0]||null;
    return {
      claimId,
      answered:true,
      from:claim.derivedFrom==='route-relations'?'the map':'an authority',
      authority:source?.authority||null,
      value:String(claim.proposedValue||'').slice(0,160),
    };
  });
}

/**
 * The gate's verdict on a trail wherever it currently stands.
 *
 * `outputFor(jobId)` hands back a stored specialist output, so the caller owns
 * the reading and this stays testable without a store.
 */
function gateDryRun({orchestration,jobs,outputFor,trailId,at}={}){
  const trail=(orchestration?.trails||[]).find(item=>
    String(item.trailId)===String(trailId)||String(item.candidateId)===String(trailId));
  if(!trail)return {found:false,trailId};
  const specialistOutputs=latestOutputsByAgent(jobs,trail.candidateId,outputFor||(()=>null));
  const agents=specialistOutputs.map(output=>output.agentId).sort();
  const blockingReasons=dossierBlockingReasons(specialistOutputs);
  const unwaivable=[...new Set(blockingReasons.filter(reason=>!waivableBlocker(reason)).map(blockerId))];
  const review={reviewId:`dry-run-${trail.candidateId}`,candidateId:trail.candidateId,
    trailId:trail.trailId,trailName:trail.trailName,gateType:'dossier-approval',
    state:'awaiting-human',approvalAllowed:!blockingReasons.length,blockingReasons,
    specialistOutputs,sourceTrail:trail.sourceTrail,
    allowedActions:['approve','request-revision','reject'],publicMutationAllowed:false};
  // The policy that actually decides, asked over a queue holding only this one.
  let decision=null;
  try{ decision=gateDecision(review,{items:[review]},orchestration,new Set()); }
  catch(error){ decision={action:'errored',note:error.message}; }
  return {
    found:true,
    trailId:trail.trailId,
    trailName:trail.trailName||trail.trailId,
    state:trail.state,
    at:at||new Date().toISOString(),
    agentsReporting:agents,
    // Advancement past the evidence stages needs one completed job from each.
    missingAgents:['logistics','regulatoryRanger','terrainPoi'].filter(agent=>!agents.includes(agent)),
    routeGuidance:routeGuidanceSources(review),
    routeGuidanceBlockers:routeGuidanceBlockingReasons(specialistOutputs).map(blockerId),
    blockerCount:blockingReasons.length,
    unwaivable,
    waivableCount:blockingReasons.filter(waivableBlocker).length,
    wouldDecide:decision?.action||'nothing',
    becauseOf:decision?.targetAgent||null,
    note:decision?.note||null,
  };
}

module.exports={latestOutputsByAgent,routeGuidanceSources,gateDryRun};
