'use strict';

// Two rules about pieces a relation's ways fall into, measured on the twenty
// catalogue trails whose geometry is genuinely discontinuous.
//
// Everything else that looked like a gap was not one: the published lines are
// simplified, so a long straight segment appears wherever the walk really runs
// straight. Sentier des Patriotes' six "jumps" each have five to fourteen raw
// OSM nodes lying along them. A piece boundary is the only place a gap can be
// real, because stitching only ever joins ends that are already close.

const { chainLines, lineMeters, DROPPABLE_PIECE_M, DROPPABLE_SHARE_OF_WALK } = require('./promote-osm-trails.js');
const { STITCH_TOLERANCE_M, stitchMembers } = require('./fetch-dog-friendly-routes.js');

// [lng, lat] as the geojson stores them; chainLines returns [lat, lng].
const run = (lng, lat, count, step = 0.0005) =>
  Array.from({ length: count }, (_, i) => [lng + i * step, lat]);

describe('a piece that costs more to reach than it is long', () => {
  // Gsieser Talblickweg: thirteen fragments of 10-150 m scattered up to 10 km
  // down the valley, drawing 8.8 km of line to collect half a kilometre of path.
  test('is dropped, and reported rather than lost silently', () => {
    const walk = run(11.41, 46.36, 60);
    const fragment = run(11.48, 46.41, 2);
    const { path, dropped } = chainLines([walk, fragment]);
    expect(path).toHaveLength(walk.length);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].gap).toBeGreaterThan(dropped[0].meters);
  });

  test('while a spur nearer than its own length is kept', () => {
    const walk = run(11.41, 46.36, 60);
    const spur = run(11.4405, 46.3601, 8);
    const { path, dropped } = chainLines([walk, spur]);
    expect(dropped).toEqual([]);
    expect(path.length).toBe(walk.length + spur.length);
  });

  // The chain starts from the piece with the most POINTS, not the most ground,
  // so a long sparse line can take the lead and leave the real walk as the
  // piece under judgement. Without a ceiling the walk itself would be dropped.
  test('a piece longer than the ceiling is kept however far away it is', () => {
    const walk = run(11.41, 46.36, 60);
    const denserButShorter = run(11.50, 46.36, 400, 0.0001);
    const { dropped } = chainLines([walk, denserButShorter]);
    const walkMeters = lineMeters(walk.map(([lng, lat]) => [lat, lng]));
    expect(walkMeters).toBeGreaterThan(DROPPABLE_PIECE_M);
    expect(dropped).toEqual([]);
  });

  test('the ceiling is above every piece the catalogue actually drops', () => {
    // Largest measured across the twenty discontinuous trails: 638 m.
    expect(DROPPABLE_PIECE_M).toBeGreaterThan(638);
  });

  test('one piece is never dropped, however short', () => {
    const { path, dropped } = chainLines([run(11.41, 46.36, 2)]);
    expect(dropped).toEqual([]);
    expect(path).toHaveLength(2);
  });

  test('no pieces at all is not an error', () => {
    expect(chainLines([])).toEqual({ path: [], dropped: [] });
  });
});

describe('how far apart two member ways may be and still be one walk', () => {
  const member = (coords) => ({ type: 'way', ref: Math.random(),
    geometry: coords.map(([lng, lat]) => ({ lon: lng, lat })) });

  test('the tolerance is wide enough for the breaks in the real data', () => {
    // Gsieser's route is split by gaps of 44 m and 85 m.
    expect(STITCH_TOLERANCE_M).toBeGreaterThan(85);
    // and tighter than the narrowest gap that proved to be a real separation.
    expect(STITCH_TOLERANCE_M).toBeLessThan(134);
  });

  test('two ways 85 m apart are one line', () => {
    // 85 m is about 0.00076 degrees of latitude.
    const a = member(run(11.41, 46.36, 20));
    const b = member(run(11.41 + 19 * 0.0005, 46.36076, 20));
    expect(stitchMembers([a, b])).toHaveLength(1);
  });

  test('two ways a kilometre apart are not', () => {
    const a = member(run(11.41, 46.36, 20));
    const b = member(run(11.45, 46.37, 20));
    expect(stitchMembers([a, b])).toHaveLength(2);
  });
});

// A fragment only goes when there is plainly a walk for it to be litter beside.
describe('dropping must not quietly truncate a route', () => {
  test('two short fragments far apart keep their hole, and the draft', () => {
    const a = run(11.000, 46.50, 2, 0.005);
    const b = run(11.200, 46.50, 2, 0.005);
    const { dropped, path } = chainLines([a, b]);
    expect(dropped).toEqual([]);
    expect(path.length).toBe(4);
  });

  test('the same fragment beside a real walk does go', () => {
    const walk = run(11.41, 46.36, 200, 0.0005);
    const fragment = run(11.200, 46.50, 2, 0.005);
    const { dropped } = chainLines([walk, fragment]);
    expect(dropped).toHaveLength(1);
  });

  test('the share is a fraction of the walk, not of the catalogue', () => {
    expect(DROPPABLE_SHARE_OF_WALK).toBeGreaterThan(0);
    expect(DROPPABLE_SHARE_OF_WALK).toBeLessThan(0.5);
  });
});
