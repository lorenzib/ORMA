'use strict';

// A walk that returns to where it started is already whole.
//
// Twelve of the twenty discontinuous catalogue trails have a biggest piece that
// closes on itself, and whatever else the relation lists is somewhere else:
// Seeweg is an 8.4 km circuit plus a separate 3.3 km stretch of the same named
// path three kilometres away; Colombier is a forest-road loop plus two unnamed
// ways 1.6 km off. Chaining those drew a line across open country and called
// the result one walk.

const { chainLines, lineMeters, LOOP_CLOSE_M } = require('./promote-osm-trails.js');

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

describe('a closed loop is the walk', () => {
  test('a detached piece is set aside, not chained across open country', () => {
    const loop = ring(11.41, 46.36);
    const elsewhere = run(11.50, 46.42, 30);
    const { path, dropped } = chainLines([loop, elsewhere]);
    expect(path).toHaveLength(loop.length);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toBe('detached from a closed loop');
  });

  // Seeweg's extra is 3.3 km reached across a 3.1 km gap, so the gap rule keeps
  // it: the gap is the smaller of the two. Only closure explains why it is
  // still not part of the walk.
  test('it applies to a substantial piece the gap rule would keep', () => {
    const loop = ring(11.41, 46.36);                 // ~4.9 km
    const substantial = run(11.50, 46.42, 25, 0.001); // ~1.9 km, well over the gap ceiling
    const inKm = line => lineMeters(line.map(([lng, lat]) => [lat, lng]));
    expect(inKm(substantial)).toBeGreaterThan(1000);
    expect(inKm(substantial)).toBeLessThan(inKm(loop));
    const { path, dropped } = chainLines([loop, substantial]);
    expect(path).toHaveLength(loop.length);
    expect(dropped[0].reason).toBe('detached from a closed loop');
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
    const { dropped } = chainLines([ring(11.41, 46.36), run(11.50, 46.42, 20), run(11.55, 46.45, 20)]);
    expect(dropped).toHaveLength(2);
  });

  test('the loop keeps its own shape', () => {
    const loop = ring(11.41, 46.36);
    const { path } = chainLines([loop, run(11.50, 46.42, 30)]);
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
    const other = run(11.50, 46.42, 20);
    const { dropped } = chainLines([almost, other]);
    expect(dropped.every(d => d.reason !== 'detached from a closed loop')).toBe(true);
  });

  test('the closing tolerance matches the stitching tolerance', () => {
    expect(LOOP_CLOSE_M).toBe(100);
  });
});
