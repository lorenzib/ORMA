const fs = require('fs');
const path = require('path');

const root = __dirname;
const plannerHtml = fs.readFileSync(path.join(root, 'route-planner.html'), 'utf8');
const plannerSource = fs.readFileSync(path.join(root, 'route-planner.js'), 'utf8');
const detailHtml = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, 'trail.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const savedHtml = fs.readFileSync(path.join(root, 'saved.html'), 'utf8');

describe('standalone draft route planner', () => {
  test('is entered from Explore and absent from trail detail', () => {
    expect(homeHtml).toContain('href="route-planner.html">Create a draft route</a>');
    expect(detailHtml).not.toContain('id="mapLoopComposerBtn"');
    expect(detailHtml).not.toContain('id="mapLoopComposerPanel"');
    expect(detailSource).not.toContain('    initLoopComposer(map, t);');
  });

  test('selects routing coverage geographically rather than by trail id', () => {
    expect(plannerSource).toContain('function coverageFor(point)');
    expect(plannerSource).toContain('contains(entry, point)');
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
    expect(plannerSource).toContain('router.routeLoop(points, graph, options)');
  });

  test('states the safety limitations and exposes saved drafts', () => {
    expect(plannerHtml).toContain('This is not an ORMA-verified trail.');
    expect(plannerHtml).toContain('does not confirm legal access');
    expect(savedHtml).toContain('id="my-routes"');
    expect(savedHtml).toContain('route-planner.html?route=');
  });
});
