'use strict';

const { operationalFactsFromClaims, mergeOperationalFacts } = require('./compile-operational-facts');
const { publicationRequestIsRetryable } = require('./publication-failure-receipts');

// Savoy and the Dolomites are geographically disjoint, and the website splits
// its runtime bundles on `trail.region`. The longitude test is the one
// scripts/build-regional-runtime-data.js already uses: well east of Savoy and
// well west of the Dolomites, so there is no ambiguous walk in either package.
// It reads the line being published, so a publication cannot land a trail in a
// region it is nowhere near -- which is what a hardcoded region did to the
// first Savoy walks to reach publication.
const SAVOY_EAST_LIMIT = 9;
function regionForLongitude(lng){
  return Number(lng) < SAVOY_EAST_LIMIT ? 'savoy' : 'dolomites';
}

// A published distance and the line drawn for it are two measurements of one
// walk, and they arrive here from different places: the distance from the
// dossier's website fields, the line from the approved route proposal. A
// publication swapping in a line that measures differently from the distance it
// keeps puts a contradiction on the page, and route-shape-geometry.test.js
// rejects it -- which is how the first five publications surfaced, as an opaque
// generated-artifact failure after the approvals had already been written.
//
// What is refused is a publication that *introduces* a disagreement. Four walks
// in the catalogue already disagree with their own lines, knowingly and on the
// record; re-publishing one of those is not this fault, and refusing it would
// stop a trail the repository already accepts. The threshold and the formula are
// the pinned test's, so the two cannot drift apart.
const DISTANCE_DISAGREEMENT = 0.2;
const km=(a,b)=>Math.hypot((a[0]-b[0])*111.2,(a[1]-b[1])*Math.cos(a[0]*Math.PI/180)*111.2);
const lineKm=path=>path.reduce((total,point,i)=>i?total+km(path[i-1],point):0,0);

function measure(distance,path){
  if(!Array.isArray(path) || path.length<2) return null;
  const line=lineKm(path);
  const value=Number(distance);
  if(!line || !Number.isFinite(value) || value<=0) return null;
  return { distance:value, lineKm:Math.round(line*1000)/1000, ratio:Math.round((value/line)*1000)/1000 };
}

const disagrees=measured => measured && Math.abs(measured.ratio-1) >= DISTANCE_DISAGREEMENT;

// An out-and-back is declared, and its line is traced one way on purpose, so a
// 2x disagreement is its expected shape rather than a fault. The same carve-out
// the pinned test makes -- read from the declarations the overrides carry,
// because a publication's own fields never include a route shape.
function declaredOutAndBack(overrides,trailId){
  return (overrides?.trails||[]).some(entry =>
    entry?.id===trailId && entry?.fields?.routeShape==='out-and-back');
}

function introducedDisagreement(fields,{priorTrail,outAndBack}){
  if(outAndBack) return null;
  const published=measure(fields.distance,fields.path);
  if(!disagrees(published)) return null;
  // Already on the record as a disagreement: not this publication's doing.
  if(disagrees(measure(priorTrail?.distance,priorTrail?.path))) return null;
  return published;
}

