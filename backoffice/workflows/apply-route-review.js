'use strict';

/**
 * Applies a stage-0 route choice.
 *
 * The desk has been able to record one since the gate was restored, and every
 * answer went into `backofficeRouteReviews` and stopped there: no workflow read
 * that collection, so the question in `route-review` kept being asked and the
 * chosen line never became the candidate's route. This is the missing half.
 *
 * What a choice decides is narrow and worth saying: which official variant is
 * this trail's line. It does not clear parking, dog rules, water, exposure or
 * any other gate, and it publishes nothing — the chosen geometry is promoted
 * inside the protected store, where the rest of the pipeline already looks for
 * it (`route-proposal-<trailId>`).
 */

const { createHash }=require('crypto');

const VERSION='1.0.0';
const GATE='geometry-approval';
const HUMAN_STATES=/human|direct-confirmation/i;
const APPLICABLE_ACTIONS=Object.freeze([
  'approve-route','approve-route-variants','request-route-research','reject-route-source','route-unresolved',
]);
const APPROVALS=Object.freeze(['approve-route','approve-route-variants']);
// Everything past the choice — parking, dog rules, water, exposure, photo — is
// still owed. Said on every receipt so a kept route is never read as a verified
// trail.
const APPROVAL_SCOPE='Route geometry only; evidence, safety and publication gates remain pending.';

function proposalsOf(item){
  const listed=Array.isArray(item.proposals)?item.proposals:[];
  return listed.length||!item.proposal?listed:[item.proposal];
}

function geometryOf(feature){
  if(!feature)return null;
  const geometry=feature.type==='Feature'?feature.geometry:feature.geometry||feature;
  return geometry&&geometry.type==='LineString'&&Array.isArray(geometry.coordinates)?geometry:null;
}

/**
 * The chosen line, with the two facts that let a later reader prove it is the
 * same line: how many points it has and what it hashes to. Same hashing
 * convention as the verification record, so the two can be compared.
 */
function geometryReceipt(feature){
  const geometry=geometryOf(feature);
  if(!geometry)return {geometry:'unresolved'};
  return {coordinateCount:geometry.coordinates.length,
    geometrySha256:createHash('sha256').update(JSON.stringify(geometry)).digest('hex')};
}

/**
 * May this stored line be written as the trail's route? Only if it says it is
 * the proposal that was chosen. The geometry is read by proposal id, so a
 * mismatch means the wrong file is behind that id — which would otherwise
 * publish another route's shape under this trail's name.
 */
function promotableFeature(feature,proposalId){
  if(!feature)return {feature:null,geometry:'unresolved'};
  const stamped=feature.properties&&feature.properties.proposalId;
  if(stamped&&stamped!==proposalId)return {feature:null,geometry:'rejected-proposal-mismatch',foundProposalId:stamped};
  return {feature};
}

/**
 * The lines a recorded choice is still owed. A choice applied before its
 * proposal geometry was seeded promoted nothing, and applying happens once — so
 * without this the trail enters verification pointing at a route artifact that
 * was never written, and every specialist researches without the line the
 * editor chose.
 */
function unpromotedChoices(routeReview){
  return ((routeReview&&routeReview.items)||[])
    .filter(item=>item.reviewState==='route-choice-approved'&&item.selectedProposalId)
    .map(item=>({candidateId:item.candidateId,proposalId:item.selectedProposalId,
      promoteAs:item.trailId||item.candidateId}));
}

function researchAction(item,note){
  const current=item.nextAgentAction||{};
  const completed=Number(current.completedAttempts||0);
  const maximum=Number(current.maximumAttempts||5);
  const attempt=completed+1;
  // The retry budget is the cartographer's, and a human asking again spends
  // from it. Past the budget the honest next step is a person, not a sixth run.
  if(attempt>maximum)return {exhausted:true,nextAgentAction:{...current,action:'await-direct-confirmation-or-field-check',
    attempt:maximum,completedAttempts:completed,maximumAttempts:maximum,
    instructions:`Automated retry budget exhausted; preserve the unresolved state. Editor's last request: ${note}`}};
  return {exhausted:false,nextAgentAction:{...current,action:'research-route-proposals',
    attempt,completedAttempts:completed,maximumAttempts:maximum,instructions:note}};
}

