const scoring = require('./scoring/recommendation-v1.js');
const fixtures = require('./scoring/fixtures-v1.json');

function run(fixture){
  return scoring.calculateRecommendation({
    dog: fixture.dog,
    trail: fixtures.trailFixtures[fixture.trail],
    currentConditions: fixture.currentConditions,
  });
}

describe('SCORE-01 canonical recommendation contract', () => {
  test('the fixture set and calculator use the same immutable version', () => {
    expect(scoring.VERSION).toBe('1.1.0');
    expect(fixtures.scoringVersion).toBe(scoring.VERSION);
  });

  test.each(fixtures.cases)('$id matches the reviewed product decision', fixture => {
    const result = run(fixture);
    expect({
      score: result.score,
      category: result.category,
      confidence: result.confidence,
    }).toEqual(fixture.expected);
  });

  test.each(fixtures.cases)('$id returns the complete explanation shape', fixture => {
    const result = run(fixture);
    expect(result.scoringVersion).toBe(scoring.VERSION);
    expect(Array.isArray(result.positiveReasons)).toBe(true);
    expect(Array.isArray(result.cautions)).toBe(true);
    expect(Array.isArray(result.unknowns)).toBe(true);
    expect(Array.isArray(result.hardStops)).toBe(true);
    expect(result.effectiveDogLimits).toEqual(expect.objectContaining({
      terrainRank: expect.any(Number),
      distanceKm: expect.any(Number),
      ascentM: expect.any(Number),
      heatSensitive: expect.any(Boolean),
    }));
  });

  test('unknown safety evidence never creates a high-confidence result', () => {
    const fixture = fixtures.cases.find(entry => entry.id === 'incomplete-profile-unknown-trail');
    const result = run(fixture);
    expect(result.confidence).toBe('low');
    expect(result.category).not.toBe('strong-option');
    expect(result.unknowns.map(entry => entry.code)).toEqual(
      expect.arrayContaining([
        'trail.exposure.unknown',
        'trail.dog-access.unknown',
        'evidence.route.unverified',
        'evidence.access.unverified',
      ])
    );
  });

  test('dog prohibition is a hard stop rather than a normal penalty', () => {
    const fixture = fixtures.cases.find(entry => entry.id === 'dog-access-hard-stop');
    const result = run(fixture);
    expect(result.hardStops).toEqual([
      expect.objectContaining({ code: 'trail.dog-access.prohibited' }),
    ]);
    expect(result.category).toBe('not-recommended');
    expect(result.score).toBe(5);
  });

  test('a high fitness profile still has finite planning limits', () => {
    const fixture = fixtures.cases.find(entry => entry.id === 'fit-adult-challenging-route');
    const result = run(fixture);
    expect(result.effectiveDogLimits.distanceKm).toBe(18);
    expect(result.effectiveDogLimits.ascentM).toBe(1200);
  });

  test('session adjustments stay inside the documented finite limits', () => {
    const fixture = fixtures.cases.find(entry => entry.id === 'fit-adult-challenging-route');
    const result = scoring.calculateRecommendation({
      dog: fixture.dog,
      trail: fixtures.trailFixtures[fixture.trail],
      currentConditions: fixture.currentConditions,
      effectiveLimits: { terrainRank: 99, distanceKm: 99, ascentM: 9999 },
    });
    expect(result.effectiveDogLimits).toEqual(expect.objectContaining({
      terrainRank: 2,
      distanceKm: 18,
      ascentM: 1200,
    }));
  });

  test('current conditions are independent from baseline trail heat risk', () => {
    const cool = fixtures.cases.find(entry => entry.id === 'young-dog-easy-route');
    const hot = fixtures.cases.find(entry => entry.id === 'heat-sensitive-dog-hot-day');
    const coolResult = run(cool);
    const hotResult = run(hot);
    expect(coolResult.positiveReasons.map(entry => entry.code)).toContain('trail.heat.low');
    expect(hotResult.cautions.map(entry => entry.code)).toContain('conditions.heat.high');
  });

  test('dynamic explanations expose translation metadata without changing canonical messages', () => {
    const fixture = fixtures.cases.find(entry => entry.id === 'young-dog-easy-route');
    const result = run(fixture);
    const distance = result.positiveReasons.find(entry => entry.code === 'trail.distance.within-range');

    expect(distance.message).toMatch(/km route/);
    expect(distance.messageKey).toBe('trail.distance.within-range');
    expect(distance.vars).toEqual(expect.objectContaining({ distance:expect.any(Number) }));
  });

  test('route cautions name the recorded hazards instead of showing only a count', () => {
    const result = scoring.calculateRecommendation({
      dog:{ fitness:'moderate', ageYears:4, weightKg:14 },
      trail:{
        metrics:{ distanceKm:5, ascentM:200, descentM:200 },
        suitability:{
          terrainRank:1,
          exposure:false,
          heatRisk:'low',
          shadePercent:60,
          surfaceHazards:['Loose rock', 'Paved road crossing'],
          dogAccess:{ status:'allowed' },
        },
        verification:{
          categories:{
            route:'verified', water:'verified', heat:'verified', exposure:'verified',
            livestock:'verified', surfaceHazards:'verified', access:'verified',
          },
        },
      },
    });
    const caution = result.cautions.find(entry => entry.code === 'trail.surface-hazards.present');

    expect(caution.message).toBe('Recorded route cautions: Loose rock; Paved road crossing.');
    expect(caution.vars).toEqual(expect.objectContaining({
      count:2,
      hazards:'Loose rock; Paved road crossing',
    }));
  });
});
