# PERF-02 — Asset and regional loading optimization

Status: implemented

## Outcome

ORMA now delays the map engine until a map approaches the viewport or a
map control is engaged. The route and core trail content remain available
without MapLibre, while regional amenities join after the map's primary work
has completed.

## Loading boundaries

- The homepage requests Dolomites trail data by default.
- Trail detail resolves the requested trail ID to one region before loading
  that region's trail and POI files.
- Browse/catalogue pages can still request both regions because cross-region
  discovery is their explicit job.
- Homepage water, dog-route, hut, and bar layers are scheduled as secondary
  work after the visible trail catalogue.
- Trail-detail huts, bars, and water load only after the detail map is visible
  and the browser has idle capacity.

`map-runtime.js` owns one shared, pinned MapLibre load promise. It waits for
both the script and stylesheet before map construction, preventing a map from
being drawn before its layout styles are ready.

## Images

The 15–16 MB Carezza and Braies PNG files are retained as source assets only;
runtime code does not reference them. The website uses responsive WebP files
with 480 px mobile choices and optimized JPEG fallbacks. Three Savoy photos
that previously transferred 1.3–1.6 MB now also have 480 px and 960 px WebP
choices plus JPEG fallbacks. Explicit dimensions reduce layout movement.

The throttled mobile gate after this change measured:

| Scenario | Transfer | LCP | INP | CLS | JS execution |
| --- | ---: | ---: | ---: | ---: | ---: |
| Homepage | 1720.5 KB | 4120 ms | 104 ms | 0.715 | 104 ms |
| Discovery | 1397.3 KB | 2900 ms | 88 ms | 0.527 | 160 ms |
| Trail detail | 2141.9 KB | 8480 ms | 88 ms | 0.813 | 300 ms |
| Download flow | 1619.3 KB | 8488 ms | 88 ms | 0.813 | 77 ms |
| Active hike | 1850.2 KB | 8488 ms | 72 ms | 0.813 | 78 ms |

All five remain within the PERF-01 regression budgets. The high absolute LCP
and CLS values remain visible technical debt; passing a regression ceiling is
not presented as meeting a Core Web Vitals target.

## Verification

- `performance-loading.test.js` protects lazy maps, regional boundaries, and
  responsive image availability.
- `npm test -- --runInBand` protects application behavior.
- `npm run test:static` protects generated/static trail pages.
- `npm run perf:mobile` verifies the five PERF-01 mobile budgets under the
  documented throttled profile.

The original PERF-01 baseline remains the comparison point rather than being
rewritten after optimization.

## Regression verification — 2026-08-11

The full three-run, cold-cache mobile profile was repeated after the homepage
navigation changes. Every scenario remained inside its checked-in ceiling:

| Scenario | Transfer | LCP | INP | CLS | JS execution |
| --- | ---: | ---: | ---: | ---: | ---: |
| Homepage | 1844.3 KB | 4384 ms | 88 ms | 0.715 | 93 ms |
| Discovery | 1622.0 KB | 2920 ms | 88 ms | 0.501 | 158 ms |
| Trail detail | 2153.6 KB | 8580 ms | 80 ms | 0.838 | 287 ms |
| Download flow | 1631.0 KB | 8564 ms | 72 ms | 0.813 | 73 ms |
| Active hike | 1861.9 KB | 8576 ms | 72 ms | 0.813 | 78 ms |

This is a regression pass, not a claim that the remaining absolute LCP or CLS
technical debt has been eliminated.
