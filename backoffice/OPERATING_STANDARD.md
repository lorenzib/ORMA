# ORMA Agentic Backoffice Operating Standard

Status: **current baseline**
Effective from: **1 September 2026**

This document is the normative product contract for ORMA's agentic backoffice.
The interface and automation will continue to evolve, but changes must preserve
these responsibilities and gates unless the CEO explicitly changes the model.

## Operating principles

1. Agents prepare and recommend. For trails already on the public site, the
   existing-catalogue evidence policy makes routine verification and publication
   decisions; the CEO sees exceptions and audit receipts, not a routine queue.
2. Work is reviewed once at the correct gate. A downstream team consumes an
   approved result and does not ask for the same decision again.
3. Unresolved review packets are preserved. Scheduled runs must not duplicate,
   silently replace, or reset work that is already waiting for review.
4. A revision request runs promptly. It never waits for the next weekly or
   fortnightly cycle.
5. Every public mutation has an explicit release gate. Existing-catalogue trail
   updates use the evidence policy plus the protected repository quality gate;
   other lanes retain their stated human gate. The result must state whether it
   was saved, committed, pushed, merged, deployed, or blocked.
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

A successfully fetched feed removes a warning only when it arrived **whole**. A
complete snapshot is the authoritative list of what is currently active, so
absence from it is removal evidence -- and that flag was set for any HTTP 200
whose body parsed, which means a truncated response, a partial transfer or a
document cut off mid-stream would have deleted every live warning for that
source without anyone seeing it. An Atom document that was cut short does not
carry its closing tag, so the feed must close before its silence counts; a
partial-content response is refused outright. A source that answered partially
may still **add** the warnings it carried, because those are real. What it may
not do is remove the ones it failed to mention. This is the same principle the
outage rule already states -- an unreachable source is not evidence of safety --
applied to a source that answered badly rather than not at all.

A verification gate that is standing only on findings an agent can supply is
sent to that agent rather than left on the desk. This is principle 1 applied to
a gate that was already open: nothing re-ran an agent on a trail parked at a
gate, so research nobody had done waited for a moderator who could not do it
either. It asks one agent at a time, the
one carrying the most outstanding findings, and tells it which other agents hold
the rest; a gate blocked on several agents is therefore cleared over successive
passes rather than in one. It fires only when the blockers name an agent at all
-- an unattributed blocker is a decision, not a dispatch -- and only when a
re-run could answer something. Where evidence was read and disagrees, the
agent has already given its answer: asking again returns the same
contradiction and spends one of five resolution attempts to learn nothing, so
that gate goes to the moderator with a recommendation instead. The exception is
a blocker no decision of hers can clear -- route guidance, which is supplied and
never accepted, and a geometry conflict, which has to be settled before
directions can be written -- and those reach an agent whatever their wording
looks like. It never fires past the
automated-resolution limit, never over a decision already waiting to be applied,
and at most a few gates per queue pass because each dispatch costs a model call. Setting the repository variable
`ORMA_GATE_DISPATCH_ENABLED` to `false` stops it without a code change.

For trails already published on ORMA, the remaining gates are policy decisions:

- clean, source-identified geometry is accepted automatically;
- verification requires a sourced recommended start and complete reader-usable
  route guidance: trail-number sequence and switch points, or a sourced landmark
  and turn sequence for a genuinely unnumbered route;
- every assigned optional claim is actively scouted through the full research
  ladder. An exhausted optional claim is accepted only as unknown and is omitted
  from publishable facts; it is never promoted from silence or a model guess;
- an exhausted critical geometry or route-guidance failure is rejected from
  ORMA Verified automatically and remains visible as an unverified exception;
- editorial copy is generated only from the locked supported facts and accepted
  after deterministic contract validation; the trail's existing licensed image
  is retained rather than reopening photo sourcing;
- a complete existing-trail update is materialised in a pull request, merged only
  after `Validate ORMA` passes, and deployed with a protected receipt.

This policy removes routine CEO intervention; it does not guarantee that every
route earns the badge. A trail whose route or navigation cannot be substantiated
stays on the site without an ORMA Verified claim until new evidence exists.
The existing-site campaign is bounded to catalogue records that already have a
publishable trail page and its card and hero artwork. Catalogue drafts remain in
the ordinary intake lane and are not silently published by this backfill.

