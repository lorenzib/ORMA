'use strict';

// The Saved trails page as a season reminder: walks back in season this month
// are named at the top, out-of-season ones are counted and listed last.
const fs = require('fs');
const path = require('path');
const words = require('./trail-season-words');

const summer = { recommended: { months: [6, 7, 8, 9, 10] } };
const allYear = { recommended: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } };

describe('back in season', () => {
  test('is the first month of a walk\'s season, not the months after', () => {
    expect(words.cameBackThisMonth(summer, 6)).toBe(true);
    expect(words.cameBackThisMonth(summer, 7)).toBe(false);
    expect(words.cameBackThisMonth(summer, 12)).toBe(false);
  });

  test('never for a walk good all year or without a record', () => {
    expect(words.cameBackThisMonth(allYear, 1)).toBe(false);
    expect(words.cameBackThisMonth(undefined, 6)).toBe(false);
  });

  test('wraps across the new year', () => {
    const winter = { recommended: { months: [12, 1, 2] } };
    expect(words.cameBackThisMonth(winter, 12)).toBe(true);
    expect(words.cameBackThisMonth(winter, 1)).toBe(false);
  });
});

describe('the Saved trails page', () => {
  const html = fs.readFileSync(path.join(__dirname, 'saved.html'), 'utf8');
  const it = fs.readFileSync(path.join(__dirname, 'i18n-phrases-it.js'), 'utf8');

  test('names the walks back in season and lists the out-of-season ones last', () => {
    expect(html).toContain('id="savedSeason"');
    expect(html).toContain("words.inSeasonFirst(saved");
    expect(html).toContain("tx('Back in season this month: {walks}.'");
    expect(html).toContain("words.cameBackThisMonth(tr.season, month)");
  });

  test('every new sentence has its Italian', () => {
    for (const phrase of ['Back in season', 'Back in season this month: {walks}.', '{count} more',
      '1 of your saved walks is out of season in {month}; it is listed last.',
      '{count} of your saved walks are out of season in {month}; they are listed last.']) {
      expect(it).toContain(JSON.stringify(phrase) + ':');
    }
  });
});
