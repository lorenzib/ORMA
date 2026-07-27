# DATA-01 — Canonical versioned trail schema

**Status:** Complete

**Decision date:** 2026-07-27

## Outcome

Curated and imported trails now have one explicit versioned contract:

- JSON Schema: `schemas/trail.schema.json`
- Curated example: `data/examples/trail.curated.example.json`
- Imported example: `data/examples/trail.imported.example.json`
- Domain validator: `scripts/trail-schema.js`
- Validation command: `npm run validate:trail-schema`

This task defines the contract and validates representative records. DATA-02
will migrate and enforce it across every production trail source.

## Coordinate rule

All canonical positions use GeoJSON coordinate order:

```text
[longitude, latitude]
```

This differs from the current `trails-data.js` and generated
`osm-trails-data.js` presentation objects, whose `path` arrays use
`[latitude, longitude]`.

Adapters must perform that conversion at the legacy boundary. New canonical
data must never use the legacy order.

## Required top-level fields

Every record contains:

- `schemaVersion`: contract version;
- `recordVersion`: incrementing version of this trail record;
- `id` and `slug`;
- `origin`: `curated` or `osm`;
- `lifecycle`: `draft`, `published`, or `retired`;
- `name` and normalized `region`;
- GeoJSON `geometry`, `center`, and `trailhead`;
- normalized `metrics`;
- dog-specific `suitability`;
- typed `waypoints`;
- user-facing `content`;
- structured `sources`;
- `verification` tier, state, reviewer, date, and category states;
- category-level `freshness` dates;
- import/generation `provenance`;
- `unknownFields`.

Unknown is data. It is not inferred to mean safe, absent, false, zero, or
reviewed.

## Units and enums

Canonical units are:

- distance: kilometres;
- ascent, descent, and elevation: metres;
- duration: minutes;
- shade: percentage from 0 through 100;
- coordinates: decimal degrees in `[longitude, latitude]` order.

Core enums are defined by the JSON Schema and mirrored by the domain validator.
Unknown enum values use the literal `unknown`. Nullable observations use
`null`.

## Unknown-value rule

Every `null` or literal `unknown` within a data-bearing section must also be
listed as a JSON Pointer in `unknownFields`.

Example:

```json
{
  "metrics": {
    "descentM": null
  },
  "unknownFields": [
    "/metrics/descentM"
  ]
}
```

This makes incomplete data machine-queryable and prevents presentation code
from silently turning missing evidence into a favourable claim.

`unreviewed` is distinct from `unknown`:

- `unknown`: the underlying value or rule is not known;
- `unreviewed`: a value exists but DoloPaws has not reviewed the evidence;
- `verified`: the evidence category passed the declared review process.

## Geometry

Version 1 permits GeoJSON `LineString` and `MultiLineString`.

- Every line contains at least two valid positions.
- A record declaring `routeType: loop` with a `LineString` must have identical
  first and last positions.
- The trailhead may be reviewed, a mapped suggestion, or explicitly unknown.
- A mapped trailhead is not presented as field-reviewed.

## Source and freshness model

Sources are structured records rather than a single free-text URL. Each source
declares:

- provider and label;
- source kind;
- URL when available;
- retrieval and observation dates independently;
- evidence categories;
- licence when known.

Freshness is split into geometry, safety, and access dates. Updating map
geometry does not silently refresh livestock, water, access, or hazard claims.

## Verification rules

Verification tiers are:

1. `imported`
2. `mapped`
3. `route-audited`
4. `field-verified`

Statuses are `unreviewed`, `in-progress`, and `verified`.

A record may use status `verified` only when:

- reviewer and review date are present; and
- route, water, heat, exposure, livestock, surface-hazard, and access
  categories are all verified.

The `field-verified` tier additionally requires verified status.

## Versioning and migration policy

`schemaVersion` follows semantic versioning:

- patch: documentation or validation clarification that accepts the same data;
- minor: backward-compatible optional capability;
- major: required-field, meaning, coordinate, unit, or enum changes that need
  migration.

`recordVersion` increments whenever a published trail's canonical data changes.
Offline packages store the trail ID, schema version, and record version so
stale or incompatible packages can be identified.

Migration rules:

1. Never rewrite a source file silently during a read.
2. Convert into a new canonical record through a named adapter or migration.
3. Preserve source identifiers and retrieval dates.
4. Convert legacy `[latitude, longitude]` paths explicitly.
5. Map missing legacy observations to `null` or `unknown` and list them in
   `unknownFields`.
6. Validate before publishing or packaging.
7. Major-version records require a compatible reader or a clear unsupported
   state; they must not be guessed into an older format.

## Legacy mapping

| Legacy field | Canonical field |
|---|---|
| `path: [[lat, lng]]` | `geometry.coordinates: [[lng, lat]]` |
| `lat`, `lng` | `center: [lng, lat]` |
| `distance` | `metrics.distanceKm` |
| `elevation` | `metrics.ascentM` |
| `hours` | `metrics.durationMinutes` |
| `shadeCoverage` | `suitability.shadePercent` |
| `heatRisk` | `suitability.heatRisk` |
| `exposure` | `suitability.exposure` |
| `surfaceHazards` | `suitability.surfaceHazards` |
| `waterSources` | typed `waypoints` |
| `sourceLinks` | structured `sources` |
| `reviewedAt` / `verified` | `verification` and `freshness` |
| missing value | explicit `null`/`unknown` plus `unknownFields` |

## DATA-01 acceptance

- Required, optional, nullable, and derived semantics are documented.
- Units, coordinates, enums, sources, and freshness are explicit.
- Curated and imported examples validate.
- Unknowns are explicit and mechanically enforced.
- Schema and record versioning have a migration policy.

## Follow-on: DATA-02

DATA-02 must:

1. add adapters for all current trail sources;
2. validate every production record;
3. reject duplicate IDs/slugs, invalid geometry and unrealistic metrics;
4. update generators to emit the canonical contract;
5. run validation in CI before publishing generated trail pages.
