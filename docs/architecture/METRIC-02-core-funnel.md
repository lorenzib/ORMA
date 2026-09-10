# METRIC-02 — Core journey funnel

Status: Complete in code, first-party delivery and protected reporting (2026-09-10)

## Journey milestones

The consent-aware funnel records the ordered product journey across discovery,
trail selection, decision explanation, offline-package readiness, offline
self-test, confirmed hike start, durable completion, and structured post-hike
outcome.

`metric-funnel.js` adds a session-level exactly-once guard around the METRIC-01
API. A guard is written only when METRIC-01 accepts the event, so no milestone
is marked before consent. Guards are tied to the current consent generation;
withdrawing and later granting consent starts a fresh anonymous journey.

## Operational categories

Raw browser errors are never recorded. Package failures are reduced to one of
`network`, `storage`, `verification`, `authentication`, `unsupported`, or
`unknown`. Durations, package sizes, GPS accuracy, and completion are likewise
reduced to controlled bands. Search text, precise position, GPS history, names,
email, and free-form outcome content remain outside the analytics payload.

## Exactly-once boundaries

- Discovery results are recorded once per search or browse journey.
- Selection, explanation, readiness, self-test, hike start, completion, and
  outcome are recorded once per trail and browser session.
- Hike start waits for the first usable GPS fix.
- Hike completion waits for the durable completion record to save.
- Outcome waits for the structured response to save and only records a newly
  created response.

## Verification

The automated journey test asserts the complete ordered sequence and repeats
every call to prove that duplicates are suppressed. Separate tests verify that
consent-off attempts do not create guards, withdrawal begins a fresh consent
generation, and raw failure messages are converted only to allowlisted
categories.

The homepage recommendation surface now records recommendation results, the
visible top-match explanation, primary-detail selection, map/list selection,
and recommendation adjustments. Existing trail detail, offline-package, hike,
and outcome milestones complete the path. Consented events are delivered to
the first-party Firestore receiver and aggregated by distinct browser in the
protected Product funnel backoffice desk. Raw browser identifiers are never
rendered there.
