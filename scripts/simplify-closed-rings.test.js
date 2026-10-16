'use strict';

// Douglas-Peucker measures every point against the line from the first to the
// last. On a closed ring those are the same point, so that baseline has no
// length, every distance divides by an epsilon and comes out at zero, and the
// whole loop collapses to its two identical endpoints. Phase 2 then reads the
// 0 km line as a degenerate trail and drops it.
//
// Measured on 2026-10-16: 108 of 177 kept relations dropped this way in a
// --loops-only run, and the Dolomites catalogue came back 23 routes smaller.
// It also explains why 90 of 109 published trails have jumps in them -- a walk
// whose geometry closed cleanly was deleted, so the ones that survived to be
// published are disproportionately the ones that failed to meet their start.

const { simplify, isClosedRing } = require('./fetch-dog-friendly-routes.js');

const R = 6371000, rad = Math.PI / 180;
const metres = (a, b) => {
  const x = (b[1] - a[1]) * rad, y = (b[0] - a[0]) * rad;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const km = (p) => { let m = 0; for (let i = 1; i < p.length; i += 1) m += metres(p[i - 1], p[i]); return m / 1000; };

const circle = (n = 120) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([11.41 + 0.012 * Math.cos(a), 46.36 + 0.009 * Math.sin(a)]);
  }
  pts[pts.length - 1] = pts[0].slice();
  return pts;
};

describe('a loop survives being simplified', () => {
  test('a closed ring keeps its length instead of collapsing to 0 km', () => {
    const loop = circle();
    expect(km(loop)).toBeGreaterThan(5);
    const out = simplify(loop);
    expect(out.length).toBeGreaterThan(2);
    expect(km(out)).toBeCloseTo(km(loop), 1);
  });

  // The exact failure: two identical endpoints, which reads as 0 km and is
  // then dropped by the degenerate check.
  test('it does not come back as its two endpoints', () => {
    const out = simplify(circle());
    expect(out).not.toHaveLength(2);
    expect(km(out)).toBeGreaterThan(0.3);
  });

  test('and it still closes afterwards', () => {
    const out = simplify(circle());
    expect(metres(out[0], out[out.length - 1])).toBeLessThan(5);
  });

  test('simplifying still removes points', () => {
    const loop = circle();
    expect(simplify(loop).length).toBeLessThan(loop.length);
  });
});

describe('open lines are untouched by the change', () => {
  test('an open line keeps its length and is still reduced', () => {
    const open = circle().slice(0, -3);
    const out = simplify(open);
    expect(km(out)).toBeCloseTo(km(open), 1);
    expect(out.length).toBeLessThan(open.length);
    expect(out.length).toBeGreaterThan(2);
  });

  test('a straight line still reduces to its ends', () => {
    const straight = Array.from({ length: 40 }, (_, i) => [11.41 + i * 0.001, 46.36]);
    expect(simplify(straight)).toHaveLength(2);
  });

  test('two points are returned as they are', () => {
    expect(simplify([[11.41, 46.36], [11.42, 46.37]])).toHaveLength(2);
  });
});

describe('what counts as a closed ring', () => {
  test('first and last at the same place', () => {
    expect(isClosedRing(circle())).toBe(true);
  });

  test('an open line is not one', () => {
    expect(isClosedRing(circle().slice(0, -3))).toBe(false);
  });

  test('too few points to be a ring', () => {
    expect(isClosedRing([[11.41, 46.36], [11.41, 46.36]])).toBe(false);
  });
});
