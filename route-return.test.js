const routeReturn = require('./route-return');
globalThis.DoloPawsRecommendationV1 = require('./scoring/recommendation-v1');
const adapters = require('./scoring/recommendation-adapters-v1');

// A one-way walk's published figures cover one direction. A reader who walks
// back the same way walks twice as far, and climbs what they came down.

const level = {
  id:'level', routeShape:'point-to-point', distance:2.6, elevation:80, hours:'0.75',
  elevationProfile:[{ km:0, elev:1421 }, { km:1.3, elev:1501 }, { km:2.6, elev:1421 }],
};
// Rotwandwiesen from the gondola: 1 m up, 561 m down, one way.
const downhill = {
  id:'downhill', routeShape:'point-to-point', distance:4.8, elevation:1, hours:'2.2',
  elevationProfile:[{ km:0, elev:1925 }, { km:4.8, elev:1365 }],
};

describe('a one-way walk seen there and back', () => {
  test('doubles the distance', () => {
    expect(routeReturn.outAndBack(level).distance).toBe(5.2);
  });

  test('doubles the climb when the walk starts and ends at the same height', () => {
    const back = routeReturn.outAndBack(level);
    expect(back.elevation).toBe(160);
    expect(back.descent).toBe(160);
  });

  test('counts the descent as climb on the way back', () => {
    // 1 m up and 561 m down is about 562 m up there and back, not 2 m.
    const back = routeReturn.outAndBack(downhill);
    expect(back.elevation).toBe(562);
    expect(back.returnLeg.oneWayDescent).toBe(561);
  });

  test('doubles the time of a symmetric walk', () => {
    expect(routeReturn.outAndBack(level).hours).toBe('1.5');
  });

  test('gives an uphill walk back more time than the downhill walk out', () => {
    const hours = Number(routeReturn.outAndBack(downhill).hours);
    expect(hours).toBeGreaterThan(2.2 * 2);
  });

  test('keeps a range a range', () => {
    expect(routeReturn.outAndBack({ ...level, hours:'2.5–3' }).hours).toBe('5–6');
    expect(routeReturn.parseHoursRange('3:38')[0]).toBeCloseTo(3.633, 2);
  });

  test('without a profile assumes the walk ends where it climbed from', () => {
    const back = routeReturn.outAndBack({ ...level, elevationProfile:undefined });
    expect(back.elevation).toBe(160);
  });

  test('without a profile counts the stated descent as climb on the way back', () => {
    // Sentiero Hans e Paula Steger: 301 m up and 475 m down, Compatsch to Saltria.
    const steger = { ...level, elevation:301, descent:475, elevationProfile:undefined };
    expect(routeReturn.outAndBack(steger).elevation).toBe(776);
    // Sentiero del Trenino climbs 454 m and drops 2 m: the way back is downhill.
    const trenino = { ...level, elevation:454, descent:2, elevationProfile:undefined };
    expect(routeReturn.outAndBack(trenino).elevation).toBe(456);
  });

  test('leaves loops and out-and-back walks alone', () => {
    expect(routeReturn.isOneWay({ ...level, routeShape:'loop' })).toBe(false);
    expect(routeReturn.isOneWay({ ...level, routeShape:'out-and-back' })).toBe(false);
    expect(routeReturn.outAndBack({ ...level, routeShape:'loop' })).toBeNull();
  });

  test('a one-way walk opens there and back, and one way is the choice', () => {
    // Most readers walk back to the car, so the default is the walk back.
    expect(routeReturn.view()).toBe(routeReturn.VIEWS.OUT_AND_BACK);
    expect(routeReturn.forView(level).distance).toBe(5.2);
    expect(level.distance).toBe(2.6);
    routeReturn.setView(routeReturn.VIEWS.ONE_WAY);
    expect(routeReturn.forView(level)).toBe(level);
    routeReturn.setView(routeReturn.VIEWS.OUT_AND_BACK);
    expect(routeReturn.forView(level).distance).toBe(5.2);
  });

  test('a copy already worked out is not doubled again', () => {
    const copy = routeReturn.forView(level);
    expect(routeReturn.forView(copy)).toBe(copy);
  });
});

describe('the score for the walk back', () => {
  // A low-energy dog with a 5 km range: 4.2 km one way is within it, 8.4 km
  // there and back is not.
  const subject = { terrain:'0', distance:'5' };
  const walk = { ...level, id:'walk', distance:4.2, elevation:120, curated:true };
  const codes = trail => adapters.recommendLegacyTrail(trail, subject).cautions.map(item => item.code);

  test('charges the longer walk against the dog\'s range', () => {
    expect(codes(walk)).not.toContain('trail.distance.above-range');
    expect(codes(routeReturn.outAndBack(walk))).toContain('trail.distance.above-range');
  });
});

// "3.9 h" read as 3 h 9 min; a reader says hours and minutes.
describe('walking time as hours and minutes', () => {
  test.each([
    ['3.9', '3 h 55 min'],
    ['1', '1 h'],
    ['0.75', '45 min'],
    ['3:38', '3 h 40 min'],
    ['2–3', '2–3 h'],
    ['1.5–2', '1 h 30 min – 2 h'],
    ['0.3–0.5', '20–30 min'],
    [5.75, '5 h 45 min'],
  ])('%s hours reads "%s"', (hours, text) => {
    expect(routeReturn.formatDuration(hours)).toBe(text);
  });

  test('nothing to read gives nothing', () => {
    expect(routeReturn.formatDuration('')).toBe('');
    expect(routeReturn.formatDuration(null)).toBe('');
  });
});
