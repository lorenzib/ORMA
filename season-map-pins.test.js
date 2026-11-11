const fs = require('fs');
const path = require('path');

// browse-map.js reads the season words from the page's window.
global.window = global;
window.DoloPawsTrailSeasonWords = require('./trail-season-words');
const { trailFeature } = require('./browse-map.js');

const summer = { recommended: { months: [6, 7, 8, 9], source: { label: 'Board', url: 'https://example.org', accessedAt: '2026-11-01' } } };
const pin = (season) => trailFeature({ id: 'x', name: 'X', lat: 46.5, lng: 11.7, season }, { score: 80 }).properties;

describe('map pins out of season', () => {
  afterEach(() => jest.useRealTimers());

  test('a pin knows when its walk is out of season this month', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-15T10:00:00'));
    expect(pin(summer).out).toBe(1);
    expect(pin(null).out).toBe(0);
    jest.setSystemTime(new Date('2026-07-15T10:00:00'));
    expect(pin(summer).out).toBe(0);
  });

  test('both maps fade those pins and draw them under the rest', () => {
    const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
    for (const file of ['browse-map.js', 'script.js']) {
      const src = read(file);
      expect(src).toMatch(/'circle-sort-key'\s*:\s*\['-', 1, \['coalesce', \['get', 'out'\], 0\]\]/);
      expect(src).toMatch(/'circle-opacity'\s*:\s*\[\s*'case',\s*\['==', \['coalesce', \['get', 'out'\], 0\], 1\]/);
    }
    expect(read('script.js')).toMatch(/out: liOutOfSeasonNow\(t\) \? 1 : 0/);
  });
});
