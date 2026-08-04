# HIKE-05 — Route rejoin guidance

**Status:** orientation milestone implemented in code; verified safe-path
routing and physical-device validation remain open.

## Product boundary

When DoloPaws has at least three reliable fixes sustained for 20 seconds
confirming that a user is off route, it
now identifies the nearest point on the stored trail geometry. The online hike
map and the Carezza offline package show:

- distance to that point;
- compass direction;
- an orange target on the trail; and
- a dashed orientation line from the current fix to the target.

The line is not presented as a walking route. The warning explicitly tells the
user to follow marked paths and not the straight line. DoloPaws suppresses this
guidance for weak or stale fixes and when the user is more than two kilometres
from the packaged trail corridor.

This is the earliest safe increment of HIKE-05. Claiming a navigable recovery
path requires a packaged, licensed routing graph with access, barrier, water,
and hazard constraints. That data is not currently present, so the application
must not infer that the geometric nearest point is safely reachable.

## Geometry contract

`route-rejoin.js` is a dependency-free module shared by the online hike mode
and downloaded package. It projects each route segment into local metres,
selects the nearest point on the segment rather than only a stored vertex, and
returns:

- target latitude and longitude;
- distance in metres;
- bearing in degrees and an eight-point compass direction;
- segment index and fractional position; and
- `routingMode: orientation-only`.

No GPS history or exact coordinate is persisted by this calculation.

## Offline contract

Carezza beta.12 includes `route-rejoin.js` as a required, checksum-protected
resource. Rejoin calculation and rendering use only the stored route GeoJSON,
map bounds, GPS fix, and shared accuracy policy. They make no network request.

## Remaining safe-path milestone

Before DoloPaws can say “follow this path back to the trail,” the offline
package contract must add a routable corridor and prove that it:

1. contains legal pedestrian paths and their direction/access constraints;
2. excludes water, cliffs, closed paths, barriers, and private access;
3. chooses the closest *reachable* trail point by route cost;
4. exposes “no safe route available” instead of drawing a guess;
5. fits the offline storage budget and licensing terms; and
6. passes controlled iPhone and Android airplane-mode tests on low-risk ground.

Full turn-by-turn and voice navigation remain outside the first beta. HIKE-05
is limited to short off-route recovery inside the downloaded corridor.

## Automated evidence

`route-rejoin.test.js` covers segment projection, endpoint selection,
multi-segment selection, invalid geometry, compass direction, and online script
ordering. Offline package tests require the shared module and verify its exact
size and checksum with every other required resource.
