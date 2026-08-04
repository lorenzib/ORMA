# Day 6 — Master beta backlog

Status: complete

## Goal

This backlog converts the Day 5 inventory into dependency-ordered work for the
first DoloPaws beta. It is a planning artifact, not a commitment to implement
every existing feature.

The beta is complete only when an account holder can:

```text
create one dog profile
→ find and compare trails in one supported region
→ understand one recommendation
→ save and download one trail
→ verify it offline
→ reach the start
→ track and restore the hike
→ finish
→ report whether the trail suited the dog
```

## Backlog conventions

### Priority

- **P0:** safety, security, feasibility, or architectural blocker.
- **P1:** required to complete the beta journey.
- **P2:** improves beta quality but is not on the critical path.
- **P3:** experimental or post-beta work.

### Size

- **XS:** less than half a focused day.
- **S:** approximately one focused day.
- **M:** two to three focused days.
- **L:** four to seven focused days.
- **XL:** must be split after a research or design task.

Estimates describe complexity, not calendar promises.

## Dependency map

```text
OFF-01 offline feasibility
├── OFF-02 package contract
│   ├── OFF-03 storage and lifecycle
│   ├── OFF-04 offline map corridor
│   └── OFF-05 package verification
│       ├── UX-06 pre-hike readiness
│       └── HIKE-01 durable session
│           ├── HIKE-02 restoration
│           ├── HIKE-03 GPS and off-route safety
│           └── HIKE-04 completion
│               └── OUT-01 post-hike outcome
│
DATA-01 canonical trail schema
├── DATA-02 validation
├── SCORE-01 scoring contract
│   ├── SCORE-02 migrate consumers
│   └── UX-04 recommendation explanation
├── TRUST-01 provenance contract
└── UX-03 trail comparison

AUTH-01 account-entitlement contract
├── AUTH-02 intent-preserving login
├── OFF-03 storage and lifecycle
└── SEC-01 Firestore rules
    └── SEC-02 authorization tests

All P0 and P1 work
→ QA-04 internal airplane-mode field test
→ QA-05 beta readiness review
```

## Epic A — Offline feasibility and packages

### OFF-01 — Decide the offline map and web-platform architecture

- **Priority:** P0
- **Size:** M
- **Depends on:** none
- **Outcome:** prove that the account-gated offline promise is technically,
  legally, and operationally viable on supported iPhone and Android browsers.
- **Scope:** compare map providers, tile or vector packaging, licensing,
  service-worker strategy, browser storage limits, eviction behavior, update
  policy, and PWA installation requirements.
- **Acceptance:**
  - A written decision names the selected approach and rejected alternatives.
  - Map licensing explicitly permits the intended offline use.
  - A small trail corridor opens in airplane mode on current iOS Safari and
    Android Chrome.
  - Storage use is measured rather than estimated informally.
  - Known platform limitations and fallbacks are documented.
  - The prototype does not modify the production caching strategy.

### OFF-02 — Define the offline package contract

- **Priority:** P0
- **Size:** M
- **Depends on:** OFF-01, DATA-01
- **Outcome:** every downloaded route has one versioned, verifiable manifest.
- **Scope:** package ID, account owner, trail and scoring versions, files,
  checksums, download time, freshness, required versus optional resources,
  update compatibility, and deletion metadata.
- **Acceptance:**
  - The contract distinguishes required and optional resources.
  - A package cannot be called ready without a valid manifest.
  - Weather is stored as a timestamped snapshot, never as live data.
  - Migration and incompatible-version behavior are defined.
  - Personal data is excluded unless explicitly justified.

### OFF-03 — Implement account-gated package storage and lifecycle

- **Status:** In progress; owner metadata, restartable recovery, and storage
  preflight and package management complete (2026-07-28)
- **Priority:** P0
- **Size:** L
- **Depends on:** OFF-02, AUTH-01
- **Outcome:** authenticated users can download, list, update, and remove route
  packages without losing access when connectivity or a session disappears.
