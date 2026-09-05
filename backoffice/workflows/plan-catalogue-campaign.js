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

// Does the last identity check say the recorded relation is a different route?
//
// The relation's name settles it when there is one: a relation named as the
// trail is the trail, and any disagreement about its length is then a metrics
// question for the geometry gate, not evidence of the wrong route.
//
// Without that, two findings speak, and only for a reconstruction that came
// back as one connected line. A relation carrying variants, spurs and
// approaches reconstructs as several components whose lengths sum to far more
// than the walk; comparing that total against the route's distance says
// nothing about which route it is.
function normalisedName(value){
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function identityCheckFor(trail, identityChecks){
  const check = identityChecks && identityChecks[trail && trail.id];
  if(!check || check.externalRelationId !== relationExternalId(trail)) return null;
  return check;
}

function identityContradiction(trail, identityChecks){
  const check = identityCheckFor(trail, identityChecks);
  if(!check) return null;

  const relationName = normalisedName(check.relationName);
  if(relationName && relationName === normalisedName(trail && trail.name)) return null;

  // `null` means the check predates component counting; treat it as unproven
  // rather than as a single line, so an old verdict cannot condemn a trail.
  if(check.componentCount !== 1) return null;

  const detail = { checkedAt: check.checkedAt || null,
    externalRelationId: check.externalRelationId,
    relationName: check.relationName || null,
    reconstructedDistanceKm: check.reconstructedDistanceKm ?? null,
    officialDistanceKm: check.officialDistanceKm ?? null };
  if((check.blockers || []).includes('official-distance-conflict')){
    return { reason: 'official-distance-conflict', ...detail };
  }
  if(pathIsClosedLoop(trail) && check.closedLoop === false){
    return { reason: 'reconstruction-is-not-a-loop', ...detail };
  }
  return null;
}

function baselineBlockers(trail, identityChecks){
  const blockers = [];
  if(!relationExternalId(trail)) blockers.push('route-source-identity-unresolved');
  else if(identityContradiction(trail, identityChecks)) blockers.push('route-source-identity-contradicted');
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

function priorityFor(trail, verified, blockers, identityChecks){
  let score = trail.curated === false ? 200 : 300;
  if(verified) score = 50;
  // A relation that reconstructs a different route is not a usable identity,
  // so it does not earn the bonus for having one.
  if(relationExternalId(trail) && !identityContradiction(trail, identityChecks)) score += 15;
  if(Array.isArray(trail.sourceLinks) && trail.sourceLinks.length) score += 10;
  score += Math.min(blockers.length, 20);
  return score;
}

function campaignItem(trail, identityChecks){
  const verified = hasFullGraduation(trail);
  const externalId = relationExternalId(trail);
  const blockers = verified ? [] : baselineBlockers(trail, identityChecks);
  const contradiction = verified ? null : identityContradiction(trail, identityChecks);
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
      : externalId && !contradiction ? 'identity-check-queued' : 'source-identity-required',
    priorityScore: priorityFor(trail, verified, blockers, identityChecks),
    baselineBlockers: blockers,
    identityCheck: contradiction,
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
  const items = trails.map(trail => campaignItem(trail, identityChecks)).sort((a, b) =>
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
  pathIsClosedLoop, identityContradiction, normalisedName,
};
