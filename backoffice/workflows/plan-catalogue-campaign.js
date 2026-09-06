'use strict';

const { VERSION, validateCampaign } = require('../contracts/catalogue-campaign-v1');
const { createAgentJob } = require('../contracts/agent-job-v1');

const GRADUATION_CHECKS = Object.freeze([
  'photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat',
  'exposure', 'livestock', 'surfaceHazards', 'access',
]);
const SAFETY_FIELDS = Object.freeze([
  'shadeCoverage', 'heatRisk', 'exposure', 'surfaceHazards',
]);

function hasFullGraduation(trail){
  const graduation = trail && trail.graduation;
  if(!graduation || graduation.status !== 'verified') return false;
  const completed = new Set(Array.isArray(graduation.completed) ? graduation.completed : []);
  return GRADUATION_CHECKS.every(check => completed.has(check));
}

function relationExternalId(trail){
  if(Number.isInteger(trail && trail.osmRelation)) return `relation/${trail.osmRelation}`;
  if(trail && trail.provenance && /^relation\/\d+$/.test(trail.provenance.externalId || '')){
    return trail.provenance.externalId;
  }
  if(trail && trail.curated === false){
    const idMatch = String(trail.id || '').match(/^osm-(\d+)$/);
    if(idMatch) return `relation/${idMatch[1]}`;
  }
  const links = [trail && trail.source, trail && trail.waymarkedtrails]
    .concat(Array.isArray(trail && trail.sourceLinks) ? trail.sourceLinks.map(source => source.url) : []);
  for(const link of links.filter(Boolean)){
    const relationMatch = String(link).match(/(?:relation\/|route\?id=)(\d+)/);
    if(relationMatch) return `relation/${relationMatch[1]}`;
  }
  return null;
}

// Two points count as the same place when they are within 50 m; a hand-drawn
// loop rarely closes on the exact metre.
const CLOSED_LOOP_METRES = 50;

function metresBetween(a, b){
  const radians = Math.PI / 180;
  const dLat = (b[0] - a[0]) * radians;
  const dLng = (b[1] - a[1]) * radians;
  const chord = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * radians) * Math.cos(b[0] * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(chord));
}

function pathIsClosedLoop(trail){
  const path = Array.isArray(trail && trail.path) ? trail.path : [];
  if(path.length < 3) return false;
  return metresBetween(path[0], path[path.length - 1]) <= CLOSED_LOOP_METRES;
}

// Does the recorded relation actually cover this walk?
//
// Measured across the catalogue, this is the only question that separates the
// cases. 127 of 155 trails lie almost entirely on their relation; the other 28
// wander off it, and their relations reconstruct to a median 59% of the trail's
// length: they are one leg of a route stitched from several.
//
// Earlier versions asked about length, loop shape and the relation's name.
// Each was a proxy and each was wrong. A trail may walk 3.4 km of a 7.2 km
// named route and be perfectly sourced, and a relation may carry the trail's
// exact name while sharing a quarter of its path.
const ON_ROUTE_PERCENT = 90;

function identityCheckFor(trail, identityChecks){
  const check = identityChecks && identityChecks[trail && trail.id];
  // A check of a relation the trail no longer records answers a question
  // nobody is asking, so correcting a source retires its verdict.
  if(!check || check.externalRelationId !== relationExternalId(trail)) return null;
  return check;
}

// A composite route source: the ordered waymarked paths a walk follows, when no
// single relation covers it. It counts only once a human has approved it at the
// geometry gate, which is where route identity has always been settled.
function approvedComposite(trail, composites){
  const composite = composites && composites[trail && trail.id];
  if(!composite || composite.state !== 'approved') return null;
  return Number.isFinite(composite.coveragePercent) && composite.coveragePercent >= ON_ROUTE_PERCENT
    ? composite : null;
}

function identityContradiction(trail, identityChecks, composites){
  if(approvedComposite(trail, composites)) return null;
  const check = identityCheckFor(trail, identityChecks);
  if(!check) return null;
  const containment = check.pathContainmentPercent;
  // A check taken before containment was measured condemns nobody.
  if(!Number.isFinite(containment) || containment >= ON_ROUTE_PERCENT) return null;
  return {
    reason: 'relation-covers-part-of-the-route',
    pathContainmentPercent: containment,
    checkedAt: check.checkedAt || null,
    externalRelationId: check.externalRelationId,
    relationName: check.relationName || null,
    reconstructedDistanceKm: check.reconstructedDistanceKm ?? null,
    officialDistanceKm: check.officialDistanceKm ?? null,
  };
}

function baselineBlockers(trail, identityChecks, composites){
  const blockers = [];
  if(!relationExternalId(trail) && !approvedComposite(trail, composites)){
    blockers.push('route-source-identity-unresolved');
  }else if(identityContradiction(trail, identityChecks, composites)){
    blockers.push('route-source-identity-contradicted');
  }
  if(!Array.isArray(trail.path) || trail.path.length < 2) blockers.push('usable-geometry-missing');
  if(!trail.reviewedAt) blockers.push('review-date-missing');
  if(!Array.isArray(trail.sourceLinks) || !trail.sourceLinks.length) blockers.push('claim-sources-missing');
  SAFETY_FIELDS.forEach(field => {
    if(trail[field] === undefined || trail[field] === null) blockers.push(`${field}-unknown`);
  });
  if(!trail.verified || !Array.isArray(trail.verified.categories)) blockers.push('category-review-incomplete');
  if(!trail.graduation?.completed?.includes('routeNumbers')) blockers.push('route-number-guidance-unverified');
  return blockers;
}

