# AUTH-03 — Server deletion and device cleanup

**Status:** Complete in code

**Implementation date:** 2026-08-06

## User contract

Account deletion and browser cleanup are separate operations. Before confirming
deletion, ORMA names both scopes and asks whether public offline maps should
remain on the current device.

Server deletion removes, in order:

1. private post-hike outcomes under `users/{uid}/outcomes`;
2. the private `users/{uid}` profile, including dog profiles, saved trails, and
   match history; and
3. the Firebase Authentication identity.

Community reviews, trail photos, hazard reports, abuse reports, and immutable
moderation audit records may remain for community safety or legal obligations.
The confirmation copy discloses that retention before the destructive action.

If private Firestore cleanup fails, the authentication identity is not deleted.
If identity deletion fails after private data was removed, the user receives an
explicit partial-completion message and a recovery action instead of a generic
error.

## Device choices

Both logout and account deletion provide an explicit shared-device choice:

- **Keep downloaded public maps** removes private local records but preserves
  verified public offline packages and their local lifecycle metadata.
- **Remove all ORMA local data** removes every `dolopaws-` local and session
  storage entry, all offline package caches and metadata, journals, active and
  completed hike records, pending outcomes and reports, analytics queues,
  photos, cached profile data, preferences, and device ownership metadata.

Cleanup never removes unrelated browser-origin keys. The settings-page logout
entry now routes through the same choice screen as every other logout entry.

## Completion receipt

After successful server deletion, the homepage reports one of three device
states: all ORMA data removed, public maps retained, or device cleanup
incomplete. The receipt parameters are removed from the URL after display.

## Verification

- `account-deletion.test.js` checks deletion ordering, partial-failure stages,
  disclosure copy, logout routing, and completion receipts.
- `local-data.test.js` checks private-record removal, map retention, full
  ORMA cleanup, and isolation from unrelated browser data.
- `firestore-security.test.js` verifies that owners can list and delete their
  private outcome records while updates remain forbidden.

