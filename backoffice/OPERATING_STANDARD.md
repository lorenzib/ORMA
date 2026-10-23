# ORMA Agentic Backoffice Operating Standard

Status: **current baseline**
Effective from: **1 September 2026**

This document is the normative product contract for ORMA's agentic backoffice.
The interface and automation will continue to evolve, but changes must preserve
these responsibilities and gates unless the CEO explicitly changes the model.

## Operating principles

1. Agents prepare and recommend. Verification is decided by the evidence policy
   for every trail in the catalogue, published or not:
   there is no human verification gate, and the CEO sees exceptions and audit
   receipts rather than a queue of decisions. Publication of a trail that is not yet on the public
   site remains a separate lane with its own gate -- the policy settles whether
   a trail is verified, not whether it ships.
2. Work is reviewed once at the correct gate. A downstream team consumes an
   approved result and does not ask for the same decision again.
3. Unresolved review packets are preserved. Scheduled runs must not duplicate,
   silently replace, or reset work that is already waiting for review.
4. A revision request runs promptly. It never waits for the next weekly or
   fortnightly cycle.
5. Every public mutation has an explicit release gate. Catalogue trail
   verification and existing-catalogue updates use the evidence policy plus the
   protected repository quality gate; other lanes retain their stated human gate. The result must state whether it
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
feed stops listing it, when its own stated expiry passes on a source that
answered, or when it stated no expiry and no answering source has carried
it for seven days. That last rule is the backstop for a warning whose source
answers but never hands over a whole document: the first two rules cannot reach
it, and without the backstop it is published for ever. A warning that did state
an expiry is never removed early by it -- a source that published a validity
period is still publishing it. There is no human removal gate.
Source failure or outage never removes the last known warning, because an
unreachable source is not evidence of safety.
Weather warnings are never presented as proof that a specific trail is closed.

Nobody publishes trail closures as data for these regions, so a closure reaches
ORMA two ways and neither is a feed. A walker reports one, or the Closure Scout
goes looking: once per run it searches one area's comune, park,
forestry, protezione civile, alpine club and operator pages, and
files them as pending hazard reports. It publishes nothing. A scouted notice goes through the same
Hazard Analyst vetting as a walker's report, which searches independently for
corroboration, and the notice the scout found is evidence rather than its own
corroboration. A notice names the trails it affects by an id printed beside
them, and one naming anything else is discarded. A scouted notice is never
presented as a walker's sighting, and where an authority stated an end date that
date is the expiry, capped at the corroborated lifetime so a long closure is
renewed by re-vetting rather than trusted for a season. The scout is off unless
switched on, and the budget is areas per run, oldest first.

A walk whose only source is the OpenStreetMap relation its line came from
cannot be verified: the route claims need a source a reader can be shown, and a
relation records that a path exists rather than how to walk it. The Route Source
Scout searches the comune, park, tourism board, forestry service, alpine club
and operator for the page that describes one such walk, and nobody reviews what
it finds. The agent must quote the page; the run then fetches that page and
confirms the quote is on it, and only a find that passes is recorded. A find
whose page is gone, or whose quote is not in it, is dropped with the rule that
dropped it so a later pass can try a different page. Aggregators are refused in
the prompt and again in code. The pull request is the receipt and the quality
gate is the release gate, as it is for every catalogue trail update. The scout
runs only when dispatched, with a budget in trails per run.

Each authoritative source declares its own shape rather than all of them being
assumed to be one feed. A connector states the documents to try, how to parse
them, how to tell a whole body from a truncated one, and the months it publishes
at all. Four are registered: MeteoAlarm Italy and France, and the Tyrol/South
Tyrol/Trentino avalanche service for the provinces of Bolzano and Trento.

**Out of season is not a source failure.** An avalanche bulletin does not exist
in October, and reporting that every three hours would teach an operator to
ignore source failures, which is the one signal in this lane that must never
become noise. A source outside its window is not fetched, reports no error --
and is explicitly **not** a complete snapshot, because a source that published
nothing has not told anyone that last winter's warnings are over.

A dated bulletin is not a live feed. The day's edition is published in the
afternoon for the night ahead, so today's document is tried and then
yesterday's; only when both are missing, in season, is the source unavailable
and the last known warning retained.

An avalanche bulletin names its area by EAWS region code rather than in prose,
so it is matched to a trail on that code -- `IT-32-BZ` to Bolzano, `IT-32-TN` to
Trento -- and an unrecognised code matches no trail rather than every trail.
Only danger 4 and 5 are published: ORMA's trails are valley dog walks, not
backcountry ski terrain, so a moderate rating is not news for them and
publishing every bulletin would bury the warnings that matter. The level travels
in the severity and in the bulletin's own words, and the displayed sentence
still says it is not a trail-closure notice. The bulletin's own validity is the
warning's expiry, so the existing expiry rule removes it with no new removal
path.

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
contradiction and spends one of its resolution attempts to learn nothing, so
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
  lanes that retain a human gate. Trail verification is not one of them: it is
  monitored through receipts and exceptions rather than decided, for every
  catalogue trail rather than only the published ones. A geometry or dossier
  gate is settled by the evidence policy in the same worker pass that opens it.
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

## Nothing is searched for that the map says is not there

An optional claim gets three materially different web searches. Measured across
the catalogue on 14 October 2026, **111 of 225 such claims spent that ladder and
came back having found nothing** — roughly half the money spent on optional
detail bought the word "unknown".

Some of those were never answerable. ORMA measures the mapped water, huts and
bars along each walk from its own line, and a walk with no mapped water is one
the web is unlikely to find a fountain on. Paying three searches to confirm that
is three searches for nothing.

So a category the map was read for and found nothing of is recorded as settled
before any job is queued. Measured 17 October 2026: **281 of 489 category claims
across 163 trails, and 41 walks with nothing of any kind on them** — up to 843
searches that will not be made.

The record says what was done. "The mapped features along this walk were
measured and none of this kind is on it" is the same sentence shape an exhausted
ladder writes, so every consumer that recognises an exhausted claim recognises
this one, and a reader is told the map was read rather than left with silence.

**Only where the map was actually read.** A walk with no line, or a run with no
mapped features to read, settles nothing — not looking is not a finding, and
that distinction is the whole reason the measurement reports whether it ran.

**And only for what is optional.** The four route claims keep their full ladder
whatever the map holds: they decide whether a trail can be verified at all.

A mapped place is still not current availability. Where the map *does* show
water or a hut, the claim is researched exactly as before, because whether the
water is drinkable now and whether the hut is open this season still need a
source.

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
at 0, 0, 0, 0 and 6 hours, and that pacing is not failure handling: a model or
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
moves: source-exhausted still means what it said, and a claim is still never
promoted from silence.

The one-hour waits before the third and fourth attempts went on 14 October
2026. They paced two different angles on the same question -- a new search of
the same web -- and an hour does not change what that web holds. What they did
instead was hold a trail still, because a trail cannot leave
evidence-resolution until its slowest claim is terminal: each wait cost an hour
of the whole trail, not of one claim. Tre Cime sat at stage four of eight with
nothing wrong with it, waiting forty-three minutes for a search that could have
run at once. Optional detail stops at three attempts and so now waits not at
all.

### Optional detail stops at three

Route guidance keeps all five attempts. Optional detail stops at three.

The two are not the same kind of claim. Directions decide whether a trail can
be verified at all, so their ladder is worth its full length. Optional detail
is recorded `unknown` whether it runs out at three attempts or at five, and the
reader sees the same thing either way — but the evidence policy will not approve
a trail while any claim is still researchable. The cost of the last two
attempts is therefore not two searches. It is the trail.

Le Belvédère reached the dossier gate on 13 October 2026, the first trail ever
to get there, carrying 110 blockers and not one of them unwaivable. Nothing
about it needed a human or a decision. It was sent back to look again for
details that were going to be written down as unknown regardless.

Three is measured. Across the catalogue the ladder answered 55 claims on the
first attempt, 22 on the second, 14 on the third, 16 on the fourth and 7 on the
fifth. Stopping optional detail at three gives up 23 answers and saves 270
searches; what it buys is that a trail whose only outstanding work is optional
can reach approval.

The count is not written into the sentence other code reads. An exhausted claim
says `<n> automated resolution strategies exhausted`, and every consumer matches
the words rather than the number — because there are now two numbers, and a
consumer that had been matching the literal `five` would have quietly matched
nothing from the day this changed, leaving every such trail circulating for
ever.

### A settled verdict is not researched again

The research ladder is one layer. The gate is another, and it was asking the
same question fifteen more times.

When the evidence policy reaches a dossier gate it first rejects anything
standing on a missing direction. So a gate that is still open past that point
is held only by optional detail, and the verdict is already known: approve, and
record the rest as unknown. Every revision from there buys a thicker dossier,
never a different answer. It was five revisions per agent, three agents
reporting, plus five dispatches to the agent with the most blockers — fifteen
model calls, each one a specialist job with a web search, to arrive where the
first pass already stood.

