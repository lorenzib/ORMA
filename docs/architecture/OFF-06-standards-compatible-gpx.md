# OFF-06 — Standards-compatible GPX export

**Status:** Complete in code; production export/import acceptance pending
(2026-08-12)

## Outcome

A signed-in DoloPaws user can export the current trail as a GPX 1.1 file from
the trail-detail hero. A guest who selects **Export GPX** enters the existing
bounded login handoff and returns to the same trail; export starts only after
authentication succeeds.

## File contract

`gpx-export.js` creates a local file without sending route or location data to
another provider. The document contains:

- GPX 1.1 namespace and schema declaration;
- DoloPaws as creator;
- trail name and export timestamp;
- one trailhead waypoint, using the curated start point when available and the
  first route coordinate as an explicit fallback;
- one track segment preserving the canonical `[latitude, longitude]` path
  order; and
- a description warning that the file contains route geometry only.

Invalid coordinates are omitted. Export fails truthfully if fewer than two
valid path points remain.

## Safety boundary

GPX is a portability fallback, not an offline DoloPaws package. It does not
carry current access, hazard reports, weather, water confidence, dog profile
matching, or other safety context. Both metadata and the post-download message
state this limitation.

## Verification

`gpx-export.test.js` parses a representative export independently with the
browser XML parser, checks the GPX namespace, waypoint, ordered track points,
XML escaping, invalid-geometry rejection, filename sanitization, and the
account-intent UI wiring.

The production browser and independent-navigation-app boundary must be recorded
with `docs/testing/OFF-06-gpx-acceptance.md`. Button visibility or a successful
unit test alone does not close the `GPX-AUTHENTICATED-EXPORT` readiness gate.
