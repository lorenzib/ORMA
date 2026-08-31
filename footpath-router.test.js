describe('HIKE-07 mapped footpath rejoin router', () => {
  let router;
  const graph = {
    schemaVersion:1,
    nodes:[
      [11.0000, 46.0000],
      [11.0010, 46.0000],
      [11.0020, 46.0000],
      [11.0010, 46.0010],
    ],
    edges:[
      [0, 1, 77, 'footway'],
      [1, 2, 77, 'footway'],
      [1, 3, 50, 'path'],
    ],
    trailNodes:[2],
  };

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsFootpathRouter;
    require('./footpath-router.js');
    router = window.DoloPawsFootpathRouter;
  });

  test('routes over connected mapped edges instead of drawing a straight line', () => {
    const result = router.routeToTrail(
      { lat:46.00002, lng:11.0001 },
      graph,
      { maxSnapDistanceM:20 }
    );
    expect(result.routingMode).toBe('mapped-footpath');
    expect(result.path.length).toBeGreaterThanOrEqual(3);
    expect(result.target).toEqual({ lat:46, lng:11.002 });
    expect(result.distanceM).toBeGreaterThan(140);
    expect(result.source).toBe('openstreetmap');
  });

  test('chooses the shortest connected route to a trail node', () => {
    const multiGoal = { ...graph, trailNodes:[2, 3] };
    const result = router.routeToTrail(
      { lat:46.00002, lng:11.0001 },
      multiGoal,
      { maxSnapDistanceM:20 }
    );
    expect(result.target).toEqual({ lat:46.001, lng:11.001 });
    expect(result.distanceM).toBeLessThan(130);
  });

  test('routes between two selected points on the shared walking graph', () => {
    const result = router.routeToPoint(
      { lat:46.00002, lng:11.0001 },
      { lat:46.00002, lng:11.0019 },
      graph,
      { maxSnapDistanceM:20, maxTargetSnapDistanceM:20 }
    );
    expect(result).not.toBeNull();
    expect(result.routingMode).toBe('mapped-point');
    expect(result.path.length).toBeGreaterThanOrEqual(3);
    expect(result.distanceM).toBeGreaterThan(100);
    expect(result.target.lng).toBeCloseTo(11.0019, 4);
  });

  test('does not guess a selected destination far from the walking graph', () => {
    expect(router.routeToPoint(
      { lat:46.00002, lng:11.0001 },
      { lat:46.01, lng:11.01 },
      graph,
      { maxSnapDistanceM:20, maxTargetSnapDistanceM:20 }
    )).toBeNull();
  });

  test('closes an ordered three-point route over mapped graph edges', () => {
    const result = router.routeLoop([
      { lat:46.00001, lng:11.00005 },
      { lat:46.00001, lng:11.00195 },
      { lat:46.00095, lng:11.001 },
    ], graph, {
      maxSnapDistanceM:20,
      maxTargetSnapDistanceM:20,
      maxLegDistanceM:500,
      maxTotalDistanceM:1000,
    });
    expect(result).not.toBeNull();
    expect(result.routingMode).toBe('mapped-loop');
    expect(result.closed).toBe(true);
    expect(result.legs).toHaveLength(3);
    expect(result.points).toHaveLength(3);
    expect(result.path.length).toBeGreaterThan(4);
    expect(result.path.at(-1)).toEqual(result.path[0]);
    expect(result.distanceM).toBeGreaterThan(250);
    expect(result.source).toBe('openstreetmap');
  });

  test('previews ordered points without inventing the closing leg', () => {
    const result = router.routeThroughPoints([
      { lat:46.00001, lng:11.00005 },
      { lat:46.00001, lng:11.00195 },
      { lat:46.00095, lng:11.001 },
    ], graph, {
      maxSnapDistanceM:20,
      maxTargetSnapDistanceM:20,
      maxLegDistanceM:500,
      maxTotalDistanceM:1000,
    });
    expect(result.routingMode).toBe('mapped-waypoints');
    expect(result.closed).toBe(false);
    expect(result.legs).toHaveLength(2);
    expect(result.path.at(-1)).not.toEqual(result.path[0]);
  });

  test('fails closed for too few points, disconnected points, or route limits', () => {
    expect(router.routeLoop([
      { lat:46, lng:11 },
      { lat:46, lng:11.001 },
    ], graph)).toBeNull();
    expect(router.routeLoop([
      { lat:46, lng:11 },
      { lat:46, lng:11.001 },
      { lat:46.01, lng:11.01 },
    ], graph, { maxTargetSnapDistanceM:20 })).toBeNull();
    expect(router.routeLoop([
      { lat:46, lng:11 },
      { lat:46, lng:11.001 },
      { lat:46.001, lng:11.001 },
    ], graph, { maxTotalDistanceM:100 })).toBeNull();
  });

  test('rejects duplicate legs and more points than the bounded composer allows', () => {
    expect(router.routeLoop([
      { lat:46, lng:11 },
      { lat:46, lng:11 },
      { lat:46.001, lng:11.001 },
    ], graph)).toBeNull();
    expect(router.routeLoop([
      { lat:46, lng:11 },
      { lat:46, lng:11.001 },
      { lat:46.001, lng:11.001 },
      { lat:46.001, lng:11 },
    ], graph)).toBeNull();
  });

  test('returns no route when the user is not close to a mapped footpath', () => {
    expect(router.routeToTrail(
      { lat:46.002, lng:11.002 },
      graph,
      { maxSnapDistanceM:20 }
    )).toBeNull();
  });

  test('rejects disconnected and malformed routing data', () => {
    expect(router.routeToTrail({ lat:46, lng:11 }, {
      schemaVersion:1,
      nodes:graph.nodes,
      edges:[[0, 1, 77]],
      trailNodes:[2],
    })).toBeNull();
    expect(router.validateGraph({})).toBe(false);
    expect(router.validateGraph({ ...graph, trailNodes:[99] })).toBe(false);
  });

  test('Carezza package routes a known side footpath back to the stored trail', () => {
    const fs = require('fs');
    const graphData = JSON.parse(fs.readFileSync(
      require('path').join(__dirname, 'offline/packages/lago-carezza/footpath-network.json'),
      'utf8'
    ));
    const result = router.routeToTrail(
      { lat:46.4110609, lng:11.5719944 },
      graphData,
      { maxSnapDistanceM:10, maxRouteDistanceM:1500 }
    );
    expect(router.validateGraph(graphData)).toBe(true);
    expect(result).not.toBeNull();
    expect(result.routingMode).toBe('mapped-footpath');
    expect(result.path.length).toBeGreaterThan(10);
    expect(result.distanceM).toBeGreaterThan(200);
    expect(result.distanceM).toBeLessThan(300);
  });

  test('Alpe di Siusi package routes a known side footpath back to the stored trail', () => {
    const fs = require('fs');
    const graphData = JSON.parse(fs.readFileSync(
      require('path').join(__dirname, 'offline/packages/alpe-siusi/footpath-network.json'),
      'utf8'
    ));
    const result = router.routeToTrail(
      { lat:46.5423625, lng:11.6170037 },
      graphData,
      { maxSnapDistanceM:10, maxRouteDistanceM:1500 }
    );
    expect(router.validateGraph(graphData)).toBe(true);
    expect(result).not.toBeNull();
    expect(result.routingMode).toBe('mapped-footpath');
    expect(result.path.length).toBeGreaterThan(20);
    expect(result.distanceM).toBeGreaterThan(300);
    expect(result.distanceM).toBeLessThan(400);
  });

  test('builds a bounded loop on the published Carezza walking graph', () => {
    const fs = require('fs');
    const graphData = JSON.parse(fs.readFileSync(
      require('path').join(__dirname, 'offline/packages/lago-carezza/footpath-network.json'),
      'utf8'
    ));
    const points = [20, 80, 160].map(index => ({
      lng:graphData.nodes[index][0],
      lat:graphData.nodes[index][1],
    }));
    const result = router.routeLoop(points, graphData, {
      maxSnapDistanceM:5,
      maxTargetSnapDistanceM:5,
      maxTotalDistanceM:10000,
    });
    expect(result).not.toBeNull();
    expect(result.routingMode).toBe('mapped-loop');
    expect(result.distanceM).toBeGreaterThan(900);
    expect(result.distanceM).toBeLessThan(1000);
    expect(result.path.at(-1)).toEqual(result.path[0]);
  });
});
