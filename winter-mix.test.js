'use strict';

const { goodAllWinter, candidateSeason, walksShortOfQuota, summarise, addedSince, WINTER_QUOTA } = require('./scripts/winter-mix');
const path = require('path');

const ALL_YEAR = { highPoint: 400, recommended: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } };
const SUMMER = { highPoint: 2200, recommended: { months: [6, 7, 8, 9] } };

describe('a walk good all winter', () => {
  test('is in season in December, January and February', () => {
    expect(goodAllWinter(ALL_YEAR)).toBe(true);
    expect(goodAllWinter(SUMMER)).toBe(false);
  });

  test('needs all three months, not one of them', () => {
    expect(goodAllWinter({ highPoint: 500, recommended: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] } })).toBe(false);
  });

  test('is not a walk with no season record', () => {
    expect(goodAllWinter(undefined)).toBe(false);
    expect(goodAllWinter({ highPoint: 600 })).toBe(false);
  });

  test('is not a walk along a ski run, whatever its board says', () => {
    expect(goodAllWinter({ ...ALL_YEAR, winterUse: [{ kind: 'downhill', km: 1.2 }] })).toBe(false);
  });

  test('includes a winter walk on its prepared path', () => {
    expect(goodAllWinter({ highPoint: 1500, winterWalk: true, recommended: { months: [12, 1, 2, 3] } })).toBe(true);
  });
});

describe('a candidate before it is built', () => {
  test('counts on its board months', () => {
    expect(goodAllWinter(candidateSeason(1500, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBe(true);
  });

  test('falls back on the snow estimate from its high point', () => {
    const season = candidateSeason(1700);
    expect(season.snow).toBeTruthy();
    expect(season.recommended).toBeUndefined();
    expect(goodAllWinter(season)).toBe(false);
  });
});

describe('the quota', () => {
  test('is three walks in ten', () => {
    expect(WINTER_QUOTA).toBe(0.3);
  });

  test('says how many more winter walks would meet it', () => {
    expect(walksShortOfQuota(0, 10)).toBe(5);
    expect(walksShortOfQuota(2, 10)).toBe(2);
    expect(walksShortOfQuota(3, 10)).toBe(0);
    expect(walksShortOfQuota(0, 0)).toBe(0);
  });
});

describe('the summary', () => {
  const trails = [
    { id: 'a', region: 'dolomites', season: ALL_YEAR },
    { id: 'b', region: 'dolomites', season: SUMMER },
    { id: 'c', region: 'piedmont', season: ALL_YEAR },
    { id: 'd', region: 'piedmont', season: SUMMER },
  ];

  test('counts the catalogue and each region', () => {
    const summary = summarise(trails, null);
    expect(summary.good).toBe(2);
    expect(summary.total).toBe(4);
    expect(summary.regions.map(row => [row.region, row.good, row.total])).toEqual([['dolomites', 1, 2], ['piedmont', 1, 2]]);
    expect(summary.added).toBeNull();
  });

  test('measures the new walks against the quota', () => {
    const summary = summarise(trails, new Set(['b', 'd']));
    expect(summary.added).toMatchObject({ total: 2, good: 0, meetsQuota: false, shortBy: 1 });
    expect(summarise(trails, new Set(['c', 'd'])).added).toMatchObject({ good: 1, meetsQuota: true });
  });
});

describe('walks added since a commit', () => {
  test('are the walks with no trail-details file then', () => {
    const root = path.resolve(__dirname);
    const { ids } = addedSince(root, 'HEAD');
    expect(ids('a-walk-that-does-not-exist')).toBe(true);
    expect(ids('winter-voels-voelser-weiher')).toBe(false);
  });
});
