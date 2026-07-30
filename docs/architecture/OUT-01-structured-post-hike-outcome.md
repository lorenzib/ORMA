# OUT-01 — Structured private post-hike outcome

## Decision

DoloPaws asks for a short, private check-in only after a hike completion has
been stored. This check-in is product evidence about whether the recommendation
suited the dog; it is not a public rating or review.

The required response is one of:

- appropriate;
- appropriate with unexpected cautions;
- not appropriate;
- did not complete;
- prefer not to answer.

Water accuracy and material hazards are optional structured follow-ups. Free
text, precise GPS positions, and dog profile fields are deliberately excluded.

## Durable local record

`post-hike-outcomes.js` stores an owner-bound record in
`dolopaws-post-hike-outcomes-v1`. Its identifier is deterministically derived
from the durable completion ID, so retrying cannot create a second outcome for
the same completed hike.

An outcome can only be created when:

- the hike completion has a valid completion and trail ID;
- an account owner is known;
- that owner matches any owner already attached to the completion; and
- the primary response belongs to the fixed response set.

The local record exposes either `pending` or `synced`. A failed upload remains
pending for the same owner and is retried on reconnect or authentication.

## Online and downloaded trail experience

The regular completion screen and the downloaded Lago di Carezza trail both
use the same record contract. The downloaded page explicitly says that the
record is stored privately and pending synchronization until reconnection.
Saving a check-in never blocks or replaces the durable hike completion.

The optional METRIC-01 event records only the same bounded categories and is
still subject to the user's analytics consent. The private outcome itself does
not depend on analytics consent.

## Firestore boundary

Synchronized records live at:

`users/{uid}/outcomes/{outcomeId}`

Rules allow only the owner to create, read, list, or delete a record. The
client must provide the exact structured field set, the path owner must match
the authenticated user, and updates are denied. Deterministic create-or-read
sync makes a retry idempotent without allowing mutable outcome history.

The public `reviews` collection is not used. Publishing community content
remains a separate, moderated action under the MOD epic.

## Verification

Automated coverage checks:

- all five primary responses and optional field filtering;
- owner mismatch rejection and no free-text persistence;
- one-record-per-completion idempotency;
- pending, retry, and synchronized queue states;
- corrupt or incompatible local-store handling;
- Firestore owner isolation, immutable schema, and rejected extra fields;
- inclusion and checksum verification in the downloaded trail package; and
- visible private/pending wording in both completion paths.
