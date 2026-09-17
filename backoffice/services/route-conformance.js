'use strict';

// Does the drawn line actually follow the route it tells a walker to follow?
//
// Nothing asked this. The geometry checks test that a line is well formed --
// no gaps, no jumps, closes if it should, plausible length -- and every one of
// them passes for a line drawn along the wrong path. The cartographer's human
// gate asks a moderator to "compare the reconstructed line with the named
// official route and trail numbers", by eye, with no number to compare.
//
// Tre Cime is what that costs. Its line is healthy by every existing test:
// 2077 points, 9.51 km against 9.53 declared, longest segment 31 m, closing to
// 43 m, and never more than 14 m from a mapped way. It also leaves the 101 and
// 105 it names for 2.7 km of those 9.5, by as much as 201 m, onto real paths
// that carry no route at all. A walker following the page's directions and a
// walker following the page's map are on different walks for a quarter of it.
//
// So the test is distance from the *named* route, not from something walkable.
// Two paths can run within sight of each other for a kilometre and still be
// different walks, which is exactly the case this has to catch.

const { distanceMeters } = require('./geometry-validator');

// Coordinates are [lng, lat] throughout, as in geometry-validator. Overpass
// hands back {lat, lon} objects, so the conversion happens here, once, where
// the shape is unambiguous -- rather than being carried as a convention.

// How far off the named route a point has to be before it is off it. GPS
// mapping noise between two renderings of the same path stays well inside
// this; a parallel path does not.
const OFF_ROUTE_M = 25;

// Some departure is ordinary: the approach from a car park, a signed variant
// around a closed section, a stretch nobody has added to the relation yet. A
// tenth of the walk covers those. A quarter is a different route.
const MAX_OFF_ROUTE_SHARE = 0.1;

// A departure shorter than this is a mapping wobble, not a detour, and naming
// it would bury the real ones.
const MIN_STRETCH_M = 80;

function toRadians(value){ return value * Math.PI / 180; }

/**
 * A local flat projection in metres. Over a single trail the error is far
 * below OFF_ROUTE_M, and it makes point-to-segment distance ordinary algebra
 * rather than spherical trigonometry run millions of times.
 */
function projector(referenceLat){
  const metresPerLat = 111132;
  const metresPerLng = 111320 * Math.cos(toRadians(referenceLat));
  return point => [point[0] * metresPerLng, point[1] * metresPerLat];
}