function materializeApprovedPublications({ requests, staging, routesByCandidate, overrides, operationalFacts, at, forceRetry=false, productionTrails=[] }){
  const priorById = new Map((productionTrails||[]).map(trail => [trail?.id, trail]));
  const next = JSON.parse(JSON.stringify(overrides || { contractVersion:'1.0.0', trails:[] }));
  next.contractVersion ||= '1.0.0';
  next.trails ||= [];
  const materializedApprovals = new Set(next.trails.map(entry => entry.approvalId).filter(Boolean));
  const approved = (requests?.requests || []).filter(request =>
    publicationRequestIsRetryable(request,{at,force:forceRetry}) && !materializedApprovals.has(request.id));
  const entries = [];
  // Rifugio and lift policies ride the same evidence-policy decision as the
  // publication that carries them, so no fact bypasses the audited release.
  const approvedFacts = [];
  const refused = [];

  for(const request of approved){
    const item = staging?.items?.find(candidate => candidate.candidateId === request.candidateId);
    if(!item || item.state !== 'ready-for-publication-preview' || !item.proposedWebsiteFields){
      throw new Error(`Approved publication is not ready for ${request.candidateId}`);
    }
    const route = routesByCandidate?.[request.candidateId];
    if(!route?.geometry?.coordinates?.length){
      throw new Error(`Approved route geometry missing for ${request.candidateId}`);
    }
    // A walk verified or re-lined by hand is changed by hand. Its seal lives in
    // trail-audits.js and its official line in a routeLine entry, so neither is
    // visible to the seal check below, and a pipeline publication replaces the
    // ledger entry wholesale: on 23 October one would have put St. Magdalena
    // back on its old line and taken the Verified badge off it. Refused, not
    // thrown, for the same reason as a disagreeing distance.
    const prior = priorById.get(item.targetTrailId);
    const verifiedByHand = prior?.tier === 'route-audited' && prior?.graduation?.status === 'verified';
    const lineSetByHand = (overrides?.trails || []).some(entry =>
      entry?.id === item.targetTrailId && entry?.verificationScope === 'routeLine');
    if(verifiedByHand || lineSetByHand){
      refused.push({
        candidateId:request.candidateId,
        trailId:item.targetTrailId,
        requestId:request.id,
        reason:verifiedByHand ? 'verified-by-hand' : 'line-set-by-hand',
        message:verifiedByHand
          ? `${item.targetTrailId} is verified by hand; a pipeline publication may not replace it`
          : `${item.targetTrailId} carries an official line set by hand; a pipeline publication may not replace it`,
      });
      continue;
    }
    const fields = {
      ...item.proposedWebsiteFields,
      id:item.targetTrailId,
      path:route.geometry.coordinates.map(point => [point[1], point[0]]),
      lat:route.geometry.coordinates[0][1],
      lng:route.geometry.coordinates[0][0],
      region:regionForLongitude(route.geometry.coordinates[0][0]),
      curated:true,
      publicationApprovalId:request.id,
    };
    delete fields.routeRef;
    const disagreement = introducedDisagreement(fields,{
      priorTrail:priorById.get(item.targetTrailId),
      outAndBack:declaredOutAndBack(overrides,item.targetTrailId),
    });
    if(disagreement){
      // Refused, not thrown: the other approved publications in this batch are
      // sound and should still reach the website. The request keeps its retry
      // receipt so the pipeline says which walk is stuck and by how much.
      refused.push({
        candidateId:request.candidateId,
        trailId:item.targetTrailId,
        requestId:request.id,
        reason:'distance-disagrees-with-its-line',
        ...disagreement,
        message:`Published distance ${disagreement.distance} km disagrees with the approved line (${disagreement.lineKm} km, ratio ${disagreement.ratio}) by 20% or more`,
      });
      continue;
    }
    // Which door this publication comes through.
    //
    // A full verification -- all eleven checks -- carries the seal and declares
    // no scope. Short of that the publication is a reviewed one: the walk's
    // directions, copy, start point and photograph reach the page, the badge
    // reads "Reviewed by ORMA", and the entry says so in its own scope rather
    // than looking like a full verification that happens to have `ormaVerified`
    // set to false.
    const fullSeal = fields.ormaVerified === true;
    const entry = {
      id:item.targetTrailId,
      candidateId:item.candidateId,
      approvalId:request.id,
      generatedAt:at,
      ...(fullSeal?{}:{verificationScope:'routeReviewed'}),
      fields,
    };
    approvedFacts.push(...operationalFactsFromClaims(item.proposedOperationalClaims, {
      trailId:item.targetTrailId,
      at,
      verifiedBy:request.approvedBy || 'ORMA evidence policy',
    }));

    const index = next.trails.findIndex(trail => trail.id === entry.id);
    // A publication may add to what a trail has established; it may not take a
    // seal away. The graduation upgrades itself as research lands, so the only
    // way this fires is a trail being republished from a thinner dossier than
    // the one that earned it -- which would quietly unverify a verified walk
    // and leave nothing behind saying when or why.
    if(index >= 0 && !fullSeal && next.trails[index]?.fields?.ormaVerified === true){
      throw new Error(`Publication for ${entry.id} would remove the ORMA Verified seal it already carries`);
    }
    // A withdrawal is a human decision -- dogs found not allowed, or a line
    // that is not a walk -- and lifting it is a human edit. A republication
    // replaces the entry wholesale, so without this it would silently put a
    // withdrawn walk back on the site.
    const withdrawal = index >= 0 ? next.trails[index]?.fields?.withdrawal : null;
    if(withdrawal && !entry.fields.withdrawal) entry.fields = { ...entry.fields, withdrawal };
    if(index >= 0) next.trails[index] = entry;
    else next.trails.push(entry);
    entries.push(entry);
  }

  if(entries.length) next.updatedAt = at;
  const facts = mergeOperationalFacts(operationalFacts, approvedFacts, at);
  return {
    overrides:next,
    entries,
    materialized:entries.length,
    refused,
    operationalFacts:facts.table,
    operationalFactsChanged:facts.changed,
  };
}

module.exports = { materializeApprovedPublications };
