const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('PERF-02 asset and regional loading contract', () => {
  test('homepage and trail detail load MapLibre on demand', () => {
    const homepage = read('index.html');
    const detail = read('trail.html');
    [homepage, detail].forEach(html => {
      expect(html).not.toContain('unpkg.com/maplibre-gl@5.24.0');
      expect(html).toContain('map-runtime.js?v=20260810-1');
    });
    const runtime = read('map-runtime.js');
    expect(runtime).toContain('IntersectionObserver');
    expect(runtime).toContain("rootMargin: opts.rootMargin || '320px 0px'");
    expect(runtime).toContain('Promise.all([loadStyle(), loadScript()])');
  });

  test('homepage and detail map scheduling includes secondary POIs', () => {
    const homepage = read('script.js');
    const detail = read('trail.js');
    expect(homepage).toContain('function scheduleGuestMap()');
    expect(homepage).toContain('function scheduleTrailMap()');
    expect(homepage).toContain("renderGondolas(guestMapInstance, 'guest-gondolas', { visible: true })");
    expect(homepage).toContain('const overlayStates = { routes: true, lifts: true');
    expect(homepage).toContain('onIdle(loadSecondaryMapData, 5000)');
    expect(homepage.indexOf("renderGondolas(trailMapInstance, 'trailmap-gondolas')"))
      .toBeGreaterThan(homepage.indexOf('const loadSecondaryMapData = () =>'));
    expect(homepage).toContain("overlayControls.sync('lifts')");
    expect(homepage).toContain("lifts:    ['trailmap-gondolas-line', 'trailmap-gondolas-labels']");
    expect(homepage).toContain('function publicLiftNote(note)');
    expect(homepage).not.toContain('<br>${station.label}');
    expect(detail).toContain('whenVisible(detailMapTarget, initDetailMap');
    expect(detail).toContain('function publicLiftNote(note)');
    expect(detail).not.toContain("p.label ? '<br>' + p.label");
    expect(detail).toContain('onIdle(loadSecondaryPois, 4500)');
    expect(detail.indexOf('renderAllLifts(map);'))
      .toBeGreaterThan(detail.indexOf('const loadSecondaryPois = () =>'));
  });

  test('trail loaders keep default and requested regions explicit', () => {
    expect(read('index.html')).toContain('data-default-region="dolomites"');
    expect(read('trail.html')).toContain('data-default-region="trail"');
    const loader = read('regional-trails-loader.js');
    expect(loader).toContain("mode === 'trail'");
    expect(loader).toContain('regionForTrail:');
  });

  test('oversized trail photos have mobile WebP variants and JPEG fallbacks', () => {
    const stems = [
      'lago-di-braies',
      'lago-di-carezza',
      'boucle-du-marais-des-chassettes',
      'circuit-beatrice-de-savoie',
      'itineraire-decouverte-de-la-nature',
    ];
    stems.forEach(stem => {
      const mobile = path.join(__dirname, 'images', `${stem}-480.webp`);
      const fallback = path.join(__dirname, 'images', `${stem}.jpg`);
      expect(fs.existsSync(mobile)).toBe(true);
      expect(fs.existsSync(fallback)).toBe(true);
      expect(fs.statSync(mobile).size).toBeLessThan(100 * 1024);
      expect(fs.statSync(fallback).size).toBeLessThan(350 * 1024);
    });
    expect(read('index.html')).not.toContain('lago-di-braies.png');
    expect(read('trail-card-visual.js')).toContain('srcset=');
  });
});
