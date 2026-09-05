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

Dynamic hazards run hourly. A source-backed severe, extreme, or dog-critical
warning may be added automatically. When a successfully fetched authoritative
active-warning feed affirmatively stops listing a warning, the protected hazard
is removed automatically and the watcher records that removal. Expiry without
a complete successful source snapshot opens a resolution review; source failure
or outage never removes the last known warning. Weather warnings are never
presented as proof that a specific trail is closed.

Existing Trails is the current throughput priority. Every day after the
Firestore quota reset window, the protected
catalogue campaign admits the next eligible candidates for ORMA Verified
review, subject to the shared capacity limit. The hosted worker checks
its durable specialist queue before general editorial, image, newsletter and
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

### 2. New Trails

Owns discovery before catalogue admission. It prioritises:

- plausible loop routes;
- animal-friendly evidence;
- candidates close to areas ORMA already covers; and
- coherent geographic expansion before unrelated new regions.

The active discovery phase is Dolomites-first. Scouting is paused during the
trail-photo and ORMA Verified backfills; existing candidates are preserved and
nothing is deleted. When resumed it refreshes Monday through Saturday, ranks
credible Dolomites candidates ahead of other regions, and preserves unresolved
candidates between refreshes.

CEO selection sends a candidate into the Existing Trails verification fleet.
Selection is not publication. A New Trail becomes an Existing Trail only after
the required evidence and human gates are complete.

### 3. Trail photos

Owns trail-photo coverage only. The website-copy and Safety Library queues are
retired: their agents, desks and scheduled runs are removed rather than gated,
and any future copy work starts from a new explicit decision.

Trail-photo coverage is a separate Editorial workflow. It audits every
published trail, not guides or general pages, and ranks Dolomites gaps first.
During the MVP phase it is an active throughput lane: the daily refresh keeps
up to 15 trail-photo searches or exact asset reviews active, automatically
queues correctly licensed and credited candidate scouting for the highest
priority unfilled trails, and preserves the remaining coverage inventory
without presenting every gap as simultaneous work.
For each trail, the CEO can upload her own photograph in a protected backoffice
space, choose an existing ORMA asset, request correctly licensed candidates,
explicitly request an AI option, or park the gap. Uploads are not publicly
readable. The browser compresses an uploaded photo to a strict 560 KiB maximum
and holds it temporarily in the protected Firestore review queue; ORMA does not
require a paid photo-storage bucket. The CEO previews the exact image and its
creator, rights basis and alt text before approving it for a publication pull
request. The worker copies an approved photo into GitHub, which is the permanent
public asset store, and deletes the temporary Firestore copy after the reviewed
pull request is merged and deployed.

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
- Before consuming an approved trail or trail-photo publication, the hosted
  worker checks the latest completed `Validate ORMA` run for its exact commit.
  A failed, cancelled, or missing result pauses only materialization and pull
  request creation. The approval stays saved, specialist queues continue, and
  Backoffice Home records `Publishing paused` with the validation-run link.
  The next scheduled worker pass resumes publication automatically after that
  exact commit is green.

## Current cadence

- Dynamic hazard check: hourly at minute 7, Europe/Rome, clear of the
  quarter-hour queue worker. Successfully fetched
  authoritative feeds remove warnings that they affirmatively resolve; source
  outages retain the last known warning.
- Existing Trails queue: checked by the hosted worker every thirty minutes,
  with daily ORMA Verified intake at 09:30 local time and 15-trail capacity.
  Hazard freshness does not depend on this cadence; the hazard watch runs on its
  own hourly schedule.
- Trail-photo coverage and licensed candidate scouting: daily at 11:00 local
  time, after New Trail scouting, with at most 15 active searches or reviews;
  guide-wide image audits are not part of this queue.
- New Trail scouting: paused for the duration of the trail-photo and ORMA
  Verified backfills. Each newly admitted trail opens a new photo gap and a new
  verification gap faster than either backfill closes one, so intake stays
  paused until both lanes reach full coverage of the existing catalogue.
  Cadence when resumed: Monday through Saturday at 10:00 local time, Dolomites
  first; admission remains CEO-gated.
The Newsletter, Social, Analyst, Product Design and website-copy lanes are
retired. Their agents, desks, scheduled workflows and npm entry points are
removed from the repository. Firestore review collections and existing artifacts
are left untouched, so no decision history is lost, but nothing reads or writes
them. Reopening any of these lanes is a new, explicit build.

Hosted production workers use server-side credentials and must preserve these
contracts. The duplicate local desk server is retired; the hosted backoffice is
the single operator surface.

## Definition of done for future iterations

A backoffice change is not complete until:

1. its team owner and human gate are unambiguous;
2. the CEO can see the relevant progress or decision in the dashboard;
3. unresolved work survives refreshes and later scheduled runs;
4. approval, revision, failure, and publication states are truthful;
5. focused workflow tests and static-page checks pass; and
6. the implementation still conforms to this standard, or this document is
   deliberately updated as part of an explicitly approved operating change.
