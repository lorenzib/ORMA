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

const {routeConformanceBlockingReasons,OFF_DECLARED_ROUTE_BLOCKER_ID}=require('../services/route-conformance');

const OFFICIAL_ROUTE_CLAIMS=['route-number-status','route-number-sequence','route-number-switches'];

// A verified line without instructions for following it is not a verified
// walk. Numbered routes must name the sequence and switches. Genuinely
// unnumbered routes satisfy the same contract with a sourced landmark sequence
// and turn instructions; they do not get an empty "not applicable" shortcut.
const VERIFICATION_ROUTE_CLAIMS=Object.freeze(['recommended-start',...OFFICIAL_ROUTE_CLAIMS]);

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
  const missing=VERIFICATION_ROUTE_CLAIMS.filter(id=>!supportedLogisticsClaim(review,id));
  if(missing.length)throw new Error(`${trail?.trailName||trail?.trailId||'Trail'} requires sourced route guidance before verification: ${missing.join(', ')}`);
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

/** The routes an approved composite is made of, empty for a single relation. */
function compositeRelations(result){
  return Array.isArray(result?.source?.relations) ? result.source.relations.filter(Boolean) : [];
}

/**
 * What the dossier says this route is. A single relation names itself; a
 * composite names the routes it runs along, because its own id is a label this
 * project invented and no walker will ever see on a signpost.
 */
function routeIdentityValue(result,trail,composed){
  const name=result?.relation?.tags?.name||trail?.trailName;
  if(composed.length){
    // Its number if it has one, else its name. The id is the last resort: it
    // identifies the relation, not the route, and "along relation/12043472" is
    // no more use to a walker than the composite label this avoids. Lago di
    // Braies is covered end to end by one relation tagged `Seeweg` and no ref,
    // which is exactly what the signs by the lake say.
    const numbered=composed.map(relation=>relation.ref||relation.name||relation.externalRelationId).filter(Boolean);
    const along=numbered.length?`along ${numbered.join(', ')}`:`along ${composed.length} mapped route(s)`;
    return `${name} · ${composed.length} approved route(s) ${along}`;
  }
  return `${name} · ${result?.source?.externalId||trail?.sourceTrail?.externalRelationId||'source identifier retained'}`;
}

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
  const missing=VERIFICATION_ROUTE_CLAIMS.filter(id=>!supportedLogisticsClaim(review,id));
  return missing.map(id=>`logistics/${id}: sourced, reader-usable route guidance is required`);
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
// Route guidance is the one blocker no reason can wave through. Every other
// blocker is background research a human can judge sufficient; this one is
// content printed on the trail page for a walker to follow, so waiving it means
// publishing a walk with no directions. It is the agent's job, and #304 made it
// one it can do.
//
// Recognised by the identifier the blocker is filed under, not by its wording.
// It used to match the sentence the two producers ended with, and #472 reworded
// one of them on 2026-09-17: from then on the class that cannot be waived did
// not contain the missing recommended start it was written for. The desk showed
// a tick-box for it, the approve guard passed, and compileVerifiedDossier threw
// instead -- and since desk decisions are queued, that surfaced as an item that
// would not move. Every test covering it hand-typed the retired sentence, so
// they all passed.
//
// The logistics ids come from the list routeGuidanceBlockingReasons iterates,
// so requiring a new claim makes it unwaivable in the same edit.
const UNWAIVABLE_BLOCKER_IDS=Object.freeze([
  ...VERIFICATION_ROUTE_CLAIMS.map(id=>`logistics/${id}`),
  OFF_DECLARED_ROUTE_BLOCKER_ID,
  'not-closed-loop','implausibly-short','suspicious-coordinate-jump',
  'relation-not-hiking-route','missing-member-geometry','disconnected-components',
  'composite-coverage-dropped','composite-relations-changed','official-distance-conflict',
  'declared-route-unavailable','route-source-identity-unresolved','route-source-identity-contradicted',
  'route-geometry-unavailable','usable-geometry-missing','unmeasurable-offset',
]);

/** The id a blocking reason is filed under: everything before the first colon. */
function blockerId(reason){return String(reason).split(':')[0].trim();}

