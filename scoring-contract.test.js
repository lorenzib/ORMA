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
    expect(scoring.VERSION).toBe('1.5.0');
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

  // ---- SCORE-03 behaviour-aware fit -------------------------------------

  const reviewedCategories = {
    route:'verified', water:'verified', heat:'verified', exposure:'verified',
    livestock:'verified', surfaceHazards:'verified', access:'verified',
  };
  const idealPhysicalRoute = {
    metrics:{ distanceKm:4, ascentM:100, descentM:100 },
    suitability:{
      terrainRank:0, shadePercent:70, heatRisk:'low', exposure:false,
      surfaceHazards:[], dogAccess:{ status:'allowed' },
    },
    waypoints:[{ type:'water', status:'reviewed' }],
    verification:{ tier:'field-verified', categories:reviewedCategories },
  };
  const steadyDog = { fitness:'moderate', ageYears:4, weightKg:22, conditions:[] };

  function scoreWith(trailOverrides, behaviour){
    return scoring.calculateRecommendation({
      dog:{ ...steadyDog, ...(behaviour ? { behaviour } : {}) },
      trail:{
        ...idealPhysicalRoute,
        ...trailOverrides,
        suitability:{ ...idealPhysicalRoute.suitability, ...(trailOverrides.suitability || {}) },
      },
    });
  }

  test('a positioned advisory names its kilometres and is exposed for navigation', () => {
    const result = scoreWith({
      segments:[{
        id:'upper-pasture', type:'livestock', fromKm:2.1, toKm:3.4,
        advisory:'leash-recommended', note:'open grazing pasture',
        status:'reviewed', seasonal:true,
      }],
    }, { recall:'variable' });
    const advisory = result.cautions.find(entry => entry.messageKey === 'segment.leash-recommended');

    expect(advisory.message).toBe(
      'Open grazing pasture between kilometres 2.1 and 3.4. Lead recommended.');
    expect(advisory.vars).toEqual(expect.objectContaining({ fromKm:2.1, toKm:3.4, type:'livestock' }));
    expect(result.leashAdvisories).toEqual([
      expect.objectContaining({ fromKm:2.1, toKm:3.4, advisory:'leash-recommended' }),
    ]);
  });

  test('two advisories of the same kind on one route both survive', () => {
    const result = scoreWith({
      segments:[
        { id:'lower', type:'livestock', fromKm:5.0, toKm:6.2, advisory:'leash-recommended',
          note:null, status:'reviewed', seasonal:null },
        { id:'upper', type:'livestock', fromKm:2.1, toKm:3.4, advisory:'leash-recommended',
          note:null, status:'reviewed', seasonal:null },
      ],
    }, { recall:'variable' });
    const advisories = result.cautions.filter(entry => entry.messageKey === 'segment.leash-recommended');

    // Ordered by start distance so navigation can consume them directly.
    expect(advisories).toHaveLength(2);
    expect(result.leashAdvisories.map(entry => entry.fromKm)).toEqual([2.1, 5]);
  });

  test('an advisory that cannot be placed on the route is dropped, not shown vaguely', () => {
    const result = scoreWith({
      segments:[
        { id:'bad-order', type:'livestock', fromKm:4, toKm:2, advisory:'leash-recommended',
          status:'reviewed' },
        { id:'no-range', type:'livestock', fromKm:null, toKm:null, advisory:'leash-recommended',
          status:'reviewed' },
      ],
    }, { recall:'variable' });

    expect(result.leashAdvisories).toEqual([]);
    expect(result.cautions.some(entry => /kilometres/.test(entry.message))).toBe(false);
  });

  test('undeclared behaviour neither penalises nor reassures', () => {
    const hostile = {
      suitability:{
        livestockPresence:'likely', wildlifePresence:'high', sightlines:'restricted',
        roadProximity:'alongside', crowding:'busy',
      },
    };
    const silent = scoreWith(hostile, undefined);
    const baseline = scoreWith({}, undefined);

    expect(silent.score).toBe(baseline.score);
    expect(silent.behaviourDeclaredCount).toBe(0);
    expect(silent.cautions.map(entry => entry.code)).not.toContain('trail.livestock.behaviour-risk');
    // Silence runs both ways: a quiet route must not be talked up either.
    expect(scoreWith({ suitability:{ livestockPresence:'none', crowding:'quiet' } }, undefined)
      .positiveReasons.map(entry => entry.code)).not.toContain('trail.livestock.none');
  });

  test('behaviour can move a route out of strong option but never outweighs the route', () => {
    const hostile = {
      suitability:{
        livestockPresence:'likely', wildlifePresence:'high', sightlines:'restricted',
        roadProximity:'alongside', crowding:'busy',
      },
    };
    const hardest = scoreWith(hostile, {
      recall:'unreliable', reactivity:'strong', preyDrive:'high',
      livestockComfort:'reactive', trafficComfort:'reactive',
      crowdComfort:'reactive', heatTolerance:'low',
    });

    // Every rule fires at its hardest, so the uncapped load far exceeds the
    // cap; the deduction must still stop at 45 off an otherwise ideal route.
    // A route this wrong for this dog should indeed read as not recommended.
    expect(hardest.score).toBe(55);
    expect(hardest.category).toBe('not-recommended');
    // But behaviour is a fit signal, never a prohibition: it must not reach
    // the hard-stop floor reserved for routes that ban dogs outright.
    expect(hardest.hardStops).toEqual([]);
    expect(hardest.score).toBeGreaterThan(
      scoreWith({ suitability:{ dogAccess:{ status:'prohibited' } } }, undefined).score);
  });

  test('reassurance requires reviewed evidence, warnings do not', () => {
    const unreviewed = {
      route:'unreviewed', water:'unreviewed', heat:'unreviewed', exposure:'unreviewed',
      livestock:'unreviewed', surfaceHazards:'unreviewed', access:'unreviewed',
    };
    const result = scoring.calculateRecommendation({
      dog:steadyDog,
      trail:{
        ...idealPhysicalRoute,
        suitability:{ ...idealPhysicalRoute.suitability, heatRisk:'moderate', shadePercent:30 },
        verification:{ tier:'imported', categories:unreviewed },
      },
    });
    const codes = result.positiveReasons.map(entry => entry.code);

    // "No exposed section is recorded" on a route nobody reviewed is a safety
    // claim dressed as a fact. It must not appear.
    expect(codes).not.toContain('trail.exposure.none-known');
    expect(codes).not.toContain('trail.terrain.within-tolerance');
    expect(codes).not.toContain('trail.dog-access.allowed');
    // Measured geometry stands on its own and still does.
    expect(codes).toContain('trail.distance.within-range');
    expect(codes).toContain('trail.ascent.within-range');
    // Warnings are never suppressed for want of a review: hiding one would
    // conceal a hazard and leave its penalty unexplained.
    expect(result.cautions.map(entry => entry.code)).toEqual(
      expect.arrayContaining(['trail.heat.moderate', 'trail.shade.low']));
  });

  test('the same reassurance appears once the evidence is reviewed', () => {
    const result = scoreWith({}, undefined);
    expect(result.positiveReasons.map(entry => entry.code)).toEqual(
      expect.arrayContaining([
        'trail.exposure.none-known', 'trail.terrain.within-tolerance', 'trail.dog-access.allowed',
      ]));
  });

  test('an unconfirmed advisory waits for confirmation instead of being shown', () => {
    const reported = scoreWith({
      segments:[{ id:'walker-report', type:'livestock', fromKm:2.1, toKm:3.4,
        advisory:'leash-recommended', note:'cattle seen here', status:'reported' }],
    }, { recall:'variable' });

    expect(reported.leashAdvisories).toEqual([]);
    expect(reported.cautions.some(entry => /kilometres/.test(entry.message))).toBe(false);
  });

  // ---- P0-1 the score explains itself ------------------------------------

  test('every factor carries what it cost, and the costs add up to the score', () => {
    const result = scoring.calculateRecommendation({
      dog:{ ...steadyDog, conditions:['heat'], traits:{ heatSensitive:true } },
      trail:{
        ...idealPhysicalRoute,
        metrics:{ distanceKm:12, ascentM:700, descentM:700 },
        suitability:{ ...idealPhysicalRoute.suitability, terrainRank:2, exposure:true,
          heatRisk:'high', shadePercent:15, surfaceHazards:['Loose scree'] },
      },
      currentConditions:{ status:'known', heatRisk:'high' },
    });

    // A breakdown whose numbers do not reach the number on the card is worse
    // than no breakdown, so this is the property the whole story rests on.
    const total = result.factors.reduce((sum, factor) => sum + factor.impact, 0);
    expect(100 + total).toBe(result.score);
    expect(result.factors.every(factor => Number.isFinite(factor.impact))).toBe(true);
  });

  test('the breakdown is ordered by impact, top negative first', () => {
    const result = scoring.calculateRecommendation({
      dog:{ ...steadyDog, conditions:['heat'], traits:{ heatSensitive:true } },
      trail:{
        ...idealPhysicalRoute,
        metrics:{ distanceKm:12, ascentM:700, descentM:700 },
        suitability:{ ...idealPhysicalRoute.suitability, terrainRank:2, exposure:true, heatRisk:'high' },
      },
    });
    const impacts = result.factors.map(factor => factor.impact);

    expect(impacts).toEqual([...impacts].sort((a, b) => a - b));
    expect(impacts[0]).toBeLessThan(0);
  });

  test('no factor is a bare label or a bare number', () => {
    const result = scoring.calculateRecommendation({
      dog:steadyDog,
      trail:{ ...idealPhysicalRoute, metrics:{ distanceKm:30, ascentM:100, descentM:100 } },
    });

    result.factors.forEach(factor => {
      expect(typeof factor.message).toBe('string');
      // A reason, not a label: a sentence with something to act on.
      expect(factor.message.trim().split(/\s+/).length).toBeGreaterThan(3);
      expect(factor.code).toEqual(expect.any(String));
    });
  });

  test('a capped behaviour load is shared across its factors, not dumped on one', () => {
    const hostile = {
      suitability:{ livestockPresence:'likely', wildlifePresence:'high', sightlines:'restricted',
        roadProximity:'alongside', crowding:'busy' },
    };
    const result = scoreWith(hostile, {
      recall:'unreliable', reactivity:'strong', preyDrive:'high',
      livestockComfort:'reactive', trafficComfort:'reactive', crowdComfort:'reactive',
    });
    const behaviour = result.factors.filter(factor => /livestock|wildlife|sightlines|road|crowding/.test(factor.code));
    const charged = behaviour.reduce((sum, factor) => sum + factor.impact, 0);

    // Uncapped the load far exceeds 45; every factor shrinks together so the
    // recorded costs still match the 45 actually deducted.
    expect(behaviour.length).toBeGreaterThan(3);
    expect(behaviour.every(factor => factor.impact < 0)).toBe(true);
    expect(Math.abs(charged)).toBe(45);
  });

  test('every ceiling on the score is recorded as a factor', () => {
    // Regression: an earlier pass recorded the seasonal cap's cost but dropped
    // the cap itself, so the score silently stopped being held at 84.
    const seasonal = scoreWith({
      suitability:{ dogAccess:{ status:'seasonal-restrictions' } },
    }, undefined);
    expect(seasonal.score).toBe(84);
    expect(seasonal.factors.find(factor => factor.code === 'trail.dog-access.seasonal').impact).toBe(-16);

    // Unreviewed safety evidence holds a route below a strong option, and that
    // deduction has to be visible in the breakdown like any other.
    const unreviewed = scoring.calculateRecommendation({
      dog:steadyDog,
      trail:{ ...idealPhysicalRoute, verification:{ tier:'imported', categories:{
        route:'unreviewed', water:'unreviewed', heat:'unreviewed', exposure:'unreviewed',
        livestock:'unreviewed', surfaceHazards:'unreviewed', access:'unreviewed',
      } } },
    });
    expect(unreviewed.score).toBe(80);
    expect(unreviewed.factors.find(factor => factor.code === 'evidence.critical.capped').impact).toBe(-20);
  });

  test('the breakdown reconciles and stays ordered across the whole input space', () => {
    // The two properties the story depends on, checked by construction rather
    // than by example: a breakdown that does not add up to the number on the
    // card, or that is not sorted, is worse than showing nothing.
    const pick = (list, seed) => list[seed % list.length];
    let checked = 0;

    for(let seed = 0; seed < 1500; seed += 1){
      const result = scoring.calculateRecommendation({
        dog:{
          fitness:pick(['low', 'moderate', 'high', undefined], seed),
          ageYears:pick([0.5, 4, 9, 12, null], seed >> 2),
          weightKg:pick([4, 22, 50, null], seed >> 3),
          conditions:pick([[], ['heat'], ['joints'], ['cardiac', 'overweight']], seed >> 4),
          behaviour:{
            recall:pick([undefined, 'reliable', 'unreliable'], seed >> 5),
            preyDrive:pick([undefined, 'low', 'high'], seed >> 6),
            livestockComfort:pick([undefined, 'confident', 'reactive'], seed >> 7),
            crowdComfort:pick([undefined, 'reactive'], seed >> 8),
            trafficComfort:pick([undefined, 'reactive'], seed >> 9),
          },
        },
        trail:{
          metrics:{ distanceKm:pick([2, 12, 25, null], seed), ascentM:pick([50, 900, null], seed >> 2),
            descentM:pick([50, 500, null], seed >> 3), durationMinutes:pick([60, 200, null], seed >> 4) },
          suitability:{
            terrainRank:pick([0, 1, 3, null], seed >> 1), exposure:pick([true, false, null], seed >> 2),
            heatRisk:pick(['low', 'high', 'unknown'], seed >> 3), shadePercent:pick([10, 70, null], seed >> 4),
            surfaceHazards:pick([[], ['a'], ['a', 'b']], seed >> 5),
            dogAccess:{ status:pick(['allowed', 'seasonal-restrictions', 'prohibited', 'unknown'], seed >> 6) },
            livestockPresence:pick(['none', 'likely', 'unknown'], seed >> 7),
            wildlifePresence:pick(['low', 'high', 'unknown'], seed >> 8),
            sightlines:pick(['open', 'restricted', 'unknown'], seed >> 9),
            roadProximity:pick(['none', 'alongside', 'unknown'], seed >> 10),
            crowding:pick(['quiet', 'busy', 'unknown'], seed >> 11),
          },
          waypoints:[],
          verification:{ tier:'field-verified', categories:Object.fromEntries(
            ['route', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access']
              .map((name, index) => [name, pick(['verified', 'unreviewed'], (seed >> index) + index)])) },
        },
        currentConditions:pick([{ status:'not-provided' }, { status:'known', heatRisk:'high' }], seed >> 12),
      });

      const total = result.factors.reduce((sum, factor) => sum + factor.impact, 0);
      expect(100 + total).toBe(result.score);
      const impacts = result.factors.map(factor => factor.impact);
      expect(impacts).toEqual([...impacts].sort((a, b) => a - b));
      checked += 1;
    }

    expect(checked).toBe(1500);
  });

  test('a declared robust heat tolerance never clears a medical heat risk', () => {
    const result = scoring.calculateRecommendation({
      dog:{ ...steadyDog, conditions:['cardiac'], behaviour:{ heatTolerance:'robust' } },
      trail:idealPhysicalRoute,
    });

    expect(result.effectiveDogLimits.heatSensitive).toBe(true);
  });

  test('reviewed water points are counted rather than reported as at least one', () => {
    const result = scoreWith({
      waypoints:[
        { type:'water', status:'reviewed' },
        { type:'water', status:'reviewed' },
        { type:'water', status:'mapped' },
      ],
    }, undefined);
    const water = result.positiveReasons.find(entry => entry.code === 'trail.water.reviewed');

    expect(water.message).toBe('Water is available at 2 reviewed points.');
    expect(water.vars).toEqual({ count:2 });
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
