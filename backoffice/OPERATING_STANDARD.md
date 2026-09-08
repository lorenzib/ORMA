# ORMA Agentic Backoffice Operating Standard

Status: **current baseline**
Effective from: **1 September 2026**

This document is the normative product contract for ORMA's agentic backoffice.
The interface and automation will continue to evolve, but changes must preserve
these responsibilities and gates unless the CEO explicitly changes the model.

## Operating principles

1. Agents prepare and recommend. The CEO sees only work that needs a decision.
2. Work is reviewed once at the correct gate. A downstream team consumes an
   approved result and does not ask for the same decision again.
3. Unresolved review packets are preserved. Scheduled runs must not duplicate,
   silently replace, or reset work that is already waiting for review.
4. A revision request runs promptly. It never waits for the next weekly or
   fortnightly cycle.
5. Every public mutation has an explicit human gate. The result must state
   whether it was saved locally, committed, pushed, deployed, or blocked.
6. Failures remain visible and honest. An agent must not present a blocked or
   incomplete result as published work, and a source outage must not erase the
   last known public safety state.
7. The CEO dashboard is the operating overview. Detailed evidence and editing
   belong in separate, clearly named team desks.
8. A broken website build must not make every quarter-hour worker repeat the
   same publication attempt. Queue and agent work continue, but publication
   materialization is circuit-broken until the checked-out commit has a
   successful `Validate ORMA` result.

## Team ownership

### 1. Existing Trails

Owns trails that are already in ORMA and verifies:

- the GPS route used for navigation;
- claims about interest points;
- terrain and surface information;
- parking, access, and how to get there; and
- dynamic hazards that may affect a covered area.

Dynamic hazards run hourly and are fully automatic in both directions. A
source-backed severe, extreme, or dog-critical warning is added without review.
A warning is removed without review when a successfully fetched authoritative
feed stops listing it, or when its own stated expiry passes on a source that
answered. There is no human removal gate. Source failure or outage never removes
the last known warning, because an unreachable source is not evidence of safety.
Weather warnings are never presented as proof that a specific trail is closed.

Customer hazard reports are a separate, equally automatic lane. A signed-in
contributor reports a hazard on one trail; the Hazard Analyst searches for
independent corroboration in official notices, park and comune bulletins, alpine
club updates and local news, and decides without a human:

- corroborated by at least one retrieved source: published as a confirmed ORMA
  hazard carrying its citations, for at most thirty days;
- plausible but uncorroborated: published under an explicit "reported by a hiker
  and not yet confirmed" label, at moderate severity, for seven days. Most
  genuinely local hazards are never published online, so silence is not treated
  as evidence against the reporter;
- contradicted by a current authoritative source, spam, abuse, or not a hazard:
  never published.

A published community hazard re-checks itself daily and removes itself when its
corroboration lapses or its life ends. Raw reports are never public; only the
vetted hazard is. Community hazards follow this lifecycle alone and are never
reconciled against the weather feeds.

Existing Trails is the current throughput priority. Every day after the
Firestore quota reset window, the protected
catalogue campaign admits the next eligible candidates for ORMA Verified
review, subject to the shared capacity limit. The hosted worker checks
its durable specialist queue before general editorial, newsletter and
Analyst generation work. It may keep up to 15 trails in verification and run
up to ten specialist jobs per worker pass. This changes working capacity only:
all geometry, evidence, dossier, editorial and release gates remain required.

For every named or numbered official route, verification must identify the
recommended starting point and direction from an authoritative route source.
The approved geometry is oriented from that point, and the numbered trail
description follows the route in that order. A nearby parking pin is access
evidence only and must never be substituted for an authoritative route start.
When an official route is genuinely unnumbered, verification must provide an
ordered landmark sequence and useful turn instructions from the authoritative
route description instead. A statement that trail numbers are unavailable is
not publishable route guidance; if neither numbered nor landmark directions can
be established, the route-following claim remains unresolved.

A recorded route source is a claim like any other, and the identity check tests
it by asking whether the trail's own route lies on that relation. A trail that
walks part of a longer named route is properly sourced, and the difference in
length is the point of the trail rather than a fault in its source. Neither the
relation's name nor its length is evidence on its own: a relation may carry a
trail's exact name and share a quarter of its path.

A trail whose route leaves the recorded relation needs a route source that
covers the whole walk, exactly as if it had none. It is not queued for the same
check again, and it is never presented as a route awaiting geometry approval.
The verdict is recorded against the relation that was examined, so correcting
the source retires it.

Not every walk is one relation. A loop may go up one numbered path and back
another, and its source is then the ordered set of paths it follows. Those are
proposed by measuring which documented routes carry the walk, and a proposal is
evidence, never a decision: a composite becomes a route source only when a human
approves it at the geometry gate, and only while it covers the walk. The paths
are recorded in the order a reader meets them on the ground.

A route source must be at the scale of the walk. A long-distance route running
along a trail covers all of it at once, and reading guidance from it would send
a walker after a week-long traverse for an afternoon. Paths the walk
substantially occupies are proposed first, and a longer route through the area
answers only where nothing at that scale explains the route.

### 2. New Trails

Owns discovery before catalogue admission. It prioritises:

- plausible loop routes;
- animal-friendly evidence;
- candidates close to areas ORMA already covers; and
- coherent geographic expansion before unrelated new regions.

The active discovery phase is Dolomites-first. Scouting is paused during the
ORMA Verified backfill; existing candidates are preserved and
nothing is deleted. When resumed it refreshes Monday through Saturday, ranks
credible Dolomites candidates ahead of other regions, and preserves unresolved
candidates between refreshes.

CEO selection sends a candidate into the Existing Trails verification fleet.
Selection is not publication. A New Trail becomes an Existing Trail only after
the required evidence and human gates are complete.

