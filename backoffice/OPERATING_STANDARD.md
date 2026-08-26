# ORMA Agentic Backoffice Operating Standard

Status: **current baseline**
Effective from: **19 August 2026**

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

## Team ownership

### 1. Existing Trails

Owns trails that are already in ORMA and verifies:

- the GPS route used for navigation;
- claims about interest points;
- terrain and surface information;
- parking, access, and how to get there; and
- dynamic hazards that may affect a covered area.

Dynamic hazards run daily. A source-backed severe, extreme, or dog-critical
warning may be added automatically. Expiry opens a resolution review; removing
a warning requires confirmation. Weather warnings are never presented as proof
that a specific trail is closed.

Existing Trails is the current throughput priority. Every day after the
Firestore quota reset window, the protected
catalogue campaign admits the next eligible candidates for ORMA Verified
review, subject to the shared capacity limit. The hosted worker checks
its durable specialist queue before general editorial, image, newsletter and
Analyst generation work. It may keep up to 15 trails in verification and run
up to ten specialist jobs per worker pass. This changes working capacity only:
all geometry, evidence, dossier, editorial and release gates remain required.

### 2. New Trails

Owns discovery before catalogue admission. It prioritises:

- plausible loop routes;
- animal-friendly evidence;
- candidates close to areas ORMA already covers; and
- coherent geographic expansion before unrelated new regions.

The active discovery phase is Dolomites-first. Scouting refreshes Monday
through Saturday, ranks credible Dolomites candidates ahead of other regions,
and preserves unresolved candidates between refreshes.

CEO selection sends a candidate into the Existing Trails verification fleet.
Selection is not publication. A New Trail becomes an Existing Trail only after
the required evidence and human gates are complete.

### 3. Editorial

Owns website copy and trail-photo coverage as two separate queues.

The weekly copy cycle:

- reviews non-safety guides, editorial articles, and explicitly named
  governance pages, not design;
- pauses all Safety Library copy packets while the Safety Library UI is being
  redesigned; existing packets move to a protected paused archive and are not
  shown as CEO decisions;
- prioritises immediate revision requests first, then the Privacy and Terms
  pages during the current website-refinement cycle, then ordinary freshness
  work outside the Safety Library;
- excludes collections from automatic freshness review;
- keeps exactly three copy packets active at a time;
- shows the current page beside the proposed page;
- allows the CEO to edit proposed copy before approval;
- uses current, dated, authoritative sources for factual changes; and
- adds or updates a visible `Last reviewed` date when the factual review is
  complete.

Privacy and Terms remain copy-only, human-gated reviews. Their visible
`Last updated` date changes only when an approved edit materially changes the
published policy or terms; the copy agent must flag legal or implementation
uncertainty instead of inventing a commitment.

Approval applies only the reviewed changes, runs checks, commits only the
approved source files, pushes to `main`, and reports the deployment result.

Trail-photo coverage is a separate Editorial workflow. It audits every
published trail, not guides or general pages, and ranks Dolomites gaps first.
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

### 4. Newsletter

Remains parked until the CEO explicitly confirms that the trail catalogue,
collections and website content are ready to support useful public links. No
scheduled issue generation, revision job or downstream handoff runs while it
is parked. Existing draft and review records are preserved.

Once re-enabled, it runs every 14 days and assembles one complete issue from:

- newly published trails;
- material changes to published guides; and
- useful, current, source-linked seasonal signals.

It reuses approved upstream facts and never reopens their editorial decision.
The CEO reviews one reader-facing issue, with subject options, source links,
approval, and an immediate revision path. Approval hands the issue to Social
and to any future sending integration. It must not claim an email was sent when
no sending service is connected.

### 5. Social Media

Remains launch-gated until the channels and publishing credentials are
explicitly enabled. Once active, it:

- repurposes approved newsletter material for Instagram, Facebook, and TikTok;
- adapts the format to each channel; and
- regularly explains useful ORMA product features.

Social consumes the approved newsletter packet. It does not publish or invent
a second version of the underlying trail or safety facts.

### 6. Analyst

Runs as an independent product-discovery lane. It scouts competitor releases,
feature patterns, UI improvements, and editorial gaps, with direct sources and
clear evidence-versus-inference language.

The required handoff is:

`Analyst scouts -> CEO reviews -> Product Designer prepares visual prototype -> CEO reviews -> Developer implements -> Release`

The Product Designer is a first-class fleet member with a dedicated prompt and
a top-level Design desk. Analyst owns evidence and prioritisation; Design owns
the full-width interactive screen prototype, usability rationale, revision
requests and the CEO prototype gate. An investigation, priority decision or prototype never authorises development on its own.

## CEO review and shipping contract

- The dashboard shows counts, progress, blocked work, and decisions across all
  six teams.
- Customer-facing ORMA navigation does not expose a backoffice link or an
  administrator sign-in flow. Production operators enter through the unlinked
  dedicated backoffice login and must hold the Firebase moderator claim.
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

## Current cadence

- Dynamic hazard check: daily at 07:15 local time.
- Existing Trails queue: checked by the hosted worker every fifteen minutes,
  with daily ORMA Verified intake at 09:30 local time and 15-trail capacity.
- Strategy cycle: Wednesday at 12:00 local time.
- Editorial copy: weekly, with up to three active non-safety reviews; Safety
  Library copy review is paused during the current UI redesign.
- Trail-photo coverage: refreshed Monday through Saturday at 11:00 local time,
  after New Trail scouting; guide-wide image audits are not part of this queue.
- New Trail scouting: Monday through Saturday at 10:00 local time, Dolomites
  first; admission remains CEO-gated.
- Newsletter: parked until trail, collection and website content readiness is
  explicitly confirmed.
- Analyst discovery: weekly.
- Social: parked until launch.

The local macOS background services keep these workflows available after login.
Scheduled drafting uses the signed-in local Codex session when no API key is
configured. Hosted production workers use server-side credentials and must
preserve the same contracts.

## Definition of done for future iterations

A backoffice change is not complete until:

1. its team owner and human gate are unambiguous;
2. the CEO can see the relevant progress or decision in the dashboard;
3. unresolved work survives refreshes and later scheduled runs;
4. approval, revision, failure, and publication states are truthful;
5. focused workflow tests and static-page checks pass; and
6. the implementation still conforms to this standard, or this document is
   deliberately updated as part of an explicitly approved operating change.
