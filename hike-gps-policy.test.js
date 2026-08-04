describe('HIKE-03 accuracy-aware GPS policy', () => {
  let policy;

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsGpsPolicy;
    require('./hike-gps-policy.js');
    policy = window.DoloPawsGpsPolicy;
  });

  function assess(overrides){
    return policy.assessFix({
      now: 20_000,
      timestamp: 19_000,
      accuracyM: 12,
      routeDistanceM: 10,
      previousOffRouteStreak: 0,
      previousOffRouteSince: null,
      ...overrides,
    });
  }

  test.each([
    [12, 'good'],
    [40, 'fair'],
    [80, 'weak'],
    [150, 'unusable'],
    [NaN, 'unavailable'],
  ])('classifies %s metre accuracy as %s', (accuracyM, band) => {
    expect(policy.accuracyBand(accuracyM)).toBe(band);
  });

  test.each([
    [5_000, 'current'],
    [30_000, 'aging'],
    [60_000, 'stale'],
  ])('classifies a %s ms old fix as %s', (ageMs, band) => {
    expect(policy.freshnessBand(ageMs)).toBe(band);
  });

  test('requires three reliable fixes sustained for twenty seconds', () => {
    const first = assess({ routeDistanceM: 110, accuracyM: 20 });
    const second = assess({
      now: 30_000,
      timestamp: 29_000,
      routeDistanceM: 112,
      accuracyM: 20,
      previousOffRouteStreak: first.nextOffRouteStreak,
      previousOffRouteSince: first.nextOffRouteSince,
    });
    const third = assess({
      now: 41_000,
      timestamp: 40_000,
      routeDistanceM: 115,
      accuracyM: 20,
      previousOffRouteStreak: second.nextOffRouteStreak,
      previousOffRouteSince: second.nextOffRouteSince,
    });

    expect(first.offRouteState).toBe('possible');
    expect(second.offRouteState).toBe('possible');
    expect(third.offRouteState).toBe('confirmed');
    expect(third.offRouteEvidenceMs).toBe(21_000);
  });

  test('three rapid fixes remain possible rather than producing an alert', () => {
    const first = assess({ routeDistanceM: 120, accuracyM: 10 });
    const second = assess({
      now: 22_000,
      timestamp: 21_000,
      routeDistanceM: 120,
      accuracyM: 10,
      previousOffRouteStreak: first.nextOffRouteStreak,
      previousOffRouteSince: first.nextOffRouteSince,
    });
    const third = assess({
      now: 24_000,
      timestamp: 23_000,
      routeDistanceM: 120,
      accuracyM: 10,
      previousOffRouteStreak: second.nextOffRouteStreak,
      previousOffRouteSince: second.nextOffRouteSince,
    });
    expect(third.nextOffRouteStreak).toBe(3);
    expect(third.offRouteState).toBe('possible');
  });

  test('adds a twenty metre uncertainty cushion beyond reported accuracy', () => {
    const result = assess({
      routeDistanceM: 85,
      accuracyM: 10,
      previousOffRouteStreak: 5,
      previousOffRouteSince: 0,
    });
    expect(result.lowerBoundM).toBe(55);
    expect(result.offRouteState).toBe('none');
  });

  test.each([
    ['weak accuracy', { routeDistanceM: 300, accuracyM: 80 }],
    ['stale fix', { routeDistanceM: 300, timestamp: 1_000 }],
    ['overlapping uncertainty', { routeDistanceM: 95, accuracyM: 25 }],
  ])('%s never creates a strong off-route claim', (_label, overrides) => {
    const result = assess({ previousOffRouteStreak: 2, ...overrides });
    expect(result.offRouteState).not.toBe('confirmed');
    expect(result.nextOffRouteStreak).toBeLessThan(3);
  });

  test('a confidently on-route fix clears the warning streak', () => {
    const result = assess({
      routeDistanceM: 8,
      accuracyM: 10,
      previousOffRouteStreak: 4,
    });
    expect(result.offRouteState).toBe('none');
    expect(result.nextOffRouteStreak).toBe(0);
  });

  test('progress accepts aging fair fixes but rejects stale or unusable fixes', () => {
    expect(assess({ now: 100_000, timestamp: 1_000 }).usableForProgress).toBe(false);
    expect(assess({ accuracyM: 120 }).usableForProgress).toBe(false);
    expect(assess({ now: 100_000, timestamp: 1_000, accuracyM: 120 }).reliableForWarning)
      .toBe(false);
    expect(assess({ now: 100_000, timestamp: 1_000, accuracyM: 120 }).farFromRoute)
      .toBe(false);
    expect(assess({ timestamp: 1_000 }).freshness).toBe('aging');
  });

  test('the trail page loads the policy before hike mode uses it', () => {
    const fs = require('fs');
    const path = require('path');
    const page = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const hikeMode = fs.readFileSync(path.join(__dirname, 'hike-mode.js'), 'utf8');
    expect(page.indexOf('hike-gps-policy.js')).toBeGreaterThan(-1);
    expect(page.indexOf('hike-gps-policy.js')).toBeLessThan(page.indexOf('hike-mode.js'));
    expect(hikeMode).toContain('DoloPawsGpsPolicy.assessFix');
    expect(hikeMode).toContain('rejoin ? rejoin.distanceM : snap.minDist');
    expect(hikeMode).toContain("'hike.gpsOnTrail'");
    expect(hikeMode).toContain("'hike.gpsCheckingRoute'");
    expect(hikeMode).toContain("'hike.gpsLine'");
    expect(hikeMode).toContain("'hike.gpsStale'");
  });
});
