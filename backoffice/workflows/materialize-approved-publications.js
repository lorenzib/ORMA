'use strict';

const { operationalFactsFromClaims, mergeOperationalFacts } = require('./compile-operational-facts');
const { publicationRequestIsRetryable } = require('./publication-failure-receipts');

function materializeApprovedPublications({ requests, staging, routesByCandidate, overrides, operationalFacts, at, forceRetry=false }){
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

  for(const request of approved){
    const item = staging?.items?.find(candidate => candidate.candidateId === request.candidateId);
    if(!item || item.state !== 'ready-for-publication-preview' || !item.proposedWebsiteFields){
      throw new Error(`Approved publication is not ready for ${request.candidateId}`);
    }
    const route = routesByCandidate?.[request.candidateId];
    if(!route?.geometry?.coordinates?.length){
      throw new Error(`Approved route geometry missing for ${request.candidateId}`);
    }
    const fields = {
      ...item.proposedWebsiteFields,
      id:item.targetTrailId,
      path:route.geometry.coordinates.map(point => [point[1], point[0]]),
      lat:route.geometry.coordinates[0][1],
      lng:route.geometry.coordinates[0][0],
      region:'dolomites',
      curated:true,
      publicationApprovalId:request.id,
    };
    delete fields.routeRef;
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
    operationalFacts:facts.table,
    operationalFactsChanged:facts.changed,
  };
}

module.exports = { materializeApprovedPublications };
