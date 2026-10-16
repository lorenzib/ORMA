'use strict';

const { fetchRelation, fetchRoutesNearPath } = require('../services/osm-relation-client');
const { assessRouteConformance, routeLinesFor } = require('../services/route-conformance');
const { rebuildLostTheRoute, withoutRebuildFaults, INCOMPLETE_REBUILD_NOTE,
  openRouteNotABrokenLoop, OPEN_ROUTE_NOTE } = require('./reconstruction-quality');
const { reconstructRelation } = require('../services/relation-geometry');
const { singleRelationGuidance } = require('./route-guidance-from-map');
const { reconstructComposite } = require('../services/composite-geometry');
const { discoverRouteComposite } = require('./discover-route-composite');
const { numbersAlongTheWalk } = require('./numbers-along-the-walk');
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

/**
 * The numbered walking routes a walk runs along, for a walk that carries no
 * number of its own.
 *
 * Seven trails were refused for want of route guidance after ORMA read `ref`
 * on their own relation and found nothing. That tag says whether the walk is
 * *itself* a numbered route; it says nothing about the waymarks a walker
 * actually follows. Four of the six that could be read run along numbered
 * paths.
 *
 * Same corridor fetch and same measurement the composite search uses, so no
 * second idea of what "along the walk" means, and no model call.
 */
