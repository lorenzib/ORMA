const filters = require('./discovery-filters');

function trail(overrides = {}){
  return {
    id:'sample',
    name:'Sample loop',
    region:'dolomites',
    valley:'Val di Fassa',
    distance:4,
    terrainRank:0,
    shadeCoverage:60,
    heatRisk:'low',
    safetyLevel:'low-risk',
    exposure:false,
    waterSources:[{ km:1, label:'Fountain' }],
    verification:{
      tier:'route-audited',
      categories:{
        route:'verified', water:'verified', heat:'verified',
        exposure:'verified', livestock:'unknown',
        surfaceHazards:'verified', access:'verified',
      },
    },
    suitability:{
      safetyLevel:'low-risk',
      terrainRank:0,
      shadePercent:60,
      heatRisk:'low',
      exposure:false,
      surfaceHazards:[],
      dogAccess:{ status:'allowed', notes:null },
    },
    metrics:{ distanceKm:4 },
    waypoints:[{ id:'water-1', type:'water', status:'reviewed' }],
    ...overrides,
  };
}

describe('dog-specific discovery filters', () => {
  test('known reviewed facts satisfy all positive safety filters', () => {
    expect(filters.matches(trail(), {
      country:'italy',
      distance:'5',
      terrain:'soft',
      water:true,
      heat:'shade-reviewed',
      exposure:'none-reviewed',
      access:'allowed-reviewed',
    })).toBe(true);
  });

  test('country and region remain independent geographic filters', () => {
    expect(filters.matches(trail(), { country:'italy', region:'dolomites' })).toBe(true);
    expect(filters.matches(trail(), { country:'france' })).toBe(false);
    expect(filters.matches(trail({ region:'savoy', country:'FR' }), { country:'france', region:'savoy' })).toBe(true);
  });

  test('valley narrows results inside the selected region', () => {
    expect(filters.matches(trail(), { region:'dolomites', valley:'Val di Fassa' })).toBe(true);
    expect(filters.matches(trail(), { region:'dolomites', valley:'Val Gardena' })).toBe(false);
  });

  test.each([
    ['distance', { metrics:{ distanceKm:null } }, { distance:'5' }],
    ['terrain', { suitability:{ terrainRank:null } }, { terrain:'mixed' }],
    ['water', { verification:{ tier:'route-audited', categories:{ water:'unknown' } } }, { water:true }],
    ['shade', { verification:{ tier:'route-audited', categories:{ heat:'unknown' } } }, { heat:'shade-reviewed' }],
    ['exposure', { verification:{ tier:'route-audited', categories:{ exposure:'unknown' } } }, { exposure:'none-reviewed' }],
    ['access', { verification:{ tier:'route-audited', categories:{ access:'unknown' } } }, { access:'leash-ok-reviewed' }],
  ])('unknown %s data never becomes a positive match', (_name, overrides, state) => {
    expect(filters.matches(trail(overrides), state)).toBe(false);
  });

  test('access filter excludes reviewed prohibitions', () => {
    const prohibited = trail({
      suitability:{
        safetyLevel:'low-risk', terrainRank:0, shadePercent:60,
        heatRisk:'low', exposure:false, surfaceHazards:[],
        dogAccess:{ status:'prohibited', notes:'No dogs' },
      },
    });
    expect(filters.matches(prohibited, { access:'leash-ok-reviewed' })).toBe(false);
  });

  test('zero-result diagnosis names restrictive filters and safe broadening', () => {
    const catalog = [trail(), trail({ id:'long', metrics:{ distanceKm:8 }, distance:8 })];
    const state = { distance:'3', terrain:'soft' };
    const diagnosis = filters.diagnoseZero(catalog, state);

    expect(diagnosis.restrictive.map(item => item.label)).toContain('Up to 3 km');
    expect(diagnosis.broadenings).toEqual(expect.arrayContaining([
      expect.objectContaining({ label:'Widen distance to 5 km', count:1 }),
    ]));
  });
});
