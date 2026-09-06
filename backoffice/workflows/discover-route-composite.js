'use strict';

const { ON_ROUTE_METRES } = require('./run-catalogue-batch');

// Which documented waymarked paths does this walk follow?
//
// Many ORMA routes are not one OSM relation. A walker's loop is stitched from
// numbered paths — up the 1, back the 1A — and a check that can only read a
// single relation calls every one of them unsourced. This proposes the set of
// relations the walk actually follows, so the route has a source that covers
// it and the reader gets the numbers they will see on the signs.
//
// Nothing here decides anything. A proposal is evidence for the geometry gate.

const MAX_RELATIONS = 6;

function metresBetween(a, b){
  const radians = Math.PI / 180;
  const dLat = (b[0] - a[0]) * radians;
  const dLng = (b[1] - a[1]) * radians;
  const chord = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * radians) * Math.cos(b[0] * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(chord));
}

// An Overpass payload carries relations with their member way ids, and the ways
// with geometry. Stitching them per relation gives the points to measure against.
function relationsFromPayload(payload){
  const elements = Array.isArray(payload && payload.elements) ? payload.elements : [];
  const wayPoints = new Map();
  for(const element of elements){
    if(element.type !== 'way' || !Array.isArray(element.geometry)) continue;
    wayPoints.set(element.id, element.geometry
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon))
      .map(point => [point.lat, point.lon]));
  }
  const relations = [];
  for(const element of elements){
    if(element.type !== 'relation') continue;
    const points = [];
    for(const member of element.members || []){
      if(member.type === 'way' && wayPoints.has(member.ref)) points.push(...wayPoints.get(member.ref));
    }
    if(points.length) relations.push({ id:element.id, tags:element.tags || {}, points });
  }
  return relations;
}

function coveredIndices(walked, relation, radiusMetres){
  const covered = new Set();
  walked.forEach((point, index) => {
    for(const vertex of relation.points){
      if(metresBetween(point, vertex) <= radiusMetres){ covered.add(index); return; }
    }
  });
  return covered;
}

// Greedy set cover over the trail's own points: repeatedly take the relation
// that explains the most of the walk that nothing has explained yet. A relation
// adding nothing is never proposed, so the set stays as small as the route allows.
function discoverRouteComposite(trail, payload, options = {}){
  const radiusMetres = options.radiusMetres || ON_ROUTE_METRES;
  const maximumRelations = options.maximumRelations || MAX_RELATIONS;
  const walked = Array.isArray(trail && trail.path) ? trail.path : [];
  if(walked.length < 2) return null;

  const relations = relationsFromPayload(payload);
  const coverage = new Map(relations.map(relation => [relation.id, coveredIndices(walked, relation, radiusMetres)]));
  const outstanding = new Set(walked.map((_, index) => index));
  const chosen = [];

  while(outstanding.size && chosen.length < maximumRelations){
    let best = null;
    let bestGain = 0;
    for(const relation of relations){
      if(chosen.some(entry => entry.id === relation.id)) continue;
      let gain = 0;
      for(const index of coverage.get(relation.id)) if(outstanding.has(index)) gain += 1;
      if(gain > bestGain){ bestGain = gain; best = relation; }
    }
    if(!best) break;
    chosen.push(best);
    for(const index of coverage.get(best.id)) outstanding.delete(index);
  }

  const covered = walked.length - outstanding.size;
  return {
    radiusMetres,
    candidateRelationCount: relations.length,
    coveragePercent: Math.round((covered / walked.length) * 100),
    // Ordered by where each path first carries the walk, which is the order a
    // reader meets the numbers on the ground.
    relations: chosen
      .map(relation => ({
        externalRelationId: `relation/${relation.id}`,
        ref: relation.tags.ref || null,
        name: relation.tags.name || null,
        network: relation.tags.network || null,
        coveragePercent: Math.round((coverage.get(relation.id).size / walked.length) * 100),
        firstCoveredIndex: Math.min(...coverage.get(relation.id)),
      }))
      .sort((a, b) => a.firstCoveredIndex - b.firstCoveredIndex),
  };
}

// Ruling on a proposal. An approval rests on a fresh measurement, never on the
// number the proposal stored: that said what was true when discovery ran, and
// approving is the moment the claim becomes a route source. A measurement that
// could not be taken, or one that no longer covers the walk, leaves the
// proposal exactly as it was — holding is not rejecting.
function ruleOnComposite(composite, measured, options = {}){
  const at = options.at || new Date().toISOString();
  const by = options.approvedBy || 'human-moderator';
  const threshold = Number.isFinite(options.minimumCoveragePercent) ? options.minimumCoveragePercent : 90;
  if(!composite || composite.state !== 'proposed'){
    return { outcome:'left-alone', composite };
  }
  if(!measured || !Number.isFinite(measured.coveragePercent)){
    return { outcome:'held', reason:'coverage could not be measured', composite };
  }
  if(measured.coveragePercent < threshold){
    return { outcome:'held', reason:`covers ${measured.coveragePercent}% today`, composite };
  }
  const before = (composite.relations || []).map(entry => entry.externalRelationId).sort().join(',');
  const after = (measured.relations || []).map(entry => entry.externalRelationId).sort().join(',');
  return { outcome:'approved', composite:{ ...composite, state:'approved', approvedAt:at, approvedBy:by,
    coveragePercent:measured.coveragePercent, relations:measured.relations,
    relationsUnchangedSinceProposal:before === after } };
}

function rejectComposite(composite, options = {}){
  if(!composite || composite.state !== 'proposed') return { outcome:'left-alone', composite };
  return { outcome:'rejected', composite:{ ...composite, state:'rejected',
    rejectedAt:options.at || new Date().toISOString(),
    rejectedBy:options.approvedBy || 'human-moderator' } };
}

module.exports = { MAX_RELATIONS, discoverRouteComposite, relationsFromPayload, metresBetween,
  ruleOnComposite, rejectComposite };
