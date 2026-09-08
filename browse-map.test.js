const fs = require('fs');
const { coordinateFor, withinBounds } = require('./browse-map.js');

describe('Explore trail map', () => {
  test('uses a declared trailhead before the legacy coordinate', () => {
    expect(coordinateFor({
      startPoint:{ lat:46.54, lng:11.62 }, lat:40, lng:9,
    })).toEqual([11.62, 46.54]);
    expect(coordinateFor({ lat:46.6, lng:11.7 })).toEqual([11.7, 46.6]);
    expect(coordinateFor({ lat:null, lng:null })).toBeNull();
  });

  test('filters the catalogue to the visible map bounds', () => {
    const bounds={ west:11.5, east:11.8, south:46.4, north:46.7 };
    expect(withinBounds({ lat:46.54, lng:11.62 }, bounds)).toBe(true);
    expect(withinBounds({ lat:46.8, lng:11.62 }, bounds)).toBe(false);
    expect(withinBounds({ lat:46.54, lng:12.1 }, bounds)).toBe(false);
  });

  test('supports map bounds that cross the antimeridian', () => {
    const bounds={ west:170, east:-170, south:-20, north:20 };
    expect(withinBounds({ lat:0, lng:175 }, bounds)).toBe(true);
    expect(withinBounds({ lat:0, lng:-175 }, bounds)).toBe(true);
    expect(withinBounds({ lat:0, lng:0 }, bounds)).toBe(false);
  });

  test('the Explore page includes the linked catalogue and map controls', () => {
    const html=fs.readFileSync('browse-trails.html','utf8');
    expect(html).toContain('<title>Explore trails, ORMA</title>');
    expect(html).toContain('id="browseExplorer"');
    expect(html).toContain('id="browseMap"');
    expect(html).toContain('id="browseSearchBtn"');
    expect(html).toContain('id="browseSearchArea"');
    expect(html).toContain('data-browse-view="list"');
    expect(html).toContain('data-browse-view="map"');
    expect(html).toContain('src="browse-map.js?v=20260908-1"');
  });
});
