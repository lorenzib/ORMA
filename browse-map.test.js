const fs = require('fs');
const { coordinateFor, withinBounds, trailFeature } = require('./browse-map.js');

describe('Trails page map', () => {
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
    expect(source).toContain("fitColourExpression('fit', 'score')");
  });

  test('a pin carries its verdict tier, so it is the colour of its card', () => {
    expect(trailFeature({ id:'x', lat:46.6, lng:11.7 }, { score:90, fit:'fair' }).properties.fit).toBe('fair');
    expect(trailFeature({ id:'x', lat:46.6, lng:11.7 }, { score:90 }).properties.fit).toBe('');
  });

  test('the picked walk is drawn in its fit colour, not a fixed green', () => {
    const source=fs.readFileSync('browse-map.js','utf8');
    const line=source.slice(source.indexOf("id:'browse-selected-route-line'"));
    expect(line.slice(0, line.indexOf('});'))).toContain("'line-color':fitColour");
    expect(source).not.toContain("'line-color':'#2e4034'");
    const dot=source.slice(source.indexOf("id:'browse-trails-selected'"));
    expect(dot.slice(0, dot.indexOf('});'))).toContain("'circle-color':fitColour");
  });

  test('the popup says the verdict, not a heading with nothing under it', () => {
    const source=fs.readFileSync('browse-map.js','utf8');
    expect(source).not.toContain('Dog suitability at a glance');
    expect(source).toContain('browse-map-popup__verdict');
    const html=fs.readFileSync('browse-trails.html','utf8');
    expect(html).toContain('verdictFor:matchVerdict');
    expect(html).toContain('subjectLabel:scoredSubjectLabel');
  });

  test('the map has a key, in the pins\' own colours and the verdicts\' own words', () => {
    const html=fs.readFileSync('browse-trails.html','utf8');
    expect(html).toContain('id="browseMapKey"');
    ['strong-option','possible-with-cautions','not-recommended'].forEach(category => {
      expect(html).toContain(`data-category="${category}"`);
    });
    expect(html).toContain('OrmaMatchVerdict.categoryLabel(label.dataset.category, window.t)');
    ['good','fair','poor'].forEach(fit => expect(html).toContain(`data-fit="${fit}"`));
    expect(html).toContain('window.ORMAMapStyle.MATCH_COLOURS[dot.dataset.fit]');
  });

  test('the Trails page includes the linked catalogue and map controls', () => {
    const html=fs.readFileSync('browse-trails.html','utf8');
    expect(html).toContain('<title>Trails, ORMA</title>');
    expect(html).toContain('id="browseExplorer"');
    expect(html).toContain('id="browseMap"');
    expect(html).toContain('id="browseSearchBtn"');
    expect(html).toContain('id="browseSearchArea"');
    expect(html).toContain('data-browse-view="list"');
    expect(html).toContain('data-browse-view="map"');
    expect(html).toContain('src="browse-map.js?v=20261028-1"');
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
