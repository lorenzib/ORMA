const fs = require('fs');
const path = require('path');
const { applyHutSeasons, closedMonths } = require('./scripts/hut-seasons');
const words = require('./trail-season-words');

const hut = {
  name: 'Rifugio Example', url: 'https://www.example.org/hut', accessedAt: '2026-11-11',
  periods: [{ from: '06-13', to: '10-11' }], knownMonths: [5, 6, 7, 8, 9, 10, 11], datesFor: { summer: '2026' },
};
const board = { recommended: { months: [6, 7, 8, 9, 10], source: { label: 'Board', url: 'https://example.org', accessedAt: '2026-11-01' } } };
const withHut = (use = { huts: ['h'], goals: ['h'] }, h = hut) => applyHutSeasons([{ id: 'w', season: board }], { huts: { h }, trails: { w: use } })[0];

describe('hut seasons', () => {
  test('a hut is shut only in months it is shut every day of, among the months its dates speak for', () => {
    expect(closedMonths(hut)).toEqual([5, 11]);
    expect(closedMonths({ periods: [{ from: '12-04', to: '04-07' }, { from: '06-25', to: '09-15' }] })).toEqual([5, 10, 11]);
  });

  test('the walk gets the hut with its dates and the source', () => {
    const out = words.describe(withHut().season);
    expect(out.lifts[0].line).toBe('The Rifugio Example is open from 13 June to 11 October (summer 2026 dates; winter dates not yet published).');
    expect(out.lifts[0].source.label).toBe('example.org');
  });

  test('hut dates never change the walk’s months', () => {
    expect(words.bestMonths(withHut().season)).toEqual([6, 7, 8, 9, 10]);
    expect(words.outOfSeason(withHut().season, 11)).toBe(true);
    expect(words.outOfSeason(withHut().season, 7)).toBe(false);
  });

  test('a closed hut the walk walks to is noted; one it only passes is not', () => {
    expect(words.nowNote(withHut().season, 11)).toBe('November is outside the season the board publishes for this walk. In November the Rifugio Example is closed: take food and water for you and your dog.');
    expect(words.nowNote(withHut({ huts: ['h'] }).season, 11)).toBe('November is outside the season the board publishes for this walk.');
    expect(words.nowNote(withHut().season, 1)).not.toMatch(/closed/);
  });

  test('rough dates say so', () => {
    expect(words.describe(withHut(undefined, { ...hut, approx: true }).season).lifts[0].line).toMatch(/^The Rifugio Example is open from about 13 June to about 11 October/);
  });

  test('bad records are refused', () => {
    expect(() => withHut(undefined, { ...hut, datesFor: {} })).toThrow(/which season/);
    expect(() => withHut(undefined, { ...hut, periods: [{ from: '6-13', to: '10-11' }] })).toThrow(/MM-DD/);
    expect(() => withHut({ huts: [], goals: ['h'] })).toThrow(/goal it does not pass/);
    expect(() => applyHutSeasons([{ id: 'w', season: board }], { huts: { h: hut }, trails: { x: { huts: ['h'] } } })).toThrow(/unknown walk/);
  });

  test('the curated file holds sourced huts for real walks', () => {
    const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'hut-seasons.json'), 'utf8'));
    const { loadProductionTrails } = require('./scripts/load-production-trails');
    const trails = loadProductionTrails(__dirname);
    for (const id of Object.keys(artifact.trails)) {
      const trail = trails.find(t => t.id === id);
      expect(trail.graduation && trail.graduation.status).toBe('verified');
      expect(trail.season.huts.length).toBeGreaterThan(0);
    }
  });
});
