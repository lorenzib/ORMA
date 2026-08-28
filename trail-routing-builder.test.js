const {
  buildGraph,
  overpassQuery,
  parseArguments,
  routeBounds,
  selectedTrails,
  splitBounds,
} = require('./scripts/build-mapped-trail-routing');

describe('catalogue mapped-routing graph builder', () => {
  test('requests a five-kilometre walking corridor around route geometry', () => {
    const bounds = routeBounds([[46.64, 11.70], [46.65, 11.72]], 5);
    expect(bounds.south).toBeLessThan(46.60);
    expect(bounds.north).toBeGreaterThan(46.69);
    expect(bounds.west).toBeLessThan(11.64);
    expect(bounds.east).toBeGreaterThan(11.78);
    const query = overpassQuery(bounds);
    expect(query).toContain('footway|path|pedestrian|track|steps|service|residential|living_street|unclassified');
    expect(query).toContain('(._;>;);');
  });

  test('splits dense corridors into complete, non-overlapping Overpass tiles', () => {
    const bounds = { south:46.4, west:12.3, north:46.52, east:12.46 };
    const tiles = splitBounds(bounds, 0.06, 0.08);
    expect(tiles).toHaveLength(4);
    expect(Math.min(...tiles.map(tile => tile.south))).toBe(bounds.south);
    expect(Math.max(...tiles.map(tile => tile.north))).toBe(bounds.north);
    expect(Math.min(...tiles.map(tile => tile.west))).toBe(bounds.west);
    expect(Math.max(...tiles.map(tile => tile.east))).toBe(bounds.east);
    expect(tiles.every(tile => tile.north - tile.south <= 0.060001)).toBe(true);
    expect(tiles.every(tile => tile.east - tile.west <= 0.080001)).toBe(true);
  });

  test('builds only the connected, dog-permitted walking network that reaches the trail', () => {
    const trail = { id:'fixture', path:[[46, 11], [46, 11.002]] };
    const osm = { elements:[
      { type:'node', id:1, lat:46, lon:11 },
      { type:'node', id:2, lat:46, lon:11.001 },
      { type:'node', id:3, lat:46, lon:11.002 },
      { type:'node', id:4, lat:46.01, lon:11.01 },
      { type:'node', id:5, lat:46.011, lon:11.011 },
      { type:'node', id:6, lat:46, lon:11.003 },
      { type:'way', id:10, nodes:[1, 2, 3], tags:{ highway:'path' } },
      { type:'way', id:11, nodes:[4, 5], tags:{ highway:'footway' } },
      { type:'way', id:12, nodes:[3, 6], tags:{ highway:'path', dog:'no' } },
    ] };
    const graph = buildGraph(trail, osm, {
      retrievedAt:'2026-08-27T00:00:00.000Z',
      bounds:{ south:45.9, west:10.9, north:46.1, east:11.1 },
      bufferKm:5,
    });
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.trailNodes).toHaveLength(3);
    expect(graph.attribution).toContain('OpenStreetMap');
    expect(graph.restrictions.excludes).toContain('dog=no');
  });

  test('drops sub-decimetre edges that round to an invalid zero cost', () => {
    const trail = { id:'tiny-edge', path:[[46, 11], [46, 11.001]] };
    const osm = { elements:[
      { type:'node', id:1, lat:46, lon:11 },
      { type:'node', id:2, lat:46, lon:11.0000000001 },
      { type:'node', id:3, lat:46, lon:11.001 },
      { type:'way', id:20, nodes:[1, 2, 3], tags:{ highway:'path' } },
    ] };
    const graph = buildGraph(trail, osm, { bufferKm:5 });
    expect(graph.edges.every(edge => edge[2] > 0)).toBe(true);
  });

  test('requires an explicit scope and recognises the Val di Funes batch', () => {
    expect(() => parseArguments([])).toThrow(/Choose/);
    const options = parseArguments(['--funes']);
    const trails = selectedTrails([
      { id:'funes', name:'Panorama', area:'Val di Funes / Villnöss' },
      { id:'other', name:'Lake', area:'Carezza' },
    ], options);
    expect(trails.map(trail => trail.id)).toEqual(['funes']);
  });
});
