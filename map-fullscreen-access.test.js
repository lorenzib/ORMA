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

  test('the compare explainer sits in a plain white card', () => {
    const html = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');
    expect(html).toContain('.browse-compare-note{margin:0 0 12px;padding:12px 15px;background:#fff;border:1px solid var(--paper-line);');
  });
});
