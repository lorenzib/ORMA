# Day 5 — Feature inventory and beta scope

Status: complete

## Purpose

This inventory decides which existing and planned capabilities belong in the
first DoloPaws beta. Classification is based on the agreed product promise:

> Help an account holder choose a trail that suits their dog, prepare it for
> offline use, understand where they are during the hike, and report whether
> the trail was appropriate afterward.

Classification meanings:

- **Core:** the beta promise fails without it.
- **Supporting:** strengthens the journey but should not block the first beta
  unless it carries essential safety information.
- **Experimental:** implemented or proposed, but value or operating cost still
  needs evidence.
- **Defer:** intentionally excluded from the first beta.
- **Remove or consolidate:** obsolete, duplicated, or confusing; verify
  dependencies before deletion.

This document classifies product scope. "Remove" is not permission to delete a
file without a separate dependency check.

## Core beta features

| Feature | User problem | Current state | Main gap or risk | Required beta action |
| --- | --- | --- | --- | --- |
| Account creation and login | Preserve private data and unlock downloads | Implemented with Firebase | Contribution eligibility and offline session rules are incomplete | Add verified-identity state and test authentication handoffs |
| Authentication intent recovery | Return users to the action that caused login | Partly implemented for trail actions | Download does not exist yet; not every flow preserves context | Preserve trail, dog draft, filters, and intended action |
| Dog profile | Describe the dog's relevant capabilities | Implemented | Some questions do not explain their recommendation effect | Define required fields, assumptions, and completeness |
| Temporary guest profile | Demonstrate personalized value before registration | Implemented through guest flows | Must survive account conversion safely | Preserve and migrate the draft after consent |
| Trail discovery | Find realistic routes in a chosen area | Implemented across homepage and browse surfaces | Overlapping discovery experiences and scattered filters | Define one canonical discovery journey |
| Dog-specific filters | Narrow by constraints that matter to the dog | Partly implemented | Water, shade, heat, exposure, restrictions, and verification are inconsistent | Consolidate filters and explain zero-result recovery |
| Trail comparison | Choose among suitable alternatives | Missing | Users must compare pages from memory | Compare two or three trails on the agreed dog-safety dimensions |
| Canonical scoring engine | Produce one consistent recommendation | Complete in SCORE-02 | Active consumers use scoring `1.1.0`; obsolete `my-trails.js` removed | Keep cross-surface regression coverage |
| Recommendation explanation | Understand why a trail matches | Partly implemented | Reasons, cautions, and unknowns are not one consistent output | Return structured positives, warnings, unknowns, and score version |
| Trail trust and provenance | Know what evidence supports each claim | Implemented in `trail-trust.js` and audits | Freshness and verification language vary by surface | Standardize tier, source, date, and unknown-category display |
| Canonical trail schema | Prevent contradictory or malformed trail data | Informal data structures exist | Curated and imported records contain different completeness levels | Define a versioned schema with required and optional fields |
| Build-time trail validation | Stop unsafe data from reaching production | Several audit and validation scripts exist | There is no single mandatory validation gate for all trail sources | Run unified schema, geometry, source, and freshness checks in CI |
| Dynamic trail detail | Present the decision and route | Implemented in `trail.html` and related scripts | Large, fragmented implementation with inconsistent next actions | Make the decision block and primary actions canonical |
| Save/bookmark | Preserve planning intent across devices | Implemented | Save may be confused with offline download | Label it clearly as a synchronized bookmark |
| Offline trail download | Retain route data without coverage | Missing | Central product promise is not delivered | Build account-gated package creation, progress, verification, update, and removal |
| Offline map corridor | See route context without network tiles | Missing | GPS alone cannot provide usable map context | Choose an offline map architecture and package bounded trail corridors |
| Offline readiness check | Know whether the route will really work offline | Missing | A previously opened page can be mistaken for a download | Verify all essential resources before showing "Ready offline" |
| GPX export | Use the route in another offline navigation product | Missing | No fallback when the web experience is unsuitable | Provide export to authenticated users from the download flow |
| Trailhead readiness | Reach the correct start prepared | Partly implemented through access and parking data | No consolidated pre-hike checklist | Add start coordinates, access caveats, permissions, package, weather, and emergency checks |
| Live GPS position | Understand current location on the trail | Implemented in `hike-mode.js` | It depends on the page and map already being available | Bind it to the downloaded package |
| GPS accuracy handling | Avoid false confidence and false warnings | Partly implemented | Accuracy thresholds and recovery need product rules and tests | Define accuracy bands and suppress unreliable off-route conclusions |
| Off-route detection | Recognize meaningful deviation | Implemented in basic form | Warning lacks durable state and complete guidance | Add accuracy-aware messaging, distance, last fix, and recovery |
| Durable active hike | Resume after refresh, browser closure, or restart | Missing | A critical hike can be lost | Persist the minimum session locally and restore it offline |
| Hike completion | Close the navigation session deliberately | Implemented in basic form | Completion depends on a journal handoff | Save a minimal completion record before opening optional follow-up |
| Post-hike suitability outcome | Learn whether the recommendation was correct | Missing as a structured core event | Reviews do not answer the north-star question reliably | Ask the agreed short outcome questions after completion |
| Safe failure recovery | Continue after common failures | Uneven | Download, storage, GPS, offline, and restoration states lack recovery | Implement the Day 2 failure matrix |
| Accessibility of the core journey | Use the product without visual or motor assumptions | Some dialogs and controls handle focus | No end-to-end accessibility gate exists | Test search, profile, download, navigation, and completion by keyboard and screen reader |
| Product analytics abstraction | Measure the agreed funnel privately | Minimal abstraction in `guest-session.js` | The eight event families are not implemented | Add consent-aware events without exact GPS or personal content |
| Firestore rules and indexes | Enforce authorization independently of the client | Not stored in this repository | Community and user-data security cannot be reviewed or tested here | Version, test, and deploy rules and indexes |
| Account deletion and local cleanup | Respect privacy and shared-device use | Account deletion exists | Offline packages, journal data, and pending queues need explicit policy | Define server deletion separately from removal of local device data |

