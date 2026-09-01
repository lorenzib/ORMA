const refs = require('./trail-route-refs');

describe('trail route-number guidance', () => {
  test('keeps verified numbered trails in walking order without duplicates', () => {
    expect(refs.forTrail({
      decisionPoints: [
        { instruction:'Switch from trail 7 onto trail 6' },
        { instruction:'Switch from trail 6 onto trail 30' },
      ],
      desc:'A loop using trails 7, 6, and 30.',
    })).toEqual(['7', '6', '30']);
  });

  test('reads mapped path names and alphanumeric route references', () => {
    expect(refs.forTrail({
      routeSource:{ name:'Seceda circuit (paths 1 and 1A)' },
      ref:'AV1',
    })).toEqual(['AV1', '1', '1A']);
  });

  test('does not mistake an OSM relation number for a trail number', () => {
    expect(refs.forTrail({
      osmRelation:11817269,
      routeSource:{ name:'Rundweg St. Magdalena' },
      waymarkedtrails:'https://hiking.waymarkedtrails.org/#route?id=11817269',
    })).toEqual([]);
  });

  test('reads verified references attached only to mapped route sections', () => {
    expect(refs.forTrail({
      routeRefSegments: [
        { ref:'15A', path:[[46.64, 11.92], [46.63, 11.92]] },
        { ref:'RA', path:[[46.63, 11.92], [46.62, 11.91]] },
      ],
    })).toEqual(['15A']);
  });

  test('splits route numbers at mapped switch points instead of combining them', () => {
    const path = [[46, 11], [46, 11.1], [46, 11.2], [46, 11.3], [46, 11.4], [46, 11.5]];
    expect(refs.segmentsForTrail({
      path,
      decisionPoints: [
        { lat:46, lng:11.2, instruction:'Switch from trail 7 onto trail 6' },
        { lat:46, lng:11.4, instruction:'Switch from trail 6 onto trail 30' },
      ],
    })).toEqual([
      { ref:'7', path:path.slice(0, 3) },
      { ref:'6', path:path.slice(2, 5) },
      { ref:'30', path:path.slice(4) },
    ]);
  });

  test('does not invent section geometry from an unlocated text sequence', () => {
    expect(refs.segmentsForTrail({
      path:[[46, 11], [46, 11.1]],
      routeSource:{ name:'Circuit using paths 7, 6 and 30' },
    })).toEqual([]);
  });

  test('builds the same line-labelled GeoJSON used by both route maps', () => {
    const trail = {
      id:'route-7',
      ref:'7',
      path:[[46, 11], [46.1, 11.1]],
    };
    expect(refs.featuresForTrail(trail)).toEqual([{
      type:'Feature',
      properties:{ id:'route-7', routeRef:'7' },
      geometry:{ type:'LineString', coordinates:[[11, 46], [11.1, 46.1]] },
    }]);
  });

  test('exposes switch timing for detailed route guidance', () => {
    const trail = {
      decisionPoints:[
        { km:2.31, lat:46, lng:11.2, instruction:'Switch from trail 7 onto trail 6' },
      ],
    };
    expect(refs.switchesForTrail(trail)).toEqual([
      expect.objectContaining({ from:'7', to:'6', km:2.31, lat:46, lng:11.2 }),
    ]);
  });

  test('does not mistake historical years following a route name for trail numbers', () => {
    expect(refs.forTrail({
      desc:'Waymarked Trails relation 9445694 follows the old railway line (1916–1960).',
    })).toEqual([]);
  });

  test('does not present a trail number that the route description says to avoid', () => {
    expect(refs.forTrail({
      desc:'This lower circuit deliberately avoids trail 525 and the exposed climb.',
    })).toEqual([]);
  });
});
