const fs = require('fs');
const { coordinateFor, withinBounds, trailFeature } = require('./browse-map.js');

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

  test('keeps every trailhead individual and carries homepage marker state', () => {
    expect(trailFeature({
      id:'matched-loop', name:'Matched Loop', lat:46.6, lng:11.7,
    }, { score:82, saved:true }).properties).toEqual(expect.objectContaining({
      id:'matched-loop', score:82, saved:1,
    }));

    const source=fs.readFileSync('browse-map.js','utf8');
    expect(source).not.toContain('cluster:true');
    expect(source).not.toContain('point_count');
    expect(source).not.toContain('getClusterExpansionZoom');
    expect(source).toContain("id:'browse-trails-individual'");
    expect(source).toContain("matchColourExpression('score')");
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
    expect(html).toContain('src="browse-map.js?v=20260909-1"');
    expect(html).toContain('scoreFor:matchScore');
    expect(html).toContain('savedFor:trail => !!currentFavorites[trail.id]');
  });

  test('uses the same map-left, results-right desktop order as the logged-in homepage', () => {
    const explore=fs.readFileSync('browse-trails.html','utf8');
    const homepage=fs.readFileSync('index.html','utf8');
    expect(explore.indexOf('<div class="browse-map-pane"')).toBeLessThan(
      explore.indexOf('<div class="browse-list-pane"')
    );
    expect(homepage.indexOf('<div class="li-map"')).toBeLessThan(
      homepage.indexOf('<aside class="li-list"')
    );
  });
});