function waivableBlocker(reason){return !UNWAIVABLE_BLOCKER_IDS.includes(blockerId(reason));}

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
function dossierBlockingReasons(outputs){
  const reasons=routeGuidanceBlockingReasons(outputs);
  for(const output of outputs){
    const result=output.result||{};
    if(result.recommendation&&result.recommendation!=='advance') reasons.push(`${output.agentId}: recommendation is ${result.recommendation}`);
    for(const question of result.openQuestions||[]) reasons.push(`${output.agentId}: open question — ${question}`);
    for(const claim of result.claims||[]){
      if(['conflicted','unresolved','counter-evidence'].includes(claim.finding)) reasons.push(`${output.agentId}/${claim.id}: ${claim.finding}`);
      if(claim.resolution?.state==='source-exhausted') reasons.push(`${output.agentId}/${claim.id}: five automated resolution strategies exhausted`);
      for(const blocker of claim.blockers||[]) reasons.push(`${output.agentId}/${claim.id}: ${blocker}`);
    }
  }
  return [...new Set(reasons)];
}

/**
 * The blockers as the checks read the evidence now, rather than as they were
 * written down when the gate opened.
 *
 * A gate item is written once, at the transition into a gate, and its
 * specialist outputs can be refreshed afterwards without the reasons being
 * recomputed. Six dossiers reached the desk that way: one stored 41 reasons
 * where the same outputs yield 17, omitting redTeam's recommendation to block
 * and a logistics/recommended-start requirement -- a route-guidance reason, the
 * one class no written reason can answer. The desk was offering an approval the
 * contract would refuse.
 *
 * b23d447a fixed this for a gate item that had gone missing and stated the rule
 * for all of them: re-run the real checks rather than trusting a stored flag,
 * and never be more permissive than a fresh gate. This applies it wherever a
 * decision is weighed.
 *
 * Where there is nothing to re-read, the stored list stands: evidence that
 * cannot be re-read is a reason to keep what a human last saw, not to wave a
 * dossier through on an empty list.
 *
 * A summarised output is that same case wearing a different hat, and it is the
 * dangerous one. review-queue-compaction keeps a claim's id, category, finding
 * and value and drops its `blockers`, its `resolution` and the output's
 * `openQuestions` -- which is most of what dossierBlockingReasons reads. So
 * recomputing from a summary yields a handful of reasons where the evidence has
 * fifty, and recomputing is supposed to be the stricter answer, not a discount.
 * rehydrateReviewQueue restores the detail before an approval and says a
 * pointer it cannot follow leaves the gate to refuse; without this it would do
 * the opposite, because fewer blockers is an easier approval.
 *
 * So where the detail is withheld the two lists are unioned: never fewer than
 * the human last saw, never fewer than the evidence now says.
 */
function detailWithheld(outputs){
  return outputs.some(output=>output?.result?.detailWithheld);
}

function currentBlockingReasons(review){
  const outputs=review?.specialistOutputs||[];
  const stored=review?.blockingReasons||[];
  if(!outputs.length)return stored;
  if(review?.gateType==='geometry-approval'){
    // A geometry gate's blockers are the cartographer's own, not the dossier's.
    const geometry=outputs.find(output=>output.agentId==='cartographer')||outputs[0];
    const current=geometry?.result?.blockers;
    if(!current)return stored;
    return detailWithheld(outputs)?[...new Set([...stored,...current])]:current;
  }
  const current=dossierBlockingReasons(outputs);
  return detailWithheld(outputs)?[...new Set([...stored,...current])]:current;
}

