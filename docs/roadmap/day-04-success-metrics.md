# Day 4 — Success metrics

Status: complete

This document defines the measurement model. Analytics implementation is a
later task.

## North-star metric

> Appropriate offline hikes completed with ORMA.

A hike counts toward the numerator only when:

- the route package was ready offline;
- the user started and completed the hike;
- the user submitted a post-hike suitability response;
- the user confirmed that the trail was appropriate for their dog.

```text
completed hikes rated appropriate
÷
completed hikes with a suitability response
```

## Event families

### 1. `discovery_search`

States:

- `started`
- `results_viewed`
- `no_results`
- `filters_changed`

Properties may include region, result count, dog-profile presence, and active
filter count. Raw search text should not be recorded.

### 2. `dog_profile`

States:

- `started`
- `completed`
- `updated`
- `abandoned`

Properties may include completeness and whether relevant factors are known.
Names, photos, exact dates, and free text must not enter analytics.

### 3. `trail_decision`

States:

- `opened`
- `explanation_viewed`
- `unknowns_viewed`
- `compared`
- `selected`

Properties may include trail ID, match category, verification status, warning
count, unknown count, and profile presence.

### 4. `trail_saved`

States:

- `attempted`
- `completed`
- `failed`
- `removed`

Properties may include trail ID, authentication state, failure category, and
whether saving caused an authentication handoff.

### 5. `offline_package`

States:

- `started`
- `ready`
- `failed`
- `airplane_test_passed`
- `update_available`
- `updated`
- `removed`

Properties may include trail ID, package-size band, duration band, failure
category, storage band, package version, and browser family.

Only `ready` means all required resources were stored and verified.

### 6. `hike_session`

States:

- `started`
- `gps_acquired`
- `restored`
- `paused`
- `off_route_warning`
- `completed`
- `abandoned`

Properties may include trail ID, online/offline state, package presence, GPS
accuracy band, duration band, and distance-completion band. Exact coordinates
and continuous traces must not enter product analytics.

### 7. `community_contribution`

States:

- `started`
- `queued_offline`
- `submitted`
- `pending_moderation`
- `published`
- `failed`

Properties may include contribution type, trail ID, contributor category,
recorded-hike presence, and moderation state. Content and images must not enter
analytics.

### 8. `post_hike_outcome`

Values:

- `appropriate`
- `appropriate_with_unexpected_cautions`
- `not_appropriate`
- `did_not_complete`
- `prefer_not_to_answer`

Properties may include trail ID, pre-hike match category, primary mismatch
category, offline-package use, recorded-hike presence, and whether conditions
differed from downloaded information.

## Core funnel

```text
search results viewed
→ trail selected
→ recommendation explanation viewed
→ offline package ready
→ airplane-mode test passed
→ hike started
→ hike completed
→ suitability outcome submitted
```

Dog-profile completion and account creation support this funnel but are not the
final outcome.

## Product metrics

### Recommendation quality

```text
appropriate outcomes ÷ suitability responses
```

Initial beta target: at least 80%.

### Recommendation understanding

```text
participants who can explain the main recommendation reasons
÷
observed usability participants
```

Initial target: at least 80%.

### Offline preparation success

```text
packages reaching ready ÷ package downloads started
```

Initial target: at least 95%.

### Airplane-mode reliability

```text
successful airplane-mode openings ÷ airplane-mode tests attempted
```

Beta target: 100%.

### Active-hike restoration

```text
successful active-hike restorations ÷ restoration attempts
```

Beta target: 100% in supported browsers.

### Journey completion

```text
hikes completed ÷ hikes started
```

This is diagnostic. A responsible decision to stop a hike is not automatically
a negative outcome.

### Contribution rate

```text
post-hike outcomes submitted ÷ hikes completed
```

Initial target: at least 50%.

## Safety guardrails

These override growth or conversion targets:

- misleading safety claims;
- incorrect route geometry;
- false "ready offline" confirmations;
- offline package failures;
- unrecoverable active hikes;
- off-route warnings generated from unreliable GPS;
- stale restrictions shown without freshness warnings;
- unauthorized community publication.

Any confirmed critical safety or offline-reliability issue is a launch blocker.

## Privacy boundaries

Product analytics must not collect:

- dog or owner names;
- email addresses;
- photos, reviews, or captions;
- exact home or search locations;
- exact GPS coordinates;
- continuous movement history;
- medical free text;
- authentication tokens.

Offline events may be queued locally and uploaded later using a pseudonymous
identifier, coarse timestamps, coarse region, trail ID, appropriate consent,
and an explicit retention policy.

Operational data required to restore a hike must remain separate from product
analytics.

