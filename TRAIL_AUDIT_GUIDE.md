# ORMA trail audit guide

## Assignment

Review trails individually and use this process as the trail's route-audit —
its promotion from **under review** to **route-audited**. This applies to
**both regions, Dolomites and Savoy**; the checks are identical, only the
data files differ (see below). Complete one trail fully before moving to the
next, and work each region's under-review trails in a stable order (e.g.
alphabetical) so progress is resumable.

**Albanne** (`osm-14381570`, Savoy) is the worked example throughout this
guide: its route presentation has been audited, but it has not been promoted —
unresolved safety evidence keeps its rating estimated. Treat it as the model
for how a trail either passes all checks or carries clearly documented
blockers.

Never describe desk research as a field visit. A trail may still graduate from
a thorough desk review, but every check must be supported by named, appropriate,
current sources. An unsuccessful source search is a blocker, not verification.

## The ten graduation checks

A trail becomes verified only when all ten checks pass:

1. Photo/licensing
2. Route geometry
3. Exact map-point coordinates
4. Elevation profile and headline ascent
5. Water
6. Heat and shade
7. Exposure
8. Livestock and guardian dogs
9. Surface hazards
10. Dog access and leash rules

**A trail sits in one of three tiers, all shown to visitors: `under-review`
(imported OSM data, audit not yet run — shown but flagged unvetted, rating
estimated), `route-audited` (cleared this mechanism), or `dolopaws-walked`
(a human has walked it).** "Imported" is never a public label. This guide runs
the route-audit that promotes an under-review trail to route-audited. It verifies
data integrity and screens for hard disqualifiers — it does **not** judge how
dangerous the trail is; per-dog severity is the Layer-2 match %'s job
(`SCORING.md`), which models heat × distance × shade × water and the dog's
own profile. See "What the route-audit produces" and "Trail tiers" in
`VERIFICATION.md` for the full model. The ten checks play four roles, not one
flat list:

- **Data-integrity gates — hard blocks:** the four presentation checks
  (photo, geometry, map points, elevation). Wrong data means the trail stays
  a candidate.
- **Hard disqualifiers:** dogs prohibited (national reserve / protected area)
  → **remove** the trail; officially marked dangerous for humans (SAC
  T3+/`alpine_hiking`, "difficile/vertigineux", via ferrata, cables/ladders,
  or a named hazardous surface) → **block**. These are the exposure and
  surface positive signals.
- **Heat/shade — the one safety-data gate:** still needs a citable canopy/
  exposure source, because `shadeCoverage` feeds the match %.
- **Display advisories — never block:** water potability, livestock/patou
  presence, leash rules. Water *presence* is resolved for the record (mapped
  points at real coordinates, or a documented "no water on route") so the
  score and advisory are accurate — not as a severity call.

