# Day 7 — Beta charter and scope lock

Status: complete

Decision date: 2026-07-27

Scope amendment: 2026-08-10

Account-profile amendment: 2026-08-11

## Purpose

This charter closes the first planning cycle and fixes the target for the first
ORMA beta. It prevents new ideas, visual work, and existing experimental
features from displacing the shortest complete safe journey.

The charter may change only through the change-control rule below.

## Product promise

> ORMA helps an account holder choose a trail that suits their dog, prepare
> it for offline use, understand where they are while hiking, and report
> whether the trail was appropriate afterward.

ORMA is:

1. a dog-specific trail decision tool; and
2. an offline trail companion.

It is not an emergency-rescue service or a certified turn-by-turn navigation
product.

## Initial beta region

The first beta region is:

> Val Gardena and nearby Alpe di Siusi trails in the Dolomites.

Only a deliberately selected set of familiar, low-risk routes may enter the
first field test.

Before field testing, each selected route must have:

- valid and reviewed geometry;
- a reviewed trailhead;
- explicit source and freshness information;
- no hidden unknowns in critical safety categories;
- a functioning offline package;
- an internal airplane-mode test.

Cortina, the wider Dolomites, and Savoy are outside the first beta scope.
Expansion requires evidence that the complete journey works in the initial
region.

If repeated access to Val Gardena and Alpe di Siusi proves operationally
impossible, the region may be replaced before recruitment by another compact
Dolomites area that can be personally and repeatedly validated. This is a
charter change, not an informal addition of a second region.

### Controlled offline-route scope amendment

The first offline-navigation beta is now frozen to exactly two packaged
routes: **Alpe di Siusi Meadow Loop** and **Lago di Carezza Loop**. Alpe di
Siusi remains the in-region reference route. Carezza is the established
architecture and airplane-mode reference route and is an explicit controlled
test exception to the original regional boundary.

This amendment does not authorize wider Dolomites or Savoy expansion. No
other trail may advertise an offline package during the first beta until the
two-route device and field matrix passes. Online planning and account features
may continue to cover the wider published catalogue.

### Optional multiple-dog profile amendment

An account may keep up to five dog profiles and select one active dog. This is
now an in-scope supporting account capability because the product owner chose
to retain it and its storage, switching, removal, breed catalogue, and photo
isolation contracts are implemented and tested.

The core beta journey still requires only one dog. Multiple profiles do not
expand offline-route, scoring, community, or geographic scope, and they may
not delay the physical navigation and usability gates. See
`docs/architecture/PROFILE-01-multi-dog-profiles.md`.

## Supported beta platforms

The supported mobile targets are:

- current iPhone hardware using current Safari;
- current Android hardware using current Chrome;
- at least one older supported iPhone;
- at least one older or lower-powered supported Android device.

Desktop browsers support planning and account management, but desktop
navigation is not a beta success criterion.

The precise minimum operating-system and browser versions will be set by
`OFF-01` after storage, service-worker, wake-lock, GPS, and offline-map
capabilities are tested. Unsupported environments must receive an honest
fallback, including GPX export where appropriate.

## Required beta journey

The in-scope journey is:

```text
arrive
→ search one supported region
→ create or load one dog profile
→ compare suitable trails
→ understand recommendation, cautions, unknowns, and sources
→ create an account or log in
→ save or download one trail
→ confirm that the package is ready offline
→ run an airplane-mode check
→ reach the reviewed trailhead
→ start and track the hike
→ recover after refresh or browser closure
→ finish the hike
→ report whether the trail suited the dog
```

Every step must have:

- a clear primary action;
- a truthful loading, empty, failure, and offline state;
- an accessible keyboard and screen-reader path;
- a recovery action that does not silently lose user work.

## Account and access rules

Guests may:

- browse supported trails;
- create a temporary dog profile;
- receive personalized recommendations;
- compare trails;
- inspect safety information, provenance, and freshness.

An authenticated account is required to:

- save a bookmark;
- initiate and manage an offline download;
- export GPX;
- synchronize private data;
- begin a public community contribution.

An eligible verified account is required to publish a rating, review, photo,
or hazard report.

