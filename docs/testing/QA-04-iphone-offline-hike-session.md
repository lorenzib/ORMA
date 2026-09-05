# QA-04 — Current iPhone offline and hike session

**Status:** Protocol ready; physical execution pending.

## Purpose

Exercise the current offline packages and the complete hike lifecycle in one
safe iPhone session. This record supplies evidence for both
`OFFLINE-IOS-CURRENT` and `HIKE-RESTORE-GPS`; it does not replace the separate
route field review or Android matrix.

## Test target

- Device: iPhone 13 Pro
- Browser: current Safari
- Display modes: browser tab and Add to Home Screen
- Carezza package: `2026.09.05-beta.19`
- Alpe di Siusi package: `2026.09.05-beta.6`

Record the installed iOS and Safari versions at test time. Use a familiar,
low-risk location and do not leave a safe marked path to manufacture an
off-route warning.

## Preparation

1. Sign in, update both packages, and confirm each says **Ready offline**.
2. Run the offline self-test for each package while still online.
3. Confirm sufficient battery and normal location permission. Carry the usual
   independent map and safety equipment; ORMA is not emergency navigation.
4. Record each displayed package version and size below. Stop if either version
   differs from this protocol—the evidence would apply to another build.

## Session A — Lago di Carezza, Safari tab

1. Open Carezza, start a hike, and wait for a usable GPS fix.
2. Confirm walked distance begins from zero rather than the recommended
   trailhead, while the elevation cursor separately indicates route position.
3. Confirm GPS accuracy, last-valid-fix time, and approximate route elevation
   are visible. Switch among Flat, Satellite, and Elevation map while online.
4. Pause and resume. Confirm elapsed time and walked distance are preserved.
5. Close Safari, reopen Carezza, and resume the same hike exactly once.
6. Enable airplane mode and disable Wi-Fi. Open the downloaded Carezza map.
7. Confirm route, map context, trailhead, warnings, attribution, flat basemap,
   stored elevation profile, and GPS position remain available.
8. Refresh, then close and reopen Safari while offline. Confirm the package and
   active hike restore without starting a duplicate session.
9. In naturally poor reception only, confirm weak/stale wording suppresses a
   confident off-route warning. Restore normal reception; do not obstruct the
   device if doing so would create unsafe distraction.
10. From a safe nearby mapped path or controlled trailhead position, confirm
    **Find closest trail point** appears only for a usable nearby fix. Select it
    and confirm the blue line follows a visible mapped path, has an orange
    target, and can be cancelled. Do not continue if signs or closures disagree.
11. Finish once. Confirm one completion is retained and any offline outcome is
    visibly queued rather than claimed as published.

## Session B — Alpe di Siusi, Add to Home Screen

Repeat Session A using the installed experience and the Alpe di Siusi package.
The rejoin check must fail closed—draw no route—if the fix is not near a
connected packaged footpath. Confirm the loop does not force one walking
direction and walked distance remains independent of route direction.

## Evidence record

| Field | Carezza | Alpe di Siusi |
|---|---|---|
| Tested at (ISO date/time and timezone) |  |  |
| Tester |  |  |
| iOS / Safari version |  |  |
| Display mode | Safari tab | Add to Home Screen |
| Package version | `2026.09.05-beta.19` | `2026.09.05-beta.6` |
| Displayed package size |  |  |
| Ready offline + self-test | Pass / Fail | Pass / Fail |
| Airplane open, refresh, close/reopen | Pass / Fail | Pass / Fail |
| One hike restored with preserved progress | Pass / Fail | Pass / Fail |
| Walked distance starts at zero | Pass / Fail | Pass / Fail |
| GPS accuracy and last-valid-fix visible | Pass / Fail | Pass / Fail |
| Weak/stale state suppresses false alert | Pass / Fail | Pass / Fail |
| Flat offline map and elevation profile | Pass / Fail | Pass / Fail |
| Live route-elevation cursor | Pass / Fail | Pass / Fail |
| Rejoin control and mapped-path behavior | Pass / Fail / Not safely testable | Pass / Fail / Not safely testable |
| Loop does not force direction | Pass / Fail | Pass / Fail |
| One completion retained | Pass / Fail | Pass / Fail |
| Defect IDs / notes |  |  |

## Pass and stop rules

`OFFLINE-IOS-CURRENT` passes when both routes pass package installation,
self-test, airplane open, refresh, and close/reopen in their assigned display
modes. `HIKE-RESTORE-GPS` passes only when both routes also pass restoration,
accuracy-aware status, distance, elevation, safe rejoin behavior, and completion.
`Not safely testable` keeps the rejoin part pending; it is not a pass.

Stop for an incorrect route, false **Ready offline** state, lost or duplicated
hike, invented progress, confident warning from weak GPS, straight-line rejoin
instruction, unsafe mapped guidance, or lost completion. Record a release defect
and repeat the affected session from preparation after it is fixed.
