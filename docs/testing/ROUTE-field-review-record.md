# Beta route field-review record

**Status:** Protocol ready; Carezza and Alpe di Siusi reviews pending.

## Purpose

Confirm on the ground that each downloadable beta route matches its packaged
geometry and that its essential access and dog-safety statements do not create
false confidence. A successful cache or GPS test does not prove that the mapped
route is currently walkable.

## Safety boundary

- Review only in suitable weather and daylight on a familiar, low-risk route.
- Do not leave a marked path or cross a closure to test ORMA.
- Stop for a closure, unsafe surface, livestock conflict, weather deterioration,
  incorrect route, or any uncertainty that makes continuing inappropriate.
- ORMA is not emergency navigation. Carry the normal local map and safety
  equipment for the route.
- Do not publish exact private locations or identifiable bystander information.

## Review procedure

Complete one record per route and package version.

1. Before departure, record the package version, reviewer, date, weather, and
   the official/local source used to check access or closures.
2. Confirm the displayed trailhead is a lawful and practical place to join the
   route; record any access restriction or seasonal limitation.
3. Walk the intended route without deliberately testing unsafe alternatives.
   Confirm the packaged line follows the marked route closely enough to avoid a
   wrong-turn instruction at each meaningful junction.
4. Record whether the route is actually a loop and whether either direction is
   reasonable. Note any section where one direction should not be implied.
5. Check the route surface, exposed sections, livestock context, shade/heat
   context, and water statements. Record `Unknown` rather than inferring a fact
   from a single visit.
6. Confirm the offline route, trailhead, warnings, attribution, and approximate
   elevation profile remain understandable without a network connection.
7. Record every material mismatch as a defect. Do not change the manifest to a
   field-verified state until all release-blocking defects are fixed and the
   affected part of the route is reviewed again.

## Lago di Carezza Loop

| Field | Result |
|---|---|
| Trail ID | `lago-carezza` |
| Package version | `2026.09.05-beta.18` |
| Reviewed at (ISO date/time and timezone) |  |
| Reviewer |  |
| Weather and recent conditions |  |
| Access/closure source and checked time |  |
| Trailhead lawful and practical | Pass / Fail |
| Packaged geometry follows marked route | Pass / Fail |
| Meaningful junctions unambiguous | Pass / Fail |
| Loop and direction representation accurate | Pass / Fail |
| Surface and exposure statements accurate | Pass / Fail / Unknown |
| Livestock statements accurate | Pass / Fail / Unknown |
| Shade/heat statements accurate | Pass / Fail / Unknown |
| Water statements accurate | Pass / Fail / Unknown |
| Offline safety context understandable | Pass / Fail |
| Defect IDs and notes |  |
| Overall result | Pass / Fail |

## Alpe di Siusi Meadow Loop

| Field | Result |
|---|---|
| Trail ID | `alpe-siusi` |
| Package version | `2026.09.05-beta.5` |
| Reviewed at (ISO date/time and timezone) |  |
| Reviewer |  |
| Weather and recent conditions |  |
| Access/closure source and checked time |  |
| Trailhead lawful and practical | Pass / Fail |
| Packaged geometry follows marked route | Pass / Fail |
| Meaningful junctions unambiguous | Pass / Fail |
| Loop and direction representation accurate | Pass / Fail |
| Surface and exposure statements accurate | Pass / Fail / Unknown |
| Livestock statements accurate | Pass / Fail / Unknown |
| Shade/heat statements accurate | Pass / Fail / Unknown |
| Water statements accurate | Pass / Fail / Unknown |
| Offline safety context understandable | Pass / Fail |
| Defect IDs and notes |  |
| Overall result | Pass / Fail |

## Pass and stop rules

`ROUTE-FIELD-REVIEW` passes only when both route records have an overall `Pass`,
their review time and reviewer are recorded, and no release-blocking mismatch is
open. `Unknown` is acceptable only for a non-claimed contextual factor; it must
not be converted into a positive safety statement. A wrong route, unlawful
trailhead, missed closure, misleading junction, or material access mismatch is
a P0 release defect for that package.