async function measureNumbersAlong(path, options = {}){
  if(!Array.isArray(path) || path.length < 2){
    return { measured: false, why: 'the walk has no line to measure along' };
  }
  try{
    const { payload } = await (options.fetchRoutesNearPath || fetchRoutesNearPath)(path, options);
    return { measured: true, guidance: numbersAlongTheWalk(path, payload, options) };
  }catch(error){
    // Unmeasured, not degraded. An Overpass outage is not evidence about a
    // trail -- but it has to leave a mark, or it reads as one. La Croix des
    // Salles was surveyed on 15 October 2026 and came back with no measurement
    // at all because the corridor query failed for it, and the trail simply sat
    // showing its two route claims unanswered. Nothing said a measurement had
    // been attempted and could not be taken, so nothing said to try again.
    return { measured: false, why: String(error.message || error).slice(0, 160) };
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

  // A composite says which of the three cases it is, like any other survey.
  //
  // It recorded the numbers it measured and nothing at all otherwise, so a
  // composite whose routes carry no number could not be told from one surveyed
  // before the marks existed. From the gate those read alike, and only one of
  // them is a walk to research. Cinque Torri was the last trail in the
  // catalogue blocked on route guidance on 16 October 2026, for exactly that
  // reason, and twelve trails are on this path -- Tre Cime and Lago di Braies
  // among them.
  //
  // Its own routes' numbers first, then the numbered walking routes running
  // along the walk, which is the same ladder the single-relation path climbs
  // and makes the mark mean one thing in both. A composite whose members are
  // unnumbered is not a walk with no numbers near it.
  const along = reconstructed.routeGuidance
    ? { measured: true, guidance: reconstructed.routeGuidance }
    : await measureNumbersAlong(reconstructed.geometry.coordinates
      .map(([lng, lat]) => [lat, lng]), options);
  const routeGuidance = along.guidance || null;
  const routeNumbersAbsent = along.measured && !along.guidance;
  const routeNumbersUnmeasured = along.measured ? null : (along.why || 'the measurement could not be taken');
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
    // Which numbered route carries each stretch, and where one gives way to
    // the next, read off the relations this walk is built from. Travels beside
    // routeConformance because it is the same kind of thing: a measurement the
    // cartographer made, which the dossier reads rather than researches.
    ...(routeGuidance ? { routeGuidance } : {}),
    ...(routeNumbersAbsent ? { routeNumbersAbsent: true } : {}),
    ...(routeNumbersUnmeasured ? { routeNumbersUnmeasured } : {}),
    // What ORMA already recorded about this walk, travelling with everything
    // else the audit measured so the dossier can read it rather than send an
    // agent to rediscover it.
    ...(candidate.trailRecord ? { trailRecord: candidate.trailRecord } : {}),
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
  // Its own number where it has one, and otherwise the numbered walking routes
  // it runs along -- which is what a walker reads off a signpost either way.
  const ownNumber = singleRelationGuidance(reconstructed.relation);
  const along = ownNumber
    ? { measured: true, guidance: ownNumber }
    : await measureNumbersAlong(reconstructed.geometry.coordinates
      .map(([lng, lat]) => [lat, lng]), options);
  const routeGuidance = along.guidance || null;
  // Measured and found nothing is a fact about the walk. Never measured is a
  // fact about ORMA, and the two must not read alike: a walk is told it carries
  // no number only where somebody looked. Audits taken before this measurement
  // existed carry neither mark, so nothing is claimed of them -- the trap #806
  // fell into, where a derived field only existed for trails measured since.
  const routeNumbersAbsent = along.measured && !along.guidance;
  // Three outcomes, not two. Found numbers, looked and found none, or could
  // not look -- and the third must not read as the second. A walk whose own
  // relation carries a number needed no corridor query, so it is not
  // unmeasured; nothing was missed.
  const routeNumbersUnmeasured = along.measured ? null : (along.why || 'the measurement could not be taken');
  const rawBlockers = [...reconstructed.assessment.issues, ...((routeConformance && routeConformance.issues) || [])];
  if(comparison.withinOfficialDistanceTolerance === false) rawBlockers.push('official-distance-conflict');
  // Missing official distance stays unknown; contradiction still blocks.
  //
  // A rebuild that lost a material part of a line ORMA already holds, where the
  // held line matches the distance the authority publishes, has failed. Its
  // connectivity and its length describe the rebuild, not the route, so they
  // are set aside and the failure is recorded as the audit's own. Everything
  // else it found still stands.
  const rebuild = rebuildLostTheRoute({
    rebuiltKm: reconstructed.assessment.distanceKm,
    heldPath: candidate.path,
    officialKm: comparison.officialDistanceKm,
  });
  // A route nobody declared a loop, whose line is the full published distance
  // and simply ends elsewhere, was never a loop. Faulting it for not closing
  // holds it to a shape it never claimed.
  const openRoute = openRouteNotABrokenLoop({
    declaredShape: candidate.routeShape || null,
    lineKm: reconstructed.assessment.distanceKm,
    officialKm: comparison.officialDistanceKm,
    closed: reconstructed.assessment.isClosed,
  });
  const afterRebuild = rebuild.incomplete
    ? [...withoutRebuildFaults(rawBlockers), INCOMPLETE_REBUILD_NOTE]
    : rawBlockers;
  const blockers = openRoute.open
    ? [...afterRebuild.filter(blocker => blocker !== 'not-closed-loop'), OPEN_ROUTE_NOTE]
    : afterRebuild;
  const result = {
    contractVersion: VERSION,
    candidateId: candidate.id,
    agentId: 'cartographer',
    action: 'reconstruct-full-osm-relation',
    generatedAt: options.at || new Date().toISOString(),
    reviewState: blockers.length ? 'blocked' : 'ready-for-human-review',
    rebuild,
    openRoute,
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
    // One relation is one number from end to end. The derivation is shared
    // with the gate, which has to reach the same answer for audits taken
    // before this field was written at all.
    //
    // 150 of 162 trails are built this way, so leaving it to the composite
    // path covered twelve of them.
    ...(routeGuidance ? { routeGuidance } : {}),
    ...(routeNumbersAbsent ? { routeNumbersAbsent: true } : {}),
    ...(routeNumbersUnmeasured ? { routeNumbersUnmeasured } : {}),
    ...(candidate.trailRecord ? { trailRecord: candidate.trailRecord } : {}),
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
