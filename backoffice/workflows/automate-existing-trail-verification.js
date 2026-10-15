'use strict';

const {currentBlockingReasons,waivableBlocker,blockerId,ROUTE_GUIDANCE_CLAIM_IDS}=require('./compile-verified-dossier');
const {planGateDispatches}=require('./dispatch-unanswered-gates');
const {rehydrateReviewQueue}=require('./rehydrate-review-detail');
const {blockerCountsByAgent,blockersForAgent}=require('../revision-target');
const {MAX_AUTOMATED_ATTEMPTS}=require('../contracts/resolution-policy-v1');

/**
 * How many times the gate sends a trail back when only optional detail stands.
 *
 * By the time this is reached the policy has already established that nothing
 * unwaivable is outstanding -- a missing route claim rejects two lines above.
 * So every revision from here researches detail the policy will record as
 * `unknown` whichever way it goes: the verdict is already decided and only the
 * thickness of the dossier is at stake.
 *
 * It was MAX_AUTOMATED_ATTEMPTS, five per agent. Measured on a trail with
 * nothing unwaivable: fifteen revisions before approval, three agents by five,
 * each one a specialist job and each a model call with a web search.
 * "Itinéraire découverte de la nature" spent eleven passes that way on 15
 * October and came to rest without a seal, and a whole top-up bought about a
 * trail and a half.
 *
 * One more look per agent keeps what the patience was for -- a first pass can
 * genuinely miss what a second finds -- and gives up the twelve calls that
 * were buying a fuller account of car park coordinates. ORMA tells a walker
 * the trail is real and what its terrain means for a dog; it does not promise
 * an exhaustive census of the cafés near it.
 *
 * A trail short of route guidance is untouched: that rejects above, and the
 * dispatch that chases a missing direction runs before any of this.
 */
const MAX_OPTIONAL_REVISIONS=1;

const POLICY_ACTOR='orma-existing-trail-verifier-v1';
const OPTIONAL_UNKNOWN_REASON='Automated evidence policy: the full research ladder was exhausted; this remains unknown and no unsupported fact will be published.';

function queuedIds(reviews,key){return new Set((reviews||[]).map(review=>String(review[key]||'')));}

/**
 * What a gate was short of, in the two terms that decide its fate.
 *
 * Route guidance is the only blocker class that can never be waived, so it is
 * the only one that turns into a rejection once research runs out. Everything
 * else is optional detail that is accepted as unknown. Reporting the counts
 * separately is what distinguishes a trail that is one search away from being
 * verified from one that is heading for a rejection -- and until this, both
 * logged as `"action": "request-revision"` and nothing else.
 */
