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
  --user-agent 'ORMA-offline-map-builder/1.0 (https://www.dolopaws.com)' \
  --output data/offline-map-sources/lago-carezza.osm \
  'https://api.openstreetmap.org/api/0.6/map?bbox=11.5718,46.4070,11.5784,46.4113'
```

Regenerate the SVG:

```sh
node scripts/render-offline-osm-map.js
```

The output is a ORMA-designed Produced Work. The source data and output
retain the required OpenStreetMap attribution.
