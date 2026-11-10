const fs = require('fs');
const path = require('path');
const words = require('./trail-season-words');

const summer = { recommended: { months: [6, 7, 8, 9, 10], source: { label: 'Board', url: 'https://example.org', accessedAt: '2026-11-01' } } };
const winter = { ...summer, recommended: { ...summer.recommended, months: [12, 1, 2, 3] } };

describe('back in season', () => {
  test('an out-of-season walk names the month it comes back', () => {
    expect(words.backInSeason(summer, 11)).toBe(6);
    expect(words.outOfSeasonTag(summer, 11)).toBe('Out of season · back in June');
    expect(words.outOfSeasonTag(summer, 11, true)).toBe('Out of season · back in Jun');
  });

  test('a season across New Year comes back after it', () => {
    expect(words.backInSeason(winter, 5)).toBe(12);
    expect(words.backInSeason(winter, 11)).toBe(12);
  });

  test('says nothing in season, or without a record', () => {
    expect(words.backInSeason(summer, 7)).toBeNull();
    expect(words.outOfSeasonTag(summer, 7)).toBe('');
    expect(words.outOfSeasonTag(null, 11)).toBe('');
  });
});

describe('the walks to go on now come first', () => {
  test('out-of-season walks move to the end, each group in its order', () => {
    const list = [
      { id: 'a', season: summer },
      { id: 'b', season: winter },
      { id: 'c', season: null },
      { id: 'd', season: summer },
      { id: 'e', season: winter },
    ];
    expect(words.inSeasonFirst(list, (x) => x.season, 7).map((x) => x.id)).toEqual(['a', 'c', 'd', 'b', 'e']);
    expect(words.inSeasonFirst(list, (x) => x.season, 1).map((x) => x.id)).toEqual(['b', 'c', 'e', 'a', 'd']);
  });
});

describe('where it is used', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

  test('the lists put the walks in season first', () => {
    expect(read('browse-trails.html')).toMatch(/inSeasonFirst\(ranked/);
    expect(read('script.js')).toMatch(/inSeasonFirst\(displayList/);
    expect(read('homepage-search.js')).toMatch(/inSeasonFirst\(ranked/);
  });

  test('the guest homepage has a good-walks-this-month row', () => {
    const src = read('homepage-search.js');
    expect(src).toContain("tx('Good Dolomites walks for {month}'");
    expect(src).toContain("var GOOD_NOW_REGION = 'dolomites';");
    expect(src).toMatch(/t\.region !== GOOD_NOW_REGION/);
    expect(src).toMatch(/function goodNow\(/);
  });

  test('the tags say when the walk is back', () => {
    expect(read('trail-blueprint.js')).toContain('outOfSeasonTag(');
    expect(read('browse-trails.html')).toContain('outOfSeasonTag(');
    expect(read('scripts/generate-trail-pages.js')).toContain("L('Out of season · back in {month}'");
  });
});
