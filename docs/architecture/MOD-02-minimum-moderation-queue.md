# MOD-02 — Minimum moderation queue

## Outcome

`moderation.html` is a private operator surface for reviews, photos, and hazard
reports that are pending, reported, hidden, or removed. Visible content with
an open abuse report also enters the queue.

The page is not linked from the public navigation and asks search engines not
to index it. Those are usability measures only. Firestore authorization is the
actual security boundary.

## Authority

An operator must be signed in with the trusted Firebase Authentication custom
claim:

`moderator: true`

The client refreshes the ID token before loading the queue. Firestore Rules
independently require the same claim for private queue reads, content-state
decisions, abuse-report resolution, and audit creation. An ordinary,
unverified, or merely verified account cannot inspect the queue.

Custom claims require a trusted Admin SDK environment. They must never be
written from the website or stored in the client-writable user profile.

## Queue projection

Moderators can inspect only the fields needed for a decision:

- contribution type and ID;
- trail ID;
- author UID;
- creation timestamp and current state;
- review rating/text/date, hazard type/text/km, or photo/caption;
- open abuse-report reasons and timestamps.

Dog profile context, email addresses, owner details, and other account data are
not returned to the moderation page.

## Decisions

The interface supports:

- publish pending content;
- keep reported content visible and dismiss its reports;
- hide;
- remove;
- restore hidden or removed content; and
- record an optional internal decision note.

A single Firestore batch applies the content transition, resolves all attached
open reports, and creates the audit record. A failed batch applies none of
those writes.

## Audit trail

Every decision creates an immutable `moderationAudit/{auditId}` document with:

- content type and ID;
- trail ID and author UID;
- from/to states;
- moderator UID;
- bounded internal reason; and
- server timestamp.

Only moderators can read or create these records. Updates and deletions are
denied. Audit records deliberately exclude account profiles and email
addresses.

## Verification

Automated coverage checks:

- custom-claim enforcement on client and server;
- ordinary-user queue and audit denial;
- pending/reported/hidden/removed queue coverage;
- open abuse-report inclusion;
- bounded moderation-only projection;
- explicit publish, hide, remove, restore, and keep-visible actions;
- atomic decision, report-resolution, and audit writes;
- moderator identity binding and server timestamps;
- immutable audit records; and
- text-only rendering for untrusted submitted content.

The local Firestore emulator requires Java 21. When Java is unavailable,
Firebase's production rules compiler remains the deployment gate, while the
emulator assertions stay in CI.
