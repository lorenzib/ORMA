'use strict';

/**
 * Our own hiking network replaces Waymarked's raster, so every numbered route
 * it drew must come out of here with its number, as one joined line where its
 * ways meet. The OPL below is the shape osmium writes after
 * `add-locations-to-ways`: ways first with coordinates on each node, then the
 * relations.
 */

const { routesFromOpl, parseTags, mergeWays } = require('./build-hiking-routes');

const OPL = [
  'w1 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Thighway=path Nn1x11.1000000y46.6000000,n2x11.1010000y46.6000000',
  // Drawn against the route's direction; the merge must turn it round.
  'w2 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Thighway=path Nn3x11.1020000y46.6010000,n2x11.1010000y46.6000000',
  'w3 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Thighway=track Nn8x11.2000000y46.7000000,n9x11.2010000y46.7000000',
  // A node outside the extract keeps no location, so this way is unusable.
  'w4 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Thighway=path Nn10x11.3000000y46.8000000,n11',
  'r100 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Ttype=route,route=hiking,ref=7A,name=Sentiero%20%delle%20%Malghe%2c%%20%Funes,network=lwn,osmc:symbol=red:red:white_bar Mw1@,w2@forward,w4@',
  'r101 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Ttype=route,route=foot,network=rwn Mw3@',
  'r102 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Ttype=route,route=bicycle,ref=9 Mw3@',
  'r103 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Ttype=route,route=hiking,ref=12,state=proposed Mw3@',
  'r104 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Ttype=superroute,route=hiking,ref=AV1 Mr100@,r101@',
  'r105 v1 dV c1 t2026-10-01T00:00:00Z i1 uA Ttype=route,route=hiking,ref=99 Mw4@',
];

async function routes(lines){
  const out = [];
  for await (const feature of routesFromOpl(lines)) out.push(feature);
  return out;
}

test('each hiking route keeps its number, name and network', async () => {
  const [first] = await routes(OPL);
  expect(first.properties).toEqual({ id: 100, ref: '7A', name: 'Sentiero delle Malghe, Funes', network: 'lwn', rank: 4 });
});

test('a route\'s ways become one line where they share a node', async () => {
  const [first] = await routes(OPL);
  expect(first.geometry).toEqual({
    type: 'LineString',
    coordinates: [[11.1, 46.6], [11.101, 46.6], [11.102, 46.601]],
  });
});

test('foot routes count, other routes and unbuilt ones do not', async () => {
  const ids = (await routes(OPL)).map(feature => feature.id);
  expect(ids).toEqual([100, 101]);
});

test('an unnumbered route still draws, ranked by its network', async () => {
  const unnumbered = (await routes(OPL)).find(feature => feature.id === 101);
  expect(unnumbered.properties).toMatchObject({ ref: '', rank: 3 });
});

test('separate stretches of one route stay separate lines', () => {
  const node = (id, lon) => ({ id, lon, lat: 46 });
  const lines = mergeWays([[node('1', 11), node('2', 11.1)], [node('5', 12), node('6', 12.1)]]);
  expect(lines).toHaveLength(2);
});

test('OPL escapes are undone in keys and values', () => {
  expect(parseTags('name=G%e4%mpen%20%Alm,note%3d%x=a%40%b')).toEqual({ name: 'Gämpen Alm', 'note=x': 'a@b' });
});
