describe('direction-neutral walked distance', () => {
  let distance;

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsHikeDistance;
    require('./hike-distance.js');
    distance = window.DoloPawsHikeDistance;
  });

  function fix(routePositionM, timestamp, overrides){
    return {
      lat:46.54,
      lng:11.62 + routePositionM / 100000,
      timestamp,
      accuracyM:10,
      routePositionM,
      nearRoute:true,
      usable:true,
      ...(overrides || {}),
    };
  }

  test('starts at zero wherever the hiker joins the route', () => {
    let state = distance.create(0);
    state = distance.update(state, fix(5700, 1000), { totalRouteM:7500, loop:true });
    state = distance.update(state, fix(5750, 21000), { totalRouteM:7500, loop:true });
    expect(state.distanceM).toBeCloseTo(50, 5);
  });

  test('counts either direction around a loop', () => {
    let state = distance.create(0);
    state = distance.update(state, fix(5700, 1000), { totalRouteM:7500, loop:true });
    state = distance.update(state, fix(5650, 21000), { totalRouteM:7500, loop:true });
    expect(state.distanceM).toBeCloseTo(50, 5);
  });

  test('uses the short distance when crossing the loop seam', () => {
    expect(distance.routeDelta(7480, 20, 7500, true)).toBe(40);
    expect(distance.routeDelta(7480, 20, 7500, false)).toBe(7460);
  });

  test('ignores small GPS drift and implausible jumps', () => {
    let state = distance.create(0);
    state = distance.update(state, fix(1000, 1000, { accuracyM:35 }), { totalRouteM:7500, loop:true });
    state = distance.update(state, fix(1015, 11000, { accuracyM:35 }), { totalRouteM:7500, loop:true });
    expect(state.distanceM).toBe(0);
    state = distance.update(state, fix(1400, 12000, { accuracyM:10 }), { totalRouteM:7500, loop:true });
    expect(state.distanceM).toBe(0);
  });

  test('resumes from stored walked distance without adding the restart jump', () => {
    let state = distance.create(1.2);
    state = distance.update(state, fix(3000, 1000), { totalRouteM:7500, loop:true });
    expect(state.distanceM).toBe(1200);
  });
});
