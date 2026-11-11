const fs = require('fs');
const path = require('path');
const words = require('./trail-season-words.js');
const filters = require('./discovery-filters.js');
const { loadProductionTrails } = require('./scripts/load-production-trails');

// A high-mountain walk (on a ski or sled run, or climbing to 1,800 m or more)
// is left off the trail list, the map, the homepage and the collections while
// it is out of season. Its page, a saved
// walk and a direct link still reach it.
describe('high-mountain walks sit out their off-season', () => {
  const skiRun = {
    recommended: { months: [6, 7, 8, 9, 10], source: { label: 'Board', url: 'https://example.com', accessedAt: '2026-11-06' } },
    winterUse: [{ kind: 'downhill', km: 2.2, names: ['Seceda'] }],
  };
  const crossCountry = {
    snow: { months: [12, 1, 2], likelihood: 'possible', highPoint: 1400 },
    winterUse: [{ kind: 'nordic', km: 5.9, names: [] }],
  };

  test('a ski-run walk is hidden out of season and shown in season', () => {
    expect(words.hiddenThisMonth(skiRun, 11)).toBe(true);
    expect(words.hiddenThisMonth(skiRun, 1)).toBe(true);
    expect(words.hiddenThisMonth(skiRun, 7)).toBe(false);
  });

  test('a walk at 1,800 m or more is hidden out of season, even off the pistes', () => {
    const seiserAlm = { highPoint: 2139, recommended: { ...skiRun.recommended } };
    expect(words.HIGH_MOUNTAIN_M).toBe(1800);
    expect(words.hiddenThisMonth(seiserAlm, 11)).toBe(true);
    expect(words.hiddenThisMonth(seiserAlm, 8)).toBe(false);
    expect(words.hiddenThisMonth({ ...seiserAlm, highPoint: 1799 }, 11)).toBe(false);
  });

  test('a lower walk beside a cross-country track, or with no season, is only labelled', () => {
    expect(words.outOfSeason(crossCountry, 1)).toBe(true);
    expect(words.hiddenThisMonth(crossCountry, 1)).toBe(false);
    expect(words.hiddenThisMonth(null, 1)).toBe(false);
  });

  test('the shared discovery filter leaves the walk out unless asked to include it', () => {
    const trail = { id: 'seceda', name: 'Seceda Ridge', region: 'dolomites', season: skiRun };
    expect(filters.matches(trail, {}, { month: 11 })).toBe(false);
    expect(filters.matches(trail, {}, { month: 7 })).toBe(true);
    expect(filters.matches(trail, {}, { month: 11, includeOutOfSeason: true })).toBe(true);
  });

  test('saved walks on the trail list ignore the season', () => {
    const html = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');
    expect(html).toContain('includeOutOfSeason: savedOnly');
  });

  test('every page that lists walks loads the season words before using them', () => {
    for(const page of ['index.html', 'browse-trails.html', 'collections.html']){
      const html = fs.readFileSync(path.join(__dirname, page), 'utf8');
      expect(html).toContain('trail-season-words.js?v=20261111-2');
    }
    expect(fs.readFileSync(path.join(__dirname, 'collections-page.js'), 'utf8')).toContain('hiddenThisMonth');
  });

  test('every published walk has a season record and a high point, in every region', () => {
    const seasons = require('./data/trail-seasons.json').trails;
    expect(Object.values(seasons).every(season => season.highPoint > 0)).toBe(true);
    const missing = loadProductionTrails(__dirname, undefined, { seasons: false })
      .filter(trail => !seasons[trail.id])
      .map(trail => `${trail.region}/${trail.id}`);
    expect(missing).toEqual([]);
  });
});