/**
 * @param routeReview the `route-review` artifact: the questions.
 * @param ledger      the `route-review-ledger` artifact: every decision applied.
 * @param review      one queued `backofficeRouteReviews` document.
 * @param options.geometries Map of proposalId -> proposal GeoJSON Feature, read
 *   by the caller. A proposal whose geometry cannot be found is still a valid
 *   choice: it is recorded, and the promotion is reported as unresolved rather
 *   than losing the decision.
 * @returns {routeReview, ledger, promotions, outcome}
 */
function applyRouteReview(routeReview,ledger,review,options={}){
  const at=options.at||new Date().toISOString();
  const reviewedBy=review.submittedBy||options.reviewedBy||'human-moderator';
  const geometries=options.geometries instanceof Map?options.geometries:new Map(Object.entries(options.geometries||{}));
  if(!APPLICABLE_ACTIONS.includes(review.action))throw new Error('Invalid route review action');
  const item=(routeReview.items||[]).find(candidate=>candidate.candidateId===review.candidateId);
  if(!item)throw new Error('Route review item was not found');
  if(!HUMAN_STATES.test(item.reviewState||''))throw new Error('Route review item is no longer awaiting a decision');

  const note=String(review.note||'').trim();
  const proposals=proposalsOf(item);
  const chosenIds=(Array.isArray(review.proposalIds)?review.proposalIds:[]).map(String);
  const chosen=[];
  const promotions=[];
  let next={...item,decidedAt:at,decision:{reviewId:review.id||null,action:review.action,note,
    proposalIds:chosenIds,reviewedAt:at,reviewedBy},publicMutationAllowed:false};

  if(APPROVALS.includes(review.action)){
    if(item.approvalAllowed===false)throw new Error('This route cannot be approved while its own findings stand');
    if(!chosenIds.length)throw new Error('At least one route variant must be kept');
    if(item.selectionMode!=='one-or-more'&&chosenIds.length>1)throw new Error('Only one route may be kept for this trail');
    // The action and the count have to agree, or a decision recorded as one
    // route quietly keeps two.
    if(review.action==='approve-route'&&chosenIds.length>1)throw new Error('Keeping more than one variant is approve-route-variants');
    for(const id of chosenIds){
      const proposal=proposals.find(candidate=>candidate&&candidate.id===id);
      if(!proposal)throw new Error(`Route proposal is not on this review: ${id}`);
      chosen.push(proposal);
    }
    // The order the cartographer listed them in decides which is the trail's
    // own line; the rest are kept variants, and a variant needs its own
    // candidate before it can become a second ORMA trail. Naming them here is
    // what stops a kept variant being quietly dropped.
    const ordered=proposals.filter(proposal=>chosen.includes(proposal));
    const [primary,...variants]=ordered;
    // Promoted under the catalogue trail the question is about, which is the id
    // publication reads. A question that names no catalogue trail keeps its own
    // candidate id, so the line is still stored and nothing is written under a
    // name that means something else.
    const {feature,...refusal}=promotableFeature(geometries.get(primary.id)||null,primary.id);
    promotions.push({candidateId:item.trailId||item.candidateId,proposalId:primary.id,feature,
      ...(feature?geometryReceipt(feature):refusal)});
    next={...next,reviewState:'route-choice-approved',selectedProposalIds:ordered.map(proposal=>proposal.id),
      selectedProposalId:primary.id,
      pendingVariantIntake:variants.map(proposal=>({proposalId:proposal.id,label:proposal.label||proposal.id,
        reason:'A kept variant becomes a separate ORMA trail only once it has its own candidate.'})),
      nextAgentAction:{action:variants.length?'admit-kept-variants-as-candidates':'resume-evidence-research',
        attempt:1,completedAttempts:Number(item.nextAgentAction?.completedAttempts||0),
        maximumAttempts:Number(item.nextAgentAction?.maximumAttempts||5),
        instructions:variants.length
          ?`The editor kept ${ordered.length} official variants. ${primary.label||primary.id} is this candidate's line; the rest need their own candidates.`
          :'The editor chose this line. Continue with the evidence and safety gates.'}};
  }else if(review.action==='request-route-research'){
    if(!note)throw new Error('A precise research instruction is required');
    const {exhausted,nextAgentAction}=researchAction(item,note);
    next={...next,reviewState:exhausted?'source-exhausted-direct-confirmation':'route-research-requested',
      approvalAllowed:exhausted?false:item.approvalAllowed,nextAgentAction};
  }else if(review.action==='reject-route-source'){
    if(!note)throw new Error('A rejection must say what is wrong with the source');
    next={...next,reviewState:'route-source-rejected',approvalAllowed:false,
      nextAgentAction:{action:'await-new-route-source',attempt:1,
        completedAttempts:Number(item.nextAgentAction?.completedAttempts||0),
        maximumAttempts:Number(item.nextAgentAction?.maximumAttempts||5),
        instructions:`The editor rejected this source: ${note}`}};
  }else{
    next={...next,reviewState:'source-exhausted-direct-confirmation',approvalAllowed:false,
      nextAgentAction:{action:'await-direct-confirmation-or-field-check',attempt:1,
        completedAttempts:Number(item.nextAgentAction?.completedAttempts||0),
        maximumAttempts:Number(item.nextAgentAction?.maximumAttempts||5),
        instructions:note||'Held unresolved by the editor; preserve the unresolved state.'}};
  }

  // The receipt carries what was decided and what was written: the kept
  // proposal, the variants still owed a candidate, and either the promoted
  // line's fingerprint or the reason there is none.
  const kept=promotions.length
    ?(({candidateId,proposalId,feature,...facts})=>({scope:APPROVAL_SCOPE,proposalId,promotedAs:candidateId,
      keptVariantIds:next.selectedProposalIds.slice(1),...facts}))(promotions[0])
    :{};
  const entry={contractVersion:VERSION,gate:GATE,reviewId:review.id||null,candidateId:item.candidateId,
    title:item.title||item.candidateId,action:review.action,proposalIds:chosenIds,note,
    reviewedAt:at,reviewedBy,publicMutationAllowed:false,...kept};

  const current=ledger||{contractVersion:VERSION,gate:GATE,updatedAt:null,decisions:[]};
  const nextLedger={...current,contractVersion:VERSION,gate:GATE,updatedAt:at,publicMutationAllowed:false,
    // One entry per applied decision, newest last, bounded so the ledger cannot
    // outgrow its Firestore document.
    decisions:[...(current.decisions||[]).filter(decision=>!decision.reviewId||decision.reviewId!==entry.reviewId),entry].slice(-200)};

  const nextReview={...routeReview,updatedAt:at,publicMutationAllowed:false,
    items:(routeReview.items||[]).map(candidate=>candidate.candidateId===item.candidateId?next:candidate)};

  return {routeReview:nextReview,ledger:nextLedger,promotions,
    outcome:{candidateId:item.candidateId,action:review.action,reviewState:next.reviewState,
      proposalIds:chosenIds,promoted:promotions.filter(promotion=>promotion.feature).map(promotion=>promotion.proposalId),
      unresolvedGeometry:promotions.filter(promotion=>!promotion.feature).map(promotion=>promotion.proposalId)}};
}

module.exports={VERSION,GATE,APPLICABLE_ACTIONS,APPROVAL_SCOPE,promotableFeature,unpromotedChoices,applyRouteReview};