What survives all of that is a decision, and some of those cannot be made from
a review card either: whether a trail can be verified despite nobody
establishing the livestock on it means reading a comune page or a pasture
notice. So an adjudicator reads those sources and writes what it found into the
field beside each blocker, with the publisher and a verbatim quote. It runs
after every automatic decision in the pass, so it only ever researches gates
that are genuinely a person's.

It recommends and never accepts. The tick stays the moderator's, because the
reason beside it is kept with the verification permanently and has to be a
person's sentence; a suggested reason can be replaced, and the replacement is
what is kept. A recommendation to accept is withheld unless it cites a source
that was actually retrieved, is never offered for a blocker the contract
refuses to waive, and stops being shown once the gate's blockers change,
because it then answers a different question. "Nobody could justify accepting
this" is shown as prominently as the other answer. `ORMA_GATE_ADJUDICATION_ENABLED`
set to `false` stops it.

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
all geometry, evidence, dossier, editorial and release checks remain required;
for the existing public catalogue they are applied by the evidence policy above.

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
proposed by measuring which documented routes carry the walk. For an existing
public trail, a composite becomes a route source only when the deterministic
coverage and evidence-policy checks accept it, and only while it covers the
walk. The paths are recorded in the order a reader meets them on the ground.

A route source must be at the scale of the walk. A long-distance route running
along a trail covers all of it at once, and reading guidance from it would send
a walker after a week-long traverse for an afternoon. Paths the walk
substantially occupies are proposed first, and a longer route through the area
answers only where nothing at that scale explains the route.

### 2. New Trails

Owns discovery before catalogue admission. It prioritises:

- plausible loop routes;
- animal-friendly evidence;
- valleys where ORMA is thin, measured against the catalogue rather than
  guessed at; and
- coherent geographic expansion before unrelated new regions.

The third of those used to read "candidates close to areas ORMA already
covers", and proximity turned out not to measure coverage. The ranking scored
`existing-area` -- within 30 km of a published trail -- highest and a valley
with nothing nearby lowest, and at ORMA's density almost everything in the
Dolomites is within 30 km of something. Measured on 2026-10-08, all four
awaiting candidates were tagged `existing-area` while sitting in four different
valleys, two of them thin and one with no ORMA trail at all: the tier had
nothing left to separate them but raw distance.

A twenty-eighth trail in Alta Pusteria adds less than a second trail in
Cortina, and only the valley count says so. So candidates are ordered by how
far their valley is below the depth the coverage report calls thin, taken from
that report's own threshold rather than a second copy of it. Region priority
still comes first, so coherent expansion continues to beat an unrelated new
region, and proximity remains a tiebreak rather than the signal. Where the
valley taxonomy cannot be read the order falls back exactly to what it was.

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
- The CEO may approve, edit and approve, request a revision, or reject/park in
  lanes that retain a human gate. Existing-catalogue verification is monitored
  through receipts and exceptions rather than routine decisions.
- Revision requests are processed immediately and return to the same desk.
- Approval must produce a visible receipt. For website copy, that receipt
  includes the commit and deployment state.
- No unrelated dirty workspace files may be included in an automated commit.
- Agent output must not bypass tests, source/licensing checks, or the release
  gate assigned to its lane.
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
- Verification drain: run by hand (`orma-verification-drain.yml`) when the
  queue is longer than the three-hourly cadence can clear. It repeats the
  worker's pass back to back under the worker's own lock, so it never runs
  beside a scheduled pass, and stops on the first of: two idle passes, the
  clock budget, or the Firestore read budget and write budget it was started
  with (defaults 20,000 reads and 8,000 writes, leaving the rest of the day's
  quota to the crons and the desk). Every pass is metered -- the store counts
  the documents it reads and writes -- and the ledger is written once, as the
  `verification-drain` artifact, so the cost of a pass is a measurement. The
  drain decides nothing the scheduled worker would not: it runs the same
  lanes with the same policy, and leaves publication (materialise, pull
  request, merge, deploy) to the scheduled worker that follows it.
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