An already verified offline package:

- remains usable without connectivity;
- does not require a fresh authentication token;
- is not removed merely because the session expires;
- follows the explicit shared-device, logout, and account-deletion policy.

## Core recommendation rules

The same dog and trail inputs must produce the same result everywhere.

Each recommendation contains:

- score and recommendation category;
- positive reasons;
- cautions;
- unknown factors;
- scoring version;
- trail evidence tier;
- sources and freshness.

Product language follows these rules:

- unknown is not safe;
- mapped is not field-verified;
- a recorded hike is not a verified review;
- community reports do not silently alter the ORMA assessment;
- "Verified" is reserved for the agreed evidence-backed process.

## Offline package commitment

The offline package must contain enough information to use the selected trail
without mobile data:

- route geometry;
- bounded offline map context;
- trailhead;
- recommendation, cautions, and unknowns;
- essential water and hazard points;
- emergency and local safety information;
- timestamped downloaded weather summary;
- package, trail-data, and scoring versions;
- download and freshness dates.

"Ready offline" appears only after every required resource has been verified.
A previously opened page or partially cached map is not a downloaded package.

Account holders also receive a valid GPX fallback.

## On-trail commitment

The beta on-trail experience provides:

- current GPS position and accuracy;
- position relative to the downloaded route;
- distance completed and remaining;
- accuracy-aware off-route warnings;
- upcoming essential waypoints;
- visible online or offline state;
- durable active-hike state;
- restoration after refresh and browser closure;
- explicit pause, resume, discard, and finish actions.

Continuous GPS history is not collected for product analytics. The minimum
operational state required to restore the hike is stored separately.

## Post-hike commitment

Completion is saved before optional navigation to another page.

The core post-hike question asks whether the trail was:

- appropriate;
- appropriate with unexpected cautions;
- not appropriate;
- not completed;
- unanswered by preference.

Optional structured follow-ups cover material hazards and water accuracy.
Offline responses remain visibly queued until synchronization succeeds.

A post-hike outcome is private product evidence. It does not automatically
become a public review.

## Community scope

The beta may include:

- one rating per eligible account per trail;
- moderated written reviews;
- moderated photos;
- immediately visible but explicitly unconfirmed hazard reports;
- confirmations, disputes, type-based expiry, and moderation history.

The community surface remains secondary to the core journey. If verification,
authorization, rate limits, moderation, or expiry are not ready, the affected
public contribution type must be disabled rather than published unsafely.

Open comment and reply threads are not part of the beta.

## Required P0 gates

The beta cannot launch with an unresolved failure in:

1. offline-map licensing or supported-browser feasibility;
2. canonical trail schema or production validation;
3. canonical scoring or provenance;
4. account and offline-entitlement rules;
5. Firestore authorization rules and tests;
6. package storage, map data, and readiness verification;
7. durable hike persistence and restoration;
8. GPS accuracy or off-route behavior;
9. controlled airplane-mode field testing;
10. final evidence-based readiness review.

The corresponding Day 6 backlog IDs are:

```text
OFF-01 OFF-02 OFF-03 OFF-04 OFF-05
DATA-01 DATA-02
SCORE-01 SCORE-02
TRUST-01
AUTH-01
SEC-01 SEC-02
HIKE-01 HIKE-02 HIKE-03
QA-04 QA-05
```

## Required P1 capabilities

The first beta also requires:

- regional data loading;
- canonical discovery;
- dog-specific filters and zero-result recovery;
- trail comparison;
- canonical recommendation explanation;
- intent-preserving authentication;
- pre-hike readiness;
- durable completion and structured outcome;
- the minimum safe community and moderation workflow for enabled contribution
  types;
- privacy-safe measurement of the core funnel;
- retention and deletion rules;
- mobile performance budgets;
- optimized images and regional data;
- end-to-end accessibility;
- the complete CI and failure-test matrix;
- internal usability testing.

A P1 item may be omitted only if:

- the affected feature is removed from beta scope;
- the core journey remains complete;
- the fallback is safe and documented;
- the omission is recorded at the readiness review.

## Supporting features that may remain

These features may remain available but cannot delay the core journey:

