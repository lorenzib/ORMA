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

const REQUIRED_ROUTE_GUIDANCE_CLAIMS=['route-number-status','route-number-sequence','route-number-switches'];

function supportedLogisticsClaim(review,id){
  return (review.specialistOutputs||[]).flatMap(output=>(output.result?.claims||[]).map(claim=>({agentId:output.agentId,claim})))
    .find(({agentId,claim})=>agentId==='logistics'&&claim.id===id&&claim.finding==='supported-proposal'
      &&String(claim.proposedValue||'').trim()
      &&(claim.sources||[]).some(source=>/^https:\/\//.test(source.url||'')&&String(source.authority||'').trim()));
}

function assertRouteGuidance(review,trail){
  const missing=REQUIRED_ROUTE_GUIDANCE_CLAIMS.filter(id=>!supportedLogisticsClaim(review,id));
  if(!authoritativeRecommendedStart(review))missing.unshift('recommended-start');
  if(missing.length){
    throw new Error(`${trail?.trailName||trail?.trailId||'Trail'} requires supported route-number guidance before verification: ${missing.join(', ')}`);
  }
}

function routeGuidanceBlockingReasons(outputs){
  const review={specialistOutputs:outputs||[]};
  const missing=REQUIRED_ROUTE_GUIDANCE_CLAIMS.filter(id=>!supportedLogisticsClaim(review,id));
  if(!authoritativeRecommendedStart(review))missing.unshift('recommended-start');
  return missing.map(id=>`logistics/${id}: supported authoritative route guidance is required`);
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
      conditions:['Recheck time-sensitive access, restriction, parking and water claims on their scheduled maintenance cadence.']},
    specialistOutputRefs:(review.specialistOutputs||[]).map(output=>`firestore:trail-specialist-output-${output.jobId}`),
    publicMutationAllowed:false,publicationAuthorized:false};
  const errors=validateDossier(dossier);if(errors.length)throw new Error(errors.join('; '));return dossier;
}

function verificationRecord(dossier){return {candidateId:dossier.candidateId,trailName:dossier.trailName,
  verifiedAt:dossier.ormaVerification.verifiedAt,verifiedBy:dossier.ormaVerification.verifiedBy,
  routeGeometrySha256:createHash('sha256').update(JSON.stringify(dossier.routeGeometry||null)).digest('hex'),
  conditions:dossier.ormaVerification.conditions,nextStage:'editorial-and-publication-review',
  dossierRef:`firestore:verified-dossier-${dossier.candidateId}`};}

module.exports={MIN_ACCEPTANCE_REASON,waivableBlocker,unacceptedBlockers,acceptedBlockerMap,numberedRouteReference,authoritativeRecommendedStart,supportedLogisticsClaim,assertRouteGuidance,routeGuidanceBlockingReasons,compileVerifiedDossier,verificationRecord};