The first-party product analytics lane is also retired. Its customer event
hooks, local queue, Firestore receiver, funnel desk and retention workflow are
removed. Existing `productEvents` records are left untouched as historical
data, but no customer or backoffice client can read or write that collection.
The identity-free `hikeEvents` counter is not product analytics: it remains
because it directly powers the public “dogs hiked this week” feature. Adding a
hosted analytics provider later is a separate, explicit product and privacy
decision.

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

The geometry validator reads a trail's declared shape and the source relation's
`roundtrip` tag, so a legitimate there-and-back or point-to-point route is not
faulted merely for remaining open. A moderator can still record a corrected
shape as a verification override in `data/verified-trail-overrides.json` by

    npm run backoffice:route-shape -- --trail <id> --shape <shape> --note "<why>"

with a note of at least ten characters, which becomes the evidence for the
declaration. Only a moderator's own observation belongs in that note.

The automated existing-trail lane never invents a shape to clear this check. If
neither the catalogue nor the route source establishes the shape and the line
fails its geometry contract, the trail remains unverified without opening a
routine CEO task. The command is retained as an exceptional correction tool.

## Route guidance is asked for, not only demanded

Every walk has a recommended direction, and the dossier gate refuses a trail
without one. The Logistics Agent is therefore asked for route guidance in the
same job that asks for parking and access, and a result that omits route
guidance has those claims recorded as unresolved rather than being thrown
away -- see "A claim the agent did not answer is unresolved, not a failure".
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

## Optional evidence is exhausted, not merely absent

An optional detail is non-blocking at the final evidence-policy gate; it is not optional
research. Every verification specialist actively scouts every claim it owns,
including parking operation, public transport, water, shade, surface, livestock,
temporary access and entity policies. The absence of a detail from the first
route page is never enough to call it unsubstantiated.

The initial pass and each automated resolution attempt follow the available
source ladder: reopen ORMA's recorded sources; search the current route operator,
municipality, park, regulator, transport or facility owner; inspect their linked
PDFs, GPX files, maps, geoportals and current notices; triangulate mapped
infrastructure and topographic data; then use credible local or specialist
secondary sources as leads or corroboration. Searches use the local-language
route and entity names, known variants and the exact claim being tested.

Only after the materially different resolution strategies are exhausted may a
claim be reported as source-exhausted. The result then records what was checked,
when it was checked, the strategies or queries that failed, any conflicting or
inapplicable evidence, and the exact authority contact, field observation or
measurement that could settle it. A current operational fact is dated; silence
is never converted into absence, permission or safety.

This persistence does not lower the evidence threshold. Agents never invent a
detail to complete a dossier. For an existing public trail, the evidence policy
accepts a genuinely unresolved optional claim as non-blocking with a recorded
reason; the claim remains unknown and publishes no unsupported fact.

A strategy that found nothing is followed promptly. The five attempts are paced
at 0, 0, 1, 1 and 6 hours, and that pacing is not failure handling: a model or
provider error reschedules the job on its own ladder and costs the claim none of
its five attempts. The delay between two deliberately different searches was
doing nothing else, and it was expensive. Until 2026-10-07 it read 0, 1, 6, 24
and 72 hours — 103 hours of waiting per claim that went the distance, on a trail
that cannot leave evidence-resolution until its slowest claim is terminal. That
is most of a trail's life spent waiting for the web to change its mind, and it
stopped the queue drain too: a third of the queue sat unclaimable, so repeated
passes found nothing, called the queue idle and stopped.

Six hours before the fifth attempt is kept deliberately. It is the one place a
delay can plausibly change an answer, because the last strategy is a final
targeted search rather than a new angle. Nothing about the evidence threshold
moves: five materially different strategies are still required, source-exhausted
still means what it said, and a claim is still never promoted from silence.

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

## A claim the agent did not answer is unresolved, not a failure

Two output contracts used to throw when a mandatory claim was absent: the four
route-guidance claims from the Logistics Agent, and the six scouting claims from
the Terrain & POI Analyst. A thrown result is a system failure, three of those
block the job permanently, and the trail loses that work for good.

An agent asked for six claims in one reply usually returns six and sometimes
returns four. Measured by forcing one trail (osm-1116675) through repeatedly on
2026-10-08: the first fix removed `water` from the omissions, the second named
all five categories explicitly and forbade one claim standing in for several,
and `water` came back anyway on the commit containing the second fix. Two
wording changes, neither reliable, because wording was never the cause. Roughly
a fifth of replies died and each death cost a life.

