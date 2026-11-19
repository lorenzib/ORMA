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

  test('a one-way walk opens one way, as its source gives it, and there and back is the choice', () => {
    expect(routeReturn.view(level)).toBe(routeReturn.VIEWS.ONE_WAY);
    expect(routeReturn.forView(level)).toBe(level);
    routeReturn.setView(routeReturn.VIEWS.OUT_AND_BACK, level);
    expect(routeReturn.forView(level).distance).toBe(5.2);
    expect(level.distance).toBe(2.6);
    // The choice is this walk's only.
    expect(routeReturn.forView(downhill)).toBe(downhill);
    routeReturn.setView(routeReturn.VIEWS.ONE_WAY, level);
    expect(routeReturn.forView(level)).toBe(level);
  });

  test('a copy already worked out is not doubled again', () => {
    const copy = routeReturn.outAndBack(level);
    expect(routeReturn.forView(copy)).toBe(copy);
  });
});

// San Giacomo from Ortisei, as the board gives it: 6 km and 330 m there and
// back, 2 h. The profile turns at the church, 3 km out.
const sanGiacomo = {
  id:'san-giacomo', routeShape:'out-and-back', distance:6, elevation:330, hours:'2',
  elevationProfile:[
    { km:0, elev:1241 }, { km:0.9, elev:1256 }, { km:2.2, elev:1492 }, { km:3.1, elev:1578 },
    { km:3.9, elev:1469 }, { km:5.2, elev:1275 }, { km:5.7, elev:1239 },
  ],
};

describe('an out-and-back walk seen one way', () => {
  test('opens there and back, as its source gives it', () => {
    expect(routeReturn.isThereAndBack(sanGiacomo)).toBe(true);
    expect(routeReturn.hasChoice(sanGiacomo)).toBe(true);
    expect(routeReturn.view(sanGiacomo)).toBe(routeReturn.VIEWS.OUT_AND_BACK);
    expect(routeReturn.forView(sanGiacomo)).toBe(sanGiacomo);
  });

  test('halves the distance and splits the climb by the profile', () => {
    const leg = routeReturn.oneWayLeg(sanGiacomo);
    expect(leg.distance).toBe(3);
    // Going out climbs 1241 → 1578 with one small dip: most of the 330 m.
    expect(leg.elevation + leg.descent).toBe(330);
    expect(leg.elevation).toBeGreaterThan(300);
    expect(leg.elevationProfile[leg.elevationProfile.length - 1].km).toBeCloseTo(3.1, 5);
  });

  test('never invents a one-way time', () => {
    const leg = routeReturn.oneWayLeg(sanGiacomo);
    expect(leg.hours).toBeNull();
    expect(leg.oneWayOf).toEqual(expect.objectContaining({ roundTripDistance:6, roundTripHours:'2', hoursPublished:false }));
  });

  test('reads a profile drawn one way only as the out leg', () => {
    // Le Buet to Barberine: 8.6 km there and back, line and profile one way.
    const buet = { id:'buet', routeShape:'out-and-back', distance:8.6, elevation:220, hours:'3.5',
      elevationProfile:[{ km:0, elev:1341 }, { km:2, elev:1364 }, { km:4.2, elev:1177 }] };
    const leg = routeReturn.oneWayLeg(buet);
    expect(leg.distance).toBe(4.3);
    expect(leg.elevationProfile).toHaveLength(3);
    expect(leg.elevation).toBeLessThan(leg.descent);
  });

  test('switches to one way and back, and a worked-out copy passes through', () => {
    routeReturn.setView(routeReturn.VIEWS.ONE_WAY, sanGiacomo);
    const leg = routeReturn.forView(sanGiacomo);
    expect(leg.distance).toBe(3);
    expect(routeReturn.forView(leg)).toBe(leg);
    expect(routeReturn.isOneWay(leg)).toBe(false);
    routeReturn.setView(routeReturn.VIEWS.OUT_AND_BACK, sanGiacomo);
    expect(routeReturn.forView(sanGiacomo)).toBe(sanGiacomo);
  });

  test('leaves loops and lollipops alone', () => {
    expect(routeReturn.hasChoice({ ...sanGiacomo, routeShape:'loop' })).toBe(false);
    expect(routeReturn.hasChoice({ ...sanGiacomo, routeShape:'lollipop' })).toBe(false);
    expect(routeReturn.oneWayLeg({ ...sanGiacomo, routeShape:'lollipop' })).toBeNull();
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
