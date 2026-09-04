describe('HIKE-05 route rejoin guidance', () => {
  let rejoin;

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsRouteRejoin;
    require('./route-rejoin.js');
    rejoin = window.DoloPawsRouteRejoin;
  });

  test('finds the closest point on a segment rather than only a route vertex', () => {
    const result = rejoin.guidance(
      { lat: 46.001, lng: 11.005 },
      [{ lat: 46, lng: 11 }, { lat: 46, lng: 11.01 }]
    );

    expect(result.target.lat).toBeCloseTo(46, 5);
    expect(result.target.lng).toBeCloseTo(11.005, 5);
    expect(result.distanceM).toBeGreaterThan(100);
    expect(result.distanceM).toBeLessThan(112);
    expect(result.direction).toBe('S');
    expect(result.routingMode).toBe('orientation-only');
  });

  test('returns the closest endpoint when the perpendicular falls outside a segment', () => {
    const result = rejoin.guidance(
      { lat: 46, lng: 10.99 },
      [{ lat: 46, lng: 11 }, { lat: 46, lng: 11.01 }]
    );

    expect(result.target).toEqual({ lat: 46, lng: 11 });
    expect(result.segmentFraction).toBe(0);
    expect(result.direction).toBe('E');
  });

  test('selects the nearest segment from a multi-segment route', () => {
    const result = rejoin.guidance(
      { lat: 46.009, lng: 11.005 },
      [
        { lat: 46, lng: 11 },
        { lat: 46, lng: 11.01 },
        { lat: 46.01, lng: 11.01 },
      ]
    );

    expect(result.segmentIndex).toBe(1);
    expect(result.target.lng).toBeCloseTo(11.01, 5);
    expect(result.direction).toBe('E');
  });

  test('rejects missing and invalid route geometry', () => {
    expect(rejoin.guidance({ lat: 46, lng: 11 }, [])).toBeNull();
    expect(rejoin.guidance({ lat: 46, lng: 11 }, [{ lat: 46, lng: 11 }])).toBeNull();
    expect(rejoin.guidance({ lat: NaN, lng: 11 }, [
      { lat: 46, lng: 11 },
      { lat: 46.1, lng: 11.1 },
    ])).toBeNull();
  });

  test('the online trail loads guidance before hike mode', () => {
    const { expectBundledBefore, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');
    expectTrailBundleLoaded();
    expectBundledBefore('route-rejoin.js', 'hike-mode.js');
  });
});
