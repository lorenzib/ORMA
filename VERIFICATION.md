# ORMA trail verification — internal reference

How a trail moves through the review tiers, and what "checked" means per
hazard. Companion to `SCORING.md` (how the trail is scored) and
`trail-trust.js` (how the tier is worded to the owner). Keep this in sync
with `scripts/promote-osm-trails.js` and the `PROMOTED_RELATIONS` comments in
that file — this doc is the process, that file's comments are the audit trail.

## Trail tiers

All three tiers are shown to visitors — the word "imported" is never a public
label. The tier tells the visitor how far a trail has been through ORMA'
review, from "we haven't vetted this yet" to "a human has walked it."

| Tier | Meaning |
|---|---|
| **Under review** | Shown, but the ORMA route-audit has not yet run. Freshly imported OSM data: usable, but its rating is estimated and its facts are unvetted. The honest default for anything the mechanism hasn't reached. |
| **ORMA route-audited** | Cleared the desk mechanism *and* been enriched into a real listing: data integrity verified, no hard disqualifiers, shade sourced, and genuine trail-specific content written (real description, dog notes, terrain/shade/water detail, key waypoints) in place of import boilerplate. The gate checks are largely mechanizable, but enrichment is authored content, so this tier moves at human-writing speed. **Not** a claim that a human walked it. |
| **ORMA walked** | A human has walked the trail. The strong tier — field-verified, not just a data check. |

The tier is a field on the trail (e.g. `tier: 'under-review' |
'route-audited' | 'dolopaws-walked'`), not the old `curated` boolean — a
boolean can't carry three states, and the badge logic in `trail-trust.js`
keys off the tier. A hard disqualifier (dogs prohibited) still **removes** a
trail entirely rather than showing it under review.

"Route-audited" is what the desk process in this doc produces: it promotes an
under-review trail one tier. Everything below describes that mechanism.

## What the route-audit produces

The route-audit answers a narrow question: **is this under-review trail's data
real, and are there any hard disqualifiers?** It is *not* a verdict on how
dangerous the trail is for a given dog — that is the job of the Layer-2
match % in `SCORING.md`, which already models the interactions that actually
hurt dogs (heat × distance × shade × water, terrain vs. the dog's tolerance,
fragility and health modifiers) far better than any binary check could. The
route-audit and the match % are two different systems: the audit establishes
*trust in the facts*; the match % turns those facts into *per-dog risk*. The
audit must not try to re-litigate severity — if it did, it would duplicate
the scoring engine badly and hide the interactions the score captures well.

So the ten checks sort into four roles, not one flat pass/fail list — and a
fifth requirement, content enrichment, sits alongside them before a trail
can publish as route-audited.

### 1. Data-integrity gates — hard blocks (the four presentation checks)

Photo/licensing, route geometry, map-point coordinates, elevation. These
must be correct to publish, because they decide whether the listing can be
trusted at all. They carry no dog-safety content themselves; they are about
honesty of the record.

### 2. Hard disqualifiers — block or remove

- **Dogs prohibited** (national reserve, RNCFS, other protected area where
  dogs are banned even leashed): the trail is **removed**, not blocked — add
  its relation to `PROMOTED_RELATIONS` with a `BANNED`/`REMOVED` comment.
- **Officially marked dangerous for humans** (SAC T3 / `alpine_hiking`+,
  "difficile/vertigineux", via ferrata, fixed cables/ladders, or a named
  hazardous surface like scree or scrambling): **blocks** the audit — the
  trail stays a candidate. This is the exposure/surface positive signal, and
  such a trail should not be published as a route-audited dog walk.

### 3. Heat/shade — the one safety-*data* gate

Still needs a citable source describing canopy/exposure, because
`shadeCoverage` feeds the match %. This gate exists to keep that input real,
not to pronounce the trail hot or cool — the score does that per dog.

### 4. Display advisories — never block