## Supporting features

| Feature | Value | Current state | Beta treatment |
| --- | --- | --- | --- |
| Saved-trails management | Organizes bookmarks | Implemented in `saved.html` and duplicated elsewhere | Keep one canonical surface |
| Walk journal | Helps users remember previous walks | Implemented with device-local storage | Preserve, but do not expand until synchronization and privacy behavior are defined |
| Elevation profile | Helps assess physical difficulty | Implemented where data exists | Keep; show unknown honestly |
| Parking and access points | Helps users reach the trailhead | Implemented from mapped and queried data | Keep when provenance is visible; do not imply field verification |
| Public transport and lift information | Supports practical planning | Partially represented through POIs and guidance | Include only when current and sourced |
| Water points | Critical dog-planning context | Implemented with trust-aware language | Treat source and freshness display as core; richer POI browsing remains supporting |
| Rifugi, bars, and amenities | Adds useful route context | Implemented from large regional datasets | Lazy-load and avoid implying dog access without evidence |
| Weather and heat snapshot | Helps plan timing and water | Implemented in parts of trail UI | Keep as a timestamped snapshot; never treat downloaded weather as live |
| Dog-safety guides | Educates owners beyond a single trail | Implemented as editorial pages | Keep available but do not let guide expansion block the core journey |
| Italian localization | Supports the initial market | Implemented broadly | Maintain core-flow parity; secondary content can follow |
| Mobile navigation shell | Makes key sections reachable on phones | Implemented | Keep and test with the revised download and active-hike actions |
| Map points of interest | Shows water, amenities, transit, and lifts | Implemented through multiple layers | Keep essential safety points; lazy-load secondary categories |
| Static trail pages | Provides indexable route summaries | Generated for many trails | Keep for discovery, but define how they hand off to the canonical interactive trail experience |
| Sitemap and structured discovery | Supports search-engine discovery | Implemented | Maintain through generation and static-link checks |
| Trail source and trust audits | Supports editorial operations | Implemented through scripts and documentation | Retain and integrate into the required validation gate |

## Experimental features

| Feature | Hypothesis | Current state | Evidence needed |
| --- | --- | --- | --- |
| Public star ratings | Community sentiment helps trail selection | Implemented for logged-in users | Determine whether ratings add value beyond dog-specific outcomes |
| Written reviews | Dog-owner context explains trail realities | Implemented | Test usefulness, moderation workload, and structured alternatives |
| Community hazard reports | Recent observations improve safety awareness | Implemented with stale handling | Test confirmation, expiry, abuse, and moderation workflows |
| Community photos | Recent images help users understand conditions | Implemented using Firestore data URLs | Test moderation, storage cost, privacy, and actual decision value |
| Breed-derived insights | Physical breed traits improve explanations | Extensively implemented | Validate language with veterinary expertise and user comprehension |
| Popularity or recent-hike counts | Social proof helps planning | Partly implemented through hike events | Determine whether it informs safety or merely adds activity signals |
| Automatic parking improvement | A nearer start point improves route usability | Implemented with network lookup and caching | Verify accuracy and avoid silently rotating routes to inappropriate access |
| Broad OSM route import | More coverage increases discovery value | Implemented for Dolomites and Savoy datasets | Measure whether incomplete routes dilute trust and performance |
| Dog-friendly POI filtering | Dog-tagged businesses improve trip planning | Implemented on maps | Validate OSM completeness before making strong claims |
| "Preview as" dog personas | Demonstrates personalization before profile creation | Implemented on the guest homepage | Test whether it teaches the product or distracts from creating a real profile |

