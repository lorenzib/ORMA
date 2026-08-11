const fs = require('fs');
const path = require('path');
const amenities = require('./scripts/fetch-amenities.js');

describe('TOOL-01 fetch utility boundary', () => {
  test('network fetch utilities live under scripts', () => {
    expect(fs.existsSync(path.join(__dirname, 'fetch-amenities.js'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, 'scripts', 'fetch-amenities.js'))).toBe(true);
    const rootFetchers = fs.readdirSync(__dirname)
      .filter(name => /^fetch-.*\.js$/.test(name) && !name.endsWith('.test.js'));
    expect(rootFetchers).toEqual([]);
  });

  test('the diagnostic converter has deterministic GeoJSON output', () => {
    const result = amenities.osmToGeojson({ elements:[
      { type:'node', id:1, lat:46.5, lon:11.7, tags:{ name:'Tap' } },
      { type:'way', id:2, tags:{ name:'Bench row' }, geometry:[
        { lat:46.5, lon:11.7 }, { lat:46.6, lon:11.8 },
      ] },
    ] });

    expect(result).toEqual({
      type:'FeatureCollection',
      features:[
        {
          type:'Feature',
          geometry:{ type:'Point', coordinates:[11.7, 46.5] },
          properties:{ id:1, name:'Tap', tags:{ name:'Tap' } },
        },
        {
          type:'Feature',
          geometry:{ type:'LineString', coordinates:[[11.7, 46.5], [11.8, 46.6]] },
          properties:{ id:2, name:'Bench row', tags:{ name:'Bench row' } },
        },
      ],
    });
  });

  test('package metadata exposes the diagnostic command explicitly', () => {
    const pkg = require('./package.json');
    expect(pkg.scripts['fetch:amenities']).toBe('node scripts/fetch-amenities.js');
  });
});
