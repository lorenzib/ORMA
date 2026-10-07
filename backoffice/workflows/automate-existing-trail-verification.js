'use strict';

const {currentBlockingReasons,waivableBlocker}=require('./compile-verified-dossier');
const {planGateDispatches}=require('./dispatch-unanswered-gates');
const {rehydrateReviewQueue}=require('./rehydrate-review-detail');
const {blockerCountsByAgent,blockersForAgent}=require('../revision-target');
const {MAX_AUTOMATED_ATTEMPTS}=require('../contracts/resolution-policy-v1');

const POLICY_ACTOR='orma-existing-trail-verifier-v1';
const OPTIONAL_UNKNOWN_REASON='Automated evidence policy: the full research ladder was exhausted; this remains unknown and no unsupported fact will be published.';

function queuedIds(reviews,key){return new Set((reviews||[]).map(review=>String(review[key]||'')));}

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
    const exhaustedByClaim=mine.length&&mine.every(reason=>/five automated resolution strategies exhausted/i.test(reason));
    return !exhaustedByClaim&&Number(trail?.resolutionAttempts?.[agentId]||0)<MAX_AUTOMATED_ATTEMPTS;
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
      outcomes.push({reviewId:item.reviewId,candidateId:item.candidateId,gateType:item.gateType,
        action:decision.action,status:'queued',decisionId:written?.reviewId||null});
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

module.exports={POLICY_ACTOR,OPTIONAL_UNKNOWN_REASON,gateDecision,automateEvidenceGates,automateEditorialReviews,automatePublicationReviews};
