'use strict';

/**
 * A line is measured against the members it was built from.
 *
 * #832 counts how many of a relation's way members came back carrying a line.
 * That question is asked before anything is built, so it cannot see a member
 * that arrives and then does not reach the output. Three Savoy walks passed it
 * with every member present and were written short anyway, because their
 * exactly closed rings collapsed inside `simplify`:
 *
 *   Au pied du Roc d'Enfer     0.75 km of a 12.74 km relation    6%
 *   Albannette petite boucle   3.62 km of  5.01 km              72%
 *   Boucle des cascades        7.06 km of  8.56 km              82%
 *
 * #831 fixed the collapse. Nothing measured the loss, so the three sat in the
 * published catalogue from 1 October to 18 October 2026, and the 1.06 km hole
 * in Albannette's line is why #867 held the walk back and deleted a page that
 * was live.
 *
 * The floor is not a guess. Every one of the 149 relations in both catalogues
 * was re-read from the OSM API on 18 October 2026 and rebuilt with this code:
 * the lowest drawn share was 0.9639 and the fifth percentile 0.9823, against
 * a median of 1.0107. Welds between member ends add length, simplification
 * takes 1-2% back, and nothing healthy came near the floor.
 */

const { geometryOf, memberLengthKm, memberGeometryShare, incompleteGeometryReason,
  simplify, stitchMembers, MINIMUM_DRAWN_SHARE, MINIMUM_GEOMETRY_SHARE } =
  require('./fetch-dog-friendly-routes');

// A square of four plain members whose last node IS the first, which is what a
// correctly tagged roundtrip looks like -- and what used to collapse.
const RING = [
  [{ lat: 46.8167, lon: 11.7230 }, { lat: 46.8167, lon: 11.7270 }],
  [{ lat: 46.8167, lon: 11.7270 }, { lat: 46.8197, lon: 11.7270 }],
  [{ lat: 46.8197, lon: 11.7270 }, { lat: 46.8197, lon: 11.7230 }],
  [{ lat: 46.8197, lon: 11.7230 }, { lat: 46.8167, lon: 11.7230 }],
];
const way = (geometry, role, ref = 1) =>
  ({ type: 'way', ref, geometry, ...(role ? { role } : {}) });
const ring = () => RING.map((geometry, i) => way(geometry, null, 30 + i));

describe('the ground a relation’s own members cover', () => {
  test('is the sum of the on-route ways', () => {
    // Four sides of a square: two of 0.0030 degrees latitude, two of 0.0040
    // degrees longitude at 46.8 N. Just over a kilometre in total.
    expect(memberLengthKm(ring())).toBeGreaterThan(1.2);
    expect(memberLengthKm(ring())).toBeLessThan(1.3);
  });

  test('leaves out an approach, which is not the walk', () => {
    const withSpur = [...ring(),
      way([{ lat: 46.8151, lon: 11.7553 }, { lat: 46.8151, lon: 11.7953 }], 'approach', 99)];
    expect(memberLengthKm(withSpur)).toBeCloseTo(memberLengthKm(ring()), 6);
  });

  test('a member with no line contributes nothing and is not an error', () => {
    expect(memberLengthKm([...ring(), way(undefined, null, 98)]))
      .toBeCloseTo(memberLengthKm(ring()), 6);
  });

  test('no members at all is zero, not a crash', () => {
    expect(memberLengthKm([])).toBe(0);
    expect(memberLengthKm(undefined)).toBe(0);
  });
});

describe('what a built line reports about itself', () => {
  test('it carries the members’ length and the share it drew', () => {
    const built = geometryOf(ring(), {}, new Map());
    expect(built.memberKm).toBeCloseTo(memberLengthKm(ring()), 6);
    expect(built.drawnShare).toBeGreaterThan(MINIMUM_DRAWN_SHARE);
  });

  test('a healthy ring draws essentially all of itself', () => {
    // The case that collapsed: it must now come back whole.
    expect(geometryOf(ring(), {}, new Map()).drawnShare).toBeGreaterThan(0.99);
  });

  test('members with no length leave the share undefined rather than zero', () => {
    // A single two-identical-point way covers no ground, so there is no
    // denominator and no claim to make about the line.
    const built = geometryOf([way([{ lat: 46.8, lon: 11.7 }, { lat: 46.8, lon: 11.7 }])], {}, new Map());
    expect(built.memberKm).toBe(0);
    expect(built.drawnShare).toBeNull();
  });
});

