'use strict';

const { VERSION: CANDIDATE_VERSION, validateCandidate } = require('../contracts/candidate-v1');
const workflow = require('../contracts/workflow-v1');
const { assessGeometry } = require('../services/geometry-validator');

const HARD_BLOCK_DIFFICULTIES = new Set([
  'alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking',
]);
const REQUIRED_EVIDENCE = Object.freeze([
  'route', 'parking', 'elevation', 'water', 'heat', 'exposure',
  'livestock', 'surfaceHazards', 'access', 'photo',
]);

function candidateId(externalId){
  return `osm-${externalId.replace('/', '-')}`;
}

function disqualifiers(trail){
  const tags = trail.sourceTags || {};
  const reasons = [];
  if(HARD_BLOCK_DIFFICULTIES.has(trail.difficulty)) reasons.push(`blocked-difficulty:${trail.difficulty}`);
  if(tags.dog === 'no' || tags.dog === 'prohibited') reasons.push('dogs-prohibited');
  if(tags.access === 'private' || tags.access === 'no') reasons.push(`blocked-access:${tags.access}`);
  if(tags.highway === 'motorway' || tags.highway === 'motorway_link') reasons.push('motorway');
  return reasons;
}

function buildCandidate(trail, context = {}){
  const at = context.at || new Date().toISOString();
  const geometryAssessment = assessGeometry(trail.geometry);
  const blockers = [...disqualifiers(trail), ...geometryAssessment.issues];
  let candidate = {
    contractVersion: CANDIDATE_VERSION,
    id: candidateId(trail.id),
    name: trail.name || trail.ref || `Unnamed OSM trail ${trail.id}`,
    state: 'discovered',
    source: {
      provider: 'openstreetmap',
      externalId: trail.id,
      url: `https://www.openstreetmap.org/${trail.id}`,
      retrievedAt: context.retrievedAt || null,
      licence: 'ODbL-1.0',
      sourceTags: trail.sourceTags || {},
    },
    geometry: { type: 'LineString', coordinates: trail.geometry || [] },
    center: trail.center || null,
    geometryAssessment,
    blockers,
    evidenceRequired: [...REQUIRED_EVIDENCE],
    createdAt: at,
    updatedAt: at,
    history: [],
  };
  candidate = workflow.transition(candidate, blockers.length ? 'rejected' : 'geometry_validated', {
    at,
    actor: 'discovery-workflow-v1',
    reason: blockers.length ? blockers.join(', ') : 'deterministic geometry checks passed',
  });
  return candidate;
}

function discoverTrails(payload, options = {}){
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
  const trails = Array.isArray(payload && payload.trails) ? payload.trails : [];
  const assessed = trails.map(trail => buildCandidate(trail, {
    at: options.at,
    retrievedAt: payload.generatedAt || null,
  }));
  const candidates = assessed.filter(candidate => candidate.state === 'geometry_validated').slice(0, limit);
  for(const candidate of candidates){
    const errors = validateCandidate(candidate);
    if(errors.length) throw new Error(`${candidate.id}: ${errors.join('; ')}`);
  }
  return {
    workflowVersion: workflow.VERSION,
    generatedAt: options.at || new Date().toISOString(),
    input: { source: payload && payload.source || null, totalTrails: trails.length },
    summary: {
      assessed: assessed.length,
      eligible: assessed.filter(candidate => candidate.state === 'geometry_validated').length,
      queued: candidates.length,
      rejected: assessed.filter(candidate => candidate.state === 'rejected').length,
    },
    candidates,
    rejections: assessed.filter(candidate => candidate.state === 'rejected').map(candidate => ({
      id: candidate.id,
      name: candidate.name,
      blockers: candidate.blockers,
    })),
  };
}

module.exports = { HARD_BLOCK_DIFFICULTIES, REQUIRED_EVIDENCE, buildCandidate, discoverTrails, disqualifiers };
