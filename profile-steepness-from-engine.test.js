const fs = require('fs');
const path = require('path');
const vm = require('vm');

// scoring.js is a page script: run it the way the page does, beside the engine.
function runtime(){
  const ctx = { console, Date, Math, JSON };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for(const file of ['breeds-data.js', 'data/regions/dolomites-trails.js', 'scoring/recommendation-v1.js', 'scoring/recommendation-adapters-v1.js', 'scoring.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), ctx, { filename:file });
  }
  return {
    adapters: ctx.DoloPawsRecommendationAdaptersV1,
    effectiveOverrides: vm.runInContext('effectiveOverrides', ctx),
    scoreTrail: vm.runInContext('scoreTrail', ctx),
    trails: ctx.trails,
  };
}

const { adapters, effectiveOverrides, scoreTrail, trails } = runtime();

// A steep walk (rank 2) with nothing else against it.
const steepWalk = {
  id:'steep', name:'Steep', distance:4, elevation:150, hours:1.5, terrainRank:2,
  shadeCoverage:60, heatRisk:'low', exposure:false, safetyLevel:'low-risk',
  waterSources:[], surfaceHazards:[], desc:'Dogs are allowed on this route.',
};
const healthy = { name:'Teo', fitness:'moderate', ageBand:'3-4', weightBand:'20-30', conditions:[] };

const tolerance = subject => adapters.recommendLegacyTrail(steepWalk, subject, null, { month:7 })
  .effectiveDogLimits.terrainRank;

describe('a real dog\'s steepness limit comes from the engine, not the old fitness default', () => {
  test('a healthy moderate dog is not held back by a steep walk (scoring 1.9.0)', () => {
    expect(tolerance(effectiveOverrides(healthy, null))).toBe(2);
  });

  test('one limit leaves moderately steep, as the engine says (1.10.0)', () => {
    expect(tolerance(effectiveOverrides({ ...healthy, ageBand:'9-10' }, null))).toBe(1);
    expect(tolerance(effectiveOverrides({ ...healthy, conditions:['joints'] }, null))).toBe(1);
  });

  test('the owner\'s steepness answer from the dog setup counts', () => {
    expect(tolerance(effectiveOverrides({ ...healthy, steepnessLimit:0 }, null))).toBe(0);
    expect(tolerance(effectiveOverrides({ ...healthy, steepnessLimit:1 }, null))).toBe(1);
  });

  test('a steepness changed by hand still wins', () => {
    expect(tolerance(effectiveOverrides(healthy, { terrain:'0' }))).toBe(0);
    // Changing something else leaves steepness to the engine.
    expect(tolerance(effectiveOverrides(healthy, { distance:'5' }))).toBe(2);
  });

  test('a dog with no profile behind it keeps its stated limit', () => {
    expect(tolerance({ terrain:'1', distance:'10', heatSensitive:false })).toBe(1);
  });
});

describe('the gentle-only answer changes the score on every page', () => {
  const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
  const sorapis = trails.find(trail => trail.id === 'lago-sorapis');
  const score = profile => scoreTrail(sorapis, effectiveOverrides(profile, null), null);

  test('Lago di Sorapis (steepest stretch about 32%) scores lower for a gentle-only Teo', () => {
    expect(sorapis).toBeTruthy();
    const none = score(healthy);
    const moderate = score({ ...healthy, steepnessLimit:1 });
    const gentle = score({ ...healthy, steepnessLimit:0 });
    expect(moderate).toBe(none - 10);
    expect(gentle).toBe(none - 20);
  });

  // Each page scores a dog through effectiveOverrides(), so the rule above is
  // what the trail page, the browse cards and the home page show.
  test.each([
    ['trail page', 'trail-recommendation.js', /effectiveOverrides\(profile, null\)/],
    ['browse cards', 'script.js', /const overrides = profile \? effectiveOverrides\(profile, adjustOverride\)/],
    ['home page', 'homepage-search.js', /scoreTrail\(t, effectiveOverrides\(activeProfile\(\), null\)/],
  ])('the %s scores through effectiveOverrides()', (page, file, pattern) => {
    expect(read(file)).toMatch(pattern);
  });
});
