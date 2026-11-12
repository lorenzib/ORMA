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

  test('the curated file holds sourced roads for real walks', () => {
    const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'road-seasons.json'), 'utf8'));
    const { loadProductionTrails } = require('./scripts/load-production-trails');
    const trails = loadProductionTrails(__dirname);
    for (const id of Object.keys(artifact.trails)) {
      const trail = trails.find(t => t.id === id);
      expect((trail.season.roads || []).length + (trail.season.carFree || []).length).toBeGreaterThan(0);
    }
  });

  test('a road closed to cars in summer says when to take the shuttle, and keeps the walk in season', () => {
    const carFree = { name: 'road to the hut', shuttle: 'the shuttle from the village', periods: [{ from: '06-28', to: '08-31' }], datesFor: '2025', operator: 'Example map', url: 'https://example.org/map', accessedAt: '2026-11-12' };
    const [trail] = applyRoadSeasons([{ id: 'w', season: snowy }], { roads: {}, carFree: { c: carFree }, trails: { w: { carFree: ['c'] } } });
    expect(trail.season.carFree[0].closedMonths).toEqual([7, 8]);
    expect(trail.season.roads).toBeUndefined();
    expect(words.bestMonths(trail.season)).toEqual([6, 7, 8, 9, 10]);
    expect(words.describe(trail.season).lifts[0].line).toBe('From 28 June to 31 August (2025 dates) the road to the hut is closed to cars; take the shuttle from the village.');
    expect(words.nowNote(trail.season, 8)).toMatch(/In August the road to the hut is closed to cars; take the shuttle from the village\.$/);
    expect(() => applyRoadSeasons([{ id: 'w', season: snowy }], { carFree: { c: { ...carFree, shuttle: '' } }, trails: {} })).toThrow(/which shuttle/);
  });
});
