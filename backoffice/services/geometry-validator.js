'use strict';

const EARTH_RADIUS_M = 6371008.8;

function toRadians(value){
  return value * Math.PI / 180;
}

function distanceMeters(a, b){
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b[0] - a[0]);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Not every walk returns to where it started. An out-and-back retraces its
// outward leg and a point-to-point ends somewhere else entirely, and both are
// ordinary ways for a trail to exist. Treating an open route as broken geometry
// froze real trails out of verification for having the wrong shape.
//
// The shape defaults to 'loop', so nothing changes for a trail that has not
// been declared: only a trail whose shape a human has stated is judged by it.
const ROUTE_SHAPES = Object.freeze(['loop', 'out-and-back', 'point-to-point']);

// `roundtrip` is OSM's own statement about whether a route comes back to where it
// started, and this catalogue already trusts it elsewhere — see
// scripts/fetch-dog-friendly-routes.js. The geometry check did not, so every
// route nobody had declared was assumed to be a loop and faulted for not
// closing. declare-route-shape exists to work around exactly that, one trail at
// a time, and in the repo's whole history it has been used once.
//
// Precedence is a human declaration, then OSM, then the old assumption: a
// moderator can still overrule a mis-tagged relation, and nothing changes where
// neither says anything. Only an explicit tag counts — inferring "not a loop"
// from a missing tag would fault nothing and exempt everything.
function isCircularRoute(options = {}){
  if(ROUTE_SHAPES.includes(options.routeShape)) return options.routeShape === 'loop';
  if(options.roundtrip === true) return true;
  if(options.roundtrip === false) return false;
  return true;
}

function assessGeometry(coordinates, options = {}){
  const closureThresholdM = options.closureThresholdM || 100;
  const routeShape = ROUTE_SHAPES.includes(options.routeShape) ? options.routeShape : 'loop';
  const issues = [];
  if(!Array.isArray(coordinates) || coordinates.length < 2){
    return {
      version: 'geometry-v1', status: 'rejected', isClosed: false,
      closureDistanceM: null, distanceKm: null, maxSegmentM: null,
      issues: ['missing-geometry'],
    };
  }

  const valid = coordinates.every(point => Array.isArray(point) && point.length === 2 &&
    Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90);
  if(!valid){
    return {
      version: 'geometry-v1', status: 'rejected', isClosed: false,
      closureDistanceM: null, distanceKm: null, maxSegmentM: null,
      issues: ['invalid-coordinate'],
    };
  }

  const segments = coordinates.slice(1).map((point, index) => distanceMeters(coordinates[index], point));
  const totalM = segments.reduce((sum, segment) => sum + segment, 0);
  const maxSegmentM = Math.max(...segments);
  const closureDistanceM = distanceMeters(coordinates[0], coordinates[coordinates.length - 1]);
  const isClosed = closureDistanceM <= closureThresholdM;
  // Only a route that is meant to close is faulted for not closing.
  const circular = isCircularRoute(options);
  if(!isClosed && circular) issues.push('not-closed-loop');
  if(totalM < 250) issues.push('implausibly-short');
  if(maxSegmentM > Math.max(5000, totalM * 0.45)) issues.push('suspicious-coordinate-jump');

  return {
    version: 'geometry-v1',
    status: issues.length ? 'rejected' : 'passed',
    routeShape,
    // routeShape is the shape a human declared, or the default. `circular` is
    // whether the closure test actually applied, which OSM can now answer.
    circular,
    isClosed,
    closureDistanceM: Math.round(closureDistanceM),
    distanceKm: Math.round(totalM / 10) / 100,
    maxSegmentM: Math.round(maxSegmentM),
    pointCount: coordinates.length,
    issues,
  };
}

module.exports = { isCircularRoute, ROUTE_SHAPES, assessGeometry, distanceMeters };
