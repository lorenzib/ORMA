# OFF-01 — Offline map architecture decision

**Status:** Provisional decision accepted for the beta. Local feasibility passed; production map generation and physical-device validation remain open.

## Outcome

For the first DoloPaws beta, each downloadable trail should contain a small,
bounded offline package:

- a georeferenced raster map covering the trail corridor;
- the route as GeoJSON;
- safety points and essential trail facts as structured JSON;
- package metadata, attribution, version, size, and integrity information.

The package will be stored in browser-managed storage and displayed without a
network connection. The download action remains available only to signed-in
users, but an already downloaded trail must continue working after the session
expires or the user loses connectivity.

This is intentionally narrower than downloading arbitrary map tiles. It gives
hikers a dependable trail-specific map while keeping package size, licensing,
and browser-storage behaviour understandable during beta.

## Why this decision is needed

The current site loads map code, styles, and data from several remote services.
Those dependencies are suitable for an online prototype but cannot form a
reliable offline product:

- MapLibre GL JS and its stylesheet are loaded from a CDN.
- The primary basemap is supplied by OpenFreeMap.
- Elevation, satellite imagery, and hiking overlays use additional third-party
  services.
- The production service worker currently removes old caches and unregisters
  itself; it is not an offline runtime.

Simply caching every remote response would create an unreliable product and may
breach tile-provider policies.

## Options considered

### A. Cache third-party public map tiles

**Decision: rejected.**

It is technically easy to intercept requests with a service worker, but bulk
prefetching is prohibited by the OpenStreetMap standard tile policy. DoloPaws
also does not currently have explicit permission to bulk-download the other
public endpoints used by the site. Availability, retention, attribution, and
package completeness would remain outside our control.

### B. Download a bounded PMTiles archive

**Decision: retain as the likely scalable successor, not the beta default.**

PMTiles is a strong fit for static hosting and MapLibre, and a self-hosted
OSM-derived extract removes dependence on public tile servers. However, normal
PMTiles use relies on HTTP range requests. Complete offline use would require
downloading and retaining the bounded archive, then serving ranges from browser
storage through a custom protocol. That is feasible but adds storage, rendering,
and failure modes before the core hiking experience has been validated.

### C. Download a georeferenced raster corridor plus vector route

**Decision: selected for beta.**

A map image generated for one trail corridor is easy to verify as complete,
render without WebGL, version, remove, and keep within a predictable size. The
route and the hiker's position remain independent vector overlays, so they stay
clear at different screen sizes. The source image must be generated from data
DoloPaws is permitted to use offline—not captured from a public tile endpoint.

### D. Route line without a basemap

**Decision: use only as a fallback.**

The route, position, direction, distance, and safety points remain useful if the
map image is missing or corrupt. A line alone does not provide enough terrain
context to be the primary experience.

## Beta architecture

### 1. Build-time map generation

For every downloadable trail:

1. Calculate a corridor around the route, including a safety margin.
2. Render a north-up raster map from a self-hosted or contractually permitted
   OSM-derived data source.
3. Export the route separately as simplified GeoJSON.
4. Export safety points and essential facts as JSON.
5. Record geographic bounds, image dimensions, attribution, package version,
   and resource hashes in a manifest.

The recommended source pipeline is a self-hosted Protomaps/OSM extract. Public
OpenStreetMap or OpenFreeMap endpoints must not be bulk-cached unless DoloPaws
obtains explicit permission for that use.

### 2. Offline package

Each package should have this logical shape:

```text
trail-package/
├── manifest.json
├── map.webp
├── route.geojson
└── safety.json
```

The manifest is the source of truth. A package is marked **Ready offline** only
when all required resources exist and pass verification. OFF-02 will define the
final schema, integrity algorithm, and download-state machine.

### 3. Browser storage

- Use Cache Storage for immutable shell assets and trail-package resources.
- Use IndexedDB for package metadata, verification state, and the active-hike
  session.
- Use versioned DoloPaws-owned cache names; never delete unrelated origin
  storage.
- Ask for persistent storage when supported, but treat the answer as a hint
  rather than a guarantee.
- Show the estimated download size before download and re-check free space.
- Verify the package after download and again before starting an offline hike.
- Make deletion explicit per trail.

Browser storage is still subject to quotas and possible eviction. Product copy
must say “available offline on this device,” not promise permanent storage.

### 4. Service worker

Replace the current service-worker kill switch only after the production
architecture is implemented and tested. The new worker should:

