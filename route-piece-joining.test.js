'use strict';

// A relation's ways arrive in whatever order the relation lists them, pointing
// whichever way they were drawn. Concatenating them as they come put a jump at
// every join the size of the distance between two unrelated ends, and twenty-one
// catalogue trails were held back as drafts for "geometry jump" because of it.
//
// Measured against the two route files: chaining narrows the widest gap on 38
// routes, widens it on none, and brings three back under the 1 km publication
// limit. The rest have gaps of 1-6 km that no ordering closes -- those are
// holes in OpenStreetMap, and the draft is the correct outcome for them.

const { chainLines, toPath, widestGapMeters } = require('./scripts/promote-osm-trails.js');

// Three straight pieces of one route, each 1 km apart end to end, given to the
// builder shuffled and with the middle one drawn backwards -- the shape a
// relation routinely has.
// Points within a piece sit ~380 m apart, so a mis-joined end (kilometres)
// is plainly distinguishable from an ordinary step along the route.
const WEST = [[11.000, 46.50], [11.005, 46.50], [11.010, 46.50]];
const MIDDLE = [[11.020, 46.50], [11.015, 46.50], [11.010, 46.50]];
const EAST = [[11.020, 46.50], [11.025, 46.50], [11.030, 46.50]];
const STEP_METRES = 400;

const multi = coordinates => ({ type: 'MultiLineString', coordinates });

describe('putting a route\'s pieces in walking order', () => {
  test('shuffled and reversed pieces become one continuous line', () => {
    const asListed = multi([EAST, WEST, MIDDLE]);
    const naive = [];
    for (const line of asListed.coordinates) for (const [lng, lat] of line) naive.push([lat, lng]);

    // As listed, the joins are the width of the whole route.
    expect(widestGapMeters(naive)).toBeGreaterThan(1000);
    // Chained, no join is wider than an ordinary step along the route.
    expect(widestGapMeters(toPath(asListed).pts)).toBeLessThan(STEP_METRES);
  });

  test('it reorders and reorients, never adds or drops a point', () => {
    const asListed = multi([EAST, WEST, MIDDLE]);
    const pts = toPath(asListed).pts;
    expect(pts).toHaveLength(WEST.length + MIDDLE.length + EAST.length);
    // Every source coordinate is still present.
    const seen = new Set(pts.map(([lat, lng]) => `${lat},${lng}`));
    for (const line of asListed.coordinates) {
      for (const [lng, lat] of line) expect(seen.has(`${lat},${lng}`)).toBe(true);
    }
  });

  test('a route already in order is left exactly as it is', () => {
    const inOrder = multi([WEST, [[11.010, 46.50], [11.015, 46.50], [11.020, 46.50]], EAST]);
    const naive = [];
    for (const line of inOrder.coordinates) for (const [lng, lat] of line) naive.push([lat, lng]);
    expect(toPath(inOrder).pts).toEqual(naive);
  });

  test('a single-piece route is untouched', () => {
    const single = { type: 'LineString', coordinates: [[11.000, 46.50], [11.005, 46.50]] };
    expect(toPath(single).pts).toEqual([[46.50, 11.000], [46.50, 11.005]]);
    expect(toPath(single).segments).toBe(1);
  });

  test('chaining can narrow a route\'s widest gap and can never widen it', () => {
    // The property that makes this safe to run over the whole catalogue rather
    // than only the trails known to be broken. Greedy chaining is a heuristic
    // and on one real relation it picked an order fractionally worse than the
    // file's own, so the two are compared and the better kept.
    const asListed = multi([EAST, WEST, MIDDLE]);
    const naive = [];
    for (const line of asListed.coordinates) for (const [lng, lat] of line) naive.push([lat, lng]);
    expect(widestGapMeters(toPath(asListed).pts)).toBeLessThanOrEqual(widestGapMeters(naive));
  });

  test('a genuine hole still reads as a gap of its real size', () => {
    // The 1 km publication limit exists to catch a line that teleports. This
    // must narrow a gap that was an ordering artifact and leave one that is
    // missing data, or it would publish a route with a hole in it.
    //
    // Dropping unreachable fragments must not quietly defeat that. These two
    // pieces are 380 m each and fifteen kilometres apart: neither is litter
    // beside a walk, they are the whole relation, so both are kept and the
    // hole stays visible. See DROPPABLE_SHARE_OF_WALK.
    const far = multi([[[11.000, 46.50], [11.005, 46.50]], [[11.200, 46.50], [11.205, 46.50]]]);
    expect(chainLines(far.coordinates).dropped).toEqual([]);
    expect(widestGapMeters(toPath(far).pts)).toBeGreaterThan(10000);
  });

  test('segments still counts the pieces the relation really has', () => {
    // Nothing published is derived from this any more -- the gap count and the
    // access-point gate both ask the drawn line how many holes it has. It is
    // the promoter's log that reports how many pieces a relation arrived in,
    // and that is a fact about the source, so reordering must not make a
    // three-piece relation look like one continuous way.
    expect(toPath(multi([EAST, WEST, MIDDLE])).segments).toBe(3);
  });

  test('chainLines copes with an empty piece rather than throwing', () => {
    // It reports what it refused alongside the path, so a dropped fragment is
    // visible to the caller rather than gone.
    expect(chainLines([[], [[11.000, 46.50], [11.005, 46.50]]]))
      .toEqual({ path: [[46.50, 11.000], [46.50, 11.005]], dropped: [], connectors: [] });
    expect(chainLines([])).toEqual({ path: [], dropped: [], connectors: [] });
  });
});
