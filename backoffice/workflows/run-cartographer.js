'use strict';

const { fetchRelation } = require('../services/osm-relation-client');
const { reconstructRelation } = require('../services/relation-geometry');
const { VERSION, validateCartographerResult } = require('../contracts/cartographer-result-v1');

function compareMetrics(sampled, reconstructed, reference){
  const officialKm = reference && reference.distanceKm;
  const fullKm = reconstructed.assessment.distanceKm;
  const sampledKm = sampled && sampled.distanceKm;
  const deltaPercent = Number.isFinite(officialKm) && Number.isFinite(fullKm) && officialKm > 0
    ? Math.round(((fullKm - officialKm) / officialKm) * 1000) / 10 : null;
  return {
    sampledDistanceKm: sampledKm ?? null,
    reconstructedDistanceKm: fullKm ?? null,
    officialDistanceKm: officialKm ?? null,
    officialAscentM: (reference && reference.ascentM) ?? null,
    distanceDeltaPercent: deltaPercent,
    withinOfficialDistanceTolerance: deltaPercent !== null ? Math.abs(deltaPercent) <= 10 : null,
  };
}

async function runCartographer(candidate, dossier, options = {}){
  if(!candidate || !candidate.source || !candidate.source.externalId){
    throw new Error('Candidate with an OSM relation source is required');
  }
  if(!String(candidate.source.externalId).startsWith('relation/')){
    throw new Error('Cartographer relation reconstruction currently supports OSM relations only');
  }
  const fetched = await (options.fetchRelation || fetchRelation)(candidate.source.externalId, options);
  const reconstructed = reconstructRelation(fetched.payload, candidate.source.externalId);
  const comparison = compareMetrics(candidate.geometryAssessment, reconstructed, dossier && dossier.referenceMetrics);
  const blockers = [...reconstructed.assessment.issues];
  if(comparison.withinOfficialDistanceTolerance === false) blockers.push('official-distance-conflict');
  if(comparison.officialDistanceKm === null) blockers.push('official-distance-unavailable');
  const result = {
    contractVersion: VERSION,
    candidateId: candidate.id,
    agentId: 'cartographer',
    action: 'reconstruct-full-osm-relation',
    generatedAt: options.at || new Date().toISOString(),
    reviewState: blockers.length ? 'blocked' : 'ready-for-human-review',
    source: {
      provider: fetched.query ? 'OpenStreetMap via Overpass' : 'OpenStreetMap main API',
      url: candidate.source.url,
      endpoint: fetched.endpoint,
      externalId: candidate.source.externalId,
      relationVersion: reconstructed.relation.version,
      relationTimestamp: reconstructed.relation.timestamp,
      licence: 'ODbL-1.0',
    },
    relation: reconstructed.relation,
    geometry: reconstructed.geometry,
    components: reconstructed.components,
    assessment: reconstructed.assessment,
    comparison,
    blockers,
    humanGate: {
      required: true,
      id: 'geometry-approval',
      instructions: [
        'Compare the reconstructed line with the named official route and trail numbers.',
        'For a named or numbered route, identify its authoritative recommended starting point before approval.',
        'Rotate a loop or reverse a line so coordinate 0 is the approved recommended starting point; follow an authoritative recommended direction when one is specified.',
        'Inspect every disconnected component, gap, duplicate branch and road crossing.',
        'Approve route geometry separately from parking; a nearby parking pin is not proof of the route start.',
      ],
    },
  };
  const errors = validateCartographerResult(result);
  if(errors.length) throw new Error(errors.join('; '));
  return result;
}

module.exports = { compareMetrics, runCartographer };