describe('refusing a line that cannot account for its members', () => {
  // The exact shape of the fault, reproduced: the ring is there, the line is
  // the two-point stub Douglas-Peucker used to leave behind.
  const collapsed = () => {
    const built = geometryOf(ring(), {}, new Map());
    const stub = [built.lines[0][0], built.lines[0][0]];
    return { ...built, lines: [stub], lengthKm: 0, drawnShare: 0 };
  };

  test('a collapsed ring is refused, and says what it drew', () => {
    // Derived from the producer, not retyped: a hand-copied figure passes
    // against a string nothing emits.
    const covered = Math.round(memberLengthKm(ring()) * 10) / 10;
    expect(incompleteGeometryReason(ring(), collapsed()))
      .toBe(`drew 0 km of the ${covered} km its own members cover (0%)`);
  });

  test('the three Savoy shares are all below the floor', () => {
    for (const share of [0.059, 0.722, 0.825]) {
      expect(share).toBeLessThan(MINIMUM_DRAWN_SHARE);
    }
  });

  test('the worst healthy walk measured is above it', () => {
    // osm-19661726, Sentier pédestre des Graniteurs: 0.75 km drawn of 0.78.
    expect(0.9639).toBeGreaterThan(MINIMUM_DRAWN_SHARE);
  });

  test('a whole line passes', () => {
    expect(incompleteGeometryReason(ring(), geometryOf(ring(), {}, new Map()))).toBeNull();
  });

  test('a thin answer is still caught, by the count rather than the length', () => {
    const thin = [...Array.from({ length: 30 }, (_, i) => way(undefined, null, 200 + i)), ...ring()];
    expect(memberGeometryShare(thin).share).toBeLessThan(MINIMUM_GEOMETRY_SHARE);
    expect(incompleteGeometryReason(thin, geometryOf(thin, {}, new Map())))
      .toMatch(/returned geometry for 4\/34 ways/);
  });

  test('the count is asked first, because it names the real fault', () => {
    // Both are true of a thin answer; "the geometry never arrived" is the one
    // worth printing, not "the line came out short".
    const thin = [...Array.from({ length: 30 }, (_, i) => way(undefined, null, 300 + i)), ...ring()];
    expect(incompleteGeometryReason(thin, collapsed())).toMatch(/returned geometry for/);
  });

  test('a genuinely tiny but complete walk is not refused', () => {
    // A 40 m path is a short walk, not a lost one. The length check is a
    // ratio, so it has nothing to say about a walk being small.
    const tiny = [way([{ lat: 46.8, lon: 11.7 }, { lat: 46.8, lon: 11.70052 }])];
    expect(incompleteGeometryReason(tiny, geometryOf(tiny, {}, new Map()))).toBeNull();
  });

  test('no members to compare against is not a refusal', () => {
    expect(incompleteGeometryReason([], null)).toBeNull();
  });
});

describe('a refresh may only improve a line', () => {
  const { refreshGeometry } = require('./fetch-dog-friendly-routes');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const write = () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'orma-share-')), 'routes.geojson');
    fs.writeFileSync(file, JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[11.7, 46.8], [11.8, 46.9]] },
        properties: { osm_relation: 13337921, name: "Au pied du Roc d'Enfer", distance_km: 12.7 } },
    ] }));
    return file;
  };
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const answer = (members) => async (query) => (/\["surface"\]/.test(query)
    ? { elements: [] }
    : { elements: [{ type: 'relation', id: 13337921, tags: {}, members }] });

  // Before this, the refresh asked neither question -- so the one path whose
  // whole job is repairing geometry would write the short line over the good
  // one and report it as a change.
  test('a short answer leaves the feature exactly as it was', async () => {
    const file = write();
    const stub = [{ lat: 46.8167, lon: 11.7230 }, { lat: 46.81671, lon: 11.7230 }];
    const result = await refreshGeometry([13337921], { outputPath: file,
      fetchQuery: answer([...ring(), way(stub, null, 40)].map((m, i) => (i < 4 ? { ...m, geometry: [] } : m))) });
    expect(result.changed).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(read(file).features[0].geometry.coordinates).toEqual([[11.7, 46.8], [11.8, 46.9]]);
  });

  test('a whole answer is still written', async () => {
    const file = write();
    const result = await refreshGeometry([13337921], { outputPath: file, fetchQuery: answer(ring()) });
    expect(result.failed).toEqual([]);
    expect(result.changed).toHaveLength(1);
    expect(read(file).features[0].geometry.coordinates).not.toEqual([[11.7, 46.8], [11.8, 46.9]]);
  });
});

