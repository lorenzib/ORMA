# HIKE-01 — Durable active-hike session

**Status:** implemented.

## Outcome

Starting a hike creates one small, versioned record in local storage. Each
acceptable GPS fix replaces the previous progress snapshot. ORMA does not
store a breadcrumb trail or continuous latitude/longitude history.

The first reliable fix establishes the starting baseline wherever the hiker
joins the route. Later reliable movement accumulates as **distance walked since
Start**. It is not presented as distance from the recommended trailhead, and a
closed loop may be walked in either direction.

The record survives page refresh, browser closure, and loss of connectivity.
HIKE-02 provides the customer-facing restore, pause, resume, discard, expiry,
and missing-package flows that consume it.

## Stored contract

Storage key: `dolopaws-active-hike-v1`

- `schemaVersion`
- opaque `sessionId`
- `trailId`
- stable `packageId`
- account `ownerId`, or `null` for a guest
- `startedAt` and `updatedAt`
- state: `active`, `paused`, or `completion-pending`
- one `lastProgress` snapshot:
  - monotonic kilometres walked since Start
  - snapped path index
  - reported GPS accuracy
  - fix time

The session contains no latitude, longitude, GPS array, photo, note, or other
continuous location history.

## Write and failure policy

- A session is written when the user starts hike mode.
- Progress replaces the previous snapshot only for numeric GPS fixes reporting
  accuracy of 200 metres or better and no more than 2 kilometres from the
  route.
- Small changes inside the GPS accuracy envelope do not add distance. Implausible
  jumps and long gaps are ignored, and a restored session uses its first new fix
  only as a fresh baseline so a page reload cannot invent distance.
- Near the route, distance follows movement along the route geometry. Closed
  loops use the shortest change across the start/end seam, regardless of walking
  direction. Away from the route, conservative point-to-point movement is used.
- A GPS error after a fix changes the record to `paused`. Failure before the
  first fix removes the empty attempt.
- Ending after a fix changes the record to `completion-pending`.
- Explicit discard removes the record.
- A successfully written journal entry removes the record. A failed journal
  write leaves it available for later recovery.
- Storage access and quota exceptions return a result instead of interrupting
  the safety interface.

## Safe reads

The reader returns an explicit status:

- `empty`
- `ready`
- `corrupt`
- `incompatible`
- `unavailable`

Invalid JSON, missing fields, unsupported schema versions, invalid states, and
malformed progress never become an active session.

## Automated evidence

`hike-session.test.js` covers:

- the complete minimum record;
- replacement of the last progress snapshot;
- absence of continuous GPS history;
- corrupt and incompatible data;
- blocked storage reads and writes;
- paused and completion-pending states; and
- script ordering and hike-mode lifecycle integration.

`hike-distance.test.js` separately covers arbitrary starting points, both loop
directions, start/end seam crossing, GPS drift and jump rejection, and session
resume without a fabricated restart jump.

## Consumer

See `docs/architecture/HIKE-02-offline-restoration.md`.
