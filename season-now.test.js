const fs = require('fs');
const path = require('path');
const words = require('./trail-season-words');

const board = { recommended: { months: [6, 7, 8, 9, 10], source: { label: 'Outdooractive', url: 'https://www.outdooractive.com/x', accessedAt: '2026-11-06' } } };
const high = { snow: { months: [1, 2, 3, 4, 5, 11, 12], likelihood: 'likely', highPoint: 2326 } };
const low = { snow: { months: [1, 2, 12], likelihood: 'possible', highPoint: 900 } };
const allYear = { recommended: { ...board.recommended, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } };
const piste = { ...allYear, winterUse: [{ kind: 'downhill', km: 1, names: [] }] };

describe('best time and out of season', () => {
  test('the best months', () => {
    expect(words.bestMonths(board)).toEqual([6, 7, 8, 9, 10]);
    expect(words.bestMonths(high)).toEqual([6, 7, 8, 9, 10]);
    expect(words.bestMonths(low)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(words.bestMonths(piste)).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(words.bestMonths(undefined)).toBeNull();
  });

  test('say so in a few words', () => {
    expect(words.bestTime(board)).toBe('Best time: June to October');
    expect(words.bestTime(board, true)).toBe('Best time: Jun–Oct');
    expect(words.bestTime(allYear)).toBe('Good all year');
    expect(words.bestTime({ recommended: { ...board.recommended, months: [11, 12, 1, 2] } }, true)).toBe('Best time: Nov–Feb');
    expect(words.bestTime(undefined)).toBe('');
  });

  test('out of season is any month outside the best ones', () => {
    expect(words.outOfSeason(board, 11)).toBe(true);
    expect(words.outOfSeason(board, 7)).toBe(false);
    expect(words.outOfSeason(piste, 1)).toBe(true);
    expect(words.outOfSeason(allYear, 1)).toBe(false);
    expect(words.outOfSeason(undefined, 1)).toBe(false);
  });
});

describe('the match score and the season', () => {
  const engine = require('./scoring/recommendation-v1');
  const base = {
    dog: { size: 'medium', age: 'adult', fitness: 'moderate' },
    trail: {
      metrics: { distanceKm: 5, ascentM: 200, descentM: 200 },
      suitability: { terrainRank: 0, exposure: false, heatRisk: 'low', dogAccess: { status: 'allowed' }, lift: { type: 'none', dependency: 'none' } },
      verification: { tier: 'route-audited', categories: {} },
    },
  };
  const withSeason = (season, month) => engine.calculateRecommendation({
    ...base, month, trail: { ...base.trail, suitability: { ...base.trail.suitability, season } },
  });

  test('is unchanged when no month is given', () => {
    expect(withSeason(board, undefined).score).toBe(engine.calculateRecommendation(base).score);
  });

  test('drops out of season, by the same rule as the tag', () => {
    const inSeason = withSeason(board, 7);
    expect(inSeason.positiveReasons.map(c => c.code)).toContain('trail.season.inside');
    for (const [season, month] of [[board, 11], [high, 12], [piste, 2], [low, 1]]) {
      const out = withSeason(season, month);
      expect(out.cautions.find(c => c.code === 'trail.season.outside').impact).toBe(-25);
    }
    expect(withSeason(board, 11).score).toBeLessThan(inSeason.score);
  });
});

describe('the pages', () => {
  test('a trail page carries both tags, the month shown by the reader’s clock', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trails', 'col-raiser-seceda.html'), 'utf8');
    expect(html).toContain('data-season-out="111110000011"');
    expect(html).toContain('<span>Best time: June to October</span>');
    expect(html).not.toContain('sp-plan-month');
    const it = fs.readFileSync(path.join(__dirname, 'it', 'trails', 'col-raiser-seceda.html'), 'utf8');
    expect(it).toContain('Fuori stagione');
    expect(it).toContain('Periodo migliore: da giugno a ottobre');
  });

  test('the trail list and the app show the tags', () => {
    const list = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');
    expect(list).toContain('${seasonTags(t)}');
    expect(list.indexOf('trail-season-words.js')).toBeGreaterThan(-1);
    expect(fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8')).toContain('trail-season-tag--best');
  });
});
