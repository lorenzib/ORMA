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

  test('keeps every mapped route rail in the active dog match colour', () => {
    expect(script).toContain("id: 'trail-paths-mapped-casing'");
    expect(script).toContain("id: 'trail-paths-mapped-line'");
    expect(script).toMatch(/id: 'trail-paths-mapped-casing'[\s\S]*?'step'[\s\S]*?65, '#C98A2E', 85, '#4A7856'/);
    expect(script).toMatch(/id: 'trail-paths-mapped-line'[\s\S]*?'step'[\s\S]*?65, '#C98A2E', 85, '#4A7856'/);
    expect(script).toContain("13, 18, 16, 22");
    expect(script).toContain("13, 13, 16, 16");
    expect(script).toContain("13, 11, 16, 14");
    expect(script).toContain("13, 5, 16, 7");
  });

  test('uses the shared high-contrast route-number shields', () => {
    expect(script).toContain("id:'trail-paths-route-number'");
    expect(script).toContain("source:'trail-route-refs'");
    expect(script).toContain('window.DoloPawsTrailRouteRefs.addShieldLayer');
    expect(script).toContain('window.DoloPawsTrailRouteRefs.featuresForTrail(t)');
    expect(routeRefs).toContain("const SHIELD_IMAGE_ID = 'orma-route-number-shield'");
    expect(routeRefs).toContain("'icon-text-fit':'both'");
    expect(routeRefs).toContain("'text-color':'#17221B'");
    // Sized for reading, not for shouting: the previous 16-23px text in a
    // 1.08-1.34 scaled shield produced clip-art slabs, and the requested
    // "Open Sans Bold" 404s on the tile server so the glyphs were rasterised
    // locally and blurred.
    expect(routeRefs).toContain('12, 11.5, 16, 13, 19, 14');
    expect(routeRefs).toContain('12, 0.72, 16, 0.82, 19, 0.9');
    expect(routeRefs).toContain("'text-font':['Noto Sans Bold']");
    expect(routeRefs).toContain("refs.join(' / ')");
  });
});
