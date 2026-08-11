# MOD-01 — Community content states

## Decision

Reviews and ratings, trail photos, and hazard reports share this lifecycle:

`draft → pending → visible → reported → hidden → removed`

`draft` exists only in the local form. The first server write is always
`pending`; neither a verified contributor nor a modified client can publish
content directly.

For the beta, the first and every later review or photo remain pending until a
moderator approves them. This is deliberately stricter than a future trusted
contributor policy and makes the first-contribution rule enforceable without a
paid server function.

## Visibility and ratings

`visible` and `reported` are public. A report is an allegation awaiting a
moderation decision, so reported content carries an under-review label but is
not silently removed.

Only visible or reported reviews contribute to the displayed rating. Draft,
pending, hidden, and removed reviews are excluded by both the Firestore query
and the rendering layer.

Hazards now use `visible` rather than the legacy `active` name. A production
read before rollout found no legacy active hazard documents requiring
migration.

## Authority

Verified, unblocked contributors can:

- create only `pending` content;
- edit their own pending content; and
- edit published content only by returning it to `pending`.

Moderators can change only status and moderation metadata. Every transition
must belong to the explicit transition graph, use a server timestamp, and
record the moderator UID. Clients cannot set visible, reported, hidden, or
removed during creation.

## Contribution pages

The photo and hazard pages call the same Firebase contribution API as the
trail modal. They show success only after Firestore accepts a pending record.
The previous design-only local hazard record and the unsupported “visible
within the hour” promise were removed.

The dedicated review page also reads only public Firestore reviews and writes
through `DoloPawsCommunity.setReview`. It never inserts a submitted review into
the public list locally: successful submissions are labelled pending
moderation, and the page refreshes only the approved public query. The former
placeholder reviews and `dolopaws-design-reviews-*` local-storage path were
removed on 2026-08-11.

Optional hazard photos become separately pending trail-photo records. A
partial failure is reported truthfully: the accepted hazard remains submitted
while the user is told that an attachment failed.

## Verification

Automated coverage checks:

- canonical state and transition definitions;
- first-review, first-photo, and hazard pending policy;
- public/rating state filtering;
- contributor self-publication and visible-edit denial;
- moderator transition and metadata constraints;
- visible and reported public queries;
- real Firebase submission calls from the contribution pages; and
- absence of the former design-only success path.