A gate held only by optional detail now gets **one** dispatch and **one**
revision per agent. A gate held by route guidance keeps the full limit, because
that blocker decides whether the trail can be verified at all and is worth
every call. One look is kept rather than none: a first pass can genuinely miss
what a second finds.

Measured on the same trail, before and after: fifteen model calls to reach
approval, now three. A trail short of directions still costs five, and still
ends in a rejection the walker is better off with.

This is the cost of the catalogue, not of one walk. On 15 October 2026 a
twenty-dollar top-up bought about a trail and a half, and *Itinéraire
découverte de la nature* spent eleven passes before coming to rest with no seal
at all. ORMA promises a walker that a trail is real and that its terrain has
been read for a dog. It does not promise an exhaustive census of the car parks.

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

## A badge claims only what a specialist was asked

The published record asserted all eleven checks complete and all six safety
categories reviewed, unconditionally, on every trail. `water`, `heat`,
`exposure`, `livestock`, `surfaceHazards`, `access` — cited to the locked
dossier.

That was safe for exactly as long as nothing could be verified without five
specialists having researched it. It stopped being safe the moment a free
geometry survey could settle a trail's directions on its own: such a trail is
verified having asked none of those six, and the old record would have told a
walker ORMA had checked its water and its livestock. Somebody could take a dog
up a shadeless ridge in August on a badge that meant nothing.

**A dossier now records which of the six a specialist was asked about.** It
recorded findings and never recorded whether anybody looked, so absence of a
finding and absence of a look were the same shape — in the one place that
decides what a live trail page claims.

A category counts as researched where an agent returned a claim for it,
**whatever the finding**. Looking and failing to settle it is a real check, and
the page shows the reader `unknown` unchanged, exactly as SCORING.md requires.
The geometry survey is not a specialist: its claims are route guidance and
geometry, and it never asks about water.

The badge is derived from that mark rather than asserted. `verified.categories`
lists the researched ones; the graduation completes only those; and
`status: 'verified'` — the earned seal — needs all eleven. Short of that the
trail shows as **reviewed**, which is the honest thing for a walk whose route is
confirmed and whose safety facts nobody has asked about, and more than the rest
of the catalogue can show. It upgrades by itself: the next publication after
research lands derives a fuller list, so nothing has to remember to promote a
trail.

**A trail short of the full seal publishes as a reviewed one.** It was held
instead, because the override contract had no door for it: a full verification
carries the seal, and the scope that would carry a route-only publication
demanded cited sources with a `reviewedAt`, which a walk answered by the map and
by ORMA's own record does not have.

Holding it bought nothing. The badge already says reviewed, no safety category
is recorded so every caveat on the page stands, and the walk is already in the
catalogue — what was being withheld was its directions, its copy, its start
point and its photograph, which is the work the reader wanted.

So the `routeReviewed` scope carries it, under three conditions:

- it declares `ormaVerified: false`, so an unearned seal cannot reach the record
  through this door even by accident — and the full-trail door now refuses any
  entry that declares a scope at all, which it used to wave through;
- it carries the graduation, stating what it completed of the eleven, so the
  entry says what it is short of rather than being silently partial;
- its four directions name the rung that established each one.

That last condition is what the scope was missing. A walk whose start and
sequence ORMA established from the line it recorded and published has no
operator's page to cite and never will, so demanding a dated external source of
every scoped publication permanently excluded exactly the walks the record rung
exists for. What cannot be allowed is an empty source list meaning nothing in
particular — so an entry citing nothing has to state that every answer is
ORMA's own, and an entry whose answers rest on the map or on an agent's reading
still has to cite them, dated by `reviewedAt` or, for an OpenStreetMap relation,
by the relation's own timestamp.

**No publication may take a seal away.** The graduation upgrades itself as
research lands, so the only way a trail loses one is a republication from a
thinner dossier than the one that earned it — which would quietly unverify a
verified walk and leave nothing behind saying when or why. The materializer
refuses it.

**What still holds a publication is a missing answer**, not unpaid-for detail:
no mapping target, no structured fields, no route guidance. And the structured
fields are two groups, not thirteen requirements. The nine that describe the
walk — area, distance, elevation, hours, terrain type and rank, safety level,
water sources, start point — are required, and every catalogue record carries
all nine bar one trail with no usable start point. The other four — `paid`,
`shadeCoverage`, `heatRisk`, `exposure` — are safety and access attributes a
record only has once the matching category was researched, so between 33 and 39
trails of 163 have them. Requiring all thirteen together held 134 trails at the
mapping gate for not having had their heat researched: the safety gate again,
wearing a different name, one layer further down where the blocker did not say
so. A field the record does not have is now carried as absent, which is what it
is.

## Compaction may drop what is bulky, not what decides

`dossier-review-queue` is one Firestore property with a 1,024 KB ceiling, and a
waiting review keeps a summary of each specialist output rather than the record.
That is a size measure. It was also deciding verdicts.

Seven of the fourteen fields the gate reads off a specialist result were being
dropped: `routeGuidance`, `relation`, `routeNumbersAbsent`,
`routeNumbersUnmeasured`, `trailRecord`, `routeConformance` and
`claimContracts`. So a walk whose directions the map and ORMA's own record had
already answered was refused the moment its queue item was summarised — for
evidence that was never research in the first place, but a measurement the
cartographer had made and written down. Worse, a walk **measured and found to
carry no number** and a walk **nobody could measure** read identically once the
marks were gone, and those are the two cases the record rung exists to tell
apart.

Every one of those fields is small. `routeGuidance` is 47 bytes for an ordinary
walk, and its segments are written without their point lists for exactly this
reason. None of them is why the artifact once reached 960 KB; geometry and claim
evidence are, and those are still trimmed and still fetched from the output's own
document.

**Two lists both decide and can be long**: `openQuestions` and `blockers`. An
open question blocks a trail, so dropping it read as a trail with none — a
verdict changed in the permissive direction, which is the worse way for a gate
to be wrong. They are kept bounded: twelve entries, three hundred characters
each, and a tail saying how many more are in the full output.

Measured on the Tre Cime survey, the largest in the catalogue: the full output
is 20 KB, the summary was 2.4 KB and is now 3.4 KB. That is 308 waiting reviews
inside the ceiling instead of 442, against a catalogue of 163 trails — every
trail could wait at the gate at once and the artifact would still be under a
third full. A test holds that headroom, and another reads the gate's own source
for every field it takes off a result and fails on any that is neither kept nor
named as fetched through the pointer.

**A refusal says which problem it is.** A queue item keeps a summary and a
pointer to the full output, and `rehydrateReviewQueue` follows the pointer
before an approval. When it cannot — no pointer, or no artifact at the name —
the claims arrive without their sources and every one of them reports as
unsourced, which is indistinguishable from research nobody has done and points
at the wrong fix: send an agent out again, a model call, for evidence that may
be sitting in an artifact under a name that moved. The output now carries why
the detail is unreadable and the gate reports that as its own blocker. Not
finding an answer and not being able to read the answer back are different
problems, and they looked identical in the one place that decides a trail.

## One badge rule for the page and the app

The crawlable trail page and the app both answer "how well is this trail
established?", and they answered it differently.

`scripts/generate-trail-pages.js` granted **Verified by ORMA** once six safety
categories were reviewed, and had no label between that and *Imported trail*.
`trail-trust.js` has, since #616, granted the seal only on the full eleven-check
graduation. Measured across the catalogue on 18 October 2026 the two disagreed
about **22 live pages**: each showed a green Verified seal for a trail every
card in the app called *Reviewed*. With the publication lane open the
disagreement also ran the other way — a trail published through the reviewed
scope read *Imported trail* on its own page.

**Both now derive the badge from the evidence contract tier**, in the words
trail-trust.js prints, so the seal appears in both places or in neither, and a
reviewed trail is called reviewed. A reviewed trail takes the muted pill and no
icon, because the green tick is the seal. The page's footer line says the same
as its badge; it said "Verified by ORMA on <date>" for any curated trail
carrying a date.

The same rule holds for the caveats. The water and start-point sentences keyed
off **curation**, and curation is not a review: a trail published with its
directions established and its water never researched would have had its mapped
points titled *Water on trail* with the "availability can change" line removed,
and its start point printed with the raw "(OSM-verified access point)" wording
and no "check current access" line. They key off the category review now. The
prefix that strips "Start here" also lists the colon, which it did not, so a
start point that was not reviewed printed *Suggested start, Start here: parking
du lac* on seven pages.

These are two copies of one rule in two languages, and second copies drift. A
test compares them for every trail in the catalogue, label and pill and both
sentences, and checks the published pages for a seal the record has not earned.

## The directions reach the page, not only the app

