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
  scoringVersion:'1.1.0',
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
    expect(result.cells.match.text).toBe('Strong option · 88%');
    expect(result.cells.water.text).toBe('1 reviewed water point');
    expect(result.cells.restrictions.text).toBe('Dogs allowed on leash');
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
      expect(result.cells[key].text).toMatch(/^Unknown/);
    });
    expect(result.cells.verification.kind).toBe('mapped');
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
