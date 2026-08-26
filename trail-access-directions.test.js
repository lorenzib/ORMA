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

  test('finds the closest point between recorded route vertices', () => {
    const nearest = access.nearestPointOnRoute(
      { lat:46, lng:11.01 },
      [[45.99, 11], [46.01, 11]]
    );
    expect(nearest.segmentIndex).toBe(0);
    expect(nearest.fraction).toBeCloseTo(0.5, 2);
    expect(nearest.point.lat).toBeCloseTo(46, 4);
    expect(nearest.point.lng).toBeCloseTo(11, 4);
    expect(nearest.distanceKm).toBeLessThan(1);
  });

  test('offers walking directions to a nearest route point within 5 km', async () => {
    const navigatorLike = {
      geolocation:{
        getCurrentPosition:success => success({
          coords:{ latitude:46, longitude:11.01, accuracy:18 },
        }),
      },
    };
    const plan = await access.planToNearestRoute(
      navigatorLike,
      [[45.99, 11], [46.01, 11]],
      'Android'
    );
    expect(plan.allowed).toBe(true);
    expect(plan.maxKm).toBe(5);
    expect(plan.target.lat).toBeCloseTo(46, 4);
    expect(plan.url).toContain('travelmode=walking');
  });

  test('does not offer directions when every route point is over 5 km away', async () => {
    const navigatorLike = {
      geolocation:{
        getCurrentPosition:success => success({
          coords:{ latitude:46, longitude:11.1, accuracy:20 },
        }),
      },
    };
    const plan = await access.planToNearestRoute(
      navigatorLike,
      [[45.99, 11], [46.01, 11]],
      'Android'
    );
    expect(plan.allowed).toBe(false);
    expect(plan.distanceKm).toBeGreaterThan(5);
    expect(plan.url).toBeNull();
  });

  test('prioritises a connected mapped footpath route over geometric proximity', async () => {
    const navigatorLike = {
      geolocation:{
        getCurrentPosition:success => success({
          coords:{ latitude:46.00002, longitude:11.0001, accuracy:12 },
        }),
      },
    };
    const graph = {
      schemaVersion:1,
      nodes:[[11, 46], [11.001, 46], [11.002, 46]],
      edges:[[0, 1, 77, 'footway'], [1, 2, 77, 'path']],
      trailNodes:[2],
    };
    require('./footpath-router.js');
    const plan = await access.planTrailEntry(
      navigatorLike,
      { id:'test', path:[[46, 11.002]], startPoint:{ lat:46, lng:11.002 } },
      graph,
      window.DoloPawsFootpathRouter,
      'Android'
    );
    expect(plan.mode).toBe('mapped-footpath');
    expect(plan.allowed).toBe(true);
    expect(plan.path.length).toBeGreaterThan(2);
    expect(plan.url).toBeNull();
    expect(plan.instructions.at(-1).action).toBe('Join the trail');
  });

  test('falls back to the declared start without claiming an ORMA walking route', async () => {
    const navigatorLike = {
      geolocation:{
        getCurrentPosition:success => success({
          coords:{ latitude:46, longitude:11, accuracy:15 },
        }),
      },
    };
    const plan = await access.planTrailEntry(
      navigatorLike,
      {
        curated:true,
        path:[[46, 11.01]],
        startPoint:{ lat:46, lng:11.01, label:'Recommended valley start' },
      },
      null,
      null,
      'Android'
    );
    expect(plan.mode).toBe('recommended-start');
    expect(plan.targetLabel).toBe('Recommended valley start');
    expect(plan.targetKind).toBe('recommended-start');
    expect(plan.allowed).toBe(true);
    expect(plan.url).toContain('travelmode=walking');
  });

  test('does not route from a GPS fix too weak to choose a safe path', async () => {
    const navigatorLike = {
      geolocation:{
        getCurrentPosition:success => success({
          coords:{ latitude:46, longitude:11, accuracy:650 },
        }),
      },
    };
    const plan = await access.planTrailEntry(
      navigatorLike,
      { path:[[46, 11.01]] },
      null,
      null,
      'Android'
    );
    expect(plan.mode).toBe('unreliable-location');
    expect(plan.allowed).toBe(false);
    expect(plan.maxAccuracyM).toBe(500);
  });

  test('turns route geometry into compact on-map steps', () => {
    const steps = access.routeInstructions([
      { lat:46, lng:11 },
      { lat:46, lng:11.001 },
      { lat:45.999, lng:11.001 },
    ]);
    expect(steps[0].action).toBe('Follow the mapped path');
    expect(steps.some(step => /left|right/.test(step.action))).toBe(true);
    expect(steps.at(-1)).toEqual({ action:'Join the trail', distanceM:0 });
  });
});
