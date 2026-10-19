'use strict';

const path = require('path');
const { articleFor } = require('./promote-osm-trails');
const { generatedTargets } = require('./check-generated-artifacts');
const { PROMOTER_DERIVED_STATUS, applyRouteNumberEvidence } = require('./route-number-evidence');
const { loadProductionTrails } = require('./load-production-trails');
const { routeSourceReady } = require('../backoffice/workflows/run-trail-specialist');

const ROOT = path.resolve(__dirname, '..');

/**
 * `osm-trails-data.js` says "AUTO-GENERATED ... do not edit by hand" and was
 * not checked, so it went stale: 44 Dolomites trails and 31 Savoy ones
 * differed from what their own generator produces from the committed inputs.
 * 32 were missing route numbers the map had, and one was wrong about its
 * distance by 1.6 km. Everything downstream regenerated faithfully from the
 * stale file, and the generated-artifact check passed.
 */
describe('the promoted catalogue is checked like every other generated file', () => {
  test('both promoted files are in the generated set', () => {
    expect(generatedTargets).toEqual(expect.arrayContaining(
      ['osm-trails-data.js', 'osm-trails-savoy-data.js']));
  });
});

/**
 * Why it had been left stale: regenerating it quietly switched the route
 * sourcing off, and nothing said so.
 */
describe('regenerating the catalogue does not switch off its route sourcing', () => {
  const trail = extra => ({ id: 't1', name: 'Rundweg', osmRelation: 50,
    waymarkedtrails: 'https://hiking.waymarkedtrails.org/#route?id=50', ...extra });
  const mapped = new Map([['50', { ref: '50', website: { url: 'https://comune.example/route', host: 'comune.example' } }]]);
  const apply = input => applyRouteNumberEvidence([input], ROOT, mapped, new Map())[0];

  test('a status the promoter derived does not stand in front of the evidence', () => {
    for (const status of PROMOTER_DERIVED_STATUS) {
      const result = apply(trail({ routeNumberStatus: status }));
      expect({ status, url: result.routeNumberSource.url })
        .toEqual({ status, url: 'https://comune.example/route' });
    }
  });

  test('a status somebody declared still stands', () => {
    const result = apply(trail({ routeNumberStatus: 'official-landmark-route' }));
    expect(result.routeNumberStatus).toBe('official-landmark-route');
    expect(result.routeNumberSource).toBeUndefined();
  });

  // The same fault one line down, which the comment beneath it already
  // described: taking the number first threw the page away.
  test('a number the trail already carries does not deny it the page', () => {
    const result = apply(trail({ routeRefs: ['50'] }));
    expect(result.routeNumberSource.url).toBe('https://comune.example/route');
  });

  test('and with no mapped evidence a number is still enough to be documented', () => {
    const result = applyRouteNumberEvidence([trail({ routeRefs: ['50'] })], ROOT, new Map(), new Map())[0];
    expect(result.routeNumberStatus).toBe('documented');
  });

  // Measured against the catalogue: the regeneration must not cost a single
  // trail its ability to cite a real authority.
  test('no trail cites a map where it could cite an authority', () => {
    const ready = loadProductionTrails(ROOT).filter(routeSourceReady);
    expect(ready.length).toBeGreaterThan(80);
    const citingTheMap = ready.filter(item =>
      /waymarkedtrails|openstreetmap/i.test(String(item.routeNumberSource?.url || '')));
    expect(citingTheMap.map(item => item.id)).toEqual([]);
  });
});

/**
 * "An 1.5 km route". The article keyed off whether the walk was a loop, which
 * has nothing to do with it, and 42 of the 124 imported descriptions read
 * wrongly on the live pages.
 */
describe('a description says the number the way a reader says it', () => {
  test('eight, eleven, eighteen and the eighties take "an"', () => {
    for (const km of [8, 8.4, 8.9, 11, 11.1, 18, 18.6, 80, 85.2, 89.9]) {
      expect({ km, article: articleFor(km) }).toEqual({ km, article: 'An' });
    }
  });

  test('everything else takes "a"', () => {
    for (const km of [0.7, 1.5, 3, 9, 12, 19, 37.1, 71.2, 90, 100, 110]) {
      expect({ km, article: articleFor(km) }).toEqual({ km, article: 'A' });
    }
  });

  test('and no page in the catalogue reads wrongly', () => {
    const wrong = loadProductionTrails(ROOT)
      .map(record => ({ id: record.id, match: String(record.desc || '').match(/^(An?) ([\d.]+) km/) }))
      .filter(row => row.match && row.match[1] !== articleFor(row.match[2]))
      .map(row => `${row.id}: "${row.match[1]} ${row.match[2]} km"`);
    expect(wrong).toEqual([]);
  });
});