- **Acceptance:**
  - Guests are routed through login and returned to the selected download.
  - A completed package remains usable without network or token refresh.
  - Interrupted downloads resume or fail without claiming readiness.
  - Users can see size, date, freshness, and owning account.
  - Logout and account deletion follow the documented local-cleanup policy.
  - Storage failures offer actionable recovery.

### OFF-04 — Package an offline map corridor

- **Status:** First beta corridor implemented and iPhone-validated; Android and
  route-specific field validation remain open (2026-07-28)
- **Priority:** P0
- **Size:** L
- **Depends on:** OFF-01, OFF-02
- **Outcome:** the route and enough geographic context remain understandable
  without network tiles.
- **Acceptance:**
  - The corridor boundary and zoom levels are deterministic.
  - Package size has an enforced upper limit.
  - Route, trailhead, and essential safety points render in airplane mode.
  - A missing optional layer does not hide the route.
  - Provider attribution remains visible offline.

### OFF-05 — Verify packages and expose truthful states

- **Status:** Implemented for the first beta package; beta.5 iPhone self-test,
  Android validation, and route-specific field review remain open (2026-07-29)
- **Priority:** P0
- **Size:** M
- **Depends on:** OFF-03, OFF-04
- **Outcome:** "Ready offline" is a verified state, not a visual assumption.
- **Acceptance:**
  - Required resources are checked after download.
  - States include not downloaded, downloading, ready, stale, incomplete,
    update available, failed, and removed.
  - The user can retry or resume incomplete packages.
  - Automated tests reject missing or corrupt required resources.
  - An airplane-mode self-test is available.

### OFF-06 — Export a standards-compatible GPX file

- **Priority:** P1
- **Size:** S
- **Depends on:** DATA-01, AUTH-01
- **Outcome:** an account holder can carry the route in another navigation app.
- **Acceptance:**
  - Export requires an authenticated account.
  - The GPX contains valid ordered geometry, trail name, and trailhead.
  - Export does not imply that all safety context is included.
  - Representative files pass an independent GPX parser test.

## Epic B — Trail data, scoring, and trust

### DATA-01 — Define the canonical versioned trail schema

- **Status:** Complete (2026-07-27)
- **Priority:** P0
- **Size:** M
- **Depends on:** none
- **Outcome:** curated and imported trails share one explicit data contract.
- **Acceptance:**
  - Required, optional, nullable, and derived fields are documented.
  - Units, coordinate order, enums, source fields, and freshness fields are
    unambiguous.
  - Curated and imported examples both validate.
  - Unknown is represented explicitly rather than with invented defaults.
  - The schema has a version and migration policy.

### DATA-02 — Enforce unified trail validation

- **Status:** Complete (2026-07-28)
- **Priority:** P0
- **Size:** M
- **Depends on:** DATA-01
- **Outcome:** invalid trail data cannot silently enter generated pages.
- **Acceptance:**
  - All production trail sources run through one validation command.
  - Duplicate IDs and slugs, invalid coordinates, broken geometry, unrealistic
    values, missing sources, and invalid verification states fail clearly.
  - Failures identify the record and field.
  - Existing audit scripts are reused or consolidated.
  - CI runs the validation before generated trail pages are published.

### DATA-03 — Define regional loading boundaries

- **Priority:** P1
- **Size:** M
- **Depends on:** DATA-01
- **Outcome:** one region does not require every trail and POI dataset.
- **Acceptance:**
  - A manifest maps regions to required datasets.
  - Opening the initial beta region does not download Savoy route data.
  - Missing optional regional data produces an honest empty state.
  - Static generation still discovers every published trail.

### SCORE-01 — Define the scoring contract and fixtures

- **Status:** Complete (2026-07-28)
- **Priority:** P0
- **Size:** M
- **Depends on:** DATA-01
- **Outcome:** one versioned calculation returns a score plus explanations.
- **Acceptance:**
  - Inputs distinguish dog facts, trail facts, current conditions, and
    unknowns.
  - Output includes score, category, positive reasons, cautions, unknowns, and
    version.
  - Fixtures cover young, senior, heat-sensitive, small, large, fit, and
    incomplete profiles.
  - Expected results are reviewed as product decisions.
  - Unknown safety data cannot raise recommendation confidence.

