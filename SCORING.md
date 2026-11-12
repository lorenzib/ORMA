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

Version `1.10.0` gives dogs with a limit fairer steepness. A trail's terrain
rank is its steepest grade anywhere, so one short steep step marked a whole
walk steep: 263 of 368 Dolomites walks are rank 2. The score now reads the
trail's height profile and counts a pitch only when it holds over 300 m or
more; the stored rank stands when it is lower or there is no usable profile
(98 walks ease). And one limit (puppy, senior, joints or back, heart, overweight)
now softens steepness to tolerance 1 instead of ruling it out; low fitness, or
two limits together, still leave tolerance 0. Healthy dogs do not change. On the
Dolomites, green / orange / red moves for a 9-year-old from 6 / 186 / 176 to
36 / 230 / 102, a puppy from 5 / 178 / 185 to 53 / 200 / 115, a dog with sore
joints from 6 / 183 / 179 to 36 / 225 / 107, low fitness from 5 / 175 / 188 to
19 / 186 / 163. No reviewed fixture changes.

Version `1.9.0` stops steepness ruling out healthy dogs. A trail's terrain
rank is its steepest grade, and 250 of 355 Dolomites walks reach rank 2, so a
healthy dog of moderate fitness lost 30 points on most of them for steepness
alone, on top of the climb charged as ascent. A healthy adult dog of moderate or
high fitness now has terrain tolerance 2; low fitness, puppies, seniors, joint,
back, heart or weight conditions, short legs and 45+ kg keep the old
tolerances, at 10 a rank instead of 30. On the Dolomites, a healthy moderate dog
goes from 44 green / 135 orange / 190 red to 173 / 154 / 42; a 9-year-old from
3 / 29 / 337 to 6 / 191 / 172. One reviewed fixture changes category: the fit
48 kg dog on the long steep route is now good with care (66), not ruled out.

Version `1.8.0` made the score less harsh where it counted one fact twice
or charged notes as hazards. A route's baseline heat risk and its shade are one
danger, a dog overheating, so only the larger of the two is charged; both are
still listed. Recorded route cautions cost 4 each, to 10 (6 each, to 15, for a
fragile dog), down from 8 to 20: most are things to know, such as a lane shared
with bikes or a gondola to check, and the usual two or three held nearly every
Dolomites trail below a strong option. A fit adult dog was a strong option on
6 of 355 Dolomites trails; it is now one on 189. Every reviewed fixture keeps
its category; three scores rise by 4.

Version `1.3.0` added the evidence rule for reassurance. A positive statement
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
