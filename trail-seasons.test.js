const fs = require('fs');
const path = require('path');
const { parseBoardMonths, snowEstimate, applyTrailSeasons, validateSeason } = require('./scripts/trail-seasons');
const words = require('./trail-season-words');
const { loadProductionTrails } = require('./scripts/load-production-trails');

const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'trail-seasons.json'), 'utf8'));

describe('reading a board\'s month grid', () => {
  test('Outdooractive marks a recommended month "month tip"', () => {
    const cell = (name, tip) => `<li class="month${tip ? ' tip' : ''}">${name}</li>`;
    const html = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
      .map((name, i) => cell(name, i >= 4 && i <= 9)).join('');
    expect(parseBoardMonths(html)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  test('Alta Badia marks it "month active"', () => {
    const html = Array.from({ length: 12 }, (_, i) => `<span class="month${i >= 5 && i <= 8 ? ' active' : ''}"></span>`).join('');
    expect(parseBoardMonths(html)).toEqual([6, 7, 8, 9]);
  });

  test('the Dreizinnen sites list the months in the grid\'s aria-label', () => {
    const html = '<div class="seasons-bar" aria-label="aria.suggested_months_period.prefix: aria.month.may, aria.month.jun, aria.month.oct">';
    expect(parseBoardMonths(html)).toEqual([5, 6, 10]);
  });

  test('a page with no grid, or a partial one, answers nothing', () => {
    expect(parseBoardMonths('<p>No season here</p>')).toBeNull();
    expect(parseBoardMonths('<li class="month tip">Jan</li><li class="month">Feb</li>')).toBeNull();
  });
});

describe('the snow estimate', () => {
  test('goes by the walk\'s high point', () => {
    expect(snowEstimate(2326)).toEqual({ months: [1, 2, 3, 4, 5, 11, 12], likelihood: 'likely', highPoint: 2326 });
    expect(snowEstimate(1700).months).toEqual([1, 2, 3, 4, 12]);
    expect(snowEstimate(900)).toMatchObject({ months: [1, 2, 12], likelihood: 'possible' });
    expect(snowEstimate(0)).toBeNull();
  });
});

describe('data/trail-seasons.json', () => {
  test('every entry is valid and names a real walk', () => {
    const trails = loadProductionTrails(__dirname, undefined, { seasons: false });
    expect(() => applyTrailSeasons(trails, artifact)).not.toThrow();
    for (const [id, season] of Object.entries(artifact.trails)) expect(() => validateSeason(id, season)).not.toThrow();
  });

  test('a walk carries board months or an estimate, never both', () => {
    for (const season of Object.values(artifact.trails)) expect(!!(season.recommended && season.snow)).toBe(false);
  });

  test('winter use is said to be read off the map', () => {
    expect(artifact.sources.winterUse.label).toBe('Read off the map (OpenStreetMap)');
  });

  test('applying it rejects a walk that does not exist', () => {
    expect(() => applyTrailSeasons([{ id: 'a' }], { trails: { b: { snow: snowEstimate(2100) } } })).toThrow(/unknown trail: b/);
  });
});

describe('the season words', () => {
  const board = { recommended: { months: [6, 7, 8, 9, 10], source: { label: 'Outdooractive', url: 'https://www.outdooractive.com/x', accessedAt: '2026-11-06' } } };

  test('month ranges read as a walker says them, across New Year too', () => {
    expect(words.monthRange([5, 6, 7, 8, 9, 10])).toBe('from May to October');
    expect(words.monthRange([1, 2, 12])).toBe('from December to February');
    expect(words.monthRange([4, 5, 9])).toBe('from April to May and in September');
    expect(words.monthRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('all year');
  });

  test('board months name their board, an estimate says it is one', () => {
    const fromBoard = words.describe(board);
    expect(fromBoard.line).toBe('Recommended from June to October.');
    expect(fromBoard.source.label).toBe('Outdooractive');
    expect(fromBoard.source.after).toBe(', read on 6 November 2026.');
    const estimated = words.describe({ snow: snowEstimate(2326) });
    expect(estimated.source.before).toMatch(/^Estimated from the walk’s high point \(2326 m\)/);
  });

  test('this month is placed against the season', () => {
    expect(words.nowNote(board, 7)).toBe('July is in this walk’s season.');
    expect(words.outOfSeason(board, 7)).toBe(false);
    expect(words.nowNote(board, 11)).toBe('November is outside the season the board publishes for this walk.');
    expect(words.outOfSeason(board, 11)).toBe(true);
    const piste = { ...board, winterUse: [{ kind: 'downhill', km: 1, names: [] }] };
    expect(words.outOfSeason(piste, 1)).toBe(true);
    expect(words.nowNote(piste, 1)).toMatch(/ski runs or tracks now/);
  });
});

describe('the trail page', () => {
  test('a walk with a season shows "When to go" with its source', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trails', 'col-raiser-seceda.html'), 'utf8');
    expect(html).toContain('<h2>When to go</h2>');
    expect(html).toContain('Recommended from June to October.');
    expect(html).toMatch(/of this walk is a ski run/);
    expect(html).toContain('Read off the map (OpenStreetMap).');
  });

  test('the Italian page says it in Italian', () => {
    const html = fs.readFileSync(path.join(__dirname, 'it', 'trails', 'giro-del-sasso-lungo.html'), 'utf8');
    expect(html).toContain('<h2>Quando andare</h2>');
    expect(html).toContain('Qui la neve è probabile tra novembre e maggio.');
  });
});
