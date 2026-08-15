# PRIV-01 — Retention and deletion contract

**Status:** Complete in code and policy

**Implementation date:** 2026-08-10

## Purpose

Every ORMA data category has an explicit purpose, storage location,
retention rule, and deletion path. The public explanation is in
`privacy.html#retention`; the account-deletion dialog links to it.

## Retention register

| Data | Purpose and location | Retention | Deletion path |
|---|---|---|---|
| Firebase Authentication identity | Login and account recovery; Firebase Authentication | While the account exists | Account cancellation after private Firestore deletion |
| Dog profiles, photos, saved trails and match history | Personalisation; private `users/{uid}` document, with device caches | While the account exists | Account cancellation deletes the document; device cleanup removes caches |
| Offline trail packages | Offline public route access; Cache Storage and local package metadata | Until the user removes them, the browser evicts them, or complete local cleanup is chosen | Per-package removal, all-download removal, or account/logout cleanup choice |
| Active hike | Crash and offline recovery; local storage only | Recoverable for 36 hours after the last update; stale data remains inert until replaced or local cleanup | Hike completion/replacement or local cleanup |
| Completed hikes and journal | Local walk history; local storage only | Until the user removes it or clears ORMA local data | Journal controls, browser storage controls, or local cleanup |
| Private post-hike outcomes | Product suitability learning; local pending queue and private `users/{uid}/outcomes` | Pending locally until sync/cleanup; server copy while account exists | Account cancellation deletes every outcome before the user document and auth identity |
| Reviews, trail photos and hazard reports | Community guidance and trail safety; owner-bound local queue before sync, then Firestore contribution collections | Locally until accepted or local cleanup; server-side while pending, published, or needed for contribution/safety history | Local cleanup removes unsynced items; owner or moderator removal handles accepted content; account cancellation does not cascade-delete accepted content |
| Abuse reports | Investigating community abuse; private `reports` collection | Up to 24 months after resolution; longer only for an active safety dispute or legal hold | Moderator/operator retention review |
| Moderation audit | Accountability for operator decisions; private immutable `moderationAudit` collection | Up to 24 months after the last action; longer only for an active dispute or legal hold | Privileged operator retention review; clients cannot alter audit history |
| Optional product analytics | Funnel diagnostics; consented local queue | Maximum 200 queued events; records older than 30 days are pruned on analytics activity | Consent withdrawal or local cleanup immediately removes the queue and client id |
| Anonymous hike-start counter | Seven-day public trail activity count; timestamp-only `hikeEvents` rows | Maximum 90 days | Monthly operator cleanup; only the most recent seven days are queried publicly |

## Moderation retention is separate from account deletion

Account cancellation removes the authentication identity and all private
account-scoped data. It does not automatically remove community contributions,
abuse reports, or moderation audits. This prevents an account cancellation from
silently erasing published trail evidence or the history needed to investigate
abuse. Retained records must not be repurposed and must be removed at the end of
their stated period unless an active safety dispute or legal duty requires a
temporary hold.

## Operator review

Until server-side TTL jobs replace the manual process, the operator performs a
monthly retention review:

1. delete anonymous hike-start events older than 90 days;
2. delete or minimise resolved abuse reports older than 24 months;
3. delete moderation audits older than 24 months unless a documented hold is
   active; and
4. review active holds and remove them as soon as their reason ends.

The public page calls these operator retention checks so it does not imply that
the browser or Firebase performs automatic deletion.

## Implementation evidence

- `hike-session.js` makes active hikes unrecoverable after 36 hours.
- `metrics.js` caps the analytics queue at 200 and prunes events after 30 days;
  withdrawing consent removes the queue and random identifier.
- `local-data.js` separates private local cleanup from optional public package
  removal and clears the owner-bound unsynced contribution queue.
- `account-deletion.js` deletes private outcomes, then the account document,
  then the Firebase Authentication identity.
- Firestore rules restrict private outcomes to their owner, community removal
  to owner/moderator roles, reports to reporters/moderators, and immutable audit
  records to moderators.

## Verification

`privacy-retention.test.js` locks the public retention promises, the deletion
distinction, the account-dialog link, and the implementation constants that can
be enforced locally.
