# PROFILE-02 — Behavioural dog traits

**Status:** Complete in code (2026-09-04)

**Extends:** [`PROFILE-01`](PROFILE-01-multi-dog-profiles.md)

## Decision

A dog profile records how a dog behaves, not only what it can physically
manage. `PROFILE-01` captured breed, age band, weight band, fitness and health
conditions. Those answer *how far and how steep*. They cannot answer *where is
this safe*, which is the question an owner is actually asking.

Seven ordered scales and one preference are added:

| Field | Scale, easiest to hardest |
| --- | --- |
| `recall` | `reliable`, `variable`, `unreliable` |
| `reactivity` | `none`, `mild`, `strong` |
| `preyDrive` | `low`, `moderate`, `high` |
| `livestockComfort` | `confident`, `cautious`, `reactive` |
| `trafficComfort` | `confident`, `cautious`, `reactive` |
| `crowdComfort` | `confident`, `cautious`, `reactive` |
| `heatTolerance` | `robust`, `average`, `low` |
| `preferredDurationMin` | integer minutes, 1 through 1440 |

Each scale is ordered so the array index *is* the difficulty rank a scoring
rule multiplies by. A scale may therefore gain values only at its end.

## Unanswered is not easy

Every field is optional, and an unanswered field is stored as an absent key
rather than a default. Absence is load-bearing: `SCORE-03` stays silent about a
trait the owner has not declared, in both directions. It adds no penalty, and
it also offers no reassurance.

Writing `recall: 'reliable'` as a default would be the worst available
outcome. It would tell an owner that an unfenced route near a road suits a dog
whose recall was never assessed.

## Heat tolerance is asymmetric

A declared `heatTolerance: 'low'` adds heat sensitivity. A declared `robust`
deliberately removes nothing, and never clears sensitivity derived from a
breed trait or from a heat, cardiac or weight condition.

Heat injury in dogs develops quickly and is often irreversible. An owner's
confidence is a reason to collect the answer, not a reason to lower a safety
guard that physical evidence has already raised.

## Storage contract

Behaviour travels as one nested `behaviour` map on each dog in the private
`users/{uid}` document, alongside the `PROFILE-01` fields.

A single nested key keeps the dog record at 23 keys, inside the 25-key bound
`validDog` enforces in `firestore.rules`. That rule is deliberately cheap
because it runs up to six times per user-document write, so it bounds the map
rather than validating each scale. The client is the enforcing boundary:
`sanitizedDogProfile()` in `firebase-init.js` copies only recognised answers,
and `recommendation-adapters-v1.js` independently re-filters before scoring.
An unrecognised value is dropped, never coerced, so a stale or hand-edited
client cannot silently move a dog to the easy end of a scale.

## Capture

`dog-wizard.js` gains a `Behaviour` step between `Health` and `Review`. It
uses selects rather than option buttons because eight questions as button
groups produce a step no one finishes. Every control offers "Not sure yet…"
as its first option, and the step states that a blank answer means ORMA stays
quiet about that trait rather than guessing.

Tests must not count wizard steps. `advanceToSaveStep()` walks forward until
the footer offers the save action, so adding a step cannot silently disable a
save assertion.

## Verification

- `dog-wizard-save.test.js` — behaviour answers reach the saved profile, and
  an unanswered question is omitted rather than defaulted.
- `scoring-consumers.test.js` — the adapter forwards only recognised answers
  and drops an out-of-range preferred duration.
- `scoring-contract.test.js` — a declared robust heat tolerance never clears a
  medical heat risk.

## Not included

Behaviour does not enter recommendation `confidence`. Confidence measures
evidence quality about the route, and folding behaviour completeness into it
would silently restate every reviewed fixture decision in `SCORE-01`.
