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

Version `1.3.0` adds the evidence rule for reassurance. A positive statement
resting on a review category ORMA has not reviewed is no longer returned in
`positiveReasons`: on an unreviewed route, "no exposed section is recorded"
reads as a safety claim when it only means nobody looked. The matching
`unknowns` entry is the honest channel for it.

Cautions are deliberately not filtered this way. Suppressing a warning for want
of a review would hide a real hazard and leave its penalty unexplained. Across
the current catalogue that rule would have hidden an exposure caution on two
published trails and surface-hazard cautions on thirteen.

Measured route metrics — distance, ascent, descent, duration — and the five
behaviour attributes carry their own evidence and are never filtered. A
positioned advisory is shown only when its `status` is `reviewed` or `mapped`;
an unconfirmed community report waits for confirmation.

Scoring is untouched by this rule: it filters statements, not penalties, so
every reviewed fixture decision is unchanged.

Version `1.2.0` added behaviour-aware fit: recall, reactivity, prey drive,
comfort around livestock, traffic and crowds, heat tolerance, and preferred
walk length, scored against positioned route advisories. The product decisions
are documented in
`docs/architecture/SCORE-03-behaviour-aware-recommendation.md`.

Every behaviour rule needs both a recorded route attribute and a declared
behaviour. An unanswered question stays silent in both directions: it adds no
penalty and offers no reassurance. Behaviour deductions are capped at 45 points
so a behavioural mismatch never outweighs terrain, exposure or access, and the
eight reviewed `1.1.0` fixture decisions are unchanged.

The result gains `leashAdvisories` — positioned lead advisories ordered by
start distance — and `behaviourDeclaredCount`. `confidence` is unchanged: it
measures route evidence, not behavioural detail.

Version `1.1.0` added bounded, session-only effective limits for the existing
“Adjust for today” control. Terrain is bounded from 0 through 2, distance from
2 through 18 km, and ascent from 100 through 1,200 m.

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
- `docs/architecture/SCORE-03-behaviour-aware-recommendation.md` — behaviour rules
- `docs/architecture/PROFILE-02-behavioural-traits.md` — the behaviour fields
- `docs/architecture/DATA-04-route-segment-advisories.md` — positioned advisories
