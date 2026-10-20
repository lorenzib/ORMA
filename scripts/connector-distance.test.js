'use strict';

// A chained line is longer than the walk it describes.
//
// Where a relation's ways do not meet, chainLines draws a straight connector so
// the route reads as one line. There is no path under that line -- it is a hole
// in the OSM mapping -- so counting it as distance publishes a walk as longer
// than it is. Measured against the relations' own member ways on 19 Oct 2026,
// Seeweg published 14.8 km against 11.75 km of ways, and Albannette petite
// boucle would have published 6.2 km against 5.01 km.
//
// Only five of the hundred and twenty-seven promoted trails end up with a
// connector at all, and two of those are these.

const { chainLines, toPath, lineMeters, recomputeCumKm,
  reverseConnectors, haversineMeters } = require('./promote-osm-trails.js');

// [lng, lat] as the geojson stores them; chainLines returns [lat, lng].
const run = (lng, lat, count, step = 0.0005) =>
  Array.from({ length: count }, (_, i) => [lng + i * step, lat]);
const groundMeters = (line) => lineMeters(line.map(([lng, lat]) => [lat, lng]));
const walkedKm = (pts, connectors) => {
  const cumKm = recomputeCumKm(pts, connectors);
  return cumKm[cumKm.length - 1];
};

describe('a connector is reported, not just drawn', () => {
  test('each join says where it landed and what it cost', () => {
    const west = run(11.40, 46.36, 20);
    const east = run(11.42, 46.36, 20);
    const { path, connectors } = chainLines([west, east]);
    expect(connectors).toHaveLength(1);
    // The segment ending at `index` is the connector, so the two points it
    // sits between are the end of one piece and the start of the next.
    const { index, meters } = connectors[0];
    expect(index).toBe(west.length);
    expect(haversineMeters(path[index - 1][0], path[index - 1][1],
      path[index][0], path[index][1])).toBeCloseTo(meters, 6);
  });

  test('a walk whose pieces already meet has none', () => {
    const whole = run(11.40, 46.36, 40);
    expect(toPath({ type: 'LineString', coordinates: whole }).connectors).toEqual([]);
  });

  test('and a loop taken whole has none, because nothing was drawn across it', () => {
    // The closed-loop shortcut returns the ring itself and sets the debris
    // aside, so there is no join to report.
    const ring = [];
    for (let i = 0; i <= 40; i += 1) {
      const a = (i / 40) * 2 * Math.PI;
      ring.push([11.41 + 0.01 * Math.cos(a), 46.36 + 0.007 * Math.sin(a)]);
    }
    ring[ring.length - 1] = ring[0].slice();
    const { connectors, dropped } = chainLines([ring, run(11.50, 46.42, 3, 0.001)]);
    expect(dropped).toHaveLength(1);
    expect(connectors).toEqual([]);
  });
});

describe('the length a trail publishes is the ground its ways cover', () => {
  test('three pieces with holes between them measure as the three pieces', () => {
    const pieces = [run(11.40, 46.36, 20), run(11.42, 46.36, 20), run(11.44, 46.36, 20)];
    const { path, connectors } = chainLines(pieces);
    const ways = pieces.reduce((total, piece) => total + groundMeters(piece), 0);
    // The drawn line is a kilometre and a half longer than the walk.
    expect(lineMeters(path)).toBeGreaterThan(ways + 1500);
    expect(walkedKm(path, connectors) * 1000).toBeCloseTo(ways, 6);
  });

  test('the drawn line is still the geometry, so a visible hole still shows', () => {
    // Excluding a connector from the distance must not quietly close the gap:
    // the published path keeps it, which is what the publication gate judges.
    const { path, connectors } = chainLines([run(11.40, 46.36, 20), run(11.42, 46.36, 20)]);
    expect(path).toHaveLength(40);
    expect(connectors[0].meters).toBeGreaterThan(700);
  });

  test('the km axis ends at the distance the walk covers', () => {
    // One axis serves the published distance, the elevation profile, and where
    // a fountain is said to be, so the profile's last km is the published
    // distance by construction rather than by coincidence.
    const pieces = [run(11.40, 46.36, 20), run(11.42, 46.36, 20)];
    const { pts, cumKm, connectors } = toPath({ type: 'MultiLineString', coordinates: pieces });
    const ways = pieces.reduce((total, piece) => total + groundMeters(piece), 0);
    expect(cumKm).toHaveLength(pts.length);
    expect(cumKm[cumKm.length - 1] * 1000).toBeCloseTo(ways, 6);
    // Flat across the connector, and rising again after it.
    expect(cumKm[connectors[0].index]).toBe(cumKm[connectors[0].index - 1]);
    expect(cumKm[connectors[0].index + 1]).toBeGreaterThan(cumKm[connectors[0].index]);
  });

  test('the file order is measured the same way when chaining cannot better it', () => {
    // The as-listed fallback lays the pieces nose to tail, so it has the same
    // straight lines between them and they are not distance either.
    const pieces = [run(11.40, 46.36, 20), run(11.42, 46.36, 20)];
    const { cumKm } = toPath({ type: 'MultiLineString', coordinates: pieces });
    const ways = pieces.reduce((total, piece) => total + groundMeters(piece), 0);
    expect(cumKm[cumKm.length - 1] * 1000).toBeCloseTo(ways, 6);
  });
});

describe('the bookkeeping survives the path being rearranged', () => {
  test('turning the walk round takes its connectors with it', () => {
    // Loops get reversed for the gentler climb after the connectors are found.
    const { path, connectors } = chainLines([run(11.40, 46.36, 20), run(11.42, 46.36, 20)]);
    const reversed = path.slice().reverse();
    const moved = reverseConnectors(connectors, reversed.length);
    expect(walkedKm(reversed, moved)).toBeCloseTo(walkedKm(path, connectors), 9);
  });

  test('a piece added at the front moves the joins already recorded', () => {
    // Chaining prepends when the nearest free end is the head of the chain,
    // which slides every point already in it further along.
    const chain = run(11.50, 46.36, 40);
    const before = run(11.4790, 46.36, 10);
    const { path, connectors } = chainLines([chain, before]);
    expect(walkedKm(path, connectors) * 1000)
      .toBeCloseTo(groundMeters(chain) + groundMeters(before), 6);
  });

  test('an index that is not the segment it claims to be is an error', () => {
    // A wrong index would subtract the wrong stretch and publish a wrong
    // length with nothing to show it had happened.
    const { path, connectors } = chainLines([run(11.40, 46.36, 20), run(11.42, 46.36, 20)]);
    expect(() => recomputeCumKm(path, [{ index: 5, meters: connectors[0].meters }]))
      .toThrow(/measures .* but was recorded as/);
    expect(() => recomputeCumKm(path, [{ index: path.length, meters: 10 }]))
      .toThrow(/not a segment/);
  });
});
