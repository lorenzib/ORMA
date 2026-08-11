# JOURNAL-01 — Private local walk journal

Status: complete for beta (2026-08-11)

## Decision

Walk-journal records stay in the current browser and are never silently synced
to Firestore. A journal key includes the authenticated Firebase UID, preventing
one account from displaying another account's entries on the same device.

This is intentional for beta. Completed walks may reveal dates, locations,
routes, notes, dog-health context, photos, duration, and distance. DoloPaws will
not introduce server retention for that sensitive history until cross-device
sync has a separate consent, retention, deletion, conflict, and security design.

## Data flow

- Manual journal entries, free walk recordings, and completed Hike Mode walks
  write to `dolopaws-journal-<uid>` in browser local storage.
- The journal reads only the current authenticated user's namespaced key.
- Photos are resized before being embedded in the local entry.
- “Download my data” includes the current account's local journal.
- “Remove all local data” removes every namespaced journal key.
- Account deletion removes private local records even when the user elects to
  retain downloaded public trail packages.
- Sharing a walk card is an explicit user action and does not change journal
  storage or create a public journal record.

## User-facing truth

The journal states that entries are stored in this browser for the account. The
privacy page states that completed hikes and journal entries do not sync to the
server and remain until local removal or browser-data cleanup.

## Future sync gate

Cross-device journal synchronization requires a new scoped decision covering:

1. explicit opt-in and a useful no-sync mode;
2. encryption and owner-only authorization;
3. bounded record and photo retention;
4. offline conflict and retry semantics;
5. per-entry and bulk deletion across devices; and
6. revised data export and privacy disclosures.

It is not implied by signing in and is not part of the current beta.

