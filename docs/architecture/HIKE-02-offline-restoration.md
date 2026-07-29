# HIKE-02 — Restore, pause, and resume offline

**Status:** implemented in code; iPhone and Android physical validation remain
open.

## Outcome

An unfinished hike is no longer silently replaced after a refresh or browser
reopen. The interactive trail map offers explicit resume and discard actions.
While recording, the hiker can pause without finishing the hike and later
resume with the original start time and last saved progress.

The Lago di Carezza beta.7 package contains the same versioned session reader
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
- Package tests verify every beta.7 byte count and SHA-256 hash.

## Physical validation still required

On the iPhone 13 Pro:

1. Update Lago di Carezza to beta.7.
2. Start a hike and wait for a valid GPS fix.
3. Pause and resume it.
4. Close Safari, reopen the trail, and resume the saved hike.
5. Switch to airplane mode, open the downloaded map, and repeat
   resume/pause.
6. Discard the test hike and confirm the recovery panel disappears.

Repeat the same matrix on supported Android Chrome when a device is available.
