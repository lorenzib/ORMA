# OFF-02 — Offline package schema and download flow

**Status:** First deployable beta slice implemented for `lago-carezza`; field
data review and physical-device validation remain open.

## Purpose

This decision turns the OFF-01 architecture into a testable package without
replacing the production root service worker. It provides a narrow,
trail-specific offline surface scoped to `/offline/`.

## Package schema

Every manifest uses `schemaVersion: 1` and contains:

- trail ID and display name;
- immutable package version and generation date;
- geographic bounds used to plot GPS fixes;
- review status, attribution, and licence link;
- total declared package size;
- a list of required resources with role, URL, byte length, and SHA-256 hash.

Required roles for the first slice are:

- `shell`: standalone offline trail page;
- `style`: self-hosted offline styles;
- `app`: self-hosted offline application;
- `map`: georeferenced map or field-test diagram;
- `route`: GeoJSON route;
- `safety`: essential trail and emergency information.

## Download state machine

```text
unavailable
  → login required
  → ready to download
  → downloading N of M
  → verifying each resource
  → committing completed cache
  → ready offline

any download or verification failure
  → delete temporary cache
  → show recoverable error
  → ready to retry

browser or device interruption leaves an `-installing` cache
  → never treat it as ready
  → report incomplete on the next page load
  → restart and reverify every required resource

ready offline
  → open offline map
  → remove
  → unavailable
```

The package is first written to an `-installing` cache. It is copied to its
immutable final cache only after every declared resource passes its byte-length
and SHA-256 checks. Interrupted installations are therefore never presented as
ready. An abandoned temporary cache is detected on the next page load and can
be explicitly restarted from the beginning.

## Account rule

The trail page checks the current Firebase authentication state before starting
a download. Guests are sent through the existing login flow and the pending
download resumes after authentication.

Authentication is not included in the offline shell. Once installed, the
package can open and use GPS even if the Firebase session is unavailable or has
expired.

This is a product gate, not digital-rights management: same-origin browser
storage is controlled by the device owner.

## Storage and update rule

- Package resources use Cache Storage.
- A small local metadata record describes the installed version.
- Cache names are `dolopaws-trail-<trail-id>-<version>`.
- New verified versions replace older versions for the same trail.
- Removal deletes only caches for the selected trail.
- The scoped `/offline/offline-sw.js` worker never deletes root-site caches.

IndexedDB remains the planned metadata store when multiple packages and active
hike recovery are introduced. Local storage is sufficient for this single
package feasibility slice because the manifest remains authoritative. OFF-03's
first lifecycle increment adds a salted, device-scoped owner marker plus
installation date and freshness metadata without storing account identity.

## Lago di Carezza package status

The package contains the canonical route currently stored in `trails-data.js`,
essential facts, safety cautions, a standalone shell, and a georeferenced map
rendered locally from a small OpenStreetMap API extract. The map includes the
real lake shoreline, mapped paths, access roads, parking, buildings, water,
viewpoints, scale, north direction, and visible OSM attribution.

It deliberately declares:

```text
verificationStatus: field-review-required
```

The OSM map render is suitable for offline usability testing and is generated
without copying public map tiles. The route and safety assertions still require
a dated field review, so this package cannot yet close the content-quality gate
in OFF-01.

## Completion gates

Before this slice is promoted beyond beta verification:

1. Complete and date the Lago di Carezza route-specific source review.
2. Confirm the locally rendered OSM map is legible on the supported phones.
3. Deploy the updated package.
4. Run the OFF-01 iPhone and Android acceptance matrix.
5. Record storage, download, restart, GPS, and deletion results.
