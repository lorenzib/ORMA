const fs = require('fs');
const path = require('path');
const vm = require('vm');
const weatherWindow = require('./trail-weather-window');
const engine = require('./scoring/recommendation-v1.js');
const { loadProductionTrails } = require('./scripts/load-production-trails');

// A route's sun exposure is a risk on a warm day, not a fact about the route
// in every season. On 28 Oct 2026, at 11 °C, the Val Gardena railway walk told
// a heat-sensitive dog "This route tends to run warm", "There is very little
// shade" and "Hot tarmac", and its safety notes sent the reader to an
// overheating guide. The forecast for the walk day now decides.

// The trail the complaint was about, as the site publishes it.
const TRAIL = loadProductionTrails(__dirname).find(trail => trail.id === 'sentiero-del-trenino');
const CANONICAL = require('./scoring/recommendation-adapters-v1.js').normalizeTrail(TRAIL);
const SUBJECT = { terrain:'1', distance:'14', heatSensitive:true };

function day(temps, start = '2026-10-28T08:00'){
  const date = start.slice(0, 10);
  const first = Number(start.slice(11, 13));
  return weatherWindow.currentConditions({
    currentTime:start,
    temperatureC:temps[0],
    hourlyTimes:temps.map((_, index) => `${date}T${String(first + index).padStart(2, '0')}:00`),
    hourlyTemps:temps,
  });
}
const AUTUMN = day([8, 9, 10, 11, 11, 10, 9]);
const SUMMER = day([20, 23, 26, 29, 30, 29, 27], '2026-07-15T08:00');

// The browser's own stack, in the order the trail-page bundle loads it.
function loadPage(){
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    'trust/evidence-v1.js',
    'scoring/recommendation-v1.js',
    'scoring/recommendation-adapters-v1.js',
    'scoring.js',
    'trail-trust.js',
  ].forEach(file => vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context));
  return {
    recommend: conditions => vm.runInContext(
      `recommendTrail(${JSON.stringify(TRAIL)}, ${JSON.stringify(SUBJECT)}, ${JSON.stringify(conditions)})`, context),
    trust: context.DoloPawsTrailTrust,
  };
}

const codes = recommendation => recommendation.factors.map(factor => factor.code);
const hazardsLine = recommendation => {
  const entry = recommendation.factors.find(factor => factor.code === 'trail.surface-hazards.present');
  return entry ? entry.message : '';
};

describe('the walk-day forecast decides whether heat matters', () => {
  test('the snapshot carries the warmest the rest of the day gets', () => {
    expect(AUTUMN.dayMaxC).toBe(11);
    expect(SUMMER.dayMaxC).toBe(30);
    // A cool morning is not a cool day.
    expect(day([12, 16, 20, 24]).dayMaxC).toBe(24);
    expect(engine.isCoolDay(day([12, 16, 20, 24]))).toBe(false);
  });

  test('a snapshot without a day maximum assumes nothing', () => {
    expect(engine.isCoolDay({ status:'known', heatRisk:'low' })).toBe(false);
    expect(engine.isCoolDay({ status:'known', heatRisk:'low', dayMaxC:null })).toBe(false);
    expect(engine.isCoolDay({ status:'not-provided' })).toBe(false);
  });

  test('a caution only about heat is told apart from one that is not', () => {
    expect(engine.isHeatOnlyHazard('Hot tarmac (about 80% paved)')).toBe(true);
    expect(engine.isHeatOnlyHazard('Little shade on hot days')).toBe(true);
    expect(engine.isHeatOnlyHazard('Asphalt farm lanes that heat up in sun')).toBe(true);
    expect(engine.isHeatOnlyHazard('Open ridge: avoid the hot middle of summer days and storms')).toBe(false);
    expect(engine.isHeatOnlyHazard('Busy with cars round the hotels in summer')).toBe(false);
    expect(engine.isHeatOnlyHazard('Not advised in rain, snow or the hottest summer hours')).toBe(false);
  });
});

