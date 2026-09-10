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

A report may carry where on the trail it was seen. The reader places it on the
trail's own map; the tap is projected onto the route, and the distance along the
route that it lands at is the position that is stored. A point further than 250 m
from the route is not a position on it and is refused, and a report without a
position is published exactly as before -- placing is optional, and losing the
hazard would be worse than not knowing where it is.

Vetting decides whether a hazard is real, never where it was seen: the position
is carried from the report to the published hazard verbatim, and a partial or
out-of-range one is dropped rather than repaired into a plausible-looking point.

Where a report carries no position, the Hazard Analyst may establish one from the
report or from a source it retrieved, and the Terrain & POI Analyst locates the
hazards it verifies on a route. An agent supplies only the evidence for a
position -- a coordinate and the landmark that is there. The distance along the
route is measured from the trail's own path by the same projection a reader's tap
goes through, so a scouted km and a tapped km mean the same thing and neither is
an agent's arithmetic.

A coordinate that does not sit on the route is not a position on it: it is
discarded, and the claim records that it was, without blocking. A position is
decoration on a claim, and the dossier gate treats every claim blocker as
grounds to refuse verification; one stray coordinate must never veto a trail
whose evidence is otherwise sound. An agent is told
to return no position rather than infer one from the middle of a route, from the
trail head, or from the fact that the hazard is somewhere on the walk. A reporter
who placed their own pin outranks an agent's reading of their description.
Re-checking a published hazard never removes the position it already carries.

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
  cadence keeps the backoffice within the Firestore daily quota. The public
  snapshot the website reads (`data/dynamic-hazards.json`) is refreshed by an
  automatic pull request whenever the warning set changes: the run approves
  the pull request's own quality-gate run (the Actions bot never graduates
  from the first-time-contributor approval policy), merges once it passes,
  and then dispatches the website deploy itself, because nothing done with the
  workflow token starts another workflow. The page also hides any warning past
  its own expiry, so a missed refresh shows nothing rather than a stale warning.
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

## Route guidance is asked for, not only demanded

Every walk has a recommended direction, and the dossier gate refuses a trail
without one. The Logistics Agent is therefore asked for route guidance in the
same job that asks for parking and access, and its output is refused without it.
Those two contracts must not drift apart: asking only for parking while throwing
the result away for lacking directions produced parking-only dossiers on trails
whose start and sequence had already been written down.

The agent starts from what ORMA already recorded -- the stored start point, the
description that usually names the sequence in order, and the sources those came
from -- and confirms it against those sources rather than rediscovering the walk.
The record is a lead, never an authority: a claim cites the source it was
confirmed against, and a source that contradicts the record wins and says so.
Parking and the route are separate questions, and an unresolved parking picture
is never a reason to omit the directions.

## Two campaign budgets, and where a stopped trail goes

Admission to the pipeline is bounded by two separate budgets, because they
protect different things. The agent budget bounds trails under research; those
cost model credits and Firestore reads on every pass, and it is the one to keep
tight. The gate budget bounds trails parked awaiting a moderator; holding one
costs nothing, so it is far larger, and exists only so a backlog eventually
stops intake rather than growing past what the review queue artifact can hold.

Counting the two the same way stalled intake completely: on 2026-09-08 fifteen
trails filled a capacity of fifteen, five of them needing nothing but a
decision, while 145 trails could not enter. A state that neither list has met
counts against the agent budget, so an unrecognised state restricts admission
rather than silently freeing it.

A trail that exhausts its attempts is blocked. That is terminal by design and
frees its place immediately, which is what lets the rest of the queue keep
moving. It is not silent: the Trail Verification Desk lists every blocked trail
with the reason it stopped, below the queue, because a trail leaving the
pipeline without anyone seeing it is indistinguishable from one that was lost.
## A route with no rifugio must be able to say so

The Regulatory Ranger returns one entity policy claim per rifugio, lift and
protected area on a route. Ninety-two of the catalogue's 165 trails pass none at
all, and for those the only true answer is that there is nothing to report.