function unacceptedBlockers(review,acceptedBlockers){
  const accepted=acceptedBlockerMap(acceptedBlockers);
  // Trimmed on both sides of the comparison. acceptedBlockerMap files an
  // acceptance under the trimmed text, so matching the raw reason meant a
  // blocker whose sentence ends in a space -- which agent prose does, when a
  // reason is assembled from fragments -- could never be accepted at all.
  return currentBlockingReasons(review).filter(reason=>!accepted.has(String(reason).trim()));
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
      geometry=result.geometry||null;
      // A composite names several routes, and the reader is owed all of them:
      // "composite/alpe-siusi" identifies nothing a walker could follow, while
      // the eleven relations behind it are the numbers on the signposts. Each
      // becomes a source of its own, so a dossier cites what it rests on.
      const composed=compositeRelations(result);
      const ids=[addSource(result.source),addSource({label:'Raw OSM relation',url:result.source?.endpoint,
        authority:`${result.source?.externalId||''} version ${result.source?.relationVersion||''}`,relationTimestamp:result.source?.relationTimestamp,licence:result.source?.licence}),
        ...composed.map(relation=>addSource({label:`Route ${relation.ref||relation.externalRelationId}`,
          url:`https://www.openstreetmap.org/${relation.externalRelationId}`,
          authority:'OpenStreetMap',licence:result.source?.licence||'ODbL-1.0'}))].filter(Boolean);
      claims.push({id:'route-identity',label:'Approved route identity',state:'supported',proposedValue:routeIdentityValue(result,trail,composed),sourceIds:ids});
      claims.push({id:'route-geometry',label:'Approved route geometry',state:'supported',proposedValue:`Human-approved ${result.assessment?.pointCount||geometry?.coordinates?.length||0}-point reconstruction; ${result.assessment?.distanceKm||result.comparison?.reconstructedDistanceKm||'unreported'} km.`,sourceIds:ids});
      continue;
    }
    for(const claim of result.claims||[]){
      // An accepted optional unknown is permission to finish the dossier, not
      // permission to turn the model's best guess into a fact. Keep the reason
      // in acceptedBlockers below and publish only evidence-backed findings.
      if(!['supported-proposal','varies'].includes(claim.finding))continue;
      const ids=(claim.sources||[]).map(addSource).filter(Boolean);claims.push({id:`${output.agentId}-${claim.id}`,
      label:`${claim.category}: ${claim.id}`,state:'supported',proposedValue:claim.proposedValue,sourceIds:ids,humanAcceptedFinding:claim.finding,
      confidence:claim.confidence,rationale:claim.rationale,
      // The dossier claim id is namespaced by agent, so the specialist's own id
      // is kept alongside it: downstream compilers match on what the agent said,
      // not on how this function chose to prefix it.
      agentId:output.agentId,claimId:claim.id,
      entityName:claim.entityName||null,rule:claim.rule||null,observedAt:claim.observedAt||null,
      location:claim.location||null,
      // What a claim answered "varies" depends on. Dropping it here would leave
      // the reader with "unknown" for something the agent actually established.
      variesWith:claim.variesWith||null});}
  }
  const dossier={contractVersion:'1.0.0',candidateId:trail.candidateId,trailId:trail.trailId,trailName:trail.trailName,
    reviewState:'accepted',sources:[...sourceMap.values()],claims,routeGeometry:geometry,
    ormaVerification:{status:'verified',verifiedAt:at,verifiedBy:options.verifiedBy||'orma-evidence-policy-v1',reviewId:review.reviewId,
      // Kept with the verification, because a reader is entitled to know a
      // trail was verified with caveats and what the moderator said about them.
      acceptedBlockers:[...acceptedBlockerMap(options.acceptedBlockers)]
        .map(([blocker,reason])=>({blocker,reason,acceptedBy:options.verifiedBy||'orma-evidence-policy-v1',acceptedAt:at})),
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

module.exports={MIN_ACCEPTANCE_REASON,UNWAIVABLE_BLOCKER_IDS,blockerId,compositeRelations,routeIdentityValue,dossierBlockingReasons,currentBlockingReasons,OFFICIAL_ROUTE_CLAIMS,VERIFICATION_ROUTE_CLAIMS,officialRouteConfirmation,waivableBlocker,routeConformanceOf,assertRouteConformance,unacceptedBlockers,acceptedBlockerMap,numberedRouteReference,authoritativeRecommendedStart,supportedLogisticsClaim,assertRouteGuidance,routeGuidanceBlockingReasons,ROUTE_GUIDANCE_CLAIM_IDS,ROUTE_GUIDANCE_CONTRACT,routeGuidanceContractOf,routeGuidanceContractStale,compileVerifiedDossier,verificationRecord};