- saved-trail management;
- basic walk journal;
- elevation profiles;
- sourced parking, access, transport, and lift information;
- water and essential POIs;
- timestamped weather and heat information;
- dog-safety guides;
- Italian localization;
- static trail pages for discovery;
- sitemap and editorial audit tooling.

Supporting information that affects safety must still follow provenance and
freshness rules.

## Experimental features under a scope freeze

No expansion work is authorized during the core beta build for:

- public ratings beyond minimum safe operation;
- written reviews beyond minimum safe operation;
- community photos beyond minimum safe operation;
- breed-derived insight expansion;
- popularity counts;
- automatic parking adjustment;
- broad OSM route expansion;
- dog-friendly commercial POI expansion;
- preview dog personas.

Existing experimental features may receive security, accessibility, or
breakage fixes. They do not receive feature expansion until beta evidence
supports it.

## Explicitly excluded

The first beta does not include:

- open comments or reply threads;
- social feeds;
- badges, leaderboards, or gamification;
- subscriptions or paid tiers;
- new geographic regions;
- voice turn-by-turn guidance;
- continuous background GPS recording;
- advanced multi-day itineraries;
- accommodation or services marketplaces;
- complex social sharing.

## Design-work boundary

Visual design may continue in parallel when it:

- clarifies the agreed core journey;
- supplies states required by the backlog;
- improves accessibility;
- does not redefine data, scoring, offline, or security contracts.

Design work must not assume:

- that save and download are the same action;
- that a package is ready before verification;
- that unknown information is safe;
- that authentication is available during an offline hike;
- that unsupported browser capabilities exist;
- that experimental features belong in the beta.

Interface implementation that depends on offline architecture waits for
`OFF-01`.

## Launch-blocking conditions

Regardless of conversion or visual quality, beta launch is blocked by:

- incorrect or contradictory route geometry;
- inconsistent recommendations across surfaces;
- misleading verification or freshness claims;
- unauthorized access or publication;
- false "Ready offline" confirmation;
- loss of a downloaded route in the supported scenario;
- loss of an active hike after refresh or closure;
- strong off-route warnings based on unreliable GPS;
- a core action that is inaccessible on a supported device;
- prohibited personal or exact-location data entering analytics;
- absence of a safe moderation path for enabled public contributions.

## Beta success evidence

The readiness review requires recorded evidence that:

- at least 80% of observed users can explain the recommendation;
- at least 95% of test downloads reach verified readiness;
- supported airplane-mode tests succeed;
- active-hike restoration succeeds in supported scenarios;
- no unresolved critical security, navigation, or safety defect remains;
- post-hike outcomes can be queued offline and synchronized;
- the complete journey works on the supported iPhone and Android targets.

Public recruitment remains deferred until these gates pass.

## Scope-change rule

A proposed addition enters the beta only when all of the following are true:

1. It directly supports the product promise or resolves a launch blocker.
2. Its user outcome and acceptance criteria are explicit.
3. Its data, privacy, security, offline, and accessibility effects are known.
4. Dependencies and opportunity cost are identified.
5. An existing in-scope item is not silently displaced.
6. This charter and the Day 6 backlog are updated together.

Otherwise, the proposal goes to P2, P3, or the explicit post-beta list.

## Implementation decision

The first backlog action is:

> `OFF-01` — Decide the offline map and web-platform architecture.

The experiment must determine:

- permitted offline-map provider and licence;
- service-worker and local-storage architecture;
- route-corridor packaging method;
- measured package sizes;
- iPhone/Safari and Android/Chrome behavior;
- eviction and recovery limitations;
- fallback when full offline maps are unsupported.

It must not replace the production `sw.js` kill switch until the experiment is
validated and the rollout plan is reviewed.

The first production-code task after the feasibility decision is:

> `DATA-01` — Define the canonical versioned trail schema.

## Weekly review questions

At each weekly review:

1. Did completed work reduce a P0 or P1 risk?
2. Is the critical path still accurate?
3. Did new evidence change supported devices or offline feasibility?
4. Did any experimental work displace core work?
5. Is a safe fallback available for every blocked capability?
6. Does the charter still describe the product being built?
