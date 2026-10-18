'use strict';

// A walk that returns to where it started is already whole -- but only when
// what that leaves out is debris.
//
// Twelve scouted walks have a biggest piece that closes on itself. Nine of them
// leave out 5% of the loop or less: a kerb, a spur into a car park, a doubled
// node. Three leave out a fifth to a half of it, and measured against the
// relations' own member ways in OSM those three were being shortened, not
// tidied -- Albannette petite boucle is 5.01 km and came out 2.98 km, Colombier
// is 10.16 km and came out 6.76 km, Seeweg is 11.75 km and came out 8.39 km.
//
// So these cases are about the line: where what is left out is debris the loop
// is the walk, and where it is the walk the pieces are chained as normal and
// the gap they leave is judged by the publication rules like any other.

const { chainLines, lineMeters, LOOP_CLOSE_M,
  DROPPABLE_PIECE_M, DROPPABLE_SHARE_OF_WALK } = require('./promote-osm-trails.js');

// A closed ring of `n` points, roughly `radius` degrees across. [lng, lat].
const ring = (lng, lat, n = 40, radius = 0.01) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([lng + radius * Math.cos(a), lat + radius * 0.7 * Math.sin(a)]);
  }
  pts[pts.length - 1] = pts[0].slice();
  return pts;
};
const run = (lng, lat, n, step = 0.001) =>
  Array.from({ length: n }, (_, i) => [lng + i * step, lat]);
// The ring above is about 4.9 km round, so a tenth of it is roughly 490 m and
// one step of `run` is roughly 77 m. `debris` stays well inside that; `limb`
// is a piece of the walk's own size.
const debris = (lng, lat) => run(lng, lat, 3);
const limb = (lng, lat) => run(lng, lat, 25);

describe('a closed loop is the walk', () => {
  test('a detached piece is set aside, not chained across open country', () => {
    const loop = ring(11.41, 46.36);
    const elsewhere = debris(11.50, 46.42);
    const { path, dropped } = chainLines([loop, elsewhere]);
    expect(path).toHaveLength(loop.length);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toBe('detached from a closed loop');
  });

  // This is the case the rule got wrong. A piece of the walk's own size is not
  // debris however cleanly the loop closes, and setting it aside published
  // Seeweg at 8.39 km of a route whose ways measure 11.75 km.
  test('a piece the size of the walk is kept, however well the loop closes', () => {
    const loop = ring(11.41, 46.36);          // ~4.9 km
    const substantial = limb(11.50, 46.42);   // ~1.9 km
    const inMeters = line => lineMeters(line.map(([lng, lat]) => [lat, lng]));
    expect(inMeters(substantial)).toBeGreaterThan(1000);
    expect(inMeters(substantial)).toBeLessThan(inMeters(loop));
    const { dropped } = chainLines([loop, substantial]);
    expect(dropped.every(d => d.reason !== 'detached from a closed loop')).toBe(true);
  });

  test('a piece over the droppable length is kept even where it is a sliver of the loop', () => {
    const big = ring(11.41, 46.36, 40, 0.1);  // ~49 km round
    const overLength = run(12.20, 46.80, 20); // ~1.5 km: 3% of the loop, but not debris
    const inMeters = line => lineMeters(line.map(([lng, lat]) => [lat, lng]));
    expect(inMeters(overLength)).toBeGreaterThan(DROPPABLE_PIECE_M);
    expect(inMeters(overLength)).toBeLessThan(inMeters(big) * DROPPABLE_SHARE_OF_WALK);
    const { dropped } = chainLines([big, overLength]);
    expect(dropped.every(d => d.reason !== 'detached from a closed loop')).toBe(true);
  });

  test('small pieces are kept once they add up past a tenth of the loop', () => {
    const loop = ring(11.41, 46.36);
    // Each one on its own is debris; together they are a sixth of the walk.
    const many = [debris(11.50, 46.42), debris(11.52, 46.43), debris(11.54, 46.44),
      debris(11.56, 46.45), debris(11.58, 46.46)];
    const { dropped } = chainLines([loop, ...many]);
    expect(dropped.every(d => d.reason !== 'detached from a closed loop')).toBe(true);
  });

  // And it declines when the loop is not the bigger half: which of the two is
  // the walk is then a real question, so the ordinary chaining rules apply.
  test('a loop smaller than the piece beside it is not assumed to be the walk', () => {
    const loop = ring(11.41, 46.36);
    const bigger = run(11.50, 46.42, 400, 0.001);
    const { dropped } = chainLines([loop, bigger]);
    expect(dropped.every(d => d.reason !== 'detached from a closed loop')).toBe(true);
  });

  test('every detached piece goes, not just the nearest', () => {
    const { dropped } = chainLines([ring(11.41, 46.36), debris(11.50, 46.42), debris(11.55, 46.45)]);
    expect(dropped).toHaveLength(2);
    expect(dropped.every(d => d.reason === 'detached from a closed loop')).toBe(true);
  });

  test('the loop keeps its own shape', () => {
    const loop = ring(11.41, 46.36);
    const { path } = chainLines([loop, debris(11.50, 46.42)]);
    expect(lineMeters(path)).toBeCloseTo(lineMeters(loop.map(([lng, lat]) => [lat, lng])), 0);
  });
});

describe('what the rule must not do', () => {
  // The route is point-to-point; its pieces are the walk and belong together.
  test('an open route still has its pieces chained', () => {
    const west = run(11.40, 46.36, 20);
    const east = run(11.43, 46.36, 20);
    const { path, dropped } = chainLines([west, east]);
    expect(dropped).toEqual([]);
    expect(path.length).toBe(west.length + east.length);
  });

  test('a single piece is returned untouched, closed or not', () => {
    const loop = ring(11.41, 46.36);
    const { path, dropped } = chainLines([loop]);
    expect(dropped).toEqual([]);
    expect(path).toHaveLength(loop.length);
  });

  // Judged on ground covered, so a dense short line cannot pose as the walk.
  test('the biggest piece is the one covering the most ground', () => {
    const loop = ring(11.41, 46.36);
    const denseButSmall = ring(11.50, 46.42, 300, 0.0005);
    const { path } = chainLines([denseButSmall, loop]);
    expect(lineMeters(path)).toBeCloseTo(lineMeters(loop.map(([lng, lat]) => [lat, lng])), 0);
  });

  test('a near-miss is not a closed loop', () => {
    // Ends left well beyond the closing tolerance.
    const almost = ring(11.41, 46.36).slice(0, -6);
    const other = debris(11.50, 46.42);
    const { dropped } = chainLines([almost, other]);
    expect(dropped.every(d => d.reason !== 'detached from a closed loop')).toBe(true);
  });

  test('the closing tolerance matches the stitching tolerance', () => {
    expect(LOOP_CLOSE_M).toBe(100);
  });

  // The same two numbers the chaining rule drops a piece by, so a piece cannot
  // be too big to drop while chaining and small enough to drop beside a loop.
  test('what counts as debris is what chaining would already drop', () => {
    expect(DROPPABLE_PIECE_M).toBe(1000);
    expect(DROPPABLE_SHARE_OF_WALK).toBe(0.1);
  });
});
