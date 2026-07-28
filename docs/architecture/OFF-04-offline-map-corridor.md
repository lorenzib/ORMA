# OFF-04 — Offline map corridor

**Status:** First beta corridor implemented and iPhone-validated; Android and
route-specific field validation remain open

**Implementation date:** 2026-07-28

## Decision

The first beta uses one bounded, locally rendered SVG corridor rather than
downloaded public map tiles. The render input is the committed OpenStreetMap
extract in `data/offline-map-sources/lago-carezza.osm`; the route overlay is the
committed package GeoJSON.

The manifest records a versioned `fixed-bounds-svg-v1` policy:

- geographic bounds come directly from the committed OSM extract;
- the render is fixed at 1200 × 1140 pixels;
- `scaleLevels: [1]` declares the single packaged render level; browser scaling
  does not fetch another map layer;
- the complete package must remain at or below 5 MB; and
- the route, map, and safety resources are mandatory.

The current `2026.07.29-beta.5` package is approximately 37 KB.

## Acceptance evidence

| OFF-04 criterion | Evidence | State |
|---|---|---|
| Corridor boundary and scale levels are deterministic | Tests compare manifest bounds with the committed OSM extract, dimensions with the SVG view box, and the declared single scale level. | Implemented |
| Package size has an enforced upper limit | The manifest declares 5 MB; validation rejects a package above it; integrity tests sum all resources. | Implemented |
| Route, trailhead, and essential safety points render in airplane mode | The required SVG contains the route and start marker; route and safety files are mandatory. The iPhone airplane-mode test passed. | Implemented; field review open |
| A missing optional layer does not hide the route | Both installer and offline reader skip a failed resource only when `required: false`; every current beta resource is explicitly mandatory. | Implemented |
| Provider attribution remains visible offline | Attribution is embedded in the SVG and repeated with the licence link in the offline shell. The iPhone visibility check passed. | Implemented |

## Integrity and failure behavior

The download controller verifies byte length and SHA-256 before committing each
resource. The offline reader repeats those checks when opening the package.
Missing or corrupt mandatory resources show the truthful “not ready offline”
failure state.

Future decorative or contextual layers may use `required: false`. Failure of
such a layer is tolerated, but the package can be called ready only while every
mandatory resource is present and verified.

## Remaining validation

OFF-04 must not be described as fully device-validated until:

1. the Android Chrome physical-device matrix passes;
2. the selected oldest supported device floors pass legibility checks; and
3. the Lago di Carezza route and safety content receive a dated field review.

Those open checks do not change the implemented fixed-corridor or integrity
contract.