function priorityFor(trail, verified, blockers, identityChecks, composites){
  let score = trail.curated === false ? 200 : 300;
  if(verified) score = 50;
  // A relation that does not cover the walk is not a usable identity, so it
  // does not earn the bonus for having one. An approved composite does.
  const sourced = approvedComposite(trail, composites)
    || (relationExternalId(trail) && !identityContradiction(trail, identityChecks, composites));
  if(sourced) score += 15;
  if(Array.isArray(trail.sourceLinks) && trail.sourceLinks.length) score += 10;
  score += Math.min(blockers.length, 20);
  return score;
}

function campaignItem(trail, identityChecks, composites){
  const verified = hasFullGraduation(trail);
  const externalId = relationExternalId(trail);
  const blockers = verified ? [] : baselineBlockers(trail, identityChecks, composites);
  const contradiction = verified ? null : identityContradiction(trail, identityChecks, composites);
  const composite = verified ? null : approvedComposite(trail, composites);
  return {
    trailId: trail.id,
    name: trail.name,
    origin: trail.curated === false ? 'imported' : 'curated',
    publicRecordPresent: trail.publicRecordPresent !== false,
    modernGraduationVerified: verified,
    externalRelationId: externalId,
    campaignState: verified
      ? 'verified-monitoring'
      // A recorded relation that turned out to be a different route leaves the
      // trail needing a source, exactly like having none. Queueing the same
      // check again would only fail again.
      : composite ? 'identity-check-queued'
      : externalId && !contradiction ? 'identity-check-queued' : 'source-identity-required',
    priorityScore: priorityFor(trail, verified, blockers, identityChecks, composites),
    baselineBlockers: blockers,
    identityCheck: contradiction,
    routeComposite: composite
      ? { coveragePercent:composite.coveragePercent,
          relations:(composite.relations || []).map(entry => entry.externalRelationId) }
      : null,
    existing: {
      reviewedAt: trail.reviewedAt || null,
      sourceCount: Array.isArray(trail.sourceLinks) ? trail.sourceLinks.length : 0,
      pathPointCount: Array.isArray(trail.path) ? trail.path.length : 0,
      reviewedCategories: trail.verified && Array.isArray(trail.verified.categories)
        ? trail.verified.categories : [],
    },
  };
}

function jobForItem(item, index, at){
  return createAgentJob({
    id: `catalogue-cartographer-${String(index + 1).padStart(3, '0')}`,
    agentId: 'cartographer',
    action: item.externalRelationId ? 'verify-current-relation' : 'locate-authoritative-route-geometry',
    candidateId: item.trailId,
    claimIds: ['route-identity', 'route-geometry'],
    inputRefs: [`production-trails/${item.trailId}`],
    requestedBy: 'catalogue-verification-campaign-v1',
    humanGate: 'geometry-approval',
  }, { at });
}

function planCatalogueCampaign(trails, options = {}){
  const at = options.at || new Date().toISOString();
  const jobLimit = Number.isInteger(options.jobLimit) && options.jobLimit > 0 ? options.jobLimit : 5;
  const excludedTrailIds = new Set(Array.isArray(options.excludedTrailIds) ? options.excludedTrailIds : []);
  const identityChecks = options.identityChecks || {};
  const composites = options.composites || {};
  const items = trails.map(trail => campaignItem(trail, identityChecks, composites)).sort((a, b) =>
    b.priorityScore - a.priorityScore || a.name.localeCompare(b.name) || a.trailId.localeCompare(b.trailId));
  const queueable = items.filter(item => !item.modernGraduationVerified
    && item.campaignState !== 'rejected'
    && !excludedTrailIds.has(item.trailId));
  const selected = queueable.slice(0, jobLimit);
  const jobs = selected.map((item, index) => jobForItem(item, index, at));
  const campaign = {
    contractVersion: VERSION,
    generatedAt: at,
    mode: 'draft-only',
    publicMutationAllowed: false,
    jobLimit,
    summary: {
      total: items.length,
      curated: items.filter(item => item.origin === 'curated').length,
      imported: items.filter(item => item.origin === 'imported').length,
      modernGraduationVerified: items.filter(item => item.modernGraduationVerified).length,
      routeNumberGuidanceVerified: trails.filter(trail=>trail.graduation?.completed?.includes('routeNumbers')).length,
      routeNumberGuidanceOutstanding: trails.filter(trail=>!trail.graduation?.completed?.includes('routeNumbers')).length,
      identityCheckQueued: items.filter(item => item.campaignState === 'identity-check-queued').length,
      sourceIdentityRequired: items.filter(item => item.campaignState === 'source-identity-required').length,
      sourceIdentityContradicted: items.filter(item => item.identityCheck).length,
      sourcedByComposite: items.filter(item => item.routeComposite).length,
      previouslyQueued: excludedTrailIds.size,
      remainingQueueable: queueable.length - selected.length,
      jobsCreated: jobs.length,
    },
    selectedTrailIds: selected.map(item => item.trailId),
    jobs,
    items,
  };
  const errors = validateCampaign(campaign);
  if(errors.length) throw new Error(errors.join('; '));
  return campaign;
}

module.exports = {
  GRADUATION_CHECKS, hasFullGraduation, relationExternalId,
  baselineBlockers, campaignItem, jobForItem, planCatalogueCampaign,
  pathIsClosedLoop, identityContradiction, approvedComposite, ON_ROUTE_PERCENT,
};
