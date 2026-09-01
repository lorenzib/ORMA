const fs = require('fs');
const path = require('path');

const root = __dirname;
const plannerHtml = fs.readFileSync(path.join(root, 'route-planner.html'), 'utf8');
const plannerSource = fs.readFileSync(path.join(root, 'route-planner.js'), 'utf8');
const plannerRouting = require('./route-planner-routing.js');
const detailHtml = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, 'trail.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const savedHtml = fs.readFileSync(path.join(root, 'saved.html'), 'utf8');

describe('standalone draft route planner', () => {
  test('is entered from Explore and absent from trail detail', () => {
    expect(homeHtml).toContain('href="route-planner.html">Draft a loop</a>');
    expect(homeHtml.indexOf('class="li-plan-route"')).toBeLessThan(homeHtml.indexOf('class="li-body"'));
    expect(detailHtml).not.toContain('id="mapLoopComposerBtn"');
    expect(detailHtml).not.toContain('id="mapLoopComposerPanel"');
    expect(detailSource).not.toContain('    initLoopComposer(map, t);');
  });

  test('uses geographic coverage only for the bundled fallback graph', () => {
    expect(plannerSource).toContain('function coverageFor(point)');
    expect(plannerSource).toContain('contains(entry, point)');
    expect(plannerSource).toContain('walkingRouter.route(points');
    expect(plannerSource).not.toContain('coverage.trails[t.id]');
  });

  test('allows three to eight points and requires a closed mapped preview before saving', () => {
    expect(plannerHtml).toContain('id="plannerClose"');
    expect(plannerHtml).toContain('id="plannerSave"');
    expect(plannerSource).toContain('const MIN_LOOP_POINTS = 3');
    expect(plannerSource).toContain('const MAX_POINTS = 8');
    expect(plannerSource).toContain('points.length < MIN_LOOP_POINTS');
    expect(plannerHtml).toContain('0 / 8');
    expect(plannerSource).toContain('!preview || !preview.closed');
    expect(plannerSource).toContain('localRouter.routeLoop(points, graph, options)');
  });

  test('uses the same hiking map context and controls as the homepage map', () => {
    expect(plannerHtml).toContain('map-runtime.js');
    expect(plannerHtml).toContain('id="plannerMarkedRoutes"');
    expect(plannerSource).toContain('DoloPawsMapRuntime.mapOptions');
    expect(plannerSource).toContain('DoloPawsMapRuntime.enhance(map)');
    expect(plannerSource).toContain('new maplibregl.GeolocateControl');
    expect(plannerSource).toContain('tile.waymarkedtrails.org/hiking');
    expect(plannerSource).toContain("'raster-opacity':['interpolate',['linear'],['zoom'],7,.48,10,.66,12,.84,14,1]");
    expect(plannerSource).toContain("'raster-saturation':0");
    expect(plannerSource).toContain("id:'planner-orma-trails-line'");
    expect(plannerHtml).toContain('data-planner-poi="water"');
    expect(plannerHtml).toContain('data-planner-poi="huts"');
    expect(plannerHtml).toContain('data-planner-poi="food"');
    expect(plannerSource).toContain('collapseAttribution()');
    expect(plannerSource).toContain("data-maplayer=\"satellite\"");
  });

  test('states the safety limitations and exposes saved drafts', () => {
    expect(plannerHtml).toContain('This is not an ORMA-verified trail.');
    expect(plannerHtml).toContain('does not confirm legal access');
    expect(savedHtml).toContain('id="my-routes"');
    expect(savedHtml).toContain('route-planner.html?route=');
  });
});

describe('live walking-route client', () => {
  test('closes the waypoint list and reads a BRouter GeoJSON route', async () => {
    const fetchMock = jest.fn(async url => ({
      ok:true,
      json:async () => ({
        type:'FeatureCollection',
        features:[{
          type:'Feature',
          properties:{ 'track-length':'1840' },
          geometry:{ type:'LineString', coordinates:[[11.55,46.56],[11.57,46.57],[11.55,46.56]] },
        }],
      }),
    }));
    const result = await plannerRouting.route([
      { lng:11.55, lat:46.56 },
      { lng:11.57, lat:46.57 },
      { lng:11.56, lat:46.58 },
    ], { closeLoop:true, fetch:fetchMock, maxDistanceM:30000 });
    const requested = new URL(fetchMock.mock.calls[0][0]);
    expect(requested.searchParams.get('profile')).toBe('hiking-mountain');
    expect(requested.searchParams.get('profile:SAC_scale_limit')).toBe('2');
    expect(requested.searchParams.get('profile:SAC_scale_preferred')).toBe('1');
    expect(requested.searchParams.get('format')).toBe('geojson');
    expect(requested.searchParams.get('lonlats').split('|')).toHaveLength(4);
    expect(result).toMatchObject({ distanceM:1840, closed:true, source:'openstreetmap-brouter' });
    expect(result.path).toHaveLength(3);
  });

  test('rejects routes above the planner limit', async () => {
    const fetchMock = jest.fn(async () => ({
      ok:true,
      json:async () => ({
        features:[{
          properties:{ 'track-length':'31000' },
          geometry:{ type:'LineString', coordinates:[[11.55,46.56],[11.75,46.76]] },
        }],
      }),
    }));
    await expect(plannerRouting.route([
      { lng:11.55, lat:46.56 },
      { lng:11.75, lat:46.76 },
    ], { fetch:fetchMock, maxDistanceM:30000 })).rejects.toMatchObject({ code:'too-long' });
  });
});
