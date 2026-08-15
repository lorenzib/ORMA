# ORMA recommendations — implementation reference

The live website uses one versioned recommendation engine:

- `scoring/recommendation-v1.js` owns all calculation rules.
- `scoring/recommendation-adapters-v1.js` normalizes existing profile and trail
  records into that contract.
- `scoring.js` is a browser compatibility facade. `recommendTrail()` returns
  the complete structured result; `scoreTrail()` returns only its score.

The product decisions, inputs, limits, penalties, categories, confidence rules,
and reviewed examples are documented in
`docs/architecture/SCORE-01-canonical-recommendation-contract.md`.

## Current version

Version `1.1.0` adds bounded, session-only effective limits for the existing
“Adjust for today” control. It does not change the reviewed fixture decisions.
Terrain is bounded from 0 through 2, distance from 2 through 18 km, and ascent
from 100 through 1,200 m.

High fitness is finite: it means at most terrain rank 2, 18 km, and 1,200 m
ascent before life-stage, size, and health adjustments.

## Consumer rule

Views must call `recommendTrail(trail, profileOrEffectiveLimits, conditions)`
when they need a recommendation, explanation, category, confidence, evidence
tier, or model version. They may call `scoreTrail()` only where a bare number
is genuinely the only required value.

No page may reproduce penalties, thresholds, reason selection from raw trail
fields, or an alternative scoring function.

## Output

The canonical result contains:

- `scoringVersion`;
- `score`;
- `category`;
- `confidence`;
- `evidenceTier`;
- structured `positiveReasons`, `cautions`, `unknowns`, and `hardStops`;
- `effectiveDogLimits`.

Generated trail pages publish the current scoring version as a body data
attribute and send signed-in visitors to the interactive recommendation.
Offline package manifests record the scoring version explicitly.

## File map

- `scoring/recommendation-v1.js` — calculation and version
- `scoring/recommendation-adapters-v1.js` — legacy-to-canonical normalization
- `scoring/fixtures-v1.json` — reviewed product fixtures
- `scoring.js` — browser facade and profile presentation helpers
- `scoring-contract.test.js` — contract and fixture regression tests
- `scoring-consumers.test.js` — cross-surface migration checks
- `docs/architecture/SCORE-02-scoring-consumer-migration.md` — migration record
