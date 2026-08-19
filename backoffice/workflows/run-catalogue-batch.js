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

async function runCatalogueBatch(campaign, trails, options = {}){
  const at = options.at || new Date().toISOString();
  const executeCartographer = options.runCartographer || runCartographer;
  const trailById = new Map(trails.map(trail => [trail.id, trail]));
  const outputs = [];
  const jobs = [];
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
      jobs.push({
        ...job, status: result.reviewState === 'ready-for-human-review' ? 'needs-human' : 'needs-human',
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
      failed: jobs.filter(job => job.status === 'failed').length,
    },
    jobs, outputs,
  };
}

module.exports = { candidateFromProductionTrail, referenceFromProductionTrail, runCatalogueBatch };
