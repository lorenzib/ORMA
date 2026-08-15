# HIKE-04 — Durable completion before follow-up

**Status:** implemented in code; iPhone and Android physical validation remain
open.

## Outcome

Ending a hike now creates a small, durable completion record before ORMA
opens a journal or other optional follow-up. The active session is removed only
after that record is successfully stored.

If the completion write fails, the active session remains
`completion-pending` and the interface offers **Save completed hike** again.
Navigation does not begin from the failed path.

## Completion contract

Storage key: `dolopaws-hike-completions-v1`

Each record contains:

- schema version;
- deterministic completion ID derived from the active session ID;
- session, trail, package, and owner identifiers;
- start and completion timestamps;
- duration in seconds;
- final stored route progress in kilometres;
- completion status;
- optional follow-up status; and
- synchronization status.

No GPS coordinate history is added.

## Idempotency

The completion ID is `completion:<sessionId>`. Saving the same session again
returns the original record and does not change its completion time or create a
second hike.

The store rejects corrupt or incompatible data instead of overwriting it.
Storage exceptions return an error result without escaping into the hiking
interface.

## Ordering guarantee

The online and offline finish flows use this order:

1. mark the active session `completion-pending`;
2. write or retrieve the idempotent completion record;
3. if the write fails, retain the active session and show retry guidance;
4. if it succeeds, clear the active session;
5. only then show or navigate to optional follow-up.

Saving a journal entry marks `followUpStatus` as `journal-saved`. Explicitly
discarding the optional journal details marks it `discarded`; neither action
deletes the underlying completion.

## Offline behavior

Lago di Carezza beta.9 includes `/hike-completions.js` as a mandatory,
checksum-protected package resource. **Finish hike** is available in the
downloaded recovery controls.

An offline completion is saved with `syncStatus: pending` and remains available
to later synchronization work. The active session is cleared only after that
offline write succeeds.

## Automated evidence

`hike-completions.test.js` covers:

- complete timestamps, duration, trail, package, owner, and status;
- deterministic duplicate prevention;
- pending offline synchronization;
- journal-saved and discarded follow-up states;
- corrupt and incompatible stores;
- storage failure; and
- online ordering before active-session clearing and navigation.

Offline package tests require the completion resource and Finish control, and
verify that its save call precedes session clearing. Package tests verify every
beta.9 byte count and SHA-256 hash.

## Physical validation

On the iPhone 13 Pro:

1. Update Carezza to beta.9.
2. Start a short test hike and wait for a valid GPS fix.
3. Tap **End hike** and confirm the completion screen appears.
4. Repeat from the downloaded map in airplane mode using **Finish hike**.
5. Reopen the downloaded map and confirm the active-hike recovery panel no
   longer appears.

Do not create duplicate real walks merely to test idempotency; that case is
covered automatically. Repeat the physical matrix on supported Android Chrome
when available.