describe('reading a relation from the OSM API instead of Overpass', () => {
  const { osmApiFetchQuery } = require('./fetch-dog-friendly-routes');

  // relation/<id>/full.json: the relation, its ways, and their nodes, flat.
  const FULL = {
    elements: [
      { type: 'node', id: 1, lat: 46.8167, lon: 11.7230 },
      { type: 'node', id: 2, lat: 46.8167, lon: 11.7270 },
      { type: 'node', id: 3, lat: 46.8197, lon: 11.7270 },
      { type: 'way', id: 10, nodes: [1, 2], tags: { surface: 'ground' } },
      { type: 'way', id: 11, nodes: [2, 3], tags: {} },
      { type: 'relation', id: 13337921, tags: { name: "Au pied du Roc d'Enfer" },
        members: [{ type: 'way', ref: 10, role: '' }, { type: 'way', ref: 11, role: 'approach' }] },
    ],
  };
  const stub = (doc = FULL) => {
    const calls = [];
    const fetchQuery = osmApiFetchQuery({ sleep: async () => {},
      fetch: async (url) => { calls.push(url); return { ok: true, json: async () => doc }; } });
    return { fetchQuery, calls };
  };

  test('it answers in the shape `out geom` produces', async () => {
    const { fetchQuery } = stub();
    const data = await fetchQuery('[out:json];relation(id:13337921);out geom;');
    expect(data.elements).toHaveLength(1);
    const [relation] = data.elements;
    expect(relation.type).toBe('relation');
    expect(relation.tags.name).toBe("Au pied du Roc d'Enfer");
    expect(relation.members[0]).toEqual({ type: 'way', ref: 10, role: '',
      geometry: [{ lat: 46.8167, lon: 11.7230 }, { lat: 46.8167, lon: 11.7270 }] });
  });

  test('a member’s role survives the trip, so an approach is still dropped', async () => {
    const { fetchQuery } = stub();
    const { elements: [relation] } = await fetchQuery('relation(id:13337921);out geom;');
    expect(relation.members[1].role).toBe('approach');
    expect(geometryOf(relation.members, {}, new Map()).lines).toHaveLength(1);
  });

  test('the surface query is answered from the same document, not a second trip', async () => {
    const { fetchQuery, calls } = stub();
    await fetchQuery('relation(id:13337921)->.r;way(r.r)["surface"];out ids tags;');
    const tagged = await fetchQuery('relation(id:13337921)->.r;way(r.r)["surface"];out ids tags;');
    expect(tagged.elements).toEqual([{ type: 'way', id: 10, tags: { surface: 'ground' } }]);
    expect(new Set(calls).size).toBe(1);
  });

  test('a relation is fetched once however often it is asked for', async () => {
    const { fetchQuery, calls } = stub();
    await fetchQuery('relation(id:13337921);out geom;');
    await fetchQuery('relation(id:13337921);out geom;');
    expect(calls).toHaveLength(1);
  });

  test('only the relation clause is read for ids', async () => {
    // `[out:json][timeout:180]` is not a request for relation 180, which is
    // what reading every number in the query made of it.
    const { fetchQuery, calls } = stub();
    await fetchQuery('[out:json][timeout:180];\nrelation(id:13337921);\nout geom;');
    expect(calls).toEqual([expect.stringContaining('/relation/13337921/full.json')]);
  });

  test('several ids in one query are all fetched', async () => {
    const { fetchQuery, calls } = stub();
    await fetchQuery('[out:json][timeout:180];relation(id:13337921,14379937);out geom;');
    expect(calls).toHaveLength(2);
  });

  test('an HTTP failure is raised, not returned as an empty walk', async () => {
    const fetchQuery = osmApiFetchQuery({ sleep: async () => {},
      fetch: async () => ({ ok: false, status: 509 }) });
    await expect(fetchQuery('relation(id:13337921);out geom;'))
      .rejects.toThrow(/HTTP 509 for relation 13337921/);
  });

  test('a way the document does not carry leaves an empty line, not a crash', async () => {
    const missing = { elements: FULL.elements.filter((el) => el.id !== 10 || el.type !== 'way') };
    const { fetchQuery } = stub(missing);
    const { elements: [relation] } = await fetchQuery('relation(id:13337921);out geom;');
    expect(relation.members[0].geometry).toEqual([]);
    // And the count guard is what then refuses it.
    expect(incompleteGeometryReason(relation.members, null)).toMatch(/returned geometry for 1\/2/);
  });
});
