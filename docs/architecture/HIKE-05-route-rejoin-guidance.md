# HIKE-05 — Route rejoin guidance

**Status:** Carezza mapped-footpath pilot implemented in code; physical-device
validation and rollout to other trail packages remain open.

## Product behaviour

After at least three reliable fixes sustained for 20 seconds confirm that a
hiker is off route, DoloPaws tries to match the current fix to the packaged
walking network. If that network has a connected route back to the trail, the
online and offline Carezza maps show:

- a solid blue route following mapped footpaths;
- the route distance to the reachable trail node;
- an orange rejoin target on the DoloPaws trail; and
- a reminder to check local signs and closures.

The previous dashed geometric line has been removed. If the GPS fix cannot be
matched to a nearby mapped footpath, or that component does not connect to the
trail, DoloPaws says that no connected mapped path was found and draws no
route. Guidance remains suppressed for weak or stale fixes and when the user
is more than two kilometres from the packaged corridor.

## Packaged graph

`scripts/build-offline-footpath-network.js` deterministically creates the
Carezza graph from the retained OpenStreetMap bounding-box extract. The graph
contains 224 nodes, 223 edges, and 95 nodes lying within 12 metres of the
stored DoloPaws trail geometry. It adds about 11 KB to package beta.13.

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
Carezza page fetches the same graph, while the offline package checksum-verifies
the router and graph before making them available.

## Verification

Automated tests cover shortest-path selection, path snapping, disconnected and
malformed graphs, and a real Carezza side-path fixture. Package tests verify
the new required resources, sizes, hashes, load order, and removal of the
straight-line instruction.

Before marking HIKE-05 fully complete, run controlled Carezza tests on the
iPhone and an Android device in normal and airplane modes. Testing must confirm
that the blue path aligns with visible paths and signs, reroutes as fixes move,
disappears after rejoining, and fails closed near closures, barriers, water,
and unmapped ground. No tester should deliberately leave a safe marked path.
