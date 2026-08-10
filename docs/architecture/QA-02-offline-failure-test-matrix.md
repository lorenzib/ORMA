# QA-02 — Offline failure test matrix

**Status:** Complete as an executable test contract; physical-device results remain open

**Decision date:** 2026-08-10

## Beta scope exercised by this matrix

The first controlled offline beta is limited to two packaged routes:

1. **Lago di Carezza Loop** (`lago-carezza`) — the established iPhone and
   airplane-mode reference package.
2. **Alpe di Siusi Meadow Loop** (`alpe-siusi`) — the in-region package and the
   second route-rejoin pilot.

No other trail may display an offline-download promise during this beta. A
published trail without a registered package remains available for online
planning and GPX export only.

## Required device coverage

| Device class | Browser / mode | Required before beta | Current evidence |
|---|---|---:|---|
| Current iPhone | Current Safari, browser tab | Yes | Carezza partial pass; repeat current package |
| Current iPhone | Added to Home Screen | Yes | Open |
| Current Android | Current Chrome, browser tab | Yes | Open — physical device required |
| Current Android | Installed PWA | Yes | Open — physical device required |
| Oldest supported iPhone | Safari | Yes | Support floor and result open |
| Older/lower-powered Android | Chrome | Yes | Support floor and result open |

An emulator may discover defects, but it cannot pass GPS, storage eviction,
airplane-mode, restart, or installed-PWA acceptance.

## Result vocabulary

- **Pass:** observed result and recovery match this contract.
- **Fail:** behavior or message differs, data is lost, or the interface claims
  more certainty than the device can support.
- **Blocked:** the scenario cannot be performed; record why and an owner.
- **Not run:** no evidence yet.

Every physical result records date, tester, device, OS, browser, display mode,
route, package version, package size, network state, and evidence link.

## A. Download, storage, and package integrity

| ID | Scenario | Expected user state/message | Required recovery | Gate |
|---|---|---|---|---|
| PKG-01 | Signed-in download succeeds | Downloading progresses to **Ready offline** only after checksums pass | Open map and run offline self-test | P0 |
| PKG-02 | Guest selects Download | Account requirement is explained and the selected trail is retained | Return to the same trail and resume download after login | P0 |
| PKG-03 | Connection stops during download | Package remains **Incomplete**, never ready | Retry or resume without deleting a previously valid version | P0 |
| PKG-04 | Browser reports insufficient storage | Download stops with a storage-specific explanation | Manage downloads or free device storage, then retry | P0 |
| PKG-05 | Manifest or mandatory resource is unavailable | Package is **Failed** or **Incomplete** | Retry; online planning remains available | P0 |
| PKG-06 | Mandatory cached resource is removed or corrupted | Offline self-test fails and names a repair action | Repair/update replaces the damaged package | P0 |
| PKG-07 | Newer manifest exists | Existing verified package remains usable; **Update available** appears | Update deliberately; failed update preserves old package | P1 |
| PKG-08 | Stored content is stale | Package remains technically usable and is labelled stale without claiming live conditions | Update when online | P1 |
| PKG-09 | Package belongs to another account on a shared device | Ownership is explained without exposing personal data | Remove it or sign into the owning account | P0 |
| PKG-10 | User removes a package | Package and its metadata disappear together | Download again while signed in | P1 |

## B. Airplane mode, GPS, and hike restoration

| ID | Scenario | Expected user state/message | Required recovery | Gate |
|---|---|---|---|---|
| NAV-01 | Open verified package after enabling airplane mode | Route, map context, trailhead, warnings and attribution render | None | P0 |
| NAV-02 | Refresh the offline trail page | The same package opens without a network request | Repair only if local verification fails | P0 |
| NAV-03 | Close and reopen browser/PWA offline | Download remains available | Reopen downloaded trails or the active hike | P0 |
| NAV-04 | Start, move, pause and resume offline | Time and walked distance continue from the first reliable fix | Pause/resume controls remain available | P0 |
| NAV-05 | Refresh or close during an active hike | Active session is restored exactly once | Resume or explicitly discard | P0 |
| GPS-01 | Location permission denied | No position certainty or off-route warning is shown | Explain how to enable location and provide retry | P0 |
| GPS-02 | Location request times out or is unavailable | Last-valid-fix state is honest; tracking does not invent progress | Retry and continue showing the stored route | P0 |
| GPS-03 | Accuracy is poor or fixes jump | Accuracy halo/state is visible; nuisance off-route warnings are suppressed | Wait for a better fix; no forced action | P0 |
| GPS-04 | Reliable fix is slightly beside the route | User remains **near trail** inside the accuracy-aware tolerance | No alert | P0 |
| GPS-05 | Reliable fixes remain off-route | Distance appears only after sustained evidence | Offer **Find closest trail point** | P0 |
| GPS-06 | Rejoin is requested on a packaged mapped footpath | Guidance follows the packaged accessible path, not a straight line | Cancel guidance or return to hike view | P0 |
| GPS-07 | No safe mapped rejoin path is available | No confident route is drawn; orientation-only wording is explicit | Follow marked paths or seek local help | P0 |
| ELEV-01 | Offline package lacks elevation-map data | Flat map and route remain usable; unavailable elevation is stated | Continue in flat-map mode | P1 |

## C. Completion, synchronization, and account cleanup

| ID | Scenario | Expected user state/message | Required recovery | Gate |
|---|---|---|---|---|
| END-01 | Finish while offline | Completion is stored before navigation | Reopen completion if the next screen fails | P0 |
| END-02 | Finish is tapped twice or page reloads | One completion record exists | Continue to outcome | P0 |
| END-03 | Submit post-hike outcome offline | Outcome is visibly queued, not published as a review | Retry automatically or manually online | P1 |
| END-04 | Connectivity returns | Pending outcome/event syncs once | Failed items remain visibly retryable | P1 |
| END-05 | Logout with downloaded data | Choice clearly distinguishes account logout from local removal | Keep or remove local packages deliberately | P0 |
| END-06 | Delete account with active/local data | Server deletion and device cleanup scopes are named separately | Confirm each destructive action independently | P0 |

## Execution order

Run the matrix in this order so failures stop unsafe downstream testing:

1. Automated integrity and lifecycle tests.
2. Current iPhone browser-tab run on Carezza.
3. Current iPhone installed run on Alpe di Siusi.
4. Current Android browser and installed runs on both routes.
5. Oldest-device smoke runs for download, restart, GPS and completion.
6. Controlled low-risk field runs (`QA-04`).

Do not deliberately leave a safe marked route to test rejoin behavior. Use a
safe side path, a controlled trailhead location, or deterministic GPS fixtures.

## Exit criteria

QA-02 is fully closed only when:

- every P0 row passes on the current iPhone and Android targets;
- download, offline reopen, GPS, restoration and completion pass on both routes;
- oldest-device smoke coverage passes;
- every accepted P1 exception has an owner and safe fallback; and
- failures and evidence are linked from `docs/testing/OFF-01-device-results.md`.

