# OFF-01 — Physical-device test results

## Lago di Carezza beta.2

### iPhone 13 Pro

- **Test date:** 2026-07-27
- **Device:** iPhone 13 Pro
- **Operating system:** iOS 26.5
- **Browser:** Safari
- **Package:** `lago-carezza` version `2026.07.27-beta.2`
- **Package size:** 35 KB
- **Tester:** Product owner
- **Overall result:** Pass

| Check | Result |
|---|---|
| Existing beta.1 package offered the beta.2 update | Pass |
| Package reached `Ready offline` after verification | Pass |
| Corrected OSM-derived offline map displayed | Pass |
| Offline route was consistent with the online route | Pass |
| Map key, north arrow, scale and OSM attribution displayed | Pass |
| GPS produced the expected result while online | Pass |
| Package opened in airplane mode with Wi-Fi disabled | Pass |
| Offline refresh succeeded | Pass |
| Package reopened after closing Safari | Pass |
| GPS produced the expected result while offline | Pass |
| Downloaded package remained usable without an authenticated session | Pass |

### Notes

The initial beta.1 schematic map was rejected as insufficiently detailed.
Beta.2 replaced it with a locally rendered map generated from a bounded
OpenStreetMap API extract. The replacement passed the same-device update and
offline usability checks.

This result closes the current-iPhone test case only. It does not close OFF-01
until the remaining supported-device matrix and the dated route-specific field
review are complete.

## Remaining device coverage

- Current Android phone using Chrome — **deferred: no test device currently
  available**
- The same Android phone with ORMA installed — **deferred: no test device
  currently available**
- Oldest iPhone/iOS combination selected for beta support
- Oldest or lower-powered Android/Chrome combination selected for beta support

Android testing may be completed later using a borrowed physical device, a
beta tester's device, or a device-testing service. Emulator results may be used
for early defect discovery but do not replace the physical-device GPS,
airplane-mode, storage, restart, and installed-PWA checks.

The missing Android result does not block continued implementation. It remains
a required gate before the public beta support claim includes Android.

Use `docs/testing/QA-04-android-offline-matrix.md` for the current borrowed-device
session. It names the shipped packages, separates Chrome from the installed
experience, and includes test-data cleanup for a phone that is not the owner's.

## Pending elevation-profile retest

The current packages (`lago-carezza` beta.21 and `alpe-siusi` beta.5) add a
checksum-verified stored route profile. Before closing OFF-01, repeat the
iPhone airplane-mode test on both routes and confirm that:

- the profile is visible immediately after the package opens;
- it still renders after Safari is closed and reopened offline;
- a reliable GPS fix moves the profile cursor to the nearest route position;
- the readout is labelled as approximate route elevation; and
- the flat offline basemap remains available even though no DEM is packaged.

These checks are not marked as passed until they have been performed on the
physical device. Android profile and cursor coverage remains part of the
deferred Android matrix above.

Record the complete current-package iPhone result in
`docs/testing/QA-04-iphone-offline-hike-session.md`; it combines these checks
with restoration, GPS accuracy, rejoin, and completion without treating an
older package result as current evidence.

## Remaining content gate

- Complete and date both route-specific reviews in
  `docs/testing/ROUTE-field-review-record.md`.
