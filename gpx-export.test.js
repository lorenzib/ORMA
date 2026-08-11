/** @jest-environment jsdom */

const gpx = require('./gpx-export');

const trail = {
  id:'demo-loop',
  name:'Lago & Meadow <Loop>',
  path:[[46.4108, 11.57925], [46.4112, 11.5789], [46.4108, 11.57925]],
  startPoint:{ lat:46.4107, lng:11.5794, label:'Bus & trailhead' },
};

describe('standards-compatible GPX export', () => {
  test('serializes GPX 1.1 metadata, trailhead and ordered geometry', () => {
    const xml = gpx.serialize(trail, { generatedAt:'2026-08-11T10:00:00Z' });
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    const root = parsed.documentElement;
    expect(root.localName).toBe('gpx');
    expect(root.namespaceURI).toBe('http://www.topografix.com/GPX/1/1');
    expect(root.getAttribute('version')).toBe('1.1');
    expect(parsed.querySelector('metadata > name').textContent).toBe(trail.name);
    expect(parsed.querySelector('metadata > desc').textContent).toBe(gpx.DISCLAIMER);
    const waypoint = parsed.querySelector('wpt');
    expect([waypoint.getAttribute('lat'), waypoint.getAttribute('lon')])
      .toEqual(['46.4107', '11.5794']);
    expect(waypoint.querySelector('name').textContent).toBe('Bus & trailhead');
    const points = [...parsed.querySelectorAll('trkseg > trkpt')]
      .map(point => [Number(point.getAttribute('lat')), Number(point.getAttribute('lon'))]);
    expect(points).toEqual(trail.path);
  });

  test('rejects missing or invalid route geometry', () => {
    expect(() => gpx.serialize({ name:'No route', path:[[99, 12], ['x', 2]] }))
      .toThrow('enough valid route geometry');
  });

  test('creates safe portable filenames', () => {
    expect(gpx.filename('Lago di Carezza / Karersee')).toBe('lago-di-carezza-karersee.gpx');
  });

  test('trail UI keeps the export behind the existing account intent', () => {
    const html = require('fs').readFileSync(require('path').join(__dirname, 'trail.html'), 'utf8');
    const script = require('fs').readFileSync(require('path').join(__dirname, 'trail.js'), 'utf8');
    expect(html).toContain('id="exportGpxBtn"');
    expect(html).toContain('src="gpx-export.js?v=20260811-1"');
    expect(script).toContain("DoloPawsTrailAction.request('export-gpx')");
    expect(script).toContain("DoloPawsTrailAction.consume('export-gpx')");
  });
});
