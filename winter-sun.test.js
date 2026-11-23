'use strict';

const path = require('path');
const ws = require('./scripts/winter-sun');
const terrain = require('./scripts/terrain-tiles');
const words = require('./trail-season-words');

describe('the sun on the solstice', () => {
  test('stands 20 degrees high at noon at 46.5 N, for about 8 h 20 min', () => {
    const sun = ws.solsticeSunPath(46.5);
    const noon = Math.max(...sun.map(s => s.elevation));
    expect(noon).toBeCloseTo(90 - 46.5 - 23.44, 0);
    expect(sun.length * ws.STEP_MINUTES / 60).toBeCloseTo(8.33, 1);
  });

  test('rises in the south-east and sets in the south-west', () => {
    const sun = ws.solsticeSunPath(46.5);
    expect(sun[0].azimuth).toBeGreaterThan(120);
    expect(sun[0].azimuth).toBeLessThan(135);
    expect(sun[sun.length - 1].azimuth).toBeGreaterThan(225);
    const noon = sun.reduce((a, b) => (b.elevation > a.elevation ? b : a));
    expect(Math.abs(noon.azimuth - 180)).toBeLessThan(1.5);
  });
});

describe('the skyline', () => {
  test('flat ground sees the whole day', () => {
    const flat = () => 500;
    const minutes = ws.sunMinutesAt(46.5, 11.5, flat);
    expect(minutes).toBe(ws.solsticeSunPath(46.5).length * ws.STEP_MINUTES);
  });

  test('a wall to the south 1,000 m high and 1 km away keeps the sun off', () => {
    // Ground rises to 1,500 m south of the point (lat below 46.49).
    const wall = (lat) => (lat < 46.491 ? 1500 : 500);
    expect(ws.sunMinutesAt(46.5, 11.5, wall)).toBe(0);
  });

  test('the same wall to the north changes nothing', () => {
    const wall = (lat) => (lat > 46.509 ? 1500 : 500);
    expect(ws.sunMinutesAt(46.5, 11.5, wall)).toBe(ws.solsticeSunPath(46.5).length * ws.STEP_MINUTES);
  });

  test('a point with no ground height has no answer', () => {
    expect(ws.sunMinutesAt(46.5, 11.5, () => NaN)).toBeNull();
  });
});

describe('a walk', () => {
  test('is sampled evenly, ends included, at most 20 points', () => {
    const line = Array.from({ length: 200 }, (_, i) => [46.5, 11.5 + i * 0.001]);
    const points = ws.samplePath(line, 20);
    expect(points).toHaveLength(20);
    expect(points[0]).toEqual(line[0]);
    expect(points[19][1]).toBeCloseTo(line[199][1], 6);
  });

  test('averages its points and counts those with no sun', () => {
    // A walk heading north from the foot of a 1,000 m wall: the first points
    // sit in its shadow, the last, 10 km away, see the midday sun over it.
    const line = [[46.5, 11.5], [46.59, 11.5]];
    const wall = (lat) => (lat < 46.491 ? 1500 : 500);
    const sun = ws.walkWinterSun(line, wall);
    expect(sun.noSunShare).toBeGreaterThan(0);
    expect(sun.noSunShare).toBeLessThan(1);
    expect(sun.hours).toBeGreaterThan(0);
  });
});

describe('the terrain tiles', () => {
  test('place a point in the right zoom 11 tile', () => {
    const [x, y] = terrain.tileXY(46.5, 11.5, 11).map(Math.floor);
    expect([x, y]).toEqual([1089, 724]);
  });

  test('read the heights a tile encodes', () => {
    // One pixel: R*256 + G + B/256 - 32768 = 1000 m.
    const png = { width: 1, height: 1, channels: 3, pixels: Buffer.from([0x83, 0xe8, 0]) };
    expect(terrain.terrariumHeights(png)[0]).toBe(1000);
  });
});

describe('the tag and the line', () => {
  const sunny = { winterSun: { hours: 6.4, noSunShare: 0 } };
  const middle = { winterSun: { hours: 4, noSunShare: 0 } };
  const shady = { winterSun: { hours: 0.3, noSunShare: 0.45 } };
  const hour = { winterSun: { hours: 1.1, noSunShare: 0 } };

  test('only from November to February', () => {
    expect(words.winterSunTag(sunny, 12)).toEqual({ kind: 'sunny', label: 'Sunny in winter' });
    expect(words.winterSunTag(sunny, 7)).toBeNull();
    expect(words.winterSunTag(shady, 1)).toEqual({ kind: 'shady', label: 'Little winter sun' });
  });

  test('nothing for the walks in between, or without a reading', () => {
    expect(words.winterSunTag(middle, 1)).toBeNull();
    expect(words.winterSunTag({}, 1)).toBeNull();
    expect(words.winterSunLine({})).toBeNull();
  });

  test('says the hours, and the ice where much of the line sees none', () => {
    expect(words.winterSunLine(middle).line).toBe('On the shortest day the sun reaches this walk for about 4 hours.');
    expect(words.winterSunLine(shady).line).toMatch(/all but a few minutes\. About 50% of the line gets no direct sun at all in midwinter: expect ice there\.$/);
    expect(words.winterSunLine(hour).line).toBe('On the shortest day the sun reaches this walk for about an hour.');
    expect(words.winterSunLine(sunny).source.url).toBe('https://registry.opendata.aws/terrain-tiles/');
  });
});

describe('the built file', () => {
  const file = require('./data/winter-sun.json');
  const { loadProductionTrails } = require('./scripts/load-production-trails');

  test('covers the catalogue, and the loader puts it on the season', () => {
    // Walks added after the last build have no entry yet and get no tag;
    // most of the catalogue must still be covered.
    const trails = loadProductionTrails(path.resolve(__dirname));
    const covered = trails.filter(trail => file.trails[trail.id]).length;
    expect(covered / trails.length).toBeGreaterThan(0.9);
    const braies = trails.find(trail => trail.id === 'lago-braies');
    expect(braies.season.winterSun.hours).toBeLessThan(words.SHADY_WINTER_HOURS);
  });
});
