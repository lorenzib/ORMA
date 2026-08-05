describe('trailhead access directions', () => {
  let access;

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsTrailAccess;
    require('./trail-access-directions.js');
    access = window.DoloPawsTrailAccess;
  });

  test('allows a customer already within the 100 km area', () => {
    const result = access.assess(
      { lat:46.50, lng:11.35 },
      { lat:46.41, lng:11.58 }
    );
    expect(result.allowed).toBe(true);
    expect(result.distanceKm).toBeLessThan(100);
  });

  test('does not offer directions from outside the 100 km area', () => {
    const result = access.assess(
      { lat:45.46, lng:9.19 },
      { lat:46.41, lng:11.58 }
    );
    expect(result.allowed).toBe(false);
    expect(result.maxKm).toBe(100);
  });

  test('builds device-appropriate directions with current origin', () => {
    expect(access.directionsUrl(
      { lat:46.5, lng:11.3 },
      { lat:46.4, lng:11.5 },
      'iPhone'
    )).toContain('maps.apple.com/?saddr=46.5,11.3&daddr=46.4,11.5');
    expect(access.directionsUrl(
      { lat:46.5, lng:11.3 },
      { lat:46.4, lng:11.5 },
      'Android'
    )).toContain('origin=46.5,11.3&destination=46.4,11.5');
  });

  test('plans from a browser GPS fix without retaining the position', async () => {
    const navigatorLike = {
      geolocation:{
        getCurrentPosition:success => success({
          coords:{ latitude:46.5, longitude:11.3, accuracy:20 },
        }),
      },
    };
    const plan = await access.planFromCurrent(
      navigatorLike,
      { lat:46.4, lng:11.5 },
      'Android'
    );
    expect(plan.allowed).toBe(true);
    expect(plan.url).toContain('destination=46.4,11.5');
  });
});
