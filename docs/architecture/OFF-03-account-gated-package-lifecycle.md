# OFF-03 — Account-gated package storage and lifecycle

**Status:** In progress; owner metadata and restartable recovery slices complete

**Implementation date:** 2026-07-28

## Completed slice

The Lago di Carezza package now records enough privacy-preserving metadata to
describe its local ownership and freshness truthfully:

- installation still requires a currently authenticated Firebase account;
- the metadata stores a device-scoped opaque owner marker, never the Firebase
  UID, email address, display name, dog profile, authentication token, or
  location history;
- the marker combines a random per-device salt with the Firebase UID before
  SHA-256 hashing, so it cannot correlate the same account across devices;
- installed metadata records package version, installation time, size,
  verification state, cache name, and opaque owner marker;
- the trail page distinguishes the current account, another account on the
  device, a retained signed-out owner, and legacy packages without ownership
  metadata;
- the ready state displays package size and installation date;
- `listInstalledPackages(user)` exposes version, size, date, verification,
  ownership, and update availability without returning account identity;
- opening, GPS use, and removal remain available without a valid session.

Existing packages without an owner marker remain usable and are labelled
`download owner not recorded`. Their next authenticated update writes the new
metadata instead of silently inventing historical ownership.

## Interrupted-download recovery

The installer writes to a temporary cache whose name ends in `-installing`.
That cache is never considered a ready offline package:

- a normal fetch, verification, or storage failure removes the temporary cache,
  reports a failed state, and offers **Retry download** or **Retry update**;
- a hard browser or device interruption can leave the temporary cache behind;
  the next page load detects it, reports an incomplete state, and offers
  **Restart download** or **Restart update**;
- restarting removes the abandoned temporary cache and verifies every required
  resource again from the beginning;
- a failed or interrupted update never replaces the previous verified package;
- a partial first download is explicitly unavailable offline.

The beta deliberately restarts rather than attempting byte-range resumption.
The current package is small, and full restart plus SHA-256 verification gives
a simpler, more reliable integrity boundary.

## Storage boundary

Package resources remain in versioned Cache Storage. The first beta slice keeps
small package metadata in local storage because only one production package is
available. The manifest remains authoritative for resource integrity.

The device owner salt is local-only. Removing a package deletes its package
metadata and caches but deliberately retains the salt so future packages for
the same account remain recognisable on that device without storing identity.

## Verification

- `offline-lifecycle.test.js` verifies stable same-account markers, different
  account separation, absence of plaintext identity, ownership states, and
  identity-free labels. It also verifies abandoned-install detection and
  distinct restart and retry states.
- The normal application suite passes 153 tests.
- The static link checker passes all 171 HTML pages.

## Remaining before OFF-03 is complete

1. Move the package registry and lifecycle metadata to IndexedDB before
   enabling multiple downloadable trails.
2. Add a package-management surface that lists every installed trail.
3. Add storage-quota checks and actionable insufficient-space recovery.
4. Connect logout and account deletion to the documented retain/remove
   decision, including shared-device cleanup.
5. Repeat physical-device validation on supported iOS Safari and Android
   Chrome; Android remains untested because no device is currently available.
