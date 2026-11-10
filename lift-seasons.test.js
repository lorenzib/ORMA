'use strict';

// A walk that rides a lift is only the walk ORMA describes while the lift runs.
// data/lift-seasons.json keeps each lift's published dates; a walk that needs
// the lift is out of season in the months it is shut, and the "When to go"
// strip marks those months.

const path = require('path');
const { applyLiftSeasons, runningMonths } = require('./scripts/lift-seasons');
const words = require('./trail-season-words');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const artifact = require('./data/lift-seasons.json');
const liftAccess = require('./data/lift-access.json');

const GONDOLA = {
  name: 'Example gondola', operator: 'Example lifts', url: 'https://example.org/dates',
  accessedAt: '2026-11-09', datesFor: '2026', valleyM: 1230, topM: 2100,
  periods: [{ from: '05-30', to: '11-01' }, { from: '12-06', to: '04-06' }],
};
const walk = (dependency, season) => ({
  id: 'w', name: 'w', liftAccess: { type: 'gondola', dependency },
  season: season || { recommended: { months: [5, 6, 7, 8, 9, 10], source: { label: 'Board', url: 'https://example.org', accessedAt: '2026-11-01' } }, highPoint: 2100 },
});
const apply = dependency => applyLiftSeasons([walk(dependency)], { lifts: { g: GONDOLA }, trails: { w: { lifts: ['g'] } } })[0];

describe('the months a lift runs', () => {
  test('a month counts when the lift runs for at least half of it', () => {
    // Opens 30 May: May is not a lift month, June is; shuts 1 November.
    expect(runningMonths(GONDOLA.periods)).toEqual([1, 2, 3, 6, 7, 8, 9, 10, 12]);
  });

  test('a period across New Year is one period', () => {
    expect(runningMonths([{ from: '12-20', to: '03-31' }])).toEqual([1, 2, 3]);
  });
});

describe('a walk that needs the lift', () => {
  const trail = apply('required');

  test('carries the lift, its months, and the height it covers', () => {
    expect(trail.season.lifts).toEqual([expect.objectContaining({ id: 'g', required: true, shutMonths: [4, 5, 11], climbM: 870 })]);
  });

  test('is out of season in the months the lift is shut, and hidden when high', () => {
    // The board says May to October; the lift opens on 30 May.
    expect(words.bestMonths(trail.season)).toEqual([6, 7, 8, 9, 10]);
    expect(words.outOfSeason(trail.season, 5)).toBe(true);
    expect(words.hiddenThisMonth(trail.season, 5)).toBe(true);
    expect(words.outOfSeason(trail.season, 7)).toBe(false);
  });

  test('the strip marks the shut months and says why', () => {
    const out = words.describe(trail.season);
    expect(out.strip[4].state).toBe('lift');
    expect(out.strip[6].state).toBe('good');
    expect(out.legend).toContainEqual(['lift', 'Lift not running']);
    expect(out.lifts[0].line).toBe('The Example gondola runs from 30 May to 1 November and from 6 December to 6 April (2026 dates). The walk needs it; when it is shut, the 870 m it covers are on foot, if a path allows.');
    expect(out.lifts[0].source.url).toBe('https://example.org/dates');
  });

  test('this month\'s note names the lift, and does not also call the month in season', () => {
    expect(words.nowNote(trail.season, 5)).toBe('In May the Example gondola is not running, and the walk needs it.');
  });
});

describe('a lift with only summer dates published', () => {
  const summerOnly = { ...GONDOLA, periods: [{ from: '05-30', to: '11-01' }], knownMonths: [5, 6, 7, 8, 9, 10, 11] };
  const trail = applyLiftSeasons([walk('required')], { lifts: { g: summerOnly }, trails: { w: { lifts: ['g'] } } })[0];

  test('is shut only in the summer months its dates speak for', () => {
    expect(trail.season.lifts[0].shutMonths).toEqual([5, 11]);
    expect(words.describe(trail.season).strip[0].state).toBe('off');
  });

  test('says the winter dates are not out yet', () => {
    expect(words.describe(trail.season).lifts[0].line).toMatch(/winter dates not yet published/);
  });
});

describe('a lift with only winter dates published', () => {
  const winterOnly = { ...GONDOLA, periods: [{ from: '11-28', to: '04-04' }], knownMonths: [11, 12, 1, 2, 3, 4] };
  const trail = applyLiftSeasons([walk('required')], { lifts: { g: winterOnly }, trails: { w: { lifts: ['g'] } } })[0];

  test('says the summer dates are not out yet', () => {
    expect(trail.season.lifts[0].winterOnly).toBe(true);
    expect(trail.season.lifts[0].summerOnly).toBeUndefined();
    expect(words.describe(trail.season).lifts[0].line).toMatch(/summer dates not yet published/);
  });
});

describe('a walk that only offers the lift as a shortcut', () => {
  const trail = apply('optional');

  test('keeps its season', () => {
    expect(words.bestMonths(trail.season)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(words.describe(trail.season).strip[4].state).toBe('good');
  });

  test('still says when the lift runs', () => {
    expect(words.describe(trail.season).lifts[0].line).toMatch(/The walk does not need it\.$/);
    expect(words.nowNote(trail.season, 5)).toMatch(/not running; the walk does not need it/);
  });
});

describe('the curated file', () => {
  const trails = loadProductionTrails(path.resolve(__dirname));
  const byId = new Map(trails.map(trail => [trail.id, trail]));

  test('every walk with a lift record has its lift season, or is held with a reason', () => {
    const missing = liftAccess.trails.map(entry => entry.id).filter(id => !artifact.trails[id] && !artifact.held[id]);
    expect(missing).toEqual([]);
    for (const id of Object.keys(artifact.held)) expect(artifact.trails[id]).toBeUndefined();
  });

  test('every lift has dates, a source and a read-on date', () => {
    for (const lift of Object.values(artifact.lifts)) {
      expect(lift.periods.length).toBeGreaterThan(0);
      expect(lift.url).toMatch(/^https:\/\//);
      expect(lift.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('a walk that needs a lift is never left with no season at all', () => {
    for (const id of Object.keys(artifact.trails)) {
      const trail = byId.get(id);
      expect(trail.season.lifts.length).toBeGreaterThan(0);
      expect(words.bestMonths(trail.season) || []).not.toEqual([]);
    }
  });
});
