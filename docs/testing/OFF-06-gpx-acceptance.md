# OFF-06 — Authenticated GPX acceptance

**Status:** Protocol ready; one production export/import remains pending.

## Purpose

Confirm that the production account gate creates a portable Carezza GPX file
and that an independent navigation application can read the route. Automated
tests already validate GPX 1.1 structure and ordered geometry; this check covers
the browser download and third-party import boundary that unit tests cannot.

## Supported test case

- Trail: `https://www.app-orma.com/trail.html?id=lago-carezza`
- Account: signed-in, non-moderator test account
- Browser: record name and version
- Independent reader: record application and version; it must not be ORMA
- Expected filename: `lago-di-carezza-loop.gpx`

Do not record account credentials, precise current location, or unrelated
browsing data in the evidence.

## Procedure

1. Open the Carezza trail in a signed-out private window and select
   **Export GPX**. Confirm that ORMA requests login and does not download a
   file for the guest.
2. Complete login with the test account. Confirm that the browser returns to
   Carezza and starts exactly one GPX download.
3. Record the downloaded filename, byte size, and SHA-256 checksum. Retain the
   file only for this acceptance check.
4. Open the file in an independent GPX-capable navigation application.
5. Confirm that the application reports **Lago di Carezza Loop**, shows one
   trailhead waypoint, and renders a closed route around Lago di Carezza rather
   than a straight line, empty track, or route in another region.
6. Confirm that the imported route does not claim to contain ORMA hazard,
   weather, water-confidence, or dog-matching context.
7. Return to ORMA and confirm that the page remains usable and the signed-in
   account has not been logged out.

## Evidence record

| Field | Result |
|---|---|
| Tested at (ISO date/time and timezone) |  |
| Tester |  |
| Browser and version |  |
| Navigation application and version |  |
| Filename |  |
| Byte size |  |
| SHA-256 |  |
| Guest was gated without a download | Pass / Fail |
| Login returned to Carezza | Pass / Fail |
| Exactly one file downloaded | Pass / Fail |
| Trail name readable | Pass / Fail |
| Trailhead waypoint readable | Pass / Fail |
| Ordered closed route rendered near Carezza | Pass / Fail |
| Route-only safety boundary understood | Pass / Fail |
| ORMA session remained usable | Pass / Fail |
| Notes / defect IDs |  |

## Pass and stop rules

The `GPX-AUTHENTICATED-EXPORT` gate passes only when every row above is `Pass`,
the filename/size/checksum are recorded, and the independent application renders
the expected Carezza route. A login loop, duplicate download, empty or misplaced
track, unreadable file, missing waypoint, or misleading safety claim is a
release defect. Keep the ledger gate pending until the defect is fixed and the
entire procedure is repeated.