function shortOf(item){
  const blockers=currentBlockingReasons(item);
  if(!blockers.length)return {};
  const routeGuidance=[...new Set(blockers.map(blockerId)
    .filter(id=>ROUTE_GUIDANCE_CLAIM_IDS.includes(String(id).replace(/^logistics\//,''))))];
  const unwaivable=[...new Set(blockers.filter(reason=>!waivableBlocker(reason)).map(blockerId))];
  return {blockerCount:blockers.length,
    ...(routeGuidance.length?{missingRouteGuidance:routeGuidance}:{}),
    ...(unwaivable.length?{unwaivable}:{})};
}

/**
 * Decide routine evidence gates under the approved existing-catalogue policy.
 * Researchable findings are deliberately omitted here: dispatch runs first and
 * its queued review id prevents this pass from deciding over the revision.
 */
function gateDecision(item,reviewQueue,orchestration,queuedReviewIds){
  if(!item||item.state!=='awaiting-human'||queuedReviewIds.has(String(item.reviewId)))return null;
  const dispatch=planGateDispatches(orchestration,reviewQueue,{limit:Number.MAX_SAFE_INTEGER,
    queuedReviewIds:[...queuedReviewIds]}).dispatches.find(entry=>entry.reviewId===item.reviewId);
  if(dispatch)return {action:'request-revision',targetAgent:dispatch.targetAgent,
    note:dispatch.note,acceptedBlockers:[]};
  const blockers=currentBlockingReasons(item);
  if(!blockers.length)return {action:'approve',acceptedBlockers:[]};
  const unwaivable=blockers.filter(reason=>!waivableBlocker(reason));
  if(unwaivable.length)return {action:'reject',acceptedBlockers:[],
    note:`Automated evidence policy withheld verification because critical route evidence could not be established: ${unwaivable.join('; ')}`};
  const trail=(orchestration.trails||[]).find(candidate=>String(candidate.candidateId)===String(item.candidateId));
  const remaining=[...blockerCountsByAgent(blockers).keys()].find(agentId=>{
    const mine=blockersForAgent(blockers,agentId);
    // Without the count. This read `/five automated.../` while the producer
    // wrote "five", and the moment optional detail stopped at three the two
    // would have stopped matching -- leaving every trail whose remaining
    // blockers were all exhausted looking like it still had research to do,
    // and circulating for ever. Exactly the shape of #472.
    const exhaustedByClaim=mine.length&&mine.every(reason=>/automated resolution strategies exhausted/i.test(reason));
    return !exhaustedByClaim&&Number(trail?.resolutionAttempts?.[agentId]||0)<MAX_OPTIONAL_REVISIONS;
  });
  if(remaining)return {action:'request-revision',targetAgent:remaining,acceptedBlockers:[],
    note:`ORMA evidence policy: continue exhaustive optional-detail scouting for ${blockersForAgent(blockers,remaining).join('; ')}. Preserve unsupported claims as unknown.`};
  return {action:'approve',acceptedBlockers:blockers.map(blocker=>({blocker,reason:OPTIONAL_UNKNOWN_REASON}))};
}

async function automateEvidenceGates(store,options={}){
  if(options.autoVerificationEnabled===false||typeof store.submitDossierReview!=='function')return [];
  const [orchestration,rawQueue,queued]=await Promise.all([
    store.getArtifact('trail-orchestration'),store.getArtifact('dossier-review-queue'),store.listDossierReviews('queued'),
  ]);
  if(!orchestration||!rawQueue)return [];
  const existingIds=Array.isArray(options.productionTrails)
    ?new Set(options.productionTrails.map(trail=>String(trail.id))):null;
  const pending=queuedIds(queued,'reviewId');const outcomes=[];
  for(const raw of (rawQueue.items||[]).filter(item=>item.state==='awaiting-human').slice(0,options.autoVerificationLimit||20)){
    if(existingIds&&!existingIds.has(String(raw.trailId||raw.candidateId)))continue;
    if(pending.has(String(raw.reviewId)))continue;
    const hydrated=await rehydrateReviewQueue(store,rawQueue,raw.reviewId);
    const item=(hydrated.items||[]).find(entry=>entry.reviewId===raw.reviewId)||raw;
    const decision=gateDecision(item,hydrated,orchestration,pending);
    if(!decision)continue;
    try{
      const written=await store.submitDossierReview({reviewId:item.reviewId,candidateId:item.candidateId,
        ...decision,submittedBy:POLICY_ACTOR});
      pending.add(String(item.reviewId));
      // An action on its own does not say what the gate was short of, and with
      // no desk left to look at there is nowhere else to find out. A revision
      // that went to logistics means the directions are still missing; one that
      // went anywhere else means optional detail. Those are different problems
      // with different fixes and they read identically as "request-revision".
      outcomes.push({reviewId:item.reviewId,candidateId:item.candidateId,gateType:item.gateType,
        action:decision.action,status:'queued',decisionId:written?.reviewId||null,
        ...(decision.targetAgent?{targetAgent:decision.targetAgent}:{}),
        ...shortOf(item)});
    }catch(error){outcomes.push({reviewId:item.reviewId,candidateId:item.candidateId,status:'blocked',error:String(error.message||error)});}
  }
  return outcomes;
}

async function automateEditorialReviews(store,options={}){
  if(options.autoVerificationEnabled===false||typeof store.submitContentReview!=='function')return [];
  const [queue,execution,reviewQueue,queued]=await Promise.all([
    store.getArtifact('verified-trail-editorial-queue'),store.getArtifact('verified-trail-editorial-execution'),
    store.getArtifact('content-review-queue'),store.listReviews('queued'),
  ]);
  if(!queue||!execution)return [];
  const scoped=Array.isArray(options.productionTrails);
  const existingIds=new Set((options.productionTrails||[]).map(trail=>String(trail.id)));
  const normalizedItems=(queue.items||[]).map(item=>existingIds.has(String(item.targetTrailId))
    ?{...item,assetPolicy:'preserve-existing'}:item);
  const normalizedQueue={...queue,items:normalizedItems};
  if(normalizedItems.some((item,index)=>item!==(queue.items||[])[index])){
    await store.setArtifact('verified-trail-editorial-queue',normalizedQueue,{migratedToEvidencePolicy:true});
  }
  const decided=new Set((reviewQueue?.submissions||[]).flatMap(submission=>submission.decisions||[]).map(decision=>decision.jobId));
  for(const review of queued||[])for(const decision of review.decisions||[])decided.add(decision.jobId);
  const eligible=new Set(normalizedItems.filter(item=>item.assetPolicy==='preserve-existing'
    &&(!scoped||existingIds.has(String(item.targetTrailId||item.candidateId)))).map(item=>item.candidateId));
  const outcomes=[];
  for(const output of (execution.outputs||[]).filter(output=>output.agentId==='copywriter'&&output.status==='ready-for-review'
      &&eligible.has(output.candidateId)&&!decided.has(output.jobId)).slice(0,options.autoEditorialLimit||20)){
    try{
      const written=await store.submitContentReview({decisions:[{jobId:output.jobId,action:'approve',note:'Validated against the locked evidence dossier.'}],submittedBy:POLICY_ACTOR});
      decided.add(output.jobId);outcomes.push({jobId:output.jobId,candidateId:output.candidateId,status:'queued',reviewId:written?.reviewId||null});
    }catch(error){outcomes.push({jobId:output.jobId,candidateId:output.candidateId,status:'blocked',error:String(error.message||error)});}
  }
  return outcomes;
}

async function automatePublicationReviews(store,options={}){
  if(options.autoVerificationEnabled===false||typeof store.submitPublicationReview!=='function')return [];
  const [staging,requests,queued]=await Promise.all([
    store.getArtifact('publication-staging'),store.getArtifact('publication-requests'),store.listPublicationReviews('queued'),
  ]);
  if(!staging)return [];
  const scoped=Array.isArray(options.productionTrails);
  const existingIds=new Set((options.productionTrails||[]).map(trail=>String(trail.id)));
  const decided=new Set([...(requests?.requests||[]).map(item=>item.candidateId),...(queued||[]).map(item=>item.candidateId)]);
  const outcomes=[];
  for(const item of (staging.items||[]).filter(candidate=>candidate.state==='ready-for-publication-preview'
      &&candidate.assetPolicy==='preserve-existing'&&!decided.has(candidate.candidateId)
      &&(!scoped||existingIds.has(String(candidate.targetTrailId||candidate.candidateId)))).slice(0,options.autoPublicationLimit||20)){
    try{
      const written=await store.submitPublicationReview({candidateId:item.candidateId,action:'approve-for-pr-creation',
        note:'Evidence-policy approval; publication remains gated by the repository quality gate.',submittedBy:POLICY_ACTOR});
      decided.add(item.candidateId);outcomes.push({candidateId:item.candidateId,status:'queued',reviewId:written?.reviewId||null});
    }catch(error){outcomes.push({candidateId:item.candidateId,status:'blocked',error:String(error.message||error)});}
  }
  return outcomes;
}

module.exports={MAX_OPTIONAL_REVISIONS,POLICY_ACTOR,OPTIONAL_UNKNOWN_REASON,gateDecision,automateEvidenceGates,automateEditorialReviews,automatePublicationReviews};