Water **potability**, **livestock/patou presence**, **leash rules**, and the
"no official danger marking" nuance for exposure. These stay visible to the
owner and, where they are quantitative (water presence, shade), flow into the
match %, but they never gate the audit. Water **presence** is resolved for
the record (mapped points at real coordinates, or a documented "no water on
route") but only so the score and the advisory are accurate — not as a
severity judgment.

**One thing to strengthen, not loosen:** a long or hot route with no mapped
water is the single interaction that most often harms dogs. It passes the
water gate by default, so it must surface as a **visible warning** and must
lower the match % — never sit silently behind a green check. `mapped absence
of a hazard is never, by itself, evidence the hazard is absent` still holds.

### 5. Content enrichment — required to publish as route-audited

The gate checks above establish that the data is *trustworthy*; enrichment
establishes that the listing is *useful*. A raw import ships with robotic
auto-text — desc "An X km route near Y, imported from the OpenStreetMap
hiking network…", tips "Imported route — … not yet been walked." A
route-audited trail must **replace that boilerplate with genuine,
trail-specific content**:

- a real **description** of the route (character, scenery, what to expect);
- **dog notes** — leash/access as known, plus any advisory (livestock/patou,
  no-water warning) the audit surfaced;
- **terrain, shade, and water** detail written out, not left as generic
  labels;
- **key waypoints / decision points** where the route needs them.

Each added *fact* still needs a citable source (the "Sentier du Four" pattern
in `trails-data.js` — leash and livestock facts sourced from Decathlon
Outdoor and the Haute-Savoie department fiche); descriptive colour does not,
but must not assert facts it can't support. Because enrichment is authored,
this is the part of the route-audit that is **not** mechanizable — the gate
checks can be batch-run, but a human writes the content before the trail
publishes as route-audited. Deeper enrichment (a licensed photo, richer
tips) can keep accruing afterward, and is expected at the `dolopaws-walked`
tier.

When every gate passes **and** the listing is enriched, set
`tier: 'route-audited'`, retain the original `source: 'osm'` provenance, and
record the completed checks. Reaching `tier: 'dolopaws-walked'` is a
separate, stronger step that requires a human to walk it. A trail that fails
the audit — or is data-clean but not yet enriched — stays
`tier: 'under-review'` (still shown, still flagged unvetted) until finished,
or is removed on a hard disqualifier.

## Source hierarchy — what counts as citable

| Source | Counts as citable for... | Never sufficient alone for... |
|---|---|---|
| OSM tags (`sac_scale`, `surface`, `leash`) | Terrain/surface baseline, orientation | Exposure, livestock, heat/shade, dog access — OSM is rarely dog-specific and "not tagged" ≠ "not present" |
| Official/regional portal (park authority, tourism board, department fiche — the `website` field on imported trails) | Any fact the source states explicitly and specifically (e.g. "dogs on leash, cattle graze June–Sept") | Anything the source doesn't mention — silence isn't clearance |
| Recent, dated, specific trip reports (Waymarked Trails talk, AllTrails/Komoot comments, forums) | Corroborating or overriding a stale official source, especially for conditions that change season to season (water flow, livestock presence, washed-out sections) | A single report older than ~2 years, or one that doesn't name the specific hazard |
| Your own field visit | Everything — a field visit resolves all categories at once and is the only source that can positively confirm shade/exposure conditions no document states | — |

Rule of thumb: if the only source for a fact is OSM, write it as unverified
(current behavior for imported trails). If you have one non-OSM citable
source per hazard category, `curated: true` is defensible. If you have
none, leave it `curated: false` even if OSM made the trail look complete.

## Per-hazard checklist

Same categories `trail-trust.js` already renders (`waterAssessment`,
`heatAssessment`, `exposureAssessment`, `livestockAssessment`), plus surface
hazards and dog access, which aren't currently individually broken out.

- **Water** — resolves on **presence, not potability**. If one or more water
  points are mapped and confirmed at their real coordinates (traced to
  `water-sources-all-regions.geojson`, with `osmId` + `lat`/`lng`), the water
  check passes. A trail with no mapped water also resolves — as a documented
  "no water on route, carry a full supply" state. We no longer require a
  source proving current flow or potability to graduate. **Displayed
  guidance still warns** the owner not to assume a mapped point is flowing or
  safe to drink — that caveat stays in `trail-trust.js` wording; it just is
  not a graduation blocker.
- **Heat & shade** — does a source describe canopy/exposure (forest vs open
  ridge), not just the season? `shadeCoverage` should reflect what a source
  says, not a guess from elevation.
- **Exposure** — flagged **only when the trail is officially marked dangerous
  for humans**: a high SAC scale (`sac_scale` T3 / `alpine_hiking` or above),
  an official difficulty of "difficile"/"vertigineux," via-ferrata sections,
  or fixed cables/ladders. An easy- or family-rated trail with none of these
  passes the exposure check. This is desk-verifiable from OSM `sac_scale` and
  the official fiche, and the importer already screens out T3+/via-ferrata.
  Set `exposure: true` only when such a marking exists; otherwise the check
  is satisfied.
- **Livestock** — **not a hazard gate.** It fails only when the trail lies in
  a zone that prohibits dogs (national reserve, RNCFS, other protected area
  where dogs are banned even on a leash). That case is a **removal**, not a
  blocker — see the `BANNED`/`REMOVED` entries in `PROMOTED_RELATIONS`. For a
  trail with no such prohibition the check passes. Grazing livestock and
  guardian/patou dogs are no longer required evidence to graduate; where an
  official source *does* mention them, keep an advisory leash line in the
  displayed guidance (the enriched "Sentier du Four" pattern), but do not
  block on it.
- **Surface hazards** — flagged **only when a known hazardous surface is on
  record**: scree, loose rock, scrambling sections, or fixed cables/ladders,
  from OSM `surfaces`/`sac_scale` or an official description. Sparse or
  absent surface data is *not* a blocker — a trail with no hazardous surface
  on record passes. Populate `surfaceHazards` only with hazards a source
  actually names; do not invent footing detail to fill the gap.
- **Dog access / leash rules** — is there an explicit rule (leash required,
  seasonal restriction, banned outright)? A protected-area or no-dogs
  finding is a **removal**, not a downgrade — see the `BANNED`/`REMOVED`
  entries in `PROMOTED_RELATIONS` in `scripts/promote-osm-trails.js`.

## Tracking progress: the `verified` field

Prose comments (`// Facts from Decathlon Outdoor...`) are the human-readable
record, but nothing can query them — there's no way to ask "which trails
still need their livestock check?" without re-reading every comment. Each
trail entry can carry a small structured field alongside the comment so
progress is machine-readable and survives across sessions:

```js
"verified": {
  "categories": ["livestock", "surfaceHazards"],  // subset of the 6 below, checked against a non-OSM source
  "sources": ["Decathlon Outdoor — Chemin des Fours", "Dept. Haute-Savoie fiche"],
  "date": "2026-07-14"
}
```

The six canonical category names (match the checklist above and the keys
`check-trail-sources.js` reports on): `water`, `heat`, `exposure`,
`livestock`, `surfaceHazards`, `access`.

- Absent `verified` field = no category-by-category source review is recorded.
- `categories` only ever grows via real verification work — never add a
  category you didn't actually check against a listed source.
- `source` records how the trail entered the catalogue. `curated: false` means
  it has not graduated; `curated: true` means it passed the full standard.
  Only a record with all six safety categories and all four presentation/data
  checks may be described to visitors as verified.
- Add `reviewedAt`, `reviewedBy`, and route-specific `sourceLinks` so the
  visitor can inspect the dated review record rather than seeing a generic
  list of data providers.
- The prose comment and the `verified` field should agree — write both in
  the same edit, the comment for a human skimming the file, the field for
  the script.

## Tracking graduation: the `graduation` field

`verified.categories` records the six safety checks. `graduation` combines
those with the four presentation/data checks required before an imported trail
can become verified:

```js
graduation: {
  status: 'in-progress',
  required: ['photo','route','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access'],
  completed: ['photo','route','mapPoints','elevation'],
  blockers: {
    water: 'Mapped locations exist, but current flow is not confirmed.'
  }
}
```

- A check enters `completed` only when its evidence and source are recorded.
- `blockers` must explain why each unresolved check cannot yet pass.
- `status: 'verified'` is valid only when all ten required checks are complete.
- Until then the trail remains `curated: false` and its rating remains an
  estimate, even if its route line and headline facts are correct.
- No-source-found is a blocker, not a successful check.

## Procedure

1. Run `npm run check:trail-sources` (see below) to get a worklist of
   imported trails, each with its OSM surface cross-check, its official
   portal / Waymarked Trails links, and its verification progress
   (`categories` already checked vs. still missing) — this replaces
   manually hunting for each trail's OSM relation, website, and prior notes.
2. For each trail, open the official portal link and search recent trip
   reports for the hazard categories still missing. Note what each source
   actually says (or doesn't).
3. Fill in only what a source supports. Leave the rest unknown — an
   unverified field beats a guessed one.
4. Validate photo rights, geometry, exact waypoint coordinates and elevation;
   record those four checks in `graduation.completed` only when they pass.
5. Add newly-resolved safety category names to `verified.categories`, the
   source(s) to `verified.sources`, and today's date — plus the matching
   dated prose comment above the entry.
6. Mirror every supported safety category in `graduation.completed`. If all
   ten checks pass, set `graduation.status: 'verified'` and `curated: true`.
   Otherwise keep the trail imported and list the blockers.
7. If a source rules the route out for dogs (protected area, mandatory
   off-leash zone, alpine-grade terrain), remove it from `trails-data.js`
   and add its relation ID to `PROMOTED_RELATIONS` with a `BANNED`/`REMOVED`
   comment so the importer never re-adds it.

## `scripts/check-trail-sources.js`

Cross-references `trails-data.js` + the imported (`osm-trails*-data.js`)
trails against the raw OSM properties already fetched into
`dog-friendly-routes*.geojson` (`surfaces`, `website`, `waymarkedtrails`,
`sac_scale`, `leash`, `dogFriendlyNotes`). It does not call any external
API — everything it reports was already pulled by `fetch-dolomites-trails.js`
/ `fetch-dog-friendly-routes.js`. It flags:

- surface data that disagrees with the stored `terrainRank`/`surfaceHazards`,
- trails with no official portal link at all (harder to verify — plan on a
  trip report or field visit instead),
- OSM `leash`/`dogFriendlyNotes`/`sac_scale` tags that exist but aren't
  reflected in the trail entry, in case a re-fetch has picked up tagging
  that wasn't there before,
- verification progress from the `verified` field: which of the six
  categories are already checked and which remain, so you can pick a trail
  back up without re-reading its whole history.

It does not and cannot check exposure, heat/shade, or livestock — those
have no reliable OSM tagging in this region and stay a manual, source-cited
judgment call per the checklist above.

```
npm run check:trail-sources                # imported trails only, all regions
npm run check:trail-sources -- --id osm-123162
npm run check:trail-sources -- --include-curated   # sanity-check curated trails too
```
