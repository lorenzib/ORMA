const fs = require('fs');
const path = require('path');

describe('logged-in homepage mapped-route hierarchy', () => {
  const root = __dirname;
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  test('loads route reference extraction before the homepage controller', () => {
    expect(html.indexOf('trail-route-refs.js')).toBeGreaterThan(-1);
    expect(html.indexOf('trail-route-refs.js')).toBeLessThan(html.indexOf('script.js?v='));
  });

  test('draws a consistent purple mapped route above the ORMA colour underlay', () => {
    expect(script).toContain("id: 'trail-paths-mapped-casing'");
    expect(script).toContain("id: 'trail-paths-mapped-line'");
    expect(script).toContain("'line-color': '#76528C'");
    expect(script).toContain("13, 18, 16, 22");
    expect(script).toContain("13, 13, 16, 16");
    expect(script).toContain("13, 11, 16, 14");
    expect(script).toContain("13, 5, 16, 7");
  });

  test('uses scalable white shields with black numbers that grow with zoom', () => {
    expect(script).toContain("id: 'trail-paths-route-number'");
    expect(script).toContain("source: 'trail-route-refs'");
    expect(script).toContain("'icon-image': 'orma-route-number-shield'");
    expect(script).toContain("'icon-text-fit': 'both'");
    expect(script).toContain("'text-color': '#202821'");
    expect(script).toContain("8, 12, 12, 14, 16, 18, 19, 22");
    expect(script).toContain("8, 0.85, 12, 1, 16, 1.2, 19, 1.4");
    expect(script).toContain('window.DoloPawsTrailRouteRefs.segmentsForTrail(t)');
    expect(script).toContain('refs.length === 1');
  });
});
