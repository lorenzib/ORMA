# HIKE-02 — Restore, pause, and resume offline

**Status:** implemented in code; iPhone and Android physical validation remain
open.

## Outcome

An unfinished hike is no longer silently replaced after a refresh or browser
reopen. The interactive trail map offers explicit resume and discard actions.
While recording, the hiker can pause without finishing the hike and later
resume with the original start time and last saved progress.

The Lago di Carezza beta.9 package contains the same versioned session reader
and exposes resume, pause, and discard controls on the downloaded map. These
controls and GPS progress writes use only package resources and local storage,
so they remain available in airplane mode.

## Recovery decisions

`DoloPawsHikeSession.recoveryState()` returns one of:

- `empty`
- `ready`
- `expired`
- `corrupt`
- `incompatible`
- `owner-mismatch`
- `other-trail`
- `missing-package`
- `unavailable`

A session expires after 36 hours without an update. Expired, corrupt, and
incompatible records are never resumed automatically and are not silently
deleted. The user receives guidance and an explicit discard action.

When the interactive page is offline, it verifies that the matching downloaded
package is usable before offering resume. If it is missing, the record remains
intact and the page links to downloaded-map management.

## Online trail controls

- **Resume hike** restores the original start time, progress kilometres, and
  path index, then asks the browser for live GPS again.
- **Pause** stops GPS and the wake lock while keeping the session.
- **End hike** moves the session to `completion-pending`.
- **Discard hike** explicitly removes the local record.
- A session belonging to another trail links back to that trail.
- A session owned by another account is not exposed.

## Downloaded package controls

The verified offline package includes `/hike-session.js` as a mandatory,
checksum-protected resource. The offline shell:

- reads the session without a network call;
- shows the last stored progress;
- resumes GPS and replaces the last progress snapshot;
- pauses without completing;
- retains `completion-pending` state for later journal saving; and
- handles expired or damaged records with discard guidance.

It does not collect or persist a GPS breadcrumb history.

## Automated evidence

- The session contract tests cover clean, expired, corrupt, incompatible,
  owner-mismatch, other-trail, and missing-package decisions.
- Static integration tests confirm the online resume/pause lifecycle.
- Offline package tests require the session reader and recovery controls in the
  verified resource set.
- Package tests verify every beta.9 byte count and SHA-256 hash.

## Physical validation still required

Run the current two-route iPhone session in
`docs/testing/QA-04-iphone-offline-hike-session.md`. It verifies restoration
against the package revisions actually shipped rather than the historical
beta.9 implementation build. Repeat the same lifecycle on supported Android
Chrome when a device is available.
