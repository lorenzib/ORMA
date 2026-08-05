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
  });

  test('directions are location-gated on the map preview and detail page', () => {
    const home = source('index.html');
    const trail = source('trail.html');
    const app = source('script.js');
    const blueprint = source('trail-blueprint.js');

    expect(home).toContain('id="mapCalloutDirections"');
    expect(trail).toContain('id="getDirectionsStatus"');
    expect(app).toContain('planFromCurrent(navigator, target, navigator.userAgent, 100)');
    expect(blueprint).toContain('planFromCurrent(navigator, accessTarget, navigator.userAgent, 100)');
  });

  test('the compare explainer uses the glacier-blue palette', () => {
    const browse = source('browse-trails.html');
    expect(browse).toContain('background:#E1EFF4');
    expect(browse).toContain('color:#294D5A');
  });
});
