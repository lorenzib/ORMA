'use strict';

/**
 * Re-reading one relation's geometry without touching the catalogue.
 *
 * The full pass rediscovers the area -- 2,826 named routes and 2,197
 * candidates against the 92 features on file, in 88 Overpass batches, several
 * of which answer 504. Running it to correct geometry therefore also adds and
 * retires trails on the strength of whatever OpenStreetMap looks like that
 * morning, which is a product decision and not a geometry fix. These are the
 * guarantees that make the targeted path safe to use instead.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { geometryOf, refreshGeometry, pathLengthKm, simplify, stitchMembers, isClosedLoop } =
  require('./fetch-dog-friendly-routes');

// Vandoies/Vintl, where relation 11795251 starts: a ~1.3 km square of plain
// members, and the spur its 2.48 km jump landed on.
const SQUARE = [
  [{ lat: 46.8167, lon: 11.7230 }, { lat: 46.8167, lon: 11.7270 }],
  [{ lat: 46.8167, lon: 11.7270 }, { lat: 46.8197, lon: 11.7270 }],
  [{ lat: 46.8197, lon: 11.7270 }, { lat: 46.8197, lon: 11.7230 }],
  // Closes ~9 m from the start, the way a real stitched loop does.
  [{ lat: 46.8197, lon: 11.7230 }, { lat: 46.81678, lon: 11.7230 }],
];
const SPUR = [{ lat: 46.81516, lon: 11.75532 }, { lat: 46.81516, lon: 11.75932 }];

const way = (geometry, role, ref = 1) =>
  ({ type: 'way', ref, geometry, ...(role ? { role } : {}) });
const square = () => SQUARE.map((geometry, i) => way(geometry, null, 10 + i));

describe('what a relation’s geometry decides', () => {
  test('nothing to draw is nothing, not an empty feature', () => {
    expect(geometryOf([], {}, new Map())).toBeNull();
    expect(geometryOf([way(SPUR, 'approach')], {}, new Map())).toBeNull();
  });

  test('one line is a LineString, several are a MultiLineString', () => {
    expect(geometryOf(square(), {}, new Map()).geometry.type).toBe('LineString');
    const split = geometryOf([way(SQUARE[0]), way(SPUR)], {}, new Map());
    expect(split.geometry.type).toBe('MultiLineString');
  });

  test('the operator’s own distance tag beats the measured length', () => {
    // A published figure is better evidence than a sum over a simplified line.
    const built = geometryOf(square(), { distance: '7.3 km' }, new Map());
    expect(built.properties.distance_km).toBe(7.3);
    expect(built.lengthKm).not.toBe(7.3);
  });

  test('with no tag, the measurement fills in', () => {
    const built = geometryOf(square(), {}, new Map());
    expect(built.properties.distance_km).toBe(pathLengthKm(built.lines));
  });

  test('a loop is what the geometry says', () => {
    // Closed and over a kilometre.
    expect(geometryOf(square(), {}, new Map()).properties.loop).toBe(true);
    // A single short way closes nothing.
    expect(geometryOf([way(SQUARE[0])], {}, new Map()).properties.loop).toBe(false);
  });

  test('an approach road’s asphalt is not surface the walk is made of', () => {
    const surfaces = new Map([[10, 'ground'], [99, 'asphalt']]);
    const built = geometryOf([...square(), way(SPUR, 'approach', 99)], {}, surfaces);
    expect(built.properties.surfaces).toHaveProperty('ground');
    expect(built.properties.surfaces).not.toHaveProperty('asphalt');
  });

  test('no surface tags at all is null, not an empty object', () => {
    expect(geometryOf(square(), {}, new Map()).properties.surfaces).toBeNull();
  });
});

describe('a refresh changes geometry and nothing else', () => {
  const onFile = () => ({
    type: 'FeatureCollection', generatedAt: '2026-10-13T15:01:20.958Z',
    source: 'OpenStreetMap via Overpass API',
    features: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        properties: { osm_relation: 11795251, name: '1 - Dörferrundweg (Vintl)',
          ref: '1', network: 'lwn', distance_km: 13.2, loop: false, surfaces: null,
          website: 'https://example.invalid/vintl', sac_scale: null } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[2, 2], [3, 3]] },
        properties: { osm_relation: 999, name: 'Untouched', distance_km: 4.2, loop: true } },
    ],
  });

  const write = () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orma-refresh-')), 'routes.geojson');
    fs.writeFileSync(file, JSON.stringify(onFile()));
    return file;
  };
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

  // The shape Overpass returns for `relation(id:…); out geom;`, plus the
  // companion surface query.
  const answer = (members, tags = {}) => async query =>
    (/way\(r\.r\)\["surface"\]/.test(query)
      ? { elements: [{ type: 'way', id: 10, tags: { surface: 'ground' } }] }
      : { elements: [{ type: 'relation', id: 11795251, tags, members }] });

  test('the refreshed feature gets the new line', async () => {
    const file = write();
    const result = await refreshGeometry([11795251], { outputPath: file,
      fetchQuery: answer([...square(), way(SPUR, 'approach', 99)]) });
    expect(result.changed.map(entry => entry.id)).toEqual([11795251]);
    const [refreshed] = read(file).features;
    expect(refreshed.geometry.coordinates).not.toEqual([[0, 0], [1, 1]]);
    expect(refreshed.properties.loop).toBe(true);
    expect(refreshed.properties.surfaces).toEqual({ ground: expect.any(Number) });
  });

  test('its tag-derived properties are left exactly as they were', async () => {
    // Only geometry is being re-read. Name, ref, network and website come from
    // the relation's tags and are the full pass's business, not a refresh's.
    const file = write();
    await refreshGeometry([11795251], { outputPath: file,
      fetchQuery: answer(square()) });
    const [refreshed] = read(file).features;
    expect(refreshed.properties).toEqual(expect.objectContaining({
      name: '1 - Dörferrundweg (Vintl)', ref: '1', network: 'lwn',
      website: 'https://example.invalid/vintl' }));
  });

  test('every other trail on file is untouched', async () => {
    const file = write();
    await refreshGeometry([11795251], { outputPath: file, fetchQuery: answer(square()) });
    const after = read(file).features.find(f => f.properties.osm_relation === 999);
    expect(after).toEqual(onFile().features[1]);
  });

  test('a relation not on file is reported, never added', async () => {
    // Putting a walk in the catalogue is a product decision, not a refresh.
    const file = write();
    const result = await refreshGeometry([424242], { outputPath: file,
      fetchQuery: answer(square()) });
    expect(result.absent).toEqual([424242]);
    expect(read(file).features).toHaveLength(2);
    expect(result.changed).toEqual([]);
  });

  test('a relation the query does not return is a failure, not a silent skip', async () => {
    const file = write();
    const result = await refreshGeometry([11795251], { outputPath: file,
      fetchQuery: async () => ({ elements: [] }) });
    expect(result.failed).toEqual([{ id: 11795251, why: 'not returned by the query' }]);
    expect(read(file).features[0].geometry.coordinates).toEqual([[0, 0], [1, 1]]);
  });

  test('a relation whose members are all off-route is a failure too', async () => {
    const file = write();
    const result = await refreshGeometry([11795251], { outputPath: file,
      fetchQuery: answer([way(SPUR, 'approach')]) });
    expect(result.failed[0]).toEqual({ id: 11795251, why: 'no route members left a line' });
    expect(read(file).features[0].geometry.coordinates).toEqual([[0, 0], [1, 1]]);
  });

  test('an unchanged line is reported as unchanged', async () => {
    const file = write();
    const once = await refreshGeometry([11795251], { outputPath: file, fetchQuery: answer(square()) });
    expect(once.changed).toHaveLength(1);
    const twice = await refreshGeometry([11795251], { outputPath: file, fetchQuery: answer(square()) });
    expect(twice.changed).toEqual([]);
    expect(twice.identical.map(entry => entry.id)).toEqual([11795251]);
  });

  test('a dry run writes nothing', async () => {
    const file = write();
    const result = await refreshGeometry([11795251], { outputPath: file, dryRun: true,
      fetchQuery: answer(square()) });
    expect(result.changed).toHaveLength(1);
    expect(result.written).toBe(false);
    expect(read(file)).toEqual(onFile());
  });

  test('a failed surface query thins the data, it does not fail the refresh', async () => {
    const file = write();
    const result = await refreshGeometry([11795251], { outputPath: file,
      fetchQuery: async query => {
        if(/surface/.test(query)) throw new Error('504');
        return { elements: [{ type: 'relation', id: 11795251, tags: {}, members: square() }] };
      } });
    expect(result.changed).toHaveLength(1);
    expect(read(file).features[0].properties.surfaces).toBeNull();
  });
});

describe('a ring that closes exactly survives being simplified', () => {
  // Douglas-Peucker anchors on the first and last point. On an exactly closed
  // ring those are the same point, so every point between them measures zero
  // distance from the baseline and the whole ring collapses to two identical
  // points -- length zero, and the walk is dropped as degenerate geometry.
  //
  // This is what a correctly tagged roundtrip looks like once its approach and
  // excursion members are left out: the last way's final node IS the first
  // way's first node. Appending a spur used to leave the ends apart and hide
  // it. Refreshing 41 relations after the member-role fix turned 18 of them
  // into 0 km before this was fixed -- Toblacher Höhenweg from 27.3 km,
  // Rundweg Peitlerkofel from 11.8.
  const exactRing = () => stitchMembers([
    [{ lat: 46.8167, lon: 11.7230 }, { lat: 46.8167, lon: 11.7270 }],
    [{ lat: 46.8167, lon: 11.7270 }, { lat: 46.8197, lon: 11.7270 }],
    [{ lat: 46.8197, lon: 11.7270 }, { lat: 46.8197, lon: 11.7230 }],
    [{ lat: 46.8197, lon: 11.7230 }, { lat: 46.8167, lon: 11.7230 }],
  ].map((geometry, i) => ({ type: 'way', ref: 20 + i, geometry })))[0];

  test('the ring really does close on itself, bit for bit', () => {
    const ring = exactRing();
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  test('its corners are kept, not flattened to a point', () => {
    expect(simplify(exactRing()).length).toBeGreaterThan(2);
  });

  test('it still has a length', () => {
    expect(pathLengthKm([simplify(exactRing())])).toBeGreaterThan(1);
  });

  test('and it is still read as a loop', () => {
    expect(isClosedLoop([simplify(exactRing())])).toBe(true);
  });

  test('a ring of one repeated point is genuinely degenerate and still reduces', () => {
    // The guard: nothing to keep, so two points is the right answer and the
    // split must not be attempted.
    expect(simplify([[1, 1], [1, 1], [1, 1]])).toEqual([[1, 1], [1, 1]]);
  });

  test('an open line is unaffected', () => {
    const open = [[0, 0], [0.001, 0.0005], [0.002, 0]];
    expect(simplify(open)[0]).toEqual([0, 0]);
    expect(simplify(open)[simplify(open).length - 1]).toEqual([0.002, 0]);
  });
});
