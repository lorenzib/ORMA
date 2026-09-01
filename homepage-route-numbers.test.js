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

  test('keeps official mapped numbers above a wider ORMA colour underlay', () => {
    expect(script).not.toContain("id: 'trail-paths-route-number'");
    expect(script).not.toContain("source: 'trail-route-refs'");
    expect(script).toContain("13, 18, 16, 22");
    expect(script).toContain("13, 13, 16, 16");
    expect(script).toContain("}, 'waymarked-hiking-layer');");
    expect(script).toContain("14, 0.82");
    expect(script).toContain("16, 0.95");
    expect(script).toContain("'raster-resampling': 'nearest'");
  });
});
