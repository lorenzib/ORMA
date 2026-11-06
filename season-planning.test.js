const fs = require('fs');
const path = require('path');
const words = require('./trail-season-words');

const board = { recommended: { months: [6, 7, 8, 9, 10], source: { label: 'Outdooractive', url: 'https://www.outdooractive.com/x', accessedAt: '2026-11-06' } } };
const high = { snow: { months: [1, 2, 3, 4, 5, 11, 12], likelihood: 'likely', highPoint: 2326 } };
const low = { snow: { months: [1, 2, 12], likelihood: 'possible', highPoint: 900 } };
const piste = { ...board, winterUse: [{ kind: 'downhill', km: 1, names: [] }] };

describe('a walk in a month', () => {
  test('good, check first, or out of season', () => {
    expect(words.verdict(board, 7)).toBe('good');
    expect(words.verdict(board, 11)).toBe('out');
    expect(words.verdict(high, 12)).toBe('out');
    expect(words.verdict(high, 8)).toBe('good');
    expect(words.verdict(low, 1)).toBe('check');
    expect(words.verdict({ recommended: { ...board.recommended, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, winterUse: piste.winterUse }, 2)).toBe('check');
    expect(words.verdict(undefined, 7)).toBeNull();
  });

  test('says so on a card', () => {
    expect(words.verdictLabel('good', 7)).toBe('Good in July');
    expect(words.verdictLabel('check', 1)).toBe('Check first in January');
    expect(words.verdictLabel('out', 11)).toBe('Out of season in November');
  });
});

describe('the planning month', () => {
  let store;
  beforeEach(() => {
    jest.resetModules();
    store = {};
    global.localStorage = {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: key => { delete store[key]; },
    };
  });
  afterEach(() => { delete global.localStorage; });

  test('is this month until a reader picks one', () => {
    const planner = require('./trail-planning-month');
    expect(planner.current()).toEqual({ month: new Date().getMonth() + 1, chosen: false });
    const other = (planner.today() % 12) + 1;
    planner.set(other);
    expect(planner.current()).toEqual({ month: other, chosen: true });
  });

  test('picking this month goes back to following the calendar', () => {
    const planner = require('./trail-planning-month');
    planner.set((planner.today() % 12) + 1);
    planner.set(planner.today());
    expect(store[planner.KEY]).toBeUndefined();
    expect(planner.current().chosen).toBe(false);
  });
});

describe('"Walkable then" on the trail list', () => {
  beforeAll(() => { globalThis.DoloPawsTrailSeasonWords = words; });
  afterAll(() => { delete globalThis.DoloPawsTrailSeasonWords; });
  const filters = () => require('./discovery-filters');

  test('keeps only walks that are good in the month', () => {
    const trails = [
      { id: 'summer', name: 'Summer', distance: 5, season: board },
      { id: 'piste', name: 'Piste', distance: 5, season: piste },
      { id: 'none', name: 'No record', distance: 5 },
    ];
    expect(filters().filter(trails, { walkable: true, month: 7 }).map(t => t.id)).toEqual(['summer', 'piste']);
    expect(filters().filter(trails, { walkable: true, month: 1 }).map(t => t.id)).toEqual([]);
    expect(filters().filter(trails, { month: 1 }).length).toBe(3);
  });

  test('names the month on its chip and comes off cleanly', () => {
    const active = filters().active({ walkable: true, month: 3 });
    expect(active).toEqual([{ key: 'walkable', label: 'Walkable in March' }]);
    expect(filters().without({ walkable: true }, 'walkable').walkable).toBe(false);
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

  test('drops outside the board\'s season and in likely snow', () => {
    const inSeason = withSeason(board, 7);
    expect(withSeason(board, 11).score).toBeLessThan(inSeason.score);
    expect(withSeason(board, 11).cautions.find(c => c.code === 'trail.season.outside').impact).toBe(-25);
    expect(withSeason(board, 11).cautions.map(c => c.code)).toContain('trail.season.outside');
    expect(inSeason.positiveReasons.map(c => c.code)).toContain('trail.season.inside');
    expect(withSeason(high, 12).cautions.map(c => c.code)).toContain('trail.season.snow-likely');
    expect(withSeason(piste, 2).cautions.map(c => c.code)).toEqual(expect.arrayContaining(['trail.season.outside', 'trail.season.winter-use']));
  });
});

describe('the pages', () => {
  test('the trail list offers the month and the filter', () => {
    const html = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');
    expect(html).toContain('id="browsePlanMonth"');
    expect(html).toContain('id="browseWalkable"');
    expect(html.indexOf('trail-planning-month.js')).toBeLessThan(html.indexOf('src="scoring.js'));
  });

  test('a trail page lets the reader pick the month', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trails', 'col-raiser-seceda.html'), 'utf8');
    expect(html).toContain('<select class="sp-plan-month">');
    expect(html).toContain("var KEY = 'orma-planning-month';");
  });

  test('every page that scores loads the planning month first', () => {
    for (const page of ['index.html', 'collections.html', 'compare.html', 'saved.html', 'safety-guide.html']) {
      const html = fs.readFileSync(path.join(__dirname, page), 'utf8');
      expect(html.indexOf('trail-planning-month.js')).toBeGreaterThan(-1);
      expect(html.indexOf('trail-planning-month.js')).toBeLessThan(html.indexOf('src="scoring.js'));
    }
  });
});
