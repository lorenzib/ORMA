'use strict';

// Nine hand-curated trails carry no OSM relation of their own, and the
// cartographer threw route-source-identity-unresolved on every one. Six of them
// have a human-approved composite recorded instead: Alpe di Siusi's walk runs
// along eleven waymarked routes and is covered by them end to end.
//
// A composite is not a geometry source. discoverRouteComposite measures
// trail-ward -- for each point of the curated path, is any vertex of this
// relation within 60 m -- so it answers how much of the walk runs along a route,
// never how much of that route is the walk. Relation 9437572 carries 46% of
// Alpe di Siusi and continues well past it. Stitching the eleven whole would
// draw a line covering several times the ground a walker covers.
//
// So the route is the curated path somebody drew, and the composite is what
// says whose route it is. This reconstructs that: the path as the geometry, the
// approved relations as the identity, and a fresh coverage measurement as the
// check -- the same shape as reconstructRelation, which re-fetches a relation
// and re-compares it, so nothing downstream has to know which kind it got.

const { assessGeometry } = require('./geometry-validator');

// Below this a composite no longer describes the walk it was approved for.
// Deliberately its own number rather than the discovery threshold: approving a
// proposal and continuing to trust one are different decisions, and this is the
// one that can withdraw a route source from a trail already in the pipeline.
const MINIMUM_LIVE_COVERAGE_PERCENT = 90;

/**
 * The curated path as GeoJSON. trail.path is [lat, lng] -- the order the site
 * stores and fetchRoutesNearPath expects -- and geometry is [lng, lat]. The flip
 * happens here, once, so no caller carries both orders.
 */
function pathToGeometry(path){
  return (Array.isArray(path) ? path : [])
    .filter(point => Array.isArray(point) && point.length >= 2
      && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([lat, lng]) => [lng, lat]);
}

function approvedRelationIds(composite){
  return new Set((composite?.relations || []).map(relation => String(relation.externalRelationId)));
}

/**
 * What the live measurement says about a composite that was approved earlier.
 * Absent means nobody could measure, which is not the same as a composite that
 * has stopped covering its walk: an Overpass outage is not evidence about a
 * trail, and the same distinction run-cartographer draws for conformance.
 */
function compareCoverage(composite, measured, options = {}){
  const threshold = Number.isFinite(options.minimumCoveragePercent)
    ? options.minimumCoveragePercent : MINIMUM_LIVE_COVERAGE_PERCENT;
  const approvedAt = Number(composite?.coveragePercent);
  if(!measured) return { status:'unmeasured', approvedCoveragePercent:approvedAt || null,
    liveCoveragePercent:null, missingRelations:[], issues:[] };

  const live = Number(measured.coveragePercent);
  const stillPresent = new Set((measured.relations || []).map(relation => String(relation.externalRelationId)));
  const missingRelations = [...approvedRelationIds(composite)].filter(id => !stillPresent.has(id));

  const issues = [];
  if(Number.isFinite(live) && live < threshold) issues.push('composite-coverage-dropped');
  // A route the approval rested on that no longer carries the walk. Reported
  // even when coverage still holds, because the identity a reader is shown is
  // the list of numbers, and one of them has stopped being true.
  if(missingRelations.length) issues.push('composite-relations-changed');

  return {
    status: issues.length ? 'degraded' : 'holding',
    approvedCoveragePercent: Number.isFinite(approvedAt) ? approvedAt : null,
    liveCoveragePercent: Number.isFinite(live) ? live : null,
    minimumCoveragePercent: threshold,
    missingRelations,
    issues,
  };
}

/**
 * The same shape reconstructRelation returns, so run-cartographer and every
 * reader below it stay single-branch.
 */
function reconstructComposite(trail, composite, measured, options = {}){
  const coordinates = pathToGeometry(trail && trail.path);
  const coverage = compareCoverage(composite, measured, options);
  const assessment = assessGeometry(coordinates, {
    closureThresholdM: options.closureThresholdM || 100,
    routeShape: trail?.routeShape || options.routeShape,
  });
  const issues = [...assessment.issues, ...coverage.issues];
  const relations = (composite?.relations || []).map(relation => ({
    externalRelationId: relation.externalRelationId,
    ref: relation.ref || null,
    name: relation.name || null,
    coveragePercent: relation.coveragePercent ?? null,
  }));

  return {
    relation: {
      // Named for what it is. Nothing downstream should mistake it for a
      // relation id it could fetch.
      id: `composite/${trail?.id || 'unknown'}`,
      version: null,
      timestamp: composite?.approvedAt || null,
      tags: {
        type: 'route', route: 'hiking',
        name: composite?.trailName || trail?.name || null,
        // The numbers a walker meets, in the order the composite lists them.
        ref: relations.map(relation => relation.ref).filter(Boolean).join(';') || undefined,
      },
      memberRelationCount: relations.length,
    },
    geometry: { type:'LineString', coordinates },
    components: [{ wayIds: [], pointCount: coordinates.length, coordinates }],
    missingWayIds: [],
    relations,
    coverage,
    assessment: { ...assessment, issues, status: issues.length ? 'needs-review' : 'passed' },
  };
}

module.exports = { MINIMUM_LIVE_COVERAGE_PERCENT, pathToGeometry, approvedRelationIds, compareCoverage, reconstructComposite };
