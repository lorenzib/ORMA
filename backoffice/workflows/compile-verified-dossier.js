'use strict';

const {createHash}=require('crypto');
const {validateDossier}=require('../contracts/dossier-v1');

function sourceId(url,index){return `source-${index+1}-${createHash('sha256').update(url).digest('hex').slice(0,10)}`;}

function compileVerifiedDossier(review,trail,options={}){
  if(!review.approvalAllowed)throw new Error('A blocked dossier cannot be compiled as verified');
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
      confidence:claim.confidence,rationale:claim.rationale});}
  }
  const dossier={contractVersion:'1.0.0',candidateId:trail.candidateId,trailId:trail.trailId,trailName:trail.trailName,
    reviewState:'accepted',sources:[...sourceMap.values()],claims,routeGeometry:geometry,
    ormaVerification:{status:'verified',verifiedAt:at,verifiedBy:options.verifiedBy||'human-moderator',reviewId:review.reviewId,
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

module.exports={compileVerifiedDossier,verificationRecord};
