const fs = require('fs');
const path = require('path');

describe('logged-in homepage mapped-route hierarchy', () => {
  const root = __dirname;
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const routeRefs = fs.readFileSync(path.join(root, 'trail-route-refs.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  test('loads route reference extraction before the homepage controller', () => {
    expect(html.indexOf('trail-route-refs.js')).toBeGreaterThan(-1);
    expect(html.indexOf('trail-route-refs.js')).toBeLessThan(html.indexOf('script.js?v='));
  });

  test('the shortlist carries match colours while other routes recede', () => {
    // Four stacked rails (halo, line, mapped-casing, mapped-line) collapsed
    // into one cased corridor once masking the raster stopped being the goal.
    // What must survive is the personalised colour, not the layer count.
    // One definition of the tiers now, in map-style.js.
    expect(script).toContain("const catalogueMatchColour = window.ORMAMapStyle.matchColourExpression('score');");
    expect(fs.readFileSync(path.join(root, 'map-style.js'), 'utf8'))
      .toContain("MATCH_COLOURS = Object.freeze({ good: '#4A7856', fair: '#C98A2E', poor: '#9C3A25' })");
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-color': \[[\s\S]*?catalogueMatchColour, '#9AA19C'/);
    // The shortlist is a thin solid match-colour line on a white edge (owner,
    // 19 Nov: the old 15-20 px translucent bands read as blobs); the other
    // trails are fainter hairlines at 0.5.
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-width': rankWidth\(\[1\.5, 2, 2\.5, 3\.5\], \[0\.8, 1\.2, 1\.6, 2\]\)/);
    expect(script).not.toContain("id: 'trail-paths-mapped-casing'");
    expect(script).not.toContain("id: 'trail-paths-mapped-line'");
    // Thin lines, expressed per rank rather than as a bare zoom ramp.
    expect(script).toContain('rankWidth([3, 4.5, 5.5, 7], [1.5, 2.5, 3.5, 4.5])');
    expect(script).toContain('rankWidth([1.5, 2, 2.5, 3.5], [0.8, 1.2, 1.6, 2])');
    expect(script).toContain("'line-opacity': ['case', TOP_MATCH_TEST, 1, 0.5]");
    expect(script).not.toContain('rankWidth([5, 10, 15, 20]');
  });

  test('leaves route numbers to the hiking network', () => {
    // The catalogue rails sit under the hiking network's route numbers, so
    // the network numbers the routes itself. Reprinting our own shields would
    // just be duplicates fighting those for space.
    expect(script).not.toContain("id:'trail-paths-route-number'");
    expect(script).not.toContain('addShieldLayer');
    expect(script).not.toContain("addSource('trail-route-refs'");
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?\}, railsBeforeId\);/);
  });
});