### SCORE-02 — Migrate every scoring consumer

- **Status:** Complete (2026-07-28)
- **Priority:** P0
- **Size:** M
- **Depends on:** SCORE-01
- **Outcome:** every page produces the same recommendation for the same inputs.
- **Acceptance:**
  - Homepage, saved trails, `my-trails`, trail detail, and generated experiences
    use the canonical contract or stored canonical output.
  - Duplicate scoring logic is removed.
  - Cross-surface regression tests compare representative profiles.
  - Score version is available for analytics and downloaded packages.

### TRUST-01 — Standardize provenance and freshness output

- **Status:** Complete (2026-07-28)
- **Priority:** P0
- **Size:** M
- **Depends on:** DATA-01
- **Outcome:** users can distinguish mapped, reviewed, field-checked, community,
  stale, and unknown information.
- **Acceptance:**
  - Every safety category has a source state and freshness state.
  - "Verified" is reserved for the agreed evidence-backed process.
  - Generated and interactive trail pages use the same labels.
  - Missing dates are visible as unknown.
  - Community reports never silently alter the DoloPaws assessment.

## Epic C — Discovery and trail decisions

### UX-01 — Select the canonical discovery journey

- **Status:** Complete in code (2026-07-29)
- **Priority:** P1
- **Size:** S
- **Depends on:** DATA-03
- **Outcome:** homepage and browse surfaces have distinct, non-duplicated jobs.
- **Acceptance:**
  - One documented entry flow is canonical for search and filtering.
  - Secondary pages link into that state rather than reimplementing it.
  - Search, selected region, filters, and dog context survive navigation.
  - Obsolete preview surfaces are excluded from production deployment.

### UX-02 — Consolidate dog-specific filters and zero-result recovery

- **Status:** Complete in code (2026-07-29)
- **Priority:** P1
- **Size:** M
- **Depends on:** UX-01, SCORE-01
- **Outcome:** users narrow routes by meaningful dog constraints without
  reaching an unexplained dead end.
- **Acceptance:**
  - Filters cover distance, terrain, water, shade or heat, exposure,
    restrictions, and verification.
  - Each filter has understandable language.
  - Zero results identify restrictive filters and offer reset or safe
    broadening.
  - Filtering never converts unknown data into a positive match.

### UX-03 — Add side-by-side trail comparison

- **Status:** Complete in code (2026-07-29)
- **Priority:** P1
- **Size:** L
- **Depends on:** SCORE-01, TRUST-01
- **Outcome:** users can compare two or three trails without relying on memory.
- **Acceptance:**
  - Comparison covers match category, reasons, distance, elevation, duration,
    terrain, exposure, shade, heat, water, hazards, restrictions, and
    verification.
  - Unknown values are visually and semantically distinct from safe values.
  - Comparison works on the supported mobile viewport.
  - Users can remove a trail and proceed to its detail page.

### UX-04 — Build the canonical recommendation decision block

- **Status:** Complete in code (2026-07-29)
- **Priority:** P1
- **Size:** M
- **Depends on:** SCORE-01, TRUST-01
- **Outcome:** each trail gives one explainable recommendation.
- **Acceptance:**
  - The block shows conclusion, reasons, cautions, and unknowns.
  - It names the active dog or states that the result is unpersonalized.
  - Source and freshness links are reachable.
  - Save, compare, and download are clearly different actions.
  - Generated summaries cannot contradict the interactive result.

### UX-05 — Preserve guest context through account creation

- **Status:** Complete in code (2026-07-30)
- **Priority:** P1
- **Size:** M
- **Depends on:** AUTH-01
- **Outcome:** registration does not destroy the value already created.
- **Acceptance:**
  - Dog draft, trail ID, filters, region, and intended action survive login.
  - The user returns directly to save or download confirmation.
  - Migration requires a clear user action and does not overwrite newer data.
  - Expired or malformed pending state fails safely.

### UX-06 — Add the pre-hike readiness check

