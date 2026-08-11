# TOOL-01 — Fetch utility boundary

Status: complete (2026-08-11)

## Rule

Network-fetch and ingestion utilities are developer/build tools and live under
`scripts/`. Nothing at the website root should look like a browser asset while
actually querying Overpass or generating source data.

## Maintained commands and outputs

| Command | Purpose | Governed output |
| --- | --- | --- |
| `npm run fetch:dolomites-trails` | Fetch broad Dolomites hiking candidates | `data/dolomites-trails.json` |
| `node scripts/fetch-dog-friendly-routes.js --region dolomites` | Fetch and screen Dolomites route relations and access points | `dog-friendly-routes.geojson`, `data/access-points.geojson`, `data/dog-route-review.json` |
| `node scripts/fetch-dog-friendly-routes.js --region savoy` | Fetch and screen Savoy route relations and access points | `dog-friendly-routes-savoy.geojson`, `data/access-points-savoy.geojson`, `data/dog-route-review-savoy.json` |
| `node scripts/fetch-huts-bars.js` | Refresh regional food, drink, hut and shelter POIs | `huts-bars-all-regions.geojson` |
| `npm run fetch:amenities` | Diagnose Trentino-Alto Adige fountain and bench availability | stdout only; no production artifact |

## Downstream gates

Fetched trail candidates are adapters' input, never published directly. Run
the relevant schema validation and `npm run generate:artifacts` before any
generated page or regional payload is committed.

POI refreshes must be followed by `npm run build:regional-data`, then the
generated-artifact and static-link checks. The scheduled POI workflow follows
this boundary for the production hut/food dataset.

The amenities command is deliberately diagnostic. Its former root-level file
claimed browser usage and “data ready” despite writing nothing; moving it under
`scripts/` and documenting stdout-only output removes that ambiguity.

## Network safety

These commands contact third-party Overpass endpoints and are never run by the
web application. Production-writing fetchers include retry/floor checks and
must refuse to replace a healthy artifact with a suspiciously small response.