So a claim the agent did not return is recorded as **unresolved**. That is the
state the pipeline already holds for a question not yet settled, and the
resolution ladder exists to work five materially different strategies through
it. An omission becomes ordinary unfinished research instead of a fatal error
nobody can act on.

It asserts nothing and hides nothing: no sources, zero confidence, a rationale
naming the agent and saying plainly that this is not evidence there is nothing
to report, and a `<claim>-not-answered` blocker so it reaches the dossier gate
and the desk. It buys no trail a verification either -- the gate requires a
supported proposal with a named authority for every route-guidance claim, so an
unanswered one refuses verification exactly as the thrown result did.

An agent that returns **no claims at all** is a different thing: it did not omit
a claim, it failed to work. That stays fatal and keeps its retries, because
filling six unresolved claims there would report a job as done having answered
nothing.

## A route with no fountain must be able to say so

Measured on drain run 37831560802: **every one of the nine job failures was an
agent omitting a mandatory claim**, and seven of those were the Terrain & POI
Analyst. `water` was missing from all seven, `other-places` from six. No
provider error, no throttling -- the validator refused the result because a
required claim was simply not there, and a refused result spends one of the
job's three lives, so this was quietly killing work rather than just adding
noise.

The cause is the same one this document already records for a route with no
rifugio and for a walk that never changes path. The analyst is asked to return a
claim for water, huts, food and drink, other places and animals "even when the
honest result is unresolved" -- but a route with no fountain is not unresolved.
Nothing was left unestablished; there is nothing there. Asked to choose between
saying something false and saying nothing, the agent said nothing.

So "there is none on this route" is a finding. It is returned as a single
supported proposal whose value says so, citing the source that establishes it:
an official route description or facility list that enumerates what is there, or
a checked map layer. `VERIFICATION.md` already required exactly this for water --
a documented "no water on route, carry a full supply" state -- and the
instruction never offered it.

This does not loosen the rule that silence is never absence. Where no source
enumerates the category, the honest finding remains unresolved, and the claim is
still returned saying what was looked at. What is forbidden either way is
omitting the claim, because that is not an answer at all.

## A walk that never changes path must be able to say so

Route guidance asks four things, and they are not equally answerable. Measured
on 2026-10-08: `route-number-status` blocked nothing at all,
`route-number-sequence` blocked two trails, `recommended-start` blocked seven --
and every one of those seven failed as *conflicted*, sources found and
disagreeing, which the resolution ladder then cleared on four of them.
`route-number-switches` blocked eleven, and all eleven failed as *unresolved*:
nothing found, not once a disagreement. Research rescued two.

A claim that comes back empty every single time is a question with no answer to
find. On those same trails, from the same pages, the agent established whether
the route was numbered and in what order its paths ran. It had the route. What it
lacked was a way to describe a walk that follows one path from start to finish,
because the only instruction naming that answer forbade it.

So a route that keeps one reference throughout answers `route-number-switches`
by saying there are none and naming the reference it follows, cited to the
source that establishes it. That is a complete answer. `unresolved` is for a
route whose course could not be established at all, not for a simple route.

This is not the "not applicable" shortcut that unnumbered routes are still
refused, and it cannot become one. All four claims must be supported proposals
carrying a named authority and an https source before the gate opens, so "there
are no switches" is only ever accepted beside a sourced `route-number-sequence`
that establishes the order on its own evidence. What is gone is the pretence
that every walk has a junction.

A switch is located by the landmark a walker meets there -- the refuge, col,
junction or bridge the source names. A mapped coordinate and a distance from the
start are recorded when the source publishes them, and official route
descriptions usually do not; a switch that can be placed by landmark is never
withheld for want of a coordinate. Nothing in the dossier gate ever inspected
those fields, so demanding them bought no assurance and cost the trail its
verification.

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

1. its team owner and release gate are unambiguous;
2. the CEO can see the relevant progress or decision in the dashboard;
3. unresolved work survives refreshes and later scheduled runs;
4. approval, revision, failure, and publication states are truthful;
5. focused workflow tests and static-page checks pass; and
6. the implementation still conforms to this standard, or this document is
   deliberately updated as part of an explicitly approved operating change.