- **Status:** Complete in code (2026-07-30)
- **Priority:** P1
- **Size:** M
- **Depends on:** OFF-05, HIKE-03
- **Outcome:** users know whether the route, GPS, information, and device are
  ready before leaving.
- **Acceptance:**
  - Package, freshness, GPS permission, usable fix, weather snapshot, trailhead,
    and emergency-information states are shown.
  - Blocking and advisory items are distinct.
  - Users can run the airplane-mode self-test.
  - DoloPaws never implies that beta navigation replaces emergency preparation.

## Epic D — Accounts, security, and local ownership

### AUTH-01 — Define account, entitlement, and local-data rules

- **Status:** Complete (2026-07-27)
- **Priority:** P0
- **Size:** S
- **Depends on:** none
- **Outcome:** account requirements remain consistent online and offline.
- **Acceptance:**
  - Guests, authenticated users, verified contributors, expired sessions,
    logout, and deleted accounts have documented permissions.
  - Download requires authentication only when initiating or managing it.
  - Existing packages remain usable offline without token refresh.
  - Shared-device ownership and local cleanup behavior are explicit.

### AUTH-02 — Add verified contributor eligibility

- **Status:** Complete and production-verified (2026-07-28)
- **Priority:** P1
- **Size:** M
- **Depends on:** AUTH-01, SEC-01
- **Outcome:** only eligible accounts can publish community content.
- **Acceptance:**
  - Email-password accounts require verified email for publication.
  - Verified social identity follows a documented policy.
  - Ineligible users receive a recovery action, not a generic failure.
  - Download entitlement remains separate from contribution eligibility.

### AUTH-03 — Separate server deletion from device cleanup

- **Priority:** P1
- **Size:** M
- **Depends on:** AUTH-01, OFF-03, HIKE-01
- **Outcome:** users understand and control what account deletion removes.
- **Acceptance:**
  - Server account deletion, local packages, active hikes, journal records,
    pending reports, and analytics queues are covered explicitly.
  - Shared-device cleanup is available.
  - Destructive actions name their exact scope before confirmation.
  - Automated tests cover retained and removed local data.

### SEC-01 — Version Firestore rules and indexes

- **Status:** Complete and production-verified (2026-07-28)
- **Priority:** P0
- **Size:** M
- **Depends on:** AUTH-01
- **Outcome:** server-side authorization is reviewable with the application.
- **Acceptance:**
  - Rules and required indexes are stored in the repository.
  - Ownership, field shape, size, allowed states, and contribution eligibility
    are enforced server-side.
  - Clients cannot publish themselves as verified or bypass moderation.
  - Deployment instructions identify the target project and safe rollout.

### SEC-02 — Test Firestore allow and deny cases

- **Status:** Complete (2026-07-28)
- **Priority:** P0
- **Size:** M
- **Depends on:** SEC-01
- **Outcome:** authorization failures are caught before deployment.
- **Acceptance:**
  - Emulator tests cover unauthenticated, owner, other-user, moderator, and
    malformed requests.
  - Users cannot edit or delete another user's private or community data.
  - Rate-sensitive or duplicate writes follow the documented policy.
  - Tests run in CI without production credentials.

## Epic E — Durable hike mode

### HIKE-01 — Persist the minimum active-hike session

- **Priority:** P0
- **Size:** M
- **Depends on:** OFF-05, AUTH-01
- **Implementation:** complete in code; see
  `docs/architecture/HIKE-01-durable-active-session.md`.
- **Outcome:** a refresh or closure does not erase an active hike.
- **Acceptance:**
  - Trail and package IDs, start time, state, last valid progress, and schema
    version are persisted locally.
  - Continuous GPS history is not required or stored by default.
  - Writes are resilient to storage exceptions.
  - Corrupt or incompatible sessions fail safely.

### HIKE-02 — Restore, pause, and resume a hike offline

- **Priority:** P0
- **Size:** M
- **Depends on:** HIKE-01
- **Implementation:** complete in code; see
  `docs/architecture/HIKE-02-offline-restoration.md`.