- cache a self-hosted, versioned app shell;
- serve verified trail-package resources cache-first;
- update shell assets without deleting trail packages;
- provide a stable offline page when a requested resource is unavailable;
- avoid claiming that `navigator.onLine` proves server reachability.

Map rendering code and essential icons must be self-hosted. An offline hike must
not depend on a CDN, analytics request, login refresh, or third-party API.

### 5. Location and hike mode

During a hike:

- request GPS permission only when the user starts tracking;
- plot the position against the stored geographic bounds;
- show GPS accuracy and last-fix age;
- retain the most recent valid position;
- calculate distance from the route locally;
- warn when the hiker appears off-route, while acknowledging GPS uncertainty;
- keep route, safety points, and essential facts available if the basemap cannot
  render.

Downloading requires an account. Reading an already verified package and using
GPS must not require a current login session.

## Licensing and attribution rules

- Do not prefetch or bulk-cache `tile.openstreetmap.org`.
- Do not assume a public map endpoint permits offline packaging because normal
  interactive access is free.
- Generate beta maps from a self-hosted extract or a provider agreement that
  explicitly permits offline use.
- Display OpenStreetMap attribution visibly on the offline map and link to the
  applicable licence when connectivity is available.
- Preserve source, licence, attribution text, and generation date in every
  package manifest.
- Review attribution presentation and any additional style/data licences before
  public beta.

## Local proof of concept

The isolated prototype in `experiments/offline-map-poc/` demonstrates the
storage and restoration model without changing the production service worker.

Verified locally:

- a package manifest controls the required resources;
- the package is not marked ready until all resources are present;
- route, safety facts, and a georeferenced test map restore from storage;
- the page reloads and remains usable after the local HTTP server is stopped;
- simulated position updates continue with the server unavailable;
- package removal is scoped to the prototype cache;
- automated tests cover manifest completeness and coordinate projection.

The fixture is synthetic and tiny. Its measured size is not evidence of a
production package size.

## Initial beta budgets to validate

These are product constraints for the first production fixture, not measured
results:

- target package size: **15 MB or less per trail**;
- warn before downloads larger than **25 MB**;
- target offline app shell: **3 MB or less**;
- include map detail only for the trail corridor and nearby escape context;
- provide an explicit low-storage error before starting an incomplete download.

If a representative trail cannot meet the target while remaining legible,
reassess image resolution, corridor width, WebP quality, and then the PMTiles
option.

## Physical-device acceptance checklist

Run the full checklist on:

- a current iPhone in Safari;
- the same iPhone with DoloPaws installed to the Home Screen;
- the oldest iPhone/iOS version selected for beta support;
- a current Android phone in Chrome;
- the same Android phone with DoloPaws installed;
- the oldest Android/Chrome combination selected for beta support.

For each device:

1. Sign in and download a representative real trail over Wi-Fi.
2. Confirm size, progress, completion, and visible attribution.
3. Close every DoloPaws tab, enable airplane mode, reopen, and load the trail.
4. Refresh while still in airplane mode.
5. Restart the phone and repeat the offline open.
6. Start hike mode, grant GPS, and confirm position, accuracy, and
   route-relative movement outdoors.
7. Deny location permission and confirm a useful, recoverable state.
8. Sign out or expire the session and confirm the downloaded trail still opens.
9. Simulate low storage and confirm no package is labelled ready after a partial
   download.
10. Remove the package and confirm only that trail's offline data is deleted.
11. Apply storage pressure where practical and confirm eviction is detected and
    explained.
12. Return online and confirm the package can be repaired or updated.

Record device, OS/browser version, package size, download time, reload result,
restart result, GPS behaviour, and defects.

## Exit criteria

OFF-01 can be closed only when:

- one representative real trail package is generated from an approved source;
- its attribution and licence treatment are confirmed;
- its size and legibility meet an agreed beta budget;
- the checklist passes on the selected iPhone and Android support floor;
- the team confirms that the raster-corridor approach is sufficient for beta.

Until then, the architecture is a provisional decision with a successful local
feasibility test—not a completed mobile validation.

## Follow-on work

1. **OFF-02:** Define the downloadable package schema, hashes, storage model, and
   download-state machine.
2. **DATA-01:** Produce one representative real trail package from the approved
   source pipeline.
3. **UX-01:** Design download, storage, repair, deletion, permission, and offline
   status flows.
4. **GPS-01:** Define GPS accuracy, stale-fix, off-route, and battery behaviour.
5. **QA-01:** Execute and record the physical-device matrix above.
