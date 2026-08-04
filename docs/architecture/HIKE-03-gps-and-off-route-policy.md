# HIKE-03 — GPS and off-route safety policy

**Status:** implemented in code; iPhone and Android physical validation remain
open.

## Outcome

DoloPaws no longer treats every GPS coordinate as equally trustworthy. One
versioned policy controls progress, map messaging, and off-route warnings on
both the interactive trail map and the downloaded offline map.

Every displayed fix includes:

- reported GPS accuracy;
- measured distance from the stored route; and
- time of the last valid fix.

Weak or stale coordinates keep the hiker visible but pause confident
off-route claims and do not advance durable progress.

## Versioned thresholds

Policy version: `1.1.0`

### Accuracy

| Band | Reported accuracy | Progress | Off-route warning |
|---|---:|---:|---:|
| Good | 0–25 m | yes | eligible |
| Fair | 26–50 m | yes | eligible |
| Weak | 51–100 m | yes | paused |
| Unusable | over 100 m | no | paused |

### Fix age

| Band | Age | Progress | Off-route warning |
|---|---:|---:|---:|
| Current | 0–15 seconds | yes | eligible |
| Aging | over 15–45 seconds | yes | paused |
| Stale | over 45 seconds | no | paused |

## Accuracy-aware route distance

The policy uses a conservative lower bound with an extra cushion for GPS
receivers that report overly optimistic accuracy:

`nearest-segment distance − reported GPS accuracy − 20 metres`

A fix only contributes to the off-route streak when that lower bound is more
than 60 metres. At least three consecutive eligible fixes **and** 20 seconds of
continuous evidence are required before DoloPaws shows a strong off-route
warning. Any weak, stale, or contradictory fix resets that evidence window.

Distance is measured to the closest position along every route segment, not
only to stored route vertices. This prevents sparse route geometry from making
a hiker between two valid points appear off-route.

A confidently on-route fix clears the streak when:

`measured route distance + reported GPS accuracy < 40 metres`

Ambiguous fixes decay the streak. Weak, unusable, aging, or stale fixes reset
it and hide the strong warning. A “far from route” message likewise requires a
current good/fair fix whose conservative lower bound is over 2 kilometres.

## Interface behavior

- Reliable fixes may snap the marker to the route.
- Unreliable fixes show the raw position instead of implying route certainty.
- Progress and the elevation cursor use only usable fixes.
- The routine panel reports “On trail”, “Position near trail”, or “Checking
  route position”, plus accuracy and last-valid-fix time. Exact route distance
  is reserved for a confirmed warning or the far-from-route state so harmless
  GPS drift does not read like an alarm.
- Weak and stale states explicitly say off-route warnings are paused.
- Permission denied, unavailable, and timeout states keep their existing
  recovery instructions and pause the durable hike if a valid fix existed.

## Offline package

Lago di Carezza beta.12 includes `/hike-gps-policy.js` as a mandatory,
checksum-protected resource. The downloaded map applies the same thresholds,
shows the same three GPS facts, and only displays its alert after three
eligible fixes.

No network access is used for this assessment.

## Automated evidence

`hike-gps-policy.test.js` covers:

- all accuracy and freshness bands;
- three-fix and 20-second confirmation;
- the extra uncertainty cushion;
- suppression of rapid false-positive fixes;
- weak accuracy;
- stale fixes;
- uncertainty overlapping the route;
- confident on-route recovery;
- progress eligibility;
- far-route suppression; and
- script ordering and online integration.

Offline package tests require the policy resource, visible route-warning
surface, and shared assessment function. Package tests verify every beta.12
byte count and SHA-256 hash.

## Safe physical validation

Do not leave a marked route to test an alert.

On the iPhone 13 Pro, update Carezza to beta.12 and confirm:

1. A normal GPS fix shows accuracy, route distance, and last-valid-fix time.
2. The same facts remain visible in airplane mode on the downloaded map.
3. Covering the phone briefly or moving into naturally poor reception changes
   the message to weak/stale without showing a confident off-route alert.
4. Permission denial and retry guidance still work.

Use automated coordinate simulation for off-route confirmation. Repeat the
physical-device matrix on supported Android Chrome when available.
