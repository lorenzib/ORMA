const words = require('./trail-season-words.js');
const { applyTrailSeasons } = require('./scripts/trail-seasons');
const { loadProductionTrails } = require('./scripts/load-production-trails');

// A winter walk is the board's winter tour of a path, with its own record
// (id winter-...). It is offered from November to April only: outside those
// months it is out of season and off the lists, like a high-mountain walk.
describe('winter walks are offered only in winter', () => {
  const source = { label: 'Outdooractive', url: 'https://example.com', accessedAt: '2026-11-07' };
  const allYear = { winterWalk: true, highPoint: 1070, recommended: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], source } };
  const shortWinter = { winterWalk: true, highPoint: 1320, recommended: { months: [1, 2, 11, 12], source } };

  test('the loader marks a winter- record as a winter walk, and no other', () => {
    const artifact = { trails: { 'winter-a': { highPoint: 1000 }, 'summer-b': { highPoint: 1000 } } };
    const [winter, summer] = applyTrailSeasons([{ id: 'winter-a' }, { id: 'summer-b' }], artifact);
    expect(winter.season.winterWalk).toBe(true);
    expect(summer.season.winterWalk).toBeUndefined();
  });

  test('best months are the board months that fall in November to April', () => {
    expect(words.bestMonths(allYear)).toEqual([1, 2, 3, 4, 11, 12]);
    expect(words.bestMonths(shortWinter)).toEqual([1, 2, 11, 12]);
    expect(words.bestTime(allYear)).toBe('Best time: November to April');
  });

  test('hidden out of winter and in the board’s off months, shown in winter', () => {
    expect(words.hiddenThisMonth(allYear, 7)).toBe(true);
    expect(words.hiddenThisMonth(allYear, 1)).toBe(false);
    expect(words.hiddenThisMonth(shortWinter, 3)).toBe(true);
    expect(words.hiddenThisMonth(shortWinter, 12)).toBe(false);
  });

  test('the month strip and this month’s sentence agree with the tag', () => {
    const shown = words.describe(allYear);
    expect(shown.strip.filter(m => m.state === 'good').map(m => m.month)).toEqual([1, 2, 3, 4, 11, 12]);
    expect(shown.line).toBe('A winter walk, recommended from November to April.');
    expect(words.nowNote(allYear, 7)).toBe('July is outside winter, and this is the winter walk.');
    expect(words.nowNote(allYear, 1)).toBe('January is in this walk’s season.');
  });

  test('the three live winter walks carry the flag and sit out the summer', () => {
    const trails = loadProductionTrails(__dirname).filter(trail => trail.id.startsWith('winter-'));
    expect(trails.map(trail => trail.id).sort()).toEqual(['winter-pozza-canto-acqua', 'winter-steinegg-osservatorio', 'winter-voels-voelser-weiher']);
    trails.forEach(trail => {
      expect(trail.season.winterWalk).toBe(true);
      expect(words.hiddenThisMonth(trail.season, 7)).toBe(true);
      expect(words.hiddenThisMonth(trail.season, 12)).toBe(false);
    });
  });

  test('the match score drops a winter walk in summer, by the same rule', () => {
    const engine = require('./scoring/recommendation-v1');
    const score = month => engine.calculateRecommendation({
      dog: { size: 'medium', age: 'adult', fitness: 'moderate' },
      month,
      trail: {
        metrics: { distanceKm: 5, ascentM: 200, descentM: 200 },
        suitability: { terrainRank: 0, exposure: false, heatRisk: 'low', dogAccess: { status: 'allowed' }, lift: { type: 'none', dependency: 'none' }, season: allYear },
        verification: { tier: 'route-audited', categories: {} },
      },
    });
    expect(score(7).cautions.find(c => c.code === 'trail.season.outside').impact).toBe(-25);
    expect(score(1).positiveReasons.map(c => c.code)).toContain('trail.season.inside');
  });
});