ORMA establishes four answers about following a walk — where to start, what the
numbers are, the order they come in, and where they change — and they reached
only the app. The crawlable page, the one a search engine indexes and a reader
arrives on, said how far the walk was and nothing about how to walk it, while
the answers sat in the same record the page was built from.

**The page carries the same card now**, under the same heading, with the same
labels and the same sentences, and the same waymark shields in the same order
from the same module. It is the same card in a second renderer, and two
renderers of one card is how a page and an app come to say different things
about the same walk, so a test compares them for every trail that has guidance.

Three sentences or none. Half a set of directions is worse than none, because
the reader cannot tell which part is missing.

**The signage caveat is printed.** The `status` sentence says whether ORMA
confirmed how the numbers appear on local signs — the sentence a reader
standing at a junction needs — and the app was dropping it, so the card stated
a number sequence as though the signage were settled. Both print it when the
record carries one; the five walks published before the pipeline wrote that
field have none.

## An existing trail keeps the description it already has

A trail already on the site keeps its photograph. `preserve-existing` has said
so for a long time: no new image is sourced, no new licence is checked, the one
already credited on the page is carried forward.

Its words had no such rule. Every verification queued a copywriter, so
**establishing a walk's directions cost a model call to rewrite a description
that already existed, was already approved, and is on the live page as you read
this.** All 163 catalogue trails have a name, a description and practical
notes. Across the catalogue that is 163 model calls to produce what is already
there.

The description is not what a verification establishes. The directions are, and
since they have their own section on the page they are not in the description
at all. So an existing trail's copy is **carried unchanged**, and the item says
`copyPolicy: 'preserve-existing'` rather than claiming the words were newly
written or newly reviewed.

Three conditions, each of them a line that must not be crossed:

- **All three fields or none.** A record missing a name, a description or its
  practical notes cannot supply the copy, and that trail gets a copywriter as
  before. Not having the copy and not asking for it must not look the same.
- **Only a trail already on the site.** A new trail has nothing to keep, and
  the asset policy already draws that same line.
- **A copywriter that did run still wins.** This is about not paying for words
  nobody needed, not about refusing words somebody wrote.

No human gate is lost. The `editorial-evidence-policy` gate checks that new
copy matches the locked facts, keeps its caveats and sounds like ORMA — and
where no copy is written there is nothing for it to check, so the gate is not
raised. For a trail on the site that gate was in any case being approved
automatically by policy, so what this removes is a model call and the rubber
stamp on its output, not a judgement anybody was making. The publication itself
still goes through `automated-existing-trail-publication-policy`, unchanged.

The decision is recorded where the job is queued and read where the fields are
published, rather than worked out twice, so the copywriter that ran and the
description that reaches the page cannot disagree about which is which.

**With this, the whole lane runs on no model calls at all** for a trail already
in the catalogue: a free survey establishes the directions, the gate answers
from the map and from ORMA's own record, the photograph and the words are the
ones already there, and what reaches the page is the directions and a badge
that says reviewed.

## A photograph says who took it and under what terms

A credit line says where a picture came from. It does not say that anyone may
use it.

`existingImageFields` asked for a picture, a hero image, alt text and a credit
line. On 20 October 2026, sixteen Savoy walks were found showing a photograph
credited to a tourism board or a commercial site — "Decathlon Outdoor
(edited)", "Lac Annecy Tourisme fiche (Apidae)", "altituderando.com (edited)" —
with **no licence, creator or terms recorded anywhere**: not on the trail, not
in the image overrides, not in the provenance module.

They had been uploaded by hand in July with a credit and a source link, and
nothing since had asked the next question. The gap only surfaced because 23
trails could not reach the full badge for want of a photograph, and seventeen
of them turned out to have one already.

**The record now has to say who took the picture and under what licence.**
Every one of the 140 trails that already had a complete record carried both, so
this refuses nothing that was passing; what it stops is a photograph being
promoted to the trail's own on the strength of a credit line.

**An AI illustration is not a photograph.** Two walks carry one, labelled as
such on the page, and they must not satisfy a check that says this trail has a
photograph of it. They are recorded as ORMA's own, `ai-illustration`, and
excluded.

Five of the seventeen turned out to carry their licence in the credit text all
along — Wikimedia Commons, CC BY 2.0 and CC BY-SA. Each was **verified against
its source page** before being recorded, which corrected one of them: the
credit said "CC BY-SA" with no version and the file is CC BY-SA 4.0. Their alt
text was written from looking at the cropped image, not from the trail's name.

Ten are still unestablished. `npm run audit:trail-photos` lists every trail's
picture by what the record can say about it, so this is a question anybody can
ask again rather than one that had to be stumbled on.

## A photograph nobody is sourcing is not a pending approval

`asset-and-licensing-approval` exists to check a photograph somebody sourced:
its preview, its creator, its licence, its credit, its alt text. A trail
already on the site keeps the one it has instead, and no visualDirector job is
queued for it — the backoffice photo lane was removed in September 2026 because
images are sourced by hand and committed directly.

Those two rules met in a deadlock. A trail on the site whose image record is
**incomplete** — a thumbnail but no hero image, or no alt text — retained
nothing, so publication waited on an approval that only a job nobody queues
could ever give. Measured across the catalogue: **23 of 163 trails**, their
directions held off the page for want of a photograph nobody was looking for,
and no report anywhere saying so.

A trail with no complete photograph **publishes without image fields**. It
keeps whatever it already shows, because an override writes only the fields it
names; the publication claims nothing about the image; and `graduationFor` is
told there is no photograph, so the badge counts four of the eleven instead of
five. Understating is the safe direction — a bare thumbnail with no alt text
and no credit is not the check the seal means.

A trail that is **not** on the site still needs an image sourced, licensed and
approved. Nothing here changes that.

With this and the retained description, **162 of the catalogue's 163 trails run
the whole lane on no model calls**: survey, gate, publication, page. The one
that does not is Val di Funes Panorama Trail, which has no recommended start —
the import anchors a start to a mapped access point within 400 m of the line
and that walk has none, so there is nothing to recommend. It needs a sourced
start point through the `startPoint` override scope, which is the one piece of
human research the catalogue still owes.

A test runs every trail in the catalogue through the whole chain and holds all
of it: the count, that nothing queued a job, that every entry comes through the
reviewed door unsealed, that each carries its own words and its directions, and
that a trail without a photograph neither claims one nor writes image fields.
It is what found the deadlock.

## An imported walk's official line

An imported trail's line is the OpenStreetMap relation as its mappers left it.
Sometimes that is not the walk the operator signs: Seeweg in Ulten carried an
old upper path and a 3.3 km loop on the far side of the dam, 11.7 km against
an official 7.7. Nothing in the pipeline can correct that, because the line
lives in a generated file the promoter rewrites.

The `routeLine` override scope corrects it. A human rebuilds the walk on OSM
ways along the operator's own route (the official GPX is a guide, never the
line itself, because its licence is rarely stated) and records the result in
`data/verified-trail-overrides.json`. The entry:

- carries the line (`path`) and the distance measured on it, and may carry
  only the numbers that follow from the line: ascent, time, profile, the
  start coordinates and its shape;
- states where the line came from in `routeLineNote`;
- cites at least one dated `https` source.

It claims nothing else. It does not seal the trail, and a verification of the
other checks is recorded the usual way. Both the page builder and the runtime
data read the ledger, so the line a reader sees on the page and on the map is
the same one.

## A walk verified by hand is changed by hand

A publication the evidence policy approves may add to what a trail has
established; it may not take it away. The seal check guarded only the
ledger's own `ormaVerified` field, but a hand verification records its seal in
`trail-audits.js` and its official line in a `routeLine` entry, and a pipeline
publication replaces the trail's ledger entry wholesale. On 23 October one
would have put St. Magdalena back on its old 1.6 km line and taken its
Verified badge off.

So the publisher now **refuses** a publication for a trail that is verified by
hand (`tier: 'route-audited'`, graduation `verified`) or that carries a
`routeLine` entry, with the reason `verified-by-hand` or `line-set-by-hand`.
Like a disagreeing distance it is refused, not thrown: the rest of the batch
still publishes. Changing such a trail is a human edit.

## The funnel reaches the page

The verification funnel stopped at `ready-for-editorial`. That was honest for a
long time: no trail had ever gone further, and everything past it was theory.

It is not theory now. A verified walk goes on to an editorial queue, to
publication staging, to an approved publication request, and into the override
file the site is built from — **four more places a trail can stop, none of them
reported.** The deadlock found on 18 October was exactly that shape: 23 trails
waiting on an approval nothing could ever give, in a state whose name reads as
patience, with nothing anywhere saying so.

The funnel now follows a trail past the gate and reports, for each stage, how
many are there and how many are held — and **names what holds them**, because a
trail held here has already been verified and whatever stops it is standing
between finished work and a reader.

Two counts, kept apart on purpose:

- **what this lane published** — an override entry carrying the `approvalId`
  the materializer stamps on everything it writes;
