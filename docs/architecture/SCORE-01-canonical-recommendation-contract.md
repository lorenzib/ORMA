# SCORE-01 — Canonical recommendation contract

**Status:** Complete

**Decision date:** 2026-07-28

## Outcome

DoloPaws now has one versioned recommendation calculation that accepts
separate dog facts, trail facts, current conditions, and evidence states. It
returns:

- a score from 5 through 100;
- one recommendation category;
- confidence and trail evidence tier;
- positive reasons;
- cautions;
- unknown factors;
- hard stops;
- the effective dog limits used;
- scoring version `1.1.0`.

The implementation is `scoring/recommendation-v1.js`. The reviewed product
decisions are stored in `scoring/fixtures-v1.json` and protected by
`scoring-contract.test.js`.

SCORE-02 migrated every website surface from the legacy percentage-only
function to this contract.

## What the result means

The trail's evidence classification and the dog-specific recommendation remain
different concepts.

- Trail evidence describes what DoloPaws knows and how it knows it.
- Recommendation describes the fit between one normalized dog profile, one
  trail record, and an optional conditions snapshot.
- Community reports never change the canonical result silently.
- A score is decision support, not veterinary advice or a guarantee of safety.

## Input contract

### Dog facts

Only structured, owner-provided facts are scored:

| Input | Values |
|---|---|
| `ageYears` | non-negative number or `null` |
| `weightKg` | positive number or `null` |
| `fitness` | `low`, `moderate`, `high`, or unknown |
| `conditions` | structured values such as `joints`, `back`, `recovering`, `heat`, `cardiac`, `overweight`, `vision` |
| `traits` | documented physical traits: `heatSensitive`, `shortLegged`, `giant`, `backRisk` |

Names, photos, free-text health notes, breed popularity, and assumed
temperament never affect the score. A breed adapter may derive only the
documented physical traits. The normalized traits must be visible as inputs;
the calculation does not infer them from a name.

Missing age, weight, or fitness is reported as unknown. Moderate fitness is
used as a neutral computational default when fitness is absent, but confidence
falls and the default is disclosed.

### Trail facts

Version 1 consumes canonical DATA-01 fields:

- distance, ascent, and descent;
- terrain rank;
- shade and baseline heat risk;
- exposure and surface hazards;
- dog-access status;
- reviewed water points;
- evidence tier and category-level verification states.

`null`, `unknown`, and unreviewed evidence are not converted into favourable
facts.

### Current conditions

Current conditions are a separate, timestampable input. Version 1 consumes a
known, unknown, or omitted heat-risk state.

A route's baseline heat classification never changes merely because today's
snapshot is cool. Conversely, current high heat adds a separate penalty and
caution. Conditions data must carry its observation time in the production
adapter and must not be described as live after it becomes stale.

Weather and temporary trail state are not silently inferred when conditions
are omitted. The output says they were not included.

## Effective dog limits

Fitness supplies finite planning limits:

| Fitness | Terrain rank | Distance | Ascent |
|---|---:|---:|---:|
| Low | 0 | 5 km | 250 m |
| Moderate | 1 | 10 km | 600 m |
| High | 2 | 18 km | 1,200 m |

High fitness is deliberately finite. It no longer means unlimited distance.

Adjustments are multiplicative where several facts apply:

| Dog fact | Adjustment |
|---|---|
| Puppy under 1 year | terrain −1; distance ×0.5; ascent ×0.5 |
| Senior 8–10 years | terrain −1; distance ×0.75; ascent ×0.7 |
| Very senior 11+ | terrain −1; distance ×0.5; ascent ×0.6 |
| Orthopedic risk | terrain −1; distance ×0.75; ascent ×0.6 |
| Cardiac condition | distance ×0.6; ascent ×0.6 |
| Overweight | distance ×0.75; ascent ×0.75 |
| Under 5 kg | distance ×0.8 |
| Short-legged or 45+ kg | terrain capped at rank 1 |

The minimum computational distance is 2 km and minimum ascent is 100 m. Those
floors prevent nonsensical arithmetic; they are not claims that every dog can
safely complete that amount.

## Score rules

The calculation starts at 100 and never returns less than 5.

