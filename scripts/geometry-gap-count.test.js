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

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { toPath, chainLines, widestGapMeters, haversineMeters } = require('./promote-osm-trails.js');

const ROOT = path.resolve(__dirname, '..');
const ANCHORED = /\(OSM-verified access point\)$/;

// The seven walks whose lines are continuous but whose relations arrived in
// pieces, which the old gate turned away.
const NEWLY_ANCHORED = ['osm-123162', 'osm-9511973', 'osm-11860429', 'osm-12302191',
  'osm-19974725', 'osm-13337921', 'osm-16180587'];

// The promoter's own output, read without the override layer: these are the
// records this script writes, not the catalogue after curation.
function promotedRecords(file) {
  const sandbox = { trails: [] };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  return sandbox.trails;
}

const REGIONS = [
  { records: 'osm-trails-data.js', routes: 'dog-friendly-routes.geojson' },
  { records: 'osm-trails-savoy-data.js', routes: 'dog-friendly-routes-savoy.geojson' },
];

// Each promoted record beside the relation geometry it was built from.
const promoted = REGIONS.flatMap(({ records, routes }) => {
  const features = new Map(
    JSON.parse(fs.readFileSync(path.join(ROOT, routes), 'utf8')).features
      .map((feature) => [`osm-${feature.properties.osm_relation}`, feature]));
  return promotedRecords(records).map((record) => ({ record, feature: features.get(record.id) }));
});

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

describe('every promoted trail declares the holes its own line has', () => {
  test('the catalogue is actually being read', () => {
    expect(promoted.length).toBeGreaterThan(100);
    // A record with no relation in the geojson would silently pass the check
    // below, so there must not be one.
    expect(promoted.filter(({ feature }) => !feature)).toEqual([]);
  });

  test('the declared count is the connector count, for all of them', () => {
    const wrong = promoted
      .map(({ record, feature }) => ({
        id: record.id,
        declared: record.osmGeometryGaps || 0,
        connectors: toPath(feature.geometry).connectors.length,
      }))
      .filter((row) => row.declared !== row.connectors);
    expect(wrong).toEqual([]);
  });

  test('and the field is absent rather than zero when there is no hole', () => {
    for (const { record } of promoted) {
      if (record.osmGeometryGaps !== undefined) expect(record.osmGeometryGaps).toBeGreaterThan(0);
    }
    // Not a vacuous check: some trail still has a hole.
    expect(promoted.some(({ record }) => record.osmGeometryGaps > 0)).toBe(true);
  });

  test('Gsieser Talblickweg declares the one hole it has, not fourteen pieces', () => {
    const { record, feature } = promoted.find(({ record: r }) => r.id === 'osm-1780768');
    const { segments, connectors, droppedPieces } = toPath(feature.geometry);
    expect(segments).toBe(15);            // the relation's own pieces
    expect(droppedPieces).toHaveLength(13);
    expect(connectors).toHaveLength(1);
    expect(record.osmGeometryGaps).toBe(1);
  });
});

describe('a verified start point is anchored only to a line with no holes in it', () => {
  // The safety condition on relaxing the gate. rotateLoop and the reversal do
  // not carry connector indices, so a line with a connector in it must keep
  // the orientation it was drawn in.
  test('no anchored trail has a connector', () => {
    const anchored = promoted.filter(({ record }) => ANCHORED.test(record.startPoint.label));
    expect(anchored.length).toBeGreaterThan(50);
    expect(anchored
      .filter(({ feature }) => toPath(feature.geometry).connectors.length)
      .map(({ record }) => record.id)).toEqual([]);
  });

  test('a continuous line in several pieces is anchored all the same', () => {
    // The seven the old gate turned away. Each has a mapped car park, bus stop
    // or lift within 400 m of a line that has no hole in it.
    for (const id of NEWLY_ANCHORED) {
      const entry = promoted.find(({ record }) => record.id === id);
      const { segments, connectors } = toPath(entry.feature.geometry);
      expect(segments).toBeGreaterThan(1);
      expect(connectors).toEqual([]);
      expect(entry.record.startPoint.label).toMatch(ANCHORED);
    }
  });

  test('and anchoring it opens no gap the drawn line did not have', () => {
    // What a wrongly relaxed gate would look like: a loop whose ends do not
    // meet, rotated to start at a car park, shows a jump the publication rules
    // then hold it back for. Rotating a line that closes introduces nothing,
    // and these seven close within 25 m. Their widest gap is the same either
    // way, so none of them is newly held out of publication.
    //
    // Pinned to the seven rather than to every anchored trail, because this
    // change is not what put the others there: rotation on a loop whose ends
    // are a couple of hundred metres apart does move the widest gap, and seven
    // trails have been anchored that way since long before this.
    for (const id of NEWLY_ANCHORED) {
      const { record, feature } = promoted.find((entry) => entry.record.id === id);
      const drawn = widestGapMeters(toPath(feature.geometry).pts);
      // The published line is rounded to five decimal places, which moves a
      // segment end by about a metre.
      expect(widestGapMeters(record.path)).toBeCloseTo(drawn, -0.5);
    }
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