- **Outcome:** an unfinished hike resumes from the downloaded package.
- **Acceptance:**
  - Refresh and browser reopening restore the active hike.
  - Restoration works in airplane mode.
  - Users may resume, pause, or explicitly discard the session.
  - A missing package produces recovery guidance.
  - Automated tests cover clean, expired, corrupt, and missing-package state.

### HIKE-03 — Make GPS and off-route behavior accuracy-aware

- **Priority:** P0
- **Size:** M
- **Depends on:** OFF-04
- **Implementation:** complete in code; see
  `docs/architecture/HIKE-03-gps-and-off-route-policy.md`.
- **Outcome:** poor GPS does not create false confidence or false alarms.
- **Acceptance:**
  - Accuracy bands and stale-fix thresholds are documented and tested.
  - Unreliable fixes do not trigger strong off-route claims.
  - The interface shows accuracy and time of last valid fix; exact route
    distance appears only for confirmed or far-from-route guidance.
  - Permission denied, unavailable, and timeout states have recovery actions.
  - A user is never asked to deliberately leave a safe route during testing.

### HIKE-04 — Persist completion before optional follow-up

- **Priority:** P1
- **Size:** M
- **Depends on:** HIKE-02
- **Implementation:** complete in code; see
  `docs/architecture/HIKE-04-durable-completion.md`.
- **Outcome:** finishing a hike is durable even if the next page fails.
- **Acceptance:**
  - Completion time, duration, trail, and status save before navigation.
  - Repeated completion does not create duplicates.
  - The active session is cleared only after the completion record succeeds.
  - Offline completion remains available for later synchronization.

### HIKE-05 — Guide an off-route user back to a reachable trail point

- **Status:** Carezza mapped-footpath routing pilot implemented in code;
  physical validation and rollout to other trails remain open (2026-08-04)
- **Priority:** P0
- **Size:** L
- **Depends on:** HIKE-03, OFF-04
- **Implementation:** accuracy-aware detection plus an offline OSM footpath
  graph and local shortest-path routing for Carezza are complete; see
  `docs/architecture/HIKE-05-route-rejoin-guidance.md`.
- **Outcome:** a user with a reliable off-route fix can identify how to regain
  the trail without mistaking a geometric straight line for a safe path.
- **Acceptance:**
  - The target is the closest safely reachable trail point, not merely the
    closest stored vertex.
  - Weak, stale, or ambiguous fixes never produce confident rejoin guidance.
  - A warning requires sustained evidence and uses nearest-segment distance so
    ordinary GPS drift and sparse route points do not create nuisance alerts.
  - Distance, compass direction, current position, and target remain available
    from the downloaded package.
  - Guidance uses a verified routable path where one is packaged; otherwise it
    is explicitly labelled as orientation only and says to use marked paths.
  - The interface never routes across water, cliffs, barriers, or private and
    inaccessible land.
  - Guidance is suppressed when the user is too far from the packaged corridor.
  - Automated geometry tests and controlled physical tests cover re-entry,
    inaccurate GPS, restart, and airplane mode.

### HIKE-06 — Keep live elevation context visible during navigation

- **Status:** Online hike-mode milestone implemented; downloaded elevation-map
  data and physical validation remain open (2026-08-04)
- **Priority:** P0
- **Size:** M
- **Depends on:** HIKE-02, HIKE-03
- **Implementation:** fullscreen live elevation profile and Flat map / Elevation
  map selector complete; see `docs/architecture/HIKE-06-live-elevation-context.md`.
- **Outcome:** a hiker can see where they are within the climb or descent without
  leaving the navigation map.
- **Acceptance:**
  - Fullscreen hike mode keeps the route elevation profile visible.
  - The live cursor uses nearest-segment progress rather than sparse vertices.
  - Current progress and interpolated route elevation are labelled as route
    data rather than exact GPS altitude.
  - Flat map remains the legible default and Elevation map adds shaded relief
    without hiding the route, labels, or safety controls.
  - Missing elevation data produces an honest unavailable state.
  - Downloaded packages include the profile before offline hike mode claims
    elevation support; remote terrain tiles are never implied to work offline.

### OUT-01 — Collect the structured post-hike outcome

