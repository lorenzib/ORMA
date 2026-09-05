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

  test('the catalogue corridor carries the active dog match colour', () => {
    // Four stacked rails (halo, line, mapped-casing, mapped-line) collapsed
    // into one cased corridor once masking the raster stopped being the goal.
    // What must survive is the personalised colour, not the layer count.
    // One definition of the tiers now, in map-style.js.
    expect(script).toContain("const catalogueMatchColour = window.ORMAMapStyle.matchColourExpression('score');");
    expect(fs.readFileSync(path.join(root, 'map-style.js'), 'utf8'))
      .toContain("MATCH_COLOURS = Object.freeze({ good: '#4A7856', fair: '#C98A2E', poor: '#9C3A25' })");
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?'line-color': catalogueMatchColour/);
    expect(script).not.toContain("id: 'trail-paths-mapped-casing'");
    expect(script).not.toContain("id: 'trail-paths-mapped-line'");
    expect(script).toContain("13, 20, 16, 26");
    expect(script).toContain("13, 15, 16, 20");
  });

  test('leaves route numbers to the Waymarked raster it no longer masks', () => {
    // The catalogue rails sit UNDER the hiking raster now, so Waymarked's own
    // numbered shields are visible on them. Reprinting our own would just be
    // duplicates fighting the real ones for space.
    expect(script).not.toContain("id:'trail-paths-route-number'");
    expect(script).not.toContain('addShieldLayer');
    expect(script).not.toContain("addSource('trail-route-refs'");
    expect(script).toMatch(/id: 'trail-paths-orma-line'[\s\S]*?\}, 'waymarked-hiking-layer'\);/);
  });
});
