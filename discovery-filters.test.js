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

  test('duration splits day hikes from multi-day itineraries and defaults to all', () => {
    const dayHike = trail({ distance:4, metrics:{ distanceKm:4 } });
    const longRoute = trail({ distance:71.2, metrics:{ distanceKm:71.2 } });
    // Unset duration leaves the list untouched, so existing callers see both.
    expect(filters.matches(dayHike, {})).toBe(true);
    expect(filters.matches(longRoute, {})).toBe(true);
    // The default day view hides the long route; 'multi' shows only it.
    expect(filters.matches(dayHike, { duration:'day' })).toBe(true);
    expect(filters.matches(longRoute, { duration:'day' })).toBe(false);
    expect(filters.matches(dayHike, { duration:'multi' })).toBe(false);
    expect(filters.matches(longRoute, { duration:'multi' })).toBe(true);
  });

  test('the multi-day opt-in is the only duration value shown as a removable chip', () => {
    expect(filters.active({ duration:'day' }).some(entry => entry.key === 'duration')).toBe(false);
    const chip = filters.active({ duration:'multi' }).find(entry => entry.key === 'duration');
    expect(chip).toBeTruthy();
    expect(chip.label).toMatch(/multi-day/i);
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