- **what carries directions on its page** — any entry whose fields hold route
  guidance, including the two walks given it by hand before the lane existed.

Folding those together overstated the lane by eight on the day this was
written: eleven entries in the override file, three publications. The rest are
hand-written corrections — a declared route shape, a sourced start point — and
calling them publications would have reported a pipeline that had run when it
had not.

And when nothing is published and nothing is held, the report says so in those
words. A lane that never ran and a lane with nothing to do produce the same
silence, and both read as success.

## A scouted walk becomes a record the catalogue holds

The scouting lane had no exit. A selected candidate lived only in Firestore —
an id, a name, an OSM relation and an empty path — and publication restates
nine fields from a catalogue record it had not got, so the walk was verified,
had its research and its copy paid for, reached the mapping gate and stopped
there for ever. The section below holds such a candidate at intake rather than
admitting it. This is the step that lets it in.

`scripts/import-scouted-trail.js` adds **one feature** to the region's route
file and changes nothing else. `npm run promote:trails` then derives the record
the way it does for every other trail — distance and gain from the line,
terrain from the surface tags, water and rifugi from the mapped points, the
start from the nearest access point within 400 m — so an imported walk is the
same kind of record as the 163 already there, and the generated-artifact check
holds it to that.

Proved on a copy of the whole tree: a relation imported this way promoted to a
record with all nine fields — area, 6 km, 431 m of gain, Naismith hours, the
terrain from its surface tags, a rating from the computed grade, a mapped water
point, and a start anchored to a parking 9 m from the route — passed
publication validation, and got a page.

**The discovery pass's screening runs first.** A walk reached this way has not
been through phase 1, and importing one the region sweep would have refused is
how a via ferrata ends up on a dog-walking site. The relation's own tags go
through `evaluateRelation`; its member ways go through `hardWayForDogs`, which
is the same rule the sweep asks Overpass for as six set expressions. Two
readings of one rule, so a test reads the query out of the source and puts
every condition in it to the predicate. Dogs are the reason the rule exists.

Three things it will not do:

- **Re-import a walk already on file.** That would rewrite a line the
  catalogue rests on, which is what the targeted geometry refresh is for.
- **Write anything on a refusal**, or on a relation OpenStreetMap does not
  return.
- **Insert.** The feature is appended, because the promoter reads the file in
  order and writes the catalogue in that order, so inserting would move every
  trail after it in a file the generated-artifact check compares byte for byte.

Dry run by default, and the intake hold now names the command that clears it.

## A walk the catalogue does not hold cannot be published

A scouted walk exists only in Firestore. `candidateToTrail` builds it from the
scouting packet — an id, a name, an OSM relation, `path: []` — writes it to the
`new-trail-intake` artifact, and nothing ever writes it into `data/`.

Publication restates nine fields from the catalogue record: how far, how long,
what ground, where it starts, what water is on it. Such a walk has no record,
so there is nothing to restate and it stops at the mapping gate. For ever: the
hand-typed table that could supply those fields has three entries, all of them
trails already published.

**It stopped there having been paid for.** The cartographer is free, but the
research agents, the copywriter and the visual director are not, and every one
of them runs before anything notices the walk can never reach a page. That is
the wall the scouting lane would hit on trail 164, once for every trail it
found.

Two things follow, and neither of them is the missing import — that is a
separate piece of work, and the right one.

**The blocker says which problem it is.** `structured-website-fields` reads as
a record missing some of its fields, and sends somebody to look for fields on a
record that does not exist. A walk the catalogue does not hold now reports
`trail-not-in-the-catalogue`. And a target is only called `update-existing`
where something exists to update; calling a walk that is not in the catalogue
an update was a claim about the site that was simply untrue, and it travelled
on the staging item.

**A candidate the catalogue does not hold is kept back, not admitted.** It is
named on the intake artifact with its reason, and the reason travels on the
review outcome, so a review that queued nothing does not read like a review
that queued work. Nothing is dropped and nothing is charged; it waits for the
import that would give it a record.

A caller that passes no catalogue is not saying the catalogue is empty, so the
intake admits as it always did — a missing argument must not become a silent
stop.

## The promoted catalogue is checked like every other generated file

`osm-trails-data.js` says "AUTO-GENERATED by scripts/promote-osm-trails.js, do
not edit by hand" and nothing checked that it was. It had gone stale.
Regenerating it from the committed inputs changed **55 of 91 Dolomites trails
and 34 of 36 Savoy ones** — no trail added, none removed, but:

- **32 trails were missing route numbers the map already had.** Those numbers
  are what the map rung answers `route-number-sequence` and
  `route-number-switches` with, so those walks were going through verification
  without the thing that answers half their unwaivable claims.
- Many had the wrong elevation or no elevation profile, one was wrong about its
  distance by 1.6 km, and several were held out of publication by geometry that
  had since been rebuilt.

Everything downstream regenerated faithfully from the stale file and the
generated-artifact check passed, because the check started below it.

**Why it had been left stale: regenerating it switched the route sourcing off.**
`applyRouteNumberEvidence` returns early on a trail that already declares a
`routeNumberStatus` — written for a status somebody declared by hand. The
promoter writes `mapped-relation-ref` or `not-listed-in-mapped-source` on every
imported trail, straight off the relation's tags, and the early return treated
the two alike. So 29 trails lost a real authority — the SAT, the Comune di
Lozzo di Cadore — and fell back to citing the Waymarked Trails relation, which
the route claims cannot be made from. A second return, one line down, did the
same for a trail that already carried a number: the exact fault the comment
beneath it describes and was written to fix, placed one line too late to catch
its own case.

With both corrected, regeneration costs nothing and gains: **route-source-ready
goes from 78 trails to 86**, no trail loses its authority, and none cites a map
where it could cite a publisher.

The promoter runs in the check with `ORMA_PROMOTE_OFFLINE=true`. Ground height
does not change, so the committed elevation cache answers every point and
nothing is fetched; a point it has not got is an error naming the fix, rather
than a request to a server a check should not need. Two consecutive runs of
each region are byte-identical, which is what makes this safe to check at all.

**And a description says the number the way a reader says it.** The article
keyed off whether the walk was a loop — "A 2.2 km loop", "An 1.5 km route" —
which has nothing to do with it, and 43 of the imported descriptions read
wrongly on live pages.

## The pass builds publication staging, not the decision loop

`publication-staging` was written in one place: inside the loop that applies an
editorial decision. That held for as long as every verified trail queued a
copywriter, because there was always a decision to apply and staging was
rebuilt as a side effect of applying it.

A trail already on the site keeps its own description now. So no copywriter is
queued, so there is no decision, so nothing rebuilt its staging — and
`automatePublicationReviews`, which reads that artifact, never saw the trail.
**The walk was verified, its handoff was written, and it stopped there: nothing
queued, nothing failing, and nothing saying so.**

Every test of this chain called `buildPublicationStaging` directly, so none of
them could see it. The break was in the wiring, not in any of the parts.

The pass builds it now, from the three artifacts that describe the lane, before
the publication policy reads it. Three reads and, when the items have changed,
one write; unchanged, it writes nothing, because the pass runs every half hour
against a free-tier quota. `generatedAt` moves on every build, so the
comparison is on the items rather than the whole artifact — otherwise it would
write every pass and report a change each time.

The decision loop still writes its own, with the values it has just computed,
atomically with the decision. What changed is that it is no longer the only
thing that does.

## A re-survey can be asked for by the record, not by hand

The geometry survey is free: the surveyor reads OpenStreetMap and measures, and
spends no model credit. That makes it the one thing that can move a trail while
the credits are out — and on 19 October 2026 they were, with every job the
campaign attempted refused for no credits remaining.

It could only be asked for by naming trails. A list typed out of a report is
wrong the next morning, and the trails that need one are not the ones a person
remembers: they are the ones whose survey was taken before the surveyor learned
to record what it found.

A survey taken since 15 October carries one of three marks, and **which one it
carries is the answer**: `routeGuidance` names the numbered routes along the
walk and their order, `routeNumbersAbsent` says somebody measured and there are
none, `routeNumbersUnmeasured` says the measurement could not be taken. An
older survey carries none of them — and a walk with none cannot be told from a
walk measured and found to carry nothing, which is the one distinction that
answers `route-number-sequence` and `route-number-switches` from ORMA's own
record without paying an agent.

So `--stale` asks the record. It lists what it found before queueing anything,
it is a dry run until `--apply`, and the same question is a checkbox on the
requeue workflow for anybody without a terminal.

Three rules it keeps:

- **A mark that is present and false still says somebody looked.** Measured and
  found none is recorded as a value; absent is not the same thing, and a falsy
  check would read them alike.
- **A walk nobody has surveyed is not called stale.** It has never been past
  the cartographer, so a survey is already owed and a second would be two
  audits of one line.
- **The trail does not move.** Only its survey is taken again, and every reader
  already takes the newest; research already paid for is untouched.

