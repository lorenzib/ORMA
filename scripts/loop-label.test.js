'use strict';

// "Does this walk come back to where it started?" is a question about the
// walk. It was being answered about the relation: anything listing more than
// one piece was refused outright, so a circuit that closes to the metre was
// recorded as not a loop because the relation also carried a stray fragment
// somewhere else in the valley.
//
// Fourteen catalogue walks are labelled that way today -- seven in each region
// -- Roda dles Viles among them, whose two ends meet at 0 m.

const { isClosedLoop, pathLengthKm } = require('./fetch-dog-friendly-routes.js');

// [lng, lat], as the geojson stores it.
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

describe('a walk that comes back to its start', () => {
  test('is a loop even when the relation lists a stray fragment', () => {
    const walk = ring(11.41, 46.36);
    const stray = run(11.60, 46.50, 3);
    expect(isClosedLoop([walk, stray])).toBe(true);
  });

  test('and still is when it arrives as the only piece', () => {
    expect(isClosedLoop([ring(11.41, 46.36)])).toBe(true);
  });

  test('however many strays there are', () => {
    const walk = ring(11.41, 46.36);
    expect(isClosedLoop([walk, run(11.6, 46.5, 3), run(11.7, 46.6, 3), run(11.8, 46.7, 3)])).toBe(true);
  });
});

describe('a walk that does not', () => {
  test('is not a loop, stray fragment or no', () => {
    const open = run(11.41, 46.36, 40, 0.002);
    expect(isClosedLoop([open])).toBe(false);
    expect(isClosedLoop([open, run(11.60, 46.50, 3)])).toBe(false);
  });

  // The stray must not be able to answer for the walk.
  test('a closed fragment beside an open walk does not make it one', () => {
    const openWalk = run(11.41, 46.36, 200, 0.001);
    const tinyRing = ring(11.60, 46.50, 20, 0.0003);
    expect(pathLengthKm([openWalk])).toBeGreaterThan(pathLengthKm([tinyRing]));
    expect(isClosedLoop([tinyRing, openWalk])).toBe(false);
  });

  test('the walk is the piece covering the most ground, not the most points', () => {
    const openWalk = run(11.41, 46.36, 50, 0.004);
    const denseRing = ring(11.60, 46.50, 400, 0.0004);
    expect(denseRing.length).toBeGreaterThan(openWalk.length);
    expect(pathLengthKm([openWalk])).toBeGreaterThan(pathLengthKm([denseRing]));
    expect(isClosedLoop([denseRing, openWalk])).toBe(false);
  });
});

describe('nothing to judge', () => {
  test('no pieces, empty pieces, or a single point are not loops', () => {
    expect(isClosedLoop([])).toBe(false);
    expect(isClosedLoop([[]])).toBe(false);
    expect(isClosedLoop([[[11.41, 46.36]]])).toBe(false);
    expect(isClosedLoop(null)).toBe(false);
  });
});
