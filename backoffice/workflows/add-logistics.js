'use strict';

const workflow = require('../contracts/workflow-v1');
const { rankParking } = require('../services/parking-ranker');

function addLogistics(candidate, accessPoints, context = {}){
  if(!candidate || candidate.state !== 'geometry_validated'){
    throw new Error(`Logistics requires geometry_validated candidate, received ${candidate && candidate.state}`);
  }
  const suggestions = rankParking(candidate.geometry.coordinates, accessPoints, {
    radiusM: context.radiusM || 500,
    limit: context.limit || 3,
  });
  const at = context.at || new Date().toISOString();
  const updated = {
    ...candidate,
    logistics: {
      version: 'logistics-v1',
      status: suggestions.length ? 'suggestions-ready' : 'parking-unresolved',
      searchRadiusM: context.radiusM || 500,
      parkingSuggestions: suggestions,
      selectedParking: null,
      requiresHumanReview: true,
    },
  };
  return workflow.transition(updated, 'evidence_pending', {
    at,
    actor: 'logistics-workflow-v1',
    reason: suggestions.length
      ? `${suggestions.length} mapped parking suggestion(s) require review`
      : 'no mapped parking found within search radius',
  });
}

function enrichQueue(queue, accessPoints, options = {}){
  const candidates = (queue.candidates || []).map(candidate => addLogistics(candidate, accessPoints, options));
  return {
    ...queue,
    generatedAt: options.at || new Date().toISOString(),
    logistics: {
      version: 'logistics-v1',
      accessSnapshotAt: accessPoints.generatedAt || null,
      candidatesProcessed: candidates.length,
      withParkingSuggestions: candidates.filter(candidate => candidate.logistics.parkingSuggestions.length).length,
      unresolvedParking: candidates.filter(candidate => !candidate.logistics.parkingSuggestions.length).length,
    },
    candidates,
  };
}

module.exports = { addLogistics, enrichQueue };
