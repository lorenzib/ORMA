# Offline map source extracts

This directory contains the raw geographic source used to build ORMA
offline map images. These files are build inputs; they are not downloaded as
part of a trail package.

## Lago di Carezza

- File: `lago-carezza.osm`
- Source: OpenStreetMap API 0.6 bounding-box extract
- Retrieved: 2026-07-27
- Bounding box: `11.5718,46.4070,11.5784,46.4113`
- Licence: Open Database Licence (ODbL)
- Attribution: © OpenStreetMap contributors
- Licence information: https://www.openstreetmap.org/copyright

Retrieval command:

```sh
curl --fail --location \
  --user-agent 'ORMA-offline-map-builder/1.0 (https://www.app-orma.com)' \
  --output data/offline-map-sources/lago-carezza.osm \
  'https://api.openstreetmap.org/api/0.6/map?bbox=11.5718,46.4070,11.5784,46.4113'
```

Regenerate the SVG:

```sh
node scripts/render-offline-osm-map.js
```

Build or refresh the routable walking graph for a trail whose OSM extract and
`offline/packages/<trail-id>/route.geojson` are present, then publish browser
coverage:

```sh
node scripts/build-offline-footpath-network.js <trail-id>
npm run build:trail-routing
```

The graph builder excludes private/no pedestrian access, `foot=no`, `dog=no`,
and demanding/alpine SAC scales. A generated graph is mapped routing evidence,
not proof of a current opening; the product must keep its local-sign and
temporary-closure warning.

The output is a ORMA-designed Produced Work. The source data and output
retain the required OpenStreetMap attribution.

## Widening an extract for a trail whose drawn line is short

Two trails publish a distance their geometry does not reach, because the line
was only part of the walk:

| trail | published | drawn | what is missing |
| --- | --- | --- | --- |
| `alpe-siusi` | 7.5 km | 5.55 km | the loop runs further than the traced part |
| `prato-piazza` | 4.6 km | 2.27 km | the Alta Via 3 return leg across the plateau |

`alpe-siusi` already has an extract, but it was cut around the short line with
a uniform ~150 m pad, so it cannot supply the missing part. Both need a wider
area before the geometry can be rebuilt.

The OSM API's `/map` call is the simpler route and returns `<bounds>` itself,
but it refuses any request over **50,000 nodes**. The existing `alpe-siusi`
extract is 9,114 nodes over 3.7e-4 deg^2, so the box below works out at roughly
41,600 — inside the cap, but not by enough to rely on. Use Overpass, which has
no such limit once the query is filtered to walkable ways.

### Overpass

Run at https://overpass-turbo.eu or against any Overpass endpoint. Replace the
bbox line for each trail:

- `alpe-siusi`: `46.5200,11.6061,46.5534,11.6571`
- `prato-piazza`: `46.6282,12.1671,46.6658,12.2096`

```overpassql
[out:xml][timeout:180][bbox:46.5200,11.6061,46.5534,11.6571];
(
  // Everything the footpath builder will walk on.
  way["highway"~"^(footway|path|pedestrian|track|steps|service|residential|living_street|unclassified)$"];
  // The numbered hiking routes, so route membership survives into the extract.
  relation["route"="hiking"];
);
(._;>;);          // pull in the nodes the ways and relations refer to
out meta;
```

Save the result as `data/offline-map-sources/<trail-id>.osm`.

### Give it the bounds Overpass leaves out

`build-offline-footpath-network.js` requires a `<bounds>` element and clips its
edges to it. Overpass XML has none, so write back the box you asked for:

```sh
node scripts/ensure-osm-bounds.js \
  data/offline-map-sources/alpe-siusi.osm 46.5200 11.6061 46.5534 11.6571
```

It is idempotent, and a no-op on an extract that already has bounds.

### Then rebuild

```sh
node scripts/build-offline-footpath-network.js alpe-siusi
npm run build:trail-routing
```

The widened graph is what the route geometry is then rebuilt from. Record the
new bounding box and retrieval date in this file, as above, so the extract
stays reproducible.
