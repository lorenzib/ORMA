# OFF-03 — Account-gated package storage and lifecycle

**Status:** In progress; owner-aware metadata slice complete

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
  identity-free labels.
- The normal application suite passes 150 tests.
- The static link checker passes all 171 HTML pages.

## Remaining before OFF-03 is complete

1. Move the package registry and lifecycle metadata to IndexedDB before
   enabling multiple downloadable trails.
2. Add resumable or explicitly restartable interrupted downloads without ever
   claiming readiness for a partial cache.
3. Add a package-management surface that lists every installed trail.
4. Add storage-quota checks and actionable insufficient-space recovery.
5. Connect logout and account deletion to the documented retain/remove
   decision, including shared-device cleanup.
6. Repeat physical-device validation on supported iOS Safari and Android
   Chrome; Android remains untested because no device is currently available.
