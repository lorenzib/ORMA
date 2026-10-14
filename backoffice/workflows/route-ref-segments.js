'use strict';

/**
 * Which numbered route a walker is on, at each point of the walk.
 *
 * The composite discovery already measures this. For every point of the path it
 * asks which relations run within the radius, uses that to choose the smallest
 * set covering the walk, and then collapses the answer to a coverage percentage
 * and the index where each relation first appears. The per-point assignment --
 * the thing that says "you are on 101 here and on 105 there" -- is computed and
 * thrown away.
 *
 * It is the answer to two of the four route-guidance claims. The order of the
 * refs along the line is route-number-sequence. The point where one ref gives
 * way to the next is route-number-switches, with a coordinate and a distance
 * from the start.
 *
 * This is not inferring a route from map appearance, which the logistics prompt
 * rightly forbids. The relation membership is the map's own structure: somebody
 * recorded that these ways carry route 101, and reading that back is no more an
 * inference than reading a trail's distance off its line. What it may never do
 * is claim an operator published it as a route description -- see
 * OPERATING_STANDARD, "Read off the map, and said to be read off the map".
 */

// [lat, lng], the order trail.path is stored in and the order
// discover-route-composite measures in. geometry-validator's distanceMeters
// takes [lng, lat] because it works on GeoJSON, and quietly handing it a path
// point would put the Dolomites in the Indian Ocean.
function metresBetween(a, b){
  const radians = Math.PI / 180;
  const dLat = (b[0] - a[0]) * radians;
  const dLng = (b[1] - a[1]) * radians;
  const chord = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * radians) * Math.cos(b[0] * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(chord));
}

// A stretch shorter than this is not a switch, it is the line passing within
// range of a route it never joins. Two relations that share a junction overlap
// for a little however carefully the radius is chosen, and reporting each brush
// as "change to route X, then immediately back" would be worse than saying
// nothing: it reads as instructions and describes noise.
//
// Measured in metres rather than in points. A path's point count is how finely
// somebody drew it -- a hand-traced walk and a GPS track of the same ground
// differ by an order of magnitude -- so a rule counting points would fold a
// real leg on one trail and keep noise on another. 150 m is about the distance
// over which a walker could not tell they had changed path.
const MINIMUM_SEGMENT_METRES = 150;

/** Metres along the path to each index, so a switch can say how far in it is. */
function cumulativeMetres(points){
  const metres = [0];
  for(let index = 1; index < points.length; index += 1){
    metres.push(metres[index - 1] + metresBetween(points[index - 1], points[index]));
  }
  return metres;
}

/**
 * The ref carrying each point.
 *
 * Where several routes cover a point the one already being followed wins. A
 * walker stays on the trail they are on until it stops going their way, and
 * without that rule the ref flips back and forth between two routes sharing a
 * valley for a kilometre -- true of the data, useless as directions.
 */
function refAtEachPoint(pointCount, carriers){
  const refs = new Array(pointCount).fill(null);
  let held = null;
  for(let index = 0; index < pointCount; index += 1){
    const here = carriers(index);
    if(!here.length){ held = null; continue; }
    refs[index] = here.includes(held) ? held : here[0];
    held = refs[index];
  }
  return refs;
}

/** Contiguous runs of one ref, shortest ones folded into their neighbours. */
function runsOf(refs){
  const runs = [];
  for(let index = 0; index < refs.length; index += 1){
    const last = runs[runs.length - 1];
    if(last && last.ref === refs[index]) last.toIndex = index;
    else runs.push({ ref: refs[index], fromIndex: index, toIndex: index });
  }
  return runs;
}

function foldShortRuns(runs, metres = null){
  if(runs.length < 2) return runs;
  // Without distances every run is kept: a caller that cannot measure should
  // not have its runs silently merged on a guess.
  const lengthOf = run => (metres ? metres[run.toIndex] - metres[run.fromIndex] : Infinity);
  const kept = [];
  for(const run of runs){
    const previous = kept[kept.length - 1];
    if(lengthOf(run) >= MINIMUM_SEGMENT_METRES || !previous){ kept.push({ ...run }); continue; }
    // Too short to be a change of route: it belongs to the stretch before it.
    previous.toIndex = run.toIndex;
  }
  // Folding can leave two neighbours carrying the same ref; join them.
  return kept.reduce((merged, run) => {
    const last = merged[merged.length - 1];
    if(last && last.ref === run.ref) last.toIndex = run.toIndex;
    else merged.push(run);
    return merged;
  }, []);
}

/**
 * The numbered route under each stretch of a walk, and where it changes.
 *
 * `points` are the walk's own [lat, lng] path. `carriers(index)` answers which
 * refs run within range of that point, in the order the composite chose them.
 * Both come from the measurement discovery already makes.
 */
function routeRefSegments(points, carriers, options = {}){
  const path = Array.isArray(points) ? points : [];
  if(path.length < 2) return { segments: [], switches: [], sequence: [] };
  const metres = cumulativeMetres(path);
  const refs = refAtEachPoint(path.length, index => {
    const here = carriers(index);
    return Array.isArray(here) ? here.filter(Boolean).map(String) : [];
  });
  const runs = foldShortRuns(runsOf(refs), metres);
  const segments = runs.map(run => ({
    ref: run.ref,
    fromIndex: run.fromIndex,
    toIndex: run.toIndex,
    fromKm: Number((metres[run.fromIndex] / 1000).toFixed(2)),
    toKm: Number((metres[run.toIndex] / 1000).toFixed(2)),
    path: path.slice(run.fromIndex, run.toIndex + 1),
  }));
  // A change between two numbered stretches. A stretch carrying no number is
  // not a switch at either end: "leave 101 and follow nothing" is not an
  // instruction, and the walk continuing on an unnumbered path is ordinary.
  const switches = [];
  for(let index = 1; index < segments.length; index += 1){
    const from = segments[index - 1];
    const to = segments[index];
    if(!from.ref || !to.ref) continue;
    switches.push({
      from: from.ref,
      to: to.ref,
      km: to.fromKm,
      lat: path[to.fromIndex][0],
      lng: path[to.fromIndex][1],
      // Named by the landmark the caller knows about, if it gave one.
      landmark: typeof options.landmarkAt === 'function' ? options.landmarkAt(to.fromKm) : null,
    });
  }
  return {
    segments,
    switches,
    // The numbers in the order they are met, which is the sequence a reader
    // follows. Unnumbered stretches are not part of the sequence, but they are
    // in the segments, so nothing pretends the walk is numbered end to end.
    sequence: segments.map(segment => segment.ref).filter(Boolean),
  };
}

module.exports = { MINIMUM_SEGMENT_METRES, metresBetween, cumulativeMetres, refAtEachPoint, runsOf, foldShortRuns, routeRefSegments };