- **Priority:** P1
- **Size:** M
- **Depends on:** HIKE-04, METRIC-01
- **Implementation:** complete in code; see
  `docs/architecture/OUT-01-structured-post-hike-outcome.md`.
- **Outcome:** DoloPaws learns whether the recommendation suited the dog.
- **Acceptance:**
  - The user can answer appropriate, appropriate with unexpected cautions, not
    appropriate, did not complete, or prefer not to answer.
  - Water accuracy and material hazards are optional structured follow-ups.
  - Offline responses queue with visible pending state.
  - Submission does not automatically publish a public review.

## Epic F — Community and moderation

### MOD-01 — Implement community content states

- **Priority:** P1
- **Size:** M
- **Depends on:** AUTH-02, SEC-01
- **Implementation:** complete in code; see
  `docs/architecture/MOD-01-community-content-states.md`.
- **Outcome:** ratings, reviews, hazards, and photos follow explicit publication
  rules.
- **Acceptance:**
  - Supported states are draft, pending, visible, reported, hidden, and removed.
  - First-review and first-photo policies are enforceable.
  - Ratings exclude pending, hidden, and removed content.
  - Clients cannot set privileged moderation states.

### MOD-02 — Add the minimum moderation queue

- **Priority:** P1
- **Size:** L
- **Depends on:** MOD-01, SEC-02
- **Implementation:** complete in code; see
  `docs/architecture/MOD-02-minimum-moderation-queue.md`.
- **Outcome:** a responsible operator can review reported and pending content.
- **Acceptance:**
  - Authorized moderators can inspect type, trail, author ID, timestamps,
    report reason, and content.
  - Decisions include publish, hide, remove, and restore with an audit record.
  - Ordinary users cannot access the queue.
  - Personal information not required for moderation is excluded.

### MOD-03 — Add hazard confirmation and expiry

- **Priority:** P1
- **Size:** M
- **Depends on:** MOD-01
- **Implementation:** complete in code; see
  `docs/architecture/MOD-03-hazard-confirmation-and-expiry.md`.
- **Outcome:** urgent reports appear quickly without becoming permanent facts.
- **Acceptance:**
  - A new hazard is labelled as an unconfirmed community report.
  - Independent eligible users can confirm or dispute it.
  - Expiry depends on hazard type.
  - DoloPaws-reviewed and official confirmation are distinct.
  - Expired reports leave the active safety view without being silently erased
    from moderation history.

### MOD-04 — Queue offline contributions

- **Priority:** P2
- **Size:** M
- **Depends on:** MOD-01, OFF-03
- **Outcome:** post-hike feedback is not lost without connectivity.
- **Acceptance:** queued items show pending state, retry idempotently, survive
  reopening, and never publish twice.

## Epic G — Measurement and privacy

### METRIC-01 — Implement a privacy-safe event API

- **Status:** Complete in code (2026-07-30)
- **Priority:** P1
- **Size:** M
- **Depends on:** AUTH-01
- **Outcome:** the eight Day 4 event families use one consent-aware path.
- **Acceptance:**
  - Event names, states, and allowed properties are validated.
  - Names, email, content, exact coordinates, and GPS history are rejected.
  - Operational hike state is stored separately.
  - Consent and withdrawal behavior are documented.
  - Offline events queue and retry without duplication.

### METRIC-02 — Instrument the core funnel

- **Status:** Complete in code (2026-08-04)
- **Priority:** P1
- **Size:** M
- **Depends on:** METRIC-01, OFF-05, OUT-01
- **Outcome:** the team can locate failures from discovery through outcome.
- **Acceptance:**
  - Search results, selection, explanation, package readiness, airplane test,
    hike start, completion, and outcome are recorded once.
  - Failure categories are actionable and contain no sensitive content.
  - A test journey produces the expected ordered event sequence.

### PRIV-01 — Define retention and deletion

- **Priority:** P1
- **Size:** S
- **Depends on:** AUTH-03, METRIC-01
- **Outcome:** collected data has a documented purpose and lifetime.
- **Acceptance:**
  - Private profile, downloads, active hikes, outcomes, community content,
    moderation records, and analytics each have a retention rule.
  - User-visible explanations match implementation.
  - Deletion and legally necessary moderation retention are distinguished.