### 3. Trail photos

Trail photos are sourced by hand, outside the backoffice, and committed directly
to the repository (`images/trails/` plus `data/trail-image-overrides.json`, whose
`imageCredit*` fields carry each picture's creator, licence and source). The
backoffice has no photo lane: there is no coverage audit, no candidate sourcing,
no owner-upload desk and no image review queue. The publication pipeline still
renders whatever photo the overrides name; it never gathers or replaces one.

OpenAI remains in use for trail verification and for scouting additional trails.

## CEO review and shipping contract

- The dashboard shows counts, progress, blocked work, and decisions across all
  six teams.
- Customer-facing ORMA navigation does not expose a backoffice link or an
  administrator sign-in flow. Production operators enter through the unlinked
  dedicated backoffice login and must hold the Firebase moderator claim.
- Customer pages only collect community photos, reviews, place observations
  and hazard reports. Their publish, hide, remove and restoration decisions
  live in the dedicated Community moderation desk, appear in the dashboard's
  human-decision count, and produce immutable audit receipts.
- Localhost remains an explicit development mode and does not require the
  production moderator login.
- Every queue has one clear purpose and one clearly named desk.
- Copy review presents a real current-versus-proposed page preview.
- The CEO may approve, edit and approve, request a revision, or reject/park when
  that action applies.
- Revision requests are processed immediately and return to the same desk.
- Approval must produce a visible receipt. For website copy, that receipt
  includes the commit and deployment state.
- No unrelated dirty workspace files may be included in an automated commit.
- Agent output must not bypass tests, source/licensing checks, or a required
  human gate.
- Before consuming an approved trail publication, the hosted
  worker checks the latest completed `Validate ORMA` run for its exact commit.
  A failed, cancelled, or missing result pauses only materialization and pull
  request creation. The approval stays saved, specialist queues continue, and
  Backoffice Home records `Publishing paused` with the validation-run link.
  The next scheduled worker pass resumes publication automatically after that
  exact commit is green.

## Current cadence

- Dynamic hazard check: every three hours at minute 7, Europe/Rome, clear of the
  queue worker. Successfully fetched authoritative feeds remove warnings that they
  affirmatively resolve or that have passed their own expiry; source outages
  retain the last known warning. Hazard conditions change slowly, so a three-hour
  cadence keeps the backoffice within the Firestore daily quota.
- Customer hazard vetting: inside every worker pass, at most three reports or
  re-checks per pass, published or rejected by the Hazard Analyst without a
  human gate.
- Existing Trails queue: checked by the hosted worker every three hours,
  with daily ORMA Verified intake at 09:30 local time and 15-trail capacity.
  The verification pipeline advances on this cadence without a per-batch prompt;
  a solo operator does not need quarter-hour batches, and the wider spacing keeps
  Firestore within its daily quota. Hazard freshness does not depend on this
  cadence; the hazard watch runs on its own three-hour schedule.
- New Trail scouting: paused for the duration of the ORMA Verified backfill.
  Each newly admitted trail opens a new verification gap faster than the backfill
  closes one, so intake stays paused until the lane reaches full coverage of the
  existing catalogue. Cadence when resumed: Monday through Saturday at 10:00 local
  time, Dolomites first; admission remains CEO-gated.
The Newsletter, Social, Analyst, Product Design and website-copy lanes are
retired. Their agents, desks, scheduled workflows and npm entry points are
removed from the repository. Firestore review collections and existing artifacts
are left untouched, so no decision history is lost, but nothing reads or writes
them. Reopening any of these lanes is a new, explicit build.

Hosted production workers use server-side credentials and must preserve these
contracts. The duplicate local desk server is retired; the hosted backoffice is
the single operator surface.

Trail review is consolidated into one desk. `trail-verify-desk.html` presents
every trail waiting on a human together with the question it is waiting on, and
carries the route, findings, description and publication decisions that the
Trail Verification Desk and the Verified Trail Content Desk carried separately.
Those two desks are retired: a trail's journey no longer spans several pages,
which is what "every queue has one clear purpose and one clearly named desk"
asks for. Their Firestore collections are left untouched, so no decision history
is lost.

The route-choice review is retired with them. Its queue artifact was written
only by seeding and reporting, its decisions were read by nothing outside the
browser client, and the module that would have applied them had tests and no
caller. The geometry gate the pipeline actually opens is `geometry-approval`,
which reaches the moderator through the dossier review queue.

## Declaring a route's shape

The geometry validator assumes a trail is a loop, so a route that legitimately
does not return to its start — a there-and-back, or a point-to-point — is
faulted `not-closed-loop` and cannot clear its gate. That judgement is a
moderator's to make, not an agent's, so it is recorded as a verification
override in `data/verified-trail-overrides.json` by

    npm run backoffice:route-shape -- --trail <id> --shape <shape> --note "<why>"

with a note of at least ten characters, which becomes the evidence for the
declaration. Only a moderator's own observation belongs in that note.

The desk cannot make this declaration itself: the override is a repository file,
and `backofficeReviews` accepts only content-review writes. Where a trail is
faulted for not closing, the Trail Verification Desk therefore composes the
command with the trail's id already filled in and offers it to be copied. It
writes nothing; running the command is what records the decision.

## Definition of done for future iterations

A backoffice change is not complete until:

1. its team owner and human gate are unambiguous;
2. the CEO can see the relevant progress or decision in the dashboard;
3. unresolved work survives refreshes and later scheduled runs;
4. approval, revision, failure, and publication states are truthful;
5. focused workflow tests and static-page checks pass; and
6. the implementation still conforms to this standard, or this document is
   deliberately updated as part of an explicitly approved operating change.
