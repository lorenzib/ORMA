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
  currentBlockingReasons,waivableBlocker,blockerId,ROUTE_GUIDANCE_CLAIM_IDS}=require('./compile-verified-dossier');
const {gateDecision}=require('./automate-existing-trail-verification');
const {MAX_AUTOMATED_ATTEMPTS}=require('../contracts/resolution-policy-v1');

// What answered a claim, in the words the standard uses for it. A claim with
// no `derivedFrom` is the agent's own, cited to somebody who published it.
const SOURCE_NAMES=Object.freeze({'route-relations':'the map','orma-record':"ORMA's own record"});

/**
 * Where the report and the decision disagree about what blocks a trail.
 *
 * Two computations of one fact. The report recomputes the blockers with the
 * catalogue in hand; `currentBlockingReasons` is what the policy decides on.
 * Both are now given the same evidence, so anything here is a fault somebody
 * has reintroduced -- which is what this exists to catch.
 *
 * It compares the two lists rather than asking whether a claim is answered.
 * Asking that mislabelled ten trails as faults on 15 October 2026: their start
 * was answered and deliberately held by a contradiction the agent had found,
 * both halves agreed about it, and nothing was wrong except the word on the
 * line. A rule working as designed is not a bug, and printing it as one sends
 * somebody to look for code that is behaving.
 *
 * It is never a judgement about the walk. It means one computation is seeing
 * evidence the other cannot.
 */
function reportVersusDecision(reportUnwaivable,decidedUnwaivable){
  const report=new Set(reportUnwaivable||[]);const decided=new Set(decidedUnwaivable||[]);
  return [...new Set([...report,...decided])].filter(id=>report.has(id)!==decided.has(id));
}

/**
 * A direction that is answered and still held, because the agent found sources
 * that contradict each other.
 *
 * Not a fault and not a missing answer: a judgement the contract makes on
 * purpose, since reading where the ways run does not settle a disagreement
 * between two authorities about what anybody recommends. It is named separately
 * because it is the one category a person can decide about -- the others are
 * code to fix or research to commission.
 */
function contestedAnswers(routeGuidance,decidedUnwaivable){
  const answered=new Set((routeGuidance||[]).filter(entry=>entry.answered).map(entry=>entry.claimId));
  return [...new Set((decidedUnwaivable||[]).filter(id=>answered.has(String(id).split('/').pop())))];
}

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
      // Three sources, never blurred. The standard requires a reader be told
      // which of them they have, and ORMA's own record is the weakest -- it
      // was reading as "answered by an authority - ORMA", which is the one
      // thing it must never read as.
      from:SOURCE_NAMES[claim.derivedFrom]||'an authority',
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
    // The catalogue record, so the decision answers from ORMA's own record
    // exactly as the gate pass now does. Without it the dry run would be
    // stricter than the gate and report a fault that production does not have.
    ...(catalogueTrail?{trail:catalogueTrail}:{}),
    allowedActions:['approve','request-revision','reject'],publicMutationAllowed:false};
  // ORMA's own record is current catalogue data, not a measurement frozen when
  // the audit ran. Reading it from the stored output would report what the
  // catalogue said the day the cartographer last ran -- which is the stale
  // picture this tool exists to replace -- and would miss a start point
  // corrected since.
  const options={...(catalogueTrail?{trail:catalogueTrail}:{})};
  const routeGuidance=routeGuidanceSources(review,options);
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
  // A claim the ladder answered that the *decision* still names as the thing
  // deciding against the trail.
  //
  // These are two computations of one fact, and the comparison has to be
  // between the two that actually differ. The report reads the catalogue as it
  // stands; `currentBlockingReasons` is what the policy decides on, recomputed
  // from the stored outputs alone and never handed the trail -- so ORMA's own
  // record can answer in the report and not in the decision.
  //
  // Fenn Promenade read exactly that way on 15 October 2026: all four
  // directions answered, "Nothing unwaivable stands", zero blockers, and the
  // gate rejected it for recommended-start and route-number-status being
  // required. The only way to notice was to read both halves and spot it, and
  // finding out why took an afternoon of reading the gate by hand.
  //
  // It is never a judgement about the walk. It means one computation is seeing
  // evidence the other cannot, so it is reported as the fault it is.
  // A measurement that was attempted and could not be taken. It is not a
  // verdict and not research to commission: it is a survey to run again, and
  // without it a trail reads as refused for want of evidence nobody could get.
  const unmeasured=latestOutputsByAgent(jobs,trail.candidateId,outputFor||(()=>null))
    .find(output=>output.agentId==='cartographer')?.result?.routeNumbersUnmeasured||null;
  const decided=[...new Set(currentBlockingReasons(review)
    .filter(reason=>!waivableBlocker(reason)).map(blockerId))];
  const disagreement=reportVersusDecision(unwaivable,decided);
  const contested=contestedAnswers(routeGuidance,decided);
  return {
    found:true,
    trailId:trail.trailId,
    trailName:trail.trailName||trail.trailId,
    state:trail.state,
    at:at||new Date().toISOString(),
    agentsReporting:agents,
    // Advancement past the evidence stages needs one completed job from each.
    missingAgents:['logistics','regulatoryRanger','terrainPoi'].filter(agent=>!agents.includes(agent)),
    routeGuidance,
    // The report and the decision disagreeing about what blocks this trail:
    // a fault rather than a verdict, and after #810 it should be empty.
    reportVersusDecision:disagreement,
    // Answered, and held on purpose because the agent found sources that
    // contradict each other. The one category a person can decide about.
    contestedAnswers:contested,
    // Why the numbers along this walk were never measured, where somebody
    // tried. A survey to run again, not a walk to research.
    routeNumbersUnmeasured:unmeasured,
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

module.exports={latestOutputsByAgent,routeGuidanceSources,reportVersusDecision,contestedAnswers,gateDryRun};