Alongside the gates, a fifth requirement: **content enrichment.** A
route-audited trail must replace the auto-generated import boilerplate (desc
"… imported from the OpenStreetMap hiking network…", tips "Imported route —
… not yet been walked") with genuine, trail-specific content — a real
description, dog notes, written-out terrain/shade/water detail, and key
waypoints. Each added fact still needs a citable source; descriptive colour
does not. This part is authored, not mechanizable: the gate checks can be
batch-run, but a human writes the content before the trail publishes.

A long or hot route with **no mapped water** passes the water gate but must
surface as a visible warning and lower the match %, never sit behind a silent
green check.

Until all applicable gates pass **and the listing is enriched**, keep
`tier: 'under-review'` (still shown, flagged unvetted), keep the rating
labelled estimated, and list the blockers. When the gates pass and the
content is written, set `tier: 'route-audited'`, record the completed checks,
and preserve `source: 'osm'` as provenance. `dolopaws-walked` is a separate,
stronger step requiring a human to walk the trail.

## Detailed checks for every trail

For each trail, verify all five areas below.

### 1. Photograph and attribution

- Identify whether the trail uses a genuine photograph, a generated image, a
  route diagram, or a placeholder.
- If a photograph is already used, trace it back to its source and confirm that
  ORMA has a defensible right to use it.
- Preserve the photographer's exact credited name and link to the original
  source or licence where available.
- Store the credit in the existing `imageCredit` structure.
- Do not copy a photograph merely because it appears on an official tourism
  page. A visible image is not automatically licensed for reuse.
- If no properly licensed image is available, set `imagePlaceholder: true` and
  do not invent a credit. The route diagram remains preferable to an
  unattributed photograph.

### 2. Route line on the map

- Confirm the trail has a `path` array with more than one coordinate.
- Confirm the line renders on `trail.html?id=<trail-id>` and that the map fits
  the entire route.
- Compare the stored geometry with the authoritative route source, normally:
  1. an official tourism or local-authority route page or map;
  2. the Waymarked Trails relation;
  3. the corresponding OpenStreetMap relation.
- Check that a loop actually closes and that a point-to-point route is not
  falsely presented as a loop.
- Look for geometry gaps, implausible straight segments, duplicated branches,
  or a path whose order jumps between disconnected pieces.
- Keep the full route geometry even when the official distance is rounded.
- Do not manually edit the generated OSM files — `osm-trails-data.js`
  (Dolomites) or `osm-trails-savoy-data.js` (Savoy). Corrections go in
  `trail-audits.js`.

### 3. Map icons and waypoint locations

- Every trail-specific marker must use a real latitude and longitude.
- Never position an icon by interpolating a rounded `km` value along the route.
  On loops this can put the icon on the wrong side of the trail.
- For mapped amenities, retain the source identifier, for example
  `osmId: "node/123"`, alongside `lat`, `lng`, `km`, and the display label.
- Trace water points to `water-sources-all-regions.geojson`.
- Trace huts and food locations to `huts-bars-all-regions.geojson`.
- Trace parking, bus stops, and lift access to the region's access-points
  file — `data/access-points.geojson` (Dolomites) or
  `data/access-points-savoy.geojson` (Savoy).
- Measure each amenity's distance from the route. Do not call a place “on the
  trail” when it is merely nearby.
- Where multiple mapped features represent one physical facility, avoid
  stacking duplicate trail-owned markers. The nearby-POI layer already
  clusters OSM points at their exact source coordinates.
- `trail.js` intentionally refuses to draw a trail-owned waypoint without
  explicit GPS coordinates and skips OSM-backed duplicates. Preserve this
  behaviour.

### 4. Elevation profile and headline ascent

- Confirm `elevationProfile` exists, contains ordered numeric samples, starts at
  kilometre 0, and ends at the trail's displayed distance.
- Confirm the profile renders and reports a plausible minimum and maximum.
- Compare the headline elevation gain with an official route figure whenever
  one exists.
- Prefer the official published ascent for the headline statistic. Elevation
  APIs can inflate cumulative gain through sampling noise.
- The profile can still use sampled terrain elevation, but its kilometre scale
  must align with the displayed route distance.
- Do not claim an elevation has been field measured unless that is genuinely
  the source.

### 5. Review record

- Add `reviewedAt` using `YYYY-MM-DD`.
- Set `reviewedBy: "ORMA route audit"`.
- Add a `routeAudit` object covering:
  - `photo`
  - `route`
  - `mapPoints`
  - `elevation`
- Add route-specific `sourceLinks`, using primary and authoritative sources
  wherever possible.
- The visitor-facing record should say “ORMA route audit” and show the
  date.
- Keep route-audit status separate from the six dog-safety checks in
  `verified.categories`. Do not add a safety category unless a route-specific
  source actually supports that category under `VERIFICATION.md`.
- Add a `graduation` record containing the ten required checks, completed
  checks, status, and a specific explanation for every blocker.
- A presentation audit is progress toward graduation, not a verified trail.
- The trail only graduates when every presentation and safety check passes.

## Where audited data belongs

Use `trail-audits.js` for human-reviewed corrections and metadata attached to
generated OSM trails. Add one object keyed by trail ID:

```js
'osm-123456': {
  distance: 7.7,
  elevation: 249,
  hours: '3.5',
  imagePlaceholder: true,
  reviewedAt: '2026-07-17',
  reviewedBy: 'ORMA route audit',
  routeAudit: {
    photo: 'No licensed trail photo is currently used; no credit is due.',
    route: 'Full route geometry present and checked against the official map.',
    mapPoints: 'Mapped points checked at their source GPS coordinates.',
    elevation: 'Profile present; headline ascent checked against the official figure.'
  },
  graduation: {
    status: 'in-progress',
    required: ['photo','route','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access'],
    completed: ['photo','route','mapPoints','elevation'],
    blockers: {
      water: 'Mapped points exist, but current flow and potability are not confirmed.'
    }
  },
  sourceLinks: [
    { label: 'Official route page', url: 'https://…' },
    { label: 'Waymarked Trails', url: 'https://…' },
    { label: 'OpenStreetMap contributors', url: 'https://…' }
  ]
}
```

Do not duplicate the entire generated trail record. Override only the fields
that were checked or corrected.

If the importer itself loses information needed by every future trail, improve
`scripts/promote-osm-trails.js` as well. The importer now retains exact POI
coordinates and OSM identifiers. Do not regenerate an entire region's
catalogue unless the resulting large change has been inspected carefully.

## Source hierarchy

Use sources in this order:

1. Official municipality, tourism office, park authority, lift operator, or
   departmental route page/map.
2. Waymarked Trails relation page.
3. OpenStreetMap relation and source POI nodes.
4. Current, route-specific reports only when an official source does not cover
   the fact in question.

Record what each source explicitly supports. Silence is not evidence that a
hazard, restriction, photographer credit, or facility does not exist.

For technical implementation questions, use project code and tests as the
source of truth. For current trail facts, use live authoritative sources and
record their URLs.

## Albanne current graduation status

Albanne demonstrates the difference between corrected data and verification:

- Official source: Les Karellis route 09.
- Official figures: 7.7 km, 249 m ascent, about 3.5 hours.
- The full OSM relation geometry is present and renders as a loop.
- The previous 468 m headline ascent was replaced because it conflicted with
  the official route record.
- The elevation profile remains present and now ends at 7.7 km.
- Six water-related features retain their exact OSM coordinates and node IDs.
- Incorrect markers derived only from rounded kilometre values are no longer
  drawn.
- OSM-backed points are left to the exact-coordinate nearby-POI layer, avoiding
  duplicate markers.
- No licensed trail photograph is used, so Albanne displays a placeholder and
  no photographer credit.
- Existing sources support the heat/shade pattern and dog access with seasonal
  forest-leash qualification.
- Albanne remains imported because current evidence does not yet resolve water
  availability, exposure, livestock/guardian dogs, or surface hazards.
- The page must show verification progress and retain an estimated rating until
  those blockers are resolved.

Reference files:

- `trail-audits.js`
- `trail.js`
- `trail-trust.js`
- `trail-blueprint.js`
- `scripts/promote-osm-trails.js`
- `scripts/generate-trail-pages.js`
- `VERIFICATION.md`
- `trail-audits.test.js`

## Audit workflow for each trail

1. Find the next under-review trail (either region) in your working order and
   record its trail ID and OSM relation.
2. Extract its current complete record from the trail datasets plus
   `trail-audits.js`.
3. Inspect the raw region GeoJSON route (`dog-friendly-routes.geojson` for
   Dolomites, `dog-friendly-routes-savoy.geojson` for Savoy) and its properties.
4. Find and read the strongest official route source.
5. Compare name, route type, distance, ascent, duration, official start, and
   route geometry.
6. Inspect every stored water, hut, food, parking, lift, and bus marker against
   its source dataset and exact coordinate.
7. Inspect the photograph and its reuse credit, or retain a placeholder.
8. Validate the elevation profile and correct the headline ascent when an
   authoritative source contradicts the calculated value.
9. Add the smallest necessary override to `trail-audits.js`.
10. Regenerate static trail pages.
11. Open the live local detail page and visually confirm the header, map line,
    markers/clusters, elevation chart, sources, and review date.
12. Run all required tests.
13. Promote the trail to route-audited only if all ten checks pass and it is
    enriched. Otherwise keep it under review and record exact evidence blockers.
14. Report what was corrected, whether the trail was promoted, what remains
    blocked, and name the next trail in your working order.

## Required validation

Run:

```text
npm test -- --runInBand
npm run test:static
npm run audit:trail-trust
npm run check:trail-sources -- --id <trail-id>
node scripts/generate-trail-pages.js
npm run test:static
```

Also inspect the generated `trails/<slug>.html` diff. Confirm that unrelated
trail pages did not change unexpectedly.

## Completion report template

For each trail, report:

- **Trail:** name and ID
- **Photo:** credited source, or placeholder/no reusable photo
- **Route:** present, corrected, or blocked—with source
- **Map points:** number checked, exact coordinates retained, duplicates or
  invalid points removed
- **Elevation:** profile status and official headline ascent comparison
- **Last reviewed:** date shown to visitors
- **Still unverified:** especially current water availability and dog-safety
  conditions
- **Validation:** tests and visual check performed
- **Next trail:** next under-review trail in your working order (note the region)

## Guardrails

- Do not invent trail facts, credits, coordinates, hazards, or dog rules.
- Do not mark a trail field-reviewed after a desk review.
- Do not treat an OSM-mapped fountain as proof that water currently flows or is
  potable.
- Do not use or copy a photograph without a clear reuse basis.
- Do not hand-edit generated OSM trail files.
- Do not remove a route merely because verification is incomplete. Remove it
  only when a reliable source establishes that it is unsuitable or prohibited
  for dogs, following `VERIFICATION.md`.
- Preserve unrelated working-tree changes.
- Do not commit or push unless explicitly requested.
