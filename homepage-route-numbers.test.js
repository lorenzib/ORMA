const fs = require('fs');
const path = require('path');

describe('logged-in homepage route numbers', () => {
  const root = __dirname;
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  test('loads route reference extraction before the homepage controller', () => {
    expect(html.indexOf('trail-route-refs.js')).toBeGreaterThan(-1);
    expect(html.indexOf('trail-route-refs.js')).toBeLessThan(html.indexOf('script.js?v='));
  });

  test('adds a prominent score-coloured number above each personalised route', () => {
    expect(script).toContain("id: 'trail-paths-route-number'");
    expect(script).toContain("'symbol-placement': 'line'");
    expect(script).toContain("'symbol-spacing': 240");
    expect(script).toContain("'text-field': ['get', 'routeRef']");
    expect(script).toContain("9, 14, 12, 17, 15, 20");
    expect(script).toContain("'text-halo-width': 5");
    expect(script).toContain('window.DoloPawsTrailRouteRefs.forTrail(t)[0]');
  });
});
