# DATA-02 — Unified production trail validation

**Status:** Complete

**Decision date:** 2026-07-28

## Outcome

Every production trail source now passes through one legacy-to-canonical
adapter and the DATA-01 validator before a static trail page can be generated.

Run:

```text
npm run validate:production-trails
```

The command:

1. loads `trails-data.js`, both OSM trail datasets, trail audits, and region
   assignments in one isolated runtime;
2. adapts every source object to canonical schema `1.0.0`;
3. makes unknown values explicit;
4. validates each canonical record;
5. checks catalog-wide ID and slug uniqueness;
6. classifies broken or unrealistic routes as drafts;
7. writes `data/generated/trail-validation-report.json`;
8. exits non-zero for schema or catalog errors.

The static page generator uses the same loader, adapter, validator, slugs, and
publication state. It cannot generate a page from a record held as a draft.

## Production sources

The unified source list is maintained in
`scripts/load-production-trails.js`:

- `trails-data.js`;
- `osm-trails-data.js`;
- `osm-trails-savoy-data.js`;
- `trail-audits.js`;
- `regions-config.js`.

Adding another production trail source requires adding it to this list. The
validator and generator then receive it together.

## Legacy adapter

`scripts/trail-adapter.js` performs the explicit legacy-boundary conversion.

### Coordinates

Legacy paths use:

```text
[latitude, longitude]
```

Canonical GeoJSON uses:

```text
[longitude, latitude]
```

Every path position, center, trailhead, and derived waypoint passes through
that conversion. Canonical validation then checks latitude and longitude
ranges and reports the record ID plus JSON Pointer.

### Slugs

Slugs are assigned once by the canonical catalog:

1. normalize the trail name;
2. if it collides, append the stable trail ID;
3. fail if the resulting canonical catalog still contains a duplicate.

The generator no longer has an independent slug algorithm.

### Geometry and route type

- Fewer than two positions is invalid.
- Exact closed paths become `loop`.
- A path measuring approximately half the declared distance becomes
  `out-and-back`; this preserves known round-trip records without inventing
  missing return geometry.
- Other open paths use `unknown`.
- A segment jump over 1 km prevents publication.

The source record is retained when publication is blocked.

### Metrics

The adapter normalizes:

- distance in kilometres;
- ascent and descent in metres;
- duration in minutes;
- elevation-profile bounds in metres;
- terrain rank into canonical difficulty.

Duration ranges use their midpoint. `H:MM` values are parsed as clock
durations. Missing values become `null` and are listed in `unknownFields`.

Initial publication limits are:

- distance: no more than 50 km;
- ascent: no more than 4,000 m;
- duration: no more than 24 hours.

Values outside those limits remain canonical draft records and are reported.
The broader schema bounds still reject impossible numeric input.

### Sources and verification

Existing source links and OSM route sources become structured canonical source
records. A source-less curated legacy record receives an explicitly labelled
`legacy` provenance record; this preserves origin without pretending an
external review exists.

Category values are:

- `verified` only when the legacy evidence record or completed graduation
  names that category;
- `unreviewed` when a structured value exists without completed review;
- `unknown` when the value itself is absent.

The adapter does not convert “present in the old object” into “verified.”

### Waypoints and unknowns

Legacy water entries that contain only a kilometre marker receive a coordinate
interpolated along the stored route. Their status remains `mapped` unless the
water category passed review.

All `null` and literal `unknown` values under canonical data sections are
collected into `unknownFields`. The shared DATA-01 validator confirms both
directions:

- every unknown must be declared;
- every declared pointer must resolve to an unknown.

## Failure behavior

Schema and catalog errors stop the command and generation. Examples include:

- duplicate ID or slug;
- invalid latitude or longitude;
- malformed or missing geometry;
- missing canonical source;
- invalid enum or verification transition;
- unrealistic schema value;
- undeclared unknown.

Errors use:

```text
trail-id/json/pointer: explanation
```

Publication-quality failures that preserve a structurally valid record create
a draft with explicit reasons. Drafts do not generate public pages.

## Current production result

On 2026-07-28:

- source records: 164;
- canonical schema-valid records: 164;
- published records: 143;
- held drafts: 21;
- schema/catalog errors: 0.

Twenty records contain a segment jump over 1 km. Two records exceed the 50 km
publication limit; one of those also contains a large geometry jump.

The exact IDs, points, distances, and reasons are stored in
`data/generated/trail-validation-report.json`.

The 21 generated HTML pages were removed from public generation. Their source
records were not deleted, so a corrected route automatically returns after it
passes validation and generation.

## CI and generation

The repository validation workflow runs on pushes and pull requests and checks:

- production trail adaptation and validation;
- canonical examples;
- the test suite;
- static links.

The scheduled page-generation workflow runs production validation before
writing or committing pages. The monthly OSM promotion workflow also validates
newly promoted data before committing it.

## DATA-02 acceptance

- All production sources use one loader, adapter, validator, and command.
- Every record becomes a canonical record or produces a field-specific error.
- IDs and slugs are unique.
- Coordinates, geometry, metrics, sources, verification, and unknowns are
  enforced.
- Broken and unrealistic routes cannot enter generated pages.
- A versioned report identifies every held record and reason.
- CI validates before generated trail publication.

## Follow-on work

1. Repair the 21 held routes, prioritizing initial beta-region candidates.
2. Replace legacy provenance-only records with dated external source evidence.
3. Make the interactive catalog consume canonical records in DATA-03 and
   SCORE-02; DATA-02 currently gates generated pages.
4. Add route-specific geometry tolerances only through reviewed fixtures,
   never by silently raising the global jump limit.
