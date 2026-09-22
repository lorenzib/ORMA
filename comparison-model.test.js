// compare.html loads the vocabulary before this model, and so does the test:
// the labels it renders are match-verdict.js's, not a copy of its own.
const { requireAll } = require('./test-support/page-runtime');

// The vocabularies and the view compare.html loads before this model, in the
// order that page runs them. Naming them here and hoping used to be enough to
// pass while the verification cell rendered empty and the reasons row read
// "unknown" -- so the page decides what exists and in what order, and a name
// it no longer loads fails this file rather than hiding inside it.
requireAll('compare.html', [
  'trust/evidence-v1.js', 'match-verdict.js', 'recommendation-decision.js',
]);
const model = require('./comparison-model');

const baseTrail = {
  id:'reviewed',
  name:'Reviewed Loop',
  area:'Carezza',
  hours:1.5,
  metrics:{ distanceKm:4, ascentM:120 },
  suitability:{
    terrainRank:0, shadePercent:60, heatRisk:'low', exposure:false,
    surfaceHazards:[], dogAccess:{ status:'leash-required' },
  },
  waypoints:[{ type:'water', status:'reviewed' }],
  verification:{
    tier:'route-audited',
    categories:{ water:'verified', heat:'verified', exposure:'verified', surfaceHazards:'verified', access:'verified' },
  },
};

const recommendation = {
  score:88,
  category:'strong-option',
  confidence:'high',
  scoringVersion:'1.6.0',
  positiveReasons:[{ message:'Terrain is suitable.' }],
  cautions:[],
  hardStops:[],
  unknowns:[],
};

describe('comparison presentation model', () => {
  test('builds every required comparison cell from canonical facts', () => {
    const result = model.build(baseTrail, {
      normalizeTrail: value => value,
      recommendation,
    });

    expect(Object.keys(result.cells)).toEqual([
      'match','reasons','distance','elevation','duration','terrain','exposure',
      'shade','heat','water','hazards','restrictions','verification',
    ]);
    // The verdict, not the verdict and the number. Two trails both called a
    // strong option are separated by the rows beneath this one, not by a few
    // points of a score whose evidence does not carry that precision.
    expect(result.cells.match.text).toBe('Strong option');
    // A route ORMA audited from sources and one ORMA walked are different
    // claims. This table used to call both "Verified by ORMA", hiding the
    // distinction a reader opens a comparison to see.
    expect(result.cells.verification.text).toBe('ORMA route-audited');
    expect(result.cells.water.text).toBe('1 reviewed water point');
    expect(result.cells.restrictions.text).toBe('Dogs allowed on leash');
    expect(result.cells.duration.text).toBe('1.5 h');
    expect(model.build({ ...baseTrail, hours:'2–2.5' }, {
      normalizeTrail:value => value,
      recommendation,
    }).cells.duration.text).toBe('2–2.5 h');
  });

  test('unreviewed absence remains unknown rather than safe', () => {
    const result = model.build({
      ...baseTrail,
      suitability:{ ...baseTrail.suitability, exposure:false, surfaceHazards:[] },
      verification:{
        tier:'imported',
        categories:{ water:'unknown', heat:'unknown', exposure:'unknown', surfaceHazards:'unknown', access:'unknown' },
      },
    }, { normalizeTrail:value => value, recommendation });

    ['exposure','shade','heat','water','hazards','restrictions'].forEach(key => {
      expect(result.cells[key].kind).toBe('unknown');
      expect(result.cells[key].text).toMatch(/^Not listed/);
    });
    expect(result.cells.verification.kind).toBe('mapped');
    expect(result.cells.verification.text).toBe('Imported map data');
  });

  // The row used to print the engine's own sentences, in the engine's order,
  // untranslated -- and where a trail had nothing to caution about, one
  // templated sentence per positive: "Terrain is within this dog's effective
  // tolerance. The 3.6 km route is within this dog's effective range." The
  // same sentence three times with the nouns swapped.
  test('a trail with nothing to caution about says what fits, once', () => {
    const result = model.build(baseTrail, {
      normalizeTrail:value => value,
      dogName:'Eddie',
      recommendation:{
        ...recommendation,
        hardStops:[], cautions:[], unknowns:[],
        factors:[
          { code:'trail.terrain.within-tolerance', message:'The terrain suits Eddie.', impact:0 },
          { code:'trail.distance.within-range', message:'7.5 km is within Eddie’s range.', impact:0, vars:{ distance:7.5 } },
          { code:'trail.ascent.within-range', message:'The 150 m climb is fine.', impact:0, vars:{ ascent:150 } },
        ],
        positiveReasons:[
          { code:'trail.terrain.within-tolerance', message:'The terrain suits Eddie.' },
          { code:'trail.distance.within-range', message:'7.5 km is within Eddie’s range.', vars:{ distance:7.5 } },
          { code:'trail.ascent.within-range', message:'The 150 m climb is fine.', vars:{ ascent:150 } },
        ],
      },
    });
    expect(result.cells.reasons.kind).toBe('known');
    expect(result.cells.reasons.text)
      .toBe('The terrain, the 7.5 km distance and the 150 m climb.');
  });

  test('a missing profile field is not counted against the trail', () => {
    // Every column would carry the same "add Eddie's weight", which says
    // nothing about the trails being compared.
    const result = model.build(baseTrail, {
      normalizeTrail:value => value,
      recommendation:{
        ...recommendation,
        cautions:[{ code:'trail.heat.high', message:'This route gets hot.' }],
        unknowns:[
          { code:'dog.weight.unknown', message:'Weight is missing.' },
          { code:'trail.exposure.unknown', message:'Exposure is not established.' },
        ],
      },
    });
    expect(result.cells.reasons.detail).toBe('1 unknown item also affects confidence');
  });

  test('cautions and hard stops take priority over positive reasons', () => {
    const result = model.build(baseTrail, {
      normalizeTrail:value => value,
      recommendation:{
        ...recommendation,
        category:'not-recommended',
        score:5,
        hardStops:[{ message:'Dogs are prohibited.' }],
        cautions:[{ message:'High heat.' }],
      },
    });
    expect(result.cells.match.kind).toBe('caution');
    expect(result.cells.reasons.text).toContain('Dogs are prohibited.');
    expect(result.cells.reasons.text).toContain('High heat.');
  });
});
