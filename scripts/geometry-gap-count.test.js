'use strict';

/**
 * A gap is a hole in the line, not a piece in the relation.
 *
 * `osmGeometryGaps` was the number of pieces the source geometry arrived in,
 * less one. That is a different question from the one the field's name asks,
 * because `chainLines` leaves out the fragments that cost more to reach than
 * they are long, and can take a closed loop whole and set the rest aside. The
 * line that ends up published therefore has far fewer holes than the relation
 * had pieces, or none at all.
 *
 * Measured on the 127 promoted trails on 19 Oct 2026: twelve declared a gap
 * and five had one. Gsieser Talblickweg declared fourteen -- its relation
 * lists 160 ways falling into eighteen groups, the walk and then thirteen
 * fragments of ten to a hundred and fifty metres scattered up to ten
 * kilometres down the valley -- and its published line has a single hole.
 *
 * The same question gated the verified start point, which is why this is worth
 * more than a tidier number. Anchoring rotates a loop to begin at a mapped car
 * park or bus stop, or turns a line round to start from the accessible end,
 * and neither helper carries connector indices -- so it has to run on a
 * connector-free line. It asked for a one-piece source geometry instead, and
 * seven walks whose lines are continuous were left with "best parking/access
 * not yet verified" on a walk that starts at a bus stop.
 */

const { toPath, chainLines, haversineMeters } = require('./promote-osm-trails.js');

// [lng, lat] as the geojson stores them; chainLines returns [lat, lng].
const run = (lng, lat, count, step = 0.0005) =>
  Array.from({ length: count }, (_, i) => [lng + i * step, lat]);
const multi = (coordinates) => ({ type: 'MultiLineString', coordinates });

describe('what the gap count counts', () => {
  test('a relation in several pieces whose fragments are all left out has no gap', () => {
    // A walk and two scraps far enough away that reaching them costs more than
    // they are long. The line drawn is the walk, unbroken.
    const geometry = multi([run(11.41, 46.36, 60), run(11.48, 46.41, 2), run(11.49, 46.42, 2)]);
    const { segments, connectors, droppedPieces } = toPath(geometry);
    expect(segments).toBe(3);
    expect(droppedPieces).toHaveLength(2);
    expect(connectors).toEqual([]);   // so the record declares nothing
  });

  test('a hole the line really has is counted', () => {
    // Two long pieces a kilometre apart: neither is droppable, so chaining
    // draws across and the line carries the hole.
    const { segments, connectors } = toPath(multi([run(11.40, 46.36, 60), run(11.42, 46.36, 60)]));
    expect(segments).toBe(2);
    expect(connectors).toHaveLength(1);
    expect(connectors[0].meters).toBeGreaterThan(500);
  });

  test('a closed loop taken whole has no gap, however many pieces came with it', () => {
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


describe('the pieces a relation arrived in are still known', () => {
  test('they are reported, and reported as the source fact they are', () => {
    // Nothing published carries them, so the promoter says them out loud. The
    // count itself has to survive chaining's reordering to be worth saying.
    const { segments, droppedPieces } = toPath(multi([run(11.41, 46.36, 60),
      run(11.48, 46.41, 2), run(11.485, 46.415, 2)]));
    expect(segments).toBe(3);
    expect(droppedPieces.map((piece) => piece.points)).toEqual([2, 2]);
    for (const piece of droppedPieces) {
      expect(piece.gap).toBeGreaterThan(piece.meters);   // why it went
      expect(piece.meters).toBeGreaterThan(0);
    }
  });

  test('a fragment far from a walk is still measured in metres of real path', () => {
    const scrap = run(11.48, 46.41, 3);
    const { dropped } = chainLines([run(11.41, 46.36, 60), scrap]);
    expect(dropped[0].meters)
      .toBe(Math.round(haversineMeters(46.41, 11.48, 46.41, 11.481)));
  });
});
