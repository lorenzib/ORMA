# OFF-08 — The offline map says what the trail page says

**Status:** Decided 2026-10-24 by the product owner. Replaces the
`field-review-required` label OFF-07 put on every package.

## Decision

An offline map carries the same verification status as its trail page.

- A **Verified** trail's map is `source-verified`. It is drawn from the line
  that was verified against official sources, so it shows **Verified by ORMA
  against official sources**, the same claim as the badge on the trail page.
- A trail that is **not** Verified keeps its map `not-verified` and says so:
  **Not yet verified by ORMA** and "ORMA hasn't verified this route yet. Follow
  local signs." Today that is only the Alpe di Siusi pilot; every other
  package exists because its trail is Verified (OFF-07).

## Why

OFF-07 labelled every package `field-review-required`, and the offline page
turned that into "This package has not yet had a dated field review" and
"Beta trail information". Next to a green **Verified by ORMA** badge, a walker
read two contradicting claims about the same line and could not tell which to
believe. The offline map is not a second, weaker copy of the route: it is the
verified route.

## What stays

- Every map keeps ordinary safety advice: water, "Follow local signs, lead
  rules and temporary closures." That is advice for any walk, not doubt about
  ORMA's data.
- "Beta" leaves what walkers read ("Beta package 2" is now "Package 2"). The
  feature is still in testing, and that belongs on the launch checklist:
  `OFFLINE-IOS-CURRENT`, `OFFLINE-ANDROID-CURRENT` and `HIKE-RESTORE-GPS` are
  unchanged.
- `ROUTE-FIELD-REVIEW` stays on the checklist as a quality check for the two
  pilots on the ground. It is no longer a label shown to walkers.

## Where it shows

| Place | Verified trail | Not Verified |
| --- | --- | --- |
| Trail page, before download | "Offline map not downloaded. Same verified route, saved to your phone." | "Offline map not downloaded." |
| Offline map page, under the title | Verified by ORMA against official sources | Not yet verified by ORMA |
| Offline map page, package status | Verified route, same as the trail page. | ORMA hasn't verified this route yet. Follow local signs. |
| Downloaded trails list | Verified by ORMA | Not yet verified by ORMA |

`offline-beta-scope.test.js` checks that every package's manifest, safety sheet
and route carry the status of its trail, and that a Verified trail's cautions
never mention a field review or "beta".

## Revisions

Every package's bytes changed, so all move to a new revision and anyone who
already downloaded one is offered the update. The pilots moved to Carezza
`2026.10.24-beta.23` (now `source-verified`) and Alpe di Siusi
`2026.10.24-beta.11` (`not-verified`).