## The capacity has to reach the command that admits

The intake budget was raised to 60 on 18 October. The campaign admitted nobody
on the 18th, and nobody on the 19th. Three layers, each of which alone was
enough:

```
ORMA_CAMPAIGN_CAPACITY: 60      set, logged, read by nothing in this workflow
CAMPAIGN_CAPACITY: '15'         what the command actually passed
--capacity must be 1..25        what the command would have refused
```

The run printed the first two one line apart and reported success. "Queued 0
new Cartographer job(s)" is what a closed queue looks like, and it is also what
a working queue with nothing to admit looks like.

The invariant written after the first failure checked that
`vars.ORMA_CAMPAIGN_CAPACITY` appeared in both workflows. It did. **A name that
is set and not used reads exactly like a number that does not work**, and
checking that a name is present is not checking that it is used.

So: one name, passed where it is read, with no second copy beside it to be
passed instead. The invariant asserts the command line, asserts the absence of
the duplicates, and asserts that every capacity the workflow can hand over is
one the command would accept.

And the two numbers are separated. `--limit` is how many trails one pass may
admit — a batch, deliberately small. `--capacity` is how many trails may be in
flight at once — the fleet, and a much larger number. They shared a ceiling of
25, so 60 could not have been accepted even after the workflow passed it. The
guard remains, set above anything the catalogue can hold.

## Free work goes first

A pass orders its queue so the trails that can actually be verified are
researched first. That rule exists to stop the model budget going on trails
that cannot pass, and it is right about paid work.

**It has no business ordering work that costs nothing.** The geometry survey is
deterministic — it reads OpenStreetMap and measures, no model call — and it was
being ranked by the same rule, because a free survey job carries the same
unverifiable trail as a paid research job for it.

That produced a circle. A trail with no published source ranks last. Its survey
is the free job that would answer its directions from the map and make it
verifiable. And the survey never ran, because it sat behind every paid job in the
queue and a pass takes ten. Six surveys were queued by hand on 16 October 2026
and not one of them ran until each trail was scoped to its own pass. We would not
survey it because it had no directions, and it had no directions because we
would not survey it.

Free first, then the verifiable-first rule among the rest, then the queue's own
order. One list says which agents are free, and the branch that runs a job reads
the same list, so the two cannot disagree about what is free.

A pass can therefore spend itself entirely on free work. That is the right way
round: every such job makes a trail verifiable for nothing, and there is at most
one survey per trail, so the group drains. Research already in flight waits
behind it for a pass or two rather than for ever.

## A seal does not wait for optional detail

The four route claims are the only unwaivable ones, and since the map and
ORMA's own record learned to answer them, a trail can have all four settled from
its **geometry survey alone** — which is free, deterministic and needs no model.
Measured 15 October 2026: **152 of the catalogue's 162 trails** hold everything
those four need.

Everything an agent researches beyond them is optional, and the evidence policy
accepts it as unknown once research runs out. A trail in that position is not
waiting to find out whether it can be verified. It is waiting to find out how
full its page will be — and the seal was queued behind that.

It cost the catalogue its throughput. Eight stages and about eight jobs a trail,
three worker passes a day: four trails a day, **forty days for 162 and three
months for a thousand**. Five of those jobs are model calls producing detail
that half the time comes back unknown. On 16 October they could not run at all,
because the credits had gone, while seven trails they were blocking needed
nothing from them.

So where a survey has settled all four directions and no agent has yet spoken,
the trail goes to the dossier gate on what it has.

**What the seal says, stated plainly.** It says the line is real and the
directions are right. It does not say every café on the route has been found.
That was always what the contract encoded — those four are unwaivable and
everything else is explicitly waivable — but the queue made the seal wait for
the waivable part, so in practice it promised more than it said. It now promises
exactly what it says.

**Only where no agent has spoken at all.** A trail already part-way through
research keeps its research; overtaking it would throw away work already paid
for. And a trail whose directions are not settled waits for the agents exactly
as it always did.

Research is deferred, not cancelled. A sealed trail's page is filled in by the
agents afterwards, at whatever rate credits allow, by the safety-research lane
below.

## A reviewed trail is sent back for its safety research

> **Status: approved 22 October 2026, with all three decisions below as
> drafted, and built in `backoffice/workflows/safety-research-lane.js`.**

The fast lane takes a trail to the gate on its geometry survey alone, and
nothing ever sends it to the specialists afterwards. Measured 21 October 2026:
**eleven trails** stand at ready-for-editorial on the survey alone, seven of
them already published as *Reviewed by ORMA*, every one at **5 of 11** checks —
route, numbers, map points, elevation, photo — and **none of the six safety
checks**. Nothing in the pipeline can move them further. The seal they cannot
reach is the one that tells a walker ORMA has looked at water, heat, exposure,
livestock, surface hazards and access.

The first two trails to graduate (Rundweg Laugen Elvas, Anello del Sole, both
21 October) got there by hand, through `trail-audits.js`, outside the pipeline.
That does not scale; this lane is the pipeline doing the same work.

**Who enters.** A catalogue trail whose directions are settled and published —
`verificationScope: routeReviewed`, `ormaVerified: false` — and whose dossier
records fewer than six researched safety categories. Trails with a live page
first, then the oldest-sealed. A trail still in the route pipeline never enters:
it gets its specialists there.

**What is asked.** Only the two specialists the fast lane skipped, and only the
safety questions:

- `regulatoryRanger` — `dog-access`, `leash-rules`, `seasonal-restrictions`
  (plus `rifugio-dog-policy` / `lift-dog-policy` only where the record names a
  rifugio or a lift on the route);
- `terrainPoi` — `water`, `shade`, `surface`, `exposure`, `livestock`, `animals`.

Logistics and the cartographer are not asked again: the directions are settled
and this lane must never reopen them. Every source ladder and evidence rule the
specialists already follow applies unchanged — current official authorities
first, every jurisdiction the line crosses, never silence as absence.

