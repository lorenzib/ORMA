const fs = require('fs');
const path = require('path');

const source = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('map browsing controls', () => {
  test('the browse map and trail map expose accessible fullscreen controls', () => {
    const home = source('index.html');
    const trail = source('trail.html');
    const app = source('script.js');
    const detail = source('trail.js');
    const css = source('styles.css');

    expect(home).toContain('id="homeMapExpandBtn"');
    expect(trail).toContain('id="mapExpandBtn"');
    expect(home).toContain('aria-expanded="false"');
    expect(trail).toContain('aria-expanded="false"');
    expect(app).toContain("mapWrap.classList.toggle('map-fs', on)");
    expect(detail).toContain("mapBox.classList.toggle('map-fs', on)");
    expect(css).toContain('.li-map.map-fs{position:fixed;inset:0;');
    expect(css).toContain('.trail-map-box.map-fs{position:fixed;inset:0;');
    expect(css).toContain('.li-map .li-map-expand{top:10px;right:10px;');
    expect(css).toContain('.li-map .maplibregl-ctrl-top-right{top:46px;}');
    expect(trail).toContain('.td2 .map-expand-btn{top:12px;right:12px;');
    expect(trail).toContain('.td2 .trail-map-box .maplibregl-ctrl-top-right{top:48px;}');
  });

  test('map attribution starts collapsed behind its info button', () => {
    const app = source('script.js');
    const detail = source('trail.js');

    expect(app).toContain('attributionControl: { compact: true }');
    expect(app).toContain("attribution.classList.remove('maplibregl-compact-show')");
    expect(detail).toContain('attributionControl: { compact: true }');
    expect(detail).toContain("attribution.classList.remove('maplibregl-compact-show')");
  });

  test('map-card directions hand straight off to a maps app; the detail page stays location-gated', () => {
    const home = source('index.html');
    const trail = source('trail.html');
    const app = source('script.js');
    const blueprint = source('trail-blueprint.js');

    expect(home).toContain('id="mapCalloutDirections"');
    expect(home).toContain('id="mapCalloutDirMenu"');
    expect(home).not.toContain('mapCalloutDirectionsStatus');
    expect(app).toContain("appleA.href = `https://maps.apple.com/?daddr=");
    expect(app).not.toContain('planFromCurrent(navigator, target, navigator.userAgent, 100)');
    expect(trail).toContain('id="getDirectionsStatus"');
    expect(blueprint).toContain('planFromCurrent(navigator, accessTarget, navigator.userAgent, 100)');
  });

  test('the trail map prefers a mapped footpath route, supports a nearby route handoff, and keeps the start-point fallback explicit', () => {
    const trail = source('trail.html');
    const detail = source('trail.js');
    const coverage = source('trail-routing-coverage.js');

    expect(trail).toContain('id="mapNearestDirectionsBtn"');
    expect(trail).toContain('id="mapNearestDirectionsStatus"');
    expect(trail).toContain('id="mapNearestDirectionsSteps"');
    expect(detail).toContain('planTrailEntry(');
    expect(detail).toContain("mode === 'mapped-footpath'");
    expect(detail).toContain("mode === 'nearest-route'");
    expect(detail).toContain('Open directions to nearest trail point');
    expect(detail).toContain('ORMA does not yet have a connected footpath network here.');
    expect(detail).not.toContain('planToNearestRoute(navigator, t.path');
    expect(coverage).toContain('offline/packages/alpe-siusi/footpath-network.json');
    expect(coverage).toContain('offline/packages/lago-carezza/footpath-network.json');
  });

  test('the compare explainer sits in a plain white card', () => {
    const html = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');
    expect(html).toContain('.browse-compare-note{margin:0 0 12px;padding:12px 15px;background:#fff;border:1px solid var(--paper-line);');
  });
});
