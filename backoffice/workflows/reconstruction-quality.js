'use strict';

/**
 * Whether the line the audit just rebuilt is good enough to judge the trail by.
 *
 * The cartographer re-fetches a trail's OSM relation and rebuilds its line, so
 * that the geometry is checked against the source rather than against itself.
 * When the rebuild succeeds that is exactly right. When it does not, the trail
 * is faulted for the audit's own failure.
 *
 * Measured 13 October, on three trails rejected for disconnected-components and
 * official-distance-conflict:
 *
 *   trail                        official   ORMA's line   rebuilt
 *   Circuit Béatrice de Savoie    4.9 km      4.88 km     4.23 km
 *   Les Marais d'Albens           6.6 km      6.61 km     5.35 km
 *   1 - Dörferrundweg (Vintl)    13.2 km     13.15 km     9.66 km
 *
 * ORMA's own line matches the published distance to within half a percent in
 * all three. The rebuild is short by 14 to 27 per cent, because the relation
 * could not be stitched whole -- which is what disconnected-components says.
 * The route is not wrong. The rebuild is incomplete, and every metric taken
 * from it is then wrong too: the line is short, so the distance conflicts, and
 * if it is a loop its ends no longer meet.
 *
 * All 23 rejected trails were rejected on geometry, and this is why.
 *
 * So a rebuild that loses a material share of a line ORMA already holds, where
 * that held line agrees with the distance the authority publishes, is reported
 * as a rebuild that failed rather than a trail that is wrong.
 */

// How much of the held line a rebuild may lose before it is not the same route.
// Below this the rebuild is a usable reading of it; at or above, it is missing
// a piece, and the smallest real case measured was 14 per cent.
const LOST_SHARE = 0.1;
// How far the held line may sit from the published distance and still be taken
// as corroborating it. The same tolerance the audit applies to the rebuild, so
// a held line is not trusted on easier terms than the one it stands in for.
const HELD_LINE_TOLERANCE = 0.1;

function metres(path){
  if(!Array.isArray(path) || path.length < 2) return null;
  const R = 6371000, rad = degrees => degrees * Math.PI / 180;
  let total = 0;
  for(let index = 1; index < path.length; index += 1){
    const [aLat, aLng] = path[index - 1], [bLat, bLng] = path[index];
    const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}

/**
 * Whether the rebuild lost a material part of the route.
 *
 * Both conditions are required. A short rebuild alone proves nothing -- ORMA's
 * line could be the wrong one. It is the held line agreeing with the published
 * distance that says which of the two is missing something.
 */
function rebuildLostTheRoute({ rebuiltKm, heldPath, officialKm }){
  const heldM = metres(heldPath);
  if(!Number.isFinite(rebuiltKm) || !Number.isFinite(officialKm) || officialKm <= 0 || heldM === null){
    return { incomplete: false, reason: 'not enough to compare' };
  }
  const heldKm = heldM / 1000;
  const heldAgrees = Math.abs(heldKm - officialKm) / officialKm <= HELD_LINE_TOLERANCE;
  const lostShare = (heldKm - rebuiltKm) / heldKm;
  const incomplete = heldAgrees && lostShare >= LOST_SHARE;
  return {
    incomplete,
    heldKm: Math.round(heldKm * 100) / 100,
    rebuiltKm: Math.round(rebuiltKm * 100) / 100,
    officialKm,
    heldAgreesWithOfficial: heldAgrees,
    lostSharePercent: Math.round(lostShare * 1000) / 10,
    reason: incomplete
      ? 'the rebuilt line is materially shorter than the line ORMA holds, which matches the published distance'
      : heldAgrees ? 'the rebuild kept the route' : 'the held line does not corroborate the published distance either',
  };
}

// What the audit says when its own rebuild came up short. Not in the unwaivable
// set: it describes the audit, and a trail cannot answer for it.
const INCOMPLETE_REBUILD_NOTE = 'relation-rebuild-incomplete';

/**
 * The blockers that belong to the rebuild rather than to the trail.
 *
 * Connectivity and length are the two the rebuild decides, and both come out
 * wrong when it drops a member. Everything else -- the relation not being a
 * hiking route, its identity being contradicted, geometry that is absent
 * altogether -- is a fact about the source and still stands.
 */
const REBUILD_DERIVED = Object.freeze(['disconnected-components', 'official-distance-conflict',
  'not-closed-loop', 'implausibly-short', 'missing-member-geometry']);

function withoutRebuildFaults(blockers){
  return (blockers || []).filter(blocker => !REBUILD_DERIVED.includes(String(blocker)));
}

module.exports = { LOST_SHARE, HELD_LINE_TOLERANCE, INCOMPLETE_REBUILD_NOTE, REBUILD_DERIVED,
  metres, rebuildLostTheRoute, withoutRebuildFaults };
