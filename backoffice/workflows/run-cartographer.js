'use strict';

const { fetchRelation, fetchRoutesNearPath } = require('../services/osm-relation-client');
const { assessRouteConformance, routeLinesFor } = require('../services/route-conformance');
const { reconstructRelation } = require('../services/relation-geometry');
const { reconstructComposite } = require('../services/composite-geometry');
const { discoverRouteComposite } = require('./discover-route-composite');
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

/**
 * The numbers this route tells a walker to follow, from the relation's own ref.
 * A relation carrying several is several routes to stay on, not one.
 */
function declaredRefs(relation){
  return String((relation && relation.tags && relation.tags.ref) || '')
    .split(';').map(ref => ref.trim()).filter(Boolean);
}

/**
 * How much of the reconstructed line runs along the routes it names.
 *
 * A lookup that fails leaves the comparison 'unknown' rather than blocking the
 * lane: an Overpass outage is not evidence about a trail. It is still recorded,
 * so a route nobody could check is visible as unchecked instead of silently
 * reading as clean.
 */
async function measureRouteConformance(coordinates, relation, options = {}){
  const refs = declaredRefs(relation);
  if(!refs.length) return null;
  // fetchRoutesNearPath builds an Overpass `around:` corridor, which is lat,lon,
  // and every caller hands it a site path in that order. These coordinates are
  // GeoJSON lng,lat, so the flip happens here, once, rather than two orders
  // being carried any further.
  const corridor = coordinates.map(([lng, lat]) => [lat, lng]);
  try{
    const { payload } = await (options.fetchRoutesNearPath || fetchRoutesNearPath)(corridor, options);
    return assessRouteConformance(coordinates, routeLinesFor(payload, refs), { refs });
  }catch(error){
    return { ...assessRouteConformance(coordinates, [], { refs }), lookupError: error.message };
  }
}

function leadRelationUrl(relations){
  const lead = (relations || [])[0];
  return lead && lead.externalRelationId ? `https://www.openstreetmap.org/${lead.externalRelationId}` : null;
}

/**
 * A composite is re-measured rather than re-fetched. The approval already works
 * this way -- "an approval rests on a fresh measurement, never on the number the
 * proposal stored" -- and the same reasoning applies every time the route is
 * used afterwards: the relations are somebody else's data and can move.
 *
 * One corridor fetch, not one per relation. fetchRoutesNearPath takes the site
 * path in [lat, lng], which is the order trail.path is already in.
 */
async function measureComposite(candidate, options = {}){
  try{
    const { payload } = await (options.fetchRoutesNearPath || fetchRoutesNearPath)(candidate.path, options);
    return discoverRouteComposite({ id:candidate.id, path:candidate.path }, payload, options);
  }catch(error){
    // Unmeasured, not degraded. An Overpass outage is not evidence about a trail.
    return null;
  }
}

async function runCompositeCartographer(candidate, dossier, options = {}){
  const measured = await measureComposite(candidate, options);
  const reconstructed = reconstructComposite(candidate, candidate.composite, measured, options);
  const comparison = compareMetrics(candidate.geometryAssessment, reconstructed, dossier && dossier.referenceMetrics);
  const routeConformance = await measureRouteConformance(reconstructed.geometry.coordinates,
    reconstructed.relation, options);
  const blockers = [...reconstructed.assessment.issues, ...((routeConformance && routeConformance.issues) || [])];
  if(comparison.withinOfficialDistanceTolerance === false) blockers.push('official-distance-conflict');
  // Many valid local routes publish a line but no distance. Missing comparison
  // data is recorded in `comparison`; it is not evidence that the geometry is
  // wrong. A contradictory published distance still blocks above.
  return {
    contractVersion: VERSION,
    candidateId: candidate.id,
    agentId: 'cartographer',
    action: 'attest-approved-route-composite',
    generatedAt: options.at || new Date().toISOString(),
    reviewState: blockers.length ? 'blocked' : 'ready-for-human-review',
    source: {
      provider: 'OpenStreetMap via Overpass',
      // The route that first carries the walk, which is the number a walker
      // meets first. It is one of several: the full list is in relations below,
      // and the dossier renders all of them.
      url: leadRelationUrl(reconstructed.relations) || candidate.source?.url
        || `https://www.openstreetmap.org/`,
      endpoint: null,
      externalId: reconstructed.relation.id,
      relationVersion: null,
      relationTimestamp: reconstructed.relation.timestamp,
      // The routes this walk is made of. A reader asking "whose route is this"
      // is answered by the list, never by the composite id above.
      relations: reconstructed.relations,
      licence: 'ODbL-1.0',
    },
    relation: reconstructed.relation,
    geometry: reconstructed.geometry,
    components: reconstructed.components,
    assessment: reconstructed.assessment,
    coverage: reconstructed.coverage,
    routeConformance,
    comparison,
    blockers,
    humanGate: {
      required: true,
      id: 'geometry-approval',
      instructions: [
        'Compare the walked line with the routes the composite names and their numbers.',
        'Confirm the walk still follows those routes on the ground.',
      ],
    },
    publicMutationAllowed: false,
  };
}

async function runCompositeCartographerValidated(candidate, dossier, options = {}){
  const result = await runCompositeCartographer(candidate, dossier, options);
  const errors = validateCartographerResult(result);
  if(errors.length) throw new Error(errors.join('; '));
  return result;
}

async function runCartographer(candidate, dossier, options = {}){
  // A trail with an approved composite has no single relation to reconstruct.
  if(candidate && candidate.composite) return runCompositeCartographerValidated(candidate, dossier, options);
  if(!candidate || !candidate.source || !candidate.source.externalId){
    throw new Error('Candidate with an OSM relation source is required');
  }
  if(!String(candidate.source.externalId).startsWith('relation/')){
    throw new Error('Cartographer relation reconstruction currently supports OSM relations only');
  }
  const fetched = await (options.fetchRelation || fetchRelation)(candidate.source.externalId, options);
  const reconstructed = reconstructRelation(fetched.payload, candidate.source.externalId,
    { routeShape: candidate.routeShape || undefined });
  const comparison = compareMetrics(candidate.geometryAssessment, reconstructed, dossier && dossier.referenceMetrics);
  const routeConformance = await measureRouteConformance(reconstructed.geometry.coordinates,
    reconstructed.relation, options);
  const blockers = [...reconstructed.assessment.issues, ...((routeConformance && routeConformance.issues) || [])];
  if(comparison.withinOfficialDistanceTolerance === false) blockers.push('official-distance-conflict');
  // Missing official distance stays unknown; contradiction still blocks.
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
    routeConformance,
    comparison,
    blockers,
    humanGate: {
      required: true,
      id: 'geometry-approval',
      instructions: [
        'Compare the reconstructed line with the named official route and trail numbers.',
      'Read the measured route conformance: any stretch it reports is the line leaving the numbers the page prints.',
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

module.exports = { compareMetrics, declaredRefs, measureRouteConformance, measureComposite, leadRelationUrl, runCompositeCartographer, runCartographer };
