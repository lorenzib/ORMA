const fs = require('fs');
const os = require('os');
const path = require('path');
const { seasonDatesReview, latestWindow, expectedSeasons, checkedOn } = require('./scripts/season-dates-review');

function fixture(files){
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'season-dates-'));
  fs.mkdirSync(path.join(root, 'data'));
  for(const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, 'data', name), JSON.stringify(body));
  return root;
}

const source = { url: 'https://example.org', accessedAt: '2026-11-11' };
const root = fixture({
  'lift-seasons.json': {
    lifts: {
      summer: { name: 'Summer gondola', ...source, datesFor: '2026', periods: [{ from: '06-25', to: '09-20' }], knownMonths: [5, 6, 7, 8, 9, 10, 11] },
      winter: { name: 'Winter chairlift', ...source, datesFor: '2025/26', periods: [{ from: '12-06', to: '04-06' }], knownMonths: [11, 12, 1, 2, 3, 4] },
      always: { name: 'All-year cable car', ...source, datesFor: '2026', allYear: true, periods: [{ from: '01-01', to: '12-31' }] },
    },
    held: { 'walk-a': 'Taser cable car: no year on the dates (checked 11 Nov 2026).', 'walk-b': 'Cherz chairlift: no dates found.' },
  },
  'road-seasons.json': {
    roads: { toll: { name: 'Toll road', ...source } },
    access: { ra: { line: 'In 2025, from 28 June to 31 August, the road was closed to cars.', ...source } },
  },
  'hut-seasons.json': { huts: { hut: { name: 'A hut', ...source, datesFor: { summer: '2026', winter: '2026/27' }, periods: [{ from: '06-20', to: '09-20' }] } } },
});

describe('season dates review', () => {
  test('the check windows open on 1 April and 1 October', () => {
    expect(latestWindow('2026-11-12')).toEqual({ date: '2026-10-01', kind: 'autumn' });
    expect(latestWindow('2027-02-01')).toEqual({ date: '2026-10-01', kind: 'autumn' });
    expect(latestWindow('2027-04-01')).toEqual({ date: '2027-04-01', kind: 'spring' });
    expect(expectedSeasons('2026-11-12')).toEqual({ summer: 2026, winter: 2026 });
    expect(expectedSeasons('2027-04-02')).toEqual({ summer: 2027, winter: 2026 });
  });

  test('a held reason gives the date it was checked', () => {
    expect(checkedOn('no year (checked 10 Nov 2026); rechecked 11 Nov 2026')).toBe('2026-11-11');
    expect(checkedOn('no dates found')).toBe('');
  });

  test('in autumn, last winter’s lift dates and undated holds are due', () => {
    const { due, counts } = seasonDatesReview(root, '2026-11-12');
    expect(counts).toEqual({ lifts: 3, roads: 1, access: 1, huts: 1, held: 2 });
    expect(due.map(item => item.id).sort()).toEqual(['walk-b', 'winter']);
    expect(due.find(item => item.id === 'winter').why).toBe('winter dates are for 2025; 2026 winter dates are due');
  });

  test('in spring, every summer date from last year and everything read before 1 April is due', () => {
    const { due } = seasonDatesReview(root, '2027-04-02');
    const why = Object.fromEntries(due.map(item => [item.id, item.why]));
    expect(Object.keys(why).sort()).toEqual(['always', 'hut', 'ra', 'summer', 'toll', 'walk-a', 'walk-b', 'winter']);
    expect(why.always).toBe('dates are for 2026; 2027 dates are due');
    expect(why.hut).toBe('summer dates are for 2026; 2027 summer dates are due');
    expect(why.toll).toMatch(/last read 2026-11-11, before the spring check \(2027-04-01\)/);
  });

  test('the real files read without error', () => {
    const report = seasonDatesReview(__dirname, '2026-11-12');
    expect(report.counts.lifts).toBeGreaterThan(0);
    expect(report.counts.huts).toBeGreaterThan(0);
  });
});
