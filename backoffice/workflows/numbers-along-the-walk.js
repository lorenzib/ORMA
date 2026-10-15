'use strict';

/**
 * The waymarked numbers a walker meets on a walk that carries none of its own.
 *
 * ORMA refused seven trails on 15 October 2026 for want of route guidance,
 * having concluded they had no route number. They had none *of their own* --
 * `ref` on the relation the line is built from -- which is a different thing.
 * A tag search for numbered walking routes sharing any way with the walk found
 * candidates on four of the six that could be read: 9 and 56 on La Croix des
 * Salles, 23, 25 and 22 on Le Marais de Pré Lombard, 2, 44, 54 and 56 on Le
 * Mont d'Arbois, GR 96 on Itinéraire de découverte historique.
 *
 * Sharing a way is not carrying the walk, which is why this measures rather
 * than reads tags: a route qualifies only where it runs within the corridor
 * along at least 150 metres. Le Mont d'Arbois has nothing qualifying under that
 * test despite four numbers appearing beside it, and that is the right answer
 * -- a route brushing the walk for twenty metres is not something to follow.
 *
 * The measurement already existed. `discoverRouteComposite` works out which of
 * several routes carries each stretch of a walk, and `routeRefSegments` turns
 * that into an order and the places one number gives way to the next. It was
 * only ever pointed at a composite -- a walk assembled from several relations
 * -- so a single unnumbered relation never got measured, though the code to do
 * it was sitting beside it.
 *
 * This is that measurement pointed at the case nobody pointed it at. Same
 * functions, no new arithmetic, and no model call.
 */

const { relationsFromPayload, coveredIndices, metresBetween } = require('./discover-route-composite');
const { routeRefSegments } = require('./route-ref-segments');

// The same corridor the composite search uses, so "along the walk" means one
// thing in ORMA and not two.
const ON_ROUTE_METRES = 25;

/**
 * Walking routes only.
 *
 * Le Mont d'Arbois has `VAE 9`, `VAE 11` and `VAE 69` running along it -- VAE
 * is *vélo à assistance électrique*, an e-bike route. Sending a walker after a
 * cycle waymark is sending them the wrong way, and in the worst case onto a
 * road: the member ways of these walks carry `D 8`, `D 55` and `D 309a`, which
 * are French départementale *roads*. Nothing here reads a way's own ref for
 * that reason -- only the ref of a route relation that is a footpath.
 */
const WALKING_ROUTES = Object.freeze(['hiking', 'foot', 'walking']);

function isWalkingRoute(tags){
  return tags?.type === 'route' && WALKING_ROUTES.includes(tags?.route);
}

/** A numbered walking route, or null where it is neither. */
function numberedWalkingRoute(relation){
  if(!isWalkingRoute(relation?.tags)) return null;
  const ref = String(relation.tags.ref || '').trim();
  return ref ? { ...relation, ref } : null;
}

/**
 * Which numbered walking routes carry each stretch of this walk.
 *
 * Ordered by how much of the walk each explains, so where two cover the same
 * step the one a walker is on for longer is offered first -- the same ordering
 * the composite search arrives at, and the hysteresis in `routeRefSegments`
 * then keeps the walker on a number while it still carries them rather than
 * flipping at every overlap.
 *
 * `routeRefSegments` ignores a run shorter than 150 m, so a route that merely
 * crosses the walk is never reported as a stretch of it.
 */
function numbersAlongTheWalk(path, payload, options = {}){
  const walked = Array.isArray(path) ? path : [];
  if(walked.length < 2) return null;
  const radiusMetres = options.radiusMetres || ON_ROUTE_METRES;

  const numbered = relationsFromPayload(payload)
    .map(numberedWalkingRoute)
    .filter(Boolean);
  if(!numbered.length) return null;

  const coverage = new Map(numbered.map(relation =>
    [relation.id, coveredIndices(walked, relation, radiusMetres)]));
  const explains = relation => coverage.get(relation.id)?.size || 0;
  const ordered = [...numbered].sort((left, right) => explains(right) - explains(left));

  const carriers = index => ordered
    .filter(relation => coverage.get(relation.id)?.has(index))
    .map(relation => relation.ref);

  const guidance = routeRefSegments(walked, carriers);
  // Segments, not numbers, is the wrong test. A route that merely crosses the
  // walk is folded away by `foldShortRuns`, which leaves one segment carrying
  // `ref: null` -- a stretch with no number on it. Reporting that as an answer
  // would hand a walker an empty list of waymarks to follow.
  if(!guidance.sequence.filter(Boolean).length) return null;
  return {
    // Running along somebody else's numbered route is not being one, and a
    // reader is told which. "Follow 23" of a walk that merely shares a stretch
    // with 23 would send them down it at the point the walk leaves it.
    alongOtherRoutes: true,
    sequence: guidance.sequence,
    switches: guidance.switches,
    // Without the point lists, which would repeat the whole walk once per
    // stretch in an artifact that already has a byte ceiling.
    segments: guidance.segments.map(({ path: _points, ...segment }) => segment),
    // The routes the numbers came from, so the claim can cite them.
    relations: ordered
      .filter(relation => guidance.sequence.includes(relation.ref))
      .map(relation => ({ externalRelationId: `relation/${relation.id}`,
        ref: relation.ref, name: relation.tags.name || null })),
  };
}

module.exports = { ON_ROUTE_METRES, WALKING_ROUTES, isWalkingRoute,
  numberedWalkingRoute, numbersAlongTheWalk };