describe('the score', () => {
  const page = loadPage();

  test('a cool forecast charges no heat, no shade and no hot tarmac', () => {
    const autumn = page.recommend(AUTUMN);
    expect(codes(autumn)).not.toContain('trail.heat.moderate');
    expect(codes(autumn)).not.toContain('trail.shade.very-low');
    expect(hazardsLine(autumn)).not.toMatch(/hot tarmac/i);
    expect(hazardsLine(autumn)).toMatch(/SS242/);
    // 11 °C is nowhere near heat, so "today is cool enough" says nothing.
    expect(codes(autumn)).not.toContain('conditions.heat.low');
  });

  test('a hot forecast still does', () => {
    const summer = page.recommend(SUMMER);
    expect(codes(summer)).toContain('trail.heat.moderate');
    expect(codes(summer)).toContain('trail.shade.very-low');
    expect(hazardsLine(summer)).toMatch(/hot tarmac/i);
    expect(page.recommend(AUTUMN).score).toBeGreaterThan(summer.score);
  });

  test('with no forecast the route keeps its summer reading', () => {
    const unknown = page.recommend({ status:'not-provided' });
    expect(codes(unknown)).toContain('trail.heat.moderate');
    expect(codes(unknown)).toContain('trail.shade.very-low');
  });

  test('a small dog on a cold day gets a note that costs nothing', () => {
    const cold = day([0, 1, 2, 3, 3]);
    const small = engine.calculateRecommendation({
      dog:{ fitness:'moderate', ageYears:4, weightKg:4 }, trail:CANONICAL, currentConditions:cold,
    });
    const note = small.cautions.find(entry => entry.code === 'conditions.cold.small');
    expect(note).toBeTruthy();
    expect(note.impact).toBe(0);
    const big = engine.calculateRecommendation({
      dog:{ fitness:'moderate', ageYears:4, weightKg:25 }, trail:CANONICAL, currentConditions:cold,
    });
    expect(big.cautions.map(entry => entry.code)).not.toContain('conditions.cold.small');
  });
});

describe('Important for your dog', () => {
  const { trust } = loadPage();

  test('on a cool day there is no heat row and no hot tarmac', () => {
    expect(trust.heatAssessment(TRAIL, AUTUMN).ok).toBe(true);
    const surface = trust.surfaceAssessment(TRAIL);
    const traffic = trust.trafficAssessment(TRAIL);
    expect(JSON.stringify([surface, traffic])).not.toMatch(/hot/i);
  });

  test('on a hot day the heat row names the hot tarmac', () => {
    const heat = trust.heatAssessment(TRAIL, SUMMER);
    expect(heat.ok).toBe(false);
    expect(heat.items).toEqual(['Hot tarmac (about 80% paved)']);
  });

  test('a cold day gives cold advice and no overheating guide', () => {
    const cold = trust.heatAssessment(TRAIL, day([0, 1, 2, 3]));
    expect(cold.ok).toBe(false);
    expect(cold.title).toBe('Cold day');
    expect(cold.guide).toBeNull();
  });

  test('cars and bikes are a traffic row, not a surface hazard', () => {
    expect(trust.trafficAssessment(TRAIL).items).toEqual([
      'About 200 m beside the SS242 state road in St. Christina',
      'Several SS242 crossings',
      'Village streets with traffic',
      'Shared cycle path',
    ]);
    // Nothing left underfoot to warn about on a flat railway grade.
    expect(trust.surfaceAssessment(TRAIL)).toBeNull();
  });

  test('the surface row says what is underfoot, then each caution', () => {
    const rough = { ...TRAIL, terrainRank:1, terrainType:'Rocky path: roots and scree', surfaceHazards:['Loose scree below the col', 'Village streets with traffic'] };
    const surface = trust.surfaceAssessment(rough);
    expect(surface.detail).toBe('Underfoot: rocky path, roots and scree. Check pads at breaks.');
    expect(surface.items).toEqual(['Loose scree below the col']);
  });
});

