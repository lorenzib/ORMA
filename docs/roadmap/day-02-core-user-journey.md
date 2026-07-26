# Day 2 — Core user journey

Status: complete

## Intended journey

```text
Discover
→ describe dog
→ search
→ compare
→ understand recommendation
→ create account or log in
→ save or download
→ confirm offline readiness
→ reach trailhead
→ track hike
→ recover from problems
→ finish
→ report conditions
```

## Journey audit

| Stage | Current state | Main gap | Required outcome |
| --- | --- | --- | --- |
| Discover | Guest and returning-user home experiences exist | Offline value is not central to the message | Explain planning plus offline use |
| Describe dog | Guest wizard and account profile exist | Questions do not consistently explain their effect | Explain why every answer matters |
| Search | Search, regions, valleys, and filters exist | Dog-specific filters are scattered | Consolidate water, shade, heat, exposure, and restrictions |
| Compare | Trails are ranked and scored | No side-by-side comparison | Compare two or three trails on dog-specific factors |
| Understand | Trail pages show scores, facts, and sources | Reasoning and unknowns are not consistently summarized | Show match reasons, cautions, and unknowns |
| Save | Account favorites work | Save can be confused with offline availability | Define save as a synchronized bookmark |
| Download | Not implemented | No package, progress, or verification | Provide an account-gated verified offline package |
| Reach trailhead | Some parking and start information exists | No unified readiness check | Provide start navigation and a pre-hike checklist |
| Track hike | GPS, progress, off-route detection, and wake lock partly exist | State is not durable or truly offline | Restore downloaded routes and active hikes |
| Recover | Some GPS and connectivity messages exist | Key failures lack recovery paths | Provide explicit recovery for every failure |
| Finish | Hike completion links to the journal | Completion data is fragile and local | Persist a minimal hike record |
| Report | Reviews, photos, and hazards exist | Offline submissions and moderation are incomplete | Queue contributions and moderate publication |

## Recommendation presentation

Each trail should provide one decision block:

```text
Recommended for Fido with cautions

Why it matches
✓ Distance is within Fido's usual range
✓ Mostly suitable terrain
✓ Good shade coverage

Important cautions
! Limited confirmed water
! Exposed section after km 4.2

Unknown
? Lift dog policy not recently confirmed
? Route not field-verified this season
```

The conclusion must be one of:

- strong option;
- possible with cautions;
- not recommended for this dog.

## Save versus download

Save and download are different product actions.

### Save

A lightweight bookmark synchronized with the user's account.

### Download

A verified offline package stored on the device. An account is required to
initiate and manage downloads.

Once downloaded, a route must:

- open without internet connectivity;
- work without refreshing an authentication token;
- remain available when a login session expires;
- be removed only by an explicit user or account-data action;
- identify its download date, data freshness, and package version.

Required package states:

- not downloaded;
- downloading;
- ready offline;
- update available;
- incomplete;
- removed.

## Offline package contents

The initial package should contain:

- route geometry;
- an offline map for the trail corridor;
- trail facts and dog-specific recommendation;
- warnings, water points, and relevant hazards;
- trailhead and parking coordinates;
- emergency and local safety information;
- the latest downloaded weather summary, labelled as a snapshot;
- download time, freshness information, and package version.

A GPX export should also be available to account holders.

## Pre-hike readiness

Before starting, DoloPaws should confirm:

- the trail is ready offline;
- GPS permission is granted;
- a usable location can be acquired;
- trail and weather information has been reviewed;
- the route package is current enough to use;
- emergency information is accessible.

The user should be offered an airplane-mode test before leaving.

## On-trail essentials

The first version should provide:

- current GPS position and accuracy;
- position relative to the route;
- distance completed and remaining;
- off-route distance and warning;
- upcoming water, hazard, and waypoint distances;
- a visible online or offline state;
- battery-conscious location updates;
- persistence after refresh, browser closure, or phone restart;
- pause and finish controls.

An off-route warning must consider GPS accuracy and say how far the route
appears to be, whether the reading is reliable, and when the last valid
position was obtained.

## Recovery requirements

| Failure | Required recovery |
| --- | --- |
| No dog profile | Continue with clearly unpersonalized facts |
| No suitable results | Explain restrictive filters and offer reset |
| Authentication failure | Preserve profile, trail, filters, and intended action |
| Interrupted download | Resume rather than restart |
| Insufficient storage | Show required space and removal options |
| Outdated package | Keep it usable while identifying stale information |
| No connectivity | Use the verified downloaded package |
| GPS denied | Explain permission recovery and keep the route visible |
| GPS inaccurate | Show accuracy and delay off-route conclusions |
| Browser closed | Restore the active hike |
| Report cannot upload | Queue it with a visible pending state |
| Low battery | Offer reduced tracking and screen usage |

## Account and contribution rules

Guests may:

- browse and search;
- create a temporary dog profile;
- receive personalized recommendations;
- compare trails;
- inspect safety information and sources.

Verified account holders may:

- save and download trails;
- synchronize profiles and bookmarks;
- maintain a walk journal;
- publish eligible ratings, reviews, photos, and hazard reports.

Authentication intent must survive login. A guest choosing "Download offline"
returns to the same trail and download action after creating an account.

## Moderation policy

Only authenticated users with a verified email or verified social identity may
publish community content.

| Contribution | Initial publication policy |
| --- | --- |
| Rating | Publish after automated checks; one rating per account per trail |
| Written review | First contribution may remain pending; trusted users may publish immediately |
| Hazard report | Show immediately as an unconfirmed community report |
| Photo | Hold new contributors' photos for moderation |
| Replies and comments | Deferred from the initial beta |

Content states:

```text
draft → pending → visible → reported → hidden → removed
```

"Verified" is reserved for evidence-backed DoloPaws or official checks.
A GPS-recorded contribution may say "Hike recorded with DoloPaws," but it is
not a verified review.

## Accepted product rules

1. Guests can evaluate and compare trails without an account.
2. Accounts are required to save, download, synchronize, or contribute.
3. Downloaded trails remain usable offline without re-authentication.
4. Save means bookmark; download means verified offline availability.
5. Active hikes survive refreshes and browser closure.
6. Offline reports are queued for later upload.
7. Unknown or stale information is never presented as safe.
8. Offline readiness and freshness remain visible during the hike.
9. The beta must pass an airplane-mode test on a real, low-risk trail.
10. Public contributions require a verified account and the appropriate
    moderation state.

