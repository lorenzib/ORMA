// "Total descent is unknown" sat on the card of nearly every walk, Lago di
// Braies among them, for an ordinary dog the descent can never affect. The
// figure is now worked out where the record allows it (a walk that returns to
// its start comes down its climb; a one-way walk comes down its climb less the
// net height gained), and the unknown is said only for a fragile or giant dog
// on a walk whose descent could pass the 400 m the score starts counting at.
const path = require('path');
const engine = require('./scoring/recommendation-v1.js');
const adapters = require('./scoring/recommendation-adapters-v1.js');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { buildCanonicalCatalog } = require('./scripts/trail-adapter');

const DOGS = {
  ordinary:{ fitness:'moderate', ageYears:4, weightKg:22, conditions:[] },
  senior:{ fitness:'moderate', ageYears:11, weightKg:22, conditions:[] },
  giant:{ fitness:'high', ageYears:4, weightKg:55, conditions:[] },
};

function recommend(trail, dog){
  return engine.calculateRecommendation({ dog, trail:adapters.normalizeTrail(trail) });
}
const codes = result => result.unknowns.map(entry => entry.code);

describe('descent figure', () => {
  test('a loop comes down as far as it climbs', () => {
    expect(adapters.descentM({ elevation:39, routeShape:'loop' })).toBe(39);
    expect(adapters.descentM({ elevation:120, path:[[46.7, 12.08], [46.71, 12.09], [46.70001, 12.08001]] })).toBe(120);
  });

  test('a one-way walk comes down its climb less the height it gains', () => {
    const walk = { elevation:300, routeShape:'point-to-point',
      elevationProfile:[{ km:0, elev:2000 }, { km:3, elev:2200 }, { km:6, elev:1500 }] };
    expect(adapters.descentM(walk)).toBe(800);
  });

  test('a stated descent wins, and nothing is guessed without a climb or profile', () => {
    expect(adapters.descentM({ elevation:300, descent:520, routeShape:'loop' })).toBe(520);
    expect(adapters.descentM({ elevation:null, routeShape:'loop' })).toBeNull();
    expect(adapters.descentM({ elevation:300, routeShape:'point-to-point' })).toBeNull();
  });

  test('the walk pages read the same figure', () => {
    const catalog = buildCanonicalCatalog(loadProductionTrails(path.resolve(__dirname)));
    const braies = catalog.records.find(record => record.id === 'lago-braies');
    expect(braies.metrics.descentM).toBe(braies.metrics.ascentM);
    expect(braies.unknownFields).not.toContain('/metrics/descentM');
  });
});

describe('unknown descent on the card', () => {
  const trails = loadProductionTrails(path.resolve(__dirname));

  test('Lago di Braies no longer says it for an ordinary dog', () => {
    const braies = trails.find(trail => trail.id === 'lago-braies');
    expect(codes(recommend(braies, DOGS.ordinary))).not.toContain('trail.descent.unknown');
  });

  test('it is said only where the descent could be scored', () => {
    const tall = { elevation:650, routeShape:'point-to-point', distance:9, terrainRank:1 };
    const short = { elevation:120, distance:4, terrainRank:0 };
    expect(codes(recommend(tall, DOGS.ordinary))).not.toContain('trail.descent.unknown');
    expect(codes(recommend(tall, DOGS.senior))).toContain('trail.descent.unknown');
    expect(codes(recommend(tall, DOGS.giant))).toContain('trail.descent.unknown');
    // A one-way walk can come down further than it climbs, so the climb alone
    // does not rule it out; a closed loop with a small climb does.
    const engineLoop = { metrics:{ distanceKm:4, ascentM:120, descentM:null, routeType:'loop' },
      suitability:{ terrainRank:0 }, verification:{ categories:{} } };
    const result = engine.calculateRecommendation({ dog:DOGS.senior, trail:engineLoop });
    expect(codes(result)).not.toContain('trail.descent.unknown');
    expect(codes(recommend(short, DOGS.senior))).toContain('trail.descent.unknown');
  });

  test('an unknown descent never moves the score, for any published walk and dog', () => {
    // Every published walk has a figure now, so each is scored with it taken
    // away: unknown must cost exactly what no descent at all costs.
    for(const trail of trails){
      const parts = adapters.normalizeTrail(trail);
      for(const dog of Object.values(DOGS)){
        const score = descentM => engine.calculateRecommendation({
          dog, trail:{ ...parts, metrics:{ ...parts.metrics, descentM } },
        });
        const unknown = score(null);
        const none = score(0);
        expect([trail.id, unknown.score, unknown.category]).toEqual([trail.id, none.score, none.category]);
        expect(unknown.factors.some(entry => /descent/.test(entry.code))).toBe(false);
      }
    }
  });

  test('every published walk has a descent', () => {
    expect(trails.filter(trail => adapters.descentM(trail) === null).map(trail => trail.id)).toEqual([]);
  });
});
