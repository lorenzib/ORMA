# QA-04 — Android offline acceptance matrix

**Status:** Protocol ready; borrowed physical-device execution pending.

## Purpose

Give a trusted tester a self-contained Android procedure without sharing an
owner account or requiring knowledge of the ORMA implementation. A desktop
emulator or remote browser preview may find layout defects, but cannot pass this
gate because storage, installation, restart, permissions, GPS, and airplane-mode
behaviour must be observed on a physical phone.

## Required targets

Use a dedicated verified test account with no moderator role and no private
owner data.

| Target | Browser / display mode | Routes |
|---|---|---|
| Current Android phone | Current Chrome browser tab | Carezza and Alpe di Siusi |
| Same phone | Installed ORMA experience | Carezza and Alpe di Siusi |
| Older/lower-powered supported phone | Current supported Chrome browser tab | One-route smoke test, then both if a defect appears |

- Carezza package: `2026.08.10-beta.16`
- Alpe di Siusi package: `2026.08.10-beta.3`

Record manufacturer, model, Android version, Chrome version, free storage, and
display mode. Do not record passwords, a precise home location, or continuous
GPS history. Remove the test account and packages after the session if the phone
is borrowed.

## Per-route procedure

Repeat in both Chrome and the installed experience.

1. Open the trail while signed out and select Download. Confirm login is
   required and the intended trail is retained.
2. Sign in with the test account, install/update the package, and wait for
   **Ready offline**. Record the displayed version and size.
3. Run the self-test. Interrupt one non-final attempt by disabling connectivity;
   confirm it never claims **Ready offline**, then reconnect and recover.
4. Start a hike, accept location permission, and wait for a usable fix. Confirm
   walked distance starts at zero, GPS accuracy and last-valid-fix are visible,
   and the elevation profile does not clip map controls.
5. Pause, resume, close the browser/app, and restore the same hike exactly once.
6. Enable airplane mode and disable Wi-Fi. Open the package, refresh it, then
   close and reopen it. Confirm the route, context, warnings, attribution, GPS,
   flat basemap, and stored elevation profile remain available.
7. Confirm weak or stale GPS does not produce a confident off-route alert. Do
   not leave a safe marked path to test this.
8. If safely near a packaged connected path, select **Find closest trail point**.
   Confirm the blue route follows mapped paths and can be cancelled. Otherwise
   record `Not safely testable`; do not invent an off-route situation.
9. Finish once and confirm one completion is retained. If offline, confirm an
   optional outcome is queued rather than claimed as published.
10. Remove the package and confirm its downloaded state disappears without
    deleting the test account or the other route.

## Evidence record

Copy one column for each device/display-mode combination.

| Field | Result |
|---|---|
| Tested at (ISO date/time and timezone) |  |
| Tester |  |
| Manufacturer / model |  |
| Android / Chrome version |  |
| Display mode | Chrome / Installed |
| Free storage before test |  |
| Route and package version |  |
| Guest login gate retained trail | Pass / Fail |
| Interrupted download failed safely and recovered | Pass / Fail |
| Ready offline and self-test | Pass / Fail |
| GPS facts and walked distance | Pass / Fail |
| Pause/resume and one restored hike | Pass / Fail |
| Airplane open, refresh, close/reopen | Pass / Fail |
| Flat map and elevation profile fit | Pass / Fail |
| Weak/stale GPS suppressed confident alert | Pass / Fail |
| Rejoin followed mapped path or failed closed | Pass / Fail / Not safely testable |
| One completion retained | Pass / Fail |
| Package removal preserved account and other route | Pass / Fail |
| Test data removed from borrowed phone | Pass / Fail |
| Defect IDs / notes |  |

## Pass and stop rules

`OFFLINE-ANDROID-CURRENT` passes only after both routes pass on the current phone
in Chrome and installed modes. The older-phone smoke result defines the support
floor but does not substitute for the current-device matrix. `Not safely
testable` keeps rejoin validation pending rather than failing the offline gate.

Stop for a false ready state, missing route offline, lost or duplicated hike,
invented progress, confident weak-GPS warning, straight-line or unsafe rejoin
guidance, completion loss, or removal of another route/account. File a release
defect and repeat the affected route/mode after it is fixed.
