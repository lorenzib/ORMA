# POI-01 — Lazy nonessential map overlays

Status: complete (2026-08-11)

## Loading boundary

The route catalogue, selected route geometry, trailhead, map controls, and
location controls are the first map workload. Nonessential planning context is
scheduled only after the browser becomes idle (with a bounded fallback):

- regional drinking-water points;
- huts, rifugi, bars, cafés, and restaurants;
- dog-route overlays;
- lift lines and station markers; and
- nearby detail-page POIs.

Trail-detail lift geometry now joins the same idle task as nearby POIs. The
homepage no longer creates every lift line and roughly 1,400 station marker
elements during initial map construction.

## Interaction correctness

Layer controls exist before secondary datasets arrive. A shared marker array
and a small `sync` method apply the current Lift toggle state as soon as late
lift data is registered. Both lift lines and labels belong to the Lift layer;
the prior mismatch—hidden labels with visible lines—is removed.

The basemap's own transit features require no DoloPaws dataset download.
Optional Overpass enrichment is already initiated only after a user clicks a
map feature, so it remains request-driven rather than part of initial loading.

## Failure behaviour

Secondary POI fetch failures are non-blocking. The trail, route facts, map,
offline package and hike controls remain usable without any of these layers.

## Evidence

- `performance-loading.test.js` locks both idle boundaries and late lift-state
  synchronization.
- Regional POI URLs remain governed by DATA-03.
- Mobile budgets remain governed by PERF-01/PERF-02.