| Factor | Effect |
|---|---|
| Terrain above effective tolerance | −30 per rank |
| Distance above effective range | −5 per kilometre, maximum −35 |
| Ascent above effective range | −4 per additional 100 m, maximum −20 |
| Descent above 400 m for fragile or giant dogs | −4 per additional 100 m, maximum −20 |
| Exposure | −30; another −10 for fragile or vision-impaired dogs |
| Baseline high heat | −25 heat-sensitive; −12 otherwise |
| Baseline moderate heat | −10 heat-sensitive; −4 otherwise |
| Shade below 20% | −10 |
| Shade from 20% through 39% | −5 |
| Surface hazards | −8 each, maximum −20; ×1.5 and maximum −30 for fragile dogs |
| Current high heat | −25 heat-sensitive; −10 otherwise |
| Current moderate heat | −10 heat-sensitive; −4 otherwise |
| Seasonal dog restrictions | score capped at 84 |
| Critical unknown evidence | score capped at 80 |

Critical evidence is route, exposure, surface hazards, and dog access.

### Hard stops

A reviewed `dogAccess.status: prohibited` is a hard stop. It forces
`not-recommended` and caps the score at 5 regardless of distance, terrain,
weather, or dog fitness.

Future hard stops require a scoring-version change and reviewed fixtures. They
must not be introduced through presentation code.

## Recommendation categories

| Category | Rule |
|---|---|
| `strong-option` | score 85–100, no hard stop, and no critical evidence unknown |
| `possible-with-cautions` | score 60–84, or an otherwise strong score with critical evidence unknown |
| `not-recommended` | score 5–59 or any hard stop |

A strong option may still have ordinary cautions, such as a leash requirement
or a known surface issue. The interface must display those cautions rather
than treating the category as “safe.”

## Confidence

Confidence measures input completeness, not suitability.

The calculation counts:

- seven verified trail categories; and
- known fitness, age, and weight.

| Confidence | Completeness points |
|---|---:|
| High | 9–10 |
| Medium | 5–8 |
| Low | 0–4 |

Unknown or unreviewed safety data can only leave confidence unchanged or lower
it. It can never create a positive reason, raise confidence, or produce a
strong option when a critical category is unknown.

Confidence does not replace the evidence tier. Both are returned.

## Explanation rules

Every explanation is a structured `{code, message}` record so presentation
surfaces can translate and order it consistently.

- Positive reasons require a known favourable input.
- Cautions identify known mismatches, restrictions, or adverse conditions.
- Unknowns identify missing dog facts, missing trail facts, omitted
  conditions, and every unverified evidence category.
- Hard stops are returned separately and must be displayed before percentage
  or positive reasons.
- Codes are stable within scoring version 1; wording may receive
  non-substantive accessibility or translation improvements.

The interface should present the result in this order:

1. category, score, confidence, version, and evidence tier;
2. hard stop, if any;
3. why it matches;
4. important cautions;
5. unknown factors;
6. source and freshness information.

## Versioning

`scoringVersion` uses semantic versioning.

- Patch: wording or implementation correction that preserves every fixture
  result.
- Minor: backward-compatible inputs or output metadata that preserve existing
  decisions.
- Major: threshold, penalty, category, hard-stop, derived-limit, or meaning
  changes that may alter a result.

Offline packages store the scoring version and the calculated output. A newer
website may explain an old downloaded recommendation, but must not silently
recalculate it with a different version while offline.

## Reviewed fixtures

The fixture decisions cover:

1. a puppy on a short easy trail;
2. a senior dog with joint risk on a demanding trail;
3. a heat-sensitive dog on a hot day;
4. a sub-5 kg dog on a long route;
5. a 45+ kg dog facing sustained descent;
6. a fit adult on a reviewed challenging route;
7. an incomplete profile paired with unknown imported safety data;
8. a route where dogs are prohibited.

Each fixture records why the expected result is a product decision, not merely
an implementation snapshot.

## SCORE-01 acceptance

- Dog facts, trail facts, conditions, and unknowns are separate inputs.
- The output contains score, category, reasons, cautions, unknowns, confidence,
  evidence tier, effective limits, hard stops, and version.
- All required dog-profile fixture types are represented.
- Fixture results are executable and reviewed in repository history.
- Unknown safety data cannot create high confidence or a strong option.
- Prohibited dog access overrides otherwise favourable inputs.

## SCORE-02 implementation

SCORE-02 is complete. The browser adapter normalizes saved and guest profiles,
legacy trail objects, and bounded session adjustments. Homepage, saved trails,
trail detail, generated pages, analytics-facing DOM metadata, and offline
packages now expose the same versioned contract. The obsolete `my-trails`
implementation was removed after that route became a redirect to the canonical
saved-trails experience.

Version `1.1.0` is a backward-compatible minor release adding optional finite
`effectiveLimits` for session controls. Existing reviewed fixture decisions are
unchanged.
