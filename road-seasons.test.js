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

  test('a seasonal dog rule makes the months with no allowed day out of season and dates the edge months', () => {
    const rule = {
      operator: 'Example park', url: 'https://example.org/park', accessedAt: '2026-11-23',
      allowed: { from: { day: 15, month: 7 }, to: { day: 15, month: 9 } },
      line: 'Dogs are allowed only from 15 July to 15 September, on a lead.',
      shutNote: 'In {month} dogs are not allowed in the park zones on this walk.',
      partNote: 'In {month} dogs are allowed only from 15 July to 15 September.',
    };
    const board = { recommended: { months: [6, 7, 8, 9, 10], source: { label: 'Board', url: 'https://example.org', accessedAt: '2026-11-01' } } };
    const trail = applyRoadSeasons([{ id: 'w', season: board }], { dogRules: { d: rule }, trails: { w: { dogRules: ['d'] } } })[0];
    expect(trail.season.dogRules[0]).toEqual(expect.objectContaining({ shutMonths: [1, 2, 3, 4, 5, 6, 10, 11, 12], partMonths: [7, 9] }));
    expect(words.bestMonths(trail.season)).toEqual([7, 8, 9]);
    expect(words.outOfSeason(trail.season, 6)).toBe(true);
    const out = words.describe(trail.season);
    expect(out.strip[5].state).toBe('dogs');
    expect(out.strip[7].state).toBe('good');
    expect(out.legend).toContainEqual(['dogs', 'No dogs allowed']);
    expect(out.lifts[0]).toEqual(expect.objectContaining({ line: rule.line }));
    expect(words.nowNote(trail.season, 6)).toBe('In June dogs are not allowed in the park zones on this walk.');
    expect(words.nowNote(trail.season, 7)).toBe('July is in this walk’s season. In July dogs are allowed only from 15 July to 15 September.');
    expect(words.nowNote(trail.season, 8)).toBe('August is in this walk’s season.');
    expect(() => applyRoadSeasons([{ id: 'w', season: board }], { dogRules: { d: { ...rule, allowed: undefined } }, trails: {} })).toThrow(/when dogs are allowed/);
    expect(() => applyRoadSeasons([{ id: 'w', season: board }], { dogRules: {}, trails: { w: { dogRules: ['d'] } } })).toThrow(/unknown dog rule/);
  });

  test('the curated file holds sourced roads for real walks', () => {
    const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'road-seasons.json'), 'utf8'));
    const { loadProductionTrails } = require('./scripts/load-production-trails');
    const trails = loadProductionTrails(__dirname);
    for (const id of Object.keys(artifact.trails)) {
      const trail = trails.find(t => t.id === id);
      expect((trail.season.roads || []).length + (trail.season.access || []).length + (trail.season.dogRules || []).length).toBeGreaterThan(0);
    }
  });

  test('a seasonal bus is a dated access rule on a walk it serves', () => {
    const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'road-seasons.json'), 'utf8'));
    const buses = Object.keys(artifact.access).filter(id => id.startsWith('bus-'));
    expect(buses.length).toBeGreaterThan(0);
    const used = new Set(Object.values(artifact.trails).flatMap(use => use.access || []));
    for (const id of buses) {
      const rule = artifact.access[id];
      expect(used.has(id)).toBe(true);
      expect(rule.line).toMatch(/\b(bus|buses)\b/i);
      expect(rule.line).toMatch(/\b20\d\d\b/);
    }
  });
});