## Epic H — Performance, accessibility, and release gates

### PERF-01 — Establish mobile performance budgets

- **Priority:** P1
- **Size:** S
- **Depends on:** DATA-03
- **Outcome:** performance regressions have explicit limits.
- **Acceptance:**
  - Homepage, discovery, trail detail, download, and active hike have measured
    baselines on a throttled mobile profile.
  - Budgets cover transferred bytes, LCP, INP, CLS, and JavaScript execution.
  - Results and test conditions are reproducible.

### PERF-02 — Optimize oversized images and regional data

- **Priority:** P1
- **Size:** L
- **Depends on:** PERF-01, DATA-03
- **Outcome:** users do not download desktop images or unrelated regions.
- **Acceptance:**
  - Large PNGs have responsive modern formats and fallbacks.
  - Trail and POI data load by required region.
  - Maps and secondary POIs lazy-load.
  - Performance budgets pass on supported mobile devices.

### A11Y-01 — Make the core journey keyboard and screen-reader complete

- **Priority:** P1
- **Size:** L
- **Depends on:** UX-04, UX-06, HIKE-04
- **Outcome:** the beta journey does not require a mouse or visual-only cues.
- **Acceptance:**
  - Search, profile, comparison, login handoff, download, readiness, active
    hike, completion, and outcome are keyboard operable.
  - Dialog focus, accessible names, errors, status announcements, contrast, and
    reduced motion are verified.
  - Automated checks are supplemented by manual screen-reader testing.

### QA-01 — Add the complete CI quality gate

- **Priority:** P1
- **Size:** M
- **Depends on:** DATA-02, SEC-02
- **Outcome:** tests, trail validation, static links, security rules, and
  production generation must pass before deployment.
- **Acceptance:**
  - One documented command runs the local equivalent.
  - CI fails on any required check.
  - Generated artifacts are checked for unintended drift.
  - No production credential is required.

### QA-02 — Create the offline failure test matrix

- **Priority:** P1
- **Size:** M
- **Depends on:** OFF-05, HIKE-03
- **Outcome:** the Day 2 recovery promises are repeatably tested.
- **Acceptance:**
  - Tests cover interruption, low storage, stale package, no network, denied or
    inaccurate GPS, refresh, closure, restart, and queued submission.
  - Each scenario names the expected user message and recovery action.
  - Supported browser and device versions are documented.

### QA-03 — Run an end-to-end internal usability test

- **Priority:** P1
- **Size:** M
- **Depends on:** UX-06, OUT-01, A11Y-01
- **Outcome:** an unfamiliar user completes the core journey without coaching.
- **Acceptance:**
  - The participant can explain the recommendation.
  - Save and download are not confused.
  - Offline readiness is understood.
  - All hesitations and dead ends are recorded by journey stage.
  - Safety testing uses only a familiar, low-risk route.

### QA-04 — Pass a controlled airplane-mode field test

- **Priority:** P0
- **Size:** M
- **Depends on:** OFF-05, HIKE-02, HIKE-03, UX-06
- **Outcome:** the core offline promise works on a real low-risk trail.
- **Acceptance:**
  - The package is downloaded and verified before departure.
  - The browser is closed and reopened in airplane mode.
  - Route, map context, warnings, trailhead, and GPS position remain available.
  - Refresh and active-hike restoration succeed.
  - No deliberate unsafe or off-route behavior is used.
  - Any failure blocks beta readiness until resolved.

### QA-05 — Make the beta readiness decision

- **Priority:** P0
- **Size:** S
- **Depends on:** all P0 and P1 items required by the core journey
- **Outcome:** launch, reduce scope, or delay based on evidence.
- **Acceptance:**
  - No unresolved P0 issue remains.
  - Accepted P1 exceptions have an owner, rationale, and user-safe fallback.
  - Security, offline, accuracy, accessibility, performance, and privacy gates
    have recorded evidence.
  - Recruitment does not begin until this decision is recorded.

## P2 supporting backlog

