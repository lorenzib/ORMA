# AUTH-02 — Verified contributor eligibility

**Status:** Complete in repository; production deployment pending

**Decision date:** 2026-07-28

## Outcome

DoloPaws now separates ordinary account entitlement from community
contribution eligibility:

- any authenticated account may initiate and manage an offline trail package;
- a community contributor must have a verified Firebase email and the
  server-issued `contributor: true` custom claim;
- clients cannot grant, store, or edit that claim themselves;
- `suspended: true` prevents claim issuance and provides a revocation control;
- moderator claims remain manually administered and independent.

This implements eligibility to submit content. It does not make moderation
decisions. MOD-01 will change new reviews, photos, and applicable reports to a
pending state before public publication.

## Supported beta identities

| Provider | Eligibility |
|---|---|
| Email and password | Eligible after the Firebase verification link is completed |
| Google | Eligible when Firebase reports the Google email as verified |
| Any other provider | Ineligible until its verification semantics are reviewed and added explicitly |

New email/password accounts receive a verification email immediately. The
account settings page reports one of: verified, verification required,
activation required, temporarily unavailable, or suspended. It offers a resend
or retry action where recovery is possible.

## Trusted claim flow

1. The signed-in client reloads the Firebase user.
2. An unverified account receives recovery guidance and no Firestore write is
   attempted.
3. A verified account without a contributor claim calls
   `refreshContributorEligibility` in `europe-west1`.
4. The callable function retrieves the authoritative Firebase Auth user record.
5. It rejects disabled, suspended, unverified, and unsupported-provider
   accounts.
6. It merges `contributor: true` into existing trusted claims without replacing
   moderator or other claims.
7. The client force-refreshes its ID token before attempting the contribution.
8. Firestore Rules independently require `email_verified: true`,
   `contributor: true`, and no `suspended: true` claim.

If an ineligible account still has a contributor claim when it calls the
function, the function removes that claim. Requiring `email_verified` in the
rules also prevents an unverified token from relying on a stale contributor
claim.

## Recovery UX

- Signed out: log in and return to the intended contribution.
- Email unverified: open Account → Settings and resend the verification link.
- Verified but not activated: enable contributions or submit once to activate
  automatically.
- Network/function failure: retain the draft in the open form and retry.
- Suspended: do not retry; contact DoloPaws for review.

Downloads never call the contributor function and remain governed by AUTH-01.

## Tests and CI

- `auth-eligibility.test.js` verifies the client, entitlement, rule, and
  deployment contracts.
- `functions/contributor-eligibility.spec.cjs` tests verified providers,
  unverified/disabled/suspended/unsupported denials, and claim preservation.
- The Firestore Emulator confirms that an unverified token is denied even when
  it contains `contributor: true`.
- CI installs function dependencies and runs the backend policy tests
  separately from browser Jest tests.

Firebase Functions `7.3.0` and Firebase Admin `14.2.0` are pinned. A narrow
`brace-expansion` override removes the current high-severity transitive
advisory chain. The remaining current Firebase Admin advisories are moderate
and originate in storage-related transitive packages not invoked by this
Auth-only function; `npm audit --audit-level=high --prefix functions` must
remain clean.

## Production rollout

Repository completion does not deploy Firebase resources. Before enabling
contributions in production:

1. confirm the Firebase project is `dolopaws` and that Functions billing and
   the `europe-west1` region are acceptable;
2. configure Firebase App Check for the web application, then decide whether
   to enforce it on the callable function;
3. deploy `refreshContributorEligibility`;
4. smoke-test email/password verification and Google activation with test
   accounts;
5. compare and deploy Firestore indexes and rules using the SEC-01 safe-rollout
   procedure;
6. verify ordinary-account denial, verified-contributor submission, suspended
   denial, and moderator access;
7. retain the previous rules source for rollback.

No production deployment is part of AUTH-02 without explicit operator
approval.