function segmentDistance(point, start, end){
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared ? ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

/**
 * Segments bucketed into a grid so each point tests its own neighbourhood
 * instead of the whole route. A named route can carry thousands of segments
 * and a trail thousands of points; without this the gate is minutes of
 * multiplication for an answer that takes milliseconds.
 */
function grid(segments, cellSize){
  const cells = new Map();
  const key = (x, y) => `${x}:${y}`;
  segments.forEach((segment, index) => {
    const [a, b] = segment;
    const x0 = Math.floor(Math.min(a[0], b[0]) / cellSize);
    const x1 = Math.floor(Math.max(a[0], b[0]) / cellSize);
    const y0 = Math.floor(Math.min(a[1], b[1]) / cellSize);
    const y1 = Math.floor(Math.max(a[1], b[1]) / cellSize);
    for(let x = x0; x <= x1; x += 1){
      for(let y = y0; y <= y1; y += 1){
        const id = key(x, y);
        if(!cells.has(id)) cells.set(id, []);
        cells.get(id).push(index);
      }
    }
  });
  return {
    near(point){
      const cx = Math.floor(point[0] / cellSize);
      const cy = Math.floor(point[1] / cellSize);
      const found = new Set();
      for(let x = cx - 1; x <= cx + 1; x += 1){
        for(let y = cy - 1; y <= cy + 1; y += 1){
          const bucket = cells.get(key(x, y));
          if(bucket) for(const index of bucket) found.add(index);
        }
      }
      return found;
    },
  };
}

/**
 * The member-way geometry of every route relation whose ref matches one the
 * trail declares, from an Overpass payload shaped by fetchRoutesNearPath.
 *
 * Refs are compared with the spacing and case stripped, the way
 * promote-osm-trails already normalises them: "101" and "101 " and "101a" all
 * being separate refs is a mapping detail, not a different route on the ground.
 */
function routeLinesFor(payload, refs){
  const wanted = new Set((refs || [])
    .map(ref => String(ref || '').trim().toUpperCase().replace(/\s+/g, ''))
    .filter(Boolean));
  if(!wanted.size) return [];
  const elements = (payload && payload.elements) || [];
  const relations = elements.filter(element => element.type === 'relation');
  const matched = relations.filter(relation => String((relation.tags || {}).ref || '')
    .split(';')
    .some(ref => wanted.has(ref.trim().toUpperCase().replace(/\s+/g, ''))));
  const memberIds = new Set();
  for(const relation of matched){
    for(const member of relation.members || []){
      if(member.type === 'way') memberIds.add(member.ref);
    }
  }
  const lines = [];
  for(const element of elements){
    if(element.type !== 'way' || !memberIds.has(element.id)) continue;
    const geometry = element.geometry || [];
    if(geometry.length > 1) lines.push(geometry.map(node => [node.lon, node.lat]));
  }
  return lines;
}

/**
 * How much of `coordinates` runs along `routeLines`, measured as a share of
 * the walk rather than of the points: a route drawn densely round a hairpin
 * and sparsely along a straight must not have the hairpin count for more.
 *
 * Returns 'unknown' rather than 'passed' when there is nothing to compare
 * against. A route whose relations could not be fetched has not been checked,
 * and saying otherwise is how an unchecked route reaches a walker.
 */
function assessRouteConformance(coordinates, routeLines, options = {}){
  const offRouteM = options.offRouteM ?? OFF_ROUTE_M;
  const maxOffRouteShare = options.maxOffRouteShare ?? MAX_OFF_ROUTE_SHARE;
  const minStretchM = options.minStretchM ?? MIN_STRETCH_M;
  const refs = (options.refs || []).map(ref => String(ref)).filter(Boolean);

  const points = Array.isArray(coordinates) ? coordinates : [];
  if(points.length < 2){
    return {
      version: 'route-conformance-v1', status: 'unknown', refs,
      issues: ['missing-geometry'], distanceKm: null, offRouteKm: null,
      offRouteShare: null, maxOffsetM: null, stretches: [],
    };
  }
  const lines = (routeLines || []).filter(line => Array.isArray(line) && line.length > 1);
  if(!lines.length){
    return {
      version: 'route-conformance-v1', status: 'unknown', refs,
      issues: ['declared-route-unavailable'], distanceKm: null, offRouteKm: null,
      offRouteShare: null, maxOffsetM: null, stretches: [],
    };
  }

  const project = projector(points[0][1]);
  const segments = [];
  for(const line of lines){
    for(let index = 1; index < line.length; index += 1){
      segments.push([project(line[index - 1]), project(line[index])]);
    }
  }
  const index = grid(segments, Math.max(offRouteM * 4, 100));

  // Each point owns half the walk either side of it, so the off-route total is
  // a length along the ground rather than a count of vertices.
  // A point far enough off the route that its own neighbourhood is empty is
  // exactly the point worth measuring precisely, so it falls back to the whole
  // route rather than reporting an infinity that JSON would turn into null.
  const nearest = projected => {
    let best = Infinity;
    for(const id of index.near(projected)){
      const distance = segmentDistance(projected, segments[id][0], segments[id][1]);
      if(distance < best) best = distance;
    }
    if(Number.isFinite(best)) return best;
    for(const segment of segments){
      const distance = segmentDistance(projected, segment[0], segment[1]);
      if(distance < best) best = distance;
    }
    return best;
  };
  const offsets = points.map(point => nearest(project(point)));
  const spans = points.map((point, position) => {
    const before = position > 0 ? distanceMeters(points[position - 1], point) / 2 : 0;
    const after = position < points.length - 1 ? distanceMeters(point, points[position + 1]) / 2 : 0;
    return before + after;
  });

  let totalM = 0;
  let offM = 0;
  const stretches = [];
  let open = null;
  let travelled = 0;
  points.forEach((point, position) => {
    totalM += spans[position];
    const off = offsets[position] > offRouteM;
    if(off){
      offM += spans[position];
      if(!open) open = { startKm: travelled / 1000, startAt: point, maxOffsetM: 0, lengthM: 0 };
      open.maxOffsetM = Math.max(open.maxOffsetM, offsets[position]);
      open.lengthM += spans[position];
      open.endKm = travelled / 1000;
    }else if(open){
      if(open.lengthM >= minStretchM) stretches.push(open);
      open = null;
    }
    if(position < points.length - 1) travelled += distanceMeters(point, points[position + 1]);
  });
  if(open && open.lengthM >= minStretchM) stretches.push(open);

  const share = totalM > 0 ? offM / totalM : 0;
  const issues = share > maxOffRouteShare ? ['off-declared-route'] : [];
  const finite = offsets.filter(Number.isFinite);
  if(finite.length !== offsets.length) issues.push('unmeasurable-offset');
  return {
    version: 'route-conformance-v1',
    status: issues.length ? 'rejected' : 'passed',
    refs,
    distanceKm: Math.round(totalM / 10) / 100,
    offRouteKm: Math.round(offM / 10) / 100,
    offRouteShare: Math.round(share * 1000) / 1000,
    maxOffsetM: finite.length ? Math.round(Math.max(...finite)) : null,
    offRouteM,
    stretches: stretches.map(stretch => ({
      startKm: Math.round(stretch.startKm * 100) / 100,
      endKm: Math.round((stretch.endKm ?? stretch.startKm) * 100) / 100,
      lengthM: Math.round(stretch.lengthM),
      maxOffsetM: Math.round(stretch.maxOffsetM),
      startAt: stretch.startAt,
    })),
    issues,
  };
}

/**
 * The blocking reason for a failed assessment, phrased as the dossier's
 * route-guidance blockers are: those are unwaivable, and this belongs with
 * them. A line that leaves the numbers it prints is not background research a
 * moderator can judge sufficient -- it is the directions being wrong.
 */
function routeConformanceBlockingReasons(assessment){
  if(!assessment || assessment.status !== 'rejected') return [];
  const refs = (assessment.refs || []).join(', ') || 'its declared route';
  return [`geometry/off-declared-route: the line leaves ${refs} for ${assessment.offRouteKm} km `
    + `of ${assessment.distanceKm} km (up to ${assessment.maxOffsetM} m): `
    + 'supported authoritative route guidance is required'];
}

module.exports = {
  OFF_ROUTE_M, MAX_OFF_ROUTE_SHARE, MIN_STRETCH_M,
  routeLinesFor, assessRouteConformance, routeConformanceBlockingReasons,
};
