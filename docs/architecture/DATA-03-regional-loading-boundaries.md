# DATA-03 — Regional loading boundaries

**Status:** Complete in code (2026-08-05)

## Decision

DoloPaws keeps the canonical 164-trail source catalog unchanged for validation,
auditing, and static page generation. A deterministic build step derives two
runtime packages from it:

- `dolomites`: 110 trails;
- `savoy`: 54 trails.

`data/regions-manifest.json` is the public contract. It maps each region to its
trail, water, hut/bar, and dog-route assets, and maps every published trail ID
back to one region. `regions-runtime-manifest.js` is the synchronous browser
form of the same generated contract.

## Loading policy

| Surface | Initial runtime payload |
| --- | --- |
| Homepage | Dolomites, unless `?region=savoy` is requested |
| Trail detail | Only the region containing the requested trail ID |
| Browse-all, saved, compare, journal, collections | Both regions because these surfaces explicitly span the catalog |

Switching the homepage region loads the second trail payload on demand, then
replaces the map's water, hut/bar, and dog-route sources with the selected
region's assets. A failed optional regional request leaves the existing region
usable and displays a retryable connection message.

## Build and drift prevention

Run:

```sh
npm run build:regional-data
```

The route, POI, and static-page GitHub workflows run this command after their
canonical inputs change and commit the derived payloads. Regression tests fail
if the regional trail IDs no longer equal the canonical source IDs, if a trail
appears twice, if counts drift, or if a required regional asset is missing.

Static generation continues to load `trails-data.js`, `osm-trails-data.js`, and
`osm-trails-savoy-data.js` directly. The runtime split therefore cannot hide a
trail from the generated sitemap or published detail pages.

## Verified browser evidence

Local browser validation on 2026-08-05 confirmed:

- the default homepage requested only `dolomites-trails.js` and rendered 110;
- selecting Savoy requested `savoy-trails.js` on demand and rendered 54;
- a Savoy detail page requested only `savoy-trails.js`;
- Browse all requested both payloads and rendered all 164 trails.

Physical-device performance measurement belongs to PERF-01; DATA-03 establishes
the loading boundary that makes that comparison meaningful.
