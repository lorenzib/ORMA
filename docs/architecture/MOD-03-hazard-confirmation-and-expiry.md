# MOD-03 — Hazard confirmation and expiry

## Outcome

Community hazard reports can appear quickly after moderation without becoming
permanent trail facts. Publication state, evidence state, and expiry are
separate:

- moderation decides whether content is publicly visible;
- eligible community members can independently confirm or dispute it;
- DoloPaws review and official-source confirmation remain distinct;
- type-specific expiry removes stale reports from the active safety view; and
- the original report, private responses, and moderation audit remain stored.

Hazards continue to sit alongside the canonical DoloPaws trail assessment.
They do not change the recommendation score.

## Lifecycle contract

Every new `flags/{flagId}` document starts with:

- `status: pending`;
- `confirmationSource: community`;
- `confirmations: 0`;
- `disputes: 0`; and
- a bounded `expiresAt`.

The active public query requires both a public moderation state
(`visible` or `reported`) and `expiresAt` later than the current time. Firestore
Rules enforce the same boundary, so a modified client cannot read an expired
hazard as active. The list query uses a one-minute future cutoff so the Rules
request clock can prove the result set is unexpired; a report may therefore
leave the active list up to one minute before its stored expiry.

Legacy or expired visible hazards enter the moderator queue. An operator may
renew them as unconfirmed, mark them as DoloPaws-reviewed, mark an official
source, hide them, or remove them. This supplies lifecycle metadata to legacy
records without granting public access first.

## Type-specific expiry

| Hazard type | Active lifetime |
|---|---:|
| Dry water source | 7 days |
| Livestock guard dogs | 14 days |
| Dangerous terrain | 30 days |
| Lift refused a dog | 30 days |
| Other | 30 days |
| Not dog-friendly / access restriction | 90 days |

The browser computes the intended timestamp, while Firestore Rules enforce
that it is in the future and no later than the maximum for that hazard type.
Moderation renewal restarts the same type-specific period.

## Community confirmation

An email-verified, unblocked contributor can submit one immutable response at
`flags/{flagId}/responses/{uid}`:

- `confirm`; or
- `dispute`.

The original reporter cannot respond to their own report. A single atomic
batch creates the private response and increments exactly one public aggregate.
Rules require that the response did not exist before the batch and does exist
after it, preventing repeated counter increments.

Response documents are readable only by their owner and moderators. Public
trail pages receive aggregate counts, not responder identities.

The derived display states are:

- **Unconfirmed community report:** fewer than two aligned responses;
- **Confirmed by the community:** at least two confirmations and more
  confirmations than disputes;
- **Disputed by the community:** at least two disputes and disputes are not
  outnumbered by confirmations;
- **Reviewed by DoloPaws:** explicitly selected by a moderator; and
- **Confirmed by an official source:** explicitly selected by a moderator.

Official and DoloPaws labels take precedence over aggregate community wording,
but the community counts remain visible.

## Authorization

Firestore Rules enforce:

- verified-contributor eligibility for responses;
- one response per account and hazard;
- no self-confirmation by the original author;
- active, public, unexpired parent hazards;
- exact counter deltas in the same atomic batch;
- private response identities;
- immutable responses;
- moderator-only evidence-source labels and renewal; and
- maximum expiry by hazard type.

Authors may edit their pending content but cannot alter evidence source,
confirmation counts, expiry, or operator metadata.

## Verification

Automated coverage includes:

- type-specific expiry dates;
- expired and missing expiry behavior;
- distinct community, DoloPaws, and official labels;
- active-query and Rules expiry constraints;
- atomic response/counter writes;
- duplicate and self-response denial;
- response-identity privacy;
- moderator renewal of legacy records; and
- declared compound indexes.

The semantic Firestore suite remains in
`firestore-emulator.spec.cjs`. It requires Java 21 locally and is also intended
to run in CI. Production deployment requires both the Rules compiler and the
new `trailId + status + expiresAt` index to succeed.
