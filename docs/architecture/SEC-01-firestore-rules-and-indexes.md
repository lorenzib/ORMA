# SEC-01 — Firestore rules and indexes

**Status:** Complete in the repository; not deployed

**Decision date:** 2026-07-28

## Outcome

DoloPaws now stores its Firestore authorization boundary in version control:

- `firestore.rules`;
- `firestore.indexes.json`;
- `firebase.json`.

The configuration targets the existing Firebase project ID `dolopaws`, but no
production rule or index deployment is part of SEC-01. Deployment is blocked
until SEC-02 runs allow-and-deny cases against the Firestore emulator.

## Authority model

Firebase Authentication establishes identity. Two server-issued custom claims
establish privileged roles:

| Claim | Meaning |
|---|---|
| `contributor: true` | AUTH-02 has established eligibility to publish community content |
| `moderator: true` | The account may inspect moderation inputs and change moderation states |

Neither claim is stored in a user document. A web client cannot make itself a
contributor or moderator by writing Firestore data. The administrative process
that grants and revokes claims is AUTH-02 work and must use trusted server-side
credentials.

## Collection policy

| Path | Read policy | Write policy |
|---|---|---|
| `users/{uid}` | Owner only; collection listing denied | Owner only, validated keys and bounded maps/lists |
| `hikeEvents/{trailId}/events/{id}` | Public aggregate source; contains only a timestamp | Anonymous create with server timestamp only; no update |
| `flags/{id}` | Active reports are public; moderators may inspect all | Eligible contributor owns content; moderator owns state |
| `reviews/{trailId_uid}` | Visible reviews are public; moderators may inspect all | One review per eligible contributor and trail |
| `trailPhotos/{id}` | Visible photos are public; moderators may inspect all | Eligible contributor owns content; moderator owns state |
| `reports/{id}` | Reporter may get their report; moderators may list | Any signed-in account may open a bounded abuse report; only moderators resolve it |

All unmatched paths deny reads and writes. New collections therefore start
private until a reviewed rule is added.

## Validation boundaries

The rules enforce:

- authenticated ownership for private account data;
- allowlisted document keys;
- upper bounds for favourites, saved matches, legacy dogs, text, photos, and
  trail-distance markers;
- allowlisted hazard types and content states;
- one deterministic review document per account and trail;
- immutable contribution author and trail identity;
- author updates that cannot change moderation state or metadata;
- moderator updates limited to state and moderation metadata;
- public reads limited to the active or visible state;
- server timestamps for new public content and anonymous hike events;
- hike events containing neither identity nor location.

Firestore Rules cannot provide a reliable per-user rate limiter. App Check,
server-mediated limits, duplicate-write policy, and emulator coverage remain
SEC-02 and moderation follow-on work.

## Index policy

Explicit indexes cover the current trail/status queries for flags, reviews, and
photos, plus the planned moderation queue ordered by creation time. Index
definitions are deployed from the repository rather than being maintained only
in the Firebase console.

## Safe rollout

1. Install the Firebase CLI and Firestore emulator locally.
2. Run SEC-02's complete allow-and-deny suite against a demo project ID.
3. Export or otherwise record the rules and indexes currently active in
   project `dolopaws`.
4. Compare the production collection shapes with the validators in
   `firestore.rules`; migrate incompatible records before tightening access.
5. Deploy indexes first and wait until they finish building.
6. Re-run read queries against a non-production Firebase project.
7. Review the exact rules diff and deploy rules separately:

   ```sh
   firebase deploy --only firestore:rules --project dolopaws
   ```

8. Immediately verify owner reads/writes, public visible-content reads,
   ordinary-account denials, contributor publication, and moderator state
   changes.
9. Roll back by redeploying the previously recorded rules source if a required
   path is denied unexpectedly.

The Firebase CLI overwrites console-managed rules during deployment, so console
and repository edits must never diverge. A production deployment requires
explicit operator approval; routine website deployment must not implicitly
publish Firestore rules.

## Follow-ons

- **SEC-02:** complete; semantic emulator tests cover unauthenticated, owner,
  other-user, contributor, moderator, malformed, query, and transition cases.
- **AUTH-02:** complete in repository; trusted contributor-claim eligibility
  and recovery UX await an approved function-and-rules deployment.
- **MOD-01/02:** pending/visible policy, moderation queue, and audit records.
- **AUTH-03:** complete cross-collection server deletion and local cleanup.
