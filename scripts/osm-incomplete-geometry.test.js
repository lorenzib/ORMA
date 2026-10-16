'use strict';

// A thin Overpass answer is not a broken trail.
//
// Regenerating the Dolomites catalogue on 2026-10-16 dropped 102 relations as
// "degenerate geometry (0 km)" and the file came back 23 routes smaller, which
// would have deleted 23 live trail pages. Replaying the identical phase-2
// query by hand returned full geometry for every one checked -- 36/36, 38/40
// and 30/30 member ways. The data was always there; the response was not.
//
// The old guard only caught a relation with no members at all. One that comes
// back with its members listed and their geometry missing stitches to a stub,
// and the degenerate check then reads that as a walk too short to publish.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { stitchMembers, MINIMUM_GEOMETRY_SHARE, MAXIMUM_CATALOGUE_LOSS,
  readPreviousCatalogue } = require('./fetch-dog-friendly-routes.js');

const line = (n, lat = 46.36, lng = 11.41) =>
  Array.from({ length: n }, (_, i) => ({ lat: lat + i * 0.001, lon: lng + i * 0.001 }));

const member = (geometry, role = '') => ({ type: 'way', ref: Math.random(), role, geometry });

// The share the production code computes before deciding.
const geometryShare = (members) => {
  const ways = members.filter((m) => m.type === 'way');
  const withGeometry = ways.filter((m) => Array.isArray(m.geometry) && m.geometry.length > 1);
  return ways.length ? withGeometry.length / ways.length : 0;
};

describe('telling a thin answer from a broken trail', () => {
  test('a full answer is above the floor and stitches to a real line', () => {
    const members = Array.from({ length: 36 }, (_, i) => member(line(20, 46.36 + i * 0.02)));
    expect(geometryShare(members)).toBe(1);
    expect(geometryShare(members)).toBeGreaterThanOrEqual(MINIMUM_GEOMETRY_SHARE);
    expect(stitchMembers(members).length).toBeGreaterThan(0);
  });

  // The shape that cost 23 trails: members listed, geometry absent.
  test('members listed with no geometry fall below the floor', () => {
    const members = Array.from({ length: 36 }, () => member(undefined));
    expect(geometryShare(members)).toBe(0);
    expect(geometryShare(members)).toBeLessThan(MINIMUM_GEOMETRY_SHARE);
    // And this is why it used to look degenerate rather than broken.
    expect(stitchMembers(members)).toEqual([]);
  });

  test('a partial answer falls below it too', () => {
    const members = [...Array.from({ length: 30 }, () => member(undefined)),
      ...Array.from({ length: 6 }, (_, i) => member(line(20, 46.36 + i * 0.02)))];
    expect(geometryShare(members)).toBeCloseTo(6 / 36, 5);
    expect(geometryShare(members)).toBeLessThan(MINIMUM_GEOMETRY_SHARE);
  });

  // A trail that really is tiny must still be droppable.
  test('a complete answer that is genuinely tiny stays above the floor', () => {
    const members = [member([{ lat: 46.36, lon: 11.41 }, { lat: 46.36001, lon: 11.41001 }])];
    expect(geometryShare(members)).toBe(1);
    expect(geometryShare(members)).toBeGreaterThanOrEqual(MINIMUM_GEOMETRY_SHARE);
  });

  test('an off-route role does not count against the share', () => {
    const members = [...Array.from({ length: 28 }, () => member(line(20))),
      member(line(20), 'alternative')];
    expect(geometryShare(members)).toBe(1);
  });
});

describe('a regeneration may not quietly shrink the catalogue', () => {
  const write = (ids) => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orma-')), 'routes.geojson');
    fs.writeFileSync(file, JSON.stringify({ type: 'FeatureCollection',
      features: ids.map((id) => ({ properties: { osm_relation: id } })) }));
    return file;
  };
  const loss = (before, after) =>
    before.filter((id) => !after.includes(id)).length / before.length;

  test('the previous catalogue is read back by relation id', async () => {
    expect(await readPreviousCatalogue(write([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  test('no file yet is not a loss', async () => {
    expect(await readPreviousCatalogue('/nope/missing.geojson')).toBeNull();
  });

  // 23 of 92 is what the failed run produced.
  test('losing a quarter of the catalogue is over the limit', () => {
    const before = Array.from({ length: 92 }, (_, i) => i);
    expect(loss(before, before.slice(23))).toBeGreaterThan(MAXIMUM_CATALOGUE_LOSS);
  });

  test('losing one trail is not', () => {
    const before = Array.from({ length: 92 }, (_, i) => i);
    expect(loss(before, before.slice(1))).toBeLessThan(MAXIMUM_CATALOGUE_LOSS);
  });
});
