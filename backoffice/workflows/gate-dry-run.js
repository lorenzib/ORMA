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
const {MAX_AUTOMATED_ATTEMPTS}=require('../contracts/resolution-policy-v1');

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
function routeGuidanceSources(review,options={}){
  return ROUTE_GUIDANCE_CLAIM_IDS.map(claimId=>{
    const answer=supportedRouteGuidance(review,claimId,options);
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
function gateDryRun({orchestration,jobs,outputFor,trailId,at,trail:catalogueTrail}={}){
  const trail=(orchestration?.trails||[]).find(item=>
    String(item.trailId)===String(trailId)||String(item.candidateId)===String(trailId));
  if(!trail)return {found:false,trailId};
  const specialistOutputs=latestOutputsByAgent(jobs,trail.candidateId,outputFor||(()=>null));
  const agents=specialistOutputs.map(output=>output.agentId).sort();
  const blockingReasons=dossierBlockingReasons(specialistOutputs,
    catalogueTrail?{trail:catalogueTrail}:{});
  const unwaivable=[...new Set(blockingReasons.filter(reason=>!waivableBlocker(reason)).map(blockerId))];
  const review={reviewId:`dry-run-${trail.candidateId}`,candidateId:trail.candidateId,
    trailId:trail.trailId,trailName:trail.trailName,gateType:'dossier-approval',
    state:'awaiting-human',approvalAllowed:!blockingReasons.length,blockingReasons,
    specialistOutputs,sourceTrail:trail.sourceTrail,
    allowedActions:['approve','request-revision','reject'],publicMutationAllowed:false};
  // ORMA's own record is current catalogue data, not a measurement frozen when
  // the audit ran. Reading it from the stored output would report what the
  // catalogue said the day the cartographer last ran -- which is the stale
  // picture this tool exists to replace -- and would miss a start point
  // corrected since.
  const options={...(catalogueTrail?{trail:catalogueTrail}:{})};
  // The policy that actually decides, asked over a queue holding only this one.
  let decision=null;
  try{ decision=gateDecision(review,{items:[review]},orchestration,new Set()); }
  catch(error){ decision={action:'errored',note:error.message}; }
  // And what it would decide once the research is over.
  //
  // "request-revision" today says only that some agent still has attempts
  // left; it does not say whether the trail can ever be verified, which is the
  // question actually being asked. Running the same policy over the same
  // evidence with every agent's attempts spent answers it: if the end state is
  // approve, the trail needs passes and nothing else, and the only thing
  // between it and a seal is credits.
  //
  // The evidence is not changed, so this is a floor and not a forecast. More
  // research can only answer claims, never create a blocker that is not
  // already here.
  const spent={...orchestration,trails:(orchestration?.trails||[]).map(item=>
    item.candidateId===trail.candidateId
      ? {...item,resolutionAttempts:Object.fromEntries(
          ['logistics','regulatoryRanger','terrainPoi','evidenceLibrarian','redTeam','cartographer']
            .map(agentId=>[agentId,MAX_AUTOMATED_ATTEMPTS]))}
      : item)};
  let ending=null;
  try{ ending=gateDecision(review,{items:[review]},spent,new Set()); }
  catch(error){ ending={action:'errored',note:error.message}; }
  return {
    found:true,
    trailId:trail.trailId,
    trailName:trail.trailName||trail.trailId,
    state:trail.state,
    at:at||new Date().toISOString(),
    agentsReporting:agents,
    // Advancement past the evidence stages needs one completed job from each.
    missingAgents:['logistics','regulatoryRanger','terrainPoi'].filter(agent=>!agents.includes(agent)),
    routeGuidance:routeGuidanceSources(review,options),
    routeGuidanceBlockers:routeGuidanceBlockingReasons(specialistOutputs).map(blockerId),
    blockerCount:blockingReasons.length,
    unwaivable,
    waivableCount:blockingReasons.filter(waivableBlocker).length,
    wouldDecide:decision?.action||'nothing',
    // What it comes to once every agent has spent its attempts on this same
    // evidence: the answer to "can this trail be verified at all".
    wouldDecideWhenResearchEnds:ending?.action||'nothing',
    becauseOf:decision?.targetAgent||null,
    note:decision?.note||null,
  };
}

module.exports={latestOutputsByAgent,routeGuidanceSources,gateDryRun};
