# SEC-02 — Firestore emulator authorization tests

**Status:** Complete

**Decision date:** 2026-07-28

## Outcome

DoloPaws now executes its Firestore Security Rules against the real Firestore
Emulator in local development and continuous integration.

The suite uses:

- Firebase Web SDK `12.16.0`;
- Firebase Rules Unit Testing `5.0.1`;
- Firestore Emulator `1.21.0`;
- Java 21;
- the demo-only project ID `demo-dolopaws`.

The demo project ID is deliberate. The emulator runner enables strict
single-project mode, and a demo project has no production Firebase resources to
fall back to.

## Test matrix

Fifteen grouped scenarios cover:

| Area | Allow cases | Deny cases |
|---|---|---|
| Private user document | Owner create, read, update, and delete | Guest, other user, collection listing, role injection, oversized or malformed data |
| Anonymous hike event | Server timestamp only; public weekly query | Identity, precise location, updates |
| Hazard flag | Verified, unblocked account submits pending content; author edit/delete; visible/reported public read | Unverified or blocked account submission, self-publication, author spoofing, another author’s edits/deletes, invalid type/text |
| Moderator flag action | State and moderation metadata | Rewriting contribution content |
| Review and rating | Verified account creates one pending review per trail; author edit/delete; visible query | Unverified account, wrong document ID, invalid rating, another author, timestamp reset, self-publication, unfiltered public list |
| Trail photo | Verified account submits a bounded pending data image; visible query | Unverified account, remote URL, oversized caption, self-publication, unfiltered public list |
| Abuse report | Signed-in reporter create/get; moderator list/resolve | Guest, other user, reporter resolution, invalid target |
| Unknown collection | None | All reads and writes |

The suite seeds hidden and visible documents with rules disabled only for test
setup. Every asserted application operation runs with rules enabled.

## Duplicate and rate-sensitive policy

- Review IDs are `${trailId}_${uid}`, enforcing one review/rating per account
  and trail.
- An author may edit the review but cannot replace its original server
  timestamp to make it appear newer.
- Anonymous hike events contain only a server timestamp. They are a
  non-authoritative popularity hint and cannot affect safety, ranking,
  entitlement, or moderation decisions.
- Security Rules cannot reliably rate-limit repeated writes. Verified email,
  operator blocks, bounded schemas, and moderation states constrain impact, but App
  Check or a server-mediated rate limiter is required before community volume
  grows. Repeated flags/photos are therefore moderation inputs, not verified
  facts.

## Reproducible emulator runner

`npm run test:firestore-rules` starts the emulator, runs the isolated test file,
and always stops the process.

The runner downloads the official emulator archive only when its cache is
empty. Emulator version and SHA-256 are pinned in
`scripts/run-firestore-rules-tests.cjs`; a checksum mismatch stops the suite.
The Firebase CLI is not a project dependency. This keeps the test dependency
audit clean and avoids pulling deployment credentials or production project
selection into CI.

GitHub Actions:

1. installs Node dependencies with `npm ci`;
2. installs Temurin Java 21;
3. restores the versioned emulator cache when available;
4. runs normal Jest tests;
5. runs the Firestore emulator matrix separately.

## Production deployment

The deployment boundary was satisfied on 2026-07-28:

1. production rules and document shapes were compared with the repository;
2. explicit operator approval was recorded before each production change;
3. the indexes and AUTH-02 rules were deployed separately;
4. verified submission, pending privacy, manual approval, public visibility,
   and cleanup passed an end-to-end production test;
5. the prior rules source and ruleset remain recorded under `docs/rollbacks/`.
