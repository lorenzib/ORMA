# OFF-07 — Offline packages for every Verified trail

**Status:** Implemented 2026-10-23. The `field-review-required` label below was
replaced on 2026-10-24 by OFF-08: an offline map now says what its trail page
says. The physical-device gates are unchanged.

## Decision

The offline beta began with two hand-built pilots, Lago di Carezza and Alpe di
Siusi. From this decision, every trail the site shows as **Verified by ORMA**
also has an offline package, and its trail page offers the download.

The scope is the Verified seal, by the same rule the badge uses
(`trust/evidence-v1.js` `tierOf`: `route-audited` or `field-verified`). A
Verified trail's route was audited against authority sources, so it is the
line we are most willing to put on a phone that may have no signal. A trail
that is only Reviewed or Imported gets no package.

What does not change:

- Every package is labelled `field-review-required`, on the manifest, on
  `safety.json` and on the offline page. Verified means audited from sources,
  not walked with this package.
- Downloading still needs a signed-in account (OFF-03).
- The device-test gates (`OFFLINE-IOS-CURRENT`, `OFFLINE-ANDROID-CURRENT`,
  `HIKE-RESTORE-GPS`) are run on the two pilots. The other packages use the
  same reader, byte for byte, so the pilots' results stand for the reader.
- `ROUTE-FIELD-REVIEW` names the two pilots. Each other route keeps its
  `field-review-required` label until it has its own dated review.

## How a package is built

`node scripts/build-offline-packages.js` does, for each Verified trail:

1. **Route.** The line the trail page draws, as GeoJSON.
2. **Corridor.** The route's box plus 400 m, then widened on its short side to
   the map's aspect (1200 px wide, 720–1600 px tall), so the drawing is never
   stretched.
3. **Extract.** One Overpass query for that box, filtered to what the map draws
   and the footpath router walks on (`overpass-corridor-v1`).
4. **Files.** `map.svg` (the pilots' renderer, in its `generated` mode: minor
   roads drawn, ways outside the frame dropped, labels kept apart),
   `footpath-network.json`, `elevation-profile.json` and `safety.json`, then
   the manifest with sizes and SHA-256 hashes.
5. **List.** The download list in `offline-packages.js` is rewritten from the
   manifests that exist.

The elevation profile is the trail's stored one. Six Verified trails have
none; for those, ground height is sampled along the route from Open-Meteo, and
the profile names that source.

`safety.json` is written from the published trail: its start point, water
points, heat and exposure flags and surface hazards, with the same wording the
trail page uses. Nothing is added that the trail record does not say.

The raw extracts are not committed. The largest is 6.7 MB of OSM XML, and 77
would add over 100 MB to every clone. They are cached in
`.cache/offline-map-sources/`; the package records its bounds and retrieval
date, so the extract can be fetched again.

## Revisions

A generated package's revision is `<date>-beta.<n>` and moves on its own, but
only when a downloadable byte changes (the OFF rule since beta.21). The two
pilots keep revisions typed in `scripts/build-offline-manifest.js`, because the
device-test records name them.

This change moved the pilots to Carezza `2026.10.23-beta.22` and Alpe di Siusi
`2026.10.23-beta.10`. No route, map, profile or safety byte changed; the shared
reader (`offline/offline-app.js`) now finds any package by trail id and leaves
out a fact a trail does not record.

## Keeping it current

`.github/workflows/orma-offline-packages.yml` keeps the packages following the
seal, so nobody has to remember to run the builder. It runs every morning at
05:40 Europe/Rome, by hand, and after a push to main that changes the trail
sources, the verified-trail overrides or the evidence rule. (A verification
merged with the workflow token starts no workflow, which is why the morning
run exists.) It runs:

```
node scripts/build-offline-packages.js --prune --stale
npm run build:trail-routing
npm run build:trail-page-bundle
```

- A trail that **gains** the seal has no package, so `--stale` builds it.
- A trail whose route, stored elevation profile or safety facts changed is
  rebuilt. Everything else keeps its bytes and its revision, so a run without
  the extract cache fetches only the corridors it needs.
- A trail that **loses** the seal: `--prune` removes its package.
  `offline-beta-scope.test.js` fails until it is gone, so a withdrawal pull
  request must prune in the same change.
- One builder at a time (`concurrency: orma-offline-packages`), pinned to
  `overpass-api.de`. The corridor extracts live in an actions cache.
- The result is its own pull request on `orma-bot/offline-packages`, published
  the way the hazard snapshot is: the run approves the PR's quality-gate run,
  merges once it passes, and dispatches validation and the website deploy.
- `--refresh` fetches every extract again, for newer OpenStreetMap data. That
  stays a hand-run job.

## Where else it shows

- The live hike mode on a trail page offers "Route me to the trail" for every
  trail with a package, not only the two pilots.
- The route planner's walking coverage (`trail-routing-coverage.js`) uses a
  package's footpath graph where a trail has no wider five-kilometre graph in
  `routing-graphs/`.
