'use strict';

// Below 800 m snow is occasional: the walk stays in season all winter, and the
// page still says a cold spell can bring snow (owner decision, 20 November 2026).

const { snowEstimate, SNOW_OCCASIONAL_BELOW_M } = require('./scripts/trail-seasons');
const words = require('./trail-season-words');
const recommendation = require('./scoring/recommendation-v1');
const seasons = require('./data/trail-seasons.json').trails;

describe('snow below 800 m', () => {
  test('is occasional, and possible from 800 m', () => {
    expect(SNOW_OCCASIONAL_BELOW_M).toBe(800);
    expect(snowEstimate(799)).toMatchObject({ likelihood: 'occasional', months: [1, 2, 12] });
    expect(snowEstimate(800)).toMatchObject({ likelihood: 'possible', months: [1, 2, 12] });
    expect(snowEstimate(1600).likelihood).toBe('likely');
  });

  test('leaves the walk in season all year', () => {
    const season = { highPoint: 300, snow: snowEstimate(300) };
    expect(words.bestMonths(season)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(words.outOfSeason(season, 1)).toBe(false);
    expect(words.bestTime(season)).toBe('Good all year');
  });

  test('still takes the winter out of a walk from 800 m', () => {
    const season = { highPoint: 900, snow: snowEstimate(900) };
    expect(words.outOfSeason(season, 1)).toBe(true);
  });

  test('a ski run on the line still takes the winter out', () => {
    const season = { highPoint: 700, snow: snowEstimate(700), winterUse: [{ kind: 'downhill', km: 1, names: [] }] };
    expect(words.outOfSeason(season, 1)).toBe(true);
  });

  test('shows every month as snow-free and says a cold spell can bring snow', () => {
    const out = words.describe({ highPoint: 450, snow: snowEstimate(450) }, 1);
    expect(out.strip.every(month => month.state === 'good')).toBe(true);
    expect(out.line).toMatch(/^Usually snow-free all year\. After a cold spell, snow can lie for a few days/);
    expect(out.legend).toEqual([['good', 'Usually snow-free']]);
  });

  test('the score agrees with the page', () => {
    // The score keeps its own copy of bestMonths: a walk below 800 m is in
    // season in January there too, and one from 800 m is not.
    const score = (highPoint, month) => recommendation.calculateRecommendation({
      dog: { size: 'medium', age: 'adult', fitness: 'moderate' },
      month,
      trail: {
        metrics: { distanceKm: 5, ascentM: 200, descentM: 200 },
        suitability: { terrainRank: 0, exposure: false, heatRisk: 'low', dogAccess: { status: 'allowed' }, lift: { type: 'none', dependency: 'none' }, season: { highPoint, snow: snowEstimate(highPoint) } },
        verification: { tier: 'route-audited', categories: {} },
      },
    });
    const codes = out => out.cautions.map(c => c.code).concat(out.positiveReasons.map(c => c.code));
    expect(codes(score(450, 1))).not.toContain('trail.season.outside');
    expect(score(450, 1).score).toBeGreaterThan(score(900, 1).score);
    expect(codes(score(900, 1))).toContain('trail.season.outside');
  });
});

describe('the season file', () => {
  test('marks every estimated walk below 800 m occasional, and none above', () => {
    for(const [id, season] of Object.entries(seasons)){
      if(!season.snow) continue;
      const below = season.snow.highPoint < SNOW_OCCASIONAL_BELOW_M;
      if(season.snow.likelihood === 'occasional') expect([id, below]).toEqual([id, true]);
      if(below) expect([id, season.snow.likelihood]).toEqual([id, 'occasional']);
    }
  });
});
