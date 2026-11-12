const fs = require('fs');
const path = require('path');
const { applyRoadSeasons } = require('./scripts/road-seasons');
const words = require('./trail-season-words');

const road = {
  name: 'Example toll road', operator: 'Example town', url: 'https://example.org/road', accessedAt: '2026-11-11',
  usually: { from: { part: 'late', month: 5 }, to: { part: 'late', month: 10 } },
  openMonths: [6, 7, 8, 9, 10],
};
const snowy = { highPoint: 2400, snow: { months: [1, 2, 3, 4, 5, 11, 12], likelihood: 'likely', highPoint: 2400 } };
const withRoad = (season = snowy) => applyRoadSeasons([{ id: 'w', season }], { roads: { r: road }, trails: { w: { roads: ['r'] } } })[0];

describe('road seasons', () => {
  test('a walk that needs a winter-shut road gets its shut months', () => {
    expect(withRoad().season.roads).toEqual([expect.objectContaining({ id: 'r', shutMonths: [1, 2, 3, 4, 5, 11, 12] })]);
  });

  test('the shut months are out of season, marked on the strip and said with the source', () => {
    const board = { recommended: { months: [5, 6, 7, 8, 9, 10], source: { label: 'Board', url: 'https://example.org', accessedAt: '2026-11-01' } } };
    const trail = withRoad(board);
    expect(words.bestMonths(trail.season)).toEqual([6, 7, 8, 9, 10]);
    expect(words.outOfSeason(trail.season, 5)).toBe(true);
    const out = words.describe(trail.season);
    expect(out.strip[4].state).toBe('road');
    expect(out.legend).toContainEqual(['road', 'Road closed']);
    expect(out.lifts[0].line).toBe('The Example toll road is usually open from late May to late October. The walk starts at the end of it; while it is shut, there is no drive to the start.');
    expect(out.lifts[0].source.url).toBe('https://example.org/road');
    expect(words.nowNote(trail.season, 5)).toBe('In May the Example toll road is closed, and the walk starts at the end of it.');
  });

  test('a key no month shows any more is dropped', () => {
    expect(words.describe(withRoad().season).legend.map(([state]) => state)).toEqual(['good', 'road']);
  });

  test('bad records are refused', () => {
    expect(() => applyRoadSeasons([{ id: 'w', season: snowy }], { roads: { r: { ...road, usually: undefined } }, trails: {} })).toThrow(/usually opens/);
    expect(() => applyRoadSeasons([{ id: 'w', season: snowy }], { roads: { r: road }, trails: { x: { roads: ['r'] } } })).toThrow(/unknown walk/);
  });

  test('an access rule is said, noted in its months, and never changes the walk’s months', () => {
    const board = { recommended: { months: [5, 6, 7, 8, 9, 10], source: { label: 'Board', url: 'https://example.org', accessedAt: '2026-11-01' } } };
    const rule = { operator: 'Example valley', url: 'https://example.org/valley', accessedAt: '2026-11-12', months: [7, 8], line: 'Cars need a booking in summer.', monthNote: 'In {month} cars need a booking.' };
    const trail = applyRoadSeasons([{ id: 'w', season: board }], { roads: {}, access: { a: rule }, trails: { w: { access: ['a'] } } })[0];
    expect(trail.season.roads).toBeUndefined();
    expect(words.bestMonths(trail.season)).toEqual([5, 6, 7, 8, 9, 10]);
    const out = words.describe(trail.season);
    expect(out.lifts[0]).toEqual(expect.objectContaining({ line: 'Cars need a booking in summer.' }));
    expect(out.lifts[0].source.label).toBe('Example valley');
    expect(words.nowNote(trail.season, 7)).toBe('July is in this walk’s season. In July cars need a booking.');
    expect(words.nowNote(trail.season, 6)).toBe('June is in this walk’s season.');
    expect(() => applyRoadSeasons([{ id: 'w', season: board }], { access: { a: { ...rule, monthNote: 'no month' } }, trails: {} })).toThrow(/month note/);
    expect(() => applyRoadSeasons([{ id: 'w', season: board }], { access: {}, trails: { w: { access: ['a'] } } })).toThrow(/unknown access rule/);
  });

  test('the curated file holds sourced roads for real walks', () => {
    const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'road-seasons.json'), 'utf8'));
    const { loadProductionTrails } = require('./scripts/load-production-trails');
    const trails = loadProductionTrails(__dirname);
    for (const id of Object.keys(artifact.trails)) {
      const trail = trails.find(t => t.id === id);
      expect((trail.season.roads || []).length + (trail.season.access || []).length).toBeGreaterThan(0);
    }
  });
});
