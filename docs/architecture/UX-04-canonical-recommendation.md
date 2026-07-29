# UX-04 — Canonical recommendation decision block

Status: Complete in code (2026-07-29)

## One decision

`trail-recommendation.js` is the only trail-detail consumer that turns the
canonical `recommendTrail()` result into a decision summary. The hero sentence
is set from that same presentation, so it cannot claim that a trail is
generally suitable while the personalized result says otherwise.

The block exposes:

- the recommendation category and percentage;
- the active dog's name, or an explicit unpersonalized label;
- canonical positive reasons;
- hard stops and cautions;
- unknown evidence and current-condition gaps;
- confidence and scoring-contract version; and
- a link that opens the trail's source and review-status section.

`recommendation-decision.js` is a pure presentation adapter. It does not
calculate or adjust a score.

The unknown count remains visible, while its detailed list is collapsed by
default to avoid repeating every evidence gap on otherwise simple trail pages.

## Actions

The decision block keeps three intents separate:

- **Save trail** delegates to the account-backed favourite control.
- **Add to comparison** stores the trail in the versioned comparison state,
  then opens comparison when at least two trails are selected or returns to
  Browse to choose another.
- **Download offline map** delegates to the account-gated offline package
  control and is disabled when the trail has no package.

## Generated pages

Generated SEO trail pages carry the canonical scoring version but do not
calculate or publish a personalized conclusion. If a saved dog profile is
detected, their copy hands the visitor to the interactive trail page for the
versioned recommendation, cautions, and evidence.

## Verification

Automated tests ensure:

- every canonical section is present;
- dog and guest contexts are labelled;
- hard stops precede ordinary cautions;
- unknown overflow remains explicit;
- the hero consumes the same presentation as the decision block;
- source and action controls remain reachable; and
- generated pages do not invoke a competing recommendation calculation.
