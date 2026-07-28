# SCORE-02 — Scoring consumer migration

**Status:** Complete

**Decision date:** 2026-07-28

## Outcome

Every active recommendation surface now delegates to canonical scoring version
`1.1.0`. Calculation rules live only in
`scoring/recommendation-v1.js`.

`scoring/recommendation-adapters-v1.js` is the transition boundary for existing
browser data. It converts saved or guest profiles, legacy trail objects,
evidence states, and the “Adjust for today” values into canonical inputs.
`scoring.js` keeps the established browser function names without owning any
score arithmetic.

## Consumer map

| Surface | Canonical behaviour |
|---|---|
| Homepage | Ranks trails from complete canonical results and uses structured reasons |
| Saved trails | Calculates and explains each saved trail from the same result |
| Trail detail | Publishes score, category, confidence, and version in the rendered DOM |
| Dog wizard and search | Use the percentage-only facade backed by the canonical engine |
| Generated trail pages | Record the active version and hand personalized scoring to the interactive page |
| Offline package | Records `scoringVersion` in the verified manifest |

The retired `my-trails.js` screen had a separate scoring function. Its HTML
route already redirected to the personalized homepage, so the unused
implementation and its obsolete unit test were removed.

## Compatibility and finite adjustments

The existing “Adjust for today” values are treated as session-only effective
limits, not new dog facts. The canonical engine clamps them to terrain ranks
0–2, distance 2–18 km, and ascent 100–1,200 m. This removes the old unlimited
high-fitness distance while preserving the current UI.

Current conditions remain a separate optional input. If a surface does not
supply a conditions snapshot, the canonical output explicitly reports that
conditions were not included.

## Verification

`scoring-consumers.test.js` protects:

1. browser facade delegation and identical repeated results;
2. required script order on every active scoring page;
3. absence of the retired duplicate implementation;
4. scoring-version propagation to generated pages and the offline manifest.

The fixture suite also proves bounded session limits and retains all SCORE-01
reviewed decisions.
