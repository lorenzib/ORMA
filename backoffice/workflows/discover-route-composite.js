'use strict';

const { ON_ROUTE_METRES } = require('../services/geometry-validator');

// Which documented waymarked paths does this walk follow?
//
// Many ORMA routes are not one OSM relation. A walker's loop is stitched from
// numbered paths, up the 1 and back the 1A, and a check that can only read a
// single relation calls every one of them unsourced. This proposes the set of
// relations the walk actually follows, so the route has a source that covers
// it and the reader gets the numbers they will see on the signs.
//
// Nothing here decides anything. A proposal is evidence for the geometry gate.

const MAX_RELATIONS = 6;

// A route source should be at the scale of the walk. A long-distance traverse
// that happens to run along it covers everything in one relation, which is
// exactly what a set cover rewards, and it is a poor source: guidance drawn
// from it would tell a reader to follow a week-long route for five kilometres.
// Such a relation is used only when nothing at the walk's own scale explains
// the route.
const MINIMUM_WALK_SHARE = 0.1;

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

// Length of a line, ignoring jumps between disjoint pieces so a relation that
// comes back in fragments is not credited with the gaps between them.
function lineKilometres(points){
  let total = 0;
  for(let index = 1; index < points.length; index += 1){
    const step = metresBetween(points[index - 1], points[index]) / 1000;
    if(step < 1) total += step;
  }
  return total;
}

// A chairlift is mapped as two or three nodes over a kilometre of cable, so
// asking whether a walked point is near one of its *vertices* misses the middle
// of the ride. Densifying the line first keeps the nearest-vertex test that the
// rest of this file uses, and for a straight cable span that is exact.
const RIDE_SAMPLE_M = 20;

// How much longer than the cable the matched stretch may be before it stops
// looking like a ride. The station approaches add a little; they do not double it.
const RIDE_LENGTH_TOLERANCE = 1.5;

function densify(points, spacingMetres = RIDE_SAMPLE_M){
  const dense = [];
  for(let index = 0; index < points.length - 1; index += 1){
    const start = points[index];
    const end = points[index + 1];
    const steps = Math.max(1, Math.ceil(metresBetween(start, end) / spacingMetres));
    for(let step = 0; step < steps; step += 1){
      dense.push([start[0] + (end[0] - start[0]) * step / steps,
        start[1] + (end[1] - start[1]) * step / steps]);
    }
  }
  if(points.length) dense.push(points[points.length - 1]);
  return dense;
}

/**
 * The stretch of a walk that is ridden rather than walked.
 *
 * Only for an itinerary that declares it rides a lift. `liftAccess.dependency`
 * is curated and already says exactly this: "required when the itinerary itself
 * rides the lift, optional when a lift only shortens the walk". Where a lift is
 * merely nearby -- and in a ski area a path often runs right under one -- the
 * walk is still walked and nothing here applies.
 *
 * One contiguous stretch, the longest, because a ride is continuous. Scattered
 * points that happen to pass beneath a cable are not a ride and must not excuse
 * ground a walker covers on foot.
 */
function ridesALift(trail){ return trail?.liftAccess?.dependency === 'required'; }

