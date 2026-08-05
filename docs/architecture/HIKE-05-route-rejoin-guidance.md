# HIKE-05 — Route rejoin guidance

**Status:** Carezza and Alpe di Siusi mapped-footpath pilots implemented in
code; physical-device validation and broader rollout remain open.

## Product behaviour

A hiker with a usable GPS fix near, but not on, the route sees **Find closest
trail point** when a packaged walking network is available. The control appears
before DoloPaws makes a stronger off-route claim, so someone who can already see
that they need help does not need to wait for an alert. Selecting it matches the
current fix to the packaged network and, when a connected route exists, the
online and offline pilot maps show:

- a solid blue route following mapped footpaths;
- the route distance to the reachable trail node;
- an orange rejoin target on the DoloPaws trail; and
- a reminder to check local signs and closures.

The previous dashed geometric line has been removed. If the GPS fix cannot be
matched to a nearby mapped footpath, or that component does not connect to the
trail, DoloPaws says that no connected mapped path was found and draws no
route. Guidance remains suppressed for weak or stale fixes and when the user
is more than two kilometres from the packaged corridor.

Separately, at least three reliable fixes sustained for 20 seconds are still
required before DoloPaws automatically says that the hiker appears off route.
That confirmation shows the measured warning and the same rejoin control; it
does not silently start navigation. Returning close to the route removes the
control and any active rejoin line.

## Packaged graph

`scripts/build-offline-footpath-network.js` deterministically creates each
graph from its retained OpenStreetMap bounding-box extract. Carezza contains
224 nodes, 223 edges, and 95 trail nodes. Alpe di Siusi contains 1,367 nodes,
1,372 edges, and 466 trail nodes. Both use the same 12-metre trail-matching
rule and fail-closed router.

The build excludes ways or barrier nodes tagged with private/no pedestrian
access, `foot=no`, `dog=no`, and SAC scales above ordinary mountain hiking.
Allowed edges cover mapped footways, paths, pedestrian ways, tracks, steps,
and low-speed access roads. OpenStreetMap attribution and ODbL information
remain in the package.

These rules make the graph routable; they do not prove that a mapped path is
currently open or suitable for every dog. The interface therefore calls it a
“mapped path,” retains local-sign and closure warnings, and does not claim
emergency-navigation reliability.

## Local router

`footpath-router.js` is dependency-free and shared by the online trail page and
downloaded application. It:

1. snaps the current fix only when it is sufficiently close to a mapped edge;
2. uses the GPS accuracy to cap the permitted snap distance;
3. calculates the lowest-cost connected graph route to any trail node;
4. returns the full path geometry, distance, and target; and
5. returns `null` rather than inventing a connection.

No GPS position or route history is persisted by this calculation. The online
pilot page fetches its own graph, while each offline package checksum-verifies
the shared router and trail-specific graph before making them available.

## Verification

Automated tests cover shortest-path selection, path snapping, disconnected and
malformed graphs, and real Carezza and Alpe di Siusi side-path fixtures. Package
tests verify the required resources, explicit rejoin controls, sizes, hashes,
load order, and removal of the straight-line instruction.

Before marking HIKE-05 fully complete, run controlled Carezza and Alpe di
Siusi tests on the iPhone and an Android device in normal and airplane modes.
Testing must confirm that the button appears only with a usable nearby fix, the
blue path aligns with visible paths and signs after selection, reroutes as fixes
move, disappears after rejoining, and fails closed near closures, barriers,
water, and unmapped ground. No tester should deliberately leave a safe marked
path.