**What it may change.** Only the six safety categories and the page detail
derived from them. The research recompiles the dossier; `researchedSafetyCategories`
records what was asked (by claim category, PR #916); `graduationFor` derives the
graduation; publication goes through the existing `routeReviewed` →
full-verification path and its pull request. When all six are researched the
trail earns the seal; short of that it stays reviewed with a fuller page. **No
publication may take a seal away** applies unchanged, and this lane cannot touch
route guidance, geometry or the directions on the page.

**Budget.** Its own budget, separate from the agent budget for trails under
route research, so it can never starve the route lane and the route lane never
starves it: **at most two trails a pass** (two specialist calls each, plus any
resolution attempts the ladder already allows), switched by
`ORMA_SAFETY_RESEARCH_ENABLED` with the same kill-switch shape as gate dispatch.
Free work still goes first. A job refused for no credits is a provider outage
(`provider-outage.js`): it is requeued, as in every lane, never counted as
research, and `worker-productivity.js` reports the run as having done no work.
A trail is researched only by a specialist that answered.

**Measured, not estimated.** The first ten trails through the lane are the
measurement: model calls and Firestore reads per trail, from the drain ledger
and job records, recorded here before the per-pass limit is raised.

### How it is built

- **Finding the work costs no read.** The lane reads the published overrides the
  checkout already holds: a `routeReviewed` entry whose graduation is short of a
  safety check names a trail; the orchestration record says whether it is
  settled (`ready-for-editorial`, ORMA-verified) and whether this contract has
  already sent it (`safetyResearch.contract`), so a trail is sent once per
  contract and never loops.
- **Sending it back** puts the trail in `evidence-research` at stage
  `safety-research` with two jobs marked `lane: safety-research`. The runner
  adds the lane's instruction to the specialist's developer prompt.
- **Returning it** waits for both specialists to answer *since it was sent
  back* — an older Ranger answer never stands in — passes through the existing
  resolution ladder if a claim is open, and then opens the dossier gate with
  the survey and the new answers (stage `safety-research-dossier`). The
  Librarian and the red team are not asked. The evidence policy decides the
  gate as it decides every other.
- **Held from the seal, saying why.** A graduation that completes all eleven
  but is held back carries `heldFor` (`access-unanswered`,
  `livestock-unanswered`, `dogs-not-accepted`), and the override contract
  accepts a reviewed publication that is complete only when it says what holds
  it.
- **A withdrawn walk is a draft.** The publication carries `withdrawal`; the
  trail adapter reads it as an exclusion reason, so the walk leaves the site by
  the path every held trail takes. Lifting it is a human edit to the override.
- **The trail board** flags *Off the site* and *Hand audit*, and lists the
  address of each document nobody could read.
- **Switch:** `ORMA_SAFETY_RESEARCH_ENABLED` (repository variable, on unless
  `'false'`), `ORMA_SAFETY_RESEARCH_LIMIT` two a pass, in the worker and the
  drain alike.

### Decisions, approved 22 October 2026

1. **Does "looked, could not settle it" earn the seal for access?** Under the
   rule in *A badge claims only what a specialist was asked*, a category counts
   as researched whatever the finding — so a trail whose Ranger found no dog
   rule anywhere would be sealed with access shown as unknown. Proposed:
   **access and livestock need a settled finding** (supported, or `varies` with
   what it varies with) for the seal; the other four keep the
   whatever-the-finding rule. Both hand-graduated trails had settled answers.
2. **A finding that dogs are not allowed.** Research may establish that dogs
   are banned on part of a published walk. Proposed: such a trail **does not
   earn the seal and is taken off the published catalogue** pending review,
   rather than sealed with a ban on its page.
3. **Reading documents.** The binding rules for both hand-graduated trails sat
   in documents a web search does not read well: a landscape plan behind a map
   viewer, and a scanned municipal regulation. Proposed: the lane may cite a
   document the specialist names but cannot read as `unresolved` with the
   document's address, and those trails surface on the trail board for a hand
   audit, rather than being guessed.

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

### A note about the agent's own search is not a missing answer

The unwaivable class is written for a direction **nobody can supply**. It is not
written for an agent reporting what happened when it looked.

The three-source ladder exists so that where the agent cannot establish a
direction, the map or ORMA's own record can. But the agent's own admission that
it could not — `unresolved`, or every strategy spent — was filed under the claim
id, which is the class no reason can waive. So the answer was computed,
reported, and then overruled by the very failure the ladder exists to cover.
**The ladder could never once rescue a trail.**

Anello di Ciampeviei, 15 October 2026: its start, status and sequence came from
the Lozzo di Cadore authority and its switches from the map — all four answered
— and the gate rejected it for `logistics/route-number-switches: unresolved`.
Thirteen trails carrying a route number on their own relation stood behind it.

Where a claim is answered by any rung of the ladder, what the agent reports
about its own search is filed as a caveat under the claim's own suffix. It still
reaches the desk and the agent that could clear it, and is accepted as unknown
like any other optional detail. It no longer decides.

**Only `unresolved` and an exhausted ladder move.** `conflicted` and
`counter-evidence` mean the agent learned something that contradicts, and a
measurement of where the ways run does not settle a disagreement between two
authorities about what anybody recommends. Those keep deciding, and a walk the
ladder answers nowhere is refused exactly as before.

This is the second place the same mistake was made. The first was a footnote:
Tre Cime's agent established the Rifugio Locatelli switch, cited it, and noted
that no coordinate had been published for it — and that note, filed as the
claim, rejected the best-documented walk in the catalogue. An agent that found
the switch and said nothing else would have passed. A note is a note wherever it
is written down, and the rule now holds for a claim's finding as well as for its
footnotes.

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

## A worker that has stopped says so

The queue worker records a health receipt on every run, including the number of
runs that have failed in a row. That count existed from the first run and was
read only by the dashboard, which nobody opens while they believe the pipeline
is running. On 13 October the worker stopped at 16:00 on an oversized Firestore
document, the schedule went on firing and failing every three hours, and it was
found hours later by being asked about rather than by saying so.

The worker therefore raises a GitHub issue, `ORMA worker has stopped`, carrying
the failure count, the last successful run and the stage that failed. It is
opened on the second consecutive failure, so a single blip stays quiet, and on
the first failure that prevents the health receipt from being written at all,
because that case has no counter to wait for. It is commented on while the
failure persists, and the next successful run closes it.

One issue, found by its own label rather than by title search, so a search
index that has not caught up cannot open a second one every three hours. The
issue is the notification: no dashboard has to be open and nothing has to be
asked for the operator to learn that nothing is being verified.

A worker can also stop without failing. The jobs are claimed, the model
provider refuses every one, and the run reports success because nothing about
the run went wrong: a green tick, an empty pipeline, and the alarm above
correctly silent because there was no failure. That is how the pipeline sat
dead from 11 October 2026, and how it stopped again on 14 October when the
OpenAI credits ran out.

So two runs in a row where not one job gets through raise a second issue,
`ORMA worker is running but getting nothing done`, carrying when anything last
worked, how long it has been empty, and the provider's own words. It is a
separate issue from the one above because what to go and do is different: that
one is a bug to read a log for, this one is usually a bill to pay. A run that
gets work through closes it. A run with nothing queued is neither, and leaves
the count where it found it.

## Read off the map, and said to be read off the map

ORMA's lines are built from OpenStreetMap route relations, and the geometry
audit measures which of them carries each stretch of a walk. That measurement
answers two of the four route-guidance claims: the order of the numbers along
the line, and where one number gives way to the next.

It was computed on every run and thrown away. The agents were sent to the web
to research what had just been measured, and `route-number-switches` came back
answered half the time, which is every trail that cannot be verified for want
of directions.

Reading relation membership is not inferring a route from map appearance, which
the logistics prompt rightly forbids. Somebody recorded that these ways carry
route 101; reading that back is no more an inference than reading a walk's
distance off its line.

**The map answers two of the four, and only two.** A relation records where
these ways run, so it can say what the route is and where its number changes.
It does not publish a start point, and it cannot say whether a walk is followed
by numbers or by landmarks. `recommended-start` and `route-number-status` stay
the agent's to establish from an authority, and no amount of map reading
answers them.

An authority the agent cited always wins. An operator's published description
is better evidence than a measurement of the ways: it says what somebody
recommends, where the map only says what is drawn.

**And it says so, in the value itself.** Every map-read value ends with "Read
from the OpenStreetMap route relations this walk is built from, not from a
published route description", and is written descriptively -- "the mapped route
follows 101, then 105" rather than "follow 101, then 105" -- because a relation
recommends nothing. The provenance travels in the value and not only in the
citation, since a value is quoted and summarised far from its source. The
citation is the relation itself, attributed to OpenStreetMap.

A reader is therefore always told which of the two they have, and the
difference between a walk whose directions an operator published and one whose
directions were read off the map is visible rather than blurred.

### A walk with no number of its own still has numbers along it

`ref` on a relation says whether the walk **is** a numbered route. It says
nothing about the waymarks a walker actually follows.

Seven trails were refused for want of route guidance on 15 October 2026 after
ORMA read that one tag and concluded they had no numbers. Asking the looser
question — which numbered walking routes share any way with the walk — found
candidates on four of the six that could be read: 9 and 56 on La Croix des
Salles, 23, 25 and 22 on Le Marais de Pré Lombard, 2, 44, 54 and 56 on Le Mont
d'Arbois, GR 96 on Itinéraire de découverte historique.

**Sharing a way is not carrying the walk, and the measurement is the stricter
question.** A route counts only where it runs within the corridor along a
stretch of at least 150 metres, so one that brushes the walk for twenty is not
guidance. Measured that way, Le Mont d'Arbois has nothing qualifying despite
four numbers appearing beside it — which is the right answer, and the reason the
measurement decides rather than the tag search that found the candidates.

The measurement already existed and was pointed at one case only. The composite
search works out which of several routes carries each stretch of a walk, and
`routeRefSegments` turns that into an order and the places one number gives way
to the next — for a walk **assembled** from several relations. A single
unnumbered relation never got measured, though the code sat beside it. So where
a walk carries no number of its own, the same measurement now reads the numbered
walking routes running along it.

**Walking routes only, and never a road.** Le Mont d'Arbois has `VAE 9`,
`VAE 11` and `VAE 69` along it — *vélo à assistance électrique*, e-bike routes.
And the member ways of these walks carry `D 8`, `D 55` and `D 309a`, which are
French départementale **roads**. Following a cycle waymark is the wrong way;
following a road number could be a dangerous one. Only the `ref` of a route
relation that is a footpath is ever read, never a way's own tag.

**And it says it runs along them, never that it is one of them.** "Follow 23" of
a walk that shares one stretch with 23 sends a walker down 23 at the point the
walk leaves it. The value opens by saying the walk carries no number of its own
and then names the waymarks it runs along, and it cites those routes rather than
the walk's own relation — which is precisely the thing with no number on it. A
route that merely crosses the walk is folded away by the 150-metre minimum, and
a stretch with no number left on it is not an answer: an empty list of waymarks
is not guidance.

### A walk with no number says how to follow it

Some walks carry no number and have no numbered route running along them
either. Boucle du Taillefer and Boucle du Lac Vert were measured against the
live map on 15 October 2026 and have nothing. Asking them what order the numbers
come in has no answer, and refusing them for want of one refuses them for ever.

What they have is landmarks ORMA wrote down by hand: a kilometre mark and a
sentence — "Taillefer high point (766 m): benches and the double panorama over
the Grand and Petit lac d'Annecy". That is what somebody walking it actually
follows, and it is what the walk is given instead of a number: the start, then
each landmark in the order a walker meets it, with the distance to each.

Two of the seven have nothing but a start point. Those say so and tell the
walker to follow the walk's name on local signs and the mapped ORMA line on the
page, because that is what a person does on an unnamed, unnumbered path. It
invents nothing — no distances, no places.

Water sources are not landmarks. Their labels are mostly "Drinking water
(OSM-verified location)", which is useful on a trail page and useless as a
thing to navigate by, and five identical sentences is not guidance.

**Only where somebody looked.** Measured-and-found-nothing is a fact about the
walk; never-measured is a fact about ORMA, and the two must not read alike. The
geometry audit marks an audit where it searched for numbers along the walk and
found none, and the record answers these two claims only on that mark. An audit
taken before that measurement existed carries neither, so nothing is claimed of
it — the trap the derived route number fell into, where a field existed only for
trails measured after it shipped.

The record stays the bottom rung. A number measured off the map is better
evidence than a landmark and still wins, and an authority's own description wins
over both.

Saying nothing was the worse option. A walker expecting to follow "route 23"
who arrives to find only name-boards has been let down by a blank page.

### A measurement that could not be taken says so

Three outcomes, not two: the survey found numbers, it looked and found none, or
**it could not look**. The third must never read as the second.

La Croix des Salles was surveyed on 15 October 2026 and came back with no number
measurement at all, because the Overpass corridor query fails for that trail.
Nothing recorded that a measurement had been attempted and could not be taken,
so the trail sat with its two route claims unanswered — reading exactly like a
walk nobody can supply directions for, when what it was short of was a request
that reached the map.

An outage is not evidence about a trail. But it has to leave a mark, or it
becomes one: a silent failure and an honest refusal are indistinguishable from
the outside, and only one of them is worth doing anything about.

The audit records what went wrong, and the gate dry run names it as its own
category — **a survey to run again**, beside the faults to fix, the judgements
to make and the research to commission. A walk whose own relation carries a
number needed no corridor query at all, so it is not marked unmeasured; nothing
was missed.

### A composite survey says which of the three cases it is too

A composite recorded the numbers it measured and **nothing at all otherwise**,
so a composite whose routes carry no number could not be told from one surveyed
before those marks existed. From the gate those two read alike, and only one of
them is a walk somebody has to research.

Cinque Torri was the last trail in the catalogue blocked on route guidance on 16
October 2026, for exactly that reason. Twelve trails are on this path, Tre Cime
and Lago di Braies among them.

A composite now records the same three outcomes as any other survey: the numbers
it measured, that it looked and found none, or that it could not look. Its own
measurement already works out which numbered routes carry each stretch — a
composite is defined by the routes it runs along, so those are its own numbers —
and where it finds none, the corridor is searched for numbered walking routes
along the walk before anything is concluded, which is the same ladder the
single-relation path climbs. The mark therefore means one thing in both.

### A named trail can be surveyed again

The geometry audit is deterministic — it reads OpenStreetMap and measures, with
no model call — and it is where the map reading lives. So **every improvement to
it is invisible to a trail already past it**, and nothing in the pipeline goes
backwards.

That cost three improvements their effect on 15 October 2026: the route number
sitting unread in a stored audit, the numbered walking routes running along a
walk that carries none of its own, and the mark saying somebody looked for them
and found none. Each landed, and each applied only to trails surveyed
afterwards. Five of the eight trails still blocked had moved past the survey and
could never benefit from a better one.

The pipeline's state lives in Firestore and the credential stays in Actions, so
this runs where the credential is: the **ORMA requeue fixed jobs** workflow
takes `resurvey_trail_ids`, alongside the inputs for releasing a blocked job and
reconsidering a rejection, because all three are the same act — running
something again once its cause has been fixed. Nothing is queued without
`apply`, and it costs no model credits.

A checkout cannot run it. `npm run backoffice:resurvey` is the command the
workflow runs, not one to run from a machine, and shipping the npm script alone
left the standard describing something unrunnable.

**It changes nothing else.** The trail stays exactly where it is; only its
survey is taken again. It does not have to move, because every reader already
takes the newest completed output per agent — so the new survey is what the gate
reads the moment it lands, and the research already paid for is untouched.

Sending the trail back a stage would stall it. `reconsider-rejected-trails` does
that, correctly, for a trail that was rejected — but it also sets
`reconsideredAt`, which marks **every** agent's evidence as predating the
return, so a trail sent back for a survey would wait at evidence-research for
research nobody queued. A rejection keeps its own way back; a re-survey is the
narrower thing.

A trail already at the survey is held rather than given a second audit of the
same line, a resting trail is not waiting on a survey at all, and a name that is
not in the pipeline is reported rather than silently dropped.

### The audit on the shelf is read, not re-taken

The measurement is derived where the audit is read, not stored by whichever
pass happened to run last.

The geometry audit writes the derived answer into its result. Audits taken
before that field existed do not carry it, and nothing re-audits a trail
already parked at a gate — so for its first day the map answered only for
trails audited since. Nineteen of the catalogue's twenty-seven blocked trails
carry a route number on the very relation they are built from: Fenn Promenade
is route 20, Anello di Ciampeviei is 69, Dörferrundweg is 4, B05 is B05. Every
one of them was refused for want of route guidance that was sitting in its own
audit under `relation.tags.ref`.

Ten lines above the reader, the citation builder already reached into an old
audit for that same tag. So the two halves of one fact disagreed about which
audits they could read: the source could be cited from an audit the answer
could not be taken from.

A single relation is a single number from end to end, so its guidance needs no
measurement — only the composite path, where several routes carry different
stretches, needs one. **That derivation has one definition, used by the pass
that writes an audit and by the gate that reads one**, so a fresh audit and a
stored one reach the same answer and cannot drift apart. The gate therefore
needs no re-audit to see what the map has always said.

A walk the map gives no number for stays unanswered rather than invented, and a
composite's joined label is left to the measurement that can order it.

### The record answers in the decision, not only in the report

A gate recomputes its blockers from the stored outputs rather than trusting
what was written down when it opened, which is right. But it was handed no
trail, so **ORMA's own record answered in every report and in no decision.**

Measured on 15 October 2026: **22 of 34 trails** named `recommended-start` or
`route-number-status` as the thing rejecting them while ORMA's own catalogue
held the answer. Fenn Promenade's report read "all four answered · nothing
unwaivable · 0 blockers" directly above "reject, because those two are
required".

The catalogue the worker already loads — it was being used only to scope which
trails to look at — now rides the gate item, read live rather than taken from
the audit, so a start point corrected since the cartographer last ran is the one
the gate decides on. Where there is no record to read, the two claims it answers
are honestly refused rather than quietly waved through.

**The report and the decision are two computations of one fact and must agree.**
The gate dry run compares them and reports any disagreement as a fault rather
than a verdict, because a disagreement means one of them is seeing evidence the
other cannot — never that there is anything wrong with the walk. A trail
carrying both a fault and a real blocker says both: one is a bug to fix, the
other a walk somebody has to go and research, and they were reading alike.

### ORMA's own suggestion is not overruled by a disagreement between others

A contradiction an agent finds between published sources normally decides:
reading where the ways run does not settle a disagreement between two
authorities about what anybody recommends.

It does not decide where the answer is **ORMA's own record**. That value says in
its own words that it is ORMA's suggestion from the walk it recorded, not an
operator's recommendation, and tells the reader to check access before going.
Two operators disagreeing with each other does not make ORMA's own recorded
start point wrong — and suppressing it leaves the reader with no answer at all
rather than a better one.

It was rejecting ten trails on 15 October 2026 whose start ORMA has always
published: Albannette, Anello dei Forti, B02, B05, B08, Rafeil-Rundweg, Giro del
Zimon, Circuit Béatrice de Savoie and two more, every one
`recommended-start: conflicted` over a start sitting in the catalogue.

The conflict is still recorded, still reaches the desk and the agent that could
settle it, and is accepted as unknown like any other optional detail. What it no
longer does is suppress ORMA's own answer in favour of none.

**Only a conflict over a record-answered claim moves.** `counter-evidence` means
the agent found evidence *against*, and a contradiction over a claim an
authority answered is a disagreement a measurement cannot settle. Both still
decide.

A held contradiction is therefore a judgement somebody can make, not a bug and
not missing research, and the gate dry run names it as its own category. Calling
it a fault sent a reader looking for code that was behaving exactly as written.

### A dossier can exist for a walk the map and the record answered

The gate approved it and the compiler threw. Five trails stood at the dossier
gate on 18 October 2026 and not one could produce a dossier, so nothing could
reach publication — which is why no trail has ever carried a badge.

Two rules written before the ladder existed did it.

**The numbered-route rule asked for an authority.** A walk with a number had to
carry a recommended start citing a published page, in words written when nothing
else could answer anything. It now asks the question the contract asks
everywhere else: is the start established, and is the reader told by whom. An
authority still wins where one exists, and a record answer says in its own words
that it is ORMA's suggestion from the walk it recorded and tells the reader to
check access. Refusing it outright published nothing at all, which serves a
walker worse than an honestly-labelled start. A numbered route with no start
from any rung is still refused.

**And the guidance assertion was handed the trail and did not pass it on**, so
the bottom rung was deaf in the one place that decides whether a dossier exists.
That is the third time the same shape has appeared: an answer computed in one
place, and the place that needed it not given what it takes to compute it.

What a fast-lane dossier contains is the line, its identity, and the sources
they rest on. It carries no safety category as reviewed, because no specialist
spoke — which the badge already derives rather than asserts.

## Three kinds of answer, and the reader is told which

A route-guidance claim may be answered three ways, and they are not equal. The
contract takes the best available and says in the value itself which it was.

**An authority the agent cited** is the best. It says what somebody recommends,
not merely what is drawn, and it always wins where it exists.

**The map** comes next, for the two claims it can establish: the order of the
numbers along the line, and where one gives way to the next. See "Read off the
map, and said to be read off the map".

**ORMA's own record** is the weakest, and answers the other two. 161 of the 162
trails carry a named start point with coordinates, and the geometry audit
measures the numbers each walk follows. An agent sent to research a start point
is being paid to rediscover what the catalogue has had all along, and a trail
whose search finds no authority was being refused for want of a fact ORMA could
state itself. Measured on the ten trails nearest the seal on 14 October 2026:
five were blocked by all four claims at once, every one empty because nothing
had been published about that walk anywhere.

The public page has rendered exactly this for a long time -- "Suggested start,
<place>. Check current access before travelling." Only the gate refused it.

So ORMA may answer those two as ORMA. Every such value ends with "ORMA's own
suggestion from the walk it recorded, not an operator's recommendation", and
the citation is ORMA's own record attributed to ORMA, because no authority was
found and naming one would be the invention this contract exists to refuse.
The start carries "Check current access before travelling"; the numbers do not,
because access is about whether somebody may begin there today and attaching it
to a sentence about trail numbers warns about the wrong fact.

What ORMA may never do is make a walk up. The start is one it already published
and a reader can see on the map; the status is read off the numbers the audit
measured. A walk with neither a record nor an authority is answered by nobody,
and is not verified.

## A walk nobody wrote about rests, it is not rejected

Les Marais d'Albens is a real 6.6 km walk near Albens. Its municipality has
never published a description of it, and no amount of research will produce a
page that does not exist. Eight trails in the catalogue are in that position.

Calling that `rejected` says three wrong things. It reads as ORMA having looked
at the walk and said no. It keeps the trail in the counts of things going
wrong, where it crowds out the trails that really are failing. And it leaves
the trail eligible to be picked up and paid for again, which is how 202
searches went on optional detail for trails that could never finish.

So a refusal standing **only** on route guidance rests as `imported`, which is
what the public page has always called such a trail. It keeps its place on the
site with its terrain, its elevation and its honest badge; the pipeline simply
stops spending on it. The trail records why, so a later reader does not have to
derive it again.

A refusal standing on anything else is still a rejection. A line that does not
resolve, a route that has been withdrawn, an identity contradicted by its
source -- those are problems somebody could fix, and they should stay visible
as problems.

The distinction is drawn from the blockers rather than from the wording of a
note. A reworded note is how an unwaivable class came to stop containing the
blocker it was written for.

Resting is terminal. A rested trail is not agent work, holds no place in the
intake budget, and waits for no decision. Nothing re-opens it but somebody
finding a source that did not exist before.

## Backoffice Home is the trail board, and it asks rather than decides

On 21 October 2026 the operator could not tell where any single trail was.
Backoffice Home led with counts, programme cards and receipts; the one table
of trails was built in the browser from the orchestration, so it held only
the 61 trails already admitted and none of the 101 waiting to start. The
first question anybody asks of the backoffice -- where is this trail? -- had
no page that answered it.

**Home is now the trail board.** Every catalogue trail is one row: the stage
it is at, how many of the eleven checks it has, the badge the public page
shows, and what happens next in words. The eleven orchestration states fold
into six stages a person can follow -- Not started, Route check, Research,
Publishing, Passed, Stopped -- and the raw state stays on the row for anyone
who needs it. Automation health, programme health, the decision queue and the
receipts moved unchanged to a **System** page; principle 7 still holds, with
the overview split across the two.

The worker writes the board (`trail-board`) at the end of every pass, from the
checkout's catalogue and the orchestration, because the hosted backoffice is
served without `data/` and could never have joined the two itself. The page
reads that one document, the worker heartbeat and the newest requests; it
never lists jobs or reads the orchestration.

Two kinds of row are called out rather than counted: a trail **stuck** where no
automation will move it (blocked, or a publication failure that needs a fix),
and a trail where the **record and the site disagree** -- a seal earned by the
route audit that a later pipeline pass rejected. The seal stays, because no
publication may take one away; the board is how anybody finds out.

**The board's buttons ask the automation to do something for one trail. They
never decide a verification.** There is still no human verification gate:
every geometry and dossier gate is settled by the evidence policy. What a
moderator can now choose is *what is worked on, and when* -- which had only
been possible by typing trail ids into a GitHub Actions form.

| Button | When it is offered | What it runs |
|---|---|---|
| Start verification | not started | the worker, `reverify_trail_ids` (named admission) |
| Work on this next | route check or research, with an agent job waiting | the worker, `candidate_id` |
| Re-measure the route | admitted, not at the survey, not resting | the requeue job, `resurvey_trail_ids` (free) |
| Retry publishing | a retryable publication failure | the worker, `force_publication_retry` |
| Look at it again | rejected | the requeue job, `reconsider_trail_ids` |

Every button is an input those workflows already had, with one addition:
`reconsider_trail_ids` names rejected trails one by one, because nine of the
seventeen rejected on 21 October carried no blocker a `--reason` could match.
Naming a trail is a deliberate act, the same discipline as naming a reason.

A press saves a request to `backofficeTrailRequests`; the browser holds no
GitHub token and starts nothing itself. The **ORMA trail requests** workflow
runs every fifteen minutes, re-checks each request against the current board
(a stale page cannot ask for what the trail can no longer do), and dispatches
at most one run per workflow per pass, because GitHub cancels an older pending
run in a concurrency group for a newer one. It never writes the orchestration:
the worker and the requeue job keep their own concurrency rules. A request is
`queued`, then `dispatched` with its run, then `done`, `failed` or `refused`
with the reason; a run that was replaced goes back to `queued`. Requests are
receipts: the Firestore rule lets a moderator create one in a fixed shape and
nobody edit or delete one.

With nothing asked for, a pass costs two Firestore reads. Buttons change order
and scope, not cost: research still spends model credits, and only
re-measuring the route is free.

## Paid research is off; verification is done by hand

> Decided 22 October 2026.

A credit top-up lasted **31 hours** (20 October 11:00 to 21 October 18:36 UTC).
Measured across every worker run in that window, the backoffice made about
**101 model calls, and 95 of them were the fourth attempt or later** of an
agent on the same trail -- the evidence ladder retrying optional detail one
claim at a time, each attempt a full web search. One trail had the terrain
analyst asked 23 times. Only two calls were a trail's first research.

At the same time, verification done by hand in Claude, against official
sources, graduated four trails in two days with no model credit spent, and
found what the automated route checks had published wrong: the municipality
on every trail researched, and photographs taken 0.4 to 10 km from the walk.

So the split is:

- **The backoffice keeps everything that is free or bounded**: the hazard
  watch (official MeteoAlarm feeds, every three hours, no model), the
  geometry survey, the fast lane, publication, the trail board and trail
  requests, the daily intake, and vetting of walker-reported hazards (a model
  call per report, at most three a pass). Weather on a trail page is fetched
  live from Open-Meteo by the page itself and costs the backoffice nothing.
- **Paid verification research is off** (`ORMA_PAID_RESEARCH_ENABLED`, off
  unless the repository variable is `'true'`). The specialists and the
  evidence ladder are not run; their jobs stay queued, untouched, and the
  free survey keeps running in the same pass.
- **Parked, switched off**: the safety-research lane, the closure scout and
  gate adjudication (`ORMA_SAFETY_RESEARCH_ENABLED`,
  `ORMA_CLOSURE_SCOUT_ENABLED`, `ORMA_GATE_ADJUDICATION_ENABLED`).
- **Verification research is done by hand** and recorded in the published
  entry, the route-source ledger and the photo ledger, through a pull request
  reviewed before merge.

Before paid research is switched back on, the evidence ladder's retries on
optional detail need a cap, or the next top-up goes the same way.

## Definition of done for future iterations

A backoffice change is not complete until:

1. its team owner and release gate are unambiguous;
2. the CEO can see the relevant progress or decision in the dashboard;
3. unresolved work survives refreshes and later scheduled runs;
4. approval, revision, failure, and publication states are truthful;
5. focused workflow tests and static-page checks pass; and
6. the implementation still conforms to this standard, or this document is
   deliberately updated as part of an explicitly approved operating change.
