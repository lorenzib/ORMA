const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('shared map quality profile', () => {
  test('uses antialiasing and hiking-specific vector refinements', () => {
    const runtime = read('map-runtime.js');
    expect(runtime).toContain('antialias: true');
    expect(runtime).toContain("'road_path_pedestrian'");
    expect(runtime).toContain("'highway-name-path'");
    expect(runtime).toContain("['poi_r1', 12]");
    expect(runtime).toContain("'raster-resampling', 'linear'");
  });

  test('applies the profile to the primary map experiences', () => {
    ['script.js', 'trail.js', 'walk-page.js', 'collection-detail.js'].forEach(file => {
      const source = read(file);
      expect(source).toContain('DoloPawsMapRuntime.mapOptions');
      expect(source).toContain('DoloPawsMapRuntime.enhance');
    });
  });

  test('loads the shared runtime before each primary page map', () => {
    const pages = [
      ['index.html', 'script.js'],
      ['trail.html', 'trail.js'],
      ['collection.html', 'collection-detail.js'],
      ['walk.html', 'walk-page.js'],
    ];
    pages.forEach(([page, mapScript]) => {
      const html = read(page);
      expect(html).toContain('map-runtime.js?v=20260826-1');
      expect(html.indexOf('map-runtime.js?v=20260826-1'))
        .toBeLessThan(html.indexOf(`src="${mapScript}`));
    });
  });

  test('uses the full-width trail card without a duplicate map popup', () => {
    const homepage = read('index.html');
    const script = read('script.js');
    expect(homepage).toContain('id="mapCallout"');
    expect(homepage).toContain('id="mapCalloutOpen"');
    expect(homepage).toContain('<a class="map-callout-thumb" id="mapCalloutThumb" href="#"></a>');
    expect(script).toContain('showMapCallout(t)');
    expect(script).toContain('thumb.href = trailUrl');
    expect(script).toContain("thumb.setAttribute('aria-label', `Open ${t.name} trail details`)");
    expect(script).not.toContain('showTrailMapPopup');
    expect(script).not.toContain("className: 'trail-map-popup'");
  });
});