// On 30 Oct 2026 the Lago di Braies card told Teo "Today is cool enough." In
// late October that is always true, and it took a slot from a reason that
// said something. Heat is a real risk in summer, or on a very hot spring day,
// so that is when the reason is shown.
describe('"Today is cool enough" only when heat was a question', () => {
  const decision = require('./recommendation-decision.js');
  const BRAIES = require('./scoring/recommendation-adapters-v1.js').normalizeTrail(
    loadProductionTrails(__dirname).find(trail => trail.id === 'lago-braies'));
  const ORDINARY = { fitness:'moderate', ageYears:4, weightKg:20 };
  const SENSITIVE = { ...ORDINARY, traits:{ heatSensitive:true } };
  const run = (dog, conditions) => engine.calculateRecommendation({ dog, trail:BRAIES, currentConditions:conditions });
  const shown = result => result.positiveReasons.map(entry => entry.code).includes('conditions.heat.low');
  const fits = result => decision.present(result, { dogName:'Teo' }).fits;

  test('the snapshot carries the walk day at the trailhead', () => {
    expect(day([8, 9], '2026-10-30T09:00').date).toBe('2026-10-30');
  });

  test('the spring line is the one the score charges from, for every dog', () => {
    expect(engine.COOL_DAY_MAX_C).toBe(weatherWindow.WARM_C);
    expect(engine.HEAT_QUESTION_MARGIN_C).toBe(5);
  });

  test('a cool October day for an ordinary dog lists no heat reason', () => {
    const october = run(ORDINARY, day([4, 6, 8, 9, 9, 8], '2026-10-30T09:00'));
    expect(shown(october)).toBe(false);
    expect(october.positiveReasons.map(entry => entry.code)).not.toContain('trail.heat.low');
    expect(fits(october)).not.toContain('Today is cool enough.');
  });

  test('autumn and winter never list it, even on a mild day', () => {
    expect(shown(run(SENSITIVE, day([14, 17, 19, 20, 21], '2026-09-20T09:00')))).toBe(false);
    expect(shown(run(SENSITIVE, day([12, 15, 18, 19], '2026-02-15T10:00')))).toBe(false);
  });

  test('summer lists it whenever the day stays cool, for any dog', () => {
    const july = run(ORDINARY, day([10, 12, 14, 15, 14], '2026-07-15T08:00'));
    expect(shown(july)).toBe(true);
    expect(fits(july)).toContain('Today is cool enough.');
  });

  test('a warm spring day just under a heat-sensitive dog\'s line still lists it', () => {
    const warm = day([15, 17, 19, 20, 21, 20], '2026-05-10T08:00');
    expect(warm.dayMaxC).toBeLessThan(engine.COOL_DAY_MAX_C);
    const result = run(SENSITIVE, warm);
    expect(shown(result)).toBe(true);
    expect(fits(result)).toContain('Today is cool enough.');
  });

  test('an ordinary spring day does not, and the score does not move', () => {
    // 16 °C and 17 °C sit either side of the margin and are both cool days,
    // so nothing else in the reading changes between them.
    const quiet = run(SENSITIVE, day([12, 14, 16, 16], '2026-04-20T09:00'));
    const warmer = run(SENSITIVE, day([12, 14, 17, 17], '2026-04-20T09:00'));
    expect(shown(quiet)).toBe(false);
    expect(shown(warmer)).toBe(true);
    expect(quiet.score).toBe(warmer.score);
    expect(quiet.category).toBe(warmer.category);
  });

  test('a snapshot without a date falls back to the forecast', () => {
    expect(engine.heatWasAQuestion({ status:'known', heatRisk:'low', temperatureC:10 })).toBe(false);
    expect(engine.heatWasAQuestion({ status:'known', heatRisk:'low', temperatureC:19 })).toBe(true);
    // Knowing nothing, it keeps saying what it said before.
    expect(engine.heatWasAQuestion({ status:'known', heatRisk:'low' })).toBe(true);
  });
});
