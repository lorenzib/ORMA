# Beta launch checklist

**Status:** Draft, 2026-10-27. Readiness decision: `not-ready`
(`npm run check:beta-readiness`: 5 gates passed, 7 pending).

This checklist orders the remaining work for the **charter beta** described in
`day-07-beta-charter.md`. It adds no new gate. Every item points at the ledger
gate in `config/beta-readiness.json` and the protocol that records its
evidence. A green test suite never passes a physical or human gate (QA-05).

## The critical path

The software is ahead of the evidence. Every pending gate needs a person, a
phone or a trail, so the dates are set by trips and testers, not by code.

```text
1. Freeze the pilot packages
        ↓
2. Pre-trip dry run at home (iPhone + Android, airplane mode)
        ↓
3. Field trip: Carezza + Alpe di Siusi
   (field review + iPhone hike session + Android matrix on the same walks)
        ↓
4. Fix any defect found → re-test only what the fix touched
        ↓
5. Desk gates: GPX export, VoiceOver, one uncoached usability session
        ↓
6. Readiness review (QA-05) → decision: launch, reduce scope, or delay
        ↓
7. Invite the controlled beta cohort
```

Steps 2 and 5 can run in parallel with anything else. Step 3 is the long pole
and has a **seasonal deadline**: both pilots are alpine meadow walks, and a
review done in snow does not test the surface, water, shade or livestock
statements. If step 3 cannot happen before the first lasting snow, the
readiness review must either wait for spring or record the seasonal limits
explicitly.

## 1. Freeze the pilot packages (owner: ORMA)

The device and field results are only valid for the package versions they were
run on. The ledger names **Lago di Carezza `beta.23`** and **Alpe di Siusi
`beta.11`**. OFF-07 showed that a change to the shared offline reader bumps
both pilots, which makes any earlier result stale.

- [ ] Do not merge changes to `offline/` (reader, service worker, CSS), the
      pilot packages, or the hike-mode files until step 4 is done, unless the
      change fixes a beta defect.
- [ ] On the morning of each test day, confirm the live pilot versions still
      match the ledger. Record the version you actually tested in the evidence
      table, not the version from the protocol.
- [ ] The automated "Offline maps follow the Verified trails" PRs never rebuild
      the pilots (OPERATING_STANDARD). They may keep running.

## 2. Pre-trip dry run at home (owner: product owner, ~2 hours)

This catches defects before travel, when a fix is cheap. It is **not** evidence
for any gate.

- [ ] iPhone 13 Pro, current Safari: sign in, download both pilots, reach
      `Ready offline`, run the self-test, open each in airplane mode, close
      and reopen.
- [ ] Android phone, current Chrome: the same, in the browser tab and in the
      installed app.
- [ ] Start a hike, refresh, close the browser, reopen: progress is kept.
- [ ] Export the Carezza GPX while signed in (this can close the GPX gate on
      the spot; see step 5).
- [ ] Note the free storage on each phone and keep the battery above 80% for
      the trip.

## 3. Field trip: both pilots (owner: product owner, 1–2 days)

One trip can close **four P0 gates**. Walk each pilot once with both phones:
one person reviews the route, the other runs the device protocol, and nobody
looks at a screen where that would be unsafe.

| Gate | Protocol | Done when |
|---|---|---|
| `ROUTE-FIELD-REVIEW` (P0) | `docs/testing/ROUTE-field-review-record.md` | Both route tables are filled, dated, and say `Pass` overall. |
| `OFFLINE-IOS-CURRENT` (P0) | `docs/testing/QA-04-iphone-offline-hike-session.md` | Session A (Carezza, Safari tab) and Session B (Siusi, Home Screen) both pass. |
| `HIKE-RESTORE-GPS` (P0) | same iPhone protocol plus the Android matrix | Restore, GPS accuracy, weak-signal suppression, rejoin (or `Not safely testable`), completion and elevation cursor recorded on both platforms. |
| `OFFLINE-ANDROID-CURRENT` (P0) | `docs/testing/QA-04-android-offline-matrix.md` | Current phone in Chrome and installed, both routes; older phone one-route smoke test. |

Before leaving:

- [ ] Check the access, lift and road status for both trailheads on the day
      and record the source in the field-review table.
- [ ] Line up the Android phones: one current, one older or lower-powered. A
      borrowed phone must have the test data removed afterwards (part of the
      matrix).
- [ ] Bring the printed protocols or have them open on a third device.

`Not safely testable` keeps the rejoin row pending; it is not a pass. Any
`Fail` stops the gate and opens a defect (step 4).

## 4. Fix and re-test (owner: ORMA)

- [ ] Each defect gets an issue that names the gate, the device and the
      package version.
- [ ] A fix that changes the reader or a pilot package bumps its version. In
      that case, re-run the affected rows on the new version. Route-review
      rows about the ground (trailhead, junctions, surface, water) stay valid
      unless the route line changed.
- [ ] Update `config/beta-readiness.json`: status, evidence path, and the date
      each gate passed.

## 5. Desk gates (owner: product owner, can start now)

| Gate | Protocol | Effort |
|---|---|---|
| `GPX-AUTHENTICATED-EXPORT` (P1) | `docs/testing/OFF-06-gpx-acceptance.md` | 15 min: export Carezza while signed in, open it in an independent app (for example Gaia, OsmAnd or Komoot) and record the result. |
| `ACCESSIBILITY-VOICEOVER` (P1) | `docs/testing/A11Y-01-voiceover-acceptance.md` | 1–2 hours on the iPhone with VoiceOver on, through the whole core journey. |
| `QA-INTERNAL-USABILITY` (P1) | `docs/testing/QA-03-internal-usability-protocol.md` | One uncoached session with someone who has never seen ORMA, plus the 5–8 owner recommendation cohort. |

The charter's success evidence needs **at least 80% of observed users** to
explain the recommendation. That figure comes from the QA-03 cohort, so the
cohort needs at least five people.

A P1 gate may be waived only as the charter allows: the feature leaves beta
scope, the fallback is safe and documented, and the waiver is recorded at the
readiness review. P0 gates cannot be waived.

## 6. Readiness review (QA-05)

- [ ] `npm run check:beta-readiness -- --require-ready` exits 0.
- [ ] `npm run quality:gate` passes on `main`.
- [ ] Check each charter launch blocker against the evidence: no contradictory
      route geometry, no false `Ready offline`, no lost download or active hike,
      no confident off-route alert on weak GPS, no inaccessible core action,
      and no exact location in analytics.
- [x] The charter scope amendment
      (`day-07-charter-amendment-catalogue-scope.md`) is decided (2026-10-27,
      Option A), so the review judges the product we actually ship.
- [ ] If any physical device gate failed, non-pilot offline downloads were
      switched off until its fix passed (charter, Option A).
- [ ] Record the decision (`launch`, `reduce scope` or `delay`) and its date in
      the ledger.

## 7. Before inviting testers

- [ ] The invitation names the supported phones and the two pilot routes for
      the offline hike. Planning covers the published catalogue.
- [ ] Run the operational checks: Firestore free-tier headroom, OpenAI credit
      if research is on, and the hazard snapshot and offline-package
      workflows green.
- [ ] Define how testers report a defect and who triages it within 24 hours.

## Not on the critical path

These continue, but cannot displace the steps above:

- hand verification of new trails (the catalogue amendment sets its limits);
- backoffice agent research, which is paused (`paidResearchEnabled: false`);
- Italian localisation of trail pages (paused; a supporting feature);
- map and UI polish outside the beta journey.
