'use strict';

const {createHash}=require('crypto');
const {validateDossier}=require('../contracts/dossier-v1');

function sourceId(url,index){return `source-${index+1}-${createHash('sha256').update(url).digest('hex').slice(0,10)}`;}

function numberedRouteReference(review,trail){
  const cartographer=(review.specialistOutputs||[]).find(output=>output.agentId==='cartographer')?.result;
  const value=cartographer?.relation?.tags?.ref||trail?.sourceTrail?.ref||trail?.routeRef||null;
  return String(value||'').trim()||null;
}

function authoritativeRecommendedStart(review){
  return (review.specialistOutputs||[]).flatMap(output=>(output.result?.claims||[]).map(claim=>({agentId:output.agentId,claim})))
    .find(({agentId,claim})=>agentId==='logistics'&&claim.id==='recommended-start'&&claim.finding==='supported-proposal'
      &&(claim.sources||[]).some(source=>/^https:\/\//.test(source.url||'')&&String(source.authority||'').trim()));
}

const {routeConformanceBlockingReasons}=require('../services/route-conformance');

// Two different promises, separated. "ORMA Verified" answers the question a dog
// owner is actually asking -- is this walk safe for my dog -- from water, heat,
// exposure, livestock, surface hazards, access, an approved geometry and a
// sourced trailhead. Whether a comune published a numbered route sheet is a fact
// about municipal record-keeping, not about the walk, and requiring it meant
// "Verified" really read "well documented by its local authority".
//
// 101 catalogue trails have no such sheet and never will. Six reached the gate
// and were sent back for these three claims. They are still researched and still
// recorded -- they earn "official route confirmed" -- but they no longer stand
// between a safe trail and its badge.
const OFFICIAL_ROUTE_CLAIMS=['route-number-status','route-number-sequence','route-number-switches'];

// Kept required: a walker cannot start a walk they cannot find the start of, and
// a park or refuge page naming the trailhead clears this far more often than a
// numbered route sheet does.
const VERIFICATION_ROUTE_CLAIMS=Object.freeze(['recommended-start']);

function supportedLogisticsClaim(review,id){
  return (review.specialistOutputs||[]).flatMap(output=>(output.result?.claims||[]).map(claim=>({agentId:output.agentId,claim})))
    .find(({agentId,claim})=>agentId==='logistics'&&claim.id===id&&claim.finding==='supported-proposal'
      &&String(claim.proposedValue||'').trim()
      &&(claim.sources||[]).some(source=>/^https:\/\//.test(source.url||'')&&String(source.authority||'').trim()));
}

/**
 * The measured comparison between the drawn line and the routes the page tells
 * a walker to follow, from whichever specialist took it. Absent means nobody
 * measured, which is not the same as clean: it does not block here, because the
 * measurement has to reach every lane before it can be required of one.
 */
function routeConformanceOf(review){
  return (review?.specialistOutputs||[]).map(output=>output.result?.routeConformance).find(Boolean)||null;
}

// A line that leaves the numbers printed beside it is the directions being
// wrong, not background research a moderator can judge sufficient, so it is
// asserted with the rest of the route guidance rather than left to the eye.
// The cartographer's gate has always asked a human to "compare the
// reconstructed line with the named official route and trail numbers"; nothing
// ever gave them a number to compare. Tre Cime shipped 2.7 km of its 9.5 off
// the 101 and 105 it names, by up to 201 m, onto real paths carrying no route
// at all, having passed every geometry check there was.
function assertRouteConformance(review,trail){
  const reasons=routeConformanceBlockingReasons(routeConformanceOf(review));
  if(reasons.length){
    throw new Error(`${trail?.trailName||trail?.trailId||'Trail'} cannot be verified: ${reasons.join('; ')}`);
  }
}

function assertRouteGuidance(review,trail){
  if(!authoritativeRecommendedStart(review)){
    throw new Error(`${trail?.trailName||trail?.trailId||'Trail'} requires a sourced recommended start before verification: recommended-start`);
  }
}

/**
 * Whether this trail's numbered route is confirmed against an authority, which
 * is recorded either way. Absent is an honest "nobody published one", not a
 * failure, so it never blocks and never reads as a caveat on the safety facts.
 */
function officialRouteConfirmation(review){
  const missing=OFFICIAL_ROUTE_CLAIMS.filter(id=>!supportedLogisticsClaim(review,id));
  return {confirmed:!missing.length,missingClaims:missing};
}

// Tightening the claims a gate requires does not invalidate the dossiers already
// captured under the looser contract, and nothing surfaced that they were stale.
// Seven trails sat at the dossier gate holding logistics output from before
// 2026-09-04 with all four route-guidance claims simply *absent* — not weak,
// not unsourced — and no orchestration branch re-runs an agent for a trail
// already parked at a human gate, so they would have waited forever.
//
// The version is derived from the required set rather than declared, so it moves
// exactly when the requirement moves and cannot be forgotten at bump time.
// Sorted, so reordering the list is not mistaken for changing it.
// Still all four: logistics is asked for route numbering exactly as before, and
// the contract hash is derived from this list. Loosening the gate without
// touching what is researched leaves the hash where it is, so no trail already
// parked at the gate is pulled back a second time to re-earn what it has.
const ROUTE_GUIDANCE_CLAIM_IDS=Object.freeze(['recommended-start',...OFFICIAL_ROUTE_CLAIMS]);
const ROUTE_GUIDANCE_CONTRACT=`rg-${createHash('sha256')
  .update([...ROUTE_GUIDANCE_CLAIM_IDS].sort().join(',')).digest('hex').slice(0,8)}`;

function logisticsOutput(outputs){return (outputs||[]).find(output=>output.agentId==='logistics');}

/** The route-guidance contract a stored logistics result was produced under. */
function routeGuidanceContractOf(outputs){
  return logisticsOutput(outputs)?.result?.claimContracts?.routeGuidance||null;
}

/**
 * Whether a dossier was captured before the current requirement existed. Such a
 * dossier cannot satisfy the gate however good its evidence is, and re-reviewing
 * it cannot help — only re-running the agent can. A trail with no logistics
 * output yet is not stale, it is simply unfinished.
 */
function routeGuidanceContractStale(outputs){
  if(!logisticsOutput(outputs))return false;
  return routeGuidanceContractOf(outputs)!==ROUTE_GUIDANCE_CONTRACT;
}

function routeGuidanceBlockingReasons(outputs){
  const review={specialistOutputs:outputs||[]};
  const missing=VERIFICATION_ROUTE_CLAIMS.filter(id=>!authoritativeRecommendedStart(review));
  return missing.map(id=>`logistics/${id}: a sourced recommended start is required`);
}


// A moderator can accept a blocker rather than clear it, and the acceptance is
// what makes a dossier approvable. Five agents researching a mountain trail
// always leave loose ends, and demanding that every one resolve itself is why
// nothing was ever verified.
//
// What an acceptance says is "this dossier can be verified", never "this claim
// is true". The claim keeps the finding the specialist gave it, so an accepted
// unresolved dog-access claim still publishes nothing about dog access:
// factFromClaim refuses any claim whose humanAcceptedFinding is not a supported
// proposal. Accepting is a judgement about the dossier, not about the world.
const MIN_ACCEPTANCE_REASON=10;
const ROUTE_GUIDANCE_BLOCKER=/supported authoritative route guidance is required$/;

// Route guidance is the one blocker no reason can wave through. Every other
// blocker is background research a human can judge sufficient; this one is
// content printed on the trail page for a walker to follow, so waiving it means
// publishing a walk with no directions. It is the agent's job, and #304 made it
// one it can do.
function waivableBlocker(reason){return !ROUTE_GUIDANCE_BLOCKER.test(String(reason));}

function acceptedBlockerMap(acceptedBlockers){
  const accepted=new Map();
  for(const entry of acceptedBlockers||[]){
    const blocker=String(entry?.blocker||'').trim();
    const reason=String(entry?.reason||'').trim();
    if(!blocker||reason.length<MIN_ACCEPTANCE_REASON)continue;
    if(!waivableBlocker(blocker))continue;
    accepted.set(blocker,reason);
  }
  return accepted;
}

/** Every blocker still standing: unaccepted, or accepted without a real reason. */
function unacceptedBlockers(review,acceptedBlockers){
  const accepted=acceptedBlockerMap(acceptedBlockers);
  return (review?.blockingReasons||[]).filter(reason=>!accepted.has(String(reason)));
}

function compileVerifiedDossier(review,trail,options={}){
  // Defence in depth: applyDossierReview checks this too, but nothing may compile
  // a dossier whose blockers a human never addressed.
  const standing=unacceptedBlockers(review,options.acceptedBlockers);
  if(!review.approvalAllowed&&standing.length){
    throw new Error(`A blocked dossier cannot be compiled as verified: ${standing.join('; ')}`);
  }
  const routeReference=numberedRouteReference(review,trail);
  if(routeReference&&!authoritativeRecommendedStart(review)){
    throw new Error(`Numbered route ${routeReference} requires an authoritative recommended-start claim before verification`);
  }
  assertRouteGuidance(review,trail);
  assertRouteConformance(review,trail);
  const at=options.at||new Date().toISOString();const sourceMap=new Map();
  function addSource(source){const url=source?.url;if(!/^https:\/\//.test(url||''))return null;if(sourceMap.has(url))return sourceMap.get(url).id;
    const id=sourceId(url,sourceMap.size);sourceMap.set(url,{id,url,label:source.label||source.provider||url,authority:source.authority||null,
      accessedAt:source.accessedAt||source.relationTimestamp||at,licence:source.licence||null});return id;}
  const claims=[];let geometry=null;
  for(const output of review.specialistOutputs||[]){const result=output.result||{};
    if(output.agentId==='cartographer'){
      geometry=result.geometry||null;const ids=[addSource(result.source),addSource({label:'Raw OSM relation',url:result.source?.endpoint,
        authority:`${result.source?.externalId||''} version ${result.source?.relationVersion||''}`,relationTimestamp:result.source?.relationTimestamp,licence:result.source?.licence})].filter(Boolean);
      claims.push({id:'route-identity',label:'Approved route identity',state:'supported',proposedValue:`${result.relation?.tags?.name||trail.trailName} · ${result.source?.externalId||trail.sourceTrail?.externalRelationId||'source identifier retained'}`,sourceIds:ids});
      claims.push({id:'route-geometry',label:'Approved route geometry',state:'supported',proposedValue:`Human-approved ${result.assessment?.pointCount||geometry?.coordinates?.length||0}-point reconstruction; ${result.assessment?.distanceKm||result.comparison?.reconstructedDistanceKm||'unreported'} km.`,sourceIds:ids});
      continue;
    }
    for(const claim of result.claims||[]){const ids=(claim.sources||[]).map(addSource).filter(Boolean);claims.push({id:`${output.agentId}-${claim.id}`,
      label:`${claim.category}: ${claim.id}`,state:'supported',proposedValue:claim.proposedValue,sourceIds:ids,humanAcceptedFinding:claim.finding,
      confidence:claim.confidence,rationale:claim.rationale,
      // The dossier claim id is namespaced by agent, so the specialist's own id
      // is kept alongside it: downstream compilers match on what the agent said,
      // not on how this function chose to prefix it.
      agentId:output.agentId,claimId:claim.id,
      entityName:claim.entityName||null,rule:claim.rule||null,observedAt:claim.observedAt||null,
      // What a claim answered "varies" depends on. Dropping it here would leave
      // the reader with "unknown" for something the agent actually established.
      variesWith:claim.variesWith||null});}
  }
  const dossier={contractVersion:'1.0.0',candidateId:trail.candidateId,trailId:trail.trailId,trailName:trail.trailName,
    reviewState:'accepted',sources:[...sourceMap.values()],claims,routeGeometry:geometry,
    ormaVerification:{status:'verified',verifiedAt:at,verifiedBy:options.verifiedBy||'human-moderator',reviewId:review.reviewId,
      // Kept with the verification, because a reader is entitled to know a
      // trail was verified with caveats and what the moderator said about them.
      acceptedBlockers:[...acceptedBlockerMap(options.acceptedBlockers)]
        .map(([blocker,reason])=>({blocker,reason,acceptedBy:options.verifiedBy||'human-moderator',acceptedAt:at})),
      conditions:['Recheck time-sensitive access, restriction, parking and water claims on their scheduled maintenance cadence.'],
      officialRoute:officialRouteConfirmation(review)},
    specialistOutputRefs:(review.specialistOutputs||[]).map(output=>`firestore:trail-specialist-output-${output.jobId}`),
    publicMutationAllowed:false,publicationAuthorized:false};
  const errors=validateDossier(dossier);if(errors.length)throw new Error(errors.join('; '));return dossier;
}

function verificationRecord(dossier){return {candidateId:dossier.candidateId,trailName:dossier.trailName,
  // Carried into the registry so the public side can show the extra marker
  // without reopening the dossier.
  officialRouteConfirmed:Boolean(dossier.ormaVerification.officialRoute?.confirmed),
  verifiedAt:dossier.ormaVerification.verifiedAt,verifiedBy:dossier.ormaVerification.verifiedBy,
  routeGeometrySha256:createHash('sha256').update(JSON.stringify(dossier.routeGeometry||null)).digest('hex'),
  conditions:dossier.ormaVerification.conditions,nextStage:'editorial-and-publication-review',
  dossierRef:`firestore:verified-dossier-${dossier.candidateId}`};}

module.exports={MIN_ACCEPTANCE_REASON,OFFICIAL_ROUTE_CLAIMS,VERIFICATION_ROUTE_CLAIMS,officialRouteConfirmation,waivableBlocker,routeConformanceOf,assertRouteConformance,unacceptedBlockers,acceptedBlockerMap,numberedRouteReference,authoritativeRecommendedStart,supportedLogisticsClaim,assertRouteGuidance,routeGuidanceBlockingReasons,ROUTE_GUIDANCE_CLAIM_IDS,ROUTE_GUIDANCE_CONTRACT,routeGuidanceContractOf,routeGuidanceContractStale,compileVerifiedDossier,verificationRecord};
