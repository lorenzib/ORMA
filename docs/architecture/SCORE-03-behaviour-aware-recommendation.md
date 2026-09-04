# SCORE-03 — Behaviour-aware recommendation

**Status:** Complete in code (2026-09-04)

**Extends:** [`SCORE-01`](SCORE-01-canonical-recommendation-contract.md)

**Depends on:** [`PROFILE-02`](PROFILE-02-behavioural-traits.md),
[`DATA-04`](DATA-04-route-segment-advisories.md)

## Decision

Scoring version `1.2.0` layers behavioural fit on top of the physical
assessment. Version `1.3.0` adds the evidence rule below. The score itself is not the product. The explanation is. A
percentage decorates a card; a reason changes what an owner does at kilometre
two.

Every rule requires **both** a recorded route attribute and a declared
behaviour. Where either is missing the engine says so or says nothing, and
never fills the gap with an assumption.

## Rules

| Route attribute | Declared behaviour | Effect |
| --- | --- | --- |
| `livestockPresence` `likely` / `seasonal` | `livestockComfort`, `preyDrive`, `recall` | Caution naming each driver; seasonal load weighted 0.6 |
| `wildlifePresence` `high` / `moderate` | `preyDrive`, `recall` | Chase-risk caution |
| `sightlines` `open` | `recall` worse than reliable | Positive: the dog stays visible |
| `sightlines` `restricted` | `recall` worse than reliable | Caution: harder to keep in view |
| `roadProximity` `alongside` / `crossings` | `trafficComfort`, `recall` | Traffic caution |
| `crowding` `busy` / `moderate` | `crowdComfort`, `reactivity` | Social caution, taking the harder of the two |
| `metrics.durationMinutes` | `preferredDurationMin` | Caution beyond 1.25×, otherwise a positive |

`none`, `low` and `quiet` values produce a positive only when the owner
declared a behaviour that value speaks to. Reassurance nobody asked for is
noise, and it dilutes the reasons that matter.

## Reassurance requires evidence (1.3.0)

A positive statement resting on a review category that has not been reviewed is
not returned at all. "No exposed section is recorded" on a route nobody has
reviewed is a safety claim dressed as a fact; the `unknowns` entry that already
says ORMA has not checked it is the honest channel.

Cautions are deliberately exempt. Unreviewed evidence can fall short of
reassuring without falling short of worth mentioning, and suppressing a warning
would both hide a hazard and leave its penalty unexplained. Measured metrics and
the five behaviour attributes are also exempt: a distance is computed from the
geometry, and an attribute only leaves `unknown` when someone records it.

A positioned advisory is shown only when its `status` is `reviewed` or `mapped`.
A `reported` community sighting waits for confirmation under the MOD epic rather
than rendering as an established fact.

This filters statements, not penalties, so no reviewed fixture decision moves.

## The cap

Behaviour deductions are capped at 45 points in total.

Behaviour is a fit signal, not a prohibition. The cap lets a behavioural
mismatch move a route out of `strong-option` — and, on a fully hostile route,
below the 60-point `possible-with-cautions` threshold — while keeping it above
the floor reserved for routes that ban dogs outright. Terrain, exposure and
access remain the dominant terms.

## Segments explain, attributes score

A `leash-required` or `leash-recommended` segment produces a positioned
caution and an entry in the new `leashAdvisories` output, ordered by start
distance so navigation can consume it directly. It carries no penalty of its
own: the aggregate attribute has already charged the score for the same fact.

Only `avoid` is scored at the segment level, because it describes a hazard no
aggregate attribute represents.

Each segment's reason `code` includes its kilometre range. The canonical
result de-duplicates by `code`, so two grazing stretches on one route would
otherwise collapse into one. `messageKey` stays stable for translation.

## Output additions

`SCORE-01`'s contract is extended, not changed:

- `leashAdvisories`: ordered positioned advisories;
- `behaviourDeclaredCount`: how many behaviour answers informed this result.

`confidence` is untouched. It measures route evidence, not behavioural detail.

## Reviewed decisions

All eight `SCORE-01` fixtures score identically under `1.2.0`. Three cases were
added on one reviewed route, `pasture-and-wildlife-reviewed`:

| Case | Score |
| --- | --- |
| `settled-dog-same-pasture-route` | 100 |
| `chaser-on-pasture-route` | 70 |
| `undeclared-behaviour-same-pasture-route` | 100 |

The same trail, the same day, 100 or 70 depending only on the dog. That
difference is the feature.

The third case is the guard rail: an owner who has answered nothing is scored
on physical evidence alone, exactly as before this version.

## Live data

No production trail declares a behaviour attribute yet, so these rules are
inert on live data until `DATA-04` population happens. That is deliberate —
the alternative was inferring livestock from prose.

## Verification

`scoring-contract.test.js` covers positioned advisory text and `vars`,
two advisories of one kind surviving de-duplication, unplaceable segments
being dropped, silence in both directions for undeclared behaviour, the cap,
and the asymmetric heat-tolerance rule.
