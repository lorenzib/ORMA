# Autonomous trail-audit task

A self-contained brief for an agent that runs **independently, on a schedule,
without a human checking each run**, and moves ORMA trails through the
review tiers. Hand this whole file to the task runner as its prompt — it does
not depend on any prior conversation.

## Objective

Advance trails from **under review** to **route-audited** by running the
route-audit mechanism defined in `VERIFICATION.md` and `TRAIL_AUDIT_GUIDE.md`:
the gate checks (data integrity + hard disqualifiers + shade) **and** content
enrichment. This covers **both regions — Dolomites and Savoy** — not one; the
worklist (`npm run check:trail-sources`) already spans both. Produce the
result as a **reviewable branch** (a pull request when `gh` is available,
otherwise a local branch plus a report file), never a direct write to `main`.

## Two hard limits — do not exceed them

1. **You cannot produce the `dolopaws-walked` tier.** That requires a human to
   physically walk the trail. The most you may do is add a
   `walkCandidate: true` flag with a one-line reason when a route-audited
   trail looks worth a field visit. Never set `tier: 'dolopaws-walked'`.
2. **Never publish to `main` and never silently edit live data.** Each run
   works on a fresh branch (`trail-audit/<date>-<batch>`) and leaves its work
   for human review. How it hands off degrades gracefully:
   - If `gh` is installed and authenticated, **open a pull request** whose body
     is the report below.
   - Otherwise, **commit to the local branch** and write the same report to
     `audit-reports/<YYYY-MM-DD>.md`. Do not attempt to push or install `gh`.
   Either way, merge is the human backstop; the run never merges itself.

## Prerequisite (check first, and stop if unmet)

The target data model is a `tier` field (`'under-review' | 'route-audited' |
'dolopaws-walked'`) plus the badge logic in `trail-trust.js`. If the codebase
still uses the `curated` boolean and has no `tier` field, the migration has
not landed yet. In that case **do not invent a parallel scheme**: write your
proposed audits as `trail-audits.js` overlay entries (the existing Albanne
pattern — `graduation`, `verified`, `sourceLinks`, `reviewedAt`) and note in
the PR that they await the `tier` migration. Confirm which state the repo is
in before editing.

## Inputs and authority

- `VERIFICATION.md` — the gate model (four roles + enrichment), the redefined
  categories, and the source hierarchy. **This is the authority; read it in
  full each run.**
- `TRAIL_AUDIT_GUIDE.md` — the per-trail presentation checks and the
  region-specific worked example.
- `npm run check:trail-sources` — the worklist: under-review trails with their
  OSM cross-check, official links, and per-category progress.
- `trail-audits.js` — where human-reviewed overrides live. Never hand-edit the
  generated `osm-trails*-data.js` files.

## Per-run procedure

1. **Read `VERIFICATION.md` and `TRAIL_AUDIT_GUIDE.md` fully.** They may
   have changed since the last run.
2. **Create the branch** `trail-audit/<YYYY-MM-DD>-<n>`.
3. **Get the worklist** with `npm run check:trail-sources` (it spans both
   Dolomites and Savoy). Pick a small batch (default **3 trails**) that are
   `under-review`, preferring ones with clean geometry and an official
   per-route source — the realistic near-term promotions. **Alternate regions
   across runs** (or split the batch) so Dolomites and Savoy both progress
   rather than one region being cleared first. Note each trail's region in the
   PR.
4. **For each trail, run the gate checks:**
   - **Data integrity** — photo/licensing, route geometry vs. the official
     source (type/distance/ascent must agree — a mismatch is a blocker, see
     the Chemin des Diligences case), map-point coordinates traced to the
     source GeoJSON, elevation profile present and aligned.
   - **Hard disqualifiers** — dogs prohibited (national reserve / protected
     area) → **remove** the trail (add its relation to `PROMOTED_RELATIONS`
     with a `BANNED`/`REMOVED` note); officially dangerous for humans (SAC
     T3+, "difficile/vertigineux", via ferrata, cables/ladders, named
     hazardous surface) → **block**, stays under review.
   - **Heat/shade** — needs a citable canopy/exposure source.
   - **Water / exposure / surface** — pass by default per the redefined rules;
     flag only on a positive signal.
5. **Enrich the listing** — replace the auto-generated import boilerplate with
   a real description, dog notes (plus any livestock/no-water advisory the
   audit surfaced), written-out terrain/shade/water detail, and key waypoints.
   Every asserted *fact* needs a citable source; descriptive colour does not
   but must assert nothing it can't support.
6. **Decide the tier:** all gates pass **and** enriched → `route-audited`;
   otherwise stays `under-review` with precise blockers listed; hard
   disqualifier → removed.
7. **Record** `reviewedAt` (today), `reviewedBy: 'ORMA route audit'`,
   `sourceLinks` (per-category), completed checks, and blockers.
8. **Commit and hand off** with the report below (open a PR if `gh` is
   available and authenticated; otherwise commit locally and write the report
   to `audit-reports/<YYYY-MM-DD>.md`). Do not merge, do not push if there is
   no auth, do not install anything.

## Guardrails — the lines that must never be crossed

- **Never fabricate** a source, URL, coordinate, elevation, hazard, dog rule,
  or photo credit. A fabricated safety fact is the worst possible outcome —
  worse than leaving a trail under review forever.
- **Never infer safety from silence.** If a source does not address a
  category, it is unresolved, not clear.
- **Never treat a mapped fountain as proof of potable water**, and never
  describe desk research as a field visit.
- **Only assert what a named source supports.** For the map-resolvable
  categories an OSM relation/node reference is an acceptable `sourceLink`;
  label it as such so it is visibly OSM-derived, not portal-confirmed.
- If a source is unreachable (e.g. a 403), record that as a blocker; do not
  guess its contents.
- If confidence on any asserted fact is low, leave the category blocked and
  say so in the PR rather than promoting the trail.

## PR report (per trail)

- **Trail:** name and id
- **Tier decision:** route-audited / stays under-review / removed
- **Gates:** which passed, which blocked, with the evidence and source URL
- **Enrichment:** what content was written; which facts are sourced
- **Blockers:** precise, per category
- **Walk candidate:** yes/no + one-line reason
- **Validation:** `npm test`, `npm run test:static`, `npm run audit:trail-trust`,
  `npm run check:trail-sources -- --id <id>`, and page regeneration all run

## What this task deliberately does not do

- It does not merge its own PRs.
- It does not grant `dolopaws-walked`.
- It does not edit generated OSM files or publish to `main`.
- It does not process more than its batch size per run — small, reviewable
  increments beat a large unchecked change.
