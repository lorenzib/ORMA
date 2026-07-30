# AUTH-02 — Verified contributor eligibility

**Status:** Complete and production-verified

**Decision date:** 2026-07-28

## Outcome

DoloPaws uses a Spark-compatible contribution policy that requires no Cloud
Functions or paid Firebase plan:

- any authenticated account may initiate and manage an offline trail package;
- community submission requires a Firebase-authenticated account whose email is
  verified;
- every new review, rating, trail photo, and hazard report starts as `pending`;
- pending content is invisible to public application queries;
- an operator approves or rejects submissions manually in the Firebase console;
- a private `contributionBlocks/{uid}` document prevents a verified account
  from submitting again.

Downloads and community eligibility remain separate. Authentication alone is
enough to download; verified email is required to contribute.

## Supported beta identities

| Provider | Eligibility |
|---|---|
| Email and password | Eligible after the Firebase verification link is completed |
| Google | Eligible when Firebase reports the Google email as verified |
| Any future provider | Ineligible until its verification behavior is reviewed |

New email/password accounts receive a verification email immediately. Account
settings show whether the address is verified and provide a resend action.

## Submission flow

1. The client reloads the signed-in Firebase user.
2. An unverified account receives a concrete email-verification recovery action.
3. A verified account submits well-formed content with `status: pending`.
4. Firestore Rules independently require `email_verified: true`.
5. The rules check that `contributionBlocks/{uid}` does not exist.
6. Public queries request only `visible` or `reported` contributions, so they
   cannot expose pending records.
7. The user sees confirmation that moderation is required.

Rules also reject a client attempt to create content directly as `visible`.
Editing previously published content returns it to `pending`, so the
changed version does not bypass moderation.

## Manual moderation on Spark

Until MOD-02 provides an operator dashboard, moderation happens in the Firebase
console:

1. Open Firestore and inspect `flags`, `reviews`, or `trailPhotos`.
2. Filter or locate documents whose `status` is `pending`.
3. Verify that the trail, author UID, text, rating, image, and timestamp are
   appropriate.
4. Approve a flag by changing `pending` to `visible`.
5. Approve a review or photo by changing `pending` to `visible`.
6. Reject content by changing it to `hidden` or `removed`.
7. Do not edit the author UID, trail ID, or original creation timestamp.

Firebase console operations use project administrator credentials and do not
depend on application-client moderator claims.

## Blocking an account

To prevent further submissions without exposing a public block list:

1. Copy the account UID from Firebase Authentication.
2. In Firestore, create `contributionBlocks/{uid}` using that UID as the
   document ID.
3. Add an internal reason and timestamp if useful to the operator.
4. Disable the account in Firebase Authentication if all account access should
   stop, not only community submissions.

Application clients cannot read or write `contributionBlocks`. Removing the
document restores contribution eligibility if the account remains verified and
enabled.

## Tests and CI

- `auth-eligibility.test.js` verifies email verification, pending submission,
  entitlement separation, recovery UX, and absence of a Functions dependency.
- The Firestore Emulator covers verified success; unverified and blocked
  denial; pending privacy; author ownership; and moderator state transitions.
- The normal CI pipeline runs without production credentials or a paid Firebase
  service.

## Production verification

The Spark-compatible flow was deployed and verified on 2026-07-28:

1. the previous rules source and ruleset were recorded for rollback;
2. production document shapes were compatible with the repository validators;
3. all four composite indexes reached `READY`;
4. the reviewed rules were deployed and matched the repository hash;
5. a verified account submitted a labelled review with `status: pending`;
6. an anonymous query was denied access to the pending review;
7. manual Firebase-console approval changed it to `visible`;
8. the live trail page rendered the approved review and rating;
9. the labelled test review was deleted and the public query returned to zero.

The live test exposed a first-review pre-read denial. Commit `e83b54d` corrected
the client creation fallback and limited pending-review reads to the document
owner. The 147 application tests, 15 emulator authorization tests, and
171-page static check passed before the corrective deployment.

No Blaze upgrade or Cloud Function deployment is required.