Experimental features remain behind the core journey. They must have a
specific hypothesis, success measure, and operational owner before expansion.

## Deferred from the first beta

| Feature | Reason to defer |
| --- | --- |
| Open comment and reply threads | Creates moderation, notification, harassment, and staleness obligations without clear beta value |
| Social feed | Does not improve the core choose-download-hike journey |
| Gamification, badges, and leaderboards | Can distort safety contributions and requires abuse controls |
| Paid subscriptions | Value and repeat use have not yet been demonstrated |
| Multiple dog profiles | Multiplies scoring and journey complexity before the single-dog flow is proven |
| Wide geographic expansion | Makes verification, offline packaging, and support harder before one region works |
| Voice turn-by-turn guidance | Adds navigation and accessibility complexity beyond the first offline companion |
| Continuous background GPS recording | Has substantial battery, privacy, and platform constraints |
| Advanced trip itineraries | Premature before single-trail planning is dependable |
| Accommodation or services marketplace | Different product and operating model |
| Complex social sharing | Not required to validate recommendation or navigation value |
| Desktop administration beyond minimum moderation | Build only the operational tools required to run the beta safely |

## Remove or consolidate candidates

| Candidate | Problem | Decision |
| --- | --- | --- |
| `DoloPaws Homepage - Split Hero.html` | Large historical prototype at repository root | Confirm it is not used, then move outside production or delete |
| `dolopaws-combined-preview.html` | Standalone design prototype overlaps the real homepage | Archive outside the deployed site after dependency check |
| `my-trails.html` and `saved.html` | Two saved-trail concepts create navigation and maintenance ambiguity | Select `saved.html` as the canonical bookmark manager and migrate any unique behavior |
| `my-trails.js` scoring | Removed in SCORE-02 | Personalized homepage now owns this journey |
| `index.html` and `browse-trails.html` discovery flows | Overlapping search and browsing entry points | Give each a distinct purpose or consolidate into one canonical discovery flow |
| Dynamic `trail.html` and generated `trails/*.html` | Two trail-detail experiences can diverge | Keep generated pages for discovery only if they hand off clearly and share data/trust rendering |
| Current `sw.js` kill switch | Correctly removes the obsolete cache-first worker but cannot deliver the new promise | Keep until the replacement offline architecture is safely deployed, then replace it deliberately |
| Root-level one-off data scripts | Production code, editorial tooling, and fetch utilities are mixed | Move maintained tooling under `scripts/` and document generated outputs |
| `.DS_Store` and other machine artifacts | No product value | Remove from version control and expand `.gitignore` |
| Repeated inline page controllers | Business logic is embedded in large HTML files | Extract only when touching the relevant feature; avoid an unrelated rewrite |

## Beta scope boundary

The first beta includes only the shortest complete safe loop:

```text
create or load one dog profile
→ find and compare trails in one supported region
→ understand one recommendation
→ authenticate
→ save and download one trail
→ verify it offline
→ reach the start
→ track and restore one hike
→ finish
→ answer whether it suited the dog
```

Reviews, photos, guides, detailed journal features, and rich POIs may remain
available, but they cannot displace work required by this loop.

## Priority decisions

1. Treat offline download, offline maps, and durable hike restoration as
   missing core capabilities.
2. Centralize scoring and trust output before adding more recommendation UI.
3. Make `saved.html` the canonical bookmark surface unless a later usability
   test provides a reason not to.
4. Preserve generated trail pages for search discovery only if they cannot
   contradict the interactive trail experience.
5. Freeze geographic expansion until one compact Dolomites region passes the
   offline field test.
6. Keep community features experimental until identity verification,
   moderation, and expiry workflows exist.
7. Do not build open comments, social features, subscriptions, or advanced
   navigation for the first beta.

## Completion criteria

Day 5 is complete because:

- every meaningful existing or planned feature has a scope classification;
- every core feature has a beta requirement;
- missing core capabilities are explicit;
- experimental features have named evidence requirements;
- deferred work has a reason;
- duplicated and obsolete surfaces have been identified without deleting them;
- the beta scope can be expressed as one complete user loop.
