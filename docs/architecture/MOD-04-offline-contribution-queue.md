# MOD-04 — Offline community contribution queue

**Status:** Implemented in code; corrective Firestore rules deployment and
authenticated offline browser acceptance remain pending (2026-08-11)

## Outcome

Verified signed-in users do not lose a review, hazard report, or trail photo
when the network disappears during submission. The contribution is saved in an
owner-bound local queue, shown as **waiting to sync**, and retried when the
browser reconnects or the account session becomes available again.

Queued contributions remain private. The UI never says they are pending
moderation until Firestore accepts them.

## Queue contract

`offline-contributions.js` stores versioned, validated records under
`dolopaws-offline-contributions-v1`:

- each record has an owner UID, contribution type, bounded payload, creation
  time, and stable client ID;
- only the current owner's records are selected for synchronization;
- reviews, hazards, and photos use the same field and size limits as their
  server APIs;
- dedicated photo and hazard pages resize phone images to a maximum 900-pixel
  edge and bounded JPEG before upload or queuing;
- the queue is capped at 20 records and approximately 3.8 million serialized
  characters so a photo cannot expand storage without limit;
- a record is removed only after Firestore reports acceptance; and
- a failure stops the current pass and leaves the same stable ID for retry.

## Idempotency

Reviews already use the deterministic `trailId_uid` document ID. Hazard and
photo writes now use `uid_clientId`. Before a retry creates a document, the
owner checks that exact document; an existing record is treated as accepted.
The corrective rules allow an author to get their own non-public hazard or
photo by ID but still forbid listing non-public content. Other members and
guests cannot read it.

## Lifecycle and privacy

The queue retries on `online`, `dolopaws-auth-ready`, and signed-in
`dolopaws-auth-changed` events. Logout and account/device cleanup remove the
queue through `local-data.js`. Public offline trail packages never contain a
contribution or owner identifier.

## Verification

Automated coverage checks payload validation, owner isolation, retry stability,
idempotent enqueue, removal only after acceptance, storage caps, page loading
order, and author-only Firestore reads. Production acceptance still requires a
verified account test after the rules are deployed.
