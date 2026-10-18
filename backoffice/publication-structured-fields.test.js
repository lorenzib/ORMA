'use strict';

const { VERIFIED_FIELDS, STRUCTURED_FIELDS, REQUIRED_STRUCTURED_FIELDS,
  OPTIONAL_STRUCTURED_FIELDS, structuredFieldsFromTrail, verifiedFieldsFor }
  = require('./workflows/build-publication-staging');
const { loadProductionTrails } = require('../scripts/load-production-trails');
const path = require('path');

// The structured fields a published trail carries were typed in by hand, one
// hardcoded entry per candidate. Three existed, so the fourth trail to clear
// verification would have stalled at the mapping gate until somebody edited the
// source file. A trail already in the catalogue carries all thirteen itself.

function trail(overrides = {}){
  const base = { id:'seceda', area:'Val Gardena', distance:10.8, elevation:550, hours:'4',
    paid:false, terrainType:'Ridge path', terrainRank:2, shadeCoverage:null, heatRisk:'high',
    safetyLevel:'caution', exposure:false, waterSources:[],
    startPoint:{ lat:46.6, lng:11.7, label:'Seceda upper lift station' } };
  return { ...base, ...overrides };
}

const byId = trails => new Map(trails.map(entry => [entry.id, entry]));

describe('a trail supplies its own structured fields', () => {
  test('an update takes all thirteen from the record', () => {
    const fields = verifiedFieldsFor({ candidateId:'osm-relation-6528494' },
      { trailId:'seceda', operation:'update-existing' }, byId([trail()]));

    expect(Object.keys(fields).sort()).toEqual([...STRUCTURED_FIELDS].sort());
    expect(fields).toMatchObject({ distance:10.8, heatRisk:'high', terrainRank:2 });
  });

  test('an unknown that has been recorded as unknown is a value, not an absence', () => {
    // shadeCoverage is null on verified trails. Treating null as missing would
    // block exactly the trails that did the review honestly.
    const fields = structuredFieldsFromTrail(trail({ shadeCoverage:null }));

    expect(fields).not.toBeNull();
    expect(fields.shadeCoverage).toBeNull();
  });

  // This asserted that deleting heatRisk blocks publication. All thirteen were
  // required together, and heatRisk, shadeCoverage, exposure and paid only
  // exist once the matching safety category was researched -- so the rule it
  // pinned held 134 of 163 trails at the mapping gate for not having had their
  // heat researched, which is the safety gate again under another name. The
  // nine that describe the walk are still required.
  test('a safety attribute nobody has researched is carried as absent, not as a block', () => {
    const missing = trail();
    delete missing.heatRisk;
    delete missing.shadeCoverage;

    const fields = structuredFieldsFromTrail(missing);
    expect(fields).not.toBeNull();
    expect('heatRisk' in fields).toBe(false);
    expect('shadeCoverage' in fields).toBe(false);
    expect(fields.distance).toBe(10.8);
  });

  test('a field the walk cannot be described without still blocks', () => {
    for(const field of REQUIRED_STRUCTURED_FIELDS){
      const missing = trail();
      delete missing[field];
      expect({ field, fields:structuredFieldsFromTrail(missing) }).toEqual({ field, fields:null });
    }
  });

  // Measured against the catalogue, not asserted from a fixture: the point of
  // the split is how many real trails can publish, and the one that cannot is
  // the known trail with no usable start point.
  test('every catalogue trail but one can supply its publication fields', () => {
    const trails = loadProductionTrails(path.resolve(__dirname, '..'));
    const blocked = trails.filter(record => !structuredFieldsFromTrail(record)).map(record => record.id);

    expect(trails.length).toBeGreaterThan(150);
    expect(blocked).toEqual(['valley-view']);
  });

  test('the two groups make up the whole list and do not overlap', () => {
    expect([...STRUCTURED_FIELDS].sort())
      .toEqual([...REQUIRED_STRUCTURED_FIELDS, ...OPTIONAL_STRUCTURED_FIELDS].sort());
    expect(REQUIRED_STRUCTURED_FIELDS.filter(field => OPTIONAL_STRUCTURED_FIELDS.includes(field))).toEqual([]);
  });

  test('a new trail has no record to carry forward and stays blocked', () => {
    expect(verifiedFieldsFor({ candidateId:'whatever' },
      { trailId:'not-in-the-catalogue', operation:'create-new' }, byId([trail()]))).toBeNull();
  });

  test('a target that maps to no catalogue trail stays blocked', () => {
    expect(verifiedFieldsFor({ candidateId:'whatever' },
      { trailId:'missing', operation:'update-existing' }, byId([trail()]))).toBeNull();
  });

  test('an item with no target at all stays blocked', () => {
    expect(verifiedFieldsFor({ candidateId:'whatever' }, null, byId([trail()]))).toBeNull();
  });
});

describe('the hand-written table still decides where it exists', () => {
  test('a tabled candidate keeps its exact fields', () => {
    const fields = verifiedFieldsFor({ candidateId:'osm-relation-1484751' },
      { trailId:'tre-cime', operation:'update-existing' }, byId([trail({ id:'tre-cime' })]));

    expect(fields).toEqual(VERIFIED_FIELDS['osm-relation-1484751']);
  });

  test('the table wins even when the record could supply them', () => {
    const fields = verifiedFieldsFor({ candidateId:'osm-relation-1484751' },
      { trailId:'tre-cime', operation:'update-existing' },
      byId([trail({ id:'tre-cime', distance:999 })]));

    expect(fields.distance).toBe(VERIFIED_FIELDS['osm-relation-1484751'].distance);
    expect(fields.distance).not.toBe(999);
  });
});
