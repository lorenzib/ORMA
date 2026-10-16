'use strict';

/**
 * A walk that closes exactly on its start keeps its shape.
 *
 * Douglas-Peucker measures every point against the line from the first to the
 * last. On an exactly closed ring that line is a point, every distance from it
 * is zero, and the whole ring came back as two identical coordinates: 0 km,
 * `loop` false, and the walk dropped downstream as "degenerate geometry
 * (0 km)" with nothing to say which OSM edit did it.
 *
 * Found 16 October 2026 while building the targeted geometry refresh, and
 * latent rather than live: all 248 lines in the three committed route files
 * simplify identically before and after this fix, and none of them closes
 * exactly, because the stitcher joins endpoints within 30 m and that leaves a
 * baseline. One relation edited to share a single node at the join would have
 * wiped that walk's geometry silently.
 *
 * The square below is the one the member-role tests use -- a ~330 m ring of
 * plain members at Vandoies/Vintl, where relation 11795251 starts -- so the
 * fixture is the stitcher's own output rather than a hand-typed copy of it.
 */

const { stitchMembers, simplify, pathLengthKm, isClosedLoop } =
  require('./fetch-dog-friendly-routes');

const SQUARE = [
  [{ lat: 46.8167, lon: 11.7230 }, { lat: 46.8167, lon: 11.7270 }],
  [{ lat: 46.8167, lon: 11.7270 }, { lat: 46.8197, lon: 11.7270 }],
  [{ lat: 46.8197, lon: 11.7270 }, { lat: 46.8197, lon: 11.7230 }],
  [{ lat: 46.8197, lon: 11.7230 }, { lat: 46.8167, lon: 11.7230 }],
];

const way = (geometry, i) => ({ type: 'way', ref: 10 + i, geometry });
// What the importer actually feeds simplify(): stitchMembers' line, not a
// literal. The members meet at shared coordinates, so it closes bit-identically.
const stitchedRing = () => stitchMembers(SQUARE.map(way))[0];

describe('an exactly closed ring survives simplification', () => {
  test('the stitched square really is bit-identically closed', () => {
    const ring = stitchedRing();
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  test('its corners are kept', () => {
    const line = simplify(stitchedRing());
    expect(line.length).toBeGreaterThan(2);
    // Every corner of the square, and the closing coordinate.
    expect(line).toEqual(stitchedRing());
  });

  test('it has a non-zero length', () => {
    // The old result was [first, first]: 0 km, and under the 0.3 km floor the
    // importer drops a geometry at, so the walk vanished.
    expect(pathLengthKm([simplify(stitchedRing())])).toBeGreaterThan(0.3);
  });

  test('it is still read as a loop', () => {
    // The importer's own test: one continuous line, >= 1 km, ends meeting.
    const lines = [simplify(stitchedRing())];
    expect(isClosedLoop(lines)).toBe(true);
    expect(pathLengthKm(lines)).toBeGreaterThanOrEqual(1);
  });

  test('a ring closed within a metre is treated the same way', () => {
    // Not bit-identical, but close enough that the baseline is useless.
    const ring = stitchedRing();
    const near = ring.slice(0, -1).concat([[11.72300632, 46.8167]]);
    expect(simplify(near)).toHaveLength(ring.length);
    expect(pathLengthKm([simplify(near)])).toBeGreaterThan(0.3);
  });

  test('an out-and-back of a single segment is not flattened either', () => {
    // Three points, first and last identical: a degenerate baseline too.
    const there = [[11.7230, 46.8167], [11.7270, 46.8167], [11.7230, 46.8167]];
    expect(simplify(there)).toEqual(there);
    expect(pathLengthKm([simplify(there)])).toBeGreaterThan(0);
  });
});

describe('what the ring handling must not change', () => {
  test('a near-closed ring is unaffected, which is every real walk', () => {
    // The stitcher joins within 30 m, so a real loop ends short of its start
    // and Douglas-Peucker has a baseline. 20 m here.
    const ring = stitchedRing();
    const near = ring.slice(0, -1).concat([[11.72326, 46.8167]]);
    expect(simplify(near)).toEqual(near);
    expect(isClosedLoop([simplify(near)])).toBe(true);
  });

  test('a ring is still simplified, not just preserved', () => {
    // A redundant coordinate mid-edge, well inside the 5 m tolerance, goes.
    const ring = stitchedRing();
    const noisy = [ring[0], [11.7250, 46.8167], ...ring.slice(1)];
    expect(simplify(noisy)).toEqual(ring);
  });

  test('an open line still collapses to its endpoints', () => {
    const straight = [[11.7200, 46.8100], [11.7250, 46.8100], [11.7300, 46.8100]];
    expect(simplify(straight)).toEqual([straight[0], straight[2]]);
  });

  test('a line of one repeated coordinate is left degenerate', () => {
    // There is no furthest point to cut at and no walk to save. Returning it
    // as 0 km is right: the importer drops it and says so.
    const point = [11.7230, 46.8167];
    expect(pathLengthKm([simplify([point, point, point, point, point])])).toBe(0);
  });

  test('a line of two points or fewer is returned untouched', () => {
    expect(simplify([])).toEqual([]);
    expect(simplify([[11.7230, 46.8167]])).toEqual([[11.7230, 46.8167]]);
  });
});
