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

function baselineBlockers(trail){
  const blockers = [];
  if(!relationExternalId(trail)) blockers.push('route-source-identity-unresolved');
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

function priorityFor(trail, verified, blockers){
  let score = trail.curated === false ? 200 : 300;
  if(verified) score = 50;
  if(relationExternalId(trail)) score += 15;
  if(Array.isArray(trail.sourceLinks) && trail.sourceLinks.length) score += 10;
  score += Math.min(blockers.length, 20);
  return score;
}

function campaignItem(trail){
  const verified = hasFullGraduation(trail);
  const externalId = relationExternalId(trail);
  const blockers = verified ? [] : baselineBlockers(trail);
  return {
    trailId: trail.id,
    name: trail.name,
    origin: trail.curated === false ? 'imported' : 'curated',
    publicRecordPresent: trail.publicRecordPresent !== false,
    modernGraduationVerified: verified,
    externalRelationId: externalId,
    campaignState: verified
      ? 'verified-monitoring'
      : externalId ? 'identity-check-queued' : 'source-identity-required',
    priorityScore: priorityFor(trail, verified, blockers),
    baselineBlockers: blockers,
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
  const items = trails.map(campaignItem).sort((a, b) =>
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
  baselineBlockers, campaignItem, planCatalogueCampaign,
};