| ID | Item | Size | Dependency |
| --- | --- | --- | --- |
| SAVE-01 | Consolidate `my-trails` into the canonical `saved.html` experience | M | SCORE-02, UX-01 |
| JOURNAL-01 | Define synchronization and privacy for walk-journal records | M | AUTH-03, HIKE-04 |
| POI-01 | Lazy-load nonessential rifugi, bars, lifts, and transit layers | M | DATA-03, PERF-01 |
| I18N-01 | Guarantee Italian parity for every core beta state | M | Stable core-flow copy |
| SEO-01 | Make generated trail pages hand off to the canonical interactive page | M | TRUST-01, UX-04 |
| GUIDE-01 | Link relevant guides from cautions without interrupting decisions | S | UX-04 |
| TOOL-01 | Move maintained fetch utilities under `scripts/` and document outputs | S | DATA-02 |
| CLEAN-01 | Remove machine artifacts and archive unused prototypes | S | UX-01 dependency audit |

## P3 experiments

| ID | Experiment | Evidence required before expansion |
| --- | --- | --- |
| EXP-01 | Public ratings | Demonstrate that they improve decisions beyond structured outcomes |
| EXP-02 | Written reviews | Demonstrate usefulness relative to moderation cost |
| EXP-03 | Community photos | Demonstrate decision value and sustainable storage/moderation |
| EXP-04 | Breed insights | Obtain expert review and comprehension evidence |
| EXP-05 | Popularity counts | Show a safety or planning benefit rather than generic social proof |
| EXP-06 | Automatic parking adjustment | Validate access accuracy without silently changing route meaning |
| EXP-07 | Broad OSM expansion | Show that added coverage does not reduce trust or performance |
| EXP-08 | Preview dog personas | Show that they improve profile conversion and understanding |

## Explicitly not in the first beta

- open comments and replies;
- social feeds;
- badges, leaderboards, or contribution gamification;
- subscriptions or paid tiers;
- multiple dog profiles;
- geographic expansion beyond the selected initial region;
- voice turn-by-turn navigation;
- continuous background GPS recording;
- advanced multi-day itinerary planning;
- accommodation or services marketplaces;
- complex social sharing.

## Critical path

The shortest dependency-safe sequence is:

1. **OFF-01:** prove the offline architecture and licensing.
2. **DATA-01:** define the trail schema.
3. **AUTH-01:** define account and offline entitlement rules.
4. **SCORE-01** and **TRUST-01:** define recommendation and evidence contracts.
5. **DATA-02**, **SCORE-02**, and **SEC-01/02:** enforce the contracts.
6. **OFF-02 through OFF-05:** build and verify packages.
7. **HIKE-01 through HIKE-06:** make the hike durable, accuracy-aware, able to
   provide honest off-route recovery guidance, and keep elevation context
   visible.
8. **UX-01 through UX-06:** complete the decision and readiness journey.
9. **OUT-01**, **METRIC-01/02**, and **MOD-01 through MOD-03:** close the
   feedback and operating loop.
10. **PERF**, **A11Y**, and **QA** gates: validate the complete beta.

## First work item

The first backlog action is **OFF-01: Decide the offline map and web-platform
architecture**.

It comes first because offline use is now part of the product promise, but the
current service worker is intentionally a cache-removal kill switch. Map
licensing, iOS storage behavior, package size, and eviction constraints could
change the architecture or beta scope. That uncertainty should be resolved
before building the download interface.

The first production-code change after the feasibility decision should be
**DATA-01: Define the canonical versioned trail schema**.

## Definition of ready

An issue is ready for implementation when:

- its user outcome is clear;
- dependencies are complete or deliberately stubbed;
- acceptance criteria are testable;
- required product language is agreed;
- privacy, safety, and offline implications are identified;
- the issue is small enough to complete without hiding a second project.

## Definition of done

An issue is done when:

- acceptance criteria pass;
- relevant automated and manual tests pass;
- failure and accessibility states are covered;
- documentation and data migrations are updated;
- analytics contain no prohibited personal or location data;
- generated outputs do not drift unexpectedly;
- no new P0 safety or security problem is introduced.