That answer is `rule: not-applicable` with no entity named. It is what the
schema offers and what the agent is asked for, and it requires neither an entity
nor a date a source was read, because there is no entity and no source to read.
It must not name an entity: a claim about nothing that names something is not
about nothing. Every other entity policy claim is held to the full contract --
a named entity, a rule from the published vocabulary, and the date its source
was read -- and a claim about nothing publishes nothing, because the operational
facts table has no entity to key it to.

Refusing that answer left no valid reply at all: naming no entity failed
validation and retired the job, while answering `unresolved` instead blocked the
dossier gate. A contract that no honest answer satisfies stops the pipeline just
as surely as a missing agent.

## Approval means every blocker was addressed, not that there were none

Five agents researching a mountain trail always leave loose ends, and a gate
that opens only when none remain never opens. A dossier is approvable when every
blocker has been addressed: cleared by the agents, or accepted by the moderator
with a reason of at least ten characters. The reason, the moderator and the
moment are kept in the verification record, and a trail verified with accepted
caveats says so.

An acceptance says the dossier can be verified. It never says the claim is true.
Each claim keeps the finding its specialist gave it in `humanAcceptedFinding`,
and the operational facts compiler publishes nothing whose accepted finding is
not a supported proposal. Accepting an unresolved dog-access claim accepts that
it is unresolved; it does not tell a reader the rifugio takes dogs. Cautions and
unknowns reach the reader unchanged, exactly as SCORING.md requires.

Route guidance is the one blocker no reason can wave through. Every other
blocker is background research a human can judge sufficient; route guidance is
content printed on the trail page for a walker to follow, so waiving it would
publish a walk with no directions. It is the agent's work, and it must be
supplied rather than excused.

## Some questions have no fixed answer

Whether cattle are on a summer pasture depends on the day you walk, and no
amount of research settles it in advance. A claim that says so is finished, not
failed: its finding is `varies`, and it names what a walker must check on the
day. It is not retried and it does not hold the trail at the dossier gate.

It is deliberately hard to reach, because "it varies" must never become the
easier way to say nothing was found:

- only livestock and seasonal restrictions may use it. A route start and a
  distance do not vary, and neither does tree cover or the existence of a
  fountain; those are features of the route, and conditions on the day -- a
  spring that is dry in August, snow on a col -- belong to the dynamic hazard
  lane, which already reports things that change;
- it cannot be given on the first pass. Only from the second resolution attempt,
  so it is a conclusion drawn from having looked;
- it must cite a source, and the source is evidence for the variability rather
  than for a value.

Verified means ORMA checked, not that everything is fixed. A trail may be
verified with a claim recorded as varying, and the reader is told what changes
and when to check rather than being given a false constant or an empty unknown.

A livestock claim answered `varies` is published as `livestockPresence:
'seasonal'`, the value the trail schema and the scoring engine already carry.
The reader is then told "Livestock graze this route in season" instead of
"whether livestock graze this route is unknown", and the penalty is applied at
the lighter seasonal weight rather than as though stock were there every day.
Without that mapping a verified trail declares livestock a reviewed category
while telling the reader it is unknown, and those cannot both be true.

Only `varies` is mapped. Turning a supported sentence into `likely` or `none`
would mean reading free text for a safety value, which is exactly how a
description that mentions cattle becomes a claim about grazing on the day
someone walks. What a claim varies with travels with it to the editorial
handoff, so the copy may say which months without any of it being inferred.

## Definition of done for future iterations

A backoffice change is not complete until:

1. its team owner and human gate are unambiguous;
2. the CEO can see the relevant progress or decision in the dashboard;
3. unresolved work survives refreshes and later scheduled runs;
4. approval, revision, failure, and publication states are truthful;
5. focused workflow tests and static-page checks pass; and
6. the implementation still conforms to this standard, or this document is
   deliberately updated as part of an explicitly approved operating change.