function riddenStretch(trail, aerialways, radiusMetres = ON_ROUTE_METRES){
  if(!ridesALift(trail)) return null;
  const walked = Array.isArray(trail.path) ? trail.path : [];
  const lines = (aerialways || []).filter(way => (way.points || []).length > 1)
    .map(way => ({ ...way, dense: densify(way.points) }));
  if(!walked.length || !lines.length) return null;

  let best = null;
  let run = null;
  walked.forEach((point, index) => {
    const on = lines.find(line => line.dense.some(vertex => metresBetween(point, vertex) <= radiusMetres));
    if(!on){ run = null; return; }
    if(!run || run.way !== on.id) run = { from:index, to:index, way:on.id, tags:on.tags };
    else run.to = index;
    if(!best || (run.to - run.from) > (best.to - best.from)) best = { ...run };
  });
  if(!best) return null;

  // Excusing ground is the direction that flatters a proposal, so it is capped
  // by the cable's own length. A walk leaves the top station still beside the
  // line, which is the station and fairly counted with the ride; a walk running
  // under a cable for twice its length is something else, and the honest answer
  // there is to measure the lot and let the coverage figure say so.
  const stretch = lineKilometres(walked.slice(best.from, best.to + 1));
  // Measured on the densified line: lineKilometres drops any step of a kilometre
  // or more as a gap between disjoint pieces, and a cable mapped as two nodes is
  // exactly one such step. Its own length would otherwise come back as zero.
  const cable = lineKilometres(lines.find(line => line.id === best.way).dense);
  if(cable > 0 && stretch > cable * RIDE_LENGTH_TOLERANCE) return null;

  return {
    fromIndex: best.from,
    toIndex: best.to,
    pointCount: best.to - best.from + 1,
    metres: Math.round(stretch * 1000),
    cableMetres: Math.round(cable * 1000),
    aerialway: best.tags?.aerialway || null,
    name: best.tags?.name || trail.liftAccess?.name || null,
  };
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
  const walkKm = lineKilometres(walked);
  const share = new Map(relations.map(relation => {
    const relationKm = lineKilometres(relation.points);
    return [relation.id, relationKm > 0 ? walkKm / relationKm : 0];
  }));
  const atScale = relation => share.get(relation.id) >= MINIMUM_WALK_SHARE;

  // A ride is not walked, so it is not the routes' job to explain it. Measuring
  // it would hold a hiking relation responsible for a cable, and cinque-torri
  // sat unproposable at 88% because 1 km of its 5.3 is the 5 Torri chairlift.
  // Removed from the denominator rather than counted as covered: the question
  // is what share of the *walk* runs along a waymarked route.
  const ridden = riddenStretch(trail, options.aerialways, radiusMetres);
  const isRidden = index => ridden && index >= ridden.fromIndex && index <= ridden.toIndex;
  const measured = walked.map((_, index) => index).filter(index => !isRidden(index));
  if(!measured.length) return null;

  const outstanding = new Set(measured);
  const chosen = [];

  // Paths at the walk's own scale first. Only if they leave the route
  // unexplained does a longer route through it get to answer.
  for(const eligible of [atScale, () => true]){
    while(outstanding.size && chosen.length < maximumRelations){
      let best = null;
      let bestGain = 0;
      for(const relation of relations){
        if(!eligible(relation)) continue;
        if(chosen.some(entry => entry.id === relation.id)) continue;
        let gain = 0;
        for(const index of coverage.get(relation.id)) if(outstanding.has(index)) gain += 1;
        if(gain > bestGain){ bestGain = gain; best = relation; }
      }
      if(!best) break;
      chosen.push(best);
      for(const index of coverage.get(best.id)) outstanding.delete(index);
    }
  }

  const covered = measured.length - outstanding.size;
  return {
    radiusMetres,
    candidateRelationCount: relations.length,
    coveragePercent: Math.round((covered / measured.length) * 100),
    // Stated, never silent. A denominator that quietly shrank would be the same
    // trick as a stored blocker list nobody recomputes.
    ...(ridden ? { riddenSegment: ridden, walkedPointCount: measured.length } : {}),
    // Ordered by where each path first carries the walk, which is the order a
    // reader meets the numbers on the ground.
    relations: chosen
      .map(relation => ({
        externalRelationId: `relation/${relation.id}`,
        ref: relation.tags.ref || null,
        name: relation.tags.name || null,
        network: relation.tags.network || null,
        coveragePercent: Math.round(([...coverage.get(relation.id)].filter(index => !isRidden(index)).length / measured.length) * 100),
        walkSharePercent: Math.min(100, Math.round(share.get(relation.id) * 100)),
        firstCoveredIndex: Math.min(...coverage.get(relation.id)),
      }))
      .sort((a, b) => a.firstCoveredIndex - b.firstCoveredIndex),
  };
}

// Ruling on a proposal. An approval rests on a fresh measurement, never on the
// number the proposal stored: that said what was true when discovery ran, and
// approving is the moment the claim becomes a route source. A measurement that
// could not be taken, or one that no longer covers the walk, leaves the
// proposal exactly as it was. Holding is not rejecting.
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
    // Carried from the fresh measurement with the figure it belongs to. An
    // approval that kept the proposal's ride and the new percent would describe
    // neither.
    riddenSegment:measured.riddenSegment || null,
    walkedPointCount:measured.walkedPointCount || null,
    relationsUnchangedSinceProposal:before === after } };
}

function rejectComposite(composite, options = {}){
  if(!composite || composite.state !== 'proposed') return { outcome:'left-alone', composite };
  return { outcome:'rejected', composite:{ ...composite, state:'rejected',
    rejectedAt:options.at || new Date().toISOString(),
    rejectedBy:options.approvedBy || 'human-moderator' } };
}

module.exports = { MAX_RELATIONS, MINIMUM_WALK_SHARE, RIDE_SAMPLE_M, RIDE_LENGTH_TOLERANCE, lineKilometres, discoverRouteComposite, relationsFromPayload, metresBetween,
  densify, riddenStretch, ridesALift, ruleOnComposite, rejectComposite };
