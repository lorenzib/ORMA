'use strict';

const { runCartographer } = require('./run-cartographer');
const { relationExternalId } = require('./plan-catalogue-campaign');

function candidateFromProductionTrail(trail){
  const externalId = relationExternalId(trail);
  if(!externalId) throw new Error('route-source-identity-unresolved');
  return {
    id: trail.id,
    name: trail.name,
    source: {
      provider: 'OpenStreetMap', externalId,
      url: trail.waymarkedtrails || `https://www.openstreetmap.org/${externalId}`,
    },
    geometryAssessment: {
      distanceKm: Number.isFinite(trail.distance) ? trail.distance : null,
    },
  };
}

function referenceFromProductionTrail(trail){
  return {
    referenceMetrics: {
      distanceKm: Number.isFinite(trail.distance) ? trail.distance : null,
      ascentM: Number.isFinite(trail.elevation) ? trail.elevation : null,
    },
  };
}

// What the reconstruction found, in the form the campaign planner reads back.
// It is keyed to the relation that was examined, so correcting a trail's source
// retires the verdict rather than freezing the trail out.
function identityCheckFrom(result, at){
  return {
    externalRelationId: result.source?.externalId || null,
    checkedAt: result.generatedAt || at,
    reviewState: result.reviewState,
    blockers: result.blockers || [],
    closedLoop: !(result.assessment?.issues || []).includes('not-closed-loop'),
    // The relation's own name, and whether it reconstructed as one line. A
    // relation carrying variants and spurs reconstructs as several components
    // whose lengths sum to far more than the walk, so its total is not a
    // distance the route can be compared against.
    relationName: result.relation?.tags?.name || null,
    componentCount: Array.isArray(result.components) ? result.components.length : null,
    reconstructedDistanceKm: result.comparison?.reconstructedDistanceKm ?? null,
    officialDistanceKm: result.comparison?.officialDistanceKm ?? null,
    distanceDeltaPercent: result.comparison?.distanceDeltaPercent ?? null,
  };
}

async function runCatalogueBatch(campaign, trails, options = {}){
  const at = options.at || new Date().toISOString();
  const executeCartographer = options.runCartographer || runCartographer;
  const trailById = new Map(trails.map(trail => [trail.id, trail]));
  const outputs = [];
  const jobs = [];
  const identityChecks = {};
  for(const queuedJob of campaign.jobs || []){
    const startedAt = options.at || new Date().toISOString();
    const job = { ...queuedJob, status: 'running', startedAt };
    const trail = trailById.get(job.candidateId);
    try{
      if(!trail) throw new Error('production-trail-not-found');
      if(job.action !== 'verify-current-relation') throw new Error('source-identity-research-required');
      const result = await executeCartographer(
        candidateFromProductionTrail(trail), referenceFromProductionTrail(trail), options
      );
      const outputRef = `backoffice-data/cartographer/${trail.id}.json`;
      outputs.push({ outputRef, result });
      identityChecks[trail.id] = identityCheckFrom(result, at);
      jobs.push({
        // A reconstruction that contradicted the record is not a route waiting
        // for a geometry review. Reporting both as `needs-human` told the
        // operator that a failed identity check was ready for their approval.
        ...job, status: result.reviewState === 'ready-for-human-review' ? 'needs-human' : 'blocked',
        completedAt: options.at || new Date().toISOString(), outputRefs: [outputRef],
        outcome: result.reviewState, blockers: result.blockers,
      });
    }catch(error){
      jobs.push({
        ...job, status: error.message === 'source-identity-research-required' ? 'needs-human' : 'failed',
        completedAt: options.at || new Date().toISOString(),
        error: error.message,
      });
    }
  }
  return {
    contractVersion: '1.0.0', campaignGeneratedAt: campaign.generatedAt,
    executedAt: at, publicMutationAllowed: false,
    summary: {
      attempted: jobs.length,
      needsHuman: jobs.filter(job => job.status === 'needs-human').length,
      blocked: jobs.filter(job => job.status === 'blocked').length,
      failed: jobs.filter(job => job.status === 'failed').length,
    },
    jobs, outputs, identityChecks,
  };
}

module.exports = { candidateFromProductionTrail, referenceFromProductionTrail, identityCheckFrom, runCatalogueBatch };
